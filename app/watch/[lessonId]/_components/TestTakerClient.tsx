"use client";

import { useState, useEffect, useTransition, useCallback } from "react";
import dynamic from "next/dynamic";
import { toast } from "sonner";
import { ArrowLeft, Clock, Send, AlertTriangle, Flag, Upload, X, Image as ImageIcon, FileText, Loader2, ExternalLink } from "lucide-react";
import { useRouter } from "next/navigation";
import { startTestAttempt, submitTestAttempt } from "@/actions/test";
import { useCountdown } from "@/hooks/use-countdown";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { cn } from "@/lib/utils";
import axios from "axios";

const PDFViewer = dynamic(() => import("@/components/ui/pdf-viewer"), {
  ssr: false,
  loading: () => (
    <div className="flex h-full w-full items-center justify-center bg-gray-100">
      Đang tải đề thi...
    </div>
  ),
});

export default function TestTakerClient({
  test,
  lesson,
  course,
  resultsPath,
  backPath,
}: {
  test: any;
  lesson: any;
  course: any;
  resultsPath?: string;
  backPath?: string; // Where the back arrow goes (defaults to course detail)
}) {
  const router = useRouter();
  const [attemptId, setAttemptId] = useState<string | null>(null);
  const [startedAt, setStartedAt] = useState<Date | null>(null);
  const [isPending, startTransition] = useTransition();
  const [loadingInitial, setLoadingInitial] = useState(true);
  const [isTimeUp, setIsTimeUp] = useState(false); // Riêng biệt, chỉ true khi countdown thực sự hết

  const [answers, setAnswers] = useState<Record<string, string>>({});
  const [flags, setFlags] = useState<Record<string, boolean>>({});
  const [isUploading, setIsUploading] = useState<Record<string, boolean>>({});

  useEffect(() => {
    // 1. Fetch or create attempt
    startTestAttempt(test.id).then((res) => {
      if (res.success && res.attempt) {
        // IMPORTANT: If attempt is already completed, redirect to results immediately
        if (res.attempt.completedAt) {
          const path = resultsPath
            ? `${resultsPath}/${res.attempt.id}`
            : `/watch/${lesson.id}/results/${res.attempt.id}`;
          router.replace(path);
          return;
        }

        setAttemptId(res.attempt.id);
        setStartedAt(new Date(res.attempt.startedAt));

        // 2. Load draft from localStorage
        const draft = localStorage.getItem(`draft_${res.attempt.id}`);
        if (draft) {
          try {
            setAnswers(JSON.parse(draft));
          } catch (e) {}
        }
      } else {
        toast.error("Không thể bắt đầu làm bài");
      }
      setLoadingInitial(false);
    });
  }, [test.id, lesson.id, resultsPath, router]);

  // Duration count-down has been removed per request (unlimited time)

  const handleSubmit = useCallback(() => {
    if (!attemptId) return;

    let totalQuestions = 0;
    test.sections.forEach((s: any) => (totalQuestions += s.questions.length));
    const answeredCount = Object.keys(answers).filter(
      (k) => answers[k] !== "",
    ).length;

    if (answeredCount < totalQuestions && !isTimeUp) {
      if (
        !confirm(
          `Bạn mới làm ${answeredCount}/${totalQuestions} câu. Bạn có chắc chắn muốn nộp bài?`,
        )
      ) {
        return;
      }
    }

    startTransition(async () => {
      try {
        const answersArray = Object.keys(answers).map((qId) => ({
          questionId: qId,
          answerProvided: answers[qId],
        }));

        const res = await submitTestAttempt(attemptId, answersArray);
        if (res.success) {
          toast.success("Nộp bài thành công!");
          localStorage.removeItem(`draft_${attemptId}`);
          const path = resultsPath
            ? `${resultsPath}/${attemptId}`
            : `/watch/${lesson.id}/results/${attemptId}`;
          router.push(path);
        } else {
          throw new Error("Lỗi nộp bài");
        }
      } catch (e) {
        toast.error("Không thể nộp bài");
      }
    });
  }, [attemptId, answers, isTimeUp, test, lesson, resultsPath, router]);

  // Auto-submit on time up has been disabled

  // Auto-save logic
  useEffect(() => {
    if (attemptId && Object.keys(answers).length > 0) {
      localStorage.setItem(`draft_${attemptId}`, JSON.stringify(answers));
    }
  }, [answers, attemptId]);

  const handleSelectAnswer = (qId: string, value: string) => {
    setAnswers((prev) => ({ ...prev, [qId]: value }));
  };

  const handleToggleFlag = (qId: string) => {
    setFlags(prev => ({ ...prev, [qId]: !prev[qId] }));
  };

  const handleFileUpload = async (e: React.ChangeEvent<HTMLInputElement>, qId: string) => {
    const files = e.target.files;
    if (!files || files.length === 0) return;

    setIsUploading(prev => ({ ...prev, [qId]: true }));
    try {
      const file = files[0];
      const res = await axios.put<{ publicUrl: string }>(
        `/api/upload/proxy?fileName=essay_${qId}_${Date.now()}_${encodeURIComponent(file.name)}`,
        file,
        { headers: { "Content-Type": file.type } }
      );
      
      handleSelectAnswer(qId, res.data.publicUrl);
      toast.success("Tải tệp lên thành công");
    } catch (error) {
      toast.error("Lỗi tải tệp lên");
    } finally {
      setIsUploading(prev => ({ ...prev, [qId]: false }));
    }
  };

  const removeFileUpload = (qId: string) => {
    handleSelectAnswer(qId, "");
  };

  if (loadingInitial) {
    return (
      <div className="flex h-screen items-center justify-center">
        Đang khởi tạo bài thi...
      </div>
    );
  }

  return (
    <div className="flex h-screen flex-col bg-[#E2EEFF] overflow-hidden relative z-[60] w-full max-w-full">
      {/* Hide Global Header on Test Page */}
      <style dangerouslySetInnerHTML={{ __html: `
        header { display: none !important; }
      `}} />

      {/* Main Split - 60/40 vertical on mobile, flex-1/fixed-width on desktop */}
      <div className="flex flex-col md:flex-row flex-1 relative overflow-hidden w-full max-w-full">
        {/* Left/Top: PDF (60% height on mobile, flex-1 on desktop) */}
        <div className="min-w-0 w-full flex-1 h-[60%] md:h-full border-r relative bg-[#E2EEFF] overflow-y-auto custom-scrollbar">
          {test.pdfUrl ? (
            <div className="min-h-full w-full">
              <PDFViewer 
                url={test.pdfUrl} 
                noScroll 
                flat 
                renderLeft={
                  <div className="flex items-center gap-2 md:gap-4 min-w-0">
                    <Button
                      variant="ghost"
                      size="icon"
                      onClick={() => router.back()}
                      className="h-8 w-8 md:h-9 md:w-9 rounded-lg hover:bg-white/20 shrink-0"
                    >
                      <ArrowLeft className="h-4 w-4 md:h-5 md:w-5 text-slate-600" />
                    </Button>
                    <div className="min-w-0">
                      <h1 className="font-black text-slate-900 leading-none truncate text-[11px] md:text-sm uppercase tracking-tight">{lesson.title}</h1>
                      <p className="hidden sm:block text-[9px] text-slate-400 mt-0.5 truncate font-bold uppercase tracking-widest">{course.title}</p>
                    </div>
                  </div>
                }
              />
            </div>
          ) : (
            <div className="flex items-center justify-center h-full">
              Đề thi chưa có file PDF.
            </div>
          )}
        </div>

        {/* Right/Bottom: Bubble Sheet (40% height on mobile, fixed-width on desktop) */}
        <div className="min-w-0 w-full md:w-[350px] xl:w-[400px] shrink-0 h-[40%] md:h-full bg-white flex flex-col md:sticky md:top-0 overflow-hidden z-20 border-t md:border-t-0 shadow-[-4px_0_12px_rgba(0,0,0,0.02)]">
          <div className="h-14 md:h-16 border-b border-slate-200 bg-white flex items-center justify-between px-3 md:px-4 font-black text-slate-800 shadow-sm shrink-0">
            <div className="flex flex-col min-w-0">
               <span className="uppercase tracking-widest text-[8px] md:text-[10px] text-slate-400">PHIẾU TRẢ LỜI</span>
               <span className="text-xs md:text-sm font-black text-blue-600 uppercase tracking-wider">Đang làm bài</span>
            </div>
            
            <Button
              onClick={handleSubmit}
              disabled={isPending}
              className="gap-1.5 md:gap-2 bg-blue-600 hover:bg-blue-700 h-9 md:h-11 text-xs md:text-sm px-4 md:px-6 rounded-xl font-black uppercase tracking-widest shadow-lg shadow-blue-500/20"
            >
              <Send className="h-3.5 md:h-4 w-3.5 md:h-4" />
              <span>{isPending ? "..." : "Nộp bài"}</span>
            </Button>
          </div>

          <div className="flex-1 overflow-y-auto p-2 md:p-4 space-y-4 md:space-y-6 custom-scrollbar w-full">
            {test.sections.map((section: any, sIdx: number) => (
              <div key={section.id} className="space-y-3">
                <h3 className="font-bold text-blue-800 border-b pb-2 uppercase tracking-wide text-[10px]">
                  {section.name}
                </h3>

                <div className="flex flex-col gap-2">
                  {section.questions.map((q: any, qIdx: number) => {
                    const val = answers[q.id] || "";
                    const isFlagged = flags[q.id] || false;
                    const qNumber = qIdx + 1;
                    const rawType = q?.type ?? "MULTIPLE_CHOICE";
                    const normalizedType = typeof rawType === "string"
                      ? rawType.trim().toUpperCase()
                      : "MULTIPLE_CHOICE";
                    const isChoice = normalizedType === "MULTIPLE_CHOICE" || normalizedType === "MCQ" || normalizedType === "MULTIPLE_CHOICE_SINGLE";
                    const isShort = normalizedType === "SHORT_ANSWER";
                    const isEssay = normalizedType === "ESSAY";

                    return (
                      <div
                        key={q.id}
                        className={cn(
                          "flex items-center gap-2 p-2.5 border rounded-xl transition-all",
                          isFlagged ? "bg-orange-50/50 border-orange-200" : "bg-gray-50/50 hover:bg-white border-slate-100"
                        )}
                      >
                        <div className="flex items-center gap-2 shrink-0 min-w-[65px]">
                          <button 
                            onClick={() => handleToggleFlag(q.id)}
                            className={cn(
                              "p-1.5 rounded-lg transition-all",
                              isFlagged ? "text-orange-500 bg-orange-100 shadow-sm" : "text-slate-300 hover:text-slate-400 hover:bg-slate-100"
                            )}
                          >
                            <Flag className={cn("w-3 h-3", isFlagged && "fill-current")} />
                          </button>
                          <div className="text-[12px] font-black text-slate-700">
                            C.{qNumber}
                          </div>
                        </div>

                        <div className="flex-1">
                          {isChoice && (
                            <div className="flex gap-1.5">
                              {["A", "B", "C", "D"].map((opt) => (
                                <button
                                  key={opt}
                                   onClick={() => handleSelectAnswer(q.id, opt)}
                                  className={cn(
                                    "w-8 h-8 rounded-lg border text-xs font-black transition-all",
                                    val === opt
                                      ? "bg-blue-600 text-white border-blue-600 shadow-md scale-105"
                                      : "bg-white text-slate-500 border-slate-200 hover:border-blue-400 hover:bg-blue-50/30"
                                  )}
                                >
                                  {opt}
                                </button>
                              ))}
                            </div>
                          )}

                          {isShort && (
                            <Input
                              value={val}
                              onChange={(e) =>
                                handleSelectAnswer(q.id, e.target.value)
                              }
                              placeholder="Nhập đáp án..."
                              className="h-10 text-sm bg-white border-slate-200 focus:ring-blue-500 rounded-xl"
                            />
                          )}

                          {isEssay && (
                            <div className="py-2 space-y-2">
                               <label className="flex items-center gap-2 cursor-pointer group">
                                  <div className={cn(
                                    "h-10 flex-1 border-2 border-dashed border-blue-200 rounded-xl flex items-center justify-center gap-2 bg-blue-50/30 group-hover:bg-blue-50 group-hover:border-blue-400 transition-all",
                                    isUploading[q.id] && "opacity-50 cursor-not-allowed"
                                  )}>
                                     {isUploading[q.id] ? (
                                        <Loader2 className="w-4 h-4 text-blue-600 animate-spin" />
                                     ) : (
                                        <Upload className="w-4 h-4 text-blue-400 group-hover:text-blue-600 transition-colors" />
                                     )}
                                     <span className="text-xs font-black text-slate-500 group-hover:text-blue-700 uppercase tracking-tight">
                                        {isUploading[q.id] ? "Đang tải..." : "Nộp bài tự luận"}
                                     </span>
                                  </div>
                                  <input 
                                    type="file" 
                                    className="hidden" 
                                    accept="image/*,application/pdf" 
                                    onChange={(e) => handleFileUpload(e, q.id)}
                                    disabled={isUploading[q.id]}
                                  />
                               </label>

                               {val && (
                                  <div className="flex items-center gap-2 p-2.5 bg-blue-50/50 border border-blue-100 rounded-xl group animate-in fade-in slide-in-from-top-1">
                                     <div className="w-9 h-9 rounded-lg bg-white flex items-center justify-center shadow-sm border border-slate-100">
                                        {val.match(/\.(jpg|jpeg|png|gif)$/i) ? <ImageIcon className="w-5 h-5 text-blue-500" /> : <FileText className="w-5 h-5 text-red-500" />}
                                     </div>
                                     <div className="flex-1 min-w-0">
                                        <p className="text-[10px] font-black text-slate-700 uppercase tracking-tight">Đã tải lên</p>
                                        <a href={val} target="_blank" className="text-[10px] font-black text-blue-600 uppercase hover:underline flex items-center gap-1">
                                           Xem bài làm <ExternalLink className="w-2.5 h-2.5" />
                                        </a>
                                     </div>
                                     <button 
                                       onClick={() => removeFileUpload(q.id)}
                                       className="p-1.5 rounded-lg bg-red-50 text-red-500 opacity-0 group-hover:opacity-100 transition-all hover:bg-red-100"
                                     >
                                        <X className="w-4 h-4" />
                                     </button>
                                  </div>
                               )}
                            </div>
                          )}

                          {!isChoice && !isShort && !isEssay && (
                            <div className="text-xs text-slate-500 font-bold py-2">
                              Không xác định loại câu hỏi
                            </div>
                          )}
                        </div>
                      </div>
                    );
                  })}
                </div>
              </div>
            ))}
          </div>
        </div>
      </div>
    </div>
  );
}
