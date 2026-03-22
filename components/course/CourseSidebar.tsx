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
        if (ch.lessons.some((l) => l.id === currentLessonId)) {
          initialState[ch.id] = true;
        }
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
    <div className="bg-white border rounded-2xl shadow-sm overflow-hidden flex flex-col max-h-[calc(100vh-100px)]">
      {/* Header Sidebar */}
      <div className="p-5 border-b bg-white z-10">
        <h3 className="font-bold text-gray-900 mb-1">Nội dung khóa học</h3>
        <div className="flex items-center justify-between text-xs text-gray-500 mb-2">
          <span>Đã hoàn thành {progress}%</span>
          <span>3/12 bài</span>
        </div>
        {/* Progress Bar */}
        <div className="w-full bg-gray-100 rounded-full h-1.5 overflow-hidden">
          <div
            className="bg-red-600 h-1.5 rounded-full transition-all duration-500"
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
                "w-full flex items-center justify-between p-4 transition-colors hover:bg-gray-50",
                openChapters[chapter.id] ? "bg-gray-50/50" : "bg-white",
              )}
            >
              <span className="font-semibold text-sm text-gray-800 text-left line-clamp-1">
                {chapter.title}
              </span>
              <ChevronDown
                className={cn(
                  "w-4 h-4 text-gray-400 transition-transform duration-200",
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
                        "flex items-start gap-x-3 py-3 px-4 text-sm transition-all relative group",
                        isActive
                          ? "bg-red-100/50 text-red-700 border-r-4 border-red-600"
                          : "text-gray-600 hover:bg-gray-100 hover:text-gray-900",
                        isLocked &&
                          "opacity-70 cursor-not-allowed hover:bg-transparent",
                      )}
                    >
                      <div className="mt-0.5">
                        {isActive ? (
                          <div className="bg-red-600 rounded-full p-1 animate-pulse">
                            <PlayCircle className="w-3 h-3 text-white fill-current" />
                          </div>
                        ) : isLocked ? (
                          <Lock className="w-4 h-4 text-gray-400" />
                        ) : (
                          // Nếu completed thì hiện CheckCircle, chưa thì hiện Video Icon
                          <Video className="w-4 h-4 text-gray-400 group-hover:text-red-500" />
                        )}
                      </div>

                      <div className="flex-1">
                        <p
                          className={cn(
                            "font-medium line-clamp-2",
                            isActive && "font-bold",
                          )}
                        >
                          {lesson.title}
                        </p>
                        <span className="text-[10px] text-gray-400 font-normal">
                          12:30 {/* Duration giả định */}
                        </span>
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
