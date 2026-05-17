"use client";

import { useState } from "react";
import { 
  CheckCircle2, 
  XCircle, 
  MessageSquare, 
  FileText, 
  Image as ImageIcon,
  User,
  Clock,
  ExternalLink
} from "lucide-react";
import { Button } from "@/components/ui/button";
import { Textarea } from "@/components/ui/textarea";
import { toast } from "sonner";
import { gradeHomework } from "@/actions/homework";
import { cn } from "@/lib/utils";

interface TeacherHomeworkReviewProps {
  submissions: any[];
}

export function TeacherHomeworkReview({ submissions: initialSubmissions }: TeacherHomeworkReviewProps) {
  const [submissions, setSubmissions] = useState(initialSubmissions);
  const [feedback, setFeedback] = useState<Record<string, string>>({});
  const [loading, setLoading] = useState<Record<string, boolean>>({});

  const handleGrade = async (submissionId: string, status: "SATISFACTORY" | "UNSATISFACTORY") => {
    setLoading(prev => ({ ...prev, [submissionId]: true }));
    try {
      const res = await gradeHomework(submissionId, status, feedback[submissionId]);
      if (res.success) {
        setSubmissions(prev => prev.map(s => s.id === submissionId ? res.submission : s));
        toast.success("Đã cập nhật trạng thái bài nộp");
      }
    } catch (error) {
      toast.error("Lỗi khi chấm bài");
    } finally {
      setLoading(prev => ({ ...prev, [submissionId]: false }));
    }
  };

  if (submissions.length === 0) {
    return (
      <div className="p-12 text-center bg-slate-50 rounded-[2rem] border border-dashed border-slate-200">
        <Clock className="w-12 h-12 text-slate-300 mx-auto mb-4" />
        <p className="text-slate-500 font-bold uppercase tracking-tight">Chưa có học sinh nào nộp bài tập</p>
      </div>
    );
  }

  return (
    <div className="space-y-6">
      <h3 className="text-xl font-black text-slate-800 uppercase tracking-tight flex items-center gap-3">
        <div className="w-10 h-10 rounded-2xl bg-blue-600 flex items-center justify-center text-white shadow-lg shadow-blue-200">
           <FileText className="w-5 h-5" />
        </div>
        Danh sách bài nộp ({submissions.length})
      </h3>

      <div className="grid grid-cols-1 gap-6">
        {submissions.map((sub) => (
          <div key={sub.id} className="bg-white rounded-[2rem] border border-blue-100 shadow-sm overflow-hidden flex flex-col md:flex-row">
            {/* Left: Student Info & Files */}
            <div className="p-6 md:p-8 flex-1 space-y-6 border-r border-slate-50">
               <div className="flex items-center gap-4">
                  <div className="w-12 h-12 rounded-2xl bg-slate-100 flex items-center justify-center text-slate-400 overflow-hidden">
                     {sub.user.image ? <img src={sub.user.image} alt="" className="w-full h-full object-cover" /> : <User className="w-6 h-6" />}
                  </div>
                  <div>
                     <p className="font-black text-slate-800 uppercase tracking-tight">{sub.user.name || "Học viên"}</p>
                     <p className="text-[10px] font-bold text-slate-400 uppercase tracking-widest">{sub.user.email}</p>
                  </div>
               </div>

               <div className="space-y-3">
                  <p className="text-[10px] font-black text-blue-600 uppercase tracking-[0.2em]">Tệp đính kèm:</p>
                  <div className="grid grid-cols-1 sm:grid-cols-2 gap-2">
                     {(sub.attachments as any[]).map((file, i) => (
                        <a 
                          key={i} 
                          href={file.url} 
                          target="_blank" 
                          className="flex items-center gap-3 p-3 bg-slate-50 rounded-xl hover:bg-blue-50 transition-colors group"
                        >
                           {file.name.match(/\.(jpg|jpeg|png|gif)$/i) ? <ImageIcon className="w-4 h-4 text-blue-500" /> : <FileText className="w-4 h-4 text-red-500" />}
                           <span className="text-[11px] font-bold text-slate-600 truncate flex-1">{file.name}</span>
                           <ExternalLink className="w-3 h-3 text-slate-300 group-hover:text-blue-500" />
                        </a>
                     ))}
                  </div>
               </div>
            </div>

            {/* Right: Grading Area */}
            <div className="p-6 md:p-8 w-full md:w-[350px] bg-slate-50/50 space-y-4">
               <div className="space-y-2">
                  <div className="flex items-center gap-2 text-[10px] font-black text-slate-400 uppercase tracking-widest">
                     <MessageSquare className="w-3.5 h-3.5" />
                     Nhận xét
                  </div>
                  <Textarea 
                    placeholder="Nhập nhận xét cho học sinh..."
                    value={feedback[sub.id] || sub.feedback || ""}
                    onChange={(e) => setFeedback(prev => ({ ...prev, [sub.id]: e.target.value }))}
                    className="min-h-[100px] rounded-2xl border-slate-200 text-sm focus:ring-blue-500"
                  />
               </div>

               <div className="flex flex-col gap-2">
                  <Button
                    onClick={() => handleGrade(sub.id, "SATISFACTORY")}
                    disabled={loading[sub.id]}
                    className={cn(
                      "w-full h-11 rounded-xl font-black uppercase text-[10px] tracking-widest flex items-center justify-center gap-2 transition-all",
                      sub.status === "SATISFACTORY" ? "bg-emerald-600 hover:bg-emerald-700" : "bg-white text-emerald-600 border border-emerald-200 hover:bg-emerald-50"
                    )}
                  >
                     <CheckCircle2 className="w-4 h-4" />
                     Đạt yêu cầu
                  </Button>
                  <Button
                    onClick={() => handleGrade(sub.id, "UNSATISFACTORY")}
                    disabled={loading[sub.id]}
                    className={cn(
                      "w-full h-11 rounded-xl font-black uppercase text-[10px] tracking-widest flex items-center justify-center gap-2 transition-all",
                      sub.status === "UNSATISFACTORY" ? "bg-red-600 hover:bg-red-700" : "bg-white text-red-600 border border-red-200 hover:bg-red-50"
                    )}
                  >
                     <XCircle className="w-4 h-4" />
                     Chưa đạt
                  </Button>
               </div>
            </div>
          </div>
        ))}
      </div>
    </div>
  );
}
