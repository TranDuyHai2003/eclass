"use client";

import { useState, useMemo } from "react";
import { RankingUser } from "@/actions/ranking";
import { calculateHunterLeaderboard } from "@/lib/ranking-engine";
import { getSafeAvatarUrl } from "@/lib/game-rank";
import { Swords, Crown, Flame, ShieldAlert, Sparkles, Trophy, Award, Zap, Calendar, Globe, ZapIcon, TrendingUp, TrendingDown, Minus } from "lucide-react";
import Image from "next/image";

interface Top15LeaderboardProps {
  leaderboard: RankingUser[];
  weeklyLeaderboard?: RankingUser[];
  monthlyLeaderboard?: RankingUser[];
  currentUserId?: string;
  totalStudentsInClass?: number;
  minRequiredTests?: number;
}

export function Top15Leaderboard({
  leaderboard = [],
  weeklyLeaderboard = [],
  monthlyLeaderboard = [],
  currentUserId,
  totalStudentsInClass,
  minRequiredTests = 5,
}: Top15LeaderboardProps) {
  const [period, setPeriod] = useState<"ALL_TIME" | "WEEKLY" | "MONTHLY">("ALL_TIME");

  const activeRawList = useMemo(() => {
    if (period === "WEEKLY") {
      return (weeklyLeaderboard && weeklyLeaderboard.length > 0) ? weeklyLeaderboard : leaderboard;
    }
    if (period === "MONTHLY") {
      return (monthlyLeaderboard && monthlyLeaderboard.length > 0) ? monthlyLeaderboard : leaderboard;
    }
    return leaderboard;
  }, [period, leaderboard, weeklyLeaderboard, monthlyLeaderboard]);

  const totalCount = totalStudentsInClass || Math.max(1, activeRawList.length);

  // Process through ranking engine
  const engineResult = calculateHunterLeaderboard(activeRawList, totalCount);
  const eligibleLeaderboard = engineResult.leaderboard.slice(0, 15);

  const top1 = eligibleLeaderboard[0];
  const top2 = eligibleLeaderboard[1];
  const top3 = eligibleLeaderboard[2];

  // Ranks 4 to 15 for the table
  const tableList = eligibleLeaderboard.slice(3, 15);

  const getAvatarUrl = (u: any) => {
    if (!u) return "";
    return getSafeAvatarUrl(u.name, u.image);
  };

  return (
    <section className="rounded-none sm:rounded-3xl border-y sm:border border-slate-800/80 bg-[#0D121D]/90 backdrop-blur-xl shadow-2xl text-slate-100 overflow-hidden space-y-4 sm:space-y-6 p-3.5 sm:p-6 lg:p-8 relative group w-full min-w-0 max-w-full">
      {/* Background AI Guild Throne Room Artwork Backdrop */}
      <div
        className="absolute inset-0 bg-cover bg-center opacity-75 transition-opacity duration-500 pointer-events-none"
        style={{ backgroundImage: "url('/guild-leaderboard-bg.webp')" }}
      />
      <div className="absolute inset-0 bg-gradient-to-b from-[#0D121D]/50 via-[#0D121D]/75 to-[#0D121D]/95 pointer-events-none" />

      {/* Header Row: BANG HỘI THỢ SĂN · TOP 15 + TIMEFRAME TABS */}
      <div className="flex flex-col md:flex-row md:items-center justify-between border-b border-slate-800/80 pb-3 sm:pb-4 gap-3 relative z-10 w-full min-w-0">
        <div className="flex items-center gap-3 min-w-0">
          <div className="p-2 sm:p-2.5 rounded-xl bg-cyan-950/80 border border-cyan-500/50 shadow-[0_0_12px_rgba(6,182,212,0.4)] shrink-0">
            <Swords className="w-5 h-5 sm:w-6 sm:h-6 text-cyan-400" />
          </div>
          <div className="min-w-0">
            <h3 className="font-black text-xs sm:text-lg lg:text-xl tracking-widest text-slate-100 uppercase">
              TOP 15 LEADERBOARD
            </h3>
            <p className="text-[10px] sm:text-xs lg:text-sm text-slate-400 font-mono">
              {period === "ALL_TIME" ? "Xếp hạng tích lũy toàn khóa" : period === "WEEKLY" ? "Xếp hạng bứt phá trong tuần" : "Xếp hạng phong độ trong tháng"}
            </p>
          </div>
        </div>

        {/* TIMEFRAME TABS (TOÀN KHÓA / TUẦN NÀY / THÁNG NÀY) */}
        <div className="flex items-center gap-1.5 p-1 rounded-2xl bg-slate-950/90 border border-slate-800/80 shrink-0 self-start md:self-auto shadow-inner">
          <button
            onClick={() => setPeriod("ALL_TIME")}
            className={`px-3 sm:px-4 py-1.5 rounded-xl text-xs sm:text-base font-black transition-all flex items-center gap-1.5 ${period === "ALL_TIME"
              ? "bg-gradient-to-r from-cyan-600/30 to-blue-600/30 text-cyan-300 border border-cyan-400/60 shadow-[0_0_12px_rgba(6,182,212,0.4)]"
              : "text-slate-400 hover:text-slate-200 hover:bg-slate-900"
              }`}
          >
            <Globe className="w-3.5 h-3.5 sm:w-4 sm:h-4 text-cyan-400" />
            <span>TOÀN KHÓA</span>
          </button>
          <button
            onClick={() => setPeriod("WEEKLY")}
            className={`px-3 sm:px-4 py-1.5 rounded-xl text-xs sm:text-base font-black transition-all flex items-center gap-1.5 ${period === "WEEKLY"
              ? "bg-gradient-to-r from-amber-600/30 to-orange-600/30 text-amber-300 border border-amber-400/60 shadow-[0_0_12px_rgba(245,158,11,0.4)]"
              : "text-slate-400 hover:text-slate-200 hover:bg-slate-900"
              }`}
          >
            <ZapIcon className="w-3.5 h-3.5 sm:w-4 sm:h-4 text-amber-400" />
            <span>TUẦN NÀY</span>
          </button>
          <button
            onClick={() => setPeriod("MONTHLY")}
            className={`px-3 sm:px-4 py-1.5 rounded-xl text-xs sm:text-base font-black transition-all flex items-center gap-1.5 ${period === "MONTHLY"
              ? "bg-gradient-to-r from-emerald-600/30 to-teal-600/30 text-emerald-300 border border-emerald-400/60 shadow-[0_0_12px_rgba(16,185,129,0.4)]"
              : "text-slate-400 hover:text-slate-200 hover:bg-slate-900"
              }`}
          >
            <Calendar className="w-3.5 h-3.5 sm:w-4 sm:h-4 text-emerald-400" />
            <span>THÁNG NÀY</span>
          </button>
        </div>
      </div>

      {/* Visual Monarch RPG Podium for Top 3 (Order: Top 2 - Top 1 - Top 3) */}
      {top1 && top2 && top3 && (
        <div className="pt-2 sm:pt-4 pb-4 sm:pb-6 relative z-10 w-full min-w-0">
          <div className="grid grid-cols-3 gap-2 sm:gap-6 lg:gap-8 items-end max-w-3xl mx-auto w-full min-w-0">
            {/* Rank 2 (Silver Monarch Warden - Left) */}
            <div className="flex flex-col items-center text-center space-y-2 order-1 group/p2 min-w-0 w-full">
              {/* Avatar + Silver Glow Ring */}
              <div className="relative">
                <div className="w-6 h-6 sm:w-8 sm:h-8 rounded-full bg-gradient-to-r from-slate-200 to-slate-400 text-slate-950 font-black text-xs sm:text-sm flex items-center justify-center mx-auto mb-1 border-2 border-white shadow-[0_0_15px_rgba(203,213,225,0.8)] z-10 relative">
                  2
                </div>
                <div className="w-14 h-14 sm:w-24 sm:h-24 lg:w-28 lg:h-28 rounded-2xl overflow-hidden border-2 border-slate-300 bg-slate-950 shadow-[0_0_25px_rgba(203,213,225,0.4)] ring-4 ring-slate-300/40 mx-auto transition-transform duration-300 group-hover/p2:scale-105">
                  <Image
                    src={getAvatarUrl(top2)}
                    alt={top2.name || "Top 2"}
                    width={112}
                    height={112}
                    className="w-full h-full object-cover"
                  />
                </div>
              </div>

              {/* Steel-Silver Metallic Pedestal Card */}
              <div className="w-full bg-gradient-to-b from-[#263248]/90 via-[#151D2A]/90 to-[#0A0F17]/95 border-2 border-slate-400/80 rounded-2xl p-2 sm:p-4 text-center shadow-xl shadow-slate-900/50 space-y-1.5 min-w-0 flex flex-col justify-between backdrop-blur-md">
                <div className="space-y-0.5">
                  <span className="text-[9px] sm:text-xs font-mono font-bold text-slate-300 uppercase tracking-wider block">
                    VƯƠNG GIẢ HẠNG 2
                  </span>
                  <h4 className="font-black text-xs sm:text-base lg:text-lg text-white leading-tight break-words line-clamp-2">
                    {top2.name}
                  </h4>
                </div>

                <div className="space-y-1 pt-1">
                  {/* Power Score Badge */}
                  <div className="inline-flex items-center justify-center gap-1 px-2 py-1 rounded-xl bg-slate-900/90 border border-slate-400/70 text-[10px] sm:text-xs font-mono font-black text-slate-200 w-full shadow-inner">
                    <Zap className="w-3 h-3 text-cyan-400 shrink-0" />
                    <span>{top2.displayPowerText} PTS</span>
                  </div>
                  {/* Micro stats */}
                  <p className="text-[9px] sm:text-xs font-mono text-slate-400 font-bold">
                    {top2.completedTests} Quests · {top2.rawAverageScore.toFixed(2)}đ
                  </p>
                </div>
              </div>
            </div>

            {/* Rank 1 (The Gold Sovereign Monarch - Center - Tallest Throne Pedestal) */}
            <div className="flex flex-col items-center text-center space-y-2 order-2 -mt-4 sm:-mt-8 group/p1 min-w-0 w-full z-20">
              {/* Avatar + Floating Gold Crown + Monarch Aura Ring */}
              <div className="relative">
                <Crown className="w-6 h-6 sm:w-10 sm:h-10 text-amber-400 fill-amber-400 absolute -top-5 sm:-top-9 left-1/2 -translate-x-1/2 drop-shadow-[0_0_15px_rgba(245,158,11,1)] animate-bounce" />
                <div className="w-7 h-7 sm:w-9 sm:h-9 rounded-full bg-gradient-to-r from-amber-300 via-amber-400 to-yellow-500 text-slate-950 font-black text-xs sm:text-base flex items-center justify-center mx-auto mb-1 border-2 border-white shadow-[0_0_20px_rgba(245,158,11,0.9)] ring-4 ring-amber-500/80 z-10 relative">
                  1
                </div>
                <div className="w-18 h-18 sm:w-28 sm:h-28 lg:w-32 lg:h-32 rounded-2xl overflow-hidden border-2 border-amber-400 bg-slate-950 shadow-[0_0_35px_rgba(245,158,11,0.6)] ring-4 ring-amber-400/60 mx-auto transition-transform duration-300 group-hover/p1:scale-105">
                  <Image
                    src={getAvatarUrl(top1)}
                    alt={top1.name || "Top 1"}
                    width={128}
                    height={128}
                    className="w-full h-full object-cover"
                  />
                </div>
              </div>

              {/* Monarch Gold Metallic Pedestal Card */}
              <div className="w-full bg-gradient-to-b from-[#4A3B18]/95 via-[#2A200C]/95 to-[#140F05]/95 border-2 border-amber-400 rounded-2xl p-2.5 sm:p-5 text-center shadow-2xl shadow-amber-500/25 space-y-1.5 min-w-0 flex flex-col justify-between backdrop-blur-md">
                <div className="space-y-0.5">
                  <span className="text-[9px] sm:text-xs font-mono font-black text-amber-400 uppercase tracking-widest block flex items-center justify-center gap-1">
                    <Trophy className="w-3.5 h-3.5 text-amber-400 fill-amber-400" />
                    <span>CHÚA TỂ BANG HỘI</span>
                  </span>
                  <h4 className="font-black text-xs sm:text-lg lg:text-xl text-amber-200 leading-tight break-words line-clamp-2">
                    {top1.name}
                  </h4>
                </div>

                <div className="space-y-1 pt-1">
                  {/* Power Score Badge */}
                  <div className="inline-flex items-center justify-center gap-1 px-2.5 py-1 sm:py-1.5 rounded-xl bg-amber-950/90 border border-amber-400 text-xs sm:text-sm font-mono font-black text-amber-300 w-full shadow-[0_0_12px_rgba(245,158,11,0.4)]">
                    <Zap className="w-3.5 h-3.5 text-amber-400 fill-amber-400 shrink-0 animate-pulse" />
                    <span>{top1.displayPowerText} PTS</span>
                  </div>
                  {/* Micro stats */}
                  <p className="text-[9px] sm:text-xs font-mono text-amber-300/80 font-bold">
                    {top1.completedTests} Quests · {top1.rawAverageScore.toFixed(2)}đ
                  </p>
                </div>
              </div>
            </div>

            {/* Rank 3 (Bronze Monarch Vanguard - Right) */}
            <div className="flex flex-col items-center text-center space-y-2 order-3 group/p3 min-w-0 w-full">
              {/* Avatar + Bronze Glow Ring */}
              <div className="relative">
                <div className="w-6 h-6 sm:w-8 sm:h-8 rounded-full bg-gradient-to-r from-amber-600 to-amber-800 text-amber-100 font-black text-xs sm:text-sm flex items-center justify-center mx-auto mb-1 border-2 border-amber-400 shadow-[0_0_15px_rgba(217,119,6,0.8)] z-10 relative">
                  3
                </div>
                <div className="w-14 h-14 sm:w-24 sm:h-24 lg:w-28 lg:h-28 rounded-2xl overflow-hidden border-2 border-amber-600 bg-slate-950 shadow-[0_0_25px_rgba(217,119,6,0.4)] ring-4 ring-amber-600/40 mx-auto transition-transform duration-300 group-hover/p3:scale-105">
                  <Image
                    src={getAvatarUrl(top3)}
                    alt={top3.name || "Top 3"}
                    width={112}
                    height={112}
                    className="w-full h-full object-cover"
                  />
                </div>
              </div>

              {/* Bronze Metallic Pedestal Card */}
              <div className="w-full bg-gradient-to-b from-[#3D2517]/90 via-[#23150D]/90 to-[#0F0905]/95 border-2 border-amber-600/80 rounded-2xl p-2 sm:p-4 text-center shadow-xl shadow-amber-950/50 space-y-1.5 min-w-0 flex flex-col justify-between backdrop-blur-md">
                <div className="space-y-0.5">
                  <span className="text-[9px] sm:text-xs font-mono font-bold text-amber-400 uppercase tracking-wider block">
                    VƯƠNG GIẢ HẠNG 3
                  </span>
                  <h4 className="font-black text-xs sm:text-base lg:text-lg text-white leading-tight break-words line-clamp-2">
                    {top3.name}
                  </h4>
                </div>

                <div className="space-y-1 pt-1">
                  {/* Power Score Badge */}
                  <div className="inline-flex items-center justify-center gap-1 px-2 py-1 rounded-xl bg-amber-950/90 border border-amber-600/70 text-[10px] sm:text-xs font-mono font-black text-amber-200 w-full shadow-inner">
                    <Zap className="w-3 h-3 text-amber-500 shrink-0" />
                    <span>{top3.displayPowerText} PTS</span>
                  </div>
                  {/* Micro stats */}
                  <p className="text-[9px] sm:text-xs font-mono text-amber-400/70 font-bold">
                    {top3.completedTests} Quests · {top3.rawAverageScore.toFixed(2)}đ
                  </p>
                </div>
              </div>
            </div>
          </div>
        </div>
      )}

      {/* MOBILE HUNTER CARDS (sm:hidden) - 100% Fit Compact RPG Card Format */}
      <div className="sm:hidden space-y-2.5 relative z-10 w-full min-w-0">
        {tableList.map((user) => {
          const rankPos = user.position || 4;
          const { theme, movement, displayTopText, displayPowerText, rawAverageScore, completedTests } = user;

          return (
            <div
              key={user.id}
              className="p-3 rounded-2xl bg-[#080B12]/40 border border-slate-800/80 text-slate-200 shadow-md space-y-2 min-w-0 hover:bg-[#080B12]/60 transition-colors"
            >
              {/* Card Header Row: Rank #, Rank Badge, Movement */}
              <div className="flex items-center justify-between border-b border-slate-800/80 pb-2">
                <div className="flex items-center gap-2">
                  <span className="font-mono font-black text-xs text-slate-300">
                    #{String(rankPos).padStart(2, "0")}
                  </span>
                  <span className={`text-[10px] font-mono font-black px-2.5 py-0.5 rounded-full uppercase tracking-wider ${theme.badgeBg}`}>
                    RANK {user.provisionalRank}
                  </span>
                </div>

                {/* Rank Movement Tag */}
                <div className="flex items-center gap-1">
                  {movement.direction === "up" && (
                    <span className="whitespace-nowrap inline-flex items-center gap-1 px-2.5 py-0.5 rounded-full bg-emerald-500/15 border border-emerald-500/40 text-emerald-400 text-[10px] font-mono font-black shadow-[0_0_8px_rgba(16,185,129,0.2)]">
                      <TrendingUp className="w-3 h-3 text-emerald-400 shrink-0" />
                      <span>+{Math.abs(movement.delta || 0)}</span>
                    </span>
                  )}
                  {movement.direction === "down" && (
                    <span className="whitespace-nowrap inline-flex items-center gap-1 px-2.5 py-0.5 rounded-full bg-rose-500/15 border border-rose-500/40 text-rose-400 text-[10px] font-mono font-black shadow-[0_0_8px_rgba(244,63,94,0.2)]">
                      <TrendingDown className="w-3 h-3 text-rose-400 shrink-0" />
                      <span>-{Math.abs(movement.delta || 0)}</span>
                    </span>
                  )}
                  {movement.direction === "same" && (
                    <span className="whitespace-nowrap inline-flex items-center justify-center px-2 py-0.5 rounded-full bg-slate-800/80 border border-slate-700/80 text-slate-400 text-[10px] font-mono font-bold">
                      <Minus className="w-3 h-3 text-slate-400" />
                    </span>
                  )}
                  {movement.direction === "new" && (
                    <span className="whitespace-nowrap inline-flex items-center gap-0.5 px-2 py-0.5 rounded-full bg-cyan-500/15 border border-cyan-500/50 text-cyan-300 text-[10px] font-mono font-black tracking-wider shadow-[0_0_8px_rgba(6,182,212,0.25)]">
                      <Sparkles className="w-2.5 h-2.5 text-cyan-300 animate-pulse shrink-0" />
                      <span>NEW</span>
                    </span>
                  )}
                </div>
              </div>

              {/* Card Body: Avatar, Name & Power Score */}
              <div className="flex items-center justify-between gap-3">
                <div className="flex items-center gap-2.5 min-w-0 flex-1">
                  <div className="w-9 h-9 rounded-xl overflow-hidden bg-slate-900 border border-slate-700 shrink-0">
                    <Image
                      src={getAvatarUrl(user)}
                      alt={user.name || "Thợ săn"}
                      width={36}
                      height={36}
                      className="w-full h-full object-cover"
                    />
                  </div>
                  <div className="min-w-0 space-y-0.5">
                    <h5 className="font-black text-white text-xs leading-snug break-words">
                      {user.name}
                    </h5>
                    <span className="text-[10px] font-mono text-emerald-400 font-bold block">
                      {completedTests} Quests hoàn thành
                    </span>
                  </div>
                </div>

                {/* Power Score */}
                <div className="flex flex-col items-end shrink-0">
                  <span className="text-[9px] font-mono text-slate-400 uppercase font-bold">POWER</span>
                  <span className="font-mono font-black text-amber-300 text-sm">
                    {displayPowerText} PTS
                  </span>
                </div>
              </div>

              {/* Dynamic Rank Supremacy Progress Bar */}
              <div className="w-full bg-slate-950/80 rounded-full h-2 border border-slate-800/80 overflow-hidden">
                <div
                  className={`h-full rounded-full transition-all duration-500 ${user.provisionalRank === 'SSS' ? 'bg-gradient-to-r from-amber-500 to-yellow-400' :
                    user.provisionalRank === 'SS' ? 'bg-gradient-to-r from-orange-500 to-red-500' :
                      user.provisionalRank === 'S' ? 'bg-gradient-to-r from-rose-500 to-pink-500' :
                        user.provisionalRank === 'A' ? 'bg-gradient-to-r from-cyan-500 to-blue-500' :
                          'bg-gradient-to-r from-emerald-500 to-teal-500'
                    }`}
                  style={{ width: `${Math.max(15, Math.round(((totalCount - rankPos + 1) / totalCount) * 100))}%` }}
                />
              </div>

              {/* Card Footer: Tests + Avg Score */}
              <div className="flex items-center justify-between text-[10px] font-mono font-bold text-slate-400 pt-0.5">
                <span>{completedTests} Quests hoàn thành</span>
                <span className="text-slate-300 font-black">Điểm TB: {rawAverageScore.toFixed(2)}đ</span>
              </div>
            </div>
          );
        })}
      </div>

      {/* DESKTOP TABLE (hidden sm:block) - Transparent Glassmorphic Grid */}
      <div className="hidden sm:block overflow-x-auto w-full rounded-2xl border border-slate-800/70 bg-[#080B12]/30 backdrop-blur-md relative z-10 shadow-xl min-w-0">
        <table className="w-full text-left text-base text-slate-300 font-medium border-collapse">
          <thead className="bg-[#0B0F17]/50 backdrop-blur-md text-slate-400 uppercase tracking-wider font-black text-sm sm:text-base lg:text-lg border-b border-slate-800/80">
            <tr>
              <th className="py-4 px-5 text-center w-24">HẠNG</th>
              <th className="py-4 px-5 text-center w-24">BIẾN ĐỘNG</th>
              <th className="py-4 px-5">THỢ SĂN</th>
              <th className="py-4 px-5 text-center">CẤP ĐỘ RANK</th>
              <th className="py-4 px-5 text-center">POWER SCORE</th>
              <th className="py-4 px-5 text-right">ĐIỂM TB</th>
            </tr>
          </thead>
          <tbody className="divide-y divide-slate-800/50 font-medium">
            {tableList.map((user) => {
              const rankPos = user.position || 4;
              const { theme, movement, displayPowerText, rawAverageScore, completedTests } = user;

              return (
                <tr
                  key={user.id}
                  className="border-l-4 border-l-transparent hover:border-l-cyan-400 hover:bg-cyan-950/30 transition-colors duration-150 group/row"
                >
                  {/* Position */}
                  <td className="py-4 px-5 text-center font-black font-mono">
                    <span className="inline-flex items-center justify-center w-10 h-10 sm:w-11 sm:h-11 rounded-xl bg-[#0F1623] border border-slate-800 text-slate-300 text-base sm:text-lg font-black group-hover/row:border-cyan-500/50 group-hover/row:text-cyan-400 transition-colors">
                      #{String(rankPos).padStart(2, "0")}
                    </span>
                  </td>

                  {/* Rank Movement */}
                  <td className="py-4 px-5 text-center font-mono font-black text-xs sm:text-base">
                    {movement.direction === "up" && (
                      <span className="whitespace-nowrap inline-flex items-center gap-1.5 px-3 py-1 rounded-full bg-emerald-500/15 border border-emerald-500/40 text-emerald-400 text-xs sm:text-sm font-black shadow-[0_0_12px_rgba(16,185,129,0.25)]">
                        <TrendingUp className="w-3.5 h-3.5 text-emerald-400 shrink-0" />
                        <span>+{Math.abs(movement.delta || 0)}</span>
                      </span>
                    )}
                    {movement.direction === "down" && (
                      <span className="whitespace-nowrap inline-flex items-center gap-1.5 px-3 py-1 rounded-full bg-rose-500/15 border border-rose-500/40 text-rose-400 text-xs sm:text-sm font-black shadow-[0_0_12px_rgba(244,63,94,0.25)]">
                        <TrendingDown className="w-3.5 h-3.5 text-rose-400 shrink-0" />
                        <span>-{Math.abs(movement.delta || 0)}</span>
                      </span>
                    )}
                    {movement.direction === "same" && (
                      <span className="whitespace-nowrap inline-flex items-center justify-center w-7 h-7 rounded-full bg-slate-800/80 border border-slate-700/80 text-slate-400 text-xs font-bold mx-auto">
                        <Minus className="w-3.5 h-3.5 text-slate-400" />
                      </span>
                    )}
                    {movement.direction === "new" && (
                      <span className="whitespace-nowrap inline-flex items-center gap-1 px-3 py-1 rounded-full bg-cyan-500/15 border border-cyan-500/50 text-cyan-300 text-xs font-black tracking-wider uppercase shadow-[0_0_12px_rgba(6,182,212,0.3)]">
                        <Sparkles className="w-3 h-3 text-cyan-300 animate-pulse shrink-0" />
                        <span>NEW</span>
                      </span>
                    )}
                  </td>

                  {/* Name + Avatar */}
                  <td className="py-4 px-5">
                    <div className="flex items-center gap-3.5 min-w-0">
                      <div className="w-10 h-10 sm:w-12 sm:h-12 rounded-xl overflow-hidden bg-slate-900 border border-slate-700 shrink-0 shadow-sm group-hover/row:border-cyan-400 transition-colors">
                        <Image
                          src={getAvatarUrl(user)}
                          alt={user.name || "Thợ săn"}
                          width={48}
                          height={48}
                          className="w-full h-full object-cover"
                        />
                      </div>
                      <div className="min-w-0 space-y-0.5">
                        <h5 className="font-black text-white text-base sm:text-lg lg:text-xl truncate group-hover/row:text-cyan-300 transition-colors" title={user.name || undefined}>
                          {user.name}
                        </h5>
                        <p className="text-xs sm:text-base font-mono text-emerald-400 font-bold">
                          {completedTests} Quests hoàn thành
                        </p>
                      </div>
                    </div>
                  </td>

                  {/* Cấp độ Rank */}
                  <td className="py-4 px-5 text-center">
                    <span className={`inline-block text-xs sm:text-base lg:text-lg font-mono font-black px-4 py-1.5 rounded-full uppercase tracking-wider ${theme.badgeBg}`}>
                      RANK {user.provisionalRank}
                    </span>
                  </td>

                  {/* Power Score */}
                  <td className="py-4 px-5 text-center font-mono text-amber-300 text-base sm:text-lg lg:text-xl font-black">
                    <div className="inline-flex items-center gap-1.5 px-3.5 py-1.5 rounded-xl bg-amber-950/40 border border-amber-500/50 shadow-inner">
                      <span>{displayPowerText} PTS</span>
                    </div>
                  </td>

                  {/* Điểm TB */}
                  <td className="py-4 px-5 text-right font-mono font-black text-slate-200 text-base sm:text-xl lg:text-2xl">
                    {rawAverageScore.toFixed(2)}đ
                  </td>
                </tr>
              );
            })}
          </tbody>
        </table>
      </div>
    </section>
  );
}
