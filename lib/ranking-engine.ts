import {
  GameRankType,
  GameRankTheme,
  RANK_THEMES,
  calculateSimplePowerScore,
  determineScoreRankTier,
  rankTierByPosition,
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
  /** Chưa đủ số bài tối thiểu → vị trí chỉ là tạm tính (xếp sau mọi người đã đủ bài) */
  isProvisional: boolean;

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

/** Hạng theo vị trí — dùng chung với lib/game-rank.ts để mọi màn hiển thị cùng một hạng. */
const assignRankTierByPosition = rankTierByPosition;

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
      isProvisional: true,
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
        // rankChange null = chưa có dữ liệu tuần trước để so (không phải "mới vào") → hiện "—"
        direction: typeof s.rankChange === "number" ? (s.rankChange > 0 ? "up" : s.rankChange < 0 ? "down" : "same") : "new",
        displayDeltaText: typeof s.rankChange === "number" ? (s.rankChange > 0 ? `↑ ${s.rankChange}` : s.rankChange < 0 ? `↓ ${Math.abs(s.rankChange)}` : "–") : "—",
      },
    };
  });

  // All active students with tests participate in leaderboard
  const activeStudents = processedList.filter((s) => !s.isZeroTests);

  // Vị trí chính thức từ server (chỉ học sinh đủ số bài tối thiểu mới có). Người chưa đủ bài xếp SAU
  // tất cả người đã đủ (theo điểm sức mạnh) và mang nhãn "Tạm tính" — trước đây hai nhóm bị trộn
  // trong cùng một phép sắp xếp nên có thể có hai người cùng hiện "#1".
  const backendRank = new Map<string, number>();
  for (const s of students) {
    const r = (s as any)?.rank;
    if (typeof r === "number" && r > 0) backendRank.set(s.id, r);
  }
  activeStudents.sort((a, b) => {
    const ra = backendRank.get(a.id);
    const rb = backendRank.get(b.id);
    if (ra !== undefined && rb !== undefined) return ra - rb;
    if (ra !== undefined) return -1;
    if (rb !== undefined) return 1;
    return deterministicTieBreak(a, b);
  });

  const totalCount = activeStudents.length || 1;

  // Assign official Leaderboard positions & Ranks (liên tục 1..n, không trùng)
  activeStudents.forEach((student, index) => {
    const position = index + 1;
    student.position = position;
    student.isProvisional = !backendRank.has(student.id);
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
