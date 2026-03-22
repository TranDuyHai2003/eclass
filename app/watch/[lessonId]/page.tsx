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
  Menu,
  BookOpen
} from "lucide-react";
import Link from "next/link";
import { CommentSection } from "@/components/comment/CommentSection";
import { CourseProgressButton } from "@/components/course/CourseProgressButton";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import {
  Sheet,
  SheetContent,
  SheetHeader,
  SheetTitle,
  SheetTrigger,
} from "@/components/ui/sheet";

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
      <div className="bg-white/80 backdrop-blur-xl border-b border-border/60 px-4 sm:px-6 py-3 flex items-center justify-between sticky top-0 md:relative z-30">
        <div className="flex items-center gap-2 text-[11px] sm:text-sm text-gray-400">
          <Link href="/" className="hover:text-red-600 transition flex items-center gap-1">
            <Home className="w-3.5 h-3.5 sm:w-4 sm:h-4" />
            <span className="hidden sm:inline">Trang chủ</span>
          </Link>
          <ChevronRight className="w-3.5 h-3.5" />
          <Link
            href={`/courses/${lesson.chapter.courseId}`}
            className="hover:text-red-600 transition font-black truncate max-w-[100px] sm:max-w-none"
          >
            {course.title}
          </Link>
          <ChevronRight className="w-3.5 h-3.5" />
          <span className="font-black text-gray-900 truncate max-w-[120px] sm:max-w-[200px]">
            {lesson.title}
          </span>
        </div>
        
        {/* Mobile Syllabus Drawer Trigger */}
        <div className="xl:hidden">
          <Sheet>
            <SheetTrigger asChild>
              <button className="flex items-center gap-2 bg-red-50 text-red-600 px-3 py-1.5 rounded-full text-[10px] font-black uppercase tracking-widest shadow-sm">
                <BookOpen className="w-3.5 h-3.5" />
                <span>Nội dung</span>
              </button>
            </SheetTrigger>
            <SheetContent side="right" className="p-0 border-none w-[320px]">
               <SheetHeader className="p-6 border-b bg-gray-50/50">
                  <SheetTitle className="text-sm font-black uppercase tracking-tight">Danh sách bài học</SheetTitle>
               </SheetHeader>
               <div className="h-[calc(100vh-80px)] overflow-y-auto">
                 <CourseSidebar course={course} currentLessonId={lessonId} />
               </div>
            </SheetContent>
          </Sheet>
        </div>
      </div>

      <div className="container mx-auto pt-4 md:pt-6 pb-12 px-2 sm:px-6 lg:px-8 max-w-[1920px]">
        <div className="grid grid-cols-1 xl:grid-cols-4 gap-6 md:gap-8">
          {/* --- LEFT COLUMN: VIDEO & CONTENT --- */}
          <div className="xl:col-span-3 flex flex-col gap-4 md:gap-6">
            {/* Video Player Container */}
            <div className="bg-black rounded-2xl md:rounded-3xl overflow-hidden shadow-2xl ring-1 ring-black/10 aspect-video relative z-10 group">
              <VideoPlayer
                src={lesson.videoUrl || ""}
                title={lesson.title}
                poster={lesson.chapter.course.thumbnail || undefined}
              />
            </div>

            {/* Navigation & Progress Buttons - Engagement Layer */}
            <div className="card-surface flex flex-col md:flex-row items-center justify-between gap-4 p-4 rounded-3xl border-gray-100/50 shadow-sm">
              <div className="flex items-center gap-3 w-full md:w-auto">
                {prevLesson && (
                  <Link
                    href={`/watch/${prevLesson.id}`}
                    className="flex-1 md:flex-none flex items-center justify-center gap-2 px-4 sm:px-6 py-3 rounded-2xl border border-gray-200 bg-white hover:bg-gray-50 text-[10px] font-black uppercase tracking-[0.15em] transition shadow-sm group"
                  >
                    <ChevronLeft className="w-3.5 h-3.5 group-hover:-translate-x-1 transition-transform" /> 
                    <span className="hidden sm:inline">Bài trước</span>
                    <span className="sm:hidden">Trước</span>
                  </Link>
                )}
                
                {nextLesson && (
                  <Link
                    href={`/watch/${nextLesson.id}`}
                    className="flex-1 md:flex-none flex items-center justify-center gap-2 px-4 sm:px-6 py-3 rounded-2xl border border-gray-200 bg-white hover:bg-gray-50 text-[10px] font-black uppercase tracking-[0.15em] transition shadow-sm group"
                  >
                    <span className="hidden sm:inline">Bài sau</span>
                    <span className="sm:hidden">Sau</span>
                    <ChevronRight className="w-3.5 h-3.5 group-hover:translate-x-1 transition-transform" />
                  </Link>
                )}
              </div>

              <div className="w-full md:w-auto">
                <CourseProgressButton
                  lessonId={lessonId}
                  courseId={course.id}
                  nextLessonId={nextLesson?.id}
                  isCompleted={!!progress?.isCompleted}
                />
              </div>
            </div>

            {/* Main Content info */}
            <div className="card-surface rounded-3xl p-6 md:p-8 space-y-6">
              <div className="space-y-2">
                <span className="px-3 py-1 rounded-full bg-red-100 text-red-700 font-black text-[10px] uppercase tracking-widest inline-block">
                  {lesson.chapter.title}
                </span>
                <h1 className="text-2xl md:text-3xl font-black text-gray-900 leading-tight">
                  {lesson.title}
                </h1>
              </div>

              <Separator className="bg-gray-50" />

              <div className="prose prose-red max-w-none text-gray-600">
                <h3 className="text-lg md:text-xl font-bold text-gray-900 mb-4">
                  Nội dung chi tiết
                </h3>
                <div className="bg-gray-50/50 p-5 md:p-6 rounded-2xl border border-gray-100 italic text-sm md:text-base">
                  {lesson.description ||
                    "Bài học này hiện chưa có nội dung mô tả chi tiết. Hãy theo dõi video bài giảng để nắm bắt kiến thức quan trọng nhất."}
                </div>
              </div>

              {lesson.attachments.length > 0 && (
                <div className="bg-gray-50 rounded-2xl p-5 md:p-6 border border-gray-100">
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
            
            {/* Mobile Tabs Section (Visible on all screens but integrated for mobile) */}
            <div className="xl:hidden">
               <div className="card-surface rounded-3xl overflow-hidden min-h-[400px]">
                  <Tabs defaultValue="content" className="flex flex-col h-full">
                     <TabsList className="grid grid-cols-2 h-12 bg-gray-100/80 m-4 mb-2 p-1 gap-1 rounded-2xl border-none shadow-inner">
                        <TabsTrigger 
                          value="content" 
                          className="data-[state=active]:bg-white data-[state=active]:text-red-600 data-[state=active]:shadow-md rounded-xl h-full font-black text-[11px] uppercase tracking-widest transition-all"
                        >
                           Bài học
                        </TabsTrigger>
                        <TabsTrigger 
                          value="discussion" 
                          className="data-[state=active]:bg-white data-[state=active]:text-red-600 data-[state=active]:shadow-md rounded-xl h-full font-black text-[11px] uppercase tracking-widest transition-all"
                        >
                           Thảo luận
                        </TabsTrigger>
                     </TabsList>
                     
                     <div className="flex-1 bg-white">
                        <TabsContent value="content" className="m-0 p-0 h-full">
                           <CourseSidebar course={course} currentLessonId={lessonId} />
                        </TabsContent>
                        <TabsContent value="discussion" className="m-0 p-4 h-full">
                           <CommentSection lessonId={lessonId} />
                        </TabsContent>
                     </div>
                  </Tabs>
               </div>
            </div>
          </div>

          {/* --- RIGHT COLUMN: SIDEBAR TABS (Desktop Only) --- */}
          <div className="hidden xl:block xl:col-span-1">
            <div className="sticky top-20 flex flex-col gap-6 max-h-[calc(100vh-120px)]">
               <div className="bg-white rounded-3xl border shadow-xl flex flex-col overflow-hidden h-full">
                  <Tabs defaultValue="content" className="flex flex-col h-full">
                     <TabsList className="grid grid-cols-2 h-12 bg-gray-100/80 m-4 mb-2 p-1 gap-1 rounded-2xl border-none shadow-inner">
                        <TabsTrigger 
                          value="content" 
                          className="data-[state=active]:bg-white data-[state=active]:text-red-600 data-[state=active]:shadow-md rounded-xl h-full font-black text-[11px] uppercase tracking-widest transition-all"
                        >
                           Bài học
                        </TabsTrigger>
                        <TabsTrigger 
                          value="discussion" 
                          className="data-[state=active]:bg-white data-[state=active]:text-red-600 data-[state=active]:shadow-md rounded-xl h-full font-black text-[11px] uppercase tracking-widest transition-all"
                        >
                           Thảo luận
                        </TabsTrigger>
                     </TabsList>
                     
                     <div className="flex-1 overflow-y-auto custom-scrollbar">
                        <TabsContent value="content" className="m-0 p-0 h-full">
                           <CourseSidebar course={course} currentLessonId={lessonId} />
                        </TabsContent>
                        <TabsContent value="discussion" className="m-0 p-4 h-full">
                           <CommentSection lessonId={lessonId} />
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
