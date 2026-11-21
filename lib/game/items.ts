/**
 * Danh mục đồ trang trí nhân vật chibi — hằng số trong code, KHÔNG lưu DB.
 * Quy ước: `id` là slug ổn định (chỉ THÊM, không đổi/xoá slug vì UserItem/UserAvatar tham chiếu).
 * Thuần (không import Prisma) → dùng được ở client.
 */
import type { Rarity } from "@/lib/points/rarity";

export type Slot = "skin" | "hair" | "hairColor" | "eyes" | "outfit" | "accessory" | "frame" | "background" | "title" | "pet";

export const SLOTS: { key: Slot; label: string; icon: string; optional?: boolean }[] = [
  { key: "skin", label: "Màu da", icon: "🖐️" },
  { key: "hair", label: "Kiểu tóc", icon: "💇" },
  { key: "hairColor", label: "Màu tóc", icon: "🎨" },
  { key: "eyes", label: "Màu mắt", icon: "👀" },
  { key: "outfit", label: "Trang phục", icon: "👕" },
  { key: "accessory", label: "Phụ kiện", icon: "🎀", optional: true },
  { key: "frame", label: "Khung", icon: "🖼️", optional: true },
  { key: "background", label: "Nền", icon: "🌈", optional: true },
  { key: "title", label: "Danh hiệu", icon: "🏷️", optional: true },
  { key: "pet", label: "Mèo Cún", icon: "🐱", optional: true },
];

export interface Item {
  id: string;
  slot: Slot;
  name: string;
  rarity: Rarity;
  /** Giá bán trong tiệm: xu hoặc ngọc; không có = miễn phí (free) hoặc chỉ từ rương (gachaOnly) */
  price?: { xu: number } | { gem: number };
  free?: boolean;
  gachaOnly?: boolean;
  /** Tham số vẽ (màu, biến thể) — Chibi.tsx đọc */
  v?: string;
  v2?: string;
}

const skin = (id: string, name: string, v: string): Item => ({ id, slot: "skin", name, rarity: "common", free: true, v });
const hairColor = (id: string, name: string, v: string, extra: Partial<Item> = {}): Item => ({ id, slot: "hairColor", name, rarity: "common", v, free: !extra.price && !extra.gachaOnly, ...extra });
const eyes = (id: string, name: string, v: string, extra: Partial<Item> = {}): Item => ({ id, slot: "eyes", name, rarity: "common", v, free: !extra.price && !extra.gachaOnly, ...extra });

