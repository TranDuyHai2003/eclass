/**
 * Độ hiếm của quà — tự suy ra từ giá (giáo viên không phải chọn), chỉ để trang trí thẻ quà.
 * Mốc theo thang xu 26/11: mỗi bài tập về nhà tối đa 500 xu (100 nộp đúng hạn + 400 chữa đủ).
 */
export type Rarity = "common" | "rare" | "epic" | "legendary";

export interface RarityStyle {
  key: Rarity;
  label: string;
  /** Nhãn góc thẻ */
  chip: string;
  /** Nền khu vực ảnh quà (có hoạ tiết chấm) */
  art: string;
  /** Viền + bóng của thẻ */
  card: string;
  /** Màu chấm hoạ tiết */
  dot: string;
}

export const RARITY: Record<Rarity, RarityStyle> = {
  common: {
    key: "common",
    label: "Phổ thông",
    chip: "bg-sky-100 text-sky-700",
    art: "from-sky-50 to-blue-100",
    card: "border-sky-200 shadow-[0_4px_0_0_#bae6fd]",
    dot: "#7dd3fc",
  },
  rare: {
    key: "rare",
    label: "Hiếm",
    chip: "bg-emerald-100 text-emerald-700",
    art: "from-emerald-50 to-teal-100",
    card: "border-emerald-200 shadow-[0_4px_0_0_#a7f3d0]",
    dot: "#6ee7b7",
  },
  epic: {
    key: "epic",
    label: "Sử thi",
    chip: "bg-violet-100 text-violet-700",
    art: "from-violet-50 to-fuchsia-100",
    card: "border-violet-200 shadow-[0_4px_0_0_#ddd6fe]",
    dot: "#c4b5fd",
  },
  legendary: {
    key: "legendary",
    label: "Huyền thoại",
    chip: "bg-gradient-to-r from-amber-200 to-orange-200 text-orange-800",
    art: "from-amber-50 via-orange-50 to-rose-100",
    card: "border-amber-300 shadow-[0_4px_0_0_#fcd34d]",
    dot: "#fbbf24",
  },
};

/**
 * Mốc giá (xu): ≤1 500 Phổ thông · ≤3 000 Hiếm · ≤7 500 Sử thi · còn lại Huyền thoại.
 * 26/11/2026: giá quà = tiền thật ÷ 3,6 (trước ~2 xu/1đ) → mốc cũ 7 500 / 18 000 / 45 000 thu nhỏ theo.
 */
export const RARITY_THRESHOLDS = { common: 1500, rare: 3000, epic: 7500 } as const;

export function rarityOf(price: number): RarityStyle {
  if (price <= RARITY_THRESHOLDS.common) return RARITY.common;
  if (price <= RARITY_THRESHOLDS.rare) return RARITY.rare;
  if (price <= RARITY_THRESHOLDS.epic) return RARITY.epic;
  return RARITY.legendary;
}
