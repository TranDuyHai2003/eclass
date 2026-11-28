/**
 * Hầm Bổ đề — Sảnh Ngưỡng cửa (hướng dẫn, ~90 s) và Cỗ máy Định lý (màn kết rút gọn). Logic thuần.
 *
 * Ngưỡng cửa, 3 nhịp:
 *  0. Mọi người đứng lên một ấn ký (mỗi ấn ký một người) → "ai cũng quan trọng".
 *  1. Hai dây chuông cách nhau 14 m phải kéo trong vòng 0,5 s → học nút "Đếm 3-2-1".
 *  2. Phiến đá ẩn: CHỈ người cầm đèn (ghế ●) thấy → phải PING cho người khác tới đứng → học ping + thông tin bất đối xứng.
 * Cỗ máy Định lý (rút gọn): N phiến quanh khối hai mươi mặt vỡ; mọi phiến có người đứng 3 s liền → Định lý phục hồi.
 */
import { clamp, rng } from "./geom";

export const HALL_R = 9;
export const SIGIL_R = 3.4;
export const ROPES: [number, number][] = [
  [-7, 0],
  [7, 0],
];
export const RING_WINDOW = 500;
export const T_BEATS = 3;

export interface TState {
  beat: number;
  /** ghế đang đứng trên ấn ký i (−1 = trống) */
  sig: number[];
  ring: [number, number];
  plate: [number, number];
  /** ghế đang đứng trên phiến ẩn */
  on: number;
  hold: number;
}

export function sigil(n: number, i: number): [number, number] {
  const a = (i / n) * Math.PI * 2 + Math.PI / 2;
  return [Math.cos(a) * SIGIL_R, Math.sin(a) * SIGIL_R];
}
export function tInit(n: number, seed: number): TState {
  const r = rng(seed ^ 0x51a7e);
  // phiến ẩn: nửa phía bắc, xa ấn ký và dây chuông
  const a = -Math.PI / 2 + (r() - 0.5) * 1.6;
  const d = 5.2 + r() * 1.6;
  return { beat: 0, sig: Array.from({ length: n }, () => -1), ring: [0, 0], plate: [Math.cos(a) * d, Math.sin(a) * d], on: -1, hold: 0 };
}

export function tTick(st: TState, pos: ([number, number, number] | null)[], dt: number) {
  const n = st.sig.length;
  st.sig = st.sig.map(() => -1);
  st.on = -1;
  pos.forEach((p, seat) => {
    if (!p || p[1] > 1.5) return;
    for (let i = 0; i < n; i++) {
      const [x, z] = sigil(n, i);
      if (Math.hypot(p[0] - x, p[2] - z) < 0.95 && st.sig[i] < 0) st.sig[i] = seat;
    }
    if (seat !== 0 && Math.hypot(p[0] - st.plate[0], p[2] - st.plate[1]) < 1.0) st.on = seat;
  });
  if (st.beat === 0) {
    st.hold = st.sig.every((s) => s >= 0) ? st.hold + dt * 1000 : 0;
    if (st.hold >= 800) {
      st.beat = 1;
      st.hold = 0;
    }
  } else if (st.beat === 2) {
    st.hold = st.on > 0 ? st.hold + dt * 1000 : 0;
    if (st.hold >= 800) {
      st.beat = 3;
      st.hold = 0;
    }
  }
}
/** Kéo dây chuông i: phải đứng sát dây (≤ 1,6 m) */
export function tRing(st: TState, i: number, px: number, pz: number, now: number): boolean {
  if (st.beat !== 1 || (i !== 0 && i !== 1)) return false;
  if (Math.hypot(px - ROPES[i][0], pz - ROPES[i][1]) > 1.6) return false;
  st.ring[i] = now;
  const other = st.ring[1 - i];
  if (other && Math.abs(now - other) <= RING_WINDOW) st.beat = 2;
  return true;
}
export const ropeAt = (x: number, z: number) => ROPES.findIndex(([rx, rz]) => Math.hypot(x - rx, z - rz) < 1.6);
export const tClear = (st: TState) => st.beat >= 3;
export const tProgress = (st: TState) => clamp(st.beat / 3, 0, 1);
export function tBlocked(x: number, z: number): boolean {
  return Math.hypot(x, z) > HALL_R - 0.4;
}

// ───────────── Cỗ máy Định lý (màn kết rút gọn) ─────────────
export const ENGINE_R = 5.2;
export const FIN_HOLD = 3000;
export interface EState {
  occ: number[];
  hold: number;
}
export function plate(n: number, i: number): [number, number] {
  const a = (i / n) * Math.PI * 2 + Math.PI / 2;
  return [Math.cos(a) * ENGINE_R, Math.sin(a) * ENGINE_R];
}
export function eInit(n: number): EState {
  return { occ: Array.from({ length: n }, () => -1), hold: 0 };
}
export function eTick(st: EState, pos: ([number, number, number] | null)[], dt: number) {
  const n = st.occ.length;
  st.occ = st.occ.map(() => -1);
  pos.forEach((p, seat) => {
    if (!p) return;
    for (let i = 0; i < n; i++) {
      const [x, z] = plate(n, i);
      if (Math.hypot(p[0] - x, p[2] - z) < 1.0 && st.occ[i] < 0) st.occ[i] = seat;
    }
  });
  st.hold = st.occ.every((s) => s >= 0) ? st.hold + dt * 1000 : 0;
}
export const eClear = (st: EState) => st.hold >= FIN_HOLD;
export const eProgress = (st: EState) => Math.round((st.occ.filter((s) => s >= 0).length / st.occ.length) * 20) / 20;
export const ENGINE_FLOOR_R = 11;
