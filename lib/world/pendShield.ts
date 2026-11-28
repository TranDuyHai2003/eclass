/**
 * Khiên Con lắc (Pendulum Shield) — logic thuần (không three / React → kiểm thử được).
 *
 * Khiên là quả lắc treo dưới tay bằng dây dài L. Góc lệch θ = θ₀·cos ψ, pha ψ tăng đều 2π/T mỗi giây,
 * chu kỳ T = 2π·√(L/g) (không phụ thuộc khối lượng; góc lớn thì dài hơn chút — dùng xấp xỉ góc nhỏ cho nhịp chơi).
 *  - Thế đỡ (chuột phải): buông quả lắc từ ĐỈNH (ψ = 0) → nó tới ĐÁY sau đúng T/4. Dây ngắn tới đáy sớm, dây dài muộn.
 *  - Đòn quái tới lúc quả lắc ở đáy (±PERFECT_S) = ĐỠ HOÀN HẢO: chặn trọn + phản đòn bằng động năng ở đáy
 *    ½·m·v² = m·g·L·(1 − cos θ₀) (bảo toàn cơ năng: thế năng ở đỉnh thành động năng ở đáy).
 *  - Đỡ hoàn hảo liên tiếp = đẩy xích đu đúng nhịp → biên độ θ₀ tăng (cộng hưởng); không đẩy thì tắt dần về θ_BASE.
 *  - Đòn đập khiên: sát thương theo động năng lúc chạm, KE/KE_max = (cos θ − cos θ₀)/(1 − cos θ₀).
 */

export const G = 9.8;
export const TAU = Math.PI * 2;
/** ba nấc dây (m) — phím X / nút L trên HUD */
export const SHIELD_LENGTHS = [0.25, 0.4, 0.6] as const;
/** khối lượng quả lắc (kg) — chỉ để hiện số năng lượng; nhịp KHÔNG phụ thuộc m */
export const BOB_MASS = 2;
/** biên độ (rad): nền, tối đa */
export const THETA_BASE = 0.45;
export const THETA_MAX = 1.1;
/** cửa sổ đỡ hoàn hảo quanh lúc qua đáy (s) */
export const PERFECT_S = 0.09;
/** đỡ "tốt" khi |θ| < GOOD_FRAC·θ₀ */
export const GOOD_FRAC = 0.7;
/** thời gian tắt dần biên độ về nền (s) — tắt dần theo hàm mũ */
export const DAMP_TAU = 6;

export function period(L: number, g = G): number {
  return TAU * Math.sqrt(L / g);
}

/** Thời gian từ lúc buông ở đỉnh tới lúc qua đáy lần đầu: T/4 */
export function quarter(L: number): number {
  return period(L) / 4;
}

/** Góc lệch theo pha */
export function angleAt(theta0: number, psi: number): number {
  return theta0 * Math.cos(psi);
}

/** Pha tiến thêm dt giây (giữ pha liên tục khi đổi L) */
export function advance(psi: number, dt: number, L: number): number {
  return (psi + (TAU * dt) / period(L)) % TAU;
}

/** Độ cao quả lắc so với đáy: h = L(1 − cos θ) */
export function height(L: number, theta: number): number {
  return L * (1 - Math.cos(theta));
}

/** Vận tốc quả lắc (bảo toàn cơ năng): v = √(2gL(cos θ − cos θ₀)) */
export function speedAt(L: number, theta0: number, theta: number, g = G): number {
  return Math.sqrt(Math.max(0, 2 * g * L * (Math.cos(theta) - Math.cos(theta0))));
}

/** Động năng ở đáy = thế năng ở đỉnh: ½mv² = mgL(1 − cos θ₀) */
export function kineticMax(L: number, theta0: number, m = BOB_MASS, g = G): number {
  return m * g * height(L, theta0);
}

/** Tỉ lệ động năng hiện tại / tối đa (0 ở biên, 1 ở đáy) */
export function keRatio(theta0: number, psi: number): number {
  const th = angleAt(theta0, psi);
  const den = 1 - Math.cos(theta0);
  return den > 1e-9 ? Math.max(0, Math.min(1, (Math.cos(th) - Math.cos(theta0)) / den)) : 0;
}

/** Khoảng thời gian (s) từ pha ψ tới lần qua đáy gần nhất (đáy ở ψ = π/2 + nπ) */
export function timeToBottom(psi: number, L: number): number {
  const r = (((psi - Math.PI / 2) % Math.PI) + Math.PI) % Math.PI;
  const dpsi = Math.min(r, Math.PI - r);
  return (dpsi / TAU) * period(L);
}

export type ParryGrade = "perfect" | "good" | "weak";

export function parryGrade(psi: number, L: number): ParryGrade {
  if (timeToBottom(psi, L) <= PERFECT_S) return "perfect";
  if (Math.abs(Math.cos(psi)) < GOOD_FRAC) return "good";
  return "weak";
}

/** Phần sát thương bị chặn theo hạng */
export function blockFraction(g: ParryGrade): number {
  return g === "perfect" ? 1 : g === "good" ? 0.7 : 0.3;
}

/** KE tham chiếu: dây giữa, biên độ nền — để phản đòn có thang đo dễ hiểu */
export const KE_REF = kineticMax(SHIELD_LENGTHS[1], THETA_BASE);

/** tỉ lệ năng lượng so với KE_REF, chặn ở 3 (giữ cân bằng khi cộng hưởng tối đa) */
export function energyRatio(L: number, theta0: number): number {
  return Math.min(3, kineticMax(L, theta0) / KE_REF);
}

/** Sát thương phản đòn (× công vũ khí) tỉ lệ động năng ở đáy */
export function counterMul(L: number, theta0: number): number {
  return 1.2 + 1.6 * energyRatio(L, theta0);
}

/** Đòn đập khiên: 0,6 ở biên … 1,5 ở đáy (theo tỉ lệ động năng) */
export function bashMul(theta0: number, psi: number): number {
  return 0.6 + 0.9 * keRatio(theta0, psi);
}

/** Cộng hưởng: mỗi lần "đẩy" đúng nhịp tăng biên độ (chuỗi đỡ hoàn hảo liên tiếp đẩy mạnh dần) */
export function pump(theta0: number, streak: number): number {
  const gain = 0.12 + 0.04 * Math.min(3, Math.max(0, streak));
  return Math.min(THETA_MAX, theta0 + gain);
}

/** Tắt dần theo hàm mũ về biên độ nền */
export function decay(theta0: number, dt: number): number {
  return THETA_BASE + (theta0 - THETA_BASE) * Math.exp(-Math.max(0, dt) / DAMP_TAU);
}

/** Giải phóng cộng hưởng (tụ lực): bán kính + hệ số sát thương theo năng lượng đang tích */
export function releaseBurst(L: number, theta0: number): { r: number; mul: number } {
  const e = energyRatio(L, theta0);
  const k = (theta0 - THETA_BASE) / (THETA_MAX - THETA_BASE);
  return { r: 2.2 + 2.6 * Math.max(0, k), mul: 1.4 + 1.1 * e };
}

/** Pha bắt đầu thế đỡ: buông từ đỉnh phía sau (θ = +θ₀) */
export const GUARD_PSI = 0;
