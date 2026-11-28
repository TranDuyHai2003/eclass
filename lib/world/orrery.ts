/**
 * Thiên văn đồ — máy mô hình Hệ Mặt Trời bằng đồng (bốt Siêu khối, phòng cuối hành lang đông; TESSERACT_BOOTH.md §13 A6).
 * Định luật Kepler: (1) quỹ đạo elip, Mặt Trời ở một tiêu điểm; (2) quét diện tích bằng nhau trong thời gian bằng nhau;
 * (3) T² / a³ như nhau cho mọi hành tinh (≈ 1 năm²/AU³). Mỗi khung giải phương trình Kepler M = E − e·sin E (Newton).
 * Số liệu thật (J2000, NASA JPL "Approximate positions of the planets"): bán trục lớn a (AU), tâm sai e, kinh độ điểm cận
 * nhật ϖ, kinh độ trung bình L₀ tại J2000, chu kỳ thiên văn T (ngày). Thuần logic, có test (tests/world/orrery.test.ts).
 */
import { ORR } from "./tessRoom";

export type Planet = { id: string; vi: string; en: string; a: number; e: number; varpi: number; L0: number; T: number; color: string; size: number };

export const PLANETS: readonly Planet[] = [
  { id: "mercury", vi: "Sao Thuỷ", en: "Mercury", a: 0.38709927, e: 0.20563593, varpi: 77.45779628, L0: 252.2503235, T: 87.969, color: "#b9a89a", size: 0.07 },
  { id: "venus", vi: "Sao Kim", en: "Venus", a: 0.72333566, e: 0.00677672, varpi: 131.60246718, L0: 181.9790995, T: 224.701, color: "#f2d39b", size: 0.11 },
  { id: "earth", vi: "Trái Đất", en: "Earth", a: 1.00000261, e: 0.01671123, varpi: 102.93768193, L0: 100.46457166, T: 365.256, color: "#5fa8ff", size: 0.115 },
  { id: "mars", vi: "Sao Hoả", en: "Mars", a: 1.52371034, e: 0.0933941, varpi: 336.05637041, L0: 355.44656795, T: 686.98, color: "#e0623c", size: 0.09 },
  { id: "jupiter", vi: "Sao Mộc", en: "Jupiter", a: 5.202887, e: 0.04838624, varpi: 14.72847983, L0: 34.39644051, T: 4332.59, color: "#e3b98a", size: 0.24 },
  { id: "saturn", vi: "Sao Thổ", en: "Saturn", a: 9.53667594, e: 0.05386179, varpi: 92.59887831, L0: 49.95424423, T: 10759.22, color: "#e8d28f", size: 0.2 },
];

export const YEAR_DAYS = 365.25;
export const J2000_MS = Date.UTC(2000, 0, 1, 12, 0, 0);
const RAD = Math.PI / 180;

/** Giải phương trình Kepler M = E − e·sin E (e ∈ [0, 1)) bằng Newton. M (rad) bất kỳ; trả E cùng "vòng" với M. */
export function solveKepler(M: number, e: number, tol = 1e-12): number {
  const twoPi = 2 * Math.PI;
  const k = Math.floor((M + Math.PI) / twoPi);
  const m = M - k * twoPi; // ∈ [−π, π)
  // điểm xuất phát an toàn cho cả tâm sai lớn (Danby): E₀ = M + 0,85·e·sign(sin M)
  let E = e < 0.8 ? m : m + 0.85 * e * Math.sign(Math.sin(m) || 1);
  for (let i = 0; i < 50; i++) {
    const f = E - e * Math.sin(E) - m;
    const d = f / (1 - e * Math.cos(E));
    E -= d;
    if (Math.abs(d) < tol) break;
  }
  return E + k * twoPi;
}

/** Dị thường thật ν từ dị thường tâm sai E */
export const trueAnomaly = (E: number, e: number) => 2 * Math.atan2(Math.sqrt(1 + e) * Math.sin(E / 2), Math.sqrt(1 - e) * Math.cos(E / 2));

/** Vị trí trên mặt phẳng quỹ đạo (AU), Mặt Trời ở gốc: x theo hướng điểm cận nhật */
export function orbitXY(a: number, e: number, E: number): [number, number] {
  return [a * (Math.cos(E) - e), a * Math.sqrt(1 - e * e) * Math.sin(E)];
}

/** Dị thường trung bình (rad) của hành tinh sau d ngày kể từ J2000 */
export const meanAnomaly = (p: Planet, days: number) => (p.L0 - p.varpi + (360 * days) / p.T) * RAD;

