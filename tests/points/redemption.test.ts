/**
 * Đổi quà: quyền xem/đổi, số dư, kho, giới hạn tháng, bấm đồng thời, huỷ/từ chối/trao/hết hạn (DB local).
 */
import { test, describe, after } from "node:test";
import assert from "node:assert/strict";
import { prisma } from "@/lib/prisma";
import { POINTS } from "@/lib/points/config";
import { closeWithRefund, deliverInTx, expireStaleRedemptions, redeemInTx, rejectInTx } from "@/lib/points/redemption";
import { createFixture, disconnect } from "../helpers/fixtures";

const fx = createFixture();
after(async () => {
  await fx.cleanup();
  await disconnect();
});

const redeem = (userId: string, rewardId: string) => prisma.$transaction((tx) => redeemInTx(tx, userId, rewardId));
const close = (id: string, status: "CANCELLED" | "REJECTED" | "EXPIRED") => prisma.$transaction((tx) => closeWithRefund(tx, id, status));
const richStudent = async (points = 100, opts: Parameters<typeof fx.user>[0] = {}) => {
  const s = await fx.user(opts);
  await fx.give(s.id, points);
  return s;
};
const consistent = async (userId: string) => assert.equal(await fx.balance(userId), await fx.ledgerSum(userId), "ví khớp sổ");

describe("Đổi quà thành công", () => {
  test("trừ điểm, trừ kho, ghi sổ, tạo yêu cầu chờ trao, bỏ ghim mục tiêu", async () => {
    const s = await richStudent(50);
    const r = await fx.reward({ price: 30, stock: 3 });
    await prisma.pointWallet.update({ where: { userId: s.id }, data: { goalRewardId: r.id } });
    const res = await redeem(s.id, r.id);
    assert.equal(res.success, true);
    assert.equal(await fx.balance(s.id), 20);
    assert.equal((await prisma.reward.findUnique({ where: { id: r.id } }))!.stock, 2);
    const red = await prisma.redemption.findFirstOrThrow({ where: { userId: s.id } });
    assert.equal(red.status, "PENDING");
    assert.equal(red.price, 30);
    assert.equal((await fx.wallet(s.id))!.goalRewardId, null);
    await consistent(s.id);
  });

  test("quà không giới hạn số lượng: kho vẫn null", async () => {
    const s = await richStudent();
    const r = await fx.reward({ price: 10, stock: null });
    assert.equal((await redeem(s.id, r.id)).success, true);
    assert.equal((await prisma.reward.findUnique({ where: { id: r.id } }))!.stock, null);
  });

  test("giáo viên đổi giá sau khi học sinh đổi → yêu cầu giữ giá cũ, hoàn đúng giá cũ", async () => {
    const s = await richStudent(50);
    const r = await fx.reward({ price: 30 });
    await redeem(s.id, r.id);
    await prisma.reward.update({ where: { id: r.id }, data: { price: 5 } });
    const red = await prisma.redemption.findFirstOrThrow({ where: { userId: s.id } });
    await close(red.id, "CANCELLED");
    assert.equal(await fx.balance(s.id), 50);
  });
});

describe("Không được đổi", () => {
  test("không đủ điểm → báo thiếu bao nhiêu, không thay đổi gì", async () => {
    const s = await richStudent(10);
    const r = await fx.reward({ price: 30, stock: 1 });
    const res = await redeem(s.id, r.id);
    assert.equal(res.success, false);
    assert.match((res as any).error, /thêm 20 điểm/);
    assert.equal(await fx.balance(s.id), 10);
    assert.equal((await prisma.reward.findUnique({ where: { id: r.id } }))!.stock, 1);
  });

  test("số dư âm (bị trừ điểm) → không đổi được quà nào", async () => {
    const s = await richStudent(-5);
    const r = await fx.reward({ price: 1 });
    assert.equal((await redeem(s.id, r.id)).success, false);
  });

  test("hết kho", async () => {
    const s = await richStudent();
    const r = await fx.reward({ price: 1, stock: 0 });
    assert.equal((await redeem(s.id, r.id)).success, false);
    assert.equal(await fx.balance(s.id), 100);
  });

  test("học sinh chưa duyệt / demo / giáo viên không đổi được", async () => {
    const r = await fx.reward({ price: 1, kind: "VIRTUAL" });
    for (const opts of [{ isApproved: false }, { isDemo: true }, { role: "TEACHER" as const }]) {
      const u = await richStudent(100, opts);
      assert.equal((await redeem(u.id, r.id)).success, false, JSON.stringify(opts));
    }
  });

  test("quà đã ẩn / đã xoá / không tồn tại", async () => {
    const s = await richStudent();
    const hidden = await fx.reward({ isActive: false });
    const deleted = await fx.reward({ deletedAt: new Date() });
    for (const id of [hidden.id, deleted.id, "khong-ton-tai"]) assert.equal((await redeem(s.id, id)).success, false, id);
    assert.equal(await fx.balance(s.id), 100);
  });
});

