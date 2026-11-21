/** NPC Lucky Boy (lib/game/npc.ts) — thuần: thứ tự ưu tiên, không nhắc rương, luôn có câu */
import { test, describe } from "node:test";
import assert from "node:assert/strict";
import { buildNpcLines } from "@/lib/game/npc";

describe("buildNpcLines", () => {
  test("quá hạn trước sắp hạn trước chuỗi; không bao giờ nhắc rương/bảo hiểm", () => {
    const lines = buildNpcLines({
      name: "Nguyễn Văn An",
      overdue: [{ title: "Bài 3" }],
      dueSoon: [{ title: "Bài 4", dueDate: new Date(Date.now() + 5 * 3600000) }],
      weekActivities: 1,
      weekTarget: 2,
      thisWeekCounted: false,
      nextLevel: { name: "Phú nông", toNext: 500 },
      gems: 2,
    });
    assert.match(lines[0], /Bài 3.*quá hạn/);
    assert.match(lines[1], /Bài 4.*5 giờ/);
    assert.match(lines[2], /thêm 1 bài/);
    assert.ok(lines.some((l) => /Phú nông/.test(l)));
    assert.ok(lines.some((l) => /2 ngọc/.test(l)));
    assert.ok(lines.every((l) => !/rương|bảo hiểm|quay/i.test(l)), "không được nhắc rương");
    assert.ok(lines[0].includes("An"), "gọi tên riêng");
  });

  test("không có gì để nhắc → câu động viên + câu giới thiệu; chưa duyệt → câu chờ duyệt đầu tiên", () => {
    const calm = buildNpcLines({ name: "B", thisWeekCounted: true, lifetimeEarned: 5000 });
    assert.equal(calm.length, 2);
    assert.match(calm[0], /cố lên/);
    assert.match(buildNpcLines({ canEarn: false })[0], /chờ thầy duyệt/);
    assert.match(buildNpcLines({ lifetimeEarned: 0, thisWeekCounted: true })[0], /300 xu/);
  });

  test("đủ xu mua quà mục tiêu → nhắc đổi; chưa đủ → không nhắc", () => {
    assert.ok(buildNpcLines({ goal: { title: "Bim bim", price: 100 }, balance: 150, thisWeekCounted: true }).some((l) => /Bim bim/.test(l)));
    assert.ok(!buildNpcLines({ goal: { title: "Bim bim", price: 100 }, balance: 50, thisWeekCounted: true }).some((l) => /Bim bim/.test(l)));
  });
});
