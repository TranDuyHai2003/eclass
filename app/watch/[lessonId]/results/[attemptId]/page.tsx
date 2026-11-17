import { auth } from "@/auth";
import { notFound, redirect } from "next/navigation";

export const dynamic = "force-dynamic";
import { ArrowLeft } from "lucide-react";
import Link from "next/link";
import { Button } from "@/components/ui/button";
import { format } from "date-fns";
import { vi } from "date-fns/locale";
import { getAttemptStatistics } from "@/actions/analytics";
import { ReopenAttemptButton } from "./_components/ReopenAttemptButton";
import { ResultReview } from "./_components/ResultReview";
import { parseSolutionAnchors } from "@/lib/pdf-question-anchors";

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

  return (
    <div className="h-[100dvh] flex flex-col bg-[#E2EEFF] overflow-hidden">
      {/* Result Header */}
      <header className="h-16 px-3 md:px-6 border-b flex items-center justify-between gap-3 shrink-0 bg-white z-40 shadow-sm">
        <div className="flex items-center gap-2 md:gap-4 min-w-0 flex-1">
          <Button variant="ghost" size="icon" asChild className="rounded-xl">
            <Link href={`/watch/${lessonId}`}>
              <ArrowLeft className="w-5 h-5" />
            </Link>
          </Button>
          <div className="min-w-0">
            <h2 className="font-black text-slate-900 truncate md:max-w-[480px]">
              Kết quả: {test.pdfUrl ? test.pdfUrl.split("/").pop() : (test.title || "Bài kiểm tra")}
            </h2>
            <p className="text-[10px] font-black uppercase text-slate-400 tracking-widest">
              Lượt làm bài ngày{" "}
              {format(attempt.startedAt, "dd/MM/yyyy", { locale: vi })}
            </p>
          </div>
        </div>
        {isTeacher && attempt.completedAt && (
          <div className="flex items-center gap-2 shrink-0">
            <ReopenAttemptButton attemptId={attempt.id} />
          </div>
        )}
      </header>

      <ResultReview
        attemptId={attempt.id}
        testId={test.id}
        pdfUrl={test.pdfUrl}
        solutionPdfUrl={test.explanation?.trim() ? test.explanation : null}
        solutionAnchors={parseSolutionAnchors(test.solutionAnchors, test.explanation)}
        solutionVideos={solutionVideos.filter((v: any) => v?.url)}
        sections={test.sections}
        answers={attempt.answers}
        canSeeAnswers={test.showAnswers || isTeacher}
        isTeacher={isTeacher}
        score={Number(attempt.score || 0)}
        durationSeconds={
          attempt.completedAt
            ? Math.max(0, Math.floor((attempt.completedAt.getTime() - attempt.startedAt.getTime()) / 1000))
            : null
        }
      />
    </div>
  );
}
