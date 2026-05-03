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

interface FastEntryModalProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  onConfirm: (answers: string[]) => void;
}

export function FastEntryModal({
  open,
  onOpenChange,
  onConfirm,
}: FastEntryModalProps) {
  const [text, setText] = useState("");
  const answerCount = (text.match(/[A-Da-d]/g) || []).length;

  const handleProcess = () => {
    if (!text.trim()) return;

    // Extract all A-D characters from any supported format (1A 2B, ABCD, etc.)
    const processedAnswers = (text.match(/[A-Da-d]/g) || []).map((char) =>
      char.toUpperCase(),
    );

    if (processedAnswers.length > 0) {
      onConfirm(processedAnswers);
      setText("");
      onOpenChange(false);
    }
  };

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-w-md rounded-[32px]">
        <DialogHeader>
          <DialogTitle className="flex items-center gap-2 text-xl font-black">
            <Zap className="w-5 h-5 text-blue-600" />
            Nhập đáp án nhanh
          </DialogTitle>
          <DialogDescription className="text-slate-500">
            Dán chuỗi đáp án trắc nghiệm vào đây để hệ thống tự động điền vào ma
            trận.
          </DialogDescription>
        </DialogHeader>

        <div className="space-y-4 py-4">
          <div className="space-y-2">
            <Label className="font-bold text-slate-700">Chuỗi đáp án</Label>
            <Textarea
              placeholder="Ví dụ: 1A 2B 3C... hoặc ABCD..."
              value={text}
              onChange={(e) => setText(e.target.value)}
              className="min-h-[150px] rounded-2xl border-slate-200 focus-visible:ring-blue-500/20 leading-relaxed font-mono break-all whitespace-pre-wrap"
            />
            <p className="text-xs text-slate-500 text-right">
              Đã nhập {answerCount} câu
            </p>
          </div>

          <div className="bg-slate-50 p-4 rounded-2xl flex gap-3 items-start border border-slate-100">
            <Info className="w-5 h-5 text-blue-500 shrink-0 mt-0.5" />
            <div className="text-xs text-slate-600 leading-normal">
              <p className="font-bold mb-1">Định dạng hỗ trợ:</p>
              <ul className="list-disc list-inside space-y-1">
                <li>Kiểu liệt kê: 1A, 2B, 3C...</li>
                <li>Kiểu chuỗi dính: ABCD...</li>
                <li>Hỗ trợ dấu cách, dấu phẩy, xuống dòng.</li>
              </ul>
            </div>
          </div>
        </div>

        <DialogFooter className="gap-2 sm:gap-0">
          <Button
            variant="ghost"
            onClick={() => onOpenChange(false)}
            className="rounded-xl font-bold"
          >
            Hủy
          </Button>
          <Button
            onClick={handleProcess}
            className="bg-blue-600 hover:bg-blue-700 rounded-xl px-8 font-black shadow-lg shadow-blue-100"
          >
            Xác nhận nhập
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
