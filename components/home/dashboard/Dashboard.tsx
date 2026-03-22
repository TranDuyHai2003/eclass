import { ContinueMission } from "./ContinueMission";
import { StatsWidget } from "./StatsWidget";
import { Leaderboard } from "./Leaderboard";
import CourseCard from "@/components/course/CourseCard";
import { HomeSidebar } from "@/components/home/HomeSidebar";
import { HomePromo } from "@/components/home/HomePromo";
import Link from "next/link";
import { ChevronRight } from "lucide-react";

type DashboardUser = {
  name?: string | null;
  image?: string | null;
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
};

function stablePercentFromId(id: string) {
  // Deterministic 0..100 based on string hash (no Math.random in render)
  let hash = 0;
  for (let i = 0; i < id.length; i++) {
    hash = (hash * 31 + id.charCodeAt(i)) >>> 0;
  }
  return hash % 101;
}

export function Dashboard({
  user,
  courses,
}: {
  user: DashboardUser;
  courses: DashboardCourse[];
}) {
  return (
    <div className="page-shell">
      <main className="container mx-auto py-8 px-4 sm:px-6 lg:px-8">
        <div className="flex flex-col lg:flex-row gap-8">
          {/* Left Column: Profile & Navigation */}
          <aside className="w-full lg:w-[300px] shrink-0 space-y-4 sm:space-y-6">
            <div className="card-surface rounded-[2rem] p-6 sm:p-8 flex flex-col items-center text-center">
              <div className="w-20 h-20 sm:w-24 sm:h-24 rounded-full bg-red-100 ring-4 ring-white shadow-xl flex items-center justify-center mb-4 sm:mb-6 relative group overflow-hidden">
                {user.image ? (
                  <img
                    src={user.image}
                    alt={user.name || ""}
                    className="w-full h-full object-cover"
                  />
                ) : (
                  <div className="w-full h-full bg-gradient-to-br from-red-600 to-orange-500 flex items-center justify-center text-white text-2xl sm:text-3xl font-black">
                    {user.name?.[0].toUpperCase()}
                  </div>
                )}
                <div className="absolute inset-0 bg-black/40 flex items-center justify-center opacity-0 group-hover:opacity-100 transition-opacity">
                  <span className="text-[10px] text-white font-black uppercase">
                    Sửa
                  </span>
                </div>
              </div>
              <div className="space-y-1">
                <p className="text-[9px] sm:text-[10px] font-black text-red-600 uppercase tracking-[0.2em]">
                  Tân Binh
                </p>
                <h3 className="font-black text-gray-900 text-lg sm:text-xl">
                  {user.name}
                </h3>
              </div>

              <div className="w-full mt-4 sm:mt-6 pt-4 sm:pt-6 border-t border-gray-50">
                <div className="flex justify-between items-end mb-2">
                  <span className="text-[9px] sm:text-[10px] font-black text-gray-400 uppercase">
                    EXP: 1,250 / 2,000
                  </span>
                  <span className="text-xs font-black text-red-600">
                    Level 5
                  </span>
                </div>
                <div className="w-full h-2 bg-gray-100 rounded-full overflow-hidden">
                  <div className="h-full bg-gradient-to-r from-red-600 to-orange-500 w-[60%] rounded-full" />
                </div>
              </div>
            </div>

            <HomeSidebar />
            <HomePromo />
          </aside>

          {/* Center/Right Content */}
          <section className="flex-1 space-y-8">
            {/* Hero Section: Continue Mission */}
            <ContinueMission
              lastLesson={{
                id: "1",
                title: "Cấu trúc dữ liệu và giải thuật",
                courseTitle: "Lập trình C++ từ cơ bản",
              }}
            />

            <div className="grid grid-cols-1 xl:grid-cols-3 gap-8">
              {/* Stats Section */}
              <div className="xl:col-span-2 space-y-8">
                <div className="grid grid-cols-1 sm:grid-cols-2 gap-6">
                  <StatsWidget type="streak" />
                  <StatsWidget type="exercises" />
                </div>

                {/* My Courses */}
                <div className="space-y-6">
                    <div className="flex items-center justify-between">
                      <h2 className="text-2xl font-black text-gray-900 uppercase tracking-tight flex items-center gap-2">
                        <span className="w-2 h-8 bg-red-600 rounded-full" />
                        Bản đồ Nhiệm vụ
                      </h2>
                      <Link 
                        href="/courses" 
                        className="text-xs font-black text-red-600 hover:text-red-700 uppercase tracking-wider flex items-center gap-1 group"
                      >
                        Xem tất cả
                        <ChevronRight className="w-4 h-4 group-hover:translate-x-1 transition-transform" />
                      </Link>
                    </div>
                  <div className="grid grid-cols-1 sm:grid-cols-2 gap-6">
                    {courses.slice(0, 4).map((course) => (
                      <CourseCard
                        key={course.id}
                        course={course}
                        progress={stablePercentFromId(course.id)}
                      />
                    ))}
                  </div>
                </div>
              </div>

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
