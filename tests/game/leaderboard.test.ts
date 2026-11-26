/**
 * Bảng Vàng theo khối (lib/game/leaderboard.ts, bản không cache) — DB local: lọc khối/lớp, loại demo/chưa duyệt, kỳ tháng, hạng của tôi.
 */
import { test, describe, after, before } from "node:test";
import assert from "node:assert/strict";
import { prisma } from "@/lib/prisma";
import { getLeaderboardUncached, getMyRank } from "@/lib/game/leaderboard";
import { createFixture, disconnect } from "../helpers/fixtures";

const fx = createFixture();
after(async () => {
  await fx.cleanup();
  await disconnect();
});

// Khối 7 và 8 để không đụng dữ liệu thật của DB local (khối 10–12)
let c7a: string, c7b: string, c8: string;
let a: string, b: string, c: string, d: string, z: string;
before(async () => {
  c7a = (await prisma.studyClass.create({ data: { name: `${fx.tag} 7A`, grade: 7 } })).id;
  c7b = (await prisma.studyClass.create({ data: { name: `${fx.tag} 7B`, grade: 7 } })).id;
  c8 = (await prisma.studyClass.create({ data: { name: `${fx.tag} 8A`, grade: 8 } })).id;
  a = (await fx.user({ classId: c7a })).id;
  b = (await fx.user({ classId: c7b })).id;
  c = (await fx.user({ classId: c8 })).id;
  d = (await fx.user({ classId: c7a, isDemo: true })).id;
  z = (await fx.user({ classId: c7b })).id; // chưa có xu
  const unapproved = (await fx.user({ classId: c7a, isApproved: false })).id;
  await fx.give(a, 1000);
  await fx.give(b, 3000);
  await fx.give(c, 9000);
  await fx.give(d, 99999);
  await fx.give(unapproved, 77777);
  // b có 2 000 xu từ tháng trước (không tính kỳ tháng); a có xu từ rương (không tính danh hiệu/kỳ)
  await prisma.pointLedger.updateMany({ where: { userId: b, amount: 3000 }, data: { amount: 1000 } });
  await prisma.pointLedger.create({ data: { userId: b, amount: 2000, source: "TEST_SUBMIT", createdAt: new Date(Date.now() - 45 * 86400000) } });
  await prisma.pointLedger.create({ data: { userId: a, amount: 5000, source: "GACHA" } });
  await prisma.pointWallet.update({ where: { userId: a }, data: { balance: 6000 } });
});

describe("Bảng Vàng", () => {
  test("theo khối: chỉ học sinh thật đã duyệt của khối, xếp theo xu tích luỹ, có nhân vật và danh hiệu", async () => {
    const rows = await getLeaderboardUncached({ grade: 7 }, "all", 30);
    assert.deepEqual(rows.map((r) => r.userId), [b, a]);
    assert.deepEqual(rows.map((r) => r.rank), [1, 2]);
    assert.equal(rows[0].xu, 3000);
    assert.ok(rows[0].avatar.hair && rows[0].level.name);
    assert.ok(rows.every((r) => r.userId !== d), "demo bị loại");
  });

  test("theo lớp: chỉ lớp đó", async () => {
    const rows = await getLeaderboardUncached({ classId: c7a }, "all", 30);
    assert.deepEqual(rows.map((r) => r.userId), [a]);
  });

  test("kỳ tháng: chỉ xu tích luỹ trong tháng VN, bỏ gacha; xếp lại thứ tự", async () => {
    const rows = await getLeaderboardUncached({ grade: 7 }, "month", 30);
    const byId = new Map(rows.map((r) => [r.userId, r.xu]));
    assert.equal(byId.get(a), 1000, "xu rương 5 000 không tính");
    assert.equal(byId.get(b), 1000, "2 000 xu tháng trước không tính");
    // bằng xu tháng → xếp theo tích luỹ (b 3 000 > a 1 000)
    assert.deepEqual(rows.map((r) => r.userId), [b, a]);
  });

  test("giới hạn top N; hạng của tôi tính ngoài top", async () => {
    const top1 = await getLeaderboardUncached({ grade: 7 }, "all", 1);
    assert.equal(top1.length, 1);
    const mine = await getMyRank(a, { grade: 7 }, "all");
    assert.deepEqual(mine, { rank: 2, total: 2, xu: 1000 });
    assert.equal(await getMyRank(c, { grade: 7 }, "all"), null, "khác khối → null");
    assert.equal((await getLeaderboardUncached({ grade: 99 }, "all", 10)).length, 0);
  });

  test("bạn chưa có xu không lên bảng, không tính vào tổng", async () => {
    const rows = await getLeaderboardUncached({ grade: 7 }, "all", 30);
    assert.ok(!rows.some((r) => r.userId === z));
    assert.equal(await getMyRank(z, { grade: 7 }, "all"), null);
    assert.deepEqual(await getMyRank(a, { grade: 7 }, "all"), { rank: 2, total: 2, xu: 1000 });
  });
});
