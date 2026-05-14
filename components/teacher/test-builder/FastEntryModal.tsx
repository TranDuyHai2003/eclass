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
  
  // Hỗ trợ A-E (Trắc nghiệm 5 đáp án)
  const matches = text.match(/[A-Ea-e]/g) || [];
  const answerCount = matches.length;

  const handleProcess = () => {
    if (!text.trim()) return;

    // Extract all A-E characters from any supported format
    const processedAnswers = (text.match(/[A-Ea-e]/g) || []).map((char) =>
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
      <DialogContent className="max-w-md rounded-[32px] overflow-hidden">
        <DialogHeader>
          <DialogTitle className="flex items-center gap-2 text-xl font-black text-slate-900">
            <Zap className="w-5 h-5 text-blue-600 fill-blue-600" />
            Nhập đáp án nhanh
          </DialogTitle>
          <DialogDescription className="text-slate-500 font-medium">
            Dán chuỗi đáp án trắc nghiệm vào đây để hệ thống tự động điền vào ma
            trận.
          </DialogDescription>
        </DialogHeader>

        <div className="space-y-4 py-4">
          <div className="space-y-2">
            <div className="flex justify-between items-end">
              <Label className="font-bold text-slate-700">Chuỗi đáp án</Label>
              <span className="text-[10px] font-black uppercase text-blue-600 bg-blue-50 px-2 py-0.5 rounded-full">
                Đã nhận diện: {answerCount} câu
              </span>
            </div>
            <Textarea
              placeholder="Ví dụ: 1A 2B 3C... hoặc ABCD..."
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
                <li>Kiểu liệt kê: 1A, 2B, 3C...</li>
                <li>Kiểu chuỗi dính: ABCD...</li>
                <li>Hỗ trợ dấu cách, dấu phẩy, xuống dòng.</li>
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
