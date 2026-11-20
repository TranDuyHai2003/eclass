import { prisma } from "@/lib/prisma";
import { getVietnamMonthStart, getVietnamWeekStart, getWeekCode } from "@/lib/ranking/history-engine";
import { POINTS, STREAK_ACTIVITY_SOURCES } from "./config";
import { visibleRewardWhere } from "./redemption";

const EMPTY_WALLET = {
  balance: 0,
  lifetimeEarned: 0,
  weekStreak: 0,
  bestWeekStreak: 0,
  lastStreakWeek: null as string | null,
  streakFreezes: 1,
  goalRewardId: null as string | null,
};

/** Số dư hiển thị trên header (1 truy vấn theo khoá chính) */
/** Chip điểm trên header: số dư + tổng đã kiếm (để hiện cấp) — 1 truy vấn theo khoá chính */
export async function getHeaderPoints(userId: string) {
  const w = await prisma.pointWallet.findUnique({ where: { userId }, select: { balance: true, lifetimeEarned: true } });
  return { balance: w?.balance ?? 0, lifetimeEarned: w?.lifetimeEarned ?? 0 };
}

/** Chuỗi còn "sống" nếu tuần gần nhất được tính là tuần này hoặc tuần trước (hoặc trước nữa mà còn thẻ giữ chuỗi) */
function liveStreak(w: typeof EMPTY_WALLET, now = new Date()) {
  const last = w.lastStreakWeek;
  if (!last) return 0;
  if (last === getWeekCode(now) || last === getWeekCode(now, -1)) return w.weekStreak;
  if (last === getWeekCode(now, -2) && w.streakFreezes > 0) return w.weekStreak;
  return 0;
}

export async function getStudentPointsPage(userId: string) {
  const user = await prisma.user.findUniqueOrThrow({
    where: { id: userId },
    select: { classId: true, studentType: true, isApproved: true, isDemo: true, role: true },
  });
  const monthStart = getVietnamMonthStart();

  const [walletRow, rewards, redemptions, ledger, weekActivities, monthUsage] = await Promise.all([
    prisma.pointWallet.findUnique({ where: { userId } }),
    prisma.reward.findMany({
      where: visibleRewardWhere(user),
      orderBy: [{ price: "asc" }, { createdAt: "asc" }],
      select: { id: true, title: true, description: true, emoji: true, price: true, stock: true, perStudentMonthlyLimit: true, kind: true },
    }),
    prisma.redemption.findMany({
      where: { userId },
      orderBy: { createdAt: "desc" },
      take: 30,
      select: { id: true, price: true, status: true, note: true, createdAt: true, handledAt: true, reward: { select: { title: true, emoji: true } } },
    }),
    prisma.pointLedger.findMany({
      where: { userId },
      orderBy: { createdAt: "desc" },
      take: 60,
      select: { id: true, amount: true, source: true, reason: true, createdAt: true },
    }),
    prisma.pointLedger.count({
      where: { userId, source: { in: [...STREAK_ACTIVITY_SOURCES] }, amount: { gt: 0 }, createdAt: { gte: getVietnamWeekStart() } },
    }),
    prisma.redemption.groupBy({
      by: ["rewardId"],
      where: { userId, status: { in: ["PENDING", "DELIVERED"] }, createdAt: { gte: monthStart } },
      _count: { _all: true },
    }),
  ]);

  const wallet = { ...EMPTY_WALLET, ...(walletRow ?? {}) };
  const usage = new Map(monthUsage.map((u) => [u.rewardId, u._count._all]));
  const goal = wallet.goalRewardId ? rewards.find((r) => r.id === wallet.goalRewardId) ?? null : null;

  return {
    canEarn: user.role === "STUDENT" && user.isApproved && !user.isDemo,
    isOffline: user.studentType === "OFFLINE",
    wallet: {
      balance: wallet.balance,
      lifetimeEarned: wallet.lifetimeEarned,
      weekStreak: liveStreak(wallet),
      bestWeekStreak: wallet.bestWeekStreak,
      streakFreezes: wallet.streakFreezes,
      thisWeekCounted: wallet.lastStreakWeek === getWeekCode(),
      weekActivities,
      weekTarget: POINTS.streak.minActivities,
    },
    goal,
    rewards: rewards.map((r) => ({
      ...r,
      usedThisMonth: usage.get(r.id) ?? 0,
    })),
    redemptions: redemptions.map((r) => ({ ...r, createdAt: r.createdAt.toISOString(), handledAt: r.handledAt?.toISOString() ?? null })),
    ledger: ledger.map((l) => ({ ...l, createdAt: l.createdAt.toISOString() })),
  };
}

export type StudentPointsPageData = Awaited<ReturnType<typeof getStudentPointsPage>>;

/** Thẻ chào trên trang chủ học sinh: số dư, cấp (tổng đã kiếm), chuỗi tuần, tiến độ tuần, quà mục tiêu */
export async function getPointsCard(userId: string) {
  // Ví và số lần nộp bài tuần này chạy song song; quà mục tiêu cần goalRewardId nên lấy sau
  const [w, weekActivities] = await Promise.all([
    prisma.pointWallet.findUnique({
      where: { userId },
      select: { balance: true, lifetimeEarned: true, weekStreak: true, lastStreakWeek: true, streakFreezes: true, goalRewardId: true },
    }),
    prisma.pointLedger.count({
      where: { userId, source: { in: [...STREAK_ACTIVITY_SOURCES] }, amount: { gt: 0 }, createdAt: { gte: getVietnamWeekStart() } },
    }),
  ]);
  const goal = w?.goalRewardId
    ? await prisma.reward.findFirst({
        where: { id: w.goalRewardId, isActive: true, deletedAt: null },
        select: { title: true, emoji: true, price: true },
      })
    : null;
  return {
    balance: w?.balance ?? 0,
    lifetimeEarned: w?.lifetimeEarned ?? 0,
    weekStreak: w ? liveStreak({ ...EMPTY_WALLET, ...w }) : 0,
    weekActivities,
    weekTarget: POINTS.streak.minActivities,
    thisWeekCounted: w?.lastStreakWeek === getWeekCode(),
    goal,
  };
}

