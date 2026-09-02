import {
  GameRankType,
  GameRankTheme,
  RANK_THEMES,
  calculateSimplePowerScore,
  determineScoreRankTier,
} from "./game-rank";

export interface StudentInput {
  id: string;
  name?: string | null;
  image?: string | null;
  avgScore?: number | null;
  score?: number | null;
  completedTests?: number | null;
  streak?: number | null;
  previousRank?: number | null;
  rankChange?: number | null;
}

export interface HunterStudentOutput {
  id: string;
  name: string;
  image: string;

  // Status Flags
  isZeroTests: boolean;

  // Ranks
  rank: GameRankType | null;
  provisionalRank: GameRankType;
  theme: GameRankTheme;

  // Performance
  rawAverageScore: number;
  powerScore: number;
  displayPowerText: string;

  // Progression
  completedTests: number;
  streak: number;

  // Leaderboard Position & Percentile
  position: number | null;
  totalEligibleStudents: number;
  topPercent: number;
  displayTopText: string;

  // Movement
  movement: {
    previousPosition: number | null;
    delta: number;
    direction: "up" | "down" | "same" | "new";
    displayDeltaText: string;
  };
}

/**
 * Direct & Transparent Power Score Sort
 * 1. Power Score DESC
 * 2. Raw Average Score DESC
 * 3. Completed Tests DESC
 * 4. Student ID ASC
 */
function deterministicTieBreak(a: HunterStudentOutput, b: HunterStudentOutput): number {
  if (b.powerScore !== a.powerScore) {
    return b.powerScore - a.powerScore;
  }
  if (b.rawAverageScore !== a.rawAverageScore) {
    return b.rawAverageScore - a.rawAverageScore;
  }
  if (b.completedTests !== a.completedTests) {
    return b.completedTests - a.completedTests;
  }
  return a.id.localeCompare(b.id);
}

/**
 * Assign Rank Tier based on Official Position & Total Count
 */
function assignRankTierByPosition(position: number, totalCount: number): GameRankType {
  if (position <= 3) return 'SSS';
  const top5Count = Math.max(3, Math.ceil(totalCount * 0.05));
  if (position <= top5Count) return 'SS';
  const top10Count = Math.max(top5Count, Math.ceil(totalCount * 0.10));
  if (position <= top10Count) return 'S';
  const top25Count = Math.max(top10Count, Math.ceil(totalCount * 0.25));
  if (position <= top25Count) return 'A';
  const top50Count = Math.max(top25Count, Math.ceil(totalCount * 0.50));
  if (position <= top50Count) return 'B';
  return 'C';
}

/**
 * MAIN RANKING ENGINE: Process all student attempts into official Hunter Leaderboard Output
 */
export function calculateHunterLeaderboard(
  students: StudentInput[],
  totalStudentsInClass: number = 140
): {
  leaderboard: HunterStudentOutput[];
  provisionalList: HunterStudentOutput[];
  allStudents: HunterStudentOutput[];
  totalEligibleCount: number;
} {
  const processedList: HunterStudentOutput[] = students.map((s) => {
    const rawScore = s.avgScore ?? s.score ?? 7.5;
    const safeAvgScore = rawScore > 10 ? rawScore / 10 : rawScore;
    const completedTests = Math.max(0, s.completedTests ?? 0);
    const streak = Math.max(0, s.streak ?? 0);

    const isZeroTests = completedTests === 0;
    const { powerScore, displayPowerText } = calculateSimplePowerScore(safeAvgScore, completedTests, streak);
    const initialRank = determineScoreRankTier(safeAvgScore);
    const theme = RANK_THEMES[initialRank];

    return {
      id: s.id,
      name: s.name || "Thợ săn",
      image: s.image || "",
      isZeroTests,
      rank: initialRank,
      provisionalRank: initialRank,
      theme,
      rawAverageScore: parseFloat(safeAvgScore.toFixed(2)),
      powerScore: isZeroTests ? 0 : powerScore,
      displayPowerText: isZeroTests ? "—" : displayPowerText,
      completedTests,
      streak,
      position: null,
      totalEligibleStudents: 0,
      topPercent: 100,
      displayTopText: "Top 100%",
      movement: {
        previousPosition: s.previousRank || null,
        delta: s.rankChange || 0,
        direction: s.rankChange ? (s.rankChange > 0 ? "up" : s.rankChange < 0 ? "down" : "same") : "new",
        displayDeltaText: s.rankChange ? (s.rankChange > 0 ? `↑ ${s.rankChange}` : s.rankChange < 0 ? `↓ ${Math.abs(s.rankChange)}` : "-") : "NEW",
      },
    };
  });

  // All active students with tests participate in leaderboard
  const activeStudents = processedList.filter((s) => !s.isZeroTests);
  
  // If inputs already have backend rank position, sort by backend rank (s.rank)
  activeStudents.sort((a, b) => {
    const rawA = students.find((s) => s.id === a.id);
    const rawB = students.find((s) => s.id === b.id);
    const rankA = (rawA as any)?.rank;
    const rankB = (rawB as any)?.rank;
    if (typeof rankA === "number" && typeof rankB === "number") {
      return rankA - rankB;
    }
    return deterministicTieBreak(a, b);
  });

  const totalCount = activeStudents.length || 1;

  // Assign official Leaderboard positions & Ranks
  activeStudents.forEach((student, index) => {
    const rawInput = students.find((s) => s.id === student.id);
    const backendRank = (rawInput as any)?.rank;
    const position = typeof backendRank === "number" && backendRank > 0 ? backendRank : index + 1;
    student.position = position;
    student.totalEligibleStudents = totalCount;

    const rankTier = assignRankTierByPosition(position, totalCount);
    student.rank = rankTier;
    student.provisionalRank = rankTier;
    student.theme = RANK_THEMES[rankTier];

    const rawTop = Math.ceil((position / totalCount) * 100);
    const topPercent = Math.max(1, rawTop);
    student.topPercent = topPercent;
    student.displayTopText = `Top ${topPercent}%`;

    // Movement calculation
    if (student.movement.previousPosition) {
      const delta = student.movement.previousPosition - position;
      student.movement.delta = delta;
      student.movement.direction = delta > 0 ? "up" : delta < 0 ? "down" : "same";
      student.movement.displayDeltaText = delta > 0 ? `↑ ${delta}` : delta < 0 ? `↓ ${Math.abs(delta)}` : "-";
    }
  });

  return {
    leaderboard: activeStudents,
    provisionalList: [],
    allStudents: processedList,
    totalEligibleCount: totalCount,
  };
}