/** Vị trí nhật tâm trên mặt phẳng hoàng đạo (AU) — góc đo từ điểm xuân phân, ngược chiều kim đồng hồ nhìn từ cực bắc */
export function heliocentric(p: Planet, days: number): { x: number; y: number; r: number; nu: number; E: number } {
  const E = solveKepler(meanAnomaly(p, days), p.e);
  const [px, py] = orbitXY(p.a, p.e, E);
  const w = p.varpi * RAD;
  const c = Math.cos(w);
  const s = Math.sin(w);
  return { x: px * c - py * s, y: px * s + py * c, r: Math.hypot(px, py), nu: trueAnomaly(E, p.e), E };
}

/** Định luật 3: T² / a³ (năm² / AU³) — ≈ 1 cho mọi hành tinh (lệch ~0,1 % ở Sao Mộc / Thổ vì khối lượng của chính chúng) */
export const keplerRatio = (p: Planet) => (p.T / YEAR_DAYS) ** 2 / p.a ** 3;

/**
 * Tỉ lệ hiển thị: bán kính quỹ đạo thật trải từ 0,39 tới 9,54 AU — nén theo căn bậc hai để vừa máy Ø6 m
 * mà vẫn giữ HÌNH elip thật (mỗi hành tinh một hệ số co đều, tâm sai giữ nguyên).
 */
export const ORRERY_R = 3.0;
export const visRadius = (a: number) => 0.55 + (ORRERY_R - 0.55) * Math.sqrt(a / PLANETS[PLANETS.length - 1].a);
export const visScale = (a: number) => visRadius(a) / a;

/** Cần gạt thời gian: 1 giây thật = mult giây mô phỏng (×1 = thời gian thực; ×10⁶ ≈ 11,6 ngày / giây) */
export const TIME_STEPS = [1, 10, 100, 1e3, 1e4, 1e5, 1e6] as const;
export const nextTimeStep = (m: number) => TIME_STEPS[(TIME_STEPS.indexOf(m as (typeof TIME_STEPS)[number]) + 1) % TIME_STEPS.length];
/** số ngày mô phỏng trôi qua sau dt giây thật ở hệ số mult */
export const simDays = (dt: number, mult: number) => (dt * mult) / 86400;
/** ngày kể từ J2000 của một thời điểm (ms) */
export const daysSinceJ2000 = (ms: number) => (ms - J2000_MS) / 86400000;

/** "Hành tinh học trò": a = 2,5 AU, tâm sai chỉnh được — quạt diện tích bằng nhau thấy rõ khi e lớn */
export const STUDENT = { a: 2.5, varpi: 200 } as const;
export const ECC_STEPS = [0, 0.3, 0.6, 0.8, 0.9] as const;
export const nextEcc = (e: number) => ECC_STEPS[(ECC_STEPS.findIndex((x) => Math.abs(x - e) < 1e-9) + 1) % ECC_STEPS.length];
export const studentPeriodDays = () => Math.pow(STUDENT.a, 1.5) * YEAR_DAYS;

/**
 * Quạt diện tích bằng nhau: chia một chu kỳ thành n khoảng thời gian bằng nhau (dị thường trung bình đều),
 * mỗi quạt là đa giác Mặt Trời → các điểm trên cung quỹ đạo (toạ độ mặt phẳng quỹ đạo, AU). seg điểm mỗi cung.
 */
export function equalAreaWedges(a: number, e: number, n = 12, seg = 12): [number, number][][] {
  const out: [number, number][][] = [];
  for (let k = 0; k < n; k++) {
    const poly: [number, number][] = [[0, 0]];
    for (let j = 0; j <= seg; j++) {
      const M = ((k + j / seg) / n) * 2 * Math.PI;
      poly.push(orbitXY(a, e, solveKepler(M, e)));
    }
    out.push(poly);
  }
  return out;
}

/** Diện tích đa giác (công thức dây giày) */
export function polygonArea(poly: [number, number][]): number {
  let s = 0;
  for (let i = 0; i < poly.length; i++) {
    const [x1, y1] = poly[i];
    const [x2, y2] = poly[(i + 1) % poly.length];
    s += x1 * y2 - x2 * y1;
  }
  return Math.abs(s) / 2;
}

/** Gần cần gạt thời gian / núm tâm sai (toạ độ cục bộ phòng điều khiển, sàn chính) */
export function nearOrrery(x: number, z: number, y: number): "lever" | "dial" | null {
  if (y > 1.2 || x < ORR.cx - ORR.r) return null;
  const ox = x - ORR.cx;
  if (Math.hypot(ox - ORR.lever[0], z - ORR.lever[1]) < 1.5) return "lever";
  if (Math.hypot(ox - ORR.dial[0], z - ORR.dial[1]) < 1.5) return "dial";
  return null;
}
