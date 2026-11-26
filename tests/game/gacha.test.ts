/**
 * Rương bí ẩn: tỉ lệ (mô phỏng RNG giả), bảo hiểm lần 5, trùng → xu, bất biến sổ–ví, trần ngày, đồng thời, điều kiện — DB local.
 */
import { test, describe, after } from "node:test";
import assert from "node:assert/strict";
import { prisma } from "@/lib/prisma";
import { CHESTS, RARITY_ORDER, poolFor, ratesTable, roll, rollRarity } from "@/lib/game/gacha-shared";
import { pullInTx, pullsToday } from "@/lib/game/gacha";
import { DUPLICATE_REFUND, ITEMS } from "@/lib/game/items";
import { createFixture, disconnect } from "../helpers/fixtures";

const fx = createFixture();
after(async () => {
  await fx.cleanup();
  await disconnect();
});

/** RNG giả xác định (mulberry32) */
function seeded(seed: number) {
  let a = seed >>> 0;
  return () => {
    a = (a + 0x6d2b79f5) >>> 0;
    let t = a;
    t = Math.imul(t ^ (t >>> 15), t | 1);
    t ^= t + Math.imul(t ^ (t >>> 7), t | 61);
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
  };
}

const pull = (userId: string, chest: "xu" | "gem" = "xu", rng?: () => number, now?: Date) => prisma.$transaction((tx) => pullInTx(tx, userId, chest, rng, now));
const consistent = async (userId: string) => {
  const w = await fx.wallet(userId);
  assert.equal(w!.balance, await fx.ledgerSum(userId, "XU"), "xu khớp sổ");
  assert.equal(w!.gems, await fx.ledgerSum(userId, "GEM"), "ngọc khớp sổ");
};

describe("Rương không phải máy in xu (26/11/2026)", () => {
  test("đã sở hữu MỌI món: trung bình xu nhận lại mỗi lượt Rương Xu vẫn thấp hơn giá mở", () => {
    const rng = seeded(20261126);
    const owned = new Set(ITEMS.map((i) => i.id));
    const cost = (CHESTS.xu.cost as { xu: number }).xu;
    let pity = 0;
    let xu = 0;
    const N = 100_000;
    for (let i = 0; i < N; i++) {
      const r = roll("xu", rng, pity, owned);
      pity = r.pityAfter;
      if (r.outcome.kind === "item") xu += r.outcome.refundXu;
      else if (r.outcome.kind === "xu") xu += r.outcome.amount;
    }
    const avg = xu / N;
    assert.ok(avg < cost * 0.85, `trung bình ${avg.toFixed(0)} xu/lượt, giá ${cost}`);
  });
});

