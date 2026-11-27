import { test } from "node:test";
import assert from "node:assert/strict";
import { HANOI, dayFactor, moonPosition, sunPosition, toDir } from "@/lib/world/sunClock";

/** giờ địa phương Hà Nội (UTC+7) → Date */
const hn = (y: number, mo: number, d: number, h: number, mi = 0) => new Date(Date.UTC(y, mo - 1, d, h - HANOI.tz, mi));

test("trưa hạ chí ở Hà Nội: mặt trời gần thiên đỉnh (~87°), hơi lệch bắc", () => {
  const s = sunPosition(hn(2026, 6, 21, 12, 0));
  assert.ok(s.elevation > 84 && s.elevation < 90, `cao độ ${s.elevation}`);
});

test("trưa đông chí: cao ~45° ở phía nam", () => {
  const s = sunPosition(hn(2026, 12, 21, 12, 0));
  assert.ok(s.elevation > 42 && s.elevation < 48, `cao độ ${s.elevation}`);
  assert.ok(s.azimuth > 160 && s.azimuth < 200, `phương vị ${s.azimuth}`);
  // phía nam = +z trong toạ độ game
  assert.ok(s.dir[2] > 0.5);
});

test("bình minh mọc ở đông (+x), hoàng hôn lặn ở tây (−x); nửa đêm dưới chân trời", () => {
  const am = sunPosition(hn(2026, 3, 20, 7, 0));
  const pm = sunPosition(hn(2026, 3, 20, 17, 0));
  const night = sunPosition(hn(2026, 3, 20, 0, 0));
  assert.ok(am.elevation > 0 && am.dir[0] > 0.5, `sáng ${am.elevation}, x ${am.dir[0]}`);
  assert.ok(pm.elevation > 0 && pm.dir[0] < -0.5, `chiều ${pm.elevation}, x ${pm.dir[0]}`);
  assert.ok(night.elevation < -40);
});

test("vector hướng là vector đơn vị; bắc = −z", () => {
  const [x, y, z] = toDir(0, 0);
  assert.ok(Math.abs(x) < 1e-9 && Math.abs(y) < 1e-9 && Math.abs(z + 1) < 1e-9);
  const s = sunPosition(hn(2026, 11, 27, 15, 30));
  assert.ok(Math.abs(Math.hypot(...s.dir) - 1) < 1e-9);
});

test("trăng ban đêm luôn trên chân trời ≥ 25°; độ ngày chuyển mượt", () => {
  assert.ok(moonPosition(hn(2026, 11, 27, 23, 0)).elevation >= 25);
  assert.equal(dayFactor(30), 1);
  assert.equal(dayFactor(-20), 0);
  const mid = dayFactor(2);
  assert.ok(mid > 0 && mid < 1);
});
