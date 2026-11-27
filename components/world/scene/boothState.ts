/** Trạng thái chung của Bốt Siêu khối: đích đến hiện tại + chuyến du hành "The Fold" (dùng bởi phòng, vũ trụ, bảng điều khiển) */
import { create } from "zustand";
import { sfx } from "@/lib/world/sfx";

type L = { en: string; vi: string };
export type Dest = "solar" | "blackhole" | "lorenz" | "poincare" | "tesseract";
export const DESTS: { id: Dest; name: L; idea: L }[] = [
  { id: "solar", name: { en: "The Solar System", vi: "Hệ Mặt Trời" }, idea: { en: "Kepler's third law: T² ∝ a³ — outer planets crawl, inner ones race.", vi: "Định luật Kepler III: T² ∝ a³ — hành tinh xa bò chậm, hành tinh gần chạy nhanh." } },
  { id: "blackhole", name: { en: "Event Horizon", vi: "Chân trời Sự kiện" }, idea: { en: "Gravity bends light into a ring around the shadow.", vi: "Trọng lực bẻ cong ánh sáng thành vòng quanh vùng tối." } },
  { id: "lorenz", name: { en: "The Lorenz Storm", vi: "Cơn bão Lorenz" }, idea: { en: "Deterministic, yet unpredictable: the butterfly of chaos.", vi: "Tất định mà không đoán trước được: con bướm của hỗn loạn." } },
  { id: "poincare", name: { en: "Hyperbolic Sky", vi: "Bầu trời Hyperbol" }, idea: { en: "Infinitely many triangles fit in a disc — space curves the other way.", vi: "Vô số tam giác vừa trong một hình tròn — không gian cong theo chiều ngược lại." } },
  { id: "tesseract", name: { en: "Tesseract Space", vi: "Không gian Siêu khối" }, idea: { en: "A 4-D cube casting a 3-D shadow as it turns.", vi: "Khối lập phương 4 chiều đổ bóng 3 chiều khi xoay." } },
];

export const useBooth = create<{ dest: Dest; travelAt: number; to: Dest | null }>(() => ({ dest: "solar", travelAt: 0, to: null }));
/** "The Fold": 4,8 s — cửa chớp mống mắt đóng kín 0,35 s quanh mốc 50 % để đổi vũ trụ */
export const TRAVEL_MS = 4800;
export const IRIS = { closeAt: 0.4, shutAt: 0.47, openAt: 0.55, doneAt: 0.66 };
export function travelTo(to: Dest) {
  const s = useBooth.getState();
  if (s.to || to === s.dest) return;
  useBooth.setState({ to, travelAt: performance.now() });
  sfx.chime(5);
  sfx.fold(TRAVEL_MS / 1000);
}
/** Tiến độ chuyến du hành 0..1 (−1 khi không du hành) */
export function travelK(now = performance.now()) {
  const s = useBooth.getState();
  return s.to ? Math.min(1, (now - s.travelAt) / TRAVEL_MS) : -1;
}
/** Độ đóng của cửa chớp 0 (mở) … 1 (kín) theo tiến độ */
export function irisAt(k: number) {
  if (k < IRIS.closeAt || k > IRIS.doneAt) return 0;
  if (k < IRIS.shutAt) return (k - IRIS.closeAt) / (IRIS.shutAt - IRIS.closeAt);
  if (k < IRIS.openAt) return 1;
  return 1 - (k - IRIS.openAt) / (IRIS.doneAt - IRIS.openAt);
}

// DEV: móc kiểm thử trình duyệt (du hành không cần bấm thẻ) — không có ở bản production
if (typeof window !== "undefined" && process.env.NODE_ENV !== "production") {
  (window as unknown as { __booth: unknown }).__booth = { travelTo, useBooth, travelK };
}
