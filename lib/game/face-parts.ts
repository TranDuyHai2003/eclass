/**
 * Bộ phận khuôn mặt phối riêng (Mắt / Miệng / Trang điểm) — miễn phí, không phải món, lưu trong AvatarConfig.
 * `null` = bộ phận của khuôn mặt nền. Nét vẽ nằm ở components/avatar/FaceArt.tsx.
 */
import { FACE_PART_KEYS, LOOK_EXTRA_KEYS, type FacePartKey, type LookExtraKey } from "./presets";

export { FACE_PART_KEYS, LOOK_EXTRA_KEYS, hasFaceParts, type FacePartKey, type LookExtraKey } from "./presets";

export interface FacePart {
  id: string;
  name: string;
  /** màu (màu da) */
  v?: string;
}

/** Màu da riêng: tô lại da của tranh (mặt, tai, cổ, tay) — null = màu da của tranh */
export const SKIN_TONES: FacePart[] = [
  { id: "porcelain", name: "Trắng sứ", v: "#ffe8dc" },
  { id: "rosy", name: "Hồng hào", v: "#f9c7ae" },
  { id: "honey", name: "Bánh mật", v: "#e3ad82" },
  { id: "tan", name: "Ngăm", v: "#c88b5c" },
  { id: "brown", name: "Nâu", v: "#9c6542" },
  { id: "deep", name: "Nâu đậm", v: "#6f432a" },
];

/** Lông mày (vẽ nổi trên tóc mái kiểu anime, màu theo màu tóc) */
export const BROWS: FacePart[] = [
  { id: "thin", name: "Mày mảnh" },
  { id: "thick", name: "Mày rậm" },
  { id: "arched", name: "Mày cong" },
  { id: "straight", name: "Mày ngang" },
  { id: "angry", name: "Mày nhíu" },
  { id: "worried", name: "Mày lo lắng" },
  { id: "dot", name: "Mày chấm" },
];

/** Mắt riêng của nhân vật tự chỉnh (không lấy mắt của mẫu — muốn mặt mẫu thì chọn nguyên mẫu) + biểu cảm */
export const EYE_SHAPES: FacePart[] = [
  { id: "round", name: "Mắt tròn" },
  { id: "big", name: "Mắt to long lanh" },
  { id: "sharp", name: "Mắt sắc" },
  { id: "gentle", name: "Mắt hiền" },
  { id: "cat", name: "Mắt mèo" },
  { id: "sleepy", name: "Mắt lờ đờ" },
  { id: "starry", name: "Mắt ngôi sao" },
  { id: "fierce", name: "Mắt quyết tâm" },
  { id: "happy", name: "Mắt cười" },
  { id: "closed", name: "Mắt nhắm" },
  { id: "wink", name: "Nháy mắt" },
  { id: "heart", name: "Mắt trái tim" },
  { id: "dizzy", name: "Mắt xoáy" },
];

export const MOUTHS: FacePart[] = [
  { id: "grin", name: "Cười tươi" },
  { id: "o", name: "Ngạc nhiên" },
  { id: "tongue", name: "Lè lưỡi" },
  { id: "cat", name: "Miệng mèo" },
  { id: "fang", name: "Răng khểnh" },
  { id: "pout", name: "Phụng phịu" },
  { id: "smirk", name: "Cười nhếch" },
];

export const FACE_DECOS: FacePart[] = [
  { id: "blush", name: "Má hồng" },
  { id: "shy", name: "Ngượng ngùng" },
  { id: "freckles", name: "Tàn nhang" },
  { id: "star", name: "Sticker ngôi sao" },
  { id: "heart", name: "Sticker trái tim" },
  { id: "bandaid", name: "Băng cá nhân" },
  { id: "whiskers", name: "Ria mèo" },
  { id: "sweat", name: "Giọt mồ hôi" },
];

export const FACE_PART_OPTIONS: Record<FacePartKey | LookExtraKey, FacePart[]> = { eyeShape: EYE_SHAPES, mouth: MOUTHS, faceDeco: FACE_DECOS, skinTone: SKIN_TONES, brows: BROWS };
export const skinToneOf = (id: string | null | undefined) => SKIN_TONES.find((t) => t.id === id)?.v ?? null;

/** Giữ id hợp lệ (dữ liệu từ client) */
export function sanitizeFaceParts(input: Record<string, unknown>): Partial<Record<FacePartKey | LookExtraKey, string>> {
  const out: Partial<Record<FacePartKey | LookExtraKey, string>> = {};
  for (const k of [...FACE_PART_KEYS, ...LOOK_EXTRA_KEYS]) {
    const v = input[k];
    if (typeof v === "string" && FACE_PART_OPTIONS[k].some((p) => p.id === v)) out[k] = v;
  }
  return out;
}
