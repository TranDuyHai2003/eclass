/**
 * Hầm Bổ đề · Phòng V — Dàn hợp xướng Fourier (Ada Lovelace). Logic thuần.
 *
 * Ý toán: mọi sóng tuần hoàn là tổng các sóng sin (Fourier). Sóng vuông chỉ có hoạ âm LẺ (1, 1/3, 1/5, …) và
 * các góc luôn vọt lố ~9 % (hiện tượng Gibbs). Sóng ↔ phổ là hai cách nhìn cùng một vật.
 *
 * Luật chơi: mỗi ống k có một bệ; ĐỨNG trên bệ thì ống mới cất tiếng và mới xoay được núm biên độ a_k ∈ [−1, 1].
 * Sai số tính trong không gian hệ số (chính xác vì các sin trực giao):
 *   err = √Σ(a_k − t_k)² / √Σ t_k²      (ống không ai đứng = câm = a_k tính 0)
 * Xong màn khi err ≤ 0,10 giữ 2 giây.
 *  S1 "Lên dây": ống 1…N, một hỗn hợp đơn giản.
 *  S2 "Những ống lẻ": ống 1, 3, 5, 7 — sóng vuông.
 *  S3 "Nhạc trưởng": sóng răng cưa (1, −½, ⅓): CHỈ đứng trên bục Nhạc trưởng mới thấy phổ (cột hệ số);
 *     người thổi ống chỉ thấy hình sóng → Nhạc trưởng chỉ huy bằng ping giá trị (+, −, 0, đảo dấu).
 */
import { clamp } from "./geom";

export const F_STAGES = 3;
export const ERR_OK = 0.1;
export const F_HOLD = 2000;
/** bán kính vòng bệ ống, bục nhạc trưởng */
export const PIPE_R = 7.2;
export const PODIUM = { x: 0, z: 8.2, r: 1.2 };
export const PEDESTAL_R = 1.05;

export interface FState {
  sg: number;
  /** số hiệu hoạ âm của từng ống */
  ks: number[];
  /** biên độ đích (ẩn với người thổi ống ở màn 3) */
  tg: number[];
  /** biên độ đang đặt trên núm */
  amp: number[];
  /** ống đang có người đứng (đang kêu) */
  on: boolean[];
  /** có bục Nhạc trưởng (màn 3) */
  cond: boolean;
  err: number;
  hold: number;
  turns: number;
}

const T1 = [1, 1 / 2, -1 / 3, 1 / 4];

export function stageDef(stage: number, n: number): { ks: number[]; tg: number[]; cond: boolean } {
  const N = clamp(n, 2, 4);
  if (stage === 0) {
    const ks = Array.from({ length: N }, (_, i) => i + 1);
    return { ks, tg: T1.slice(0, N), cond: false };
  }
  if (stage === 1) {
    const ks = [1, 3, 5, 7].slice(0, N);
    return { ks, tg: ks.map((k) => 1 / k), cond: false };
  }
  const ks = N >= 4 ? [1, 2, 3] : Array.from({ length: N }, (_, i) => i + 1);
  return { ks, tg: ks.map((k) => (k % 2 ? 1 : -1) / k), cond: true };
}
export function fInit(stage: number, n: number): FState {
  const d = stageDef(stage, n);
  return { sg: stage, ks: d.ks, tg: d.tg, amp: d.ks.map(() => 0), on: d.ks.map(() => false), cond: d.cond, err: 1, hold: 0, turns: 0 };
}

