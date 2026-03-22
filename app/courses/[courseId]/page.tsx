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
  ChevronRight,
} from "lucide-react";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import type { Prisma } from "@prisma/client";
import type { ReactNode, ElementType } from "react";
import { auth } from "@/auth";
import { getEnrollmentStatus } from "@/actions/enrollment";
import { EnrollButton } from "@/components/course/EnrollButton";

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
  params,
}: {
  params: Promise<{ courseId: string }>;
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

  const totalLessons = c.chapters.reduce(
    (acc, ch) => acc + ch.lessons.length,
    0,
  );
  const firstLesson = c.chapters[0]?.lessons[0];

  const session = await auth();
  const enrollmentStatus = await getEnrollmentStatus(courseId);

  const isLoggedIn = !!session?.user;
  const isAdminOrTeacher =
    session?.user?.role === "ADMIN" || session?.user?.role === "TEACHER";
  const userEmail = session?.user?.email || "";

  return (
    <div className="page-shell">
      {/* Hero Section */}
      <section className="relative bg-gradient-to-r from-red-700 to-red-600 text-white pt-12 pb-20 overflow-hidden">
        {/* Decorative background elements */}
        <div className="absolute top-0 right-0 w-1/2 h-full opacity-10 pointer-events-none">
          <svg viewBox="0 0 400 400" className="w-full h-full">
            <circle cx="300" cy="100" r="150" fill="white" />
            <rect
              x="100"
              y="200"
              width="200"
              height="200"
              fill="white"
              transform="rotate(45 200 300)"
            />
          </svg>
        </div>

        <div className="container mx-auto px-4 sm:px-8 relative z-10">
          <div className="grid grid-cols-1 lg:grid-cols-2 gap-8 lg:gap-12 items-center">
            {/* Left: Course Thumbnail / Banner */}
            <div className="relative aspect-video rounded-2xl md:rounded-3xl overflow-hidden shadow-2xl border-2 sm:border-4 border-white/20">
              {c.thumbnail ? (
                <Image
                  src={c.thumbnail}
                  alt={c.title}
                  fill
                  className="object-cover"
                />
              ) : (
                <div className="w-full h-full bg-red-900/50 flex items-center justify-center">
                  <BookOpen className="w-12 h-12 sm:w-20 sm:h-20 opacity-20" />
                </div>
              )}
              {/* Overlay with play button like in reference */}
              <div className="absolute inset-0 flex items-center justify-center">
                <div className="w-12 h-12 sm:w-16 sm:h-16 bg-white/20 backdrop-blur-sm rounded-full flex items-center justify-center">
                  <div className="w-9 h-9 sm:w-12 sm:h-12 bg-white rounded-full flex items-center justify-center shadow-lg">
                    <Play className="w-4 h-4 sm:w-5 sm:h-5 text-red-600 fill-current ml-1" />
                  </div>
                </div>
              </div>
            </div>

            {/* Right: Course Info */}
            <div className="space-y-6">
              <h1 className="text-2xl sm:text-4xl md:text-5xl font-black tracking-tight uppercase leading-[1.1] sm:leading-tight text-center lg:text-left">
                {c.title}
              </h1>

              {/* Stats Grid */}
              <div className="grid grid-cols-2 md:grid-cols-4 gap-3 sm:gap-4">
                <StatBox icon={Clock} label="thời gian" value="0" />
                <StatBox
                  icon={BookOpen}
                  label="bài học"
                  value={totalLessons.toString()}
                />
                <StatBox icon={Users} label="học viên" value="10k+" />
                <StatBox icon={Star} label="đánh giá" value="5/5" />
              </div>

              {/* Instructor */}
              <div className="flex flex-col sm:flex-row items-center gap-4 sm:gap-3">
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
                    <p className="text-[10px] opacity-80 uppercase tracking-widest font-bold">
                      Giảng viên
                    </p>
                    <p className="font-bold text-base sm:text-lg">
                      {c.user?.name || "Toán Thầy Đức"}
                    </p>
                  </div>
                </div>
                <div className="sm:ml-auto w-full sm:w-auto bg-white/10 px-4 py-2 rounded-xl flex items-center justify-center sm:justify-start gap-2">
                  <Calendar className="w-4 h-4 text-accent" />
                  <span className="text-xs sm:text-sm font-medium">
                    Khai giảng: 19/05/2026
                  </span>
                </div>
              </div>

              {/* CTA Button */}
              <div className="pt-2 sm:pt-4 w-full">
                <EnrollButton
                  courseId={course.id}
                  courseTitle={course.title}
                  coursePrice={course.price || 0}
                  enrollmentStatus={enrollmentStatus}
                  firstLessonId={firstLesson?.id}
                  isLoggedIn={isLoggedIn}
                  isAdminOrTeacher={isAdminOrTeacher}
                  userEmail={userEmail}
                />
              </div>
            </div>
          </div>
        </div>
      </section>

      {/* Tabs Section */}
      <section className="relative z-20 pb-20">
        <Tabs defaultValue="content" className="w-full">
          {/* Tabs Navigation Header - Full Width Look */}
          <div className="bg-white border-b border-gray-200 sticky top-0 z-30 shadow-sm">
            <div className="container mx-auto px-4 sm:px-8">
              <TabsList
                variant="line"
                className="bg-transparent h-16 w-full flex justify-between sm:justify-center lg:justify-start gap-2 sm:gap-12 overflow-x-auto overflow-y-hidden custom-scrollbar flex-nowrap scrollbar-hide border-none"
              >
                <TabTrigger value="overview">Tổng quan</TabTrigger>
                <TabTrigger value="content">Nội dung</TabTrigger>
                <TabTrigger value="instructor">Giảng viên</TabTrigger>
                <TabTrigger value="reviews">Đánh giá</TabTrigger>
              </TabsList>
            </div>
          </div>

          {/* Content Area */}
          <div className="container mx-auto px-4 sm:px-8 mt-2 lg:mt-6">
            <div className="bg-white rounded-3xl p-4 sm:p-12 shadow-sm border border-gray-100 min-h-[500px]">
              <TabsContent value="overview" className="space-y-8 mt-0">
                <div className="flex items-center gap-4 mb-4">
                  <div className="w-2 h-8 bg-red-600 rounded-full" />
                  <h2 className="text-2xl sm:text-3xl font-black text-gray-900 uppercase tracking-tight">
                    Về khóa học này
                  </h2>
                </div>
                <div className="prose prose-sm sm:prose-base max-w-none text-gray-600 leading-relaxed font-medium">
                  {c.description ||
                    "Thông tin giới thiệu về khóa học hiện chưa có sẵn. Vui lòng quay lại sau."}
                </div>
              </TabsContent>

              <TabsContent value="content" className="space-y-6">
                <div className="flex items-center justify-between mb-2">
                  <h2 className="text-2xl font-bold text-gray-900">
                    Nội dung khóa học
                  </h2>
                  <p className="text-sm text-gray-500 font-medium">
                    {c.chapters.length} chương • {totalLessons} bài học
                  </p>
                </div>

                <div className="space-y-4">
                  {c.chapters.map((chapter, idx) => (
                    <div
                      key={chapter.id}
                      className="border rounded-2xl overflow-hidden"
                    >
                      <div className="bg-red-50/50 px-6 py-4 flex items-center justify-between border-b cursor-pointer hover:bg-red-50 transition">
                        <div className="flex items-center gap-4">
                          <span className="w-8 h-8 rounded-full bg-red-600 text-white flex items-center justify-center font-bold text-sm">
                            {String.fromCharCode(65 + idx)}
                          </span>
                          <h3 className="font-bold text-gray-900 uppercase tracking-tight">
                            {chapter.title}
                          </h3>
                        </div>
                        <div className="flex items-center gap-2">
                          <span className="px-3 py-1 bg-red-100 text-red-700 rounded-full text-xs font-bold">
                            {chapter.lessons.length}
                          </span>
                          <ChevronRight className="w-4 h-4 text-gray-400" />
                        </div>
                      </div>
                    </div>
                  ))}
                </div>
              </TabsContent>

              <TabsContent value="instructor">
                <h2 className="text-2xl font-bold text-gray-900 mb-4">
                  Thông tin giảng viên
                </h2>
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
                    <h3 className="text-xl font-bold text-gray-900">
                      {c.user?.name || "Toán Thầy Đức"}
                    </h3>
                    <p className="text-red-600 font-medium text-sm mt-1">
                      Giảng viên chuyên môn
                    </p>
                    <p className="mt-4 text-gray-600">
                      Thông tin chi tiết về kinh nghiệm và phương pháp giảng dạy
                      của giảng viên sẽ được cập nhật sớm.
                    </p>
                  </div>
                </div>
              </TabsContent>
            </div>
          </div>
        </Tabs>
      </section>

      {/* Sticky Bottom Bar for Mobile */}
      <div className="lg:hidden fixed bottom-0 left-0 right-0 z-[100] p-4 bg-white/95 backdrop-blur-xl border-t border-gray-200/50 shadow-[0_-10px_40px_rgba(0,0,0,0.08)] animate-in fade-in slide-in-from-bottom-5 duration-500">
        <EnrollButton
          courseId={course.id}
          courseTitle={course.title}
          coursePrice={course.price || 0}
          enrollmentStatus={enrollmentStatus}
          firstLessonId={firstLesson?.id}
          isLoggedIn={isLoggedIn}
          isAdminOrTeacher={isAdminOrTeacher}
          userEmail={userEmail}
        />
      </div>

      <div className="pb-24 lg:pb-0" />
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
      <p className="text-[10px] uppercase tracking-widest opacity-80 font-bold">
        {label}
      </p>
    </div>
  );
}

function TabTrigger({
  value,
  children,
}: {
  value: string;
  children: ReactNode;
}) {
  return (
    <TabsTrigger
      value={value}
      className="data-[state=active]:bg-transparent data-[state=active]:text-red-600 data-[state=active]:border-b-red-600 data-[state=active]:border-b-4 data-[state=active]:border-x-transparent data-[state=active]:border-t-transparent after:hidden rounded-none h-full font-bold text-sm text-gray-500 transition-all px-0"
    >
      {children}
    </TabsTrigger>
  );
}
