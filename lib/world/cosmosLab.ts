/**
 * Phòng thí nghiệm vũ trụ (Thế giới Bất Khả) — toán thuần cho 5 thí nghiệm tương tác ở 5 kỳ quan:
 *  Lorenz (hiệu ứng cánh bướm) · phyllotaxis (góc vàng) · thớ Hopf (điểm ↔ vòng tròn) · nút ba lá (tô 3 màu) · Sierpiński (chia mãi).
 * Không phụ thuộc three.js — dùng chung cho cảnh và test.
 */
export type V3 = [number, number, number];

// ── Lorenz ──
export const LZ = { sigma: 10, rho: 28, beta: 8 / 3 };
function lzF(p: V3): V3 {
  return [LZ.sigma * (p[1] - p[0]), p[0] * (LZ.rho - p[2]) - p[1], p[0] * p[1] - LZ.beta * p[2]];
}
/** Một bước Runge–Kutta 4 (ghi đè p) */
export function lorenzStep(p: V3, dt: number): V3 {
  const a = lzF(p);
  const b = lzF([p[0] + (dt / 2) * a[0], p[1] + (dt / 2) * a[1], p[2] + (dt / 2) * a[2]]);
  const c = lzF([p[0] + (dt / 2) * b[0], p[1] + (dt / 2) * b[1], p[2] + (dt / 2) * b[2]]);
  const d = lzF([p[0] + dt * c[0], p[1] + dt * c[1], p[2] + dt * c[2]]);
  for (let i = 0; i < 3; i++) p[i] += (dt / 6) * (a[i] + 2 * b[i] + 2 * c[i] + d[i]);
  return p;
}
/** Điểm xuất phát nằm sẵn trên hấp dẫn lạ (đã chạy qua pha chuyển tiếp) */
export function lorenzStart(): V3 {
  const p: V3 = [0.1, 0, 0];
  for (let i = 0; i < 3000; i++) lorenzStep(p, 0.005);
  return p;
}
/** Hệ số co giãn / tâm của mô hình Lorenz trong cảnh (khớp Blender: (x, y, z − 25) × 0,3) */
export const LZ_SCALE = 0.3;

// ── Phyllotaxis ──
export const GOLDEN_ANGLE = 360 / ((1 + Math.sqrt(5)) / 2) ** 2; // ≈ 137,508°
/** Hạt thứ k (1..n): bán kính c·√k, góc k·α — mô hình Vogel cho đầu hoa hướng dương */
export function phyllotaxis(n: number, angleDeg: number, c = 1): [number, number][] {
  const a = (angleDeg * Math.PI) / 180;
  const out: [number, number][] = [];
  for (let k = 1; k <= n; k++) {
    const r = c * Math.sqrt(k);
    out.push([r * Math.cos(k * a), r * Math.sin(k * a)]);
  }
  return out;
}
/** Độ "kín" của cách xếp: khoảng cách nhỏ nhất giữa hai hạt / c (càng lớn càng đều, không chừa khe) */
export function packingScore(n: number, angleDeg: number): number {
  const P = phyllotaxis(n, angleDeg);
  let best = Infinity;
  for (let i = Math.floor(n / 2); i < n; i++)
    for (let j = 0; j < n; j++) {
      if (i === j) continue;
      const d = Math.hypot(P[i][0] - P[j][0], P[i][1] - P[j][1]);
      if (d < best) best = d;
    }
  return best;
}

// ── Thớ Hopf ──
/**
 * Thớ (vòng tròn trong S³) nằm trên điểm của mặt cầu S² có góc cực η, kinh độ φ, chiếu nổi xuống R³:
 * z₁ = cos(η/2)·e^{i(t+φ)}, z₂ = sin(η/2)·e^{it}; (x₁,x₂,x₃,x₄) = (Re z₁, Im z₁, Re z₂, Im z₂) ↦ (x₁,x₂,x₃)/(1−x₄).
 */
export function hopfFiber(eta: number, phi: number, n = 96, scale = 1): V3[] {
  const out: V3[] = [];
  for (let s = 0; s < n; s++) {
    const t = (2 * Math.PI * s) / n;
    const x1 = Math.cos(eta / 2) * Math.cos(t + phi);
    const x2 = Math.cos(eta / 2) * Math.sin(t + phi);
    const x3 = Math.sin(eta / 2) * Math.cos(t);
    const x4 = Math.sin(eta / 2) * Math.sin(t);
    const d = Math.max(1 - x4, 1e-4);
    out.push([(x1 / d) * scale, (x2 / d) * scale, (x3 / d) * scale]);
  }
  return out;
}
/** Ánh xạ Hopf của một điểm trên thớ → điểm trên S² (để kiểm chứng) */
export function hopfBase(eta: number, phi: number): V3 {
  return [Math.sin(eta) * Math.cos(phi), Math.sin(eta) * Math.sin(phi), Math.cos(eta)];
}
/** Số móc xích Gauss của hai đường cong khép kín (≈ ±1 nếu móc vào nhau, 0 nếu rời) */
export function linkingNumber(A: V3[], B: V3[]): number {
  let s = 0;
  for (let i = 0; i < A.length; i++) {
    const a0 = A[i];
    const a1 = A[(i + 1) % A.length];
    const da: V3 = [a1[0] - a0[0], a1[1] - a0[1], a1[2] - a0[2]];
    const am: V3 = [(a0[0] + a1[0]) / 2, (a0[1] + a1[1]) / 2, (a0[2] + a1[2]) / 2];
    for (let j = 0; j < B.length; j++) {
      const b0 = B[j];
      const b1 = B[(j + 1) % B.length];
      const db: V3 = [b1[0] - b0[0], b1[1] - b0[1], b1[2] - b0[2]];
      const r: V3 = [am[0] - (b0[0] + b1[0]) / 2, am[1] - (b0[1] + b1[1]) / 2, am[2] - (b0[2] + b1[2]) / 2];
      const L = Math.hypot(...r);
      const cx = da[1] * db[2] - da[2] * db[1];
      const cy = da[2] * db[0] - da[0] * db[2];
      const cz = da[0] * db[1] - da[1] * db[0];
      s += (r[0] * cx + r[1] * cy + r[2] * cz) / (L * L * L);
    }
  }
  return s / (4 * Math.PI);
}

