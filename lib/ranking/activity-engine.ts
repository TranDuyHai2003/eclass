export const BUSINESS_TIMEZONE = "Asia/Ho_Chi_Minh";

export interface AttemptTimestamp {
  completedAt?: Date | string | null;
  startedAt?: Date | string | null;
}

export interface ActivityHeatmapDay {
  date: string; // YYYY-MM-DD in Asia/Ho_Chi_Minh
  active: boolean;
  dayName: string; // T2, T3, T4, T5, T6, T7, CN
}

export interface ActivityMetrics {
  currentStreak: number;
  maxStreak: number;
  completedDaysThisMonth: number;
  totalDaysInMonth: number;
  weeklyHeatmap: ActivityHeatmapDay[];
  distinctActiveDaysCount: number;
}

/**
 * Format a Date or date string to YYYY-MM-DD in Asia/Ho_Chi_Minh timezone
 */
export function getCalendarDateString(dateInput: Date | string, timezone: string = BUSINESS_TIMEZONE): string {
  const date = typeof dateInput === "string" ? new Date(dateInput) : dateInput;
  if (isNaN(date.getTime())) return "";

  const formatter = new Intl.DateTimeFormat("en-CA", {
    timeZone: timezone,
    year: "numeric",
    month: "2-digit",
    day: "2-digit",
  });
  return formatter.format(date); // Format: "YYYY-MM-DD"
}

/**
 * Get current date string YYYY-MM-DD in Asia/Ho_Chi_Minh
 */
export function getTodayDateString(timezone: string = BUSINESS_TIMEZONE): string {
  return getCalendarDateString(new Date(), timezone);
}

/**
 * Get date string offset by N days relative to a base YYYY-MM-DD string
 */
function getOffsetDateString(baseDateStr: string, offsetDays: number): string {
  const [year, month, day] = baseDateStr.split("-").map(Number);
  const d = new Date(Date.UTC(year, month - 1, day));
  d.setUTCDate(d.getUTCDate() + offsetDays);
  return d.toISOString().slice(0, 10);
}

/**
 * Get total number of days in a given year and month (1-indexed month)
 */
export function getDaysInMonth(year: number, month: number): number {
  return new Date(year, month, 0).getDate();
}

/**
 * Calculate Activity Engine metrics from student attempt history
 */
export function calculateActivityEngine(
  attempts: AttemptTimestamp[],
  now: Date = new Date(),
  timezone: string = BUSINESS_TIMEZONE
): ActivityMetrics {
  const activeDateSet = new Set<string>();

  attempts.forEach((att) => {
    const rawDate = att.completedAt || att.startedAt;
    if (rawDate) {
      const dateStr = getCalendarDateString(rawDate, timezone);
      if (dateStr) {
        activeDateSet.add(dateStr);
      }
    }
  });

  const todayStr = getCalendarDateString(now, timezone);
  const yesterdayStr = getOffsetDateString(todayStr, -1);

  // 1. Current Streak Calculation
  // Streak starts from today if active today, or yesterday if active yesterday.
  let currentStreak = 0;
  let checkDateStr = "";

  if (activeDateSet.has(todayStr)) {
    checkDateStr = todayStr;
  } else if (activeDateSet.has(yesterdayStr)) {
    checkDateStr = yesterdayStr;
  }

  if (checkDateStr) {
    while (activeDateSet.has(checkDateStr)) {
      currentStreak++;
      checkDateStr = getOffsetDateString(checkDateStr, -1);
    }
  }

  // 2. Max Streak Calculation
  const sortedDates = Array.from(activeDateSet).sort();
  let maxStreak = 0;
  let tempStreak = 0;
  let prevDateStr = "";

  sortedDates.forEach((dStr) => {
    if (!prevDateStr) {
      tempStreak = 1;
    } else {
      const expectedNext = getOffsetDateString(prevDateStr, 1);
      if (dStr === expectedNext) {
        tempStreak++;
      } else {
        tempStreak = 1;
      }
    }
    if (tempStreak > maxStreak) {
      maxStreak = tempStreak;
    }
    prevDateStr = dStr;
  });

  // 3. Monthly Activity Calculation (Current Month in VN Timezone)
  const currentYear = parseInt(todayStr.slice(0, 4), 10);
  const currentMonth = parseInt(todayStr.slice(5, 7), 10);
  const currentMonthPrefix = `${currentYear}-${String(currentMonth).padStart(2, "0")}`;

  let completedDaysThisMonth = 0;
  activeDateSet.forEach((dStr) => {
    if (dStr.startsWith(currentMonthPrefix)) {
      completedDaysThisMonth++;
    }
  });

  const totalDaysInMonth = getDaysInMonth(currentYear, currentMonth);

  // 4. Weekly Heatmap (Monday -> Sunday of current week in VN Timezone)
  const [y, m, d] = todayStr.split("-").map(Number);
  const todayUtc = new Date(Date.UTC(y, m - 1, d));
  const dayOfWeek = todayUtc.getUTCDay() || 7; // 1 = Mon, 7 = Sun
  const mondayUtc = new Date(todayUtc);
  mondayUtc.setUTCDate(todayUtc.getUTCDate() - (dayOfWeek - 1));

  const dayNames = ["T2", "T3", "T4", "T5", "T6", "T7", "CN"];
  const weeklyHeatmap: ActivityHeatmapDay[] = [];

  for (let i = 0; i < 7; i++) {
    const curDateUtc = new Date(mondayUtc);
    curDateUtc.setUTCDate(mondayUtc.getUTCDate() + i);
    const dateStr = curDateUtc.toISOString().slice(0, 10);

    weeklyHeatmap.push({
      date: dateStr,
      active: activeDateSet.has(dateStr),
      dayName: dayNames[i],
    });
  }

  return {
    currentStreak,
    maxStreak,
    completedDaysThisMonth,
    totalDaysInMonth,
    weeklyHeatmap,
    distinctActiveDaysCount: activeDateSet.size,
  };
}
