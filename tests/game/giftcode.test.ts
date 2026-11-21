/**
 * Mã quà tặng (lib/game/giftcode.ts) — DB local: hết lượt, nhập lại, hết hạn, sai lớp, đồng thời, chống dò, đủ điều kiện.
 */
import { test, describe, after } from "node:test";
import assert from "node:assert/strict";
import { prisma } from "@/lib/prisma";
import {
  CODE_LENGTH, RATE_LIMIT, createBatch, generateCode, noteFailure, normalizeCode, rateLimited, redeemGiftCodeInTx, resetFailures, validateBatchInput,
} from "@/lib/game/giftcode";
import { parseVnDateTime } from "@/lib/game/giftcode-shared";
import { createFixture, disconnect } from "../helpers/fixtures";

const fx = createFixture();
after(async () => {
  await prisma.giftCode.deleteMany({ where: { note: fx.tag } });
  await fx.cleanup();
  await disconnect();
});

const redeem = (userId: string, code: string) => prisma.$transaction((tx) => redeemGiftCodeInTx(tx, userId, code));
const gems = async (userId: string) => (await fx.wallet(userId))?.gems ?? 0;

async function batch(opts: Partial<Parameters<typeof createBatch>[0]> = {}) {
  const teacher = await fx.user({ role: "TEACHER" });
  return createBatch({ count: 1, currency: "GEM", amount: 3, maxUses: 1, note: fx.tag, ...opts }, teacher.id);
}

describe("Sinh mã và kiểm tra đầu vào", () => {
  test("mã 8 ký tự, không có O/0/I/1; chuẩn hoá chữ thường, khoảng trắng, gạch", () => {
    for (let i = 0; i < 50; i++) assert.match(generateCode(), /^[ABCDEFGHJKMNPQRSTUVWXYZ23456789]{8}$/);
    assert.equal(normalizeCode(" ab-cd ef gh "), "ABCDEFGH");
    assert.equal(CODE_LENGTH, 8);
  });

  test("hạn dùng từ datetime-local (không múi giờ) hiểu là giờ Việt Nam; ISO/Date giữ nguyên (review Gemini)", () => {
    assert.equal(parseVnDateTime("2026-11-22T18:00")?.toISOString(), "2026-11-22T11:00:00.000Z");
    assert.equal(parseVnDateTime("2026-11-22T18:00:30")?.toISOString(), "2026-11-22T11:00:30.000Z");
    assert.equal(parseVnDateTime("2026-11-22T11:00:00.000Z")?.toISOString(), "2026-11-22T11:00:00.000Z");
    assert.equal(parseVnDateTime(new Date("2026-01-01T00:00:00Z"))?.toISOString(), "2026-01-01T00:00:00.000Z");
    assert.equal(parseVnDateTime("xx"), null);
    assert.equal(parseVnDateTime(null), null);
  });

  test("từ chối lô sai: số mã, giá trị, lượt, hạn quá khứ", () => {
    const ok = { count: 5, currency: "GEM" as const, amount: 3, maxUses: 1 };
    assert.equal(validateBatchInput(ok), null);
    assert.ok(validateBatchInput({ ...ok, count: 0 }));
    assert.ok(validateBatchInput({ ...ok, count: 201 }));
    assert.ok(validateBatchInput({ ...ok, amount: 0 }));
    assert.ok(validateBatchInput({ ...ok, amount: 51 }));
    assert.ok(validateBatchInput({ ...ok, currency: "XU", amount: 20001 }));
    assert.equal(validateBatchInput({ ...ok, currency: "XU", amount: 20000 }), null);
    assert.ok(validateBatchInput({ ...ok, maxUses: 0 }));
    assert.ok(validateBatchInput({ ...ok, expiresAt: new Date(Date.now() - 1000) }));
    assert.ok(validateBatchInput({ ...ok, expiresAt: "xx" }));
  });

  test("tạo lô: đủ số mã, không trùng, cùng batchId", async () => {
    const { batchId, codes } = await batch({ count: 20 });
    assert.equal(codes.length, 20);
    assert.equal(new Set(codes).size, 20);
    assert.equal(await prisma.giftCode.count({ where: { batchId } }), 20);
  });
});

