import { unstable_cache } from "next/cache";
import { prisma } from "@/lib/prisma";
import { getVietnamMonthStart } from "@/lib/ranking/history-engine";
import { EARNING_SOURCES } from "@/lib/points/config";
import { getLevel } from "@/lib/points/levels";
import { getAvatars } from "./inventory";
import { ITEM_BY_ID } from "./items";
import type { AvatarConfig } from "./avatar";

export type Period = "all" | "month";
export type Scope = { grade: number } | { classId: string };

export interface LeaderboardRow {
  userId: string;
  name: string | null;
  image: string | null;
  className: string | null;
  /** Xu tích luỹ (all) hoặc xu học được trong tháng (month) */
  xu: number;
  lifetimeEarned: number;
  level: { icon: string; name: string };
  avatar: AvatarConfig;
  equippedTitle: string | null;
  rank: number;
}

const STUDENT_WHERE = { role: "STUDENT" as const, isApproved: true, isDemo: false };

/**
 * Dữ liệu gốc của Bảng Vàng — KHÔNG phụ thuộc người xem (review Gemini: che tên demo làm ngoài cache).
 * Cache 60 giây theo (phạm vi, kỳ).
 */
async function loadLeaderboard(scope: Scope, period: Period, limit: number): Promise<LeaderboardRow[]> {
  const scopeWhere = "grade" in scope ? { studyClass: { grade: scope.grade } } : { classId: scope.classId };
  const users = await prisma.user.findMany({
    where: { ...STUDENT_WHERE, ...scopeWhere },
    select: { id: true, name: true, image: true, studyClass: { select: { name: true } }, pointWallet: { select: { lifetimeEarned: true } } },
  });
  if (users.length === 0) return [];
  const ids = users.map((u) => u.id);

  let xuBy = new Map<string, number>();
  if (period === "month") {
    const rows = await prisma.pointLedger.groupBy({
      by: ["userId"],
      where: { userId: { in: ids }, currency: "XU", source: { in: [...EARNING_SOURCES] }, createdAt: { gte: getVietnamMonthStart() } },
      _sum: { amount: true },
    });
    xuBy = new Map(rows.map((r) => [r.userId, Math.max(0, r._sum.amount ?? 0)]));
  } else {
    xuBy = new Map(users.map((u) => [u.id, u.pointWallet?.lifetimeEarned ?? 0]));
  }

  const sorted = users
    .map((u) => ({ u, xu: xuBy.get(u.id) ?? 0 }))
    .sort((a, b) => b.xu - a.xu || (b.u.pointWallet?.lifetimeEarned ?? 0) - (a.u.pointWallet?.lifetimeEarned ?? 0) || (a.u.name ?? "").localeCompare(b.u.name ?? ""))
    .slice(0, limit);
  const avatars = await getAvatars(sorted.map((s) => s.u.id));
  return sorted.map(({ u, xu }, i) => {
    const lifetime = u.pointWallet?.lifetimeEarned ?? 0;
    const lv = getLevel(lifetime);
    const avatar = avatars.get(u.id)!;
    return {
      userId: u.id,
      name: u.name,
      image: u.image,
      className: u.studyClass?.name ?? null,
      xu,
      lifetimeEarned: lifetime,
      level: { icon: lv.icon, name: lv.name },
      avatar,
      equippedTitle: avatar.title ? (ITEM_BY_ID[avatar.title]?.name ?? null) : null,
      rank: i + 1,
    };
  });
}

const cached = unstable_cache(
  (scopeKey: string, period: Period, limit: number) => {
    const scope: Scope = scopeKey.startsWith("g:") ? { grade: Number(scopeKey.slice(2)) } : { classId: scopeKey.slice(2) };
    return loadLeaderboard(scope, period, limit);
  },
  ["game-leaderboard"],
  { revalidate: 60 },
);

export function getLeaderboard(scope: Scope, period: Period = "all", limit = 30) {
  const key = "grade" in scope ? `g:${scope.grade}` : `c:${scope.classId}`;
  return cached(key, period, limit);
}

/** Không cache — dùng trong test và khi cần dữ liệu tức thì */
export const getLeaderboardUncached = loadLeaderboard;

/** Các khối đang có lớp (10/11/12…) */
export async function getGrades(): Promise<number[]> {
  const rows = await prisma.studyClass.findMany({ where: { grade: { not: null } }, select: { grade: true }, distinct: ["grade"], orderBy: { grade: "desc" } });
  return rows.map((r) => r.grade!).filter((g) => Number.isInteger(g));
}

/** Vị trí của một học sinh trong phạm vi (tính ngoài cache, không phụ thuộc top N) */
export async function getMyRank(userId: string, scope: Scope, period: Period): Promise<{ rank: number; total: number; xu: number } | null> {
  const rows = await loadLeaderboard(scope, period, 10000);
  const idx = rows.findIndex((r) => r.userId === userId);
  if (idx < 0) return null;
  return { rank: idx + 1, total: rows.length, xu: rows[idx].xu };
}
