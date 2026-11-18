import { prisma, prismaBase } from "@/lib/prisma";
import { demoGuard } from "@/lib/demo";
import { maskUsersForDemo } from "@/lib/demo-privacy";
import { auth } from "@/auth";
import { DEFAULT_RANKING_CONFIG, RankStatus, RankConfirmationState } from "@/lib/ranking-config";
import { calculateRankingScore } from "@/lib/ranking-calculator";
import { calculateActivityEngine, BUSINESS_TIMEZONE } from "@/lib/ranking/activity-engine";
import {
  calculateStudentHistory,
  getWeekCode,
  getVietnamWeekStart,
  getVietnamMonthStart,
  DBLeaderboardSnapshot,
} from "@/lib/ranking/history-engine";
import { calculateGrowthEngine, SnapshotForGrowth } from "@/lib/ranking/growth-engine";
import { calculateClassStatsEngine } from "@/lib/ranking/class-stats-engine";
import { evaluateQuestEngine } from "@/lib/ranking/quest-engine";
import { calculateSessionProgressEngine } from "@/lib/ranking/session-progress-engine";
import { calculateWeeklyProgressEngine } from "@/lib/ranking/weekly-progress-engine";

export interface RankingUser {
  id: string;
  name: string | null;
  image: string | null;
  rank: number | null;
  score: number;
  avgScore: number;
  bayesianSkill?: number;
  rankingScore: number;
  academicScore?: number;
  completionBonus?: number;
  activityBonus?: number;
  rankStatus?: RankStatus;
  rankConfirmationState?: RankConfirmationState;
  rankConfirmationProgress?: number;
  latestTestScore?: number;
  completedTests: number;
  isEligible: boolean;
  rankChange: number | null;
  previousRank?: number | null;
  powerScore?: number;
  lastSubmitAt: Date | null;
  isCurrentUser: boolean;
  streak?: number;
}

export interface PersonalRankingContext {
  currentUser: RankingUser | null;
  studyClassName: string | null;
  minRequiredTests: number;
  totalStudentsInClass: number;
  isClassEmpty: boolean;
  whyRanked: {
    avgScore: number;
    rankingScore: number;
    completedTests: number;
    minRequiredTests: number;
    isEligible: boolean;
    nextRankGapScore: number | null;
    nextRankName: string | null;
  };
}

export interface GetRankingOptions {
  period?: "ALL_TIME" | "WEEKLY" | "MONTHLY";
  studyClassId?: string;
}

import { unstable_cache } from "next/cache";
import type { Prisma } from "@prisma/client";

// Số lượt làm bài tối đa lấy cho mỗi học sinh. Đủ lớn để học sinh học lâu năm không bị cắt
// completedTests / điểm TB (trước đây 100), nhưng vẫn có trần để giới hạn bộ nhớ khi tải cả lớp/toàn trường.
const MAX_ATTEMPTS_PER_STUDENT = 400;

// Số bài tối thiểu trong kỳ (tuần/tháng) để được lên bảng xếp hạng theo kỳ — tránh 1 bài may mắn đứng top.
const MIN_TESTS_FOR_PERIOD_BOARD = 2;

