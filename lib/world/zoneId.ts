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

/**
 * Cờ câu đố dùng chung của đồ thị khu (tin "zf" — phòng "siren"): dike / ticket = 0/1 (đã mở thì giữ — chốt), desert = mode 0…15.
 * zfMerge: luật gộp — CÙNG luật với realtime/server.mjs (selftest kiểm server, tests/world/zoneGraph.test.ts kiểm bản này).
 */
export const ZF_KEY = /^[a-z][a-z0-9_]{0,15}$/;
export const ZF_LATCH: readonly string[] = ["dike", "ticket"];
export type ZoneFlags = Record<string, number>;
export function zfMerge(f: ZoneFlags, k: unknown, v: unknown): boolean {
  if (typeof k !== "string" || !ZF_KEY.test(k)) return false;
  const n = v === true ? 1 : v === false ? 0 : typeof v === "number" ? v : NaN;
  if (!Number.isInteger(n) || n < 0 || n > 15) return false;
  if (!Object.prototype.hasOwnProperty.call(f, k) && Object.keys(f).length >= 8) return false;
  if (ZF_LATCH.includes(k) && f[k] === 1) return false;
  if (f[k] === n) return false;
  f[k] = n;
  return true;
}
