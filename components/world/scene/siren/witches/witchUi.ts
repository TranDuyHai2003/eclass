"use client";
/**
 * Trạng thái HUD của phù thuỷ hoạ âm đang hoạt động (zustand, cập nhật thưa ≤ 8 lần/s — không setState mỗi khung).
 * Một trận một lúc; cùng khuôn với bosses/bossStore.ts nhưng riêng cho kết giới phù thuỷ của Mê cung Hoạ âm.
 */
import { create } from "zustand";
import type { Stage } from "@/lib/world/witchGoiXepIm";

export interface WitchUi {
  on: boolean;
  stage: Stage;
  n: number;
  prevN: number;
  phase: number;
  hp: number;
  maxHp: number;
  /** đòn đang báo trước / đánh (slam / whip) hoặc null */
  atk: string | null;
  /** đếm lùi (phách) */
  count: number;
  /** tiến độ may từng nút trong 0…1 (tối đa 3) */
  pins: [number, number, number];
  /** chiều dài vách (m) — để HUD ghi L */
  L: number;
}

export const useWitchUi = create<WitchUi>(() => ({ on: false, stage: "dormant", n: 2, prevN: 2, phase: 1, hp: 1, maxHp: 1, atk: null, count: 0, pins: [0, 0, 0], L: 12 }));