export const ITEMS: Item[] = [
  // ---- Da (miễn phí)
  skin("skin-light", "Sáng", "#fde7d2"),
  skin("skin-peach", "Đào", "#f8d3b6"),
  skin("skin-tan", "Nâu nhạt", "#d9a877"),
  skin("skin-brown", "Nâu", "#a86f45"),
  // ---- Kiểu tóc
  { id: "hair-short", slot: "hair", name: "Tóc ngắn", rarity: "common", free: true, v: "short" },
  { id: "hair-bob", slot: "hair", name: "Tóc bob", rarity: "common", free: true, v: "bob" },
  { id: "hair-ponytail", slot: "hair", name: "Tóc đuôi ngựa", rarity: "common", free: true, v: "ponytail" },
  { id: "hair-spiky", slot: "hair", name: "Tóc dựng", rarity: "rare", price: { xu: 900 }, v: "spiky" },
  { id: "hair-twin", slot: "hair", name: "Tóc hai bím", rarity: "rare", price: { xu: 900 }, v: "twin" },
  { id: "hair-long", slot: "hair", name: "Tóc dài", rarity: "rare", price: { xu: 1200 }, v: "long" },
  { id: "hair-bun", slot: "hair", name: "Búi củ tỏi", rarity: "epic", gachaOnly: true, v: "bun" },
  { id: "hair-mohawk", slot: "hair", name: "Mohawk", rarity: "epic", gachaOnly: true, v: "mohawk" },
  // ---- Màu tóc
  hairColor("hc-black", "Đen", "#1f2937"),
  hairColor("hc-brown", "Nâu", "#6b3f1d"),
  hairColor("hc-blonde", "Vàng", "#f2c14e"),
  hairColor("hc-red", "Đỏ", "#c0392b", { rarity: "rare", price: { xu: 600 } }),
  hairColor("hc-blue", "Xanh dương", "#2563eb", { rarity: "rare", price: { xu: 600 } }),
  hairColor("hc-pink", "Hồng", "#ec4899", { rarity: "rare", price: { xu: 600 } }),
  hairColor("hc-mint", "Bạc hà", "#34d399", { rarity: "epic", gachaOnly: true }),
  hairColor("hc-silver", "Bạc", "#cbd5e1", { rarity: "epic", gachaOnly: true }),
  hairColor("hc-rainbow", "Cầu vồng", "url(#hairRainbow)", { rarity: "legendary", gachaOnly: true }),
  // ---- Màu mắt
  eyes("eye-brown", "Nâu", "#4b2e1e"),
  eyes("eye-black", "Đen", "#111827"),
  eyes("eye-blue", "Xanh", "#2563eb", { rarity: "rare", price: { xu: 450 } }),
  eyes("eye-green", "Lục", "#059669", { rarity: "rare", price: { xu: 450 } }),
  eyes("eye-violet", "Tím", "#7c3aed", { rarity: "epic", gachaOnly: true }),
  eyes("eye-gold", "Vàng kim", "#d97706", { rarity: "legendary", gachaOnly: true }),
  // ---- Trang phục
  { id: "outfit-uniform", slot: "outfit", name: "Đồng phục", rarity: "common", free: true, v: "#ffffff", v2: "#1d4ed8" },
  { id: "outfit-tee", slot: "outfit", name: "Áo phông", rarity: "common", free: true, v: "#60a5fa", v2: "#1e3a8a" },
  { id: "outfit-hoodie", slot: "outfit", name: "Áo hoodie", rarity: "rare", price: { xu: 1500 }, v: "#f97316", v2: "#9a3412" },
  { id: "outfit-dress", slot: "outfit", name: "Váy hoa", rarity: "rare", price: { xu: 1500 }, v: "#f472b6", v2: "#be185d" },
  { id: "outfit-sport", slot: "outfit", name: "Đồ thể thao", rarity: "rare", price: { xu: 1500 }, v: "#22c55e", v2: "#166534" },
  { id: "outfit-scientist", slot: "outfit", name: "Áo blouse nhà toán học", rarity: "epic", price: { xu: 4500 }, v: "#e2e8f0", v2: "#334155" },
  { id: "outfit-ninja", slot: "outfit", name: "Ninja", rarity: "epic", gachaOnly: true, v: "#1f2937", v2: "#dc2626" },
  { id: "outfit-royal", slot: "outfit", name: "Hoàng bào", rarity: "legendary", price: { gem: 8 }, v: "#7c3aed", v2: "#fbbf24" },
  { id: "outfit-astro", slot: "outfit", name: "Phi hành gia", rarity: "legendary", gachaOnly: true, v: "#f8fafc", v2: "#0ea5e9" },
  // ---- Phụ kiện
  { id: "acc-glasses", slot: "accessory", name: "Kính học bá", rarity: "common", price: { xu: 450 }, v: "glasses" },
  { id: "acc-cap", slot: "accessory", name: "Mũ lưỡi trai", rarity: "rare", price: { xu: 900 }, v: "cap" },
  { id: "acc-bow", slot: "accessory", name: "Nơ hồng", rarity: "rare", price: { xu: 900 }, v: "bow" },
  { id: "acc-headphones", slot: "accessory", name: "Tai nghe", rarity: "epic", gachaOnly: true, v: "headphones" },
  { id: "acc-crown", slot: "accessory", name: "Vương miện", rarity: "legendary", price: { gem: 10 }, v: "crown" },
  { id: "acc-halo", slot: "accessory", name: "Vòng hào quang", rarity: "legendary", gachaOnly: true, v: "halo" },
  // ---- Khung
  { id: "frame-blue", slot: "frame", name: "Khung xanh", rarity: "common", price: { xu: 600 }, v: "#60a5fa" },
  { id: "frame-leaf", slot: "frame", name: "Khung lá", rarity: "rare", price: { xu: 1200 }, v: "#22c55e" },
  { id: "frame-rainbow", slot: "frame", name: "Khung mây cầu vồng", rarity: "epic", gachaOnly: true, v: "rainbow" },
  { id: "frame-gold", slot: "frame", name: "Khung hào quang vàng", rarity: "legendary", price: { gem: 6 }, v: "gold" },
  // ---- Nền
  { id: "bg-sky", slot: "background", name: "Trời xanh", rarity: "common", price: { xu: 300 }, v: "#dbeafe", v2: "#bfdbfe" },
  { id: "bg-mint", slot: "background", name: "Bạc hà", rarity: "common", price: { xu: 300 }, v: "#d1fae5", v2: "#a7f3d0" },
  { id: "bg-sunset", slot: "background", name: "Hoàng hôn", rarity: "rare", price: { xu: 900 }, v: "#fed7aa", v2: "#fbcfe8" },
  { id: "bg-galaxy", slot: "background", name: "Dải ngân hà", rarity: "epic", gachaOnly: true, v: "#312e81", v2: "#7c3aed" },
  { id: "bg-gold", slot: "background", name: "Vàng ròng", rarity: "legendary", gachaOnly: true, v: "#fde68a", v2: "#f59e0b" },
  // ---- Danh hiệu trang trí (khác danh hiệu theo xu)
  { id: "title-nerd", slot: "title", name: "Mọt sách", rarity: "common", price: { xu: 450 } },
  { id: "title-speed", slot: "title", name: "Thần tốc", rarity: "rare", price: { xu: 900 } },
  { id: "title-pi", slot: "title", name: "Fan của số π", rarity: "rare", gachaOnly: true },
  { id: "title-boss", slot: "title", name: "Trùm cuối", rarity: "epic", gachaOnly: true },
  { id: "title-legend", slot: "title", name: "Huyền thoại lớp", rarity: "legendary", gachaOnly: true },
  // ---- Mèo Cún đồng hành (theo mockup "Tiệm Quà Học Đường"): hiện cạnh hồ sơ, bấm vuốt ve
  { id: "pet-bi", slot: "pet", name: "Mèo Mướp Bi", rarity: "common", free: true, v: "tabby" },
  { id: "pet-moka", slot: "pet", name: "Mèo Vàng Moka Béo Ú", rarity: "common", price: { xu: 450 }, v: "orange" },
  { id: "pet-peanut", slot: "pet", name: "Bé Mèo Tam Thể Peanut", rarity: "rare", price: { xu: 600 }, v: "calico" },
  { id: "pet-shadow", slot: "pet", name: "Mèo Đen Bóng Đêm", rarity: "epic", gachaOnly: true, v: "black" },
  { id: "pet-snow", slot: "pet", name: "Mèo Hoàng Thượng Snow", rarity: "legendary", price: { gem: 8 }, v: "snow" },
];

export const ITEM_BY_ID: Record<string, Item> = Object.fromEntries(ITEMS.map((i) => [i.id, i]));

export const RARITY_LABEL: Record<Rarity, string> = { common: "Phổ thông", rare: "Hiếm", epic: "Sử thi", legendary: "Huyền thoại" };

/** Xu trả lại khi trúng đồ đã có (theo bậc) */
export const DUPLICATE_REFUND: Record<Rarity, number> = { common: 150, rare: 450, epic: 1500, legendary: 4500 };

export function itemsOfSlot(slot: Slot) {
  return ITEMS.filter((i) => i.slot === slot);
}

export function isFree(item: Item) {
  return !!item.free;
}

/** Đồ bán trong tiệm (có giá) */
export function shopItems() {
  return ITEMS.filter((i) => i.price);
}
