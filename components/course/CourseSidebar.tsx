"use client";

import { useState, useMemo } from "react";
import Link from "next/link";
import {
  ChevronDown,
  PlayCircle,
  Lock,
  CheckCircle,
  Video,
} from "lucide-react";
import { cn } from "@/lib/utils"; // Giả sử bạn có utility này từ shadcn/tailwind

// ... (Giữ nguyên các type Lesson, Chapter, Course)
type Lesson = {
  id: string;
  title: string;
  position: number;
  isCompleted?: boolean; // Nếu sau này có logic check hoàn thành
  isFree?: boolean;
};

type Chapter = {
  id: string;
  title: string;
  position: number;
  lessons: Lesson[];
};

type Course = {
  id: string;
  title: string;
  chapters: Chapter[];
};

type CourseSidebarProps = {
  course: Course;
  currentLessonId: string;
};

export default function CourseSidebar({
  course,
  currentLessonId,
}: CourseSidebarProps) {
  // Tự động mở chương chứa bài học hiện tại
  const [openChapters, setOpenChapters] = useState<Record<string, boolean>>(
    () => {
      const initialState: Record<string, boolean> = {};
      course.chapters.forEach((ch) => {
        initialState[ch.id] = true;
      });
      return initialState;
    },
  );

  const toggleChapter = (id: string) => {
    setOpenChapters((prev) => ({ ...prev, [id]: !prev[id] }));
  };

  // Tính toán tiến độ giả định (để hiển thị UI cho đẹp)
  // Trong thực tế bạn sẽ truyền progress thật vào props
  const progress = 35;

  return (
    <div className="bg-white border-none rounded-3xl shadow-none overflow-hidden flex flex-col max-h-[calc(100vh-100px)] h-full">
      {/* Header Sidebar */}
      <div className="p-6 bg-white z-10 border-b border-gray-50">
        <h3 className="font-black text-gray-900 mb-4 text-base uppercase tracking-tight">Nội dung khóa học</h3>
        <div className="flex items-center justify-between text-[10px] font-black text-gray-400 mb-2 uppercase tracking-widest">
          <span>Tiến độ học tập</span>
          <span className="text-red-600">{progress}%</span>
        </div>
        {/* Progress Bar */}
        <div className="w-full bg-gray-100 rounded-full h-2.5 overflow-hidden p-0.5">
          <div
            className="bg-gradient-to-r from-red-600 to-orange-500 h-1.5 rounded-full transition-all duration-1000 shadow-[0_0_10px_rgba(239,68,68,0.2)]"
            style={{ width: `${progress}%` }}
          ></div>
        </div>
      </div>

      {/* Scrollable Content */}
      <div className="overflow-y-auto flex-1 custom-scrollbar">
        {course.chapters.map((chapter) => (
          <div
            key={chapter.id}
            className="border-b last:border-0 border-gray-50"
          >
            <button
              onClick={() => toggleChapter(chapter.id)}
              className={cn(
                "w-full flex items-center justify-between py-4 px-6 transition-all hover:bg-gray-50/80",
                openChapters[chapter.id] ? "bg-gray-50/30" : "bg-white",
              )}
            >
              <span className="font-black text-[13px] text-gray-900 text-left line-clamp-1 uppercase tracking-tight">
                {chapter.title}
              </span>
              <ChevronDown
                className={cn(
                  "w-4 h-4 text-gray-400 transition-transform duration-300",
                  openChapters[chapter.id] && "transform rotate-180",
                )}
              />
            </button>

            {/* Animation đơn giản hoặc logic show/hide */}
            {openChapters[chapter.id] && (
              <div className="bg-gray-50/30 flex flex-col pb-2">
                {chapter.lessons.map((lesson) => {
                  const isActive = lesson.id === currentLessonId;
                  const isLocked = false; // Logic check lock sau này

                  return (
                    <Link
                      key={lesson.id}
                      href={isLocked ? "#" : `/watch/${lesson.id}`}
                      className={cn(
                        "flex items-start gap-x-3 py-4 px-6 text-[13px] transition-all relative group mx-2 rounded-2xl mb-1",
                        isActive
                          ? "bg-red-50 text-red-700 shadow-sm"
                          : "text-gray-500 hover:bg-gray-100/50 hover:text-gray-900 border-transparent",
                        isLocked &&
                          "opacity-70 cursor-not-allowed hover:bg-transparent",
                      )}
                    >
                      <div className="mt-1 flex-shrink-0">
                        {isActive ? (
                          <div className="bg-red-600 rounded-full p-1.5 shadow-lg shadow-red-200">
                            <PlayCircle className="w-3.5 h-3.5 text-white fill-current" />
                          </div>
                        ) : isLocked ? (
                          <Lock className="w-4 h-4 text-gray-400" />
                        ) : (
                          <Video className="w-4 h-4 text-gray-300 group-hover:text-red-500 transition-colors" />
                        )}
                      </div>

                      <div className="flex-1 min-w-0">
                        <p
                          className={cn(
                            "font-bold line-clamp-2 leading-tight",
                            isActive ? "text-red-700" : "text-gray-700"
                          )}
                        >
                          {lesson.title}
                        </p>
                        <div className="flex items-center gap-1.5 mt-1.5 opacity-60">
                           <span className="text-[10px] font-black uppercase tracking-widest">Video</span>
                           <span className="text-[10px]">•</span>
                           <span className="text-[10px] font-bold">12:30</span>
                        </div>
                      </div>
                    </Link>
                  );
                })}
              </div>
            )}
          </div>
        ))}
      </div>
    </div>
  );
}
