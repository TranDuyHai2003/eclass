import { cn } from "@/lib/utils";

/**
 * Ảnh vật phẩm từ canvas thiết kế của thầy (GĐ9): 2 sprite trong public/studio.
 * - items.webp: 8 cột × 4 hàng, ô 83:68 — hàng 0 mẫu nhân vật, 1 thú cưng, 2 khung viền, 3 hiệu ứng
 * - backgrounds.webp: 3 cột × 2 hàng, ô 112:62 — hình nền
 * Món không có trong sprite (mèo cũ, khung/nền cũ, danh hiệu…) vẫn vẽ bằng SVG.
 */
export const SPRITE_ITEMS = "/studio/items.webp";
export const SPRITE_BGS = "/studio/backgrounds.webp";

type Pos = { sheet: "items" | "bgs"; col: number; row: number };

const ITEM_POS: Record<string, Pos> = {
  // Mẫu nhân vật (thứ tự PRESETS)
  "preset-student": { sheet: "items", col: 0, row: 0 },
  "preset-wizard": { sheet: "items", col: 1, row: 0 },
  "preset-catgirl": { sheet: "items", col: 2, row: 0 },
  "preset-knight": { sheet: "items", col: 3, row: 0 },
  "preset-scholar": { sheet: "items", col: 4, row: 0 },
  "preset-astro": { sheet: "items", col: 5, row: 0 },
  "preset-gamer": { sheet: "items", col: 6, row: 0 },
  "preset-kimono": { sheet: "items", col: 7, row: 0 },
  // Thú cưng (ô 0 "Mèo tinh linh" chưa có món tương ứng)
  "pet-dragon": { sheet: "items", col: 1, row: 1 },
  "pet-shiba": { sheet: "items", col: 2, row: 1 },
  "pet-owl": { sheet: "items", col: 3, row: 1 },
  "pet-bunny": { sheet: "items", col: 4, row: 1 },
  "pet-slime": { sheet: "items", col: 5, row: 1 },
  "pet-phoenix": { sheet: "items", col: 6, row: 1 },
  "pet-robot": { sheet: "items", col: 7, row: 1 },
  // Khung viền
  "frame-royal": { sheet: "items", col: 0, row: 2 },
  "frame-laurel": { sheet: "items", col: 1, row: 2 },
  "frame-sakura": { sheet: "items", col: 2, row: 2 },
  "frame-neon": { sheet: "items", col: 3, row: 2 },
  "frame-ice": { sheet: "items", col: 4, row: 2 },
  "frame-catear": { sheet: "items", col: 5, row: 2 },
  "frame-fire": { sheet: "items", col: 6, row: 2 },
  "frame-moon": { sheet: "items", col: 7, row: 2 },
  // Hiệu ứng
  "fx-sparkle": { sheet: "items", col: 0, row: 3 },
  "fx-sakura": { sheet: "items", col: 1, row: 3 },
  "fx-snow": { sheet: "items", col: 2, row: 3 },
  "fx-thunder": { sheet: "items", col: 3, row: 3 },
  "fx-butterfly": { sheet: "items", col: 4, row: 3 },
  "fx-meteor": { sheet: "items", col: 5, row: 3 },
  "fx-flame": { sheet: "items", col: 6, row: 3 },
  "fx-bubble": { sheet: "items", col: 7, row: 3 },
  // Hình nền
  "bg-library": { sheet: "bgs", col: 0, row: 0 },
  "bg-dusk": { sheet: "bgs", col: 1, row: 0 },
  "bg-classroom": { sheet: "bgs", col: 2, row: 0 },
  "bg-sakura": { sheet: "bgs", col: 0, row: 1 },
  "bg-neon": { sheet: "bgs", col: 1, row: 1 },
  "bg-forest": { sheet: "bgs", col: 2, row: 1 },
};

export const hasSprite = (id?: string | null) => !!id && id in ITEM_POS;

/** Kiểu nền CSS cho một ô sprite, phủ kín phần tử chứa (tỉ lệ ô: 83:68 hoặc 112:62) */
export function spriteStyle(id: string): React.CSSProperties | undefined {
  const p = ITEM_POS[id];
  if (!p) return undefined;
  const [cols, rows] = p.sheet === "items" ? [8, 4] : [3, 2];
  return {
    backgroundImage: `url(${p.sheet === "items" ? SPRITE_ITEMS : SPRITE_BGS})`,
    backgroundSize: `${cols * 100}% ${rows * 100}%`,
    backgroundPosition: `${((p.col / (cols - 1)) * 100).toFixed(4)}% ${((p.row / (rows - 1)) * 100).toFixed(4)}%`,
    backgroundRepeat: "no-repeat",
  };
}

