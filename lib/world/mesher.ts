/**
 * Dựng lưới một chunk voxel (thuần, không three — dùng được trong worker / test):
 *  • đọc khối MỘT lần vào mảng dày đặc (CHUNK + 2)² × H (viền 1 khối để biết mặt giáp không khí ở mép chunk) — nhưng chỉ
 *    trong khoảng y CỦA TỪNG CỘT (chunk có đảo nổi / hang không bắt cả chunk quét từ đáy hang tới đỉnh đảo);
 *  • chỉ sinh mặt giáp không khí; mỗi mặt 4 đỉnh + 6 chỉ mục (hình học có chỉ mục, ít hơn 1/3 đỉnh so với 6 đỉnh rời);
 *  • AO ĐỈNH kiểu Minecraft (0fps.net "Ambient occlusion for Minecraft-like worlds"): mỗi đỉnh xét 2 khối cạnh + 1 khối góc
 *    phía trước mặt → mức 0..3; đường chéo của tứ giác lật theo AO để không gãy sọc dị hướng.
 * Màu mặt do hàm `color(x, y, z, id, ny)` trả (sRGB 0..1), đã nhân bóng hướng; mesher nhân thêm AO.
 */
export type MeshAccess = {
  blockAt: (x: number, y: number, z: number) => number;
  columnRange: (x: number, z: number) => [number, number];
  isGlow: (id: number) => boolean;
  color: (x: number, y: number, z: number, id: number, faceNy: number) => [number, number, number];
};
export type MeshData = { p: Float32Array; n: Float32Array; c: Float32Array; idx: Uint32Array };

/** mặt: pháp tuyến, 4 đỉnh (thứ tự ngược chiều kim đồng hồ nhìn từ ngoài), bóng hướng */
const FACES: { n: [number, number, number]; v: [number, number, number][]; shade: number }[] = [
  { n: [0, 1, 0], v: [[0, 1, 1], [1, 1, 1], [1, 1, 0], [0, 1, 0]], shade: 1 },
  { n: [0, -1, 0], v: [[0, 0, 0], [1, 0, 0], [1, 0, 1], [0, 0, 1]], shade: 0.55 },
  { n: [1, 0, 0], v: [[1, 0, 1], [1, 0, 0], [1, 1, 0], [1, 1, 1]], shade: 0.82 },
  { n: [-1, 0, 0], v: [[0, 0, 0], [0, 0, 1], [0, 1, 1], [0, 1, 0]], shade: 0.82 },
  { n: [0, 0, 1], v: [[0, 0, 1], [1, 0, 1], [1, 1, 1], [0, 1, 1]], shade: 0.72 },
  { n: [0, 0, -1], v: [[1, 0, 0], [0, 0, 0], [0, 1, 0], [1, 1, 0]], shade: 0.72 },
];
export const FACE_SHADE = FACES.map((f) => f.shade);
/** mức sáng theo số khối che (0 → 1,0 … 3 → 0,55) */
export const AO_LEVEL = [1, 0.82, 0.68, 0.55];

export function vertexAO(side1: boolean, side2: boolean, corner: boolean): number {
  if (side1 && side2) return 3;
  return (side1 ? 1 : 0) + (side2 ? 1 : 0) + (corner ? 1 : 0);
}

class Buf {
  p: number[] = [];
  n: number[] = [];
  c: number[] = [];
  idx: number[] = [];
  done(): MeshData {
    return { p: new Float32Array(this.p), n: new Float32Array(this.n), c: new Float32Array(this.c), idx: new Uint32Array(this.idx) };
  }
}

/** Ô "đặc thật" nằm dưới khoảng của cột (không đọc khối, chỉ biết là đặc) — không bao giờ sinh mặt */
const SOLID_BELOW = -1;

