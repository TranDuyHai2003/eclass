/**
 * Chuỗi tuần học: tuần đạt khi nộp ≥ minActivities bài; thẻ giữ chuỗi; mốc thưởng.
 */
import { test, describe, after } from "node:test";
import assert from "node:assert/strict";
import { prisma } from "@/lib/prisma";
import { POINTS } from "@/lib/points/config";
import { lockWallet, updateWeekStreak } from "@/lib/points/engine";
import { getWeekCode } from "@/lib/ranking/history-engine";
import { createFixture, disconnect } from "../helpers/fixtures";

const fx = createFixture();
after(async () => {
  await fx.cleanup();
  await disconnect();
});

const W = (offset: number) => getWeekCode(new Date(), offset);

async function student(wallet: Partial<{ weekStreak: number; bestWeekStreak: number; lastStreakWeek: string | null; streakFreezes: number }> = {}, activities: number = POINTS.streak.minActivities) {
  const s = await fx.user();
  await prisma.pointWallet.create({ data: { userId: s.id, ...wallet } });
  for (let i = 0; i < activities; i++) {
    await prisma.pointLedger.create({ data: { userId: s.id, amount: 1, source: i % 2 ? "HOMEWORK_SUBMIT" : "TEST_SUBMIT" } });
  }
  return s.id;
}
const run = (userId: string) => prisma.$transaction(async (tx) => updateWeekStreak(tx, await lockWallet(tx, userId)));
const streakBonus = async (userId: string) =>
  (await prisma.pointLedger.aggregate({ where: { userId, source: "STREAK" }, _sum: { amount: true } }))._sum.amount ?? 0;

describe("Chuỗi tuần", () => {
  test("chưa đủ số bài trong tuần → chưa tính", async () => {
    const u = await student({}, POINTS.streak.minActivities - 1);
    await run(u);
    assert.equal((await fx.wallet(u))!.weekStreak, 0);
  });

  test("chỉ lần nộp bài mới tính là hoạt động (điểm cao, thưởng tay không tính)", async () => {
    const u = await student({}, 0);
    await prisma.pointLedger.createMany({ data: [
      { userId: u, amount: 1, source: "TEST_SUBMIT" },
      { userId: u, amount: 5, source: "MANUAL" },
      { userId: u, amount: 2, source: "TEST_SCORE" },
    ] });
    await run(u);
    assert.equal((await fx.wallet(u))!.weekStreak, 0);
  });

  test("hoạt động của tuần trước không tính cho tuần này", async () => {
    const u = await student({}, 0);
    for (let i = 0; i < 3; i++) await prisma.pointLedger.create({ data: { userId: u, amount: 1, source: "TEST_SUBMIT", createdAt: new Date(Date.now() - 8 * 86400000) } });
    await run(u);
    assert.equal((await fx.wallet(u))!.weekStreak, 0);
  });

  test("tuần đầu → chuỗi 1, không thưởng; gọi lại trong tuần không tăng", async () => {
    const u = await student();
    await run(u);
    await run(u);
    const w = (await fx.wallet(u))!;
    assert.equal(w.weekStreak, 1);
    assert.equal(w.lastStreakWeek, W(0));
    assert.equal(await streakBonus(u), 0);
  });

  test("liên tiếp: 1 → 2, thưởng mốc 2 tuần", async () => {
    const u = await student({ weekStreak: 1, bestWeekStreak: 1, lastStreakWeek: W(-1) });
    await run(u);
    assert.equal((await fx.wallet(u))!.weekStreak, 2);
    assert.equal(await streakBonus(u), POINTS.streak.milestones[2]);
  });

  test("lỡ 1 tuần, có thẻ → giữ chuỗi, trừ thẻ", async () => {
    const u = await student({ weekStreak: 5, lastStreakWeek: W(-2), streakFreezes: 2 });
    await run(u);
    const w = (await fx.wallet(u))!;
    assert.equal(w.weekStreak, 6);
    assert.equal(w.streakFreezes, 1);
  });

  test("lỡ 1 tuần, hết thẻ → về 1", async () => {
    const u = await student({ weekStreak: 5, lastStreakWeek: W(-2), streakFreezes: 0 });
    await run(u);
    assert.equal((await fx.wallet(u))!.weekStreak, 1);
  });

  test("lỡ 2 tuần → về 1 dù còn thẻ", async () => {
    const u = await student({ weekStreak: 9, bestWeekStreak: 9, lastStreakWeek: W(-3), streakFreezes: 2 });
    await run(u);
    const w = (await fx.wallet(u))!;
    assert.equal(w.weekStreak, 1);
    assert.equal(w.bestWeekStreak, 9, "kỷ lục cũ giữ nguyên");
    assert.equal(w.streakFreezes, 2, "không dùng thẻ khi chuỗi đã đứt");
  });

  test("mốc 4 tuần: +4 và thêm thẻ (tối đa 2)", async () => {
    const u = await student({ weekStreak: 3, lastStreakWeek: W(-1), streakFreezes: 2 });
    await run(u);
    const w = (await fx.wallet(u))!;
    assert.equal(w.weekStreak, 4);
    assert.equal(w.streakFreezes, POINTS.streak.maxFreezes, "không vượt tối đa");
    assert.equal(await streakBonus(u), POINTS.streak.milestones[4]);
  });

  test("sau 12 tuần: mỗi 4 tuần +12, tuần thường không thưởng", async () => {
    const u16 = await student({ weekStreak: 15, lastStreakWeek: W(-1) });
    await run(u16);
    assert.equal(await streakBonus(u16), POINTS.streak.every4WeeksAfter12);
    const u14 = await student({ weekStreak: 13, lastStreakWeek: W(-1) });
    await run(u14);
    assert.equal(await streakBonus(u14), 0);
  });

  test("kỷ lục cập nhật khi vượt", async () => {
    const u = await student({ weekStreak: 6, bestWeekStreak: 6, lastStreakWeek: W(-1) });
    await run(u);
    assert.equal((await fx.wallet(u))!.bestWeekStreak, 7);
  });
});
