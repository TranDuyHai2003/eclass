/**
 * Chứa các hàm helper phục vụ việc chấm điểm bài thi
 */

/**
 * Chuẩn hóa đáp án (cho câu hỏi điền khuyết)
 * - Xóa khoảng trắng thừa ở hai đầu
 * - Chuyển về chữ thường
 * - Có thể mở rộng thêm logic xử lý dấu câu hoặc ký tự đặc biệt nếu cần
 */
export function normalizeAnswer(answer: string | null | undefined): string {
  if (!answer) return "";
  if (answer.startsWith("http://") || answer.startsWith("https://")) {
    try {
      answer = decodeURIComponent(new URL(answer).pathname.split("/").pop() || answer);
    } catch {
      answer = decodeURIComponent(answer.split("/").pop() || answer);
    }
  }
  return answer.trim().toLowerCase();
}

/**
 * So sánh hai đáp án
 */
export function compareAnswers(provided: string, correct: string): boolean {
  return normalizeAnswer(provided) === normalizeAnswer(correct);
}

/**
 * Tính tổng điểm dựa trên danh sách câu trả lời và ma trận câu hỏi
 */
export function calculateScore(
  studentAnswers: { questionId: string; answerProvided: string }[],
  questions: any[]
): { totalScore: number; results: any[] } {
  let totalScore = 0;
  
  const questionMap = new Map(questions.map(q => [q.id, q]));
  
  const results = studentAnswers.map(ans => {
    const q = questionMap.get(ans.questionId);
    let isCorrect = false;
    let pointsAwarded = 0;
    
    if (q) {
      if (q.type === 'MULTIPLE_CHOICE' || q.type === 'TRUE_FALSE') {
        const providedNorm = normalizeAnswer(ans.answerProvided);
        const expectedOptions = (q.correctAnswer || "").split('|').map((s: string) => normalizeAnswer(s));
        const providedParts = providedNorm.split(',').map((s: string) => s.trim()).filter(Boolean);
        const providedSorted = [...providedParts].sort().join(',');

        isCorrect = expectedOptions.some((opt: string) => {
          const optParts = opt.split(',').map((s: string) => s.trim()).filter(Boolean);
          const optSorted = [...optParts].sort().join(',');
          if (providedSorted === optSorted) return true;
          if (providedParts.length > 0 && providedParts.every((p: string) => optParts.includes(p))) return true;
          return false;
        });
      } else if (q.type === 'SHORT_ANSWER') {
        isCorrect = compareAnswers(ans.answerProvided, q.correctAnswer);
      } else if (q.type === 'ESSAY') {
        // ESSAY needs manual grading, so we return null as "pending"
        return {
          questionId: ans.questionId,
          answerProvided: ans.answerProvided,
          isCorrect: null,
          pointsAwarded: 0
        };
      }
      
      if (isCorrect) {
        pointsAwarded = q.points;
        totalScore += pointsAwarded;
      }
    }
    
    return {
      questionId: ans.questionId,
      answerProvided: ans.answerProvided,
      isCorrect,
      pointsAwarded
    };
  });
  
  return { totalScore: Math.round(totalScore * 100) / 100, results };
}
