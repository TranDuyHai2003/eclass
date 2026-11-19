"use server";

import { revalidatePath } from "next/cache";
import { auth } from "@/auth";
import { prisma } from "@/lib/prisma";
import { demoGuard } from "@/lib/demo";
import { POINTS, isPointsEnabled } from "@/lib/points/config";
import { isEligibleStudent, lockWallet, vietnamDayStart, writeEntry } from "@/lib/points/engine";
import { closeWithRefund, monthlyRedemptionCount, visibleRewardWhere } from "@/lib/points/redemption";

type Result = { success: true; message?: string } | { success: false; error: string };

const DISABLED: Result = { success: false, error: "Tính năng Điểm thưởng đang tạm tắt." };

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

export async function redeemReward(rewardId: string): Promise<Result> {
  if (!isPointsEnabled()) return DISABLED;
  const blocked = await demoGuard();
  if (blocked) return blocked;
  const session = await auth();
  const userId = session?.user?.id;
  if (!userId) return { success: false, error: "Vui lòng đăng nhập." };

  try {
    return await prisma.$transaction(async (tx): Promise<Result> => {
      if (!(await isEligibleStudent(tx, userId))) {
        return { success: false, error: "Chỉ học sinh đã được duyệt mới đổi được quà." };
      }
      const user = await tx.user.findUniqueOrThrow({ where: { id: userId }, select: { classId: true, studentType: true } });
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
        // Trừ kho có điều kiện → nhiều bạn bấm cùng lúc cũng không đổi quá số quà còn lại
        const taken = await tx.reward.updateMany({
          where: { id: reward.id, stock: { gt: 0 } },
          data: { stock: { decrement: 1 } },
        });
        if (taken.count === 0) return { success: false, error: "Quà này vừa hết." };
      }

      const redemption = await tx.redemption.create({
        data: { userId, rewardId: reward.id, price: reward.price },
        select: { id: true },
      });
      await writeEntry(tx, {
        userId,
        amount: -reward.price,
        source: "REDEEM",
        refId: redemption.id,
        reason: `Đổi quà "${reward.title}"`,
      });
      // Đổi xong món đang đặt làm mục tiêu → bỏ mục tiêu
      await tx.pointWallet.updateMany({ where: { userId, goalRewardId: reward.id }, data: { goalRewardId: null } });
      return { success: true, message: `Đã đổi "${reward.title}". Thầy sẽ trao quà ở buổi học tới.` };
    });
  } catch (err) {
    console.error("[points] redeemReward", err);
    return { success: false, error: "Không đổi được quà, vui lòng thử lại." };
  } finally {
    revalidateAll();
  }
}

export async function cancelRedemption(redemptionId: string): Promise<Result> {
  const blocked = await demoGuard();
  if (blocked) return blocked;
  const session = await auth();
  const userId = session?.user?.id;
  if (!userId) return { success: false, error: "Vui lòng đăng nhập." };

  const r = await prisma.redemption.findUnique({ where: { id: redemptionId }, select: { userId: true } });
  if (!r || r.userId !== userId) return { success: false, error: "Không tìm thấy yêu cầu." };
  const ok = await prisma.$transaction((tx) => closeWithRefund(tx, redemptionId, "CANCELLED", { handledById: userId }));
  revalidateAll();
  return ok ? { success: true, message: "Đã huỷ và hoàn điểm." } : { success: false, error: "Yêu cầu đã được xử lý, không huỷ được." };
}

