"use client";
/**
 * Ống nhòm: góc nhìn thứ nhất từ đầu nhân vật, phóng ×2–×16 (FOV = 45° / zoom, chuyển mượt), độ nhạy xoay giảm theo zoom,
 * nhãn địa danh ở xa vẫn hiện theo khoảng cách hiệu dụng (d / zoom), nhận diện mục tiêu giữa tâm ngắm, đo khoảng cách bằng tia.
 */
import { create } from "zustand";
import { useWorld } from "./store";

export const ZOOM_MIN = 2;
export const ZOOM_MAX = 16;
export const useScope = create<{ on: boolean; zoom: number; target: string | null; dist: number | null }>(() => ({ on: false, zoom: 4, target: null, dist: null }));
/** Zoom thực (đã làm mượt) — Player cập nhật mỗi khung hình; 1 khi không dùng ống nhòm */
export const SCOPE = { zoom: 1 };

export function toggleScope(force?: boolean) {
  const on = force ?? !useScope.getState().on;
  if (on && useWorld.getState().overlay) return;
  useScope.setState({ on, target: null, dist: null });
  if (on) useWorld.setState({ camPitch: Math.min(0.2, Math.max(-0.4, useWorld.getState().camPitch - 0.2)) });
}
export function zoomBy(factor: number) {
  const z = useScope.getState().zoom;
  useScope.setState({ zoom: Math.min(ZOOM_MAX, Math.max(ZOOM_MIN, z * factor)) });
}
