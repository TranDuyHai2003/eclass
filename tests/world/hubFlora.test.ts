import { test } from "node:test";
import assert from "node:assert/strict";
import { canBloom, flowerClumps, shadowCenter, TREE_CASTERS, TREES } from "../../lib/world/hubFlora";
import { COLLIDERS, FOUNTAINS, GARDEN, PATH_HALF, pathDistance } from "../../lib/world/hubLayout";

test("khóm hoa: tất định, đủ số, nằm trên cỏ — không trên lối đá / gốc cây / bồn đài phun", () => {
  const a = flowerClumps(1600);
  const b = flowerClumps(1600);
  assert.deepEqual(a, b);
  assert.ok(a.length > 500, `chỉ có ${a.length} khóm`);
  for (const c of a) {
    assert.ok(canBloom(c.x, c.z));
    assert.ok(c.kind >= 0 && c.kind <= 3 && Number.isInteger(c.kind));
    for (const f of FOUNTAINS) assert.ok(Math.hypot(c.x - f.x, c.z - f.z) > f.r, "trong bồn đài phun");
    for (const t of TREES) assert.ok(Math.hypot(c.x - t.x, c.z - t.z) > 0.75 * t.s, "đè gốc cây");
  }
  // lối đá (ngoài vườn sinh vật) không có hoa
  const onPath = a.filter((c) => pathDistance(c.x, c.z) < PATH_HALF && Math.hypot(c.x, c.z) < 29 && Math.hypot(c.x - GARDEN.x, c.z - GARDEN.z) > GARDEN.r);
  assert.equal(onPath.length, 0);
  // không chặn đường: khóm hoa không nằm trong vật cản cứng (hoa không có va chạm, chỉ để kiểm tra bố trí)
  const inCollider = a.filter((c) => COLLIDERS.some((k) => Math.hypot(c.x - k.x, c.z - k.z) < k.r * 0.6));
  assert.ok(inCollider.length < a.length * 0.02);
});

test("khóm hoa: mức thấp ít hơn hẳn mức cao", () => {
  assert.ok(flowerClumps(400).length < flowerClumps(1600).length * 0.45);
});

test("bóng tán: lệch NGƯỢC hướng nắng, dài hơn khi nắng thấp, kẹp ở giờ vàng", () => {
  assert.equal(TREE_CASTERS.length, TREES.length);
  const c = TREE_CASTERS[0];
  // nắng từ phía tây (−x) → bóng về phía đông (+x)
  const noonish = shadowCenter(c, [-0.5, 0.866, 0]);
  const low = shadowCenter(c, [-0.97, 0.24, 0]);
  assert.ok(noonish[0] > c[0] && Math.abs(noonish[1] - c[1]) < 1e-9);
  assert.ok(low[0] - c[0] > noonish[0] - c[0]);
  // kẹp cao độ ≥ 0,38 → bóng không dài quá ~2,5 lần độ cao tán
  assert.ok(low[0] - c[0] <= c[3] * 2.5);
});
