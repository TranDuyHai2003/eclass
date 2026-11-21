/**
 * Cấu hình nhân vật (món đang trang bị ở từng ô) — thuần, dùng ở cả client lẫn server.
 */
import { ITEM_BY_ID, SLOTS, itemsOfSlot, type Slot } from "./items";

export type AvatarConfig = Partial<Record<Slot, string | null>>;

const REQUIRED: Slot[] = ["skin", "hair", "hairColor", "eyes", "outfit"];

/** Băm xác định (FNV-1a) → nhân vật mặc định khác nhau giữa các bạn nhưng ổn định cho mỗi người */
export function hashId(id: string) {
  let h = 2166136261;
  for (let i = 0; i < id.length; i++) {
    h ^= id.charCodeAt(i);
    h = Math.imul(h, 16777619) >>> 0;
  }
  return h;
}

/** Nhân vật mặc định suy từ id người dùng: chỉ chọn trong đồ miễn phí */
export function defaultAvatar(userId: string): Required<Pick<AvatarConfig, (typeof REQUIRED)[number]>> & AvatarConfig {
  const h = hashId(userId || "x");
  const pick = (slot: Slot, seed: number) => {
    const free = itemsOfSlot(slot).filter((i) => i.free);
    return free[seed % free.length].id;
  };
  return {
    skin: pick("skin", h & 0xff),
    hair: pick("hair", (h >>> 8) & 0xff),
    hairColor: pick("hairColor", (h >>> 16) & 0xff),
    eyes: pick("eyes", (h >>> 24) & 0xff),
    outfit: pick("outfit", (h >>> 4) & 0xff),
    accessory: null,
    frame: null,
    background: null,
    title: null,
  };
}

/**
 * Làm sạch cấu hình: món không tồn tại / sai ô / không sở hữu (và không miễn phí) → về mặc định (ô bắt buộc) hoặc bỏ (ô tuỳ chọn).
 * `owned` = danh sách itemId đã sở hữu.
 */
export function sanitizeAvatar(raw: unknown, userId: string, owned: Iterable<string>): AvatarConfig {
  const base = defaultAvatar(userId);
  const has = new Set(owned);
  const input = (raw && typeof raw === "object" ? raw : {}) as Record<string, unknown>;
  const out: AvatarConfig = { ...base };
  for (const { key } of SLOTS) {
    const v = input[key];
    if (v === null || v === undefined || v === "") {
      if (!REQUIRED.includes(key)) out[key] = null;
      continue;
    }
    if (typeof v !== "string") continue;
    const item = ITEM_BY_ID[v];
    if (!item || item.slot !== key) continue;
    if (!item.free && !has.has(item.id)) continue;
    out[key] = item.id;
  }
  return out;
}

/** Một món có thể trang bị với người này không (miễn phí hoặc sở hữu) */
export function canEquip(itemId: string, owned: Set<string>) {
  const item = ITEM_BY_ID[itemId];
  return !!item && (item.free || owned.has(itemId));
}
