/**
 * Thế giới Toán — tầng dữ liệu (Prisma). Server actions gọi vào đây sau khi đã kiểm tra đăng nhập / demo.
 * Nguyên tắc: đáp án không bao giờ rời server trước khi nộp; mỗi câu nộp đúng một lần.
 * PLAN: docs/ai-reviews/game-3d/PLAN.md
 */
import { prisma } from "@/lib/prisma";
import { randomSeed } from "./rng";
import { FAMILY_BY_ID, generate, practiceFamilies, type Format, type PublicPrompt } from "./generators";
import { grade, parseShort, revealAnswer, type Answer } from "./grading";
import { DISCOVERIES, DISCOVERY_IDS, KCS, KC_IDS, MISCONCEPTIONS, type DiscoveryId, type KcId } from "./kcs";
import { DISCOVERY_REVEALS } from "./reveals";
import { DEFAULT_LANG, isLang, tr, type Lang } from "./i18n";
import {
  EMPTY_MEMORY,
  Rating,
  creatureState,
  desiredRetention,
  eloUpdate,
  fsrsGrade,
  pickByElo,
  retrievability,
  review,
  type CreatureState,
  type MemoryState,
} from "./memory";

export const CHALLENGE_TTL_MS = 2 * 60 * 60 * 1000;
export const DAILY_CHALLENGE_LIMIT = 300;
const EXPECTED_MS: Record<Format, number> = { MCQ: 45000, TF4: 150000, SHORT: 100000, ANCHOR: 60000, MULTI: 45000 };
const STAGE_ORDER = ["hunch", "confirmed", "explained", "mastered"] as const;
type Stage = (typeof STAGE_ORDER)[number];
const stageAtLeast = (s: string | null | undefined, min: Stage) => !!s && STAGE_ORDER.indexOf(s as Stage) >= STAGE_ORDER.indexOf(min);

export class WorldError extends Error {}
/** Lỗi song ngữ */
const err = (lang: Lang, en: string, vi: string) => new WorldError(lang === "vi" ? vi : en);

type KnowledgeRow = Awaited<ReturnType<typeof prisma.worldKnowledge.findMany>>[number];

function toMemory(k: KnowledgeRow | null | undefined): MemoryState {
  if (!k) return EMPTY_MEMORY;
  return {
    stability: k.stability,
    difficulty: k.difficulty,
    reps: k.reps,
    lapses: k.lapses,
    state: k.state,
    lastReview: k.lastReview,
    dueAt: k.dueAt,
    scheduledDays: k.scheduledDays,
  };
}

const memoryFields = (m: MemoryState) => ({
  stability: m.stability,
  difficulty: m.difficulty,
  reps: m.reps,
  lapses: m.lapses,
  state: m.state,
  scheduledDays: m.scheduledDays,
  lastReview: m.lastReview,
  dueAt: m.dueAt,
});

// ───────────── Đọc trạng thái ─────────────

export interface CreatureView {
  kc: KcId;
  name: string;
  creature: string;
  color: string;
  state: CreatureState;
  /** Xác suất còn nhớ (0..1) */
  recall: number;
  dueAt: string | null;
}

export interface DiscoveryView {
  id: DiscoveryId;
  stage: Stage | null;
  prediction: string | null;
  explanation: string | null;
  /** Chỉ có khi đã xác nhận */
  title?: string;
  statement?: string;
  unlocked: boolean;
}

export interface WorldState {
  discoveries: DiscoveryView[];
  creatures: CreatureView[];
  abilities: string[];
  dueCount: number;
}

