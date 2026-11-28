/**
 * Id khu của đồ thị khu Mê cung Hoạ âm trên dây mạng (tách nhỏ để RemotePlayers — dùng ở mọi cảnh — không kéo theo bố cục khu).
 * Thiếu / rỗng / lạ = "hub" (client / server cũ).
 */
export type ZoneId = "hub" | "keys" | "wait" | "desert";
export function normZone(z: string | null | undefined): ZoneId {
  return z === "keys" || z === "wait" || z === "desert" ? z : "hub";
}
export const sameZone = (a: string | null | undefined, b: string | null | undefined) => normZone(a) === normZone(b);
/** Id khu hợp lệ trên dây (server lọc bằng cùng mẫu) */
export const ZONE_WIRE = /^[a-z][a-z0-9_-]{0,15}$/;
