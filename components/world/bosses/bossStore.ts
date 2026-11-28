"use client";
/**
 * Trạng thái boss / sự kiện Vùng Kỳ quan cho HUD (zustand, cập nhật thưa ≤ 8 lần/s — không setState mỗi khung) +
 * tiến trình đã lưu (localStorage, máy này) + điều phối "đang có boss nào" (chỉ một trận một lúc).
 */
import { create } from "zustand";

export type BossId = "surveyor" | "ledger";

export interface BossUi {
  on: boolean;
  id: BossId;
  hp: number;
  maxHp: number;
  phase: number;
  /** mode: intro / fight / seal / stun / spill / exposed / dead */
  mode: string;
  /** đòn đang báo trước / đánh (mã) */
  atk: string | null;
  // Kẻ Khảo sát: khiên
  seal: null | { line: string; rule: string; stakes: { name: string; u: number; v: number; pinned: boolean }[]; ghost: boolean; left: number; tries: number; wrong: boolean };
  /** toạ độ người chơi trong đấu trường (ô nguyên) */
  pu: number;
  pv: number;
  // Sổ Mưa
  ledger: null | { w: number[]; pay: number[]; k: number; points: number; need: number; bet: number; counts: number[]; expect: number[]; last: string };
}

export const useBossUi = create<BossUi>(() => ({ on: false, id: "surveyor", hp: 0, maxHp: 1, phase: 1, mode: "intro", atk: null, seal: null, pu: 0, pv: 0, ledger: null }));

export interface EventUi {
  on: boolean;
  wave: number;
  waves: number;
  left: number;
  state: string;
  /** chu kỳ của các đàn trong đợt (giây) và thời gian tới lần cùng sà (s) */
  periods: number[];
  sync: number;
}
export const useEventUi = create<EventUi>(() => ({ on: false, wave: 0, waves: 3, left: 0, state: "idle", periods: [], sync: 0 }));

/** Dòng thông báo ngắn trên HUD (triệu hồi thất bại, chiến thắng, phần thưởng…) */
export const useBossToast = create<{ text: string; at: number; kind: "info" | "win" | "warn" }>(() => ({ text: "", at: 0, kind: "info" }));
export function toast(text: string, kind: "info" | "win" | "warn" = "info") {
  useBossToast.setState({ text, at: performance.now(), kind });
}

/** Trận đang diễn ra: tâm đấu trường + seed + hướng (Sổ Mưa) */
export interface Fight {
  id: BossId;
  cx: number;
  cz: number;
  y: number;
  seed: number;
  /** hướng dọc bến (Sổ Mưa): 0..3 × 90° */
  rot: number;
}
/** Đêm Đèn lồng đang diễn ra: tâm + khoá (= seed chung khi nhiều người) */
export interface LanternEv {
  cx: number;
  cz: number;
  y: number;
  key: number;
}
export const useFight = create<{ fight: Fight | null; eventOn: boolean; ev: LanternEv | null }>(() => ({ fight: null, eventOn: false, ev: null }));

// ───────────── Tiến trình (localStorage) ─────────────

const KEY = "eclass-expanse-progress";
export interface Progress {
  surveyor: number;
  ledger: number;
  /** khoá đêm của lần Đêm Đèn lồng gần nhất */
  lantern: string | null;
}
export function loadProgress(): Progress {
  try {
    const raw = typeof localStorage !== "undefined" ? localStorage.getItem(KEY) : null;
    const o = raw ? (JSON.parse(raw) as Partial<Progress>) : {};
    return { surveyor: Math.max(0, Number(o.surveyor) || 0), ledger: Math.max(0, Number(o.ledger) || 0), lantern: typeof o.lantern === "string" ? o.lantern : null };
  } catch {
    return { surveyor: 0, ledger: 0, lantern: null };
  }
}
export function saveProgress(p: Progress) {
  try {
    localStorage.setItem(KEY, JSON.stringify(p));
  } catch {
    /* chế độ riêng tư / bộ nhớ đầy: bỏ qua (tiến trình chỉ là tiện ích) */
  }
}
