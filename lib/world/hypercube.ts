/**
 * Siêu khối có tay cầm (bốt Siêu khối, TESSERACT_BOOTH.md §13 I1) — toán thuần 4 chiều.
 * Trong 4D, phép quay diễn ra TRONG MỘT MẶT PHẲNG (không quanh trục): có 6 mặt xy, xz, yz (quen thuộc) và xw, yw, zw
 * (“bất khả” với mắt 3D: khối trong lộn dần ra thành khối ngoài). Chiếu phối cảnh 4D → 3D: p · k / (k − w).
 */
export type V4 = [number, number, number, number];
export const PLANES: { id: string; i: number; j: number; w: boolean }[] = [
  { id: "xy", i: 0, j: 1, w: false },
  { id: "xz", i: 0, j: 2, w: false },
  { id: "yz", i: 1, j: 2, w: false },
  { id: "xw", i: 0, j: 3, w: true },
  { id: "yw", i: 1, j: 3, w: true },
  { id: "zw", i: 2, j: 3, w: true },
];
export const HC = { bearing: 135, r: 7.5, y: 2.05, size: 0.4, k: 3 } as const;

/** 16 đỉnh (±1)⁴ */
export const VERTS: V4[] = Array.from({ length: 16 }, (_, n) => [n & 1 ? 1 : -1, n & 2 ? 1 : -1, n & 4 ? 1 : -1, n & 8 ? 1 : -1]);
/** 32 cạnh: cặp đỉnh khác nhau đúng một toạ độ */
export const EDGES: [number, number][] = [];
for (let a = 0; a < 16; a++) for (let b = a + 1; b < 16; b++) if (((a ^ b) & ((a ^ b) - 1)) === 0) EDGES.push([a, b]);

export function rotate(p: V4, plane: { i: number; j: number }, ang: number): V4 {
  const q = p.slice() as V4;
  const c = Math.cos(ang);
  const s = Math.sin(ang);
  q[plane.i] = p[plane.i] * c - p[plane.j] * s;
  q[plane.j] = p[plane.i] * s + p[plane.j] * c;
  return q;
}
/** chiếu phối cảnh 4D → 3D (máy chiếu ở w = k) */
export function project(p: V4, k: number = HC.k): [number, number, number] {
  const f = k / (k - p[3]);
  return [p[0] * f, p[1] * f, p[2] * f];
}

/** gần máy chiếu (toạ độ cục bộ phòng, sàn chính) */
export function nearHypercube(x: number, z: number, y: number): boolean {
  const b = (HC.bearing * Math.PI) / 180;
  return y < 1.2 && Math.hypot(x - Math.sin(b) * HC.r, z + Math.cos(b) * HC.r) < 1.5;
}
