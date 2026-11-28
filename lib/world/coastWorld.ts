/**
 * Bờ Sóng (Wave Coast) — bố cục THUẦN: mặt đất, va chạm, thuỷ triều cuốn người, vị trí các trạm, tiến trình.
 * Toạ độ: x đông (biển ở +x), z nam (bắc = −z), y lên. Dùng chung cho cảnh (components/world/scene/coast/*) và test.
 *
 *  Bãi đáp (tây, cỏ cao 1,2 m) → cồn cát → bãi biển dốc 0,12 xuống biển (mực triều chạy −0,8 … +0,8 m, bờ nước dời ~14 m).
 *  I.   Lối Triều (z ≈ 0): doi cát đỉnh −0,9 m dài 25 m ra Đảo Hải Đăng — chỉ lội qua được lúc nước ròng.
 *  II.  Đảo Hải Đăng (33, 0): gương mặt trời → lăng kính xoay (bước 7,5°) → tinh thể A (lệch ~39°) thắp đèn; tinh thể B cần phản xạ toàn phần.
 *  III. Cầu tàu nam (z ≈ 21): cầu phao lắc theo sóng lừng 3 s, con lắc dây chỉnh bằng tời, hai thanh chuông ở ±0,62 rad.
 *  IV.  Mũi đất bắc (z < −16): Đầm Giao thoa — hai nguồn sóng; đi theo đường nút (hyperbol) hoặc gạt cần đảo pha → đường giữa lặng.
 *       Sau đầm: Hang Nàng Tiên Cá → cổng tới Mê cung Hoạ âm (boss Fourier Siren, lib/world/boss.ts) — không làm lại boss.
 */
import { GLASS_N, LAGOON, prismPoly, rayHitsDisc, smoothstep, traceGlass, type Trace, type V2 } from "./waves";

export const SPAWN = { x: -24, z: 2 };
/** cổng về Quảng trường */
export const PORTAL = { x: -31, z: 7 };
export const TIDE_STONE = { x: -17.5, z: -4.5 };
export const BOUNDS = { x0: -42, x1: 50, z0: -57, z1: 38 };

// ── Lối Triều + Đảo Hải Đăng
export const CAUSEWAY = { x0: 1.5, x1: 28, half: 1.7, top: -0.9 };
export const ISLE = { x: 33, z: 0, flat: 5, r: 7.6, top: 1.5 };
export const LIGHTHOUSE = { x: 36, z: 2.6, r: 1.3, h: 11 };
/** nước sâu hơn mức này → sóng triều cuốn bạn về bờ */
export const SWEEP_DEPTH = 0.62;
/** sâu quá mức này là biển thẳm: không bước vào được */
export const DEEP = -1.35;

// ── Câu đố ánh sáng
export const EMITTER = { x: 29.2, z: -2.6 };
export const BEAM_DIR: V2 = { x: 1, z: 0 };
export const PRISM = { x: 31.2, z: -2.6, side: 1.2, step: 7.5 };
/** tinh thể A (thắp hải đăng) và B (chỉ sáng nhờ phản xạ toàn phần trong lăng kính) */
export const CRYSTAL_A = { x: 34.3, z: 0.2, r: 0.32 };
export const CRYSTAL_B = { x: 31.75, z: 1.4, r: 0.3 };
export const PRISM_STEPS = Math.round(360 / PRISM.step);
export const PRISM_START = 0;

// ── Cầu tàu + cầu phao con lắc
export const PIER = { x0: -13, x1: 15, z0: 19.5, z1: 22.5, top: 1.4 };
export const PONTOON = { x0: 15, x1: 21, z0: 17.5, z1: 24.5, top: 1.4 };
export const GANTRY = { x: 18.4, z: 21, pivotY: 6.8, post: 1.7 };
export const WINCH = { x: 16.1, z: 18.6 };
export const WEIGHTS = { x: 16.1, z: 23.4 };
export const PUSH_SPOT = { x: 16.3, z: 21 };
export const BELL_STONE = { x: -10.5, z: 18.2 };

// ── Mũi đất bắc + Đầm Giao thoa
export const HEADLAND = { z: -16, top: 1.4, ramp: 4.5 };
export const LEVER = { x: -10.2, z: -17.6 };
export const LAGOON_STONE = { x: 5.4, z: -17.4 };
export const SOURCE_R = 0.85;
export const GROTTO = { x: -2, z: -53, x0: -8, x1: 4 };

