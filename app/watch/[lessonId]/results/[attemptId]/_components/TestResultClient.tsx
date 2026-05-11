"use client";

import dynamic from "next/dynamic";
import {
  ArrowLeft,
  CheckCircle2,
  XCircle,
  Clock,
  Award,
  Info,
  Video,
  Headphones,
} from "lucide-react";
import { useRouter } from "next/navigation";
import { Button } from "@/components/ui/button";
import { Progress } from "@/components/ui/progress";
import { cn } from "@/lib/utils";
import { GradeEssay } from "@/components/teacher/test-builder/GradeEssay";

const PDFViewer = dynamic(() => import("@/components/ui/pdf-viewer"), {
  ssr: false,
  loading: () => (
    <div className="flex h-full w-full items-center justify-center bg-gray-100 font-bold text-gray-400">
      Đang tải đề thi...
    </div>
  ),
});

export default function TestResultClient({ attempt, isTeacher = false }: { attempt: any, isTeacher?: boolean }) {
  const router = useRouter();
  const test = attempt.test;

  // Calculate stats
  let totalQuestions = 0;
  let correctAnswers = 0;
  let wrongAnswers = 0;
  let totalPoints = 0;

  const answerMap = new Map();
  attempt.answers.forEach((a: any) => {
    answerMap.set(a.questionId, a);
    if (a.isCorrect === true) correctAnswers++;
    if (a.isCorrect === false) wrongAnswers++;
  });

  test.sections.forEach((s: any) => {
    s.questions.forEach((q: any) => {
      totalQuestions++;
      totalPoints += q.points;
    });
  });

  const durationStr = attempt.completedAt
    ? Math.round(
        (new Date(attempt.completedAt).getTime() -
          new Date(attempt.startedAt).getTime()) /
          60000,
      )
    : 0;

  // Determine back path and title based on whether it's a course or lesson test
  const isCourseTest = !!test.courseId;
  const backPath = isCourseTest
    ? `/courses/${test.courseId}`
    : `/watch/${test.lessonId}`;
  const testTitle = isCourseTest
    ? `Kiểm tra cuối khóa: ${test.course?.title ?? ""}`
    : `Kết quả: ${test.lesson?.title ?? ""}`;

  return (
    <div className="flex h-full flex-col bg-white">
      {/* Header */}
      <header className="h-16 px-6 border-b flex items-center justify-between shrink-0 bg-white z-[60] shadow-sm">
        <div className="flex items-center gap-4">
          <Button
            variant="ghost"
            size="icon"
            onClick={() => router.push(backPath)}
            className="rounded-xl"
          >
            <ArrowLeft className="h-5 w-5" />
          </Button>
          <div className="min-w-0">
            <h1 className="font-black text-slate-900 truncate max-w-[400px]">
              {testTitle}
            </h1>
            <p className="text-[10px] font-black uppercase text-slate-400 tracking-widest">
              Nộp lúc:{" "}
              {attempt.completedAt
                ? new Date(attempt.completedAt).toLocaleString()
                : "Chưa nộp"}
            </p>
          </div>
        </div>

        <div className="flex items-center gap-6">
          <div className="flex items-center gap-2">
            <Clock className="w-4 h-4 text-slate-400" />
            <span className="text-sm font-bold text-slate-600">
              {durationStr} phút
            </span>
          </div>
          <div className="flex items-center gap-2">
            <Award className="w-5 h-5 text-yellow-500" />
            <span className="text-xl font-black text-blue-600">
              {attempt.score?.toFixed(1)} / 10
            </span>
          </div>
          <div className="flex gap-4 text-[10px] font-black uppercase tracking-widest border-l pl-6">
            <span className="text-emerald-600">Đúng: {correctAnswers}</span>
            <span className="text-red-500">Sai: {wrongAnswers}</span>
          </div>
        </div>
      </header>

      {/* Main Split */}
      <div className="flex flex-1 overflow-hidden">
        {/* Left: PDF */}
        <div className="w-1/2 border-r bg-slate-100">
          {test.pdfUrl ? (
            <PDFViewer url={test.pdfUrl} />
          ) : (
            <div className="flex items-center justify-center h-full text-slate-400 font-bold">
              Đề thi chưa có file PDF.
            </div>
          )}
        </div>

        {/* Right: Answer Key */}
        <div className="w-1/2 flex flex-col bg-white overflow-hidden">
          {test.showAnswers ? (
            <div className="flex-1 overflow-y-auto p-6 custom-scrollbar space-y-10">
              {/* Overall Explanation Section */}
              {(test.explanation || test.videoUrl || test.audioUrl) && (
                <div className="bg-blue-50/50 rounded-[32px] p-6 border border-blue-100 space-y-4">
                  <div className="flex items-center gap-3">
                    <div className="w-10 h-10 rounded-2xl bg-blue-600 flex items-center justify-center text-white shadow-lg shadow-blue-100">
                      <Info className="w-5 h-5" />
                    </div>
                    <h3 className="font-black text-slate-900 uppercase tracking-tight">
                      Lời giải toàn bài
                    </h3>
                  </div>

                  <div className="flex flex-wrap gap-3">
                    {test.videoUrl && (
                      <a
                        href={test.videoUrl}
                        target="_blank"
                        className="flex items-center gap-2 px-4 py-2 bg-white rounded-xl border border-blue-100 text-xs font-bold text-blue-600 hover:bg-blue-50 transition-colors"
                      >
                        <Video className="w-4 h-4" /> Xem Video lời giải
                      </a>
                    )}
                    {test.audioUrl && (
                      <a
                        href={test.audioUrl}
                        target="_blank"
                        className="flex items-center gap-2 px-4 py-2 bg-white rounded-xl border border-blue-100 text-xs font-bold text-blue-600 hover:bg-blue-50 transition-colors"
                      >
                        <Headphones className="w-4 h-4" /> Nghe Audio lời giải
                      </a>
                    )}
                  </div>

                  {test.explanation && (
                    <div className="text-sm text-slate-600 leading-relaxed font-medium whitespace-pre-wrap bg-white/50 p-4 rounded-2xl">
                      {test.explanation}
                    </div>
                  )}
                </div>
              )}

              {test.sections.map((section: any, sIdx: number) => (
                <div key={section.id} className="space-y-4">
                  <h3 className="font-black text-slate-900 uppercase tracking-tight text-sm flex items-center gap-2">
                    <div className="w-6 h-6 rounded bg-slate-900 text-white flex items-center justify-center text-[10px]">
                      {sIdx + 1}
                    </div>
                    {section.name}
                  </h3>
                  <div className="grid grid-cols-1 gap-6">
                    {section.questions.map((q: any, qIdx: number) => {
                      const ansRecord = answerMap.get(q.id);
                      const isCorrect = ansRecord?.isCorrect;
                      const isPending = q.type === "ESSAY" && isCorrect === null;
                      return (
                        <div key={q.id} className="space-y-3">
                          <div
                            className={cn(
                              "flex items-center gap-4 p-4 rounded-[20px] border transition-all",
                              isCorrect === true
                                ? "bg-emerald-50/50 border-emerald-100"
                                : isPending
                                  ? "bg-blue-50/50 border-blue-100"
                                  : "bg-red-50/50 border-red-100",
                            )}
                          >
                            <div className="w-8 text-center text-xs font-black text-slate-400">
                              #{qIdx + 1}
                            </div>

                            <div className="flex-1 flex items-center gap-8">
                              <div className="space-y-0.5">
                                <p className="text-[9px] font-black uppercase text-slate-400 tracking-widest">
                                  {q.type === "ESSAY" ? "Hình thức" : "Bạn chọn"}
                                </p>
                                <p
                                  className={cn(
                                    "font-black text-lg",
                                    isCorrect === true
                                      ? "text-emerald-600"
                                      : isPending
                                        ? "text-blue-600"
                                        : "text-red-600",
                                  )}
                                >
                                  {q.type === "ESSAY" ? "Làm ra giấy" : (ansRecord?.answerProvided || "Bỏ trống")}
                                </p>
                              </div>

                              {isCorrect === false && q.type !== "ESSAY" && (
                                <div className="space-y-0.5">
                                  <p className="text-[9px] font-black uppercase text-slate-400 tracking-widest">
                                    Đáp án đúng
                                  </p>
                                  <p className="font-black text-lg text-emerald-600">
                                    {q.correctAnswer}
                                  </p>
                                </div>
                              )}
                            </div>

                            <div className="shrink-0">
                              {isCorrect === true ? (
                                <CheckCircle2 className="w-6 h-6 text-emerald-500" />
                              ) : isPending ? (
                                <div className="w-6 h-6 rounded-full bg-blue-100 flex items-center justify-center">
                                   <Clock className="w-4 h-4 text-blue-600" />
                                </div>
                              ) : (
                                <XCircle className="w-6 h-6 text-red-500" />
                              )}
                            </div>
                          </div>

                          {/* Teacher Grading UI */}
                          {isTeacher && q.type === "ESSAY" && ansRecord && (
                            <GradeEssay 
                              answerId={ansRecord.id}
                              initialPoints={ansRecord.pointsAwarded}
                              maxPoints={q.points}
                              isCorrect={ansRecord.isCorrect}
                            />
                          )}

                          {(q.explanation || q.videoUrl || q.audioUrl) && (
                            <div className="ml-12 space-y-3">
                              <div className="flex flex-wrap gap-2">
                                {q.videoUrl && (
                                  <a
                                    href={q.videoUrl}
                                    target="_blank"
                                    className="flex items-center gap-1.5 px-3 py-1.5 bg-slate-50 rounded-lg border border-slate-100 text-[10px] font-black uppercase tracking-tight text-slate-500 hover:bg-blue-50 hover:text-blue-600 transition-colors"
                                  >
                                    <Video className="w-3 h-3" /> Video
                                  </a>
                                )}
                                {q.audioUrl && (
                                  <a
                                    href={q.audioUrl}
                                    target="_blank"
                                    className="flex items-center gap-1.5 px-3 py-1.5 bg-slate-50 rounded-lg border border-slate-100 text-[10px] font-black uppercase tracking-tight text-slate-500 hover:bg-blue-50 hover:text-blue-600 transition-colors"
                                  >
                                    <Headphones className="w-3 h-3" /> Audio
                                  </a>
                                )}
                              </div>
                              {q.explanation && (
                                <div className="p-4 bg-slate-50 rounded-2xl border border-slate-100 flex gap-3">
                                  <Info className="w-4 h-4 text-blue-500 shrink-0 mt-0.5" />
                                  <div className="text-sm text-slate-600">
                                    {q.type === "ESSAY" && (
                                      <p className="font-bold text-slate-900 mb-1">
                                        Câu hỏi tự luận:
                                      </p>
                                    )}
                                    <p className="whitespace-pre-wrap">
                                      {q.explanation}
                                    </p>
                                  </div>
                                </div>
                              )}
                            </div>
                          )}
                        </div>
                      );
                    })}
                  </div>
                </div>
              ))}
            </div>
          ) : (
            <div className="flex flex-col items-center justify-center h-full p-12 text-center bg-slate-50/50">
              <Award className="w-16 h-16 text-yellow-400 mb-6" />
              <h2 className="text-2xl font-black text-slate-900 mb-2">
                Đã nộp bài thành công!
              </h2>
              <p className="text-slate-500 max-w-[320px] font-medium leading-relaxed">
                Giảng viên đã cài đặt ẩn đáp án chi tiết. Vui lòng liên hệ giảng
                viên hoặc chờ thông báo để xem kết quả.
              </p>
              <Button
                className="mt-8 rounded-2xl px-8 h-12 font-black bg-blue-600 hover:bg-blue-700 shadow-lg shadow-blue-100"
                onClick={() => router.push(backPath)}
              >
                Quay lại
              </Button>
            </div>
          )}
        </div>
      </div>
    </div>
  );
}
