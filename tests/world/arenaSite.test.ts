import { test } from "node:test";
import assert from "node:assert/strict";
import { flattestSite } from "@/lib/world/arenaSite";

test("đấu trường: đứng cạnh đồi → dời tâm sang bãi phẳng gần nhất; đã phẳng thì giữ nguyên", () => {
  // đồi dốc ở x > 0 (cao dần), bãi phẳng ở x ≤ −4
  const hill = (x: number) => (x > -4 ? (x + 4) * 0.8 : 0);
  const r = flattestSite(0, 0, (x) => hill(x), { half: 8, radius: 16, step: 4 });
  assert.ok(r.cx <= -12, `tâm phải dời sang bãi phẳng: ${r.cx}`);
  assert.ok(r.range < 1, `chênh cao còn lại ${r.range}`);
  const flat = flattestSite(5.5, -3.5, () => 2, { half: 12 });
  assert.deepEqual([flat.cx, flat.cz, flat.range], [5.5, -3.5, 0]);
});

test("đấu trường: tránh sàn ngập dưới mực nước dù phẳng hơn", () => {
  // bên trái là đáy hồ phẳng (−5), bên phải đất hơi gợn (0…0,6)
  const g = (x: number, z: number) => (x < -6 ? -5 : 0.3 + 0.3 * Math.sin(x + z));
  const r = flattestSite(0, 0, g, { half: 6, radius: 16, step: 4, water: -2 });
  // khung nửa cạnh 6 không chạm đáy hồ (x < −6) ⇔ tâm ≥ 0
  assert.ok(r.cx >= 0, `không chọn đáy hồ: ${r.cx}`);
});
