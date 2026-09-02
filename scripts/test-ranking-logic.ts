import { calculateBayesianSkill } from "../lib/game-rank";
import { calculateRankingScore } from "../lib/ranking-calculator";

console.log("=== VERIFICATION TEST SUITE: POWERSCORE RANKING ENGINE ===\n");

const testCases = [
  { name: "0 tests @ 0", tests: 0, avg: 0, streak: 0 },
  { name: "1 test @ 10.0", tests: 1, avg: 10.0, streak: 1 },
  { name: "5 tests @ 10.0", tests: 5, avg: 10.0, streak: 3 },
  { name: "10 tests @ 10.0", tests: 10, avg: 10.0, streak: 7 },
  { name: "15 tests @ 9.2", tests: 15, avg: 9.2, streak: 5 },
  { name: "20 tests @ 9.2", tests: 20, avg: 9.2, streak: 10 },
];

testCases.forEach((tc) => {
  const skill = calculateBayesianSkill(tc.avg, tc.tests);
  const breakdown = calculateRankingScore(tc.avg, tc.tests, tc.streak);

  console.log(`Test [${tc.name}]:`);
  console.log(`  - Raw Average: ${skill}`);
  console.log(`  - Academic Score: ${breakdown.academicScore}`);
  console.log(`  - Total PowerScore: ${breakdown.totalScore}\n`);
});

// Verification: 1 test @ 10.0 vs 20 tests @ 9.2
const student1 = calculateRankingScore(10.0, 1, 1);
const student20 = calculateRankingScore(9.2, 20, 10);

console.log("=== HEAD-TO-HEAD COMPARISON: 1 Test @ 10.0 vs 20 Tests @ 9.2 ===");
console.log(`Student A (1 test @ 10.0, streak 1):  Total PowerScore = ${student1.totalScore}`);
console.log(`Student B (20 tests @ 9.2, streak 10): Total PowerScore = ${student20.totalScore}`);

if (student20.totalScore > student1.totalScore) {
  console.log("\n✅ SUCCESS: Student B (20 tests @ 9.2) correctly ranks higher than Student A (1 test @ 10.0)!");
} else {
  console.log("\n❌ FAIL: Student A ranked higher despite low test count.");
}

