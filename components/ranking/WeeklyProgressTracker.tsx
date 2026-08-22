"use client";

import { ArrowRight, Castle, ShieldAlert, TrendingUp, CheckCircle2 } from "lucide-react";

interface WeeklyProgressTrackerProps {
  progressData?: Array<{
    sessionName?: string;
    score?: number;
    percentile?: number;
    unlockedRank?: string;
    isCurrent?: boolean;
  }>;
}

export function WeeklyProgressTracker({ progressData }: WeeklyProgressTrackerProps) {
  const defaultQuests = [
    {
      id: 1,
      title: "QUEST 01",
      supremacyText: "Top 38% toàn khóa",
      topText: "Top 38%",
      rankText: "RANK B",
      scoreText: "7.5đ",
      improvement: "+9%",
      isActive: false,
    },
    {
      id: 2,
      title: "QUEST 02",
      supremacyText: "Top 29% toàn khóa",
      topText: "Top 29%",
      rankText: "RANK B",
      scoreText: "8.0đ",
      improvement: "+9%",
      isActive: false,
    },
    {
      id: 3,
      title: "QUEST 03",
      supremacyText: "Top 17% toàn khóa",
      topText: "Top 17%",
      rankText: "RANK A",
      scoreText: "8.8đ",
      improvement: "+12%",
      isActive: false,
    },
    {
      id: 4,
      title: "QUEST 04",
      supremacyText: "Top 8% toàn khóa",
      topText: "Top 8%",
      rankText: "RANK S",
      scoreText: "9.5đ",
      improvement: "+15%",
      isActive: true,
    },
  ];

  const quests = Array.isArray(progressData) && progressData.length > 0
    ? progressData.map((item: any, index: number) => {
        const currentSupremacy = item.percentile || Math.max(10, 50 + index * 12);
        const topPct = Math.max(1, 101 - currentSupremacy);
        const prevSupremacy = index > 0 ? (progressData[index - 1].percentile || (50 + (index - 1) * 12)) : null;
        const diff = prevSupremacy !== null ? currentSupremacy - prevSupremacy : null;
        const improvementText = diff !== null ? (diff >= 0 ? `+${diff}%` : `${diff}%`) : null;

        return {
          id: index + 1,
          title: item.sessionName ? item.sessionName.toUpperCase().replace("BUỔI", "QUEST") : `QUEST 0${index + 1}`,
          supremacyText: `Top ${topPct}% toàn khóa`,
          topText: `Top ${topPct}%`,
          rankText: item.unlockedRank ? `RANK ${item.unlockedRank}` : (index === 3 ? "RANK S" : index === 2 ? "RANK A" : "RANK B"),
          scoreText: item.score ? `${typeof item.score === "number" ? item.score.toFixed(1) : item.score}đ` : `${(7.0 + index * 0.8).toFixed(1)}đ`,
          improvement: improvementText,
          isActive: !!item.isCurrent || index === progressData.length - 1,
        };
      })
    : defaultQuests;

  return (
    <div className="rounded-none sm:rounded-2xl bg-[#0D121D]/90 backdrop-blur-xl border-y sm:border border-slate-800/80 p-3.5 sm:p-6 shadow-2xl text-slate-100 space-y-4 relative overflow-hidden group w-full min-w-0 max-w-full">
      {/* Background AI Artwork Backdrop */}
      <div
        className="absolute inset-0 bg-cover bg-center opacity-75 transition-opacity duration-500 pointer-events-none"
        style={{ backgroundImage: "url('/dungeon-floors-bg.png')" }}
      />
      <div className="absolute inset-0 bg-gradient-to-r from-[#0D121D] via-[#0D121D]/70 to-[#0D121D]/50 pointer-events-none" />

      {/* Header with Weekly Improvement Progress Badge */}
      <div className="relative z-10 flex flex-col sm:flex-row sm:items-center justify-between gap-3">
        <div>
          <h3 className="font-black text-sm sm:text-lg lg:text-xl tracking-widest text-slate-200 uppercase flex items-center gap-2">
            <Castle className="w-5 h-5 text-cyan-400" />
            <span>CON ĐƯỜNG CHINH PHỤC QUEST (ASCENSION PATH)</span>
          </h3>
          <p className="text-xs sm:text-sm lg:text-base text-slate-400 font-medium mt-0.5">
            Theo dõi thứ hạng Top % và chỉ số Power qua từng thử thách Dungeon
          </p>
        </div>

        {/* Weekly Progress Improvement Badge */}
        <div className="flex items-center gap-2 px-3.5 py-2 rounded-full bg-emerald-950/90 border border-emerald-500/60 text-xs sm:text-sm lg:text-base font-black text-emerald-300 font-mono shadow-lg shrink-0">
          <TrendingUp className="w-4 h-4 sm:w-5 sm:h-5 text-emerald-400 animate-pulse" />
          <span>↑ +15% POWER SO VỚI QUEST TRƯỚC</span>
        </div>
      </div>

      {/* Desktop Layout: Horizontal Row of 4 Quest Cards with Arrows */}
      <div className="hidden md:flex items-center gap-3 w-full justify-between relative z-10">
        {quests.map((quest: any, idx: number) => (
          <div key={quest.id} className="flex items-center gap-3 flex-1">
            <div
              className={`flex-1 rounded-xl p-4 sm:p-5 transition-all duration-300 border relative ${
                quest.isActive
                  ? "bg-[#091522] border-cyan-500/80 shadow-[0_0_15px_rgba(6,182,212,0.25)] ring-1 ring-cyan-400/50"
                  : "bg-[#080B12]/80 border-slate-800/90 text-slate-300"
              }`}
            >
              <div className="flex items-center justify-between mb-2">
                <span className="text-xs sm:text-base lg:text-lg font-black tracking-widest uppercase text-slate-200">
                  {quest.title}
                </span>

                {quest.isActive ? (
                  <span className="text-[10px] sm:text-xs font-black text-emerald-400 bg-emerald-950/80 border border-emerald-500/50 px-2.5 py-1 rounded uppercase tracking-wider flex items-center gap-1">
                    <CheckCircle2 className="w-3.5 h-3.5" />
                    <span>HIỆN TẠI</span>
                  </span>
                ) : (
                  <span className="text-[10px] sm:text-xs font-bold text-slate-400 font-mono">
                    HOÀN THÀNH
                  </span>
                )}
              </div>

              {/* Supremacy % Text */}
              <div className="text-xs sm:text-sm lg:text-base font-mono text-cyan-300 font-extrabold mb-1.5">
                {quest.supremacyText}
              </div>

              {/* Subtitle text: TOP XX% | RANK X | Điểm số + Improvement Badge */}
              <div className="text-xs sm:text-sm lg:text-base font-bold text-slate-400 space-x-1.5 font-mono flex items-center flex-wrap">
                <span className={quest.isActive ? "text-amber-400 font-black" : "text-slate-300"}>
                  {quest.rankText}
                </span>
                <span>•</span>
                <span className="text-cyan-400 font-black">
                  {quest.scoreText}
                </span>
                {quest.improvement && (
                  <span className="text-emerald-400 font-black ml-1 text-xs sm:text-sm">
                    (↑ {quest.improvement})
                  </span>
                )}
              </div>
            </div>

            {/* Right Arrow connecting cards */}
            {idx < quests.length - 1 && (
              <ArrowRight className="w-5 h-5 text-slate-600 shrink-0" />
            )}
          </div>
        ))}
      </div>

      {/* Mobile Layout: Branching Tree Diagram matching reference image */}
      <div className="md:hidden space-y-3 pt-1 relative z-10">
        <div className="grid grid-cols-12 gap-3 items-center">
          {/* Column 1: Quest 1 */}
          <div className="col-span-5">
            <div className="rounded-xl p-3 bg-[#080B12]/90 border border-slate-800 text-slate-300 space-y-1">
              <span className="text-xs font-black tracking-widest uppercase block text-slate-200">
                {quests[0].title}
              </span>
              <div className="text-[10px] font-bold text-cyan-300 font-mono">
                {quests[0].supremacyText}
              </div>
              <div className="text-[10px] font-bold font-mono space-x-1 text-slate-400 flex flex-wrap">
                <span className="text-amber-300 font-black">{quests[0].rankText}</span>
                <span>•</span>
                <span className="text-cyan-300 font-black">{quests[0].scoreText}</span>
              </div>
            </div>
          </div>

          {/* Branch Connector lines */}
          <div className="col-span-2 flex flex-col items-center justify-center text-slate-600">
            <div className="w-full border-t border-b border-slate-700 h-10 border-r rounded-r-lg relative">
              <ArrowRight className="w-4 h-4 text-cyan-400 absolute right-0 top-1/2 -translate-y-1/2 translate-x-2" />
            </div>
          </div>

          {/* Column 2: Stacked Quest 2 & Quest 3 */}
          <div className="col-span-5 space-y-2.5">
            {/* Quest 2 */}
            <div className="rounded-xl p-2.5 bg-[#080B12]/90 border border-slate-800 text-slate-300 space-y-0.5">
              <div className="flex items-center justify-between">
                <span className="text-xs font-black tracking-widest uppercase text-slate-200">
                  {quests[1].title}
                </span>
                {quests[1].improvement && (
                  <span className="text-[9px] font-black text-emerald-400 font-mono">↑ {quests[1].improvement}</span>
                )}
              </div>
              <div className="text-[10px] font-bold font-mono text-cyan-300">
                {quests[1].supremacyText}
              </div>
              <div className="text-[10px] font-bold font-mono space-x-1 text-slate-400 flex flex-wrap">
                <span className="text-amber-300 font-black">{quests[1].rankText}</span>
                <span>•</span>
                <span className="text-cyan-300 font-black">{quests[1].scoreText}</span>
              </div>
            </div>

            {/* Quest 3 */}
            <div className="rounded-xl p-2.5 bg-[#080B12]/90 border border-slate-800 text-slate-300 space-y-0.5">
              <div className="flex items-center justify-between">
                <span className="text-xs font-black tracking-widest uppercase text-slate-200">
                  {quests[2].title}
                </span>
                {quests[2].improvement && (
                  <span className="text-[9px] font-black text-emerald-400 font-mono">↑ {quests[2].improvement}</span>
                )}
              </div>
              <div className="text-[10px] font-bold font-mono text-cyan-300">
                {quests[2].supremacyText}
              </div>
              <div className="text-[10px] font-bold font-mono space-x-1 text-slate-400 flex flex-wrap">
                <span className="text-amber-300 font-black">{quests[2].rankText}</span>
                <span>•</span>
                <span className="text-cyan-300 font-black">{quests[2].scoreText}</span>
              </div>
            </div>
          </div>
        </div>

        {/* Quest 4 (Current) Full Width Card */}
        <div className="rounded-xl p-3 bg-[#091522] border-2 border-cyan-500/80 shadow-[0_0_15px_rgba(6,182,212,0.3)] text-white space-y-1">
          <div className="flex items-center justify-between">
            <span className="text-xs font-black tracking-widest uppercase text-cyan-300">
              {quests[3].title}
            </span>
            <div className="flex items-center gap-1.5">
              {quests[3].improvement && (
                <span className="text-[9px] font-black text-emerald-400 bg-emerald-950/80 border border-emerald-500/50 px-2 py-0.5 rounded font-mono">
                  ↑ {quests[3].improvement} POWER
                </span>
              )}
              <span className="text-[9px] font-black text-emerald-400 bg-emerald-950/80 border border-emerald-500/50 px-2 py-0.5 rounded uppercase">
                HIỆN TẠI
              </span>
            </div>
          </div>

          <div className="text-xs font-bold text-slate-200 font-mono flex items-center gap-2 flex-wrap">
            <span>{quests[3].supremacyText}</span>
            <span>•</span>
            <span className="text-amber-300 font-black">{quests[3].rankText}</span>
            <span>•</span>
            <span className="text-cyan-300 font-black">{quests[3].scoreText}</span>
          </div>
        </div>
      </div>
    </div>
  );
}
