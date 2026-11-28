import { test } from "node:test";
import assert from "node:assert/strict";
import { ROLL_R, fulgurite, rollingSphereTarget, type StrikeCand } from "@/lib/world/lightning";

const flat = (n = 15): StrikeCand[] => {
  const out: StrikeCand[] = [];
  for (let x = -n; x <= n; x++) for (let z = -n; z <= n; z++) out.push({ x, z, top: 0 });
  return out;
};

test("đất bằng: sét đánh ngay dưới tia tiên đạo", () => {
  const c = flat();
  const i = rollingSphereTarget(c, 3, -2);
  assert.deepEqual([c[i].x, c[i].z], [3, -2]);
});

test("cột thu lôi cao che chở người đứng cạnh chân cột (quả cầu tựa vào đỉnh cột trước)", () => {
  const c = flat();
  c.push({ x: 0, z: 0, top: 6, conductor: true });
  const player = { x: 2, z: 0, top: 1.8, player: true };
  c.push(player);
  // tia tiên đạo ngay trên đầu người chơi
  const i = rollingSphereTarget(c, 2, 0);
  assert.equal(c[i].top, 6, "sét phải vào đỉnh cột chứ không vào người");
  // không có cột: chính người chơi (điểm cao nhất) bị đánh
  const c2 = flat();
  c2.push(player);
  assert.equal(c2[rollingSphereTarget(c2, 2, 0)].player, true);
});

test("ngoài bán kính cầu thì cột không che: người ở xa cột bị đánh", () => {
  const c = flat();
  c.push({ x: 0, z: 0, top: 6, conductor: true });
  c.push({ x: ROLL_R + 4, z: 0, top: 1.8, player: true });
  assert.equal(c[rollingSphereTarget(c, ROLL_R + 4, 0)].player, true);
});

test("fulgurite: chỉ các khối cát liền nhau từ mặt xuống, tối đa 4", () => {
  const sand = new Set([9, 8, 7, 6, 5, 4]);
  assert.deepEqual(fulgurite(10, (y) => sand.has(y)), [9, 8, 7, 6]);
  assert.deepEqual(fulgurite(10, (y) => y === 9), [9]);
  assert.deepEqual(fulgurite(10, () => false), []);
});
