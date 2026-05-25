"use client";

import { useMemo } from "react";
import Link from "next/link";
import { BookOpen } from "lucide-react";
import CourseCard from "@/components/course/CourseCard";
import { SearchBar } from "@/components/layout/SearchBar";
import { HomeSidebar } from "../HomeSidebar";
import { HomeCarousel } from "./HomeCarousel";
import { RightSidebar } from "./RightSidebar";
import { HomePromo } from "../HomePromo";

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
  const displayCourses = useMemo(() => {
    return [...courses].sort((a, b) => {
      if (a.isEnrolled && !b.isEnrolled) return -1;
      if (!a.isEnrolled && b.isEnrolled) return 1;
      return 0;
    });
  }, [courses]);

  return (
    <div className="page-shell min-h-screen bg-[#EBF3FF]">
      <main className="container mx-auto py-8 sm:py-10 px-4 sm:px-6 lg:px-8">
        <div className="flex flex-col lg:flex-row gap-8">
          {/* 1. Left Sidebar Navigation Column */}
          <aside className="hidden lg:block w-[280px] shrink-0">
            <div className="sticky top-24 h-fit">
              <HomeSidebar user={user} />
            </div>
          </aside>

          {/* 2. Primary Column & Widgets Wrapper */}
          <div className="flex-1 min-w-0 space-y-10">
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
                    <p className="text-slate-400 font-bold uppercase text-[9px] tracking-[0.25em]">
                      Chọn mục tiêu của bạn và bắt đầu ngay
                    </p>
                  </div>
                </div>

                <div className="grid grid-cols-1 md:grid-cols-2 xl:grid-cols-3 gap-8">
                  {displayCourses.map((course) => (
                    <div
                      key={course.id}
                      className="animate-in fade-in slide-in-from-bottom-5 duration-700"
                    >
                      <CourseCard course={course} progress={course.progress} />
                    </div>
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
          </div>
        </div>
      </main>
    </div>
  );
}
