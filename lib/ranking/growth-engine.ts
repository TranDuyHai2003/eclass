export interface StudentGrowthMetrics {
  id: string;
  name: string;
  currentScore: number;
  previousScore: number | null;
  scoreGrowth: number | null;
  currentRank: number | null;
  previousRank: number | null;
  rankChange: number | null;
  completedTests: number;
}

export interface MostImprovedStudentSummary {
  id: string;
  name: string;
  oldRank: number | null;
  newRank: number;
  rankGain: number | null;
  previousScore: number;
  currentScore: number;
  scoreGrowth: number;
}

export interface GrowthEngineOutput {
  studentGrowthList: StudentGrowthMetrics[];
  topProgressingStudents: StudentGrowthMetrics[];
  mostImprovedStudent: MostImprovedStudentSummary | null;
}

export interface StudentInputForGrowth {
  id: string;
  name: string;
  currentScore: number;
  currentRank: number | null;
  completedTests: number;
}

export interface SnapshotForGrowth {
  userId: string;
  score: number;
  rank: number | null;
}

/**
 * Calculate Growth Engine metrics based on actual previous snapshot comparisons
 */
export function calculateGrowthEngine(
  students: StudentInputForGrowth[],
  prevSnapshots: SnapshotForGrowth[] = []
): GrowthEngineOutput {
  const prevMap = new Map<string, SnapshotForGrowth>();
  prevSnapshots.forEach((snap) => {
    prevMap.set(snap.userId, snap);
  });

  const studentGrowthList: StudentGrowthMetrics[] = students.map((s) => {
    const prev = prevMap.get(s.id);
    const previousScore = prev ? prev.score : null;
    const previousRank = prev ? prev.rank : null;

    const scoreGrowth = previousScore !== null ? parseFloat((s.currentScore - previousScore).toFixed(1)) : null;
    const rankChange = (previousRank !== null && s.currentRank !== null) ? previousRank - s.currentRank : null;

    return {
      id: s.id,
      name: s.name,
      currentScore: s.currentScore,
      previousScore,
      scoreGrowth,
      currentRank: s.currentRank,
      previousRank,
      rankChange,
      completedTests: s.completedTests,
    };
  });

  // Top progressing students based on actual scoreGrowth DESC (filtering only those with valid previousScore)
  const validGrowthList = studentGrowthList
    .filter((s) => s.scoreGrowth !== null && s.scoreGrowth > 0)
    .sort((a, b) => (b.scoreGrowth || 0) - (a.scoreGrowth || 0));

  const topProgressingStudents = validGrowthList.slice(0, 5);

  let mostImprovedStudent: MostImprovedStudentSummary | null = null;
  if (validGrowthList.length > 0) {
    const top = validGrowthList[0];
    if (top.currentRank !== null && top.previousScore !== null && top.scoreGrowth !== null) {
      mostImprovedStudent = {
        id: top.id,
        name: top.name,
        oldRank: top.previousRank,
        newRank: top.currentRank,
        rankGain: top.rankChange,
        previousScore: top.previousScore,
        currentScore: top.currentScore,
        scoreGrowth: top.scoreGrowth,
      };
    }
  }

  return {
    studentGrowthList,
    topProgressingStudents,
    mostImprovedStudent,
  };
}
