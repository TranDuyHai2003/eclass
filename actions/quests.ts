"use server";

import { revalidatePath } from "next/cache";
import { auth } from "@/auth";
import { demoGuard } from "@/lib/demo";
import { canUseShop } from "@/lib/points/shop-access";
import { CAT_PETS_PER_DAY, runQuestsSafely } from "@/lib/game/quests";

/**
 * Vuốt ve mèo chủ tiệm đủ 20 lần trong ngày (máy học sinh tự đếm) → biệt danh 24 giờ "Con Sen Nghiện Mèo".
 * Nhiệm vụ cho vui, không có thưởng xu → tin số đếm của máy; grantQuestInTx không cấp lại khi biệt danh còn hạn.
 */
export async function claimCatQuest(pets: number): Promise<{ unlocked: boolean }> {
  if (!Number.isFinite(pets) || pets < CAT_PETS_PER_DAY) return { unlocked: false };
  if (await demoGuard()) return { unlocked: false };
  const me = (await auth())?.user;
  if (!me?.id || me.role !== "STUDENT" || !canUseShop(me)) return { unlocked: false };
  const got = await runQuestsSafely("claimCatQuest", me.id, async () => ["catlover"]);
  if (got.length) revalidatePath("/rewards");
  return { unlocked: got.length > 0 };
}
