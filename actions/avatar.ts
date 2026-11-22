"use server";

import { revalidatePath } from "next/cache";
import { auth } from "@/auth";
import { prisma } from "@/lib/prisma";
import { demoGuard } from "@/lib/demo";
import { isPointsEnabled } from "@/lib/points/config";
import type { PointsResult } from "@/lib/points/redemption";
import { BundleAbort, buyBundleInTx, buyItemInTx, saveAvatarConfig, type BundleResult, type BuyResult } from "@/lib/game/inventory";
import type { AvatarConfig } from "@/lib/game/avatar";

const LOGIN: PointsResult = { success: false, error: "Vui lòng đăng nhập." };

function revalidate(userId: string) {
  revalidatePath("/rewards");
  revalidatePath("/profile");
  revalidatePath(`/profile/${userId}`);
  revalidatePath("/");
}

/** Học sinh mua đồ trang trí bằng xu/ngọc */
export async function buyItem(itemId: string): Promise<BuyResult> {
  if (!isPointsEnabled()) return { success: false, error: "Tính năng Xu đang tạm tắt." };
  const blocked = await demoGuard();
  if (blocked) return blocked;
  const userId = (await auth())?.user?.id;
  if (!userId) return LOGIN;
  try {
    const res = await prisma.$transaction((tx) => buyItemInTx(tx, userId, String(itemId ?? "")));
    if (res.success) revalidate(userId);
    return res;
  } catch (err) {
    if ((err as { code?: string })?.code === "P2002") return { success: false, error: "Bạn đã có món này rồi." };
    console.error("[avatar] buyItem", err);
    return { success: false, error: "Không mua được, vui lòng thử lại." };
  }
}

/** Mua cả bộ "Mẫu nhân vật" (một giao dịch, được cả bộ hoặc không món nào) */
export async function buyBundle(itemIds: string[]): Promise<BundleResult> {
  if (!isPointsEnabled()) return { success: false, error: "Tính năng Xu đang tạm tắt." };
  const blocked = await demoGuard();
  if (blocked) return blocked;
  const userId = (await auth())?.user?.id;
  if (!userId) return LOGIN;
  if (!Array.isArray(itemIds)) return { success: false, error: "Bộ đồ không hợp lệ." };
  try {
    const res = await prisma.$transaction((tx) => buyBundleInTx(tx, userId, itemIds.map(String)));
    if (res.success) revalidate(userId);
    return res;
  } catch (err) {
    if (err instanceof BundleAbort) return { success: false, error: err.message || "Không mua được cả bộ." };
    if ((err as { code?: string })?.code === "P2002") return { success: false, error: "Có món trong bộ bạn vừa mua ở tab khác — tải lại trang nhé." };
    console.error("[avatar] buyBundle", err);
    return { success: false, error: "Không mua được, vui lòng thử lại." };
  }
}

/** Lưu nhân vật (trang bị). Ai cũng lưu được kể cả chưa duyệt (chỉ đồ miễn phí); demo bị chặn. */
export async function saveAvatar(config: AvatarConfig): Promise<PointsResult & { config?: AvatarConfig }> {
  const blocked = await demoGuard();
  if (blocked) return blocked;
  const userId = (await auth())?.user?.id;
  if (!userId) return LOGIN;
  const saved = await saveAvatarConfig(userId, config);
  revalidate(userId);
  return { success: true, message: "Đã lưu nhân vật ✨", config: saved };
}
