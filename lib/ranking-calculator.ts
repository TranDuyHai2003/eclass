import { DEFAULT_RANKING_CONFIG, RankingConfig } from "./ranking-config";

export interface ScoreBreakdown {
  academicScore: number;
  bayesianSkill: number;
  completionBonus: number;
  activityBonus: number;
  totalScore: number;
}

export function calculateRankingScore(
  avgScore: number,
  completedTests: number,
  streak: number = 0
): ScoreBreakdown {
  const safeAvg = Math.max(0, Math.min(10, avgScore > 10 ? avgScore / 10 : avgScore));
  const academicScore = parseFloat((safeAvg * 10).toFixed(1));
  const completionBonus = parseFloat((completedTests * 1).toFixed(1));
  const activityBonus = parseFloat((streak * 0.5).toFixed(1));
  const totalScore = parseFloat((academicScore + completionBonus + activityBonus).toFixed(1));

  return {
    academicScore,
    bayesianSkill: safeAvg,
    completionBonus,
    activityBonus,
    totalScore,
  };
}

