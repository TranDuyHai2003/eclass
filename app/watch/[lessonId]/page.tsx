import { prisma } from "@/lib/prisma";
import VideoPlayer from "@/components/player/VideoPlayer";
import CourseSidebar from "@/components/course/CourseSidebar";
import { DocumentViewer } from "@/components/course/DocumentViewer";
import { CountdownTimer } from "@/components/course/CountdownTimer";
import { notFound, redirect } from "next/navigation";
import { auth } from "@/auth";
import { Separator } from "@/components/ui/separator"; 
import {
  FileText,
  Download,
  ChevronLeft,
  ChevronRight,
  Home,
  Menu,
  BookOpen,
  LayoutList,
  MessageCircle,
  FileDown,
  Info,
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
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuLabel,
  DropdownMenuSeparator,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";
import QuizEntryCard from "./_components/QuizEntryCard";
import { cn } from "@/lib/utils";

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

  // ... (Keep existing data fetching logic)
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

  const progress = await prisma.progress.findUnique({
    where: {
      userId_lessonId: {
        userId: session.user.id!,
        lessonId,
      },
    },
  });

  const allLessons = course.chapters.flatMap((c) => c.lessons);
  const currentLessonIndex = allLessons.findIndex((l) => l.id === lessonId);
  const prevLesson =
    currentLessonIndex > 0 ? allLessons[currentLessonIndex - 1] : null;
  const nextLesson =
    currentLessonIndex < allLessons.length - 1
      ? allLessons[currentLessonIndex + 1]
      : null;

  let test = null;
  let quizDuration = 45;
  if (lesson.type === 'QUIZ') {
    test = await prisma.test.findUnique({ 
      where: { lessonId },
      include: {
        sections: {
          include: {
            questions: {
              orderBy: { position: "asc" }
            }
          },
          orderBy: { position: "asc" }
        }
      }
    });
    if (test) quizDuration = test.duration;
  }

  return (
    <div className="flex flex-col bg-[#F8F9FB] min-h-screen">
      {/* Main Content Layout */}
      <main className="flex-1 flex flex-col lg:flex-row relative">
        
        {/* Left Column: Video & Content - Natural Page Scroll */}
        <div className="flex-1 flex flex-col min-w-0 bg-white border-r border-slate-100">
          
          {/* Video Section - Optimized Height */}
          <div className="w-full bg-slate-950 shrink-0">
            <div className="max-w-[1600px] mx-auto aspect-video">
              {lesson.videoUrl ? (
                <VideoPlayer
                  src={lesson.videoUrl}
                  title={lesson.title}
                  poster={lesson.chapter.course.thumbnail || undefined}
                />
              ) : lesson.type === "QUIZ" ? (
                <div className="w-full h-full bg-[#0F172A] flex flex-col items-center justify-center gap-6 py-20">
                  <div className="w-16 h-16 bg-white/5 rounded-2xl flex items-center justify-center border border-white/10">
                    <BookOpen className="w-8 h-8 text-red-500" />
                  </div>
                  <h2 className="text-white font-black text-2xl">Bài kiểm tra đánh giá</h2>
                  <div className="px-5 py-2 bg-white/5 rounded-xl border border-white/10 text-slate-300 font-bold text-sm">
                    {quizDuration} Phút
                  </div>
                </div>
              ) : (
                <div className="w-full h-full bg-slate-900 flex items-center justify-center text-slate-500 font-bold uppercase tracking-widest">
                   Không có video bài giảng
                </div>
              )}
            </div>
          </div>

          {/* Lesson Info & Quick Controls */}
          <div className="px-4 md:px-10 py-5 border-b border-slate-50 flex flex-col md:flex-row md:items-center justify-between gap-4 shrink-0">
             <div className="min-w-0">
                <p className="text-[12px] font-black text-red-600 uppercase tracking-[0.2em] mb-1">
                  {lesson.chapter.title}
                </p>
                <div className="flex items-center gap-3">
                   <h1 className="text-2xl md:text-3xl font-black text-slate-900 tracking-tight leading-tight">
                     {lesson.title}
                   </h1>
                   <div className="hidden sm:flex items-center gap-2 px-3 py-1 bg-slate-100 rounded-full shrink-0">
                      <span className="w-1.5 h-1.5 rounded-full bg-red-600 animate-pulse" />
                      <span className="text-[10px] font-black uppercase tracking-tight text-slate-500">Đang phát</span>
                   </div>
                </div>
             </div>

             <div className="flex items-center gap-3">
                <div className="flex items-center gap-2 mr-3">
                  {prevLesson && (
                    <Link href={`/watch/${prevLesson.id}`} className="p-3.5 rounded-2xl bg-slate-50 hover:bg-slate-100 text-slate-600 border border-slate-200/50 transition-all shadow-sm">
                      <ChevronLeft className="w-5 h-5" />
                    </Link>
                  )}
                  {nextLesson && (
                    <Link href={`/watch/${nextLesson.id}`} className="p-3.5 rounded-2xl bg-slate-50 hover:bg-slate-100 text-slate-600 border border-slate-200/50 transition-all shadow-sm">
                      <ChevronRight className="w-5 h-5" />
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
          </div>

          {/* Content Tabs - Sticky to global header height when scrolling */}
          <Tabs defaultValue={test ? "quiz" : "description"} className="flex-1 flex flex-col">
            <div className="px-4 md:px-10 py-4 bg-white border-b border-slate-50 sticky top-[108px] lg:top-[108px] z-30 shadow-[0_4px_12px_-4px_rgba(0,0,0,0.02)]">
              <TabsList className="bg-slate-100/50 p-1.5 rounded-2xl h-12 w-fit">
                <TabsTrigger value="lessons" className="px-7 rounded-xl text-[14px] font-black uppercase tracking-wider h-full data-[state=active]:bg-white data-[state=active]:text-red-600 transition-all">
                  Nội dung
                </TabsTrigger>
                <TabsTrigger value="description" className="px-7 rounded-xl text-[14px] font-black uppercase tracking-wider h-full data-[state=active]:bg-white data-[state=active]:text-red-600 transition-all">
                  Mô tả
                </TabsTrigger>
                <TabsTrigger value="documents" className="px-7 rounded-xl text-[14px] font-black uppercase tracking-wider h-full data-[state=active]:bg-white data-[state=active]:text-red-600 transition-all">
                  Tài liệu
                </TabsTrigger>
                {test && (
                   <TabsTrigger value="quiz" className="px-7 rounded-xl text-[14px] font-black uppercase tracking-wider h-full data-[state=active]:bg-white data-[state=active]:text-red-600 transition-all">
                     Làm Quiz
                   </TabsTrigger>
                )}
              </TabsList>
            </div>

            <div className="p-4 md:p-10 bg-white flex-1 min-h-[600px]">
              <TabsContent value="lessons" className="m-0 focus-visible:outline-none">
                <div className="max-w-5xl mx-auto">
                   <CourseSidebar course={course} currentLessonId={lessonId} />
                </div>
              </TabsContent>

              <TabsContent value="description" className="m-0 focus-visible:outline-none animate-in fade-in duration-300">
                <div className="max-w-5xl mx-auto">
                   <div className="bg-slate-50/50 rounded-[40px] p-8 md:p-14 border border-slate-100 text-slate-800 leading-relaxed text-xl md:text-2xl whitespace-pre-wrap font-bold">
                      {lesson.description || "Bài học này hiện chưa có mô tả chi tiết."}
                   </div>
                </div>
              </TabsContent>

              <TabsContent value="documents" className="m-0 focus-visible:outline-none">
                <div className="max-w-5xl mx-auto">
                  {lesson.attachments.length > 0 ? (
                    <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
                      {lesson.attachments.map((item) => (
                        <a
                          key={item.id}
                          href={item.url}
                          target="_blank"
                          className="flex items-center p-6 bg-white border border-slate-100 rounded-[24px] hover:border-red-500 transition-all group shadow-sm hover:shadow-xl hover:shadow-red-500/5"
                        >
                          <div className="w-14 h-14 bg-red-50 rounded-2xl flex items-center justify-center text-red-600 mr-5 group-hover:bg-red-600 group-hover:text-white transition-colors">
                            <FileText className="w-7 h-7" />
                          </div>
                          <div className="flex-1 min-w-0">
                             <p className="font-black text-slate-900 truncate text-lg md:text-xl mb-1">{item.name}</p>
                             <span className="text-[10px] font-black uppercase tracking-widest text-slate-400">Tải xuống tài liệu</span>
                          </div>
                          <Download className="w-5 h-5 text-slate-300 ml-auto group-hover:text-red-600" />
                        </a>
                      ))}
                    </div>
                  ) : (
                    <p className="text-center py-16 text-slate-400 text-lg font-black uppercase tracking-widest opacity-50">Không có tài liệu đính kèm</p>
                  )}
                </div>
              </TabsContent>

              <TabsContent value="quiz" className="m-0 focus-visible:outline-none">
                <div className="max-w-4xl mx-auto">
                  <QuizEntryCard
                    lessonId={lessonId}
                    course={course}
                    lesson={lesson}
                    duration={quizDuration}
                    test={test}
                  />
                </div>
              </TabsContent>
            </div>
          </Tabs>
        </div>

        {/* Right Column: Discussion - Sticky Sidebar with Independent Scroll */}
        <aside className="w-full lg:w-[380px] xl:w-[440px] shrink-0 bg-white border-l border-slate-100 lg:sticky lg:top-[108px] lg:h-[calc(100vh-108px)] flex flex-col">
           <div className="h-12 px-6 border-b border-slate-50 flex items-center justify-between bg-white shrink-0">
              <div className="flex items-center gap-2">
                 <MessageCircle className="w-4 h-4 text-red-600" />
                 <span className="text-xs font-black text-slate-900 uppercase tracking-widest">Thảo luận</span>
              </div>
              <div className="flex items-center gap-1.5">
                 <span className="w-1.5 h-1.5 rounded-full bg-emerald-500 animate-pulse" />
                 <span className="text-[9px] text-slate-500 font-bold uppercase">Online</span>
              </div>
           </div>
           <div className="flex-1 min-h-0 overflow-y-auto custom-scrollbar">
              <CommentSection lessonId={lessonId} />
           </div>
        </aside>
      </main>
    </div>
  );
}

function ChevronDown(props: any) {
  return (
    <svg
      {...props}
      xmlns="http://www.w3.org/2000/svg"
      width="24"
      height="24"
      viewBox="0 0 24 24"
      fill="none"
      stroke="currentColor"
      strokeWidth="2"
      strokeLinecap="round"
      strokeLinejoin="round"
    >
      <path d="m6 9 6 6 6-6" />
    </svg>
  );
}
