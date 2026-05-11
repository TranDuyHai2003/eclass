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
  Layout,
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
  progress?: number;
  isEnrolled?: boolean;
  className?: string;
};

export default function CourseSidebar({
  course,
  currentLessonId,
  progress = 0,
  isEnrolled = false,
  className,
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

  return (
    <div className={cn("bg-white border-none h-full flex flex-col overflow-hidden", className)}>
      {/* Sidebar Header - Professional Progress */}
      <div className="p-6 bg-white sticky top-0 z-10">
        <div className="flex items-center gap-2 mb-4">
           <Layout className="w-4 h-4 text-red-600" />
           <h3 className="font-black text-slate-900 text-[11px] uppercase tracking-[0.2em]">Nội dung khóa học</h3>
        </div>
        <div className="space-y-3">
          <div className="flex items-center justify-between text-[10px] font-black uppercase tracking-widest">
            <span className="text-slate-400">Tiến độ của bạn</span>
            <span className="text-red-600 bg-red-50 px-2 py-0.5 rounded-md">{progress}%</span>
          </div>
          <div className="w-full bg-slate-100 rounded-full h-2.5 overflow-hidden p-0.5 shadow-inner">
            <div
              className="bg-gradient-to-r from-red-600 to-orange-500 h-full rounded-full transition-all duration-1000 shadow-[0_0_8px_rgba(239,68,68,0.2)]"
              style={{ width: `${progress}%` }}
            />
          </div>
        </div>
      </div>

      {/* Course Curriculum - Smooth Scroll */}
      <div className="overflow-y-auto flex-1 custom-scrollbar p-3 space-y-2">
        {course.chapters.map((chapter) => (
          <div
            key={chapter.id}
            className="rounded-[24px] overflow-hidden bg-slate-50/30 transition-all"
          >
            <button
              onClick={() => toggleChapter(chapter.id)}
              className={cn(
                "w-full flex items-center justify-between py-5 px-6 transition-all hover:bg-slate-50",
                openChapters[chapter.id] ? "bg-white" : "bg-transparent",
              )}
            >
              <div className="flex flex-col items-start gap-1">
                 <span className="text-[10px] font-black text-red-600 uppercase tracking-[0.15em]">Chương {chapter.position}</span>
                 <span className="font-black text-[15px] text-slate-900 text-left line-clamp-1 uppercase tracking-tight">
                    {chapter.title}
                 </span>
              </div>
              <div className={cn(
                "w-8 h-8 rounded-full flex items-center justify-center transition-all",
                openChapters[chapter.id] ? "bg-red-50 text-red-600" : "bg-slate-100 text-slate-400"
              )}>
                <ChevronDown
                  className={cn(
                    "w-4 h-4 transition-transform duration-500",
                    openChapters[chapter.id] && "transform rotate-180",
                  )}
                />
              </div>
            </button>

            {/* Lessons List */}
            {openChapters[chapter.id] && (
              <div className="flex flex-col p-2 gap-1 animate-in fade-in slide-in-from-top-2 duration-300">
                {chapter.lessons.map((lesson) => {
                  const isActive = lesson.id === currentLessonId;
                  const isLocked = !isEnrolled && !lesson.isFree;

                  return (
                    <Link
                      key={lesson.id}
                      href={isLocked ? `/courses/${course.id}` : `/watch/${lesson.id}`}
                      className={cn(
                        "flex items-center gap-x-4 py-4 px-4 text-[14px] transition-all relative group rounded-2xl",
                        isActive
                          ? "bg-white text-red-600 shadow-sm"
                          : "text-slate-500 hover:bg-white hover:text-slate-900 border border-transparent",
                        isLocked && "opacity-60 cursor-not-allowed",
                      )}
                    >
                      <div className="flex-shrink-0">
                        {isActive ? (
                          <div className="bg-red-600 rounded-xl p-2.5 shadow-lg shadow-red-200">
                            <PlayCircle className="w-4 h-4 text-white fill-current" />
                          </div>
                        ) : isLocked ? (
                          <div className="bg-slate-100 rounded-xl p-2.5">
                            <Lock className="w-4 h-4 text-slate-400" />
                          </div>
                        ) : (
                          <div className="bg-white rounded-xl p-2.5 transition-colors group-hover:bg-red-50 shadow-sm">
                            {lesson.type === 'QUIZ' ? (
                               <HelpCircle className="w-4 h-4 text-slate-400 group-hover:text-red-600" />
                            ) : lesson.type === 'DOCUMENT' ? (
                               <FileText className="w-4 h-4 text-slate-400 group-hover:text-red-600" />
                            ) : (
                               <Video className="w-4 h-4 text-slate-400 group-hover:text-red-600" />
                            )}
                          </div>
                        )}
                      </div>

                      <div className="flex-1 min-w-0">
                        <p
                          className={cn(
                            "font-bold line-clamp-1 leading-tight tracking-tight text-[14px]",
                            isActive ? "text-slate-900" : "text-slate-600 group-hover:text-slate-900"
                          )}
                        >
                          {lesson.title}
                        </p>
                        <div className="flex items-center gap-2 mt-1.5 opacity-60">
                           <span className="text-[9px] font-black uppercase tracking-widest">
                              {lesson.type === 'QUIZ' ? 'Kiểm tra' : lesson.type === 'DOCUMENT' ? 'Tài liệu' : 'Video'}
                           </span>
                           {lesson.isFree && !isEnrolled && (
                             <>
                               <span className="text-[9px]">•</span>
                               <span className="text-[9px] font-black text-emerald-600">Miễn phí</span>
                             </>
                           )}
                        </div>
                      </div>

                      {lesson.isCompleted && !isActive && (
                        <div className="bg-emerald-50 rounded-full p-1">
                           <CheckCircle className="w-3.5 h-3.5 text-emerald-500" />
                        </div>
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
