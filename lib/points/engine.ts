import type { Currency, PointSource } from "@prisma/client";
import { prisma } from "@/lib/prisma";
import { getVietnamWeekStart, getWeekCode, VN_UTC_OFFSET_MS } from "@/lib/ranking/history-engine";
import { AUTO_CAPPED_SOURCES, EARNING_SOURCES, POINTS, STREAK_ACTIVITY_SOURCES, isPointsEnabled } from "./config";

/**
 * Lõi Điểm thưởng. Mọi thay đổi điểm đi qua các hàm ở đây:
 * - Ghi một dòng vào PointLedger (không sửa/xoá dòng cũ) và cập nhật PointWallet trong CÙNG giao dịch.
 * - Khoá dòng ví (SELECT … FOR UPDATE) → các thao tác của cùng một học sinh chạy tuần tự, không cộng trùng khi bấm 2 lần.
 * - "Khoá logic" (key): chỉ cộng khi tổng các dòng cùng khoá = 0 → nộp lại/mở lại bài không cộng lần nữa;
 *   thu hồi (REVOKE) đưa tổng về 0 nên nếu được chấm lại thì cộng lại được.
 * - Hai loại tiền trên cùng một sổ (cột currency): XU → PointWallet.balance, GEM → PointWallet.gems.
 *   Bất biến: balance = Σ amount (currency = XU), gems = Σ amount (currency = GEM).
 */

/** Client trong giao dịch của prisma (client đã mở rộng ở lib/prisma) */
export type Tx = Parameters<Parameters<typeof prisma.$transaction>[0] & ((...a: any) => any)>[0];

export interface WalletRow {
  userId: string;
  balance: number;
  lifetimeEarned: number;
  weekStreak: number;
  bestWeekStreak: number;
  lastStreakWeek: string | null;
  streakFreezes: number;
  gems: number;
  gachaPity: number;
}

/** 00:00 hôm nay theo giờ Việt Nam (mốc UTC thật) */
export function vietnamDayStart(now: Date = new Date()): Date {
  const vn = new Date(now.getTime() + VN_UTC_OFFSET_MS);
  return new Date(Date.UTC(vn.getUTCFullYear(), vn.getUTCMonth(), vn.getUTCDate()) - VN_UTC_OFFSET_MS);
}

/** Tạo ví nếu chưa có rồi khoá dòng ví đến hết giao dịch */
export async function lockWallet(tx: Tx, userId: string): Promise<WalletRow> {
  await tx.$executeRaw`
    INSERT INTO "PointWallet" ("userId", "updatedAt") VALUES (${userId}, NOW())
    ON CONFLICT ("userId") DO NOTHING
  `;
  const rows = await tx.$queryRaw<WalletRow[]>`
    SELECT "userId", "balance", "lifetimeEarned", "weekStreak", "bestWeekStreak", "lastStreakWeek", "streakFreezes", "gems", "gachaPity"
    FROM "PointWallet" WHERE "userId" = ${userId} FOR UPDATE
  `;
  return rows[0];
}

/** Chỉ học sinh thật, đã được duyệt mới nhận điểm (không tính demo, giáo viên, admin) */
export async function isEligibleStudent(tx: Tx, userId: string) {
  const user = await tx.user.findUnique({
    where: { id: userId },
    select: { role: true, isApproved: true, isDemo: true },
  });
  return !!user && user.role === "STUDENT" && user.isApproved && !user.isDemo;
}

interface EntryInput {
  userId: string;
  amount: number;
  source: PointSource;
  key?: string | null;
  refId?: string | null;
  reason?: string | null;
  createdById?: string | null;
  /** Mặc định XU */
  currency?: Currency;
  /** Ghi đè: dòng này có tính vào lifetimeEarned không (revokeKey dùng để thu hồi đúng bản chất dòng gốc) */
  countsAsEarning?: boolean;
}

/** Ghi một dòng sổ + cập nhật ví (ví phải đã được khoá bằng lockWallet) */
export async function writeEntry(tx: Tx, e: EntryInput) {
  if (e.amount === 0) return;
  const currency: Currency = e.currency ?? "XU";
  await tx.pointLedger.create({
    data: {
      userId: e.userId,
      amount: e.amount,
      source: e.source,
      key: e.key ?? null,
      refId: e.refId ?? null,
      reason: e.reason ?? null,
      createdById: e.createdById ?? null,
      currency,
    },
  });
  if (currency === "GEM") {
    await tx.$executeRaw`
      UPDATE "PointWallet" SET "gems" = "gems" + ${e.amount}, "updatedAt" = NOW() WHERE "userId" = ${e.userId}
    `;
    return;
  }
  // Danh hiệu chỉ tính xu từ học tập (và thu hồi của nó); mã quà, gacha, mua đồ, đổi/hoàn quà không ảnh hưởng
  const countsAsEarning = e.countsAsEarning ?? (EARNING_SOURCES as readonly string[]).includes(e.source);
  await tx.$executeRaw`
    UPDATE "PointWallet"
    SET "balance" = "balance" + ${e.amount},
        "lifetimeEarned" = GREATEST(0, "lifetimeEarned" + ${countsAsEarning ? e.amount : 0}),
        "updatedAt" = NOW()
    WHERE "userId" = ${e.userId}
  `;
}