export function meshChunk(cx: number, cz: number, size: number, A: MeshAccess): { solid: MeshData; glow: MeshData } {
  const W = size + 2;
  const x0 = cx * size - 1;
  const z0 = cz * size - 1;
  // Khoảng y theo TỪNG CỘT (hợp đồng columnRange: dưới lo là đặc, trên hi là rỗng). Cột cần đọc từ
  // min(lo của 3×3 cột lân cận) − 1: ô kề hang / hố của cột bên cạnh vẫn lộ mặt; phần dưới nữa chắc chắn bị che.
  const ra = new Int32Array(W * W);
  const rb = new Int32Array(W * W);
  for (let j = 0; j < W; j++)
    for (let i = 0; i < W; i++) {
      const [a, b] = A.columnRange(x0 + i, z0 + j);
      ra[j * W + i] = a;
      rb[j * W + i] = b;
    }
  const fLo = new Int32Array(W * W);
  const fHi = new Int32Array(W * W);
  let lo = Infinity;
  let hi = -Infinity;
  for (let j = 0; j < W; j++)
    for (let i = 0; i < W; i++) {
      let m = ra[j * W + i];
      for (let b = j - 1; b <= j + 1; b++)
        for (let a = i - 1; a <= i + 1; a++) if (a >= 0 && b >= 0 && a < W && b < W && ra[b * W + a] < m) m = ra[b * W + a];
      const fl = m - 1;
      const fh = rb[j * W + i] + 1;
      fLo[j * W + i] = fl;
      fHi[j * W + i] = fh;
      if (fl < lo) lo = fl;
      if (fh > hi) hi = fh;
    }
  hi += 1;
  const H = hi - lo;
  const ids = new Int16Array(W * W * H);
  // dưới đáy mảng: đặc (hợp đồng columnRange) → không sinh mặt đáy thừa cho lớp thấp nhất
  const at = (i: number, j: number, k: number) => (k < 0 ? SOLID_BELOW : i < 0 || j < 0 || i >= W || j >= W || k >= H ? 0 : ids[(k * W + j) * W + i]);
  for (let j = 0; j < W; j++)
    for (let i = 0; i < W; i++) {
      const k0 = fLo[j * W + i] - lo;
      const k1 = fHi[j * W + i] - lo;
      for (let k = 0; k < k0; k++) ids[(k * W + j) * W + i] = SOLID_BELOW;
      for (let k = k0; k <= k1; k++) ids[(k * W + j) * W + i] = A.blockAt(x0 + i, lo + k, z0 + j);
    }
  const solid = new Buf();
  const glow = new Buf();
  const solidAt = (i: number, j: number, k: number) => at(i, j, k) !== 0;
  for (let j = 1; j <= size; j++)
    for (let i = 1; i <= size; i++)
      for (let k = fLo[j * W + i] - lo, k1 = fHi[j * W + i] - lo; k <= k1; k++) {
        const id = at(i, j, k);
        if (id === 0) continue;
        const x = x0 + i;
        const y = lo + k;
        const z = z0 + j;
        const out = A.isGlow(id) ? glow : solid;
        for (const f of FACES) {
          const [nx, ny, nz] = f.n;
          if (solidAt(i + nx, j + nz, k + ny)) continue;
          const rgb = A.color(x, y, z, id, ny);
          const base = out.p.length / 3;
          const ao: number[] = [];
          for (const v of f.v) {
            // hai trục tiếp tuyến của mặt: lệch về phía đỉnh (−1 hoặc +1) trên mỗi trục khác pháp tuyến
            const d = [v[0] * 2 - 1, v[1] * 2 - 1, v[2] * 2 - 1];
            const t = [0, 1, 2].filter((a) => f.n[a] === 0);
            const p = [i + nx, j + nz, k + ny]; // ô không khí ngay trước mặt (i, j, k) ↔ (x, z, y)
            const off = (axis: number) => (axis === 0 ? [d[0], 0, 0] : axis === 1 ? [0, 0, d[1]] : [0, d[2], 0]); // (Δi, Δj, Δk)
            const a1 = off(t[0]);
            const a2 = off(t[1]);
            const s1 = solidAt(p[0] + a1[0], p[1] + a1[1], p[2] + a1[2]);
            const s2 = solidAt(p[0] + a2[0], p[1] + a2[1], p[2] + a2[2]);
            const cn = solidAt(p[0] + a1[0] + a2[0], p[1] + a1[1] + a2[1], p[2] + a1[2] + a2[2]);
            const lvl = vertexAO(s1, s2, cn);
            ao.push(lvl);
            out.p.push(x + v[0], y + v[1], z + v[2]);
            out.n.push(nx, ny, nz);
            const m = f.shade * AO_LEVEL[lvl];
            out.c.push(rgb[0] * m, rgb[1] * m, rgb[2] * m);
          }
          // lật đường chéo khi AO hai góc đối khác nhau (tránh sọc)
          if (ao[0] + ao[2] > ao[1] + ao[3]) out.idx.push(base + 1, base + 2, base + 3, base + 1, base + 3, base);
          else out.idx.push(base, base + 1, base + 2, base, base + 2, base + 3);
        }
      }
  return { solid: solid.done(), glow: glow.done() };
}
