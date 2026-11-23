/**
 * Ai được vào Tiệm quà (dùng được cả server lẫn client).
 * Tạm thời (24/11/2026, thầy quyết): chỉ học sinh OFFLINE thấy tiệm — học sinh online vẫn tích xu, chưa đổi quà / mở hộp / nhập mã.
 * Mở cho mọi học sinh: đổi SHOP_OFFLINE_ONLY = false rồi deploy.
 */
export const SHOP_OFFLINE_ONLY = true;

export function canUseShop(user?: { role?: string | null; studentType?: string | null } | null): boolean {
  if (!user?.role) return false;
  if (user.role !== "STUDENT") return true;
  return !SHOP_OFFLINE_ONLY || user.studentType === "OFFLINE";
}