/** Tổng các dòng cùng khoá, theo đúng loại tiền (một khoá chỉ dùng cho một loại tiền) */
async function netForKey(tx: Tx, userId: string, key: string, currency: Currency = "XU") {
  const agg = await tx.pointLedger.aggregate({ where: { userId, key, currency }, _sum: { amount: true } });
  return agg._sum.amount ?? 0;
}

/** Điểm tự động đã nhận hôm nay (giờ VN) — để áp giới hạn mỗi ngày */
async function autoPointsToday(tx: Tx, userId: string, now: Date) {
  const agg = await tx.pointLedger.aggregate({
    where: {
      userId,
      source: { in: [...AUTO_CAPPED_SOURCES] },
      amount: { gt: 0 },
      createdAt: { gte: vietnamDayStart(now) },
    },
    _sum: { amount: true },
  });
  return agg._sum.amount ?? 0;
}

/**
 * Cộng điểm một lần cho mỗi khoá. Trả về số điểm thực cộng (0 nếu đã nhận, hết giới hạn ngày…).
 * Ví phải đã được khoá (lockWallet) trong cùng giao dịch.
 */
export async function awardOnce(
  tx: Tx,
  input: Omit<EntryInput, "key"> & { key: string; capped?: boolean; now?: Date },
): Promise<number> {
  if (input.amount <= 0) return 0;
  if ((await netForKey(tx, input.userId, input.key, input.currency ?? "XU")) > 0) return 0;

  let amount = input.amount;
  if (input.capped) {
    const used = await autoPointsToday(tx, input.userId, input.now ?? new Date());
    amount = Math.min(amount, Math.max(0, POINTS.dailyAutoCap - used));
    if (amount <= 0) return 0;
  }

  await writeEntry(tx, { ...input, amount });
  return amount;
}

/**
 * Thu hồi tiền của một khoá (vd giáo viên xoá lượt làm, đổi bài tập từ Đạt sang Chưa đạt) — đúng loại tiền của khoá.
 * lifetimeEarned chỉ bị trừ nếu dòng gốc của khoá là nguồn học tập (review Gemini: thu hồi GIFTCODE/GACHA không được làm tụt danh hiệu).
 */
export async function revokeKey(tx: Tx, userId: string, key: string, reason: string, createdById?: string | null, currency: Currency = "XU") {
  const net = await netForKey(tx, userId, key, currency);
  if (net <= 0) return 0;
  const origin = await tx.pointLedger.findFirst({ where: { userId, key, currency, amount: { gt: 0 } }, select: { source: true } });
  const countsAsEarning = currency === "XU" && !!origin && (EARNING_SOURCES as readonly string[]).includes(origin.source);
  await writeEntry(tx, { userId, amount: -net, source: "REVOKE", key, reason, createdById, currency, countsAsEarning });
  return net;
}

/**
 * Cập nhật chuỗi tuần sau mỗi lần nộp bài. Tuần đạt khi có ≥ minActivities lần nộp trong tuần (giờ VN).
 * Lỡ đúng 1 tuần mà còn thẻ giữ chuỗi → tự dùng thẻ, chuỗi không đứt.
 * Trả về điểm thưởng mốc (nếu có).
 */
export async function updateWeekStreak(tx: Tx, wallet: WalletRow, now: Date = new Date()) {
  const thisWeek = getWeekCode(now);
  if (wallet.lastStreakWeek === thisWeek) return 0;

  const weekStart = getVietnamWeekStart(now);
  const activities = await tx.pointLedger.count({
    where: {
      userId: wallet.userId,
      source: { in: [...STREAK_ACTIVITY_SOURCES] },
      amount: { gt: 0 },
      createdAt: { gte: weekStart },
    },
  });
  if (activities < POINTS.streak.minActivities) return 0;

  let streak = 1;
  let freezes = wallet.streakFreezes;
  if (wallet.lastStreakWeek === getWeekCode(now, -1)) {
    streak = wallet.weekStreak + 1;
  } else if (wallet.lastStreakWeek === getWeekCode(now, -2) && freezes > 0) {
    streak = wallet.weekStreak + 1;
    freezes -= 1;
  }
  if (streak % 4 === 0) freezes = Math.min(POINTS.streak.maxFreezes, freezes + 1);

  await tx.pointWallet.update({
    where: { userId: wallet.userId },
    data: {
      weekStreak: streak,
      bestWeekStreak: Math.max(wallet.bestWeekStreak, streak),
      lastStreakWeek: thisWeek,
      streakFreezes: freezes,
    },
  });

  const bonus =
    POINTS.streak.milestones[streak] ?? (streak > 12 && streak % 4 === 0 ? POINTS.streak.every4WeeksAfter12 : 0);
  if (bonus > 0) {
    await writeEntry(tx, {
      userId: wallet.userId,
      amount: bonus,
      source: "STREAK",
      key: `STREAK:${thisWeek}`,
      reason: `Chuỗi ${streak} tuần học liên tiếp`,
    });
  }
  return bonus;
}

/**
 * Chạy một thao tác điểm trong giao dịch RIÊNG, nuốt lỗi.
 * Dùng sau khi nộp bài/chấm bài đã lưu xong: lỗi tính điểm không bao giờ làm hỏng việc nộp bài.
 * Các khoá chống trùng đảm bảo chạy lại an toàn.
 */
export async function runPointsSafely(label: string, fn: (tx: Tx) => Promise<unknown>) {
  if (!isPointsEnabled()) return;
  try {
    await prisma.$transaction(fn, { timeout: 15000 });
  } catch (err) {
    console.error(`[points] ${label} failed:`, err);
  }
}