export async function getWorldState(userId: string, now = new Date(), lang: Lang = DEFAULT_LANG): Promise<WorldState> {
  const [discRows, knowRows] = await Promise.all([
    prisma.worldDiscovery.findMany({ where: { userId } }),
    prisma.worldKnowledge.findMany({ where: { userId } }),
  ]);
  const disc = new Map(discRows.map((d) => [d.discoveryId, d]));
  const know = new Map(knowRows.map((k) => [k.kc, k]));

  const discoveries: DiscoveryView[] = DISCOVERY_IDS.map((id) => {
    const row = disc.get(id);
    const def = DISCOVERIES[id];
    const confirmed = stageAtLeast(row?.stage, "confirmed");
    return {
      id,
      stage: (row?.stage as Stage) ?? null,
      prediction: row?.prediction ?? null,
      explanation: row?.explanation ?? null,
      unlocked: def.requires.every((r) => stageAtLeast(disc.get(r)?.stage, "confirmed")),
      ...(confirmed ? { title: tr(lang, DISCOVERY_REVEALS[id].title), statement: tr(lang, DISCOVERY_REVEALS[id].statement) } : {}),
    };
  });

  const creatures: CreatureView[] = KC_IDS.map((kc) => {
    const row = know.get(kc);
    const m = toMemory(row);
    const tamed = !!row?.tamedAt;
    return {
      kc,
      name: tr(lang, KCS[kc].name),
      creature: tr(lang, KCS[kc].creature),
      color: KCS[kc].color,
      state: creatureState(m, tamed, now),
      recall: tamed ? retrievability(m, now) : 0,
      dueAt: row?.dueAt?.toISOString() ?? null,
    };
  });

  return {
    discoveries,
    creatures,
    abilities: discoveries.filter((d) => stageAtLeast(d.stage, "confirmed")).map((d) => DISCOVERIES[d.id].ability.id),
    dueCount: creatures.filter((c) => c.state === "feral").length,
  };
}

// ───────────── Dự đoán & giải thích (Bảo tàng) ─────────────

export async function recordPrediction(userId: string, discoveryId: DiscoveryId, predictionId: string, lang: Lang = DEFAULT_LANG) {
  const def = DISCOVERIES[discoveryId];
  if (!def) throw err(lang, "Unknown discovery.", "Phát hiện không tồn tại.");
  if (!def.predictOptions.some((o) => o.id === predictionId)) throw err(lang, "Invalid prediction.", "Dự đoán không hợp lệ.");
  const row = await prisma.worldDiscovery.findUnique({ where: { userId_discoveryId: { userId, discoveryId } } });
  // Giữ dự đoán ĐẦU TIÊN (bảo tàng ghi lại suy nghĩ ban đầu)
  if (row?.prediction) return row;
  return prisma.worldDiscovery.upsert({
    where: { userId_discoveryId: { userId, discoveryId } },
    create: { userId, discoveryId, stage: "hunch", prediction: predictionId },
    update: { prediction: predictionId },
  });
}

export async function saveExplanation(userId: string, discoveryId: DiscoveryId, text: string, lang: Lang = DEFAULT_LANG) {
  const t = String(text ?? "").trim();
  if (t.length < 5 || t.length > 500) throw err(lang, "Explanations must be 5–500 characters.", "Lời giải thích dài 5–500 ký tự.");
  const row = await prisma.worldDiscovery.findUnique({ where: { userId_discoveryId: { userId, discoveryId } } });
  if (!stageAtLeast(row?.stage, "confirmed")) throw err(lang, "Confirm the discovery first.", "Hãy xác nhận phát hiện trước.");
  return prisma.worldDiscovery.update({
    where: { userId_discoveryId: { userId, discoveryId } },
    data: { explanation: t, stage: stageAtLeast(row!.stage, "explained") ? row!.stage : "explained" },
  });
}

// ───────────── Phát câu hỏi ─────────────

export type ChallengeRequest =
  | { mode: "discovery"; discoveryId: DiscoveryId }
  | { mode: "practice"; kc: KcId }
  | { mode: "review"; kc?: KcId };

export interface IssuedChallenge {
  challengeId: string;
  context: "discovery" | "practice" | "review";
  kc: KcId;
  prompt: PublicPrompt;
  discoveryId?: DiscoveryId;
}