const fetchRawRankingBaseData = unstable_cache(
  async (classIdKey: string) => {
    const targetClassId = classIdKey === "ALL" ? null : classIdKey;
    let studyClassName = "Bảng Xếp Hạng Chung";
    let classCourseIds: string[] = [];
    const now = new Date();

    if (targetClassId) {
      const cls = await prisma.studyClass.findUnique({
        where: { id: targetClassId },
        select: { name: true, courses: { select: { id: true } } },
      });
      if (cls) {
        studyClassName = cls.name;
        classCourseIds = cls.courses.map((c) => c.id);
      }
    }

    // Tài khoản demo (isDemo) không tham gia xếp hạng. Học sinh chưa duyệt vẫn được giữ (quyết định sản phẩm).
    const studentsInClass: any[] = await prisma.user.findMany({
      where: targetClassId
        ? { classId: targetClassId, role: "STUDENT", isDemo: false }
        : { role: "STUDENT", isDemo: false },
      select: {
        id: true,
        name: true,
        image: true,
        attempts: {
          where: { score: { not: null } },
          select: {
            score: true,
            completedAt: true,
            startedAt: true,
            testId: true,
            test: {
              select: {
                title: true,
                lesson: { select: { title: true } },
              },
            },
          },
          orderBy: { completedAt: "desc" },
          take: MAX_ATTEMPTS_PER_STUDENT,
        },
      },
    });

    // Snapshot chỉ được dùng cho: hạng tuần trước (W-1) và lịch sử 3 tuần trước của học sinh (W-3..W-1)
    // → chỉ tải đúng các tuần đó (và chỉ học sinh trong lớp khi xem theo lớp), không tải toàn bộ lịch sử.
    const historyWeekCodes = [-3, -2, -1].map((offset) => getWeekCode(now, offset));
    let dbSnapshots: DBLeaderboardSnapshot[] = [];
    try {
      if ((prisma as any).leaderboardSnapshot) {
        dbSnapshots = await (prisma as any).leaderboardSnapshot.findMany({
          where: {
            snapshotType: "WEEKLY",
            periodCode: { in: historyWeekCodes },
            ...(targetClassId ? { userId: { in: studentsInClass.map((s) => s.id) } } : {}),
          },
          select: {
            userId: true,
            periodCode: true,
            score: true,
            rankingScore: true,
            completedTests: true,
            rank: true,
          },
        });
      }
    } catch (err) {
      console.warn("[getRankingData] leaderboardSnapshot query failed:", err);
      dbSnapshots = [];
    }

    // Bài chưa tới hạn nộp (dueDate ở tương lai) không được tính là "đã bỏ lỡ" trong ma trận.
    const notDueInFuture: Prisma.TestWhereInput = { OR: [{ dueDate: null }, { dueDate: { lte: now } }] };
    const findMatrixTests = (where: Prisma.TestWhereInput) =>
      prisma.test.findMany({
        where,
        orderBy: { createdAt: "desc" },
        select: {
          id: true,
          title: true,
          lessonId: true,
          courseId: true,
          createdAt: true,
          dueDate: true,
          lesson: { select: { title: true } },
        },
      });

    let publishedTests: Awaited<ReturnType<typeof findMatrixTests>>;

    if (classCourseIds.length > 0) {
      // Lớp có gán khoá học → chỉ lấy bài kiểm tra thuộc các khoá đó (bài của bài học đã xuất bản,
      // hoặc bài kiểm tra cuối khoá), đã tới hạn hoặc không có hạn; mới nhất theo (dueDate ?? createdAt).
      const candidates = await findMatrixTests({
        AND: [
          notDueInFuture,
          {
            OR: [
              { courseId: { in: classCourseIds } },
              { lesson: { isPublished: true, chapter: { courseId: { in: classCourseIds } } } },
            ],
          },
        ],
      });
      const effectiveTime = (t: { dueDate: Date | null; createdAt: Date }) =>
        new Date(t.dueDate ?? t.createdAt).getTime();
      publishedTests = candidates.sort((a, b) => effectiveTime(b) - effectiveTime(a)).slice(0, 8);
    } else {
      // Không có lớp (nhóm "ALL") hoặc lớp chưa gán khoá học → giữ cách cũ: bài có ít nhất 1 học sinh
      // trong phạm vi đã nộp, nhưng vẫn loại bài chưa tới hạn.
      const attemptedTestIdsSet = new Set<string>();
      studentsInClass.forEach((student) => {
        student.attempts?.forEach((att: any) => {
          if (att.testId && att.score !== null) {
            attemptedTestIdsSet.add(att.testId);
          }
        });
      });
      const classAttemptedTestIds = Array.from(attemptedTestIdsSet);
      const thirtyDaysAgo = new Date(now.getTime() - 30 * 24 * 60 * 60 * 1000);
      const sevenDaysAgo = new Date(now.getTime() - 7 * 24 * 60 * 60 * 1000);

      // Ưu tiên bài tạo trong khoảng [30 ngày trước, 7 ngày trước]
      publishedTests = await findMatrixTests({
        AND: [notDueInFuture, { id: { in: classAttemptedTestIds }, createdAt: { gte: thirtyDaysAgo, lte: sevenDaysAgo } }],
      });

      // Dự phòng: bài tạo trong 30 ngày gần nhất
      if (publishedTests.length === 0) {
        publishedTests = await findMatrixTests({
          AND: [notDueInFuture, { id: { in: classAttemptedTestIds }, createdAt: { gte: thirtyDaysAgo } }],
        });
      }

      publishedTests = publishedTests.slice(0, 8);
    }

    // Sắp xếp cũ → mới để hiển thị ma trận từ trái sang phải
    publishedTests = [...publishedTests].reverse();

    const totalPublishedTests = await prisma.test.count();

    const fallbackTests = publishedTests.map((t, i) => ({
      id: t.id,
      testId: t.id,
      lessonId: t.lessonId,
      courseId: t.courseId,
      title: t.lesson?.title || t.title || `Bài ${String(i + 1).padStart(2, "0")}`,
    }));

    return {
      studentsInClass,
      studyClassName,
      dbSnapshots,
      totalPublishedTests,
      recent8TestsList: fallbackTests,
    };
  },
  ["ranking-base-data"],
  {
    revalidate: 60,
    tags: ["ranking"],
  }
);

