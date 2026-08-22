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
    (s) => s.status === "COMPLETED" && s.higherThanPercent !== null && s.higherThanPercent !== undefined
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

  const startPercentile = completedSessions[0].higherThanPercent;
  const currentPercentile = completedSessions[completedSessions.length - 1].higherThanPercent;

  const validHigherThanList = completedSessions
    .map((s) => s.higherThanPercent)
    .filter((p): p is number => p !== null && p !== undefined);

  const peakPercentile = validHigherThanList.length > 0 ? Math.max(...validHigherThanList) : null;

  let weeklyGrowthPercent: number | null = null;
  if (completedSessions.length >= 2 && startPercentile !== null && currentPercentile !== null) {
    weeklyGrowthPercent = currentPercentile - startPercentile;
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
