import { test } from "node:test";
import assert from "node:assert/strict";
import { fromDisk, geodesic, geodesicPoints, hypDistance, tilingCircle, toDisk, triangleAngles, type P2 } from "@/lib/world/hyperbolic";

const sum = (t: [number, number, number]) => t[0] + t[1] + t[2];

test("đường trắc địa vuông góc với đường tròn đơn vị (|c|² = 1 + r²) và đi qua cả hai điểm", () => {
  const a: P2 = [0.3, 0.2];
  const b: P2 = [-0.4, 0.5];
  const g = geodesic(a, b);
  assert.equal(g.line, false);
  if (g.line) return;
  assert.ok(Math.abs(g.c[0] ** 2 + g.c[1] ** 2 - (1 + g.r ** 2)) < 1e-9);
  for (const p of [a, b]) assert.ok(Math.abs(Math.hypot(p[0] - g.c[0], p[1] - g.c[1]) - g.r) < 1e-9);
  // cung nằm trọn trong đĩa
  for (const p of geodesicPoints(a, b)) assert.ok(Math.hypot(...p) < 1);
  // thẳng hàng với tâm → đường kính
  assert.equal(geodesic([0.2, 0.2], [-0.4, -0.4]).line, true);
});

test("tổng ba góc < 180°: tam giác nhỏ gần tâm ≈ 180°, tam giác lớn sát mép tụt mạnh", () => {
  const tiny = sum(triangleAngles([0.01, 0], [-0.005, 0.0087], [-0.005, -0.0087]));
  assert.ok(tiny < Math.PI && tiny > Math.PI - 0.01, `nhỏ ${tiny}`);
  const big = sum(triangleAngles([0.9, 0], [-0.45, 0.78], [-0.45, -0.78]));
  assert.ok(big < Math.PI / 4, `lớn ${(big * 180) / Math.PI}°`);
});

test("tam giác có một đỉnh ở tâm và hai cạnh thẳng: góc tại tâm đúng bằng góc Euclid", () => {
  const [a] = triangleAngles([0, 0], [0.5, 0], [0, 0.5]);
  assert.ok(Math.abs(a - Math.PI / 2) < 1e-3);
});

test("khoảng cách hyperbolic: từ tâm tới r là 2·artanh(r); tiến ra mép → vô hạn", () => {
  assert.ok(Math.abs(hypDistance([0, 0], [0.5, 0]) - 2 * Math.atanh(0.5)) < 1e-9);
  assert.ok(hypDistance([0, 0], [0.999, 0]) > 7);
});

test("tam giác cơ bản lát {7,3}: đường tròn cạnh vuông góc đường tròn đơn vị; quy đổi toạ độ sân ↔ đĩa", () => {
  const { d, r } = tilingCircle(7, 3);
  assert.ok(Math.abs(d * d - (1 + r * r)) < 1e-9);
  const [x, z] = fromDisk([0.3, -0.6]);
  const p = toDisk(x, z);
  assert.ok(Math.abs(p[0] - 0.3) < 1e-12 && Math.abs(p[1] + 0.6) < 1e-12);
});
