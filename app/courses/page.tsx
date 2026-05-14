import { getCourses } from "@/actions/course";
import CourseCard from "@/components/course/CourseCard";
import { HomeSidebar } from "@/components/home/HomeSidebar";
import { SearchBar } from "@/components/layout/SearchBar";
import {
  Trophy,
  Sparkles,
  Flame,
  BookOpen,
  Filter,
  ArrowRight,
  TrendingUp,
  GraduationCap,
} from "lucide-react";
import Link from "next/link";

export default async function CoursesPage({
  searchParams,
}: {
  searchParams: Promise<{ query?: string }>;
}) {
  const { query } = await searchParams;
  const courses = await getCourses({ search: query });

  return (
    <div className="page-shell min-h-screen bg-[#F8FAFC]">
      <main className="container mx-auto py-8 sm:py-10 px-4 sm:px-6 lg:px-8">
        <div className="flex flex-col lg:flex-row gap-8 sm:gap-10">
          {/* Left Sidebar - PC Only */}
          <aside className="hidden lg:block w-[280px] shrink-0 space-y-6">
            <div className="sticky top-24 space-y-6">
              <HomeSidebar />

              {/* Featured Badge */}
              <div className="card-surface bg-gradient-to-br from-slate-900 to-slate-800 rounded-[2rem] p-6 text-white overflow-hidden relative group">
                <div className="absolute -right-4 -bottom-4 w-24 h-24 bg-red-600/20 blur-3xl rounded-full group-hover:bg-red-600/40 transition-all duration-700" />
                <TrendingUp className="w-8 h-8 text-red-500 mb-4" />
                <h4 className="text-white text-sm uppercase tracking-wider mb-2">
                  Thử thách mới
                </h4>
                <p className="text-[11px] text-slate-400 font-medium leading-relaxed mb-4">
                  Hoàn thành 3 bài học trong tuần này để nhận huy hiệu đặc biệt.
                </p>
                <Link
                  href="/"
                  className="inline-flex items-center gap-2 text-[10px] font-black text-red-500 uppercase tracking-widest hover:text-white transition-colors group/btn"
                >
                  Tham gia ngay
                  <ArrowRight className="w-3 h-3 group-hover/btn:translate-x-1 transition-transform" />
                </Link>
              </div>
            </div>
          </aside>

          {/* Right Content Area */}
          <div className="flex-1 space-y-10 sm:space-y-14">
            {/* <div className="relative rounded-[3rem] overflow-hidden">
              <div className="absolute inset-0 bg-white shadow-xl shadow-slate-200/50 border border-slate-100" />
              <div className="absolute top-0 right-0 w-1/3 h-full bg-gradient-to-l from-red-50/50 to-transparent pointer-events-none" />
              <div className="absolute -top-24 -right-24 w-64 h-64 bg-red-100/30 blur-[100px] rounded-full" />

              <div className="relative z-10 p-8 sm:p-12 md:p-16 flex flex-col md:flex-row md:items-center justify-between gap-10">
                <div className="max-w-xl space-y-6 text-center md:text-left">
                  <div className="inline-flex items-center gap-2 px-4 py-1.5 rounded-full bg-red-50 text-red-600 text-[10px] font-black uppercase tracking-[0.2em] border border-red-100 shadow-sm animate-bounce-subtle">
                    <Sparkles className="w-3 h-3" />
                    Học toán thật dễ
                  </div>

                  <h1 className="text-4xl sm:text-5xl md:text-6xl font-black text-slate-900 uppercase tracking-tight leading-[0.9] text-balance">
                    Làm chủ <span className="text-red-600">tư duy</span>
                    <br />
                    bứt phá{" "}
                    <span className="relative inline-block">
                      điểm số
                      <span className="absolute -bottom-2 left-0 w-full h-3 bg-red-100 -z-10 rounded-full rotate-1" />
                    </span>
                  </h1>

                  <p className="text-sm sm:text-lg text-slate-500 font-medium max-w-lg leading-relaxed uppercase tracking-tight">
                    Hệ thống bài giảng livestream & video bài bản nhất giúp bạn
                    chinh phục mọi kỳ thi toán học.
                  </p>

                  <div className="flex flex-col sm:flex-row items-center gap-4 pt-4">
                    <div className="w-full sm:w-[400px] relative group">
                      <SearchBar />
                    </div>
                  </div>
                </div>

                <div className="hidden xl:flex flex-col gap-4 shrink-0">
                  <div className="grid grid-cols-2 gap-4">
                    <div className="w-32 h-32 bg-slate-900 rounded-[2.5rem] rotate-6 flex flex-col items-center justify-center text-white p-4 shadow-2xl">
                      <Trophy className="w-8 h-8 text-amber-400 mb-2" />
                      <span className="text-[10px] font-black uppercase text-center leading-tight">
                        Top hệ thống
                      </span>
                    </div>
                    <div className="w-32 h-32 bg-red-600 rounded-[2.5rem] -rotate-6 flex flex-col items-center justify-center text-white p-4 shadow-2xl translate-y-8">
                      <Flame className="w-8 h-8 text-white mb-2" />
                      <span className="text-[10px] font-black uppercase text-center leading-tight">
                        Cực hot
                      </span>
                    </div>
                  </div>
                </div>
              </div>
            </div> */}

            {/* 2. Stats & Trust Bar */}
            {/* <div className="grid grid-cols-2 md:grid-cols-4 gap-4 sm:gap-8 border-y border-slate-100 py-8 px-4">
              {[
                { label: "Khóa học", value: "50+", icon: BookOpen },
                { label: "Học viên", value: "10k+", icon: GraduationCap },
                { label: "Đánh giá", value: "4.9/5", icon: Sparkles },
                { label: "Video", value: "500+", icon: PlaySquare },
              ].map((stat, i) => (
                <div
                  key={i}
                  className="flex items-center gap-4 group hover:translate-y-[-2px] transition-transform"
                >
                  <div className="w-10 h-10 rounded-xl bg-slate-50 flex items-center justify-center group-hover:bg-red-50 transition-colors">
                    <stat.icon className="w-5 h-5 text-slate-400 group-hover:text-red-600" />
                  </div>
                  <div>
                    <p className="text-lg font-black text-slate-900 leading-none">
                      {stat.value}
                    </p>
                    <p className="text-[10px] font-bold text-slate-400 uppercase tracking-widest mt-1">
                      {stat.label}
                    </p>
                  </div>
                </div>
              ))}
            </div> */}

            {/* 3. Courses Section */}
            <div className="space-y-8">
              <div className="flex flex-col sm:flex-row sm:items-end justify-between gap-6">
                <div className="space-y-2">
                  <h2 className="text-3xl font-black text-slate-900 uppercase tracking-tighter flex items-center gap-3">
                    <span className="w-2 h-8 bg-red-600 rounded-full" />
                    Lộ trình học tập
                  </h2>
                  <p className="text-slate-400 font-bold uppercase text-[10px] tracking-[0.2em]">
                    {query
                      ? `Tìm thấy ${courses.length} khóa học cho "${query}"`
                      : "Chọn mục tiêu của bạn và bắt đầu ngay"}
                  </p>
                </div>

                {/* Filters - Simplified for now */}
                {/* <div className="flex items-center gap-2 overflow-x-auto pb-2 no-scrollbar">
                  <button className="px-5 py-2 bg-slate-900 text-white rounded-full text-[10px] font-black uppercase tracking-widest shadow-lg shadow-slate-200 shrink-0">
                    Tất cả
                  </button>
                  <button className="px-5 py-2 bg-white text-slate-500 rounded-full text-[10px] font-black uppercase tracking-widest border border-slate-100 hover:border-red-200 hover:text-red-600 transition-all shrink-0">
                    Toán 12
                  </button>
                  <button className="px-5 py-2 bg-white text-slate-500 rounded-full text-[10px] font-black uppercase tracking-widest border border-slate-100 hover:border-red-200 hover:text-red-600 transition-all shrink-0">
                    Luyện đề
                  </button>
                  <div className="w-px h-4 bg-slate-200 mx-2" />
                  <button className="p-2 bg-white border border-slate-100 rounded-full text-slate-400 hover:text-slate-900 transition-colors">
                    <Filter className="w-4 h-4" />
                  </button>
                </div> */}
              </div>

              {/* Courses Grid */}
              <div className="grid grid-cols-1 sm:grid-cols-2 xl:grid-cols-3 gap-6 sm:gap-10">
                {courses.length === 0 ? (
                  <div className="col-span-full py-40 flex flex-col items-center justify-center bg-white rounded-[4rem] border border-dashed border-slate-200 shadow-inner space-y-8">
                    <div className="w-32 h-32 bg-slate-50 rounded-full flex items-center justify-center text-6xl animate-pulse">
                      🔭
                    </div>
                    <div className="text-center space-y-3 px-6">
                      <h3 className="text-2xl font-black text-slate-900 uppercase tracking-tight">
                        Tìm kiếm không có kết quả
                      </h3>
                      <p className="text-slate-400 font-medium uppercase text-[11px] tracking-[0.2em] max-w-xs mx-auto">
                        Đừng lo, hãy thử sử dụng các từ khóa khác hoặc xóa bộ
                        lọc để xem toàn bộ danh mục nhé!
                      </p>
                      <Link
                        href="/courses"
                        className="inline-flex mt-4 px-8 py-3 bg-red-600 text-white rounded-2xl text-[11px] font-black uppercase tracking-widest hover:bg-slate-900 transition-all shadow-xl shadow-red-200"
                      >
                        Xem tất cả khóa học
                      </Link>
                    </div>
                  </div>
                ) : (
                  courses.map((course) => (
                    <CourseCard key={course.id} course={course} />
                  ))
                )}
              </div>
            </div>

            {/* 4. Bottom Call to Action */}
            {!query && courses.length > 0 && (
              <div className="bg-red-600 rounded-[3rem] p-10 sm:p-16 text-center text-white relative overflow-hidden shadow-2xl shadow-red-200 mt-20">
                <div className="absolute top-0 left-0 w-full h-full bg-[url('https://www.transparenttextures.com/patterns/cubes.png')] opacity-10" />
                <div className="relative z-10 space-y-8">
                  <h2 className="text-3xl sm:text-5xl font-black uppercase tracking-tighter leading-tight">
                    Sẵn sàng để trở thành
                    <br />
                    thủ khoa toán học?
                  </h2>
                  <p className="text-red-100 font-medium uppercase tracking-[0.2em] text-xs sm:text-sm">
                    Đồng hành cùng hàng nghìn học sinh bứt phá 9+ mỗi năm
                  </p>
                  <div className="flex justify-center pt-4">
                    <Link
                      href="/register"
                      className="px-12 py-5 bg-white text-red-600 rounded-[2rem] font-black uppercase tracking-widest hover:bg-slate-900 hover:text-white transition-all shadow-2xl flex items-center gap-3 group"
                    >
                      Đăng ký học ngay
                      <ArrowRight className="w-5 h-5 group-hover:translate-x-2 transition-transform" />
                    </Link>
                  </div>
                </div>
              </div>
            )}
          </div>
        </div>
      </main>

      <style
        dangerouslySetInnerHTML={{
          __html: `
        @keyframes bounce-subtle {
          0%, 100% { transform: translateY(0); }
          50% { transform: translateY(-5px); }
        }
        .animate-bounce-subtle {
          animation: bounce-subtle 3s infinite ease-in-out;
        }
      `,
        }}
      />
    </div>
  );
}

import { PlaySquare } from "lucide-react";
