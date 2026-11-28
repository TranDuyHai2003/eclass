"use client";
/**
 * Bờ Sóng — trạng thái cảnh: tiến trình (localStorage, mỗi trình duyệt), lời gợi ý, bảng giải thích, và các trạm
 * (pha nguồn 2 của Đầm Giao thoa, nấc tời / quả lắc, nấc lăng kính). Trạng thái chạy từng khung (con lắc) để ngoài React.
 */
import { create } from "zustand";
import { NO_PROGRESS, PRISM_START, parseProgress, type CoastArea, type CoastProgress } from "@/lib/world/coastWorld";
import { LENGTHS, type Pend } from "@/lib/world/waves";

const KEY = "world.coast";

export type CoastHint = { vi: string; en: string; at: number; kind: "info" | "aha" | "warn" };
export type CoastPanel = "tide" | "lagoon" | "bell" | null;

export const useCoast = create<
  CoastProgress & {
    hint: CoastHint | null;
    panel: CoastPanel;
    area: CoastArea;
    /** pha nguồn 2 (0 hoặc π) */
    phi: number;
    /** nấc tời (chỉ số trong LENGTHS) + quả lắc nặng / nhẹ */
    lenIdx: number;
    heavy: boolean;
    prismStep: number;
    /** tia đang trúng tinh thể nào */
    beamHit: "A" | "B" | null;
    /** số lần bị sóng đầm đánh / bị triều cuốn / đẩy sai nhịp (gợi ý tăng dần) */
    slams: number;
    sweeps: number;
    badPush: number;
    goodPush: number;
    /** lúc chuông kêu gần nhất (hiệu ứng) */
    bellAt: number;
  }
>(() => ({ ...NO_PROGRESS, hint: null, panel: null, area: "beach", phi: 0, lenIdx: 0, heavy: false, prismStep: PRISM_START, beamHit: null, slams: 0, sweeps: 0, badPush: 0, goodPush: 0, bellAt: -1e9 }));

export function loadCoast() {
  let raw: string | null = null;
  try {
    raw = localStorage.getItem(KEY);
  } catch {
    /* chế độ riêng tư */
  }
  const p = parseProgress(raw);
  useCoast.setState({ ...p, hint: null, panel: null, phi: 0, lenIdx: 0, heavy: false, prismStep: PRISM_START, beamHit: null, slams: 0, sweeps: 0, badPush: 0, goodPush: 0 });
  pend.th = 0;
  pend.om = 0;
}

export function markCoast(k: keyof CoastProgress): boolean {
  const s = useCoast.getState();
  if (s[k]) return false;
  useCoast.setState({ [k]: true } as Partial<CoastProgress>);
  const st = useCoast.getState();
  try {
    localStorage.setItem(KEY, JSON.stringify({ islet: st.islet, lit: st.lit, tir: st.tir, bell: st.bell, lagoon: st.lagoon }));
  } catch {
    /* bỏ qua */
  }
  return true;
}

export function coastHint(vi: string, en: string, kind: CoastHint["kind"] = "info") {
  useCoast.setState({ hint: { vi, en, kind, at: performance.now() } });
}

export const curLength = () => LENGTHS[useCoast.getState().lenIdx];

/** con lắc trên cầu phao (bước cố định 1/120 s theo đồng hồ chung) */
export const pend: Pend & { simT: number; pushAt: number; ringAt: number; side: number } = { th: 0, om: 0, simT: -1, pushAt: -1e9, ringAt: -1e9, side: 0 };
