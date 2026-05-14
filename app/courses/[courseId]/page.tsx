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
  ShieldCheck,
  Zap,
  Award,
  Download,
  PlaySquare,
  Trophy,
  FileCheck,
  Sparkles,
  ArrowLeft,
} from "lucide-react";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import type { Prisma } from "@prisma/client";
import type { ReactNode, ElementType } from "react";
import { auth } from "@/auth";
import { getEnrollmentStatus } from "@/actions/enrollment";
import { EnrollButton } from "@/components/course/EnrollButton";
import { CourseAccordion } from "./_components/CourseAccordion";
import { cn } from "@/lib/utils";

type CourseWithRelations = Prisma.CourseGetPayload<{
  include: {
    chapters: {
      include: { lessons: true };
    };
    user: true;
    category: true;
    finalTest: true;
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
      finalTest: true,
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
  // const enrollmentStatus = await getEnrollmentStatus(courseId);
  // TEMPORARILY BYPASS ENROLLMENT:
  const enrollmentStatus = "ACTIVE";

  const isLoggedIn = !!session?.user;
  const isAdminOrTeacher =
    session?.user?.role === "ADMIN" || session?.user?.role === "TEACHER";
  const userEmail = session?.user?.email || "";

  return (
    <div className="page-shell bg-[#F8FAFC] relative">
      {/* 1. Premium Hero Section */}
      <section className="relative bg-slate-950 text-white overflow-hidden pb-12 lg:pb-0">
        {/* Animated Background Glows */}
        <div className="absolute inset-0 pointer-events-none">
           <div className="absolute top-[-10%] right-[-5%] w-[50%] h-[70%] bg-red-600/20 blur-[120px] rounded-full animate-pulse" />
           <div className="absolute bottom-[-20%] left-[-10%] w-[40%] h-[60%] bg-orange-600/10 blur-[100px] rounded-full animate-pulse delay-1000" />
           <div className="absolute inset-0 bg-[url('https://www.transparenttextures.com/patterns/carbon-fibre.png')] opacity-10" />
        </div>

        <div className="container mx-auto px-4 sm:px-6 lg:px-8 relative z-10">
          <div className="flex flex-col lg:flex-row gap-12 lg:gap-20 py-12 sm:py-20 lg:py-24">
            
            {/* Left Content */}
            <div className="flex-1 space-y-8 text-center lg:text-left">
              <div className="space-y-4">
                <div className="inline-flex items-center gap-2 px-3 py-1 rounded-full bg-red-600/20 border border-red-500/30 text-red-500 text-[10px] font-black uppercase tracking-[0.2em] animate-in fade-in slide-in-from-bottom-2 duration-700">
                  <Zap className="w-3 h-3 fill-current" />
                  Lộ trình bứt phá 2026
                </div>
                
                <h1 className="text-3xl sm:text-5xl md:text-6xl font-black tracking-tighter uppercase leading-[0.9] text-balance animate-in fade-in slide-in-from-bottom-4 duration-700 delay-100">
                  {c.title}
                </h1>
                
                <p className="text-sm sm:text-lg text-slate-400 font-medium max-w-2xl mx-auto lg:mx-0 leading-relaxed uppercase tracking-tight animate-in fade-in slide-in-from-bottom-6 duration-700 delay-200">
                   Chương trình giảng dạy chuyên sâu, hệ thống bài tập phong phú giúp bạn làm chủ hoàn toàn kiến thức {c.category?.name?.toLowerCase() || "toán học"}.
                </p>
              </div>

              {/* Stats Bar */}
              <div className="flex flex-wrap justify-center lg:justify-start gap-4 sm:gap-8 animate-in fade-in slide-in-from-bottom-8 duration-700 delay-300">
                 <StatItem icon={Clock} label="Thời lượng" value="120 giờ+" />
                 <div className="w-px h-10 bg-white/10 hidden sm:block" />
                 <StatItem icon={BookOpen} label="Bài học" value={`${totalLessons} Bài`} />
                 <div className="w-px h-10 bg-white/10 hidden sm:block" />
                 <StatItem icon={Users} label="Học viên" value="5.2k+" />
                 <div className="w-px h-10 bg-white/10 hidden sm:block" />
                 <StatItem icon={Star} label="Đánh giá" value="4.9/5" />
              </div>

              {/* Trust Indicators */}
              <div className="flex flex-wrap justify-center lg:justify-start gap-6 pt-4 animate-in fade-in slide-in-from-bottom-10 duration-700 delay-400">
                 <div className="flex items-center gap-2 text-[10px] font-black uppercase tracking-widest text-slate-400">
                    <ShieldCheck className="w-4 h-4 text-emerald-500" />
                    Cam kết chất lượng
                 </div>
                 <div className="flex items-center gap-2 text-[10px] font-black uppercase tracking-widest text-slate-400">
                    <Award className="w-4 h-4 text-amber-500" />
                    Hỗ trợ 24/7
                 </div>
                 <div className="flex items-center gap-2 text-[10px] font-black uppercase tracking-widest text-slate-400">
                    <Download className="w-4 h-4 text-blue-500" />
                    Tài liệu bản quyền
                 </div>
              </div>
            </div>

            {/* Right Media Section - Video/Thumbnail Preview */}
            <div className="lg:w-[450px] shrink-0 order-first lg:order-2">
               <div className="relative aspect-[16/10] lg:aspect-[4/5] rounded-[3rem] overflow-hidden shadow-2xl shadow-red-600/10 border-4 border-white/5 group animate-in fade-in zoom-in-95 duration-1000">
                  {c.thumbnail ? (
                    <Image
                      src={c.thumbnail}
                      alt={c.title}
                      fill
                      className="object-cover group-hover:scale-105 transition-transform duration-1000"
                    />
                  ) : (
                    <div className="w-full h-full bg-slate-900 flex items-center justify-center">
                       <Play className="w-16 h-16 text-white opacity-20" />
                    </div>
                  )}
                  <div className="absolute inset-0 bg-gradient-to-t from-slate-950 via-transparent to-transparent opacity-60" />
                  
                  {/* Play Button Overlay */}
                  <div className="absolute inset-0 flex items-center justify-center">
                     <div className="w-20 h-20 bg-white/10 backdrop-blur-xl rounded-full flex items-center justify-center border border-white/20 shadow-2xl group-hover:scale-110 transition-all duration-500 cursor-pointer">
                        <div className="w-14 h-14 bg-white rounded-full flex items-center justify-center shadow-lg">
                           <Play className="w-6 h-6 text-red-600 fill-current ml-1" />
                        </div>
                     </div>
                  </div>

                  {/* Course Category Float */}
                  <div className="absolute top-6 left-6">
                     <div className="px-4 py-2 bg-slate-900/90 backdrop-blur-md rounded-2xl border border-white/10 text-[9px] font-black uppercase tracking-widest">
                        {c.category?.name || "Toán Học"}
                     </div>
                  </div>
               </div>
            </div>
          </div>
        </div>
      </section>

      {/* 2. Main Content Grid */}
      <section className="container mx-auto px-4 sm:px-6 lg:px-8 -mt-12 lg:-mt-16 pb-24 relative z-20">
        <div className="flex flex-col lg:flex-row gap-8 lg:gap-12">
          
          {/* Left Column: Details & Tabs */}
          <div className="flex-1 space-y-8">
            <div className="card-surface bg-white rounded-[2.5rem] overflow-hidden shadow-xl shadow-slate-200/50 border border-slate-100">
              <Tabs defaultValue="overview" className="w-full">
                <div className="flex justify-center sm:justify-start px-6 sm:px-10 pt-8">
                  <TabsList className="bg-slate-100/80 p-1.5 rounded-[1.5rem] h-auto flex flex-wrap sm:flex-nowrap gap-1 items-center border border-slate-200/50 backdrop-blur-sm">
                    <TabTrigger value="overview">Tổng quan</TabTrigger>
                    <TabTrigger value="content">Lộ trình học</TabTrigger>
                    <TabTrigger value="instructor">Giảng viên</TabTrigger>
                    <TabTrigger value="faq">Hỏi đáp</TabTrigger>
                  </TabsList>
                </div>

                <div className="p-4 sm:p-10">
                  <TabsContent value="overview" className="mt-0 space-y-8 animate-in fade-in duration-500">
                    <div className="space-y-4">
                       <h2 className="text-2xl font-black text-slate-900 uppercase tracking-tight flex items-center gap-3">
                          <span className="w-1.5 h-6 bg-red-600 rounded-full" />
                          Giới thiệu khóa học
                       </h2>
                       <div className="prose prose-slate max-w-none prose-p:text-slate-600 prose-p:leading-relaxed prose-p:font-medium prose-p:text-base">
                          {c.description ? (
                             <div className="whitespace-pre-wrap">{c.description}</div>
                          ) : (
                             <p>Khóa học hiện đang trong quá trình cập nhật nội dung chi tiết. Vui lòng quay lại sau.</p>
                          )}
                       </div>
                    </div>

                    {/* What you'll learn grid */}
                    <div className="grid grid-cols-1 md:grid-cols-2 gap-4 pt-4">
                       {[
                         "Nắm vững nền tảng kiến thức trọng tâm",
                         "Luyện tập các dạng bài khó, cực khó",
                         "Chiến thuật giải nhanh bằng máy tính",
                         "Kỹ năng quản lý thời gian làm bài"
                       ].map((item, i) => (
                         <div key={i} className="flex items-start gap-3 p-4 bg-slate-50 rounded-2xl border border-slate-100 group hover:border-red-100 transition-colors">
                            <div className="w-5 h-5 rounded-full bg-emerald-100 text-emerald-600 flex items-center justify-center shrink-0 mt-0.5">
                               <ChevronRight className="w-3 h-3 stroke-[3]" />
                            </div>
                            <span className="text-sm font-bold text-slate-700 uppercase tracking-tight">{item}</span>
                         </div>
                       ))}
                    </div>
                  </TabsContent>

                  <TabsContent value="content" className="mt-0 space-y-6 animate-in fade-in duration-500">
                    <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4 mb-4">
                       <h2 className="text-2xl font-black text-slate-900 uppercase tracking-tight">Chi tiết bài giảng</h2>
                       <div className="px-4 py-1.5 bg-slate-100 rounded-full text-[10px] font-black text-slate-500 uppercase tracking-widest">
                          {c.chapters.length} Chương • {totalLessons} Bài giảng
                       </div>
                    </div>
                    
                    <CourseAccordion
                      chapters={c.chapters}
                      isEnrolled={enrollmentStatus === "ACTIVE"}
                    />

                    {/* Final Test Card */}
                    {c.finalTest && (
                      <div className="mt-8 relative group">
                        <div className="absolute inset-0 bg-gradient-to-r from-red-600 to-orange-500 rounded-3xl blur-xl opacity-10 group-hover:opacity-20 transition-opacity" />
                        <div className="relative bg-white rounded-3xl border border-red-100 p-6 sm:p-8 flex flex-col sm:flex-row items-center justify-between gap-6">
                           <div className="flex items-center gap-5 text-center sm:text-left flex-col sm:flex-row">
                              <div className="w-16 h-16 rounded-[1.5rem] bg-red-50 flex items-center justify-center shrink-0 border border-red-100">
                                 <Trophy className="w-8 h-8 text-red-600" />
                              </div>
                              <div className="space-y-1">
                                 <h3 className="text-xl font-black text-slate-900 uppercase tracking-tight">Bài kiểm tra tổng kết</h3>
                                 <p className="text-sm text-slate-500 font-medium uppercase tracking-tight">Đánh giá năng lực và nhận chứng chỉ hoàn thành</p>
                              </div>
                           </div>
                           <Link
                             href={`/courses/${c.id}/final-test`}
                             className="w-full sm:w-auto px-8 py-4 bg-slate-900 text-white rounded-2xl text-[11px] font-black uppercase tracking-widest hover:bg-red-600 transition-all shadow-xl shadow-slate-200"
                           >
                             Bắt đầu làm bài
                           </Link>
                        </div>
                      </div>
                    )}
                  </TabsContent>

                  <TabsContent value="instructor" className="mt-0 animate-in fade-in duration-500">
                    <div className="flex flex-col md:flex-row gap-10 items-start">
                       <div className="w-full md:w-48 shrink-0">
                          <div className="relative aspect-square rounded-[2rem] overflow-hidden border-4 border-slate-50 shadow-xl">
                             {c.user?.image ? (
                               <Image
                                 src={c.user.image}
                                 alt={c.user?.name || "Giảng viên"}
                                 fill
                                 className="object-cover"
                               />
                             ) : (
                               <div className="w-full h-full bg-red-50 flex items-center justify-center">
                                  <Users className="w-12 h-12 text-red-200" />
                               </div>
                             )}
                          </div>
                       </div>
                       <div className="space-y-4">
                          <div className="space-y-1">
                             <h3 className="text-2xl font-black text-slate-900 uppercase tracking-tight">
                                {c.user?.name || "Giảng Viên Hệ Thống"}
                             </h3>
                             <p className="text-red-600 font-black text-[10px] uppercase tracking-[0.2em]">Chuyên gia luyện thi hàng đầu</p>
                          </div>
                          <div className="prose prose-slate max-w-none prose-p:text-slate-600 prose-p:text-sm prose-p:leading-relaxed">
                             <p>Với hơn 10 năm kinh nghiệm trong lĩnh vực giảng dạy và ôn luyện thi Đại học, thầy luôn tâm niệm mang đến những phương pháp giải toán đột phá, tư duy hiện đại và sự truyền cảm hứng mạnh mẽ cho từng học viên.</p>
                             <p>Hàng ngàn học sinh đã đạt điểm 9+ dưới sự dẫn dắt trực tiếp của thầy mỗi năm.</p>
                          </div>
                          <div className="flex gap-4 pt-2">
                             {[
                               { label: "Khóa học", value: "12+" },
                               { label: "Đánh giá", value: "4.9/5" },
                               { label: "Kinh nghiệm", value: "10 năm" }
                             ].map((stat, i) => (
                               <div key={i} className="text-center px-4 py-2 bg-slate-50 rounded-xl border border-slate-100">
                                  <p className="text-sm font-black text-slate-900">{stat.value}</p>
                                  <p className="text-[8px] font-bold text-slate-400 uppercase tracking-widest">{stat.label}</p>
                               </div>
                             ))}
                          </div>
                       </div>
                    </div>
                  </TabsContent>
                </div>
              </Tabs>
            </div>
          </div>

          {/* Right Column: Enrollment Card (Sticky) */}
          <aside className="w-full lg:w-[400px] shrink-0">
             <div className="sticky top-24 space-y-6">
                <div className="card-surface bg-white rounded-[3rem] p-8 sm:p-10 shadow-2xl shadow-slate-200 border border-slate-100 overflow-hidden relative group">
                   {/* Background Ornament */}
                   <div className="absolute top-0 right-0 w-32 h-32 bg-red-500/5 blur-3xl rounded-full -mr-16 -mt-16" />
                   
                   <div className="relative z-10 space-y-8">
                      <div className="space-y-4">
                         <div className="inline-flex items-center gap-2 px-3 py-1 rounded-full bg-emerald-50 text-emerald-600 text-[9px] font-black uppercase tracking-widest border border-emerald-100">
                            Đang mở đăng ký
                         </div>
                         <div className="space-y-1">
                            <p className="text-[10px] font-black text-slate-400 uppercase tracking-[0.2em]">Giá trị đầu tư</p>
                            <div className="flex items-baseline gap-3">
                               <span className="text-4xl font-black text-slate-900 tracking-tighter">{c.price ? `${c.price.toLocaleString()}đ` : "Miễn phí"}</span>
                               {c.price && <span className="text-base text-slate-300 font-bold line-through tracking-tight">{(c.price * 1.5).toLocaleString()}đ</span>}
                            </div>
                         </div>
                      </div>

                      <div className="space-y-4 pt-4 border-t border-slate-50">
                         {[
                           { icon: Clock, text: "Truy cập không giới hạn" },
                           { icon: FileCheck, text: "Chứng chỉ hoàn thành" },
                           { icon: BookOpen, text: "50+ Tài liệu PDF độc quyền" },
                           { icon: Users, text: "Nhóm hỗ trợ học tập kín" }
                         ].map((item, i) => (
                           <div key={i} className="flex items-center gap-3 text-slate-600 group/item">
                              <div className="w-6 h-6 rounded-lg bg-slate-50 flex items-center justify-center shrink-0 border border-slate-100 group-hover/item:border-red-100 group-hover/item:bg-red-50 transition-colors">
                                 <item.icon className="w-3 h-3 text-slate-400 group-hover/item:text-red-600 transition-colors" />
                              </div>
                              <span className="text-xs font-black uppercase tracking-tight">{item.text}</span>
                           </div>
                         ))}
                      </div>

                      <div className="pt-4">
                        <EnrollButton
                          courseId={course.id}
                          courseTitle={course.title}
                          coursePrice={course.price || 0}
                          enrollmentStatus={enrollmentStatus}
                          firstLessonId={firstLesson?.id}
                          isLoggedIn={isLoggedIn}
                          isAdminOrTeacher={isAdminOrTeacher}
                          userEmail={userEmail}
                          className="py-5 px-10 text-lg rounded-[2rem]"
                        />
                        <p className="text-center text-[10px] text-slate-400 font-bold uppercase tracking-widest mt-6 flex items-center justify-center gap-2">
                           <ShieldCheck className="w-3.5 h-3.5" />
                           Thanh toán bảo mật SSL 256-bit
                        </p>
                      </div>
                   </div>
                </div>

                {/* Promo Card Below Sticky */}
                <div className="bg-gradient-to-br from-red-600 to-orange-500 rounded-[2.5rem] p-8 text-white shadow-xl shadow-red-200 overflow-hidden relative group">
                   <div className="absolute inset-0 bg-[url('https://www.transparenttextures.com/patterns/cubes.png')] opacity-10" />
                   <div className="relative z-10 space-y-4">
                      <div className="w-10 h-10 bg-white/20 rounded-xl flex items-center justify-center border border-white/20">
                         <Sparkles className="w-5 h-5 text-white" />
                      </div>
                      <h4 className="text-xl font-black uppercase tracking-tighter leading-tight">Ưu đãi học nhóm<br />Giảm thêm 20%</h4>
                      <p className="text-[11px] text-red-50 font-medium uppercase tracking-wider leading-relaxed">Đăng ký từ 3 người để nhận được ưu đãi đặc biệt dành riêng cho bạn và bạn bè.</p>
                      <button className="w-full py-3 bg-white text-red-600 rounded-xl text-[10px] font-black uppercase tracking-widest hover:bg-slate-900 hover:text-white transition-all">
                         Tìm hiểu thêm
                      </button>
                   </div>
                </div>
             </div>
          </aside>
        </div>
      </section>

      {/* 3. Smart Bottom Dock for Mobile (Compact & Modern) */}
      <div className="lg:hidden fixed bottom-6 left-1/2 -translate-x-1/2 z-[100] w-[92%] max-w-[440px] animate-in fade-in slide-in-from-bottom-10 duration-700">
        <div className="bg-slate-900/95 backdrop-blur-2xl rounded-[2.5rem] p-2.5 shadow-[0_20px_50px_rgba(0,0,0,0.4)] border border-white/10 flex items-center gap-3">
          <Link 
            href="/courses"
            className="w-12 h-12 bg-white/10 hover:bg-white/20 rounded-full flex items-center justify-center shrink-0 border border-white/10 text-white transition-all active:scale-90"
          >
            <ArrowLeft className="w-5 h-5" />
          </Link>

          <div className="flex-1 flex flex-col pl-1">
             <span className="text-[10px] font-black text-white/40 uppercase tracking-widest leading-none">Học phí</span>
             <span className="text-sm font-black text-white mt-1">
               {c.price ? `${c.price.toLocaleString()}đ` : "Miễn phí"}
             </span>
          </div>

          <div className="flex-[1.8]">
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

      <div className="pb-24 lg:pb-0" />
    </div>
  );
}

function StatItem({ icon: Icon, label, value }: { icon: any, label: string, value: string }) {
  return (
    <div className="flex flex-col items-center lg:items-start gap-1 group">
       <div className="flex items-center gap-2">
          <Icon className="w-3.5 h-3.5 text-red-500" />
          <span className="text-base sm:text-xl font-black tracking-tighter uppercase">{value}</span>
       </div>
       <span className="text-[9px] font-bold text-slate-500 uppercase tracking-widest leading-none">{label}</span>
    </div>
  );
}

function TabTrigger({ value, children }: { value: string; children: ReactNode }) {
  return (
    <TabsTrigger
      value={value}
      className={cn(
        "rounded-2xl px-5 sm:px-8 py-2.5 font-black text-[10px] sm:text-[11px] uppercase tracking-widest transition-all duration-300",
        "text-slate-500 hover:text-slate-900",
        "data-[state=active]:bg-white data-[state=active]:text-red-600 data-[state=active]:shadow-[0_4px_20px_rgba(0,0,0,0.08)]",
        "border border-transparent data-[state=active]:border-slate-100",
        "after:hidden" // Bỏ đường kẻ underline từ base component
      )}
    >
      {children}
    </TabsTrigger>
  );
}
