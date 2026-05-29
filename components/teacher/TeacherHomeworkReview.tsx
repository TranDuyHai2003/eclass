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
  ChevronRight,
  RefreshCw,
  Trash2
} from "lucide-react";
import { Button } from "@/components/ui/button";
import { Textarea } from "@/components/ui/textarea";
import { toast } from "sonner";
import { gradeHomework, deleteHomeworkSubmission } from "@/actions/homework";
import { cn } from "@/lib/utils";
import { Badge } from "@/components/ui/badge";

interface TeacherHomeworkReviewProps {
  submissions: any[];
}

type TabType = "PENDING" | "UNSATISFACTORY" | "SATISFACTORY";

const tabConfig: Record<TabType, { label: string; activeColor: string; emptyIcon: typeof CheckCircle2; emptyText: string; emptyIconColor: string }> = {
  PENDING: { label: "Cần chấm", activeColor: "text-blue-600", emptyIcon: CheckCircle2, emptyIconColor: "text-emerald-300", emptyText: "Tuyệt vời! Không còn bài nào cần chấm." },
  UNSATISFACTORY: { label: "Chưa đạt", activeColor: "text-orange-600", emptyIcon: XCircle, emptyIconColor: "text-orange-300", emptyText: "Không có bài nào chưa đạt." },
  SATISFACTORY: { label: "Đã đạt", activeColor: "text-emerald-600", emptyIcon: CheckCircle2, emptyIconColor: "text-emerald-300", emptyText: "Chưa có bài nào đạt yêu cầu." },
};

export function TeacherHomeworkReview({ submissions: initialSubmissions }: TeacherHomeworkReviewProps) {
  const [submissions, setSubmissions] = useState(initialSubmissions);
  const [feedback, setFeedback] = useState<Record<string, string>>({});
  const [loading, setLoading] = useState<Record<string, boolean>>({});
  const [activeTab, setActiveTab] = useState<TabType>("PENDING");
  
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

    const sub = submissions.find(s => s.id === submissionId);
    if (sub?.status === "SATISFACTORY" && status === "UNSATISFACTORY") {
      if (!window.confirm("Bài này đã được đánh dấu ĐẠT. Bạn có chắc muốn đổi thành CHƯA ĐẠT?")) return;
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

  const handleDelete = async (submissionId: string, userName: string) => {
    if (!window.confirm(`Xóa bài nộp của "${userName}"? Học sinh sẽ phải nộp lại từ đầu.`)) return;

    setLoading(prev => ({ ...prev, [submissionId]: true }));
    try {
      const res = await deleteHomeworkSubmission(submissionId);
      if (res.success) {
        setSubmissions(prev => prev.filter(s => s.id !== submissionId));
        toast.success("Đã xóa bài nộp");
      }
    } catch (error) {
      toast.error("Lỗi khi xóa bài nộp");
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
  const unsatisfactorySubmissions = filteredSubmissions.filter(s => s.status === "UNSATISFACTORY");
  const satisfactorySubmissions = filteredSubmissions.filter(s => s.status === "SATISFACTORY");

  const tabCounts: Record<TabType, number> = {
    PENDING: pendingSubmissions.length,
    UNSATISFACTORY: unsatisfactorySubmissions.length,
    SATISFACTORY: satisfactorySubmissions.length,
  };

  const displaySubmissions = 
    activeTab === "PENDING" ? pendingSubmissions :
    activeTab === "UNSATISFACTORY" ? unsatisfactorySubmissions :
    satisfactorySubmissions;

  const tab = tabConfig[activeTab];

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
          {(Object.entries(tabConfig) as [TabType, typeof tabConfig[TabType]][]).map(([key, cfg]) => (
            <button 
              key={key}
              onClick={() => setActiveTab(key)} 
              className={cn(
                "px-5 py-2.5 rounded-xl text-[10px] font-black uppercase tracking-widest transition-all",
                activeTab === key ? "bg-white shadow-sm " + cfg.activeColor : "text-slate-500 hover:text-slate-700"
              )}
            >
              {cfg.label} ({tabCounts[key]})
            </button>
          ))}
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
            <tab.emptyIcon className={cn("w-12 h-12 mx-auto mb-4", tab.emptyIconColor)} />
            <p className="text-slate-500 font-bold uppercase tracking-tight">{tab.emptyText}</p>
          </div>
        ) : (
          displaySubmissions.map((sub) => {
            const isResubmitted = sub.status === "PENDING" && sub.feedback !== null;

            return (
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
                      {sub.user?.image ? <img src={sub.user.image} alt="" className="w-full h-full object-cover" /> : <User className="w-6 h-6" />}
                  </div>
                  <div className="flex-1 min-w-0">
                     <div className="flex items-center gap-2 flex-wrap">
                         <p className="font-black text-slate-800 uppercase tracking-tight">{sub.user?.name || "Học viên"}</p>
                         <Badge 
                             variant="secondary" 
                             className={cn(
                                 "text-[9px] font-black uppercase tracking-tight px-1.5 py-0",
                                 sub.user?.studentType === "OFFLINE" ? "bg-orange-100 text-orange-700" : "bg-blue-100 text-blue-700"
                             )}
                         >
                             {sub.user?.studentType}
                         </Badge>
                         {isResubmitted && (
                           <Badge variant="secondary" className="text-[9px] font-black uppercase tracking-tight px-1.5 py-0 bg-amber-100 text-amber-700">
                             <RefreshCw className="w-2.5 h-2.5 mr-0.5 inline" />
                             Đã nộp lại
                           </Badge>
                         )}
                     </div>
                     <p className="text-[10px] font-bold text-slate-400 uppercase tracking-widest">{sub.user?.email}</p>
                  </div>
               </div>

               <div className="space-y-3">
                  <div className="flex items-center justify-between">
                    <p className="text-[10px] font-black text-blue-600 uppercase tracking-[0.2em]">Tệp đính kèm:</p>
                    <Button
                      variant="ghost"
                      size="sm"
                      onClick={() => handleDelete(sub.id, sub.user?.name || "Học viên")}
                      disabled={loading[sub.id]}
                      className="h-7 px-2 rounded-lg text-rose-500 hover:text-rose-700 hover:bg-rose-50 text-[9px] font-black uppercase tracking-widest gap-1"
                    >
                      <Trash2 className="w-3 h-3" />
                      Xóa
                    </Button>
                  </div>
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
                    value={feedback[sub.id] ?? sub.feedback ?? ""}
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
                      sub.status === "SATISFACTORY" ? "bg-emerald-600 hover:bg-emerald-700 text-white" : "bg-white text-emerald-600 border border-emerald-200 hover:bg-emerald-50"
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
                      sub.status === "UNSATISFACTORY" ? "bg-orange-500 hover:bg-orange-600 text-white" : "bg-white text-orange-600 border border-orange-200 hover:bg-orange-50"
                    )}
                  >
                     <XCircle className="w-4 h-4" />
                     Chưa đạt
                  </Button>
               </div>
           </div>
          </div>
            )})
        )}
      </div>
    </div>
  );
}
