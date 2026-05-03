"use client";

import { useState } from "react";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogDescription, DialogFooter } from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { Textarea } from "@/components/ui/textarea";
import { Label } from "@/components/ui/label";
import { Input } from "@/components/ui/input";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";

interface FastEntryModalProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  sections: any[];
  onApply: (answersStr: string, pointsPerQuestion: number, targetSectionId: string | "ALL") => void;
}

export function FastEntryModal({ open, onOpenChange, sections, onApply }: FastEntryModalProps) {
  const [answersStr, setAnswersStr] = useState("");
  const [points, setPoints] = useState(1);
  const [targetSectionId, setTargetSectionId] = useState<string>("ALL");

  const handleApply = () => {
    if (!answersStr) return;
    onApply(answersStr, points, targetSectionId);
    setAnswersStr("");
    setPoints(1);
    setTargetSectionId("ALL");
    onOpenChange(false);
  };

  return (
    <Dialog open={open} onOpenChange={(val) => {
      if (!val) {
        setAnswersStr("");
        setPoints(1);
        setTargetSectionId("ALL");
      }
      onOpenChange(val);
    }}>
      <DialogContent className="sm:max-w-[425px]">
        <DialogHeader>
          <DialogTitle>Nhập nhanh đáp án</DialogTitle>
          <DialogDescription>
            Nhập chuỗi ký tự liền nhau (VD: ABCDDA). Hệ thống sẽ tự động cắt ra và gán đáp án cho từng câu hỏi.
          </DialogDescription>
        </DialogHeader>
        <div className="grid gap-4 py-4">
          <div className="space-y-2">
            <Label>Chuỗi đáp án</Label>
            <Textarea
              value={answersStr}
              onChange={(e) => setAnswersStr(e.target.value)}
              placeholder="VD: ABCDDA..."
              className="font-mono text-lg tracking-[0.2em] uppercase resize-none h-32 break-all"
            />
            <p className="text-xs text-gray-500 text-right">
              Sẽ tạo ra <b>{answersStr.replace(/\s/g, '').length}</b> câu hỏi
            </p>
          </div>
          <div className="space-y-2">
            <Label>Áp dụng cho</Label>
            <Select value={targetSectionId} onValueChange={setTargetSectionId}>
              <SelectTrigger>
                <SelectValue placeholder="Chọn phần thi" />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="ALL">Cả đề (Thay thế toàn bộ)</SelectItem>
                {sections.map((sec, idx) => (
                  <SelectItem key={sec.id || idx} value={sec.id || idx.toString()}>
                    {sec.name}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
          </div>
          <div className="space-y-2">
            <Label>Điểm mặc định cho mỗi câu</Label>
            <Input
              type="number"
              step="0.1"
              value={points}
              onChange={(e) => setPoints(Number(e.target.value))}
            />
          </div>
        </div>
        <DialogFooter>
          <Button variant="outline" onClick={() => onOpenChange(false)}>
            Hủy
          </Button>
          <Button onClick={handleApply} className="bg-blue-600 hover:bg-blue-700">
            Xác nhận
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
