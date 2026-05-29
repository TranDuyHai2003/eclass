"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import { toast } from "sonner";
import axios from "axios";
import { resubmitEssayAnswer } from "@/actions/test";
import { Loader2, RefreshCw } from "lucide-react";
import { cn } from "@/lib/utils";

interface ReuploadFormProps {
  attemptId: string;
  questionId: string;
}

export function ReuploadForm({ attemptId, questionId }: ReuploadFormProps) {
  const router = useRouter();
  const [isUploading, setIsUploading] = useState(false);
  const [isSubmitting, setIsSubmitting] = useState(false);

  const handleResubmit = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const files = e.target.files;
    if (!files || files.length === 0) return;

    const file = files[0];
    if (file.size > 50 * 1024 * 1024) {
      toast.error(`Tệp "${file.name}" vượt quá 50MB.`);
      return;
    }

    setIsUploading(true);
    try {
      const fileBuffer = await file.arrayBuffer();
      const res = await axios.put<{ publicUrl: string }>(
        `/api/upload/proxy?fileName=essay_${questionId}_${Date.now()}_${encodeURIComponent(file.name)}`,
        fileBuffer,
        { headers: { "Content-Type": file.type || "application/octet-stream" } }
      );

      setIsSubmitting(true);
      await resubmitEssayAnswer(attemptId, questionId, res.data.publicUrl);
      toast.success("Nộp lại bài tự luận thành công!");
      router.refresh();
    } catch (error: any) {
      const message = error?.response?.data || error?.message || "Lỗi tải tệp lên";
      toast.error(`Lỗi: ${message}`);
    } finally {
      setIsUploading(false);
      setIsSubmitting(false);
    }
  };

  const isBusy = isUploading || isSubmitting;

  return (
    <div className="flex items-center gap-3 p-3 bg-blue-50/50 border border-blue-100 rounded-xl">
      <label className="flex items-center gap-2 cursor-pointer group flex-1">
        <div className={cn(
          "h-10 flex-1 border-2 border-dashed border-blue-200 rounded-xl flex items-center justify-center gap-2 bg-blue-50/30 group-hover:bg-blue-50 group-hover:border-blue-400 transition-all",
          isBusy && "opacity-50 cursor-not-allowed"
        )}>
          {isBusy ? (
            <Loader2 className="w-4 h-4 text-blue-600 animate-spin" />
          ) : (
            <RefreshCw className="w-4 h-4 text-blue-400 group-hover:text-blue-600 transition-colors" />
          )}
          <span className="text-xs font-black text-slate-500 group-hover:text-blue-700 uppercase tracking-tight">
            {isUploading ? "Đang tải..." : isSubmitting ? "Đang nộp..." : "Nộp lại bài tự luận"}
          </span>
        </div>
        <input
          type="file"
          className="hidden"
          accept="image/*,application/pdf"
          onChange={handleResubmit}
          disabled={isBusy}
        />
      </label>
    </div>
  );
}
