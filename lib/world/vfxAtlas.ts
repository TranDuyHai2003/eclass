/**
 * VFX-AAA — atlas texture thủ tục dùng chung cho hiệu ứng, NƯỚNG MỘT LẦN lúc chạy (không tải mạng, ~10–20 ms ở 128²):
 *  • bakeNoiseFlow  RGBA lặp liền ô: R fBm uốn miền · G/B trường xoáy (curl) không phân kỳ (dψ/dy, −dψ/dx) ánh xạ về [0..1]
 *                   · A gân Voronoi (F2 − F1) — xói mòn khói / đẩy UV 2 pha (flowmap) / vân năng lượng;
 *  • bakePuff       RGBA kẹp mép: R tô sáng từ trên (bóng cel của cụm khói) · G cuộn khói thô · B nhiễu xói mịn
 *                   · A dáng cụm khói (đúng 0 ở mép ô → không lộ cạnh vuông).
 * Mọi nhiễu dùng lưới tuần hoàn (chu kỳ nhân đôi mỗi tầng) nên lặp không lộ đường nối trên vòng / trụ / vòm.
 * Logic thuần (Uint8Array), test ở tests/world/vfxAtlas.test.ts; THREE.DataTexture dựng ở components/world/fx/vfxTextures.ts.
 */
import { hash32 } from "./vfxRng";

const fade = (t: number) => t * t * t * (t * (t * 6 - 15) + 10);
const wrap = (i: number, p: number) => ((i % p) + p) % p;

/** giá trị lưới [0,1) tại ô (i, j) chu kỳ p, tầng o */
function lattice(i: number, j: number, p: number, o: number, seed: number): number {
  return hash32(hash32(wrap(i, p) * 7919 + wrap(j, p) * 104729 + o * 1299709) ^ seed) / 4294967296;
}

/** nhiễu giá trị tuần hoàn: (x, y) ∈ [0, 1) × [0, 1), chu kỳ p ô trên toàn ô texture */
export function periodicValue(x: number, y: number, p: number, o: number, seed: number): number {
  const fx = x * p;
  const fy = y * p;
  const i = Math.floor(fx);
  const j = Math.floor(fy);
  const u = fade(fx - i);
  const v = fade(fy - j);
  const a = lattice(i, j, p, o, seed);
  const b = lattice(i + 1, j, p, o, seed);
  const c = lattice(i, j + 1, p, o, seed);
  const d = lattice(i + 1, j + 1, p, o, seed);
  return a + (b - a) * u + (c - a) * v + (a - b - c + d) * u * v;
}

/** fBm tuần hoàn (chu kỳ gốc p, nhân đôi mỗi tầng) → [0, 1] */
export function periodicFbm(x: number, y: number, p: number, octaves: number, seed: number): number {
  let s = 0;
  let amp = 0.5;
  let norm = 0;
  let pp = p;
  for (let o = 0; o < octaves; o++) {
    s += amp * periodicValue(x, y, pp, o, seed);
    norm += amp;
    amp *= 0.5;
    pp *= 2;
  }
  return s / norm;
}

/** Voronoi tuần hoàn n × n ô (một điểm mỗi ô, lệch theo băm): trả F2 − F1 (khoảng cách theo đơn vị ô) */
function voronoiEdge(x: number, y: number, n: number, seed: number): number {
  const fx = x * n;
  const fy = y * n;
  const ci = Math.floor(fx);
  const cj = Math.floor(fy);
  let f1 = 9;
  let f2 = 9;
  for (let dj = -1; dj <= 1; dj++)
    for (let di = -1; di <= 1; di++) {
      const i = ci + di;
      const j = cj + dj;
      const h = hash32(hash32(wrap(i, n) * 92821 + wrap(j, n) * 68917) ^ seed);
      const px = i + 0.15 + 0.7 * ((h & 0xffff) / 65535);
      const py = j + 0.15 + 0.7 * ((h >>> 16) / 65535);
      const d = Math.hypot(px - fx, py - fy);
      if (d < f1) {
        f2 = f1;
        f1 = d;
      } else if (d < f2) f2 = d;
    }
  return f2 - f1;
}

const to8 = (v: number) => Math.max(0, Math.min(255, Math.round(v * 255)));

