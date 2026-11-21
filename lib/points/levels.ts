/**
 * Danh hiệu (cấp) học sinh — tính theo TỔNG xu đã kiếm từ học tập (lifetimeEarned), không giảm khi tiêu xu.
 * Tên hài theo ý thầy (21/11/2026) — đổi tên tại đây là đủ, logic không phụ thuộc tên.
 * Thang: học chăm ~12 000 xu/tháng → "Phú nông" sau ~1,5 tháng, "Đại gia" sau một học kỳ.
 */
export interface LevelDef {
  name: string;
  icon: string;
  min: number;
  /** Lớp màu Tailwind cho huy hiệu cấp */
  badge: string;
  /** Màu thanh kinh nghiệm */
  bar: string;
}

export const LEVELS: LevelDef[] = [
  { name: "Chó rách", icon: "🐕", min: 0, badge: "bg-slate-100 text-slate-700 ring-slate-200", bar: "from-slate-400 to-slate-500" },
  { name: "Nghèo rớt mồng tơi", icon: "🥬", min: 1500, badge: "bg-emerald-50 text-emerald-700 ring-emerald-200", bar: "from-emerald-400 to-teal-500" },
  { name: "Người nghèo", icon: "🪙", min: 4500, badge: "bg-sky-50 text-sky-700 ring-sky-200", bar: "from-sky-400 to-blue-500" },
  { name: "Tiểu thương", icon: "🧺", min: 9000, badge: "bg-orange-50 text-orange-700 ring-orange-200", bar: "from-orange-400 to-rose-500" },
  { name: "Phú nông", icon: "🌾", min: 18000, badge: "bg-amber-50 text-amber-700 ring-amber-200", bar: "from-amber-400 to-orange-500" },
  { name: "Phú ông · Phú bà", icon: "🎩", min: 37500, badge: "bg-violet-50 text-violet-700 ring-violet-200", bar: "from-violet-500 to-fuchsia-500" },
  { name: "Đại gia", icon: "💎", min: 75000, badge: "bg-cyan-50 text-cyan-700 ring-cyan-200", bar: "from-cyan-400 to-blue-600" },
  { name: "Tỷ phú", icon: "👑", min: 150000, badge: "bg-gradient-to-r from-amber-100 to-rose-100 text-rose-700 ring-rose-200", bar: "from-amber-400 via-rose-500 to-fuchsia-500" },
];

export interface LevelInfo extends LevelDef {
  /** Cấp 1, 2, 3… */
  level: number;
  next: LevelDef | null;
  /** Xu còn thiếu để lên cấp (0 nếu đã cấp cao nhất) */
  toNext: number;
  /** Tiến độ trong cấp hiện tại, 0–100 */
  progress: number;
}

export function getLevel(lifetimeEarned: number): LevelInfo {
  const pts = Math.max(0, Math.floor(Number.isFinite(lifetimeEarned) ? lifetimeEarned : 0));
  let i = 0;
  while (i + 1 < LEVELS.length && pts >= LEVELS[i + 1].min) i++;
  const cur = LEVELS[i];
  const next = LEVELS[i + 1] ?? null;
  const progress = next ? Math.round(((pts - cur.min) / (next.min - cur.min)) * 100) : 100;
  return { ...cur, level: i + 1, next, toNext: next ? next.min - pts : 0, progress };
}
