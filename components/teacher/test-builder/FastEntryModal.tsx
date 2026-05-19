"use client";

import { useState } from "react";
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogDescription,
  DialogFooter,
} from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { Textarea } from "@/components/ui/textarea";
import { Label } from "@/components/ui/label";
import { Zap, Info } from "lucide-react";
import { cn } from "@/lib/utils";

interface FastEntryModalProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  onConfirm: (answers: string[], type: "MULTIPLE_CHOICE" | "TRUE_FALSE") => void;
}

export function FastEntryModal({
  open,
  onOpenChange,
  onConfirm,
}: FastEntryModalProps) {
  const [text, setText] = useState("");
  const [mode, setMode] = useState<"MULTIPLE_CHOICE" | "TRUE_FALSE">("MULTIPLE_CHOICE");

  const extractAnswers = (input: string): string[] => {
    if (mode === "MULTIPLE_CHOICE") {
      // Priority 1: numbered list "1A 2B 3C..." hoặc "1. A 2. B..."
      const numberedMatches = input.match(/\d+\s*[A-Ea-e]/g);
      if (numberedMatches && numberedMatches.length >= 2) {
        return numberedMatches.map(s => s.trim().replace(/^\d+\s*/, '').toUpperCase());
      }

      // Priority 2: word-boundaried single letters "A B C" hoặc "A, B, C"
      const wordBoundMatches = input.match(/\b[A-Ea-e]\b/g);
      if (wordBoundMatches && wordBoundMatches.length >= 2) {
        return wordBoundMatches.map(c => c.toUpperCase());
      }

      // Fallback: all A-E chars (handles raw "ABCD" hoặc "ABCDABC")
      return (input.match(/[A-Ea-e]/g) || []).map(c => c.toUpperCase());
    } else {
      // TRUE_FALSE mode
      // Supports: D, S (Đúng/Sai)
      // Numbered list: 1D 2S 3D...
      const numberedMatches = input.match(/\d+\s*[DSds]/g);
      if (numberedMatches && numberedMatches.length >= 2) {
        return numberedMatches.map(s => {
          const val = s.trim().replace(/^\d+\s*/, '').toUpperCase();
          return val === 'D' ? 'T' : 'F';
        });
      }

      // Single letters
      const chars = input.match(/[DSds]/g) || [];
      return chars.map(c => {
        const val = c.toUpperCase();
        return val === 'D' ? 'T' : 'F';
      });
    }
  };

  const matches = extractAnswers(text);
  const answerCount = matches.length;

  const handleProcess = () => {
    if (!text.trim()) return;

    const processedAnswers = extractAnswers(text);

    if (processedAnswers.length > 0) {
      onConfirm(processedAnswers, mode);
      setText("");
      onOpenChange(false);
    }
  };

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-w-md rounded-[32px] overflow-hidden">
        <DialogHeader>
          <DialogTitle className="flex items-center gap-2 text-xl font-black text-slate-900">
            <Zap className="w-5 h-5 text-blue-600 fill-blue-600" />
            Nhập đáp án nhanh
          </DialogTitle>
          <DialogDescription className="text-slate-500 font-medium">
            Dán chuỗi đáp án vào đây để hệ thống tự động điền vào ma trận.
          </DialogDescription>
        </DialogHeader>

        <div className="space-y-4 py-4">
          <div className="flex p-1 bg-slate-100 rounded-2xl">
            <button
              onClick={() => setMode("MULTIPLE_CHOICE")}
              className={cn(
                "flex-1 py-2 text-xs font-black uppercase tracking-wider rounded-xl transition-all",
                mode === "MULTIPLE_CHOICE" ? "bg-white text-blue-600 shadow-sm" : "text-slate-400 hover:text-slate-600"
              )}
            >
              Trắc nghiệm (A,B,C,D)
            </button>
            <button
              onClick={() => setMode("TRUE_FALSE")}
              className={cn(
                "flex-1 py-2 text-xs font-black uppercase tracking-wider rounded-xl transition-all",
                mode === "TRUE_FALSE" ? "bg-white text-blue-600 shadow-sm" : "text-slate-400 hover:text-slate-600"
              )}
            >
              Đúng / Sai (D,S)
            </button>
          </div>

          <div className="space-y-2">
            <div className="flex justify-between items-end">
              <Label className="font-bold text-slate-700">Chuỗi đáp án</Label>
              <span className="text-[10px] font-black uppercase text-blue-600 bg-blue-50 px-2 py-0.5 rounded-full">
                Đã nhận diện: {answerCount} câu
              </span>
            </div>
            <Textarea
              placeholder={mode === "MULTIPLE_CHOICE" ? "Ví dụ: 1A 2B 3C... hoặc ABCD..." : "Ví dụ: 1D 2S 3D... hoặc DSDS..."}
              value={text}
              onChange={(e) => setText(e.target.value)}
              className="min-h-[150px] rounded-2xl border-slate-200 focus-visible:ring-blue-500/20 leading-relaxed font-mono break-all whitespace-pre-wrap text-lg"
            />
          </div>

          <div className="bg-slate-50 p-4 rounded-2xl flex gap-3 items-start border border-slate-100">
            <div className="w-8 h-8 rounded-xl bg-blue-100 flex items-center justify-center shrink-0">
              <Info className="w-4 h-4 text-blue-600" />
            </div>
            <div className="text-xs text-slate-600 leading-normal">
              <p className="font-bold text-slate-900 mb-1">Định dạng hỗ trợ:</p>
              <ul className="list-disc list-inside space-y-1 opacity-80">
                <li>Kiểu liệt kê: 1A, 2B... hoặc 1D, 2S...</li>
                <li>Kiểu chuỗi dính: ABCD... hoặc DSDS...</li>
                <li>Chỉ sử dụng D (Đúng) và S (Sai).</li>
              </ul>
            </div>
          </div>
        </div>

        <DialogFooter className="gap-2 sm:gap-0 pt-2">
          <Button
            variant="ghost"
            onClick={() => onOpenChange(false)}
            className="rounded-xl font-bold text-slate-500"
          >
            Hủy bỏ
          </Button>
          <Button
            onClick={handleProcess}
            disabled={answerCount === 0}
            className="bg-blue-600 hover:bg-blue-700 text-white rounded-xl px-8 font-black shadow-lg shadow-blue-100 transition-all active:scale-95"
          >
            Xác nhận nhập {answerCount > 0 && `(${answerCount} câu)`}
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
