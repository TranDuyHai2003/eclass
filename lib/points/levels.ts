/**
 * Danh hiệu (cấp) học sinh — tính theo TỔNG xu đã kiếm từ học tập (lifetimeEarned), không giảm khi tiêu xu.
 * Tên + mốc theo tài liệu "Biệt danh" của thầy (24/11/2026) — đổi tại đây là đủ, logic không phụ thuộc tên.
 * Thang: học chăm ~12 000 xu/tháng → Lv.4 sau 1 tháng, Lv.8 (30 000) sau ~2,5 tháng.
 */
export interface LevelDef {
  name: string;
  /** Tên ngắn cho nút / chip nhỏ */
  short: string;
  /** Lv.8 theo giới (học sinh nữ): Tiểu Thư thay Thiếu Gia */
  nameFemale?: string;
  shortFemale?: string;
  icon: string;
  min: number;
  /** Lớp màu Tailwind cho huy hiệu cấp */
  badge: string;
  /** Màu thanh kinh nghiệm */
  bar: string;
}

export const LEVELS: LevelDef[] = [
  { name: "Chó rách hết tiền", short: "Chó rách hết tiền", icon: "🐕", min: 0, badge: "bg-slate-100 text-slate-700 ring-slate-200", bar: "from-slate-400 to-slate-500" },
  { name: "Trứng bắc thảo nghèo khó", short: "Trứng bắc thảo nghèo khó", icon: "🥚", min: 2000, badge: "bg-emerald-50 text-emerald-700 ring-emerald-200", bar: "from-emerald-400 to-teal-500" },
  { name: "Trứng bắc thảo đủ ăn nhưng gầy tong teo", short: "Trứng bắc thảo gầy tong teo", icon: "🍳", min: 5000, badge: "bg-sky-50 text-sky-700 ring-sky-200", bar: "from-sky-400 to-blue-500" },
  { name: "Trứng bắc thảo béo đã đi làm lương 5 triệu/tháng", short: "Trứng bắc thảo lương 5 triệu", icon: "💼", min: 9000, badge: "bg-orange-50 text-orange-700 ring-orange-200", bar: "from-orange-400 to-rose-500" },
  { name: "Soi gương lại thấy mình cũng hơi đẳng cấp 1 chút", short: "Hơi đẳng cấp 1 chút", icon: "🪞", min: 13000, badge: "bg-amber-50 text-amber-700 ring-amber-200", bar: "from-amber-400 to-orange-500" },
  { name: "Người đẳng cấp", short: "Người đẳng cấp", icon: "😎", min: 20000, badge: "bg-violet-50 text-violet-700 ring-violet-200", bar: "from-violet-500 to-fuchsia-500" },
  { name: "Trùng sinh tôi sở hữu hệ thống thần hào", short: "Hệ thống thần hào", icon: "🌀", min: 25000, badge: "bg-cyan-50 text-cyan-700 ring-cyan-200", bar: "from-cyan-400 to-blue-600" },
  { name: "Thiếu Gia Giả Nghèo Đi Học Bằng Xe Đạp Điện Nhưng Ví Có 999 Tỷ Xu", short: "Thiếu Gia 999 Tỷ Xu", nameFemale: "Tiểu Thư Hào Môn Giả Nghèo Đi Học Bằng Xe Đạp Điện Nhưng Ví Có 999 Tỷ Xu", shortFemale: "Tiểu Thư 999 Tỷ Xu", icon: "🚲", min: 30000, badge: "bg-gradient-to-r from-amber-100 to-rose-100 text-rose-700 ring-rose-200", bar: "from-amber-400 via-rose-500 to-fuchsia-500" },
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

/** Áp tên theo giới (chỉ Lv.8 có tên nữ riêng) */
function byGender(l: LevelDef, gender?: string | null): LevelDef {
  return gender === "female" && l.nameFemale ? { ...l, name: l.nameFemale, short: l.shortFemale ?? l.short } : l;
}

export function getLevel(lifetimeEarned: number, gender?: string | null): LevelInfo {
  const pts = Math.max(0, Math.floor(Number.isFinite(lifetimeEarned) ? lifetimeEarned : 0));
  let i = 0;
  while (i + 1 < LEVELS.length && pts >= LEVELS[i + 1].min) i++;
  const cur = byGender(LEVELS[i], gender);
  const next = LEVELS[i + 1] ? byGender(LEVELS[i + 1], gender) : null;
  const progress = next ? Math.round(((pts - cur.min) / (next.min - cur.min)) * 100) : 100;
  return { ...cur, level: i + 1, next, toNext: next ? next.min - pts : 0, progress };
}
