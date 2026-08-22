import { prisma } from "@/lib/prisma";
import { auth } from "@/auth";
import { DEFAULT_RANKING_CONFIG, RankStatus, RankConfirmationState } from "@/lib/ranking-config";
import { calculateRankingScore } from "@/lib/ranking-calculator";
import { calculateActivityEngine, BUSINESS_TIMEZONE } from "@/lib/ranking/activity-engine";
import { calculateStudentHistory, getWeekCode, DBLeaderboardSnapshot } from "@/lib/ranking/history-engine";
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
    include: { studyClass: true },
  });

  if (!user) {
    throw new Error("User not found");
  }

  const MIN_REQUIRED_TESTS = DEFAULT_RANKING_CONFIG.minRequiredTests;
  const targetClassId = options.studyClassId || user.classId;
  const currentWeekCode = getWeekCode(new Date(), 0);
  const previousWeekCode = getWeekCode(new Date(), -1);

  let studentsInClass: any[] = [];
  let studyClassName = user.studyClass?.name || null;

  if (targetClassId) {
    const cls = await prisma.studyClass.findUnique({ where: { id: targetClassId } });
    if (cls) studyClassName = cls.name;

    studentsInClass = await prisma.user.findMany({
      where: { classId: targetClassId, role: "STUDENT" },
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
          },
          orderBy: { completedAt: "desc" },
        },
      },
    });
  } else {
    studyClassName = "Bảng Xếp Hạng Chung";
    studentsInClass = await prisma.user.findMany({
      where: { role: "STUDENT" },
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
          },
          orderBy: { completedAt: "desc" },
        },
      },
    });
  }

  // Fetch previous snapshots from DB for accurate history & rank movement
  let dbSnapshots: DBLeaderboardSnapshot[] = [];
  try {
    if ((prisma as any).leaderboardSnapshot) {
      dbSnapshots = await (prisma as any).leaderboardSnapshot.findMany({
        where: { snapshotType: "WEEKLY" },
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

  const prevRankMap = new Map<string, number>();
  dbSnapshots
    .filter((s) => s.periodCode === previousWeekCode)
    .forEach((snap) => {
      if (snap.rank !== null) {
        prevRankMap.set(snap.userId, snap.rank);
      }
    });

  const totalPublishedTests = await prisma.test.count();
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
      availableTests,
      completedLast30Days,
      availableLast30Days,
      DEFAULT_RANKING_CONFIG
    );

    const isEligible = completedTests >= MIN_REQUIRED_TESTS;
    const latestScore = validAttempts[0]?.score ?? (completedTests > 0 ? avgScore : 0);
    const rankConfirmationProgress = Math.min(completedTests / DEFAULT_RANKING_CONFIG.confirmationTests, 1.0);
    const rankConfirmationState: RankConfirmationState = completedTests < 5 ? "LOCKED" : completedTests < 15 ? "PROVISIONAL" : "CONFIRMED";

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
    const prevRank = prevRankMap.get(student.id);
    const rankChange = (prevRank !== undefined && prevRank !== null) ? prevRank - currentRank : null;

    let rankStatus = RankStatus.SAME;
    if (prevRank === undefined || prevRank === null) {
      rankStatus = RankStatus.NEW;
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
  const snapshotsForGrowth: SnapshotForGrowth[] = dbSnapshots
    .filter((s) => s.periodCode === previousWeekCode)
    .map((s) => ({ userId: s.userId, score: s.score, rank: s.rank }));

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

  const studentsNeedingSupport = needSupportStudentsList.slice(0, 3).map((s) => ({
    id: s.id,
    name: s.name,
    rank: (s as any).rank || null,
    reason: s.avgScore < 5.0
      ? `Điểm trung bình bài vừa rồi: ${s.avgScore}`
      : `Chưa hoàn thành đủ 5 bài kiểm tra (Hiện có ${s.completedTests}/5 bài)`,
    type: s.avgScore < 5.0 ? "SCORE" : "INCOMPLETE",
  }));

  // Gaps calculation (Ahead & Behind) for Current User (No fake gaps)
  let aheadGapScore: number | null = null;
  let aheadStudentName: string | null = null;
  let behindGapScore: number | null = null;
  let behindStudentName: string | null = null;

  if (currentUserRanked && currentUserRanked.rank && currentUserRanked.rank > 1) {
    const prevStudent = rankedEligible[currentUserRanked.rank - 2];
    if (prevStudent) {
      aheadGapScore = parseFloat((prevStudent.avgScore - currentUserRanked.avgScore).toFixed(2));
      aheadStudentName = prevStudent.name;
    }
  }

  if (currentUserRanked && currentUserRanked.rank && currentUserRanked.rank < rankedEligible.length) {
    const nextStudent = rankedEligible[currentUserRanked.rank];
    if (nextStudent) {
      behindGapScore = parseFloat((currentUserRanked.avgScore - nextStudent.avgScore).toFixed(2));
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
    teacherAnalytics: {
      gradeDistribution,
      studentsNeedingSupport,
      topProgressingStudents: growthEngineOutput.topProgressingStudents,
    },
    studentWeeklyProgress,
  };
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
  const session = await auth();
  if (!session || (session.user.role !== "ADMIN" && session.user.role !== "TEACHER")) {
    throw new Error("Unauthorized: Only Admin or Teacher can freeze snapshots");
  }

  const currentWeekCode = getWeekCode(new Date(), 0);

  const students = await prisma.user.findMany({
    where: studyClassId ? { classId: studyClassId, role: "STUDENT" } : { role: "STUDENT" },
    select: {
      id: true,
      classId: true,
      attempts: {
        where: { score: { not: null } },
        select: { score: true, completedAt: true, testId: true },
      },
    },
  });

  const MIN_REQUIRED_TESTS = 5;
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
    const academicScore = avgScore * 10;
    const participationScore = Math.min(completedTests / 30, 1.0) * 100;
    const rankingScore = parseFloat((academicScore * 0.85 + participationScore * 0.15).toFixed(1));

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
  eligible.sort((a, b) => b.rankingScore - a.rankingScore);

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
