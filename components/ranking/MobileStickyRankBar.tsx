"use client";

import { RankingUser } from "@/actions/ranking";
import { calculateGameRank } from "@/lib/game-rank";
import { Award, Lock } from "lucide-react";

interface MobileStickyRankBarProps {
  currentUser: RankingUser | null;
  studyClassName?: string | null;
  totalStudents?: number;
}

export function MobileStickyRankBar({
  currentUser,
  studyClassName,
  totalStudents = 30,
}: MobileStickyRankBarProps) {
  if (!currentUser) return null;

  const gameRank = calculateGameRank(
    currentUser.avgScore,
    currentUser.rank,
    totalStudents,
    currentUser.completedTests,
    5
  );

  const scrollToMyRow = () => {
    const row = document.getElementById(`rank-row-${currentUser.id}`);
    if (row) {
      row.scrollIntoView({ behavior: "smooth", block: "center" });
    }
  };

  return (
    <div className="fixed bottom-4 left-4 right-4 md:hidden z-40">
      <div className="bg-slate-950/95 backdrop-blur-md text-white rounded-2xl p-3.5 shadow-2xl flex items-center justify-between border border-blue-500/40 shadow-blue-500/10">
        <div className="flex items-center gap-3 min-w-0">
          <div className="w-10 h-10 rounded-xl bg-gradient-to-tr from-blue-600 to-indigo-600 font-black text-white flex items-center justify-center text-xs shadow-md shrink-0 border border-white/20">
            #{currentUser.rank || "-"}
          </div>
          <div className="text-xs space-y-0.5 min-w-0">
            <div className="font-extrabold text-white truncate flex items-center gap-1.5">
              <span>{currentUser.name || "Bạn"}</span>
              {gameRank.rank ? (
                <span className={`text-[10px] font-black px-2 py-0.2 rounded-full ${gameRank.badgeBg}`}>
                  Rank {gameRank.rank}
                </span>
              ) : (
                <span className="text-[10px] font-bold px-1.5 py-0.2 rounded-full bg-slate-800 text-slate-400 border border-slate-700 flex items-center gap-0.5">
                  <Lock className="w-2.5 h-2.5 text-amber-400" />
                  <span>Khóa</span>
                </span>
              )}
            </div>
            <span className="text-amber-300 font-bold block text-[11px] font-mono">
              {gameRank.currentScore}đ • Cao hơn {gameRank.percentile}% trong lớp
            </span>
          </div>
        </div>

        <button
          onClick={scrollToMyRow}
          className="px-3 py-2 bg-gradient-to-r from-blue-600 to-indigo-600 text-white font-extrabold text-[11px] rounded-xl shadow-md uppercase tracking-wider shrink-0 hover:from-blue-500 hover:to-indigo-500 transition active:scale-95"
        >
          Tôi ở đâu
        </button>
      </div>
    </div>
  );
}
