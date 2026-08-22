export type GameRankType = 'SSS' | 'SS' | 'S' | 'A' | 'B' | 'C';

export interface GameRankTheme {
  label: string;
  title: string;
  color: string;
  badgeBg: string;
  borderColor: string;
  glowColor: string;
}

export const RANKING_CONFIG = {
  bayesianPrior: 10,       // k = 10 prior attempts
  globalAverage: 7.5,      // Class global average prior
  minLeaderboardTests: 5,  // Min 5 tests to enter Official Leaderboard
  fullConfidenceTests: 15, // 15 tests = 100% confidence (Confirmed Rank)
  xpPerTest: 100,
  xpPerStreakBonus: 50,
  xpPerLevel: 500,
};

export const RANK_THEMES: Record<GameRankType, GameRankTheme> = {
  SSS: {
    label: 'Rank SSS (Huyền Thoại)',
    title: 'Huyền Thoại Thợ Săn (Shadow Sovereign)',
    color: 'text-amber-400 font-black tracking-wider',
    badgeBg: 'bg-amber-500/20 border border-amber-400/80 text-amber-300 shadow-[0_0_12px_rgba(245,158,11,0.4)]',
    borderColor: 'border-amber-500/70',
    glowColor: 'shadow-amber-500/40 shadow-2xl animate-aura-pulse',
  },
  SS: {
    label: 'Rank SS (Bán Thần)',
    title: 'Thợ Săn Bán Thần (Monarch Champion)',
    color: 'text-orange-400 font-black tracking-wider',
    badgeBg: 'bg-orange-500/20 border border-orange-400/80 text-orange-300 shadow-[0_0_10px_rgba(249,115,22,0.4)]',
    borderColor: 'border-orange-500/70',
    glowColor: 'shadow-orange-500/30 shadow-xl',
  },
  S: {
    label: 'Rank S (Cao Thủ)',
    title: 'Cao Thủ Thợ Săn (Monarch Hunter)',
    color: 'text-rose-400 font-extrabold',
    badgeBg: 'bg-rose-500/20 border border-rose-400/80 text-rose-300 shadow-[0_0_10px_rgba(244,63,94,0.3)]',
    borderColor: 'border-rose-500/60',
    glowColor: 'shadow-rose-600/30 shadow-xl',
  },
  A: {
    label: 'Rank A (Tinh Nhuệ)',
    title: 'Thợ Săn Tinh Nhuệ (Elite Hunter)',
    color: 'text-cyan-300 font-extrabold',
    badgeBg: 'bg-cyan-500/20 border border-cyan-400/70 text-cyan-300 shadow-[0_0_8px_rgba(6,182,212,0.3)]',
    borderColor: 'border-cyan-500/50',
    glowColor: 'shadow-cyan-500/25 shadow-lg',
  },
  B: {
    label: 'Rank B (Trung Cấp)',
    title: 'Thợ Săn Trung Cấp (Veteran Hunter)',
    color: 'text-emerald-400 font-bold',
    badgeBg: 'bg-emerald-500/20 border border-emerald-400/60 text-emerald-300 shadow-[0_0_8px_rgba(16,185,129,0.3)]',
    borderColor: 'border-emerald-500/40',
    glowColor: 'shadow-emerald-500/20 shadow-md',
  },
  C: {
    label: 'Rank C (Khởi Nguyên)',
    title: 'Thợ Săn Khởi Nguyên (Awakening Hunter)',
    color: 'text-slate-300 font-medium',
    badgeBg: 'bg-slate-800/80 text-slate-300 font-semibold border border-slate-700/80',
    borderColor: 'border-slate-700/50',
    glowColor: '',
  },
};

/**
 * Pure Function 1: Bayesian Average Skill Calculation
 * Formula: BayesianSkill = (avgScore * n + globalAverage * k) / (n + k)
 */
export function calculateBayesianSkill(avgScore: number, completedTests: number): number {
  if (completedTests <= 0) return RANKING_CONFIG.globalAverage;
  const safeAvg = Math.max(0, Math.min(10, avgScore > 10 ? avgScore / 10 : avgScore));
  const bayesian = (safeAvg * completedTests + RANKING_CONFIG.globalAverage * RANKING_CONFIG.bayesianPrior) / (completedTests + RANKING_CONFIG.bayesianPrior);
  return parseFloat(bayesian.toFixed(2));
}

/**
 * Pure Function 2: Confidence Calculation
 * Formula: min(1.0, completedTests / 15)
 */
