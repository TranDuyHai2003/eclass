"use client";

import { RankingUser } from "@/actions/ranking";
import { calculateHunterLeaderboard } from "@/lib/ranking-engine";
import { RANK_THEMES, getSafeAvatarUrl } from "@/lib/game-rank";
import { Flame, ShieldAlert, Zap } from "lucide-react";
import Image from "next/image";

interface HeroCardProps {
  currentUser: RankingUser | null;
  leaderboard?: RankingUser[];
  studyClassName?: string | null;
  totalStudents: number;
}

export function HeroCard({
  currentUser,
  leaderboard = [],
  studyClassName,
  totalStudents,
}: HeroCardProps) {
  if (!currentUser) return null;

  const studentList = leaderboard.length > 0 ? leaderboard : [currentUser];
  const result = calculateHunterLeaderboard(studentList, totalStudents);
  const student = result.allStudents.find((s) => s.id === currentUser.id) || result.allStudents[0];

  if (!student) return null;

  const userName = currentUser.name || "Học sinh";
  const avatarUrl = getSafeAvatarUrl(userName, currentUser.image);

  const {
    isZeroTests,
    provisionalRank,
    theme,
    rawAverageScore,
    powerScore,
    displayPowerText,
    completedTests,
    streak,
    position,
    topPercent,
    displayTopText,
    movement,
  } = student;

  // Calculate dynamic gap to next rank
  let gapScoreNeeded: number | null = null;
  let prevStudentName: string | null = null;
  if (position && position > 1 && leaderboard.length > 0) {
    const prevStudent = leaderboard.find((s) => s.rank === position - 1);
    if (prevStudent) {
      const prevPower = prevStudent.rankingScore ?? (prevStudent.avgScore * 10 + prevStudent.completedTests * 1 + (prevStudent.streak || 0) * 0.5);
      const myPower = currentUser.rankingScore ?? (currentUser.avgScore * 10 + currentUser.completedTests * 1 + (currentUser.streak || 0) * 0.5);
      gapScoreNeeded = parseFloat(Math.max(0.1, prevPower - myPower).toFixed(1));
      prevStudentName = prevStudent.name || `Hạng #${position - 1}`;
    }
  }

  return (
    <div className="relative overflow-hidden rounded-2xl bg-[#0D121D]/90 backdrop-blur-xl border border-slate-800 text-white p-3.5 sm:p-6 shadow-2xl group w-full min-w-0 max-w-full space-y-4 sm:space-y-6">
      {/* Background Dungeon Gate AI Generated Artwork Image Banner */}
      <div
        className="absolute right-0 top-0 bottom-0 w-full sm:w-1/2 bg-cover bg-right opacity-75 pointer-events-none rounded-r-2xl"
        style={{ backgroundImage: "url('/dungeon-bg.webp')" }}
      />
      <div className="absolute inset-0 bg-gradient-to-r from-[#0D121D] via-[#0D121D]/80 to-transparent pointer-events-none" />

      {/* Decorative Cyan Glow */}
      <div className="absolute right-0 top-0 bottom-0 w-1/2 sm:w-2/5 pointer-events-none opacity-40 sm:opacity-60 bg-[radial-gradient(ellipse_at_right,#0284c7_0%,#0369a1_30%,transparent_70%)]" />
      <div className="absolute -right-16 -top-16 w-80 h-80 bg-cyan-500/20 rounded-full blur-3xl pointer-events-none" />

      <div className="relative z-10 space-y-4 sm:space-y-5">
        {/* Top Header Row: HUNTER STATUS & RANK TIER BADGE */}
        <div className="flex items-center justify-between gap-2 flex-wrap">
          <div className="flex items-center gap-2 min-w-0">
            <Zap className="w-4 h-4 sm:w-5 sm:h-5 text-amber-400 fill-amber-400 animate-pulse shrink-0" />
            <h2 className="text-xs sm:text-base lg:text-lg font-black tracking-widest text-slate-100 uppercase truncate">
              TRẠNG THÁI THỢ SĂN
            </h2>
          </div>

          <div className="flex items-center gap-2">
            {/* Rank Badge */}
            <span className={`text-[11px] sm:text-sm font-black px-3 py-1 rounded-full uppercase tracking-wider shadow-md border ${completedTests === 0 || provisionalRank === 'DANGER' ? RANK_THEMES.DANGER.badgeBg : theme.badgeBg}`}>
              {completedTests === 0 || provisionalRank === 'DANGER' ? '🚨 RANK BÁO ĐỘNG' : `👑 RANK ${provisionalRank}`}
            </span>
          </div>
        </div>

        {/* ALERT BANNER FOR ZERO TESTS / DANGER TIER */}
        {(completedTests === 0 || provisionalRank === 'DANGER') && (
          <div className="bg-red-950/80 border-2 border-red-500/80 p-3 sm:p-4 rounded-xl text-red-200 flex items-center gap-3 animate-pulse shadow-[0_0_20px_rgba(239,68,68,0.4)] relative z-10">
            <ShieldAlert className="w-5 h-5 sm:w-6 sm:h-6 text-red-400 shrink-0" />
            <div>
              <strong className="block text-red-300 uppercase font-black text-xs sm:text-base tracking-wider">
                🚨 CẢNH BÁO BÁO ĐỘNG: CHƯA NỘP BÀI THI NÀO!
              </strong>
              <span className="text-xs sm:text-sm font-bold text-red-200">
                Bạn đang thuộc Tier Báo Động do chưa làm bài kiểm tra nào. Hãy hoàn thành ít nhất 1 bài để thoát Tier Báo Động và khôi phục Rank!
              </span>
            </div>
          </div>
        )}

        {/* User Profile Block & Primary Focal Point */}
        <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4">
          <div className="flex items-center gap-3 sm:gap-4 min-w-0">
            {/* User Avatar with Blue Glow Ring */}
            <div className="relative shrink-0">
              <div className="w-14 h-14 sm:w-20 sm:h-20 rounded-full overflow-hidden border-2 border-cyan-400 shadow-[0_0_20px_rgba(56,189,248,0.5)] bg-slate-900 ring-2 ring-cyan-500/30">
                <Image
                  src={avatarUrl}
                  alt={userName}
                  width={80}
                  height={80}
                  className="w-full h-full object-cover"
                />
              </div>
            </div>

            <div className="space-y-1 min-w-0">
              <h3 className="text-lg sm:text-2xl lg:text-3xl font-black text-white tracking-tight uppercase truncate">
                {userName}
              </h3>
              <div className="flex items-center gap-1.5 sm:gap-2 text-xs sm:text-sm font-black font-mono flex-wrap">
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
            <span className="text-[9px] sm:text-xs font-mono text-slate-400 mt-0.5">
              Công thức: ĐTB×10 + Bài×1 + Streak×0.5
            </span>
          </div>
        </div>

        {/* Quick Stat Summary Grid */}
        <div className="grid grid-cols-2 sm:grid-cols-4 gap-2.5 sm:gap-4 pt-1">
          {/* Stat 1: Hạng Trong Lớp */}
          <div className="bg-[#080B12]/90 border border-slate-800 p-2.5 sm:p-4 rounded-xl space-y-0.5 shadow-sm">
            <span className="text-[10px] sm:text-xs font-mono text-slate-400 uppercase block font-bold">HẠNG LỚP</span>
            <div className="text-sm sm:text-xl lg:text-2xl font-mono font-black text-cyan-300">
              {position ? `#${position}` : '—'} <span className="text-[10px] sm:text-xs text-slate-500 font-normal">/ {totalStudents}</span>
            </div>
          </div>

          {/* Stat 2: Điểm Trung Bình */}
          <div className="bg-[#080B12]/90 border border-slate-800 p-2.5 sm:p-4 rounded-xl space-y-0.5 shadow-sm">
            <span className="text-[10px] sm:text-xs font-mono text-slate-400 uppercase block font-bold">ĐIỂM TRUNG BÌNH</span>
            <div className="text-sm sm:text-xl lg:text-2xl font-mono font-black text-amber-300">
              {rawAverageScore.toFixed(2)}đ
            </div>
          </div>

          {/* Stat 3: Bài Thi Hoàn Thành */}
          <div className="bg-[#080B12]/90 border border-slate-800 p-2.5 sm:p-4 rounded-xl space-y-0.5 shadow-sm">
            <span className="text-[10px] sm:text-xs font-mono text-slate-400 uppercase block font-bold">ĐÃ HOÀN THÀNH</span>
            <div className="text-sm sm:text-xl lg:text-2xl font-mono font-black text-emerald-400">
              {completedTests} Quests
            </div>
          </div>

          {/* Stat 4: Chuỗi Học Tập */}
          <div className="bg-[#080B12]/90 border border-slate-800 p-2.5 sm:p-4 rounded-xl space-y-0.5 shadow-sm">
            <span className="text-[10px] sm:text-xs font-mono text-slate-400 uppercase block font-bold">STREAK HỌC TẬP</span>
            <div className="text-sm sm:text-xl lg:text-2xl font-mono font-black text-orange-400 flex items-center gap-1">
              <Flame className="w-4 h-4 sm:w-5 sm:h-5 text-orange-500 fill-orange-500 shrink-0" />
              <span>{streak} Ngày</span>
            </div>
          </div>
        </div>

        {/* Progress Bar Row: MICRO-GOAL PROGRESS */}
        <div className="pt-1">
          {/* Micro-Goal Progress Bar: Pass Next Student Position */}
          <div className="space-y-2 bg-[#080B12] border border-slate-800 p-3.5 sm:p-5 rounded-xl backdrop-blur-md">
            <div className="flex items-center justify-between text-xs sm:text-base lg:text-lg font-black gap-2 flex-wrap">
              <span className="text-slate-200 uppercase tracking-wider">
                {position && position > 1 ? `MỤC TIÊU LEO HẠNG #${position - 1}` : `TOP 1 TOÀN KHÓA`}
              </span>
              <span className="text-cyan-400 font-mono font-extrabold text-xs sm:text-sm">
                {position && position > 1 && gapScoreNeeded !== null
                  ? `Cần +${gapScoreNeeded} PTS để vượt ${prevStudentName}`
                  : `Đang giữ Ngai Vàng`}
              </span>
            </div>
            {/* Smooth Neon Amber Bar */}
            <div className="w-full bg-slate-950 rounded-full h-3 p-0.5 border border-slate-800 overflow-hidden">
              <div
                className="bg-gradient-to-r from-amber-500 to-orange-500 h-full rounded-full transition-all duration-700 shadow-[0_0_8px_rgba(245,158,11,0.6)]"
                style={{ width: `${!position || position === 1 ? 100 : Math.min(95, Math.max(20, Math.round(((powerScore) / ((powerScore) + (gapScoreNeeded || 1))) * 100)))}%` }}
              />
            </div>
            <div className="flex items-center justify-between text-[11px] sm:text-sm font-mono text-amber-300 font-bold">
              <span>Đang có {displayPowerText} PTS</span>
              <span>{position && position > 1 && gapScoreNeeded !== null ? `Mục tiêu: ${((powerScore) + gapScoreNeeded).toFixed(1)} PTS` : `Bảo vệ Ngai Vàng`}</span>
            </div>
          </div>
        </div>

        {/* Bottom Row: Streak Tag */}
        <div className="flex items-center justify-between text-xs sm:text-sm font-mono pt-2 border-t border-slate-800 text-slate-200">
          <div className="flex items-center gap-2 text-amber-400 font-black">
            <Flame className="w-4 h-4 sm:w-5 sm:h-5 text-orange-500 fill-orange-500 animate-bounce" />
            <span>CHUỖI {streak} NGÀY HỌC TẬP LIÊN TIẾP</span>
          </div>
        </div>
      </div>
    </div>
  );
}
