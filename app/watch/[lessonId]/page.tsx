import { prisma } from "@/lib/prisma";
import VideoPlayer from "@/components/player/VideoPlayer";
import CourseSidebar from "@/components/course/CourseSidebar";
import { DocumentViewer } from "@/components/course/DocumentViewer";
import { auth } from "@/auth";
import { notFound, redirect } from "next/navigation";
import Link from "next/link";
import {
  BookOpen,
  ChevronRight,
  Home,
  FileText,
  Download,
  MessageSquare,
  ArrowLeft,
  GraduationCap,
  ListVideo,
} from "lucide-react";
import { cn } from "@/lib/utils";
import QuizEntryCard from "./_components/QuizEntryCard";
import { CourseProgressButton } from "@/components/course/CourseProgressButton";
import { PDFViewerClientWrapper } from "@/components/course/PDFViewerClientWrapper";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { CommentSection } from "@/components/comment/CommentSection";
import { MobileCommentsSheet } from "./_components/MobileCommentsSheet";
import Image from "next/image";

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
                select: { id: true, duration: true },
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

  return (
    <div className="flex flex-col min-h-screen bg-[#F8FAFC] font-sans selection:bg-blue-100 selection:text-blue-900">
      {/* PREMIUM BREADCRUMB NAVIGATION */}
      <div className="sticky top-0 z-40 bg-white/70 backdrop-blur-xl border-b border-slate-200/60 px-6 py-3">
        <div className="max-w-[1400px] w-full mx-auto flex items-center justify-between">
          <div className="flex items-center gap-3 text-[11px] sm:text-xs font-bold uppercase tracking-tight text-slate-400">
            <Link
              href="/"
              className="flex items-center gap-1.5 hover:text-blue-600 transition-colors py-1"
            >
              <Home className="w-3.5 h-3.5" />
              <span className="hidden sm:inline">Trang chủ</span>
            </Link>
            <ChevronRight className="w-3 h-3 text-slate-300" />
            <Link
              href="/courses"
              className="hover:text-blue-600 transition-colors py-1"
            >
              Khóa học
            </Link>
            <ChevronRight className="w-3 h-3 text-slate-300" />
            <span className="text-blue-600 font-black truncate max-w-[200px] sm:max-w-md">
              {course.title}
            </span>
          </div>

          <div className="flex items-center gap-4">
            <div className="hidden md:flex items-center gap-2">
              <span className="text-[10px] font-black text-slate-400 uppercase tracking-widest">
                Tiến độ:
              </span>
              <div className="w-32 h-1.5 bg-slate-100 rounded-full overflow-hidden">
                <div
                  className="h-full bg-blue-600 rounded-full transition-all duration-1000"
                  style={{ width: `${progressPercent}%` }}
                />
              </div>
              <span className="text-[10px] font-black text-blue-600">
                {progressPercent}%
              </span>
            </div>
          </div>
        </div>
      </div>

      {/* MAIN CONTENT AREA */}
      <div className="flex-1 max-w-[1600px] w-full mx-auto p-2 sm:p-4">
        <div className="grid grid-cols-1 xl:grid-cols-12 gap-4 lg:gap-6 items-start">
          {/* 1. Left Area (Col 9): Player & Details */}
          <div className="xl:col-span-9 space-y-4 sm:space-y-6 min-w-0">
            {/* Aspect Ratio Player Panel */}
            <div className="aspect-video w-full relative shadow-2xl shadow-blue-900/5 rounded-2xl sm:rounded-3xl overflow-hidden bg-slate-950 border border-white">
              {activeVideoUrl ? (
                <VideoPlayer
                  src={activeVideoUrl}
                  title={activeTitle}
                  poster={course.thumbnail || undefined}
                />
              ) : lesson.type === "QUIZ" ? (
                <QuizEntryCard
                  lessonId={lessonId}
                  course={course}
                  lesson={lesson}
                  duration={quizDuration}
                  test={lesson.test}
                  currentAttempt={currentAttempt}
                />
              ) : lesson.type === "DOCUMENT" &&
                lesson.attachments.find((a) =>
                  a.url.toLowerCase().endsWith(".pdf"),
                ) ? (
                <div className="w-full h-full bg-slate-100 overflow-hidden">
                  <PDFViewerClientWrapper
                    url={
                      lesson.attachments.find((a) =>
                        a.url.toLowerCase().endsWith(".pdf"),
                      )!.url
                    }
                  />
                </div>
              ) : (
                <div className="w-full h-full bg-gradient-to-br from-slate-900 to-slate-800 flex items-center justify-center p-8 relative overflow-hidden text-white">
                  <div className="absolute top-0 right-0 w-64 h-64 bg-blue-500/10 blur-[100px] rounded-full" />
                  <div className="absolute bottom-0 left-0 w-64 h-64 bg-blue-600/10 blur-[100px] rounded-full" />
                  <div className="relative z-10 flex flex-col items-center gap-6 text-center">
                    {course.thumbnail && (
                      <div className="relative w-40 h-40 sm:w-48 sm:h-48 rounded-2xl sm:rounded-3xl overflow-hidden shadow-2xl border-4 border-white/10 shrink-0">
                        <img
                          src={course.thumbnail}
                          alt={course.title}
                          className="w-full h-full object-cover"
                        />
                      </div>
                    )}
                    <div className="space-y-3">
                      <div className="inline-flex items-center gap-2 px-3 py-1 bg-blue-500/10 border border-blue-500/20 rounded-full">
                        <div className="w-1.5 h-1.5 bg-blue-500 rounded-full animate-pulse" />
                        <span className="text-[10px] font-black uppercase tracking-widest text-blue-400">
                          Khóa học cao cấp
                        </span>
                      </div>
                      <h2 className="text-3xl sm:text-4xl font-black tracking-tight uppercase leading-tight">
                        {course.title}
                      </h2>
                      <p className="text-lg font-bold text-slate-400">
                        {activeTitle}
                      </p>
                    </div>
                  </div>
                </div>
              )}
            </div>

            {/* Lesson Info Card */}
            <div className="bg-white rounded-[2.5rem] border border-slate-200/60 p-5 sm:p-7 shadow-sm flex flex-col md:flex-row md:items-center justify-between gap-5">
              <div className="space-y-1">
                <div className="flex items-center gap-2 mb-1">
                  <span className="px-2 py-0.5 bg-blue-50 text-blue-600 rounded-md text-[10px] font-black uppercase tracking-widest border border-blue-100">
                    {isHomeworkVideo
                      ? "Hướng dẫn"
                      : lesson.type === "VIDEO"
                        ? "Bài giảng"
                        : lesson.type === "QUIZ"
                          ? "Kiểm tra"
                          : "Tài liệu"}
                  </span>
                  <span className="text-slate-300">•</span>
                  <span className="text-[10px] font-bold text-slate-400 uppercase tracking-widest">
                    Đang học bài {lesson.position + 1}
                  </span>
                </div>
                <h1 className="text-xl sm:text-2xl font-black text-slate-900 tracking-tight uppercase leading-tight">
                  {activeTitle}
                </h1>
                {lesson.description && (
                  <p className="text-slate-500 text-xs sm:text-sm font-medium leading-relaxed max-w-2xl mt-2">
                    {lesson.description}
                  </p>
                )}
              </div>
              <div className="shrink-0 pt-2 md:pt-0">
                <CourseProgressButton
                  lessonId={lessonId}
                  courseId={courseId}
                  isCompleted={!!currentProgress?.isCompleted}
                />
              </div>
            </div>

            {/* Curriculum: Danh sách bài học */}
            <div className="bg-white rounded-[2.5rem] border border-slate-200/60 p-2 sm:p-3 shadow-sm">
              <CourseSidebar
                course={courseData as any}
                currentLessonId={lessonId}
                progress={progressPercent}
                isEnrolled={!!enrollment}
                className="h-auto overflow-visible border-none bg-transparent"
              />
            </div>

            {/* Discussion for Mobile */}
            <div className="xl:hidden">
              <div className="bg-white rounded-[2.5rem] border border-slate-200/60 p-5 shadow-sm">
                <div className="flex items-center justify-between mb-5">
                  <div className="flex items-center gap-3">
                    <div className="w-9 h-9 bg-blue-50 rounded-xl flex items-center justify-center text-blue-600">
                      <MessageSquare className="w-5 h-5" />
                    </div>
                    <h3 className="font-black text-slate-900 uppercase tracking-tight text-sm">
                      Thảo luận
                    </h3>
                  </div>
                  <span className="text-[10px] font-black text-blue-600 bg-blue-50 px-2.5 py-1 rounded-full">
                    {commentCount}
                  </span>
                </div>
                <CommentSection lessonId={lessonId} />
              </div>
            </div>
          </div>

          {/* 2. Right Sticky Area: Discussion Board (Desktop) */}
          <div className="hidden xl:block xl:col-span-3 xl:sticky xl:top-24 h-fit space-y-5">
            <div className="bg-white rounded-[2.5rem] border border-slate-200/60 p-5 shadow-sm space-y-5">
              <div className="flex items-center justify-between border-b border-slate-50 pb-3">
                <div className="flex items-center gap-3">
                  <div className="w-8 h-8 bg-blue-50 rounded-xl flex items-center justify-center text-blue-600">
                    <MessageSquare className="w-4 h-4" />
                  </div>
                  <h3 className="font-black text-slate-900 text-[11px] uppercase tracking-wider">
                    Thảo luận
                  </h3>
                </div>
                <span className="px-2 py-0.5 bg-blue-50 text-blue-600 border border-blue-100 rounded-full text-[9px] font-black">
                  {commentCount}
                </span>
              </div>
              <div className="w-full">
                <CommentSection lessonId={lessonId} />
              </div>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}