describe("Ai thấy quà nào", () => {
  test("quà hiện vật: chỉ học sinh OFFLINE; quà 'Mọi học sinh': cả ONLINE", async () => {
    const online = await richStudent(100, { studentType: "ONLINE" });
    const offline = await richStudent(100, { studentType: "OFFLINE" });
    const physical = await fx.reward({ price: 1, kind: "PHYSICAL" });
    const virtual = await fx.reward({ price: 1, kind: "VIRTUAL" });
    assert.equal((await redeem(online.id, physical.id)).success, false);
    assert.equal((await redeem(online.id, virtual.id)).success, true);
    assert.equal((await redeem(offline.id, physical.id)).success, true);
    assert.equal((await redeem(offline.id, virtual.id)).success, true);
  });

  test("quà riêng cho lớp: chỉ lớp đó; quà không chọn lớp: mọi lớp và cả HS chưa xếp lớp", async () => {
    const a = await fx.cls();
    const b = await fx.cls();
    const inA = await richStudent(100, { classId: a.id });
    const inB = await richStudent(100, { classId: b.id });
    const noClass = await richStudent(100, { classId: null });
    const onlyA = await fx.reward({ price: 1, classIds: [a.id] });
    const all = await fx.reward({ price: 1 });
    assert.equal((await redeem(inA.id, onlyA.id)).success, true);
    assert.equal((await redeem(inB.id, onlyA.id)).success, false);
    assert.equal((await redeem(noClass.id, onlyA.id)).success, false);
    for (const u of [inA, inB, noClass]) assert.equal((await redeem(u.id, all.id)).success, true);
  });
});

describe("Giới hạn mỗi tháng", () => {
  test("đủ lượt → chặn; huỷ yêu cầu thì được đổi lại; yêu cầu tháng trước không tính", async () => {
    const s = await richStudent();
    const r = await fx.reward({ price: 5, perStudentMonthlyLimit: 1 });
    assert.equal((await redeem(s.id, r.id)).success, true);
    const second = await redeem(s.id, r.id);
    assert.equal(second.success, false);
    assert.match((second as any).error, /Mỗi tháng/);
    const red = await prisma.redemption.findFirstOrThrow({ where: { userId: s.id, rewardId: r.id } });
    await close(red.id, "CANCELLED");
    assert.equal((await redeem(s.id, r.id)).success, true, "huỷ rồi thì đổi lại được");
    await prisma.redemption.updateMany({ where: { userId: s.id, rewardId: r.id }, data: { createdAt: new Date(Date.now() - 40 * 86400000) } });
    assert.equal((await redeem(s.id, r.id)).success, true, "lượt tháng trước không tính");
  });
});

describe("Bấm đồng thời", () => {
  test("còn 1 quà, 5 bạn cùng đổi → đúng 1 bạn được, kho = 0, không ai mất điểm oan", async () => {
    const r = await fx.reward({ price: 10, stock: 1 });
    const students = await Promise.all(Array.from({ length: 5 }, () => richStudent(10)));
    const res = await Promise.all(students.map((s) => redeem(s.id, r.id)));
    assert.equal(res.filter((x) => x.success).length, 1);
    assert.equal((await prisma.reward.findUnique({ where: { id: r.id } }))!.stock, 0);
    const balances = await Promise.all(students.map((s) => fx.balance(s.id)));
    assert.deepEqual(balances.sort(), [0, 10, 10, 10, 10]);
  });

  test("một bạn bấm 'Đổi' 5 lần liền, đủ điểm cho 2 món → đúng 2 món, số dư không âm", async () => {
    const s = await richStudent(20);
    const r = await fx.reward({ price: 10 });
    const res = await Promise.all(Array.from({ length: 5 }, () => redeem(s.id, r.id)));
    assert.equal(res.filter((x) => x.success).length, 2);
    assert.equal(await fx.balance(s.id), 0);
    await consistent(s.id);
  });

  test("giới hạn 1 lần/tháng, bấm 3 lần cùng lúc → chỉ 1", async () => {
    const s = await richStudent(100);
    const r = await fx.reward({ price: 5, perStudentMonthlyLimit: 1 });
    const res = await Promise.all(Array.from({ length: 3 }, () => redeem(s.id, r.id)));
    assert.equal(res.filter((x) => x.success).length, 1);
  });
});