export async function getRankingData(options: GetRankingOptions = {}) {
  const session = await auth();
  if (!session || !session.user) {
    throw new Error("Unauthorized");
  }

  const currentUserId = session.user.id;
  if (!currentUserId) {
    throw new Error("Unauthorized: User ID missing");
  }

  const user = await prisma.user.findUnique({
    where: { id: currentUserId },
    select: { id: true, classId: true, role: true, studyClass: { select: { name: true } } },
  });

  if (!user) {
    throw new Error("User not found");
  }

  const MIN_REQUIRED_TESTS = DEFAULT_RANKING_CONFIG.minRequiredTests;
  const targetClassId = options.studyClassId || user.classId;
  const currentWeekCode = getWeekCode(new Date(), 0);
  const previousWeekCode = getWeekCode(new Date(), -1);

  const rawBaseData = await fetchRawRankingBaseData(targetClassId || "ALL");
  const { studyClassName, dbSnapshots, totalPublishedTests, recent8TestsList } = rawBaseData;
  // Dữ liệu trong unstable_cache dùng chung → ẩn danh sau khi lấy ra, chỉ cho tài khoản demo
  const studentsInClass = await maskUsersForDemo(rawBaseData.studentsInClass, prismaBase);

  // Hạng tuần trước CHỈ lấy từ snapshot thật của tuần trước (W-1). Snapshot có thể được chốt theo
  // toàn trường hoặc theo lớp khác phạm vi đang xem → xếp lại thứ tự trong đúng phạm vi hiện tại
  // để so "hạng với hạng" cùng thang. Không có snapshot → previousRank/rankChange = null.
  const scopeUserIds = new Set<string>(studentsInClass.map((s) => s.id));
  const prevWeekSnapshots = dbSnapshots
    .filter((s) => s.periodCode === previousWeekCode && s.rank !== null && scopeUserIds.has(s.userId))
    .sort(
      (a, b) =>
        (a.rank as number) - (b.rank as number) ||
        b.rankingScore - a.rankingScore ||
        a.userId.localeCompare(b.userId)
    );
  const prevRankMap = new Map<string, number>();
  prevWeekSnapshots.forEach((snap, idx) => {
    prevRankMap.set(snap.userId, idx + 1);
  });
  const hasPrevWeekSnapshots = prevRankMap.size > 0;

  const availableTests = Math.max(totalPublishedTests, 28);
  const thirtyDaysAgo = new Date(Date.now() - 30 * 24 * 60 * 60 * 1000);

  // 1. Calculate metrics & activity per student
  const studentMetrics = studentsInClass.map((student) => {
    const validAttempts = student.attempts || [];

    // Calculate real activity metrics using Activity Engine (VN Timezone)
    const activity = calculateActivityEngine(validAttempts, new Date(), BUSINESS_TIMEZONE);

    // Map unique test -> latest score & count 30-day activity
    const testScoreMap = new Map<string, number>();
    const testLast30DaysSet = new Set<string>();
    let latestSubmit: Date | null = null;

    validAttempts.forEach((att: any) => {
      const attDate = att.completedAt ? new Date(att.completedAt) : att.startedAt ? new Date(att.startedAt) : null;
      if (att.testId && !testScoreMap.has(att.testId)) {
        testScoreMap.set(att.testId, att.score || 0);
      }
      if (attDate && attDate >= thirtyDaysAgo && att.testId) {
        testLast30DaysSet.add(att.testId);
      }
      if (!latestSubmit && attDate) {
        latestSubmit = attDate;
      }
    });

    const completedTests = testScoreMap.size;
    const completedLast30Days = testLast30DaysSet.size;

    let totalScoreSum = 0;
    testScoreMap.forEach((sc) => {
      totalScoreSum += sc;
    });

    const avgScore = completedTests > 0 ? parseFloat((totalScoreSum / completedTests).toFixed(1)) : 0;
    const availableLast30Days = Math.max(10, Math.ceil(availableTests * 0.35));

    const breakdown = calculateRankingScore(
      avgScore,
      completedTests,
      activity.currentStreak
    );

    const isEligible = completedTests >= MIN_REQUIRED_TESTS;
    const latestScore = validAttempts[0]?.score ?? (completedTests > 0 ? avgScore : 0);
    const rankConfirmationProgress = Math.min(completedTests / DEFAULT_RANKING_CONFIG.confirmationTests, 1.0);
    const rankConfirmationState: RankConfirmationState = completedTests < 5 ? "LOCKED" : completedTests < 15 ? "PROVISIONAL" : "CONFIRMED";

    // 8-Test Matrix Calculation
    const recent8Matrix = recent8TestsList.map((t: any, idx) => {
      const att = validAttempts.find((a: any) => a.testId === t.id);
      return {
        testId: t.id,
        testTitle: t.title || `Bài ${String(idx + 1).padStart(2, "0")}`,
        lessonId: t.lessonId,
        courseId: t.courseId,
        isCompleted: !!att,
        score: att ? parseFloat((att.score || 0).toFixed(1)) : null,
      };
    });

    const completedCountInLast8 = recent8Matrix.filter((m) => m.isCompleted).length;

    return {
      id: student.id,
      name: student.name || "Học sinh",
      image: student.image,
      completedTests,
      score: avgScore,
      avgScore,
      bayesianSkill: breakdown.bayesianSkill,
      rankingScore: breakdown.totalScore,
      academicScore: breakdown.academicScore,
      completionBonus: breakdown.completionBonus,
      activityBonus: breakdown.activityBonus,
      streak: activity.currentStreak,
      activity,
      rankConfirmationProgress,
      rankConfirmationState,
      latestTestScore: parseFloat((latestScore || 0).toFixed(1)),
      lastSubmitAt: latestSubmit,
      isEligible,
      recent8Matrix,
      completedCountInLast8,
      totalTestsTracked: recent8TestsList.length,
      isCurrentUser: student.id === currentUserId,
    };
  });

  const eligibleStudents = studentMetrics.filter((s) => s.isEligible);
  const ineligibleStudents = studentMetrics.filter((s) => !s.isEligible);

  // Deterministic 6-Level Tie-breaker rules:
  // 1. rankingScore DESC
  // 2. bayesianSkill DESC (Academic evidence precedence when total score tied)
  // 3. avgScore DESC
  // 4. completedTests DESC
  // 5. streak DESC
  // 6. id ASC (Stable final fallback)
  eligibleStudents.sort((a, b) => {
    if (b.rankingScore !== a.rankingScore) return b.rankingScore - a.rankingScore;
    if ((b.bayesianSkill || 0) !== (a.bayesianSkill || 0)) return (b.bayesianSkill || 0) - (a.bayesianSkill || 0);
    if (b.avgScore !== a.avgScore) return b.avgScore - a.avgScore;
    if (b.completedTests !== a.completedTests) return b.completedTests - a.completedTests;
    if ((b.streak || 0) !== (a.streak || 0)) return (b.streak || 0) - (a.streak || 0);
    return a.id.localeCompare(b.id);
  });

  const rankedEligible: RankingUser[] = eligibleStudents.map((student, index) => {
    const currentRank = index + 1;
    const prevRank = prevRankMap.get(student.id) ?? null;
    const rankChange = prevRank !== null ? prevRank - currentRank : null;

    // Chưa có snapshot tuần trước cho cả phạm vi → trạng thái trung tính (SAME), không gắn "Mới" cho tất cả.
    let rankStatus = RankStatus.SAME;
    if (prevRank === null) {
      rankStatus = hasPrevWeekSnapshots ? RankStatus.NEW : RankStatus.SAME;
    } else if (currentRank < prevRank) {
      rankStatus = RankStatus.UP;
    } else if (currentRank > prevRank) {
      rankStatus = RankStatus.DOWN;
    }

    return {
      ...student,
      rank: currentRank,
      previousRank: prevRank || null,
      rankChange,
      rankStatus,
    };
  });

  const rankedIneligible: RankingUser[] = ineligibleStudents.map((student) => {
    const prevRank = prevRankMap.get(student.id);
    const rankStatus = (prevRank !== undefined && prevRank !== null) ? RankStatus.EXIT : RankStatus.SAME;

    return {
      ...student,
      rank: null,
      previousRank: prevRank || null,
      rankChange: null,
      rankStatus,
    };
  });

  const fullLeaderboard = [...rankedEligible, ...rankedIneligible];
  const currentUserRanked = fullLeaderboard.find((s) => s.id === currentUserId) || null;
  const currentUserMetric = studentMetrics.find((s) => s.id === currentUserId) || null;

  // 2. Class Stats Engine
  const classStatsInputs = fullLeaderboard.map((s) => ({
    id: s.id,
    completedTests: s.completedTests,
    currentStreak: s.streak || 0,
    currentRank: s.rank,
    previousRank: s.previousRank || null,
    avgScore: s.avgScore,
    isEligible: s.isEligible,
  }));
  const classStats = calculateClassStatsEngine(classStatsInputs);

  // 3. Growth Engine
  // Dùng hạng đã xếp lại trong phạm vi hiện tại (cùng thang với hạng hiện tại)
  const snapshotsForGrowth: SnapshotForGrowth[] = prevWeekSnapshots.map((s) => ({
    userId: s.userId,
    score: s.score,
    rank: prevRankMap.get(s.userId) ?? null,
  }));

  const growthEngineOutput = calculateGrowthEngine(
    rankedEligible.map((s) => ({
      id: s.id,
      name: s.name || "Học sinh",
      currentScore: s.avgScore,
      currentRank: s.rank,
      completedTests: s.completedTests,
    })),
    snapshotsForGrowth
  );

  // 4. History Engine (4 periods for current user)
  const userLiveHistoryMetrics = {
    avgScore: currentUserRanked?.avgScore || 0,
    rankingScore: currentUserRanked?.rankingScore || 0,
    completedTests: currentUserRanked?.completedTests || 0,
    rank: currentUserRanked?.rank || null,
  };
  const studentWeeklyProgress = calculateStudentHistory(
    currentUserId,
    userLiveHistoryMetrics,
    dbSnapshots
  );

  // 5. Quest Engine for current user
  const questEngineOutput = evaluateQuestEngine({
    completedTests: currentUserRanked?.completedTests || 0,
    avgScore: currentUserRanked?.avgScore || 0,
    rank: currentUserRanked?.rank || null,
    totalEligibleStudents: rankedEligible.length,
  });

  // 6. Teacher Analytics (Grade Distribution & Daily Participation)
  const totalInClass = studentsInClass.length || 1;
  const excellentStudents = studentMetrics.filter((s) => s.avgScore >= 8.5);
  const goodStudents = studentMetrics.filter((s) => s.avgScore >= 7.0 && s.avgScore < 8.5);
  const averageStudents = studentMetrics.filter((s) => s.avgScore >= 5.0 && s.avgScore < 7.0);
  const needSupportStudentsList = studentMetrics.filter((s) => s.avgScore < 5.0 || !s.isEligible);

  const gradeDistribution = {
    excellent: { count: excellentStudents.length, percentage: Math.round((excellentStudents.length / totalInClass) * 100) },
    good: { count: goodStudents.length, percentage: Math.round((goodStudents.length / totalInClass) * 100) },
    average: { count: averageStudents.length, percentage: Math.round((averageStudents.length / totalInClass) * 100) },
    needSupport: { count: needSupportStudentsList.length, percentage: Math.round((needSupportStudentsList.length / totalInClass) * 100) },
  };

  const studentsNeedingSupport = needSupportStudentsList.slice(0, 5).map((s) => ({
    id: s.id,
    name: s.name,
    rank: (s as any).rank || null,
    reason: s.completedTests === 0
      ? `🚨 RANK BÁO ĐỘNG: Chưa làm bài thi nào!`
      : s.avgScore < 5.0
      ? `Điểm trung bình bài vừa rồi: ${s.avgScore}đ`
      : `Mới hoàn thành ${s.completedTests} bài kiểm tra`,
    type: s.completedTests === 0 ? "DANGER" : s.avgScore < 5.0 ? "SCORE" : "INCOMPLETE",
  }));

  // Gaps calculation (Ahead & Behind) for Current User (No fake gaps)
  let aheadGapScore: number | null = null;
  let aheadStudentName: string | null = null;
  let behindGapScore: number | null = null;
  let behindStudentName: string | null = null;

  if (currentUserRanked && currentUserRanked.rank && currentUserRanked.rank > 1) {
    const prevStudent = rankedEligible[currentUserRanked.rank - 2];
    if (prevStudent) {
      aheadGapScore = parseFloat((prevStudent.rankingScore - currentUserRanked.rankingScore).toFixed(1));
      aheadStudentName = prevStudent.name;
    }
  }

  if (currentUserRanked && currentUserRanked.rank && currentUserRanked.rank < rankedEligible.length) {
    const nextStudent = rankedEligible[currentUserRanked.rank];
    if (nextStudent) {
      behindGapScore = parseFloat((currentUserRanked.rankingScore - nextStudent.rankingScore).toFixed(1));
      behindStudentName = nextStudent.name;
    }
  }

  // Activity output for Current User
  const currentUserActivity = currentUserMetric?.activity || calculateActivityEngine([], new Date(), BUSINESS_TIMEZONE);

  const nearMeList = getNearMeList(currentUserRanked, currentUserId, rankedEligible);
  const showPodium = studentsInClass.length >= 10;
  const top3 = showPodium ? rankedEligible.slice(0, 3) : [];
  const isClassEmpty = studentsInClass.length === 0 || eligibleStudents.length === 0;

  // 6. Session Progress & Weekly Progress Engine (Buổi 1, 2, 3, 4 progress & Weekly Summary for current user)
  const currentUserRawAttempts = (studentsInClass.find((s) => s.id === currentUserId)?.attempts || []) as any[];
  const classMemberAvgs = studentMetrics.map((s) => ({ id: s.id, avgScore: s.avgScore }));
  const sessionProgress = calculateSessionProgressEngine(currentUserRawAttempts, classMemberAvgs, 4);
  const weeklyProgress = calculateWeeklyProgressEngine(sessionProgress.sessions, 4);

  return {
    currentUser: currentUserRanked,
    userRole: user.role || "STUDENT",
    studyClassName,
    minRequiredTests: MIN_REQUIRED_TESTS,
    totalStudentsInClass: studentsInClass.length,
    isClassEmpty,
    showPodium,
    whyRanked: {
      avgScore: currentUserRanked?.score || 0,
      rankingScore: currentUserRanked?.rankingScore || 0,
      completedTests: currentUserRanked?.completedTests || 0,
      minRequiredTests: MIN_REQUIRED_TESTS,
      isEligible: currentUserRanked?.isEligible || false,
      nextRankGapScore: aheadGapScore,
      nextRankName: aheadStudentName,
    },
    nearMeList,
    top3,
    leaderboard: fullLeaderboard,
    classStats: {
      classAvgScore: classStats.classAvgScore,
      classCompletionRate: classStats.classParticipationRate,
      studentsRankIncreasedCount: classStats.studentsRankIncreasedCount,
      activeStreakStudentsCount: classStats.activeStreakStudentsCount,
    },
    mostImprovedStudent: growthEngineOutput.mostImprovedStudent,
    gaps: {
      aheadGapScore,
      aheadStudentName,
      behindGapScore,
      behindStudentName,
    },
    activity: currentUserActivity,
    quests: questEngineOutput,
    sessionProgress,
    weeklyProgress,
    // Kỳ theo lịch giờ VN: tuần từ Thứ Hai 00:00, tháng từ ngày 1 00:00
    weeklyLeaderboard: computeTimeframeLeaderboard(studentsInClass, getVietnamWeekStart(new Date()), currentUserId),
    monthlyLeaderboard: computeTimeframeLeaderboard(studentsInClass, getVietnamMonthStart(new Date()), currentUserId),
    teacherAnalytics: {
      gradeDistribution,
      studentsNeedingSupport,
      topProgressingStudents: growthEngineOutput.topProgressingStudents,
    },
    studentWeeklyProgress,
  };
}

