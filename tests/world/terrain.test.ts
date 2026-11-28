import { test } from "node:test";
import assert from "node:assert/strict";
import { blockTop, dcos, dsin, height, mathBiome, nearbyMathCells, voronoiCell } from "@/lib/world/terrain";

test("sin tất định khớp Math.sin (< 1e-7) trên dải rộng", () => {
  for (let x = -400; x <= 400; x += 0.37) {
    assert.ok(Math.abs(dsin(x) - Math.sin(x)) < 1e-7, `sin ${x}`);
    assert.ok(Math.abs(dcos(x) - Math.cos(x)) < 1e-7, `cos ${x}`);
  }
});

test("địa hình tất định: gọi lại cho cùng kết quả; điểm xuất phát bằng phẳng, không có biome toán học", () => {
  for (const [x, z] of [[0, 0], [5, -7], [-120, 333], [401, -77]]) {
    assert.equal(height(x, z), height(x, z));
    assert.equal(blockTop(x, z), blockTop(x, z));
  }
  assert.equal(mathBiome(10, 10), null);
  assert.ok(Math.abs(height(3, 4)) < 1e-9);
});

test("có Thảo nguyên Voronoi trong vài km quanh gốc; ô Voronoi: d1 ≤ d2, cùng điểm cùng ô", () => {
  const kinds = new Set<string>();
  for (let x = -2925; x <= 3000; x += 150) for (let z = -2925; z <= 3000; z += 150) for (const c of nearbyMathCells(x, z, 1)) kinds.add(c.kind);
  for (const k of ["function", "sierpinski", "fractal", "saddle", "voronoi"]) assert.ok(kinds.has(k), `thiếu ${k}`);
  for (const [x, z] of [[3, 4], [-50.5, 77.25], [999, -321]]) {
    const a = voronoiCell(x, z);
    assert.ok(a.d1 <= a.d2);
    assert.equal(voronoiCell(x, z).id, a.id);
  }
});
