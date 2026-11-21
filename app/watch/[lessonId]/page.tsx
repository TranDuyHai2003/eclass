import { prisma } from "@/lib/prisma";
import VideoPlayer from "@/components/player/VideoPlayer";
import CourseSidebar from "@/components/course/CourseSidebar";
import { auth } from "@/auth";
import { notFound, redirect } from "next/navigation";
import Link from "next/link";
import { ChevronLeft, ChevronRight, Home, MessageSquare } from "lucide-react";
import { cn } from "@/lib/utils";
import QuizEntryCard from "./_components/QuizEntryCard";
import { CourseProgressButton } from "@/components/course/CourseProgressButton";
import { PDFViewerClientWrapper } from "@/components/course/PDFViewerClientWrapper";
import { CommentSection } from "@/components/comment/CommentSection";
import { WatchPanels } from "./_components/WatchPanels";

export default async function WatchPage({
  params,
  searchParams,
}: {
  params: Promise<{ lessonId: string }>;
  searchParams: Promise<{ v?: string }>;
}) {
  const session = await auth();
  if (!session?.user) return redirect("/login");

  const { lessonId } = await params;
  const { v } = await searchParams;

  // 1. Fetch Lesson with course ownership
  const lesson = await prisma.lesson.findUnique({
    where: { id: lessonId },
    include: {
      chapter: {
        include: { course: true },
      },
      attachments: true,
      test: true,
    },
  });

  if (!lesson) return notFound();
  const courseId = lesson.chapter.courseId;

  // Determine which video to play
  const isHomeworkVideo = v === "homework";
  const activeVideoUrl = isHomeworkVideo
    ? lesson.homeworkVideoUrl
    : lesson.videoUrl;
  const activeTitle = isHomeworkVideo
    ? `Hướng dẫn: ${lesson.title}`
    : lesson.title;

  // 2. Access Control Check
  const isAdmin = session.user.role === "ADMIN";
  const isTeacher = session.user.role === "TEACHER" || isAdmin;
  const isApproved = (session.user as any).isApproved || isTeacher;
  const isOwner = lesson.chapter.course.userId === session.user.id;

  if (!isApproved && !isOwner) {
    // If not approved and not the owner/admin/teacher, they can't watch.
    // In this model, they probably shouldn't even reach here, but good for safety.
    return redirect("/profile"); // Or a specific "Not Approved" page
  }

  // Enrollment is no longer strictly used for access, but we set it to ACTIVE to keep UI components happy
  const enrollment = { status: "ACTIVE" };

  // 4. Fetch Course Full Data with Curriculum Details
  const course = await prisma.course.findUnique({
    where: { id: courseId },
    include: {
      chapters: {
        orderBy: { position: "asc" },
        include: {
          lessons: {
            orderBy: { position: "asc" },
            include: {
              progress: {
                where: { userId: session.user.id },
              },
              test: {
                select: { id: true, title: true, duration: true },
              },
              attachments: true,
              homeworkSubmissions: {
                where: { userId: session.user.id }
              }
            },
          },
        },
      },
    },
  });

  if (!course) return notFound();

  const currentProgress = await prisma.progress.findUnique({
    where: {
      userId_lessonId: {
        userId: session.user.id!,
        lessonId,
      },
    },
  });

  const courseLessonIds = course.chapters.flatMap((c) =>
    c.lessons.map((l) => l.id),
  );
  const completedInCourse = await prisma.progress.count({
    where: {
      userId: session.user.id!,
      lessonId: { in: courseLessonIds },
      isCompleted: true,
    },
  });
  const progressPercent =
    courseLessonIds.length > 0
      ? Math.round((completedInCourse / courseLessonIds.length) * 100)
      : 0;

  const courseData = {
    ...course,
    chapters: course.chapters.map((chap) => ({
      ...chap,
      lessons: chap.lessons.map((less) => ({
        ...less,
        isCompleted: !!less.progress[0]?.isCompleted,
        test: less.test,
        attachments: less.attachments,
        hasHomework: less.hasHomework,
        homeworkVideoUrl: less.homeworkVideoUrl,
        homeworkSubmission: less.homeworkSubmissions[0] || null,
      })),
    })),
  };

  const quizDuration = lesson.test?.duration || 15;
  const commentCount = await prisma.comment.count({ where: { lessonId } });

  const currentAttempt = await prisma.studentAttempt.findFirst({
    where: {
      testId: lesson.test?.id,
      userId: session.user.id!,
      completedAt: { not: null },
    },
    orderBy: { startedAt: "desc" },
  });

  const hasPdfDocument =
    lesson.type === "DOCUMENT" && lesson.attachments.some((a) => a.url.toLowerCase().endsWith(".pdf"));

  const flatLessons = course.chapters.flatMap((c) => c.lessons.map((l) => ({ id: l.id, title: l.title })));
  const lessonIndex = flatLessons.findIndex((l) => l.id === lessonId);
  const prevLesson = lessonIndex > 0 ? flatLessons[lessonIndex - 1] : null;
  const nextLesson = lessonIndex >= 0 && lessonIndex < flatLessons.length - 1 ? flatLessons[lessonIndex + 1] : null;
  const typeLabel = isHomeworkVideo
    ? "Hướng dẫn bài tập"
    : activeVideoUrl
      ? "Video bài giảng"
      : lesson.type === "QUIZ"
        ? "Bài kiểm tra"
        : "Tài liệu";
  const pdfAttachment = lesson.attachments.find((a) => a.url.toLowerCase().endsWith(".pdf"));
  const navBtn =
    "inline-flex h-11 w-11 shrink-0 items-center justify-center rounded-2xl border-2 border-blue-100 bg-white text-blue-600 transition-colors hover:border-blue-300 hover:bg-blue-50 sm:w-auto sm:gap-1.5 sm:px-3.5 sm:text-sm sm:font-bold";
  const navBtnDisabled =
    "inline-flex h-11 w-11 shrink-0 items-center justify-center rounded-2xl border-2 border-slate-100 bg-slate-50 text-slate-300 sm:w-auto sm:gap-1.5 sm:px-3.5 sm:text-sm sm:font-bold";

  return (
    <div className="flex flex-col min-h-screen bg-[#F5F8FF] font-sans selection:bg-blue-100 selection:text-blue-900">
      {/* Đường dẫn: gọn 1 dòng (tiến độ đã có trong khối nội dung khoá học) */}
      <div className="sticky top-0 z-40 bg-white/80 backdrop-blur-xl border-b border-blue-100/70 px-3 sm:px-6 py-2.5">
        <nav aria-label="Đường dẫn" className="max-w-[1600px] w-full mx-auto flex items-center gap-2 text-xs sm:text-[13px] font-semibold text-slate-500 min-w-0">
          <Link href="/" className="flex items-center gap-1.5 hover:text-blue-600 transition-colors py-1 shrink-0">
            <Home className="w-3.5 h-3.5" />
            <span className="hidden sm:inline">Trang chủ</span>
          </Link>
          <ChevronRight className="w-3 h-3 text-slate-300 shrink-0" />
          <Link href="/courses" className="hover:text-blue-600 transition-colors py-1 shrink-0">
            Khoá học
          </Link>
          <ChevronRight className="w-3 h-3 text-slate-300 shrink-0" />
          <Link href={`/courses/${courseId}`} className="text-blue-600 font-bold truncate hover:underline min-w-0">
            {course.title}
          </Link>
        </nav>
      </div>

      <div className="flex-1 max-w-[1600px] w-full mx-auto px-2 py-3 sm:p-4">
        <div className="grid grid-cols-1 xl:grid-cols-[minmax(0,1fr)_380px] 2xl:grid-cols-[minmax(0,1fr)_420px] xl:grid-rows-[auto_auto_auto_1fr] gap-3 sm:gap-4 xl:gap-5 items-start">
          {/* Video / PDF / thẻ vào làm bài */}
          <div
            className={cn(
              "w-full min-w-0 relative shadow-xl shadow-blue-900/5 rounded-2xl sm:rounded-3xl overflow-hidden bg-slate-950",
              activeVideoUrl || hasPdfDocument
                ? "aspect-video"
                : "min-h-[320px] sm:min-h-[420px] flex flex-col items-stretch justify-center py-4 sm:py-6",
            )}
          >
            {activeVideoUrl ? (
              <VideoPlayer src={activeVideoUrl} title={activeTitle} poster={course.thumbnail || undefined} />
            ) : lesson.type === "QUIZ" ? (
              <QuizEntryCard
                lessonId={lessonId}
                course={course}
                lesson={lesson}
                duration={quizDuration}
                test={lesson.test}
                currentAttempt={currentAttempt}
              />
            ) : lesson.type === "DOCUMENT" && pdfAttachment ? (
              <div className="w-full h-full bg-slate-100 overflow-hidden">
                <PDFViewerClientWrapper url={pdfAttachment.url} />
              </div>
            ) : (
              <div className="w-full h-full bg-gradient-to-br from-slate-900 to-slate-800 flex items-center justify-center p-8 relative overflow-hidden text-white">
                <div className="absolute top-0 right-0 w-64 h-64 bg-blue-500/10 blur-[100px] rounded-full" />
                <div className="absolute bottom-0 left-0 w-64 h-64 bg-blue-600/10 blur-[100px] rounded-full" />
                <div className="relative z-10 flex flex-col items-center gap-6 text-center">
                  {course.thumbnail && (
                    <div className="relative w-40 h-40 sm:w-48 sm:h-48 rounded-2xl sm:rounded-3xl overflow-hidden shadow-2xl border-4 border-white/10 shrink-0">
                      <img src={course.thumbnail} alt={course.title} className="w-full h-full object-cover" />
                    </div>
                  )}
                  <div className="space-y-3">
                    <h2 className="text-2xl sm:text-3xl font-black tracking-tight leading-tight">{course.title}</h2>
                    <p className="text-base sm:text-lg font-bold text-slate-400">{activeTitle}</p>
                  </div>
                </div>
              </div>
            )}
          </div>

          {/* Tên bài + hành động: Bài trước · Hoàn thành · Bài sau */}
          <section
            data-testid="lesson-info"
            className="min-w-0 bg-white rounded-3xl border-2 border-blue-100/80 shadow-[0_4px_0_0_#e3ecff] p-4 sm:p-6 flex flex-col lg:flex-row lg:items-center justify-between gap-4"
          >
            <div className="min-w-0 space-y-1.5">
              <div className="flex flex-wrap items-center gap-x-2 gap-y-1 text-xs font-semibold text-slate-500">
                <span className="px-2 py-0.5 bg-blue-50 text-blue-700 rounded-lg font-bold border border-blue-100">
                  {typeLabel}
                </span>
                <span className="min-w-0 truncate max-w-full">
                  {lesson.chapter.title || `Chương ${lesson.chapter.position + 1}`}
                </span>
                {lessonIndex >= 0 && (
                  <span className="shrink-0 text-slate-400">
                    · Bài {lessonIndex + 1}/{flatLessons.length}
                  </span>
                )}
              </div>
              <h1 className="text-lg sm:text-2xl font-extrabold text-slate-900 tracking-tight leading-snug break-words">
                {activeTitle}
              </h1>
              {lesson.description && (
                <p className="text-slate-500 text-sm leading-relaxed max-w-2xl">{lesson.description}</p>
              )}
            </div>
            <div className="flex items-center gap-2 shrink-0">
              {prevLesson ? (
                <Link href={`/watch/${prevLesson.id}`} className={navBtn} title={`Bài trước: ${prevLesson.title}`} aria-label="Bài trước">
                  <ChevronLeft className="w-5 h-5" />
                  <span className="hidden sm:inline">Trước</span>
                </Link>
              ) : (
                <span className={navBtnDisabled} aria-hidden>
                  <ChevronLeft className="w-5 h-5" />
                  <span className="hidden sm:inline">Trước</span>
                </span>
              )}
              <div className="flex-1 lg:flex-none">
                <CourseProgressButton
                  lessonId={lessonId}
                  courseId={courseId}
                  isCompleted={!!currentProgress?.isCompleted}
                />
              </div>
              {nextLesson ? (
                <Link href={`/watch/${nextLesson.id}`} className={navBtn} title={`Bài sau: ${nextLesson.title}`} aria-label="Bài sau">
                  <span className="hidden sm:inline">Tiếp</span>
                  <ChevronRight className="w-5 h-5" />
                </Link>
              ) : (
                <span className={navBtnDisabled} aria-hidden>
                  <span className="hidden sm:inline">Tiếp</span>
                  <ChevronRight className="w-5 h-5" />
                </span>
              )}
            </div>
          </section>

          <WatchPanels
            progress={progressPercent}
            commentCount={commentCount}
            curriculum={
              <div className="bg-white rounded-3xl border-2 border-blue-100/80 shadow-[0_4px_0_0_#e3ecff] overflow-hidden flex flex-col xl:max-h-[calc(100vh-76px)]">
                <CourseSidebar
                  course={courseData as any}
                  currentLessonId={lessonId}
                  progress={progressPercent}
                  completedCount={completedInCourse}
                  totalCount={courseLessonIds.length}
                  isEnrolled={!!enrollment}
                  className="h-auto min-h-0 flex-1 bg-transparent"
                />
              </div>
            }
            discussion={
              <section className="bg-white rounded-3xl border-2 border-blue-100/80 shadow-[0_4px_0_0_#e3ecff] p-4 sm:p-6">
                <div className="flex items-center justify-between mb-4">
                  <div className="flex items-center gap-2.5">
                    <div className="w-9 h-9 bg-blue-50 rounded-xl flex items-center justify-center text-blue-600">
                      <MessageSquare className="w-5 h-5" />
                    </div>
                    <h2 className="font-extrabold text-slate-900 text-base">Thảo luận</h2>
                    <span className="text-xs font-black text-blue-600 bg-blue-50 px-2 py-0.5 rounded-full">{commentCount}</span>
                  </div>
                  <span className="hidden sm:inline text-xs font-medium text-slate-400">Hỏi thầy và các bạn về bài này</span>
                </div>
                <CommentSection lessonId={lessonId} />
              </section>
            }
          />
        </div>
      </div>
    </div>
  );
}
