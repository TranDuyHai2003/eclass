/**
 * Hồ sơ công khai (lib/game/profile.ts): phân quyền hiển thị, phần riêng tư chỉ cho chính chủ, hạng trong khối — DB local.
 */
import { test, describe, after } from "node:test";
import assert from "node:assert/strict";
import { prisma } from "@/lib/prisma";
import { getPublicProfile } from "@/lib/game/profile";
import { createFixture, disconnect } from "../helpers/fixtures";

const fx = createFixture();
after(async () => {
  await fx.cleanup();
  await disconnect();
});

describe("getPublicProfile", () => {
  test("học sinh khác xem được hồ sơ học sinh đã duyệt; không thấy xu/ngọc/kết quả gần đây", async () => {
    const a = await fx.user();
    const b = await fx.user();
    await fx.give(a.id, 2000);
    const t = await fx.test();
    await fx.attempt(t.id, a.id, 10);
    const p = await getPublicProfile(b.id, a.id);
    assert.ok(p);
    assert.equal(p.isSelf, false);
    assert.equal(p.lifetimeEarned, 2000);
    assert.equal(p.balance, null);
    assert.equal(p.gems, null);
    assert.deepEqual(p.recent, []);
    assert.equal(p.completedTests, 1);
    assert.equal(p.tens, 1);
    assert.equal(p.level.name, "Trứng bắc thảo nghèo khó");
  });

  test("chính chủ thấy xu và kết quả gần đây", async () => {
    const a = await fx.user();
    await fx.give(a.id, 100);
    const p = await getPublicProfile(a.id, a.id);
    assert.ok(p && p.isSelf && p.balance === 100 && p.gems === 0);
  });

  test("hồ sơ thầy / chưa duyệt / demo / không tồn tại → null (trừ chính chủ)", async () => {
    const viewer = await fx.user();
    for (const opts of [{ role: "TEACHER" as const }, { isApproved: false }, { isDemo: true }]) {
      const u = await fx.user(opts);
      assert.equal(await getPublicProfile(viewer.id, u.id), null, JSON.stringify(opts));
      assert.ok(await getPublicProfile(u.id, u.id), "chính chủ vẫn xem được");
    }
    assert.equal(await getPublicProfile(viewer.id, "khong-ton-tai"), null);
  });

  test("hạng trong khối theo xu tích luỹ, chỉ tính học sinh thật cùng khối", async () => {
    const cls = await prisma.studyClass.create({ data: { name: `${fx.tag} 12X`, grade: 12 } });
    const [a, b, c] = await Promise.all([fx.user({ classId: cls.id }), fx.user({ classId: cls.id }), fx.user({ classId: cls.id, isDemo: true })]);
    await fx.give(a.id, 500);
    await fx.give(b.id, 900);
    await fx.give(c.id, 9999);
    const pa = await getPublicProfile(b.id, a.id);
    assert.ok(pa?.rankInGrade);
    assert.equal(pa.rankInGrade.rank, 2);
    assert.ok(pa.rankInGrade.total >= 2);
    assert.equal((await getPublicProfile(a.id, b.id))?.rankInGrade?.rank, 1, "demo 9999 xu không chiếm hạng");
    const noClass = await fx.user();
    assert.equal((await getPublicProfile(a.id, noClass.id))?.rankInGrade, null);
  });
});
