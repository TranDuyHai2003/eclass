import { formatInTimeZone } from "date-fns-tz";
import { parseSolutionAnchors } from "@/lib/pdf-question-anchors";
import { ReopenAttemptButton } from "./ReopenAttemptButton";
import { ResultReview } from "./ResultReview";
import { FillViewport } from "@/components/layout/FillViewport";

// Server (Heroku) chạy giờ UTC → định dạng thời gian theo giờ Việt Nam
const VN_TZ = "Asia/Ho_Chi_Minh";

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
    // Chiếm đúng phần còn lại của màn hình (dưới banner demo nếu có) → không cuộn hai lớp
    <FillViewport className="flex flex-col bg-[#E2EEFF] overflow-hidden" fallbackClassName="h-dvh">
      {/* Màn chữa bài dùng toàn màn hình như màn làm bài: ẩn header chung của site */}
      <style dangerouslySetInnerHTML={{ __html: "header { display: none !important; }" }} />

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
        completedLabel={attempt.completedAt ? formatInTimeZone(attempt.completedAt, VN_TZ, "HH:mm dd/MM/yyyy") : null}
        backHref={backHref}
        title={title}
        startedLabel={formatInTimeZone(attempt.startedAt, VN_TZ, "dd/MM/yyyy")}
        headerAction={isTeacher && attempt.completedAt ? <ReopenAttemptButton key="reopen" attemptId={attempt.id} /> : undefined}
        durationSeconds={
          attempt.completedAt
            ? Math.max(0, Math.floor((attempt.completedAt.getTime() - attempt.startedAt.getTime()) / 1000))
            : null
        }
      />
    </FillViewport>
  );
}
