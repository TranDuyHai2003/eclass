export type KindFilter = "ALL" | "PHYSICAL" | "VIRTUAL" | "COSMETIC";

/**
 * Bộ lọc loại quà thực sự áp dụng: chỉ có ý nghĩa khi có từ 2 loại quà; nếu loại đang chọn không còn quà nào
 * (vd thầy vừa ẩn món cuối, dữ liệu vừa làm mới) thì về "Tất cả" — tránh kẹt ở lưới trống khi thanh lọc đã ẩn.
 */
export function resolveKindFilter(selected: KindFilter, kinds: readonly string[]): KindFilter {
  if (kinds.length <= 1) return "ALL";
  return selected === "ALL" || kinds.includes(selected) ? selected : "ALL";
}
