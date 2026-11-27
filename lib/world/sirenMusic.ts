/**
 * Mê cung Hoạ âm — toán / nhạc / vật lý cho các điểm tương tác, quái và cơ chế tổ đội (hàm thuần, test được).
 *
 *  - Quãng âm theo tỉ lệ nguyên (ngữ điệu thuần): quãng tám 2:1, quãng năm 3:2, quãng bốn 4:3, ba trưởng 5:4…
 *    Độ "thuận tai" ~ độ cao Tenney log₂(p·q): tỉ lệ càng đơn giản càng thuận.
 *  - Đàn một dây (monochord, Pythagoras): đặt ngựa đàn chia dây; phần dây ℓ kêu cao hơn cả dây L theo tỉ lệ L:ℓ.
 *  - Ống Fourier: ống thứ n phát sin(n·t)/n; ghép đúng các hoạ âm thì ra sóng vuông (n lẻ) / răng cưa (mọi n).
 *  - Con lắc cộng hưởng: chu kỳ riêng T = 2π√(L/g); đẩy đúng nhịp thì biên độ tăng dần (cộng hưởng), lệch nhịp thì hãm.
 *  - Quái: "Nốt lạc điệu" chỉ bị thương khi trúng ĐÚNG NHỊP của nó; "Sóng nhiễu" chỉ bị thương ở pha ngược (giao thoa
 *    triệt tiêu); "Cặp bất hoà" phải được lên dây (mỗi đòn +1 nửa cung) tới quãng thuận thì tan thành hợp âm.
 *  - Tổ đội: hai bệ hợp âm — mỗi bệ "ngân" 4 s sau khi rời chân; hai bệ cùng ngân → hợp âm mở rương
 *    (2 người đứng hai bệ là chắc chắn; một mình phải chạy kịp trong lúc nốt kia còn ngân).
 */

// ───────────── Quãng âm ─────────────
export interface Interval {
  p: number;
  q: number;
  semis: number;
  vi: string;
  en: string;
}
export const INTERVALS: Interval[] = [
  { p: 1, q: 1, semis: 0, vi: "đồng âm", en: "unison" },
  { p: 16, q: 15, semis: 1, vi: "hai thứ", en: "minor second" },
  { p: 9, q: 8, semis: 2, vi: "hai trưởng", en: "major second" },
  { p: 6, q: 5, semis: 3, vi: "ba thứ", en: "minor third" },
  { p: 5, q: 4, semis: 4, vi: "ba trưởng", en: "major third" },
  { p: 4, q: 3, semis: 5, vi: "quãng bốn", en: "perfect fourth" },
  { p: 45, q: 32, semis: 6, vi: "tam cung", en: "tritone" },
  { p: 3, q: 2, semis: 7, vi: "quãng năm", en: "perfect fifth" },
  { p: 8, q: 5, semis: 8, vi: "sáu thứ", en: "minor sixth" },
  { p: 5, q: 3, semis: 9, vi: "sáu trưởng", en: "major sixth" },
  { p: 16, q: 9, semis: 10, vi: "bảy thứ", en: "minor seventh" },
  { p: 15, q: 8, semis: 11, vi: "bảy trưởng", en: "major seventh" },
  { p: 2, q: 1, semis: 12, vi: "quãng tám", en: "octave" },
];
export const cents = (r: number) => 1200 * Math.log2(r);
/** Độ cao Tenney: log₂(p·q) — càng nhỏ càng thuận tai */
export const tenney = (p: number, q: number) => Math.log2(p * q);
export function isConsonant(p: number, q: number): boolean {
  return tenney(p, q) <= 4.4;
}
/** Quãng có tên gần nhất với tỉ lệ r (≥ 1), sai lệch ≤ 25 cent */
export function nameInterval(r: number): Interval | null {
  let best: Interval | null = null;
  let bd = 25;
  for (const iv of INTERVALS) {
    const d = Math.abs(cents(r) - cents(iv.p / iv.q));
    if (d < bd) {
      bd = d;
      best = iv;
    }
  }
  return best;
}
/** Tần số phách giữa hai nốt gần nhau (Hz) */
export const beatHz = (f1: number, f2: number) => Math.abs(f1 - f2);
/** Nốt theo 12-TET quanh A4 = 440 */
export const tet = (semisFromA4: number) => 440 * Math.pow(2, semisFromA4 / 12);
/** Nốt gốc của mê cung: Đô (C4) */
export const ROOT = tet(-9);

