"use client";

import { useMemo } from "react";
import { useSearchParams } from "next/navigation";
import Link from "next/link";
import { BookOpen } from "lucide-react";
import CourseCard from "@/components/course/CourseCard";
import { SearchBar } from "@/components/layout/SearchBar";
import { HomeSidebar } from "../HomeSidebar";
import { HomeCarousel } from "./HomeCarousel";
import { RightSidebar } from "./RightSidebar";
import { HomePromo } from "../HomePromo";
import { StudentHero } from "./StudentHero";
import type { PointsCardData } from "@/lib/points/queries";
import type { HomeRecentResult, HomeTodoItem } from "@/lib/home/student-home";
import type { AvatarConfig } from "@/lib/game/avatar";
import type { LeaderboardRow } from "@/lib/game/leaderboard";
import { HomeNpcRow } from "./HomeNpcRow";
import { StudentTasks } from "./StudentTasks";
import { GuestLanding, type LandingReward } from "../landing/GuestLanding";

import { SortSelect } from "@/components/ui/SortSelect";

export function Dashboard({
  user,
  courses,
  lastLesson,
  stats,
  points,
  extras,
  avatar,
  npcLines,
  top3,
  grade,
  guestRewards,
}: {
  user: any;
  courses: any[];
  lastLesson: any;
  stats: any;
  /** Điểm thưởng của học sinh (null = tắt tính năng / không phải học sinh) */
  points?: PointsCardData | null;
  /** Bài cần làm + kết quả gần đây (chỉ học sinh) */
  extras?: { todo: HomeTodoItem[]; todoTotal: number; recent: HomeRecentResult[] } | null;
  /** Nhân vật chibi của học sinh (null = tắt Xu) */
  avatar?: AvatarConfig | null;
  /** Câu thoại NPC Lucky Boy (tính ở server) */
  npcLines?: string[] | null;
  /** Top 3 Bảng Vàng khối mình */
  top3?: LeaderboardRow[];
  grade?: number | null;
  /** Quà đang mở cho mọi lớp — chỉ trang chủ khách */
  guestRewards?: LandingReward[];
}) {
  const searchParams = useSearchParams();
  const currentSort = searchParams?.get("sort") || "default";

  const displayCourses = useMemo(() => {
    if (currentSort !== "default") {
      return courses; // Respect server-side sort completely when filtering by date
    }
    return [...courses].sort((a, b) => {
      if (a.isEnrolled && !b.isEnrolled) return -1;
      if (!a.isEnrolled && b.isEnrolled) return 1;
      return 0;
    });
  }, [courses, currentSort]);

  // Chưa học bài nào → bắt đầu từ bài đầu tiên của khoá đã ghi danh, nếu không có thì trang Khoá học
  const firstEnrolled = courses.find((c) => c.isEnrolled);
  const firstLessonId = firstEnrolled?.chapters?.[0]?.lessons?.[0]?.id;
  const startHref = firstLessonId ? `/watch/${firstLessonId}` : "/courses";

  // Khách: trang giới thiệu theo artifact thiết kế (không sidebar)
  if (!user) return <GuestLanding courses={courses} rewards={guestRewards ?? []} />;

  return (
    <div className="page-shell min-h-screen bg-[#EBF3FF]">
      <div className="flex w-full min-h-[calc(100vh-5rem)]">
        {/* 1. Left Sidebar Navigation Column - Flush Left */}
        <aside className="hidden lg:block w-[250px] shrink-0 border-r border-slate-200/70 bg-white/70 backdrop-blur-xl p-3">
          <div className="sticky top-24 h-[calc(100vh-7rem)]">
            <HomeSidebar user={user} />
          </div>
        </aside>

        {/* 2. Primary Column & Widgets Wrapper */}
        <main className="flex-1 min-w-0 px-4 sm:px-6 lg:px-8 py-6 space-y-8 max-w-[1600px]">
          {/* Carousel Slider (Temporarily hidden due to no data) */}
          {/* <HomeCarousel /> */}

          {user?.role === "STUDENT" && (
            <StudentHero
              name={user?.name}
              points={points ?? null}
              lastLesson={lastLesson}
              stats={stats}
              startHref={startHref}
              aside={<HomePromo variant="card" />}
              avatar={avatar ?? null}
              userId={user?.id}
            />
          )}

          {user?.role === "STUDENT" && extras && <StudentTasks todo={extras.todo} todoTotal={extras.todoTotal} recent={extras.recent} />}

          {user?.role === "STUDENT" && npcLines && <HomeNpcRow lines={npcLines} top3={top3 ?? []} grade={grade ?? null} currentUserId={user.id} />}

          {user && user.role !== "STUDENT" && <HomePromo />}

          {/* Course Catalog / Learning Progress */}
          <section id="lo-trinh" className="space-y-6 scroll-mt-24">
            <div className="flex flex-col sm:flex-row sm:items-end justify-between gap-4 border-b border-blue-100 pb-3">
              <div className="space-y-1.5">
                <h2 className="text-xl sm:text-2xl font-black text-slate-900 tracking-tight flex items-center gap-3">
                  <span className="w-2 h-7 bg-[#2563EB] rounded-full" />
                  Lộ trình học tập
                </h2>
                <p className="text-slate-500 font-medium text-sm">
                  Chọn mục tiêu của bạn và bắt đầu ngay
                </p>
              </div>

              {courses.length > 0 && (
                <div className="flex items-center gap-3 shrink-0">
                  <SortSelect />
                </div>
              )}
            </div>

            {/* Courses Grid */}
            {/* 1–2 khoá: thẻ ngang lấp đủ chiều rộng; từ 3 khoá: lưới 3 cột */}
            <div
              className={
                displayCourses.length === 1
                  ? "grid grid-cols-1 gap-6"
                  : displayCourses.length === 2
                  ? "grid grid-cols-1 2xl:grid-cols-2 gap-6"
                  : "grid grid-cols-1 sm:grid-cols-2 xl:grid-cols-3 gap-6"
              }
            >
              {displayCourses.map((course) => (
                <CourseCard
                  key={course.id}
                  course={course}
                  progress={user?.role === "STUDENT" || course.isEnrolled ? course.progress : undefined}
                  layout={displayCourses.length <= 2 ? "horizontal" : "vertical"}
                />
              ))}

              {courses.length === 0 && (
                <div className="col-span-full py-20 flex flex-col items-center justify-center bg-white rounded-[3rem] border border-dashed border-blue-200/60">
                  <div className="w-16 h-16 bg-blue-50 rounded-full flex items-center justify-center mb-4">
                    <BookOpen className="w-8 h-8 text-blue-600/30" />
                  </div>
                  <p className="text-slate-500 font-bold">
                    Không tìm thấy khóa học nào
                  </p>
                </div>
              )}
            </div>
          </section>
        </main>
      </div>
    </div>
  );
}
