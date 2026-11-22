/**
 * "Mẫu nhân vật" (trang Hồ sơ & Trang trí): bộ món áp một lần — không phải món, không lưu DB.
 * Món thiếu mua cả bộ qua `buyBundle` (một giao dịch, được cả bộ hoặc không món nào).
 */
import type { Slot } from "./items";

export interface Preset {
  id: string;
  name: string;
  items: Partial<Record<Slot, string | null>>;
}

export const PRESETS: Preset[] = [
  { id: "preset-student", name: "Học sinh nam", items: { hair: "hair-short", hairColor: "hc-brown", eyes: "eye-brown", outfit: "outfit-uniform", accessory: null } },
  { id: "preset-wizard", name: "Nhà thông thái", items: { hair: "hair-short", hairColor: "hc-black", eyes: "eye-blue", outfit: "outfit-wizard", accessory: "acc-wizardhat" } },
  { id: "preset-catgirl", name: "Cô bé mũ mèo", items: { hair: "hair-long", hairColor: "hc-brown", eyes: "eye-brown", outfit: "outfit-cathoodie", accessory: "acc-catears" } },
  { id: "preset-knight", name: "Hiệp sĩ tí hon", items: { hair: "hair-spiky", hairColor: "hc-blonde", eyes: "eye-blue", outfit: "outfit-knight", accessory: null } },
  { id: "preset-scholar", name: "Học giả nhỏ", items: { hair: "hair-short", hairColor: "hc-brown", eyes: "eye-brown", outfit: "outfit-scientist", accessory: "acc-glasses" } },
  { id: "preset-astro", name: "Nhà du hành", items: { hair: "hair-bob", hairColor: "hc-black", eyes: "eye-black", outfit: "outfit-astro", accessory: null } },
  { id: "preset-gamer", name: "Game thủ", items: { hair: "hair-short", hairColor: "hc-black", eyes: "eye-black", outfit: "outfit-gamer", accessory: "acc-headphones" } },
  { id: "preset-kimono", name: "Cô gái kimono", items: { hair: "hair-bob", hairColor: "hc-black", eyes: "eye-brown", outfit: "outfit-kimono", accessory: "acc-sakura" } },
];
