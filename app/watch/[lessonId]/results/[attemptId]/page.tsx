import { auth } from "@/auth";
import { prisma } from "@/lib/prisma";
import { notFound, redirect } from "next/navigation";

export const dynamic = 'force-dynamic';
import {
  ArrowLeft,
  CheckCircle2,
  XCircle,
  Clock,
  Trophy,
  Info,
  Headphones,
  Video,
  FileText,
  Download,
  Image as ImageIcon,
  ExternalLink,
  MessageSquareText,
} from "lucide-react";
import Link from "next/link";
import { Button } from "@/components/ui/button";
import { Separator } from "@/components/ui/separator";
import { cn } from "@/lib/utils";
import { format } from "date-fns";
import { vi } from "date-fns/locale";
import { PDFViewerClientWrapper } from "@/components/course/PDFViewerClientWrapper";
import VideoPlayer from "@/components/player/VideoPlayer";
import { GradeEssay } from "@/components/teacher/test-builder/GradeEssay";
import { ReuploadForm } from "./_components/ReuploadForm";
import { getAttemptStatistics } from "@/actions/analytics";
import { ResultAnalytics } from "./_components/ResultAnalytics";
import { RecommendationList } from "./_components/RecommendationList";

export default async function TestResultPage({
  params,
}: {
  params: Promise<{ lessonId: string; attemptId: string }>;
}) {
  const session = await auth();
  if (!session?.user) return redirect("/login");

  const { lessonId, attemptId } = await params;

  // 1. Fetch Attempt with full details and analytics (Single query optimization)
  const analyticsData = await getAttemptStatistics(attemptId);
  const attempt = analyticsData.attempt;

  if (!attempt) return notFound();

  // Security check: Only the student or teacher/admin can view
  const isOwner = attempt.userId === session.user.id;
  const isTeacher =
    session.user.role === "ADMIN" || session.user.role === "TEACHER";
  if (!isOwner && !isTeacher) return redirect("/");

  const test = attempt.test;
  let solutionVideos = (test.solutionVideos as any[]) || [];
  
  // If no solutionVideos array, but test.videoUrl exists, use it
  if (solutionVideos.length === 0 && test.videoUrl) {
    solutionVideos = [{ title: "Video chữa bài", url: test.videoUrl }];
  }

  // Fetch the main lesson (lecture) video
  const lesson = await prisma.lesson.findUnique({
    where: { id: lessonId },
    select: { videoUrl: true, title: true }
  });

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
    <div className="h-screen flex flex-col bg-[#E2EEFF] overflow-hidden">
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
              {attempt.score?.toFixed(2)} / 10
            </span>
          </div>
        </div>
      </header>

      {/* Main Split Body */}
      <div className="flex-1 flex flex-col lg:flex-row overflow-hidden">
        {/* Left: PDF View */}
        <div className="w-full lg:w-1/2 h-[40vh] lg:h-full border-r bg-slate-100 shrink-0">
          <PDFViewerClientWrapper url={test.pdfUrl} />
        </div>

        {/* Right: Answer Key & Student Answers */}
        <div className="w-full lg:w-1/2 flex flex-col bg-white overflow-hidden">
          <div className="h-12 px-6 border-b flex items-center justify-between bg-slate-50/50 shrink-0">
            <span className="text-[10px] font-black uppercase tracking-widest text-slate-500">
              Đối chiếu đáp án & Video
            </span>
            <div className="flex gap-4 text-[10px] font-black uppercase tracking-widest">
              <span className="text-emerald-600">Đúng: {correctCount}</span>
              <span className="text-blue-500">Sai: {totalQuestions - correctCount}</span>
            </div>
          </div>

          <div className="flex-1 overflow-y-auto p-4 md:p-6 custom-scrollbar space-y-8 md:space-y-10">
            {test.showAnswers || isTeacher ? (
              <>
                {/* Solution Videos Section */}
                {solutionVideos.length > 0 && (
                  <div className="bg-white rounded-[24px] md:rounded-[32px] p-5 md:p-6 border border-slate-200 shadow-sm space-y-4">
                    <div className="flex items-center gap-3">
                      <div className="w-10 h-10 rounded-2xl bg-blue-600 flex items-center justify-center text-white shadow-lg shadow-blue-100">
                        <Video className="w-5 h-5" />
                      </div>
                      <h3 className="font-black text-slate-900 uppercase tracking-tight">
                        Video chữa bài chi tiết
                      </h3>
                    </div>

                    <div className="grid grid-cols-1 gap-6">
                      {solutionVideos.map((video: any, idx: number) => (
                        <div key={idx} className="space-y-3">
                          {solutionVideos.length > 1 && (
                            <h4 className="text-sm font-bold text-slate-700 flex items-center gap-2">
                              <span className="w-6 h-6 rounded-lg bg-slate-100 flex items-center justify-center text-[10px] font-black">
                                {idx + 1}
                              </span>
                              {video.title}
                            </h4>
                          )}
                          <div className="aspect-video w-full rounded-2xl overflow-hidden border border-slate-200 shadow-sm">
                            <VideoPlayer src={video.url} title={video.title} />
                          </div>
                        </div>
                      ))}
                    </div>
                  </div>
                )}
                {test.explanation && (
                  <div className="bg-blue-50/50 rounded-[24px] md:rounded-[32px] p-5 md:p-6 border border-blue-100 space-y-4">
                    <div className="flex items-center gap-3">
                      <div className="w-10 h-10 rounded-2xl bg-blue-600 flex items-center justify-center text-white shadow-lg shadow-blue-100">
                        <Info className="w-5 h-5" />
                      </div>
                      <h3 className="font-black text-slate-900 uppercase tracking-tight">
                        Lời giải toàn bài
                      </h3>
                    </div>

                    <div className="space-y-4">
                      <div className="text-xs font-bold text-slate-400 uppercase tracking-widest flex items-center gap-2">
                        <FileText className="w-3 h-3" /> Tài liệu lời giải chi tiết
                      </div>
                      <div className="h-[500px] border border-blue-100 rounded-2xl overflow-hidden bg-slate-100 shadow-inner">
                        <PDFViewerClientWrapper url={test.explanation} />
                      </div>
                      <a
                        href={test.explanation}
                        target="_blank"
                        className="flex items-center justify-center gap-2 w-full py-3 bg-white rounded-xl border border-blue-100 text-xs font-bold text-blue-600 hover:bg-blue-50 transition-colors shadow-sm"
                      >
                        <Download className="w-4 h-4" /> Tải về bản PDF lời giải
                      </a>
                    </div>
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

                    <div className="grid grid-cols-1 gap-4 md:gap-6">
                      {section.questions.map((q, qIdx: number) => {
                        const studentAns = answerMap.get(q.id);
                        const isCorrect = studentAns?.isCorrect;
                        const isPending = q.type === "ESSAY" && isCorrect === null;

                        return (
                          <div key={q.id} className="space-y-3">
                            <div
                              className={cn(
                                "flex items-center gap-3 md:gap-4 p-4 rounded-[20px] border transition-all",
                                isCorrect === true
                                  ? "bg-emerald-50/50 border-emerald-100"
                                  : isPending
                                    ? "bg-blue-50/50 border-blue-100"
                                    : "bg-blue-50/50 border-blue-100",
                              )}
                            >
                              <div className="w-6 md:w-8 text-center text-xs font-black text-slate-400">
                                #{qIdx + 1}
                              </div>

                              <div className="flex-1 flex items-center gap-4 md:gap-8">
                                <div className="space-y-0.5">
                                  <p className="text-[9px] font-black uppercase text-slate-400 tracking-widest">
                                    {q.type === "ESSAY" ? "Hình thức" : "Đáp án của bạn"}
                                  </p>
                                  <p
                                    className={cn(
                                      "font-black text-base md:text-lg",
                                      isCorrect === true ? "text-emerald-600" : isPending ? "text-blue-600" : "text-blue-600",
                                    )}
                                  >
                                    {q.type === "ESSAY" ? (
                                      studentAns?.answerProvided ? (
                                        <a href={studentAns.answerProvided} target="_blank" className="flex items-center gap-2 text-blue-600 hover:underline">
                                          <ImageIcon className="w-4 h-4" />
                                          <span>Xem bài làm</span>
                                          <ExternalLink className="w-3 h-3" />
                                        </a>
                                      ) : "Làm ra giấy"
                                    ) : (q.type as any) === "TRUE_FALSE" ? (
                                      studentAns?.answerProvided === "T" ? "Đúng" : studentAns?.answerProvided === "F" ? "Sai" : "Bỏ trống"
                                    ) : (studentAns?.answerProvided || "Bỏ trống")}
                                  </p>
                                </div>

                                {isCorrect === false && q.type !== "ESSAY" && (
                                  <div className="space-y-0.5">
                                    <p className="text-[9px] font-black uppercase text-slate-400 tracking-widest">
                                      Đáp án đúng
                                    </p>
                                    <p className="font-black text-base md:text-lg text-emerald-600">
                                      {(q.type as any) === "TRUE_FALSE" ? (q.correctAnswer === "T" ? "Đúng" : "Sai") : q.correctAnswer}
                                    </p>
                                  </div>
                                )}
                              </div>

                              <div className="shrink-0">
                                {isCorrect === true ? (
                                  <CheckCircle2 className="w-5 h-5 md:w-6 md:h-6 text-emerald-500" />
                                ) : isPending ? (
                                  <div className="w-5 h-5 md:w-6 md:h-6 rounded-full bg-blue-100 flex items-center justify-center">
                                     <Clock className="w-3.5 h-3.5 md:w-4 md:h-4 text-blue-600" />
                                  </div>
                                ) : (
                                  <XCircle className="w-5 h-5 md:w-6 md:h-6 text-blue-500" />
                                )}
                              </div>
                            </div>

                            {/* Teacher Grading UI */}
                            {isTeacher && q.type === "ESSAY" && studentAns && (
                              <GradeEssay 
                                answerId={studentAns.id}
                                initialPoints={studentAns.pointsAwarded}
                                maxPoints={q.points}
                                isCorrect={studentAns.isCorrect}
                                initialFeedback={studentAns.feedback}
                              />
                            )}

                            {/* Student: show teacher feedback + re-upload if rejected */}
                            {!isTeacher && q.type === "ESSAY" && isCorrect === false && studentAns && (
                              <div className="ml-9 md:ml-12 space-y-3">
                                {studentAns.feedback && (
                                  <div className="p-3 bg-orange-50 border border-orange-200 rounded-xl flex gap-2">
                                    <MessageSquareText className="w-4 h-4 text-orange-500 shrink-0 mt-0.5" />
                                    <div>
                                      <p className="text-[10px] font-black uppercase text-orange-600 tracking-wider mb-1">
                                        Góp ý của giảng viên
                                      </p>
                                      <p className="text-sm text-slate-700 whitespace-pre-wrap">
                                        {studentAns.feedback}
                                      </p>
                                    </div>
                                  </div>
                                )}
                                <ReuploadForm
                                  attemptId={attemptId}
                                  questionId={q.id}
                                />
                              </div>
                            )}

                            {(q.explanation || q.videoUrl || q.audioUrl) && (
                              <div className="ml-9 md:ml-12 space-y-3">
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

                {/* Recommendations Section - Hidden as requested */}
                {/* <RecommendationList recommendations={analyticsData.recommendations} /> */}
              </>
            ) : (
              <div className="flex flex-col items-center justify-center h-full p-12 text-center bg-slate-50/50">
                <Trophy className="w-16 h-16 text-yellow-400 mb-6" />
                <h2 className="text-2xl font-black text-slate-900 mb-2">
                  Đã nộp bài thành công!
                </h2>
                <p className="text-slate-500 max-w-[320px] font-medium leading-relaxed">
                  Giảng viên đã cài đặt ẩn đáp án chi tiết. Vui lòng liên hệ giảng
                  viên hoặc chờ thông báo để xem kết quả.
                </p>
                <Button
                  className="mt-8 rounded-2xl px-8 h-12 font-black bg-blue-600 hover:bg-blue-700 shadow-lg shadow-blue-100"
                  asChild
                >
                  <Link href={`/watch/${lessonId}`}>Quay lại bài học</Link>
                </Button>
              </div>
            )}
          </div>
        </div>
      </div>
    </div>
  );
}
