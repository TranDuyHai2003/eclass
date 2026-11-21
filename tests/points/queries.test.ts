/**
 * Dữ liệu hiển thị: trang Điểm thưởng của học sinh, dải trang chủ, màn kết quả, trang quản lý của thầy (DB local).
 */
import { test, describe, after } from "node:test";
import assert from "node:assert/strict";
import { prisma } from "@/lib/prisma";
import { POINTS } from "@/lib/points/config";
import { getHeaderPoints, getPointsCard, getPointsForAttempt, getStudentPointsPage, getTeacherRewardsPage } from "@/lib/points/queries";
import { redeemInTx } from "@/lib/points/redemption";
import { getWeekCode } from "@/lib/ranking/history-engine";
import { createFixture, disconnect } from "../helpers/fixtures";

const fx = createFixture();
after(async () => {
  await fx.cleanup();
  await disconnect();
});

describe("Trang Điểm thưởng của học sinh", () => {
  test("học sinh mới: ví rỗng, không lỗi", async () => {
    const s = await fx.user();
    const d = await getStudentPointsPage(s.id);
    assert.equal(d.wallet.balance, 0);
    assert.equal(d.wallet.weekStreak, 0);
    assert.equal(d.canEarn, true);
    assert.deepEqual(d.ledger, []);
    assert.equal(d.goal, null);
  });

  test("chỉ thấy quà dành cho mình; đếm lượt đã đổi tháng này; quà mục tiêu", async () => {
    const c = await fx.cls();
    const other = await fx.cls();
    const s = await fx.user({ classId: c.id, studentType: "ONLINE" });
    await fx.give(s.id, 100);
    const virtual = await fx.reward({ price: 10, kind: "VIRTUAL", perStudentMonthlyLimit: 2 });
    const physical = await fx.reward({ price: 10, kind: "PHYSICAL" });
    const otherClass = await fx.reward({ price: 10, kind: "VIRTUAL", classIds: [other.id] });
    const hidden = await fx.reward({ price: 10, kind: "VIRTUAL", isActive: false });
    await prisma.$transaction((tx) => redeemInTx(tx, s.id, virtual.id));
    await prisma.pointWallet.update({ where: { userId: s.id }, data: { goalRewardId: virtual.id } });

    const d = await getStudentPointsPage(s.id);
    const ids = d.rewards.map((r) => r.id);
    assert.ok(ids.includes(virtual.id));
    for (const r of [physical, otherClass, hidden]) assert.ok(!ids.includes(r.id), "không thấy quà không dành cho mình");
    assert.equal(d.rewards.find((r) => r.id === virtual.id)!.usedThisMonth, 1);
    assert.equal(d.isOffline, false);
    assert.equal(d.goal?.id, virtual.id);
    assert.equal(d.redemptions.length, 1);
    assert.equal(d.redemptions[0].status, "PENDING");
    assert.equal(typeof d.redemptions[0].createdAt, "string", "ngày dạng chuỗi để truyền xuống client");
    assert.equal(d.ledger[0].source, "REDEEM", "lịch sử mới nhất lên đầu");
  });

  test("học sinh chưa duyệt: canEarn = false", async () => {
    const s = await fx.user({ isApproved: false });
    assert.equal((await getStudentPointsPage(s.id)).canEarn, false);
  });

  test("chuỗi hiển thị: còn giữ nếu tuần gần nhất là tuần này/tuần trước; đứt thì hiện 0", async () => {
    const mk = async (lastStreakWeek: string, streakFreezes = 0) => {
      const s = await fx.user();
      await prisma.pointWallet.create({ data: { userId: s.id, weekStreak: 5, lastStreakWeek, streakFreezes } });
      return (await getStudentPointsPage(s.id)).wallet.weekStreak;
    };
    assert.equal(await mk(getWeekCode(new Date(), 0)), 5);
    assert.equal(await mk(getWeekCode(new Date(), -1)), 5);
    assert.equal(await mk(getWeekCode(new Date(), -2), 1), 5, "còn thẻ giữ chuỗi");
    assert.equal(await mk(getWeekCode(new Date(), -2), 0), 0);
    assert.equal(await mk(getWeekCode(new Date(), -3), 2), 0);
  });

  test("tiến độ tuần: đếm số lần nộp bài tuần này", async () => {
    const s = await fx.user();
    await prisma.pointLedger.createMany({ data: [
      { userId: s.id, amount: 2, source: "TEST_SUBMIT" },
      { userId: s.id, amount: 3, source: "TEST_SCORE" },
    ] });
    const d = await getStudentPointsPage(s.id);
    assert.equal(d.wallet.weekActivities, 1);
    assert.equal(d.wallet.weekTarget, POINTS.streak.minActivities);
    assert.equal(d.wallet.thisWeekCounted, false);
  });
});

