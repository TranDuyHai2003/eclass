/**
 * W5 — MẬT ĐỘ 3D cho Vùng Kỳ quan: hang động + phần nhô (VOXEL_WORLD §1.3).
 *
 * • Chỉ "vùng hang" mới tốn: mặt nạ 2D tần số thấp `caveMask` (đồi đá tự nhiên, xa điểm xuất phát ≥ 90 m, không ở biome toán).
 *   Chunk nào mặt nạ = 0 ở mọi điểm lưới → `shapeChunk` trả null ngay, KHÔNG tính nhiễu 3D nào.
 * • Nhiễu 3D tất định (value noise, chỉ + − × floor imul) lấy mẫu trên LƯỚI THÔ 4×4×4 m rồi nội suy ba chiều
 *   (Minecraft "noise cells"): ~1 000 điểm lưới / chunk thay vì ~40 000 khối.
 *   – hang "pho mát": C < ngưỡng (khoang rộng, dẹt vì tần số dọc cao hơn ngang);
 *   – đường hầm "mì ống": |A − ½| < w và |B − ½| < w (giao của hai mặt mức 0 → ống);
 *   – phần nhô: d = (đỉnh − y)/2 + vùng-chết(O − ½)·biên độ > 0 trong dải sát mặt đất; O dẹt theo chiều đứng → gờ đá phân lớp chìa ra, hốc.
 * • Hang không xuống dưới y = CAVE_FLOOR (mặt nước là một mặt phẳng ở −2,2 — hang thấp hơn sẽ "ngập" giả).
 *   Vỏ đất trên trần hang ≥ 3 khối; miệng hang thật sự đi bộ xuống được do structures.ts đục (bậc thang 1 khối).
 * • Mảnh vụn bay lơ lửng: khối nhô cao hơn mặt đất mà có < 2 mặt kề đặc thì bỏ.
 */
import { CHUNK, blockTop, fbm, mathBiome } from "./terrain";

export const CAVE_FLOOR = -1;
const SAFE_R = 90; // bán kính quanh điểm xuất phát không có hang / phần nhô
const LAT = 4; // bước lưới thô (m)

export function hash3(x: number, y: number, z: number, s: number): number {
  let h = Math.imul(x | 0, 374761393) ^ Math.imul(y | 0, 1103515245) ^ Math.imul(z | 0, 668265263) ^ Math.imul(s | 0, 2246822519);
  h = Math.imul(h ^ (h >>> 13), 1274126177);
  return ((h ^ (h >>> 16)) >>> 0) / 4294967296;
}

/** value noise 3D ∈ [0, 1] (nội suy smoothstep) */
export function vnoise3(x: number, y: number, z: number, s: number): number {
  const ix = Math.floor(x);
  const iy = Math.floor(y);
  const iz = Math.floor(z);
  let fx = x - ix;
  let fy = y - iy;
  let fz = z - iz;
  fx = fx * fx * (3 - 2 * fx);
  fy = fy * fy * (3 - 2 * fy);
  fz = fz * fz * (3 - 2 * fz);
  const c000 = hash3(ix, iy, iz, s);
  const c100 = hash3(ix + 1, iy, iz, s);
  const c010 = hash3(ix, iy + 1, iz, s);
  const c110 = hash3(ix + 1, iy + 1, iz, s);
  const c001 = hash3(ix, iy, iz + 1, s);
  const c101 = hash3(ix + 1, iy, iz + 1, s);
  const c011 = hash3(ix, iy + 1, iz + 1, s);
  const c111 = hash3(ix + 1, iy + 1, iz + 1, s);
  const x00 = c000 + (c100 - c000) * fx;
  const x10 = c010 + (c110 - c010) * fx;
  const x01 = c001 + (c101 - c001) * fx;
  const x11 = c011 + (c111 - c011) * fx;
  const y0 = x00 + (x10 - x00) * fy;
  const y1 = x01 + (x11 - x01) * fy;
  return y0 + (y1 - y0) * fz;
}

/** 2 quãng tám, chuẩn hoá về [0, 1] */
function fbm3(x: number, y: number, z: number, s: number): number {
  return (vnoise3(x, y, z, s) * 2 + vnoise3(x * 2.03, y * 2.03, z * 2.03, s + 57)) / 3;
}

/** Mặt nạ vùng hang ∈ [0, 1]: 0 ở điểm xuất phát, biome toán học và phần lớn đồng bằng */
export function caveMask(x: number, z: number): number {
  const r2 = x * x + z * z;
  if (r2 < SAFE_R * SAFE_R) return 0;
  const v = fbm(x * 0.0055 + 211, z * 0.0055 - 87, 2, 555);
  let m = (v - 0.57) / 0.09;
  if (m <= 0) return 0;
  if (m > 1) m = 1;
  const mb = mathBiome(x, z);
  if (mb) m *= 1 - mb.w;
  // mờ dần ở rìa vùng an toàn (90 → 130 m)
  const edge = (Math.sqrt(r2) - SAFE_R) / 40;
  if (edge < 1) m *= edge;
  return m * m * (3 - 2 * m);
}

