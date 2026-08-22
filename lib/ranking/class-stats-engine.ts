export interface StudentClassStatInput {
  id: string;
  completedTests: number;
  currentStreak: number;
  currentRank: number | null;
  previousRank: number | null;
  avgScore: number;
  isEligible: boolean;
}

export interface ClassStatsOutput {
  classAvgScore: number;
  classParticipationRate: number; // Percentage 0 - 100
  studentsRankIncreasedCount: number;
  activeStreakStudentsCount: number;
  totalStudentsInClass: number;
  studentsWithAttemptsCount: number;
}

/**
 * Calculate Class Statistics deterministically with zero fake multipliers
 */
export function calculateClassStatsEngine(
  students: StudentClassStatInput[]
): ClassStatsOutput {
  const totalStudentsInClass = students.length;
  if (totalStudentsInClass === 0) {
    return {
      classAvgScore: 0,
      classParticipationRate: 0,
      studentsRankIncreasedCount: 0,
      activeStreakStudentsCount: 0,
      totalStudentsInClass: 0,
      studentsWithAttemptsCount: 0,
    };
  }

  // 1. Class Average Score among eligible students
  const eligibleScores = students.filter((s) => s.isEligible).map((s) => s.avgScore);
  const classAvgScore = eligibleScores.length > 0
    ? parseFloat((eligibleScores.reduce((a, b) => a + b, 0) / eligibleScores.length).toFixed(2))
    : 0;

  // 2. Class Participation Rate = (students with >= 1 attempt) / (total students in class)
  const studentsWithAttemptsCount = students.filter((s) => s.completedTests >= 1).length;
  const classParticipationRate = Math.round((studentsWithAttemptsCount / totalStudentsInClass) * 100);

  // 3. Students Rank Increased Count (currentRank < previousRank)
  const studentsRankIncreasedCount = students.filter((s) => {
    return s.previousRank !== null && s.currentRank !== null && s.currentRank < s.previousRank;
  }).length;

  // 4. Active Streak Students Count (currentStreak >= 2)
  const activeStreakStudentsCount = students.filter((s) => s.currentStreak >= 2).length;

  return {
    classAvgScore,
    classParticipationRate,
    studentsRankIncreasedCount,
    activeStreakStudentsCount,
    totalStudentsInClass,
    studentsWithAttemptsCount,
  };
}
