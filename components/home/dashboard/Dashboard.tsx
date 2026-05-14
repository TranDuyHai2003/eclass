import { useMemo } from "react";
import { ContinueMission } from "./ContinueMission";
import { StatsWidget } from "./StatsWidget";
import { Leaderboard } from "./Leaderboard";
import CourseCard from "@/components/course/CourseCard";
import { HomeSidebar } from "@/components/home/HomeSidebar";
import { HomePromo } from "@/components/home/HomePromo";
import Link from "next/link";
import { ChevronRight } from "lucide-react";
import { PersonalAnalytics } from "./PersonalAnalytics";

type DashboardUser = {
  name?: string | null;
  image?: string | null;
  role?: string;
};

type DashboardCourse = {
  id: string;
  title: string;
  thumbnail: string | null;
  user?: {
    name: string | null;
    image: string | null;
  } | null;
  chapters?: {
    lessons: { id: string }[];
  }[];
  category?: {
    name: string;
  } | null;
  examDate?: Date | null;
  progress?: number;
  isEnrolled?: boolean;
};

export function Dashboard({
  user,
  courses,
  lastLesson,
  stats,
}: {
  user: DashboardUser;
  courses: DashboardCourse[];
  lastLesson: { id: string; title: string; courseTitle: string } | null;
  stats: {
    completedLessons: number;
    totalLessons: number;
    courseCount: number;
  };
}) {
  const soonestExamDate = useMemo(() => {
    const dates = courses
      .map((c) => c.examDate)
      .filter((d): d is Date => !!d)
      .sort((a, b) => a.getTime() - b.getTime());
    return dates[0] || null;
  }, [courses]);

  // Enrolled courses go first
  const displayCourses = [...courses].sort((a, b: any) => {
    if (a.isEnrolled && !b.isEnrolled) return -1;
    if (!a.isEnrolled && b.isEnrolled) return 1;
    return 0;
  });

  const isAdminOrTeacher = user.role === "ADMIN" || user.role === "TEACHER";

  return (
    <div className="page-shell bg-[#F8FAFC] min-h-screen">
      <main className="container mx-auto py-8 px-4 sm:px-6 lg:px-8">
        <div className="flex flex-col lg:flex-row gap-8">
          {/* Left Column: Profile & Navigation */}
          <aside className="hidden lg:block w-[280px] shrink-0 space-y-5 sticky top-24 h-fit">
            <div className="card-surface bg-white rounded-[2rem] p-6 flex flex-col items-center text-center shadow-sm border border-slate-100">
              <div className="w-20 h-20 rounded-full bg-red-100 ring-4 ring-white shadow-xl flex items-center justify-center mb-4 relative group overflow-hidden">
                {user.image ? (
                  <img
                    src={user.image}
                    alt={user.name || ""}
                    className="w-full h-full object-cover group-hover:scale-110 transition-transform duration-500"
                  />
                ) : (
                  <div className="w-full h-full bg-gradient-to-br from-red-600 to-orange-500 flex items-center justify-center text-white text-2xl font-black">
                    {user.name?.[0].toUpperCase()}
                  </div>
                )}
              </div>
              <div className="space-y-1">
                <p className="text-[9px] font-black text-red-600 uppercase tracking-[0.2em]">
                  {isAdminOrTeacher ? "Giảng Viên" : "Tân Binh"}
                </p>
                <h3 className="font-black text-slate-900 text-lg uppercase tracking-tight">
                  {user.name}
                </h3>
              </div>

              <div className="w-full mt-5 pt-5 border-t border-slate-50">
                <div className="flex justify-between items-end mb-1.5">
                  <span className="text-[9px] font-black text-slate-400 uppercase tracking-widest leading-none">
                    Tiến độ
                  </span>
                  <span className="text-[10px] font-black text-red-600 uppercase tracking-tighter">
                    {stats.completedLessons}/{stats.totalLessons} Bài
                  </span>
                </div>
                <div className="w-full h-1.5 bg-slate-100 rounded-full overflow-hidden">
                  <div
                    className="h-full bg-gradient-to-r from-red-600 to-orange-500 rounded-full transition-all duration-1000"
                    style={{
                      width: `${stats.totalLessons > 0 ? (stats.completedLessons / stats.totalLessons) * 100 : 0}%`,
                    }}
                  />
                </div>
              </div>
            </div>

            <HomeSidebar />
          </aside>

          {/* Center/Right Content */}
          <section className="flex-1 space-y-8">
            <HomePromo targetDate={soonestExamDate} />

            {/* Hero Section: Continue Mission */}
            {lastLesson && <ContinueMission lastLesson={lastLesson} />}

            {/* Radar Analytics Section */}
            {!isAdminOrTeacher && <PersonalAnalytics />}

            <div className="grid grid-cols-1 xl:grid-cols-3 gap-8">
              {/* Stats Section */}
              {/* <div className="xl:col-span-2 space-y-8">
                <div className="grid grid-cols-1 sm:grid-cols-2 gap-6">
                  <StatsWidget type="streak" />
                  <StatsWidget type="exercises" />
                </div>
                <div className="space-y-6">
                    <div className="flex items-center justify-between">
                      <h2 className="text-xl font-black text-slate-900 uppercase tracking-tighter flex items-center gap-2">
                        <span className="w-1.5 h-6 bg-red-600 rounded-full" />
                        Bản đồ Nhiệm vụ
                      </h2>
                      <Link 
                        href="/courses" 
                        className="text-[10px] font-black text-red-600 hover:text-red-700 uppercase tracking-widest flex items-center gap-1 group transition-all"
                      >
                        Khám phá tất cả
                        <ChevronRight className="w-3.5 h-3.5 group-hover:translate-x-1 transition-transform" />
                      </Link>
                    </div>
                  <div className="grid grid-cols-1 sm:grid-cols-2 gap-6">
                    {displayCourses.slice(0, 4).map((course: any) => (
                      <CourseCard
                        key={course.id}
                        course={course}
                        progress={course.progress}
                      />
                    ))}
                  </div>
                </div>
              </div>  
              */}
              {/* Right Rail: Leaderboard */}
              <aside className="space-y-8">
                <Leaderboard />
              </aside>
            </div>
          </section>
        </div>
      </main>
    </div>
  );
}
