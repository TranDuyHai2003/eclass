"use client";
import { useState, useEffect } from "react";
import Link from "next/link";
import { useRouter, useSearchParams } from "next/navigation";
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
  Eye,
  Loader2,
  Play,
  CirclePlay,
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
  videoUrl?: string | null;
  homeworkVideoUrl?: string | null;
  isCompleted?: boolean;
  isFree?: boolean;
  hasHomework?: boolean;
  homeworkSubmission?: {
    id: string;
    status: string;
    attachments: any;
    feedback: string | null;
  } | null;
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
  isEnrolled = true,
  className,
}: CourseSidebarProps) {
  const router = useRouter();
  const searchParams = useSearchParams();

  // Use isEnrolled as a proxy for 'isApproved' in this component's scope
  const isApproved = isEnrolled;
  
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
  const [uploadProgress, setUploadProgress] = useState(0);
  const [isSubmitting, setIsSubmitting] = useState(false);

  const homeworkStatusConfig = {
    PENDING: { text: "Đang chờ duyệt", color: "text-amber-600", bg: "bg-amber-50", border: "border-amber-100" },
    SATISFACTORY: { text: "Đạt yêu cầu", color: "text-emerald-600", bg: "bg-emerald-50", border: "border-emerald-100" },
    UNSATISFACTORY: { text: "Chưa đạt yêu cầu", color: "text-rose-600", bg: "bg-rose-50", border: "border-rose-100" }
  };

  const handleInlineUpload = async (lessonId: string, e: React.ChangeEvent<HTMLInputElement>) => {
    const files = e.target.files;
    if (!files || files.length === 0) return;

    setIsUploading(true);
    setUploadProgress(0);
    try {
      const newAttachments = [...inlineAttachments];
      for (let i = 0; i < files.length; i++) {
        const file = files[i];
        const res = await axios.put<{ publicUrl: string }>(
          `/api/upload/proxy?fileName=homework_${Date.now()}_${encodeURIComponent(file.name)}`,
          file,
          {
            headers: { "Content-Type": file.type },
            onUploadProgress: (e) => {
              if (e.total) {
                const filePercent = Math.round((e.loaded / e.total) * 100);
                const overall = Math.round((i / files.length) * 100 + filePercent / files.length);
                setUploadProgress(overall);
              }
            },
          }
        );
        newAttachments.push({ name: file.name, url: res.data.publicUrl });
      }
      setInlineAttachments(newAttachments);
      toast.success("Tải tệp lên thành công");
    } catch (error) {
      toast.error("Lỗi tải tệp lên");
    } finally {
      setIsUploading(false);
      setUploadProgress(0);
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
        router.refresh();
      }
    } catch (err: any) {
      toast.error(err.message || "Lỗi khi nộp bài");
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
        "bg-white h-full flex flex-col overflow-hidden",
        className,
      )}
    >
      {/* Sidebar Header - Enhanced Typography */}
      <div className="p-4 sm:p-5 border-b border-slate-50/60">
        <div className="flex items-center gap-3 mb-4">
          <div className="w-8 h-8 bg-blue-600 rounded-xl flex items-center justify-center text-white shadow-lg shadow-blue-100">
            <Layout className="w-4 h-4" />
          </div>
          <h3 className="font-black text-slate-900 text-xs uppercase tracking-widest">
            Học phần khóa học
          </h3>
        </div>
        <div className="space-y-3">
          <div className="flex items-center justify-between text-[10px] font-black uppercase tracking-widest">
            <span className="text-slate-400">Tiến độ hoàn thành</span>
            <span className="text-blue-600 font-black">
              {progress}%
            </span>
          </div>
          <div className="w-full bg-slate-100 rounded-full h-2 overflow-hidden shadow-inner">
            <div
              className="bg-blue-600 h-full rounded-full transition-all duration-1000"
              style={{ width: `${progress}%` }}
            />
          </div>
        </div>
      </div>

      {/* Course Curriculum - Refined Items */}
      <div className="overflow-y-auto flex-1 custom-scrollbar p-4 space-y-4">
        {course.chapters.map((chapter) => (
          <div
            key={chapter.id}
            className="group/chapter"
          >
            <button
              onClick={() => toggleChapter(chapter.id)}
              className={cn(
                "w-full flex items-center justify-between py-4 px-5 rounded-[1.5rem] transition-all border border-transparent",
                openChapters[chapter.id]
                  ? "bg-slate-900 text-white shadow-xl shadow-slate-200"
                  : "bg-slate-50 text-slate-700 hover:bg-slate-100",
              )}
            >
              <div className="flex items-center gap-3">
                 <div className={cn(
                   "w-6 h-6 rounded-lg flex items-center justify-center text-[10px] font-black",
                   openChapters[chapter.id] ? "bg-white/20 text-white" : "bg-slate-200 text-slate-500"
                 )}>
                   {chapter.position + 1}
                 </div>
                 <span className="font-black text-xs uppercase tracking-tight text-left line-clamp-1">
                  {chapter.title || `Chương ${chapter.position + 1}`}
                </span>
              </div>
              <ChevronDown
                className={cn(
                  "w-4 h-4 transition-transform duration-500 opacity-60",
                  openChapters[chapter.id] && "transform rotate-180 opacity-100",
                )}
              />
            </button>

            {/* Lessons List */}
            {openChapters[chapter.id] && (
              <div className="mt-2 ml-2 pl-4 border-l-2 border-slate-100 space-y-1 py-1 animate-in slide-in-from-left-2 duration-300">
                {chapter.lessons.map((lesson) => {
                  const isActive = lesson.id === currentLessonId;
                  const isLocked = !isEnrolled && !lesson.isFree;
                  const isExpanded = !!expandedLessons[lesson.id];
                  
                  const isTutorialActive = searchParams.get("v") === "homework" && isActive;
                  const isMainVideoActive = isActive && !searchParams.get("v");

                  const hasExtras =
                    (lesson.attachments && lesson.attachments.length > 0) ||
                    lesson.test ||
                    lesson.hasHomework ||
                    !!lesson.homeworkVideoUrl;

                  return (
                    <div key={lesson.id} className="space-y-1">
                      <div
                        className={cn(
                          "flex items-center group rounded-2xl transition-all",
                          isMainVideoActive
                            ? "bg-blue-50/50 shadow-sm"
                            : "hover:bg-slate-50",
                        )}
                      >
                        <Link
                          href={isLocked ? `/courses/${course.id}` : `/watch/${lesson.id}`}
                          onClick={(e) => {
                            if (isMainVideoActive) {
                              e.preventDefault();
                              if (hasExtras) toggleLesson(lesson.id);
                            }
                            if (isLocked) {
                               e.preventDefault();
                               toast.error("Vui lòng chờ Admin kích hoạt tài khoản để học bài này.");
                            }
                          }}
                          className={cn(
                            "flex-1 flex items-center gap-x-3.5 py-3.5 px-4 text-sm transition-all",
                            isMainVideoActive ? "text-blue-700" : "text-slate-600",
                            isLocked && "opacity-60 cursor-not-allowed",
                          )}
                        >
                          <div className="flex-shrink-0">
                            {isMainVideoActive ? (
                              <div className="w-8 h-8 bg-blue-600 rounded-xl flex items-center justify-center text-white shadow-lg shadow-blue-100">
                                <CirclePlay className="w-4 h-4" />
                              </div>
                            ) : isLocked ? (
                              <div className="w-8 h-8 bg-slate-100 rounded-xl flex items-center justify-center text-slate-400">
                                <Lock className="w-3.5 h-3.5" />
                              </div>
                            ) : (
                              <div className="w-8 h-8 bg-slate-50 rounded-xl flex items-center justify-center text-slate-400 group-hover:bg-white group-hover:text-blue-500 transition-colors shadow-sm">
                                {lesson.type === "QUIZ" ? (
                                  <HelpCircle className="w-3.5 h-3.5" />
                                ) : lesson.type === "DOCUMENT" ? (
                                  <FileText className="w-3.5 h-3.5" />
                                ) : (
                                  <Play className="w-3.5 h-3.5" />
                                )}
                              </div>
                            )}
                          </div>

                          <div className="flex-1 min-w-0">
                            <p
                              className={cn(
                                "font-bold text-[13px] line-clamp-1 leading-tight tracking-tight",
                                isMainVideoActive
                                  ? "text-slate-900"
                                  : "text-slate-600 group-hover:text-slate-900",
                              )}
                            >
                              {lesson.title}
                            </p>
                            <div className="flex items-center gap-2 mt-1">
                               <span className="text-[8px] font-black uppercase tracking-widest text-slate-400">
                                 {lesson.type === "QUIZ" ? "Quiz" : lesson.type === "DOCUMENT" ? "PDF" : "Bài giảng"}
                               </span>
                               {lesson.isFree && !isEnrolled && (
                                 <span className="text-[8px] font-black text-emerald-600 bg-emerald-50 px-1.5 py-0.5 rounded uppercase">Free</span>
                               )}
                            </div>
                          </div>

                          {lesson.isCompleted && !isActive && (
                            <div className="w-5 h-5 bg-emerald-500 rounded-full flex items-center justify-center shadow-lg shadow-emerald-100">
                              <CheckCircle className="w-3 h-3 text-white" />
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
                              "w-10 h-10 rounded-xl flex items-center justify-center transition-all shrink-0 mr-1",
                              (isExpanded || isTutorialActive) ? "text-blue-600" : "text-slate-300 hover:text-slate-600 hover:bg-slate-50",
                            )}
                          >
                            <ChevronDown
                              className={cn(
                                "w-4 h-4 transition-transform duration-300",
                                (isExpanded || isTutorialActive) && "rotate-180",
                              )}
                            />
                          </button>
                        )}
                      </div>

                      {/* Nested Content - Premium Styling */}
                      {(isExpanded || isTutorialActive) && (hasExtras || lesson.videoUrl || lesson.homeworkVideoUrl) && (
                        <div className="ml-8 pb-3 space-y-1.5 pr-2 animate-in fade-in slide-in-from-top-1 duration-300">
                          {/* 1. File tài liệu */}
                          {lesson.attachments && lesson.attachments.length > 0 && (
                            <a
                              href={lesson.attachments[0].url}
                              target="_blank"
                              className="flex items-center gap-3 p-3 bg-white border border-slate-100 rounded-2xl hover:border-slate-200 hover:shadow-md transition-all group/sub"
                            >
                              <div className="w-7 h-7 bg-slate-50 text-slate-500 rounded-lg flex items-center justify-center shrink-0 group-hover/sub:bg-slate-900 group-hover/sub:text-white transition-colors">
                                <FileText className="w-3.5 h-3.5" />
                              </div>
                              <span className="text-[11px] font-black uppercase tracking-tight truncate text-slate-600 group-hover/sub:text-slate-900">
                                File tài liệu bài học
                              </span>
                              <Download className="w-3 h-3 text-slate-300 ml-auto group-hover/sub:text-blue-600" />
                            </a>
                          )}

                          {/* 2. Thực chiến bài tập về nhà */}
                          {lesson.homeworkVideoUrl && (
                            <Link
                              href={`/watch/${lesson.id}?v=homework`}
                              className={cn(
                                "flex items-center gap-3 p-3 bg-white border rounded-2xl transition-all group/sub",
                                isTutorialActive 
                                  ? "border-blue-500 bg-blue-50/20 shadow-lg shadow-blue-500/5" 
                                  : "border-slate-100 hover:border-blue-200"
                              )}
                            >
                              <div className={cn(
                                "w-7 h-7 rounded-lg flex items-center justify-center shrink-0 transition-all",
                                isTutorialActive ? "bg-blue-600 text-white" : "bg-slate-50 text-blue-500 group-hover/sub:bg-blue-500 group-hover/sub:text-white"
                              )}>
                                <Video className="w-3.5 h-3.5" />
                              </div>
                              <span className={cn(
                                "text-[11px] font-black uppercase tracking-tight",
                                isTutorialActive ? "text-blue-700" : "text-slate-600 group-hover/sub:text-slate-900"
                              )}>
                                Thực chiến bài tập về nhà
                              </span>
                            </Link>
                          )}

                          {/* 3. Quiz */}
                          {lesson.test && (
                            <Link
                              href={`/watch/${lesson.id}/quiz`}
                              className="flex items-center gap-3 p-3 bg-white border border-slate-100 rounded-2xl hover:border-blue-200 transition-all group/sub"
                            >
                              <div className="w-7 h-7 bg-slate-50 text-blue-600 rounded-lg flex items-center justify-center shrink-0 group-hover/sub:bg-blue-500 group-hover/sub:text-white transition-colors">
                                <BookOpen className="w-3.5 h-3.5" />
                              </div>
                              <span className="text-[11px] font-black uppercase tracking-tight text-slate-600 group-hover/sub:text-slate-900">
                                Nộp bài tập & Chấm điểm
                              </span>
                            </Link>
                          )}

                          {/* 4. Homework Submission */}
                          {lesson.hasHomework && (
                            <div className="space-y-2">
                              <button
                                onClick={() => {
                                  if (activeHomeworkLessonId === lesson.id) {
                                    setActiveHomeworkLessonId(null);
                                    setInlineAttachments([]);
                                  } else {
                                    setActiveHomeworkLessonId(lesson.id);
                                    // Load existing attachments into the list for editing
                                    if (lesson.homeworkSubmission?.attachments) {
                                      setInlineAttachments(lesson.homeworkSubmission.attachments as any[]);
                                    } else {
                                      setInlineAttachments([]);
                                    }
                                  }
                                }}
                                className={cn(
                                  "w-full flex items-center gap-3 p-3 bg-white border rounded-2xl transition-all group/sub",
                                  activeHomeworkLessonId === lesson.id
                                    ? "border-blue-500 bg-blue-50/10"
                                    : "border-slate-100 hover:border-blue-200"
                                )}
                              >
                                <div className={cn(
                                  "w-7 h-7 rounded-lg flex items-center justify-center shrink-0 transition-colors",
                                  activeHomeworkLessonId === lesson.id
                                    ? "bg-blue-600 text-white"
                                    : "bg-slate-50 text-blue-500 group-hover/sub:bg-blue-500 group-hover/sub:text-white"
                                )}>
                                  <Upload className="w-3.5 h-3.5" />
                                </div>
                                <span className="text-[11px] font-black uppercase tracking-tight flex-1 text-left text-slate-600 group-hover/sub:text-slate-900">
                                  Nộp lại bài chữa (Tự luận)
                                </span>

                                {lesson.homeworkSubmission && (
                                   <div className={cn(
                                     "px-2 py-0.5 rounded-md text-[8px] font-black uppercase tracking-widest border shrink-0",
                                     homeworkStatusConfig[lesson.homeworkSubmission.status as keyof typeof homeworkStatusConfig].bg,
                                     homeworkStatusConfig[lesson.homeworkSubmission.status as keyof typeof homeworkStatusConfig].color,
                                     homeworkStatusConfig[lesson.homeworkSubmission.status as keyof typeof homeworkStatusConfig].border
                                   )}>
                                      {homeworkStatusConfig[lesson.homeworkSubmission.status as keyof typeof homeworkStatusConfig].text}
                                   </div>
                                )}
                              </button>

                              {/* Inline Uploader Box */}
                              {activeHomeworkLessonId === lesson.id && (
                                <div className="p-4 bg-slate-50/50 rounded-2xl border border-blue-100 space-y-3 animate-in slide-in-from-top-2 duration-300">
                                  {/* Giáo viên nhận xét */}
                                  {lesson.homeworkSubmission?.feedback && (
                                    <div className="p-3 bg-blue-50/50 rounded-xl border border-blue-100 space-y-1.5">
                                      <p className="text-[9px] font-black text-blue-600 uppercase tracking-widest">Nhận xét từ giáo viên:</p>
                                      <p className="text-xs font-medium text-slate-600 italic leading-relaxed">"{lesson.homeworkSubmission.feedback}"</p>
                                    </div>
                                  )}

                                  {/* List of attachments */}
                                  {inlineAttachments.length > 0 && (
                                    <div className="space-y-1.5">
                                      {inlineAttachments.map((file, idx) => {
                                        // Check if this file was already in the submission
                                        const isExisting = lesson.homeworkSubmission?.attachments?.some(
                                          (existing: any) => existing.url === file.url
                                        );
                                        const canDelete = !lesson.homeworkSubmission || lesson.homeworkSubmission.status === "PENDING" || lesson.homeworkSubmission.status === "UNSATISFACTORY";

                                        return (
                                          <div key={idx} className="flex items-center gap-2 p-2 bg-white border border-slate-100 rounded-xl text-[10px]">
                                            <FileText className="w-3.5 h-3.5 text-blue-500 shrink-0" />
                                            <div className="flex-1 min-w-0">
                                              <span className="font-bold text-slate-700 truncate block">{file.name}</span>
                                              <span className={cn(
                                                "text-[8px] font-black uppercase",
                                                isExisting ? "text-slate-400" : "text-blue-500"
                                              )}>
                                                {isExisting ? "Đã nộp" : "Mới thêm"}
                                              </span>
                                            </div>
                                            <div className="flex items-center gap-1">
                                              <a href={file.url} target="_blank" className="p-1 rounded bg-slate-50 text-slate-400 hover:text-blue-600 transition-colors">
                                                <Eye className="w-2.5 h-2.5" />
                                              </a>
                                              {canDelete && (
                                                <button
                                                  onClick={() => setInlineAttachments(prev => prev.filter((_, i) => i !== idx))}
                                                  className="p-1 rounded bg-rose-50 text-rose-500 hover:bg-rose-100 transition-colors"
                                                >
                                                  <X className="w-2.5 h-2.5" />
                                                </button>
                                              )}
                                            </div>
                                          </div>
                                        );
                                      })}
                                    </div>
                                  )}

                                  {/* Input Field & Submit - Only if not SATISFACTORY */}
                                  {(!lesson.homeworkSubmission || lesson.homeworkSubmission.status === "PENDING" || lesson.homeworkSubmission.status === "UNSATISFACTORY") ? (
                                    <div className="space-y-2">
                                      <div className="flex gap-2">
                                        <label className="flex-1 cursor-pointer">
                                          <div className="h-10 border border-dashed border-blue-200 rounded-xl flex items-center justify-center gap-2 bg-white hover:bg-blue-50 transition-colors">
                                            {isUploading ? (
                                              <>
                                                <Loader2 className="w-3.5 h-3.5 text-blue-600 animate-spin shrink-0" />
                                                <div className="flex items-center gap-1.5">
                                                  <div className="w-16 h-1.5 bg-blue-100 rounded-full overflow-hidden">
                                                    <div
                                                      className="h-full bg-blue-600 rounded-full transition-all duration-300"
                                                      style={{ width: `${uploadProgress}%` }}
                                                    />
                                                  </div>
                                                  <span className="text-[9px] font-black text-blue-600 tabular-nums">
                                                    {uploadProgress}%
                                                  </span>
                                                </div>
                                              </>
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
                                          className="px-4 h-10 rounded-xl bg-blue-600 hover:bg-blue-700 text-white font-black uppercase text-[10px] tracking-widest flex items-center gap-1.5 disabled:opacity-50 shadow-lg shadow-blue-100"
                                        >
                                          {isSubmitting ? (
                                            <Loader2 className="w-3 h-3 animate-spin" />
                                          ) : (
                                            <Send className="w-3 h-3" />
                                          )}
                                          Nộp bài
                                        </button>
                                      </div>
                                    </div>
                                  ) : (
                                    <div className="p-3 bg-blue-50/50 rounded-xl border border-blue-100 text-center">
                                       <p className="text-[9px] font-black text-blue-600 uppercase tracking-widest">Bài làm đã được duyệt</p>
                                       <p className="text-[8px] font-bold text-slate-400 uppercase mt-1">Không thể chỉnh sửa tệp đã nộp</p>
                                    </div>
                                  )}
                                </div>
                              )}
                            </div>
                          )}
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
