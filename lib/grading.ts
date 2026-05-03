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
      if (q.type === 'MULTIPLE_CHOICE') {
        isCorrect = ans.answerProvided.toUpperCase() === q.correctAnswer?.toUpperCase();
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
  
  return { totalScore, results };
}
