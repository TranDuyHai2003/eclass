import { randomInt } from "crypto";
import { prisma } from "@/lib/prisma";
import { isEligibleStudent, lockWallet, vietnamDayStart, writeEntry, type Tx } from "@/lib/points/engine";
import type { PointsResult } from "@/lib/points/redemption";
import { CHESTS, roll, type ChestId, type Outcome } from "./gacha-shared";
import { getOwnedItemIds } from "./inventory";

export { CHESTS, ratesTable, roll } from "./gacha-shared";
export type { ChestId, Outcome } from "./gacha-shared";

/** Tắt toàn bộ gacha: GACHA_ENABLED=off (không cần deploy lại) */
export function isGachaEnabled() {
  return (process.env.GACHA_ENABLED ?? "on").toLowerCase() !== "off";
}

/** RNG mật mã, [0, 1) */
export const secureRng = () => randomInt(0, 1_000_000) / 1_000_000;

export type PullResult = (PointsResult & { outcome?: Outcome; guaranteed?: boolean; pity?: number; wallet?: { balance: number; gems: number } });

/**
 * Mở rương (lõi, trong giao dịch): hợp lệ → khoá ví → trần ngày → đủ tiền → tính kết quả ở server →
 * ghi GachaPull → ghi sổ tiêu (GACHA:{pullId}) → trao đồ / ghi sổ trúng (GACHAWIN:{pullId}) → cập nhật bảo hiểm.
 * Hai lượt cùng lúc: khoá ví làm tuần tự; lượt sau thiếu tiền hoặc chạm trần → lỗi, không trừ gì.
 */
export async function pullInTx(tx: Tx, userId: string, chestId: ChestId, rng: () => number = secureRng, now: Date = new Date()): Promise<PullResult> {
  const chest = CHESTS[chestId];
  if (!chest) return { success: false, error: "Rương không tồn tại." };
  if (!isGachaEnabled()) return { success: false, error: "Rương bí ẩn đang tạm đóng." };
  if (!(await isEligibleStudent(tx, userId))) return { success: false, error: "Tài khoản cần được thầy duyệt mới mở được rương." };

  const wallet = await lockWallet(tx, userId);

  if (chest.dailyLimit !== null) {
    const today = await tx.gachaPull.count({ where: { userId, chest: chestId, createdAt: { gte: vietnamDayStart(now) } } });
    if (today >= chest.dailyLimit) return { success: false, error: `Mỗi ngày chỉ mở được ${chest.dailyLimit} ${chest.name}. Mai quay lại nhé!` };
  }
  if ("xu" in chest.cost && wallet.balance < chest.cost.xu) {
    return { success: false, error: `Bạn cần thêm ${(chest.cost.xu - wallet.balance).toLocaleString("vi-VN")} xu để mở rương.` };
  }
  if ("gem" in chest.cost && wallet.gems < chest.cost.gem) {
    return { success: false, error: `Bạn cần thêm ${chest.cost.gem - wallet.gems} ngọc để mở rương.` };
  }

  const owned = new Set(await getOwnedItemIds(userId, tx));
  const { outcome, pityAfter, guaranteed } = roll(chestId, rng, chestId === "xu" ? wallet.gachaPity : 0, owned);

  const pull = await tx.gachaPull.create({
    data: {
      userId,
      chest: chestId,
      currency: "xu" in chest.cost ? "XU" : "GEM",
      cost: "xu" in chest.cost ? chest.cost.xu : chest.cost.gem,
      outcome: outcome as object,
      pityBefore: wallet.gachaPity,
      createdAt: now,
    },
  });

  if ("xu" in chest.cost) {
    await writeEntry(tx, { userId, amount: -chest.cost.xu, source: "GACHA", key: `GACHA:${pull.id}`, refId: pull.id, reason: `Mở ${chest.name}` });
  } else {
    await writeEntry(tx, { userId, amount: -chest.cost.gem, source: "GACHA", key: `GACHA:${pull.id}`, refId: pull.id, reason: `Mở ${chest.name}`, currency: "GEM" });
  }

  if (outcome.kind === "item") {
    if (outcome.duplicate) {
      await writeEntry(tx, { userId, amount: outcome.refundXu, source: "GACHA", key: `GACHAWIN:${pull.id}`, refId: pull.id, reason: `Trùng "${outcome.name}" → nhận lại xu` });
    } else {
      await tx.userItem.create({ data: { userId, itemId: outcome.itemId, source: "GACHA" } });
    }
  } else if (outcome.kind === "xu") {
    await writeEntry(tx, { userId, amount: outcome.amount, source: "GACHA", key: `GACHAWIN:${pull.id}`, refId: pull.id, reason: `Trúng ${outcome.amount} xu từ ${chest.name}` });
  } else {
    await writeEntry(tx, { userId, amount: outcome.amount, source: "GACHA", key: `GACHAWIN:${pull.id}`, refId: pull.id, reason: `Trúng ${outcome.amount} ngọc từ ${chest.name}`, currency: "GEM" });
  }

  if (chestId === "xu") await tx.pointWallet.update({ where: { userId }, data: { gachaPity: pityAfter } });

  const w = await tx.pointWallet.findUniqueOrThrow({ where: { userId }, select: { balance: true, gems: true } });
  return { success: true, outcome, guaranteed, pity: pityAfter, wallet: w };
}

/** Số lượt Rương Xu đã mở hôm nay (giờ VN) */
export async function pullsToday(userId: string, chestId: ChestId = "xu", now: Date = new Date()) {
  return prisma.gachaPull.count({ where: { userId, chest: chestId, createdAt: { gte: vietnamDayStart(now) } } });
}

/** Lịch sử gần nhất để hiện ở trang rương */
export async function recentPulls(userId: string, take = 10) {
  const rows = await prisma.gachaPull.findMany({ where: { userId }, orderBy: { createdAt: "desc" }, take, select: { id: true, chest: true, outcome: true, createdAt: true } });
  return rows.map((r) => ({ id: r.id, chest: r.chest as ChestId, outcome: r.outcome as unknown as Outcome, createdAt: r.createdAt.toISOString() }));
}
