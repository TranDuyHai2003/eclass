import { prisma } from "@/lib/prisma";
import { isEligibleStudent, lockWallet, writeEntry, type Tx } from "@/lib/points/engine";
import type { PointsResult } from "@/lib/points/redemption";
import { ITEM_BY_ID, type Item } from "./items";
import { getLevel } from "@/lib/points/levels";
import { sanitizeAvatar, type AvatarConfig } from "./avatar";

/** Đồ đã sở hữu (itemId) */
/** Món còn hạn (biệt danh 24 giờ của nhiệm vụ ẩn hết hạn thì coi như không còn) */
export const NOT_EXPIRED = () => ({ OR: [{ expiresAt: null }, { expiresAt: { gt: new Date() } }] });

export async function getOwnedItemIds(userId: string, tx?: Tx) {
  const rows: { itemId: string }[] = await (tx ?? prisma).userItem.findMany({ where: { userId, ...NOT_EXPIRED() }, select: { itemId: true } });
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

/**
 * Kiểu tóc "Hot" (thẻ kiểu tóc ở Tùy chỉnh): mỗi giới 2 kiểu được nhiều bạn dùng nhất (ít nhất 2 người),
 * bỏ kiểu mặc định (tóc ngắn / tóc bob) vì ai chưa đổi cũng dùng.
 */
export async function getHotHair(): Promise<string[]> {
  const rows = await prisma.$queryRaw<{ hair: string; n: number }[]>`
    SELECT config->>'hair' AS hair, COUNT(*)::int AS n FROM "UserAvatar"
    WHERE config->>'hair' IS NOT NULL GROUP BY 1 ORDER BY n DESC`;
  const hot: string[] = [];
  for (const g of ["male", "female"] as const) {
    hot.push(...rows.filter((r) => r.n >= 2 && r.hair !== "hair-short" && r.hair !== "hair-bob" && ITEM_BY_ID[r.hair]?.slot === "hair" && ITEM_BY_ID[r.hair]?.gender === g).slice(0, 2).map((r) => r.hair));
  }
  return hot;
}

/** Nhiều nhân vật một lúc (bảng vàng): 2 truy vấn `in` */
/** Client tối thiểu để đọc nhân vật (prisma thường hoặc prismaBase trong unstable_cache) */
type AvatarDb = {
  userAvatar: { findMany(args: { where: { userId: { in: string[] } }; select: { userId: true; config: true } }): Promise<{ userId: string; config: unknown }[]> };
  userItem: { findMany(args: { where: { userId: { in: string[] } }; select: { userId: true; itemId: true } }): Promise<{ userId: string; itemId: string }[]> };
};

export async function getAvatars(userIds: string[], client: AvatarDb = prisma) {
  if (userIds.length === 0) return new Map<string, AvatarConfig>();
  const [rows, items] = await Promise.all([
    client.userAvatar.findMany({ where: { userId: { in: userIds } }, select: { userId: true, config: true } }),
    client.userItem.findMany({ where: { userId: { in: userIds }, ...NOT_EXPIRED() }, select: { userId: true, itemId: true } }),
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
  // Món mở theo cấp (canvas "Tiệm quà v2"): cấp tính theo xu tích luỹ, tiêu xu không làm tụt cấp
  if (item.minLevel && getLevel(wallet.lifetimeEarned).level < item.minLevel) return { success: false, error: `Cần đạt Lv.${item.minLevel} để mở khoá "${item.name}".` };

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

export type BundleResult = PointsResult & { bought?: Item[] };

/** Lỗi nội bộ để rollback cả giao dịch khi một món trong bộ không mua được */
export class BundleAbort extends Error {}

/**
 * Mua cả bộ (Mẫu nhân vật): được cả bộ hoặc không món nào.
 * Bỏ qua món miễn phí / đã sở hữu; còn món chỉ-từ-rương thì từ chối trước khi ghi; kiểm tổng xu/ngọc sau khi khoá ví;
 * mua lần lượt bằng `buyItemInTx` (cùng tx) — món nào lỗi → ném BundleAbort để huỷ mọi bút toán trước đó.
 */
export async function buyBundleInTx(tx: Tx, userId: string, itemIds: string[]): Promise<BundleResult> {
  const ids = [...new Set(itemIds.filter((x): x is string => typeof x === "string" && x.length > 0))].slice(0, 12);
  const items = ids.map((id) => ITEM_BY_ID[id]);
  if (items.length === 0 || items.some((i) => !i)) return { success: false, error: "Bộ đồ không hợp lệ." };
  if (!(await isEligibleStudent(tx, userId))) return { success: false, error: "Tài khoản cần được thầy duyệt mới mua được đồ." };
  const wallet = await lockWallet(tx, userId);
  const ownedRows: { itemId: string }[] = await tx.userItem.findMany({ where: { userId, itemId: { in: ids } }, select: { itemId: true } });
  const owned = new Set(ownedRows.map((r) => r.itemId));
  const missing = items.filter((i) => !i.free && !owned.has(i.id));
  // Đã đủ (vd tab khác vừa mua xong, hoặc bấm đúp): thành công, không ghi sổ
  if (missing.length === 0) return { success: true, message: "Bạn đã có đủ các món trong bộ này ✨", bought: [] };
  const gachaOnly = missing.filter((i) => !i.price);
  if (gachaOnly.length) return { success: false, error: `Bộ này cần món chỉ có trong rương: ${gachaOnly.map((i) => i.name).join(", ")}.` };
  const xu = missing.reduce((n, i) => n + (i.price && "xu" in i.price ? i.price.xu : 0), 0);
  const gem = missing.reduce((n, i) => n + (i.price && "gem" in i.price ? i.price.gem : 0), 0);
  if (wallet.balance < xu) return { success: false, error: `Bạn cần thêm ${(xu - wallet.balance).toLocaleString("vi-VN")} xu để mua cả bộ.` };
  if (wallet.gems < gem) return { success: false, error: `Bạn cần thêm ${gem - wallet.gems} ngọc để mua cả bộ.` };
  for (const item of missing) {
    const res = await buyItemInTx(tx, userId, item.id);
    if (!res.success) throw new BundleAbort(res.error);
  }
  return { success: true, message: `Đã mua cả bộ (${missing.length} món) 🎉`, bought: missing };
}

/** Lưu trang bị: chỉ nhận món miễn phí hoặc đã sở hữu; không tốn tiền */
export async function saveAvatarConfig(userId: string, raw: unknown) {
  const owned = await getOwnedItemIds(userId);
  const config = sanitizeAvatar(raw, userId, owned);
  await prisma.userAvatar.upsert({ where: { userId }, create: { userId, config }, update: { config } });
  return config;
}