export type PointsCardData = Awaited<ReturnType<typeof getPointsCard>>;

/** Điểm thưởng nhận được từ một lượt làm bài (hiện ở màn kết quả) */
export async function getPointsForAttempt(userId: string, attemptId: string) {
  const rows = await prisma.pointLedger.findMany({
    where: { userId, refId: attemptId, amount: { gt: 0 } },
    orderBy: { createdAt: "asc" },
    select: { amount: true, source: true, reason: true },
  });
  return rows;
}

export async function getTeacherRewardsPage() {
  const monthStart = getVietnamMonthStart();
  const [rewards, pending, recent, classes, monthEntries, deliveredThisMonth] = await Promise.all([
    prisma.reward.findMany({
      where: { deletedAt: null },
      orderBy: [{ isActive: "desc" }, { price: "asc" }],
      select: {
        id: true, title: true, description: true, emoji: true, price: true, stock: true, perStudentMonthlyLimit: true,
        kind: true, costVnd: true, isActive: true,
        classes: { select: { id: true, name: true } },
        _count: { select: { redemptions: { where: { status: "PENDING" } } } },
      },
    }),
    prisma.redemption.findMany({
      where: { status: "PENDING" },
      orderBy: { createdAt: "asc" },
      select: {
        id: true, price: true, createdAt: true,
        reward: { select: { title: true, emoji: true } },
        user: { select: { id: true, name: true, email: true, studyClass: { select: { id: true, name: true } } } },
      },
    }),
    prisma.redemption.findMany({
      where: { status: { not: "PENDING" } },
      orderBy: { updatedAt: "desc" },
      take: 40,
      select: {
        id: true, price: true, status: true, note: true, createdAt: true, handledAt: true,
        reward: { select: { title: true, emoji: true } },
        user: { select: { name: true, email: true, studyClass: { select: { name: true } } } },
      },
    }),
    prisma.studyClass.findMany({
      orderBy: { name: "asc" },
      select: {
        id: true,
        name: true,
        users: {
          where: { role: "STUDENT", isApproved: true, isDemo: false },
          orderBy: { name: "asc" },
          select: { id: true, name: true, email: true, studentType: true, pointWallet: { select: { balance: true } } },
        },
      },
    }),
    prisma.pointLedger.groupBy({
      by: ["source"],
      where: { createdAt: { gte: monthStart } },
      _sum: { amount: true },
    }),
    prisma.redemption.findMany({
      where: { status: "DELIVERED", handledAt: { gte: monthStart } },
      select: { reward: { select: { costVnd: true } } },
    }),
  ]);
  const unassigned = await prisma.user.findMany({
    where: { classId: null, role: "STUDENT", isApproved: true, isDemo: false },
    orderBy: { name: "asc" },
    select: { id: true, name: true, email: true, studentType: true, pointWallet: { select: { balance: true } } },
  });
  const allClasses = unassigned.length ? [...classes, { id: "__none__", name: "Chưa xếp lớp", users: unassigned }] : classes;

  const sumOf = (sources: string[]) =>
    monthEntries.filter((e) => sources.includes(e.source)).reduce((s, e) => s + (e._sum.amount ?? 0), 0);
  const earnSources = ["TEST_SUBMIT", "TEST_SCORE", "BREAKTHROUGH", "FINAL_TEST", "HOMEWORK_SUBMIT", "HOMEWORK_PASS", "STREAK", "MANUAL", "REVOKE"];

  // Top học sinh chăm chỉ tháng này (điểm kiếm được, không tính đổi/hoàn)
  const topRaw = await prisma.pointLedger.groupBy({
    by: ["userId"],
    where: { createdAt: { gte: monthStart }, source: { in: earnSources as any } },
    _sum: { amount: true },
    orderBy: { _sum: { amount: "desc" } },
    take: 10,
  });
  const topUsers = await prisma.user.findMany({
    where: { id: { in: topRaw.map((t) => t.userId) } },
    select: { id: true, name: true, email: true, studyClass: { select: { name: true } } },
  });
  const userById = new Map(topUsers.map((u) => [u.id, u]));

  return {
    rewards,
    pending: pending.map((p) => ({ ...p, createdAt: p.createdAt.toISOString() })),
    recent: recent.map((r) => ({ ...r, createdAt: r.createdAt.toISOString(), handledAt: r.handledAt?.toISOString() ?? null })),
    classes: allClasses.map((c) => ({
      id: c.id,
      name: c.name,
      students: c.users.map((u) => ({ id: u.id, name: u.name, email: u.email, studentType: u.studentType, balance: u.pointWallet?.balance ?? 0 })),
    })),
    stats: {
      earnedThisMonth: sumOf(earnSources),
      spentThisMonth: -sumOf(["REDEEM"]) - sumOf(["REFUND"]),
      deliveredThisMonth: deliveredThisMonth.length,
      costThisMonth: deliveredThisMonth.reduce((s, d) => s + (d.reward.costVnd ?? 0), 0),
      top: topRaw.map((t) => ({
        userId: t.userId,
        points: t._sum.amount ?? 0,
        name: userById.get(t.userId)?.name || userById.get(t.userId)?.email || "Học sinh",
        className: userById.get(t.userId)?.studyClass?.name ?? null,
      })),
    },
  };
}

export type TeacherRewardsPageData = Awaited<ReturnType<typeof getTeacherRewardsPage>>;
