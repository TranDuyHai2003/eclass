/**
 * VFX-AAA — nhịp 5 pha (báo trước → chỉ hướng → GIỮ + cao trào → tải → nguội) cho hiệu ứng va chạm, và đời của cụm khói.
 * Logic thuần (ghi vào đối tượng có sẵn, không cấp phát) — test ở tests/world/vfxBeats.test.ts.
 */
import type { FxLevel } from "./spellFx";

const clamp01 = (v: number) => (v < 0 ? 0 : v > 1 ? 1 : v);

/**
 * "Nhịp nín thở" trước va chạm: theo thời gian CÒN LẠI tới lúc chạm (giây, giải từ vật lý thật) → hệ số độ sáng của
 * dấu báo trước. 1 khi còn xa; trong `holdS` cuối tụt dần về `floor` (co lại, im lặng) để cú loé lúc chạm nổi bật.
 */
export function impactDip(remainS: number, holdS = 0.09, floor = 0.3): number {
  if (!(remainS > 0)) return floor;
  if (remainS >= holdS) return 1;
  const k = remainS / holdS; // 1 → 0
  return floor + (1 - floor) * k * k;
}

/**
 * Cú loé cao trào: vọt lên đỉnh trong `attackMs` (1–3 khung), rồi tắt BẤT ĐỐI XỨNG (mũ, nhanh đầu chậm cuối) trong `decayMs`.
 * Trả 0..peak.
 */
export function climaxPulse(ageMs: number, peak = 2.6, attackMs = 30, decayMs = 420): number {
  if (ageMs < 0) return 0;
  if (ageMs < attackMs) return peak * (attackMs <= 0 ? 1 : ageMs / attackMs);
  const a = ageMs - attackMs;
  if (a >= decayMs) return 0;
  // e^{-4x} chuẩn hoá về 0 ở cuối
  const e = Math.exp(-4 * (a / decayMs));
  const e1 = Math.exp(-4);
  return (peak * (e - e1)) / (1 - e1);
}

/** Trạng thái một cụm khói tại tuổi chuẩn hoá k ∈ [0, 1] */
export interface PuffState {
  /** hệ số cỡ (nở nhanh rồi nở chậm) */
  scale: number;
  /** độ phủ (mờ dần cuối đời) */
  alpha: number;
  /** nhiệt 1 → 0: lõi than hồng lúc đầu → muội xám khi nguội */
  heat: number;
  /** ngưỡng xói (0 nguyên khối → 1 tan hết): mép bị "ăn" theo vân khói */
  erode: number;
}

/**
 * Đời cụm khói: nở outExpo 0,4 → 1 trong 18 % đầu, sau đó nở chậm tới 1,35; nhiệt nguội theo mũ (than hồng ~15 % đầu);
 * xói tăng dần từ 45 % đời; độ phủ lên trong 6 % rồi giữ, tắt nốt ở 15 % cuối.
 */
export function puffAt(k: number, out: PuffState): PuffState {
  const t = clamp01(k);
  const grow = t < 0.18 ? 0.4 + 0.6 * (1 - Math.pow(2, -10 * (t / 0.18))) : 1 + 0.35 * ((t - 0.18) / 0.82);
  out.scale = grow;
  out.alpha = t < 0.06 ? t / 0.06 : t > 0.85 ? 1 - (t - 0.85) / 0.15 : 1;
  out.heat = Math.exp(-t * 9);
  out.erode = t < 0.45 ? 0 : clamp01((t - 0.45) / 0.55) * 0.92;
  if (t >= 1) {
    out.alpha = 0;
    out.erode = 1;
  }
  return out;
}

/** Ngân sách cụm khói SỐNG cùng lúc theo mức hiệu ứng (thấp ưu tiên điện thoại / GPU tích hợp) */
export const PUFF_CAP: Record<FxLevel, number> = { 0: 8, 1: 18, 2: 28 };

/** Số cụm khói cho một sự kiện (n ở mức cao), giảm theo mức; mức thấp vẫn giữ ít nhất `min` (dáng sự kiện vẫn đọc được) */
export function puffCount(n: number, lv: FxLevel, min = 1): number {
  if (n <= 0) return 0;
  const k = lv === 0 ? 0.35 : lv === 1 ? 0.65 : 1;
  return Math.max(min, Math.round(n * k));
}
