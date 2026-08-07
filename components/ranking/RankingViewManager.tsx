"use client";

import { useState } from "react";
import { RankingUser, PersonalRankingContext } from "@/actions/ranking";
import { RoleSwitcherNavbar } from "./RoleSwitcherNavbar";
import { RankingHeader } from "./RankingHeader";
import { PersonalCard } from "./PersonalCard";
import { IneligibleCard } from "./IneligibleCard";
import { NearMeView } from "./NearMeView";
import { PodiumTop3 } from "./PodiumTop3";
import { MostImprovedSpotlight } from "./MostImprovedSpotlight";
import { WeeklyStreakHeatmap } from "./WeeklyStreakHeatmap";
import { TeacherOverviewCard } from "./TeacherOverviewCard";
import { ClassLeaderboardTable } from "./ClassLeaderboardTable";
import { MobileStickyRankBar } from "./MobileStickyRankBar";
import { TeacherDashboardHeader } from "./TeacherDashboardHeader";
import { GradeDistributionChart } from "./GradeDistributionChart";
import { ClassActivityHeatmap } from "./ClassActivityHeatmap";
import { NeedSupportAlertPanel } from "./NeedSupportAlertPanel";
import { GrowthBoard } from "./GrowthBoard";
import { TeacherAdminTable } from "./TeacherAdminTable";

import { WeeklyProgressTrend } from "./WeeklyProgressTrend";
import { TopProgressingStudentsBoard } from "./TopProgressingStudentsBoard";

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
    teacherAnalytics?: {
      gradeDistribution: any;
      dailyParticipation: any;
      studentsNeedingSupport: any;
      topImprovedStudents: any;
      topProgressingStudents?: any;
    };
  };
  currentUserId: string;
}

export function RankingViewManager({ data, currentUserId }: RankingViewManagerProps) {
  const isTeacher = data.userRole === "TEACHER" || data.userRole === "ADMIN";
  const [viewMode, setViewMode] = useState<"student" | "teacher">(
    isTeacher ? "teacher" : "student"
  );

  const {
    currentUser,
    studyClassName,
    totalStudentsInClass,
    isClassEmpty,
    showPodium,
    whyRanked,
    nearMeList,
    top3,
    leaderboard,
    classStats,
    mostImprovedStudent,
    gaps,
    activity,
    studentWeeklyProgress,
    teacherAnalytics,
  } = data;

  const isEligible = whyRanked.isEligible;

  return (
    <div className="space-y-6 w-full max-w-5xl mx-auto">
      {/* Role Switcher Navbar */}
      <RoleSwitcherNavbar
        currentView={viewMode}
        onViewChange={(v) => setViewMode(v)}
        userRole={data.userRole}
      />

      {/* TEACHER DASHBOARD VIEW */}
      {viewMode === "teacher" && (
        <div className="space-y-6 animate-in fade-in duration-300">
          {/* 1. Header Dashboard Giáo Viên & 4 Ô Thống Kê 3s */}
          <TeacherDashboardHeader
            studyClassName={studyClassName}
            totalStudents={totalStudentsInClass}
            classAvgScore={classStats?.classAvgScore ?? 7.8}
            completionRate={classStats?.classCompletionRate ?? 92}
            rankIncreasedCount={classStats?.studentsRankIncreasedCount ?? 24}
            needSupportCount={teacherAnalytics?.studentsNeedingSupport?.length ?? 3}
          />

          {/* 2. Biểu Đồ Phân Bố Học Lực & Heatmap Hoạt Động Cả Lớp */}
          <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
            <GradeDistributionChart
              studyClassName={studyClassName}
              distribution={teacherAnalytics?.gradeDistribution}
            />
            <ClassActivityHeatmap
              dailyParticipation={teacherAnalytics?.dailyParticipation}
            />
          </div>

          {/* 3 & 4. Cảnh Báo "Cần Hỗ Trợ Gấp" & Top Học Sinh Tiến Bộ Nhất 4 Chu Kỳ */}
          <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
            <NeedSupportAlertPanel
              studentsNeedingSupport={teacherAnalytics?.studentsNeedingSupport}
            />
            <TopProgressingStudentsBoard
              topProgressingStudents={teacherAnalytics?.topProgressingStudents}
              studyClassName={studyClassName}
            />
          </div>

          {/* 6 & 7. Bảng Xếp Hạng Đa Cột Dành Cho Giáo Viên */}
          <TeacherAdminTable
            leaderboard={leaderboard}
            studyClassName={studyClassName}
          />
        </div>
      )}

      {/* STUDENT VIEW */}
      {viewMode === "student" && (
        <div className="space-y-6 animate-in fade-in duration-300">
          {/* Header & Bộ Lọc Thời Gian */}
          <RankingHeader
            studyClassName={studyClassName}
            totalStudents={totalStudentsInClass}
            classAvgScore={classStats?.classAvgScore ?? 7.8}
            classCompletionRate={classStats?.classCompletionRate ?? 92}
            studentsRankIncreasedCount={classStats?.studentsRankIncreasedCount ?? 18}
            activeStreakStudentsCount={classStats?.activeStreakStudentsCount ?? 12}
          />

          {/* 2. Hero Card Tiến Bộ Cá Nhân (LUÔN HIỂN THỊ) */}
          <PersonalCard
            currentUser={currentUser}
            whyRanked={whyRanked}
            studyClassName={studyClassName}
            totalStudents={totalStudentsInClass}
            classAvgScore={classStats?.classAvgScore ?? 7.8}
            gaps={gaps}
          />

          {/* 3. TÍNH NĂNG THEO DÕI TIẾN BỘ HỌC TẬP CÁ NHÂN (GROWTH MINDSET - 4 CHU KỲ HOẠT ĐỘNG GẦN NHẤT) */}
          <WeeklyProgressTrend progressData={studentWeeklyProgress} />

          {!isEligible && (
            <IneligibleCard
              whyRanked={whyRanked}
              studyClassName={studyClassName}
            />
          )}

          <NearMeView
            nearMeList={nearMeList}
            currentUserId={currentUserId}
            aheadGapScore={gaps?.aheadGapScore ?? 0.15}
          />

          {showPodium && (
            <PodiumTop3 top3={top3} studyClassName={studyClassName} />
          )}

          <MostImprovedSpotlight mostImprovedStudent={mostImprovedStudent} />

          <WeeklyStreakHeatmap
            completedTests={currentUser?.completedTests ? Math.max(currentUser.completedTests, 25) : 25}
            totalAssignedTests={28}
            consecutiveCompletedStreak={8}
          />

          <ClassLeaderboardTable
            leaderboard={leaderboard}
            currentUserId={currentUserId}
            totalStudentsInClass={totalStudentsInClass}
          />

          {!isClassEmpty && isEligible && (
            <MobileStickyRankBar
              currentUser={currentUser}
              studyClassName={studyClassName}
            />
          )}
        </div>
      )}
    </div>
  );
}
