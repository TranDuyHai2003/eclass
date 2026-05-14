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

  // 3. Fetch Course Full Data
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
      })),
    })),
  };

  const quizDuration = lesson.test?.duration || 15;
  const commentCount = await prisma.comment.count({ where: { lessonId } });

  return (
    <div className="flex flex-col min-h-screen lg:h-screen bg-slate-50 overflow-hidden font-sans">
      {/* TOP NAVIGATION BAR (Sleek & Modern) */}
      <header className="h-14 lg:h-16 bg-slate-950 text-slate-300 flex items-center justify-between px-4 lg:px-6 shrink-0 border-b border-white/10 z-50">
        <div className="flex items-center gap-4 min-w-0 flex-1">
          <Link
            href={`/courses/${courseId}`}
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
        <main className="flex-1 min-h-0 h-full overflow-y-auto custom-scrollbar relative bg-white">
          {/* 1. Cinematic Video Section */}
          <div className="w-full bg-slate-950 flex justify-center">
            <div className="w-full max-w-[1200px] aspect-video flex items-center justify-center relative shadow-2xl">
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
                  <div className="px-5 py-2 bg-white/10 rounded-full border border-white/10 text-slate-300 font-medium text-sm backdrop-blur-md">
                    Thời lượng:{" "}
                    <span className="text-white font-bold">
                      {quizDuration} Phút
                    </span>
                  </div>
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
                <div className="w-full h-full bg-slate-900 flex items-center justify-center text-slate-400 font-medium text-sm">
                  Nội dung bài học không khả dụng hoặc đang được cập nhật.
                </div>
              )}
            </div>
          </div>

          {/* 2. Lesson Header & Action Area */}
          <div className="max-w-[1200px] mx-auto w-full px-4 sm:px-8 py-6 flex flex-col sm:flex-row sm:items-center justify-between gap-4 border-b border-slate-100">
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

          {/* 3. Modern Content Tabs */}
          <div className="max-w-[1200px] mx-auto w-full px-4 sm:px-8 py-6 pb-20">
            <Tabs defaultValue="curriculum" className="w-full">
              <TabsList className="bg-slate-100/80 p-1.5 rounded-2xl h-auto flex flex-wrap gap-1 sm:w-fit mb-6">
                <TabsTrigger
                  value="curriculum"
                  className="rounded-xl px-5 py-2.5 font-semibold text-sm text-slate-500 data-[state=active]:bg-white data-[state=active]:text-slate-900 data-[state=active]:shadow-sm transition-all"
                >
                  <ListVideo className="w-4 h-4 mr-2 inline-block" />
                  Danh sách bài
                </TabsTrigger>
                {lesson.test && (
                  <TabsTrigger
                    value="quiz"
                    className="rounded-xl px-5 py-2.5 font-semibold text-sm text-slate-500 data-[state=active]:bg-white data-[state=active]:text-slate-900 data-[state=active]:shadow-sm transition-all"
                  >
                    <BookOpen className="w-4 h-4 mr-2 inline-block" />
                    Bài tập (Quiz)
                  </TabsTrigger>
                )}
                <TabsTrigger
                  value="files"
                  className="rounded-xl px-5 py-2.5 font-semibold text-sm text-slate-500 data-[state=active]:bg-white data-[state=active]:text-slate-900 data-[state=active]:shadow-sm transition-all"
                >
                  <FileText className="w-4 h-4 mr-2 inline-block" />
                  Tài liệu ({lesson.attachments.length})
                </TabsTrigger>
              </TabsList>

              <div className="mt-2">
                <TabsContent
                  value="curriculum"
                  className="mt-0 outline-none animate-in fade-in slide-in-from-bottom-2 duration-500"
                >
                  <div className="bg-white rounded-2xl border border-slate-100 shadow-sm overflow-hidden">
                    <CourseSidebar
                      course={courseData as any}
                      currentLessonId={lessonId}
                      progress={progressPercent}
                      isEnrolled={!!enrollment}
                      className="h-auto overflow-visible border-none bg-transparent"
                    />
                  </div>
                </TabsContent>

                <TabsContent
                  value="quiz"
                  className="mt-0 outline-none animate-in fade-in slide-in-from-bottom-2 duration-500"
                >
                  <QuizEntryCard
                    lessonId={lessonId}
                    course={course}
                    lesson={lesson}
                    test={lesson.test}
                    duration={quizDuration}
                  />
                </TabsContent>

                <TabsContent
                  value="files"
                  className="mt-0 outline-none animate-in fade-in slide-in-from-bottom-2 duration-500"
                >
                  <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
                    {lesson.attachments.length > 0 ? (
                      lesson.attachments.map((att) => (
                        <a
                          key={att.id}
                          href={att.url}
                          target="_blank"
                          className="flex items-start gap-4 p-5 bg-white border border-slate-200 rounded-2xl hover:border-red-200 hover:shadow-lg hover:shadow-red-500/5 hover:-translate-y-1 transition-all group"
                        >
                          <div className="w-12 h-12 bg-red-50 text-red-500 rounded-xl flex items-center justify-center shrink-0 group-hover:bg-red-500 group-hover:text-white transition-colors">
                            <FileText className="w-6 h-6" />
                          </div>
                          <div className="flex-1 min-w-0">
                            <p className="font-semibold text-slate-900 text-sm line-clamp-2 group-hover:text-red-600 transition-colors">
                              {att.name}
                            </p>
                            <p className="text-xs font-medium text-slate-400 mt-1">
                              Tải xuống
                            </p>
                          </div>
                          <Download className="w-5 h-5 text-slate-300 group-hover:text-red-500 transition-colors shrink-0" />
                        </a>
                      ))
                    ) : (
                      <div className="col-span-full flex flex-col items-center justify-center py-20 bg-slate-50 rounded-2xl border border-dashed border-slate-200">
                        <div className="w-16 h-16 bg-slate-100 rounded-full flex items-center justify-center mb-4">
                          <FileText className="w-8 h-8 text-slate-300" />
                        </div>
                        <p className="text-slate-500 font-medium">
                          Bài học này không có tài liệu đính kèm.
                        </p>
                      </div>
                    )}
                  </div>
                </TabsContent>
              </div>
            </Tabs>
          </div>
        </main>

        {/* RIGHT SIDEBAR (Comments/Discussion) - Clean Card Layout */}
        <aside className="hidden lg:flex w-[400px] shrink-0 border-l border-slate-200 bg-slate-50 flex-col h-full min-h-0 z-10 shadow-[-10px_0_30px_rgba(0,0,0,0.02)]">
          <div className="h-16 px-6 bg-white border-b border-slate-200 flex items-center justify-between shrink-0">
            <div className="flex items-center gap-2.5">
              <div className="w-8 h-8 bg-slate-100 rounded-lg flex items-center justify-center">
                <MessageSquare className="w-4 h-4 text-slate-700" />
              </div>
              <h3 className="font-bold text-slate-900 text-base">Thảo luận</h3>
            </div>
            <span className="px-3 py-1 bg-red-50 text-red-600 rounded-full text-xs font-bold">
              {commentCount} bình luận
            </span>
          </div>
          <div className="flex-1 overflow-y-auto custom-scrollbar p-6 bg-slate-50/50">
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