describe("Tỉ lệ và bể quà (thuần)", () => {
  test("tổng tỉ lệ mỗi rương = 100; mỗi bậc có ít nhất 1 quà; Rương Ngọc không có Phổ thông", () => {
    for (const chest of Object.values(CHESTS)) {
      assert.equal(Object.values(chest.rates).reduce((s, v) => s + (v ?? 0), 0), 100, chest.id);
      for (const r of RARITY_ORDER) if ((chest.rates[r] ?? 0) > 0) assert.ok(poolFor(chest.id, r).length >= 1, `${chest.id}/${r}`);
    }
    assert.equal(CHESTS.gem.rates.common ?? 0, 0);
    assert.equal(CHESTS.xu.dailyLimit, 3, "review Gemini: Rương Xu 3 lượt/ngày");
    assert.ok(ITEMS.filter((i) => i.gachaOnly).every((i) => poolFor(i.rarity === "common" ? "xu" : "gem", i.rarity).some((p) => p.kind === "item" && p.item.id === i.id)), "mọi món chỉ-rương đều nằm trong bể");
    assert.ok(ratesTable("xu").every((row) => row.prizes.length > 0));
  });

  test("mô phỏng 20 000 lượt Rương Xu (không bảo hiểm): tần suất sát tỉ lệ công bố ±1,5 điểm %", () => {
    const rng = seeded(42);
    const n = 20000;
    const count: Record<string, number> = {};
    for (let i = 0; i < n; i++) {
      const r = rollRarity(CHESTS.xu, rng);
      count[r] = (count[r] ?? 0) + 1;
    }
    for (const r of RARITY_ORDER) {
      const pct = ((count[r] ?? 0) / n) * 100;
      assert.ok(Math.abs(pct - (CHESTS.xu.rates[r] ?? 0)) <= 1.5, `${r}: ${pct.toFixed(2)}% vs ${CHESTS.xu.rates[r]}%`);
    }
  });

  test("bảo hiểm: 4 lượt liên tiếp không Sử thi → lượt 5 chắc chắn Sử thi+; trúng Sử thi+ thì đếm về 0", () => {
    const alwaysCommon = () => 0.001; // rng nhỏ → bậc đầu tiên (common) và quà đầu tiên
    let pity = 0;
    for (let i = 0; i < 4; i++) {
      const r = roll("xu", alwaysCommon, pity, new Set());
      assert.equal(r.outcome.rarity, "common");
      assert.equal(r.guaranteed, false);
      pity = r.pityAfter;
    }
    assert.equal(pity, 4);
    const fifth = roll("xu", alwaysCommon, pity, new Set());
    assert.equal(fifth.guaranteed, true);
    assert.ok(fifth.outcome.rarity === "epic" || fifth.outcome.rarity === "legendary");
    assert.equal(fifth.pityAfter, 0);
    // Rương Ngọc không dùng bảo hiểm
    assert.equal(roll("gem", alwaysCommon, 9, new Set()).pityAfter, 9);
  });

  test("trùng đồ → đánh dấu duplicate và trả xu theo bậc", () => {
    const rngItemFirst = () => 0.001;
    const first = roll("xu", rngItemFirst, 0, new Set());
    assert.equal(first.outcome.kind, "item");
    const id = first.outcome.kind === "item" ? first.outcome.itemId : "";
    const again = roll("xu", rngItemFirst, 0, new Set([id]));
    assert.ok(again.outcome.kind === "item" && again.outcome.duplicate && again.outcome.refundXu === DUPLICATE_REFUND.common);
  });
});

