"use client";

import { RankingUser } from "@/actions/ranking";
import { Sparkles } from "lucide-react";

interface PodiumTop3Props {
  top3: RankingUser[];
  studyClassName?: string | null;
}

export function PodiumTop3({ top3, studyClassName }: PodiumTop3Props) {
  if (!top3 || top3.length < 3) return null;

  const first = top3[0];
  const second = top3[1];
  const third = top3[2];

  return (
    <section className="space-y-3 pt-2">
      <div className="flex items-center justify-between px-1">
        <h3 className="text-sm font-extrabold text-slate-900 uppercase tracking-tight flex items-center gap-1.5">
          <span>🌟</span> Top Nổi Bật Tháng 8
        </h3>
        <span className="text-xs font-bold text-slate-400">
          {studyClassName || "Lớp 10A1"}
        </span>
      </div>

      <div className="grid grid-cols-1 md:grid-cols-3 gap-3">
        {/* Top 1 */}
        {first && (
          <div className="glass-card rounded-2xl p-3.5 border-2 border-amber-300/80 bg-white/90 flex items-center gap-3 shadow-xs">
            <div className="w-8 h-8 rounded-xl bg-amber-400 text-slate-950 font-black text-sm flex items-center justify-center shrink-0">
              🥇
            </div>
            <div className="w-9 h-9 rounded-xl bg-amber-500 text-slate-950 font-black flex items-center justify-center text-xs shrink-0 border border-amber-400 overflow-hidden">
              {first.image ? (
                <img
                  src={first.image}
                  alt={first.name || "Top 1"}
                  className="w-full h-full object-cover"
                />
              ) : (
                <span>{first.name?.slice(0, 2).toUpperCase() || "MA"}</span>
              )}
            </div>
            <div className="min-w-0 flex-1">
              <h4 className="font-bold text-slate-900 text-sm truncate">
                {first.name}
              </h4>
              <span className="text-[11px] font-extrabold text-amber-600 block">
                {first.avgScore.toFixed(2)} Điểm
              </span>
            </div>
          </div>
        )}

        {/* Top 2 */}
        {second && (
          <div className="glass-card rounded-2xl p-3.5 border border-slate-200 bg-white/80 flex items-center gap-3 shadow-xs">
            <div className="w-8 h-8 rounded-xl bg-slate-100 text-slate-700 font-black text-sm flex items-center justify-center shrink-0">
              🥈
            </div>
            <div className="w-9 h-9 rounded-xl bg-slate-700 text-white font-black flex items-center justify-center text-xs shrink-0 overflow-hidden">
              {second.image ? (
                <img
                  src={second.image}
                  alt={second.name || "Top 2"}
                  className="w-full h-full object-cover"
                />
              ) : (
                <span>{second.name?.slice(0, 2).toUpperCase() || "PH"}</span>
              )}
            </div>
            <div className="min-w-0 flex-1">
              <h4 className="font-bold text-slate-900 text-sm truncate">
                {second.name}
              </h4>
              <span className="text-[11px] font-extrabold text-slate-700 block">
                {second.avgScore.toFixed(2)} Điểm
              </span>
            </div>
          </div>
        )}

        {/* Top 3 */}
        {third && (
          <div className="glass-card rounded-2xl p-3.5 border border-slate-200 bg-white/80 flex items-center gap-3 shadow-xs">
            <div className="w-8 h-8 rounded-xl bg-orange-50 text-orange-700 font-black text-sm flex items-center justify-center shrink-0">
              🥉
            </div>
            <div className="w-9 h-9 rounded-xl bg-orange-400 text-white font-black flex items-center justify-center text-xs shrink-0 overflow-hidden">
              {third.image ? (
                <img
                  src={third.image}
                  alt={third.name || "Top 3"}
                  className="w-full h-full object-cover"
                />
              ) : (
                <span>{third.name?.slice(0, 2).toUpperCase() || "GH"}</span>
              )}
            </div>
            <div className="min-w-0 flex-1">
              <h4 className="font-bold text-slate-900 text-sm truncate">
                {third.name}
              </h4>
              <span className="text-[11px] font-extrabold text-orange-600 block">
                {third.avgScore.toFixed(2)} Điểm
              </span>
            </div>
          </div>
        )}
      </div>
    </section>
  );
}
