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

import { SortSelect } from "@/components/ui/SortSelect";

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
        <main className="flex-1 min-w-0 px-4 sm:px-6 lg:px-8 py-6 space-y-10 max-w-[1600px]">
          {/* Carousel Slider (Temporarily hidden due to no data) */}
          {/* <HomeCarousel /> */}

          {/* Countdown Target Promo */}
          <HomePromo />

          {/* Course Catalog / Learning Progress */}
          <section className="space-y-6">
            <div className="flex flex-col sm:flex-row sm:items-end justify-between gap-4 border-b border-blue-100 pb-3">
              <div className="space-y-1.5">
                <h2 className="text-2xl font-black text-slate-900 uppercase tracking-tighter flex items-center gap-3">
                  <span className="w-2 h-7 bg-[#2563EB] rounded-full" />
                  Lộ trình học tập
                </h2>
                <p className="text-slate-400 font-bold uppercase text-xs sm:text-sm tracking-wider">
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
            <div className="grid grid-cols-1 sm:grid-cols-2 xl:grid-cols-3 gap-6">
              {displayCourses.map((course) => (
                <CourseCard key={course.id} course={course} />
              ))}

              {courses.length === 0 && (
                <div className="col-span-full py-20 flex flex-col items-center justify-center bg-white rounded-[3rem] border border-dashed border-blue-200/60">
                  <div className="w-16 h-16 bg-blue-50 rounded-full flex items-center justify-center mb-4">
                    <BookOpen className="w-8 h-8 text-blue-600/30" />
                  </div>
                  <p className="text-slate-500 font-bold uppercase tracking-tight">
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
