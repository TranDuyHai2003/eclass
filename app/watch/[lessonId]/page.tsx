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
  Layout,
  Menu,
  Home as HomeIcon,
} from "lucide-react";
import { cn } from "@/lib/utils";
import QuizEntryCard from "./_components/QuizEntryCard";
import { CourseProgressButton } from "@/components/course/CourseProgressButton";
import { PDFViewerClientWrapper } from "@/components/course/PDFViewerClientWrapper";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { Sheet, SheetContent, SheetTrigger } from "@/components/ui/sheet";
import { Button } from "@/components/ui/button";
import { CommentSection } from "@/components/comment/CommentSection";

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
        include: {
          course: true,
        },
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

  // If not Admin/Owner, check enrollment for non-free lessons
  if (!isAdmin && !isOwner) {
    enrollment = await prisma.enrollment.findUnique({
      where: {
        userId_courseId: {
          userId: session.user.id!,
          courseId,
        },
      },
    });

    if (!lesson.isFree) {
      if (!enrollment || enrollment.status !== "ACTIVE") {
        return redirect(`/courses/${courseId}`);
      }
    }
  } else {
    // Admins/Owners are effectively ACTIVE
    enrollment = { status: "ACTIVE" };
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

  // Check if current lesson is completed
  const currentProgress = await prisma.progress.findUnique({
    where: {
      userId_lessonId: {
        userId: session.user.id!,
        lessonId,
      },
    },
  });

  // Calculate actual progress for this course
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

  // Map progress to course structure for sidebar
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

  // Fetch comment count
  const commentCount = await prisma.comment.count({
    where: { lessonId },
  });

  return (
    <div className="flex h-screen flex-col bg-white overflow-hidden relative">
      {/* Floating Header Overlay */}
      <div className="absolute top-4 left-4 z-[100] flex items-center gap-3 pointer-events-none">
        <Link
          href="/"
          className="pointer-events-auto flex items-center gap-1.5 px-3 py-1.5 bg-white/10 backdrop-blur-md border border-white/20 rounded-full text-[10px] font-black uppercase tracking-widest text-white hover:bg-white hover:text-black transition-all shadow-2xl"
        >
          <HomeIcon className="w-3.5 h-3.5" />
          <span className="hidden sm:inline">Trang chủ</span>
        </Link>
        <div className="flex items-center gap-2 px-3 py-1.5 bg-black/20 backdrop-blur-md border border-white/10 rounded-full text-[9px] font-black uppercase tracking-widest text-white/80">
          <span className="truncate max-w-[120px]">{course.title}</span>
          <ChevronRight className="w-2.5 h-2.5 opacity-50" />
          <span className="text-red-500 truncate max-w-[180px]">
            {lesson.title}
          </span>
        </div>
      </div>

      <div className="flex flex-1 overflow-hidden">
        {/* Main Content Area - Single Scrollable Unit */}
        <main className="flex-1 overflow-y-auto custom-scrollbar bg-slate-50 relative">
          {/* 1. Video Section */}
          <div className="w-full bg-slate-950 shrink-0 shadow-2xl">
            <div className="max-w-[1600px] mx-auto aspect-video flex items-center justify-center">
              {lesson.videoUrl ? (
                <VideoPlayer
                  src={lesson.videoUrl}
                  title={lesson.title}
                  poster={course.thumbnail || undefined}
                />
              ) : lesson.type === "QUIZ" ? (
                <div className="w-full h-full bg-[#0F172A] flex flex-col items-center justify-center gap-4 py-16">
                  <div className="w-14 h-14 bg-white/5 rounded-2xl flex items-center justify-center border border-white/10">
                    <BookOpen className="w-7 h-7 text-red-500" />
                  </div>
                  <h2 className="text-white font-black text-xl">
                    Bài kiểm tra đánh giá
                  </h2>
                  <div className="px-4 py-1.5 bg-white/5 rounded-xl border border-white/10 text-slate-300 font-bold text-xs">
                    {quizDuration} Phút
                  </div>
                </div>
              ) : lesson.type === "DOCUMENT" &&
                lesson.attachments.find((a) =>
                  a.url.toLowerCase().endsWith(".pdf"),
                ) ? (
                <div className="w-full h-full bg-slate-100">
                  <PDFViewerClientWrapper
                    url={
                      lesson.attachments.find((a) =>
                        a.url.toLowerCase().endsWith(".pdf"),
                      )!.url
                    }
                  />
                </div>
              ) : (
                <div className="w-full h-full bg-slate-900 flex items-center justify-center text-slate-500 font-bold uppercase tracking-widest text-center px-10 text-xs">
                  Nội dung bài học không khả dụng hoặc đang được cập nhật
                </div>
              )}
            </div>
          </div>

          {/* 2. Content Section */}
          <div className="max-w-[1200px] mx-auto w-full p-4 md:p-8">
            {/* Header: Title & Progress Action */}
            <div className="flex flex-col md:flex-row md:items-center justify-between gap-6 mb-8">
              <div className="space-y-2">
                <div className="flex items-center gap-2 mb-1">
                  <div className="px-2 py-0.5 bg-red-50 text-red-600 rounded text-[10px] font-black uppercase tracking-widest border border-red-100">
                    Bài học
                  </div>
                  <div className="w-1 h-1 rounded-full bg-slate-300" />
                  <p className="text-slate-400 font-bold flex items-center gap-1.5 text-[10px] uppercase tracking-widest">
                    {course.title}
                  </p>
                </div>
                <h1 className="text-2xl md:text-3xl font-black text-slate-900 tracking-tight leading-tight uppercase">
                  {lesson.title}
                </h1>
              </div>

              <div className="shrink-0">
                <CourseProgressButton
                  lessonId={lessonId}
                  courseId={courseId}
                  isCompleted={!!currentProgress?.isCompleted}
                />
              </div>
            </div>

            {/* Main Tabs: Info, Attachments, Comments */}
            <Tabs defaultValue="info" className="w-full">
              <TabsList className="w-full justify-start border-none rounded-none h-14 bg-transparent p-0 gap-4 overflow-x-auto overflow-y-hidden no-scrollbar">
                <TabsTrigger
                  value="curriculum"
                  className="lg:hidden data-[state=active]:bg-transparent data-[state=active]:shadow-none rounded-none h-full font-black text-[10px] uppercase tracking-[0.1em] text-slate-400 data-[state=active]:text-red-600 px-0 shrink-0 transition-all flex items-center gap-2 group"
                >
                  <Menu className="w-4 h-4 opacity-50 group-data-[state=active]:opacity-100" />
                  Lộ trình
                </TabsTrigger>
                <TabsTrigger
                  value="info"
                  className="data-[state=active]:bg-transparent data-[state=active]:shadow-none rounded-none h-full font-black text-[10px] uppercase tracking-[0.1em] text-slate-400 data-[state=active]:text-red-600 px-0 shrink-0 transition-all flex items-center gap-2 group"
                >
                  <Layout className="w-4 h-4 opacity-50 group-data-[state=active]:opacity-100" />
                  Tổng quan
                </TabsTrigger>
                <TabsTrigger
                  value="files"
                  className="data-[state=active]:bg-transparent data-[state=active]:shadow-none rounded-none h-full font-black text-[10px] uppercase tracking-[0.1em] text-slate-400 data-[state=active]:text-red-600 px-0 shrink-0 transition-all flex items-center gap-2 group"
                >
                  <FileText className="w-4 h-4 opacity-50 group-data-[state=active]:opacity-100" />
                  Tài liệu
                  <span className="ml-0.5 px-1.5 py-0.5 bg-slate-100 text-slate-500 rounded-md text-[9px] group-data-[state=active]:bg-red-50 group-data-[state=active]:text-red-600 transition-colors">
                    {lesson.attachments.length}
                  </span>
                </TabsTrigger>
                <TabsTrigger
                  value="comments"
                  className="data-[state=active]:bg-transparent data-[state=active]:shadow-none rounded-none h-full font-black text-[10px] uppercase tracking-[0.1em] text-slate-400 data-[state=active]:text-red-600 px-0 shrink-0 transition-all flex items-center gap-2 group"
                >
                  <MessageSquare className="w-4 h-4 opacity-50 group-data-[state=active]:opacity-100" />
                  Thảo luận
                  <span className="ml-0.5 px-1.5 py-0.5 bg-slate-100 text-slate-500 rounded-md text-[9px] group-data-[state=active]:bg-red-50 group-data-[state=active]:text-red-600 transition-colors">
                    +{commentCount}
                  </span>
                </TabsTrigger>
              </TabsList>

              <div className="py-2">
                <TabsContent
                  value="curriculum"
                  className="mt-0 focus-visible:outline-none lg:hidden"
                >
                  <div className="bg-white rounded-3xl overflow-hidden shadow-sm">
                    <CourseSidebar
                      course={courseData as any}
                      currentLessonId={lessonId}
                      progress={progressPercent}
                      isEnrolled={!!enrollment}
                      className="h-auto overflow-visible"
                    />
                  </div>
                </TabsContent>

                <TabsContent
                  value="info"
                  className="mt-0 space-y-8 focus-visible:outline-none"
                >
                  {lesson.type === "QUIZ" && (
                    <QuizEntryCard
                      lessonId={lessonId}
                      course={course}
                      lesson={lesson}
                      test={lesson.test}
                      duration={quizDuration}
                    />
                  )}

                  <div className="bg-white rounded-3xl p-6 md:p-8 shadow-sm">
                    <h3 className="text-lg font-black text-slate-900 uppercase tracking-tight mb-4 flex items-center gap-2">
                      <Layout className="w-5 h-5 text-red-600" />
                      Mô tả bài học
                    </h3>
                    <div className="prose prose-slate max-w-none prose-p:text-slate-600 prose-p:leading-relaxed prose-p:font-medium">
                      <p className="whitespace-pre-wrap text-[15px]">
                        {lesson.description ||
                          "Chưa có mô tả cho bài học này."}
                      </p>
                    </div>
                  </div>
                </TabsContent>

                <TabsContent
                  value="files"
                  className="mt-0 focus-visible:outline-none"
                >
                  {lesson.attachments.length > 0 ? (
                    <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                      {lesson.attachments.map((att) => (
                        <a
                          key={att.id}
                          href={att.url}
                          target="_blank"
                          className="flex items-center gap-4 p-5 bg-white rounded-3xl hover:shadow-xl hover:shadow-red-600/5 transition-all group"
                        >
                          <div className="w-12 h-12 bg-slate-50 rounded-2xl flex items-center justify-center shrink-0 group-hover:bg-red-600 transition-colors">
                            <FileText className="w-5 h-5 text-slate-400 group-hover:text-white transition-colors" />
                          </div>
                          <div className="flex-1 min-w-0">
                            <p className="font-black text-slate-900 text-sm truncate uppercase tracking-tight group-hover:text-red-600 transition-colors">
                              {att.name}
                            </p>
                            <p className="text-[10px] font-bold text-slate-400 uppercase tracking-widest mt-1">
                              Tài liệu đính kèm
                            </p>
                          </div>
                          <div className="w-10 h-10 rounded-full flex items-center justify-center group-hover:bg-red-50 transition-colors">
                            <Download className="w-4 h-4 text-slate-300 group-hover:text-red-600 transition-colors shrink-0" />
                          </div>
                        </a>
                      ))}
                    </div>
                  ) : (
                    <div className="text-center py-20 bg-white rounded-[32px]">
                      <div className="w-16 h-16 bg-slate-50 rounded-full flex items-center justify-center mx-auto mb-4">
                        <FileText className="w-8 h-8 text-slate-200" />
                      </div>
                      <p className="text-slate-400 font-bold uppercase tracking-widest text-[11px]">
                        Không có tài liệu đính kèm
                      </p>
                    </div>
                  )}
                </TabsContent>

                <TabsContent
                  value="comments"
                  className="mt-0 focus-visible:outline-none"
                >
                  <div className="bg-white rounded-3xl p-6 md:p-8 shadow-sm">
                    <div className="flex items-center gap-2 mb-2">
                      <MessageSquare className="w-5 h-5 text-red-600" />
                      <h3 className="text-lg font-black text-slate-900 uppercase tracking-tight">
                        Hỏi đáp & Thảo luận
                      </h3>
                    </div>
                    <div className="max-w-4xl">
                      <CommentSection lessonId={lessonId} />
                    </div>
                  </div>
                </TabsContent>
              </div>
            </Tabs>
          </div>
        </main>

        {/* Sidebar - Desktop */}
        <div className="hidden lg:block w-[350px] shrink-0 border-l border-slate-200 bg-white h-full overflow-hidden">
          <CourseSidebar
            course={courseData as any}
            currentLessonId={lessonId}
            progress={progressPercent}
            isEnrolled={!!enrollment}
          />
        </div>
      </div>

      <style
        dangerouslySetInnerHTML={{
          __html: `
        header { display: none !important; }
        .page-shell { padding-top: 0 !important; height: 100vh !important; overflow: hidden !important; }
        .student-header { display: none !important; }
        body { overflow: hidden !important; }
        .no-scrollbar::-webkit-scrollbar { display: none; }
        .no-scrollbar { -ms-overflow-style: none; scrollbar-width: none; }
      `,
        }}
      />
    </div>
  );
}