function computeTimeframeLeaderboard(
  studentsInClass: any[],
  filterStartDate: Date | null,
  currentUserId: string
): RankingUser[] {
  const metrics = studentsInClass.map((student) => {
    let validAttempts = student.attempts || [];
    if (filterStartDate) {
      validAttempts = validAttempts.filter((att: any) => {
        const attDate = att.completedAt ? new Date(att.completedAt) : att.startedAt ? new Date(att.startedAt) : null;
        return attDate && attDate >= filterStartDate;
      });
    }

    const activity = calculateActivityEngine(validAttempts, new Date(), BUSINESS_TIMEZONE);
    const testScoreMap = new Map<string, number>();

    validAttempts.forEach((att: any) => {
      if (att.testId && !testScoreMap.has(att.testId)) {
        testScoreMap.set(att.testId, att.score || 0);
      }
    });

    const completedTests = testScoreMap.size;
    let totalScoreSum = 0;
    testScoreMap.forEach((sc) => {
      totalScoreSum += sc;
    });

    const avgScore = completedTests > 0 ? parseFloat((totalScoreSum / completedTests).toFixed(1)) : 0;
    const powerScore = completedTests > 0 ? parseFloat((avgScore * 10 + completedTests * 1 + activity.currentStreak * 0.5).toFixed(1)) : 0;

    return {
      id: student.id,
      name: student.name || "Thợ săn",
      image: student.image,
      completedTests,
      score: avgScore,
      avgScore,
      rankingScore: powerScore,
      powerScore,
      streak: activity.currentStreak,
      isEligible: completedTests >= MIN_TESTS_FOR_PERIOD_BOARD,
      isCurrentUser: student.id === currentUserId,
      lastSubmitAt: validAttempts[0]?.completedAt || null,
      rankChange: 0,
    };
  });

  const active = metrics.filter((s) => s.completedTests >= MIN_TESTS_FOR_PERIOD_BOARD);
  active.sort((a, b) => {
    if ((b.powerScore || 0) !== (a.powerScore || 0)) return (b.powerScore || 0) - (a.powerScore || 0);
    if (b.avgScore !== a.avgScore) return b.avgScore - a.avgScore;
    if (b.completedTests !== a.completedTests) return b.completedTests - a.completedTests;
    return a.id.localeCompare(b.id);
  });

  return active.map((s, idx) => ({
    ...s,
    rank: idx + 1,
  }));
}

