"use client";

import { useState } from "react";
import { ChevronDown, ChevronRight, Lock, PlayCircle, FileText, ClipboardList } from "lucide-react";
import { cn } from "@/lib/utils";

interface Lesson {
  id: string;
  title: string;
  isFree: boolean;
  type: string;
  duration: number | null;
}

interface Chapter {
  id: string;
  title: string;
  lessons: Lesson[];
}

interface CourseAccordionProps {
  chapters: Chapter[];
  isEnrolled: boolean;
}

export function CourseAccordion({ chapters, isEnrolled }: CourseAccordionProps) {
  // Open first chapter by default
  const [openIds, setOpenIds] = useState<Set<string>>(
    new Set(chapters.length > 0 ? [chapters[0].id] : [])
  );

  const toggle = (id: string) => {
    setOpenIds((prev) => {
      const next = new Set(prev);
      next.has(id) ? next.delete(id) : next.add(id);
      return next;
    });
  };

  const getLessonIcon = (type: string, isFree: boolean, isEnrolled: boolean) => {
    const accessible = isFree || isEnrolled;
    if (!accessible) return <Lock className="w-4 h-4 text-slate-300" />;
    
    switch(type) {
      case "QUIZ": return <ClipboardList className="w-4 h-4 text-red-600" />;
      case "DOCUMENT": return <FileText className="w-4 h-4 text-red-600" />;
      default: return <PlayCircle className="w-4 h-4 text-red-600" />;
    }
  };

  return (
    <div className="space-y-4">
      {chapters.map((chapter, idx) => {
        const isOpen = openIds.has(chapter.id);
        return (
          <div key={chapter.id} className="group overflow-hidden">
            {/* Chapter header */}
            <button
              onClick={() => toggle(chapter.id)}
              className={cn(
                "w-full px-6 py-5 flex items-center justify-between transition-all rounded-[1.5rem] border",
                isOpen 
                  ? "bg-slate-900 border-slate-900 text-white shadow-xl shadow-slate-200" 
                  : "bg-white border-slate-100 hover:border-red-100 text-slate-900 shadow-sm"
              )}
            >
              <div className="flex items-center gap-4">
                <div className={cn(
                  "w-10 h-10 rounded-2xl flex items-center justify-center font-black text-sm flex-shrink-0 transition-colors",
                  isOpen ? "bg-white/10 text-white" : "bg-red-50 text-red-600"
                )}>
                  {idx + 1}
                </div>
                <div className="flex flex-col items-start">
                   <p className={cn(
                     "text-[9px] font-black uppercase tracking-[0.15em]",
                     isOpen ? "text-white/60" : "text-red-600"
                   )}>Chương {idx + 1}</p>
                   <h3 className="font-black uppercase tracking-tight text-left text-sm sm:text-base line-clamp-1">
                     {chapter.title}
                   </h3>
                </div>
              </div>
              <div className="flex items-center gap-4 flex-shrink-0">
                <span className={cn(
                  "hidden sm:inline-flex px-3 py-1 rounded-full text-[9px] font-black uppercase tracking-widest border",
                  isOpen ? "bg-white/10 border-white/20 text-white" : "bg-slate-50 border-slate-100 text-slate-400"
                )}>
                  {chapter.lessons.length} bài
                </span>
                <ChevronDown className={cn(
                  "w-5 h-5 transition-transform duration-500",
                  isOpen ? "rotate-180 text-white" : "text-slate-400"
                )} />
              </div>
            </button>

            {/* Lesson list */}
            {isOpen && (
              <div className="mt-3 space-y-1 animate-in fade-in slide-in-from-top-2 duration-500">
                {chapter.lessons.map((lesson, lIdx) => {
                  const accessible = lesson.isFree || isEnrolled;
                  return (
                    <div
                      key={lesson.id}
                      className={cn(
                        "flex items-center gap-4 px-6 py-4 rounded-2xl transition-all border border-transparent group/lesson",
                        accessible 
                          ? "hover:bg-slate-50 hover:border-slate-100 cursor-pointer" 
                          : "opacity-60 bg-gray-50/30"
                      )}
                    >
                      {/* Icon */}
                      <div className={cn(
                        "w-10 h-10 rounded-xl flex items-center justify-center flex-shrink-0 transition-colors",
                        accessible ? "bg-white shadow-sm border border-slate-100 group-hover/lesson:bg-red-50 group-hover/lesson:border-red-100" : "bg-slate-100"
                      )}>
                        {getLessonIcon(lesson.type, lesson.isFree, isEnrolled)}
                      </div>

                      {/* Title */}
                      <div className="flex-1 min-w-0">
                        <span className="text-sm font-black text-slate-900 block truncate uppercase tracking-tight">
                          {lesson.title}
                        </span>
                        <div className="flex items-center gap-2 mt-1">
                           <span className="text-[9px] font-black uppercase tracking-widest text-slate-400">
                              {lesson.type === 'QUIZ' ? 'Luyện tập' : lesson.type === 'DOCUMENT' ? 'Tài liệu' : 'Bài giảng Video'}
                           </span>
                           {lesson.isFree && !isEnrolled && (
                             <>
                               <span className="text-[10px] text-slate-300">•</span>
                               <span className="text-[9px] font-black text-emerald-600 uppercase tracking-widest bg-emerald-50 px-2 py-0.5 rounded-md border border-emerald-100">Học thử</span>
                             </>
                           )}
                        </div>
                      </div>

                      {/* Accessible Indicator */}
                      {!accessible && (
                         <div className="px-3 py-1.5 bg-slate-100 rounded-xl text-[9px] font-black uppercase tracking-widest text-slate-400 flex items-center gap-1.5">
                            <Lock className="w-3 h-3" />
                            Đang khóa
                         </div>
                      )}
                      
                      {accessible && (
                         <div className="w-8 h-8 rounded-full flex items-center justify-center text-slate-300 group-hover/lesson:bg-white group-hover/lesson:text-red-600 group-hover/lesson:shadow-sm transition-all">
                            <ChevronRight className="w-4 h-4" />
                         </div>
                      )}
                    </div>
                  );
                })}
              </div>
            )}
          </div>
        );
      })}
    </div>
  );
}
