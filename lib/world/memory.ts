/**
 * Trí nhớ & năng lực theo KC:
 * - FSRS (ts-fsrs) quyết định KHI NÀO ôn.
 * - Elo (Pelánek 2016) quyết định CÂU NÀO (độ khó vừa sức).
 * Thuần — không đụng DB.
 */
import { createEmptyCard, fsrs, generatorParameters, Rating, State, type Card, type Grade } from "ts-fsrs";

export { Rating, State };

/** Trạng thái trí nhớ lưu trong DB (WorldKnowledge) */
export interface MemoryState {
  stability: number;
  difficulty: number;
  reps: number;
  lapses: number;
  state: number;
  lastReview: Date | null;
  dueAt: Date | null;
  scheduledDays: number;
}

export const EMPTY_MEMORY: MemoryState = {
  stability: 0,
  difficulty: 0,
  reps: 0,
  lapses: 0,
  state: State.New,
  lastReview: null,
  dueAt: null,
  scheduledDays: 0,
};

/** Mục tiêu ghi nhớ: tăng dần khi gần ngày thi (0,85 → 0,92) */
export function desiredRetention(now: Date, examDate: Date | null): number {
  if (!examDate) return 0.9;
  const days = (examDate.getTime() - now.getTime()) / 86400000;
  if (days <= 30) return 0.92;
  if (days <= 120) return 0.9;
  return 0.85;
}

function scheduler(retention: number) {
  return fsrs(generatorParameters({ enable_fuzz: false, enable_short_term: false, request_retention: retention }));
}

function toCard(m: MemoryState, now: Date): Card {
  if (m.reps === 0 || !m.lastReview) return createEmptyCard(now);
  return {
    due: m.dueAt ?? now,
    stability: m.stability,
    difficulty: m.difficulty,
    elapsed_days: 0,
    scheduled_days: m.scheduledDays,
    learning_steps: 0,
    reps: m.reps,
    lapses: m.lapses,
    state: m.state as State,
    last_review: m.lastReview,
  } as Card;
}

/**
 * Đổi kết quả thành điểm FSRS:
 * sai → Again; đúng nhưng dùng gợi ý / rất chậm / Phần II chưa trọn → Hard;
 * đúng → Good; đúng + nhanh + tự tin cao → Easy.
 */
export function fsrsGrade(r: {
  correct: boolean;
  score: number;
  hints: number;
  responseMs: number | null;
  confidence: number | null;
  expectedMs: number;
}): Grade {
  if (!r.correct && r.score < 0.5) return Rating.Again;
  if (!r.correct) return Rating.Hard; // TF4 đúng 3/4
  if (r.hints > 0) return Rating.Hard;
  const ms = r.responseMs ?? r.expectedMs;
  if (ms > r.expectedMs * 2.5) return Rating.Hard;
  if (r.confidence === 3 && ms < r.expectedMs * 0.6) return Rating.Easy;
  return Rating.Good;
}

/** Cập nhật trí nhớ sau một lần làm */
export function review(m: MemoryState, grade: Grade, now: Date, retention = 0.9): MemoryState {
  const f = scheduler(retention);
  const { card } = f.next(toCard(m, now), now, grade);
  return {
    stability: card.stability,
    difficulty: card.difficulty,
    reps: card.reps,
    lapses: card.lapses,
    state: card.state,
    lastReview: now,
    dueAt: card.due,
    scheduledDays: card.scheduled_days,
  };
}

/** Xác suất còn nhớ R ∈ [0, 1] tại thời điểm now (chưa học → 0) */
export function retrievability(m: MemoryState, now: Date): number {
  if (m.reps === 0 || !m.lastReview) return 0;
  const f = scheduler(0.9);
  return f.retrievability(toCard(m, now), now);
}

export type CreatureState = "wild" | "tamed" | "fading" | "feral";

/**
 * Sinh vật Hồi âm:
 * wild = chưa thuần hoá (chưa phát hiện) · tamed = nhớ tốt · fading = R < 0,95 · feral = đến hạn hoặc R < 0,9
 */
export function creatureState(m: MemoryState | null, tamed: boolean, now: Date): CreatureState {
  if (!tamed || !m || m.reps === 0) return "wild";
  const R = retrievability(m, now);
  if ((m.dueAt && m.dueAt <= now) || R < 0.9) return "feral";
  if (R < 0.95) return "fading";
  return "tamed";
}

// ───────────── Elo ─────────────

export const eloP = (theta: number, d: number) => 1 / (1 + Math.exp(-(theta - d)));
/** K giảm dần theo số lần cập nhật: a / (1 + b·n) */
export const eloK = (n: number, a = 1, b = 0.05) => a / (1 + b * n);

/** Cập nhật năng lực học sinh (theta) và độ khó câu (d) sau một kết quả r ∈ [0, 1] */
export function eloUpdate(theta: number, thetaN: number, d: number, dN: number, r: number) {
  const p = eloP(theta, d);
  return {
    theta: theta + eloK(thetaN) * (r - p),
    d: d - eloK(dN) * (r - p),
    p,
  };
}

/** Chọn họ câu có xác suất đúng gần target nhất (luyện 0,75; ôn 0,85) */
export function pickByElo<T extends { difficulty: number }>(items: T[], theta: number, target: number, rand = Math.random): T {
  if (items.length === 0) throw new Error("Không có câu để chọn");
  const scored = items.map((it) => ({ it, gap: Math.abs(eloP(theta, it.difficulty) - target) }));
  scored.sort((a, b) => a.gap - b.gap);
  // Ngẫu nhiên trong nhóm gần nhất (lệch ≤ 0,08) để đa dạng
  const best = scored.filter((s) => s.gap <= scored[0].gap + 0.08);
  return best[Math.floor(rand() * best.length)].it;
}
