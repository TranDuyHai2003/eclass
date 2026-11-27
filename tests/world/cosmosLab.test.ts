import { test } from "node:test";
import assert from "node:assert/strict";
import {
  GOLDEN_ANGLE,
  hopfBase,
  hopfFiber,
  linkingNumber,
  lorenzStart,
  lorenzStep,
  packingScore,
  phyllotaxis,
  sierpinskiCells,
  sierpinskiStats,
  trefoilColoring,
  trefoilCrossings,
  type V3,
} from "../../lib/world/cosmosLab";

test("Lorenz: lệch một phần triệu → sau ~30 giây hai quỹ đạo xa nhau cỡ cả cánh bướm; không lệch → trùng khít", () => {
  const a = lorenzStart();
  const b: V3 = [a[0] + 1e-6, a[1], a[2]];
  const c: V3 = [...a];
  for (let i = 0; i < 6000; i++) {
    lorenzStep(a, 0.005);
    lorenzStep(b, 0.005);
    lorenzStep(c, 0.005);
  }
  assert.ok(Math.hypot(a[0] - b[0], a[1] - b[1], a[2] - b[2]) > 3);
  assert.equal(Math.hypot(a[0] - c[0], a[1] - c[1], a[2] - c[2]), 0);
  // vẫn ở trên hấp dẫn lạ (bị chặn)
  assert.ok(Math.abs(a[0]) < 30 && a[2] > 0 && a[2] < 60);
});

test("góc vàng ≈ 137,508° và xếp hạt kín hơn góc hữu tỉ / góc lệch nhẹ", () => {
  assert.ok(Math.abs(GOLDEN_ANGLE - 137.508) < 0.001);
  const g = packingScore(300, GOLDEN_ANGLE);
  assert.ok(g > packingScore(300, 137.0));
  assert.ok(g > packingScore(300, 135));
});

test("góc 135° = 3/8 vòng → hạt dồn thành 8 tia thẳng", () => {
  const P = phyllotaxis(80, 135);
  for (let k = 0; k + 8 < 80; k++) {
    const a1 = Math.atan2(P[k][1], P[k][0]);
    const a2 = Math.atan2(P[k + 8][1], P[k + 8][0]);
    assert.ok(Math.abs(Math.sin(a1 - a2)) < 1e-9);
  }
});

test("Hopf: mỗi thớ là một vòng tròn; hai thớ khác nhau luôn móc vào nhau đúng một lần", () => {
  const A = hopfFiber(1.1, 0.3, 160);
  const B = hopfFiber(1.9, 2.2, 160);
  const C = hopfFiber(0.6, 4.0, 160);
  for (const [X, Y] of [
    [A, B],
    [A, C],
    [B, C],
  ]) assert.ok(Math.abs(Math.abs(linkingNumber(X, Y)) - 1) < 0.05);
  // là đường tròn: tâm ngoại tiếp của 3 điểm → mọi điểm khác cách tâm đúng bán kính
  const [p, q, r] = [A[0], A[50], A[110]];
  const sub = (u: V3, v: V3): V3 => [u[0] - v[0], u[1] - v[1], u[2] - v[2]];
  const cross = (u: V3, v: V3): V3 => [u[1] * v[2] - u[2] * v[1], u[2] * v[0] - u[0] * v[2], u[0] * v[1] - u[1] * v[0]];
  const dot = (u: V3, v: V3) => u[0] * v[0] + u[1] * v[1] + u[2] * v[2];
  const ab = sub(q, p);
  const ac = sub(r, p);
  const n = cross(ab, ac);
  const k = 1 / (2 * dot(n, n));
  const t1 = cross(n, ab).map((x) => x * dot(ac, ac));
  const t2 = cross(ac, n).map((x) => x * dot(ab, ab));
  const c: V3 = [p[0] + (t1[0] + t2[0]) * k, p[1] + (t1[1] + t2[1]) * k, p[2] + (t1[2] + t2[2]) * k];
  const R = Math.hypot(...sub(p, c));
  for (const x of A) assert.ok(Math.abs(Math.hypot(...sub(x, c)) - R) < 1e-6 * Math.max(1, R));
  assert.ok(Math.abs(Math.hypot(...hopfBase(1.1, 0.3)) - 1) < 1e-12);
});

test("nút ba lá: đúng 3 điểm giao; tô 3 màu hợp lệ (mỗi giao: 3 màu khác nhau)", () => {
  const X = trefoilCrossings();
  assert.equal(X.length, 3);
  const { colorAt } = trefoilColoring();
  const e = 1e-3;
  for (const x of X) {
    const cols = new Set([colorAt(x.over), colorAt(x.under - e), colorAt(x.under + e)]);
    assert.equal(cols.size, 3);
  }
});

test("Sierpiński: 4ⁿ khối, thể tích ½ⁿ, diện tích giữ nguyên, chiều = 2", () => {
  const s = sierpinskiStats(5);
  assert.equal(s.count, 1024);
  assert.equal(s.volume, 1 / 32);
  assert.equal(s.area, 1);
  assert.ok(Math.abs(s.dimension - 2) < 1e-12);
  const cells = sierpinskiCells(3, 8);
  assert.equal(cells.length, 64);
  assert.equal(cells[0].e, 1);
});