// ── Nút ba lá ──
/** Tham số hoá nút ba lá; (x, y) là mặt chiếu (sơ đồ nút), z là độ sâu */
export function trefoil(t: number): V3 {
  return [Math.sin(t) + 2 * Math.sin(2 * t), Math.cos(t) - 2 * Math.cos(2 * t), -Math.sin(3 * t)];
}
export interface Crossing {
  /** tham số của nhánh trên / nhánh dưới */
  over: number;
  under: number;
}
/** Các điểm giao trên sơ đồ chiếu (tìm số: cắt nhau giữa các đoạn của đường gấp khúc) */
export function trefoilCrossings(n = 720): Crossing[] {
  const T = (i: number) => (2 * Math.PI * i) / n;
  const P = Array.from({ length: n }, (_, i) => trefoil(T(i)));
  const out: Crossing[] = [];
  for (let i = 0; i < n; i++)
    for (let j = i + 2; j < n; j++) {
      if (i === 0 && j === n - 1) continue;
      const a = P[i];
      const b = P[(i + 1) % n];
      const c = P[j];
      const d = P[(j + 1) % n];
      const den = (b[0] - a[0]) * (d[1] - c[1]) - (b[1] - a[1]) * (d[0] - c[0]);
      if (Math.abs(den) < 1e-12) continue;
      const u = ((c[0] - a[0]) * (d[1] - c[1]) - (c[1] - a[1]) * (d[0] - c[0])) / den;
      const v = ((c[0] - a[0]) * (b[1] - a[1]) - (c[1] - a[1]) * (b[0] - a[0])) / den;
      if (u < 0 || u >= 1 || v < 0 || v >= 1) continue;
      const ti = T(i) + u * (T(1) - T(0));
      const tj = T(j) + v * (T(1) - T(0));
      const zi = a[2] + (b[2] - a[2]) * u;
      const zj = c[2] + (d[2] - c[2]) * v;
      out.push(zi > zj ? { over: ti, under: tj } : { over: tj, under: ti });
    }
  return out;
}
/**
 * Tô 3 màu: cắt nút tại các điểm "chui dưới" thành các cung; cung thứ k (theo chiều tham số) tô màu k mod 3.
 * colorAt(t) → 0 | 1 | 2.
 */
export function trefoilColoring(): { cuts: number[]; colorAt: (t: number) => number } {
  const cuts = trefoilCrossings()
    .map((c) => c.under)
    .sort((a, b) => a - b);
  const colorAt = (t: number) => {
    const tt = ((t % (2 * Math.PI)) + 2 * Math.PI) % (2 * Math.PI);
    let k = 0;
    while (k < cuts.length && tt >= cuts[k]) k++;
    return k % cuts.length % 3;
  };
  return { cuts, colorAt };
}

// ── Sierpiński ──
/** Bậc n: số khối, thể tích, diện tích mặt (so với khối ban đầu) và chiều fractal */
export function sierpinskiStats(n: number) {
  return { count: 4 ** n, volume: 0.5 ** n, area: 1, dimension: Math.log(4) / Math.log(2) };
}
/** Tâm + cỡ (cạnh) các khối tứ diện con ở bậc n, khối gốc cạnh E, đáy ở y = 0 (toạ độ y lên trên) */
export function sierpinskiCells(n: number, E = 1): { c: V3; e: number }[] {
  const h = E * Math.sqrt(2 / 3);
  const R = E / Math.sqrt(3);
  const v: V3[] = [
    [R, 0, 0],
    [R * Math.cos((2 * Math.PI) / 3), 0, R * Math.sin((2 * Math.PI) / 3)],
    [R * Math.cos((4 * Math.PI) / 3), 0, R * Math.sin((4 * Math.PI) / 3)],
    [0, h, 0],
  ];
  let cells: V3[][] = [v];
  for (let k = 0; k < n; k++) {
    const next: V3[][] = [];
    for (const t of cells)
      for (let i = 0; i < 4; i++) next.push(t.map((p) => [(p[0] + t[i][0]) / 2, (p[1] + t[i][1]) / 2, (p[2] + t[i][2]) / 2] as V3));
    cells = next;
  }
  const e = E / 2 ** n;
  return cells.map((t) => ({ c: [(t[0][0] + t[1][0] + t[2][0] + t[3][0]) / 4, (t[0][1] + t[1][1] + t[2][1] + t[3][1]) / 4, (t[0][2] + t[1][2] + t[2][2] + t[3][2]) / 4] as V3, e }));
}
