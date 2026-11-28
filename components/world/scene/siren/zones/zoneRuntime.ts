"use client";
/**
 * Trạng thái chạy của đồ thị khu (giai đoạn 2) — một nguồn cho cảnh, va chạm, mạng, HUD.
 * Logic thuần ở lib/world/zoneGraph.ts; ở đây chỉ giữ trạng thái + bọc hàm va chạm theo toạ độ THẾ GIỚI cho Player.
 */
import { create } from "zustand";
import * as THREE from "three";
import { useWorld } from "../../../store";
import { CAM, motion } from "../../../combat/combat";
import { mazeBlocked, mazeCamFloor, mazeGround } from "@/lib/world/sirenMaze";
import { ZONE_DEFS, ZVOID, zoneAtWorld, zoneBlocked, zoneGround, zoneIndex, type ZoneId } from "@/lib/world/zoneGraph";

export type DoorStyle = "curtain" | "ticket" | "door" | "bronze";
export const ZONE_RT = {
  id: "hub" as ZoneId,
  /** khoá cửa vừa ra (không vào lại ngay) */
  lock: "",
  lockAt: 0,
  /** màn che: bắt đầu (performance.now) + kiểu */
  veilAt: -1e9,
  veilStyle: "ticket" as DoorStyle,
  /** chỗ đứng an toàn cuối cùng theo khu (cục bộ, chân) */
  safe: {} as Partial<Record<ZoneId, [number, number, number]>>,
  /** khu đã sẵn sàng (tài sản tải xong + shader biên dịch) */
  ready: new Set<ZoneId>(["hub"]),
  visited: new Set<ZoneId>(["hub"]),
  /** lúc rời hub (performance.now; −1 = đang ở hub) */
  leftHubAt: -1,
};

/** Ngoài hub? — useFrame của phần hub còn gắn (logic / trạng thái cần giữ) trả về sớm khi đang ở khu khác */
export const offHub = () => ZONE_RT.id !== "hub";
/** rời hub quá lâu thì gỡ hẳn phần THUẦN HÌNH của hub (HubVisual) — quay về thì gắn lại ngay (màn che phủ khung đầu) */
export const HUB_KEEP_MS = 4000;

/** Cho React: khu hiện tại + danh sách khu đang gắn (đổi hiếm); hubAway: đã rời hub > HUB_KEEP_MS */
export const useZones = create<{ zone: ZoneId; mount: ZoneId[]; visited: ZoneId[]; hint: { text: string; at: number } | null; hubAway: boolean }>(() => ({ zone: "hub", mount: [], visited: ["hub"], hint: null, hubAway: false }));

export function zoneHint(text: string) {
  const h = useZones.getState().hint;
  if (h && h.text === text && performance.now() - h.at < 2500) return;
  useZones.setState({ hint: { text, at: performance.now() } });
}

// ───────────── Va chạm theo toạ độ thế giới (Player gọi) ─────────────
export function worldGround(x: number, z: number, y?: number): number {
  const id = zoneAtWorld(x, z);
  if (id === "hub") return mazeGround(x, z, y);
  const o = ZONE_DEFS[id].origin;
  const g = zoneGround(zoneIndex(id), x - o[0], z - o[2], y === undefined ? undefined : y - o[1]);
  return g === ZVOID ? ZVOID : g + o[1];
}
export function worldBlocked(x: number, z: number, y: number): boolean {
  const id = zoneAtWorld(x, z);
  if (id === "hub") return mazeBlocked(x, z, y);
  const o = ZONE_DEFS[id].origin;
  return zoneBlocked(zoneIndex(id), x - o[0], z - o[2], y - o[1]);
}
/** sàn cho máy quay (khu mới: không có trần → chỉ giữ trên mặt cao nhất dưới máy quay nếu mục tiêu ở trên mặt đó) */
export function worldCamFloor(x: number, z: number, camY: number, targetY: number): number | null {
  const id = zoneAtWorld(x, z);
  if (id === "hub") return mazeCamFloor(x, z, camY, targetY);
  const g = worldGround(x, z, Math.min(camY, targetY) + 0.2);
  if (g === ZVOID || targetY < g) return null;
  return camY < g + 0.35 ? g + 0.35 : null;
}

// ───────────── Dịch chuyển trong khu (hồi sinh, bị hất khỏi tấm đồng…) ─────────────

const SHIFT = new THREE.Vector3();
/** Đưa người chơi về điểm chân cục bộ `local` của khu id, có màn che (kiểu vật che của cửa) */
export function teleportLocal(id: ZoneId, local: [number, number, number], style: DoorStyle = "curtain") {
  const p = useWorld.getState().player;
  const o = ZONE_DEFS[id].origin;
  const x = local[0] + o[0];
  const y = local[1] + o[1] + 0.05;
  const z = local[2] + o[2];
  SHIFT.set(x - p.x, y - p.y, z - p.z);
  p.set(x, y, z);
  CAM.shift = (CAM.shift ?? new THREE.Vector3()).add(SHIFT);
  motion.vy = 0;
  motion.grounded = false;
  motion.dashUntil = 0;
  ZONE_RT.veilAt = performance.now();
  ZONE_RT.veilStyle = style;
}
