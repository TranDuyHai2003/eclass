"use client";

import { useState } from "react";
import { 
  Upload, 
  FileText, 
  Image as ImageIcon, 
  X, 
  CheckCircle2, 
  AlertCircle, 
  Loader2,
  Clock,
  Send
} from "lucide-react";
import { Button } from "@/components/ui/button";
import { toast } from "sonner";
import axios from "axios";
import { submitHomework } from "@/actions/homework";
import { cn } from "@/lib/utils";

const MAX_FILE_SIZE = 50 * 1024 * 1024; // 50MB

interface HomeworkSectionProps {
  lessonId: string;
  initialSubmission: any;
}

export function HomeworkSection({ lessonId, initialSubmission }: HomeworkSectionProps) {
  const [isUploading, setIsUploading] = useState(false);
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [attachments, setAttachments] = useState<{ name: string, url: string }[]>(
    initialSubmission?.attachments || []
  );
  const [submission, setSubmission] = useState(initialSubmission);

  const handleFileUpload = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const files = e.target.files;
    if (!files || files.length === 0) return;

    setIsUploading(true);
    try {
      const newAttachments = [...attachments];
      for (let i = 0; i < files.length; i++) {
        const file = files[i];
        if (file.size > MAX_FILE_SIZE) {
          toast.error(`Tệp "${file.name}" vượt quá 50MB. Vui lòng chọn tệp nhỏ hơn.`);
          continue;
        }
        const res = await axios.put<{ publicUrl: string }>(
          `/api/upload/proxy?fileName=homework_${Date.now()}_${encodeURIComponent(file.name)}`,
          file,
          { headers: { "Content-Type": file.type } }
        );
        newAttachments.push({ name: file.name, url: res.data.publicUrl });
      }
      setAttachments(newAttachments);
      toast.success("Tải tệp lên thành công");
    } catch (error: any) {
      const message = error?.response?.data || error?.message || "Lỗi tải tệp lên";
      console.error("[Upload Error]", error);
      toast.error(`Lỗi tải tệp lên: ${message}`);
    } finally {
      setIsUploading(false);
    }
  };

  const removeAttachment = (index: number) => {
    setAttachments(prev => prev.filter((_, i) => i !== index));
  };

  const handleSubmit = async () => {
    if (attachments.length === 0) {
      toast.error("Vui lòng tải lên ít nhất một tệp");
      return;
    }

    setIsSubmitting(true);
    try {
      const res = await submitHomework(lessonId, attachments);
      if (res.success) {
        setSubmission(res.submission);
        toast.success("Nộp bài tập thành công!");
      }
    } catch (error: any) {
      const message = error?.message || "Lỗi khi nộp bài";
      console.error("[Submit Error]", error);
      toast.error(`Lỗi khi nộp bài: ${message}`);
    } finally {
      setIsSubmitting(false);
      window.location.reload();
    }
  };

  const statusConfig = {
    PENDING: { icon: Clock, text: "Đang chờ duyệt", color: "text-amber-600", bg: "bg-amber-50", border: "border-amber-100" },
    SATISFACTORY: { icon: CheckCircle2, text: "Đạt yêu cầu", color: "text-emerald-600", bg: "bg-emerald-50", border: "border-emerald-100" },
    UNSATISFACTORY: { icon: AlertCircle, text: "Chưa đạt yêu cầu", color: "text-blue-600", bg: "bg-blue-50", border: "border-blue-100" }
  };

  const currentStatus = submission ? statusConfig[submission.status as keyof typeof statusConfig] : null;

  return (
    <div className="bg-white rounded-[2rem] border border-blue-100 shadow-xl shadow-blue-500/5 overflow-hidden">
      <div className="p-6 md:p-8 space-y-6">
        <div className="flex items-center justify-between">
           <div className="flex items-center gap-3">
              <div className="w-10 h-10 rounded-2xl bg-blue-600 flex items-center justify-center text-white shadow-lg shadow-blue-200">
                 <Upload className="w-5 h-5" />
              </div>
              <div>
                 <h3 className="font-black text-slate-800 uppercase tracking-tight">Nộp bài tập bài học</h3>
                 <p className="text-[10px] font-bold text-slate-400 uppercase tracking-widest">Đính kèm ảnh hoặc file PDF</p>
              </div>
           </div>
           
           {currentStatus && (
              <div className={cn("px-4 py-1.5 rounded-full border flex items-center gap-2 text-[10px] font-black uppercase tracking-widest", currentStatus.bg, currentStatus.color, currentStatus.border)}>
                 <currentStatus.icon className="w-3.5 h-3.5" />
                 {currentStatus.text}
              </div>
           )}
        </div>

        {submission?.feedback && (
           <div className="p-5 bg-slate-50 rounded-3xl border border-slate-100 space-y-2">
              <p className="text-[10px] font-black text-blue-600 uppercase tracking-widest">Nhận xét từ giáo viên:</p>
              <p className="text-sm font-medium text-slate-600 leading-relaxed italic">"{submission.feedback}"</p>
           </div>
        )}

        <div className="space-y-4">
           {attachments.length > 0 && (
              <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                 {attachments.map((file, idx) => (
                    <div key={idx} className="group relative flex items-center gap-3 p-3 bg-slate-50 border border-slate-100 rounded-2xl hover:bg-white hover:border-blue-200 transition-all">
                       <div className="w-10 h-10 rounded-xl bg-white flex items-center justify-center shadow-sm border border-slate-100">
                          {file.name.match(/\.(jpg|jpeg|png|gif)$/i) ? <ImageIcon className="w-5 h-5 text-blue-500" /> : <FileText className="w-5 h-5 text-blue-500" />}
                       </div>
                       <div className="flex-1 min-w-0">
                          <p className="text-xs font-bold text-slate-700 truncate">{file.name}</p>
                          <a href={file.url} target="_blank" className="text-[9px] font-black text-blue-600 uppercase hover:underline">Xem tệp</a>
                       </div>
                       <button 
                         onClick={() => removeAttachment(idx)}
                         className="p-1.5 rounded-lg bg-blue-50 text-blue-500 opacity-0 group-hover:opacity-100 transition-opacity"
                       >
                          <X className="w-3.5 h-3.5" />
                       </button>
                    </div>
                 ))}
              </div>
           )}

           <div className="flex flex-col sm:flex-row gap-3">
              <label className="flex-1 cursor-pointer">
                 <div className="h-14 border-2 border-dashed border-blue-100 rounded-2xl flex items-center justify-center gap-3 bg-blue-50/30 hover:bg-blue-50 hover:border-blue-300 transition-all group">
                    {isUploading ? (
                       <Loader2 className="w-5 h-5 text-blue-600 animate-spin" />
                    ) : (
                       <Upload className="w-5 h-5 text-blue-400 group-hover:text-blue-600 transition-colors" />
                    )}
                    <span className="text-sm font-bold text-slate-500 group-hover:text-blue-700 uppercase tracking-tight">
                       {isUploading ? "Đang tải lên..." : "Chọn tệp nộp bài"}
                    </span>
                 </div>
                 <input 
                   type="file" 
                   multiple 
                   className="hidden" 
                   accept="image/*,application/pdf" 
                   onChange={handleFileUpload}
                   disabled={isUploading || isSubmitting}
                 />
              </label>

              <Button 
                onClick={handleSubmit}
                disabled={isSubmitting || isUploading || attachments.length === 0}
                className="h-14 px-8 rounded-2xl bg-blue-600 hover:bg-blue-700 shadow-lg shadow-blue-200 font-black uppercase text-xs tracking-widest flex items-center gap-2 group"
              >
                 {isSubmitting ? <Loader2 className="w-4 h-4 animate-spin" /> : <Send className="w-4 h-4 group-hover:translate-x-1 group-hover:-translate-y-1 transition-transform" />}
                 {submission ? "Nộp lại bài" : "Gửi bài tập"}
              </Button>
           </div>
        </div>
      </div>
    </div>
  );
}
