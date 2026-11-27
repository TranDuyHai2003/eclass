/** Trạng thái Thư viện Babel: phòng lục giác hiện tại (số nguyên khổng lồ), độ lệch so với phòng của Thủ thư, giao diện đang mở */
import { create } from "zustand";
import { neighborHex, randomHex, type Address } from "@/lib/world/babel";
import { useWorld } from "../store";

/** Phòng của Thủ thư Tịnh (lối vào từ Bốt Siêu khối) */
export const ENTRY_HEX = randomHex(20261126);

export type BabelUi =
  | null
  | { mode: "shelf"; wall: number }
  | { mode: "reader"; addr: Address; hl?: { at: number; len: number } }
  | { mode: "search"; text?: string }
  | { mode: "desk" }
  | { mode: "stair" };

type S = {
  hex: bigint;
  /** số bước (phòng) theo hành lang và số tầng đã đi so với phòng của Thủ thư; null = đã "nhảy" tới địa chỉ khác bằng Mục lục */
  off: { x: number; y: number } | null;
  ui: BabelUi;
  climb: { dir: 1 | -1; t0: number } | null;
  /** đổi màu sách khi đổi phòng */
  rev: number;
};
export const useBabel = create<S>(() => ({ hex: ENTRY_HEX, off: { x: 0, y: 0 }, ui: null, climb: null, rev: 0 }));

export const atEntry = () => {
  const o = useBabel.getState().off;
  return !!o && o.x === 0 && o.y === 0;
};
/** Sang phòng kế bên (dx theo hành lang, dy theo tầng) */
export function stepHex(dx: number, dy: number) {
  const s = useBabel.getState();
  useBabel.setState({ hex: neighborHex(s.hex, dx, dy), off: s.off ? { x: s.off.x + dx, y: s.off.y + dy } : null, rev: s.rev + 1 });
}
/** Nhảy tới một phòng bất kỳ (từ Mục lục) */
export function jumpToHex(hex: bigint) {
  const s = useBabel.getState();
  if (hex === s.hex) return;
  useBabel.setState({ hex, off: hex === ENTRY_HEX ? { x: 0, y: 0 } : null, rev: s.rev + 1 });
}
export function openBabelUi(ui: BabelUi) {
  useBabel.setState({ ui });
  useWorld.setState({ overlay: ui ? "babel" : null });
}
