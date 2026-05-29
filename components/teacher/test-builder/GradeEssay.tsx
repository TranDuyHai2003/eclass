"use client";

import { useState, useTransition } from "react";
import { gradeStudentAnswer } from "@/actions/test";
import { toast } from "sonner";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Textarea } from "@/components/ui/textarea";
import { Check, X, Loader2, MessageSquareText } from "lucide-react";

interface GradeEssayProps {
  answerId: string;
  initialPoints: number;
  maxPoints: number;
  isCorrect: boolean | null;
  initialFeedback?: string | null;
}

export function GradeEssay({
  answerId,
  initialPoints,
  maxPoints,
  isCorrect,
  initialFeedback,
}: GradeEssayProps) {
  const [points, setPoints] = useState(initialPoints.toString());
  const [feedback, setFeedback] = useState(initialFeedback || "");
  const [isPending, startTransition] = useTransition();

  const handleGrade = (correct: boolean) => {
    const p = parseFloat(points);
    if (isNaN(p) || p < 0 || p > maxPoints) {
      toast.error(`Điểm phải từ 0 đến ${maxPoints}`);
      return;
    }
    if (correct === false && !feedback.trim()) {
      toast.error("Vui lòng nhập góp ý khi duyệt chưa đạt.");
      return;
    }

    startTransition(async () => {
      try {
        const res = await gradeStudentAnswer(answerId, p, correct, feedback.trim() || undefined);
        if (res.success) {
          toast.success("Đã cập nhật điểm");
        }
      } catch (e) {
        toast.error("Lỗi khi chấm điểm");
      }
    });
  };

  return (
    <div className="mt-4 p-4 bg-blue-50/50 rounded-2xl border border-blue-100 space-y-4">
      <div className="flex-1 text-xs font-bold text-blue-800 uppercase tracking-tight">
        Chấm điểm tự luận
      </div>

      <div className="flex items-center gap-3">
        <div className="relative">
          <Input
            type="number"
            value={points}
            onChange={(e) => setPoints(e.target.value)}
            className="w-20 h-9 rounded-xl font-black text-center pr-6"
            max={maxPoints}
            min={0}
            step={0.1}
          />
          <span className="absolute right-2 top-2.5 text-[10px] font-black text-slate-400">
            /{maxPoints}
          </span>
        </div>
        <div className="flex gap-1">
          <Button
            size="sm"
            onClick={() => handleGrade(true)}
            disabled={isPending}
            className="h-9 w-9 p-0 bg-emerald-600 hover:bg-emerald-700 rounded-xl shadow-lg shadow-emerald-200"
            title="Đạt yêu cầu"
          >
            {isPending ? <Loader2 className="w-4 h-4 animate-spin" /> : <Check className="w-4 h-4" />}
          </Button>
          <Button
            size="sm"
            variant="destructive"
            onClick={() => handleGrade(false)}
            disabled={isPending}
            className="h-9 w-9 p-0 rounded-xl shadow-lg shadow-blue-200"
            title="Chưa đạt yêu cầu"
          >
            <X className="w-4 h-4" />
          </Button>
        </div>
      </div>

      <div className="space-y-1.5">
        <label className="flex items-center gap-1.5 text-[10px] font-black uppercase text-slate-500 tracking-wider">
          <MessageSquareText className="w-3 h-3" />
          Góp ý của giảng viên
        </label>
        <Textarea
          value={feedback}
          onChange={(e) => setFeedback(e.target.value)}
          placeholder="Nhập góp ý cho học viên..."
          className="min-h-[60px] text-xs rounded-xl resize-none"
        />
      </div>
    </div>
  );
}
