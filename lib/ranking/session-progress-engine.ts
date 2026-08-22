import { determineScoreRankTier } from "../game-rank";

export interface SessionProgressItem {
  id: number;
  sessionName: string; // "BUỔI 01", "BUỔI 02", "BUỔI 03", "BUỔI 04"
  testTitle?: string;
  score: number | null; // Điểm làm bài buổi này
  cumulativeAvg: number | null; // ĐTB đến buổi này
  scoreDelta: number | null; // +X.X điểm so với buổi trước
  scoreGrowthPercent: number | null; // +X% điểm so với buổi trước
  positionPercentile: number | null; // Top X% toàn khóa (e.g. Top 15%)
  higherThanPercent: number | null; // Cao hơn X% bạn học (e.g. 85%)
  percentileDelta: number | null; // +X percentage points (e.g. +8% vị trí so với buổi trước)
  rankText: string; // RANK S/A/B/C
  status: "COMPLETED" | "CURRENT" | "LOCKED";
  isCurrent: boolean;
}

export interface SessionProgressEngineOutput {
  sessions: SessionProgressItem[];
  latestGrowthText: string | null;
  completedSessionsCount: number;
}

export interface StudentAttemptInput {
  testId: string;
  score: number;
  completedAt: Date | string | null;
}

export interface ClassMemberAvg {
  id: string;
  avgScore: number;
}

/**
 * Calculate Session-by-Session (Buổi 1, 2, 3, 4) Real Attempt Progress
 */
export function calculateSessionProgressEngine(
  userAttempts: StudentAttemptInput[],
  classMembers: ClassMemberAvg[] = [],
  targetSessionCount: number = 4
): SessionProgressEngineOutput {
  // Sort user attempts chronologically ASC (earliest to latest)
  const sortedAttempts = [...userAttempts]
    .filter((a) => a.score !== null && a.score !== undefined)
    .sort((a, b) => {
      const tA = a.completedAt ? new Date(a.completedAt).getTime() : 0;
      const tB = b.completedAt ? new Date(b.completedAt).getTime() : 0;
      return tA - tB;
    });

  // Keep unique tests chronologically
  const uniqueAttempts: StudentAttemptInput[] = [];
  const seenTests = new Set<string>();
  sortedAttempts.forEach((att) => {
    if (!seenTests.has(att.testId)) {
      seenTests.add(att.testId);
      uniqueAttempts.push(att);
    }
  });

  const totalCompleted = uniqueAttempts.length;

  let startIndex = 0;
  if (totalCompleted > targetSessionCount) {
    startIndex = totalCompleted - targetSessionCount;
  }

  const displayAttempts = uniqueAttempts.slice(startIndex, startIndex + targetSessionCount);

  let runningSum = 0;
  for (let i = 0; i < startIndex; i++) {
    runningSum += uniqueAttempts[i].score;
  }

  const sessions: SessionProgressItem[] = [];
  let prevAvg: number | null = null;
  let prevHigherThanPercent: number | null = null;
  let latestGrowthText: string | null = null;

  for (let i = 0; i < targetSessionCount; i++) {
    const sessionNum = startIndex + i + 1;
    const sessionName = `BUỔI ${String(sessionNum).padStart(2, "0")}`;
    const att = displayAttempts[i];

    if (att) {
      const score = parseFloat(att.score.toFixed(1));
      runningSum += score;
      const currentAvg = parseFloat((runningSum / (startIndex + i + 1)).toFixed(1));

      // Calculate score growth vs previous session
      let scoreDelta: number | null = null;
      let scoreGrowthPercent: number | null = null;
      if (prevAvg !== null) {
        scoreDelta = parseFloat((currentAvg - prevAvg).toFixed(1));
        if (prevAvg > 0) {
          scoreGrowthPercent = Math.round(((currentAvg - prevAvg) / prevAvg) * 100);
        }
      }

      // Calculate Class Position & HigherThanPercentile
      let positionPercentile: number | null = null;
      let higherThanPercent: number | null = null;
      let percentileDelta: number | null = null;

      if (classMembers.length > 0) {
        const higherCount = classMembers.filter((m) => m.avgScore > currentAvg).length;
        positionPercentile = Math.max(1, Math.ceil(((higherCount + 1) / classMembers.length) * 100));
        higherThanPercent = Math.max(0, 100 - positionPercentile);

        if (prevHigherThanPercent !== null) {
          percentileDelta = higherThanPercent - prevHigherThanPercent;
        }
      }

      const rankTier = determineScoreRankTier(currentAvg);
      const isCurrent = i === displayAttempts.length - 1;

      if (isCurrent && scoreDelta !== null) {
        latestGrowthText = scoreDelta >= 0
          ? `↑ +${scoreDelta}đ (+${scoreGrowthPercent || 0}%) SO VỚI BUỔI TRƯỚC`
          : `↓ ${scoreDelta}đ SO VỚI BUỔI TRƯỚC`;
      }

      sessions.push({
        id: i + 1,
        sessionName,
        score,
        cumulativeAvg: currentAvg,
        scoreDelta,
        scoreGrowthPercent,
        positionPercentile,
        higherThanPercent,
        percentileDelta,
        rankText: `RANK ${rankTier}`,
        status: "COMPLETED",
        isCurrent,
      });

      prevAvg = currentAvg;
      prevHigherThanPercent = higherThanPercent;
    } else {
      // Future / Pending Session
      const isCurrentSlot = i === displayAttempts.length;
      sessions.push({
        id: i + 1,
        sessionName,
        score: null,
        cumulativeAvg: null,
        scoreDelta: null,
        scoreGrowthPercent: null,
        positionPercentile: null,
        higherThanPercent: null,
        percentileDelta: null,
        rankText: "RANK -",
        status: isCurrentSlot ? "CURRENT" : "LOCKED",
        isCurrent: isCurrentSlot,
      });
    }
  }

  return {
    sessions,
    latestGrowthText,
    completedSessionsCount: totalCompleted,
  };
}
