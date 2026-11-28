/**
 * Epicycle Fourier cho boss Fourier Siren + cổng (thuần — test được; nhánh B, docs/ai-reviews/siren-witch/PLAN.md).
 *  - Đường viền boss = Σ c_k e^{i(k·2πt + φ_k)} (hệ số tính OFFLINE: scripts/siren-epicycles.mjs → lib/world/sirenOutline.ts),
 *    sắp giảm dần theo biên độ → chuỗi vectơ quay "to trước nhỏ sau".
 *  - "Mất hoạ âm bậc cao trước": trọng số từng số hạng w = clamp(kMax + 1 − |k|, 0, 1) — kMax thực (giảm mượt, không nhảy).
 *  - Lịch xuất hiện / BREAK / gục: hàm thuần theo mốc thời gian (ms), chỉ cho HÌNH — luật boss ở lib/world/boss.ts.
 *  - Báo trước "Sóng dừng": biểu thức vùng NGUY HIỂM viết MỘT lần, hợp lệ cả GLSL lẫn JS (test so với standingDanger).
 */
import { ARENA_R, LAMBDA } from "./boss";
import { SIREN_OUTLINE, SIREN_OUTLINE_C0 } from "./sirenOutline";

export interface Epicycles {
  n: number;
  k: Float32Array;
  amp: Float32Array;
  ph: Float32Array;
  c0x: number;
  c0y: number;
  /** |k| lớn nhất trong bộ hệ số */
  kTop: number;
}

export function epicyclesFromFlat(flat: readonly number[], c0: readonly [number, number]): Epicycles {
  const n = Math.floor(flat.length / 3);
  const e: Epicycles = { n, k: new Float32Array(n), amp: new Float32Array(n), ph: new Float32Array(n), c0x: c0[0], c0y: c0[1], kTop: 0 };
  for (let i = 0; i < n; i++) {
    e.k[i] = flat[i * 3];
    e.amp[i] = flat[i * 3 + 1];
    e.ph[i] = flat[i * 3 + 2];
    e.kTop = Math.max(e.kTop, Math.abs(e.k[i]));
  }
  return e;
}

export const SIREN_EPI = epicyclesFromFlat(SIREN_OUTLINE, SIREN_OUTLINE_C0);

/** trọng số số hạng theo bậc |k| (mất bậc cao trước, kMax thực → mờ dần mượt) */
export function termWeight(k: number, kMax: number): number {
  return Math.min(1, Math.max(0, kMax + 1 - Math.abs(k)));
}

/** số hoạ âm còn sống (HARMONIC.harmonics 8 → 1) → bậc |k| tối đa còn vẽ: 8 → đủ, 1 → chỉ còn dáng thô */
export function harmonicKMax(harmonics: number, kTop: number): number {
  const h = Math.min(8, Math.max(1, harmonics));
  return 2 + ((h - 1) / 7) * (kTop - 2);
}

/**
 * Khớp của chuỗi epicycle tại tham số chu kỳ t (0…1): out[0..1] = tâm, rồi từng khớp sau mỗi vectơ (đã nhân trọng số).
 * Trả về số khớp (n + 1). Không cấp phát.
 */
export function epicycleJoints(e: Epicycles, t: number, kMax: number, scale: number, out: Float32Array): number {
  let x = e.c0x * scale;
  let y = e.c0y * scale;
  out[0] = x;
  out[1] = y;
  const w2 = 2 * Math.PI * t;
  for (let i = 0; i < e.n; i++) {
    const a = e.amp[i] * termWeight(e.k[i], kMax) * scale;
    const ang = e.ph[i] + e.k[i] * w2;
    x += a * Math.cos(ang);
    y += a * Math.sin(ang);
    out[(i + 1) * 2] = x;
    out[(i + 1) * 2 + 1] = y;
  }
  return e.n + 1;
}

/** chỉ điểm ngọn (đầu bút) — vẽ dải ruy băng đường viền */
export function epicycleTip(e: Epicycles, t: number, kMax: number, scale: number, out: Float32Array, o = 0): void {
  let x = e.c0x * scale;
  let y = e.c0y * scale;
  const w2 = 2 * Math.PI * t;
  for (let i = 0; i < e.n; i++) {
    const w = termWeight(e.k[i], kMax);
    if (w <= 0) continue;
    const a = e.amp[i] * w * scale;
    const ang = e.ph[i] + e.k[i] * w2;
    x += a * Math.cos(ang);
    y += a * Math.sin(ang);
  }
  out[o] = x;
  out[o + 1] = y;
}

// ───────────── Lịch hình ảnh (ms) ─────────────
/** xuất hiện: bút epicycle vẽ trọn đường viền trong INTRO_DRAW ms, rồi thân boss hiện dần trong INTRO_FORM ms */
export const INTRO_DRAW = 2000;
export const INTRO_FORM = 700;
/** gục: bậc kMax giảm về 1 trong DEATH_SIMPLIFY ms (mất bậc cao trước), rồi co về một điểm trong DEATH_VANISH ms */
export const DEATH_SIMPLIFY = 2600;
export const DEATH_VANISH = 900;
/** BREAK: vỡ xuống còn bậc BREAK_K trong 450 ms; dựng lại trong BREAK_REFORM ms cuối */
export const BREAK_K = 3;
export const BREAK_REFORM = 1200;

