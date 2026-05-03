"use client";

import { useState } from "react";
import Link from "next/link";
import {
  ChevronDown,
  PlayCircle,
  Lock,
  CheckCircle,
  Video,
  FileText,
  HelpCircle,
} from "lucide-react";
import { cn } from "@/lib/utils";

type Lesson = {
  id: string;
  title: string;
  position: number;
  type?: string;
  isCompleted?: boolean;
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
  // Automatically open the first chapter or the one containing the current lesson
  const [openChapters, setOpenChapters] = useState<Record<string, boolean>>(
    () => {
      const initialState: Record<string, boolean> = {};
      course.chapters.forEach((ch, index) => {
        const hasActiveLesson = ch.lessons.some(l => l.id === currentLessonId);
        // Open the chapter if it has the active lesson, OR if it's the first chapter
        initialState[ch.id] = hasActiveLesson || index === 0;
      });
      return initialState;
    },
  );

  const toggleChapter = (id: string) => {
    setOpenChapters((prev) => ({ ...prev, [id]: !prev[id] }));
  };

  const progress = 35; // Mock progress

  return (
    <div className="bg-white border-none h-full flex flex-col overflow-hidden">
      {/* Sidebar Header - Professional Progress */}
      <div className="p-5 md:p-6 bg-white border-b border-slate-50 sticky top-0 z-10 backdrop-blur-md">
        <h3 className="font-black text-slate-900 mb-4 text-[11px] uppercase tracking-[0.2em]">Tiến độ lộ trình</h3>
        <div className="space-y-2">
          <div className="flex items-center justify-between text-[9px] font-black uppercase tracking-widest">
            <span className="text-slate-400">Hoàn thành</span>
            <span className="text-red-600 bg-red-50 px-2 py-0.5 rounded-md">{progress}%</span>
          </div>
          <div className="w-full bg-slate-100 rounded-full h-2 overflow-hidden p-0.5 border border-slate-200/50 shadow-inner">
            <div
              className="bg-gradient-to-r from-red-600 to-orange-500 h-full rounded-full transition-all duration-1000 shadow-[0_0_8px_rgba(239,68,68,0.2)]"
              style={{ width: `${progress}%` }}
            />
          </div>
        </div>
      </div>

      {/* Course Curriculum - Smooth Scroll */}
      <div className="overflow-y-auto flex-1 custom-scrollbar px-1 py-2 space-y-1">
        {course.chapters.map((chapter) => (
          <div
            key={chapter.id}
            className="rounded-2xl overflow-hidden border border-transparent transition-all"
          >
            <button
              onClick={() => toggleChapter(chapter.id)}
              className={cn(
                "w-full flex items-center justify-between py-4 px-5 transition-all hover:bg-slate-50 rounded-xl",
                openChapters[chapter.id] ? "bg-slate-50/50" : "bg-white",
              )}
            >
              <div className="flex flex-col items-start gap-1">
                 <span className="text-[10px] font-black text-red-600 uppercase tracking-widest">Chương {chapter.position}</span>
                 <span className="font-black text-[15px] md:text-[16px] text-slate-900 text-left line-clamp-1 uppercase tracking-tight">
                    {chapter.title}
                 </span>
              </div>
              <ChevronDown
                className={cn(
                  "w-4 h-4 text-slate-400 transition-transform duration-500",
                  openChapters[chapter.id] && "transform rotate-180 text-red-600",
                )}
              />
            </button>

            {/* Lessons List */}
            {openChapters[chapter.id] && (
              <div className="flex flex-col pt-1 pb-1 px-1 gap-1 animate-in fade-in slide-in-from-top-1 duration-300">
                {chapter.lessons.map((lesson) => {
                  const isActive = lesson.id === currentLessonId;
                  const isLocked = false;

                  return (
                    <Link
                      key={lesson.id}
                      href={isLocked ? "#" : `/watch/${lesson.id}`}
                      className={cn(
                        "flex items-center gap-x-4 py-4 px-5 text-[14px] transition-all relative group rounded-xl",
                        isActive
                          ? "bg-white text-red-600 shadow-md shadow-slate-200/50 border border-slate-100"
                          : "text-slate-500 hover:bg-slate-50 hover:text-slate-900 border border-transparent",
                        isLocked && "opacity-60 cursor-not-allowed hover:bg-transparent",
                      )}
                    >
                      <div className="flex-shrink-0">
                        {isActive ? (
                          <div className="bg-red-600 rounded-xl p-2 shadow-lg shadow-red-200">
                            <PlayCircle className="w-4 h-4 text-white fill-current" />
                          </div>
                        ) : isLocked ? (
                          <div className="bg-slate-100 rounded-xl p-2">
                            <Lock className="w-4 h-4 text-slate-400" />
                          </div>
                        ) : (
                          <div className="bg-slate-50 group-hover:bg-white rounded-xl p-2 transition-colors border border-transparent group-hover:border-slate-100">
                            {lesson.type === 'QUIZ' ? (
                               <HelpCircle className="w-4 h-4 text-slate-400 group-hover:text-red-600" />
                            ) : (
                               <Video className="w-4 h-4 text-slate-400 group-hover:text-red-600" />
                            )}
                          </div>
                        )}
                      </div>

                      <div className="flex-1 min-w-0">
                        <p
                          className={cn(
                            "font-bold line-clamp-1 leading-tight tracking-tight text-[14px] md:text-[15px]",
                            isActive ? "text-slate-900" : "text-slate-600 group-hover:text-slate-900"
                          )}
                        >
                          {lesson.title}
                        </p>
                        <div className="flex items-center gap-2 mt-1.5 opacity-60">
                           <span className="text-[10px] font-black uppercase tracking-widest">
                              {lesson.type === 'QUIZ' ? 'Kiểm tra' : 'Video'}
                           </span>
                           <span className="text-[10px]">•</span>
                           <span className="text-[10px] font-bold">15:00</span>
                        </div>
                      </div>

                      {lesson.isCompleted && !isActive && (
                        <CheckCircle className="w-4 h-4 text-emerald-500 fill-emerald-50" />
                      )}
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
