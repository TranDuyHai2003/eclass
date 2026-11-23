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
export function frameSpriteStyle(id: string, size: number): React.CSSProperties | undefined {
  const p = ITEM_POS[id];
  if (!p || p.sheet !== "items" || p.row !== 2) return undefined;
  const k = size / 112;
  return {
    backgroundImage: `url(${SPRITE_ITEMS})`,
    backgroundSize: `${1096 * k}px ${448 * k}px`,
    backgroundPosition: `${-(p.col * 137 + 12.5) * k}px ${-224 * k}px`,
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
