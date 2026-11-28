"use client";
/**
 * Trạng thái client của Thế giới Toán: cảnh hiện tại, vị trí nhân vật, đầu vào điều khiển, hiệu ứng (khựng hình, rung, nổ hạt).
 */
import { create } from "zustand";
import * as THREE from "three";
import type { WorldState } from "@/lib/world/service";
import type { Cubic } from "@/lib/world/cubic";
import { DEFAULT_LANG, t as tt, type Lang } from "@/lib/world/i18n";

/** Mức đồ hoạ: low = điện thoại / máy yếu, high = máy tính mạnh */
export type Quality = "low" | "mid" | "high";

export type ActPose = "cast" | "cheer" | "hurt" | "jump" | "slash" | "roll";
/** Đoạn clip cụ thể cho một động tác (thế võ): tên clip trong thư viện animation, giây bắt đầu, tốc độ */
export type ActClip = { name: string; from: number; speed: number };
export type SceneId = "hub" | "valley" | "expanse" | "impossible" | "siren" | "babel" | "paradox" | "study" | "vault" | "torus" | "bazaar" | "coast" | "archive";
export type Overlay = null | "museum" | "battle" | "characters" | "discovery" | "wonder" | "emotes" | "forge" | "console" | "babel" | "hilbert" | "guide" | "cave" | "monty" | "theseus" | "maxwell" | "croom" | "paradox" | "craft";

export interface Burst {
  id: number;
  pos: [number, number, number];
  color: string;
  count: number;
  born: number;
}

interface WorldStore {
  scene: SceneId;
  overlay: Overlay;
  lang: Lang;
  quality: Quality;
  state: WorldState;
  avatar: string;
  /** Tên học sinh tự đặt (hiện trên đầu, gửi cho người khác); rỗng = tên tài khoản */
  playerName: string;
  /** Vị trí nhân vật trong sảnh */
  player: THREE.Vector3;
  playerYaw: number;
  moving: boolean;
  /** Đầu vào: joystick / phím (x: trái-phải, y: tiến-lùi), -1..1 */
  input: { x: number; y: number; run: boolean };
  /** Đối tượng tương tác gần nhất */
  nearby: null | { kind: "portal" | "museum" | "creature" | "characters" | "home" | "wonder" | "npc" | "forge" | "console" | "shelf" | "stair" | "paradox" | "lab" | "action" | "study"; id?: string; label: string };
  wonderId: string | null;
  /** Sinh vật đang thuần hoá */
  battleKc: string | null;
  /** Động tác tạm thời của nhân vật (tung phép, mừng, trúng đòn) */
  action: { pose: ActPose; until: number; clip?: ActClip } | null;
  /** Góc xoay máy quay quanh nhân vật */
  camYaw: number;
  /** Góc ngẩng của máy quay (rad) và khoảng cách tới nhân vật */
  camPitch: number;
  camDist: number;
  /** Ô đang chọn trên thanh khối (Vùng Kỳ quan) */
  hotbar: number;
  /** Động tác đang làm (tên clip) và biểu cảm khuôn mặt đang giữ */
  emote: string | null;
  expression: string | null;
  /** Lúc hộ thể của nhân vật đỡ đòn (hiệu ứng khiên) */
  shieldAt: number;
  // Hiệu ứng
  hitstopUntil: number;
  shake: number;
  bursts: Burst[];
  // Thung lũng
  valleyCubic: Cubic;
  valleyX: number;
  anchors: number[];
  challengeCubic: Cubic | null;

  set: (p: Partial<WorldStore>) => void;
  act: (pose: ActPose, ms?: number, clip?: ActClip) => void;
  hitstop: (ms: number) => void;
  addShake: (amount: number) => void;
  burst: (pos: [number, number, number], color: string, count?: number) => void;
}

let burstId = 0;

export const useWorld = create<WorldStore>((set, get) => ({
  scene: "hub",
  overlay: null,
  lang: DEFAULT_LANG,
  quality: "mid",
  state: { discoveries: [], creatures: [], abilities: [], dueCount: 0 },
  avatar: "",
  playerName: "",
  player: new THREE.Vector3(0, 0, 20.5),
  playerYaw: Math.PI,
  moving: false,
  input: { x: 0, y: 0, run: false },
  nearby: null,
  wonderId: null,
  battleKc: null,
  action: null,
  camYaw: 0,
  camPitch: 0.16,
  camDist: 3.2,
  hotbar: 0,
  emote: null,
  expression: null,
  shieldAt: -1e9,
  hitstopUntil: 0,
  shake: 0,
  bursts: [],
  valleyCubic: { a: 0.5, b: 0, c: -1.5, d: 0 },
  valleyX: -2.5,
  anchors: [],
  challengeCubic: null,

  set: (p) => set(p),
  act: (pose, ms = 900, clip) => set({ action: { pose, until: performance.now() + ms, clip } }),
  hitstop: (ms) => set({ hitstopUntil: performance.now() + ms }),
  addShake: (amount) => set({ shake: Math.min(1, get().shake + amount) }),
  burst: (pos, color, count = 40) => {
    const now = performance.now();
    set({ bursts: [...get().bursts.filter((b) => now - b.born < 1500), { id: ++burstId, pos, color, count, born: now }] });
  },
}));

/** Hook dịch giao diện theo ngôn ngữ hiện tại */
export function useT() {
  const lang = useWorld((s) => s.lang);
  return (key: string, params?: Record<string, string | number>) => tt(lang, key, params);
}
export function useLang(): Lang {
  return useWorld((s) => s.lang);
}

/** Đoán mức đồ hoạ ban đầu theo thiết bị (sau đó PerformanceMonitor hạ tiếp nếu FPS thấp) */
export function detectQuality(): Quality {
  if (typeof window === "undefined") return "mid";
  const coarse = window.matchMedia?.("(pointer: coarse)").matches;
  const nav = navigator as Navigator & { deviceMemory?: number };
  const mem = nav.deviceMemory ?? 4;
  const cores = nav.hardwareConcurrency ?? 4;
  if (coarse || mem <= 4 || cores <= 4) return coarse && (mem <= 3 || cores <= 4) ? "low" : coarse ? "low" : "mid";
  return "mid"; // "high" chỉ bật tay — đo trên desktop mức high còn chậm (xem TECH.md)
}

/** Thời gian game (dừng trong lúc khựng hình) */
export function timeScale(): number {
  return performance.now() < useWorld.getState().hitstopUntil ? 0.03 : 1;
}
