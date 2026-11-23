"use server";

import { revalidatePath } from "next/cache";
import { auth } from "@/auth";
import { prisma } from "@/lib/prisma";
import { demoGuard } from "@/lib/demo";
import { isPointsEnabled } from "@/lib/points/config";
import { canUseShop } from "@/lib/points/shop-access";
import { isGachaEnabled, pullInTx, type ChestId, type PullResult } from "@/lib/game/gacha";

/** Học sinh mở một rương. Kết quả tính ở server; client chỉ diễn hoạt ảnh. */
export async function openChest(chestId: ChestId): Promise<PullResult> {
  if (!isPointsEnabled() || !isGachaEnabled()) return { success: false, error: "Rương bí ẩn đang tạm đóng." };
  const blocked = await demoGuard();
  if (blocked) return blocked;
  const me = (await auth())?.user;
  const userId = me?.id;
  if (!userId) return { success: false, error: "Vui lòng đăng nhập." };
  if (!canUseShop(me)) return { success: false, error: "Tiệm quà đang mở thử cho lớp offline." };
  if (chestId !== "xu" && chestId !== "gem") return { success: false, error: "Rương không tồn tại." };
  try {
    const res = await prisma.$transaction((tx) => pullInTx(tx, userId, chestId), { timeout: 15000 });
    if (res.success) {
      revalidatePath("/rewards/gacha");
      revalidatePath("/rewards");
      revalidatePath("/profile/avatar");
    }
    return res;
  } catch (err) {
    console.error("[gacha] openChest", err);
    return { success: false, error: "Không mở được rương, vui lòng thử lại." };
  }
}
