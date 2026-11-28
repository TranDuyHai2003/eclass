/**
 * Giáo Sin (Sine Lance) — logic thuần (không three / React → kiểm thử được).
 *
 * Mỗi nhát đâm thả ra một bó sóng chạy y(s, t) = A·sin(k·s − ω·(t − t₀)), k = 2π/λ, ω = 2π·f, v = λ·f (v cố định).
 *  - Nhát đâm thường: chạm ngay mọi quái trên đường đâm; quái ở ĐỈNH sóng (|sin k·s| = 1) chịu ×1,5, ở NÚT (sin = 0) chỉ ×0,7.
 *    → đổi bước sóng λ để đỉnh rơi đúng khoảng cách tới quái: s = (2n + 1)·λ/4.
 *  - Giữ chuột: biên độ A lớn dần; thả ra → bó sóng tụ lực chạy đi, mỗi lần ĐỈNH (cực trị) đi qua một quái thì quái bị đánh,
 *    sát thương ∝ |y| tại đó. Làn sóng rộng A + 0,7 m.
 *  - Hai bó sóng chồng lên nhau: y = y₁ + y₂ (chồng chập). Cùng pha → biên độ cộng (tăng cường), ngược pha → triệt tiêu.
 *    Hai nhát cùng chỗ cách nhau Δt lệch pha Δφ = ω·Δt = 2π·Δt/T: thả đúng sau một chu kỳ T là cùng pha.
 *  - Kỹ năng "Sóng dừng": một bó chạy đi + một bó phản xạ chạy về từ "vách" cách D = 2λ → nút đứng yên, bụng đập ×2.
 */

export const TAU = Math.PI * 2;
/** tốc độ truyền sóng (m/s) — cố định, nên f = v/λ */
export const WAVE_V = 4;
/** ba nấc bước sóng (m) — phím X / nút λ trên HUD */
export const LANCE_LAMBDAS = [1.6, 2.4, 3.2] as const;
/** biên độ (m): nhát đâm thường; tụ lực từ A_MIN (vừa đủ giữ) tới A_MAX (giữ thêm FULL_MS) */
export const A_CHAIN = 0.35;
export const A_MIN = 0.45;
export const A_MAX = 1.3;
/** ms giữ thêm sau ngưỡng tụ lực để biên độ đạt tối đa */
export const FULL_MS = 1000;
/** nửa bề rộng làn sóng thêm vào biên độ (m) */
export const LANE_PAD = 0.7;
/** hệ số trên đỉnh / nút cho nhát đâm */
export const CREST_MUL = 1.5;
export const NODE_MUL = 0.7;
/** dưới mức này |y| không tính là trúng (gần nút / triệt tiêu) */
export const CREST_MIN = 0.15;

export interface WaveParams {
  A: number;
  lam: number;
  k: number;
  f: number;
  omega: number;
  T: number;
  v: number;
}

export function waveParams(A: number, lam: number, v = WAVE_V): WaveParams {
  const f = v / lam;
  return { A, lam, k: TAU / lam, f, omega: TAU * f, T: 1 / f, v };
}

/** Biên độ theo thời gian giữ chuột (ms) — holdMs < holdThreshold thì chưa tụ (trả A_CHAIN) */
export function chargeAmplitude(holdMs: number, holdThreshold: number): number {
  if (holdMs < holdThreshold) return A_CHAIN;
  const k = Math.min(1, (holdMs - holdThreshold) / FULL_MS);
  return A_MIN + (A_MAX - A_MIN) * k;
}

/** Hệ số nhát đâm theo khoảng cách s (m) tới quái: đỉnh ×1,5 … nút ×0,7 (tuyến tính theo |sin k·s|) */
export function crestMul(s: number, lam: number): number {
  const a = Math.abs(Math.sin((TAU * s) / lam));
  return NODE_MUL + (CREST_MUL - NODE_MUL) * a;
}

/** Các vị trí đỉnh (|y| cực đại) trong [0, maxS]: s = (2n + 1)·λ/4 */
export function crestPositions(lam: number, maxS: number): number[] {
  const out: number[] = [];
  for (let n = 0; ; n++) {
    const s = ((2 * n + 1) * lam) / 4;
    if (s > maxS + 1e-9) break;
    out.push(s);
  }
  return out;
}

