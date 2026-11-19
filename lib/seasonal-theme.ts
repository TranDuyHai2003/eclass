/**
 * Theme theo mùa — NGƯỜI DÙNG TỰ CHỌN (menu đổi theme trên header), mặc định luôn là theme thường.
 *
 * "Mùa đang có" (getAvailableSeason, theo ngày giờ Việt Nam) chỉ quyết định có hiện tuỳ chọn hay không:
 * - Giáng sinh: 15/11 → 31/12
 * - Tết Nguyên đán: 14 ngày trước mùng 1 → hết mùng 10
 * Theme thật sự áp dụng = mùa đang có VÀ người dùng đã chọn (cookie THEME_COOKIE) — xem seasonal-theme-server.ts.
 *
 * Biến môi trường SEASONAL_THEME: "auto" (mặc định, theo ngày) | "off" (ẩn hẳn tuỳ chọn) | "christmas" | "tet" (ép mùa, để thử).
 */
export type Season = "christmas" | "tet";

/** Cookie lưu lựa chọn theme của người dùng: "christmas" | "tet" | "default". */
export const THEME_COOKIE = "site-theme";

export const SEASON_LABEL: Record<Season, string> = {
  christmas: "Giáng sinh",
  tet: "Tết",
};

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

/** Mùa đang có theo ngày (để hiện tuỳ chọn theme) — KHÔNG có nghĩa là đang áp dụng. */
export function getAvailableSeason(now: Date = new Date()): Season | null {
  const override = (process.env.SEASONAL_THEME || "auto").toLowerCase();
  if (override === "off") return null;
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
