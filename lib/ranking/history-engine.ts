export interface PeriodSnapshotItem {
  periodCode: string;
  label: string;
  averageScore: number;
  rankingScore: number;
  completedTests: number;
  rank: number | null;
  isValid: boolean;
  statusMessage?: string;
}

export interface StudentHistoryOutput {
  periods: PeriodSnapshotItem[];
  hasSufficientData: boolean;
  deltaScore: number | null;
  initialScore: number | null;
  currentScore: number;
  feedbackMessage: string;
  feedbackType: "EXCELLENT" | "STABLE" | "NEEDS_IMPROVEMENT" | "INSUFFICIENT_DATA";
}

/**
 * Múi giờ nghiệp vụ: Việt Nam (Asia/Ho_Chi_Minh) = UTC+7, không có giờ mùa hè.
 * Server production chạy UTC nên KHÔNG được dùng getter giờ địa phương (getDate, getDay…)
 * — mọi phép tính tuần/tháng đều quy về "giờ treo tường" Việt Nam qua offset cố định.
 */
export const VN_UTC_OFFSET_MS = 7 * 60 * 60 * 1000;

/** Dời mốc thời gian sang giờ VN để đọc bằng getter UTC (getUTCFullYear, getUTCDay…). */
function toVietnamWallClock(date: Date): Date {
  return new Date(date.getTime() + VN_UTC_OFFSET_MS);
}

/** Thứ Hai 00:00 giờ VN của tuần chứa `date` (trả về mốc UTC thật). */
export function getVietnamWeekStart(date: Date = new Date()): Date {
  const vn = toVietnamWallClock(date);
  const dayNum = vn.getUTCDay() || 7; // Thứ Hai = 1 … Chủ Nhật = 7
  const startAsVnWallClock = Date.UTC(vn.getUTCFullYear(), vn.getUTCMonth(), vn.getUTCDate() - (dayNum - 1));
  return new Date(startAsVnWallClock - VN_UTC_OFFSET_MS);
}

/** Ngày 1 lúc 00:00 giờ VN của tháng chứa `date` (trả về mốc UTC thật). */
export function getVietnamMonthStart(date: Date = new Date()): Date {
  const vn = toVietnamWallClock(date);
  return new Date(Date.UTC(vn.getUTCFullYear(), vn.getUTCMonth(), 1) - VN_UTC_OFFSET_MS);
}

/**
 * Generate week code ISO format: "YYYY-Www" — tính theo giờ Việt Nam (tuần bắt đầu Thứ Hai 00:00 VN),
 * độc lập với múi giờ của server.
 */
export function getWeekCode(date: Date = new Date(), offsetWeeks: number = 0): string {
  const vn = toVietnamWallClock(date);
  const d = new Date(Date.UTC(vn.getUTCFullYear(), vn.getUTCMonth(), vn.getUTCDate()));
  d.setUTCDate(d.getUTCDate() + offsetWeeks * 7);
  const dayNum = d.getUTCDay() || 7;
  d.setUTCDate(d.getUTCDate() + 4 - dayNum);
  const yearStart = new Date(Date.UTC(d.getUTCFullYear(), 0, 1));
  const weekNo = Math.ceil(((d.getTime() - yearStart.getTime()) / 86400000 + 1) / 7);
  return `${d.getUTCFullYear()}-W${String(weekNo).padStart(2, "0")}`;
}

export interface DBLeaderboardSnapshot {
  userId: string;
  periodCode: string;
  score: number;
  rankingScore: number;
  completedTests: number;
  rank: number | null;
}

/**
 * Calculate historical progression over 4 active periods (P1, P2, P3, P4)
 */
export function calculateStudentHistory(
  userId: string,
  currentLiveMetrics: {
    avgScore: number;
    rankingScore: number;
    completedTests: number;
    rank: number | null;
  },
  dbSnapshots: DBLeaderboardSnapshot[] = [],
  now: Date = new Date()
): StudentHistoryOutput {
  const snapshotMap = new Map<string, DBLeaderboardSnapshot>();
  dbSnapshots.forEach((snap) => {
    if (snap.userId === userId) {
      snapshotMap.set(snap.periodCode, snap);
    }
  });

  const periodOffsets = [-3, -2, -1, 0];
  const labels = ["Chu kỳ 1", "Chu kỳ 2", "Chu kỳ 3", "Chu kỳ 4 (Mới nhất)"];

  const periods: PeriodSnapshotItem[] = periodOffsets.map((offset, idx) => {
    const periodCode = getWeekCode(now, offset);
    const label = labels[idx];

    // Current period (offset === 0) uses live metrics
    if (offset === 0) {
      return {
        periodCode,
        label,
        averageScore: currentLiveMetrics.avgScore,
        rankingScore: currentLiveMetrics.rankingScore,
        completedTests: currentLiveMetrics.completedTests,
        rank: currentLiveMetrics.rank,
        isValid: currentLiveMetrics.completedTests > 0,
      };
    }

    const snap = snapshotMap.get(periodCode);
    if (snap) {
      return {
        periodCode,
        label,
        averageScore: snap.score,
        rankingScore: snap.rankingScore,
        completedTests: snap.completedTests,
        rank: snap.rank,
        isValid: true,
      };
    }

    return {
      periodCode,
      label,
      averageScore: 0,
      rankingScore: 0,
      completedTests: 0,
      rank: null,
      isValid: false,
      statusMessage: "INSUFFICIENT_DATA",
    };
  });

  // Calculate delta against earliest valid historical period
  const validHistoricalPeriods = periods.slice(0, 3).filter((p) => p.isValid);
  const currentPeriod = periods[3];

  let deltaScore: number | null = null;
  let initialScore: number | null = null;
  let feedbackMessage = "Đang tích lũy dữ liệu lịch sử để đánh giá sự cải thiện ✨";
  let feedbackType: "EXCELLENT" | "STABLE" | "NEEDS_IMPROVEMENT" | "INSUFFICIENT_DATA" = "INSUFFICIENT_DATA";

  if (validHistoricalPeriods.length > 0 && currentPeriod.isValid) {
    const earliestPeriod = validHistoricalPeriods[0];
    initialScore = earliestPeriod.averageScore;
    deltaScore = parseFloat((currentPeriod.averageScore - initialScore).toFixed(1));

    if (deltaScore >= 0.5) {
      feedbackMessage = `Tốt hơn ${validHistoricalPeriods.length} chu kỳ trước 🚀 (+${deltaScore} điểm)`;
      feedbackType = "EXCELLENT";
    } else if (deltaScore >= 0) {
      feedbackMessage = "Đang duy trì phong độ học tập ổn định ✨";
      feedbackType = "STABLE";
    } else {
      feedbackMessage = "Điểm số có dấu hiệu giảm nhẹ, hãy nỗ lực ở bài tiếp theo 💪";
      feedbackType = "NEEDS_IMPROVEMENT";
    }
  }

  return {
    periods,
    hasSufficientData: validHistoricalPeriods.length > 0,
    deltaScore,
    initialScore,
    currentScore: currentLiveMetrics.avgScore,
    feedbackMessage,
    feedbackType,
  };
}
