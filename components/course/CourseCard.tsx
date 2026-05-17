"use client";

import Link from 'next/link';
import { Avatar, AvatarFallback, AvatarImage } from "@/components/ui/avatar";
import { BookOpen, Play, Video, ArrowRight } from "lucide-react";

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
      className="group bg-white rounded-3xl overflow-hidden shadow-md shadow-slate-200/40 hover:shadow-xl hover:shadow-red-500/5 transition-all duration-500 flex flex-col h-full relative border border-slate-100/60"
    >
      {/* Thumbnail area */}
      <div className="aspect-[16/9.5] relative overflow-hidden bg-slate-100 shrink-0">
        <img 
          src={course.thumbnail || "/placeholder-course.jpg"} 
          alt={course.title}
          className="w-full h-full object-cover group-hover:scale-105 transition-transform duration-700 ease-out"
        />

        {/* Play Button Overlay */}
        {!isLocked && (
          <div className="absolute inset-0 flex items-center justify-center opacity-0 group-hover:opacity-100 transition-all duration-300 translate-y-3 group-hover:translate-y-0 z-20">
            <div className="w-12 h-12 bg-white/20 backdrop-blur-md rounded-full flex items-center justify-center border border-white/30 shadow-xl">
              <div className="w-9 h-9 bg-white rounded-full flex items-center justify-center shadow-md transform group-active:scale-95 transition-transform">
                <Play className="w-3.5 h-3.5 text-[#A01D24] fill-current ml-0.5" />
              </div>
            </div>
          </div>
        )}

        {/* Category Badge - High Quality */}
        <div className="absolute top-4 left-4 z-10">
          <span className="px-3 py-1 bg-slate-900/90 backdrop-blur-md text-[8px] font-black uppercase tracking-wider text-white rounded-xl shadow-lg flex items-center gap-1.5">
            <div className="w-1 h-1 bg-red-500 rounded-full animate-pulse" />
            {course.category?.name || "Toán Học"}
          </span>
        </div>
        
        {/* Soft shadow overlay for title readability */}
        <div className="absolute inset-0 bg-gradient-to-t from-slate-900/30 to-transparent opacity-0 group-hover:opacity-100 transition-opacity duration-500" />
      </div>

      {/* Content */}
      <div className="p-5 flex-1 flex flex-col space-y-4">
        <div className="space-y-1.5">
           <h3 className="font-black text-slate-900 text-[15px] leading-[1.3] group-hover:text-[#A01D24] transition-colors line-clamp-1 uppercase tracking-tight">
             {course.title}
           </h3>
           <div className="flex items-center gap-2">
              <div className="flex items-center gap-1 text-[8px] font-black text-slate-400 uppercase tracking-widest">
                 <BookOpen className="w-2.5 h-2.5 text-[#A01D24]" />
                 {totalLessons} Bài giảng
              </div>
              <div className="w-0.5 h-0.5 rounded-full bg-slate-200" />
              <div className="flex items-center gap-1 text-[8px] font-black text-slate-400 uppercase tracking-widest">
                 <Video className="w-2.5 h-2.5 text-[#A01D24]" />
                 4K Quality
              </div>
           </div>
        </div>

        {/* Progress Bar (Dashboard State) */}
        {progress !== undefined && (
          <div className="space-y-1.5 bg-slate-50/60 p-3 rounded-xl border border-slate-100/80">
            <div className="flex justify-between items-end">
                <span className="text-[8px] font-black text-slate-400 uppercase tracking-widest">Tiến trình học</span>
                <span className="text-[10px] font-black text-[#A01D24]">{progress}%</span>
            </div>
            <div className="w-full h-1 bg-slate-200/50 rounded-full overflow-hidden">
                <div 
                  className="h-full bg-gradient-to-r from-red-600 to-orange-500 rounded-full transition-all duration-1000 ease-out" 
                  style={{ width: `${progress}%` }} 
                />
            </div>
          </div>
        )}

        <div className="mt-auto pt-3 flex items-center justify-between border-t border-slate-100/60">
          <div className="flex items-center gap-2.5">
            <div className="relative group/avatar">
              <Avatar className="h-8 w-8 border-2 border-white ring-1 ring-slate-100/80 shadow-sm">
                <AvatarImage src={course.user?.image || ""} />
                <AvatarFallback className="bg-red-50 text-red-600 font-black text-[10px]">
                  {course.user?.name?.[0] || "T"}
                </AvatarFallback>
              </Avatar>
              <div className="absolute -bottom-0.5 -right-0.5 w-3 h-3 bg-emerald-500 border border-white rounded-full shadow-sm" />
            </div>
            <div className="flex flex-col">
              <span className="text-[11px] font-black text-slate-900 leading-none">{course.user?.name || "thatdehoctoan"}</span>
              <span className="text-[8px] font-bold text-slate-400 uppercase tracking-wide mt-1">Giảng viên</span>
            </div>
          </div>
          
          <div className="w-8 h-8 rounded-xl bg-slate-50 flex items-center justify-center text-slate-400 group-hover:bg-[#A01D24] group-hover:text-white group-hover:shadow-md group-hover:shadow-red-200/30 transition-all duration-300">
             <ArrowRight className="w-4 h-4" />
          </div>
        </div>
      </div>
    </Link>
  );
}
