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
 * Generate week code ISO format: "YYYY-Www"
 */
export function getWeekCode(date: Date = new Date(), offsetWeeks: number = 0): string {
  const d = new Date(Date.UTC(date.getFullYear(), date.getMonth(), date.getDate()));
  d.setUTCDate(d.getUTCDate() + offsetWeeks * 7);
  const dayNum = d.getUTCDay() || 7;
  d.setUTCDate(d.getUTCDate() + 4 - dayNum);
  const yearStart = new Date(Date.UTC(d.getFullYear(), 0, 1));
  const weekNo = Math.ceil(((d.getTime() - yearStart.getTime()) / 86400000 + 1) / 7);
  return `${d.getFullYear()}-W${String(weekNo).padStart(2, "0")}`;
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
