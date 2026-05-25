"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import {
  ClipboardList,
  Clock,
  AlertTriangle,
  ChevronRight,
} from "lucide-react";
import { Button } from "@/components/ui/button";
import { Loader2 } from "lucide-react";
import { cn } from "@/lib/utils";

interface QuizEntryCardProps {
  lessonId: string;
  course: any;
  lesson: any;
  duration: number; // minutes
  test: any;
  currentAttempt?: any;
}

export default function QuizEntryCard({
  lessonId,
  course,
  lesson,
  duration,
  test,
  currentAttempt,
}: QuizEntryCardProps) {
  const router = useRouter();
  const [isLoading, setIsLoading] = useState(false);

  const isCompleted = !!currentAttempt?.completedAt;

  if (!test) {
    return (
      <div className="flex flex-col items-center justify-center py-20 px-4 text-center">
        <div className="w-16 h-16 bg-slate-100 rounded-full flex items-center justify-center mb-4">
          <AlertTriangle className="w-8 h-8 text-slate-400" />
        </div>
        <h2 className="text-xl font-black text-slate-900 mb-2">
          Bài kiểm tra chưa sẵn sàng
        </h2>
        <p className="text-slate-500 max-w-xs">
          Giảng viên hiện chưa thiết lập nội dung câu hỏi cho bài kiểm tra này.
        </p>
      </div>
    );
  }

  const handleStart = () => {
    setIsLoading(true);
    if (isCompleted) {
      router.push(`/watch/${lessonId}/results/${currentAttempt.id}`);
    } else {
      router.push(`/watch/${lessonId}/quiz`);
    }
  };

  return (
    <div className="flex flex-col items-center justify-center py-2 px-4">
      <div className="max-w-lg w-full bg-white rounded-3xl border border-blue-100 shadow-xl p-8 text-center space-y-6">
        {/* Icon */}
        <div className="w-20 h-20 bg-blue-50 rounded-full flex items-center justify-center mx-auto">
          <ClipboardList className="w-10 h-10 text-blue-600" />
        </div>

        {/* Title */}
        <div>
          <p className="text-xs font-black uppercase tracking-widest text-blue-500 mb-2">
            Bài kiểm tra
          </p>
          <h2 className="text-2xl font-black text-gray-900">{lesson.title}</h2>
        </div>

        {/* Warning */}
        <div className="flex items-start gap-3 bg-amber-50 border border-amber-200 rounded-2xl p-4 text-left">
          <AlertTriangle className="w-5 h-5 text-amber-500 flex-shrink-0 mt-0.5" />
          <div className="text-sm text-amber-800">
            <p className="font-bold mb-1">Lưu ý trước khi làm bài</p>
            <ul className="space-y-1 list-disc list-inside text-amber-700">
              <li>Bài làm được lưu tự động, không mất khi tải lại trang.</li>
              <li>Bạn có thể làm bài không giới hạn thời gian và nộp bài bất cứ lúc nào.</li>
            </ul>
          </div>
        </div>

        {/* CTA */}
        <Button
          onClick={handleStart}
          disabled={isLoading}
          className={cn(
            "w-full h-14 text-base font-black rounded-2xl gap-2 shadow-lg",
            isCompleted 
              ? "bg-emerald-600 hover:bg-emerald-700 shadow-emerald-200" 
              : "bg-blue-600 hover:bg-blue-700 shadow-blue-200"
          )}
        >
          {isLoading ? (
            <Loader2 className="w-5 h-5 animate-spin" />
          ) : isCompleted ? (
            <>
              Xem kết quả
              <ChevronRight className="w-5 h-5" />
            </>
          ) : (
            <>
              Bắt đầu làm bài
              <ChevronRight className="w-5 h-5" />
            </>
          )}
        </Button>
      </div>
    </div>
  );
}