describe("Dải điểm trang chủ & màn kết quả", () => {
  test("dải trang chủ: số dư, quà mục tiêu (bỏ qua nếu quà đã xoá)", async () => {
    const s = await fx.user();
    await fx.give(s.id, 30);
    const r = await fx.reward({ price: 80 });
    await prisma.pointWallet.update({ where: { userId: s.id }, data: { goalRewardId: r.id } });
    let card = await getPointsCard(s.id);
    assert.equal(card.balance, 30);
    assert.equal(card.goal?.price, 80);
    await prisma.reward.update({ where: { id: r.id }, data: { deletedAt: new Date() } });
    card = await getPointsCard(s.id);
    assert.equal(card.goal, null);
    // Học sinh mới: không so "shop" (file test khác chạy song song có thể đang tạo/xoá quà → danh sách đổi giữa 2 lần gọi)
    const { shop, ...fresh } = await getPointsCard((await fx.user()).id);
    assert.ok(Array.isArray(shop));
    assert.deepEqual(fresh, {
      balance: 0, lifetimeEarned: 0, weekStreak: 0, weekActivities: 0, weekTarget: POINTS.streak.minActivities, thisWeekCounted: false, goal: null,
    });
  });

  test("màn kết quả: chỉ điểm cộng của đúng lượt làm, đúng học sinh", async () => {
    const s = await fx.user();
    const other = await fx.user();
    await prisma.pointLedger.createMany({ data: [
      { userId: s.id, amount: 2, source: "TEST_SUBMIT", refId: "A1" },
      { userId: s.id, amount: 1, source: "TEST_SCORE", refId: "A1" },
      { userId: s.id, amount: -3, source: "REVOKE", refId: "A1" },
      { userId: s.id, amount: 2, source: "TEST_SUBMIT", refId: "A2" },
      { userId: other.id, amount: 2, source: "TEST_SUBMIT", refId: "A1" },
    ] });
    const rows = await getPointsForAttempt(s.id, "A1");
    assert.deepEqual(rows.map((r) => [r.source, r.amount]).sort(), [["TEST_SCORE", 1], ["TEST_SUBMIT", 2]]);
  });
});

describe("Thẻ chào trang chủ: quà gợi ý & quà mục tiêu", () => {
  // Giá 0 → luôn rẻ hơn mọi quà thật trong DB local (giá ≥ 1); quà của từng bài test gắn lớp riêng để không lẫn nhau
  const shopIds = async (userId: string) => (await getPointsCard(userId)).shop.map((r) => r.id);

  test("3 món rẻ nhất, theo thứ tự; bỏ món đang là mục tiêu; không có quà lớp khác / hiện vật với HS online", async () => {
    const c = await fx.cls();
    const other = await fx.cls();
    const s = await fx.user({ classId: c.id, studentType: "ONLINE" });
    const goal = await fx.reward({ price: 0, kind: "VIRTUAL", classIds: [c.id] });
    const v2 = await fx.reward({ price: 0, kind: "VIRTUAL", classIds: [c.id] });
    const v3 = await fx.reward({ price: 0, kind: "VIRTUAL", classIds: [c.id] });
    const v4 = await fx.reward({ price: 0, kind: "VIRTUAL", classIds: [c.id] });
    const phys = await fx.reward({ price: 0, kind: "PHYSICAL" });
    const otherCls = await fx.reward({ price: 0, kind: "VIRTUAL", classIds: [other.id] });
    await prisma.pointWallet.create({ data: { userId: s.id, goalRewardId: goal.id } });
    const ids = await shopIds(s.id);
    assert.deepEqual(ids, [v2.id, v3.id, v4.id]);
    assert.ok(!ids.includes(phys.id) && !ids.includes(otherCls.id));
  });

  test("bỏ quà hết hàng và quà đã hết lượt đổi trong tháng (hồi quy review Gemini)", async () => {
    const s = await fx.user();
    await fx.give(s.id, 50);
    const soldOut = await fx.reward({ price: 0, stock: 0 });
    const limited = await fx.reward({ price: 0, perStudentMonthlyLimit: 1 });
    const ok = await fx.reward({ price: 0, stock: 2 });
    await prisma.redemption.create({ data: { userId: s.id, rewardId: limited.id, price: 0 } });
    const ids = await shopIds(s.id);
    assert.ok(!ids.includes(soldOut.id), "quà hết hàng không được gợi ý");
    assert.ok(!ids.includes(limited.id), "quà hết lượt tháng này không được gợi ý");
    assert.ok(ids.includes(ok.id), "quà còn hàng vẫn được gợi ý");
  });

  test("quà mục tiêu không còn dành cho học sinh (đổi sang online / quà riêng lớp khác) → không hiện, khớp /rewards (hồi quy review Gemini)", async () => {
    const c = await fx.cls();
    const other = await fx.cls();
    const s = await fx.user({ classId: c.id, studentType: "OFFLINE" });
    const phys = await fx.reward({ price: 5, kind: "PHYSICAL" });
    await prisma.pointWallet.create({ data: { userId: s.id, goalRewardId: phys.id } });
    assert.equal((await getPointsCard(s.id)).goal?.price, 5);
    await prisma.user.update({ where: { id: s.id }, data: { studentType: "ONLINE" } });
    assert.equal((await getPointsCard(s.id)).goal, null, "học sinh chuyển online không còn thấy quà nhận tại lớp");
    const onlyOther = await fx.reward({ price: 5, kind: "VIRTUAL", classIds: [other.id] });
    await prisma.pointWallet.update({ where: { userId: s.id }, data: { goalRewardId: onlyOther.id } });
    assert.equal((await getPointsCard(s.id)).goal, null, "quà riêng của lớp khác");
    assert.equal((await getStudentPointsPage(s.id)).goal, null, "trang /rewards cũng vậy");
  });
});

