"use client";

import { RankingUser } from "@/actions/ranking";
import { Target, Star } from "lucide-react";

interface NearMeViewProps {
  nearMeList: RankingUser[];
  currentUserId?: string;
  aheadGapScore?: number;
}

export function NearMeView({ nearMeList, currentUserId, aheadGapScore = 0.15 }: NearMeViewProps) {
  if (!nearMeList || nearMeList.length === 0) return null;

  const currentUserIndex = nearMeList.findIndex(
    (u) => u.isCurrentUser || u.id === currentUserId
  );

  const startRank = nearMeList[0]?.rank || 9;
  const endRank = nearMeList[nearMeList.length - 1]?.rank || 15;

  return (
    <section className="space-y-2.5">
      <div className="flex items-center justify-between px-1">
        <h3 className="text-sm font-extrabold text-slate-900 uppercase tracking-tight">
          Nhóm So Kè Gần Bạn (#{startRank} - #{endRank})
        </h3>
        <span className="text-xs font-semibold text-slate-400">
          Đối thủ cạnh tranh trực tiếp
        </span>
      </div>

      <div className="space-y-2">
        {nearMeList.map((user, idx) => {
          const isCurrent = user.isCurrentUser || user.id === currentUserId;
          const isTargetNext = currentUserIndex > 0 && idx === currentUserIndex - 1;
          const rankDisplay = user.rank ? `#${user.rank}` : `#${startRank + idx}`;
          const rankChange = user.rankChange;

          if (isCurrent) {
            return (
              <div
                key={user.id}
                className="bg-gradient-to-r from-blue-600 to-indigo-600 text-white rounded-2xl p-3.5 sm:p-4 flex items-center justify-between gap-3 shadow-xl shadow-blue-500/20 scale-[1.01] transition-all"
              >
                <div className="flex items-center gap-3 min-w-0 flex-1">
                  <span className="font-black text-amber-300 text-base w-7 text-center shrink-0">
                    {rankDisplay}
                  </span>
                  <div className="w-9 h-9 rounded-xl overflow-hidden bg-white/20 border border-amber-300 shrink-0 flex items-center justify-center font-bold text-amber-300 text-xs">
                    {user.image ? (
                      <img
                        src={user.image}
                        alt={user.name || "Avatar"}
                        className="w-full h-full object-cover"
                      />
                    ) : (
                      <span>{user.name?.[0] || "H"}</span>
                    )}
                  </div>
                  <div className="min-w-0 flex-1">
                    <h4 className="font-extrabold text-white text-sm flex items-center gap-1 truncate">
                      <span className="truncate">{user.name} (Bạn)</span> <Star className="w-3.5 h-3.5 fill-amber-300 text-amber-300 shrink-0" />
                    </h4>
                    <span className="text-[10px] font-bold text-blue-100 block truncate">
                      Đã nộp {user.completedTests} bài kiểm tra
                    </span>
                  </div>
                </div>

                <div className="flex items-center gap-2.5 text-right shrink-0">
                  <span className="text-[10px] font-black text-slate-950 bg-amber-300 px-2 py-1 rounded-md whitespace-nowrap">
                    {rankChange && rankChange > 0
                      ? `▲ +${rankChange} bậc`
                      : rankChange && rankChange < 0
                      ? `▼ ${rankChange}`
                      : "▲ Phong độ tốt"}
                  </span>
                  <span className="font-black text-amber-300 text-sm w-10 text-right">
                    {user.avgScore.toFixed(2)}
                  </span>
                </div>
              </div>
            );
          }

          if (isTargetNext) {
            return (
              <div
                key={user.id}
                className="glass-card rounded-2xl p-3.5 flex items-center justify-between gap-3 border border-amber-200 bg-amber-50/40 shadow-xs"
              >
                <div className="flex items-center gap-3 min-w-0 flex-1">
                  <span className="font-extrabold text-amber-600 text-sm w-7 text-center shrink-0">
                    {rankDisplay}
                  </span>
                  <div className="w-9 h-9 rounded-xl bg-amber-100 text-amber-800 font-black flex items-center justify-center text-xs shrink-0 border border-amber-200">
                    {user.image ? (
                      <img
                        src={user.image}
                        alt={user.name || "Avatar"}
                        className="w-full h-full object-cover rounded-xl"
                      />
                    ) : (
                      <span>{user.name?.slice(0, 2).toUpperCase() || "NV"}</span>
                    )}
                  </div>
                  <div className="min-w-0 flex-1">
                    <h4 className="font-extrabold text-slate-900 text-sm flex flex-wrap items-center gap-1.5 leading-snug">
                      <span className="truncate">{user.name}</span>
                      <span className="text-amber-600 text-[10px] font-bold bg-amber-100/80 px-1.5 py-0.5 rounded flex items-center gap-0.5 shrink-0">
                        <Target className="w-3 h-3 text-amber-600" /> Mục tiêu kế tiếp
                      </span>
                    </h4>
                    <span className="text-[11px] font-bold text-amber-700 block truncate">
                      Cần +{aheadGapScore.toFixed(2)} điểm để vượt
                    </span>
                  </div>
                </div>

                <div className="flex items-center gap-2.5 text-right shrink-0">
                  <span className="text-[10px] font-extrabold text-emerald-600 bg-emerald-100 px-2 py-1 rounded-md whitespace-nowrap">
                    {rankChange && rankChange > 0 ? `▲ +${rankChange}` : "Vị trí sát sườn"}
                  </span>
                  <span className="font-extrabold text-slate-900 text-sm w-10 text-right">
                    {user.avgScore.toFixed(2)}
                  </span>
                </div>
              </div>
            );
          }

          return (
            <div
              key={user.id}
              className="glass-card rounded-2xl p-3.5 flex items-center justify-between gap-3 bg-white/80 border border-slate-100 hover:bg-white transition"
            >
              <div className="flex items-center gap-3 min-w-0 flex-1">
                <span className="font-extrabold text-slate-400 text-sm w-7 text-center shrink-0">
                  {rankDisplay}
                </span>
                <div className="w-9 h-9 rounded-xl overflow-hidden bg-slate-100 text-slate-600 font-extrabold flex items-center justify-center text-xs shrink-0">
                  {user.image ? (
                    <img
                      src={user.image}
                      alt={user.name || "Avatar"}
                      className="w-full h-full object-cover"
                    />
                  ) : (
                    <span>{user.name?.[0] || "U"}</span>
                  )}
                </div>
                <div className="min-w-0 flex-1">
                  <h4 className="font-bold text-slate-900 text-sm truncate">
                    {user.name}
                  </h4>
                  <span className="text-[11px] font-medium text-slate-400 block truncate">
                    {user.completedTests} bài nộp
                  </span>
                </div>
              </div>

              <div className="flex items-center gap-2.5 text-right shrink-0">
                <span
                  className={`text-[10px] font-extrabold px-2 py-1 rounded-md whitespace-nowrap ${
                    rankChange && rankChange < 0
                      ? "text-rose-500 bg-rose-50"
                      : rankChange && rankChange > 0
                      ? "text-emerald-600 bg-emerald-50"
                      : "text-slate-400 bg-slate-100"
                  }`}
                >
                  {rankChange && rankChange < 0
                    ? `▼ ${rankChange}`
                    : rankChange && rankChange > 0
                    ? `▲ +${rankChange}`
                    : "Duy trì"}
                </span>
                <span className="font-extrabold text-slate-900 text-sm w-10 text-right">
                  {user.avgScore.toFixed(2)}
                </span>
              </div>
            </div>
          );
        })}
      </div>
    </section>
  );
}
