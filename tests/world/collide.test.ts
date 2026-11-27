import { test } from "node:test";
import assert from "node:assert/strict";
import { nearestFree } from "../../lib/world/collide";

// Hồi quy: rơi / bay từ trên cao xuống lòng bốt (2,2 × 2,2 m) hay thân tàu → kẹt vì mọi bước đều bị chặn
const booth = (x: number, z: number) => Math.abs(x + 6) < 1.4 && Math.abs(z + 4) < 1.4;

test("đứng trong vật cản → tìm được điểm trống sát mép, gần nhất", () => {
  const f = nearestFree(booth, -6, -4, 0);
  assert.ok(f);
  assert.ok(!booth(f[0], f[1]));
  assert.ok(Math.hypot(f[0] + 6, f[1] + 4) < 2.3, "phải ra ngay mép, không văng xa");
});

test("lệch tâm → ra phía gần hơn", () => {
  const f = nearestFree(booth, -6, -2.9, 0)!;
  assert.ok(f[1] > -2.9, "đang sát mép +z thì thoát ra phía +z");
});

test("không có chỗ trống trong bán kính → null (không dịch chuyển bừa)", () => {
  assert.equal(nearestFree(() => true, 0, 0, 0, 3), null);
});
