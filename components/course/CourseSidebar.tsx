"use client";
import { useState, useEffect } from "react";
import Link from "next/link";
import { useRouter, useSearchParams } from "next/navigation";
import {
  ChevronDown,
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
import { compressImage } from "@/lib/compressImage";

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
    attachments: { name: string; url: string }[];
    feedback: string | null;
  } | null;
  attachments?: Attachment[];
  test?: {
    id: string;
    title?: string | null;
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
  /** Số bài đã hoàn thành / tổng số bài (hiện cạnh thanh tiến độ) */
  completedCount?: number;
  totalCount?: number;
  isEnrolled?: boolean;
  className?: string;
};

export default function CourseSidebar({
  course,
  currentLessonId,
  progress = 0,
  completedCount,
  totalCount,
  isEnrolled = true,
  className,
}: CourseSidebarProps) {
  const router = useRouter();
  const searchParams = useSearchParams();

  // Session-aware chapter expansion state:
  // First time entering from outside / non-watch page -> all chapters start collapsed ({})
  // When switching lessons within watch page -> restore saved open chapters state
  const [openChapters, setOpenChapters] = useState<Record<string, boolean>>(
    () => {
      if (typeof window !== "undefined") {
        try {
          const lastPath = sessionStorage.getItem("eclass_last_visited_path");
          const referrer = document.referrer || "";

          const isFromWatchPath = !!(lastPath && lastPath.startsWith("/watch"));
          const isFromWatchReferrer = referrer.includes("/watch/");

          if (isFromWatchPath || isFromWatchReferrer) {
            const savedState = sessionStorage.getItem(`eclass_open_chapters_${course.id}`);
            if (savedState) {
              return JSON.parse(savedState);
            }
          }
        } catch (e) {
          console.error(e);
        }
      }
      // First time entering from non-watch page: start collapsed
      return {};
    },
  );

  // Save open chapters state & current watch path to sessionStorage
  useEffect(() => {
    if (typeof window !== "undefined") {
      try {
        sessionStorage.setItem("eclass_last_visited_path", window.location.pathname);
        sessionStorage.setItem(
          `eclass_open_chapters_${course.id}`,
          JSON.stringify(openChapters),
        );
      } catch (e) {
        console.error(e);
      }
    }
  }, [openChapters, course.id]);

  // Keep track of which lesson's content is expanded
  const [expandedLessons, setExpandedLessons] = useState<
    Record<string, boolean>
  >(() => {
    const initialState: Record<string, boolean> = {};
    initialState[currentLessonId] = true;
    return initialState;
  });

  const [activeHomeworkLessonId, setActiveHomeworkLessonId] = useState<string | null>(null);
  const [inlineAttachments, setInlineAttachments] = useState<{ name: string; url: string; size?: number }[]>([]);
  const [isUploading, setIsUploading] = useState(false);
  const [uploadProgress, setUploadProgress] = useState(0);
  const [isSubmitting, setIsSubmitting] = useState(false);

  const homeworkStatusConfig = {
    PENDING: { text: "Đang chờ duyệt", color: "text-amber-600", bg: "bg-amber-50", border: "border-amber-100" },
    SATISFACTORY: { text: "Đạt yêu cầu", color: "text-emerald-600", bg: "bg-emerald-50", border: "border-emerald-100" },
    UNSATISFACTORY: { text: "Chưa đạt yêu cầu", color: "text-rose-600", bg: "bg-rose-50", border: "border-rose-100" }
  };

  const CHUNK_SIZE = 3;

  const uploadSingleFile = async (
    file: File,
    index: number,
    total: number,
  ): Promise<{ name: string; url: string; size?: number } | null> => {
    try {
      const compressed = await compressImage(file);
      const safeFileName = `homework_${Date.now()}_${Math.random().toString(36).substring(2, 8)}_${encodeURIComponent(compressed.name)}`;
      const res = await axios.put<{ publicUrl: string }>(
        `/api/upload/proxy?fileName=${safeFileName}`,
        compressed,
        {
          headers: { "Content-Type": compressed.type },
          onUploadProgress: (progressEvent) => {
            if (progressEvent.total) {
              const filePercent = Math.round((progressEvent.loaded / progressEvent.total) * 100);
              const overall = Math.round((index / total) * 100 + filePercent / total);
              setUploadProgress(overall);
            }
          },
        },
      );
      if (!res.data?.publicUrl) {
        throw new Error("Server không trả về URL hợp lệ");
      }
      return { name: file.name, url: res.data.publicUrl, size: compressed.size };
    } catch (error) {
      console.error(`[Upload Error] File ${file.name}:`, error);
      const axiosError = error as { response?: { data?: { message?: string } }; message?: string };
      const errorMsg =
        axiosError.response?.data?.message || axiosError.response?.data || axiosError.message || "Lỗi không xác định";
      toast.error(`Ảnh ${file.name} thất bại: ${errorMsg}`);
      return null;
    }
  };

  const handleInlineUpload = async (lessonId: string, e: React.ChangeEvent<HTMLInputElement>) => {
    const files = e.target.files;
    if (!files || files.length === 0) return;

    setIsUploading(true);
    setUploadProgress(0);

    const fileArray = Array.from(files);
    let currentAttachments = [...inlineAttachments];
    let successCount = 0;
    let failCount = 0;

    for (let i = 0; i < fileArray.length; i += CHUNK_SIZE) {
      const chunk = fileArray.slice(i, i + CHUNK_SIZE);
      const results = await Promise.all(
        chunk.map((file, chunkIdx) => uploadSingleFile(file, i + chunkIdx, fileArray.length)),
      );

      for (const result of results) {
        if (result) {
          currentAttachments = [...currentAttachments, result];
          setInlineAttachments(currentAttachments);
          successCount++;
        } else {
          failCount++;
        }
      }
    }

    setIsUploading(false);
    setUploadProgress(0);
    e.target.value = "";

    if (successCount > 0 && failCount === 0) {
      toast.success(`Đã tải lên thành công ${successCount} tệp`);
    } else if (successCount > 0 && failCount > 0) {
      toast.warning(`Tải xong ${successCount} tệp, có ${failCount} tệp bị lỗi`);
    } else if (failCount > 0) {
      toast.error(`Tải lên thất bại: ${failCount} tệp không thể upload`);
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
    } catch (error) {
      toast.error((error as Error).message || "Lỗi khi nộp bài");
    } finally {
      setIsSubmitting(false);
    }
  };

  // Sync expansion with active lesson when currentLessonId changes
  useEffect(() => {
    if (currentLessonId) {
      setExpandedLessons((prev) => ({ ...prev, [currentLessonId]: true }));
    }
  }, [currentLessonId]);

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
      {/* Tiêu đề + tiến độ khoá học */}
      <div className="px-4 pt-4 pb-3 sm:px-5 border-b border-blue-50 shrink-0">
        <div className="flex items-center justify-between gap-3 mb-2.5">
          <h3 className="font-extrabold text-slate-900 text-[15px] flex items-center gap-2 min-w-0">
            <span className="w-7 h-7 bg-blue-600 rounded-lg flex items-center justify-center text-white shrink-0">
              <Layout className="w-3.5 h-3.5" />
            </span>
            <span className="truncate">Nội dung khoá học</span>
          </h3>
          <span className="text-xs font-bold text-slate-500 shrink-0 whitespace-nowrap">
            {totalCount !== undefined && completedCount !== undefined && (
              <>
                {completedCount}/{totalCount} bài ·{" "}
              </>
            )}
            <span className="text-blue-600 font-black">{progress}%</span>
          </span>
        </div>
        <div
          className="w-full bg-blue-50 rounded-full h-2 overflow-hidden"
          role="progressbar"
          aria-valuenow={progress}
          aria-valuemin={0}
          aria-valuemax={100}
          aria-label="Tiến độ khoá học"
        >
          <div className="bg-blue-600 h-full rounded-full transition-all duration-1000" style={{ width: `${progress}%` }} />
        </div>
      </div>

      {/* Course Curriculum - Refined Items */}
      <div className="overflow-y-auto flex-1 min-h-0 custom-scrollbar p-3 sm:p-4 space-y-2">
        {course.chapters.map((chapter) => {
          const isOpen = !!openChapters[chapter.id];
          const doneInChapter = chapter.lessons.filter((l) => l.isCompleted).length;
          const chapterDone = chapter.lessons.length > 0 && doneInChapter === chapter.lessons.length;
          const isCurrentChapter = chapter.lessons.some((l) => l.id === currentLessonId);
          return (
          <div
            key={chapter.id}
            className="group/chapter"
          >
            <button
              type="button"
              onClick={() => toggleChapter(chapter.id)}
              aria-expanded={isOpen}
              data-current-chapter={isCurrentChapter || undefined}
              className={cn(
                "w-full flex items-center justify-between gap-3 py-3 px-3.5 rounded-2xl transition-all border-2 text-left",
                isOpen
                  ? "bg-blue-600 border-blue-600 text-white shadow-[0_3px_0_0_#1e3a8a]"
                  : isCurrentChapter
                    ? "bg-blue-50 border-blue-200 text-slate-900 hover:border-blue-300"
                    : "bg-slate-50 border-transparent text-slate-700 hover:bg-blue-50/60",
              )}
            >
              <div className="flex items-center gap-3 min-w-0">
                <div
                  className={cn(
                    "w-7 h-7 rounded-lg flex items-center justify-center text-xs font-black shrink-0",
                    isOpen
                      ? "bg-white/20 text-white"
                      : chapterDone
                        ? "bg-emerald-500 text-white"
                        : isCurrentChapter
                          ? "bg-blue-600 text-white"
                          : "bg-white text-slate-500 border border-slate-200",
                  )}
                >
                  {chapterDone && !isOpen ? <CheckCircle className="w-4 h-4" /> : chapter.position + 1}
                </div>
                <div className="min-w-0">
                  <span className="block font-bold text-[13px] leading-snug line-clamp-2 break-words">
                    {chapter.title || `Chương ${chapter.position + 1}`}
                  </span>
                  <span
                    className={cn(
                      "flex items-center gap-1.5 text-[11px] font-semibold mt-0.5",
                      isOpen ? "text-blue-100" : "text-slate-400",
                    )}
                  >
                    {doneInChapter}/{chapter.lessons.length} bài
                    {isCurrentChapter && (
                      <span
                        className={cn(
                          "inline-flex items-center gap-1 rounded-full px-1.5 py-px text-[10px] font-bold",
                          isOpen ? "bg-white/20 text-white" : "bg-blue-600 text-white",
                        )}
                      >
                        Đang học
                      </span>
                    )}
                  </span>
                </div>
              </div>
              <ChevronDown
                className={cn(
                  "w-4 h-4 shrink-0 transition-transform duration-300 opacity-60",
                  isOpen && "transform rotate-180 opacity-100",
                )}
              />
            </button>

            {/* Lessons List */}
            {isOpen && (
              <div className="mt-2 ml-2 pl-3 border-l-2 border-blue-100 space-y-1 py-1 animate-in slide-in-from-left-2 duration-300">
                {chapter.lessons.map((lesson) => {
                  const isActive = lesson.id === currentLessonId;
                  const isLocked = !isEnrolled && !lesson.isFree;
                  const isExpanded = !!expandedLessons[lesson.id];
                  
                  const isTutorialActive = searchParams?.get("v") === "homework" && isActive;
                  const isMainVideoActive = isActive && !searchParams?.get("v");

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
                            ? "bg-blue-50 shadow-[inset_3px_0_0_0_#2563eb]"
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
                            "flex-1 min-w-0 flex items-center gap-x-3 py-2.5 px-3 text-sm transition-all",
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
                                "font-bold text-[13px] line-clamp-2 leading-snug",
                                isMainVideoActive
                                  ? "text-slate-900"
                                  : "text-slate-600 group-hover:text-slate-900",
                              )}
                            >
                              {lesson.title}
                            </p>
                            <div className="flex items-center gap-2 mt-1">
                               <span className="text-[11px] font-semibold text-slate-400">
                                 {lesson.type === "QUIZ" ? "Kiểm tra" : lesson.type === "DOCUMENT" ? "Tài liệu PDF" : "Bài giảng"}
                               </span>
                               {lesson.isFree && !isEnrolled && (
                                 <span className="text-[10px] font-black text-emerald-600 bg-emerald-50 px-1.5 py-0.5 rounded">Free</span>
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
                              <span className="text-[11px] font-bold truncate text-slate-600 group-hover/sub:text-slate-900">
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
                                "text-[11px] font-bold",
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
                              <div className="flex flex-col min-w-0">
                                <span className="text-[11px] font-bold text-slate-600 group-hover/sub:text-slate-900 truncate">
                                  {lesson.test.title || "Nộp bài tập & Chấm điểm"}
                                </span>
                                <span className="text-[11px] font-bold text-blue-600">
                                  {lesson.test.title ? "Làm bài tập & Chấm điểm" : "Bài kiểm tra"}
                                </span>
                              </div>
                            </Link>
                          )}

                          {/* 4. Homework Submission */}
                          {lesson.hasHomework && (
                            <div className="space-y-2">
                              <button
                                onClick={() => {
                                  if (isUploading) return;
                                  if (activeHomeworkLessonId === lesson.id) {
                                    setActiveHomeworkLessonId(null);
                                    setInlineAttachments([]);
                                  } else {
                                    setActiveHomeworkLessonId(lesson.id);
                                    if (lesson.homeworkSubmission?.attachments) {
                                      setInlineAttachments(lesson.homeworkSubmission.attachments);
                                    } else {
                                      setInlineAttachments([]);
                                    }
                                  }
                                }}
                                className={cn(
                                  "w-full flex items-center gap-3 p-3 bg-white border rounded-2xl transition-all group/sub",
                                  activeHomeworkLessonId === lesson.id
                                    ? "border-blue-500 bg-blue-50/10"
                                    : "border-slate-100 hover:border-blue-200",
                                  isUploading && "opacity-50 cursor-not-allowed"
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
                                <span className="text-[11px] font-bold flex-1 text-left text-slate-600 group-hover/sub:text-slate-900">
                                  Nộp lại bài chữa (Tự luận)
                                </span>

                                {lesson.homeworkSubmission && (
                                   <div className={cn(
                                     "px-2 py-0.5 rounded-md text-[10px] font-black border shrink-0",
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
                                      <p className="text-[11px] font-black text-blue-600">Nhận xét từ giáo viên:</p>
                                      <p className="text-xs font-medium text-slate-600 italic leading-relaxed">&ldquo;{lesson.homeworkSubmission.feedback}&rdquo;</p>
                                    </div>
                                  )}

                                  {/* List of attachments */}
                                  {inlineAttachments.length > 0 && (
                                    <div className="space-y-1.5">
                                      {inlineAttachments.map((file, idx) => {
                                        // Check if this file was already in the submission
                                        const isExisting = lesson.homeworkSubmission?.attachments?.some(
                                          (existing) => existing.url === file.url
                                        );
                                        const canDelete = !isUploading && (!lesson.homeworkSubmission || lesson.homeworkSubmission.status === "PENDING" || lesson.homeworkSubmission.status === "UNSATISFACTORY");

                                        return (
                                          <div key={idx} className="flex items-center gap-2 p-2 bg-white border border-slate-100 rounded-xl text-[10px]">
                                            <FileText className="w-3.5 h-3.5 text-blue-500 shrink-0" />
                                            <div className="flex-1 min-w-0">
                                              <span className="font-bold text-slate-700 truncate block">{file.name}</span>
                                              <span className={cn(
                                                "text-[10px] font-black",
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
                                                  <span className="text-[11px] font-black text-blue-600 tabular-nums">
                                                    {uploadProgress}%
                                                  </span>
                                                </div>
                                              </>
                                            ) : (
                                              <Upload className="w-3.5 h-3.5 text-blue-400" />
                                            )}
                                            <span className="text-[10px] font-black text-slate-500">
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
                                          className="px-4 h-10 rounded-xl bg-blue-600 hover:bg-blue-700 text-white font-bold text-xs tracking-widest flex items-center gap-1.5 disabled:opacity-50 shadow-lg shadow-blue-100"
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
                                       <p className="text-[11px] font-black text-blue-600">Bài làm đã được duyệt</p>
                                       <p className="text-[10px] font-bold text-slate-400 mt-1">Không thể chỉnh sửa tệp đã nộp</p>
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
          );
        })}
      </div>
    </div>
  );
}
