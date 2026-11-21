/**
 * Hạn nộp hiệu lực của một đề với một học sinh:
 *   hạn riêng của lớp học sinh (TestDeadline) → hạn chung (Test.dueDate) → không có hạn.
 * Thuần logic, dùng chung cho tính xu, trang chủ, trang bài học, trang của thầy.
 */
export interface DeadlineRow {
  classId: string;
  dueDate: Date | string;
}

export interface TestWithDeadlines {
  dueDate: Date | string | null;
  deadlines?: DeadlineRow[] | null;
}

export function effectiveDueDate(test: TestWithDeadlines, classId: string | null | undefined): Date | null {
  const own = classId ? test.deadlines?.find((d) => d.classId === classId) : undefined;
  const raw = own ? own.dueDate : test.dueDate;
  if (!raw) return null;
  const d = raw instanceof Date ? raw : new Date(raw);
  return Number.isNaN(d.getTime()) ? null : d;
}

export type DueStatus = "none" | "on-time" | "late";

/** Trạng thái nộp so với hạn tại thời điểm `now` */
export function dueStatus(due: Date | null, now: Date = new Date()): DueStatus {
  if (!due) return "none";
  return now.getTime() <= due.getTime() ? "on-time" : "late";
}

/** Select Prisma để lấy đủ dữ liệu tính hạn hiệu lực */
export const DEADLINE_SELECT = { dueDate: true, deadlines: { select: { classId: true, dueDate: true } } } as const;