export function calculateConfidence(completedTests: number): { confidenceRatio: number; confidencePercent: number } {
  const safeTests = Math.max(0, completedTests);
  const confidenceRatio = Math.min(1.0, safeTests / RANKING_CONFIG.fullConfidenceTests);
  const confidencePercent = Math.round(confidenceRatio * 100);
  return { confidenceRatio, confidencePercent };
}

/**
 * Pure Function 3: Power Score Calculation
 * PowerScore = BayesianSkill * 10
 */
export function calculatePowerScore(bayesianSkill: number): { powerScore: number; displayPowerText: string } {
  const powerScore = parseFloat((bayesianSkill * 10).toFixed(1));
  return {
    powerScore,
    displayPowerText: powerScore.toFixed(1),
  };
}

/**
 * Pure Function 4: Event-based XP & Level Calculation
 * XP = (completedTests * 100) + min(completedTests * 50, streak * 50)
 * Level = floor(XP / 500) + 1
 */
export function calculateXPAndLevel(completedTests: number, streak: number = 0): {
  totalXp: number;
  level: number;
  currentLevelXp: number;
  xpToNextLevel: number;
  xpPercent: number;
} {
  const safeTests = Math.max(0, completedTests);
  const safeStreak = Math.max(0, streak);

  const xpFromTests = safeTests * RANKING_CONFIG.xpPerTest;
  const xpFromStreak = Math.min(safeTests * RANKING_CONFIG.xpPerStreakBonus, safeStreak * RANKING_CONFIG.xpPerStreakBonus);
  const totalXp = xpFromTests + xpFromStreak;

  const level = Math.floor(totalXp / RANKING_CONFIG.xpPerLevel) + 1;
  const currentLevelXp = totalXp % RANKING_CONFIG.xpPerLevel;
  const xpToNextLevel = level * RANKING_CONFIG.xpPerLevel;
  const xpPercent = Math.round((currentLevelXp / RANKING_CONFIG.xpPerLevel) * 100);

  return {
    totalXp,
    level,
    currentLevelXp,
    xpToNextLevel,
    xpPercent,
  };
}

/**
 * Pure Function 5: Projected Rank Tier mapping by score (for non-leaderboard standalone calculations)
 */
export function determineScoreRankTier(score: number): GameRankType {
  const safe = Math.max(0, Math.min(10, score > 10 ? score / 10 : score));
  if (safe >= 9.5) return 'SSS';
  if (safe >= 9.0) return 'SS';
  if (safe >= 8.5) return 'S';
  if (safe >= 7.5) return 'A';
  if (safe >= 6.0) return 'B';
  return 'C';
}

/**
 * Backward compatibility helper for legacy UI components
 */
export function calculateGameRank(
  score: number,
  rankPosition: number | null,
  totalStudents: number,
  completedTests: number,
  minRequiredTests: number = 5
) {
  const bayesianSkill = calculateBayesianSkill(score, completedTests);
  const { powerScore } = calculatePowerScore(bayesianSkill);
  const { confidencePercent } = calculateConfidence(completedTests);
  const { level, totalXp, xpPercent } = calculateXPAndLevel(completedTests);

  const isEligible = completedTests >= minRequiredTests;
  const isProvisional = completedTests < RANKING_CONFIG.fullConfidenceTests;
  const potentialRank = determineScoreRankTier(bayesianSkill);

  const theme = RANK_THEMES[potentialRank];

  return {
    rank: isEligible ? potentialRank : null,
    potentialRank,
    label: isEligible
      ? (isProvisional ? `🔒 RANK ${potentialRank} (PROVISIONAL)` : theme.label)
      : `🔒 Chưa mở khóa (Rank dự kiến: ${potentialRank})`,
    title: theme.title,
    color: theme.color,
    badgeBg: theme.badgeBg,
    borderColor: theme.borderColor,
    glowColor: theme.glowColor,
    percentile: Math.round(((totalStudents - (rankPosition || totalStudents) + 1) / totalStudents) * 100),
    currentScore: parseFloat((score > 10 ? score / 10 : score).toFixed(2)),
    powerScore,
    confidencePercent,
    level,
    totalXp,
    expPercent: xpPercent,
    nextRank: potentialRank === 'SSS' ? null : potentialRank === 'SS' ? 'SSS' : potentialRank === 'S' ? 'SS' : potentialRank === 'A' ? 'S' : potentialRank === 'B' ? 'A' : 'B',
    scoreToNextRank: 0.5,
    eligibility: {
      isEligible,
      completedTests,
      minRequiredTests,
    },
  };
}
