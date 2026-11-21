import { prisma } from "@/lib/prisma";
import { isEligibleStudent, lockWallet, writeEntry, type Tx } from "@/lib/points/engine";
import type { PointsResult } from "@/lib/points/redemption";
import { ITEM_BY_ID, type Item } from "./items";
import { sanitizeAvatar, type AvatarConfig } from "./avatar";

/** Đồ đã sở hữu (itemId) */
export async function getOwnedItemIds(userId: string, tx?: Tx) {
  const rows: { itemId: string }[] = await (tx ?? prisma).userItem.findMany({ where: { userId }, select: { itemId: true } });
  return rows.map((r) => r.itemId);
}

/** Cấu hình nhân vật đã làm sạch (món không hợp lệ/không sở hữu → mặc định) */
export async function getAvatar(userId: string) {
  const [row, owned] = await Promise.all([
    prisma.userAvatar.findUnique({ where: { userId }, select: { config: true } }),
    getOwnedItemIds(userId),
  ]);
  return { config: sanitizeAvatar(row?.config, userId, owned), owned };
}

/** Nhiều nhân vật một lúc (bảng vàng): 2 truy vấn `in` */
export async function getAvatars(userIds: string[]) {
  if (userIds.length === 0) return new Map<string, AvatarConfig>();
  const [rows, items] = await Promise.all([
    prisma.userAvatar.findMany({ where: { userId: { in: userIds } }, select: { userId: true, config: true } }),
    prisma.userItem.findMany({ where: { userId: { in: userIds } }, select: { userId: true, itemId: true } }),
  ]);
  const ownedBy = new Map<string, string[]>();
  for (const it of items) ownedBy.set(it.userId, [...(ownedBy.get(it.userId) ?? []), it.itemId]);
  const cfgBy = new Map(rows.map((r) => [r.userId, r.config]));
  return new Map(userIds.map((id) => [id, sanitizeAvatar(cfgBy.get(id), id, ownedBy.get(id) ?? [])]));
}

export type BuyResult = PointsResult & { item?: Item };

/**
 * Mua đồ trang trí: học sinh hợp lệ → khoá ví → món có bán → chưa sở hữu → đủ tiền → ghi sổ ITEM (âm) → tạo UserItem.
 * Unique (userId, itemId) chặn mua trùng khi hai tab cùng bấm; bấm hai lần → lần sau thấy đã sở hữu.
 */
export async function buyItemInTx(tx: Tx, userId: string, itemId: string): Promise<BuyResult> {
  const item = ITEM_BY_ID[itemId];
  if (!item || !item.price) return { success: false, error: "Món này không bán trong tiệm." };
  if (!(await isEligibleStudent(tx, userId))) return { success: false, error: "Tài khoản cần được thầy duyệt mới mua được đồ." };
  const wallet = await lockWallet(tx, userId);
  const owned = await tx.userItem.count({ where: { userId, itemId } });
  if (owned > 0) return { success: false, error: "Bạn đã có món này rồi." };

  if ("xu" in item.price) {
    if (wallet.balance < item.price.xu) {
      return { success: false, error: `Bạn cần thêm ${(item.price.xu - wallet.balance).toLocaleString("vi-VN")} xu.` };
    }
    await writeEntry(tx, { userId, amount: -item.price.xu, source: "ITEM", key: `ITEM:${itemId}`, refId: itemId, reason: `Mua "${item.name}"` });
  } else {
    if (wallet.gems < item.price.gem) {
      return { success: false, error: `Bạn cần thêm ${item.price.gem - wallet.gems} ngọc.` };
    }
    await writeEntry(tx, { userId, amount: -item.price.gem, source: "ITEM", key: `ITEM:${itemId}`, refId: itemId, reason: `Mua "${item.name}"`, currency: "GEM" });
  }
  await tx.userItem.create({ data: { userId, itemId, source: "SHOP" } });
  return { success: true, message: `Đã mua "${item.name}" 🎉`, item };
}

/** Lưu trang bị: chỉ nhận món miễn phí hoặc đã sở hữu; không tốn tiền */
export async function saveAvatarConfig(userId: string, raw: unknown) {
  const owned = await getOwnedItemIds(userId);
  const config = sanitizeAvatar(raw, userId, owned);
  await prisma.userAvatar.upsert({ where: { userId }, create: { userId, config }, update: { config } });
  return config;
}
