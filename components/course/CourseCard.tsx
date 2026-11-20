"use client";

import Link from 'next/link';
import Image from 'next/image';
import { Avatar, AvatarFallback, AvatarImage } from "@/components/ui/avatar";
import { BookOpen, Play, Video, ArrowRight, Star, Sparkles } from "lucide-react";
import { cn } from '@/lib/utils';
import { canOptimizeImage } from '@/lib/image-hosts';
import { getAvatarThumbUrl } from "@/lib/game-rank";

interface CourseCardProps {
  course: {
    id: string;
    title: string;
    thumbnail: string | null;
    user?: {
      name: string | null;
      image: string | null;
    } | null;
    chapters?: {
      lessons: { id: string }[];
    }[];
    category?: {
      name: string;
    } | null;
  };
  isLocked?: boolean;
  progress?: number;
}

export default function CourseCard({ course, isLocked = false, progress }: CourseCardProps) {
  const firstLessonId = course.chapters?.[0]?.lessons?.[0]?.id;
  const totalLessons =
    course.chapters?.reduce((acc, ch) => acc + (ch.lessons?.length || 0), 0) ?? 0;

  const targetHref = isLocked 
    ? "/login" 
    : (firstLessonId ? `/watch/${firstLessonId}` : `/courses/${course.id}`);

  return (
    <Link 
      href={targetHref}
      className="group bg-white rounded-3xl overflow-hidden flex flex-col h-full relative border-2 border-slate-200/80 shadow-[0_4px_0_0_#e2e8f0] hover:-translate-y-1 hover:border-blue-200 hover:shadow-[0_6px_0_0_#bfdbfe] transition-all duration-300"
    >
      {/* Thumbnail area with vibrant overlay */}
      <div className="aspect-[16/10] relative overflow-hidden bg-slate-100 shrink-0">
        {course.thumbnail ? (
          // next/image: tự thu nhỏ ảnh gốc (~1MB) về đúng cỡ thẻ, WebP/AVIF, tải lười
          <Image
            src={course.thumbnail}
            alt={course.title}
            fill
            unoptimized={!canOptimizeImage(course.thumbnail)}
            sizes="(min-width: 1536px) 22vw, (min-width: 1024px) 30vw, (min-width: 640px) 45vw, 92vw"
            className="object-cover group-hover:scale-110 transition-transform duration-700 ease-out"
          />
        ) : (
          // Chưa có ảnh bìa → ảnh bìa tự tạo từ tên khoá học (màu cố định theo tên)
          <div className={`w-full h-full relative flex items-end p-5 pt-14 bg-gradient-to-br ${fallbackGradient(course.title)}`}>
            <div className="absolute inset-0 opacity-[0.12] bg-[radial-gradient(circle_at_1px_1px,white_1px,transparent_0)] [background-size:18px_18px]" />
            <div aria-hidden className="absolute -right-6 -bottom-8 text-[140px] font-black leading-none text-white/10 select-none">∑</div>
            <p className="relative text-lg sm:text-xl font-black uppercase leading-tight text-white line-clamp-3 drop-shadow-sm">
              {course.title}
            </p>
          </div>
        )}

        {/* Premium Badge */}
        <div className="absolute top-4 left-4 z-10">
          <div className="px-3.5 py-1.5 bg-slate-900/90 backdrop-blur-md text-xs sm:text-sm font-black uppercase tracking-wider text-white rounded-2xl shadow-lg flex items-center gap-2">
            <Sparkles className="w-3.5 h-3.5 text-blue-400 animate-pulse" />
            {course.category?.name || "Toán Học"}
          </div>
        </div>

        {/* Watch Indicator */}
        {!isLocked && (
          <div className="absolute inset-0 flex items-center justify-center opacity-0 group-hover:opacity-100 transition-all duration-500 z-20">
            <div className="w-16 h-16 bg-white/10 backdrop-blur-md rounded-full flex items-center justify-center border border-white/30 shadow-2xl scale-75 group-hover:scale-100 transition-transform">
              <div className="w-12 h-12 bg-white rounded-full flex items-center justify-center shadow-xl">
                <Play className="w-5 h-5 text-blue-600 fill-current ml-1" />
              </div>
            </div>
          </div>
        )}
        
        {/* Modern gradient for better contrast */}
        <div className="absolute inset-0 bg-gradient-to-t from-slate-950/40 via-transparent to-transparent opacity-0 group-hover:opacity-100 transition-opacity duration-500" />
      </div>

      {/* Content Section */}
      <div className="p-5 flex-1 flex flex-col">
        <div className="space-y-2 mb-4">
           <h3 className="font-black text-slate-900 text-base sm:text-lg leading-snug group-hover:text-blue-600 transition-colors line-clamp-2">
             {course.title}
           </h3>
           <div className="flex items-center gap-3">
              <div className="flex items-center gap-1.5 text-xs sm:text-sm font-bold text-slate-500">
                 <BookOpen className="w-4 h-4 text-blue-500" />
                 {totalLessons} Bài
              </div>
              <div className="w-1 h-1 rounded-full bg-slate-200" />
              <div className="flex items-center gap-1.5 text-xs sm:text-sm font-bold text-slate-500">
                 <Star className="w-4 h-4 text-orange-400 fill-orange-400" />
                 Premium
              </div>
           </div>
        </div>

        {/* Progress Section */}
        {progress !== undefined && (
          <div className="mb-4" data-testid="course-progress">
            <div className="flex justify-between items-end mb-1.5">
                <span className="text-xs font-bold text-slate-500">{progress >= 100 ? "Đã hoàn thành 🎉" : "Tiến độ của bạn"}</span>
                <span className="text-xs font-black text-blue-600">{progress}%</span>
            </div>
            <div className="w-full h-2.5 bg-slate-100 rounded-full overflow-hidden">
                <div 
                  className="h-full bg-gradient-to-r from-blue-600 to-indigo-500 rounded-full transition-all duration-1000 ease-out shadow-[0_0_8px_rgba(37,99,235,0.3)]" 
                  style={{ width: `${progress}%` }} 
                />
            </div>
          </div>
        )}

        {/* Footer - Teacher & Action */}
        <div className="mt-auto pt-4 flex items-center justify-between border-t border-slate-100">
          <div className="flex items-center gap-3">
            <div className="relative">
              <Avatar className="h-9 w-9 border-2 border-white shadow-sm ring-1 ring-slate-100">
                <AvatarImage src={course.user?.image ? getAvatarThumbUrl(course.user.name, course.user.image, 64) : ""} />
                <AvatarFallback className="bg-blue-50 text-blue-600 font-black text-xs sm:text-sm">
                  {course.user?.name?.[0] || "T"}
                </AvatarFallback>
              </Avatar>
              <div className="absolute -bottom-0.5 -right-0.5 w-3.5 h-3.5 bg-emerald-500 border-2 border-white rounded-full shadow-sm" />
            </div>
            <div className="flex flex-col">
              <span className="text-xs sm:text-sm font-black text-slate-900 leading-none">{course.user?.name || "thatdehoctoan"}</span>
              <span className="text-xs font-semibold text-slate-400 mt-1">Giảng viên</span>
            </div>
          </div>
          
          <div className="w-10 h-10 rounded-[1.25rem] bg-slate-50 flex items-center justify-center text-slate-400 group-hover:bg-blue-600 group-hover:text-white group-hover:shadow-xl group-hover:shadow-blue-600/20 transition-all duration-300">
             <ArrowRight className="w-5 h-5" />
          </div>
        </div>
      </div>
    </Link>
  );
}

const FALLBACK_GRADIENTS = [
  "from-blue-600 to-indigo-700",
  "from-violet-600 to-fuchsia-600",
  "from-emerald-600 to-teal-700",
  "from-orange-500 to-rose-600",
  "from-sky-500 to-blue-700",
];

function fallbackGradient(title?: string | null) {
  let h = 0;
  for (const ch of title || "") h = (h * 31 + ch.charCodeAt(0)) >>> 0;
  return FALLBACK_GRADIENTS[h % FALLBACK_GRADIENTS.length];
}
