import { POINTS } from "./config";
import { isEligibleStudent, lockWallet, vietnamDayStart, writeEntry, type Tx } from "./engine";

/** Kiểm tra đầu vào thưởng/trừ tay. Trả về lỗi (chuỗi) hoặc null nếu hợp lệ. */
export function validateManualGrant(amount: number, reason: string | null | undefined): string | null {
  const max = POINTS.manual.maxPerGrant;
  if (!Number.isInteger(amount) || amount === 0 || Math.abs(amount) > max) return `Số xu từ -${max.toLocaleString("vi-VN")} đến ${max.toLocaleString("vi-VN")} (khác 0).`;
  if (!reason?.trim()) return "Nhập lý do để học sinh biết vì sao được thưởng/bị trừ.";
  return null;
}

/**
 * Thầy thưởng (dương) / trừ (âm) điểm cho một học sinh. Thưởng bị giới hạn mỗi ngày; trừ thì không.
 * Trả về số điểm thực áp dụng, hoặc "skip" (không phải học sinh hợp lệ) / "cap" (đã đủ giới hạn hôm nay).
 */
export async function grantManualInTx(
  tx: Tx,
  p: { userId: string; amount: number; reason: string; staffId: string; now?: Date },
): Promise<number | "skip" | "cap"> {
  if (!(await isEligibleStudent(tx, p.userId))) return "skip";
  await lockWallet(tx, p.userId);
  const reason = p.reason.trim().slice(0, 200);
  let value = p.amount;
  if (value > 0) {
    const today = await tx.pointLedger.aggregate({
      where: { userId: p.userId, source: "MANUAL", amount: { gt: 0 }, createdAt: { gte: vietnamDayStart(p.now) } },
      _sum: { amount: true },
    });
    value = Math.min(value, POINTS.manual.dailyCapPerStudent - (today._sum.amount ?? 0));
    if (value <= 0) return "cap";
  }
  await writeEntry(tx, { userId: p.userId, amount: value, source: "MANUAL", reason, createdById: p.staffId });
  await tx.notification.create({
    data: {
      userId: p.userId,
      title: value > 0 ? `Thầy thưởng ${value.toLocaleString("vi-VN")} xu 💰` : `Bị trừ ${(-value).toLocaleString("vi-VN")} xu`,
      message: reason,
      link: "/rewards",
      type: "SYSTEM",
    },
  });
  return value;
}