describe("Chip điểm trên header", () => {
  test("số dư và tổng đã kiếm; học sinh mới = 0", async () => {
    const s = await fx.user();
    assert.deepEqual(await getHeaderPoints(s.id), { balance: 0, lifetimeEarned: 0 });
    await fx.give(s.id, 30);
    assert.deepEqual(await getHeaderPoints(s.id), { balance: 30, lifetimeEarned: 30 });
  });
});

describe("Thẻ chào trang chủ: tiến độ tuần", () => {
  test("đếm lần nộp bài tuần này, chưa tính chuỗi", async () => {
    const s = await fx.user();
    await prisma.pointLedger.createMany({ data: [
      { userId: s.id, amount: 2, source: "TEST_SUBMIT" },
      { userId: s.id, amount: 1, source: "HOMEWORK_SUBMIT" },
      { userId: s.id, amount: 3, source: "TEST_SCORE" },
      { userId: s.id, amount: 2, source: "TEST_SUBMIT", createdAt: new Date(Date.now() - 9 * 86400000) },
    ] });
    const card = await getPointsCard(s.id);
    assert.equal(card.weekActivities, 2);
    assert.equal(card.thisWeekCounted, false);
  });
});

describe("Trang quản lý của thầy", () => {
  test("yêu cầu chờ trao, học sinh theo lớp kèm số dư, thống kê tháng", async () => {
    const c = await fx.cls();
    const s = await fx.user({ classId: c.id });
    const noClass = await fx.user({ classId: null });
    const hiddenStudent = await fx.user({ classId: c.id, isApproved: false });
    await fx.give(s.id, 50);
    const r = await fx.reward({ price: 20, costVnd: 6000 });
    await prisma.$transaction((tx) => redeemInTx(tx, s.id, r.id));

    const d = await getTeacherRewardsPage();
    const pending = d.pending.find((p) => p.user.id === s.id);
    assert.ok(pending, "thấy yêu cầu chờ trao");
    assert.equal(pending!.user.studyClass?.name, c.name);

    const cls = d.classes.find((x) => x.id === c.id)!;
    assert.deepEqual(cls.students.map((x) => [x.id, x.balance]), [[s.id, 30]], "chỉ học sinh đã duyệt, kèm số dư");
    assert.ok(!cls.students.some((x) => x.id === hiddenStudent.id));
    const none = d.classes.find((x) => x.id === "__none__");
    assert.ok(none?.students.some((x) => x.id === noClass.id), "nhóm 'Chưa xếp lớp'");

    assert.ok(d.stats.earnedThisMonth >= 50);
    assert.ok(d.stats.spentThisMonth >= 20);
    assert.ok(d.rewards.some((x) => x.id === r.id && x._count.redemptions === 1));
  });

  test("chi phí: tính theo quà đã trao trong tháng", async () => {
    const before = (await getTeacherRewardsPage()).stats;
    const s = await fx.user();
    await fx.give(s.id, 10);
    const r = await fx.reward({ price: 10, costVnd: 7000 });
    await prisma.$transaction((tx) => redeemInTx(tx, s.id, r.id));
    await prisma.redemption.updateMany({ where: { userId: s.id }, data: { status: "DELIVERED", handledAt: new Date() } });
    const after = (await getTeacherRewardsPage()).stats;
    assert.equal(after.deliveredThisMonth - before.deliveredThisMonth, 1);
    assert.equal(after.costThisMonth - before.costThisMonth, 7000);
  });
});
