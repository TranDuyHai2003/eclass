"use client";
import { useState, useEffect } from "react";
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
  Download,
  BookOpen,
  Upload,
  Send,
  X,
  Loader2,
} from "lucide-react";
import { cn } from "@/lib/utils";
import axios from "axios";
import { toast } from "sonner";
import { submitHomework } from "@/actions/homework";

type Attachment = {
  id: string;
  name: string;
  url: string;
};

type Lesson = {
  id: string;
  title: string;
  position: number;
  type?: string;
  isCompleted?: boolean;
  isFree?: boolean;
  hasHomework?: boolean;
  attachments?: Attachment[];
  test?: {
    id: string;
    duration: number;
  } | null;
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
  // Automatically open the chapter containing the current lesson
  const [openChapters, setOpenChapters] = useState<Record<string, boolean>>(
    () => {
      const initialState: Record<string, boolean> = {};
      course.chapters.forEach((ch, index) => {
        const hasActiveLesson = ch.lessons.some(
          (l) => l.id === currentLessonId,
        );
        initialState[ch.id] = hasActiveLesson || index === 0;
      });
      return initialState;
    },
  );
  // Keep track of which lesson's content is expanded
  const [expandedLessons, setExpandedLessons] = useState<
    Record<string, boolean>
  >(() => {
    const initialState: Record<string, boolean> = {};
    initialState[currentLessonId] = true;
    return initialState;
  });

  const [activeHomeworkLessonId, setActiveHomeworkLessonId] = useState<string | null>(null);
  const [inlineAttachments, setInlineAttachments] = useState<{ name: string; url: string }[]>([]);
  const [isUploading, setIsUploading] = useState(false);
  const [isSubmitting, setIsSubmitting] = useState(false);

  const handleInlineUpload = async (lessonId: string, e: React.ChangeEvent<HTMLInputElement>) => {
    const files = e.target.files;
    if (!files || files.length === 0) return;

    setIsUploading(true);
    try {
      const newAttachments = [...inlineAttachments];
      for (let i = 0; i < files.length; i++) {
        const file = files[i];
        const res = await axios.put<{ publicUrl: string }>(
          `/api/upload/proxy?fileName=homework_${Date.now()}_${encodeURIComponent(file.name)}`,
          file,
          { headers: { "Content-Type": file.type } }
        );
        newAttachments.push({ name: file.name, url: res.data.publicUrl });
      }
      setInlineAttachments(newAttachments);
      toast.success("Tải tệp lên thành công");
    } catch (error) {
      toast.error("Lỗi tải tệp lên");
    } finally {
      setIsUploading(false);
    }
  };

  const handleInlineSubmit = async (lessonId: string) => {
    if (inlineAttachments.length === 0) {
      toast.error("Vui lòng tải lên ít nhất một tệp");
      return;
    }

    setIsSubmitting(true);
    try {
      const res = await submitHomework(lessonId, inlineAttachments);
      if (res.success) {
        toast.success("Nộp bài tập thành công!");
        setInlineAttachments([]);
        setActiveHomeworkLessonId(null);
        setTimeout(() => {
          window.location.reload();
        }, 1000);
      }
    } catch (err) {
      toast.error("Lỗi khi nộp bài");
    } finally {
      setIsSubmitting(false);
    }
  };

  // Sync expansion with active lesson when currentLessonId changes
  useEffect(() => {
    if (currentLessonId) {
      setExpandedLessons((prev) => ({ ...prev, [currentLessonId]: true }));
      // Also ensure the chapter is open
      const targetChapter = course.chapters.find((ch) =>
        ch.lessons.some((l) => l.id === currentLessonId),
      );
      if (targetChapter) {
        setOpenChapters((prev) => ({ ...prev, [targetChapter.id]: true }));
      }
    }
  }, [currentLessonId, course.chapters]);

  const toggleChapter = (id: string) => {
    setOpenChapters((prev) => ({ ...prev, [id]: !prev[id] }));
  };

  const toggleLesson = (id: string) => {
    setExpandedLessons((prev) => ({ ...prev, [id]: !prev[id] }));
  };

  return (
    <div
      className={cn(
        "bg-white border-none h-full flex flex-col overflow-hidden",
        className,
      )}
    >
      {/* Sidebar Header - Professional Progress */}
      <div className="p-6 bg-white sticky top-0 z-10">
        <div className="flex items-center gap-2 mb-4">
          <Layout className="w-4 h-4 text-red-600" />
          <h3 className="font-black text-slate-900 text-[11px] uppercase tracking-[0.2em]">
            Nội dung khóa học
          </h3>
        </div>
        <div className="space-y-3">
          <div className="flex items-center justify-between text-[10px] font-black uppercase tracking-widest">
            <span className="text-slate-400">Tiến độ của bạn</span>
            <span className="text-red-600 bg-red-50 px-2 py-0.5 rounded-md">
              {progress}%
            </span>
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
                openChapters[chapter.id]
                  ? "bg-white border-b border-slate-100"
                  : "bg-transparent",
              )}
            >
              <div className="flex flex-col items-start gap-1">
                <span className="font-black text-[14px] text-red-600 text-left line-clamp-1 uppercase tracking-tight">
                  {chapter.title && chapter.title !== `Chương ${chapter.position + 1}`
                    ? chapter.title
                    : `Chương ${chapter.position + 1}`}
                </span>
              </div>
              <div
                className={cn(
                  "w-8 h-8 rounded-full flex items-center justify-center transition-all",
                  openChapters[chapter.id]
                    ? "bg-red-50 text-red-600"
                    : "bg-slate-100 text-slate-400",
                )}
              >
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
              <div className="flex flex-col p-2 gap-1 animate-in fade-in duration-300">
                {chapter.lessons.map((lesson) => {
                  const isActive = lesson.id === currentLessonId;
                  const isLocked = !isEnrolled && !lesson.isFree;
                  const isExpanded = !!expandedLessons[lesson.id];
                  const hasExtras =
                    (lesson.attachments && lesson.attachments.length > 0) ||
                    lesson.test ||
                    lesson.hasHomework;

                  return (
                    <div key={lesson.id} className="space-y-1">
                      <div
                        className={cn(
                          "flex items-center gap-1 group rounded-2xl transition-all",
                          isActive
                            ? "bg-white shadow-sm ring-1 ring-red-100"
                            : "hover:bg-white",
                        )}
                      >
                        <Link
                          href={isLocked ? "/courses" : `/watch/${lesson.id}`}
                          className={cn(
                            "flex-1 flex items-center gap-x-4 py-4 px-4 text-[14px] transition-all relative",
                            isActive ? "text-red-600" : "text-slate-500",
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
                              <div className="bg-slate-100 rounded-xl p-2.5 group-hover:bg-red-50 transition-colors">
                                {lesson.type === "QUIZ" ? (
                                  <HelpCircle className="w-4 h-4 text-slate-400 group-hover:text-red-600" />
                                ) : lesson.type === "DOCUMENT" ? (
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
                                isActive
                                  ? "text-slate-900"
                                  : "text-slate-600 group-hover:text-slate-900",
                              )}
                            >
                              {lesson.title}
                            </p>
                            <div className="flex items-center gap-2 mt-1.5 opacity-60">
                              <span className="text-[9px] font-black uppercase tracking-widest">
                                {lesson.type === "QUIZ"
                                  ? "Kiểm tra"
                                  : lesson.type === "DOCUMENT"
                                    ? "Tài liệu"
                                    : "Video"}
                              </span>
                              {lesson.isFree && !isEnrolled && (
                                <>
                                  <span className="text-[9px]">•</span>
                                  <span className="text-[9px] font-black text-emerald-600">
                                    Miễn phí
                                  </span>
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

                        {hasExtras && (
                          <button
                            onClick={(e) => {
                              e.preventDefault();
                              toggleLesson(lesson.id);
                            }}
                            className={cn(
                              "w-10 h-10 rounded-xl flex items-center justify-center transition-all shrink-0 mr-2 hover:bg-slate-50",
                              isExpanded ? "text-red-600" : "text-slate-300",
                            )}
                          >
                            <ChevronDown
                              className={cn(
                                "w-4 h-4 transition-transform duration-300",
                                isExpanded && "rotate-180",
                              )}
                            />
                          </button>
                        )}
                      </div>

                      {/* Nested Content (Quiz, Documents, Homework) */}
                      {isExpanded && hasExtras && (
                        <div className="ml-14 pb-4 space-y-1.5 pr-2 animate-in fade-in slide-in-from-top-2 duration-300">
                          {lesson.test && (
                            <Link
                              href={`/watch/${lesson.id}/quiz`}
                              className="flex items-center gap-3 p-3 bg-white border border-red-50 rounded-xl hover:text-red-600 transition-all group/sub shadow-sm"
                            >
                              <div className="w-7 h-7 bg-red-50 text-red-500 rounded-lg flex items-center justify-center shrink-0 group-hover/sub:bg-red-500 group-hover/sub:text-white transition-colors">
                                <BookOpen className="w-3.5 h-3.5" />
                              </div>
                              <span className="text-xs font-bold uppercase tracking-tight">
                                Bài tập Quiz củng cố
                              </span>
                            </Link>
                          )}
                          {lesson.hasHomework && (
                            <div className="space-y-2">
                              <button
                                onClick={() => {
                                  if (activeHomeworkLessonId === lesson.id) {
                                    setActiveHomeworkLessonId(null);
                                    setInlineAttachments([]);
                                  } else {
                                    setActiveHomeworkLessonId(lesson.id);
                                    setInlineAttachments([]);
                                  }
                                }}
                                className={cn(
                                  "w-full flex items-center gap-3 p-3 bg-white border rounded-xl transition-all group/sub shadow-sm text-left",
                                  activeHomeworkLessonId === lesson.id
                                    ? "border-blue-500 text-blue-600 bg-blue-50/10"
                                    : "border-blue-50 hover:text-blue-600"
                                )}
                              >
                                <div className={cn(
                                  "w-7 h-7 rounded-lg flex items-center justify-center shrink-0 transition-colors",
                                  activeHomeworkLessonId === lesson.id
                                    ? "bg-blue-500 text-white"
                                    : "bg-blue-50 text-blue-500 group-hover/sub:bg-blue-500 group-hover/sub:text-white"
                                )}>
                                  <Upload className="w-3.5 h-3.5" />
                                </div>
                                <span className="text-xs font-bold uppercase tracking-tight flex-1">
                                  Nộp bài tập (Tự luận)
                                </span>
                              </button>

                              {/* Inline Uploader Box */}
                              {activeHomeworkLessonId === lesson.id && (
                                <div className="p-4 bg-slate-50 rounded-xl border border-blue-100 space-y-3 animate-in slide-in-from-top-2 duration-300">
                                  {/* List of uploaded files */}
                                  {inlineAttachments.length > 0 && (
                                    <div className="space-y-1.5">
                                      {inlineAttachments.map((file, idx) => (
                                        <div key={idx} className="flex items-center gap-2 p-2 bg-white border border-slate-100 rounded-lg text-[10px]">
                                          <FileText className="w-3.5 h-3.5 text-red-500 shrink-0" />
                                          <span className="font-bold text-slate-700 truncate flex-1">{file.name}</span>
                                          <button
                                            onClick={() => setInlineAttachments(prev => prev.filter((_, i) => i !== idx))}
                                            className="p-1 rounded bg-red-50 text-red-500"
                                          >
                                            <X className="w-2.5 h-2.5" />
                                          </button>
                                        </div>
                                      ))}
                                    </div>
                                  )}

                                  {/* Input Field */}
                                  <div className="flex gap-2">
                                    <label className="flex-1 cursor-pointer">
                                      <div className="h-10 border border-dashed border-blue-200 rounded-lg flex items-center justify-center gap-2 bg-white hover:bg-blue-50 transition-colors">
                                        {isUploading ? (
                                          <Loader2 className="w-3.5 h-3.5 text-blue-600 animate-spin" />
                                        ) : (
                                          <Upload className="w-3.5 h-3.5 text-blue-400" />
                                        )}
                                        <span className="text-[10px] font-black text-slate-500 uppercase tracking-tight">
                                          {isUploading ? "Đang tải..." : "Chọn file"}
                                        </span>
                                      </div>
                                      <input 
                                        type="file" 
                                        multiple 
                                        className="hidden" 
                                        accept="image/*,application/pdf" 
                                        onChange={(e) => handleInlineUpload(lesson.id, e)}
                                        disabled={isUploading || isSubmitting}
                                      />
                                    </label>

                                    <button
                                      onClick={() => handleInlineSubmit(lesson.id)}
                                      disabled={isSubmitting || isUploading || inlineAttachments.length === 0}
                                      className="px-4 h-10 rounded-lg bg-blue-600 hover:bg-blue-700 text-white font-black uppercase text-[10px] tracking-widest flex items-center gap-1.5 disabled:opacity-50"
                                    >
                                      {isSubmitting ? (
                                        <Loader2 className="w-3 h-3 animate-spin" />
                                      ) : (
                                        <Send className="w-3 h-3" />
                                      )}
                                      Gửi
                                    </button>
                                  </div>
                                </div>
                              )}
                            </div>
                          )}
                          {lesson.attachments?.map((att) => (
                            <a
                              key={att.id}
                              href={att.url}
                              target="_blank"
                              className="flex items-center gap-3 p-3 bg-white border border-slate-50 rounded-xl hover:text-slate-900 transition-all group/sub shadow-sm"
                            >
                              <div className="w-7 h-7 bg-slate-100 text-slate-500 rounded-lg flex items-center justify-center shrink-0 group-hover/sub:bg-slate-900 group-hover/sub:text-white transition-colors">
                                <FileText className="w-3.5 h-3.5" />
                              </div>
                              <span className="text-xs font-bold uppercase tracking-tight truncate">
                                {att.name}
                              </span>
                              <Download className="w-3 h-3 text-slate-300 ml-auto" />
                            </a>
                          ))}
                        </div>
                      )}
                    </div>
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
