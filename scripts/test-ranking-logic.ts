import { DEFAULT_RANKING_CONFIG, RankStatus } from "../lib/ranking-config";
import { calculateRankingScore } from "../lib/ranking-calculator";

function assert(condition: boolean, message: string) {
  if (!condition) {
    console.error(`❌ TEST FAILED: ${message}`);
    process.exit(1);
  }
  console.log(`✅ TEST PASSED: ${message}`);
}

console.log("=== STARTING LEADERBOARD UNIT TESTS ===");

// TEST 1: Fairness Test (Academic Score vs Bonus)
const studentA = calculateRankingScore(9.2, 5, 30, 0, 10, DEFAULT_RANKING_CONFIG);
const studentB = calculateRankingScore(8.0, 30, 30, 10, 10, DEFAULT_RANKING_CONFIG);

assert(
  studentA.totalScore > studentB.totalScore,
  `Fairness Guarantee: High Academic Student A (GPA 9.2, Score=${studentA.totalScore}) MUST beat Student B (GPA 8.0 + Max Bonus, Score=${studentB.totalScore})`
);

// TEST 2: Bonus Bounds Test
const maxBonusStudent = calculateRankingScore(10.0, 50, 20, 20, 10, DEFAULT_RANKING_CONFIG);
assert(
  maxBonusStudent.completionBonus <= DEFAULT_RANKING_CONFIG.maxCompletionBonus,
  `Completion bonus (${maxBonusStudent.completionBonus}) capped at maxCompletionBonus (${DEFAULT_RANKING_CONFIG.maxCompletionBonus})`
);
assert(
  maxBonusStudent.activityBonus <= DEFAULT_RANKING_CONFIG.maxActivityBonus,
  `Activity bonus (${maxBonusStudent.activityBonus}) capped at maxActivityBonus (${DEFAULT_RANKING_CONFIG.maxActivityBonus})`
);
assert(
  maxBonusStudent.totalScore === 110,
  `Max total score for 10.0 GPA with max bonus is 110.0 (got ${maxBonusStudent.totalScore})`
);

// TEST 3: Tie-breaker Order Test
interface MockStudent {
  id: string;
  name: string;
  avgScore: number;
  rankingScore: number;
  completedTests: number;
  streak: number;
}

const mockStudents: MockStudent[] = [
  { id: "1", name: "Student 1 (Lower Avg)", avgScore: 8.0, rankingScore: 88, completedTests: 10, streak: 5 },
  { id: "2", name: "Student 2 (Higher Avg)", avgScore: 8.5, rankingScore: 88, completedTests: 5, streak: 2 },
  { id: "3", name: "Student 3 (Higher Tests)", avgScore: 8.5, rankingScore: 88, completedTests: 8, streak: 1 },
  { id: "4", name: "Student 4 (Higher Streak)", avgScore: 8.5, rankingScore: 88, completedTests: 8, streak: 7 },
];

mockStudents.sort((a, b) => {
  if (b.rankingScore !== a.rankingScore) return b.rankingScore - a.rankingScore;
  if (b.avgScore !== a.avgScore) return b.avgScore - a.avgScore;
  if (b.completedTests !== a.completedTests) return b.completedTests - a.completedTests;
  return b.streak - a.streak;
});

assert(mockStudents[0].id === "4", "Tie-breaker 1st place should be Student 4 (High Avg, High Tests, High Streak)");
assert(mockStudents[1].id === "3", "Tie-breaker 2nd place should be Student 3 (High Avg, High Tests, Lower Streak)");
assert(mockStudents[2].id === "2", "Tie-breaker 3rd place should be Student 2 (High Avg, Lower Tests)");
assert(mockStudents[3].id === "1", "Tie-breaker 4th place should be Student 1 (Lower Avg)");

// TEST 4: RankStatus Determination Test
function getRankStatus(
  currentRank: number | null,
  prevRank: number | null,
  isEligible: boolean
): RankStatus {
  if (!isEligible) {
    return prevRank !== null ? RankStatus.EXIT : RankStatus.SAME;
  }
  if (prevRank === null) {
    return RankStatus.NEW;
  }
  if (currentRank! < prevRank) return RankStatus.UP;
  if (currentRank! > prevRank) return RankStatus.DOWN;
  return RankStatus.SAME;
}

assert(getRankStatus(1, null, true) === RankStatus.NEW, "New eligible student gets NEW status");
assert(getRankStatus(null, 5, false) === RankStatus.EXIT, "Previously ranked student now ineligible gets EXIT status");
assert(getRankStatus(2, 5, true) === RankStatus.UP, "Moving from rank 5 to 2 gets UP status");
assert(getRankStatus(8, 3, true) === RankStatus.DOWN, "Moving from rank 3 to 8 gets DOWN status");
assert(getRankStatus(4, 4, true) === RankStatus.SAME, "Staying at rank 4 gets SAME status");

console.log("\n🎉 ALL UNIT TESTS PASSED SUCCESSFULLY! 🎉\n");
