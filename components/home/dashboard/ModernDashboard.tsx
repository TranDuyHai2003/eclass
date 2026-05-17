"use client";

import { useMemo } from "react";
import { DashboardHeader } from "./DashboardHeader";
import { LeftSidebar } from "./LeftSidebar";
import { RightSidebar } from "./RightSidebar";
import { ContinueMission } from "./ContinueMission";
import { PersonalAnalytics } from "./PersonalAnalytics";
import { Leaderboard } from "./Leaderboard";
import CourseCard from "@/components/course/CourseCard";
import { Sparkles, Timer, Trophy, ArrowRight, BookOpen, GraduationCap } from "lucide-react";
import Link from "next/link";
import { useCountdown } from "@/hooks/use-countdown";
import { cn } from "@/lib/utils";

export function ModernDashboard({
  user,
  courses,
  lastLesson,
  stats,
}: {
  user: any;
  courses: any[];
  lastLesson: any;
  stats: any;
}) {
  const soonestExamDate = useMemo(() => {
    const dates = courses
      .map((c) => c.examDate)
      .filter((d): d is Date => !!d)
      .sort((a, b) => a.getTime() - b.getTime());
    return dates[0] || new Date("2026-06-11T08:00:00");
  }, [courses]);

  const { days, hours, minutes } = useCountdown(soonestExamDate);

  const displayCourses = useMemo(() => {
    return [...courses].sort((a, b) => {
      if (a.isEnrolled && !b.isEnrolled) return -1;
      if (!a.isEnrolled && b.isEnrolled) return 1;
      return 0;
    });
  }, [courses]);

  return (
    <div className="h-screen flex flex-col bg-[#F4F9FF] overflow-hidden">
      {/* CSS Override for Global Header */}
      <style dangerouslySetInnerHTML={{ __html: `
        header:not(.dashboard-header) { display: none !important; }
        .page-shell { padding-top: 0 !important; }
      `}} />

      {/* 1. Fixed Dashboard Header */}
      <DashboardHeader user={user} />

      <div className="flex flex-1 overflow-hidden">
        {/* 2. Left Sidebar (Fixed) */}
        <LeftSidebar user={user} />

        {/* 3. Main Content (Scrollable) */}
        <main className="flex-1 overflow-y-auto custom-scrollbar p-6 space-y-10">
           <div className="grid grid-cols-1 xl:grid-cols-2 gap-8 animate-in fade-in slide-in-from-bottom-4 duration-500">
              {/* Continue Mission */}
              <div className="space-y-4">
                 <div className="flex items-center gap-2 px-2">
                    <Timer className="w-4 h-4 text-blue-600" />
                    <h3 className="font-black text-slate-800 text-[11px] uppercase tracking-widest">Nhiệm vụ đang thực hiện</h3>
                 </div>
                 {lastLesson ? (
                    <ContinueMission lastLesson={lastLesson} />
                 ) : (
                    <div className="bg-white rounded-3xl p-8 border border-blue-100 flex flex-col items-center text-center space-y-4 shadow-sm">
                       <div className="w-12 h-12 bg-blue-50 rounded-2xl flex items-center justify-center">
                          <BookOpen className="w-6 h-6 text-blue-400" />
                       </div>
                       <div className="space-y-1">
                          <p className="text-sm font-black text-slate-900 uppercase tracking-tight">Sẵn sàng bắt đầu?</p>
                          <p className="text-[10px] font-bold text-slate-400 uppercase tracking-widest leading-none">Bạn chưa có bài học nào đang học dở</p>
                       </div>
                       <Link href="/courses" className="px-6 py-2 bg-blue-600 text-white font-black text-[10px] uppercase tracking-widest rounded-xl hover:bg-blue-700 transition-colors shadow-lg shadow-blue-100">Khám phá ngay</Link>
                    </div>
                 )}
              </div>

              {/* Energy/Analytics Summary */}
              <div className="space-y-4">
                 <div className="flex items-center gap-2 px-2">
                    <GraduationCap className="w-4 h-4 text-blue-600" />
                    <h3 className="font-black text-slate-800 text-[11px] uppercase tracking-widest">Tiến độ tổng quát</h3>
                 </div>
                 <div className="bg-white rounded-[2.5rem] p-6 border border-blue-100 flex flex-col justify-center h-full min-h-[140px] shadow-sm relative overflow-hidden">
                    <div className="absolute top-0 right-0 p-4 opacity-[0.03]">
                       <Trophy className="w-20 h-20 text-blue-900" />
                    </div>
                    <div className="flex items-center justify-between mb-4 px-2 relative z-10">
                       <span className="text-2xl font-black text-slate-800">{stats.completedLessons} / {stats.totalLessons}</span>
                       <span className={cn(
                         "px-3 py-1 rounded-full text-[10px] font-black uppercase tracking-widest",
                         user ? "bg-emerald-50 text-emerald-600" : "bg-blue-50 text-blue-600"
                       )}>
                          {user ? "Đã hoàn thành" : "Tiến độ học viên"}
                       </span>
                    </div>
                    <div className="w-full h-3 bg-blue-50 rounded-full overflow-hidden p-1 shadow-inner relative z-10">
                       <div 
                         className="h-full bg-gradient-to-r from-blue-500 to-indigo-600 rounded-full transition-all duration-1000 shadow-[0_0_8px_rgba(59,130,246,0.3)]" 
                         style={{ width: `${stats.totalLessons > 0 ? (stats.completedLessons/stats.totalLessons)*100 : 0}%` }} 
                       />
                    </div>
                 </div>
              </div>
           </div>

           {/* Personal Radar Analytics */}
           <div className="space-y-4 animate-in fade-in slide-in-from-bottom-6 duration-700">
              <div className="flex items-center gap-2 px-2">
                 <Sparkles className="w-4 h-4 text-blue-600" />
                 <h3 className="font-black text-slate-800 text-[11px] uppercase tracking-widest">Phân tích năng lực chuyên sâu</h3>
              </div>
              <div className="bg-white rounded-[3rem] p-8 border border-blue-100 shadow-sm overflow-hidden">
                 <PersonalAnalytics />
              </div>
           </div>

           {/* Map of Missions / Courses */}
           <div className="space-y-6 animate-in fade-in slide-in-from-bottom-8 duration-700">
              <div className="flex items-center justify-between px-2">
                <div className="flex items-center gap-2">
                   <Trophy className="w-4 h-4 text-blue-600" />
                   <h2 className="text-lg font-black text-slate-800 uppercase tracking-tighter">
                     Lộ trình học tập tiêu biểu
                   </h2>
                </div>
                <Link 
                  href="/courses" 
                  className="text-[10px] font-black text-blue-600 hover:text-blue-700 uppercase tracking-widest flex items-center gap-1 group transition-all"
                >
                  Tất cả khóa học
                  <ArrowRight className="w-3.5 h-3.5 group-hover:translate-x-1 transition-transform" />
                </Link>
              </div>
              
              <div className="grid grid-cols-1 sm:grid-cols-2 gap-6">
                {(user ? displayCourses : courses).slice(0, 6).map((course: any) => (
                  <CourseCard
                    key={course.id}
                    course={course}
                    progress={user ? course.progress : undefined}
                  />
                ))}
              </div>
           </div>

           {!user && (
             <div className="bg-blue-600 rounded-[3rem] p-8 sm:p-12 text-center text-white space-y-6 shadow-2xl shadow-blue-500/20">
                <h2 className="text-3xl font-black uppercase tracking-tighter">Sẵn sàng bứt phá điểm số?</h2>
                <p className="text-blue-100 max-w-xl mx-auto font-medium uppercase tracking-tight">Đăng ký thành viên ngay để lưu lại tiến trình học tập và nhận báo cáo năng lực chuyên sâu từ E-Class.</p>
                <div className="flex justify-center">
                   <Link href="/register" className="px-10 py-4 bg-white text-blue-600 rounded-2xl font-black uppercase tracking-widest hover:scale-105 transition-all shadow-xl">Đăng ký miễn phí</Link>
                </div>
             </div>
           )}

           <div className="pb-10" />
        </main>

        {/* 4. Right Sidebar (Fixed) */}
        <RightSidebar />
      </div>
    </div>
  );
}

function CountdownUnit({ value, label }: { value: number; label: string }) {
  return (
    <div className="flex flex-col items-center">
       <div className="w-16 h-16 sm:w-20 sm:h-20 bg-white/10 backdrop-blur-md rounded-[1.5rem] border border-white/20 flex items-center justify-center mb-2 shadow-inner">
          <span className="text-3xl sm:text-4xl font-black italic tabular-nums">{value.toString().padStart(2, "0")}</span>
       </div>
       <span className="text-[9px] font-black uppercase tracking-widest text-blue-200 opacity-60">{label}</span>
    </div>
  )
}
