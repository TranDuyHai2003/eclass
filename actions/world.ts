"use server";

import { auth } from "@/auth";
import { demoGuard } from "@/lib/demo";
import type { DiscoveryId } from "@/lib/world/kcs";
import { DEFAULT_LANG, isLang, type Lang } from "@/lib/world/i18n";
import { realtimeUrl, signRealtimeToken } from "@/lib/world/rt-token";
import {
  WorldError,
  getWorldState,
  recordPrediction,
  requestChallenge,
  saveExplanation,
  submitChallenge,
  type ChallengeRequest,
  type IssuedChallenge,
  type SubmitInput,
  type SubmitResult,
  type WorldState,
} from "@/lib/world/service";

/**
 * Thế giới Toán 3D — server actions. Chấm hoàn toàn ở server; đáp án chỉ trả về sau khi nộp.
 * PLAN: docs/ai-reviews/game-3d/PLAN.md
 */
type Result<T> = ({ success: true } & T) | { success: false; error: string };

async function requireUser() {
  const session = await auth();
  return session?.user?.id ?? null;
}

async function run<T>(fn: (userId: string) => Promise<T>, write = true): Promise<Result<{ data: T }>> {
  if (write) {
    const blocked = await demoGuard();
    if (blocked) return blocked;
  }
  const userId = await requireUser();
  if (!userId) return { success: false, error: "Please sign in to enter the Math World. / Hãy đăng nhập để vào Thế giới Toán." };
  try {
    return { success: true, data: await fn(userId) };
  } catch (e) {
    if (e instanceof WorldError) return { success: false, error: e.message };
    console.error("[world]", e);
    return { success: false, error: "Something went wrong, please try again. / Có lỗi xảy ra, thử lại nhé." };
  }
}

const L = (lang: unknown): Lang => (isLang(lang) ? lang : DEFAULT_LANG);

export async function worldState(lang?: Lang): Promise<Result<{ data: WorldState }>> {
  return run((uid) => getWorldState(uid, new Date(), L(lang)), false);
}

/** Token ngắn hạn cho máy chủ realtime (chỉ ký, máy chủ realtime không đụng DB) */
export async function worldRealtimeToken(): Promise<Result<{ data: { url: string; token: string } | null }>> {
  const session = await auth();
  const u = session?.user;
  if (!u?.id) return { success: false, error: "auth" };
  const url = realtimeUrl();
  const token = signRealtimeToken({ uid: u.id, name: (u.name || "Player").split(" ").slice(-1)[0], demo: !!u.isDemo });
  return { success: true, data: url && token ? { url, token } : null };
}

export async function worldRequestChallenge(req: ChallengeRequest, lang?: Lang): Promise<Result<{ data: IssuedChallenge }>> {
  return run((uid) => requestChallenge(uid, req, new Date(), L(lang)));
}

export async function worldSubmit(input: SubmitInput): Promise<Result<{ data: SubmitResult }>> {
  return run((uid) => submitChallenge(uid, input));
}

export async function worldPredict(discoveryId: DiscoveryId, predictionId: string, lang?: Lang): Promise<Result<{ data: { ok: true } }>> {
  return run(async (uid) => {
    await recordPrediction(uid, discoveryId, predictionId, L(lang));
    return { ok: true as const };
  });
}

export async function worldExplain(discoveryId: DiscoveryId, text: string, lang?: Lang): Promise<Result<{ data: { ok: true } }>> {
  return run(async (uid) => {
    await saveExplanation(uid, discoveryId, text, L(lang));
    return { ok: true as const };
  });
}
