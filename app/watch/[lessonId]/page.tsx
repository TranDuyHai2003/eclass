import { prisma } from "@/lib/prisma";
import VideoPlayer from "@/components/player/VideoPlayer";
import CourseSidebar from "@/components/course/CourseSidebar";
import { notFound, redirect } from "next/navigation";
import { auth } from "@/auth";
import { Separator } from "@/components/ui/separator"; // Nếu có shadcn, hoặc dùng thẻ hr
import {
  FileText,
  Download,
  ChevronLeft,
  ChevronRight,
  Home,
} from "lucide-react";
import Link from "next/link";
import { CommentSection } from "@/components/comment/CommentSection";
import { CourseProgressButton } from "@/components/course/CourseProgressButton";

type WatchPageProps = {
  params: Promise<{
    lessonId: string;
  }>;
};

export default async function WatchPage({ params }: WatchPageProps) {
  const session = await auth();

  if (!session?.user) {
    return redirect("/login");
  }

  const { lessonId } = await params;

  // 1. Get current lesson details
  const lesson = await prisma.lesson.findUnique({
    where: { id: lessonId },
    include: {
      chapter: {
        include: {
          course: true,
        },
      },
      attachments: true,
    },
  });

  if (!lesson) return notFound();

  // 2. Fetch full course structure
  const course = await prisma.course.findUnique({
    where: { id: lesson.chapter.courseId },
    include: {
      chapters: {
        include: {
          lessons: {
            orderBy: { position: "asc" },
          },
        },
        orderBy: { position: "asc" },
      },
    },
  });

  if (!course) return notFound();

  // 3. Fetch user progress
  const progress = await prisma.progress.findUnique({
    where: {
      userId_lessonId: {
        userId: session.user.id!,
        lessonId,
      },
    },
  });

  // Logic tìm bài trước/sau để điều hướng
  const allLessons = course.chapters.flatMap((c) => c.lessons);
  const currentLessonIndex = allLessons.findIndex((l) => l.id === lessonId);
  const prevLesson =
    currentLessonIndex > 0 ? allLessons[currentLessonIndex - 1] : null;
  const nextLesson =
    currentLessonIndex < allLessons.length - 1
      ? allLessons[currentLessonIndex + 1]
      : null;

  return (
    <div className="min-h-screen bg-gray-50">
      {/* Breadcrumb Header */}
      <div className="bg-white border-b px-6 py-4 flex items-center gap-2 text-sm text-gray-500">
        <Link href="/" className="hover:text-purple-600 transition">
          <Home className="w-4 h-4" />
        </Link>
        <ChevronRight className="w-4 h-4" />
        <Link
          href={`/watch/${lessonId}`} // Or a course landing page if it existed
          className="hover:text-purple-600 transition"
        >
          {course.title}
        </Link>
        <ChevronRight className="w-4 h-4" />
        <span className="font-medium text-gray-900 truncate max-w-[200px]">
          {lesson.title}
        </span>
      </div>

      <div className="container mx-auto py-6 px-4 max-w-[1800px]">
        <div className="grid grid-cols-1 lg:grid-cols-4 gap-8">
          {/* --- LEFT COLUMN: VIDEO & CONTENT --- */}
          <div className="lg:col-span-3 flex flex-col gap-6">
            {/* Video Player Container */}
            <div className="bg-black rounded-2xl overflow-hidden shadow-2xl ring-1 ring-gray-900/10 aspect-video relative z-10">
              <VideoPlayer
                src={lesson.videoUrl || ""}
                title={lesson.title}
                poster={lesson.chapter.course.thumbnail || undefined}
              />
            </div>

            {/* Navigation & Progress Buttons */}
            <div className="flex flex-col sm:flex-row items-center justify-between gap-4">
              <div className="flex items-center gap-2">
                {prevLesson && (
                  <Link
                    href={`/watch/${prevLesson.id}`}
                    className="flex items-center gap-2 px-4 py-2 rounded-lg border bg-white hover:bg-gray-50 text-sm font-medium transition"
                  >
                    <ChevronLeft className="w-4 h-4" /> Bài trước
                  </Link>
                )}
                
                {nextLesson && (
                  <Link
                    href={`/watch/${nextLesson.id}`}
                    className="flex items-center gap-2 px-4 py-2 rounded-lg border bg-white hover:bg-gray-50 text-sm font-medium transition"
                  >
                    Bài sau <ChevronRight className="w-4 h-4" />
                  </Link>
                )}
              </div>

              <CourseProgressButton
                lessonId={lessonId}
                courseId={course.id}
                nextLessonId={nextLesson?.id}
                isCompleted={!!progress?.isCompleted}
              />
            </div>

            {/* Main Content Tabs/Info */}
            <div className="bg-white rounded-2xl border shadow-sm p-6 space-y-6">
              <div>
                <h1 className="text-2xl font-bold text-gray-900 mb-2">
                  {lesson.title}
                </h1>
                <div className="flex items-center gap-2 text-sm text-gray-500">
                  <span className="px-2.5 py-0.5 rounded-full bg-purple-100 text-purple-700 font-medium text-xs">
                    {lesson.chapter.title}
                  </span>
                  <span>•</span>
                  <span>Cập nhật mới nhất</span>
                </div>
              </div>

              <hr className="border-gray-100" />

              <div className="prose prose-purple max-w-none text-gray-600">
                <h3 className="text-lg font-semibold text-gray-900 mb-2">
                  Giới thiệu bài học
                </h3>
                <p>
                  {lesson.chapter.course.description ||
                    "Hãy xem kỹ video và làm bài tập đính kèm (nếu có)."}
                </p>
              </div>

              {lesson.attachments.length > 0 && (
                <div className="bg-purple-50/50 rounded-xl p-5 border border-purple-100">
                  <h3 className="text-base font-semibold text-gray-900 mb-3 flex items-center gap-2">
                    <Download className="w-4 h-4 text-purple-600" />
                    Tài liệu học tập
                  </h3>
                  <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                    {lesson.attachments.map((item) => (
                      <a
                        key={item.id}
                        href={item.url}
                        target="_blank"
                        className="flex items-center p-3 bg-white border border-gray-200 rounded-lg hover:border-purple-400 hover:shadow-md transition group"
                      >
                        <div className="p-2 bg-purple-100 rounded-md text-purple-600 mr-3 group-hover:bg-purple-600 group-hover:text-white transition">
                          <FileText className="w-4 h-4" />
                        </div>
                        <span className="text-sm font-medium text-gray-700 group-hover:text-purple-700 truncate">
                          {item.name}
                        </span>
                      </a>
                    ))}
                  </div>
                </div>
              )}
            </div>
            <CommentSection lessonId={lessonId} />
          </div>

          {/* --- RIGHT COLUMN: SIDEBAR --- */}
          <div className="lg:col-span-1">
            {/* Sticky Wrapper */}
            <div className="sticky top-6">
              <CourseSidebar course={course} currentLessonId={lessonId} />
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}
