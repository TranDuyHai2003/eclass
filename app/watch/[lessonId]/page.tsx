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
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";

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
    <div className="page-shell">
      {/* Breadcrumb Header */}
      <div className="bg-white/80 backdrop-blur-xl border-b border-border/60 px-4 sm:px-6 py-3 flex items-center justify-between">
        <div className="flex items-center gap-2 text-sm text-gray-500">
          <Link href="/" className="hover:text-red-600 transition flex items-center gap-1">
            <Home className="w-4 h-4" />
            <span className="hidden sm:inline">Trang chủ</span>
          </Link>
          <ChevronRight className="w-4 h-4" />
          <Link
            href={`/courses/${lesson.chapter.courseId}`}
            className="hover:text-red-600 transition font-medium"
          >
            {course.title}
          </Link>
          <ChevronRight className="w-4 h-4" />
          <span className="font-bold text-gray-900 truncate max-w-[200px]">
            {lesson.title}
          </span>
        </div>
        <div className="text-xs font-bold text-red-600 bg-red-50 px-3 py-1 rounded-full uppercase tracking-wider">
           Lesson Mode
        </div>
      </div>

      <div className="container mx-auto pt-6 pb-12 px-4 sm:px-6 lg:px-8 max-w-[1920px]">
        <div className="grid grid-cols-1 xl:grid-cols-4 gap-8">
          {/* --- LEFT COLUMN: VIDEO & CONTENT --- */}
          <div className="xl:col-span-3 flex flex-col gap-6">
            {/* Video Player Container */}
            <div className="bg-black rounded-3xl overflow-hidden shadow-2xl ring-1 ring-black/10 aspect-video relative z-10 group">
              <VideoPlayer
                src={lesson.videoUrl || ""}
                title={lesson.title}
                poster={lesson.chapter.course.thumbnail || undefined}
              />
            </div>

            {/* Navigation & Progress Buttons */}
            <div className="card-surface flex flex-col md:flex-row items-center justify-between gap-4 p-4 rounded-2xl">
              <div className="flex items-center gap-3">
                {prevLesson && (
                  <Link
                    href={`/watch/${prevLesson.id}`}
                    className="flex items-center gap-2 px-5 py-2.5 rounded-2xl border border-border/70 bg-white/60 hover:bg-white text-sm font-black transition shadow-sm group"
                  >
                    <ChevronLeft className="w-4 h-4 group-hover:-translate-x-1 transition-transform" /> Bài trước
                  </Link>
                )}
                
                {nextLesson && (
                  <Link
                    href={`/watch/${nextLesson.id}`}
                    className="flex items-center gap-2 px-5 py-2.5 rounded-2xl border border-border/70 bg-white/60 hover:bg-white text-sm font-black transition shadow-sm group"
                  >
                    Bài sau <ChevronRight className="w-4 h-4 group-hover:translate-x-1 transition-transform" />
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

            {/* Main Content info */}
            <div className="card-surface rounded-3xl p-8 space-y-6">
              <div>
                <span className="px-3 py-1 rounded-full bg-red-100 text-red-700 font-bold text-[10px] uppercase tracking-widest mb-3 inline-block">
                  {lesson.chapter.title}
                </span>
                <h1 className="text-3xl font-black text-gray-900 leading-tight">
                  {lesson.title}
                </h1>
              </div>

              <Separator className="bg-gray-50" />

              <div className="prose prose-red max-w-none text-gray-600">
                <h3 className="text-xl font-bold text-gray-900 mb-4">
                  Nội dung chi tiết
                </h3>
                <div className="bg-gray-50/50 p-6 rounded-2xl border border-gray-100 italic">
                  {lesson.description ||
                    "Bài học này hiện chưa có nội dung mô tả chi tiết. Hãy theo dõi video bài giảng để nắm bắt kiến thức quan trọng nhất."}
                </div>
              </div>

              {lesson.attachments.length > 0 && (
                <div className="bg-gray-50 rounded-2xl p-6 border border-gray-100">
                  <h3 className="text-lg font-bold text-gray-900 mb-4 flex items-center gap-2">
                    <Download className="w-5 h-5 text-red-600" />
                    Tài liệu đính kèm
                  </h3>
                  <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                    {lesson.attachments.map((item) => (
                      <a
                        key={item.id}
                        href={item.url}
                        target="_blank"
                        className="flex items-center p-4 bg-white border border-gray-100 rounded-2xl hover:border-red-400 hover:shadow-lg transition-all group"
                      >
                        <div className="p-3 bg-red-50 rounded-xl text-red-600 mr-4 group-hover:bg-red-600 group-hover:text-white transition-colors">
                          <FileText className="w-5 h-5" />
                        </div>
                        <span className="text-sm font-bold text-gray-700 truncate">
                          {item.name}
                        </span>
                      </a>
                    ))}
                  </div>
                </div>
              )}
            </div>
            
            {/* Mobile Comment Section (hidden on desktop sidebar view) */}
            <div className="xl:hidden">
               <CommentSection lessonId={lessonId} />
            </div>
          </div>

          {/* --- RIGHT COLUMN: SIDEBAR TABS --- */}
          <div className="xl:col-span-1">
            <div className="sticky top-20 flex flex-col gap-6 max-h-[calc(100vh-120px)]">
               <div className="bg-white rounded-3xl border shadow-xl flex flex-col overflow-hidden h-full">
                  <Tabs defaultValue="discussion" className="flex flex-col h-full">
                     <TabsList className="grid grid-cols-2 h-14 bg-gray-50 border-b p-0 gap-0">
                        <TabsTrigger 
                          value="discussion" 
                          className="data-[state=active]:bg-white data-[state=active]:text-red-600 data-[state=active]:border-b-2 data-[state=active]:border-red-600 rounded-none h-full font-bold text-sm"
                        >
                           Thảo luận
                        </TabsTrigger>
                        <TabsTrigger 
                          value="content" 
                          className="data-[state=active]:bg-white data-[state=active]:text-red-600 data-[state=active]:border-b-2 data-[state=active]:border-red-600 rounded-none h-full font-bold text-sm"
                        >
                           Bài học
                        </TabsTrigger>
                     </TabsList>
                     
                     <div className="flex-1 overflow-y-auto custom-scrollbar">
                        <TabsContent value="discussion" className="m-0 p-4 h-full">
                           <CommentSection lessonId={lessonId} />
                        </TabsContent>
                        <TabsContent value="content" className="m-0 p-0 h-full">
                           <CourseSidebar course={course} currentLessonId={lessonId} />
                        </TabsContent>
                     </div>
                  </Tabs>
               </div>
               
               {/* Quick Info / Ad area like reference or just stats */}
               <div className="bg-gradient-to-br from-red-600 to-orange-500 rounded-3xl p-6 text-white shadow-lg">
                  <h4 className="font-bold mb-2">Hỗ trợ học tập</h4>
                  <p className="text-xs opacity-90 leading-relaxed mb-4">Nếu gặp khó khăn, hãy gửi câu hỏi vào phần thảo luận hoặc liên hệ đội ngũ hỗ trợ.</p>
                  <button className="w-full py-3 bg-white/20 hover:bg-white/30 backdrop-blur-md rounded-xl text-sm font-bold transition-all">
                     Nhắn tin hỗ trợ
                  </button>
               </div>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}
