import { auth } from "@/auth";
import { prisma } from "@/lib/prisma";
import { notFound, redirect } from "next/navigation";
import {
  ArrowLeft,
  CheckCircle2,
  XCircle,
  Clock,
  Trophy,
  Info,
  Headphones,
  Video,
} from "lucide-react";
import Link from "next/link";
import { Button } from "@/components/ui/button";
import { Separator } from "@/components/ui/separator";
import { cn } from "@/lib/utils";
import { format } from "date-fns";
import { vi } from "date-fns/locale";
import { PDFViewerClientWrapper } from "@/components/course/PDFViewerClientWrapper";

export default async function TestResultPage({
  params,
}: {
  params: Promise<{ lessonId: string; attemptId: string }>;
}) {
  const session = await auth();
  if (!session?.user) return redirect("/login");

  const { lessonId, attemptId } = await params;

  // 1. Fetch Attempt with full details
  const attempt = await prisma.studentAttempt.findUnique({
    where: { id: attemptId },
    include: {
      user: true,
      test: {
        include: {
          sections: {
            include: {
              questions: {
                orderBy: { position: "asc" },
              },
            },
            orderBy: { position: "asc" },
          },
        },
      },
      answers: true,
    },
  });

  if (!attempt) return notFound();

  // Security check: Only the student or teacher/admin can view
  const isOwner = attempt.userId === session.user.id;
  const isTeacher =
    session.user.role === "ADMIN" || session.user.role === "TEACHER";
  if (!isOwner && !isTeacher) return redirect("/");

  const test = attempt.test;

  // 2. Map answers for quick lookup
  const answerMap = new Map(attempt.answers.map((a) => [a.questionId, a]));

  // 3. Calculate stats
  let totalQuestions = 0;
  let correctCount = 0;
  test.sections.forEach((s) => {
    totalQuestions += s.questions.length;
    s.questions.forEach((q) => {
      const ans = answerMap.get(q.id);
      if (ans?.isCorrect) correctCount++;
    });
  });

  const durationInSeconds = attempt.completedAt
    ? Math.floor(
        (attempt.completedAt.getTime() - attempt.startedAt.getTime()) / 1000,
      )
    : 0;
  const minutes = Math.floor(durationInSeconds / 60);
  const seconds = durationInSeconds % 60;

  return (
    <div className="h-screen flex flex-col bg-white overflow-hidden">
      {/* Result Header */}
      <header className="h-16 px-6 border-b flex items-center justify-between shrink-0 bg-white z-[60] shadow-sm">
        <div className="flex items-center gap-4">
          <Button variant="ghost" size="icon" asChild className="rounded-xl">
            <Link href={`/watch/${lessonId}`}>
              <ArrowLeft className="w-5 h-5" />
            </Link>
          </Button>
          <div className="min-w-0">
            <h2 className="font-black text-slate-900 truncate max-w-[300px]">
              Kết quả: {test.pdfUrl.split("/").pop()}
            </h2>
            <p className="text-[10px] font-black uppercase text-slate-400 tracking-widest">
              Lượt làm bài ngày{" "}
              {format(attempt.startedAt, "dd/MM/yyyy", { locale: vi })}
            </p>
          </div>
        </div>

        <div className="flex items-center gap-6">
          <div className="flex items-center gap-2">
            <Clock className="w-4 h-4 text-slate-400" />
            <span className="text-sm font-bold text-slate-600">
              {minutes} phút {seconds} giây
            </span>
          </div>
          <Separator orientation="vertical" className="h-6" />
          <div className="flex items-center gap-2">
            <Trophy className="w-5 h-5 text-yellow-500" />
            <span className="text-xl font-black text-blue-600">
              {attempt.score?.toFixed(1)} / 10
            </span>
          </div>
        </div>
      </header>

      {/* Main Split Body */}
      <div className="flex-1 flex overflow-hidden">
        {/* Left: PDF View */}
        <div className="w-1/2 border-r bg-slate-100">
          <PDFViewerClientWrapper url={test.pdfUrl} />
        </div>

        {/* Right: Answer Key & Student Answers */}
        <div className="w-1/2 flex flex-col bg-white overflow-hidden">
          <div className="h-12 px-6 border-b flex items-center justify-between bg-slate-50/50 shrink-0">
            <span className="text-[10px] font-black uppercase tracking-widest text-slate-500">
              Đối chiếu đáp án
            </span>
            <div className="flex gap-4 text-[10px] font-black uppercase tracking-widest">
              <span className="text-emerald-600">Đúng: {correctCount}</span>
              <span className="text-red-500">Sai: {totalQuestions - correctCount}</span>
            </div>
          </div>

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

            {test.sections.map((section, sIdx) => (
              <div key={section.id} className="space-y-4">
                <h3 className="font-black text-slate-900 uppercase tracking-tight text-sm flex items-center gap-2">
                  <div className="w-6 h-6 rounded bg-slate-900 text-white flex items-center justify-center text-[10px]">
                    {sIdx + 1}
                  </div>
                  {section.name}
                </h3>

                <div className="grid grid-cols-1 gap-6">
                  {section.questions.map((q, qIdx: number) => {
                    const studentAns = answerMap.get(q.id);
                    const isCorrect = studentAns?.isCorrect;

                    return (
                      <div key={q.id} className="space-y-3">
                        <div
                          className={cn(
                            "flex items-center gap-4 p-4 rounded-[20px] border transition-all",
                            isCorrect
                              ? "bg-emerald-50/50 border-emerald-100"
                              : "bg-red-50/50 border-red-100",
                          )}
                        >
                          <div className="w-8 text-center text-xs font-black text-slate-400">
                            #{qIdx + 1}
                          </div>

                          <div className="flex-1 flex items-center gap-8">
                            <div className="space-y-0.5">
                              <p className="text-[9px] font-black uppercase text-slate-400 tracking-widest">
                                Đáp án của bạn
                              </p>
                              <p
                                className={cn(
                                  "font-black text-lg",
                                  isCorrect ? "text-emerald-600" : "text-red-600",
                                )}
                              >
                                {studentAns?.answerProvided || "Bỏ trống"}
                              </p>
                            </div>

                            {!isCorrect && (
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
                            {isCorrect ? (
                              <CheckCircle2 className="w-6 h-6 text-emerald-500" />
                            ) : (
                              <XCircle className="w-6 h-6 text-red-500" />
                            )}
                          </div>
                        </div>

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
                                  <p className="whitespace-pre-wrap">{q.explanation}</p>
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
        </div>
      </div>
    </div>
  );
}

