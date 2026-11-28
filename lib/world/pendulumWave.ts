/**
 * Con lắc sóng (bốt Siêu khối, TESSERACT_BOOTH.md §13 A4): 24 quả lắc, quả k dao động Nₖ = 29 + k lần trong Γ = 90 s
 * → Tₖ = Γ / Nₖ, chiều dài Lₖ = g·Tₖ² / (4π²) (con lắc đơn, góc nhỏ). Góc giải tích θₖ(t) = θ₀·cos(2π·Nₖ·t / Γ):
 * lệch pha dần thành "rắn", xoắn kép, hỗn loạn, rồi cứ 90 s lại thẳng hàng (Nₖ nguyên). Toạ độ cục bộ phòng (tessRoom.ts).
 */
import { dirOf } from "./tessRoom";

export const PW = { n: 24, gamma: 90, theta0: 0.32, g: 9.81, b0: 292, b1: 316, r: 11.15, pivotY: 4.52, leverB: 304, leverR: 9.6 } as const;

export const swings = (k: number) => 29 + k; // k = 1…24
export const period = (k: number) => PW.gamma / swings(k);
export const length = (k: number) => (PW.g * period(k) ** 2) / (4 * Math.PI * Math.PI);
export const angle = (k: number, t: number) => PW.theta0 * Math.cos((2 * Math.PI * swings(k) * t) / PW.gamma);
/** phương vị (độ) của quả k trên cung treo */
export const bobBearing = (k: number) => PW.b0 + ((PW.b1 - PW.b0) * (k - 0.5)) / PW.n;

/** gần cần gạt "thả cùng pha" trên sàn chính (toạ độ cục bộ phòng) */
export function nearPendulumLever(x: number, z: number, y: number): boolean {
  const [dx, dz] = dirOf(PW.leverB);
  return y < 1.2 && Math.hypot(x - dx * PW.leverR, z - dz * PW.leverR) < 1.6;
}
