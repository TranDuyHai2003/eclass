/**
 * Trạng thái chuyển cảnh dùng chung giữa các màn trung gian — để lỗ sâu → màn chờ → thẻ chương nối liền thành MỘT chuyển cảnh.
 *  travelTo / travelEnd: đang bay trong lỗ sâu (WormholeTravel tự đặt / xoá)
 *  load: màn chờ đang "lên dây" (armed: chưa quyết hiện hay không) / đang hiện (shown) / rảnh (idle)
 */
import { create } from "zustand";

export type LoadPhase = "idle" | "armed" | "shown";
export const useTransit = create<{ travelTo: string | null; travelEnd: number; load: LoadPhase }>(() => ({
  travelTo: null,
  travelEnd: 0,
  load: "idle",
}));
