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
      className="group card-surface rounded-3xl overflow-hidden card-hover flex flex-col"
    >
      {/* Thumbnail area */}
      <div className="aspect-video relative overflow-hidden bg-gray-100">
        <img 
          src={course.thumbnail || "/placeholder-course.jpg"} 
          alt={course.title}
          className="w-full h-full object-cover group-hover:scale-[1.08] transition-transform duration-700"
        />

        {/* Soft gradient for legibility */}
        <div className="absolute inset-0 bg-gradient-to-t from-black/35 via-black/0 to-black/0 opacity-90" />
        
        {/* Lock Overlay */}
        {isLocked && (
          <div className="absolute inset-0 bg-black/40 backdrop-blur-[2px] flex items-center justify-center opacity-0 group-hover:opacity-100 transition-opacity duration-300">
            <div className="bg-white/20 p-4 rounded-full backdrop-blur-md border border-white/30 transform scale-50 group-hover:scale-100 transition-transform duration-500">
                <Lock className="w-8 h-8 text-white" />
            </div>
          </div>
        )}

        {/* Play Icon (when not locked) */}
        {!isLocked && (
          <div className="absolute inset-0 bg-black/20 flex items-center justify-center opacity-0 group-hover:opacity-100 transition-all duration-300">
            <div className="w-12 h-12 bg-gradient-to-br from-red-600 to-orange-500 rounded-full flex items-center justify-center text-white transform scale-75 group-hover:scale-100 transition-all shadow-lg shadow-black/20">
              <Play className="w-6 h-6 fill-current ml-1" />
            </div>
          </div>
        )}

        {/* Category Badge */}
        <div className="absolute top-4 left-4">
          <span className="px-3 py-1 bg-white/90 backdrop-blur-md text-[10px] font-black uppercase text-red-600 rounded-xl shadow-sm">
            {course.category?.name || "Lập trình"}
          </span>
        </div>
      </div>

      {/* Content */}
      <div className="p-5 flex-1 flex flex-col">
        <h3 className="font-black text-gray-900 line-clamp-2 leading-tight group-hover:text-red-600 transition-colors text-balance">
          {course.title}
        </h3>

        {/* Progress Bar (Dashboard State) */}
        {progress !== undefined && (
          <div className="mt-4 space-y-1.5">
            <div className="flex justify-between text-[10px] font-bold text-gray-400 uppercase">
                <span>Tiến độ</span>
                <span className="text-red-600">{progress}%</span>
            </div>
            <div className="w-full h-2 bg-gray-100 rounded-full overflow-hidden">
                <div 
                  className="h-full bg-gradient-to-r from-red-600 to-orange-500 rounded-full transition-all duration-700" 
                  style={{ width: `${progress}%` }} 
                />
            </div>
          </div>
        )}

        {/* Instructor & Meta */}
        <div className="mt-auto pt-4 flex items-center justify-between">
          <div className="flex items-center gap-2">
            <Avatar className="h-6 w-6 border border-gray-100">
              <AvatarImage src={course.user?.image || ""} />
              <AvatarFallback className="text-[10px] bg-red-50 text-red-600 font-bold">
                {course.user?.name?.[0] || "I"}
              </AvatarFallback>
            </Avatar>
            <span className="text-xs font-bold text-gray-500 truncate max-w-[100px]">{course.user?.name || "Giảng viên"}</span>
          </div>
          
          <div className="flex items-center gap-3 text-gray-400">
            <div className="flex items-center gap-1 text-[10px] font-bold uppercase tracking-tighter">
                <BookOpen className="w-3 h-3" />
                {totalLessons} bài
            </div>
          </div>
        </div>

        {/* Unauthenticated Button */}
        {isLocked && (
          <div className="mt-4">
            <button className="w-full py-2.5 rounded-2xl border border-border/70 bg-white/60 text-xs font-black uppercase tracking-tight text-gray-500 group-hover:border-red-300 group-hover:text-red-600 transition-all">
                Đăng nhập để Mở khóa
            </button>
          </div>
        )}
      </div>
    </Link>
  );
}
