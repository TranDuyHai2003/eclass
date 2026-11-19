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

export type PointsResult = { success: true; message?: string } | { success: false; error: string };

/**
 * Học sinh đổi quà (lõi, không kiểm tra đăng nhập — actions/points.ts lo phần đó).
 * Khoá ví → các lần bấm của cùng học sinh chạy tuần tự; trừ kho có điều kiện → nhiều bạn đổi cùng lúc không vượt số quà.
 */
export async function redeemInTx(tx: Tx, userId: string, rewardId: string): Promise<PointsResult> {
  const user = await tx.user.findUnique({
    where: { id: userId },
    select: { role: true, isApproved: true, isDemo: true, classId: true, studentType: true },
  });
  if (!user || user.role !== "STUDENT" || !user.isApproved || user.isDemo) {
    return { success: false, error: "Chỉ học sinh đã được duyệt mới đổi được quà." };
  }
  const wallet = await lockWallet(tx, userId);

  const reward = await tx.reward.findFirst({
    where: { id: rewardId, ...visibleRewardWhere(user) },
    select: { id: true, title: true, price: true, stock: true, perStudentMonthlyLimit: true },
  });
  if (!reward) return { success: false, error: "Quà này không còn hoặc không dành cho bạn." };
  if (wallet.balance < reward.price) {
    return { success: false, error: `Bạn cần thêm ${reward.price - wallet.balance} điểm để đổi quà này.` };
  }
  if (reward.perStudentMonthlyLimit !== null) {
    const used = await monthlyRedemptionCount(tx, userId, reward.id);
    if (used >= reward.perStudentMonthlyLimit) {
      return { success: false, error: `Mỗi tháng chỉ đổi được ${reward.perStudentMonthlyLimit} lần quà này.` };
    }
  }
  if (reward.stock !== null) {
    const taken = await tx.reward.updateMany({ where: { id: reward.id, stock: { gt: 0 } }, data: { stock: { decrement: 1 } } });
    if (taken.count === 0) return { success: false, error: "Quà này vừa hết." };
  }

  const redemption = await tx.redemption.create({ data: { userId, rewardId: reward.id, price: reward.price }, select: { id: true } });
  await writeEntry(tx, { userId, amount: -reward.price, source: "REDEEM", refId: redemption.id, reason: `Đổi quà "${reward.title}"` });
  // Đổi xong món đang đặt làm mục tiêu → bỏ mục tiêu
  await tx.pointWallet.updateMany({ where: { userId, goalRewardId: reward.id }, data: { goalRewardId: null } });
  return { success: true, message: `Đã đổi "${reward.title}". Thầy sẽ trao quà ở buổi học tới.` };
}

/** Thầy đánh dấu đã trao: chỉ yêu cầu còn đang chờ mới đổi trạng thái và mới nhận thông báo. Trả về số quà đã trao. */
export async function deliverInTx(tx: Tx, ids: string[], staffId: string): Promise<number> {
  let done = 0;
  for (const id of Array.from(new Set(ids))) {
    const updated = await tx.redemption.updateMany({
      where: { id, status: "PENDING" },
      data: { status: "DELIVERED", handledById: staffId, handledAt: new Date() },
    });
    if (updated.count === 0) continue; // học sinh vừa huỷ / đã xử lý ở tab khác
    done++;
    const r = await tx.redemption.findUniqueOrThrow({ where: { id }, select: { userId: true, reward: { select: { title: true } } } });
    await tx.notification.create({
      data: { userId: r.userId, title: "Đã nhận quà 🎁", message: `Thầy đã trao quà "${r.reward.title}". Chúc mừng bạn!`, link: "/rewards", type: "SYSTEM" },
    });
  }
  return done;
}

/** Thầy từ chối (bắt buộc lý do): hoàn điểm, hoàn kho, báo học sinh */
export async function rejectInTx(tx: Tx, redemptionId: string, note: string, staffId: string): Promise<PointsResult> {
  const reason = note?.trim();
  if (!reason) return { success: false, error: "Nhập lý do từ chối để học sinh biết." };
  const done = await closeWithRefund(tx, redemptionId, "REJECTED", { note: reason.slice(0, 300), handledById: staffId });
  if (!done) return { success: false, error: "Yêu cầu đã được xử lý." };
  const r = await tx.redemption.findUniqueOrThrow({ where: { id: redemptionId }, select: { userId: true, price: true, reward: { select: { title: true } } } });
  await tx.notification.create({
    data: {
      userId: r.userId,
      title: "Yêu cầu đổi quà bị từ chối",
      message: `"${r.reward.title}": ${reason}. Đã hoàn ${r.price} điểm.`,
      link: "/rewards",
      type: "SYSTEM",
    },
  });
  return { success: true, message: "Đã từ chối và hoàn điểm." };
}
