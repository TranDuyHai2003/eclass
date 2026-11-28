import { test } from "node:test";
import assert from "node:assert/strict";
import { buildFarTile } from "@/lib/world/voxel/farTile";

const A = {
  top: (x: number, z: number) => Math.floor(4 + 3 * Math.sin(x / 9) + 2 * Math.cos(z / 7)),
  color: (): [number, number, number] => [0.4, 0.7, 0.3],
  water: 2,
  waterColor: [0.3, 0.6, 0.9] as [number, number, number],
};

test("ô địa hình xa: số đỉnh = lưới + váy, độ cao đúng hàm sinh, dưới mực nước san phẳng", () => {
  const t = buildFarTile(64, -128, 64, 4, A);
  const n = 64 / 4 + 1;
  assert.equal(t.p.length / 3, n * n + 4 * n);
  for (let j = 0; j < n; j += 5)
    for (let i = 0; i < n; i += 5) {
      const v = j * n + i;
      const h = A.top(64 + i * 4, -128 + j * 4);
      const want = h <= A.water ? A.water + 0.2 : h;
      assert.ok(Math.abs(t.p[v * 3 + 1] - want) < 1e-5);
    }
});

test("ô địa hình xa: mặt lưới quay lên (cuộn đúng), chỉ mục hợp lệ", () => {
  const t = buildFarTile(0, 0, 64, 8, A);
  const n = 9;
  const V = t.p.length / 3;
  for (const i of t.idx) assert.ok(i < V);
  for (let q = 0; q < (n - 1) * (n - 1) * 6; q += 3) {
    const [a, b, c] = [t.idx[q], t.idx[q + 1], t.idx[q + 2]];
    const P = (k: number) => [t.p[k * 3], t.p[k * 3 + 1], t.p[k * 3 + 2]];
    const A0 = P(a);
    const B0 = P(b);
    const C0 = P(c);
    const u = [B0[0] - A0[0], B0[1] - A0[1], B0[2] - A0[2]];
    const v = [C0[0] - A0[0], C0[1] - A0[1], C0[2] - A0[2]];
    const ny = u[2] * v[0] - u[0] * v[2];
    assert.ok(ny > 0, "mặt lưới phải hướng lên");
  }
});