async function familyDifficulty(familyIds: string[]) {
  const rows = await prisma.worldItemStat.findMany({ where: { familyId: { in: familyIds } } });
  const byId = new Map(rows.map((r) => [r.familyId, r]));
  return familyIds.map((id) => ({ id, difficulty: byId.get(id)?.difficulty ?? FAMILY_BY_ID[id].elo0, n: byId.get(id)?.n ?? 0 }));
}

export async function requestChallenge(userId: string, req: ChallengeRequest, now = new Date(), lang: Lang = DEFAULT_LANG): Promise<IssuedChallenge> {
  const dayAgo = new Date(now.getTime() - 86400000);
  const recent = await prisma.worldChallenge.count({ where: { userId, issuedAt: { gte: dayAgo } } });
  if (recent >= DAILY_CHALLENGE_LIMIT) throw err(lang, "You've practised a lot today — take a break and come back tomorrow!", "Hôm nay em đã luyện rất nhiều rồi — nghỉ ngơi và quay lại ngày mai nhé!");

  let familyId: string;
  let kc: KcId;
  let discoveryId: DiscoveryId | undefined;

  if (req.mode === "discovery") {
    const def = DISCOVERIES[req.discoveryId];
    if (!def) throw err(lang, "Unknown discovery.", "Phát hiện không tồn tại.");
    const confirmed = await prisma.worldDiscovery.findMany({ where: { userId, discoveryId: { in: def.requires } } });
    if (!def.requires.every((r) => confirmed.some((c) => c.discoveryId === r && stageAtLeast(c.stage, "confirmed")))) {
      throw err(lang, "This discovery is still locked — explore the previous one first.", "Phát hiện này chưa mở — hãy khám phá điều trước đó.");
    }
    familyId = def.checkFamily;
    kc = FAMILY_BY_ID[familyId].kc;
    discoveryId = req.discoveryId;
  } else {
    const know = await prisma.worldKnowledge.findMany({ where: { userId, tamedAt: { not: null } } });
    if (know.length === 0) throw err(lang, "You haven't tamed any creature yet — explore the Function Valley first.", "Em chưa thuần hoá sinh vật nào — hãy vào Thung lũng Hàm số khám phá trước.");
    let row: KnowledgeRow | undefined;
    if (req.mode === "practice") {
      if (!KC_IDS.includes(req.kc)) throw err(lang, "Unknown skill.", "Kiến thức không tồn tại.");
      row = know.find((k) => k.kc === req.kc);
      if (!row) throw err(lang, "This creature hasn't been tamed yet.", "Sinh vật này chưa được thuần hoá.");
    } else if (req.kc) {
      // Thuần hoá một sinh vật cụ thể
      row = know.find((k) => k.kc === req.kc);
      if (!row) throw err(lang, "This creature hasn't been tamed yet.", "Sinh vật này chưa được thuần hoá.");
    } else {
      // Ôn: ưu tiên KC đến hạn sớm nhất; xen kẽ — tránh lặp KC vừa làm nếu còn lựa chọn
      const last = await prisma.worldChallenge.findFirst({ where: { userId, context: "review" }, orderBy: { issuedAt: "desc" }, select: { kc: true } });
      const scored = know
        .map((k) => ({ k, r: retrievability(toMemory(k), now), due: k.dueAt?.getTime() ?? 0 }))
        .sort((a, b) => a.due - b.due || a.r - b.r);
      const pick = scored.find((s) => s.k.kc !== last?.kc && s.due <= now.getTime()) ?? scored.find((s) => s.due <= now.getTime()) ?? scored[0];
      row = pick.k;
    }
    kc = row.kc as KcId;
    const fams = await familyDifficulty(practiceFamilies(kc).map((x) => x.id));
    familyId = pickByElo(fams, row.theta, req.mode === "review" ? 0.85 : 0.75).id;
  }

  const seed = randomSeed();
  const g = generate(familyId, seed, lang);
  const ch = await prisma.worldChallenge.create({
    data: { userId, familyId, kc, seed, lang, context: req.mode, discoveryId: discoveryId ?? null, issuedAt: now },
  });
  // CHỈ gửi prompt — không key / explanation / meta
  return { challengeId: ch.id, context: req.mode, kc, prompt: g.prompt, ...(discoveryId ? { discoveryId } : {}) };
}