export type CoastProgress = { islet: boolean; lit: boolean; tir: boolean; bell: boolean; lagoon: boolean };
export const NO_PROGRESS: CoastProgress = { islet: false, lit: false, tir: false, bell: false, lagoon: false };
export function parseProgress(raw: string | null): CoastProgress {
  if (!raw) return { ...NO_PROGRESS };
  try {
    const o = JSON.parse(raw) as Partial<CoastProgress>;
    return { islet: o.islet === true, lit: o.lit === true, tir: o.tir === true, bell: o.bell === true, lagoon: o.lagoon === true };
  } catch {
    return { ...NO_PROGRESS };
  }
}

const lerp = (a: number, b: number, t: number) => a + (b - a) * t;
const inRect = (x: number, z: number, r: { x0: number; x1: number; z0: number; z1: number }, pad = 0) => x >= r.x0 - pad && x <= r.x1 + pad && z >= r.z0 - pad && z <= r.z1 + pad;

/** mặt cắt ngang bờ: cỏ 1,2 → cồn cát → bãi dốc 0,12 → đáy biển −2,4 */
export function beachGround(x: number, z: number): number {
  const ripple = 0.05 * Math.sin(x * 0.7 + z * 0.31) * Math.sin(z * 0.53 - x * 0.2);
  if (x <= -14) return 1.2 + 0.08 * Math.sin(z * 0.21) * Math.sin(x * 0.17) + ripple * 0.4;
  if (x <= -6) return lerp(1.2, 0.3, (x + 14) / 8) + ripple * 0.5;
  return Math.max(-2.4, 0.3 - 0.12 * (x + 6) - Math.max(0, x - 10) * 0.1) + ripple;
}
function isleGround(x: number, z: number): number {
  const d = Math.hypot(x - ISLE.x, z - ISLE.z);
  if (d <= ISLE.flat) return ISLE.top + 0.06 * Math.sin(x * 1.3) * Math.sin(z * 1.1);
  const t = (d - ISLE.flat) / (ISLE.r - ISLE.flat);
  return ISLE.top - 3.2 * t * t;
}
function causewayGround(x: number, z: number): number {
  if (x < CAUSEWAY.x0 - 2 || x > CAUSEWAY.x1 + 2) return -Infinity;
  const u = Math.abs(z) / CAUSEWAY.half;
  // doi cát: đỉnh hơi lồi, hai bên sụt nhanh xuống đáy biển; hai đầu nhập vào bãi / đảo
  return CAUSEWAY.top + 0.06 * Math.sin(x * 0.9) - (u < 1 ? 0.18 * u * u : 0.18 + (u - 1) * 2.4);
}
function headlandGround(x: number, z: number): number {
  // mũi đất bắc: cao 1,4, dốc thoải xuống bãi trong 4,5 m; vách đá đổ xuống biển ở x > 12
  if (z > HEADLAND.z + HEADLAND.ramp) return -Infinity;
  const t = smoothstep(HEADLAND.z + HEADLAND.ramp, HEADLAND.z, z);
  const cliff = smoothstep(16, 11, x);
  return lerp(-2.4, HEADLAND.top + 0.05 * Math.sin(x * 0.4 + z * 0.3), t * cliff);
}
export function inLagoon(x: number, z: number): boolean {
  return x > LAGOON.x0 && x < LAGOON.x1 && z > LAGOON.z0 && z < LAGOON.z1;
}
/** mặt đất (không tính nước). Nước biển = tideLevel(t), nước đầm = LAGOON.water */
export function coastGround(x: number, z: number): number {
  if (inRect(x, z, PIER) || inRect(x, z, PONTOON)) return PIER.top;
  return natGround(x, z);
}
/** mặt đất tự nhiên (bỏ cầu tàu / cầu phao) — lưới địa hình vẽ theo hàm này, cầu tàu là đạo cụ riêng */
export function natGround(x: number, z: number): number {
  if (inLagoon(x, z)) {
    // đáy đầm phẳng, mép bờ thoải 0,6 m
    const e = Math.min(x - LAGOON.x0, LAGOON.x1 - x, z - LAGOON.z0, LAGOON.z1 - z);
    return lerp(HEADLAND.top, LAGOON.floor, smoothstep(0, 0.6, e));
  }
  return Math.max(beachGround(x, z), isleGround(x, z), causewayGround(x, z), headlandGround(x, z));
}
/** độ sâu nước biển tại (x, z) khi mực triều = level (âm = khô). Cầu tàu / đầm / mũi đất không ngập. */
export function seaDepth(x: number, z: number, level: number): number {
  if (inRect(x, z, PIER) || inRect(x, z, PONTOON) || inLagoon(x, z)) return -1;
  return level - coastGround(x, z);
}

