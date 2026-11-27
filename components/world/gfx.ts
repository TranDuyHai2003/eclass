"use client";
/**
 * Cài đặt đồ hoạ & hiệu ứng (lưu localStorage). Bốn mức sẵn + chỉnh từng mục:
 *  scale      độ phân giải render (nhân với DPR của mức chất lượng) — điều chỉnh rẻ nhất cho máy yếu
 *  aa         khử răng cưa SMAA
 *  bloom      quầng sáng HDR (mipmap blur)
 *  ao         che khuất môi trường thời gian thực (N8AO — SSAO thế hệ mới, có khử nhiễu)
 *  reflections  phản chiếu mặt phẳng (sàn gương Hư Không)
 *  godrays    tia sáng thể tích từ nguồn sáng mạnh (hố đen)
 *  dof        độ sâu trường ảnh kiểu bokeh (nền nhoà, nhân vật nét)
 *  shadows    bóng đổ thời gian thực (shadow map PCF mềm, khung bóng bám theo người chơi)
 *  grain      hạt phim + quang sai màu (chỉ ở phong cách siêu thực)
 *  vfx        mật độ hiệu ứng hạt: 0 thấp · 1 vừa · 2 cao
 *  fps        hiện bộ đếm khung hình
 */
import { create } from "zustand";
import { useWorld, type Quality } from "./store";

export type Preset = "low" | "medium" | "high" | "ultra" | "custom";
export interface Gfx {
  preset: Preset;
  scale: number;
  aa: boolean;
  bloom: boolean;
  ao: boolean;
  reflections: boolean;
  godrays: boolean;
  dof: boolean;
  shadows: boolean;
  grain: boolean;
  vfx: 0 | 1 | 2;
  fps: boolean;
}
type Opts = Omit<Gfx, "preset" | "fps">;
export const PRESETS: Record<Exclude<Preset, "custom">, Opts> = {
  low: { scale: 0.75, aa: false, bloom: false, ao: false, reflections: false, godrays: false, dof: false, shadows: false, grain: false, vfx: 0 },
  medium: { scale: 0.9, aa: true, bloom: true, ao: false, reflections: false, godrays: false, dof: false, shadows: false, grain: true, vfx: 1 },
  // AO (N8AO) đắt nhất sau bóng đổ — chỉ bật ở mức Siêu (đo: GPU tích hợp tụt từ ~25 → ~2 FPS khi bật ở chất lượng "medium")
  // tia sáng thể tích thêm một lượt toàn màn hình — chỉ ở mức Siêu
  high: { scale: 1, aa: true, bloom: true, ao: false, reflections: true, godrays: false, dof: false, shadows: false, grain: true, vfx: 2 },
  ultra: { scale: 1, aa: true, bloom: true, ao: true, reflections: true, godrays: true, dof: true, shadows: true, grain: true, vfx: 2 },
};
const PRESET_QUALITY: Record<Exclude<Preset, "custom">, Quality> = { low: "low", medium: "mid", high: "high", ultra: "high" };
const KEY = "world.gfx";

function initial(): Gfx {
  if (typeof window !== "undefined") {
    try {
      const v = JSON.parse(localStorage.getItem(KEY) || "null");
      if (v && typeof v === "object" && typeof v.preset === "string") return { ...PRESETS.medium, fps: false, ...v } as Gfx;
    } catch {}
  }
  // Mặc định theo máy: điện thoại / máy yếu → Thấp; còn lại → Vừa (Cao / Siêu bật tay)
  const q = typeof window === "undefined" ? "mid" : useWorld.getState().quality;
  const p = q === "low" ? "low" : "medium";
  return { preset: p, ...PRESETS[p], fps: false };
}

export const useGfx = create<Gfx>(() => initial());

function save() {
  try {
    localStorage.setItem(KEY, JSON.stringify(useGfx.getState()));
  } catch {}
}
export function applyPreset(p: Exclude<Preset, "custom">) {
  useGfx.setState({ preset: p, ...PRESETS[p] });
  useWorld.setState({ quality: PRESET_QUALITY[p] });
  save();
}
export function setGfx(patch: Partial<Gfx>) {
  useGfx.setState({ ...patch, preset: patch.preset ?? (Object.keys(patch).every((k) => k === "fps") ? useGfx.getState().preset : "custom") });
  save();
}
/** Hệ số mật độ hiệu ứng hạt theo cài đặt */
export function vfxScale(): number {
  return [0.35, 0.65, 1][useGfx.getState().vfx];
}
