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
    // Không lặng lẽ thay bằng bảng toàn khoá khi tuần/tháng chưa có ai — hiện thông báo trống thay vào đó
    if (period === "WEEKLY") return weeklyLeaderboard ?? [];
    if (period === "MONTHLY") return monthlyLeaderboard ?? [];
    return leaderboard;
  }, [period, leaderboard, weeklyLeaderboard, monthlyLeaderboard]);

  const totalCount = totalStudentsInClass || Math.max(1, activeRawList.length);

  // Process through ranking engine
  const engineResult = calculateHunterLeaderboard(activeRawList, totalCount);
  const eligibleLeaderboard = engineResult.leaderboard.slice(0, 15);

  const top1 = eligibleLeaderboard[0];
  const top2 = eligibleLeaderboard[1];
  const top3 = eligibleLeaderboard[2];

  // Đủ 3 người mới dựng bục vinh danh; ít hơn thì đưa hết vào bảng (trước đây 1–2 người đầu bị mất)
  const hasPodium = Boolean(top1 && top2 && top3);
  const tableList = hasPodium ? eligibleLeaderboard.slice(3, 15) : eligibleLeaderboard;

  const getAvatarUrl = (u: any) => {
    if (!u) return "";
    return getSafeAvatarUrl(u.name, u.image);
  };

  return (
    <section className="rounded-none sm:rounded-3xl border-y sm:border border-slate-200 bg-white shadow-[0_4px_0_0_#e3ecff] text-slate-900 overflow-hidden space-y-4 sm:space-y-6 p-3.5 sm:p-6 lg:p-8 relative group w-full min-w-0 max-w-full">

      {/* Header Row: BANG HỘI THỢ SĂN · TOP 15 + TIMEFRAME TABS */}
      <div className="flex flex-col md:flex-row md:items-center justify-between border-b border-slate-200 pb-3 sm:pb-4 gap-3 relative z-10 w-full min-w-0">
        <div className="flex items-center gap-3 min-w-0">
          <div className="p-2 sm:p-2.5 rounded-xl bg-blue-50 border border-blue-200 shrink-0">
            <Swords className="w-5 h-5 sm:w-6 sm:h-6 text-blue-700" />
          </div>
          <div className="min-w-0">
            <h3 className="font-black text-xs sm:text-lg lg:text-xl tracking-widest text-slate-900 uppercase">
              TOP 15 LEADERBOARD
            </h3>
            <p className="text-[10px] sm:text-xs lg:text-sm text-slate-500 tabular-nums">
              {period === "ALL_TIME" ? "Xếp hạng tích lũy toàn khóa" : period === "WEEKLY" ? "Xếp hạng bứt phá trong tuần" : "Xếp hạng phong độ trong tháng"}
            </p>
          </div>
        </div>

        {/* TIMEFRAME TABS (TOÀN KHÓA / TUẦN NÀY / THÁNG NÀY) */}
        <div className="flex items-center gap-1.5 p-1 rounded-2xl bg-slate-50 border border-slate-200 shrink-0 self-start md:self-auto shadow-inner">
          <button
            onClick={() => setPeriod("ALL_TIME")}
            className={`px-3 sm:px-4 py-1.5 rounded-xl text-xs sm:text-base font-black transition-all flex items-center gap-1.5 ${period === "ALL_TIME"
              ? "bg-blue-600 text-white shadow-[0_3px_0_0_#1e3a8a]"
              : "text-slate-500 hover:text-slate-800 hover:bg-slate-50"
              }`}
          >
            <Globe className="w-3.5 h-3.5 sm:w-4 sm:h-4" />
            <span>TOÀN KHÓA</span>
          </button>
          <button
            onClick={() => setPeriod("WEEKLY")}
            className={`px-3 sm:px-4 py-1.5 rounded-xl text-xs sm:text-base font-black transition-all flex items-center gap-1.5 ${period === "WEEKLY"
              ? "bg-amber-400 text-amber-950 shadow-[0_3px_0_0_#d97706]"
              : "text-slate-500 hover:text-slate-800 hover:bg-slate-50"
              }`}
          >
            <ZapIcon className="w-3.5 h-3.5 sm:w-4 sm:h-4" />
            <span>TUẦN NÀY</span>
          </button>
          <button
            onClick={() => setPeriod("MONTHLY")}
            className={`px-3 sm:px-4 py-1.5 rounded-xl text-xs sm:text-base font-black transition-all flex items-center gap-1.5 ${period === "MONTHLY"
              ? "bg-emerald-600 text-white shadow-[0_3px_0_0_#064e3b]"
              : "text-slate-500 hover:text-slate-800 hover:bg-slate-50"
              }`}
          >
            <Calendar className="w-3.5 h-3.5 sm:w-4 sm:h-4" />
            <span>THÁNG NÀY</span>
          </button>
        </div>
      </div>

      {/* Visual Monarch RPG Podium for Top 3 (Order: Top 2 - Top 1 - Top 3) */}
      {eligibleLeaderboard.length === 0 && (
        <div className="relative z-10 rounded-2xl border border-dashed border-slate-200 bg-slate-50 px-4 py-10 text-center">
          <p className="text-sm sm:text-base font-black text-slate-800">
            {period === "WEEKLY" ? "Tuần này" : period === "MONTHLY" ? "Tháng này" : "Hiện"} chưa có thợ săn nào lên bảng
          </p>
          <p className="mt-1 text-xs sm:text-sm text-slate-500">
            {period === "ALL_TIME" ? "Hoàn thành bài kiểm tra để xuất hiện trên bảng xếp hạng." : "Hoàn thành bài trong kỳ này để là người mở màn!"}
          </p>
        </div>
      )}

      {hasPodium && (
        <div className="pt-2 sm:pt-4 pb-4 sm:pb-6 relative z-10 w-full min-w-0">
          <div className="grid grid-cols-3 gap-2 sm:gap-6 lg:gap-8 items-end max-w-3xl mx-auto w-full min-w-0">
            {/* Rank 2 (Silver Monarch Warden - Left) */}
            <div className="flex flex-col items-center text-center space-y-2 order-1 group/p2 min-w-0 w-full">
              {/* Avatar + Silver Glow Ring */}
              <div className="relative">
                <div className="w-6 h-6 sm:w-8 sm:h-8 rounded-full bg-gradient-to-r from-slate-200 to-slate-400 text-slate-950 font-black text-xs sm:text-sm flex items-center justify-center mx-auto mb-1 border-2 border-white z-10 relative">
                  2
                </div>
                <div className="relative w-fit mx-auto">
                  <div className="w-14 h-14 sm:w-24 sm:h-24 lg:w-28 lg:h-28 rounded-2xl overflow-hidden border-2 border-slate-300 bg-slate-50 ring-4 ring-slate-200 mx-auto transition-transform duration-300 group-hover/p2:scale-105">
                  <Image
                    src={getAvatarUrl(top2)}
                    alt={top2.name || "Top 2"}
                    width={112}
                    height={112}
                    className="w-full h-full object-cover"
                  />
                  </div>
                </div>
              </div>

              {/* Steel-Silver Metallic Pedestal Card */}
              <div className="relative w-full bg-gradient-to-b from-slate-200 via-slate-100 to-white border-2 border-slate-300 rounded-2xl p-2 sm:p-4 text-center shadow-xl space-y-1.5 min-w-0 flex flex-col justify-between backdrop-blur-md">
                <div className="space-y-0.5">
                  <span className="text-[9px] sm:text-xs tabular-nums font-bold text-slate-600 uppercase tracking-wider block">
                    VƯƠNG GIẢ HẠNG 2
                  </span>
                  <h4 className="font-black text-xs sm:text-base lg:text-lg text-slate-900 leading-tight break-words line-clamp-2">
                    {top2.name}
                  </h4>
                </div>

                <div className="space-y-1 pt-1">
                  {/* Power Score Badge */}
                  <div className="inline-flex items-center justify-center gap-1 px-2 py-1 rounded-xl bg-slate-50 border border-slate-300 text-[10px] sm:text-xs tabular-nums font-black text-slate-800 w-full shadow-inner">
                    <Zap className="w-3 h-3 text-blue-700 shrink-0" />
                    <span>{top2.displayPowerText} PTS</span>
                  </div>
                  {/* Micro stats */}
                  <p className="text-[9px] sm:text-xs tabular-nums text-slate-500 font-bold">
                    {top2.completedTests} Quests · {top2.rawAverageScore.toFixed(2)}đ
                  </p>
                </div>
              </div>
            </div>

            {/* Rank 1 (The Gold Sovereign Monarch - Center - Tallest Throne Pedestal) */}
            <div className="flex flex-col items-center text-center space-y-2 order-2 -mt-4 sm:-mt-8 group/p1 min-w-0 w-full z-20">
              {/* Avatar + Floating Gold Crown + Monarch Aura Ring */}
              <div className="relative">
                <Crown className="w-6 h-6 sm:w-10 sm:h-10 text-amber-700 fill-amber-400 absolute -top-5 sm:-top-9 left-1/2 -translate-x-1/2 drop-shadow-[0_0_15px_rgba(245,158,11,1)] animate-bounce" />
                <div className="w-7 h-7 sm:w-9 sm:h-9 rounded-full bg-gradient-to-r from-amber-300 via-amber-400 to-yellow-500 text-slate-950 font-black text-xs sm:text-base flex items-center justify-center mx-auto mb-1 border-2 border-white ring-4 ring-amber-200 z-10 relative">
                  1
                </div>
                <div className="relative w-fit mx-auto">
                  <div className="w-18 h-18 sm:w-28 sm:h-28 lg:w-32 lg:h-32 rounded-2xl overflow-hidden border-2 border-amber-200 bg-slate-50 ring-4 ring-amber-200 mx-auto transition-transform duration-300 group-hover/p1:scale-105">
                  <Image
                    src={getAvatarUrl(top1)}
                    alt={top1.name || "Top 1"}
                    width={128}
                    height={128}
                    className="w-full h-full object-cover"
                  />
                  </div>
                </div>
              </div>

              {/* Monarch Gold Metallic Pedestal Card */}
              <div className="relative w-full bg-gradient-to-b from-amber-100 via-amber-50 to-white border-2 border-amber-200 rounded-2xl p-2.5 sm:p-5 text-center shadow-[0_4px_0_0_#e3ecff] space-y-1.5 min-w-0 flex flex-col justify-between backdrop-blur-md">
                <div className="space-y-0.5">
                  <span className="text-[9px] sm:text-xs tabular-nums font-black text-amber-700 uppercase tracking-widest block flex items-center justify-center gap-1">
                    <Trophy className="w-3.5 h-3.5 text-amber-700 fill-amber-400" />
                    <span>CHÚA TỂ BANG HỘI</span>
                  </span>
                  <h4 className="font-black text-xs sm:text-lg lg:text-xl text-amber-700 leading-tight break-words line-clamp-2">
                    {top1.name}
                  </h4>
                </div>

                <div className="space-y-1 pt-1">
                  {/* Power Score Badge */}
                  <div className="inline-flex items-center justify-center gap-1 px-2.5 py-1 sm:py-1.5 rounded-xl bg-amber-50 border border-amber-200 text-xs sm:text-sm tabular-nums font-black text-amber-700 w-full ">
                    <Zap className="w-3.5 h-3.5 text-amber-700 fill-amber-400 shrink-0 animate-pulse" />
                    <span>{top1.displayPowerText} PTS</span>
                  </div>
                  {/* Micro stats */}
                  <p className="text-[9px] sm:text-xs tabular-nums text-amber-700 font-bold">
                    {top1.completedTests} Quests · {top1.rawAverageScore.toFixed(2)}đ
                  </p>
                </div>
              </div>
            </div>

            {/* Rank 3 (Bronze Monarch Vanguard - Right) */}
            <div className="flex flex-col items-center text-center space-y-2 order-3 group/p3 min-w-0 w-full">
              {/* Avatar + Bronze Glow Ring */}
              <div className="relative">
                <div className="w-6 h-6 sm:w-8 sm:h-8 rounded-full bg-gradient-to-r from-amber-600 to-amber-800 text-amber-100 font-black text-xs sm:text-sm flex items-center justify-center mx-auto mb-1 border-2 border-amber-200 z-10 relative">
                  3
                </div>
                <div className="relative w-fit mx-auto">
                  <div className="w-14 h-14 sm:w-24 sm:h-24 lg:w-28 lg:h-28 rounded-2xl overflow-hidden border-2 border-amber-200 bg-slate-50 ring-4 ring-amber-200 mx-auto transition-transform duration-300 group-hover/p3:scale-105">
                  <Image
                    src={getAvatarUrl(top3)}
                    alt={top3.name || "Top 3"}
                    width={112}
                    height={112}
                    className="w-full h-full object-cover"
                  />
                  </div>
                </div>
              </div>

              {/* Bronze Metallic Pedestal Card */}
              <div className="relative w-full bg-gradient-to-b from-orange-100 via-orange-50 to-white border-2 border-amber-200 rounded-2xl p-2 sm:p-4 text-center shadow-xl space-y-1.5 min-w-0 flex flex-col justify-between backdrop-blur-md">
                <div className="space-y-0.5">
                  <span className="text-[9px] sm:text-xs tabular-nums font-bold text-amber-700 uppercase tracking-wider block">
                    VƯƠNG GIẢ HẠNG 3
                  </span>
                  <h4 className="font-black text-xs sm:text-base lg:text-lg text-slate-900 leading-tight break-words line-clamp-2">
                    {top3.name}
                  </h4>
                </div>

                <div className="space-y-1 pt-1">
                  {/* Power Score Badge */}
                  <div className="inline-flex items-center justify-center gap-1 px-2 py-1 rounded-xl bg-amber-50 border border-amber-200 text-[10px] sm:text-xs tabular-nums font-black text-amber-700 w-full shadow-inner">
                    <Zap className="w-3 h-3 text-amber-500 shrink-0" />
                    <span>{top3.displayPowerText} PTS</span>
                  </div>
                  {/* Micro stats */}
                  <p className="text-[9px] sm:text-xs tabular-nums text-amber-700 font-bold">
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
              className="p-3 rounded-2xl bg-slate-50 border border-slate-200 text-slate-800 shadow-md space-y-2 min-w-0 hover:bg-slate-50 transition-colors"
            >
              {/* Card Header Row: Rank #, Rank Badge, Movement */}
              <div className="flex items-center justify-between border-b border-slate-200 pb-2">
                <div className="flex items-center gap-2">
                  <span className="tabular-nums font-black text-xs text-slate-600">
                    #{String(rankPos).padStart(2, "0")}
                  </span>
                  <span className={`text-[10px] tabular-nums font-black px-2.5 py-0.5 rounded-full uppercase tracking-wider ${theme.badgeBg}`}>
                    RANK {user.provisionalRank}
                  </span>
                </div>

                {/* Rank Movement Tag */}
                <div className="flex items-center gap-1">
                  {movement.direction === "up" && (
                    <span className="whitespace-nowrap inline-flex items-center gap-1 px-2.5 py-0.5 rounded-full bg-emerald-50 border border-emerald-200 text-emerald-700 text-[10px] tabular-nums font-black ">
                      <TrendingUp className="w-3 h-3 text-emerald-700 shrink-0" />
                      <span>+{Math.abs(movement.delta || 0)}</span>
                    </span>
                  )}
                  {movement.direction === "down" && (
                    <span className="whitespace-nowrap inline-flex items-center gap-1 px-2.5 py-0.5 rounded-full bg-rose-50 border border-rose-200 text-rose-600 text-[10px] tabular-nums font-black ">
                      <TrendingDown className="w-3 h-3 text-rose-600 shrink-0" />
                      <span>-{Math.abs(movement.delta || 0)}</span>
                    </span>
                  )}
                  {movement.direction === "same" && (
                    <span className="whitespace-nowrap inline-flex items-center justify-center px-2 py-0.5 rounded-full bg-slate-100 border border-slate-200 text-slate-500 text-[10px] tabular-nums font-bold">
                      <Minus className="w-3 h-3 text-slate-500" />
                    </span>
                  )}
                  {movement.direction === "new" && (
                    <span className="whitespace-nowrap inline-flex items-center px-2 py-0.5 rounded-full border border-slate-200 text-slate-500 text-[10px] tabular-nums font-black" title="Chưa có dữ liệu tuần trước để so sánh">
                      —
                    </span>
                  )}
                </div>
              </div>

              {/* Card Body: Avatar, Name & Power Score */}
              <div className="flex items-center justify-between gap-3">
                <div className="flex items-center gap-2.5 min-w-0 flex-1">
                  <div className="w-9 h-9 rounded-xl overflow-hidden bg-slate-50 border border-slate-200 shrink-0">
                    <Image
                      src={getAvatarUrl(user)}
                      alt={user.name || "Thợ săn"}
                      width={36}
                      height={36}
                      className="w-full h-full object-cover"
                    />
                  </div>
                  <div className="min-w-0 space-y-0.5">
                    <h5 className="font-black text-slate-900 text-xs leading-snug break-words">
                      {user.name}
                    </h5>
                    {user.isProvisional ? (
                      <span className="text-[10px] tabular-nums text-amber-700 font-bold block" title={`Cần ${minRequiredTests} bài để được xếp hạng chính thức`}>
                        Tạm tính · {completedTests}/{minRequiredTests} bài
                      </span>
                    ) : (
                      <span className="text-[10px] tabular-nums text-emerald-700 font-bold block">
                        {completedTests} Quests hoàn thành
                      </span>
                    )}
                  </div>
                </div>

                {/* Power Score */}
                <div className="flex flex-col items-end shrink-0">
                  <span className="text-[9px] tabular-nums text-slate-500 uppercase font-bold">POWER</span>
                  <span className="tabular-nums font-black text-amber-700 text-sm">
                    {displayPowerText} PTS
                  </span>
                </div>
              </div>

              {/* Dynamic Rank Supremacy Progress Bar */}
              <div className="w-full bg-slate-50 rounded-full h-2 border border-slate-200 overflow-hidden">
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
              <div className="flex items-center justify-between text-[10px] tabular-nums font-bold text-slate-500 pt-0.5">
                <span>Top {Math.max(1, Math.round((rankPos / totalCount) * 100))}% lớp</span>
                <span className="text-slate-600 font-black">Điểm TB: {rawAverageScore.toFixed(2)}đ</span>
              </div>
            </div>
          );
        })}
      </div>

      {/* DESKTOP TABLE (hidden sm:block) - Transparent Glassmorphic Grid */}
      <div className="hidden sm:block overflow-x-auto w-full rounded-2xl border border-slate-200 bg-slate-50 backdrop-blur-md relative z-10 shadow-xl min-w-0">
        <table className="w-full text-left text-base text-slate-600 font-medium border-collapse">
          <thead className="bg-slate-100/70 text-slate-500 uppercase tracking-wider font-black text-xs sm:text-sm whitespace-nowrap border-b border-slate-200">
            <tr>
              <th className="py-4 px-5 text-center w-24">HẠNG</th>
              <th className="py-4 px-5 text-center w-24">BIẾN ĐỘNG</th>
              <th className="py-4 px-5">THỢ SĂN</th>
              <th className="py-4 px-5 text-center">CẤP ĐỘ RANK</th>
              <th className="py-4 px-5 text-center">POWER SCORE</th>
              <th className="py-4 px-5 text-right">ĐIỂM TB</th>
            </tr>
          </thead>
          <tbody className="divide-y divide-slate-100 font-medium">
            {tableList.map((user) => {
              const rankPos = user.position || 4;
              const { theme, movement, displayPowerText, rawAverageScore, completedTests } = user;

              return (
                <tr
                  key={user.id}
                  className="border-l-4 border-l-transparent hover:border-l-cyan-400 hover:bg-blue-50 transition-colors duration-150 group/row"
                >
                  {/* Position */}
                  <td className="py-4 px-5 text-center font-black tabular-nums">
                    <span className="inline-flex items-center justify-center w-10 h-10 sm:w-11 sm:h-11 rounded-xl bg-slate-50 border border-slate-200 text-slate-600 text-base sm:text-lg font-black group-hover/row:border-cyan-500/50 group-hover/row:text-cyan-400 transition-colors">
                      #{String(rankPos).padStart(2, "0")}
                    </span>
                  </td>

                  {/* Rank Movement */}
                  <td className="py-4 px-5 text-center tabular-nums font-black text-xs sm:text-base">
                    {movement.direction === "up" && (
                      <span className="whitespace-nowrap inline-flex items-center gap-1.5 px-3 py-1 rounded-full bg-emerald-50 border border-emerald-200 text-emerald-700 text-xs sm:text-sm font-black ">
                        <TrendingUp className="w-3.5 h-3.5 text-emerald-700 shrink-0" />
                        <span>+{Math.abs(movement.delta || 0)}</span>
                      </span>
                    )}
                    {movement.direction === "down" && (
                      <span className="whitespace-nowrap inline-flex items-center gap-1.5 px-3 py-1 rounded-full bg-rose-50 border border-rose-200 text-rose-600 text-xs sm:text-sm font-black ">
                        <TrendingDown className="w-3.5 h-3.5 text-rose-600 shrink-0" />
                        <span>-{Math.abs(movement.delta || 0)}</span>
                      </span>
                    )}
                    {movement.direction === "same" && (
                      <span className="whitespace-nowrap inline-flex items-center justify-center w-7 h-7 rounded-full bg-slate-100 border border-slate-200 text-slate-500 text-xs font-bold mx-auto">
                        <Minus className="w-3.5 h-3.5 text-slate-500" />
                      </span>
                    )}
                    {movement.direction === "new" && (
                      <span className="whitespace-nowrap inline-flex items-center px-3 py-1 rounded-full border border-slate-200 text-slate-500 text-xs font-black" title="Chưa có dữ liệu tuần trước để so sánh">
                        —
                      </span>
                    )}
                  </td>

                  {/* Name + Avatar */}
                  <td className="py-4 px-5">
                    <div className="flex items-center gap-3.5 min-w-0">
                      <div className="w-10 h-10 sm:w-12 sm:h-12 rounded-xl overflow-hidden bg-slate-50 border border-slate-200 shrink-0 shadow-sm group-hover/row:border-cyan-400 transition-colors">
                        <Image
                          src={getAvatarUrl(user)}
                          alt={user.name || "Thợ săn"}
                          width={48}
                          height={48}
                          className="w-full h-full object-cover"
                        />
                      </div>
                      <div className="min-w-0 space-y-0.5">
                        <h5 className="font-black text-slate-900 text-base sm:text-lg lg:text-xl truncate group-hover/row:text-blue-700 transition-colors" title={user.name || undefined}>
                          {user.name}
                        </h5>
                        {user.isProvisional ? (
                          <p className="text-xs sm:text-sm tabular-nums text-amber-700 font-bold" title={`Cần ${minRequiredTests} bài để được xếp hạng chính thức`}>
                            Tạm tính · {completedTests}/{minRequiredTests} bài
                          </p>
                        ) : (
                          <p className="text-xs sm:text-base tabular-nums text-emerald-700 font-bold">
                            {completedTests} Quests hoàn thành
                          </p>
                        )}
                      </div>
                    </div>
                  </td>

                  {/* Cấp độ Rank */}
                  <td className="py-4 px-5 text-center">
                    <span className={`inline-block whitespace-nowrap text-xs sm:text-sm lg:text-base tabular-nums font-black px-3 py-1 rounded-full uppercase tracking-wider ${theme.badgeBg}`}>
                      RANK {user.provisionalRank}
                    </span>
                  </td>

                  {/* Power Score */}
                  <td className="py-4 px-5 text-center tabular-nums text-amber-700 text-base sm:text-lg lg:text-xl font-black">
                    <div className="inline-flex items-center gap-1.5 px-3.5 py-1.5 rounded-xl bg-amber-50 border border-amber-200 whitespace-nowrap">
                      <span>{displayPowerText} PTS</span>
                    </div>
                  </td>

                  {/* Điểm TB */}
                  <td className="py-4 px-5 text-right tabular-nums font-black text-slate-800 text-base sm:text-xl lg:text-2xl">
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