// ───────────── Đàn một dây ─────────────
/** Các nấc ngựa đàn: phần dây ℓ = L · q / p (nghe cao hơn dây buông theo tỉ lệ p:q) */
export const MONO_STOPS: [number, number][] = [
  [16, 15],
  [9, 8],
  [6, 5],
  [5, 4],
  [4, 3],
  [45, 32],
  [3, 2],
  [8, 5],
  [5, 3],
  [2, 1],
];
export interface Monochord {
  id: string;
  x: number;
  z: number;
  y: number;
  /** quãng cần chỉnh tới (chỉ số trong MONO_STOPS) */
  target: number;
  /** hướng dây (yaw) */
  yaw: number;
}
/** Ba đàn một dây quanh Sân Hoà âm (đảo góc Đông Nam): quãng tám, quãng năm, quãng bốn */
export const HARMONY_COURT = { x: 31, z: 31, y: 0, r: 7 };
export const MONOCHORDS: Monochord[] = [
  { id: "octave", target: 9, ...ring(HARMONY_COURT, 4.6, 0.2) },
  { id: "fifth", target: 6, ...ring(HARMONY_COURT, 4.6, 0.2 + (2 * Math.PI) / 3) },
  { id: "fourth", target: 4, ...ring(HARMONY_COURT, 4.6, 0.2 + (4 * Math.PI) / 3) },
];
function ring(c: { x: number; z: number; y: number }, r: number, a: number) {
  return { x: c.x + Math.cos(a) * r, z: c.z + Math.sin(a) * r, y: c.y, yaw: Math.atan2(-Math.sin(a), Math.cos(a)) };
}
/** Tỉ lệ tần số của nấc ngựa đàn */
export const monoRatio = (stop: number) => MONO_STOPS[stop][0] / MONO_STOPS[stop][1];
/** Phần dây còn rung (0…1) ở nấc này */
export const monoLength = (stop: number) => MONO_STOPS[stop][1] / MONO_STOPS[stop][0];
export const nextStop = (stop: number) => (stop + 1) % MONO_STOPS.length;
export function harmonySolved(stops: number[]): boolean {
  return MONOCHORDS.every((m, i) => stops[i] === m.target);
}

// ───────────── Ống Fourier ─────────────
export const FOURIER_N = 6;
export type WaveTarget = "square" | "saw";
export const WAVE_TARGET: Record<WaveTarget, { set: number[]; vi: string; en: string }> = {
  square: { set: [1, 3, 5], vi: "sóng vuông (chỉ hoạ âm lẻ)", en: "square wave (odd harmonics)" },
  saw: { set: [1, 2, 3, 4, 5, 6], vi: "sóng răng cưa (mọi hoạ âm)", en: "sawtooth (all harmonics)" },
};
/** Tổng riêng Fourier: Σ_{n bật} sin(n t) / n */
export function fourierSum(on: boolean[], t: number): number {
  let s = 0;
  for (let n = 1; n <= on.length; n++) if (on[n - 1]) s += Math.sin(n * t) / n;
  return s;
}
export function targetSum(tg: WaveTarget, t: number): number {
  let s = 0;
  for (const n of WAVE_TARGET[tg].set) s += Math.sin(n * t) / n;
  return s;
}
/** Sai số trung bình bình phương giữa sóng đang ghép và sóng mục tiêu trên một chu kỳ */
export function waveError(on: boolean[], tg: WaveTarget, samples = 64): number {
  let e = 0;
  for (let i = 0; i < samples; i++) {
    const t = (i / samples) * 2 * Math.PI;
    e += (fourierSum(on, t) - targetSum(tg, t)) ** 2;
  }
  return Math.sqrt(e / samples);
}
export const waveSolved = (on: boolean[], tg: WaveTarget) => waveError(on, tg) < 1e-9;

// ───────────── Con lắc cộng hưởng ─────────────
export const PENDULUM = { x: -6, z: -38.5, y: 0, len: 3.2, gamma: 0.03, push: 0.16, max: 0.8 };
/** Chu kỳ riêng (g thật 9,81 cho con lắc trang trí) */
export const pendulumPeriod = (len = PENDULUM.len, g = 9.81) => 2 * Math.PI * Math.sqrt(len / g);
/** Góc lệch ở thời điểm t (biên độ A, bắt đầu ở pha 0 = đi qua đáy theo chiều dương) */
export const pendulumAngle = (A: number, t: number, T = pendulumPeriod()) => A * Math.sin((2 * Math.PI * t) / T);
/**
 * Đẩy con lắc ở pha φ ∈ [0, 1) của chu kỳ (0 = đi qua đáy theo chiều đẩy): đúng nhịp (|φ| nhỏ) tăng biên độ,
 * ngược nhịp (φ ≈ 0,5) hãm lại. Trả về biên độ mới (kẹp 0…max).
 */
export function pendulumPush(A: number, phase: number): number {
  const ph = ((phase % 1) + 1) % 1;
  const k = Math.cos(2 * Math.PI * ph);
  // bắt đầu từ đứng yên: đẩy nào cũng làm con lắc dao động
  const add = A < 0.05 ? PENDULUM.push : PENDULUM.push * k;
  return Math.max(0, Math.min(PENDULUM.max, A + add));
}
/** Tắt dần theo e^{-γt} */
export const pendulumDecay = (A: number, dt: number) => A * Math.exp(-PENDULUM.gamma * dt);
export const pendulumRings = (A: number) => A >= PENDULUM.max - 1e-9;