/** RGBA size² lặp liền ô — xem đầu tệp */
export function bakeNoiseFlow(size = 128, seed = 7): Uint8Array {
  const out = new Uint8Array(size * size * 4);
  // thế ψ (fBm tuần hoàn mượt, 3 tầng) → curl bằng sai phân trung tâm trên lưới quấn
  const psi = new Float32Array(size * size);
  for (let j = 0; j < size; j++)
    for (let i = 0; i < size; i++) psi[j * size + i] = periodicFbm(i / size, j / size, 3, 3, seed ^ 0x51ed);
  const fx = new Float32Array(size * size);
  const fy = new Float32Array(size * size);
  let mag = 1e-6;
  for (let j = 0; j < size; j++)
    for (let i = 0; i < size; i++) {
      const dx = psi[j * size + wrap(i + 1, size)] - psi[j * size + wrap(i - 1, size)];
      const dy = psi[wrap(j + 1, size) * size + i] - psi[wrap(j - 1, size) * size + i];
      const k = j * size + i;
      fx[k] = dy;
      fy[k] = -dx;
      mag = Math.max(mag, Math.abs(dx), Math.abs(dy));
    }
  for (let j = 0; j < size; j++)
    for (let i = 0; i < size; i++) {
      const x = i / size;
      const y = j / size;
      // uốn miền nhẹ (vẫn tuần hoàn vì độ lệch lấy từ nhiễu tuần hoàn và lấy mẫu quấn)
      const wx = periodicFbm(x, y, 2, 2, seed ^ 0x1234) - 0.5;
      const wy = periodicFbm(x, y, 2, 2, seed ^ 0x4321) - 0.5;
      const r = periodicFbm(wrap01(x + wx * 0.35), wrap01(y + wy * 0.35), 4, 4, seed);
      const k = j * size + i;
      const edge = voronoiEdge(x, y, 6, seed ^ 0x777);
      const o = k * 4;
      out[o] = to8(r);
      out[o + 1] = to8(0.5 + 0.5 * (fx[k] / mag));
      out[o + 2] = to8(0.5 + 0.5 * (fy[k] / mag));
      out[o + 3] = to8(1 - Math.min(1, edge * 3.2));
    }
  return out;
}

function wrap01(v: number): number {
  return v - Math.floor(v);
}

/**
 * RGBA size² cụm khói kiểu cel (kẹp mép) — xem đầu tệp. Dáng = HỢP các khối cầu (1 thân + 5 bướu quanh, lệch theo hạt giống)
 * → viền "súp lơ" đặc trưng của khói anime thay vì đĩa tròn; mỗi bướu có pháp tuyến riêng → mỗi bướu một mảng sáng phía trên.
 */
export function bakePuff(size = 128, seed = 11): Uint8Array {
  const out = new Uint8Array(size * size * 4);
  // hướng sáng: từ trên, hơi chếch trái, hướng về máy quay (toạ độ ô: x phải, y lên, z ra ngoài)
  const L = [-0.35, 0.8, 0.48];
  const ll = Math.hypot(L[0], L[1], L[2]);
  // khối cầu: [cx, cy, r] — thân hơi thấp + 5 bướu quanh (to hơn ở trên → dáng bốc lên)
  const lobes: number[] = [0, -0.06, 0.44];
  const h0 = hash32(seed ^ 0xc0ffee);
  for (let k = 0; k < 5; k++) {
    const jit = ((hash32(h0 + k) & 0xffff) / 65535 - 0.5) * 0.7;
    const a = Math.PI / 2 + (k / 5) * Math.PI * 2 + jit;
    const up = Math.max(0, Math.sin(a));
    const d = 0.32 + 0.04 * up;
    lobes.push(Math.cos(a) * d, Math.sin(a) * d - 0.04, 0.25 + 0.09 * up + ((hash32(h0 + 17 + k) & 0xff) / 255) * 0.04);
  }
  for (let j = 0; j < size; j++)
    for (let i = 0; i < size; i++) {
      const u = ((i + 0.5) / size) * 2 - 1;
      const v = ((j + 0.5) / size) * 2 - 1;
      const r = Math.hypot(u, v);
      const x = (i + 0.5) / size;
      const y = (j + 0.5) / size;
      const billow = periodicFbm(x, y, 3, 3, seed);
      const fine = periodicFbm(x, y, 8, 2, seed ^ 0xbeef);
      // trường độ cao = cầu cao nhất tại điểm (mép gợn nhẹ theo cuộn khói)
      let best = -1;
      let nx = 0;
      let ny = 0;
      let nz = 0;
      for (let k = 0; k < lobes.length; k += 3) {
        const dx = u - lobes[k];
        const dy = v - lobes[k + 1];
        const R = lobes[k + 2] * (0.94 + 0.12 * billow);
        const h2 = R * R - dx * dx - dy * dy;
        if (h2 <= 0) continue;
        const h = Math.sqrt(h2);
        // cầu "nổi" nhất: so theo độ cao chuẩn hoá cộng chút lệch để bướu trên đè thân
        const score = h + lobes[k + 1] * 0.08;
        if (score > best) {
          best = score;
          nx = dx / R;
          ny = dy / R;
          nz = h / R;
        }
      }
      const border = 1 - smooth(0.88, 0.96, r);
      const a = best > 0 ? smooth(0.0, 0.22, nz) * border : 0;
      const ndl = (nx * L[0] + ny * L[1] + nz * L[2]) / ll;
      const lit = 0.25 + 0.75 * smooth(-0.1, 0.4, ndl + (billow - 0.5) * 0.35);
      const o = (j * size + i) * 4;
      out[o] = to8(lit);
      out[o + 1] = to8(billow);
      out[o + 2] = to8(fine);
      out[o + 3] = to8(a);
    }
  return out;
}

function smooth(e0: number, e1: number, x: number): number {
  const t = Math.max(0, Math.min(1, (x - e0) / (e1 - e0)));
  return t * t * (3 - 2 * t);
}