const POSTS: { x: number; z: number; r: number }[] = [
  { x: LIGHTHOUSE.x, z: LIGHTHOUSE.z, r: LIGHTHOUSE.r },
  { x: EMITTER.x, z: EMITTER.z, r: 0.35 },
  { x: PRISM.x, z: PRISM.z, r: 0.75 },
  { x: CRYSTAL_A.x, z: CRYSTAL_A.z, r: 0.4 },
  { x: CRYSTAL_B.x, z: CRYSTAL_B.z, r: 0.38 },
  { x: GANTRY.x, z: GANTRY.z - GANTRY.post, r: 0.3 },
  { x: GANTRY.x, z: GANTRY.z + GANTRY.post, r: 0.3 },
  { x: LAGOON.s1.x, z: LAGOON.s1.z, r: SOURCE_R },
  { x: LAGOON.s2.x, z: LAGOON.s2.z, r: SOURCE_R },
  { x: TIDE_STONE.x, z: TIDE_STONE.z, r: 0.55 },
  { x: LAGOON_STONE.x, z: LAGOON_STONE.z, r: 0.5 },
  { x: BELL_STONE.x, z: BELL_STONE.z, r: 0.5 },
];

/** va chạm: biên vùng, biển thẳm, vách quanh đầm, thành cầu tàu, cột / trụ */
export function coastBlocked(x: number, z: number): boolean {
  if (x < BOUNDS.x0 || x > BOUNDS.x1 || z < BOUNDS.z0 || z > BOUNDS.z1) return true;
  for (const p of POSTS) if ((x - p.x) ** 2 + (z - p.z) ** 2 < p.r * p.r) return true;
  // cầu tàu / cầu phao: đi được trên mặt, rơi xuống biển hai bên thì do mặt đất lo
  if (inRect(x, z, PIER) || inRect(x, z, PONTOON)) return false;
  // mũi đất bắc: hai vách đá ôm đầm (phải lội qua đầm), phía sau chỉ có lối vào hang
  if (z < LAGOON.z1 && z > LAGOON.z0 && (x <= LAGOON.x0 || x >= LAGOON.x1)) return true;
  if (z <= LAGOON.z0 && (x < GROTTO.x0 || x > GROTTO.x1)) return true;
  if (z < -16 && x < LAGOON.x0 - 5) return true;
  return coastGround(x, z) < DEEP;
}

/**
 * Sóng triều cuốn: đứng ở chỗ nước sâu hơn SWEEP_DEPTH → đẩy về phía đất liền (−x) tới chỗ khô đầu tiên.
 * Doi cát / bãi đều dốc theo x nên đi thẳng về tây luôn gặp bờ.
 */
export function sweepTarget(x: number, z: number, level: number): { x: number; z: number } {
  let px = x;
  for (let i = 0; i < 200; i++) {
    if (seaDepth(px, z, level) < 0.1 && !coastBlocked(px, z)) return { x: px, z };
    px -= 0.5;
  }
  return { x: SPAWN.x, z: SPAWN.z };
}

// ── Lăng kính
export function prismRot(step: number): number {
  return ((((step % PRISM_STEPS) + PRISM_STEPS) % PRISM_STEPS) * PRISM.step * Math.PI) / 180;
}
export function prismTrace(step: number, n: number = GLASS_N.g): Trace {
  return traceGlass(EMITTER, BEAM_DIR, prismPoly(PRISM.x, PRISM.z, PRISM.side, prismRot(step)), n);
}
/** tia sau lăng kính trúng tinh thể nào */
export function prismTarget(step: number): "A" | "B" | null {
  const tr = prismTrace(step);
  const p = tr.pts[tr.pts.length - 1];
  if (rayHitsDisc(p, tr.dir, CRYSTAL_A, CRYSTAL_A.r)) return "A";
  if (rayHitsDisc(p, tr.dir, CRYSTAL_B, CRYSTAL_B.r)) return "B";
  return null;
}
/** tia đi thẳng (không có lăng kính) có trúng tinh thể nào không — câu đố đòi bẻ tia */
export function straightHits(): boolean {
  return rayHitsDisc(EMITTER, BEAM_DIR, CRYSTAL_A, CRYSTAL_A.r) || rayHitsDisc(EMITTER, BEAM_DIR, CRYSTAL_B, CRYSTAL_B.r);
}

/** các vùng (cho HUD + nhạc + gợi ý) */
export type CoastArea = "beach" | "causeway" | "isle" | "pier" | "lagoon" | "grotto";
export function coastArea(x: number, z: number): CoastArea {
  if (Math.hypot(x - ISLE.x, z - ISLE.z) < ISLE.r) return "isle";
  if (x > CAUSEWAY.x0 && x < CAUSEWAY.x1 && Math.abs(z) < CAUSEWAY.half + 0.5) return "causeway";
  if (inRect(x, z, PIER) || inRect(x, z, PONTOON)) return "pier";
  if (z <= LAGOON.z0) return "grotto";
  if (z < -16) return "lagoon";
  return "beach";
}
