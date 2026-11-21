/**
 * Thầy thưởng / trừ điểm tay (DB local).
 */
import { test, describe, after } from "node:test";
import assert from "node:assert/strict";
import { prisma } from "@/lib/prisma";
import { POINTS } from "@/lib/points/config";
import { grantManualInTx } from "@/lib/points/manual";
import { redeemInTx } from "@/lib/points/redemption";
import { createFixture, disconnect } from "../helpers/fixtures";

const fx = createFixture();
after(async () => {
  await fx.cleanup();
  await disconnect();
});

const grant = (userId: string, amount: number, staffId: string, reason = "Phát biểu", now?: Date) =>
  prisma.$transaction((tx) => grantManualInTx(tx, { userId, amount, reason, staffId, now }));

describe("Thưởng tay", () => {
  test("cộng điểm, ghi lý do + người thưởng, gửi thông báo", async () => {
    const s = await fx.user();
    const t = await fx.user({ role: "TEACHER" });
    assert.equal(await grant(s.id, 3, t.id, "  Giúp bạn  "), 3);
    const row = await prisma.pointLedger.findFirstOrThrow({ where: { userId: s.id } });
    assert.equal(row.source, "MANUAL");
    assert.equal(row.reason, "Giúp bạn");
    assert.equal(row.createdById, t.id);
    const n = await prisma.notification.findFirstOrThrow({ where: { userId: s.id } });
    assert.match(n.title, /thưởng 3/);
    assert.equal(n.message, "Giúp bạn");
  });

  test(`giới hạn ${POINTS.manual.dailyCapPerStudent} điểm/ngày: cộng phần còn lại, rồi báo 'cap'`, async () => {
    const s = await fx.user();
    const t = await fx.user({ role: "TEACHER" });
    const cap = POINTS.manual.dailyCapPerStudent;
    assert.equal(await grant(s.id, cap - 2, t.id), cap - 2);
    assert.equal(await grant(s.id, 5, t.id), 2);
    assert.equal(await grant(s.id, 1, t.id), "cap");
    assert.equal(await fx.balance(s.id), cap);
  });

  test("ngày hôm sau được thưởng tiếp", async () => {
    const s = await fx.user();
    const t = await fx.user({ role: "TEACHER" });
    await grant(s.id, POINTS.manual.dailyCapPerStudent, t.id);
    await prisma.pointLedger.updateMany({ where: { userId: s.id }, data: { createdAt: new Date(Date.now() - 2 * 86400000) } });
    assert.equal(await grant(s.id, 2, t.id), 2);
  });

  test("trừ điểm không bị giới hạn ngày, số dư có thể âm và khi âm thì không đổi quà được", async () => {
    const s = await fx.user();
    const t = await fx.user({ role: "TEACHER" });
    const cap = POINTS.manual.dailyCapPerStudent;
    await grant(s.id, cap, t.id);
    assert.equal(await grant(s.id, -cap, t.id, "Chép bài"), -cap);
    assert.equal(await grant(s.id, -100, t.id, "Chép bài"), -100);
    assert.equal(await fx.balance(s.id), -100);
    const n = await prisma.notification.findFirstOrThrow({ where: { userId: s.id, title: { contains: "trừ" } } });
    assert.match(n.title, /Bị trừ/);
    const r = await fx.reward({ price: 1, kind: "VIRTUAL" });
    assert.equal((await prisma.$transaction((tx) => redeemInTx(tx, s.id, r.id))).success, false);
    const w = await fx.wallet(s.id);
    assert.equal(w!.balance, await fx.ledgerSum(s.id));
    assert.equal(w!.lifetimeEarned, 0, "tổng đã kiếm không âm");
  });

  test("bỏ qua học sinh chưa duyệt, demo, giáo viên", async () => {
    const t = await fx.user({ role: "TEACHER" });
    for (const opts of [{ isApproved: false }, { isDemo: true }, { role: "TEACHER" as const }]) {
      const u = await fx.user(opts);
      assert.equal(await grant(u.id, 3, t.id), "skip", JSON.stringify(opts));
      assert.equal(await fx.balance(u.id), 0);
    }
  });

  test("thưởng cùng lúc nhiều lần vẫn không vượt giới hạn ngày", async () => {
    const s = await fx.user();
    const t = await fx.user({ role: "TEACHER" });
    const part = Math.ceil(POINTS.manual.dailyCapPerStudent / 2);
    await Promise.all(Array.from({ length: 6 }, () => grant(s.id, part, t.id)));
    assert.equal(await fx.balance(s.id), POINTS.manual.dailyCapPerStudent);
  });
});
