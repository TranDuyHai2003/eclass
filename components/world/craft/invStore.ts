"use client";
/**
 * G4 — Túi đồ của Vùng Kỳ quan (zustand) + bể đồ rơi dùng chung. Mọi thay đổi túi đi qua các hàm ở đây → đánh dấu
 * bẩn để worldSave ghi cùng giao dịch với khối (IndexedDB). Túi đồ là của MÁY này (chưa đồng bộ mạng).
 */
import { create } from "zustand";
import { addItem, emptyInv, moveStack, quickMove, roomFor, takeFromSlot, type Slot } from "@/lib/world/inventory";
import { ITEMS, ITEM_IDS, ITEM_INDEX } from "@/lib/world/itemDefs";
import { craft, type Recipe, type Station } from "@/lib/world/recipes";
import { DropPool } from "@/lib/world/dropSim";
import type { GameMode } from "@/lib/world/voxelSave";
import { sfx } from "@/lib/world/sfx";

interface InvState {
  slots: Slot[];
  mode: GameMode;
  /** đã nạp từ bộ lưu (trước đó không ghi đè bản lưu bằng túi rỗng) */
  loaded: boolean;
  /** trạm của bảng chế tạo đang mở */
  station: Station;
  /** ô đang chọn trong bảng túi đồ (bấm ô thứ hai để chuyển) */
  pick: number | null;
}

export const useInv = create<InvState>(() => ({ slots: emptyInv(), mode: "survival", loaded: false, station: "hand", pick: null }));

const listeners = new Set<() => void>();
/** worldSave đăng ký: túi đổi → lưu */
export function onInvChange(fn: () => void) {
  listeners.add(fn);
  return () => void listeners.delete(fn);
}
function commit(slots: Slot[]) {
  useInv.setState({ slots });
  listeners.forEach((f) => f());
}

export const isCreative = () => useInv.getState().mode === "creative";
export function setMode(mode: GameMode) {
  useInv.setState({ mode });
  listeners.forEach((f) => f());
}

/** Thêm vào túi (nhặt đồ / chế tạo) — trả số đã nhận */
export function giveItem(id: string, n: number): number {
  const r = addItem(useInv.getState().slots, id, n);
  if (r.added > 0) commit(r.inv);
  return r.added;
}

/** Bớt 1 từ ô (đặt khối). Sáng tạo: không bớt. Trả false nếu ô trống. */
export function consumeSlot(slot: number): boolean {
  const s = useInv.getState();
  if (s.mode === "creative") return !!s.slots[slot];
  const r = takeFromSlot(s.slots, slot, 1);
  if (!r) return false;
  commit(r.inv);
  return true;
}

export function craftRecipe(r: Recipe, times: number): ReturnType<typeof craft> {
  const s = useInv.getState();
  const res = craft(s.slots, r, times, s.station);
  if (res.ok) commit(res.inv);
  return res;
}

export function moveSlot(a: number, b: number) {
  commit(moveStack(useInv.getState().slots, a, b));
}
export function quickMoveSlot(i: number) {
  commit(quickMove(useInv.getState().slots, i));
}
/** Lấy cả chồng ra khỏi ô (vứt ra thế giới) */
export function takeStack(i: number): Slot {
  const s = useInv.getState().slots;
  const st = s[i];
  if (!st) return null;
  const r = takeFromSlot(s, i, st.n);
  if (r) commit(r.inv);
  return st;
}
/** Sáng tạo: đặt một chồng đầy vật phẩm id vào ô */
export function creativeSet(slot: number, id: string) {
  const out = useInv.getState().slots.slice();
  out[slot] = { id, n: ITEMS[id].stack };
  commit(out);
}
/** Thay toàn bộ (nạp từ bộ lưu) — không phát sự kiện lưu */
export function loadInv(slots: Slot[], mode: GameMode) {
  useInv.setState({ slots, mode, loaded: true });
}

// ───────────── Đồ rơi (bể dùng chung: BlockInteractor thả, ItemDrops mô phỏng + vẽ) ─────────────

export const DROPS = new DropPool();
/** Nam châm: còn chỗ cho vật phẩm chỉ số it? (không cấp phát) */
export const dropRoom = (it: number) => {
  const s = useInv.getState();
  return s.loaded ? roomFor(s.slots, ITEM_IDS[it]) : 0; // chưa nạp túi đã lưu → chưa nhặt (khỏi bị ghi đè mất)
};
export const dropTake = (it: number, n: number) => {
  const got = giveItem(ITEM_IDS[it], n);
  if (got > 0) pickFeed(ITEM_IDS[it], got);
  return got;
};

// ───────────── Dòng nhặt đồ (HUD): gộp cùng loại trong 2,5 s ─────────────
export const usePickFeed = create<{ list: { key: number; id: string; n: number; at: number }[] }>(() => ({ list: [] }));
let feedKey = 1;
let lastSound = 0;
function pickFeed(id: string, n: number) {
  const now = performance.now();
  const list = usePickFeed.getState().list.filter((p) => now - p.at < 2500);
  const same = list.find((p) => p.id === id);
  if (same) {
    same.n += n;
    same.at = now;
  } else list.push({ key: feedKey++, id, n, at: now });
  usePickFeed.setState({ list: list.slice(-4) });
  if (now - lastSound > 90) {
    lastSound = now;
    sfx.pickup();
  }
}
export const dropMax = (it: number) => ITEMS[ITEM_IDS[it]]?.stack ?? 64;
/** Thả n vật phẩm id tại tâm ô (văng nhẹ lên) */
export function spawnDrop(id: string, n: number, x: number, y: number, z: number, vx = 0, vy = 0, vz = 0) {
  const it = ITEM_INDEX[id];
  if (it === undefined || n <= 0) return;
  const a = Math.random() * Math.PI * 2;
  return DROPS.spawn(it, n, x, y, z, vx || Math.cos(a) * 1.2, vy || 3.2, vz || Math.sin(a) * 1.2, ITEMS[id].stack);
}
/** Vứt cả chồng ở ô i ra trước mặt (2 s sau mới hút lại được) */
export function throwStack(i: number, x: number, y: number, z: number, yaw: number) {
  const st = takeStack(i);
  if (!st) return;
  const k = spawnDrop(st.id, st.n, x, y, z, Math.sin(yaw) * 4, 3, Math.cos(yaw) * 4);
  if (k !== undefined) DROPS.age[k] = -1.6;
}