export type BossLook = {
  /** 0…1: phần đường viền đã vẽ (1 = khép kín) */
  draw: number;
  /** bậc tối đa còn vẽ */
  kMax: number;
  /** hệ số co toàn hình (gục → 0) */
  shrink: number;
  /** độ hiện của chuỗi vectơ (vòng tròn + mũi tên) */
  chain: number;
  /** độ hiện của dải đường viền */
  trail: number;
  /** tan biến thân mô hình (0 = nguyên vẹn; ≥ 2,3 = mất hẳn — xem addDissolve) */
  dissolve: number;
  /** vòng quay của bút (chu kỳ / giây) khi đang "sống" trong BREAK */
  spin: number;
};

const clamp01 = (x: number) => Math.min(1, Math.max(0, x));
const smooth = (x: number) => {
  const t = clamp01(x);
  return t * t * (3 - 2 * t);
};
/** ngưỡng tan biến thân: 2,3 = mất hẳn (mô hình cao ~4 m, addDissolve cắt y < d·1,9 − 0,25) */
export const DISSOLVE_GONE = 2.3;

/**
 * Trạng thái hình của boss tại `now` (ms). sinceMount: ms từ lúc màn bắt đầu vẽ boss; brokenUntil / brokenAt / deadAt như BossSim.
 * baseKMax: bậc theo HARMONIC.harmonics (phân rã theo máu).
 */
export function bossLook(out: BossLook, sinceMount: number, now: number, brokenAt: number, brokenUntil: number, deadAt: number, baseKMax: number, kTop: number): BossLook {
  out.spin = 0;
  out.shrink = 1;
  if (deadAt) {
    const t = now - deadAt;
    const s = clamp01(t / DEATH_SIMPLIFY);
    // bậc giảm theo hàm mũ (bậc cao rụng nhanh, dáng thô ở lâu)
    out.kMax = 1 + (baseKMax - 1) * Math.pow(1 - s, 2.2);
    out.shrink = 1 - smooth((t - DEATH_SIMPLIFY) / DEATH_VANISH);
    out.draw = 1;
    out.chain = out.shrink * (1 - smooth((t - DEATH_SIMPLIFY * 0.6) / 600));
    out.trail = out.shrink;
    out.dissolve = DISSOLVE_GONE * smooth(t / 1500);
    return out;
  }
  if (sinceMount < INTRO_DRAW + INTRO_FORM) {
    const d = clamp01(sinceMount / INTRO_DRAW);
    const f = smooth((sinceMount - INTRO_DRAW) / INTRO_FORM);
    out.draw = d;
    out.kMax = kTop;
    out.chain = 1 - f;
    out.trail = 1 - f * 0.85;
    out.dissolve = DISSOLVE_GONE * (1 - f);
    return out;
  }
  if (now < brokenUntil) {
    const into = now - brokenAt;
    const left = brokenUntil - now;
    const down = smooth(into / 450);
    const up = smooth(1 - left / BREAK_REFORM);
    const k = baseKMax + (BREAK_K - baseKMax) * down;
    out.kMax = k + (baseKMax - k) * up;
    out.draw = 1;
    out.chain = 1 - up * 0.9;
    out.trail = 1;
    out.dissolve = 1.15 * down * (1 - up);
    out.spin = 0.45;
    return out;
  }
  // chiến đấu thường: chỉ còn "bóng ma" đường viền mảnh khi đã phân rã (đọc số hoạ âm)
  out.kMax = baseKMax;
  out.draw = 1;
  out.chain = 0;
  out.trail = 0;
  out.dissolve = 0;
  return out;
}

// ───────────── Báo trước Sóng dừng (Chladni) — cùng luật với boss.ts ─────────────
/**
 * Biểu thức vùng NGUY HIỂM (bool) của Sóng dừng, viết một lần, hợp lệ trong GLSL (biến float r, uLam, uRMax) và JS
 * (qua standingDangerDrawn). Phải trùng standingDanger(r) trong lib/world/boss.ts — test tests/world/epicycle.test.ts.
 */
export const STANDING_DANGER_EXPR = "(r >= 2.0 && r <= uRMax && abs(sin(6.283185307179586 * r / uLam)) > 0.5)";
export const STANDING_R_MAX = ARENA_R - 0.5;
export const STANDING_LAMBDA = LAMBDA;

type DangerFn = (r: number, l: number, m: number, abs: (x: number) => number, sin: (x: number) => number) => boolean;
let dangerFn: DangerFn | null = null;
/** bản JS của biểu thức GLSL đang vẽ trên sàn (x, z quanh tâm đấu trường) — chỉ dùng cho test (tạo lười) */
export function standingDangerDrawn(x: number, z: number): boolean {
  dangerFn ??= new Function("r", "uLam", "uRMax", "abs", "sin", `return ${STANDING_DANGER_EXPR};`) as DangerFn;
  return dangerFn(Math.hypot(x, z), STANDING_LAMBDA, STANDING_R_MAX, Math.abs, Math.sin);
}
