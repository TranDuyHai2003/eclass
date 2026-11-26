/** Các mục của khu "Quản lý tiệm" trong Tiệm quà (dùng cả server lẫn client: đọc ?manage=…) */
export type ManageTab = "requests" | "rewards" | "grant" | "codes" | "stats" | "prices" | "earning";
export const MANAGE_TABS: readonly ManageTab[] = ["requests", "rewards", "grant", "codes", "stats", "prices", "earning"];
export const ADMIN_ONLY_TABS: readonly ManageTab[] = ["prices", "earning"];

/** ?manage=… → mục hợp lệ; "1" / rỗng / sai → mục mặc định (đơn đổi quà nếu còn đơn chờ, không thì quà & thẻ) */
export function parseManageTab(raw: string | string[] | undefined, opts: { isAdmin: boolean; hasPending: boolean }): ManageTab | null {
  const v = Array.isArray(raw) ? raw[0] : raw;
  if (v === undefined) return null;
  const t = MANAGE_TABS.find((x) => x === v);
  if (t && (opts.isAdmin || !ADMIN_ONLY_TABS.includes(t))) return t;
  return opts.hasPending ? "requests" : "rewards";
}
