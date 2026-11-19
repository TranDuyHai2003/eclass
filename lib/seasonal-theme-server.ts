import { cookies } from "next/headers";
import { getAvailableSeason, THEME_COOKIE, type Season } from "@/lib/seasonal-theme";

/**
 * Theme đang áp dụng cho người xem: chỉ khi đang có mùa VÀ người dùng đã tự chọn theme đó.
 * Người mới vào (chưa có cookie) luôn ở theme thường.
 */
export async function getActiveSeason(): Promise<Season | null> {
  const available = getAvailableSeason();
  if (!available) return null;
  const chosen = (await cookies()).get(THEME_COOKIE)?.value;
  return chosen === available ? available : null;
}
