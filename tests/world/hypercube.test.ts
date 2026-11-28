import { test } from "node:test";
import assert from "node:assert/strict";
import { EDGES, PLANES, VERTS, project, rotate } from "@/lib/world/hypercube";

test("siêu khối: 16 đỉnh, 32 cạnh dài 2, mỗi đỉnh bậc 4", () => {
  assert.equal(VERTS.length, 16);
  assert.equal(EDGES.length, 32);
  const deg = new Array(16).fill(0);
  for (const [a, b] of EDGES) {
    deg[a]++;
    deg[b]++;
    const d = Math.hypot(...VERTS[a].map((x, i) => x - VERTS[b][i]));
    assert.ok(Math.abs(d - 2) < 1e-12);
  }
  assert.ok(deg.every((x) => x === 4));
  assert.equal(PLANES.length, 6);
});

test("siêu khối: quay trong mặt phẳng giữ độ dài; mặt chứa w đổi khối trong ↔ khối ngoài sau nửa vòng", () => {
  for (const pl of PLANES)
    for (const v of VERTS) {
      const r = rotate(v, pl, 0.73);
      assert.ok(Math.abs(Math.hypot(...r) - 2) < 1e-12);
    }
  const xw = PLANES.find((p) => p.id === "xw")!;
  const outer = VERTS.find((v) => v[0] === 1 && v[3] === 1)!; // w = 1 → chiếu ra to (khối ngoài)
  const s0 = Math.hypot(...project(outer));
  const s1 = Math.hypot(...project(rotate(outer, xw, Math.PI)));
  assert.ok(s1 < s0 * 0.6, `${s0} → ${s1}`);
  // mặt quen (xy) không đổi w → kích thước chiếu giữ nguyên
  const xy = PLANES.find((p) => p.id === "xy")!;
  assert.ok(Math.abs(Math.hypot(...project(rotate(outer, xy, 1.1))) - s0) < 1e-12);
});
