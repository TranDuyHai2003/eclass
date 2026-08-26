"use client";

import { useState } from "react";
import { RankingUser, PersonalRankingContext } from "@/actions/ranking";
import { calculateGameRank } from "@/lib/game-rank";
import { RoleSwitcherNavbar } from "./RoleSwitcherNavbar";
import { Swords, Shield, Sparkles, Castle } from "lucide-react";

// Student View Components (HUNTER SYSTEM)
import { HeroCard } from "./HeroCard";
import { WeeklyProgressTracker } from "./WeeklyProgressTracker";
import { Top15Leaderboard } from "./Top15Leaderboard";
import { NearMeAndSpotlight } from "./NearMeAndSpotlight";
import { MobileStickyRankBar } from "./MobileStickyRankBar";
import { RankGuideModal } from "./RankGuideModal";

import { Last8TestsMatrixBoard } from "./Last8TestsMatrixBoard";

// Teacher View Components (GUILD COMMAND CENTER)
import { TeacherQuickStats } from "./TeacherQuickStats";
import { ActionPanel } from "./ActionPanel";
import { TeacherAdminTable } from "./TeacherAdminTable";

interface RankingViewManagerProps {
  data: {
    currentUser: RankingUser | null;
    userRole: string;
    studyClassName: string | null;
    totalStudentsInClass: number;
    isClassEmpty: boolean;
    showPodium: boolean;
    whyRanked: PersonalRankingContext["whyRanked"];
    nearMeList: RankingUser[];
    top3: RankingUser[];
    leaderboard: RankingUser[];
    classStats?: {
      classAvgScore: number;
      classCompletionRate: number;
      studentsRankIncreasedCount: number;
      activeStreakStudentsCount: number;
    };
    mostImprovedStudent?: any;
    gaps?: any;
    activity?: any;
    studentWeeklyProgress?: any;
    quests?: any;
    sessionProgress?: any;
    weeklyProgress?: any;
    teacherAnalytics?: {
      gradeDistribution: any;
      dailyParticipation?: any;
      studentsNeedingSupport: any;
      topImprovedStudents?: any;
      topProgressingStudents?: any;
    };
  };
  currentUserId: string;
}