export async function setGoalReward(rewardId: string | null): Promise<Result> {
  const blocked = await demoGuard();
  if (blocked) return blocked;
  const session = await auth();
  const userId = session?.user?.id;
  if (!userId) return { success: false, error: "Vui lòng đăng nhập." };
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

export interface RewardInput {
  id?: string;
  title: string;
  description?: string | null;
  emoji?: string | null;
  price: number;
  stock?: number | null;
  perStudentMonthlyLimit?: number | null;
  kind: "PHYSICAL" | "VIRTUAL";
  costVnd?: number | null;
  classIds: string[];
  isActive: boolean;
}

const intOrNull = (v: unknown) => {
  if (v === null || v === undefined || v === "") return null;
  const n = Math.floor(Number(v));
  return Number.isFinite(n) && n >= 0 ? n : null;
};

export async function saveReward(input: RewardInput): Promise<Result> {
  const blocked = await demoGuard();
  if (blocked) return blocked;
  const staff = await requireStaff();

  const title = input.title?.trim();
  const price = Math.floor(Number(input.price));
  if (!title) return { success: false, error: "Nhập tên quà." };
  if (!Number.isFinite(price) || price < 1 || price > 100000) return { success: false, error: "Giá phải từ 1 điểm trở lên." };

  const data = {
    title: title.slice(0, 120),
    description: input.description?.trim().slice(0, 500) || null,
    emoji: input.emoji?.trim().slice(0, 16) || null,
    price,
    stock: intOrNull(input.stock),
    perStudentMonthlyLimit: intOrNull(input.perStudentMonthlyLimit) || null,
    kind: input.kind === "VIRTUAL" ? ("VIRTUAL" as const) : ("PHYSICAL" as const),
    // Quà hiện vật nhận tại lớp → chỉ học sinh offline
    offlineOnly: input.kind !== "VIRTUAL",
    costVnd: intOrNull(input.costVnd),
    isActive: !!input.isActive,
  };
  const classes = { set: (input.classIds || []).map((id) => ({ id })) };

  if (input.id) {
    await prisma.reward.update({ where: { id: input.id }, data: { ...data, classes } });
  } else {
    await prisma.reward.create({
      data: { ...data, createdById: staff.id, classes: { connect: (input.classIds || []).map((id) => ({ id })) } },
    });
  }
  revalidateAll();
  return { success: true, message: input.id ? "Đã lưu quà." : "Đã thêm quà." };
}

/** Xoá mềm (giữ lịch sử đổi quà); yêu cầu đang chờ vẫn giữ để thầy trao hoặc từ chối */
export async function archiveReward(rewardId: string): Promise<Result> {
  const blocked = await demoGuard();
  if (blocked) return blocked;
  await requireStaff();
  await prisma.reward.update({ where: { id: rewardId }, data: { isActive: false, deletedAt: new Date() } });
  await prisma.pointWallet.updateMany({ where: { goalRewardId: rewardId }, data: { goalRewardId: null } });
  revalidateAll();
  return { success: true, message: "Đã xoá quà." };
}

export async function deliverRedemptions(ids: string[]): Promise<Result> {
  const blocked = await demoGuard();
  if (blocked) return blocked;
  const staff = await requireStaff();
  if (!ids.length) return { success: false, error: "Chưa chọn yêu cầu nào." };

  const targets = await prisma.redemption.findMany({
    where: { id: { in: ids }, status: "PENDING" },
    select: { id: true, userId: true, reward: { select: { title: true } } },
  });
  await prisma.$transaction(async (tx) => {
    await tx.redemption.updateMany({
      where: { id: { in: targets.map((t) => t.id) }, status: "PENDING" },
      data: { status: "DELIVERED", handledById: staff.id, handledAt: new Date() },
    });
    await tx.notification.createMany({
      data: targets.map((t) => ({
        userId: t.userId,
        title: "Đã nhận quà 🎁",
        message: `Thầy đã trao quà "${t.reward.title}". Chúc mừng bạn!`,
        link: "/rewards",
        type: "SYSTEM" as const,
      })),
    });
  });
  revalidateAll();
  return { success: true, message: `Đã đánh dấu ${targets.length} quà đã trao.` };
}

export async function rejectRedemption(redemptionId: string, note: string): Promise<Result> {
  const blocked = await demoGuard();
  if (blocked) return blocked;
  const staff = await requireStaff();
  const reason = note?.trim();
  if (!reason) return { success: false, error: "Nhập lý do từ chối để học sinh biết." };

  const ok = await prisma.$transaction(async (tx) => {
    const done = await closeWithRefund(tx, redemptionId, "REJECTED", { note: reason.slice(0, 300), handledById: staff.id });
    if (done) {
      const r = await tx.redemption.findUniqueOrThrow({
        where: { id: redemptionId },
        select: { userId: true, price: true, reward: { select: { title: true } } },
      });
      await tx.notification.create({
        data: {
          userId: r.userId,
          title: "Yêu cầu đổi quà bị từ chối",
          message: `"${r.reward.title}": ${reason}. Đã hoàn ${r.price} điểm.`,
          link: "/rewards",
          type: "SYSTEM",
        },
      });
    }
    return done;
  });
  revalidateAll();
  return ok ? { success: true, message: "Đã từ chối và hoàn điểm." } : { success: false, error: "Yêu cầu đã được xử lý." };
}

/** Thưởng (số dương) hoặc trừ (số âm) điểm cho nhiều học sinh, bắt buộc có lý do */
export async function grantPoints(input: { userIds: string[]; amount: number; reason: string }): Promise<Result> {
  if (!isPointsEnabled()) return DISABLED;
  const blocked = await demoGuard();
  if (blocked) return blocked;
  const staff = await requireStaff();

  const amount = Math.trunc(Number(input.amount));
  const reason = input.reason?.trim();
  const max = POINTS.manual.maxPerGrant;
  if (!amount || Math.abs(amount) > max) return { success: false, error: `Số điểm từ -${max} đến ${max} (khác 0).` };
  if (!reason) return { success: false, error: "Nhập lý do để học sinh biết vì sao được thưởng/bị trừ." };
  if (!input.userIds?.length) return { success: false, error: "Chưa chọn học sinh." };

  let done = 0;
  const skipped: string[] = [];
  for (const userId of Array.from(new Set(input.userIds))) {
    const r = await prisma.$transaction(async (tx) => {
      if (!(await isEligibleStudent(tx, userId))) return "skip";
      await lockWallet(tx, userId);
      let value = amount;
      if (amount > 0) {
        const today = await tx.pointLedger.aggregate({
          where: { userId, source: "MANUAL", amount: { gt: 0 }, createdAt: { gte: vietnamDayStart() } },
          _sum: { amount: true },
        });
        value = Math.min(amount, POINTS.manual.dailyCapPerStudent - (today._sum.amount ?? 0));
        if (value <= 0) return "cap";
      }
      await writeEntry(tx, { userId, amount: value, source: "MANUAL", reason: reason.slice(0, 200), createdById: staff.id });
      await tx.notification.create({
        data: {
          userId,
          title: value > 0 ? `Thầy thưởng ${value} điểm thưởng ⭐` : `Bị trừ ${-value} điểm thưởng`,
          message: reason.slice(0, 200),
          link: "/rewards",
          type: "SYSTEM",
        },
      });
      return "ok";
    });
    if (r === "ok") done++;
    else skipped.push(userId);
  }
  revalidateAll();
  if (done === 0) {
    return { success: false, error: `Không áp dụng được (học sinh chưa duyệt hoặc đã đủ ${POINTS.manual.dailyCapPerStudent} điểm thưởng tay hôm nay).` };
  }
  return {
    success: true,
    message: `Đã ${amount > 0 ? "thưởng" : "trừ"} điểm cho ${done} học sinh` + (skipped.length ? `, bỏ qua ${skipped.length} (chưa duyệt hoặc đủ giới hạn ngày).` : "."),
  };
}
