"use client";

import { useState, useTransition } from "react";
import { gradeStudentAnswer } from "@/actions/test";
import { toast } from "sonner";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Check, X, Loader2 } from "lucide-react";

interface GradeEssayProps {
  answerId: string;
  initialPoints: number;
  maxPoints: number;
  isCorrect: boolean | null;
}

export function GradeEssay({
  answerId,
  initialPoints,
  maxPoints,
  isCorrect,
}: GradeEssayProps) {
  const [points, setPoints] = useState(initialPoints.toString());
  const [isPending, startTransition] = useTransition();

  const handleGrade = (correct: boolean) => {
    const p = parseFloat(points);
    if (isNaN(p) || p < 0 || p > maxPoints) {
      toast.error(`Điểm phải từ 0 đến ${maxPoints}`);
      return;
    }

    startTransition(async () => {
      try {
        const res = await gradeStudentAnswer(answerId, p, correct);
        if (res.success) {
          toast.success("Đã cập nhật điểm");
        }
      } catch (e) {
        toast.error("Lỗi khi chấm điểm");
      }
    });
  };

  return (
    <div className="mt-4 p-4 bg-blue-50/50 rounded-2xl border border-blue-100 flex flex-col sm:flex-row items-center gap-4">
      <div className="flex-1 text-xs font-bold text-blue-800 uppercase tracking-tight">
        Chấm điểm tự luận (Hệ thống):
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
          >
            {isPending ? <Loader2 className="w-4 h-4 animate-spin" /> : <Check className="w-4 h-4" />}
          </Button>
          <Button
            size="sm"
            variant="destructive"
            onClick={() => handleGrade(false)}
            disabled={isPending}
            className="h-9 w-9 p-0 rounded-xl shadow-lg shadow-red-200"
          >
            <X className="w-4 h-4" />
          </Button>
        </div>
      </div>
    </div>
  );
}
