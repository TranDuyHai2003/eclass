import { cn } from "@/lib/utils";

export type PerformanceFilter = "all" | "excellent" | "passed" | "failed" | "completed-all" | "missing-tests";

export interface StudentFilterParams {
  searchQuery: string;
  performanceFilter: PerformanceFilter;
}

/**
 * Common filtering logic for student analytics data
 */
export function filterStudents<T extends { studentName?: string; name?: string; averageScore?: number; stats?: { averageScore: number; completedCount: number; totalAssigned: number }; missedCount?: number; completedCount?: number }>(
  data: T[],
  params: StudentFilterParams
): T[] {
  const { searchQuery, performanceFilter } = params;
  const query = searchQuery.trim().toLowerCase();

  return data.filter((student) => {
    const name = (student.studentName || student.name || "").toLowerCase();
    const matchesSearch = name.includes(query);
    
    if (!matchesSearch) return false;
    if (performanceFilter === "all") return true;

    const score = student.averageScore ?? student.stats?.averageScore ?? 0;
    const missed = student.missedCount ?? (student.stats ? (student.stats.totalAssigned - student.stats.completedCount) : 0);
    const completed = student.completedCount ?? student.stats?.completedCount ?? 0;
    const total = student.stats?.totalAssigned ?? 0;

    if (performanceFilter === "excellent") return score >= 8;
    if (performanceFilter === "passed") return score >= 5;
    if (performanceFilter === "failed") return score < 5 && completed > 0;
    if (performanceFilter === "completed-all") return missed === 0 && (total > 0 || completed > 0);
    if (performanceFilter === "missing-tests") return missed > 0;

    return true;
  });
}

/**
 * Standard rounding for scores
 */
export function roundScore(score: number): number {
  return Math.round(score * 100) / 100;
}

/**
 * Format date in VN locale
 */
export function formatVNTime(date: string | Date) {
  return new Date(date).toLocaleString('vi-VN', {
    hour: '2-digit',
    minute: '2-digit',
    day: '2-digit',
    month: '2-digit',
    year: 'numeric'
  });
}
