/**
 * Thống kê tập trung của riêng người chơi (lưu cục bộ, localStorage "world.study.v1") — logic thuần.
 * Ghi: phút tập trung theo ngày, số khối học trọn vẹn, mục tiêu phiên và kết quả tự đánh giá.
 * Nghiên cứu: đặt MỘT mục tiêu quan sát được trước phiên + tự kiểm lại cuối phiên (theo dõi tiến độ) có
 * bằng chứng tốt hơn chuỗi ngày / phần thưởng; ôn lại cách quãng (1, 3, 7 ngày) giúp nhớ lâu.
 */

export type GoalResult = "done" | "part" | "no";
export interface GoalLog {
  /** ngày (YYYY-MM-DD theo giờ máy) */
  day: string;
  text: string;
  result: GoalResult;
}
export interface StudyStats {
  v: 1;
  /** phút tập trung theo ngày */
  days: Record<string, number>;
  /** số khối học trọn vẹn */
  blocks: number;
  goals: GoalLog[];
}
export const STATS_KEY = "world.study.v1";
/** giữ tối đa bao nhiêu ngày / mục tiêu (giới hạn dung lượng localStorage) */
const MAX_DAYS = 120;
const MAX_GOALS = 60;
/** khối học tính là "trọn vẹn" nếu ngồi học ≥ 60% thời lượng */
export const BLOCK_MIN_SHARE = 0.6;

export function emptyStats(): StudyStats {
  return { v: 1, days: {}, blocks: 0, goals: [] };
}

/** Khoá ngày theo giờ địa phương */
export function dayKey(d: Date): string {
  return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, "0")}-${String(d.getDate()).padStart(2, "0")}`;
}
/** Lùi / tiến n ngày từ một khoá ngày (an toàn qua đổi giờ: tính ở giữa trưa) */
export function shiftDay(key: string, n: number): string {
  const [y, m, d] = key.split("-").map(Number);
  return dayKey(new Date(y, m - 1, d + n, 12));
}

/** Đọc an toàn từ chuỗi JSON (dữ liệu hỏng / cũ → bắt đầu lại) */
export function parseStats(raw: string | null | undefined): StudyStats {
  if (!raw) return emptyStats();
  try {
    const o = JSON.parse(raw) as Partial<StudyStats>;
    if (!o || o.v !== 1 || typeof o.days !== "object" || !o.days) return emptyStats();
    const days: Record<string, number> = {};
    for (const [k, v] of Object.entries(o.days)) if (/^\d{4}-\d{2}-\d{2}$/.test(k) && Number.isFinite(v) && v > 0) days[k] = Math.min(24 * 60, Number(v));
    const goals = Array.isArray(o.goals)
      ? o.goals.filter((g): g is GoalLog => !!g && typeof g.text === "string" && typeof g.day === "string" && (g.result === "done" || g.result === "part" || g.result === "no")).map((g) => ({ ...g, text: g.text.slice(0, 120) }))
      : [];
    return { v: 1, days, blocks: Math.max(0, Math.floor(Number(o.blocks) || 0)), goals: goals.slice(-MAX_GOALS) };
  } catch {
    return emptyStats();
  }
}

/** Cộng thời gian tập trung (ms) vào ngày `day` — giữ phần lẻ chính xác tới 1/100 phút */
export function addFocus(s: StudyStats, day: string, ms: number): StudyStats {
  if (!(ms > 0)) return s;
  const days = { ...s.days, [day]: Math.min(24 * 60, Math.round(((s.days[day] ?? 0) + ms / 60_000) * 100) / 100) };
  const keys = Object.keys(days).sort();
  while (keys.length > MAX_DAYS) delete days[keys.shift()!];
  return { ...s, days };
}
export function addBlock(s: StudyStats): StudyStats {
  return { ...s, blocks: s.blocks + 1 };
}
export function logGoal(s: StudyStats, g: GoalLog): StudyStats {
  const text = g.text.trim().slice(0, 120);
  if (!text) return s;
  return { ...s, goals: [...s.goals, { ...g, text }].slice(-MAX_GOALS) };
}
/** Khối học có tính là trọn vẹn không (ngồi học đủ lâu trong khối) */
export function blockCounts(seatedMs: number, blockMs: number): boolean {
  return blockMs > 0 && seatedMs >= blockMs * BLOCK_MIN_SHARE;
}

export function minutesOn(s: StudyStats, day: string): number {
  return Math.floor(s.days[day] ?? 0);
}
export function totalMinutes(s: StudyStats): number {
  return Math.floor(Object.values(s.days).reduce((a, b) => a + b, 0));
}
/** 7 ngày gần nhất (cũ → mới), mỗi ngày số phút */
export function lastDays(s: StudyStats, today: string, n = 7): { day: string; min: number }[] {
  const out: { day: string; min: number }[] = [];
  for (let i = n - 1; i >= 0; i--) {
    const day = shiftDay(today, -i);
    out.push({ day, min: Math.floor(s.days[day] ?? 0) });
  }
  return out;
}
/**
 * Chuỗi ngày học liên tiếp (≥ `min` phút/ngày) tính tới hôm nay; hôm nay chưa học thì tính tới hôm qua
 * (không "mất chuỗi" lúc sáng sớm).
 */
export function streak(s: StudyStats, today: string, min = 10): number {
  let d = (s.days[today] ?? 0) >= min ? today : shiftDay(today, -1);
  let n = 0;
  while ((s.days[d] ?? 0) >= min) {
    n++;
    d = shiftDay(d, -1);
  }
  return n;
}
/** Tỉ lệ mục tiêu hoàn thành (đủ = 1, một phần = 0,5) */
export function goalRate(s: StudyStats): number {
  if (!s.goals.length) return 0;
  return s.goals.reduce((a, g) => a + (g.result === "done" ? 1 : g.result === "part" ? 0.5 : 0), 0) / s.goals.length;
}
/** Ôn lại cách quãng: mục tiêu đã làm cách đây đúng 1, 3 hoặc 7 ngày → gợi ý làm lại một bài tương tự hôm nay */
export const REVIEW_GAPS = [1, 3, 7] as const;
export function dueReviews(s: StudyStats, today: string): (GoalLog & { gap: number })[] {
  const out: (GoalLog & { gap: number })[] = [];
  const seen = new Set<string>();
  for (const gap of REVIEW_GAPS) {
    const day = shiftDay(today, -gap);
    for (const g of s.goals)
      if (g.day === day && g.result !== "no" && !seen.has(g.text.toLowerCase())) {
        seen.add(g.text.toLowerCase());
        out.push({ ...g, gap });
      }
  }
  return out.slice(0, 3);
}
