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
  ExternalLink,
  BookOpen,
  ChevronRight
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
  const [activeTab, setActiveTab] = useState<"PENDING" | "GRADED">("PENDING");
  
  const [courseFilter, setCourseFilter] = useState("ALL");
  const [lessonFilter, setLessonFilter] = useState("ALL");

  const handleGrade = async (submissionId: string, status: "SATISFACTORY" | "UNSATISFACTORY") => {
    if (status === "UNSATISFACTORY") {
      const currentFeedback = feedback[submissionId] !== undefined ? feedback[submissionId] : submissions.find(s => s.id === submissionId)?.feedback;
      if (!currentFeedback?.trim()) {
        toast.error("Vui lòng nhập nhận xét để học sinh biết lỗi sai");
        return;
      }
    }
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
    return null;
  }

  const uniqueCourses = Array.from(new Set(submissions.map(s => s.lesson?.chapter?.course?.title).filter(Boolean))) as string[];
  const uniqueLessons = Array.from(new Set(submissions.filter(s => courseFilter === "ALL" || s.lesson?.chapter?.course?.title === courseFilter).map(s => s.lesson?.title).filter(Boolean))) as string[];

  const filteredSubmissions = submissions.filter(s => {
    if (courseFilter !== "ALL" && s.lesson?.chapter?.course?.title !== courseFilter) return false;
    if (lessonFilter !== "ALL" && s.lesson?.title !== lessonFilter) return false;
    return true;
  });

  const pendingSubmissions = filteredSubmissions.filter(s => s.status === "PENDING");
  const gradedSubmissions = filteredSubmissions.filter(s => s.status !== "PENDING");
  const displaySubmissions = activeTab === "PENDING" ? pendingSubmissions : gradedSubmissions;

  return (
    <div className="space-y-6">
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4">
        <h3 className="text-xl font-black text-slate-800 uppercase tracking-tight flex items-center gap-3">
          <div className="w-10 h-10 rounded-2xl bg-blue-600 flex items-center justify-center text-white shadow-lg shadow-blue-200">
             <FileText className="w-5 h-5" />
          </div>
          Quản lý Bài nộp
        </h3>
        
        <div className="flex bg-slate-100 p-1.5 rounded-2xl w-fit">
          <button 
            onClick={() => setActiveTab("PENDING")} 
            className={cn("px-5 py-2.5 rounded-xl text-[10px] font-black uppercase tracking-widest transition-all", activeTab === "PENDING" ? "bg-white text-blue-600 shadow-sm" : "text-slate-500 hover:text-slate-700")}
          >
            Cần chấm ({pendingSubmissions.length})
          </button>
          <button 
            onClick={() => setActiveTab("GRADED")} 
            className={cn("px-5 py-2.5 rounded-xl text-[10px] font-black uppercase tracking-widest transition-all", activeTab === "GRADED" ? "bg-white text-slate-800 shadow-sm" : "text-slate-500 hover:text-slate-700")}
          >
            Đã chấm ({gradedSubmissions.length})
          </button>
        </div>
      </div>

      {uniqueCourses.length > 0 && (
        <div className="flex flex-col sm:flex-row gap-4 bg-slate-50 p-4 rounded-[1.5rem] border border-slate-100 animate-in fade-in duration-300">
          <select 
            className="flex-1 bg-white border border-slate-200 rounded-xl px-4 py-3 text-sm font-semibold text-slate-700 outline-none focus:border-blue-500 focus:ring-2 focus:ring-blue-100 transition-all cursor-pointer"
            value={courseFilter}
            onChange={(e) => {
              setCourseFilter(e.target.value);
              setLessonFilter("ALL");
            }}
          >
            <option value="ALL">Tất cả Khóa học</option>
            {uniqueCourses.map(c => <option key={c} value={c}>{c}</option>)}
          </select>
          
          <select 
            className="flex-1 bg-white border border-slate-200 rounded-xl px-4 py-3 text-sm font-semibold text-slate-700 outline-none focus:border-blue-500 focus:ring-2 focus:ring-blue-100 transition-all cursor-pointer"
            value={lessonFilter}
            onChange={(e) => setLessonFilter(e.target.value)}
            disabled={uniqueLessons.length === 0}
          >
            <option value="ALL">Tất cả Bài học</option>
            {uniqueLessons.map(l => <option key={l} value={l}>{l}</option>)}
          </select>
        </div>
      )}

      <div className="grid grid-cols-1 gap-6">
        {displaySubmissions.length === 0 ? (
          <div className="p-12 text-center bg-slate-50/50 rounded-[2rem] border border-dashed border-slate-200 animate-in fade-in zoom-in-95 duration-300">
            <CheckCircle2 className="w-12 h-12 text-emerald-300 mx-auto mb-4" />
            <p className="text-slate-500 font-bold uppercase tracking-tight">
              {activeTab === "PENDING" ? "Tuyệt vời! Không còn bài nào cần chấm." : "Chưa có bài nào được chấm."}
            </p>
          </div>
        ) : (
          displaySubmissions.map((sub) => (
            <div key={sub.id} className="bg-white rounded-[2rem] border border-blue-100 shadow-sm overflow-hidden flex flex-col md:flex-row animate-in fade-in slide-in-from-bottom-4 duration-500">
            {/* Left: Student Info & Files */}
            <div className="p-6 md:p-8 flex-1 space-y-6 border-r border-slate-50">
               {sub.lesson && sub.lesson.chapter && (
                 <div className="flex items-center gap-2 mb-4 bg-blue-50 w-fit px-3 py-1.5 rounded-lg border border-blue-100">
                    <BookOpen className="w-3.5 h-3.5 text-[#2563EB]" />
                    <span className="text-[10px] font-black uppercase tracking-wider text-[#2563EB] max-w-[150px] sm:max-w-[200px] truncate">
                      {sub.lesson.chapter?.course?.title || "Khóa học"}
                    </span>
                    <ChevronRight className="w-3 h-3 text-blue-300" />
                    <span className="text-[10px] font-bold text-blue-600 truncate max-w-[150px] sm:max-w-[200px]">
                      {sub.lesson.title}
                    </span>
                 </div>
               )}
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
                           {file.name.match(/\.(jpg|jpeg|png|gif)$/i) ? <ImageIcon className="w-4 h-4 text-blue-500" /> : <FileText className="w-4 h-4 text-blue-500" />}
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
                      sub.status === "UNSATISFACTORY" ? "bg-blue-600 hover:bg-blue-700" : "bg-white text-blue-600 border border-blue-200 hover:bg-blue-50"
                    )}
                  >
                     <XCircle className="w-4 h-4" />
                     Chưa đạt
                  </Button>
               </div>
           </div>
          </div>
        )))}
      </div>
    </div>
  );
}
