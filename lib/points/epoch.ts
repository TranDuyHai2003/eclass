import { prisma } from "@/lib/prisma";
import { getVietnamMonthStart } from "@/lib/ranking/history-engine";

/**
 * Mốc reset xu (GameConfig "xuEpoch", ghi bởi migration 20261126030100_reset_student_xu — thầy cho reset xu toàn bộ học sinh
 * 26/11/2026). Xu kiếm trước mốc đã bị đưa về 0 → Bảng Vàng tháng / thống kê tháng chỉ tính từ mốc này.
 * Cache 5 phút trong tiến trình (mốc gần như không đổi).
 */
/** Chỉ cần đọc một dòng GameConfig — nhận cả prisma lẫn prismaBase (Bảng Vàng chạy trong unstable_cache) */
type Db = { gameConfig: { findUnique(args: { where: { key: string }; select: { value: true } }): PromiseLike<{ value: unknown } | null> } };
let cache: { at: number; v: Date | null } | null = null;
const TTL = 5 * 60_000;

export async function getXuEpoch(db: Db = prisma): Promise<Date | null> {
  if (cache && Date.now() - cache.at < TTL) return cache.v;
  let v: Date | null = null;
  try {
    const row = await db.gameConfig.findUnique({ where: { key: "xuEpoch" }, select: { value: true } });
    const d = typeof row?.value === "string" ? new Date(row.value) : null;
    v = d && !Number.isNaN(d.getTime()) ? d : null;
  } catch {
    v = cache?.v ?? null;
  }
  cache = { at: Date.now(), v };
  return v;
}

/** Đầu kỳ tính xu tháng này: đầu tháng (giờ VN) hoặc mốc reset nếu muộn hơn */
export async function earningPeriodStart(db: Db = prisma, now: Date = new Date()): Promise<Date> {
  const month = getVietnamMonthStart(now);
  const epoch = await getXuEpoch(db);
  return epoch && epoch > month ? epoch : month;
}

/** Test: xoá cache để đọc lại mốc */
export function resetXuEpochCache() {
  cache = null;
}
