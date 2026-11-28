import { test } from "node:test";
import assert from "node:assert/strict";
import { PW, angle, length, nearPendulumLever, period } from "@/lib/world/pendulumWave";
import { dirOf } from "@/lib/world/tessRoom";

test("con lắc sóng: chu kỳ / chiều dài đúng thiết kế (k = 1 → 3 s, 2,24 m; k = 24 → 1,70 s, 0,72 m)", () => {
  assert.ok(Math.abs(period(1) - 3) < 1e-9);
  assert.ok(Math.abs(length(1) - 2.236) < 0.01);
  assert.ok(Math.abs(period(24) - 90 / 53) < 1e-9);
  assert.ok(Math.abs(length(24) - 0.716) < 0.01);
  // quả dài nhất không chạm sàn (tâm quả + bán kính 0,13 < trục treo)
  assert.ok(PW.pivotY - length(1) - 0.13 > 0.5);
});

test("con lắc sóng: thẳng hàng lại sau Γ = 90 s; ở Γ/2 các quả kề nhau ngược pha", () => {
  for (let k = 1; k <= PW.n; k++) assert.ok(Math.abs(angle(k, 90) - PW.theta0) < 1e-9);
  for (let k = 1; k < PW.n; k++) assert.ok(Math.abs(angle(k, 45) + angle(k + 1, 45)) < 1e-9);
  // ở giữa (t = 30 s) không thẳng hàng
  const a = Array.from({ length: PW.n }, (_, i) => angle(i + 1, 30));
  assert.ok(Math.max(...a) - Math.min(...a) > PW.theta0);
});

test("cần gạt: chỉ bật khi đứng trên sàn chính gần cần", () => {
  const [dx, dz] = dirOf(PW.leverB);
  assert.equal(nearPendulumLever(dx * PW.leverR, dz * PW.leverR, 0), true);
  assert.equal(nearPendulumLever(dx * PW.leverR, dz * PW.leverR, 5), false);
  assert.equal(nearPendulumLever(0, 0, 0), false);
});
