/**
 * Bộ phận khuôn mặt phối riêng (Mắt / Miệng / Trang điểm) — miễn phí, không phải món, lưu trong AvatarConfig.
 * `null` = bộ phận của khuôn mặt nền. Nét vẽ nằm ở components/avatar/FaceArt.tsx.
 */
import { FACES, FACE_PART_KEYS, type FacePartKey } from "./presets";

export { FACE_PART_KEYS, hasFaceParts, type FacePartKey } from "./presets";

export interface FacePart {
  id: string;
  name: string;
}

/** Mắt: mắt vẽ tay của các mẫu (id = id khuôn mặt) + kiểu mắt vẽ thêm */
export const EYE_SHAPES: FacePart[] = [
  ...FACES.map((f) => ({ id: f.id, name: `Mắt ${f.name}` })),
  { id: "happy", name: "Mắt cười" },
  { id: "closed", name: "Mắt nhắm" },
  { id: "wink", name: "Nháy mắt" },
  { id: "sparkle", name: "Mắt long lanh" },
  { id: "fierce", name: "Mắt quyết tâm" },
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

export const FACE_PART_OPTIONS: Record<FacePartKey, FacePart[]> = { eyeShape: EYE_SHAPES, mouth: MOUTHS, faceDeco: FACE_DECOS };

/** Giữ id hợp lệ (dữ liệu từ client) */
export function sanitizeFaceParts(input: Record<string, unknown>): Partial<Record<FacePartKey, string>> {
  const out: Partial<Record<FacePartKey, string>> = {};
  for (const k of FACE_PART_KEYS) {
    const v = input[k];
    if (typeof v === "string" && FACE_PART_OPTIONS[k].some((p) => p.id === v)) out[k] = v;
  }
  return out;
}