/** Hình dạng một cột đã bị mật độ 3D đổi: solid[y − lo] (1 đặc, 0 rỗng) cho y ∈ [lo, lo + len) */
export type ColumnShape = { lo: number; solid: Uint8Array };

export type ShapeStats = { latticePoints: number; columns: number };
export const shapeStats: ShapeStats = { latticePoints: 0, columns: 0 };

/**
 * Hình dạng (đặc / rỗng) của các cột trong chunk bị hang hoặc phần nhô đổi so với bản đồ độ cao.
 * null = chunk không có gì 3D (đường nhanh: không nhiễu 3D). Mảng 32×32 (chỉ số lz·32 + lx), undefined = cột thường.
 */
export function shapeChunk(cx: number, cz: number): (ColumnShape | undefined)[] | null {
  const x0 = cx * CHUNK;
  const z0 = cz * CHUNK;
  // ── 1) mặt nạ trên lưới 2D (phủ cả viền 1 khối quanh chunk)
  const LX0 = x0 - LAT;
  const LZ0 = z0 - LAT;
  const NL = CHUNK / LAT + 3; // 11 điểm: x0 − 4 … x0 + 36
  const M = new Float32Array(NL * NL);
  let any = false;
  for (let j = 0; j < NL; j++)
    for (let i = 0; i < NL; i++) {
      const m = caveMask(LX0 + i * LAT, LZ0 + j * LAT);
      M[j * NL + i] = m;
      if (m > 0) any = true;
    }
  if (!any) return null;
  // ── 2) độ cao viền 34×34
  const W = CHUNK + 2;
  const T = new Int16Array(W * W);
  let maxTop = -1e9;
  for (let j = 0; j < W; j++)
    for (let i = 0; i < W; i++) {
      const t = blockTop(x0 - 1 + i, z0 - 1 + j);
      T[j * W + i] = t;
      if (t > maxTop) maxTop = t;
    }
  const yLo = CAVE_FLOOR;
  const yHi = maxTop + 8;
  if (yHi <= yLo) return null;
  const NYB = yHi - yLo + 1;
  // ── 3) lưới 3D thô: 4 trường (pho mát, mì ống A/B, phần nhô)
  const LY0 = Math.floor(yLo / LAT) * LAT;
  const NY = Math.floor((yHi - LY0) / LAT) + 2;
  const n = NL * NL * NY;
  const FC = new Float32Array(n);
  const FA = new Float32Array(n);
  const FB = new Float32Array(n);
  const FO = new Float32Array(n);
  for (let j = 0; j < NL; j++)
    for (let i = 0; i < NL; i++) {
      // điểm lưới mà cả 4 ô quanh nó mặt nạ = 0 thì không cần (không cột nào dùng)
      let near = false;
      for (let b = -1; b <= 1 && !near; b++)
        for (let a = -1; a <= 1; a++) {
          const ii = i + a;
          const jj = j + b;
          if (ii >= 0 && jj >= 0 && ii < NL && jj < NL && M[jj * NL + ii] > 0) {
            near = true;
            break;
          }
        }
      if (!near) continue;
      const wx = LX0 + i * LAT;
      const wz = LZ0 + j * LAT;
      for (let k = 0; k < NY; k++) {
        const wy = LY0 + k * LAT;
        const o = (k * NL + j) * NL + i;
        FC[o] = fbm3(wx / 19, wy / 9, wz / 19, 71);
        FA[o] = fbm3(wx / 26, wy / 18, wz / 26, 72);
        FB[o] = fbm3(wx / 26, wy / 18, wz / 26, 73);
        FO[o] = fbm3(wx / 16, wy / 5, wz / 16, 74); // dẹt theo chiều đứng → gờ đá phân lớp chìa ra
        shapeStats.latticePoints++;
      }
    }
  // ── 4) đặc / rỗng cho từng ô của viền 34×34 trong dải [yLo, yHi]
  const S = new Uint8Array(W * W * NYB);
  const touched = new Uint8Array(W * W);
  const colC = new Float32Array(NY);
  const colA = new Float32Array(NY);
  const colB = new Float32Array(NY);
  const colO = new Float32Array(NY);
  for (let j = 0; j < W; j++)
    for (let i = 0; i < W; i++) {
      const x = x0 - 1 + i;
      const z = z0 - 1 + j;
      const top = T[j * W + i];
      const base = (j * W + i) * NYB;
      const gx = (x - LX0) / LAT;
      const gz = (z - LZ0) / LAT;
      const li = Math.floor(gx);
      const lj = Math.floor(gz);
      const fx = gx - li;
      const fz = gz - lj;
      const m00 = M[lj * NL + li];
      const m10 = M[lj * NL + li + 1];
      const m01 = M[(lj + 1) * NL + li];
      const m11 = M[(lj + 1) * NL + li + 1];
      const m = (m00 + (m10 - m00) * fx) * (1 - fz) + (m01 + (m11 - m01) * fx) * fz;
      // mặc định: bản đồ độ cao
      const solidTo = Math.min(top - 1, yHi);
      for (let y = yLo; y <= solidTo; y++) S[base + y - yLo] = 1;
      if (m <= 0.02) continue;
      touched[j * W + i] = 1;
      shapeStats.columns++;
      for (let k = 0; k < NY; k++) {
        const o00 = (k * NL + lj) * NL + li;
        const o10 = o00 + 1;
        const o01 = o00 + NL;
        const o11 = o01 + 1;
        const bl = (F: Float32Array) => (F[o00] + (F[o10] - F[o00]) * fx) * (1 - fz) + (F[o01] + (F[o11] - F[o01]) * fx) * fz;
        colC[k] = bl(FC);
        colA[k] = bl(FA);
        colB[k] = bl(FB);
        colO[k] = bl(FO);
      }
      const k2 = Math.min(1, m * 2);
      const thrC = 0.3 * k2;
      const w = 0.075 * k2;
      // phần nhô chỉ ở lõi vùng hang; vùng chết |O − ½| < 0,1 giữ nguyên mặt đất (không rỗ khắp nơi)
      const amp = 12 * Math.max(0, Math.min(1, (m - 0.4) / 0.6));
      const caveTop = top - 4;
      const ovLo = top - 3;
      const ovHi = Math.min(top + 7, yHi);
      for (let y = yLo; y <= ovHi; y++) {
        const gy = (y - LY0) / LAT;
        const lk = Math.floor(gy);
        const fy = gy - lk;
        let solid = y < top;
        if (y <= caveTop && solid) {
          const c = colC[lk] + (colC[lk + 1] - colC[lk]) * fy;
          if (c < thrC) solid = false;
          else {
            const a = colA[lk] + (colA[lk + 1] - colA[lk]) * fy - 0.5;
            if (a < w && a > -w) {
              const b = colB[lk] + (colB[lk + 1] - colB[lk]) * fy - 0.5;
              if (b < w && b > -w) solid = false;
            }
          }
        }
        if (y >= ovLo) {
          const ov = colO[lk] + (colO[lk + 1] - colO[lk]) * fy;
          const e = ov - 0.5;
          const s = e > 0.1 ? e - 0.1 : e < -0.1 ? e + 0.1 : 0;
          if (amp > 0) solid = (top - 0.5 - y) / 2 + s * amp > 0;
        }
        S[base + y - yLo] = solid ? 1 : 0;
      }
    }
  // ── 5) bỏ mảnh vụn: khối cao hơn mặt đất cũ mà < 2 mặt kề đặc
  const at = (i: number, j: number, y: number) => (i < 0 || j < 0 || i >= W || j >= W || y < yLo ? 1 : y > yHi ? 0 : S[(j * W + i) * NYB + y - yLo]);
  for (let pass = 0; pass < 2; pass++)
    for (let j = 1; j <= CHUNK; j++)
      for (let i = 1; i <= CHUNK; i++) {
        if (!touched[j * W + i]) continue;
        const top = T[j * W + i];
        const base = (j * W + i) * NYB;
        for (let y = top; y <= yHi; y++) {
          if (!S[base + y - yLo]) continue;
          const c = at(i + 1, j, y) + at(i - 1, j, y) + at(i, j + 1, y) + at(i, j - 1, y) + at(i, j, y + 1) + at(i, j, y - 1);
          if (c < 2 || (!at(i, j, y - 1) && c < 3)) S[base + y - yLo] = 0;
        }
      }
  // ── 6) xuất các cột trong chunk khác bản đồ độ cao
  const out: (ColumnShape | undefined)[] = new Array(CHUNK * CHUNK);
  let changed = false;
  for (let lz = 0; lz < CHUNK; lz++)
    for (let lx = 0; lx < CHUNK; lx++) {
      const i = lx + 1;
      const j = lz + 1;
      if (!touched[j * W + i]) continue;
      const top = T[j * W + i];
      const base = (j * W + i) * NYB;
      let a = -1;
      let b = -1;
      for (let y = yLo; y <= yHi; y++) {
        const hm = y < top ? 1 : 0;
        if (S[base + y - yLo] !== hm) {
          if (a < 0) a = y;
          b = y;
        }
      }
      if (a < 0) continue;
      out[lz * CHUNK + lx] = { lo: a, solid: S.slice(base + a - yLo, base + b - yLo + 1) };
      changed = true;
    }
  return changed ? out : null;
}
