import Link from "next/link";
import { ChevronRight } from "lucide-react";

export interface PointsHomeCardData {
  balance: number;
  weekStreak: number;
  goal: { title: string; emoji: string | null; price: number } | null;
}

/** Dải nhỏ trên trang chủ của học sinh: điểm thưởng, chuỗi tuần, quà mục tiêu */
export function PointsHomeCard({ data }: { data: PointsHomeCardData }) {
  const { balance, weekStreak, goal } = data;
  const pct = goal ? Math.min(100, Math.round((balance / goal.price) * 100)) : 0;
  return (
    <Link
      href="/rewards"
      className="group flex flex-wrap items-center gap-x-4 gap-y-2 rounded-3xl border border-amber-200/70 bg-gradient-to-r from-amber-50 via-white to-white px-4 py-3 shadow-sm hover:border-amber-300 transition-colors"
    >
      <span className="flex items-center gap-1.5">
        <span aria-hidden className="text-xl">⭐</span>
        <span className="text-lg font-black text-amber-600 tabular-nums">{balance}</span>
        <span className="text-xs font-bold text-slate-500">điểm thưởng</span>
      </span>
      {weekStreak > 0 && (
        <span className="text-sm font-bold text-slate-700">
          🔥 {weekStreak} tuần liên tiếp
        </span>
      )}
      {goal ? (
        <span className="flex min-w-[180px] flex-1 items-center gap-2">
          <span aria-hidden>{goal.emoji || "🎁"}</span>
          <span className="h-2 flex-1 overflow-hidden rounded-full bg-slate-100">
            <span className="block h-full rounded-full bg-amber-500" style={{ width: `${pct}%` }} />
          </span>
          <span className="shrink-0 text-xs font-bold text-slate-500">
            {balance >= goal.price ? "Đủ điểm đổi quà!" : `còn ${goal.price - balance}`}
          </span>
        </span>
      ) : (
        <span className="flex-1 text-xs font-semibold text-slate-500">Học chăm tích điểm, đổi quà với thầy</span>
      )}
      <span className="ml-auto inline-flex items-center gap-0.5 text-xs font-black text-blue-600 group-hover:translate-x-0.5 transition-transform">
        Đổi quà <ChevronRight className="h-4 w-4" />
      </span>
    </Link>
  );
}
