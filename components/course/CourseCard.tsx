"use client";

import Link from 'next/link';
import { Avatar, AvatarFallback, AvatarImage } from "@/components/ui/avatar";
import { BookOpen, Play, Lock } from "lucide-react";

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
  const totalLessons =
    course.chapters?.reduce((acc, ch) => acc + (ch.lessons?.length || 0), 0) ?? 0;

  return (
    <Link 
      href={isLocked ? "/login" : `/courses/${course.id}`}
      className="group bg-white rounded-[2.5rem] overflow-hidden shadow-lg shadow-slate-200/50 hover:shadow-2xl hover:shadow-red-500/10 transition-all duration-500 flex flex-col h-full relative border border-slate-100/50"
    >
      {/* Thumbnail area */}
      <div className="aspect-[16/10] relative overflow-hidden bg-slate-100 shrink-0">
        <img 
          src={course.thumbnail || "/placeholder-course.jpg"} 
          alt={course.title}
          className="w-full h-full object-cover group-hover:scale-110 transition-transform duration-1000 ease-out"
        />

        {/* Play Button Overlay */}
        {!isLocked && (
          <div className="absolute inset-0 flex items-center justify-center opacity-0 group-hover:opacity-100 transition-all duration-500 translate-y-4 group-hover:translate-y-0 z-20">
            <div className="w-16 h-16 bg-white/10 backdrop-blur-xl rounded-full flex items-center justify-center border border-white/20 shadow-2xl">
              <div className="w-12 h-12 bg-white rounded-full flex items-center justify-center shadow-lg transform group-active:scale-90 transition-transform">
                <Play className="w-5 h-5 text-red-600 fill-current ml-1" />
              </div>
            </div>
          </div>
        )}

        {/* Category Badge - High Quality */}
        <div className="absolute top-5 left-5 z-10">
          <span className="px-4 py-2 bg-slate-900/90 backdrop-blur-md text-[9px] font-black uppercase tracking-[0.15em] text-white rounded-2xl shadow-2xl flex items-center gap-2">
            <div className="w-1 h-1 bg-red-500 rounded-full animate-pulse" />
            {course.category?.name || "Toán Học"}
          </span>
        </div>
        
        {/* Soft shadow overlay for title readability */}
        <div className="absolute inset-0 bg-gradient-to-t from-slate-900/40 to-transparent opacity-0 group-hover:opacity-100 transition-opacity duration-500" />
      </div>

      {/* Content */}
      <div className="p-7 flex-1 flex flex-col space-y-5">
        <div className="space-y-2">
           <h3 className="font-black text-slate-900 text-[17px] leading-[1.3] group-hover:text-red-600 transition-colors line-clamp-2 uppercase tracking-tight">
             {course.title}
           </h3>
           <div className="flex items-center gap-3">
              <div className="flex items-center gap-1 text-[9px] font-black text-slate-400 uppercase tracking-widest">
                 <BookOpen className="w-3 h-3 text-red-600" />
                 {totalLessons} Bài giảng
              </div>
              <div className="w-1 h-1 rounded-full bg-slate-200" />
              <div className="flex items-center gap-1 text-[9px] font-black text-slate-400 uppercase tracking-widest">
                 <Video className="w-3 h-3 text-red-600" />
                 4K Quality
              </div>
           </div>
        </div>

        {/* Progress Bar (Dashboard State) */}
        {progress !== undefined && (
          <div className="space-y-2 bg-slate-50 p-4 rounded-2xl border border-slate-100">
            <div className="flex justify-between items-end">
                <span className="text-[9px] font-black text-slate-400 uppercase tracking-widest">Tiến trình học</span>
                <span className="text-[11px] font-black text-red-600">{progress}%</span>
            </div>
            <div className="w-full h-1.5 bg-slate-200/50 rounded-full overflow-hidden">
                <div 
                  className="h-full bg-gradient-to-r from-red-600 to-orange-500 rounded-full transition-all duration-1000 ease-out" 
                  style={{ width: `${progress}%` }} 
                />
            </div>
          </div>
        )}

        <div className="mt-auto pt-5 flex items-center justify-between border-t border-slate-50">
          <div className="flex items-center gap-3">
            <div className="relative group/avatar">
              <Avatar className="h-9 w-9 border-2 border-white ring-1 ring-slate-100 shadow-sm">
                <AvatarImage src={course.user?.image || ""} />
                <AvatarFallback className="bg-red-50 text-red-600 font-black text-xs">
                  {course.user?.name?.[0] || "T"}
                </AvatarFallback>
              </Avatar>
              <div className="absolute -bottom-0.5 -right-0.5 w-3.5 h-3.5 bg-emerald-500 border-2 border-white rounded-full shadow-sm" />
            </div>
            <div className="flex flex-col">
              <span className="text-[12px] font-black text-slate-900 leading-none">{course.user?.name || "thatdehoctoan"}</span>
              <span className="text-[9px] font-bold text-slate-400 uppercase tracking-[0.1em] mt-1">Chuyên gia giảng dạy</span>
            </div>
          </div>
          
          <div className="w-10 h-10 rounded-2xl bg-slate-50 flex items-center justify-center text-slate-400 group-hover:bg-red-600 group-hover:text-white group-hover:shadow-lg group-hover:shadow-red-200 transition-all duration-300">
             <ArrowRight className="w-5 h-5" />
          </div>
        </div>
      </div>
    </Link>
  );
}

import { Video, ArrowRight } from "lucide-react";
