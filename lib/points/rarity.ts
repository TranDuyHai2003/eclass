/**
 * Độ hiếm của quà — tự suy ra từ giá (giáo viên không phải chọn), chỉ để trang trí thẻ quà.
 * Mốc theo thang điểm nhỏ: chăm cả tháng ≈ 80–90 điểm.
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

/** Mốc giá: ≤50 Phổ thông · ≤120 Hiếm · ≤300 Sử thi · còn lại Huyền thoại */
export const RARITY_THRESHOLDS = { common: 50, rare: 120, epic: 300 } as const;

export function rarityOf(price: number): RarityStyle {
  if (price <= RARITY_THRESHOLDS.common) return RARITY.common;
  if (price <= RARITY_THRESHOLDS.rare) return RARITY.rare;
  if (price <= RARITY_THRESHOLDS.epic) return RARITY.epic;
  return RARITY.legendary;
}
