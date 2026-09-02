import { SessionProgressItem } from "./session-progress-engine";

export interface WeeklyProgressSummary {
  startPercentile: number | null;
  currentPercentile: number | null;
  peakPercentile: number | null;
  weeklyGrowthPercent: number | null; // Percentage points net growth (currentPercentile - startPercentile)

  sessionsCompleted: number;
  totalSessions: number;

  status: "NO_DATA" | "IN_PROGRESS" | "COMPLETED";
}

/**
 * Calculate Weekly Progress Summary from completed sessions in the week
 */
export function calculateWeeklyProgressEngine(
  sessions: SessionProgressItem[] = [],
  totalSessions: number = 4
): WeeklyProgressSummary {
  const completedSessions = sessions.filter(
    (s) => s.status === "COMPLETED" && s.score !== null && s.score !== undefined
  );

  if (completedSessions.length === 0) {
    return {
      startPercentile: null,
      currentPercentile: null,
      peakPercentile: null,
      weeklyGrowthPercent: null,
      sessionsCompleted: 0,
      totalSessions,
      status: "NO_DATA",
    };
  }

  const startSession = completedSessions[0];
  const currentSession = completedSessions[completedSessions.length - 1];

  const startPercentile = startSession.higherThanPercent;
  const currentPercentile = currentSession.higherThanPercent;

  const validHigherThanList = completedSessions
    .map((s) => s.higherThanPercent)
    .filter((p): p is number => p !== null && p !== undefined);

  const peakPercentile = validHigherThanList.length > 0 ? Math.max(...validHigherThanList) : null;

  let weeklyGrowthPercent: number | null = null;
  if (completedSessions.length >= 2) {
    const startScore = startSession.score ?? 0;
    const currentScore = currentSession.score ?? 0;
    const startPerc = startPercentile ?? 0;
    const currentPerc = currentPercentile ?? 0;

    const percDiff = currentPerc - startPerc;
    if (percDiff !== 0) {
      weeklyGrowthPercent = percDiff;
    } else {
      // Fallback: If percentile difference is 0 (e.g. both 0% at bottom), calculate score growth %
      if (startScore > 0) {
        weeklyGrowthPercent = Math.round(((currentScore - startScore) / startScore) * 100);
      } else if (currentScore > 0) {
        weeklyGrowthPercent = Math.round(currentScore * 100);
      } else {
        weeklyGrowthPercent = 0;
      }
    }
  }

  const status: "NO_DATA" | "IN_PROGRESS" | "COMPLETED" =
    completedSessions.length >= totalSessions ? "COMPLETED" : "IN_PROGRESS";

  return {
    startPercentile,
    currentPercentile,
    peakPercentile,
    weeklyGrowthPercent,
    sessionsCompleted: completedSessions.length,
    totalSessions,
    status,
  };
}
