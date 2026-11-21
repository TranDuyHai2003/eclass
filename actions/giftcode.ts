"use server";

import { revalidatePath } from "next/cache";
import { auth } from "@/auth";
import { prisma } from "@/lib/prisma";
import { demoGuard } from "@/lib/demo";
import { isPointsEnabled } from "@/lib/points/config";
import type { PointsResult } from "@/lib/points/redemption";
import { createBatch, noteFailure, rateLimited, redeemGiftCodeInTx, validateBatchInput, type GiftCodeBatchInput } from "@/lib/game/giftcode";

const DISABLED: PointsResult = { success: false, error: "Tính năng Xu đang tạm tắt." };

async function requireStaff() {
  const session = await auth();
  if (!session?.user?.id || (session.user.role !== "ADMIN" && session.user.role !== "TEACHER")) throw new Error("Unauthorized");
  return session.user as typeof session.user & { id: string };
}

export type RedeemGiftCodeResult = PointsResult & { currency?: "XU" | "GEM"; amount?: number };

/** Học sinh nhập mã quà tặng */
export async function redeemGiftCode(code: string): Promise<RedeemGiftCodeResult> {
  if (!isPointsEnabled()) return DISABLED;
  const blocked = await demoGuard();
  if (blocked) return blocked;
  const userId = (await auth())?.user?.id;
  if (!userId) return { success: false, error: "Vui lòng đăng nhập." };
  if (rateLimited(userId)) return { success: false, error: "Bạn nhập sai quá nhiều lần, thử lại sau 10 phút nhé." };
  try {
    const res = await prisma.$transaction((tx) => redeemGiftCodeInTx(tx, userId, String(code ?? "")));
    if (!res.success) noteFailure(userId);
    else {
      revalidatePath("/rewards");
      revalidatePath("/");
    }
    return res;
  } catch (err) {
    // Unique (giftCodeId, userId) khi hai tab cùng nhập → coi như đã dùng
    const msg = (err as { code?: string })?.code === "P2002" ? "Bạn đã dùng mã này rồi." : "Không nhập được mã, vui lòng thử lại.";
    if ((err as { code?: string })?.code !== "P2002") console.error("[giftcode] redeem", err);
    noteFailure(userId);
    return { success: false, error: msg };
  }
}

/** Thầy tạo lô mã; trả về các mã để in */
export async function createGiftCodes(input: GiftCodeBatchInput): Promise<PointsResult & { batchId?: string; codes?: string[] }> {
  if (!isPointsEnabled()) return DISABLED;
  const blocked = await demoGuard();
  if (blocked) return blocked;
  const staff = await requireStaff();
  const normalized: GiftCodeBatchInput = {
    count: Number(input.count),
    currency: input.currency === "XU" ? "XU" : "GEM",
    amount: Number(input.amount),
    maxUses: Number(input.maxUses ?? 1),
    expiresAt: input.expiresAt || null,
    classId: input.classId || null,
    note: input.note ?? null,
  };
  const err = validateBatchInput(normalized);
  if (err) return { success: false, error: err };
  if (normalized.classId) {
    const exists = await prisma.studyClass.count({ where: { id: normalized.classId } });
    if (!exists) return { success: false, error: "Lớp không tồn tại." };
  }
  const { batchId, codes } = await createBatch(normalized, staff.id);
  revalidatePath("/teacher/rewards");
  return { success: true, message: `Đã tạo ${codes.length} mã.`, batchId, codes };
}

/** Vô hiệu cả lô (mã chưa dùng không nhập được nữa; lịch sử đã dùng giữ nguyên) */
export async function deactivateGiftBatch(batchId: string): Promise<PointsResult> {
  const blocked = await demoGuard();
  if (blocked) return blocked;
  await requireStaff();
  const r = await prisma.giftCode.updateMany({ where: { batchId, isActive: true }, data: { isActive: false } });
  revalidatePath("/teacher/rewards");
  return r.count ? { success: true, message: `Đã vô hiệu ${r.count} mã.` } : { success: false, error: "Lô này đã vô hiệu." };
}
