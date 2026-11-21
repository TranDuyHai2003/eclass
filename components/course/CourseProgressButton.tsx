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
      type="button"
      onClick={onClick}
      disabled={isLoading}
      data-testid="lesson-complete"
      aria-pressed={!!isCompleted}
      title={isCompleted ? "Bấm lần nữa để bỏ đánh dấu hoàn thành" : undefined}
      className={
        isCompleted
          ? "btn-3d w-full h-11 px-4 sm:px-5 text-sm whitespace-nowrap border-2 border-emerald-500 bg-emerald-50 text-emerald-700 [--btn-edge:#86efac] hover:bg-emerald-100 disabled:opacity-60"
          : "btn-3d btn-3d-blue w-full h-11 px-4 sm:px-5 text-sm whitespace-nowrap disabled:opacity-60"
      }
    >
      {isLoading ? (
        <Loader2 className="w-4 h-4 animate-spin" />
      ) : (
        <CheckCircle className={`w-4 h-4 shrink-0 ${isCompleted ? "text-emerald-600" : ""}`} />
      )}
      <span>{isCompleted ? "Đã hoàn thành" : "Hoàn thành bài"}</span>
    </button>
  );
}
