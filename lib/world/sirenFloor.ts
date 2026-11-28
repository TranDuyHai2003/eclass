/**
 * Sàn "sống" của Mê cung Hoạ âm (thuần — test được; dùng CHUNG cho va chạm CPU trong lib/world/sirenMaze.ts và hình GPU):
 *  - Đài nổi trong đấu trường nhấp nhô / quay theo tỉ số tần số 2 : 3 : 5 (đài thứ tư 4 → đủ hợp âm trưởng 2 : 3 : 4 : 5
 *    của chuỗi hoạ âm), khoá theo beat của đồng hồ nhạc HARMONIC.
 *  - Cầu khuông nhạc (cầu Nam): mặt cầu dệt từ 5 dòng kẻ, uốn theo chuỗi Fourier sóng chạy
 *      h(s, t) = E(s) · A · Σ_{n=1..H} sin(n k s − n ω t + φ_n) / n,   H = HARMONIC.harmonics
 *    E(s) = sin(π u) ghim hai đầu cầu (nối êm với đấu trường / sân khu). CÙNG hàm cho vertex shader (STAFF_GLSL).
 *  - Phím sàn (mọi bậc cầu thang "phím đàn"): một "sóng âm" chạy từ chân lên đỉnh mỗi ô nhịp; phím nhô lên bằng lò xo
 *    (vượt đích) NGAY TRƯỚC khi sóng tới (dự báo), bị "gõ" lún xuống khi sóng qua, rồi rung về 0 — so le theo thứ tự bậc.
 *    Trạng thái lò xo nằm ở KEYS (một nguồn): cảnh bước lò xo mỗi khung, va chạm đọc cùng mảng.
 */
import { HARMONIC, springStep, type Spring } from "./harmonicState";

const TAU = Math.PI * 2;

// ───────────── Đài nổi 2 : 3 : 5 (: 4) ─────────────
/** chu kỳ gốc (beat): đài n nhấp nhô n lần mỗi PLAT_CYCLE beat */
export const PLAT_CYCLE = 8;
/** tần số tương đối của 4 đài (thứ tự ARENA_PLATFORMS) */
export const PLAT_N = [2, 3, 5, 4] as const;
/** biên độ nhấp nhô (m) — gia tốc lớn nhất (đài 5) ≈ 8,7 m/s² < trọng lực 22: người đứng trên không bị hất lên */
export const PLAT_BOB = 0.22;
/** chu kỳ quay (beat): đài n quay n vòng mỗi PLAT_SPIN_CYCLE beat (đài chẵn / lẻ ngược chiều) */
export const PLAT_SPIN_CYCLE = 64;

/** độ lệch cao của đài i ở beat b (0 tại b = 0 — mọi đài cùng pha đầu như hợp âm đánh cùng lúc) */
export function platBob(i: number, beat: number): number {
  return PLAT_BOB * Math.sin((TAU * PLAT_N[i % 4] * beat) / PLAT_CYCLE);
}
/** góc quay quanh trục đứng (rad) — chỉ HÌNH (đài tròn đối xứng nên va chạm không đổi) */
export function platYaw(i: number, beat: number): number {
  return ((i % 2 ? -1 : 1) * TAU * PLAT_N[i % 4] * beat) / PLAT_SPIN_CYCLE;
}

// ───────────── Cầu khuông nhạc ─────────────
/** id mặt đi được trong SURFS + đoạn tự do (toạ độ dọc cầu s, gốc ở tâm cầu): ngoài đoạn này cầu nằm yên trên đấu trường / sân */
export const STAFF = {
  id: "brS",
  /** mép đấu trường (z = 15,6) và mép sân Sóng sin (z = 34) theo toạ độ dọc cầu (tâm cầu z = 24,5) */
  s0: -8.9,
  s1: 9.5,
  /** biên độ hoạ âm cơ bản (m) */
  amp: 0.2,
  /** bước sóng cơ bản = chiều dài đoạn tự do */
  waveLen: 18.4,
  /** chu kỳ thời gian cơ bản (beat) — n·ω·t tuần hoàn theo chu kỳ này nên chỉ cần beat mod STAFF.cycle */
  cycle: 4,
  /** 5 dòng kẻ (m, theo bề ngang cầu) */
  lines: [-1.6, -0.8, 0, 0.8, 1.6],
} as const;
/** pha từng hoạ âm (cố định — sóng "giai điệu" chứ không phải sóng vuông) */
export const STAFF_PHI = [0, 1.3, 2.9, 0.6, 4.1, 2.2, 5.3, 3.7];
export const STAFF_MAX_H = 8;

export function staffEnvelope(s: number): number {
  const u = (s - STAFF.s0) / (STAFF.s1 - STAFF.s0);
  if (u <= 0 || u >= 1) return 0;
  return Math.sin(Math.PI * u);
}

/** chiều cao cầu (m, so với mặt tĩnh) tại toạ độ dọc s, beat b, H hoạ âm — CPU (va chạm) */
export function staffHeight(s: number, beat: number, harmonics: number): number {
  const e = staffEnvelope(s);
  if (e === 0) return 0;
  const k = TAU / STAFF.waveLen;
  const w = TAU / STAFF.cycle;
  const t = beat - Math.floor(beat / STAFF.cycle) * STAFF.cycle;
  const H = Math.max(1, Math.min(STAFF_MAX_H, Math.round(harmonics)));
  const x = s - STAFF.s0;
  let h = 0;
  for (let n = 1; n <= H; n++) h += Math.sin(n * k * x - n * w * t + STAFF_PHI[n - 1]) / n;
  return e * STAFF.amp * h;
}
/** chặn trên |h| (bất đẳng thức tam giác) — test + ngân sách bước */
export function staffBound(harmonics: number): number {
  let b = 0;
  for (let n = 1; n <= harmonics; n++) b += 1 / n;
  return STAFF.amp * b;
}

