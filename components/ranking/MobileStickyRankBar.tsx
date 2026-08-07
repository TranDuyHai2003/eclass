"use client";

import { RankingUser } from "@/actions/ranking";

interface MobileStickyRankBarProps {
  currentUser: RankingUser | null;
  studyClassName?: string | null;
}

export function MobileStickyRankBar({ currentUser, studyClassName = "10A1" }: MobileStickyRankBarProps) {
  if (!currentUser || !currentUser.rank) return null;

  const scrollToMyRow = () => {
    const row = document.getElementById(`rank-row-${currentUser.id}`);
    if (row) {
      row.scrollIntoView({ behavior: "smooth", block: "center" });
    }
  };

  const rankChange = currentUser.rankChange;

  return (
    <div className="fixed bottom-4 left-4 right-4 md:hidden z-40">
      <div className="bg-slate-900/95 backdrop-blur-md text-white rounded-2xl p-3.5 shadow-2xl flex items-center justify-between border border-blue-400/30">
        <div className="flex items-center gap-3">
          <div className="w-9 h-9 rounded-xl bg-gradient-to-tr from-blue-500 to-indigo-600 font-extrabold text-white flex items-center justify-center text-xs shadow shrink-0">
            #{currentUser.rank}
          </div>
          <div className="text-xs space-y-0.5 min-w-0">
            <div className="font-extrabold text-white truncate">
              ⭐ {currentUser.name || "Bạn"} • Lớp {studyClassName || "10A1"}
            </div>
            <span className="text-amber-300 font-bold block text-[11px]">
              {currentUser.avgScore.toFixed(2)} ĐTB •{" "}
              {rankChange && rankChange > 0 ? `↑ +${rankChange} bậc` : "Phong độ tốt"}
            </span>
          </div>
        </div>

        <button
          onClick={scrollToMyRow}
          className="px-3.5 py-2 bg-gradient-to-r from-blue-500 to-indigo-600 text-white font-extrabold text-[11px] rounded-xl shadow uppercase tracking-wider shrink-0 hover:from-blue-600 hover:to-indigo-700 transition"
        >
          Vị trí của tôi
        </button>
      </div>
    </div>
  );
}
