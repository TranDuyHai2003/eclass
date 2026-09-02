export type GameRankType = 'SSS' | 'SS' | 'S' | 'A' | 'B' | 'C' | 'DANGER';

export interface GameRankTheme {
  label: string;
  title: string;
  color: string;
  badgeBg: string;
  borderColor: string;
  glowColor: string;
}

export const RANKING_CONFIG = {
  globalAverage: 7.5,      // Class global average prior
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
  DANGER: {
    label: 'Rank Báo Động (Chưa Làm Bài)',
    title: 'Thợ Săn Chưa Hoạt Động (Inactive State)',
    color: 'text-red-400 font-black tracking-wider animate-pulse',
    badgeBg: 'bg-red-950/90 border border-red-500/90 text-red-300 shadow-[0_0_12px_rgba(239,68,68,0.5)] animate-pulse',
    borderColor: 'border-red-500/80',
    glowColor: 'shadow-red-600/50 shadow-2xl',
  },
};

export function calculateBayesianSkill(avgScore: number, completedTests: number): number {
  const safeAvg = Math.max(0, Math.min(10, avgScore > 10 ? avgScore / 10 : avgScore));
  return parseFloat(safeAvg.toFixed(2));
}

/**
  * Safely get avatar URL with SVG data URI fallback instead of external ui-avatars.com
  */
export function getSafeAvatarUrl(name?: string | null, image?: string | null): string {
  if (image && image.trim() !== "") return image;
  const userName = (name || "Hunter").trim();
  const initial = (userName.charAt(0) || "H").toUpperCase();
  const svg = `<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 100 100">
    <rect width="100" height="100" fill="#0D8ABC"/>
    <text x="50%" y="54%" dominant-baseline="middle" text-anchor="middle" fill="#ffffff" font-size="46" font-family="sans-serif" font-weight="900">${initial}</text>
  </svg>`;
  return `data:image/svg+xml;utf8,${encodeURIComponent(svg)}`;
}

/**
 * Ultra-Simple Power Score Formula:
 * PowerScore = (rawAvgScore * 10) + (completedTests * 1) + (streak * 0.5)
 * Direct, transparent, 100% intuitive for students!
 */
export function calculateSimplePowerScore(
  avgScore: number,
  completedTests: number,
  streak: number = 0
): { powerScore: number; displayPowerText: string } {
  const safeAvg = Math.max(0, Math.min(10, avgScore > 10 ? avgScore / 10 : avgScore));
  const safeTests = Math.max(0, completedTests);
  const safeStreak = Math.max(0, streak);

  const rawPower = safeAvg * 10 + safeTests * 1 + safeStreak * 0.5;
  const powerScore = parseFloat(rawPower.toFixed(1));

  return {
    powerScore,
    displayPowerText: powerScore.toFixed(1),
  };
}

/**
 * Pure Function 2: Projected Rank Tier mapping by score (for non-leaderboard standalone calculations)
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
 * Legacy compatibility helper
 */
export function calculateGameRank(
  score: number,
  rankPosition: number | null,
  totalStudents: number,
  completedTests: number,
  minRequiredTests: number = 1
) {
  const { powerScore, displayPowerText } = calculateSimplePowerScore(score, completedTests);
  const potentialRank = determineScoreRankTier(score);
  const theme = RANK_THEMES[potentialRank];

  return {
    rank: potentialRank,
    potentialRank,
    label: theme.label,
    title: theme.title,
    color: theme.color,
    badgeBg: theme.badgeBg,
    borderColor: theme.borderColor,
    glowColor: theme.glowColor,
    percentile: Math.round(((totalStudents - (rankPosition || totalStudents) + 1) / totalStudents) * 100),
    currentScore: parseFloat((score > 10 ? score / 10 : score).toFixed(2)),
    powerScore,
    displayPowerText,
    nextRank: potentialRank === 'SSS' ? null : potentialRank === 'SS' ? 'SSS' : potentialRank === 'S' ? 'SS' : potentialRank === 'A' ? 'S' : potentialRank === 'B' ? 'A' : 'B',
    scoreToNextRank: 0.5,
    eligibility: {
      isEligible: true,
      completedTests,
      minRequiredTests: 1,
    },
  };
}
