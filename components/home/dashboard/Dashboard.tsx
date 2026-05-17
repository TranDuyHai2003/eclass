import { useMemo } from "react";
import Link from "next/link";
import { BookOpen } from "lucide-react";
import { ContinueMission } from "./ContinueMission";
import { StatsWidget } from "./StatsWidget";
import { Leaderboard } from "./Leaderboard";
import CourseCard from "@/components/course/CourseCard";
import { SearchBar } from "@/components/layout/SearchBar";
import { HomeSidebar } from "../HomeSidebar";
import { CountdownTimer } from "@/components/course/CountdownTimer";

export function Dashboard({
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

  const displayCourses = useMemo(() => {
    return [...courses].sort((a, b) => {
      if (a.isEnrolled && !b.isEnrolled) return -1;
      if (!a.isEnrolled && b.isEnrolled) return 1;
      return 0;
    });
  }, [courses]);

  return (
    <div className="flex min-h-screen bg-slate-50 overflow-x-hidden">
      {/* 1. Left Sidebar Navigation */}
      <aside className="hidden lg:block w-72 h-screen sticky top-0 bg-white border-r border-slate-100 shrink-0">
         <HomeSidebar />
      </aside>

      {/* 2. Main Scrollable Content */}
      <main className="flex-1 flex flex-col min-w-0">
        {/* Global Search Header (Dashboard Only) */}
        <div className="h-16 px-6 lg:px-8 border-b border-slate-100 bg-white/50 backdrop-blur-md sticky top-0 z-40 flex items-center justify-between">
           <div className="flex-1 max-w-md">
              <SearchBar />
           </div>
           <div className="hidden sm:flex items-center gap-4 text-[10px] font-black uppercase tracking-widest text-slate-400">
              {new Date().toLocaleDateString('vi-VN', { weekday: 'long', year: 'numeric', month: 'long', day: 'numeric' })}
           </div>
        </div>

        <div className="p-6 lg:p-8 space-y-10 max-w-[1400px]">
          {/* Mission & Stats Row */}
          <section className="grid grid-cols-1 xl:grid-cols-12 gap-8 items-start">
            <div className="xl:col-span-8 space-y-8">
              <ContinueMission lastLesson={lastLesson} />
              <div className="grid grid-cols-1 sm:grid-cols-2 gap-6">
                 <StatsWidget type="streak" />
                 <StatsWidget type="exercises" />
              </div>
            </div>
            
            <div className="xl:col-span-4 space-y-8">
               <CountdownTimer targetDate={soonestExamDate.toISOString()} />
               <Leaderboard />
            </div>
          </section>

          {/* Course Progress Section */}
          <section className="space-y-6 pb-20">
            <div className="flex items-center justify-between">
               <h2 className="text-2xl font-black text-slate-900 uppercase tracking-tighter">Lộ trình học tập của bạn</h2>
               <div className="px-4 py-1.5 bg-slate-100 rounded-full text-[10px] font-black text-slate-500 uppercase tracking-widest">
                  {courses.length} Khóa học
               </div>
            </div>

            <div className="grid grid-cols-1 sm:grid-cols-2 gap-8">
              {displayCourses.map((course) => (
                <div key={course.id} className="animate-in fade-in slide-in-from-bottom-5 duration-700">
                  <CourseCard
                    course={course}
                    progress={course.progress}
                  />
                </div>
              ))}
              
              {courses.length === 0 && (
                <div className="col-span-full py-20 flex flex-col items-center justify-center bg-white rounded-[3rem] border border-dashed border-slate-200">
                   <div className="w-16 h-16 bg-slate-50 rounded-full flex items-center justify-center mb-4">
                      <BookOpen className="w-8 h-8 text-slate-300" />
                   </div>
                   <p className="text-slate-500 font-bold uppercase tracking-tight">Bạn chưa đăng ký khóa học nào</p>
                   <Link href="/courses" className="mt-4 text-red-600 font-black text-xs uppercase tracking-widest hover:underline">Khám phá ngay</Link>
                </div>
              )}
            </div>
          </section>
        </div>
      </main>
    </div>
  );
}
