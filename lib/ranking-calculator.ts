import { DEFAULT_RANKING_CONFIG, RankingConfig } from "./ranking-config";
import { calculateBayesianSkill } from "./game-rank";

export interface ScoreBreakdown {
  academicScore: number;
  bayesianSkill: number;
  completionBonus: number;
  activityBonus: number;
  totalScore: number;
}

export function calculateAcademicScore(
  avgScore: number,
  completedTests: number,
  config: RankingConfig = DEFAULT_RANKING_CONFIG
): { academicScore: number; bayesianSkill: number } {
  const bayesianSkill = calculateBayesianSkill(avgScore, completedTests);
  const academicScore = parseFloat((bayesianSkill * config.baseScoreMultiplier).toFixed(1));
  return { academicScore, bayesianSkill };
}

export function calculateCompletionBonus(
  completedTests: number,
  availableTests: number,
  config: RankingConfig = DEFAULT_RANKING_CONFIG
): number {
  if (availableTests <= 0 || completedTests <= 0) return 0;
  const rate = Math.min(1.0, completedTests / availableTests);
  return parseFloat((rate * config.maxCompletionBonus).toFixed(1));
}

export function calculateActivityBonus(
  completedLast30Days: number,
  availableLast30Days: number,
  config: RankingConfig = DEFAULT_RANKING_CONFIG
): number {
  if (availableLast30Days <= 0 || completedLast30Days <= 0) return 0;
  const rate = Math.min(1.0, completedLast30Days / availableLast30Days);
  return parseFloat((rate * config.maxActivityBonus).toFixed(1));
}

export function calculateRankingScore(
  avgScore: number,
  completedTests: number,
  availableTests: number,
  completedLast30Days: number,
  availableLast30Days: number,
  config: RankingConfig = DEFAULT_RANKING_CONFIG
): ScoreBreakdown {
  const { academicScore, bayesianSkill } = calculateAcademicScore(avgScore, completedTests, config);
  const completionBonus = calculateCompletionBonus(completedTests, availableTests, config);
  const activityBonus = calculateActivityBonus(completedLast30Days, availableLast30Days, config);

  const totalScore = parseFloat((academicScore + completionBonus + activityBonus).toFixed(2));

  return {
    academicScore,
    bayesianSkill,
    completionBonus,
    activityBonus,
    totalScore,
  };
}
