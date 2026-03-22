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
        toast.success(isCompleted ? "Đã bỏ đánh dấu hoàn thành" : "Đã hoàn thành bài học!");
        
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

  const Icon = isCompleted ? CheckCircle : CheckCircle; // Different icon logic if needed

  return (
    <button
      onClick={onClick}
      disabled={isLoading}
      className={`
        flex items-center gap-2 px-4 py-2 rounded-lg text-sm font-medium transition shadow-md hover:shadow-lg disabled:opacity-50
        ${isCompleted 
          ? "bg-green-600 hover:bg-green-700 text-white" 
          : "bg-red-600 hover:bg-red-700 text-white"}
      `}
    >
      {isLoading ? (
        <Loader2 className="w-4 h-4 animate-spin" />
      ) : (
        <Icon className={`w-4 h-4 ${isCompleted ? "fill-white text-green-600" : ""}`} />
      )}
      {isCompleted ? "Đã hoàn thành" : "Đánh dấu hoàn thành"}
    </button>
  );
}
