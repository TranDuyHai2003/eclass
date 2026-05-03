"use client";

import { useState } from "react";
import { ChevronDown, ChevronRight, Lock, PlayCircle, FileText, ClipboardList } from "lucide-react";

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
    if (type === "QUIZ") return <ClipboardList className="w-4 h-4 text-blue-500 flex-shrink-0" />;
    if (!isFree && !isEnrolled) return <Lock className="w-4 h-4 text-gray-400 flex-shrink-0" />;
    if (type === "DOCUMENT") return <FileText className="w-4 h-4 text-orange-500 flex-shrink-0" />;
    return <PlayCircle className="w-4 h-4 text-red-500 flex-shrink-0" />;
  };

  return (
    <div className="space-y-3">
      {chapters.map((chapter, idx) => {
        const isOpen = openIds.has(chapter.id);
        return (
          <div key={chapter.id} className="border border-gray-200 rounded-2xl overflow-hidden">
            {/* Chapter header */}
            <button
              onClick={() => toggle(chapter.id)}
              className="w-full bg-red-50/50 hover:bg-red-50 px-6 py-4 flex items-center justify-between transition-colors"
            >
              <div className="flex items-center gap-4">
                <span className="w-8 h-8 rounded-full bg-red-600 text-white flex items-center justify-center font-bold text-sm flex-shrink-0">
                  {String.fromCharCode(65 + idx)}
                </span>
                <h3 className="font-bold text-gray-900 uppercase tracking-tight text-left">
                  {chapter.title}
                </h3>
              </div>
              <div className="flex items-center gap-2 flex-shrink-0">
                <span className="px-3 py-1 bg-red-100 text-red-700 rounded-full text-xs font-bold">
                  {chapter.lessons.length} bài
                </span>
                {isOpen ? (
                  <ChevronDown className="w-4 h-4 text-gray-500 transition-transform" />
                ) : (
                  <ChevronRight className="w-4 h-4 text-gray-400 transition-transform" />
                )}
              </div>
            </button>

            {/* Lesson list */}
            {isOpen && (
              <ul className="divide-y divide-gray-100">
                {chapter.lessons.map((lesson, lIdx) => {
                  const accessible = lesson.isFree || isEnrolled;
                  return (
                    <li
                      key={lesson.id}
                      className={`flex items-center gap-4 px-6 py-3 ${
                        accessible ? "hover:bg-gray-50" : "opacity-60"
                      } transition-colors`}
                    >
                      {/* Index */}
                      <span className="text-xs text-gray-400 font-bold w-5 text-center flex-shrink-0">
                        {lIdx + 1}
                      </span>

                      {/* Icon */}
                      {getLessonIcon(lesson.type, lesson.isFree, isEnrolled)}

                      {/* Title */}
                      <span className="text-sm text-gray-800 font-medium flex-1 text-left">
                        {lesson.title}
                      </span>

                      {/* Badge */}
                      <div className="flex items-center gap-2 flex-shrink-0">
                        {lesson.isFree && (
                          <span className="px-2 py-0.5 bg-green-100 text-green-700 text-[10px] font-bold rounded-full uppercase tracking-wide">
                            Miễn phí
                          </span>
                        )}
                        {lesson.type === "QUIZ" && (
                          <span className="px-2 py-0.5 bg-blue-100 text-blue-700 text-[10px] font-bold rounded-full uppercase tracking-wide">
                            Quiz
                          </span>
                        )}
                        {lesson.duration && (
                          <span className="text-xs text-gray-400">
                            {Math.round(lesson.duration / 60)} ph
                          </span>
                        )}
                      </div>
                    </li>
                  );
                })}
              </ul>
            )}
          </div>
        );
      })}
    </div>
  );
}
