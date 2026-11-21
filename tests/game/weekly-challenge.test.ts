/** Banner thử thách tuần (lib/game/weekly-challenge.ts) — thuần: số ngày còn lại theo giờ VN, nội dung theo ví */
import { test, describe } from "node:test";
import assert from "node:assert/strict";
import { daysLeftInWeek, weeklyChallenge } from "@/lib/game/weekly-challenge";

// Mốc giờ VN (+07:00)
const vn = (s: string) => new Date(`${s}+07:00`);

describe("daysLeftInWeek", () => {
  test("Thứ Hai đầu tuần còn 7 ngày, Chủ Nhật tối còn 1 ngày, không bao giờ 0", () => {
    assert.equal(daysLeftInWeek(vn("2026-11-16T00:00:00")), 7); // Thứ Hai
    assert.equal(daysLeftInWeek(vn("2026-11-21T17:00:00")), 2); // Thứ Bảy chiều
    assert.equal(daysLeftInWeek(vn("2026-11-22T23:59:00")), 1); // Chủ Nhật khuya
  });

  test("tính theo giờ VN, không theo giờ máy chủ: 23:30 UTC Chủ Nhật = Thứ Hai VN → tuần mới", () => {
    assert.equal(daysLeftInWeek(new Date("2026-11-22T23:30:00Z")), 7);
  });
});

describe("weeklyChallenge", () => {
  test("chưa đủ → báo số bài còn thiếu và tiến độ; có chuỗi thì nhắc chuỗi", () => {
    const c = weeklyChallenge({ weekActivities: 1, weekTarget: 2, thisWeekCounted: false, weekStreak: 3 }, vn("2026-11-21T10:00:00"));
    assert.equal(c.done, false);
    assert.match(c.text, /thêm 1 bài/);
    assert.match(c.text, /1\/2/);
    assert.match(c.text, /3 tuần/);
    assert.equal(c.badge, "Còn 2 ngày");
  });

  test("đã tính tuần này hoặc đủ bài → hoàn thành; chuỗi 0 thì không nhắc chuỗi", () => {
    assert.equal(weeklyChallenge({ weekActivities: 0, weekTarget: 2, thisWeekCounted: true, weekStreak: 0 }).done, true);
    const c = weeklyChallenge({ weekActivities: 2, weekTarget: 2, thisWeekCounted: false, weekStreak: 0 });
    assert.equal(c.done, true);
    assert.ok(!/Chuỗi hiện tại/.test(c.text));
  });
});