/** Nấc của núm: 0, ±1/k (k = 1…8) và ±m/12 */
export const DETENTS: number[] = (() => {
  const s = new Set<number>([0]);
  for (let k = 1; k <= 8; k++) s.add(Math.round((1 / k) * 1e6) / 1e6);
  for (let m = 1; m <= 12; m++) s.add(Math.round((m / 12) * 1e6) / 1e6);
  const pos = [...s].sort((a, b) => a - b);
  return [...pos.filter((v) => v > 0).map((v) => -v).reverse(), ...pos];
})();
export function snap(v: number): number {
  if (!Number.isFinite(v)) return 0;
  const c = clamp(v, -1, 1);
  let best = 0;
  for (const d of DETENTS) if (Math.abs(d - c) < Math.abs(best - c)) best = d;
  return best;
}
/** Bước sang nấc kế bên (dir = +1 / −1) */
export function nudge(v: number, dir: number): number {
  const i = DETENTS.indexOf(snap(v));
  return DETENTS[clamp(i + (dir > 0 ? 1 : -1), 0, DETENTS.length - 1)];
}

export function errOf(amp: number[], tg: number[]): number {
  let num = 0;
  let den = 0;
  for (let i = 0; i < tg.length; i++) {
    num += (amp[i] - tg[i]) ** 2;
    den += tg[i] ** 2;
  }
  return Math.sqrt(num) / Math.sqrt(den || 1);
}
/** Biên độ thực đang kêu (ống không ai đứng = 0) */
export const sounding = (st: FState) => st.amp.map((a, i) => (st.on[i] ? a : 0));

/** Giá trị sóng tại pha x ∈ [0, 2π): Σ a_k sin(k x) */
export function sample(amps: number[], ks: number[], x: number): number {
  let s = 0;
  for (let i = 0; i < ks.length; i++) s += amps[i] * Math.sin(ks[i] * x);
  return s;
}

/** Bệ của ống i (vòng cung phía bắc giếng, nhìn về tâm) */
export function pedestal(st: { ks: number[] }, i: number): { x: number; z: number } {
  const m = st.ks.length;
  const span = Math.min(Math.PI * 0.9, (m - 1) * 0.55);
  const a = -Math.PI / 2 + (m > 1 ? -span / 2 + (span * i) / (m - 1) : 0);
  return { x: Math.cos(a) * PIPE_R, z: Math.sin(a) * PIPE_R };
}
export function pedestalAt(st: { ks: number[] }, x: number, z: number): number {
  for (let i = 0; i < st.ks.length; i++) {
    const p = pedestal(st, i);
    if (Math.hypot(x - p.x, z - p.z) < PEDESTAL_R) return i;
  }
  return -1;
}
export const onPodium = (x: number, z: number) => Math.hypot(x - PODIUM.x, z - PODIUM.z) < PODIUM.r;

export function fTick(st: FState, pos: ([number, number, number] | null)[], dt: number) {
  st.on = st.ks.map(() => false);
  for (const p of pos) {
    if (!p) continue;
    const i = pedestalAt(st, p[0], p[2]);
    if (i >= 0) st.on[i] = true;
  }
  st.err = Math.round(errOf(sounding(st), st.tg) * 1000) / 1000;
  st.hold = st.err <= ERR_OK ? st.hold + dt * 1000 : 0;
}
export const fClear = (st: FState) => st.hold >= F_HOLD;
export const fProgress = (st: FState) => Math.round(clamp(1 - st.err, 0, 1) * 20) / 20;

/** Xoay núm: chỉ khi đứng trên đúng bệ ống đó */
export function fDial(st: FState, i: number, v: number, px: number, pz: number): boolean {
  if (!Number.isInteger(i) || i < 0 || i >= st.ks.length) return false;
  if (pedestalAt(st, px, pz) !== i) return false;
  const nv = snap(v);
  if (nv === st.amp[i]) return false;
  st.amp[i] = nv;
  st.turns++;
  return true;
}

/** Mặt đất phòng Hợp xướng: sàn tròn r 12, giếng giữa r 3 (lan can) */
export const CHOIR_R = 12;
export function fBlocked(x: number, z: number): boolean {
  const r = Math.hypot(x, z);
  return r > CHOIR_R - 0.5 || r < 3.2;
}
