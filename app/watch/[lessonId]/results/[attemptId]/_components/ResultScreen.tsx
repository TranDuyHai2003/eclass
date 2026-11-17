import Link from "next/link";
import { ArrowLeft } from "lucide-react";
import { format } from "date-fns";
import { vi } from "date-fns/locale";
import { Button } from "@/components/ui/button";
import { parseSolutionAnchors } from "@/lib/pdf-question-anchors";
import { ReopenAttemptButton } from "./ReopenAttemptButton";
import { ResultReview } from "./ResultReview";

/**
 * Khung màn kết quả dùng chung cho bài kiểm tra theo bài học và bài kiểm tra cuối khoá.
 * `attempt` cần có: test (kèm sections → questions → subQuestions) và answers (kèm subAnswers).
 */
export function ResultScreen({
  attempt,
  backHref,
  fallbackTitle,
  isTeacher,
}: {
  attempt: any;
  backHref: string;
  fallbackTitle?: string | null;
  isTeacher: boolean;
}) {
  const test = attempt.test;

  let solutionVideos: { title?: string; url: string }[] = Array.isArray(test.solutionVideos) ? test.solutionVideos : [];
  if (solutionVideos.length === 0 && test.videoUrl) {
    solutionVideos = [{ title: "Video chữa bài", url: test.videoUrl }];
  }

  const title =
    test.title?.trim() || fallbackTitle?.trim() || (test.pdfUrl ? test.pdfUrl.split("/").pop() : "") || "Bài kiểm tra";

  // Bảo mật: ResultReview là client component — mọi prop đều nằm trong mã nguồn trang.
  // Chỉ gửi đáp án/lời giải/video khi giáo viên xem, hoặc học sinh đã nộp bài và đề cho phép xem đáp án.
  const canSeeAnswers = isTeacher || (!!test.showAnswers && !!attempt.completedAt);

  const sections = test.sections.map((s: any) => ({
    id: s.id,
    name: s.name,
    questions: s.questions.map((q: any) => ({
      id: q.id,
      type: q.type,
      points: q.points,
      correctAnswer: canSeeAnswers ? q.correctAnswer : null,
      explanation: canSeeAnswers ? q.explanation : null,
      videoUrl: canSeeAnswers ? q.videoUrl : null,
      audioUrl: canSeeAnswers ? q.audioUrl : null,
      subQuestions: (q.subQuestions || []).map((sq: any) => ({
        id: sq.id,
        position: sq.position,
        correctAnswer: canSeeAnswers ? sq.correctAnswer : "",
      })),
    })),
  }));

  // Chỉ các trường màn kết quả cần (không kèm question → không lộ đáp án qua câu trả lời)
  const answers = attempt.answers.map((a: any) => ({
    id: a.id,
    questionId: a.questionId,
    answerProvided: a.answerProvided,
    isCorrect: a.isCorrect,
    pointsAwarded: a.pointsAwarded,
    feedback: a.feedback,
    subAnswers: (a.subAnswers || []).map((sa: any) => ({
      subQuestionId: sa.subQuestionId,
      answerProvided: sa.answerProvided,
      isCorrect: sa.isCorrect,
    })),
  }));

  const solutionPdfUrl = canSeeAnswers && test.explanation?.trim() ? test.explanation : null;

  return (
    // Trừ chiều cao header của site (h-16 / sm:h-20 + viền 1px) để không phải cuộn hai lớp
    <div className="h-[calc(100dvh-4rem-1px)] sm:h-[calc(100dvh-5rem-1px)] flex flex-col bg-[#E2EEFF] overflow-hidden">
      <header className="h-16 px-3 md:px-6 border-b flex items-center justify-between gap-3 shrink-0 bg-white z-40 shadow-sm">
        <div className="flex items-center gap-2 md:gap-4 min-w-0 flex-1">
          <Button variant="ghost" size="icon" asChild className="rounded-xl shrink-0">
            <Link href={backHref} aria-label="Quay lại">
              <ArrowLeft className="w-5 h-5" />
            </Link>
          </Button>
          <div className="min-w-0">
            <h2 className="font-black text-slate-900 truncate md:max-w-[560px]" title={title}>
              Kết quả: {title}
            </h2>
            <p className="text-[10px] font-black uppercase text-slate-400 tracking-widest">
              Lượt làm bài ngày {format(attempt.startedAt, "dd/MM/yyyy", { locale: vi })}
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
        solutionPdfUrl={solutionPdfUrl}
        solutionAnchors={parseSolutionAnchors(test.solutionAnchors, solutionPdfUrl)}
        solutionVideos={canSeeAnswers ? solutionVideos.filter((v) => v?.url) : []}
        sections={sections}
        answers={answers}
        canSeeAnswers={canSeeAnswers}
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
