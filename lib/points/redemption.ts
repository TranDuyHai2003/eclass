import type { Prisma, RedemptionStatus } from "@prisma/client";
import { prisma } from "@/lib/prisma";
import { getVietnamMonthStart } from "@/lib/ranking/history-engine";
import { POINTS } from "./config";
import { lockWallet, writeEntry, type Tx } from "./engine";

/** Điều kiện quà học sinh được thấy/đổi: đang bán, đúng lớp, quà hiện vật chỉ cho học sinh offline */
export function visibleRewardWhere(user: { classId: string | null; studentType: string }): Prisma.RewardWhereInput {
  return {
    isActive: true,
    deletedAt: null,
    AND: [
      { OR: [{ classes: { none: {} } }, ...(user.classId ? [{ classes: { some: { id: user.classId } } }] : [])] },
      ...(user.studentType === "OFFLINE" ? [] : [{ offlineOnly: false }]),
    ],
  };
}

/** Số lần học sinh đã đổi một món trong tháng này (không tính yêu cầu bị huỷ/từ chối/hết hạn) */
export function monthlyRedemptionCount(tx: Tx, userId: string, rewardId: string) {
  return tx.redemption.count({
    where: {
      userId,
      rewardId,
      status: { in: ["PENDING", "DELIVERED"] },
      createdAt: { gte: getVietnamMonthStart() },
    },
  });
}

/**
 * Đóng một yêu cầu đang chờ và hoàn điểm + hoàn kho (huỷ / từ chối / hết hạn).
 * Trả về false nếu yêu cầu không còn ở trạng thái chờ (đã được xử lý ở nơi khác).
 */
export async function closeWithRefund(
  tx: Tx,
  redemptionId: string,
  status: Extract<RedemptionStatus, "CANCELLED" | "REJECTED" | "EXPIRED">,
  opts: { note?: string | null; handledById?: string | null } = {},
) {
  const r = await tx.redemption.findUnique({
    where: { id: redemptionId },
    select: { id: true, userId: true, rewardId: true, price: true, status: true, reward: { select: { title: true, stock: true } } },
  });
  if (!r || r.status !== "PENDING") return false;

  await lockWallet(tx, r.userId);
  // Đổi trạng thái có điều kiện → hai giáo viên/hai tab bấm cùng lúc cũng chỉ hoàn một lần
  const updated = await tx.redemption.updateMany({
    where: { id: r.id, status: "PENDING" },
    data: { status, note: opts.note ?? null, handledById: opts.handledById ?? null, handledAt: new Date() },
  });
  if (updated.count === 0) return false;

  const reasonByStatus = {
    CANCELLED: `Huỷ đổi quà "${r.reward.title}"`,
    REJECTED: `Thầy từ chối quà "${r.reward.title}"${opts.note ? `: ${opts.note}` : ""}`,
    EXPIRED: `Quá ${POINTS.pendingExpiryDays} ngày chưa nhận quà "${r.reward.title}"`,
  } as const;
  await writeEntry(tx, {
    userId: r.userId,
    amount: r.price,
    source: "REFUND",
    refId: r.id,
    reason: reasonByStatus[status],
    createdById: opts.handledById ?? null,
  });
  if (r.reward.stock !== null) {
    await tx.reward.update({ where: { id: r.rewardId }, data: { stock: { increment: 1 } } });
  }
  return true;
}

/** Tự hết hạn các yêu cầu chờ quá lâu (gọi khi mở trang Điểm thưởng / trang quản lý) */
export async function expireStaleRedemptions() {
  const cutoff = new Date(Date.now() - POINTS.pendingExpiryDays * 86400000);
  const stale = await prisma.redemption.findMany({
    where: { status: "PENDING", createdAt: { lt: cutoff } },
    select: { id: true },
    take: 200,
  });
  for (const { id } of stale) {
    try {
      await prisma.$transaction((tx) => closeWithRefund(tx, id, "EXPIRED"));
    } catch (err) {
      console.error("[points] expire redemption failed:", id, err);
    }
  }
}
