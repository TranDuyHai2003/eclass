"use client";
/**
 * VFX-AAA — đồng hồ hiệu ứng DÙNG CHUNG + tuỳ chọn giảm chuyển động (không phụ thuộc module nào khác → không vòng import).
 *  • fxNow(): thời gian hiệu ứng (ms). window.__fxFreeze(ms) (dev) dừng đồng hồ sau ms → MỌI hiệu ứng (phép, tia, khói, sóng
 *    xung kích hậu kỳ) cùng đứng ở một pha để chụp ảnh / so sánh; fxFrozen() → dt = 0 cho các mô phỏng hạt.
 *  • reduceMotion(): theo localStorage "world.reduceMotion" (on / off) hoặc prefers-reduced-motion của hệ điều hành;
 *    fxReducedMotion() đọc lại tối đa 1 lần / giây (gọi được mỗi khung).
 *  • window.__vfxSeed(n) (dev): đặt lại hạt giống của dòng ngẫu nhiên hiệu ứng (lib/world/vfxRng.ts) → ảnh chụp lặp lại được.
 */
import { vfxSeed } from "@/lib/world/vfxRng";

export const FX_FREEZE = { at: 0 };

/** thời gian hiệu ứng (ms, cùng gốc performance.now) — đứng yên khi đang đóng băng */
export function fxNow(): number {
  const t = performance.now();
  return FX_FREEZE.at > 0 ? Math.min(FX_FREEZE.at, t) : t;
}
/** đang đóng băng (dev) → các mô phỏng dùng dt = 0 */
export function fxFrozen(): boolean {
  return FX_FREEZE.at > 0 && performance.now() >= FX_FREEZE.at;
}

export const REDUCE_MOTION_KEY = "world.reduceMotion";
export function reduceMotion(): boolean {
  if (typeof window === "undefined") return false;
  try {
    const v = localStorage.getItem(REDUCE_MOTION_KEY);
    if (v === "on") return true;
    if (v === "off") return false;
  } catch {}
  return !!window.matchMedia?.("(prefers-reduced-motion: reduce)").matches;
}
const RM = { at: -1e9, on: false };
/** giảm chuyển động (đọc lại ≤ 1 lần / giây) — tắt khung chấn / tách màu / rung mạnh, giữ nguyên hình dạng + báo trước */
export function fxReducedMotion(): boolean {
  const t = performance.now();
  if (t - RM.at > 1000) {
    RM.at = t;
    RM.on = reduceMotion();
  }
  return RM.on;
}

if (typeof window !== "undefined" && process.env.NODE_ENV !== "production") {
  const w = window as unknown as Record<string, unknown>;
  w.__fxFreeze = (ms = 0) => (FX_FREEZE.at = ms > 0 ? performance.now() + ms : 0);
  w.__vfxSeed = (n = 1) => vfxSeed(n);
}
