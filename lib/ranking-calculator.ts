import { DEFAULT_RANKING_CONFIG, RankingConfig } from "./ranking-config";

export interface ScoreBreakdown {
  academicScore: number;
  completionBonus: number;
  activityBonus: number;
  totalScore: number;
}

export function calculateAcademicScore(
  avgScore: number,
  config: RankingConfig = DEFAULT_RANKING_CONFIG
): number {
  const safeAvg = Math.max(0, Math.min(10, avgScore));
  return parseFloat((safeAvg * config.baseScoreMultiplier).toFixed(1));
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
  const academicScore = calculateAcademicScore(avgScore, config);
  const completionBonus = calculateCompletionBonus(completedTests, availableTests, config);
  const activityBonus = calculateActivityBonus(completedLast30Days, availableLast30Days, config);
  
  const totalScore = parseFloat((academicScore + completionBonus + activityBonus).toFixed(2));

  return {
    academicScore,
    completionBonus,
    activityBonus,
    totalScore,
  };
}
