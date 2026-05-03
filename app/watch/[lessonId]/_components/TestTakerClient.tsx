"use client";

import { useState, useEffect, useTransition } from "react";
import dynamic from "next/dynamic";
import { toast } from "sonner";
import { ArrowLeft, Clock, Send, AlertTriangle, Flag } from "lucide-react";
import { useRouter } from "next/navigation";
import { startTestAttempt, submitTestAttempt } from "@/actions/test";
import { useCountdown } from "@/hooks/use-countdown";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { cn } from "@/lib/utils";

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

  // answers map: questionId -> string
  const [answers, setAnswers] = useState<Record<string, string>>({});
  const [flags, setFlags] = useState<Record<string, boolean>>({});

  useEffect(() => {
    // 1. Fetch or create attempt
    startTestAttempt(test.id).then((res) => {
      if (res.success && res.attempt) {
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
  }, [test.id]);

  // Target time based on startedAt + duration
  const targetDate = startedAt
    ? new Date(startedAt.getTime() + test.duration * 60000)
    : null;
  const timeLeft = useCountdown(targetDate);

  // Set isTimeUp khi countdown chạy xong (startedAt đã có = đang làm bài thực sự)
  useEffect(() => {
    if (startedAt && timeLeft.isFinished && !isTimeUp) {
      setIsTimeUp(true);
    }
  }, [timeLeft.isFinished, startedAt]);

  // Auto-submit khi isTimeUp được set
  useEffect(() => {
    if (isTimeUp && attemptId && !isPending) {
      toast.error("Đã hết thời gian làm bài. Hệ thống đang tự động nộp bài...");
      handleSubmit();
    }
  }, [isTimeUp, attemptId]);

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

  const handleSubmit = () => {
    if (!attemptId) return;

    // Check if fully answered? We just warn if missing.
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
          // Use custom resultsPath if provided, otherwise default lesson results
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
  };

  if (loadingInitial) {
    return (
      <div className="flex h-screen items-center justify-center">
        Đang khởi tạo bài thi...
      </div>
    );
  }

  return (
    <div className="flex h-screen flex-col bg-gray-50 overflow-y-auto custom-scrollbar">
      {/* Header */}
      <div className="sticky top-0 z-40 flex items-center justify-between border-b bg-white px-6 shadow-sm shrink-0 h-16">
        <div className="flex items-center gap-4">
          <Button
            variant="ghost"
            size="icon"
            onClick={() => router.push(backPath || `/courses/${course.id}`)}
          >
            <ArrowLeft className="h-5 w-5" />
          </Button>
          <div>
            <h1 className="font-bold text-gray-900 leading-none">{lesson.title}</h1>
            <p className="text-[10px] text-gray-500 mt-1">{course.title}</p>
          </div>
        </div>

        <div className="flex items-center gap-6">
          {/* Timer */}
          <div className="flex items-center gap-2 bg-red-50 text-red-600 px-4 py-2 rounded-lg font-mono font-bold border border-red-200">
            <Clock className="w-4 h-4" />
            {!startedAt || loadingInitial
              ? "--:--:--"
              : isTimeUp
                ? "00:00:00"
                : `${String(timeLeft.hours).padStart(2, "0")}:${String(timeLeft.minutes).padStart(2, "0")}:${String(timeLeft.seconds).padStart(2, "0")}`}
          </div>

          <Button
            onClick={handleSubmit}
            disabled={isPending || (timeLeft.isFinished && isPending)}
            className="gap-2 bg-blue-600 hover:bg-blue-700"
          >
            <Send className="h-4 w-4" />
            {isPending ? "Đang nộp..." : "Nộp bài"}
          </Button>
        </div>
      </div>

      {/* Main Split */}
      <div className="flex flex-1 relative">
        {/* Left: PDF */}
        <div className="min-w-0 w-2/3 lg:w-[70%] border-r relative bg-gray-50">
          {test.pdfUrl ? (
            <div className="min-h-full">
              <PDFViewer url={test.pdfUrl} noScroll flat />
            </div>
          ) : (
            <div className="flex items-center justify-center h-full">
              Đề thi chưa có file PDF.
            </div>
          )}
        </div>

        {/* Right: Bubble Sheet */}
        <div className="min-w-0 w-1/3 lg:w-[30%] bg-white flex flex-col sticky top-16 h-[calc(100vh-64px)] overflow-hidden z-20">
          <div className="h-12 border-b border-slate-200 bg-white flex items-center justify-center font-black text-slate-800 shadow-sm shrink-0 uppercase tracking-widest text-[10px]">
            PHIẾU TRẢ LỜI
          </div>

          <div className="flex-1 overflow-y-auto p-4 space-y-6 custom-scrollbar">
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
                          {q.type === "MULTIPLE_CHOICE" && (
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

                          {q.type === "SHORT_ANSWER" && (
                            <Input
                              value={val}
                              onChange={(e) =>
                                handleSelectAnswer(q.id, e.target.value)
                              }
                              placeholder="Nhập đáp án..."
                              className="h-10 text-sm bg-white border-slate-200 focus:ring-blue-500 rounded-xl"
                            />
                          )}

                          {q.type === "ESSAY" && (
                            <div className="text-xs text-orange-500 font-bold flex items-center gap-1.5 py-2">
                              <AlertTriangle className="w-3.5 h-3.5" />
                              Tự luận: Làm ra giấy
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
