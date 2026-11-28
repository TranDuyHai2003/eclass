/**
 * G4 — Túi đồ: 9 ô thanh nhanh (0..8) + 27 ô túi (9..35). Mọi thao tác là GIAO DỊCH THUẦN: nhận túi cũ, trả túi mới
 * (hoặc null nếu không làm được) — không bao giờ sửa mảng đầu vào, nên lỗi giữa chừng không làm mất / nhân đôi đồ.
 */
import { ITEMS } from "./itemDefs";

export type Stack = { id: string; n: number };
export type Slot = Stack | null;
export type Inv = readonly Slot[];

export const HOTBAR = 9;
export const BAG = 27;
export const INV_SIZE = HOTBAR + BAG;

export const emptyInv = (): Slot[] => new Array<Slot>(INV_SIZE).fill(null);
export const stackMax = (id: string) => ITEMS[id]?.stack ?? 64;

/** Tổng số vật phẩm id trong túi */
export function countItem(inv: Inv, id: string): number {
  let n = 0;
  for (const s of inv) if (s && s.id === id) n += s.n;
  return n;
}

/** Còn chứa được bao nhiêu vật phẩm id (không cấp phát — gọi được mỗi khung cho nam châm nhặt đồ) */
export function roomFor(inv: Inv, id: string): number {
  const max = stackMax(id);
  let r = 0;
  for (let i = 0; i < inv.length; i++) {
    const s = inv[i];
    if (!s) r += max;
    else if (s.id === id) r += max - s.n;
  }
  return r;
}

/**
 * Thêm n vật phẩm: lấp chồng cùng loại trước (thanh nhanh rồi túi), sau đó ô trống đầu tiên.
 * Trả về túi mới + số đã nhận (có thể < n khi đầy — phần thừa người gọi giữ lại, vd. thực thể rơi còn nằm đất).
 */
export function addItem(inv: Inv, id: string, n: number): { inv: Slot[]; added: number } {
  const out = inv.slice() as Slot[];
  if (!(id in ITEMS) || n <= 0) return { inv: out, added: 0 };
  const max = stackMax(id);
  let left = Math.floor(n);
  for (let i = 0; i < out.length && left > 0; i++) {
    const s = out[i];
    if (s && s.id === id && s.n < max) {
      const k = Math.min(left, max - s.n);
      out[i] = { id, n: s.n + k };
      left -= k;
    }
  }
  for (let i = 0; i < out.length && left > 0; i++) {
    if (!out[i]) {
      const k = Math.min(left, max);
      out[i] = { id, n: k };
      left -= k;
    }
  }
  return { inv: out, added: Math.floor(n) - left };
}

/** Bớt n vật phẩm id (lấy từ ô cuối trước — giữ chồng trên thanh nhanh lâu hơn). Không đủ → null (không đổi gì). */
export function removeItem(inv: Inv, id: string, n: number): Slot[] | null {
  if (n <= 0) return inv.slice() as Slot[];
  if (countItem(inv, id) < n) return null;
  const out = inv.slice() as Slot[];
  let left = n;
  for (let i = out.length - 1; i >= 0 && left > 0; i--) {
    const s = out[i];
    if (!s || s.id !== id) continue;
    const k = Math.min(left, s.n);
    out[i] = s.n - k > 0 ? { id, n: s.n - k } : null;
    left -= k;
  }
  return out;
}

/** Bớt n từ đúng một ô (đặt khối từ ô đang cầm). Ô không đủ → null. */
export function takeFromSlot(inv: Inv, slot: number, n = 1): { inv: Slot[]; stack: Stack } | null {
  const s = inv[slot];
  if (!s || s.n < n || n <= 0) return null;
  const out = inv.slice() as Slot[];
  out[slot] = s.n - n > 0 ? { id: s.id, n: s.n - n } : null;
  return { inv: out, stack: { id: s.id, n } };
}

/** Kéo ô a sang ô b: cùng loại → gộp (phần thừa ở lại a); khác loại / trống → đổi chỗ. */
export function moveStack(inv: Inv, a: number, b: number): Slot[] {
  const out = inv.slice() as Slot[];
  if (a === b || a < 0 || b < 0 || a >= out.length || b >= out.length) return out;
  const A = out[a];
  const Bs = out[b];
  if (A && Bs && A.id === Bs.id) {
    const max = stackMax(A.id);
    const k = Math.min(A.n, max - Bs.n);
    out[b] = { id: A.id, n: Bs.n + k };
    out[a] = A.n - k > 0 ? { id: A.id, n: A.n - k } : null;
  } else {
    out[a] = Bs;
    out[b] = A;
  }
  return out;
}

/** Chuyển nhanh (Shift + bấm): thanh nhanh ↔ túi, gộp vào chồng sẵn có trước. Không còn chỗ → giữ nguyên. */
export function quickMove(inv: Inv, slot: number): Slot[] {
  const s = inv[slot];
  if (!s) return inv.slice() as Slot[];
  const [a, b] = slot < HOTBAR ? [HOTBAR, INV_SIZE] : [0, HOTBAR];
  const out = inv.slice() as Slot[];
  const max = stackMax(s.id);
  let left = s.n;
  for (let i = a; i < b && left > 0; i++) {
    const t = out[i];
    if (t && t.id === s.id && t.n < max) {
      const k = Math.min(left, max - t.n);
      out[i] = { id: s.id, n: t.n + k };
      left -= k;
    }
  }
  for (let i = a; i < b && left > 0; i++) {
    if (!out[i]) {
      out[i] = { id: s.id, n: left };
      left = 0;
    }
  }
  out[slot] = left > 0 ? { id: s.id, n: left } : null;
  return out;
}

/** Kiểm + làm sạch túi đọc từ bộ lưu: bỏ mã lạ, số âm / thập phân, cắt theo chồng tối đa; độ dài đúng INV_SIZE */
export function sanitizeInv(raw: unknown): Slot[] {
  const out = emptyInv();
  if (!Array.isArray(raw)) return out;
  for (let i = 0; i < Math.min(raw.length, INV_SIZE); i++) {
    const s = raw[i] as { id?: unknown; n?: unknown } | null;
    if (!s || typeof s.id !== "string" || !(s.id in ITEMS)) continue;
    const n = Math.floor(Number(s.n));
    if (!Number.isFinite(n) || n <= 0) continue;
    out[i] = { id: s.id, n: Math.min(n, stackMax(s.id)) };
  }
  return out;
}
