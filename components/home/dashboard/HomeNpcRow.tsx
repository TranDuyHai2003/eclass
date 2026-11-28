import Link from "next/link";
import { ChevronRight, Crown } from "lucide-react";
import { cn } from "@/lib/utils";
import type { LeaderboardRow } from "@/lib/game/leaderboard";
import { Npc } from "@/components/game/Npc";
import { Chibi } from "@/components/avatar/Chibi";

const MEDAL = ["🥇", "🥈", "🥉"];

/** Hàng NPC Lucky Boy + Bảng Vàng khối mình (top 3) trên trang chủ học sinh */
export function HomeNpcRow({ lines, top3, grade, currentUserId }: { lines: string[]; top3: LeaderboardRow[]; grade: number | null; currentUserId?: string }) {
  const card = "min-w-0 rounded-3xl border-2 border-blue-100/80 bg-white p-4 shadow-[0_4px_0_0_#e3ecff] sm:p-5";
  return (
    <section data-testid="home-npc-row" className={cn("grid grid-cols-1 gap-4", grade && "lg:grid-cols-2")}>
      <div className={cn(card, "flex items-center")}>
        <Npc lines={lines} />
      </div>
      {grade && (
        <div className={card} data-testid="home-top3">
          <div className="mb-3 flex items-center justify-between gap-2">
            <h2 className="flex min-w-0 items-center gap-2 text-base font-black text-slate-900">
              <span className="flex h-8 w-8 shrink-0 items-center justify-center rounded-xl bg-amber-400 text-amber-950"><Crown className="h-4 w-4" /></span>
              <span className="truncate">Bảng Vàng khối {grade}</span>
            </h2>
            <Link href={`/leaderboard?tab=g${grade}`} className="inline-flex shrink-0 items-center text-xs font-black text-blue-600 hover:text-blue-700">
              Xem bảng <ChevronRight className="h-3.5 w-3.5" />
            </Link>
          </div>
          {top3.length === 0 ? (
            <p className="text-sm text-slate-500">Chưa có ai trên bảng — nộp bài đầu tiên để dẫn đầu khối!</p>
          ) : (
            <ul className="grid grid-cols-3 gap-2">
              {top3.map((r, i) => (
                <li key={r.userId}>
                  <Link href={`/profile/${r.userId}`} className={cn("flex flex-col items-center rounded-2xl bg-slate-50 px-1.5 py-2 text-center transition-colors hover:bg-amber-50", r.userId === currentUserId && "ring-2 ring-blue-400")}>
                    <span className="text-lg">{MEDAL[i]}</span>
                    <Chibi config={r.avatar} size={56} />
                    <span className="mt-1 line-clamp-1 w-full text-xs font-black text-slate-800 [overflow-wrap:anywhere]">{r.name || "Học sinh"}</span>
                    <span className="text-[11px] font-bold text-amber-700 tabular-nums">💰 {r.xu.toLocaleString("vi-VN")}</span>
                  </Link>
                </li>
              ))}
            </ul>
          )}
        </div>
      )}
    </section>
  );
}
