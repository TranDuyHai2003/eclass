/**
 * Matrix Forge — transform a block build by a 3×3 matrix (pure, testable).
 * v' = M·(v − pivot) + pivot. With det ≠ 0 we map INVERSELY (each target cell asks "where did I come from?")
 * so scaling fills solid shapes without holes; det = 0 collapses forward onto a plane/line.
 * |det| = how much volume (block count) is multiplied; det < 0 = mirrored; AB ≠ BA in general.
 */
export type Mat3 = [number, number, number, number, number, number, number, number, number];
export type Cell = { x: number; y: number; z: number; id: number };
type L = { en: string; vi: string };

export const CARDS: { id: string; name: L; m: Mat3; idea: L }[] = [
  { id: "rot", name: { en: "Rotate 90°", vi: "Quay 90°" }, m: [0, 0, 1, 0, 1, 0, -1, 0, 0], idea: { en: "det = 1: shape and size kept, only turned. The vertical axis is an eigenvector — it doesn't move.", vi: "det = 1: giữ nguyên hình và kích thước, chỉ xoay. Trục đứng là vectơ riêng — nó không đổi hướng." } },
  { id: "mirror", name: { en: "Mirror", vi: "Đối xứng gương" }, m: [-1, 0, 0, 0, 1, 0, 0, 0, 1], idea: { en: "det = −1: same volume, but left and right swap — no rotation can do this.", vi: "det = −1: thể tích như cũ nhưng trái phải đổi chỗ — không phép quay nào làm được." } },
  { id: "shear", name: { en: "Shear", vi: "Trượt" }, m: [1, 1, 0, 0, 1, 0, 0, 0, 1], idea: { en: "x' = x + y: each layer slides by its height. det = 1, so the block count is unchanged even though the shape leans.", vi: "x' = x + y: mỗi tầng trượt theo độ cao. det = 1 nên số khối không đổi dù hình nghiêng hẳn đi." } },
  { id: "stretch", name: { en: "Stretch ×2 (up)", vi: "Kéo dãn ×2 (lên)" }, m: [1, 0, 0, 0, 2, 0, 0, 0, 1], idea: { en: "det = 2: one direction doubled, so the volume doubles.", vi: "det = 2: kéo gấp đôi một chiều nên thể tích gấp đôi." } },
  { id: "scale", name: { en: "Scale ×2", vi: "Phóng ×2" }, m: [2, 0, 0, 0, 2, 0, 0, 0, 2], idea: { en: "det = 2³ = 8: doubling every length multiplies volume by eight.", vi: "det = 2³ = 8: gấp đôi mọi độ dài thì thể tích gấp tám." } },
  { id: "flatten", name: { en: "Project (flatten)", vi: "Chiếu (ép dẹt)" }, m: [1, 0, 0, 0, 0, 0, 0, 0, 1], idea: { en: "det = 0: the vertical direction is crushed to nothing. You can't undo it — a matrix with det 0 has no inverse.", vi: "det = 0: chiều đứng bị ép mất hẳn. Không thể hoàn tác — ma trận có det 0 không có nghịch đảo." } },
];

export function det3(m: Mat3): number {
  return m[0] * (m[4] * m[8] - m[5] * m[7]) - m[1] * (m[3] * m[8] - m[5] * m[6]) + m[2] * (m[3] * m[7] - m[4] * m[6]);
}
export function mul(a: Mat3, b: Mat3): Mat3 {
  const r = new Array(9).fill(0) as Mat3;
  for (let i = 0; i < 3; i++) for (let j = 0; j < 3; j++) for (let k = 0; k < 3; k++) r[i * 3 + j] += a[i * 3 + k] * b[k * 3 + j];
  return r;
}
export function inv3(m: Mat3): Mat3 | null {
  const d = det3(m);
  if (Math.abs(d) < 1e-9) return null;
  const [a, b, c, d1, e, f, g, h, i] = m;
  return [(e * i - f * h) / d, (c * h - b * i) / d, (b * f - c * e) / d, (f * g - d1 * i) / d, (a * i - c * g) / d, (c * d1 - a * f) / d, (d1 * h - e * g) / d, (b * g - a * h) / d, (a * e - b * d1) / d] as Mat3;
}
const apply = (m: Mat3, x: number, y: number, z: number): [number, number, number] => [m[0] * x + m[1] * y + m[2] * z, m[3] * x + m[4] * y + m[5] * z, m[6] * x + m[7] * y + m[8] * z];

/** Biến đổi tập khối quanh tâm pivot (pivot là toạ độ thực, thường là tâm đế rèn) */
export function transformCells(cells: Cell[], m: Mat3, pivot: { x: number; y: number; z: number }, maxOut = 3000): Cell[] {
  if (!cells.length) return [];
  const src = new Map<string, number>();
  for (const c of cells) src.set(`${c.x},${c.y},${c.z}`, c.id);
  const inv = inv3(m);
  const out: Cell[] = [];
  if (!inv) {
    // det = 0: ánh xạ xuôi, gộp các khối trùng
    const seen = new Set<string>();
    for (const c of cells) {
      const [x, y, z] = apply(m, c.x + 0.5 - pivot.x, c.y + 0.5 - pivot.y, c.z + 0.5 - pivot.z);
      const t = { x: Math.floor(x + pivot.x), y: Math.floor(y + pivot.y), z: Math.floor(z + pivot.z), id: c.id };
      const k = `${t.x},${t.y},${t.z}`;
      if (!seen.has(k)) {
        seen.add(k);
        out.push(t);
      }
    }
    return out;
  }
  // Hộp bao của ảnh
  let lo = [Infinity, Infinity, Infinity];
  let hi = [-Infinity, -Infinity, -Infinity];
  for (const c of cells)
    for (const dx of [0, 1]) for (const dy of [0, 1]) for (const dz of [0, 1]) {
      const p = apply(m, c.x + dx - pivot.x, c.y + dy - pivot.y, c.z + dz - pivot.z);
      lo = lo.map((v, i) => Math.min(v, p[i] + [pivot.x, pivot.y, pivot.z][i]));
      hi = hi.map((v, i) => Math.max(v, p[i] + [pivot.x, pivot.y, pivot.z][i]));
    }
  for (let x = Math.floor(lo[0]); x < Math.ceil(hi[0]); x++)
    for (let y = Math.floor(lo[1]); y < Math.ceil(hi[1]); y++)
      for (let z = Math.floor(lo[2]); z < Math.ceil(hi[2]); z++) {
        const [sx, sy, sz] = apply(inv, x + 0.5 - pivot.x, y + 0.5 - pivot.y, z + 0.5 - pivot.z);
        const id = src.get(`${Math.floor(sx + pivot.x)},${Math.floor(sy + pivot.y)},${Math.floor(sz + pivot.z)}`);
        if (id !== undefined) {
          out.push({ x, y, z, id });
          if (out.length >= maxOut) return out;
        }
      }
  return out;
}