/** Bước sóng trong danh sách đặt đỉnh gần khoảng cách s nhất (gợi ý cho người chơi / kiểm thử) */
export function bestLambda(s: number, lams: readonly number[] = LANCE_LAMBDAS): number {
  let best = lams[0];
  let bm = -1;
  for (const l of lams) {
    const m = crestMul(s, l);
    if (m > bm + 1e-9) {
      bm = m;
      best = l;
    }
  }
  return best;
}

// ───────────── Bó sóng chạy (packet) ─────────────

export type PacketSrc = "chain" | "charged" | "skill";

export interface Packet {
  id: number;
  /** gốc (x, z) + hướng đơn vị (dx, dz) trên mặt đất */
  ox: number;
  oz: number;
  dx: number;
  dz: number;
  /** lúc phát (s) */
  t0: number;
  A: number;
  lam: number;
  v: number;
  /** số bước sóng trong bó (độ dài bó = cycles·λ) */
  cycles: number;
  /** tầm xa tối đa (m) */
  range: number;
  /** hệ số sát thương mỗi đỉnh trên 1 m biên độ (× công vũ khí) */
  dmgK: number;
  src: PacketSrc;
}

/** Khoảng [sau, trước] của bó sóng dọc trục lúc t (đã kẹp trong [0, range]); null = chưa phát / đã đi hết */
export function packetSpan(p: Packet, t: number): [number, number] | null {
  const front = p.v * (t - p.t0);
  if (front <= 0) return null;
  const back = front - p.cycles * p.lam;
  const a = Math.max(0, back);
  const b = Math.min(p.range, front);
  return a < b ? [a, b] : null;
}

export function packetAlive(p: Packet, t: number): boolean {
  return p.v * (t - p.t0) - p.cycles * p.lam < p.range;
}

/** Toạ độ dọc trục s và lệch ngang d (≥ 0) của điểm (x, z) so với bó sóng */
export function packetLocal(p: Packet, x: number, z: number): { s: number; d: number } {
  const rx = x - p.ox;
  const rz = z - p.oz;
  return { s: rx * p.dx + rz * p.dz, d: Math.abs(rx * p.dz - rz * p.dx) };
}

/** Pha θ = k·s − ω·(t − t₀) */
export function packetPhase(p: Packet, s: number, t: number): number {
  const k = TAU / p.lam;
  return k * s - k * p.v * (t - p.t0);
}

/** Điểm (x, z) có nằm trong bó sóng lúc t không */
export function packetCovers(p: Packet, x: number, z: number, t: number): boolean {
  const span = packetSpan(p, t);
  if (!span) return false;
  const { s, d } = packetLocal(p, x, z);
  return s >= span[0] && s <= span[1] && d <= p.A + LANE_PAD;
}

export interface Superpose {
  /** độ dời tức thời y = Σ Aᵢ·sin θᵢ */
  y: number;
  /** dy/dt = Σ −Aᵢ·ωᵢ·cos θᵢ */
  dy: number;
  /** biên độ tổng hợp |Σ Aᵢ·e^{iθᵢ}| (phasor) */
  amp: number;
  /** Σ Aᵢ (biên độ nếu mọi sóng cùng pha) */
  sumA: number;
  /** số bó đang phủ điểm này */
  n: number;
  /** hệ số sát thương trung bình theo biên độ */
  dmgK: number;
}

/** Chồng chập mọi bó sóng tại (x, z) lúc t */
export function superpose(ps: readonly Packet[], x: number, z: number, t: number): Superpose {
  let y = 0;
  let dy = 0;
  let re = 0;
  let im = 0;
  let sumA = 0;
  let n = 0;
  let kA = 0;
  for (const p of ps) {
    if (!packetCovers(p, x, z, t)) continue;
    const { s } = packetLocal(p, x, z);
    const th = packetPhase(p, s, t);
    const w = (TAU * p.v) / p.lam;
    y += p.A * Math.sin(th);
    dy += -p.A * w * Math.cos(th);
    re += p.A * Math.cos(th);
    im += p.A * Math.sin(th);
    sumA += p.A;
    kA += p.dmgK * p.A;
    n++;
  }
  return { y, dy, amp: Math.hypot(re, im), sumA, n, dmgK: sumA > 0 ? kA / sumA : 0 };
}