describe("Học sinh nhập mã", () => {
  test("nhận đúng loại tiền (ngọc), sổ GEM khớp ví, xu/lifetimeEarned không đổi; nhập lại → đã dùng", async () => {
    const s = await fx.user();
    const { codes } = await batch();
    const r = await redeem(s.id, codes[0].toLowerCase());
    assert.equal(r.success, true);
    assert.equal(await gems(s.id), 3);
    assert.equal(await fx.ledgerSum(s.id, "GEM"), 3);
    assert.equal(await fx.balance(s.id), 0);
    assert.equal((await fx.wallet(s.id))!.lifetimeEarned, 0);
    const again = await redeem(s.id, codes[0]);
    assert.equal(again.success, false);
    assert.match((again as { error: string }).error, /đã dùng/);
    assert.equal(await gems(s.id), 3);
  });

  test("mã xu cộng vào balance nhưng không vào danh hiệu", async () => {
    const s = await fx.user();
    const { codes } = await batch({ currency: "XU", amount: 500 });
    assert.equal((await redeem(s.id, codes[0])).success, true);
    assert.equal(await fx.balance(s.id), 500);
    assert.equal((await fx.wallet(s.id))!.lifetimeEarned, 0);
  });

  test("mã dùng chung 2 lượt: bạn thứ 3 bị từ chối; usedCount đúng", async () => {
    const [a, b, c] = await Promise.all([fx.user(), fx.user(), fx.user()]);
    const { codes } = await batch({ maxUses: 2 });
    assert.equal((await redeem(a.id, codes[0])).success, true);
    assert.equal((await redeem(b.id, codes[0])).success, true);
    const r = await redeem(c.id, codes[0]);
    assert.equal(r.success, false);
    assert.match((r as { error: string }).error, /hết lượt/);
    assert.equal((await prisma.giftCode.findUniqueOrThrow({ where: { code: codes[0] } })).usedCount, 2);
  });

  test("5 bạn cùng nhập mã còn 2 lượt → đúng 2 thành công", async () => {
    const users = await Promise.all(Array.from({ length: 5 }, () => fx.user()));
    const { codes } = await batch({ maxUses: 2 });
    const rs = await Promise.all(users.map((u) => redeem(u.id, codes[0])));
    assert.equal(rs.filter((r) => r.success).length, 2);
    const total = (await Promise.all(users.map((u) => gems(u.id)))).reduce((s, g) => s + g, 0);
    assert.equal(total, 6);
    assert.equal((await prisma.giftCode.findUniqueOrThrow({ where: { code: codes[0] } })).usedCount, 2);
  });

  test("cùng một bạn nhập 2 tab cùng lúc → chỉ 1 lần, usedCount = 1", async () => {
    const s = await fx.user();
    const { codes } = await batch({ maxUses: 5 });
    const rs = await Promise.allSettled([redeem(s.id, codes[0]), redeem(s.id, codes[0])]);
    const ok = rs.filter((r) => r.status === "fulfilled" && r.value.success).length;
    assert.equal(ok, 1);
    assert.equal(await gems(s.id), 3);
    assert.equal((await prisma.giftCode.findUniqueOrThrow({ where: { code: codes[0] } })).usedCount, 1, "lượt tăng rồi bị rollback");
  });

  test("hết hạn, vô hiệu, sai lớp, mã lạ → từ chối; đúng lớp → nhận", async () => {
    const cls = await fx.cls();
    const inClass = await fx.user({ classId: cls.id });
    const outClass = await fx.user();
    const expired = await batch({ expiresAt: new Date(Date.now() + 60_000) });
    await prisma.giftCode.update({ where: { code: expired.codes[0] }, data: { expiresAt: new Date(Date.now() - 1000) } });
    assert.match((await redeem(inClass.id, expired.codes[0]) as { error: string }).error, /hết hạn/);
    const off = await batch();
    await prisma.giftCode.update({ where: { code: off.codes[0] }, data: { isActive: false } });
    assert.equal((await redeem(inClass.id, off.codes[0])).success, false);
    const forClass = await batch({ classId: cls.id });
    assert.equal((await redeem(outClass.id, forClass.codes[0])).success, false);
    assert.equal((await redeem(inClass.id, forClass.codes[0])).success, true);
    assert.equal((await redeem(inClass.id, "ZZZZZZZZ")).success, false);
    assert.equal((await redeem(inClass.id, "ABC")).success, false);
  });

  test("chưa duyệt / demo / giáo viên không nhập được; không tạo ví/lượt dùng rác", async () => {
    const { codes } = await batch({ maxUses: 9 });
    for (const opts of [{ isApproved: false }, { isDemo: true }, { role: "TEACHER" as const }]) {
      const u = await fx.user(opts);
      assert.equal((await redeem(u.id, codes[0])).success, false, JSON.stringify(opts));
      assert.equal(await prisma.giftCodeUse.count({ where: { userId: u.id } }), 0);
    }
    assert.equal((await prisma.giftCode.findUniqueOrThrow({ where: { code: codes[0] } })).usedCount, 0);
  });
});

describe("Chống dò mã", () => {
  test(`sau ${RATE_LIMIT.limit} lần sai trong cửa sổ thì bị chặn; hết cửa sổ thì mở lại`, () => {
    resetFailures("u1");
    const t0 = Date.now();
    for (let i = 0; i < RATE_LIMIT.limit - 1; i++) noteFailure("u1", t0);
    assert.equal(rateLimited("u1", t0), false);
    noteFailure("u1", t0);
    assert.equal(rateLimited("u1", t0), true);
    assert.equal(rateLimited("u1", t0 + RATE_LIMIT.windowMs + 1), false);
    assert.equal(rateLimited("u2", t0), false, "học sinh khác không bị ảnh hưởng");
    resetFailures();
  });
});
