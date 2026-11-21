"use server";

import { revalidatePath } from "next/cache";
import { auth } from "@/auth";
import { prisma } from "@/lib/prisma";
import { demoGuard } from "@/lib/demo";
import { isPointsEnabled } from "@/lib/points/config";
import { grantManualInTx, validateManualGrant } from "@/lib/points/manual";
import {
  closeWithRefund,
  deliverInTx,
  redeemInTx,
  rejectInTx,
  type PointsResult,
} from "@/lib/points/redemption";
import { normalizeRewardInput, type RewardInput } from "@/lib/points/reward-input";

/**
 * Server actions của Điểm thưởng: chỉ kiểm tra quyền rồi gọi phần lõi trong lib/points (đã có test ở tests/points).
 */

const DISABLED: PointsResult = { success: false, error: "Tính năng Xu đang tạm tắt." };
const LOGIN: PointsResult = { success: false, error: "Vui lòng đăng nhập." };

function revalidateAll() {
  revalidatePath("/rewards");
  revalidatePath("/teacher/rewards");
}

async function requireStaff() {
  const session = await auth();
  if (!session?.user?.id || (session.user.role !== "ADMIN" && session.user.role !== "TEACHER")) {
    throw new Error("Unauthorized");
  }
  return session.user as typeof session.user & { id: string };
}

// =============================================
// HỌC SINH
// =============================================

export async function redeemReward(rewardId: string): Promise<PointsResult> {
  if (!isPointsEnabled()) return DISABLED;
  const blocked = await demoGuard();
  if (blocked) return blocked;
  const userId = (await auth())?.user?.id;
  if (!userId) return LOGIN;
  try {
    return await prisma.$transaction((tx) => redeemInTx(tx, userId, rewardId));
  } catch (err) {
    console.error("[points] redeemReward", err);
    return { success: false, error: "Không đổi được quà, vui lòng thử lại." };
  } finally {
    revalidateAll();
  }
}

export async function cancelRedemption(redemptionId: string): Promise<PointsResult> {
  const blocked = await demoGuard();
  if (blocked) return blocked;
  const userId = (await auth())?.user?.id;
  if (!userId) return LOGIN;

  const r = await prisma.redemption.findUnique({ where: { id: redemptionId }, select: { userId: true } });
  if (!r || r.userId !== userId) return { success: false, error: "Không tìm thấy yêu cầu." };
  const ok = await prisma.$transaction((tx) => closeWithRefund(tx, redemptionId, "CANCELLED", { handledById: userId }));
  revalidateAll();
  return ok ? { success: true, message: "Đã huỷ và hoàn xu." } : { success: false, error: "Yêu cầu đã được xử lý, không huỷ được." };
}

export async function setGoalReward(rewardId: string | null): Promise<PointsResult> {
  const blocked = await demoGuard();
  if (blocked) return blocked;
  const userId = (await auth())?.user?.id;
  if (!userId) return LOGIN;
  if (rewardId) {
    const exists = await prisma.reward.count({ where: { id: rewardId, isActive: true, deletedAt: null } });
    if (!exists) return { success: false, error: "Quà này không còn." };
  }
  await prisma.pointWallet.upsert({
    where: { userId },
    create: { userId, goalRewardId: rewardId },
    update: { goalRewardId: rewardId },
  });
  revalidatePath("/rewards");
  revalidatePath("/");
  return { success: true };
}

// =============================================
// GIÁO VIÊN
// =============================================

export async function saveReward(input: RewardInput): Promise<PointsResult> {
  const blocked = await demoGuard();
  if (blocked) return blocked;
  const staff = await requireStaff();

  const parsed = normalizeRewardInput(input);
  if ("error" in parsed) return { success: false, error: parsed.error };
  const { data, classIds } = parsed;

  if (input.id) {
    const updated = await prisma.reward.updateMany({ where: { id: input.id, deletedAt: null }, data });
    if (updated.count === 0) return { success: false, error: "Quà này đã bị xoá." };
    await prisma.reward.update({ where: { id: input.id }, data: { classes: { set: classIds.map((id) => ({ id })) } } });
  } else {
    await prisma.reward.create({ data: { ...data, createdById: staff.id, classes: { connect: classIds.map((id) => ({ id })) } } });
  }
  revalidateAll();
  return { success: true, message: input.id ? "Đã lưu quà." : "Đã thêm quà." };
}

/** Xoá mềm (giữ lịch sử đổi quà); yêu cầu đang chờ vẫn giữ để thầy trao hoặc từ chối */
export async function archiveReward(rewardId: string): Promise<PointsResult> {
  const blocked = await demoGuard();
  if (blocked) return blocked;
  await requireStaff();
  await prisma.reward.update({ where: { id: rewardId }, data: { isActive: false, deletedAt: new Date() } });
  await prisma.pointWallet.updateMany({ where: { goalRewardId: rewardId }, data: { goalRewardId: null } });
  revalidateAll();
  return { success: true, message: "Đã xoá quà." };
}

export async function deliverRedemptions(ids: string[]): Promise<PointsResult> {
  const blocked = await demoGuard();
  if (blocked) return blocked;
  const staff = await requireStaff();
  if (!ids?.length) return { success: false, error: "Chưa chọn yêu cầu nào." };
  const done = await prisma.$transaction((tx) => deliverInTx(tx, ids, staff.id));
  revalidateAll();
  if (done === 0) return { success: false, error: "Các yêu cầu này đã được xử lý." };
  return { success: true, message: `Đã đánh dấu ${done} quà đã trao.` + (done < ids.length ? ` Bỏ qua ${ids.length - done} yêu cầu đã huỷ/xử lý.` : "") };
}

export async function rejectRedemption(redemptionId: string, note: string): Promise<PointsResult> {
  const blocked = await demoGuard();
  if (blocked) return blocked;
  const staff = await requireStaff();
  const res = await prisma.$transaction((tx) => rejectInTx(tx, redemptionId, note, staff.id));
  revalidateAll();
  return res;
}

/** Thưởng (số dương) hoặc trừ (số âm) điểm cho nhiều học sinh, bắt buộc có lý do */
export async function grantPoints(input: { userIds: string[]; amount: number; reason: string }): Promise<PointsResult> {
  if (!isPointsEnabled()) return DISABLED;
  const blocked = await demoGuard();
  if (blocked) return blocked;
  const staff = await requireStaff();

  const amount = Number(input.amount);
  const invalid = validateManualGrant(amount, input.reason);
  if (invalid) return { success: false, error: invalid };
  if (!input.userIds?.length) return { success: false, error: "Chưa chọn học sinh." };

  let done = 0;
  let skipped = 0;
  for (const userId of Array.from(new Set(input.userIds))) {
    const r = await prisma.$transaction((tx) => grantManualInTx(tx, { userId, amount, reason: input.reason, staffId: staff.id }));
    if (typeof r === "number") done++;
    else skipped++;
  }
  revalidateAll();
  if (done === 0) {
    return { success: false, error: "Không áp dụng được (học sinh chưa duyệt hoặc đã đủ giới hạn xu thưởng tay hôm nay)." };
  }
  return {
    success: true,
    message: `Đã ${amount > 0 ? "thưởng" : "trừ"} xu cho ${done} học sinh` + (skipped ? `, bỏ qua ${skipped} (chưa duyệt hoặc đủ giới hạn ngày).` : "."),
  };
}
