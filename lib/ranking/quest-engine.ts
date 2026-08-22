export interface QuestDefinition {
  id: number;
  title: string;
  description: string;
  type: "COMPLETED_TESTS" | "AVG_SCORE" | "TOP_PERCENTILE";
  targetValue: number; // e.g. 3 tests, 5 tests, 8.0 score, top 10%
  unlockedRank: string;
}

export interface EvaluatedQuestItem {
  id: number;
  title: string;
  description: string;
  supremacyText: string; // e.g., "Top 10% toàn khóa" or "Cần hoàn thành 5 bài"
  topText: string;
  rankText: string;
  scoreText: string;
  improvementText: string | null;
  status: "COMPLETED" | "IN_PROGRESS" | "LOCKED";
  progressPercent: number;
  isCurrent: boolean;
}

export interface QuestEngineOutput {
  quests: EvaluatedQuestItem[];
  currentQuestTitle: string;
  completedQuestsCount: number;
  totalQuestsCount: number;
}

export interface UserMetricsForQuests {
  completedTests: number;
  avgScore: number;
  rank: number | null;
  totalEligibleStudents: number;
}

// Business configuration for Ascension Quests
export const DEFAULT_QUEST_DEFINITIONS: QuestDefinition[] = [
  {
    id: 1,
    title: "QUEST 01: KHỞI ĐỘNG CHINH PHỤC",
    description: "Hoàn thành tối thiểu 3 bài kiểm tra đầu tiên",
    type: "COMPLETED_TESTS",
    targetValue: 3,
    unlockedRank: "B",
  },
  {
    id: 2,
    title: "QUEST 02: GIA NHẬP BẢNG VÀNG",
    description: "Đạt điều kiện xếp hạng chính thức (≥ 5 bài kiểm tra)",
    type: "COMPLETED_TESTS",
    targetValue: 5,
    unlockedRank: "B",
  },
  {
    id: 3,
    title: "QUEST 03: VỮNG VÀNG THÔNG THÁI",
    description: "Đạt Điểm Trung Bình từ 8.0 điểm trở lên",
    type: "AVG_SCORE",
    targetValue: 8.0,
    unlockedRank: "A",
  },
  {
    id: 4,
    title: "QUEST 04: ĐỈNH CAO BẢNG XẾP HẠNG",
    description: "Vào Top 10% học sinh xuất sắc nhất",
    type: "TOP_PERCENTILE",
    targetValue: 10, // Top 10%
    unlockedRank: "S",
  },
];

/**
 * Evaluate student performance dynamically against business Quest definitions
 */
export function evaluateQuestEngine(
  userMetrics: UserMetricsForQuests,
  questDefinitions: QuestDefinition[] = DEFAULT_QUEST_DEFINITIONS
): QuestEngineOutput {
  const { completedTests, avgScore, rank, totalEligibleStudents } = userMetrics;

  const topPercentile = (rank && totalEligibleStudents > 0)
    ? Math.max(1, Math.ceil((rank / totalEligibleStudents) * 100))
    : 100;

  let currentQuestIdx = 0;

  const quests: EvaluatedQuestItem[] = questDefinitions.map((q, idx) => {
    let isCompleted = false;
    let progressPercent = 0;
    let supremacyText = "";
    let scoreText = "";

    switch (q.type) {
      case "COMPLETED_TESTS": {
        isCompleted = completedTests >= q.targetValue;
        progressPercent = Math.min(100, Math.round((completedTests / q.targetValue) * 100));
        supremacyText = isCompleted
          ? `Đã làm ${completedTests}/${q.targetValue} bài`
          : `Đang làm ${completedTests}/${q.targetValue} bài`;
        scoreText = `${completedTests} bài`;
        break;
      }
      case "AVG_SCORE": {
        isCompleted = completedTests >= 5 && avgScore >= q.targetValue;
        progressPercent = completedTests === 0 ? 0 : Math.min(100, Math.round((avgScore / q.targetValue) * 100));
        supremacyText = `ĐTB: ${avgScore.toFixed(1)} / ${q.targetValue.toFixed(1)}đ`;
        scoreText = `${avgScore.toFixed(1)}đ`;
        break;
      }
      case "TOP_PERCENTILE": {
        isCompleted = rank !== null && topPercentile <= q.targetValue;
        progressPercent = isCompleted ? 100 : rank !== null ? Math.max(10, 100 - topPercentile) : 0;
        supremacyText = rank !== null ? `Top ${topPercentile}% toàn khóa` : "Chưa có xếp hạng";
        scoreText = rank !== null ? `Top ${topPercentile}%` : "Chưa đạt";
        break;
      }
    }

    let status: "COMPLETED" | "IN_PROGRESS" | "LOCKED" = "LOCKED";
    if (isCompleted) {
      status = "COMPLETED";
    } else if (idx === 0 || (idx > 0 && completedTests >= 1)) {
      status = "IN_PROGRESS";
      currentQuestIdx = idx;
    }

    return {
      id: q.id,
      title: q.title,
      description: q.description,
      supremacyText,
      topText: supremacyText,
      rankText: `RANK ${q.unlockedRank}`,
      scoreText,
      improvementText: null, // No fake "+15% POWER" strings
      status,
      progressPercent,
      isCurrent: false, // Set below
    };
  });

  // Mark active current quest
  if (quests.length > 0) {
    const activeIdx = quests.findIndex((q) => q.status === "IN_PROGRESS");
    if (activeIdx !== -1) {
      quests[activeIdx].isCurrent = true;
    } else {
      // If all completed, last quest is current
      quests[quests.length - 1].isCurrent = true;
    }
  }

  const completedQuestsCount = quests.filter((q) => q.status === "COMPLETED").length;

  return {
    quests,
    currentQuestTitle: quests[currentQuestIdx]?.title || "CHINH PHỤC QUEST",
    completedQuestsCount,
    totalQuestsCount: quests.length,
  };
}