// ───────────── Quái hoạ âm ─────────────
export type MonsterKind = "offkey" | "noise" | "dissonance";
export interface MonsterDef {
  kind: MonsterKind;
  vi: string;
  en: string;
  hint: { vi: string; en: string };
  hp: number;
}
export const MONSTER_DEFS: Record<MonsterKind, MonsterDef> = {
  offkey: { kind: "offkey", vi: "Nốt lạc điệu", en: "Off-key Note", hp: 120, hint: { vi: "đánh ĐÚNG NHỊP khi nó loé", en: "hit ON ITS BEAT when it flashes" } },
  noise: { kind: "noise", vi: "Sóng nhiễu", en: "Noise Wave", hp: 140, hint: { vi: "đánh khi nó ở PHA NGƯỢC (xanh) để triệt tiêu", en: "hit in ANTI-PHASE (blue) to cancel it" } },
  dissonance: { kind: "dissonance", vi: "Cặp bất hoà", en: "Dissonant Pair", hp: 1, hint: { vi: "mỗi đòn nâng nửa cung — chỉnh tới quãng thuận", en: "each hit raises a semitone — tune to a consonance" } },
};
/** Nhịp riêng của Nốt lạc điệu: chu kỳ (s) và cửa sổ "đúng nhịp" (s) */
export const OFFKEY_PERIOD = 1.2;
export const OFFKEY_WINDOW = 0.18;
/** Thời điểm t (s) có nằm trong cửa sổ đúng nhịp (quanh bội số của chu kỳ, lệch pha seed) */
export function onBeat(t: number, seed: number, period = OFFKEY_PERIOD, win = OFFKEY_WINDOW): boolean {
  const ph = (((t + seed) % period) + period) % period;
  return ph < win || ph > period - win;
}
/** Pha của Sóng nhiễu: sin(2π f t + seed); bị thương khi < −0,3 (pha ngược) */
export const NOISE_F = 0.6;
export const noisePhase = (t: number, seed: number) => Math.sin(2 * Math.PI * NOISE_F * t + seed);
export const noiseVulnerable = (t: number, seed: number) => noisePhase(t, seed) < -0.3;
/** Cặp bất hoà: bắt đầu ở hai thứ (1 nửa cung); quãng thuận = 4 (ba trưởng), 5, 7, 12 */
export const DISSONANCE_START = 1;
const CONSONANT_SEMIS = new Set([4, 5, 7, 12]);
export function tuneUp(semis: number): { semis: number; resolved: boolean } {
  const s = semis >= 12 ? 1 : semis + 1;
  return { semis: s, resolved: CONSONANT_SEMIS.has(s) };
}
/** Sát thương thực nhận của quái hoạ âm theo luật của nó (âm = hồi máu: đánh sai pha làm nó mạnh lên) */
export function monsterDamage(kind: MonsterKind, dmg: number, t: number, seed: number): number {
  if (kind === "offkey") return onBeat(t, seed) ? Math.round(dmg * 1.5) : -Math.round(dmg * 0.25);
  if (kind === "noise") return noiseVulnerable(t, seed) ? dmg : noisePhase(t, seed) > 0.3 ? -Math.round(dmg * 0.3) : 0;
  return 0;
}

export interface MonsterSpawn {
  kind: MonsterKind;
  x: number;
  z: number;
  y: number;
}
export const MONSTER_SPAWNS: MonsterSpawn[] = [
  { kind: "offkey", x: -2, z: 40, y: 0 },
  { kind: "offkey", x: 5, z: 48, y: 0 },
  { kind: "offkey", x: 0, z: 26, y: 0 },
  { kind: "noise", x: -5, z: -41, y: 0 },
  { kind: "noise", x: 6, z: -40, y: 0 },
  { kind: "dissonance", x: 40, z: 6, y: 0 },
];

// ───────────── Tổ đội: hai bệ hợp âm ─────────────
export const CHORD_PLATES = [
  { id: "A", x: -48, z: -5.5, y: 0, r: 1.5, semis: 0 },
  { id: "B", x: -48, z: 5.5, y: 0, r: 1.5, semis: 7 },
] as const;
export const SUSTAIN_MS = 4000;
export function onPlate(i: 0 | 1, x: number, y: number, z: number): boolean {
  const p = CHORD_PLATES[i];
  return Math.hypot(x - p.x, z - p.z) < p.r && Math.abs(y - p.y) < 1.2;
}
/**
 * Mỗi bệ "ngân" khi có người đứng trên nó hoặc vừa rời trong SUSTAIN_MS. Trả về độ ngân 0…1 từng bệ và hợp âm.
 * occupiedAt: thời điểm gần nhất có người đứng (ms), −∞ nếu chưa.
 */
export function chordState(occupiedAt: [number, number], now: number, sustain = SUSTAIN_MS): { ring: [number, number]; chord: boolean } {
  const ring = occupiedAt.map((t) => Math.max(0, 1 - (now - t) / sustain)) as [number, number];
  return { ring, chord: ring[0] > 0 && ring[1] > 0 };
}
