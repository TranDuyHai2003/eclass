import {
  GameRankType,
  GameRankTheme,
  RANK_THEMES,
  RANKING_CONFIG,
  calculateBayesianSkill,
  calculateConfidence,
  calculatePowerScore,
  calculateXPAndLevel,
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
  isEligibleForLeaderboard: boolean; // completedTests >= 5
  isProvisional: boolean;            // completedTests < 15
  isZeroTests: boolean;              // completedTests === 0

  // Ranks
  rank: GameRankType | null;          // Official rank if eligible, null if !eligible
  provisionalRank: GameRankType;     // Projected rank
  theme: GameRankTheme;

  // Performance
  rawAverageScore: number;
  bayesianSkill: number;
  confidencePercent: number;
  powerScore: number;
  displayPowerText: string;          // "—" for 0 tests, "88.6" for active

  // Progression
  level: number;
  totalXp: number;
  xpPercent: number;
  completedTests: number;
  remainingTestsForConfirmation: number;
  streak: number;

  // Leaderboard Position & Percentile
  position: number | null;           // Rank position on Official Leaderboard (null if !eligible)
  totalEligibleStudents: number;
  topPercent: number;
  displayTopText: string;            // e.g. "Top 1%"

  // Movement
  movement: {
    previousPosition: number | null;
    delta: number;
    direction: "up" | "down" | "same" | "new";
    displayDeltaText: string;
  };
}

/**
 * Deterministic 5-Level Tie-Breaking Comparison
 * 1. Power Score DESC
 * 2. Bayesian Skill DESC
 * 3. Confidence Percent DESC
 * 4. Completed Tests DESC
 * 5. Student ID ASC (Deterministic Fallback)
 */
function deterministicTieBreak(a: HunterStudentOutput, b: HunterStudentOutput): number {
  if (b.powerScore !== a.powerScore) {
    return b.powerScore - a.powerScore;
  }
  if (b.bayesianSkill !== a.bayesianSkill) {
    return b.bayesianSkill - a.bayesianSkill;
  }
  if (b.confidencePercent !== a.confidencePercent) {
    return b.confidencePercent - a.confidencePercent;
  }
  if (b.completedTests !== a.completedTests) {
    return b.completedTests - a.completedTests;
  }
  return a.id.localeCompare(b.id);
}

/**
 * Assign Rank Tier based on Official Position & Total Eligible Count
 */
function assignRankTierByPosition(position: number, totalEligible: number): GameRankType {
  if (position <= 3) return 'SSS';
  const top5Count = Math.max(3, Math.ceil(totalEligible * 0.05));
  if (position <= top5Count) return 'SS';
  const top10Count = Math.max(top5Count, Math.ceil(totalEligible * 0.10));
  if (position <= top10Count) return 'S';
  const top25Count = Math.max(top10Count, Math.ceil(totalEligible * 0.25));
  if (position <= top25Count) return 'A';
  const top50Count = Math.max(top25Count, Math.ceil(totalEligible * 0.50));
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
    const isEligibleForLeaderboard = completedTests >= RANKING_CONFIG.minLeaderboardTests;
    const isProvisional = completedTests < RANKING_CONFIG.fullConfidenceTests;

    const bayesianSkill = calculateBayesianSkill(safeAvgScore, completedTests);
    const { confidencePercent } = calculateConfidence(completedTests);
    const { powerScore, displayPowerText } = calculatePowerScore(bayesianSkill);
    const { level, totalXp, xpPercent } = calculateXPAndLevel(completedTests, streak);

    const provisionalRank = determineScoreRankTier(bayesianSkill);
    const theme = RANK_THEMES[provisionalRank];

    const remainingTestsForConfirmation = Math.max(0, RANKING_CONFIG.fullConfidenceTests - completedTests);

    return {
      id: s.id,
      name: s.name || "Thợ săn",
      image: s.image || "",
      isEligibleForLeaderboard,
      isProvisional,
      isZeroTests,
      rank: null, // Will be set after sorting eligible list
      provisionalRank,
      theme,
      rawAverageScore: parseFloat(safeAvgScore.toFixed(2)),
      bayesianSkill,
      confidencePercent,
      powerScore: isZeroTests ? 0 : powerScore,
      displayPowerText: isZeroTests ? "—" : displayPowerText,
      level,
      totalXp,
      xpPercent,
      completedTests,
      remainingTestsForConfirmation,
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

  // Separate eligible from non-eligible
  const eligibleList = processedList.filter((s) => s.isEligibleForLeaderboard);
  const provisionalList = processedList.filter((s) => !s.isEligibleForLeaderboard);

  // Deterministic 5-level sort on eligible students ONLY
  eligibleList.sort(deterministicTieBreak);

  const totalEligibleCount = eligibleList.length || 1;

  // Assign official Leaderboard positions & Ranks
  eligibleList.forEach((student, index) => {
    const position = index + 1;
    student.position = position;
    student.totalEligibleStudents = totalEligibleCount;

    const rankTier = assignRankTierByPosition(position, totalEligibleCount);
    student.rank = rankTier;
    student.provisionalRank = rankTier;
    student.theme = RANK_THEMES[rankTier];

    const rawTop = Math.ceil((position / totalEligibleCount) * 100);
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
    leaderboard: eligibleList,
    provisionalList,
    allStudents: processedList,
    totalEligibleCount,
  };
}
