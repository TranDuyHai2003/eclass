"use client";

import { useState } from "react";
import { Plus, Trash2, FileWarning, CheckCircle2 } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { cn } from "@/lib/utils";

export interface ParsedQuestion {
  id: string;
  order: number;
  question_label: string;
  question_category: string;
  type: "MULTIPLE_CHOICE" | "SHORT_ANSWER";
  correctAnswer: string;
}

interface ParsedQuestionsFormProps {
  questions: ParsedQuestion[];
  onChange: (questions: ParsedQuestion[]) => void;
}

export function ParsedQuestionsForm({ questions, onChange }: ParsedQuestionsFormProps) {
  const setAllMultipleChoice = () => {
    onChange(questions.map(q => ({ ...q, type: "MULTIPLE_CHOICE" })));
  };

  const updateQuestion = (id: string, data: Partial<ParsedQuestion>) => {
    onChange(
      questions.map((q) => (q.id === id ? { ...q, ...data } : q)),
    );
  };

  const removeQuestion = (id: string) => {
    const filtered = questions.filter((q) => q.id !== id);
    onChange(filtered.map((q, i) => ({ ...q, order: i + 1 })));
  };

  const addQuestion = () => {
    const nextOrder = questions.length + 1;
    onChange([
      ...questions,
      {
        id: `manual-${Date.now()}-${Math.random().toString(36).slice(2, 9)}`,
        order: nextOrder,
        question_label: `Câu ${nextOrder}`,
        question_category: "",
        type: "MULTIPLE_CHOICE",
        correctAnswer: "",
      },
    ]);
  };

  if (questions.length === 0) {
    return null;
  }

  return (
    <div className="space-y-4">
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4">
        <div>
          <Label className="font-bold text-slate-900">Danh sách câu hỏi đã bóc tách</Label>
          <p className="text-xs text-slate-500">
            {questions.length} câu hỏi - Bạn có thể sửa dạng bài, chọn kiểu câu và điền đáp án
          </p>
        </div>
        <div className="flex gap-2 shrink-0">
          <Button
            type="button"
            onClick={setAllMultipleChoice}
            size="sm"
            variant="outline"
            className="rounded-xl border-blue-200 bg-blue-50 text-blue-600 hover:bg-blue-100 font-bold text-[11px] uppercase tracking-tight"
          >
            Tất cả Trắc nghiệm
          </Button>
          <Button
            type="button"
            onClick={addQuestion}
            size="sm"
            variant="outline"
            className="rounded-xl border-dashed gap-1.5 font-bold text-[11px] uppercase tracking-tight"
          >
            <Plus className="w-3.5 h-3.5" /> Thêm câu
          </Button>
        </div>
      </div>

      <div className="space-y-3 max-h-[600px] overflow-y-auto custom-scrollbar pr-2">
        {questions.map((q, index) => (
          <div
            key={q.id}
            className="group flex flex-col sm:flex-row items-start gap-4 p-5 bg-white rounded-[2rem] border border-slate-100 shadow-sm hover:shadow-md transition-all"
          >
            <div className="w-12 h-12 rounded-2xl bg-slate-900 flex items-center justify-center text-white text-sm font-black shrink-0 shadow-lg shadow-slate-200">
              {q.order}
            </div>

            <div className="flex-1 grid grid-cols-1 sm:grid-cols-12 gap-4 items-start w-full">
              <div className="sm:col-span-4 space-y-1.5">
                <Label className="text-[9px] font-black uppercase text-slate-400 tracking-widest ml-1">
                  Phạm vi kiến thức (Dạng bài)
                </Label>
                <Input
                  value={q.question_category}
                  onChange={(e) =>
                    updateQuestion(q.id, { question_category: e.target.value })
                  }
                  placeholder="VD: Hàm số bậc 3"
                  className="h-11 text-sm rounded-xl border-slate-200 bg-slate-50/50 focus:bg-white transition-colors"
                />
              </div>

              <div className="sm:col-span-3 space-y-1.5">
                <Label className="text-[9px] font-black uppercase text-slate-400 tracking-widest ml-1">
                  Kiểu trả lời
                </Label>
                <Select
                  value={q.type}
                  onValueChange={(v: "MULTIPLE_CHOICE" | "SHORT_ANSWER") =>
                    updateQuestion(q.id, { type: v, correctAnswer: "" })
                  }
                >
                  <SelectTrigger className="h-11 rounded-xl border-slate-200 bg-slate-50/50 focus:bg-white transition-colors">
                    <SelectValue />
                  </SelectTrigger>
                  <SelectContent className="rounded-xl border-slate-200 shadow-xl">
                    <SelectItem value="MULTIPLE_CHOICE" className="font-bold py-2">Trắc nghiệm (A-D)</SelectItem>
                    <SelectItem value="SHORT_ANSWER" className="font-bold py-2">Điền đáp án (Tự do)</SelectItem>
                  </SelectContent>
                </Select>
              </div>

              <div className="sm:col-span-4 space-y-1.5">
                <Label className="text-[9px] font-black uppercase text-slate-400 tracking-widest ml-1">
                  Xác nhận đáp án đúng
                </Label>
                {q.type === "MULTIPLE_CHOICE" ? (
                  <div className="flex gap-2">
                    {["A", "B", "C", "D"].map((opt) => (
                      <button
                        key={opt}
                        type="button"
                        onClick={() =>
                          updateQuestion(q.id, { correctAnswer: opt })
                        }
                        className={cn(
                          "w-10 h-10 rounded-xl border font-black text-xs transition-all",
                          q.correctAnswer === opt
                            ? "bg-red-600 border-red-600 text-white shadow-lg shadow-red-200"
                            : "bg-white border-slate-200 text-slate-400 hover:border-red-400 hover:text-red-600"
                        )}
                      >
                        {opt}
                      </button>
                    ))}
                  </div>
                ) : (
                  <div className="relative">
                    <Input
                      value={q.correctAnswer}
                      onChange={(e) =>
                        updateQuestion(q.id, { correctAnswer: e.target.value })
                      }
                      placeholder="Nhập kết quả..."
                      className="h-11 text-sm rounded-xl border-slate-200 bg-slate-50/50 focus:bg-white transition-colors pr-10"
                    />
                    {q.correctAnswer && <CheckCircle2 className="absolute right-3 top-3 w-5 h-5 text-emerald-500" />}
                  </div>
                )}
              </div>

              <div className="sm:col-span-1 flex justify-end pt-5 sm:pt-6">
                <Button
                  type="button"
                  onClick={() => removeQuestion(q.id)}
                  size="icon"
                  variant="ghost"
                  className="h-10 w-10 text-slate-300 hover:text-red-600 hover:bg-red-50 rounded-xl transition-colors"
                >
                  <Trash2 className="w-5 h-5" />
                </Button>
              </div>
            </div>
          </div>
        ))}
      </div>
    </div>
  );
}
