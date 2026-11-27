"use client";
/**
 * Phòng thí nghiệm vũ trụ (Thế giới Bất Khả): trạng thái của 5 thí nghiệm ở 5 kỳ quan. Mở bằng F ở trạm; thẻ điều khiển
 * nằm bên phải HUD (KHÔNG che cảnh, vẫn đi / bay được) — mô phỏng 3D chạy ngay trên kỳ quan (scene/CosmosLab).
 */
import type * as THREE from "three";
import { create } from "zustand";
import type { LabId } from "@/lib/world/impCosmos";
import { GOLDEN_ANGLE } from "@/lib/world/cosmosLab";

export type HopfMode = "point" | "circle" | "two";
export interface LabState {
  id: LabId | null;
  openedAt: number;
  lorenz: { eps: number; seed: number; hist: number[]; dist: number; t: number };
  fib: { angle: number; seed: number; fam: number };
  hopf: { mode: HopfMode; eta: number; phi: number; auto: boolean };
  knot: { tricolor: boolean; bead: boolean; seed: number };
  sierp: { level: number };
}
export const useLab = create<LabState>(() => ({
  id: null,
  openedAt: 0,
  lorenz: { eps: 1e-5, seed: 0, hist: [], dist: 0, t: 0 },
  fib: { angle: GOLDEN_ANGLE, seed: 0, fam: 0 },
  hopf: { mode: "point", eta: 1.2, phi: 0, auto: true },
  knot: { tricolor: false, bead: true, seed: 0 },
  sierp: { level: 3 },
}));

export function toggleLab(id: LabId) {
  const cur = useLab.getState().id;
  if (cur === id) return closeLab();
  useLab.setState({ id, openedAt: performance.now() });
  // nhả chuột để dùng thanh trượt / nút (bấm vào cảnh để khoá lại)
  if (typeof document !== "undefined" && document.pointerLockElement) document.exitPointerLock();
}
export function closeLab() {
  useLab.setState({ id: null });
}
export function patchLab<K extends Exclude<keyof LabState, "id" | "openedAt">>(k: K, v: Partial<LabState[K]>) {
  useLab.setState({ [k]: { ...useLab.getState()[k], ...v } } as Partial<LabState>);
}

/** Nút kỳ quan trong GLB (gắn hiệu ứng thí nghiệm theo đúng phép biến đổi + vòng xoay của kỳ quan) */
export const COSMOS_NODES: { knot: THREE.Object3D | null; lorenz: THREE.Object3D | null; hopf: THREE.Object3D | null } = { knot: null, lorenz: null, hopf: null };