describe("Mở rương (DB)", () => {
  test("trừ xu, ghi GachaPull, trao đồ hoặc xu; lifetimeEarned không đổi; ví khớp sổ", async () => {
    const s = await fx.user();
    await fx.give(s.id, 3000);
    const r = await pull(s.id, "xu", seeded(7));
    assert.equal(r.success, true, JSON.stringify(r));
    assert.ok(r.outcome);
    const pulls = await prisma.gachaPull.findMany({ where: { userId: s.id } });
    assert.equal(pulls.length, 1);
    const w = await fx.wallet(s.id);
    assert.equal(w!.lifetimeEarned, 3000, "xu từ rương không tính danh hiệu");
    if (r.outcome!.kind === "item" && !r.outcome!.duplicate) {
      assert.equal(await prisma.userItem.count({ where: { userId: s.id, itemId: r.outcome!.itemId, source: "GACHA" } }), 1);
      assert.equal(w!.balance, 3000 - 600);
    } else if (r.outcome!.kind === "xu") {
      assert.equal(w!.balance, 3000 - 600 + r.outcome!.amount);
    }
    await consistent(s.id);
    assert.equal(await pullsToday(s.id), 1);
  });

  test("trùng đồ ở DB → không tạo thêm UserItem, nhận lại xu", async () => {
    const s = await fx.user();
    await fx.give(s.id, 3000);
    const rng = () => 0.001;
    const r1 = await pull(s.id, "xu", rng);
    assert.ok(r1.success && r1.outcome?.kind === "item" && !r1.outcome.duplicate);
    const r2 = await pull(s.id, "xu", rng);
    assert.ok(r2.success && r2.outcome?.kind === "item" && r2.outcome.duplicate);
    assert.equal(await prisma.userItem.count({ where: { userId: s.id } }), 1);
    assert.equal(await fx.balance(s.id), 3000 - 1200 + DUPLICATE_REFUND.common);
    await consistent(s.id);
  });

  test("trần 3 lượt/ngày: lượt 4 bị từ chối, sang ngày mới mở lại được; Rương Ngọc không có trần", async () => {
    const s = await fx.user();
    await fx.give(s.id, 10000);
    const rng = seeded(3);
    for (let i = 0; i < 3; i++) assert.equal((await pull(s.id, "xu", rng)).success, true, `lượt ${i + 1}`);
    const r4 = await pull(s.id, "xu", rng);
    assert.equal(r4.success, false);
    assert.match((r4 as { error: string }).error, /Mỗi ngày chỉ mở được 3/);
    assert.equal(await pullsToday(s.id), 3);
    const tomorrow = new Date(Date.now() + 86400000);
    assert.equal((await pull(s.id, "xu", rng, tomorrow)).success, true, "ngày mai mở được");
    await prisma.pointLedger.create({ data: { userId: s.id, amount: 20, source: "GIFTCODE", currency: "GEM" } });
    await prisma.pointWallet.update({ where: { userId: s.id }, data: { gems: 20 } });
    for (let i = 0; i < 5; i++) assert.equal((await pull(s.id, "gem", rng)).success, true, `ngọc ${i + 1}`);
    await consistent(s.id);
  });

  test("thiếu tiền → từ chối, không ghi gì; hai lượt cùng lúc khi chỉ đủ 1 → đúng 1 thành công", async () => {
    const s = await fx.user();
    await fx.give(s.id, 500);
    const r = await pull(s.id, "xu", seeded(1));
    assert.equal(r.success, false);
    assert.match((r as { error: string }).error, /thêm 100 xu/);
    assert.equal(await prisma.gachaPull.count({ where: { userId: s.id } }), 0);
    await fx.give(s.id, 400); // 900: đủ 1 lượt 600
    const rs = await Promise.all([pull(s.id, "xu", () => 0.5), pull(s.id, "xu", () => 0.5)]);
    assert.equal(rs.filter((x) => x.success).length, 1);
    assert.equal(await prisma.gachaPull.count({ where: { userId: s.id } }), 1);
    await consistent(s.id);
  });

  test("đang ở lượt 3/3: hai lượt cùng lúc → chỉ 1 qua", async () => {
    const s = await fx.user();
    await fx.give(s.id, 10000);
    const rng = seeded(9);
    await pull(s.id, "xu", rng);
    await pull(s.id, "xu", rng);
    const rs = await Promise.all([pull(s.id, "xu", rng), pull(s.id, "xu", rng)]);
    assert.equal(rs.filter((x) => x.success).length, 1);
    assert.equal(await pullsToday(s.id), 3);
  });

  test("bảo hiểm lưu trong ví: 4 lượt thường → lượt 5 Sử thi+ và gachaPity về 0", async () => {
    const s = await fx.user();
    await fx.give(s.id, 10000);
    const rng = () => 0.001;
    const days = [0, 0, 0, 1, 1].map((d) => new Date(Date.now() + d * 86400000));
    const results = [];
    for (const now of days) results.push(await pull(s.id, "xu", rng, now));
    assert.ok(results.every((r) => r.success), JSON.stringify(results.find((r) => !r.success)));
    assert.deepEqual(results.map((r) => r.guaranteed), [false, false, false, false, true]);
    assert.ok(["epic", "legendary"].includes(results[4].outcome!.rarity));
    assert.equal((await fx.wallet(s.id))!.gachaPity, 0);
  });

  test("chưa duyệt / demo / giáo viên không mở được; GACHA_ENABLED=off chặn", async () => {
    for (const opts of [{ isApproved: false }, { isDemo: true }, { role: "TEACHER" as const }]) {
      const u = await fx.user(opts);
      await fx.give(u.id, 5000);
      assert.equal((await pull(u.id)).success, false, JSON.stringify(opts));
    }
    const s = await fx.user();
    await fx.give(s.id, 5000);
    process.env.GACHA_ENABLED = "off";
    try {
      assert.equal((await pull(s.id)).success, false);
    } finally {
      delete process.env.GACHA_ENABLED;
    }
  });
});