/** Một ô sprite; mặc định giữ tỉ lệ ô (83:68 đồ vật, 112:62 nền) và rộng 100% */
export function Sprite({ id, className, style }: { id: string; className?: string; style?: React.CSSProperties }) {
  const p = ITEM_POS[id];
  if (!p) return null;
  return <span role="presentation" className={cn("block", p.sheet === "items" ? "aspect-[83/68]" : "aspect-[112/62]", className)} style={{ ...spriteStyle(id), ...style }} />;
}

/** Khung viền tròn từ sprite cho ảnh đại diện (như canvas: ô 137×112 trên bản 1096×448, cắt giữa 112×112) */
export function frameSpriteStyle(id: string, _size?: number): React.CSSProperties | undefined {
  const p = ITEM_POS[id];
  if (!p || p.sheet !== "items" || p.row !== 2) return undefined;
  // Tính theo % của chính phần tử (không theo cỡ px truyền vào): trước 24/11 dùng px theo `size` = 120 nên trên thẻ
  // điện thoại (~200px) hiện lẫn ô bên cạnh — khung "lệch", có góc trắng / nền tối / tai mèo của khung khác
  const W = 1096, H = 448, C = 112;
  return {
    backgroundImage: `url(${SPRITE_ITEMS})`,
    backgroundSize: `${((W / C) * 100).toFixed(4)}% ${((H / C) * 100).toFixed(4)}%`,
    backgroundPosition: `${(((p.col * 137 + 12.5) / (W - C)) * 100).toFixed(4)}% ${((224 / (H - C)) * 100).toFixed(4)}%`,
    backgroundRepeat: "no-repeat",
  };
}

/* ============================== Sprite Tiệm quà (8 cột × 5 hàng, ô vuông) ============================== */

export const SPRITE_SHOP = "/studio/shop.webp";

/** Ô ảnh tiệm của từng món trang trí/thú cưng (theo canvas Tiệm quà) */
const SHOP_ITEM: Record<string, number> = {
  "frame-gold": 17, "frame-sakura": 18, "frame-neon": 19,
  "bg-library": 20, "bg-galaxy": 21, "bg-sakura": 22,
  "fx-sparkle": 23, "acc-glasses": 24, "acc-crown": 25,
  "pet-shiba": 27, "pet-owl": 28, "pet-dragon": 29, "pet-bunny": 30, "pet-bi": 31, "pet-moka": 4,
};
export const SHOP_CHEST: Record<"xu" | "gem", number> = { xu: 34, gem: 36 };
export const SHOP_MASCOT = 37;

/** Quà của thầy: chọn ảnh theo từ khoá trong tên (không khớp → rương quà / vé đặc quyền) */
const REWARD_KEYS: [RegExp, number][] = [
  [/bình|nước|giữ nhiệt/i, 0],
  [/sổ|vở|notebook/i, 1],
  [/bút|gel/i, 2],
  [/gấu|bông/i, 3],
  [/móc ?kh[oó]a|móc chìa/i, 5],
  [/áo|hoodie/i, 6],
  [/balo|ba lô|cặp/i, 7],
  [/sticker|nhãn dán/i, 8],
  [/bảo vệ|giữ chuỗi|chuỗi/i, 9],
  [/nhân đôi|x2|gấp đôi/i, 10],
  [/miễn|phạt/i, 11],
  [/cộng|\+ ?\d|điểm/i, 12],
  [/đổi tên/i, 13],
  [/gợi ý|đáp án/i, 14],
  [/gia hạn|hạn nộp|trễ hạn/i, 15],
  [/vip/i, 16],
];
export function rewardArtIndex(title: string, kind: "PHYSICAL" | "VIRTUAL") {
  for (const [re, i] of REWARD_KEYS) if (re.test(title)) return i;
  return kind === "PHYSICAL" ? 34 : 11;
}
export const shopItemIndex = (id: string): number | undefined => SHOP_ITEM[id];

/** Một ô ảnh tiệm (vuông), viền mờ tròn như canvas để che mép ô */
export function ShopArt({ index, className, style }: { index: number; className?: string; style?: React.CSSProperties }) {
  const col = index % 8;
  const row = Math.floor(index / 8);
  return (
    <span
      role="presentation"
      className={cn("block aspect-square", className)}
      style={{
        backgroundImage: `url(${SPRITE_SHOP})`,
        backgroundSize: "800% 500%",
        backgroundPosition: `${((col / 7) * 100).toFixed(4)}% ${((row / 4) * 100).toFixed(4)}%`,
        backgroundRepeat: "no-repeat",
        WebkitMaskImage: "radial-gradient(closest-side,#000 72%,transparent 96%)",
        maskImage: "radial-gradient(closest-side,#000 72%,transparent 96%)",
        ...style,
      }}
    />
  );
}

