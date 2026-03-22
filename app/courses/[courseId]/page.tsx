import { prisma } from "@/lib/prisma";
import { notFound } from "next/navigation";
import Image from "next/image";
import Link from "next/link";
import { 
  Play, 
  Clock, 
  BookOpen, 
  Users, 
  Star,
  Calendar,
  ChevronRight
} from "lucide-react";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import type { Prisma } from "@prisma/client";
import type { ReactNode, ElementType } from "react";

type CourseWithRelations = Prisma.CourseGetPayload<{
  include: {
    chapters: {
      include: { lessons: true };
    };
    user: true;
    category: true;
  };
}>;

export default async function CoursePage({ 
  params 
}: { 
  params: Promise<{ courseId: string }> 
}) {
  const { courseId } = await params;

  const course = await prisma.course.findUnique({
    where: { id: courseId },
    include: {
      chapters: {
        include: {
          lessons: {
            orderBy: { position: "asc" },
          },
        },
        orderBy: { position: "asc" },
      },
      user: true,
      category: true,
    },
  });

  if (!course) return notFound();
  const c: CourseWithRelations = course;

  const totalLessons = c.chapters.reduce((acc, ch) => acc + ch.lessons.length, 0);
  const firstLesson = c.chapters[0]?.lessons[0];

  return (
    <div className="page-shell">
      {/* Hero Section */}
      <section className="relative bg-gradient-to-r from-red-700 to-red-600 text-white pt-12 pb-20 overflow-hidden">
        {/* Decorative background elements */}
        <div className="absolute top-0 right-0 w-1/2 h-full opacity-10 pointer-events-none">
           <svg viewBox="0 0 400 400" className="w-full h-full">
              <circle cx="300" cy="100" r="150" fill="white" />
              <rect x="100" y="200" width="200" height="200" fill="white" transform="rotate(45 200 300)" />
           </svg>
        </div>

        <div className="container mx-auto px-6 sm:px-8 relative z-10">
          <div className="grid grid-cols-1 lg:grid-cols-2 gap-12 items-center">
            {/* Left: Course Thumbnail / Banner */}
            <div className="relative aspect-video rounded-3xl overflow-hidden shadow-2xl border-4 border-white/20">
              {c.thumbnail ? (
                <Image src={c.thumbnail} alt={c.title} fill className="object-cover" />
              ) : (
                <div className="w-full h-full bg-red-900/50 flex items-center justify-center">
                   <BookOpen className="w-20 h-20 opacity-20" />
                </div>
              )}
              {/* Overlay with play button like in reference */}
              <div className="absolute inset-0 flex items-center justify-center">
                 <div className="w-16 h-16 bg-white/20 backdrop-blur-sm rounded-full flex items-center justify-center">
                    <div className="w-12 h-12 bg-white rounded-full flex items-center justify-center shadow-lg">
                       <Play className="w-5 h-5 text-red-600 fill-current ml-1" />
                    </div>
                 </div>
              </div>
            </div>

            {/* Right: Course Info */}
            <div className="space-y-6">
              <h1 className="text-3xl sm:text-4xl md:text-5xl font-black tracking-tight uppercase leading-tight">
                {c.title}
              </h1>
              
              {/* Stats Grid */}
              <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
                <StatBox icon={Clock} label="thời gian" value="0" />
                <StatBox icon={BookOpen} label="bài học" value={totalLessons.toString()} />
                <StatBox icon={Users} label="học viên" value="10.000+" />
                <StatBox icon={Star} label="đánh giá" value="5/5" />
              </div>

              {/* Instructor */}
              <div className="flex items-center gap-3">
                 <div className="w-10 h-10 rounded-full bg-white/20 flex items-center justify-center overflow-hidden border border-white/30">
                    {c.user?.image ? (
                      <Image
                        src={c.user.image}
                        alt={c.user.name || "Giảng viên"}
                        width={40}
                        height={40}
                        className="w-full h-full object-cover"
                      />
                    ) : (
                      <Users className="w-5 h-5 text-white" />
                    )}
                 </div>
                 <div>
                    <p className="text-xs opacity-80 uppercase tracking-widest font-bold">Giảng viên</p>
                    <p className="font-bold text-lg">{c.user?.name || "Tenschool.vn"}</p>
                 </div>
                 <div className="ml-auto bg-white/10 px-4 py-2 rounded-xl flex items-center gap-2">
                    <Calendar className="w-4 h-4 text-accent" />
                    <span className="text-sm font-medium">Khai giảng: 19/05/2026</span>
                 </div>
              </div>

              {/* CTA Button */}
              <div className="pt-4">
                <Link 
                  href={firstLesson ? `/watch/${firstLesson.id}` : "#"}
                  className="inline-flex items-center justify-center px-10 py-5 bg-white text-red-600 font-black text-lg rounded-2xl shadow-xl hover:bg-gray-50 transition-all hover:scale-105 active:scale-95 uppercase tracking-wide"
                >
                  Vào học ngay
                </Link>
              </div>
            </div>
          </div>
        </div>
      </section>

      {/* Tabs Section */}
      <section className="container mx-auto px-6 sm:px-8 -mt-8 relative z-20">
        <Tabs defaultValue="content" className="w-full">
          <div className="bg-white rounded-t-2xl border-x border-t shadow-sm">
            <TabsList className="bg-transparent h-16 border-b-2 border-gray-50 w-full justify-start px-4 gap-8">
              <TabTrigger value="overview">Tổng quan</TabTrigger>
              <TabTrigger value="content">Nội dung khóa học</TabTrigger>
              <TabTrigger value="instructor">Giảng viên</TabTrigger>
              <TabTrigger value="reviews">Đánh giá</TabTrigger>
            </TabsList>
          </div>

          <div className="bg-white rounded-b-2xl border-x border-b p-8 shadow-sm min-h-[400px]">
            <TabsContent value="overview" className="space-y-4">
              <h2 className="text-2xl font-bold text-gray-900">Giới thiệu khóa học</h2>
              <div className="prose max-w-none text-gray-600">
                {c.description || "Thông tin giới thiệu về khóa học hiện chưa có sẵn. Vui lòng quay lại sau."}
              </div>
            </TabsContent>

            <TabsContent value="content" className="space-y-6">
              <div className="flex items-center justify-between mb-2">
                 <h2 className="text-2xl font-bold text-gray-900">Nội dung khóa học</h2>
                 <p className="text-sm text-gray-500 font-medium">{c.chapters.length} chương • {totalLessons} bài học</p>
              </div>
              
              <div className="space-y-4">
                {c.chapters.map((chapter, idx) => (
                  <div key={chapter.id} className="border rounded-2xl overflow-hidden">
                    <div className="bg-red-50/50 px-6 py-4 flex items-center justify-between border-b cursor-pointer hover:bg-red-50 transition">
                       <div className="flex items-center gap-4">
                          <span className="w-8 h-8 rounded-full bg-red-600 text-white flex items-center justify-center font-bold text-sm">
                             {String.fromCharCode(65 + idx)}
                          </span>
                          <h3 className="font-bold text-gray-900 uppercase tracking-tight">{chapter.title}</h3>
                       </div>
                       <div className="flex items-center gap-2">
                          <span className="px-3 py-1 bg-red-100 text-red-700 rounded-full text-xs font-bold">{chapter.lessons.length}</span>
                          <ChevronRight className="w-4 h-4 text-gray-400" />
                       </div>
                    </div>
                  </div>
                ))}
              </div>
            </TabsContent>
            
            <TabsContent value="instructor">
               <h2 className="text-2xl font-bold text-gray-900 mb-4">Thông tin giảng viên</h2>
               <div className="flex gap-6 items-start">
                  <div className="w-32 h-32 rounded-3xl bg-gray-100 overflow-hidden ring-4 ring-red-50">
                     {c.user?.image ? (
                       <Image
                         src={c.user.image}
                         alt={c.user?.name || "Giảng viên"}
                         width={128}
                         height={128}
                         className="w-full h-full object-cover"
                       />
                     ) : null}
                  </div>
                  <div>
                     <h3 className="text-xl font-bold text-gray-900">{c.user?.name || "Tenschool.vn"}</h3>
                     <p className="text-red-600 font-medium text-sm mt-1">Giảng viên chuyên môn</p>
                     <p className="mt-4 text-gray-600">Thông tin chi tiết về kinh nghiệm và phương pháp giảng dạy của giảng viên sẽ được cập nhật sớm.</p>
                  </div>
               </div>
            </TabsContent>
          </div>
        </Tabs>
      </section>
    </div>
  );
}

function StatBox({
  icon: Icon,
  label,
  value,
}: {
  icon: ElementType;
  label: string;
  value: string;
}) {
  return (
    <div className="bg-white/10 backdrop-blur-sm rounded-2xl p-4 border border-white/20 flex flex-col items-center text-center">
      <div className="w-10 h-10 rounded-full bg-orange-400/20 flex items-center justify-center mb-2">
         <Icon className="w-5 h-5 text-accent" />
      </div>
      <p className="text-xl font-black">{value}</p>
      <p className="text-[10px] uppercase tracking-widest opacity-80 font-bold">{label}</p>
    </div>
  );
}

function TabTrigger({ value, children }: { value: string; children: ReactNode }) {
  return (
    <TabsTrigger 
      value={value} 
      className="data-[state=active]:bg-transparent data-[state=active]:text-red-600 data-[state=active]:border-b-4 data-[state=active]:border-red-600 rounded-none h-full font-bold text-sm text-gray-500 transition-all border-b-4 border-transparent px-0"
    >
      {children}
    </TabsTrigger>
  );
}