describe("Huỷ / từ chối / trao / hết hạn", () => {
  async function pending(price = 10, stock: number | null = 5) {
    const s = await richStudent(price);
    const r = await fx.reward({ price, stock });
    await redeem(s.id, r.id);
    const red = await prisma.redemption.findFirstOrThrow({ where: { userId: s.id } });
    return { s, r, red };
  }

  test("huỷ: hoàn điểm + hoàn kho; huỷ lần 2 không hoàn thêm", async () => {
    const { s, r, red } = await pending(10, 5);
    assert.equal(await close(red.id, "CANCELLED"), true);
    assert.equal(await close(red.id, "CANCELLED"), false);
    assert.equal(await fx.balance(s.id), 10);
    assert.equal((await prisma.reward.findUnique({ where: { id: r.id } }))!.stock, 5);
    await consistent(s.id);
  });

  test("quà không giới hạn: hoàn điểm, kho vẫn null", async () => {
    const { r, red } = await pending(10, null);
    await close(red.id, "CANCELLED");
    assert.equal((await prisma.reward.findUnique({ where: { id: r.id } }))!.stock, null);
  });

  test("từ chối bắt buộc lý do; hoàn điểm; học sinh nhận thông báo", async () => {
    const { s, red } = await pending();
    const staff = await fx.user({ role: "TEACHER" });
    const noNote = await prisma.$transaction((tx) => rejectInTx(tx, red.id, "   ", staff.id));
    assert.equal(noNote.success, false);
    const ok = await prisma.$transaction((tx) => rejectInTx(tx, red.id, "Hết hàng", staff.id));
    assert.equal(ok.success, true);
    const after = await prisma.redemption.findUniqueOrThrow({ where: { id: red.id } });
    assert.equal(after.status, "REJECTED");
    assert.equal(after.note, "Hết hàng");
    assert.equal(after.handledById, staff.id);
    assert.equal(await fx.balance(s.id), 10);
    assert.equal(await prisma.notification.count({ where: { userId: s.id, title: { contains: "từ chối" } } }), 1);
    const again = await prisma.$transaction((tx) => rejectInTx(tx, red.id, "lần 2", staff.id));
    assert.equal(again.success, false);
    assert.equal(await fx.balance(s.id), 10);
  });

  test("hai thầy cùng từ chối một yêu cầu → hoàn đúng 1 lần", async () => {
    const { s, red } = await pending();
    const staff = await fx.user({ role: "TEACHER" });
    const res = await Promise.all([1, 2, 3].map(() => prisma.$transaction((tx) => rejectInTx(tx, red.id, "x", staff.id))));
    assert.equal(res.filter((r) => r.success).length, 1);
    assert.equal(await fx.balance(s.id), 10);
  });

  test("trao quà: chỉ yêu cầu đang chờ; yêu cầu đã huỷ bị bỏ qua và KHÔNG nhận thông báo", async () => {
    const a = await pending();
    const b = await pending();
    const staff = await fx.user({ role: "TEACHER" });
    await close(b.red.id, "CANCELLED");
    const done = await prisma.$transaction((tx) => deliverInTx(tx, [a.red.id, b.red.id, a.red.id], staff.id));
    assert.equal(done, 1);
    assert.equal((await prisma.redemption.findUniqueOrThrow({ where: { id: a.red.id } })).status, "DELIVERED");
    assert.equal((await prisma.redemption.findUniqueOrThrow({ where: { id: b.red.id } })).status, "CANCELLED");
    assert.equal(await prisma.notification.count({ where: { userId: a.s.id, title: { contains: "Đã nhận quà" } } }), 1);
    assert.equal(await prisma.notification.count({ where: { userId: b.s.id, title: { contains: "Đã nhận quà" } } }), 0);
    assert.equal(await prisma.$transaction((tx) => deliverInTx(tx, [a.red.id], staff.id)), 0, "trao lần 2 không làm gì");
    assert.equal(await close(a.red.id, "CANCELLED"), false, "đã trao thì không huỷ/hoàn được");
    assert.equal(await fx.balance(a.s.id), 0);
  });

  test("hết hạn: yêu cầu chờ quá hạn được hoàn; yêu cầu mới giữ nguyên", async () => {
    const old = await pending();
    const fresh = await pending();
    await prisma.redemption.update({ where: { id: old.red.id }, data: { createdAt: new Date(Date.now() - (POINTS.pendingExpiryDays + 1) * 86400000) } });
    await expireStaleRedemptions();
    assert.equal((await prisma.redemption.findUniqueOrThrow({ where: { id: old.red.id } })).status, "EXPIRED");
    assert.equal((await prisma.redemption.findUniqueOrThrow({ where: { id: fresh.red.id } })).status, "PENDING");
    assert.equal(await fx.balance(old.s.id), 10);
    assert.equal(await fx.balance(fresh.s.id), 0);
  });
});
