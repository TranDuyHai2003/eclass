"use client";
/**
 * Bay lượn tự do (sân Bất Khả mở ra vũ trụ). Trên không bấm nhảy → giang cánh; khi cảnh cho phép bay, tàu lượn
 * không chỉ rơi chậm mà BAY: hướng nhìn quyết định leo / lao (lib/world/impCosmos → soarVertical), tốc độ có quán tính,
 * chạy (Shift) = tăng tốc, bay qua vòng sáng = luồng đẩy. Player đọc / ghi FLIGHT mỗi khung hình; HUD đọc useFlight (~6 lần/giây).
 */
import * as THREE from "three";
import { create } from "zustand";

export const FLIGHT = {
  /** cảnh hiện tại cho phép bay (Impossible đặt theo không gian: chỉ ngoài sân, không trong bốt) */
  enabled: false,
  /** vận tốc ngang hiện tại (m/s) */
  vel: new THREE.Vector3(),
  /** luồng đẩy từ vòng bay: hết hạn lúc boostUntil (ms) */
  boostUntil: 0,
  /** độ nghiêng thân / cánh hiện tại (làm mượt) */
  lean: 0,
  bank: 0,
};

export const useFlight = create<{ enabled: boolean; soaring: boolean; alt: number; spd: number; boost: boolean }>(() => ({ enabled: false, soaring: false, alt: 0, spd: 0, boost: false }));

/** Đường đua vòng sáng: vòng kế tiếp, thời điểm xuất phát, kỷ lục (lưu máy) */
const BEST_KEY = "world.imp.ringBest";
function loadBest(): number | null {
  try {
    const v = Number(localStorage.getItem(BEST_KEY));
    return v > 0 ? v : null;
  } catch {
    return null;
  }
}
export const useRings = create<{ next: number; passed: number; total: number; startedAt: number; best: number | null; finishedAt: number; lastTime: number }>(() => ({
  next: 0,
  passed: 0,
  total: 0,
  startedAt: 0,
  best: typeof window === "undefined" ? null : loadBest(),
  finishedAt: 0,
  lastTime: 0,
}));
export function saveBest(ms: number) {
  const best = useRings.getState().best;
  if (best === null || ms < best) {
    useRings.setState({ best: ms });
    try {
      localStorage.setItem(BEST_KEY, String(Math.round(ms)));
    } catch {}
    return true;
  }
  return false;
}
