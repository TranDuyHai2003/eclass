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
      orderBy: { createdAt: "desc" },
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
                select: { id: true, duration: true },
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
    <div className="flex flex-col min-h-screen bg-[#EBF3FF] font-sans">
      {/* BREADCRUMB NAVIGATION PATH (House icon > Course Title) */}
      <div className="bg-white/60 backdrop-blur-md px-6 py-4 flex items-center border-b border-blue-100/40">
        <div className="max-w-[1400px] w-full mx-auto flex items-center gap-2 text-[10px] sm:text-xs font-black uppercase tracking-wider text-slate-500">
          <Link
            href="/"
            className="p-1.5 hover:bg-blue-50 text-[#A01D24] rounded-lg transition-all duration-300 flex items-center justify-center shrink-0 border border-blue-100/40 bg-white"
          >
            <Home className="w-3.5 h-3.5" />
          </Link>
          <ChevronRight className="w-3.5 h-3.5 text-blue-300" />
          <span className="text-[#A01D24]">{course.title}</span>
        </div>
      </div>

      {/* MAIN CONTENT AREA: 2-Column Responsive Layout */}
      <div className="flex-1 max-w-[1600px] w-full mx-auto p-4 sm:p-6 lg:p-8">
        <div className="grid grid-cols-1 xl:grid-cols-12 gap-6 lg:gap-8 items-start">
          {/* 1. Left Area (Col 9 - 75%): Player, details & tabs */}
          <div className="xl:col-span-9 space-y-6 min-w-0">
            {/* Aspect Ratio Player Panel */}
            <div className="aspect-video w-full relative shadow-xl rounded-[2.5rem] overflow-hidden bg-slate-950 border border-red-100/60">
              {lesson.videoUrl ? (
                <VideoPlayer
                  src={lesson.videoUrl}
                  title={lesson.title}
                  poster={course.thumbnail || undefined}
                />
              ) : lesson.type === "QUIZ" ? (
                <QuizEntryCard
                  lessonId={lessonId}
                  course={course}
                  lesson={lesson}
                  duration={quizDuration}
                  test={lesson.test}
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
                /* Premium pink gradient template matching screenshot */
                <div className="w-full h-full bg-gradient-to-br from-red-500/10 via-pink-50/20 to-red-100/30 flex items-center justify-center p-8 relative overflow-hidden">
                  <div className="absolute inset-0 bg-[radial-gradient(circle_at_center,_var(--tw-gradient-stops))] from-red-200/30 via-transparent to-transparent blur-3xl opacity-60" />
                  <div className="relative z-10 flex flex-col sm:flex-row items-center gap-8 text-center sm:text-left">
                    {course.thumbnail && (
                      <div className="relative w-32 h-32 sm:w-40 sm:h-40 rounded-3xl overflow-hidden shadow-2xl border-4 border-white shrink-0 transform hover:scale-105 transition-transform duration-500">
                        <img
                          src={course.thumbnail}
                          alt={course.title}
                          className="w-full h-full object-cover"
                        />
                      </div>
                    )}
                    <div className="space-y-2">
                      <span className="bg-red-50 text-[#A01D24] text-[8px] font-black uppercase px-2.5 py-0.5 rounded-full border border-red-100/80">
                        Khóa học
                      </span>
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

            {/* Teacher Homework Review (If applicable) */}
            {lesson.hasHomework && isTeacher && (
              <div className="w-full">
                <TeacherHomeworkReview submissions={allSubmissions} />
              </div>
            )}

            {/* Lesson Description & Actions */}
            <div className="bg-white rounded-[2rem] border border-red-100/60 p-6 shadow-sm flex flex-col sm:flex-row sm:items-center justify-between gap-4">
              <div className="space-y-1">
                <h1 className="text-lg font-black text-slate-900 tracking-tight uppercase">
                  {lesson.title}
                </h1>
                {lesson.description && (
                  <p className="text-slate-500 text-xs font-bold leading-relaxed">
                    {lesson.description}
                  </p>
                )}
              </div>
              <div className="shrink-0">
                <CourseProgressButton
                  lessonId={lessonId}
                  courseId={courseId}
                  isCompleted={!!currentProgress?.isCompleted}
                />
              </div>
            </div>

            {/* Curriculum: Danh sách bài học */}
            <div className="bg-white rounded-[2.5rem] border border-red-100/60 p-6 shadow-sm">
              <CourseSidebar
                course={courseData as any}
                currentLessonId={lessonId}
                progress={progressPercent}
                isEnrolled={!!enrollment}
                className="h-auto overflow-visible border-none bg-transparent"
              />
            </div>
          </div>

          {/* 2. Right Sticky Area (Col 3 - 25%): Discussion Board */}
          <div className="xl:col-span-3 xl:sticky xl:top-24 h-fit space-y-6">
            <div className="bg-white rounded-[2.5rem] border border-red-100/60 p-5 shadow-sm space-y-5">
              <div className="flex items-center justify-between border-b border-red-50 pb-4">
                <div className="flex items-center gap-2">
                  <div className="w-8 h-8 bg-red-50 rounded-lg flex items-center justify-center">
                    <MessageSquare className="w-4 h-4 text-[#A01D24]" />
                  </div>
                  <h3 className="font-black text-slate-900 text-xs uppercase tracking-wider">
                    Thảo luận bài học
                  </h3>
                </div>
                <span className="px-3 py-1 bg-red-50 text-[#A01D24] border border-red-100/60 rounded-full text-[10px] font-black uppercase tracking-widest shadow-sm">
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
