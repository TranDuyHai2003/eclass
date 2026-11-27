/**
 * Bảng màu NGÀY ↔ ĐÊM theo giờ (nghiên cứu Codex 2026-11, preset khởi đầu cho quảng trường 21°B):
 * mỗi mốc giờ: màu + mức nắng, ánh môi trường, trời thiên đỉnh / chân trời, sương, phơi sáng. Nội suy tuyến tính, vòng 23h → 0h.
 * Thuần (không three) để kiểm thử.
 */
export type DayKey = {
  h: number;
  sun: string;
  sunK: number;
  amb: string;
  ambK: number;
  zen: string;
  hor: string;
  fog: string;
  exp: number;
};

export const DAY_KEYS: DayKey[] = [
  { h: 0, sun: "#FFC18C", sunK: 0, amb: "#829BDF", ambK: 0.12, zen: "#101831", hor: "#2C3D66", fog: "#2B3B60", exp: 1.08 },
  { h: 5, sun: "#FFC18C", sunK: 0, amb: "#8E9FD8", ambK: 0.14, zen: "#182345", hor: "#645879", fog: "#54546F", exp: 1.04 },
  { h: 6.5, sun: "#FFC18C", sunK: 0.38, amb: "#B6CBF4", ambK: 0.29, zen: "#577FD0", hor: "#FFD0B1", fog: "#E5BFB7", exp: 0.99 },
  { h: 9, sun: "#FFF0D7", sunK: 0.85, amb: "#BCD9FF", ambK: 0.42, zen: "#4E91DF", hor: "#CBE8FF", fog: "#C6DEF2", exp: 0.96 },
  { h: 12, sun: "#FFF5E6", sunK: 1, amb: "#C7E1FF", ambK: 0.48, zen: "#4289DE", hor: "#D5EEFF", fog: "#CFE7F5", exp: 0.93 },
  { h: 17, sun: "#FFC890", sunK: 0.62, amb: "#BFC3F2", ambK: 0.36, zen: "#5F7FD0", hor: "#FFB48A", fog: "#EDB6A2", exp: 0.97 },
  { h: 18.5, sun: "#FFA070", sunK: 0, amb: "#B4A2E6", ambK: 0.27, zen: "#34479A", hor: "#FF9E7E", fog: "#C68C98", exp: 1.03 },
  { h: 20, sun: "#FFA070", sunK: 0, amb: "#8EA7E8", ambK: 0.14, zen: "#162144", hor: "#3A4D79", fog: "#35466B", exp: 1.07 },
  { h: 23, sun: "#FFA070", sunK: 0, amb: "#849DE1", ambK: 0.12, zen: "#111A34", hor: "#2D3F68", fog: "#2C3D62", exp: 1.08 },
];

const hex = (s: string): [number, number, number] => [parseInt(s.slice(1, 3), 16) / 255, parseInt(s.slice(3, 5), 16) / 255, parseInt(s.slice(5, 7), 16) / 255];
const lerp3 = (a: [number, number, number], b: [number, number, number], t: number): [number, number, number] => [a[0] + (b[0] - a[0]) * t, a[1] + (b[1] - a[1]) * t, a[2] + (b[2] - a[2]) * t];

export type DaySample = {
  sun: [number, number, number];
  sunK: number;
  amb: [number, number, number];
  ambK: number;
  zen: [number, number, number];
  hor: [number, number, number];
  fog: [number, number, number];
  exp: number;
};

/** giá trị tại giờ h ∈ [0, 24) (màu sRGB 0…1) */
export function sampleDay(h: number, keys = DAY_KEYS): DaySample {
  const H = ((h % 24) + 24) % 24;
  let i = keys.length - 1;
  for (let k = 0; k < keys.length; k++) if (keys[k].h <= H) i = k;
  const a = keys[i];
  const b = keys[(i + 1) % keys.length];
  const span = (b.h - a.h + 24) % 24 || 24;
  const t = ((H - a.h + 24) % 24) / span;
  return {
    sun: lerp3(hex(a.sun), hex(b.sun), t),
    sunK: a.sunK + (b.sunK - a.sunK) * t,
    amb: lerp3(hex(a.amb), hex(b.amb), t),
    ambK: a.ambK + (b.ambK - a.ambK) * t,
    zen: lerp3(hex(a.zen), hex(b.zen), t),
    hor: lerp3(hex(a.hor), hex(b.hor), t),
    fog: lerp3(hex(a.fog), hex(b.fog), t),
    exp: a.exp + (b.exp - a.exp) * t,
  };
}

/** giờ địa phương (thập phân) của múi giờ tz (Việt Nam UTC+7) */
export function localHour(d: Date, tz = 7): number {
  return (((d.getUTCHours() + d.getUTCMinutes() / 60 + d.getUTCSeconds() / 3600 + tz) % 24) + 24) % 24;
}

/** đèn đường: 0 ban ngày → 1 khi mặt trời dưới −2° (bật đồng loạt qua chạng vạng −6°…−2° — Codex) */
export function lampFactor(sunElevationDeg: number): number {
  const t = Math.min(1, Math.max(0, (sunElevationDeg - -6) / (-2 - -6)));
  return 1 - t * t * (3 - 2 * t);
}

/** ánh lửa nhấp nháy (cùng tín hiệu cho ngọn lửa và vệt sáng trên sàn) */
export function fireFlicker(t: number): number {
  return 0.9 + 0.08 * Math.sin(13.2 * t) + 0.04 * Math.sin(35.8 * t);
}
