/**
 * Cấu hình nhân vật (món đang trang bị ở từng ô) — thuần, dùng ở cả client lẫn server.
 */
import { ITEM_BY_ID, SLOTS, itemsOfSlot, type Slot } from "./items";
import { FACE_IDS, PRESETS, type LookConfig } from "./presets";
import { sanitizeFaceParts } from "./face-parts";

/**
 * Món đang trang bị ở từng ô + `face`: khuôn mặt vẽ tay chọn riêng (id mẫu trong FACES)
 * + `eyeShape` / `mouth` / `faceDeco`: bộ phận mặt phối riêng (lib/game/face-parts.ts) — miễn phí, không phải món
 */
export type AvatarConfig = LookConfig;

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

/** Nhân vật mặc định: mẫu "Học sinh nam" (tranh vẽ); màu da suy từ id (chỉ dùng khi tự chỉnh sang nhân vật vẽ SVG) */
export function defaultAvatar(userId: string): Required<Pick<AvatarConfig, (typeof REQUIRED)[number]>> & AvatarConfig {
  const h = hashId(userId || "x");
  const pick = (slot: Slot, seed: number) => {
    const free = itemsOfSlot(slot).filter((i) => i.free);
    return free[seed % free.length].id;
  };
  // Mặc định là mẫu "Học sinh nam" của canvas thiết kế (vẽ bằng tranh, toàn đồ miễn phí) — thầy chọn 22/11/2026
  const student = PRESETS[0].items;
  return {
    skin: pick("skin", h & 0xff),
    hair: student.hair ?? "hair-short",
    hairColor: student.hairColor ?? "hc-brown",
    eyes: student.eyes ?? "eye-brown",
    outfit: student.outfit ?? "outfit-uniform",
    accessory: null,
    frame: null,
    background: null,
    effect: null,
    nameplate: null,
    title: null,
    // Ai cũng có một bé mèo miễn phí đi cùng (mockup Tiệm Quà Học Đường)
    pet: "pet-bi",
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
    // Không có khoá (cấu hình cũ) → giữ mặc định; null/"" rõ ràng → bỏ trống ô tuỳ chọn
    if (v === undefined) continue;
    if (v === null || v === "") {
      if (!REQUIRED.includes(key)) out[key] = null;
      continue;
    }
    if (typeof v !== "string") continue;
    const item = ITEM_BY_ID[v];
    if (!item || item.slot !== key) continue;
    if (!item.free && !has.has(item.id)) continue;
    out[key] = item.id;
  }
  if (typeof input.face === "string" && FACE_IDS.includes(input.face)) out.face = input.face;
  Object.assign(out, sanitizeFaceParts(input));
  if (input.gender === "male" || input.gender === "female") out.gender = input.gender;
  return out;
}

/** Một món có thể trang bị với người này không (miễn phí hoặc sở hữu) */
export function canEquip(itemId: string, owned: Set<string>) {
  const item = ITEM_BY_ID[itemId];
  return !!item && (item.free || owned.has(itemId));
}
