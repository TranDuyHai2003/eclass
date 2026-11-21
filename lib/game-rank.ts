import { canOptimizeImage } from "@/lib/image-hosts";
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
    color: 'text-amber-600 font-black tracking-wider',
    badgeBg: 'bg-gradient-to-r from-amber-100 to-yellow-50 border border-amber-300 text-amber-800',
    borderColor: 'border-amber-300',
    glowColor: 'shadow-amber-200/60 shadow-lg',
  },
  SS: {
    label: 'Rank SS (Bán Thần)',
    title: 'Thợ Săn Bán Thần (Monarch Champion)',
    color: 'text-orange-600 font-black tracking-wider',
    badgeBg: 'bg-orange-50 border border-orange-300 text-orange-700',
    borderColor: 'border-orange-300',
    glowColor: 'shadow-orange-200/50 shadow-md',
  },
  S: {
    label: 'Rank S (Cao Thủ)',
    title: 'Cao Thủ Thợ Săn (Monarch Hunter)',
    color: 'text-rose-600 font-extrabold',
    badgeBg: 'bg-rose-50 border border-rose-200 text-rose-700',
    borderColor: 'border-rose-200',
    glowColor: '',
  },
  A: {
    label: 'Rank A (Tinh Nhuệ)',
    title: 'Thợ Săn Tinh Nhuệ (Elite Hunter)',
    color: 'text-blue-700 font-extrabold',
    badgeBg: 'bg-blue-50 border border-blue-200 text-blue-700',
    borderColor: 'border-blue-200',
    glowColor: '',
  },
  B: {
    label: 'Rank B (Trung Cấp)',
    title: 'Thợ Săn Trung Cấp (Veteran Hunter)',
    color: 'text-emerald-700 font-bold',
    badgeBg: 'bg-emerald-50 border border-emerald-200 text-emerald-700',
    borderColor: 'border-emerald-200',
    glowColor: '',
  },
  C: {
    label: 'Rank C (Khởi Nguyên)',
    title: 'Thợ Săn Khởi Nguyên (Awakening Hunter)',
    color: 'text-slate-600 font-medium',
    badgeBg: 'bg-slate-100 text-slate-600 font-semibold border border-slate-200',
    borderColor: 'border-slate-200',
    glowColor: '',
  },
  DANGER: {
    label: 'Rank Báo Động (Chưa Làm Bài)',
    title: 'Thợ Săn Chưa Hoạt Động (Inactive State)',
    color: 'text-red-600 font-black tracking-wider',
    badgeBg: 'bg-red-50 border border-red-300 text-red-700',
    borderColor: 'border-red-300',
    glowColor: '',
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
 * Ảnh đại diện cỡ nhỏ cho thẻ <img> thường (KHÔNG dùng cho next/image — nó tự tối ưu).
 * Ảnh tải lên thường là ảnh gốc từ điện thoại (có ảnh > 4MB) nhưng chỉ hiển thị vài chục px
 * → đi qua bộ tối ưu của Next để nhận bản WebP rộng `size`px.
 */
export function getAvatarThumbUrl(name?: string | null, image?: string | null, size: 64 | 128 | 256 = 128): string {
  const src = getSafeAvatarUrl(name, image);
  return image && canOptimizeImage(src) && !src.startsWith("/")
    ? `/_next/image?url=${encodeURIComponent(src)}&w=${size}&q=75`
    : src;
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
 * Hạng theo VỊ TRÍ trong lớp — nguồn duy nhất, khớp với "Quy tắc Rank" hiển thị cho học sinh:
 * SSS = top 3, SS = top 5%, S = top 10%, A = top 25%, B = top 50%, C = còn lại.
 */
export function rankTierByPosition(position: number, totalCount: number): GameRankType {
  if (position <= 3) return 'SSS';
  const top5Count = Math.max(3, Math.ceil(totalCount * 0.05));
  if (position <= top5Count) return 'SS';
  const top10Count = Math.max(top5Count, Math.ceil(totalCount * 0.10));
  if (position <= top10Count) return 'S';
  const top25Count = Math.max(top10Count, Math.ceil(totalCount * 0.25));
  if (position <= top25Count) return 'A';
  const top50Count = Math.max(top25Count, Math.ceil(totalCount * 0.50));
  if (position <= top50Count) return 'B';
  return 'C';
}

/**
 * Legacy compatibility helper
 * Hạng (rank) lấy theo vị trí khi có vị trí — trước đây lấy theo điểm TB nên cùng một học sinh
 * hiện SSS ở thẻ chính nhưng "Rank A" ở thanh dưới / bảng giáo viên.
 */
export function calculateGameRank(
  score: number,
  rankPosition: number | null,
  totalStudents: number,
  completedTests: number,
  minRequiredTests: number = 1
) {
  const { powerScore, displayPowerText } = calculateSimplePowerScore(score, completedTests);
  const hasPosition = typeof rankPosition === "number" && rankPosition > 0 && completedTests > 0;
  const potentialRank = hasPosition ? rankTierByPosition(rankPosition, Math.max(1, totalStudents)) : determineScoreRankTier(score);
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
      isEligible: completedTests >= minRequiredTests,
      completedTests,
      minRequiredTests,
    },
  };
}
