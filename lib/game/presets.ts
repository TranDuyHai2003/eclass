/**
 * "Mẫu nhân vật" (trang Hồ sơ & Trang trí): bộ món áp một lần — không phải món, không lưu DB.
 * Món thiếu mua cả bộ qua `buyBundle` (một giao dịch, được cả bộ hoặc không món nào).
 */
import type { Slot } from "./items";
import { BODIES, EYE_GEO, HAIR_HEADS, HEAD_ANCHOR } from "./painted-data";

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

/** Cấu hình nhân vật kèm khuôn mặt chọn riêng (không phải món, miễn phí) */
export type LookConfig = Partial<Record<Slot, string | null>> & { face?: string | null };

/**
 * "Khuôn mặt" chọn được ở mục Tùy chỉnh: mặt vẽ tay của các mẫu (bỏ hiệp sĩ, nhà du hành vì đội mũ kín).
 * Thứ tự = ô trong public/studio/faces.webp (scripts/studio/gen-face-assets.py); `skin` = màu da của mặt đó.
 */
export const FACES: { id: string; name: string; skin: string }[] = [
  { id: "preset-student", name: "Học sinh nam", skin: "#fcd5bd" },
  { id: "preset-wizard", name: "Nhà thông thái", skin: "#fccdb6" },
  { id: "preset-catgirl", name: "Cô bé mũ mèo", skin: "#fcd7c3" },
  { id: "preset-scholar", name: "Học giả nhỏ (đeo kính)", skin: "#fed5b9" },
  { id: "preset-gamer", name: "Game thủ", skin: "#fcd1b7" },
  { id: "preset-kimono", name: "Cô gái kimono", skin: "#fbd6c2" },
];
export const FACE_IDS = FACES.map((f) => f.id);
/** Mặt đã chọn không làm lệch mẫu: chưa chọn, chọn đúng mặt của mẫu, hoặc mẫu che kín mặt (nhà du hành) */
const faceFits = (config: LookConfig, p: Preset) => !config.face || config.face === p.id || p.id === "preset-astro";
const GIRL_HAIR = new Set(["hair-bob", "hair-ponytail", "hair-twin", "hair-long", "hair-bun"]);

/** Khuôn mặt dùng khi vẽ nhân vật tự chỉnh: mặt đã chọn, chưa chọn thì theo kiểu tóc (tóc dài/búi → mặt cô gái kimono) */
export function faceIndexOf(config: LookConfig): number {
  const i = config.face ? FACE_IDS.indexOf(config.face) : -1;
  if (i >= 0) return i;
  return config.hair && GIRL_HAIR.has(config.hair) ? FACE_IDS.indexOf("preset-kimono") : 0;
}

export interface PaintedLook {
  /** Ô đầu / cả nhân vật: 0–7 = characters.webp, 8 = tóc bob không hoa, 9+ = kiểu tóc vẽ thêm (chỉ có trong char-heads.webp) */
  index: number;
  /** Mẫu gốc của ô (màu tóc/mắt/mặt/trang phục gốc) */
  base: number;
  /** Thân thay theo trang phục: ô trong char-bodies.webp; null = giữ nguyên tranh */
  body: number | null;
  /** Khuôn mặt dán lên tranh (chỉ số FACES); null = mặt của tranh */
  face: number | null;
  /** itemId màu tóc / màu mắt cần tô lại trên tranh; null = giữ màu tranh */
  hairColor: string | null;
  eyes: string | null;
}

/**
 * Đầu vẽ sẵn: ô tranh → kiểu tóc + phụ kiện của đầu đó; ô 8 = đầu cô gái kimono bỏ hoa (tóc bob trơn);
 * ô 9+ = đầu tóc bob / tóc ngắn vẽ thêm kiểu tóc (đuôi ngựa, hai bím, dài, búi, dựng, mohawk — HAIR_HEADS).
 */
const HEADS: { cell: number; base: number; hair: string | null; accessory: string | null }[] = [
  ...[0, 1, 4, 6, 7].map((i) => ({ cell: i, base: i, hair: PRESETS[i].items.hair ?? null, accessory: PRESETS[i].items.accessory ?? null })),
  { cell: 8, base: 7, hair: "hair-bob", accessory: null },
  ...Object.entries(HAIR_HEADS).map(([cell, [hair, base]]) => ({ cell: Number(cell), base, hair, accessory: null })),
];

/**
 * Vẽ bằng tranh của design (thay vì nhân vật SVG):
 * - trang phục liền đầu (hoodie tai mèo, giáp hiệp sĩ, đồ phi hành gia) → nguyên tranh mẫu đó;
 * - còn lại: kiểu tóc + phụ kiện trùng một đầu vẽ sẵn → đầu đó + thân theo trang phục
 *   (thân có sẵn hoặc trang phục tạo thêm trong char-bodies.webp), cổ ghép đúng đường cằm.
 * Khuôn mặt đã chọn khác mặt của tranh → dán mặt đó lên vùng da mặt của tranh (không đè tóc/mũ).
 * Màu tóc / màu mắt khác mẫu thì tô lại ngay trên tranh.
 */
export function paintedLook(config: LookConfig): PaintedLook | null {
  const outfit = config.outfit ?? null;
  const make = (index: number, base: number, body: number | null): PaintedLook => {
    const p = PRESETS[base];
    const fi = config.face && config.face !== p.id && index in EYE_GEO ? FACE_IDS.indexOf(config.face) : -1;
    const eyeBase = fi >= 0 ? PRESETS.find((x) => x.id === FACE_IDS[fi])?.items.eyes : p.items.eyes;
    return {
      index,
      base,
      body,
      face: fi >= 0 ? fi : null,
      hairColor: config.hairColor && config.hairColor !== p.items.hairColor ? config.hairColor : null,
      eyes: config.eyes && config.eyes !== eyeBase ? config.eyes : null,
    };
  };
  const whole = PRESETS.findIndex((p, i) => !(i in HEAD_ANCHOR) && p.items.outfit === outfit);
  if (whole >= 0) return make(whole, whole, null);
  const head = HEADS.find((h) => h.hair === (config.hair ?? null) && h.accessory === (config.accessory ?? null));
  if (!head) return null;
  if (head.cell < PRESETS.length && PRESETS[head.cell].items.outfit === outfit) return make(head.cell, head.base, null);
  const body = BODIES.findIndex((b) => b.outfit === outfit);
  return body < 0 ? null : make(head.cell, head.base, body);
}

/** Khuôn mặt đang hiện của cấu hình (id trong FACES) — để đổi tóc / áo vẫn giữ mặt; null nếu mặt bị che (nhà du hành, hiệp sĩ) */
export function currentFaceId(config: LookConfig): string | null {
  const look = paintedLook(config);
  if (!look) return FACES[faceIndexOf(config)].id;
  if (look.face !== null) return FACES[look.face].id;
  const id = PRESETS[look.base].id;
  return FACE_IDS.includes(id) ? id : null;
}

/** Chỉ số mẫu nhân vật mà cấu hình trùng khớp hoàn toàn (tóc, màu tóc, mắt, trang phục, phụ kiện, mặt); -1 nếu tự chỉnh khác mẫu */
export function presetIndexOf(config: LookConfig): number {
  return PRESETS.findIndex(
    (p) => faceFits(config, p) && (Object.keys(p.items) as Slot[]).every((k) => (config[k] ?? null) === (p.items[k] ?? null)),
  );
}
