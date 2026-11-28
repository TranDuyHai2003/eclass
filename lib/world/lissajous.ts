/**
 * Đàn laser Lissajous (bốt Siêu khối, TESSERACT_BOOTH.md §13 I4) — logic thuần.
 * Sáu tia có tần số 1…6. Chạm (F) hai tia a, b → tường vẽ x = sin(a·t + δ), y = sin(b·t) và loa phát hai âm tần số tỉ lệ a : b.
 * Tỉ lệ đơn giản (3 : 2) vừa cho hình "bánh quy" khép kín gọn vừa nghe thuận tai (quãng năm đúng) — cùng một lý do: chu kỳ chung ngắn.
 */
export const LH = { bearing: 335, r: 11.9, frameR: 13.3, frameY: 2.45, topY: 4.62, xs: [-1.25, -0.75, -0.25, 0.25, 0.75, 1.25] } as const;

const gcd = (a: number, b: number): number => (b ? gcd(b, a % b) : a);
/** tỉ lệ rút gọn (lớn : nhỏ) */
export function ratio(a: number, b: number): [number, number] {
  const g = gcd(a, b);
  const p = Math.max(a, b) / g;
  const q = Math.min(a, b) / g;
  return [p, q];
}
const NAMES: Record<string, [string, string]> = {
  "1:1": ["đồng âm", "unison"],
  "2:1": ["quãng tám", "octave"],
  "3:2": ["quãng năm đúng", "perfect fifth"],
  "4:3": ["quãng bốn đúng", "perfect fourth"],
  "5:4": ["quãng ba trưởng", "major third"],
  "6:5": ["quãng ba thứ", "minor third"],
  "5:3": ["quãng sáu trưởng", "major sixth"],
  "3:1": ["quãng mười hai (tám + năm)", "twelfth (octave + fifth)"],
  "4:1": ["hai quãng tám", "two octaves"],
  "5:2": ["quãng mười ba trưởng", "major thirteenth"],
  "6:1": ["hai quãng tám + quãng năm", "two octaves + a fifth"],
  "5:1": ["hai quãng tám + quãng ba trưởng", "two octaves + a major third"],
};
export function intervalName(a: number, b: number, vi: boolean): string {
  const [p, q] = ratio(a, b);
  const n = NAMES[`${p}:${q}`];
  return n ? n[vi ? 0 : 1] : vi ? "nghịch tai" : "dissonant";
}
export function lissajous(a: number, b: number, delta: number, t: number): [number, number] {
  return [Math.sin(a * t + delta), Math.sin(b * t)];
}
/** chu kỳ chung (khép kín) của đường cong: 2π / gcd(a, b) */
export const closePeriod = (a: number, b: number) => (2 * Math.PI) / gcd(a, b);

/** khung đàn → toạ độ cục bộ phòng (xoay π − bearing; +z khung = hướng ra tường) */
export function harpToRoom(x: number, z: number): [number, number] {
  const th = Math.PI - (LH.bearing * Math.PI) / 180;
  return [x * Math.cos(th) + z * Math.sin(th), -x * Math.sin(th) + z * Math.cos(th)];
}
/** đứng trong tia nào (0…5) — trên sàn chính, sát bệ */
export function nearHarpBeam(x: number, z: number, y: number): number | null {
  if (y > 1.2) return null;
  let best: number | null = null;
  let bd = 0.3;
  LH.xs.forEach((bx, k) => {
    const [sx, sz] = harpToRoom(bx, LH.r - 0.55);
    const d = Math.hypot(x - sx, z - sz);
    if (d < bd) {
      bd = d;
      best = k;
    }
  });
  return best;
}
