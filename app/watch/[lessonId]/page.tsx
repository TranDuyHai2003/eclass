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

import { HomeworkSection } from "@/components/course/HomeworkSection";
import { TeacherHomeworkReview } from "@/components/teacher/TeacherHomeworkReview";
import { getHomeworkSubmission } from "@/actions/homework";

export default async function WatchPage({
  params,
}: {
  params: Promise<{ lessonId: string }>;
}) {
  const session = await auth();
  if (!session?.user) return redirect("/login");

  const { lessonId } = await params;

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

  // 2. Access Control Check
  const isAdmin = session.user.role === "ADMIN";
  const isOwner = lesson.chapter.course.userId === session.user.id;
  const isTeacher = session.user.role === "TEACHER" || isAdmin;

  let enrollment = null;

  if (!isAdmin && !isOwner) {
    enrollment = await prisma.enrollment.findUnique({
      where: {
        userId_courseId: {
          userId: session.user.id!,
          courseId,
        },
      },
    });

    // TEMPORARILY DISABLED: Allow all students to learn directly
    // if (!lesson.isFree) {
    //   if (!enrollment || enrollment.status !== "ACTIVE") {
    //     return redirect(`/courses/${courseId}`);
    //   }
    // }

    // Simulate active enrollment to allow learning
    if (!enrollment || enrollment.status !== "ACTIVE") {
      enrollment = { status: "ACTIVE" } as any;
    }
  } else {
    enrollment = { status: "ACTIVE" } as any;
  }

  // 3. Fetch Homework Data
  const initialHomework = await getHomeworkSubmission(lessonId);
  
  let allSubmissions: any[] = [];
  if (isTeacher || isOwner) {
    allSubmissions = await prisma.homeworkSubmission.findMany({
      where: { lessonId },
      include: { user: true },
      orderBy: { createdAt: "desc" }
    });
  }

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
                select: { id: true, duration: true }
              },
              attachments: true,
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
      })),
    })),
  };

  const quizDuration = lesson.test?.duration || 15;
  const commentCount = await prisma.comment.count({ where: { lessonId } });

  return (
    <div className="flex flex-col min-h-screen lg:h-screen bg-[#E2EEFF] overflow-hidden font-sans">
      {/* TOP NAVIGATION BAR (Sleek & Modern) */}
      <header className="h-14 lg:h-16 bg-slate-950 text-slate-300 flex items-center justify-between px-4 lg:px-6 shrink-0 border-b border-white/10 z-50">
        <div className="flex items-center gap-4 min-w-0 flex-1">
          <Link
            href="/courses"
            className="flex items-center justify-center w-8 h-8 lg:w-10 lg:h-10 rounded-full hover:bg-white/10 transition-colors shrink-0"
          >
            <ArrowLeft className="w-5 h-5 text-white" />
          </Link>
          <div className="flex flex-col min-w-0">
            <span className="text-[10px] lg:text-xs font-semibold text-slate-400 uppercase tracking-wider truncate">
              {course.title}
            </span>
            <span className="text-sm lg:text-base font-bold text-white truncate">
              {lesson.chapter.title}
            </span>
          </div>
        </div>

        <div className="flex items-center gap-4 shrink-0">
          <div className="hidden lg:flex items-center gap-3 bg-white/5 px-4 py-1.5 rounded-full border border-white/10">
            <GraduationCap className="w-4 h-4 text-red-500" />
            <span className="text-xs font-semibold text-white">
              Tiến độ: <span className="text-red-400">{progressPercent}%</span>
            </span>
          </div>
          <div className="lg:hidden">
            <MobileCommentsSheet
              lessonId={lessonId}
              commentCount={commentCount}
            />
          </div>
        </div>
      </header>

      <div className="flex flex-1 min-h-0 overflow-hidden flex-col lg:flex-row">
        {/* MAIN CONTENT AREA */}
        <main className="flex-1 min-h-0 h-full overflow-y-auto custom-scrollbar relative bg-slate-50/50">
          {/* 1. Beautiful Video Player Section with Padding and Whitespace */}
          <div className="p-6 sm:p-8">
            <div className="max-w-[900px] mx-auto aspect-video flex items-center justify-center relative shadow-xl rounded-[2rem] overflow-hidden bg-slate-950 border border-slate-200/60">
              {lesson.videoUrl ? (
                <VideoPlayer
                  src={lesson.videoUrl}
                  title={lesson.title}
                  poster={course.thumbnail || undefined}
                />
              ) : lesson.type === "QUIZ" ? (
                <div className="w-full h-full flex flex-col items-center justify-center gap-5 py-16 bg-gradient-to-b from-slate-900 to-slate-950">
                  <div className="w-16 h-16 bg-red-500/10 rounded-2xl flex items-center justify-center border border-red-500/20 shadow-[0_0_30px_rgba(239,68,68,0.2)]">
                    <BookOpen className="w-8 h-8 text-red-500" />
                  </div>
                  <h2 className="text-white font-bold text-2xl tracking-tight">
                    Bài kiểm tra đánh giá
                  </h2>
                </div>
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
                /* Elegant Red/Pink Gradient Placeholder matching the screenshot! */
                <div className="w-full h-full bg-gradient-to-br from-red-500/10 via-pink-50/20 to-red-100/30 flex items-center justify-center p-8 relative overflow-hidden">
                  <div className="absolute inset-0 bg-[radial-gradient(circle_at_center,_var(--tw-gradient-stops))] from-red-200/30 via-transparent to-transparent blur-3xl opacity-60" />
                  <div className="relative z-10 flex flex-col sm:flex-row items-center gap-8 text-center sm:text-left">
                    {course.thumbnail && (
                      <div className="relative w-32 h-32 sm:w-40 sm:h-40 rounded-2xl overflow-hidden shadow-2xl border-4 border-white/60 shrink-0 transform hover:scale-105 transition-transform duration-500">
                        <Image
                          src={course.thumbnail}
                          alt={course.title}
                          fill
                          className="object-cover"
                        />
                      </div>
                    )}
                    <div className="space-y-2">
                      <p className="text-[10px] font-black text-red-600 uppercase tracking-[0.2em]">Khóa học</p>
                      <h2 className="text-2xl sm:text-3xl font-black text-slate-800 tracking-tight uppercase leading-tight">
                        {course.title}
                      </h2>
                      <p className="text-sm font-bold text-slate-500 uppercase tracking-wide">
                        {lesson.title}
                      </p>
                    </div>
                  </div>
                </div>
              )}
            </div>
          </div>

          {/* 2. Lesson Header & Action Area */}
          <div className="max-w-[900px] mx-auto w-full px-6 sm:px-0 py-6 flex flex-col sm:flex-row sm:items-center justify-between gap-4 border-b border-slate-100">
            <div>
              <h1 className="text-xl sm:text-2xl font-bold text-slate-900 tracking-tight">
                {lesson.title}
              </h1>
              {lesson.description && (
                <p className="text-slate-500 text-sm mt-1 max-w-3xl leading-relaxed">
                  {lesson.description}
                </p>
              )}
            </div>
            <div className="shrink-0 flex items-center">
              <CourseProgressButton
                lessonId={lessonId}
                courseId={courseId}
                isCompleted={!!currentProgress?.isCompleted}
              />
            </div>
          </div>

          {/* 2.5 Homework Section */}
          {(lesson.hasHomework || isTeacher || isOwner) && (
            <div id="homework" className="max-w-[900px] mx-auto w-full px-6 sm:px-0 py-6 space-y-8 scroll-mt-20">
              {isTeacher || isOwner ? (
                <TeacherHomeworkReview submissions={allSubmissions} />
              ) : (
                <HomeworkSection lessonId={lessonId} initialSubmission={initialHomework} />
              )}
            </div>
          )}

          {/* 3. Modern Content List (Replacing Tabs) */}
          <div className="max-w-[900px] mx-auto w-full px-6 sm:px-0 py-6 pb-20 space-y-8">
            <div className="flex items-center gap-2 mb-2">
              <ListVideo className="w-5 h-5 text-red-600" />
              <h2 className="text-lg font-black text-slate-900 uppercase tracking-tight">
                Toàn bộ lộ trình học
              </h2>
            </div>

            <div className="bg-white rounded-[2rem] border border-slate-100 shadow-xl shadow-slate-200/50 overflow-hidden">
              <CourseSidebar
                course={courseData as any}
                currentLessonId={lessonId}
                progress={progressPercent}
                isEnrolled={!!enrollment}
                className="h-auto overflow-visible border-none bg-transparent"
              />
            </div>
          </div>
        </main>

        {/* RIGHT SIDEBAR (Comments/Discussion) - Clean Card Layout */}
        <aside className="hidden lg:flex w-[400px] shrink-0 border-l border-slate-200 bg-white flex-col h-full min-h-0 z-10 shadow-[-10px_0_30px_rgba(0,0,0,0.02)]">
          <div className="h-16 px-6 bg-white border-b border-slate-100 flex items-center justify-between shrink-0 shadow-sm z-10">
            <div className="flex items-center gap-2.5">
              <div className="w-8 h-8 bg-red-50 rounded-lg flex items-center justify-center">
                <MessageSquare className="w-4 h-4 text-red-600" />
              </div>
              <h3 className="font-bold text-slate-900 text-base">Thảo luận</h3>
            </div>
            <span className="px-3 py-1 bg-slate-100 text-slate-600 rounded-full text-xs font-bold">
              {commentCount} bình luận
            </span>
          </div>

          {/* Sửa lại class ở đây, bỏ p-6 để CommentSection tự quản lý padding */}
          <div className="flex-1 overflow-hidden bg-white">
            <CommentSection lessonId={lessonId} />
          </div>
        </aside>
      </div>

      <style
        dangerouslySetInnerHTML={{
          __html: `
        /* Hide global layout components when in learning mode */
        header:not(.flex) { display: none !important; }
        .page-shell { padding-top: 0 !important; }
        .student-header { display: none !important; }
        
        /* Locking scroll logic */
        @media (max-width: 1023px) {
          body { overflow: auto !important; }
          .page-shell { height: auto !important; overflow: visible !important; }
        }
        @media (min-width: 1024px) {
          body { overflow: hidden !important; }
          .page-shell { height: 100vh !important; overflow: hidden !important; }
        }
        
        /* Beautiful Scrollbar */
        .custom-scrollbar::-webkit-scrollbar { width: 6px; height: 6px; }
        .custom-scrollbar::-webkit-scrollbar-track { background: transparent; }
        .custom-scrollbar::-webkit-scrollbar-thumb { background: #cbd5e1; border-radius: 10px; }
        .custom-scrollbar::-webkit-scrollbar-thumb:hover { background: #94a3b8; }
      `,
        }}
      />
    </div>
  );
}
