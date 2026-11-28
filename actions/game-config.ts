"use server";

import { revalidatePath } from "next/cache";
import { auth } from "@/auth";
import { demoGuard } from "@/lib/demo";
import { normalizeChestConfig, normalizeEarning, normalizeItemPrices, writeGameConfig } from "@/lib/game/game-config";

/**
 * Admin sửa giá thú cưng / khung viền / bảng tên và mức xu các hoạt động (khu Quản lý trong Tiệm quà).
 * Chỉ ADMIN. Giá trị gửi lên là TOÀN BỘ phần ghi đè (món / mục không có = về mặc định).
 * PLAN: docs/ai-reviews/game-config/PLAN.md
 */
type Result = { success: true; message: string } | { success: false; error: string };

async function requireAdmin() {
  const session = await auth();
  if (!session?.user?.id || session.user.role !== "ADMIN") return null;
  return session.user.id;
}

function revalidate() {
  revalidatePath("/rewards");
  revalidatePath("/profile");
  revalidatePath("/");
}

export async function saveItemPrices(input: unknown): Promise<Result> {
  const blocked = await demoGuard();
  if (blocked) return blocked;
  const adminId = await requireAdmin();
  if (!adminId) return { success: false, error: "Chỉ admin được sửa giá." };
  const parsed = normalizeItemPrices(input);
  if ("error" in parsed) return { success: false, error: parsed.error };
  await writeGameConfig("itemPrices", parsed.data, adminId);
  revalidate();
  return { success: true, message: "Đã lưu giá đồ trang trí." };
}

export async function saveEarningConfig(input: unknown): Promise<Result> {
  const blocked = await demoGuard();
  if (blocked) return blocked;
  const adminId = await requireAdmin();
  if (!adminId) return { success: false, error: "Chỉ admin được sửa mức xu." };
  const parsed = normalizeEarning(input);
  if ("error" in parsed) return { success: false, error: parsed.error };
  await writeGameConfig("earning", parsed.data, adminId);
  revalidate();
  return { success: true, message: "Đã lưu mức xu các hoạt động." };
}

/** Giá mở rương + lượt Rương Xu mỗi ngày (28/11) — chỉ admin */
export async function saveChestConfig(input: unknown): Promise<Result> {
  const blocked = await demoGuard();
  if (blocked) return blocked;
  const adminId = await requireAdmin();
  if (!adminId) return { success: false, error: "Chỉ admin được sửa giá rương." };
  const parsed = normalizeChestConfig(input);
  if ("error" in parsed) return { success: false, error: parsed.error };
  await writeGameConfig("chests", parsed.data, adminId);
  revalidate();
  revalidatePath("/rewards/gacha");
  return { success: true, message: "Đã lưu giá rương." };
}
