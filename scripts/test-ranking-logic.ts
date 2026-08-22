import { calculateBayesianSkill } from "../lib/game-rank";
import { calculateRankingScore } from "../lib/ranking-calculator";
import { DEFAULT_RANKING_CONFIG } from "../lib/ranking-config";

console.log("=== VERIFICATION TEST SUITE: OPTION B BAYESIAN RANKING ENGINE ===\n");

const testCases = [
  { name: "0 tests @ null", tests: 0, avg: 0, expectedSkill: 7.5, expectedState: "LOCKED" },
  { name: "1 test @ 10.0", tests: 1, avg: 10.0, expectedSkill: 7.73, expectedState: "LOCKED" },
  { name: "5 tests @ 10.0", tests: 5, avg: 10.0, expectedSkill: 8.33, expectedState: "PROVISIONAL" },
  { name: "10 tests @ 10.0", tests: 10, avg: 10.0, expectedSkill: 8.75, expectedState: "PROVISIONAL" },
  { name: "15 tests @ 9.2", tests: 15, avg: 9.2, expectedSkill: 8.52, expectedState: "CONFIRMED" },
  { name: "20 tests @ 9.2", tests: 20, avg: 9.2, expectedSkill: 8.63, expectedState: "CONFIRMED" },
];

testCases.forEach((tc) => {
  const skill = calculateBayesianSkill(tc.avg, tc.tests);
  const breakdown = calculateRankingScore(tc.avg, tc.tests, 28, Math.min(tc.tests, 10), 10, DEFAULT_RANKING_CONFIG);
  const state = tc.tests < 5 ? "LOCKED" : tc.tests < 15 ? "PROVISIONAL" : "CONFIRMED";

  console.log(`Test [${tc.name}]:`);
  console.log(`  - BayesianSkill: ${skill} (Expected ~${tc.expectedSkill})`);
  console.log(`  - AcademicScore: ${breakdown.academicScore}`);
  console.log(`  - Total RankingScore: ${breakdown.totalScore}`);
  console.log(`  - Rank State: ${state} (Expected ${tc.expectedState})\n`);
});

// Verification: 1 test @ 10.0 vs 20 tests @ 9.2
const student1 = calculateRankingScore(10.0, 1, 28, 1, 10, DEFAULT_RANKING_CONFIG);
const student20 = calculateRankingScore(9.2, 20, 28, 10, 10, DEFAULT_RANKING_CONFIG);

console.log("=== HEAD-TO-HEAD COMPARISON: 1 Test @ 10.0 vs 20 Tests @ 9.2 ===");
console.log(`Student A (1 test @ 10.0):  Academic Score = ${student1.academicScore}, Total Score = ${student1.totalScore}`);
console.log(`Student B (20 tests @ 9.2): Academic Score = ${student20.academicScore}, Total Score = ${student20.totalScore}`);

if (student20.academicScore > student1.academicScore) {
  console.log("\n✅ SUCCESS: Student B (20 tests @ 9.2) correctly ranks higher than Student A (1 test @ 10.0)!");
} else {
  console.log("\n❌ FAIL: Student A ranked higher despite small-sample bias.");
}
