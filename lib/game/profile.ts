import { prisma } from "@/lib/prisma";
import { getLevel } from "@/lib/points/levels";
import { getAvatar } from "./inventory";
import { ITEM_BY_ID } from "./items";

/**
 * Hồ sơ công khai (trong nội bộ người đã đăng nhập). Review Gemini: chỉ hiện hồ sơ của STUDENT đã duyệt, không demo —
 * trừ khi chính chủ tự xem; phần riêng tư (kết quả gần đây) chỉ trả cho chính chủ.
 * Che tên cho người xem demo làm ở trang (app/profile/[userId]) để file này không kéo next-auth vào test.
 */
export async function getPublicProfile(viewerId: string, targetId: string) {
  const u = await prisma.user.findUnique({
    where: { id: targetId },
    select: {
      id: true, name: true, image: true, role: true, isApproved: true, isDemo: true, createdAt: true,
      studyClass: { select: { name: true, grade: true } },
      pointWallet: { select: { balance: true, lifetimeEarned: true, gems: true, bestWeekStreak: true, weekStreak: true } },
    },
  });
  if (!u) return null;
  const isSelf = viewerId === targetId;
  if (!isSelf && (u.role !== "STUDENT" || !u.isApproved || u.isDemo)) return null;

  const [{ config, owned }, completedTests, tens, completedLessons, recent] = await Promise.all([
    getAvatar(u.id),
    prisma.studentAttempt.count({ where: { userId: u.id, completedAt: { not: null } } }),
    prisma.studentAttempt.count({ where: { userId: u.id, completedAt: { not: null }, score: { gte: 10 } } }),
    prisma.progress.count({ where: { userId: u.id, isCompleted: true } }),
    isSelf
      ? prisma.studentAttempt.findMany({
          where: { userId: u.id, completedAt: { not: null }, test: { lesson: { isNot: null } } },
          orderBy: { completedAt: "desc" },
          take: 5,
          select: { id: true, score: true, completedAt: true, test: { select: { title: true, lesson: { select: { id: true, title: true } } } } },
        })
      : Promise.resolve([]),
  ]);

  // Hạng trong khối theo xu tích luỹ (chỉ khi có khối)
  let rankInGrade: { rank: number; total: number } | null = null;
  if (u.studyClass?.grade && u.pointWallet) {
    const [above, total] = await Promise.all([
      prisma.pointWallet.count({
        where: { lifetimeEarned: { gt: u.pointWallet.lifetimeEarned }, user: { role: "STUDENT", isApproved: true, isDemo: false, studyClass: { grade: u.studyClass.grade } } },
      }),
      prisma.user.count({ where: { role: "STUDENT", isApproved: true, isDemo: false, studyClass: { grade: u.studyClass.grade } } }),
    ]);
    rankInGrade = { rank: above + 1, total };
  }

  const lifetime = u.pointWallet?.lifetimeEarned ?? 0;
  return {
    id: u.id,
    name: u.name,
    image: u.image,
    isSelf,
    className: u.studyClass?.name ?? null,
    grade: u.studyClass?.grade ?? null,
    memberSince: u.createdAt.toISOString(),
    level: getLevel(lifetime),
    lifetimeEarned: lifetime,
    balance: isSelf ? (u.pointWallet?.balance ?? 0) : null,
    gems: isSelf ? (u.pointWallet?.gems ?? 0) : null,
    bestWeekStreak: u.pointWallet?.bestWeekStreak ?? 0,
    weekStreak: u.pointWallet?.weekStreak ?? 0,
    avatar: config,
    equippedTitle: config.title ? (ITEM_BY_ID[config.title]?.name ?? null) : null,
    ownedCount: owned.length,
    completedTests,
    tens,
    completedLessons,
    rankInGrade,
    recent: recent.map((r) => ({
      id: r.id,
      score: r.score,
      completedAt: r.completedAt!.toISOString(),
      title: r.test.title || r.test.lesson?.title || "Bài kiểm tra",
      lessonId: r.test.lesson?.id ?? null,
    })),
  };
}

export type PublicProfile = NonNullable<Awaited<ReturnType<typeof getPublicProfile>>>;