/** Khuôn mặt nhân vật mẫu cắt từ sprite đồ vật — đúng công thức canvas (phóng 1,5× ô, lấy phần đầu) */
export function faceStyle(presetIdx: number, row = 0): React.CSSProperties {
  return {
    backgroundImage: `url(${SPRITE_ITEMS})`,
    backgroundRepeat: "no-repeat",
    backgroundSize: "1200% 491.6%",
    backgroundPosition: `${(((1.5 * presetIdx + 0.25) / 11) * 100).toFixed(3)}% ${(((row * 1.229 + 0.02) / 3.916) * 100).toFixed(3)}%`,
  };
}

/* ============================== Sprite "Tiệm quà v2" (canvas Adorable Home: 8 cột × 5 hàng, nền trong) ============================== */

export const SPRITE_V2 = "/studio/shop-v2.webp";

/** Ô ảnh v2 của món có tranh tương ứng trong canvas (khung viền tròn, thú cưng); món khác dùng ảnh cũ */
const V2_ITEM: Record<string, number> = {
  "frame-catear": 17, "frame-leaf": 18, "frame-blue": 19, "frame-rainbow": 20, "frame-butterfly": 21, "frame-sakura": 22, "frame-moon": 23, "frame-rose": 24, "frame-gold": 25,
  "np-pond": 26, "np-sakura": 27, "np-starry": 28, "np-butterfly": 29, "np-catparty": 30, "np-crimson": 31, "np-celestial": 32,
  "pet-moka": 33, "pet-shiba": 34, "pet-peanut": 35, "pet-bunny": 36, "pet-redpanda": 37, "pet-snow": 38,
};
export const V2_MASCOT = 38;
export const v2Index = (id?: string | null): number | undefined => (id ? V2_ITEM[id] : undefined);

/** Quà của thầy → tranh v2 theo từ khoá (quà hiện vật 0–9, vé đặc quyền 10–16) */
const V2_REWARD: [RegExp, number][] = [
  [/trà sữa|trà|boba/i, 0],
  [/sổ|vở|notebook/i, 1],
  [/hộp bút|túi bút/i, 4],
  [/bút|gel/i, 2],
  [/sticker|nhãn dán/i, 3],
  [/bình|nước|giữ nhiệt/i, 5],
  [/đèn/i, 6],
  [/gấu|bông/i, 7],
  [/túi|balo|ba lô|cặp/i, 8],
  [/tai nghe/i, 9],
  [/gia hạn|hạn nộp|trễ hạn|\+24h/i, 10],
  [/nhạc|giải lao/i, 11],
  [/hỏi riêng|1-1|kèm/i, 12],
  [/miễn|trực nhật|phạt/i, 13],
  [/gợi ý|đáp án/i, 14],
  [/chỗ ngồi|chọn chỗ|vip/i, 15],
  [/cộng|\+ ?\d|điểm|nhân đôi|x2|gấp đôi/i, 16],
];
export function rewardArtV2(title: string, kind: "PHYSICAL" | "VIRTUAL") {
  // Bỏ tiền tố trong ngoặc vuông (vd mã thử nghiệm) trước khi dò từ khoá
  const t = title.replace(/^\[[^\]]*\]\s*/, "");
  for (const [re, i] of V2_REWARD) if (re.test(t) && (kind === "PHYSICAL" ? i < 10 : i >= 10)) return i;
  return kind === "PHYSICAL" ? 4 : 13;
}

export function v2Style(index: number): React.CSSProperties {
  return {
    backgroundImage: `url(${SPRITE_V2})`,
    backgroundSize: "800% 500%",
    backgroundRepeat: "no-repeat",
    backgroundPosition: `${(((index % 8) / 7) * 100).toFixed(4)}% ${((Math.floor(index / 8) / 4) * 100).toFixed(4)}%`,
  };
}

/** Một ô tranh v2 (vuông, nền trong suốt) */
export function V2Art({ index, className, style }: { index: number; className?: string; style?: React.CSSProperties }) {
  return <span role="presentation" className={cn("block aspect-square", className)} style={{ ...v2Style(index), ...style }} />;
}
