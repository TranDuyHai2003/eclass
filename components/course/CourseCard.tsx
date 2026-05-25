"use client";

import Link from 'next/link';
import { Avatar, AvatarFallback, AvatarImage } from "@/components/ui/avatar";
import { BookOpen, Play, Video, ArrowRight, Star, Sparkles } from "lucide-react";
import { cn } from '@/lib/utils';

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
      className="group bg-white rounded-[2rem] overflow-hidden shadow-sm hover:shadow-2xl hover:shadow-blue-500/10 transition-all duration-500 flex flex-col h-full relative border border-slate-200/60"
    >
      {/* Thumbnail area with vibrant overlay */}
      <div className="aspect-[16/10] relative overflow-hidden bg-slate-100 shrink-0">
        {course.thumbnail ? (
          <img 
            src={course.thumbnail} 
            alt={course.title}
            className="w-full h-full object-cover group-hover:scale-110 transition-transform duration-700 ease-out"
          />
        ) : (
          <div className="w-full h-full flex items-center justify-center bg-gradient-to-br from-blue-50 to-indigo-100">
            <div className="text-center">
              <div className="w-12 h-12 mx-auto rounded-2xl bg-white/80 flex items-center justify-center shadow-sm border border-slate-200/60 mb-2">
                <svg className="w-6 h-6 text-blue-500" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
                  <path strokeLinecap="round" strokeLinejoin="round" d="M15 10l4.553-2.276A1 1 0 0121 8.618v6.764a1 1 0 01-1.447.894L15 14M5 18h8a2 2 0 002-2V8a2 2 0 00-2-2H5a2 2 0 00-2 2v8a2 2 0 002 2z" />
                </svg>
              </div>
              <p className="text-[10px] font-bold text-slate-400 uppercase tracking-wider">{course.title?.slice(0, 2) || "..."}</p>
            </div>
          </div>
        )}

        {/* Premium Badge */}
        <div className="absolute top-4 left-4 z-10">
          <div className="px-3 py-1.5 bg-slate-900/90 backdrop-blur-md text-[9px] font-black uppercase tracking-wider text-white rounded-2xl shadow-lg flex items-center gap-2">
            <Sparkles className="w-2.5 h-2.5 text-blue-400 animate-pulse" />
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
      <div className="p-6 flex-1 flex flex-col">
        <div className="space-y-2 mb-4">
           <h3 className="font-black text-slate-900 text-base leading-tight group-hover:text-blue-600 transition-colors line-clamp-2 uppercase tracking-tight">
             {course.title}
           </h3>
           <div className="flex items-center gap-3">
              <div className="flex items-center gap-1.5 text-[10px] font-black text-slate-400 uppercase tracking-widest">
                 <BookOpen className="w-3 h-3 text-blue-500" />
                 {totalLessons} Bài
              </div>
              <div className="w-1 h-1 rounded-full bg-slate-200" />
              <div className="flex items-center gap-1.5 text-[10px] font-black text-slate-400 uppercase tracking-widest">
                 <Star className="w-3 h-3 text-orange-400 fill-orange-400" />
                 Premium
              </div>
           </div>
        </div>

        {/* Progress Section */}
        {progress !== undefined && (
          <div className="mb-6 p-4 bg-blue-50/30 rounded-2xl border border-blue-100/50">
            <div className="flex justify-between items-end mb-2">
                <span className="text-[9px] font-black text-slate-400 uppercase tracking-widest">Tiến trình</span>
                <span className="text-xs font-black text-blue-600">{progress}%</span>
            </div>
            <div className="w-full h-2 bg-slate-200/50 rounded-full overflow-hidden p-0.5">
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
                <AvatarImage src={course.user?.image || ""} />
                <AvatarFallback className="bg-blue-50 text-blue-600 font-black text-xs">
                  {course.user?.name?.[0] || "T"}
                </AvatarFallback>
              </Avatar>
              <div className="absolute -bottom-0.5 -right-0.5 w-3.5 h-3.5 bg-emerald-500 border-2 border-white rounded-full shadow-sm" />
            </div>
            <div className="flex flex-col">
              <span className="text-[12px] font-black text-slate-900 leading-none">{course.user?.name || "thatdehoctoan"}</span>
              <span className="text-[9px] font-bold text-slate-400 uppercase tracking-wide mt-1.5">Giảng viên</span>
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
