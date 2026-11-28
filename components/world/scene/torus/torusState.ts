"use client";
/**
 * Quần đảo Xuyến — trạng thái cảnh: tiến trình (lưu localStorage, mỗi trình duyệt), lời gợi ý, máu Mắt Canh, quả cầu năng lượng.
 * Trạng thái logic có MỘT bản; mọi phần hình (9 ô) chỉ đọc từ đây.
 */
import { create } from "zustand";
import { NO_PROGRESS, SENTINEL, parseProgress, type TorusProgress } from "@/lib/world/torusWorld";

const KEY = "world.torus";

export type TorusHint = { vi: string; en: string; at: number; kind: "info" | "aha" | "warn" };

export const useTorus = create<
  TorusProgress & {
    hint: TorusHint | null;
    /** số lần bắn vào vách Hộp Chuông / khiên Mắt Canh (gợi ý dần) */
    boxMiss: number;
    shieldMiss: number;
    /** máu Mắt Canh (HUD) */
    wardenHp: number;
    /** lúc rung Chuông / hạ Mắt Canh (hiệu ứng) */
    bellAt: number;
    /** đang giương Cung Vòng và đường bay sẽ trúng lưng mình */
    aimSelf: boolean;
    /** đường bay dự đoán kết thúc ở đâu (null = không giương cung) */
    aimEnd: "self" | "bell" | "back" | "shield" | "wall" | "ground" | "time" | null;
    /** bảng giải thích đang mở (Bia Xuyến / Bia Bốn Góc) */
    panel: "stone" | "corner" | null;
  }
>(() => ({ ...NO_PROGRESS, hint: null, boxMiss: 0, shieldMiss: 0, wardenHp: SENTINEL.hp, bellAt: -1e9, aimSelf: false, aimEnd: null, panel: null }));

export function loadTorus() {
  let raw: string | null = null;
  try {
    raw = localStorage.getItem(KEY);
  } catch {
    /* chế độ riêng tư */
  }
  const p = parseProgress(raw);
  useTorus.setState({ ...p, hint: null, boxMiss: 0, shieldMiss: 0, wardenHp: p.warden ? 0 : SENTINEL.hp, aimSelf: false, aimEnd: null, panel: null });
}

export function markTorus(k: keyof TorusProgress): boolean {
  const s = useTorus.getState();
  if (s[k]) return false;
  useTorus.setState({ [k]: true } as Partial<TorusProgress>);
  const st = useTorus.getState();
  try {
    localStorage.setItem(KEY, JSON.stringify({ crossed: st.crossed, selfHit: st.selfHit, bell: st.bell, warden: st.warden }));
  } catch {
    /* bỏ qua */
  }
  return true;
}

export function torusHint(vi: string, en: string, kind: TorusHint["kind"] = "info") {
  useTorus.setState({ hint: { vi, en, kind, at: performance.now() } });
}

/** quả cầu năng lượng của Mắt Canh (bay thẳng, quấn mép) */
export interface Orb {
  x: number;
  y: number;
  z: number;
  vx: number;
  vy: number;
  vz: number;
  born: number;
  alive: boolean;
}
export const orbs: Orb[] = [];

/** trạng thái chạy của Mắt Canh (không React) */
export const warden = { yaw: Math.PI, hitAt: -1e9, blockAt: -1e9, fireAt: 0, deadAt: 0 };
