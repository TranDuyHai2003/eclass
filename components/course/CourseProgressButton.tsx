"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import { CheckCircle, Loader2 } from "lucide-react";
import { toast } from "sonner";
import { updateLessonProgress } from "@/actions/course";

interface CourseProgressButtonProps {
  lessonId: string;
  courseId: string;
  isCompleted?: boolean;
  nextLessonId?: string;
}

export function CourseProgressButton({
  lessonId,
  courseId,
  isCompleted,
  nextLessonId,
}: CourseProgressButtonProps) {
  const router = useRouter();
  const [isLoading, setIsLoading] = useState(false);

  const onClick = async () => {
    try {
      setIsLoading(true);

      const res = await updateLessonProgress({
        lessonId,
        isCompleted: !isCompleted,
      });

      if (res.success) {
        toast.success(isCompleted ? "Đã gỡ hoàn thành" : "Tuyệt vời! Bạn đã hoàn thành bài học này.");
        
        if (!isCompleted && nextLessonId) {
          router.push(`/watch/${nextLessonId}`);
        }
        
        router.refresh();
      } else {
        toast.error(res.error || "Có lỗi xảy ra");
      }
    } catch {
      toast.error("Lỗi hệ thống");
    } finally {
      setIsLoading(false);
    }
  };

  return (
    <button
      onClick={onClick}
      disabled={isLoading}
      className={`
        relative overflow-hidden group flex items-center gap-3 px-6 py-3.5 rounded-2xl text-xs font-black uppercase tracking-widest transition-all active:scale-95 disabled:opacity-50 shadow-xl
        ${isCompleted 
          ? "bg-slate-900 text-white shadow-slate-200" 
          : "bg-red-600 text-white shadow-red-200 hover:bg-red-700"}
      `}
    >
      {/* Glow Effect */}
      <div className={`absolute inset-0 opacity-0 group-hover:opacity-20 transition-opacity bg-white`} />
      
      {isLoading ? (
        <Loader2 className="w-4 h-4 animate-spin" />
      ) : (
        <div className={`
          w-6 h-6 rounded-lg flex items-center justify-center transition-all
          ${isCompleted ? "bg-emerald-500 text-white" : "bg-white/20 text-white"}
        `}>
          <CheckCircle className={`w-3.5 h-3.5 ${isCompleted ? "fill-current" : ""}`} />
        </div>
      )}
      <span className="relative z-10">
        {isCompleted ? "Đã hoàn thành" : "Hoàn thành bài"}
      </span>
    </button>
  );
}