/**
 * CÙNG hàm cho GPU: float staffH(float s, float t, float H) với t = beat mod STAFF.cycle (uniform), H = HARMONIC.harmonics.
 * Hằng số sinh từ STAFF / STAFF_PHI để CPU và GPU không lệch nhau.
 */
export const STAFF_GLSL = /* glsl */ `
const float STAFF_S0 = ${STAFF.s0.toFixed(4)};
const float STAFF_S1 = ${STAFF.s1.toFixed(4)};
float staffEnv(float s){
  float u = (s - STAFF_S0) / (STAFF_S1 - STAFF_S0);
  return (u <= 0.0 || u >= 1.0) ? 0.0 : sin(3.14159265 * u);
}
float staffH(float s, float t, float H){
  float e = staffEnv(s);
  float k = ${(TAU / STAFF.waveLen).toFixed(6)};
  float w = ${(TAU / STAFF.cycle).toFixed(6)};
  float x = s - STAFF_S0;
  float h = 0.0;
  ${STAFF_PHI.map((p, i) => `if (H > ${i}.5) h += sin(${i + 1}.0 * (k * x - w * t) + ${p.toFixed(4)}) / ${i + 1}.0;`).join("\n  ")}
  return e * ${STAFF.amp.toFixed(4)} * h;
}`;

// ───────────── Phím sàn ─────────────
export const KEY_MAX = 192;
/** frac: vị trí bậc trong cầu thang (0 = chân, 1 = đỉnh); lift / vel: lò xo (đơn vị: 1 = nhô đầy KEY_AMP) */
export const KEYS = { n: 0, frac: new Float32Array(KEY_MAX), lift: new Float32Array(KEY_MAX), vel: new Float32Array(KEY_MAX) };
/** độ nhô đầy (m) — vượt đích ≈ 37 % → ≤ 0,22 m: bậc vẫn ≤ STEP_UP */
export const KEY_AMP = 0.16;
/** sóng âm: mỗi KEY_CYCLE beat một sóng, chạy chân → đỉnh trong KEY_TRAVEL beat */
export const KEY_CYCLE = 4;
export const KEY_TRAVEL = 2;
/** phím nhô lên trước KEY_LEAD beat (dự báo), bị gõ lún KEY_HIT beat khi sóng qua */
export const KEY_LEAD = 0.5;
export const KEY_HIT = 0.25;
export const KEY_OMEGA = 26;
export const KEY_ZETA = 0.3;

/** đích lò xo của phím ở vị trí frac, beat b: 1 (sắp tới) · −0,5 (đang gõ) · 0 */
export function keyTarget(frac: number, beat: number): number {
  const c = beat - Math.floor(beat / KEY_CYCLE) * KEY_CYCLE;
  let d = frac * KEY_TRAVEL - c; // số beat tới khi sóng tới bậc này
  if (d < -KEY_CYCLE / 2) d += KEY_CYCLE;
  if (d > KEY_CYCLE / 2) d -= KEY_CYCLE;
  if (d > 0 && d <= KEY_LEAD) return 1;
  if (d <= 0 && d > -KEY_HIT) return -0.5;
  return 0;
}

const SP: Spring = { x: 0, v: 0 };
/** bước mọi lò xo phím (một chỗ gọi mỗi khung — MazeGeometry). calm: giảm chuyển động → biên độ nhỏ */
export function stepKeys(beat: number, dt: number, calm = false) {
  const g = calm ? 0.35 : 1;
  for (let i = 0; i < KEYS.n; i++) {
    SP.x = KEYS.lift[i];
    SP.v = KEYS.vel[i];
    springStep(SP, keyTarget(KEYS.frac[i], beat) * g, KEY_OMEGA, KEY_ZETA, dt);
    KEYS.lift[i] = SP.x;
    KEYS.vel[i] = SP.v;
  }
}
export function resetKeys() {
  KEYS.lift.fill(0);
  KEYS.vel.fill(0);
}
/** độ nhô hiện tại của phím i (m) */
export const keyLift = (i: number) => KEYS.lift[i] * KEY_AMP;

// ───────────── Mặt động (va chạm) ─────────────
/** loại mặt động gắn vào Surf: đài nổi (di = chỉ số đài), cầu khuông nhạc, phím (di = chỉ số phím trong KEYS) */
export type DynKind = "plat" | "staff" | "key";

/**
 * Độ lệch cao của mặt động tại (x, z) — đọc đồng hồ dùng chung HARMONIC (beat, harmonics).
 * cx, cz, yaw: tâm + hướng của mặt (toạ độ dọc cầu s = (x − cx)·sin yaw + (z − cz)·cos yaw).
 */
export function dynOffset(kind: DynKind, di: number, cx: number, cz: number, yaw: number, x: number, z: number): number {
  if (kind === "plat") return platBob(di, HARMONIC.beat);
  if (kind === "key") return keyLift(di);
  const s = (x - cx) * Math.sin(yaw) + (z - cz) * Math.cos(yaw);
  return staffHeight(s, HARMONIC.beat, HARMONIC.harmonics);
}
