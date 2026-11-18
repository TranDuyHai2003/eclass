/**
 * Theme theo mùa (tự bật theo ngày, giờ Việt Nam).
 *
 * - Giáng sinh: 15/11 → 31/12
 * - Tết Nguyên đán: 14 ngày trước mùng 1 → hết mùng 10
 *
 * Bật bằng biến môi trường SEASONAL_THEME: "off" (mặc định — đang tạm tắt, chờ chỉnh lại giao diện)
 * | "auto" (tự bật theo ngày) | "christmas" | "tet".
 */
export type Season = "christmas" | "tet";

/** Mùng 1 Tết (dương lịch) các năm tới — thêm năm mới vào đây khi cần. */
const TET_DATES: Record<number, string> = {
  2027: "2027-02-06",
  2028: "2028-01-26",
  2029: "2029-02-13",
  2030: "2030-02-03",
  2031: "2031-01-23",
  2032: "2032-02-11",
};

const DAY = 24 * 60 * 60 * 1000;

/** Ngày hiện tại theo giờ Việt Nam (UTC+7, không có giờ mùa hè) dưới dạng {y, m(1-12), d}. */
function vnDateParts(now: Date) {
  const vn = new Date(now.getTime() + 7 * 60 * 60 * 1000);
  return { y: vn.getUTCFullYear(), m: vn.getUTCMonth() + 1, d: vn.getUTCDate() };
}

function utcDay(y: number, m: number, d: number) {
  return Date.UTC(y, m - 1, d);
}

export function getSeasonalTheme(now: Date = new Date()): Season | null {
  // Mặc định TẮT: theme Giáng sinh đang chờ làm lại cho đẹp hơn. Bật lại: SEASONAL_THEME=auto
  const override = (process.env.SEASONAL_THEME || "off").toLowerCase();
  if (override !== "auto" && override !== "christmas" && override !== "tet") return null;
  if (override === "christmas" || override === "tet") return override;

  const { y, m, d } = vnDateParts(now);
  const today = utcDay(y, m, d);

  // Tết: xét cả Tết năm nay lẫn năm sau (Tết sớm cuối tháng 1 có thể bắt đầu từ giữa tháng 1)
  for (const year of [y, y + 1]) {
    const iso = TET_DATES[year];
    if (!iso) continue;
    const [ty, tm, td] = iso.split("-").map(Number);
    const tet = utcDay(ty, tm, td);
    if (today >= tet - 14 * DAY && today <= tet + 9 * DAY) return "tet";
  }

  if ((m === 11 && d >= 15) || m === 12) return "christmas";
  return null;
}

/** Số ngày còn lại tới 24/12 (đêm Giáng sinh) theo giờ Việt Nam; 0 nếu đã tới/qua. */
export function daysUntilChristmasEve(now: Date = new Date()): number {
  const { y, m, d } = vnDateParts(now);
  return Math.max(0, Math.round((utcDay(y, 12, 24) - utcDay(y, m, d)) / DAY));
}

/** Số ngày còn lại tới mùng 1 Tết gần nhất; null nếu chưa có dữ liệu năm đó. */
export function daysUntilTet(now: Date = new Date()): number | null {
  const { y, m, d } = vnDateParts(now);
  const today = utcDay(y, m, d);
  for (const year of [y, y + 1]) {
    const iso = TET_DATES[year];
    if (!iso) continue;
    const [ty, tm, td] = iso.split("-").map(Number);
    const diff = Math.round((utcDay(ty, tm, td) - today) / DAY);
    if (diff >= -9) return Math.max(0, diff);
  }
  return null;
}
