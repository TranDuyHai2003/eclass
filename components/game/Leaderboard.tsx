import Link from "next/link";
import { Crown } from "lucide-react";
import { cn } from "@/lib/utils";
import type { LeaderboardRow, Period } from "@/lib/game/leaderboard";
import { Chibi } from "@/components/avatar/Chibi";
import { ITEM_BY_ID } from "@/lib/game/items";

const fmt = (n: number) => n.toLocaleString("vi-VN");

const PODIUM: Record<number, { ring: string; bg: string; label: string; h: string }> = {
  1: { ring: "ring-amber-300", bg: "from-amber-100 to-yellow-50", label: "🥇", h: "sm:-translate-y-4" },
  2: { ring: "ring-slate-300", bg: "from-slate-100 to-white", label: "🥈", h: "" },
  3: { ring: "ring-orange-300", bg: "from-orange-100 to-amber-50", label: "🥉", h: "" },
};

/** Bảng Vàng: tab khối/lớp, kỳ, bục top 3 với nhân vật, danh sách 4–30, dòng "Bạn" */
export function LeaderboardView({
  rows, grades, tab, period, myClassName, hasClass, currentUserId, mine,
}: {
  rows: LeaderboardRow[];
  grades: number[];
  tab: string;
  period: Period;
  myClassName: string | null;
  hasClass: boolean;
  currentUserId: string;
  mine: { rank: number; total: number; xu: number } | null;
}) {
  const href = (t: string, p: Period) => `/leaderboard?tab=${t}&period=${p}`;
  const tabs = [...grades.map((g) => ({ key: `g${g}`, label: `Khối ${g}`, icon: "🏫" })), ...(hasClass ? [{ key: "class", label: myClassName ? `Lớp ${myClassName}` : "Lớp tôi", icon: "👥" }] : [])];
  const top = rows.slice(0, 3);
  const rest = rows.slice(3);
  const inTop = rows.some((r) => r.userId === currentUserId);
  const card = "rounded-3xl border-2 border-blue-100/80 bg-white shadow-[0_4px_0_0_#e3ecff]";

  return (
    <div className="space-y-4" data-testid="leaderboard">
      <div className="flex flex-wrap items-end justify-between gap-3">
        <div>
          <h1 className="flex items-center gap-2 text-2xl font-black text-slate-900 sm:text-3xl">
            <span className="flex h-10 w-10 items-center justify-center rounded-2xl bg-amber-400 text-amber-950 shadow-[0_3px_0_0_#d97706]"><Crown className="h-5 w-5" /></span>
            Bảng Vàng
          </h1>
          <p className="text-sm font-medium text-slate-500">Xu kiếm được từ học tập — mỗi khối là một &quot;server&quot; riêng. Đổi quà, mở rương không làm tụt hạng.</p>
        </div>
        <div className="flex gap-1 rounded-2xl border-2 border-slate-200/80 bg-slate-100/80 p-1" role="tablist" aria-label="Kỳ">
          {(["all", "month"] as Period[]).map((p) => (
            <Link key={p} href={href(tab, p)} role="tab" aria-selected={period === p} className={cn("rounded-xl px-3 py-1.5 text-sm font-black", period === p ? "bg-white text-blue-700 shadow-[0_3px_0_0_#cbd5e1]" : "text-slate-500 hover:bg-white/60")}>
              {p === "all" ? "Tích luỹ" : "Tháng này"}
            </Link>
          ))}
        </div>
      </div>

      {tabs.length > 0 && (
        <div className="flex gap-1.5 overflow-x-auto whitespace-nowrap pb-1" role="tablist" aria-label="Khối">
          {tabs.map((t) => (
            <Link key={t.key} href={href(t.key, period)} role="tab" aria-selected={tab === t.key} data-testid={`lb-tab-${t.key}`} className={cn("btn-3d shrink-0 px-4 py-2 text-sm", tab === t.key ? "btn-3d-blue" : "btn-3d-white")}>
              <span aria-hidden>{t.icon}</span> {t.label}
            </Link>
          ))}
        </div>
      )}

      {rows.length === 0 ? (
        <div className={cn(card, "p-10 text-center")}>
          <p className="animate-float text-5xl">🏆</p>
          <p className="mt-3 font-black text-slate-700">Chưa có ai trên bảng</p>
          <p className="text-sm text-slate-500">{tabs.length === 0 ? "Admin chưa đặt khối cho lớp (Quản lý lớp học → Khối)." : "Nộp bài đầu tiên để ghi tên lên Bảng Vàng!"}</p>
        </div>
      ) : (
        <>
          {/* Bục top 3 */}
          <section className={cn(card, "dots-bg overflow-hidden bg-gradient-to-b from-sky-50 to-white p-4 sm:p-6")} style={{ "--dot": "rgba(37,99,235,.08)" } as React.CSSProperties} data-testid="podium">
            <div className="grid grid-cols-3 items-end gap-2 sm:gap-4">
              {[top[1], top[0], top[2]].map((r, i) => {
                if (!r) return <div key={i} />;
                const p = PODIUM[r.rank];
                const bg = r.avatar.background ? ITEM_BY_ID[r.avatar.background] : null;
                return (
                  <Link key={r.userId} href={`/profile/${r.userId}`} className={cn("group flex flex-col items-center rounded-3xl bg-gradient-to-b p-2 text-center ring-2 transition-transform hover:-translate-y-1 sm:p-4", p.bg, p.ring, p.h, r.userId === currentUserId && "outline outline-2 outline-blue-500")}>
                    <span className="text-2xl sm:text-3xl">{p.label}</span>
                    <div className="mt-1 rounded-2xl p-1" style={bg ? { background: `linear-gradient(135deg, ${bg.v}, ${bg.v2})` } : undefined}>
                      <Chibi config={r.avatar} size={r.rank === 1 ? 96 : 80} className={cn("h-auto max-w-full", r.rank === 1 && "animate-float")} />
                    </div>
                    <p className="mt-1 line-clamp-2 w-full text-sm font-black text-slate-900 [overflow-wrap:anywhere]">{r.name || "Học sinh"}</p>
                    {r.equippedTitle && <p className="text-[10px] font-black text-violet-700">🏷️ {r.equippedTitle}</p>}
                    <p className="text-[11px] font-bold text-slate-500">{r.level.icon} {r.level.name}{r.className ? ` · ${r.className}` : ""}</p>
                    <p className="mt-1 rounded-full bg-amber-100 px-2 py-0.5 text-xs font-black text-amber-800 tabular-nums">🪙 {fmt(r.xu)}</p>
                  </Link>
                );
              })}
            </div>
          </section>

          {rest.length > 0 && (
            <section className={cn(card, "divide-y divide-slate-100")}>
              {rest.map((r) => (
                <Link key={r.userId} href={`/profile/${r.userId}`} data-testid="lb-row" className={cn("flex items-center gap-3 px-3 py-2 hover:bg-blue-50/60 sm:px-4", r.userId === currentUserId && "bg-blue-50")}>
                  <span className="w-7 shrink-0 text-center text-sm font-black text-slate-400 tabular-nums">#{r.rank}</span>
                  <Chibi config={r.avatar} size={40} className="shrink-0" />
                  <span className="min-w-0 flex-1">
                    <span className="block truncate text-sm font-bold text-slate-900">{r.name || "Học sinh"}</span>
                    <span className="block truncate text-[11px] font-semibold text-slate-500">{r.level.icon} {r.level.name}{r.className ? ` · ${r.className}` : ""}{r.equippedTitle ? ` · 🏷️ ${r.equippedTitle}` : ""}</span>
                  </span>
                  <span className="shrink-0 text-sm font-black text-amber-700 tabular-nums">🪙 {fmt(r.xu)}</span>
                </Link>
              ))}
            </section>
          )}

          {mine && !inTop && (
            <div data-testid="lb-mine" className="flex items-center gap-3 rounded-3xl border-2 border-blue-300 bg-blue-50 px-4 py-3">
              <span className="text-sm font-black text-blue-800">Bạn đang hạng #{mine.rank}/{mine.total}</span>
              <span className="ml-auto text-sm font-black text-amber-700 tabular-nums">🪙 {fmt(mine.xu)}</span>
            </div>
          )}
          {mine && inTop && <p className="text-center text-xs font-bold text-blue-700">Bạn đang hạng #{mine.rank}/{mine.total} — tên bạn được tô xanh ở trên 🎉</p>}
        </>
      )}
    </div>
  );
}