export function RankingViewManager({ data, currentUserId }: RankingViewManagerProps) {
  const isTeacherRole = data.userRole === "TEACHER" || data.userRole === "ADMIN";
  const [viewMode, setViewMode] = useState<"student" | "teacher">(
    isTeacherRole ? "teacher" : "student"
  );
  const [isGuideOpen, setIsGuideOpen] = useState(false);

  const {
    currentUser,
    studyClassName,
    totalStudentsInClass,
    whyRanked,
    nearMeList,
    leaderboard,
    classStats,
    mostImprovedStudent,
    studentWeeklyProgress,
    teacherAnalytics,
  } = data;

  const minRequiredTests = whyRanked?.minRequiredTests || 5;

  // Single Source of Truth calculation for Current User Rank Result
  const currentUserRankResult = currentUser
    ? calculateGameRank(
        currentUser.avgScore,
        currentUser.rank,
        totalStudentsInClass,
        currentUser.completedTests,
        minRequiredTests
      )
    : null;

  // Count Rank S / SSS for Teacher Stats
  const rankSCount = leaderboard.filter((u, idx) => {
    const gr = calculateGameRank(u.avgScore, u.rank || idx + 1, totalStudentsInClass, u.completedTests, minRequiredTests);
    return gr.rank === "S" || gr.rank === "SSS";
  }).length;

  return (
    <div className="space-y-6 w-full">
      {/* Route Header Title */}
      <div className="flex items-center justify-between px-3 sm:px-0">
        <div className="flex flex-col gap-1 w-full sm:w-auto">
          {/* Line 1: Icon Swords on far left + HỆ THỐNG THỢ SĂN */}
          <div className="flex items-center gap-2">
            <Swords className="w-6 h-6 sm:w-8 sm:h-8 text-cyan-400 shrink-0" />
            <h1 className="text-base sm:text-2xl lg:text-3xl font-black text-white tracking-tight uppercase">
              HỆ THỐNG THỢ SĂN
            </h1>
          </div>

          {/* Line 2: DUNGEON LỚP HỌC · MÙA 2026-2027 + Info ! Button on the right */}
          <div className="flex items-center gap-2.5 flex-wrap">
            <span className="text-slate-300 font-bold text-xs sm:text-lg lg:text-xl font-mono">
              DUNGEON LỚP HỌC · MÙA 2026-2027
            </span>

            {/* Info Button ! for Rank Rules Modal */}
            <button
              onClick={() => setIsGuideOpen(true)}
              className="inline-flex items-center gap-1.5 px-2.5 py-0.5 rounded-full bg-cyan-950/80 border border-cyan-500/60 text-cyan-300 hover:bg-cyan-900/90 hover:text-white hover:border-cyan-400 transition-all shadow-[0_0_12px_rgba(6,182,212,0.35)] text-xs font-black font-mono shrink-0"
              title="Xem quy tắc xếp hạng Thợ săn"
            >
              <span className="w-4 h-4 rounded-full bg-cyan-400 text-slate-950 font-black text-xs flex items-center justify-center">!</span>
              <span className="text-[11px] sm:text-xs">Quy tắc Rank</span>
            </button>
          </div>
        </div>

        {/* Show Role Switcher ONLY if Admin / Teacher for preview */}
        {isTeacherRole && (
          <RoleSwitcherNavbar
            currentView={viewMode}
            onViewChange={(v) => setViewMode(v)}
            userRole={data.userRole}
          />
        )}
      </div>

      {/* Slogan Banner */}
      <div className="bg-[#0D121D]/90 border border-cyan-500/40 rounded-xl p-3 sm:p-4 text-cyan-200 text-xs sm:text-sm font-medium flex items-center gap-3 shadow-lg backdrop-blur-md">
        <span className="text-base sm:text-xl shrink-0">🎯</span>
        <p className="leading-relaxed">
          <strong className="text-white font-bold">Không phải ai đạt điểm cao một lần cũng là người mạnh nhất</strong> — Rank thuộc về người chứng minh được năng lực của mình qua thời gian.
        </p>
      </div>

      {/* Rank Guide Modal Popup */}
      <RankGuideModal
        isOpen={isGuideOpen}
        onClose={() => setIsGuideOpen(false)}
        minRequiredTests={minRequiredTests}
      />

      {/* STUDENT VIEW (HUNTER SYSTEM) */}
      {viewMode === "student" && (
        <div className="space-y-6 animate-in fade-in duration-300">
          {/* 1. HUNTER STATUS (HERO CARD LỚN NHẤT & QUAN TRỌNG NHẤT) */}
          {currentUser && (
            <HeroCard
              currentUser={currentUser}
              leaderboard={leaderboard}
              studyClassName={studyClassName}
              totalStudents={totalStudentsInClass}
            />
          )}

          {/* 2. DUNGEON ASCENSION (HÀNH TRÌNH CHINH PHỤC CÁC TẦNG DUNGEON) */}
          <WeeklyProgressTracker
            weeklyProgress={data.weeklyProgress}
            sessionProgress={data.sessionProgress}
          />

          {/* 3. HUNTER GUILD • TOP 15 (VISUAL PODIUM + COMPACT TABLE) */}
          <Top15Leaderboard
            leaderboard={leaderboard}
            weeklyLeaderboard={(data as any).weeklyLeaderboard}
            monthlyLeaderboard={(data as any).monthlyLeaderboard}
            currentUserId={currentUserId}
            totalStudentsInClass={totalStudentsInClass}
            minRequiredTests={minRequiredTests}
          />

          {/* 4. LAST 8 TESTS MATRIX TRACKING BOARD */}
          <Last8TestsMatrixBoard
            leaderboard={leaderboard}
            totalStudentsInClass={totalStudentsInClass}
          />
        </div>
      )}

      {/* TEACHER VIEW (GUILD COMMAND CENTER) */}
      {viewMode === "teacher" && (
        <div className="space-y-6 animate-in fade-in duration-300">
          {/* 1. QUICK STATS 4 Ô THỐNG KÊ NHANH */}
          <TeacherQuickStats
            studyClassName={studyClassName}
            totalStudents={totalStudentsInClass}
            classAvgScore={classStats?.classAvgScore}
            completionRate={classStats?.classCompletionRate}
            rankSCount={rankSCount}
            needSupportCount={teacherAnalytics?.studentsNeedingSupport?.length}
          />

          {/* 2. BẢNG QUẢN LÝ DÂN SỐ THỢ SĂN (Lọc Rank SSS - C + % Vượt Trội) */}
          <TeacherAdminTable
            leaderboard={leaderboard}
            studyClassName={studyClassName}
            minRequiredTests={minRequiredTests}
          />

          {/* 3. PANEL HÀNH ĐỘNG 2 TAB (Cần Cứu Trợ & Bứt Phá) */}
          <ActionPanel
            studentsNeedingSupport={teacherAnalytics?.studentsNeedingSupport}
            topProgressingStudents={teacherAnalytics?.topProgressingStudents}
          />
        </div>
      )}
    </div>
  );
}