/** Biên độ tổng hợp của hai sóng cùng tần số lệch pha Δφ: √(A₁² + A₂² + 2A₁A₂·cos Δφ) */
export function resultantAmp(a1: number, a2: number, dphi: number): number {
  return Math.sqrt(Math.max(0, a1 * a1 + a2 * a2 + 2 * a1 * a2 * Math.cos(dphi)));
}

export type Interference = "single" | "constructive" | "destructive" | "partial";
export function classify(sp: Pick<Superpose, "amp" | "sumA" | "n">): Interference {
  if (sp.n < 2) return "single";
  if (sp.amp >= 0.8 * sp.sumA) return "constructive";
  if (sp.amp <= 0.3 * sp.sumA) return "destructive";
  return "partial";
}

/** Lệch pha (0..2π) của hai bó phát cùng chỗ cách nhau dtSec với chu kỳ T: Δφ = 2π·Δt/T */
export function phaseFromDelay(dtSec: number, T: number): number {
  const r = (dtSec / T) % 1;
  return (r < 0 ? r + 1 : r) * TAU;
}

/** Khoảng cách pha tới 0 (0..π) — 0 = cùng pha, π = ngược pha */
export function phaseGap(phi: number): number {
  const r = ((phi % TAU) + TAU) % TAU;
  return Math.min(r, TAU - r);
}

/** Đỉnh sóng vừa đi qua: dy/dt đổi dấu (cực trị của y) và |y| đủ lớn */
export function crestEvent(prevDy: number, dy: number, y: number): boolean {
  return prevDy !== 0 && dy !== 0 && Math.sign(prevDy) !== Math.sign(dy) && Math.abs(y) >= CREST_MIN;
}

/** Sát thương một lần đỉnh đi qua (× công vũ khí): K·|y|, tăng cường ×1,3 */
export function crestDamage(atk: number, sp: Pick<Superpose, "y" | "dmgK" | "amp" | "sumA" | "n">): number {
  const bonus = classify(sp) === "constructive" ? 1.3 : 1;
  return atk * sp.dmgK * Math.abs(sp.y) * bonus;
}

/**
 * Mô phỏng tất định một điểm (x, z) trong khoảng [t0, t1] với bước dt: đếm số đỉnh trúng + tổng |y| (dùng cho kiểm thử
 * và để cân sát thương). Giống hệt vòng lặp chạy mỗi khung hình trong game.
 */
export function simulatePoint(ps: readonly Packet[], x: number, z: number, t0: number, t1: number, dt = 1 / 60): { hits: number; sumY: number; maxY: number } {
  let prev = 0;
  let hits = 0;
  let sumY = 0;
  let maxY = 0;
  for (let t = t0; t <= t1; t += dt) {
    const sp = superpose(ps, x, z, t);
    if (sp.n === 0) {
      prev = 0;
      continue;
    }
    if (crestEvent(prev, sp.dy, sp.y)) {
      hits++;
      sumY += Math.abs(sp.y);
      maxY = Math.max(maxY, Math.abs(sp.y));
    }
    prev = sp.dy;
  }
  return { hits, sumY, maxY };
}

/** Bó sóng "Sóng dừng": cặp bó ngược chiều giữa người chơi và vách cách D (m) */
export function standingPair(id: number, ox: number, oz: number, dx: number, dz: number, t0: number, A: number, lam: number, D: number, dmgK: number, cycles = 5): [Packet, Packet] {
  const base = { A, lam, v: WAVE_V, cycles, dmgK, src: "skill" as const };
  // bó phản xạ xuất phát từ vách cùng lúc → hai bó gặp nhau ở giữa và chồng thành sóng dừng (nút cách nhau λ/2)
  return [
    { id, ox, oz, dx, dz, t0, range: D, ...base },
    { id: id + 1, ox: ox + dx * D, oz: oz + dz * D, dx: -dx, dz: -dz, t0, range: D, ...base },
  ];
}
