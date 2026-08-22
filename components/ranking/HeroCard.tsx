"use client";

import { RankingUser } from "@/actions/ranking";
import { calculateHunterLeaderboard } from "@/lib/ranking-engine";
import { ShieldAlert, Flame, TrendingUp, Zap, Sparkles, Award } from "lucide-react";
import Image from "next/image";

interface HeroCardProps {
  currentUser: RankingUser | null;
  leaderboard?: RankingUser[];
  studyClassName?: string | null;
  totalStudents: number;
}

export function HeroCard({
  currentUser,
  leaderboard,
  studyClassName,
  totalStudents,
}: HeroCardProps) {
  if (!currentUser) return null;

  const studentList = leaderboard && leaderboard.length > 0 ? leaderboard : [currentUser];
  const result = calculateHunterLeaderboard(studentList, totalStudents);
  const student = result.allStudents.find((s) => s.id === currentUser.id) || result.allStudents[0];

  if (!student) return null;

  const userName = currentUser.name || "Học sinh";
  const avatarUrl = currentUser.image || `https://ui-avatars.com/api/?name=${encodeURIComponent(userName)}&background=0D8ABC&color=fff`;

  const {
    isEligibleForLeaderboard,
    isProvisional,
    isZeroTests,
    provisionalRank,
    theme,
    rawAverageScore,
    bayesianSkill,
    confidencePercent,
    powerScore,
    displayPowerText,
    level,
    totalXp,
    xpPercent,
    completedTests,
    remainingTestsForConfirmation,
    streak,
    position,
    topPercent,
    displayTopText,
    movement,
  } = student;

  return (
    <div className="relative overflow-hidden rounded-none sm:rounded-2xl bg-[#0D121D]/90 backdrop-blur-xl border-y sm:border border-slate-800 text-white p-4 sm:p-6 shadow-2xl group w-full min-w-0 max-w-full space-y-4 sm:space-y-6">
      {/* Background Dungeon Gate AI Generated Artwork Image Banner */}
      <div
        className="absolute right-0 top-0 bottom-0 w-full sm:w-1/2 bg-cover bg-right opacity-75 pointer-events-none rounded-r-2xl"
        style={{ backgroundImage: "url('/dungeon-bg.png')" }}
      />
      <div className="absolute inset-0 bg-gradient-to-r from-[#0D121D] via-[#0D121D]/80 to-transparent pointer-events-none" />

      {/* Decorative Cyan Glow */}
      <div className="absolute right-0 top-0 bottom-0 w-1/2 sm:w-2/5 pointer-events-none opacity-40 sm:opacity-60 bg-[radial-gradient(ellipse_at_right,#0284c7_0%,#0369a1_30%,transparent_70%)]" />
      <div className="absolute -right-16 -top-16 w-80 h-80 bg-cyan-500/20 rounded-full blur-3xl pointer-events-none" />

      <div className="relative z-10 space-y-4 sm:space-y-5">
        {/* Top Header Row: HUNTER STATUS & RANK TIER BADGE */}
        <div className="flex items-center justify-between">
          <div className="flex items-center gap-2">
            <Zap className="w-5 h-5 text-amber-400 fill-amber-400 animate-pulse" />
            <h2 className="text-xs sm:text-base lg:text-lg font-black tracking-widest text-slate-100 uppercase">
              TRẠNG THÁI THỢ SĂN
            </h2>
          </div>

          <div className="flex items-center gap-2">
            {/* Level Badge */}
            <span className="text-xs sm:text-sm font-black px-3 py-1 rounded-full bg-cyan-950/90 border border-cyan-500/70 text-cyan-300 font-mono shadow-md flex items-center gap-1">
              <Award className="w-3.5 h-3.5 text-cyan-400" />
              <span>LEVEL {level}</span>
            </span>

            {/* Rank Badge */}
            <span className={`text-xs sm:text-sm lg:text-base font-black px-3.5 py-1.5 rounded-full uppercase tracking-wider shadow-md border ${theme.badgeBg}`}>
              {!isEligibleForLeaderboard
                ? `🔒 RANK ${provisionalRank} (CHƯA MỞ KHÓA)`
                : isProvisional
                  ? `🔐 RANK ${provisionalRank} (ĐANG XÁC NHẬN - ${completedTests}/15 BÀI)`
                  : `👑 RANK ${provisionalRank} (CHÍNH THỨC)`}
            </span>
          </div>
        </div>

        {/* User Profile Block & Primary Focal Point */}
        <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4">
          <div className="flex items-center gap-4">
            {/* User Avatar with Blue Glow Ring */}
            <div className="relative shrink-0">
              <div className="w-16 h-16 sm:w-20 sm:h-20 rounded-full overflow-hidden border-2 border-cyan-400 shadow-[0_0_20px_rgba(56,189,248,0.5)] bg-slate-900 ring-2 ring-cyan-500/30">
                <Image
                  src={avatarUrl}
                  alt={userName}
                  width={80}
                  height={80}
                  className="w-full h-full object-cover"
                />
              </div>
            </div>

            <div className="space-y-1">
              <h3 className="text-xl sm:text-2xl lg:text-3xl font-black text-white tracking-tight uppercase">
                {userName}
              </h3>
              <div className="flex items-center gap-2 text-xs sm:text-sm lg:text-base font-black font-mono flex-wrap">
                {position ? (
                  <span className="text-cyan-300">HẠNG #{position} / {totalStudents}</span>
                ) : (
                  <span className="text-slate-400 font-normal">Chưa vào Leaderboard</span>
                )}
                <span className="text-slate-500">•</span>
                <span className="text-amber-400 bg-amber-950/80 border border-amber-500/50 px-2 py-0.5 rounded-md">
                  {displayTopText}
                </span>
                {movement.delta !== 0 && (
                  <span className={`px-2 py-0.5 rounded-md text-xs font-bold ${movement.delta > 0 ? "bg-emerald-950/80 border border-emerald-500/50 text-emerald-400" : "bg-rose-950/80 border border-rose-500/50 text-rose-400"}`}>
                    {movement.displayDeltaText}
                  </span>
                )}
              </div>
            </div>
          </div>

          {/* Power Score Badge (RPG Focal Feature) */}
          <div className="bg-[#080B12]/95 border-2 border-amber-500/80 p-3 sm:p-4 rounded-2xl shadow-[0_0_20px_rgba(245,158,11,0.25)] flex flex-col items-center sm:items-end justify-center shrink-0 self-start sm:self-auto min-w-[140px]">
            <span className="text-[10px] sm:text-xs font-mono font-black text-amber-400 uppercase tracking-widest block">
              POWER SCORE
            </span>
            <span className="text-2xl sm:text-3xl lg:text-4xl font-mono font-black text-amber-300 drop-shadow-[0_0_10px_rgba(245,158,11,0.5)]">
              {displayPowerText} <span className="text-xs sm:text-sm font-normal text-amber-500">PTS</span>
            </span>
            <span className="text-[10px] font-mono text-slate-400 mt-0.5">
              Độ tin cậy: {confidencePercent}%
            </span>
          </div>
        </div>

        {/* Quick Stat Summary Grid */}
        <div className="grid grid-cols-2 sm:grid-cols-4 gap-2.5 sm:gap-3.5 pt-1">
          {/* Stat 1: Hạng Trong Lớp */}
          <div className="bg-[#080B12]/90 border border-slate-800 p-3 rounded-xl space-y-1 shadow-sm">
            <span className="text-[11px] sm:text-xs font-mono text-slate-400 uppercase block font-bold">VỊ THẾ LỚP HỌC</span>
            <div className="text-base sm:text-lg lg:text-xl font-mono font-black text-cyan-300">
              {position ? `#${position}` : '—'} <span className="text-xs text-slate-500 font-normal">/ {totalStudents}</span>
            </div>
          </div>

          {/* Stat 2: Điểm Trung Bình */}
          <div className="bg-[#080B12]/90 border border-slate-800 p-3 rounded-xl space-y-1 shadow-sm">
            <span className="text-[11px] sm:text-xs font-mono text-slate-400 uppercase block font-bold">ĐIỂM TRUNG BÌNH</span>
            <div className="text-base sm:text-lg lg:text-xl font-mono font-black text-amber-300">
              {rawAverageScore.toFixed(2)}đ
            </div>
          </div>

          {/* Stat 3: Bài Thi Hoàn Thành */}
          <div className="bg-[#080B12]/90 border border-slate-800 p-3 rounded-xl space-y-1 shadow-sm">
            <span className="text-[11px] sm:text-xs font-mono text-slate-400 uppercase block font-bold">NHIỆM VỤ HOÀN THÀNH</span>
            <div className="text-base sm:text-lg lg:text-xl font-mono font-black text-emerald-400">
              {completedTests} Quests
            </div>
          </div>

          {/* Stat 4: Tiến Bộ Tuần */}
          <div className="bg-[#080B12]/90 border border-slate-800 p-3 rounded-xl space-y-1 shadow-sm">
            <span className="text-[11px] sm:text-xs font-mono text-slate-400 uppercase block font-bold">TỔNG XP CHÍNH THỨC</span>
            <div className="text-base sm:text-lg lg:text-xl font-mono font-black text-cyan-300 flex items-center gap-1">
              <Sparkles className="w-4 h-4 text-cyan-400 shrink-0" />
              <span>{totalXp.toLocaleString()} XP</span>
            </div>
          </div>
        </div>

        {/* Progress Bars Row: LEVEL & XP PROGRESS + MICRO-GOAL */}
        <div className="grid grid-cols-1 md:grid-cols-2 gap-4 pt-1">
          {/* Level & XP Progression Bar */}
          <div className="space-y-2 bg-[#080B12] border border-slate-800 p-4 rounded-xl backdrop-blur-md">
            <div className="flex items-center justify-between text-xs sm:text-sm lg:text-base font-black">
              <span className="text-slate-200 uppercase tracking-wider flex items-center gap-1.5">
                <Award className="w-4 h-4 text-cyan-400" />
                <span>TIẾN TRÌNH LEVEL {level}</span>
              </span>
              <span className="text-cyan-400 font-mono font-extrabold">{totalXp.toLocaleString()} XP</span>
            </div>
            {/* XP Bar */}
            <div className="w-full bg-slate-950 rounded-full h-3 p-0.5 border border-slate-800 overflow-hidden">
              <div
                className="bg-gradient-to-r from-cyan-500 to-blue-500 h-full rounded-full transition-all duration-700 shadow-[0_0_8px_rgba(56,189,248,0.6)]"
                style={{ width: `${xpPercent}%` }}
              />
            </div>
            <div className="text-right text-xs font-mono text-cyan-300 font-bold">
              {xpPercent}% KINH NGHIỆM LÊN LEVEL {level + 1}
            </div>
          </div>

          {/* Micro-Goal Progress Bar: Pass Next Student Position */}
          <div className="space-y-2 bg-[#080B12] border border-slate-800 p-4 rounded-xl backdrop-blur-md">
            <div className="flex items-center justify-between text-xs sm:text-sm lg:text-base font-black">
              <span className="text-slate-200 uppercase tracking-wider">
                {position && position > 1 ? `MỤC TIÊU LEO HẠNG #${position - 1}` : `TOP 1 TOÀN KHÓA`}
              </span>
              <span className="text-cyan-400 font-mono font-extrabold">
                {position && position > 1 ? `Cần +0.2đ để vượt Hạng #${position - 1}` : `Đang giữ Ngai Vàng`}
              </span>
            </div>
            {/* Smooth Neon Amber Bar */}
            <div className="w-full bg-slate-950 rounded-full h-3 p-0.5 border border-slate-800 overflow-hidden">
              <div
                className="bg-gradient-to-r from-amber-500 to-orange-500 h-full rounded-full transition-all duration-700 shadow-[0_0_8px_rgba(245,158,11,0.6)]"
                style={{ width: `${!position || position === 1 ? 100 : Math.min(95, Math.max(15, Math.round((rawAverageScore / (rawAverageScore + 0.2)) * 100)))}%` }}
              />
            </div>
            <div className="flex items-center justify-between text-xs font-mono text-amber-300 font-bold">
              <span>Đang có {rawAverageScore.toFixed(2)}đ</span>
              <span>{position && position > 1 ? `Hạng #${position - 1}: ${(rawAverageScore + 0.2).toFixed(2)}đ` : `Bảo vệ Ngai Vàng`}</span>
            </div>
          </div>
        </div>

        {/* Bottom Row: Streak Tag & Provisional Info Warning */}
        <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-2 text-xs sm:text-sm lg:text-base pt-2 border-t border-slate-800 text-slate-200">
          <div className="flex items-center gap-2 text-amber-400 font-black">
            <Flame className="w-5 h-5 text-orange-500 fill-orange-500 animate-bounce" />
            <span>CHUỖI {streak} NGÀY CHINH PHỤC QUEST</span>
          </div>

          {isProvisional && (
            <div className="flex items-center gap-1.5 text-amber-400 font-bold text-xs sm:text-sm bg-amber-950/60 border border-amber-500/50 px-3 py-1 rounded-full">
              <ShieldAlert className="w-4 h-4 text-amber-400 shrink-0" />
              <span>
                {!isEligibleForLeaderboard
                  ? `Cần hoàn thành thêm ${Math.max(0, 5 - completedTests)} bài thi để vào Leaderboard`
                  : `🔒 Rank Provisional (${confidencePercent}% Confidence) · Cần thêm ${remainingTestsForConfirmation} bài để xác nhận Rank`}
              </span>
            </div>
          )}
        </div>
      </div>
    </div>
  );
}