// ───────────── Nộp bài ─────────────

export interface SubmitInput {
  challengeId: string;
  answer: Answer;
  confidence?: number | null;
  hints?: number;
  responseMs?: number | null;
}

export interface SubmitResult {
  correct: boolean;
  score: number;
  perStatement?: boolean[];
  misconception: { id: string; name: string; fix: string } | null;
  explanation: string;
  reveal: unknown;
  creature?: CreatureView;
  discovery?: { id: DiscoveryId; title: string; statement: string; ability: { id: string; name: string; desc: string } };
}

export async function submitChallenge(userId: string, input: SubmitInput, now = new Date()): Promise<SubmitResult> {
  const ch = await prisma.worldChallenge.findUnique({ where: { id: String(input.challengeId) } });
  const lang: Lang = ch && isLang(ch.lang) ? ch.lang : DEFAULT_LANG;
  if (!ch || ch.userId !== userId) throw err(lang, "Question not found.", "Không tìm thấy câu hỏi.");
  if (ch.answeredAt) throw err(lang, "This question was already submitted.", "Câu này đã nộp rồi.");
  if (now.getTime() - ch.issuedAt.getTime() > CHALLENGE_TTL_MS) throw err(lang, "This question has expired — get a new one.", "Câu hỏi đã hết hạn — hãy lấy câu mới.");

  // Lỗi định dạng (vd đáp số > 4 ký tự) → báo lại, KHÔNG tính lượt
  if (input.answer?.kind === "SHORT") {
    const p = parseShort(input.answer.text, 4, lang);
    if (p.value === null) throw new WorldError(p.error ?? "Invalid answer.");
  }

  const g = generate(ch.familyId, ch.seed, lang);
  const r = grade(g.key, input.answer, lang);
  if (r.formatError) throw new WorldError(r.formatError);
  const confidence = input.confidence != null ? Math.max(1, Math.min(3, Math.round(Number(input.confidence)))) : null;
  const hints = Math.max(0, Math.min(10, Math.round(Number(input.hints ?? 0))));
  const responseMs = input.responseMs != null ? Math.max(0, Math.min(3600000, Math.round(Number(input.responseMs)))) : null;

  return prisma.$transaction(async (tx) => {
    // Giành quyền nộp (chống bấm 2 lần / 2 tab)
    const claimed = await tx.worldChallenge.updateMany({
      where: { id: ch.id, userId, answeredAt: null },
      data: {
        answeredAt: now,
        correct: r.correct,
        score: r.score,
        confidence,
        hints,
        responseMs,
        misconception: r.misconception,
        answer: input.answer as object,
      },
    });
    if (claimed.count === 0) throw err(lang, "This question was already submitted.", "Câu này đã nộp rồi.");

    const kc = ch.kc as KcId;
    const result: SubmitResult = {
      correct: r.correct,
      score: r.score,
      perStatement: r.perStatement,
      misconception:
        r.misconception && MISCONCEPTIONS[r.misconception]
          ? { id: r.misconception, name: tr(lang, MISCONCEPTIONS[r.misconception].name), fix: tr(lang, MISCONCEPTIONS[r.misconception].fix) }
          : null,
      explanation: g.explanation,
      reveal: revealAnswer(g.key),
    };

    if (ch.context === "discovery") {
      const id = ch.discoveryId as DiscoveryId;
      const def = DISCOVERIES[id];
      if (r.correct && def) {
        const row = await tx.worldDiscovery.findUnique({ where: { userId_discoveryId: { userId, discoveryId: id } } });
        if (!stageAtLeast(row?.stage, "confirmed")) {
          await tx.worldDiscovery.upsert({
            where: { userId_discoveryId: { userId, discoveryId: id } },
            create: { userId, discoveryId: id, stage: "confirmed", confirmedAt: now },
            update: { stage: "confirmed", confirmedAt: now },
          });
        }
        // Thuần hoá các KC liên quan: lần xác nhận = lần ôn đầu tiên
        for (const k of def.kcs) {
          const existing = await tx.worldKnowledge.findUnique({ where: { userId_kc: { userId, kc: k } } });
          if (existing?.tamedAt) continue;
          const m = review(EMPTY_MEMORY, Rating.Good, now);
          await tx.worldKnowledge.upsert({
            where: { userId_kc: { userId, kc: k } },
            create: { userId, kc: k, tamedAt: now, ...memoryFields(m) },
            update: { tamedAt: now, ...memoryFields(m) },
          });
        }
        result.discovery = {
          id,
          title: tr(lang, DISCOVERY_REVEALS[id].title),
          statement: tr(lang, DISCOVERY_REVEALS[id].statement),
          ability: { id: def.ability.id, name: tr(lang, def.ability.name), desc: tr(lang, def.ability.desc) },
        };
      }
      return result;
    }

    // Luyện / ôn: cập nhật FSRS + Elo (khoá dòng KC để không ghi đè khi nộp song song)
    await tx.$queryRaw`SELECT 1 FROM "WorldKnowledge" WHERE "userId" = ${userId} AND "kc" = ${kc} FOR UPDATE`;
    const row = await tx.worldKnowledge.findUnique({ where: { userId_kc: { userId, kc } } });
    if (!row?.tamedAt) return result;
    const rating = fsrsGrade({
      correct: r.correct,
      score: r.score,
      hints,
      responseMs,
      confidence,
      expectedMs: EXPECTED_MS[g.prompt.format],
    });
    let m = review(toMemory(row), rating, now, desiredRetention(now, null));
    // Sai khi rất tự tin → ưu tiên ôn lại sớm (hiệu ứng siêu sửa lỗi)
    if (!r.correct && confidence === 3) m = { ...m, dueAt: now };
    const stat = await tx.worldItemStat.findUnique({ where: { familyId: ch.familyId } });
    const d0 = stat?.difficulty ?? FAMILY_BY_ID[ch.familyId].elo0;
    const elo = eloUpdate(row.theta, row.eloN, d0, stat?.n ?? 0, r.score);
    const updated = await tx.worldKnowledge.update({
      where: { userId_kc: { userId, kc } },
      data: { ...memoryFields(m), theta: elo.theta, eloN: row.eloN + 1 },
    });
    await tx.worldItemStat.upsert({
      where: { familyId: ch.familyId },
      create: { familyId: ch.familyId, difficulty: elo.d, n: 1 },
      update: { difficulty: elo.d, n: { increment: 1 } },
    });

    // Thành thạo: mọi KC của một phát hiện đã vững (≥ 3 lần ôn, độ bền ≥ 10 ngày)
    for (const def of Object.values(DISCOVERIES)) {
      if (!def.kcs.includes(kc)) continue;
      const ks = await tx.worldKnowledge.findMany({ where: { userId, kc: { in: def.kcs } } });
      const solid = def.kcs.every((k) => {
        const x = ks.find((y) => y.kc === k);
        return x && x.reps >= 3 && x.stability >= 10;
      });
      if (solid) {
        await tx.worldDiscovery.updateMany({ where: { userId, discoveryId: def.id, stage: { in: ["confirmed", "explained"] } }, data: { stage: "mastered" } });
      }
    }

    const um = toMemory(updated);
    result.creature = {
      kc,
      name: tr(lang, KCS[kc].name),
      creature: tr(lang, KCS[kc].creature),
      color: KCS[kc].color,
      state: creatureState(um, true, now),
      recall: retrievability(um, now),
      dueAt: um.dueAt?.toISOString() ?? null,
    };
    return result;
  });
}