function getNearMeList(currentUserRanked: RankingUser | null, currentUserId: string, rankedEligible: RankingUser[]): RankingUser[] {
  if (currentUserRanked && currentUserRanked.rank !== null && rankedEligible.length > 0) {
    const myIndex = rankedEligible.findIndex((s) => s.id === currentUserId);
    if (myIndex !== -1) {
      if (rankedEligible.length <= 5) {
        return rankedEligible;
      } else if (myIndex <= 2) {
        return rankedEligible.slice(0, 5);
      } else if (myIndex >= rankedEligible.length - 3) {
        return rankedEligible.slice(rankedEligible.length - 5);
      } else {
        return rankedEligible.slice(myIndex - 2, myIndex + 3);
      }
    }
  }
  return rankedEligible.slice(0, Math.min(5, rankedEligible.length));
}

export async function freezeWeeklySnapshot(studyClassId?: string) {
  const demoBlocked = await demoGuard();
  if (demoBlocked) return demoBlocked;

  const session = await auth();
  if (!session || (session.user.role !== "ADMIN" && session.user.role !== "TEACHER")) {
    throw new Error("Unauthorized: Only Admin or Teacher can freeze snapshots");
  }

  const currentWeekCode = getWeekCode(new Date(), 0);

  // Cùng phạm vi, ngưỡng và công thức điểm với getRankingData để hạng chốt so sánh được với hạng hiện tại
  const students = await prisma.user.findMany({
    where: studyClassId
      ? { classId: studyClassId, role: "STUDENT", isDemo: false }
      : { role: "STUDENT", isDemo: false },
    select: {
      id: true,
      classId: true,
      attempts: {
        where: { score: { not: null } },
        select: { score: true, completedAt: true, startedAt: true, testId: true },
        orderBy: { completedAt: "desc" },
        take: MAX_ATTEMPTS_PER_STUDENT,
      },
    },
  });

  const MIN_REQUIRED_TESTS = DEFAULT_RANKING_CONFIG.minRequiredTests;
  const calculated = students.map((s) => {
    const testScoreMap = new Map<string, number>();
    s.attempts.forEach((a) => {
      if (a.testId && !testScoreMap.has(a.testId)) {
        testScoreMap.set(a.testId, a.score || 0);
      }
    });

    const completedTests = testScoreMap.size;
    let total = 0;
    testScoreMap.forEach((sc) => {
      total += sc;
    });
    const avgScore = completedTests > 0 ? parseFloat((total / completedTests).toFixed(1)) : 0;
    const activity = calculateActivityEngine(s.attempts, new Date(), BUSINESS_TIMEZONE);
    const rankingScore = calculateRankingScore(avgScore, completedTests, activity.currentStreak).totalScore;

    const isEligible = completedTests >= MIN_REQUIRED_TESTS;

    return {
      userId: s.id,
      studyClassId: s.classId || "default",
      score: avgScore,
      rankingScore,
      completedTests,
      isEligible,
    };
  });

  const eligible = calculated.filter((c) => c.isEligible);
  eligible.sort(
    (a, b) =>
      b.rankingScore - a.rankingScore ||
      b.score - a.score ||
      b.completedTests - a.completedTests ||
      a.userId.localeCompare(b.userId)
  );

  if (!(prisma as any).leaderboardSnapshot) {
    return { success: false, count: 0, periodCode: currentWeekCode, message: "Prisma client needs restart" };
  }

  for (let i = 0; i < eligible.length; i++) {
    const student = eligible[i];
    await (prisma as any).leaderboardSnapshot.upsert({
      where: {
        userId_periodCode_snapshotType: {
          userId: student.userId,
          periodCode: currentWeekCode,
          snapshotType: "WEEKLY",
        },
      },
      update: {
        score: student.score,
        rankingScore: student.rankingScore,
        completedTests: student.completedTests,
        rank: i + 1,
      },
      create: {
        userId: student.userId,
        studyClassId: student.studyClassId,
        periodCode: currentWeekCode,
        snapshotType: "WEEKLY",
        score: student.score,
        rankingScore: student.rankingScore,
        completedTests: student.completedTests,
        rank: i + 1,
      },
    });
  }

  return { success: true, count: eligible.length, periodCode: currentWeekCode };
}
