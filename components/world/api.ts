"use client";
import { createContext, useContext } from "react";
import type { ChallengeRequest, IssuedChallenge, SubmitInput, SubmitResult, WorldState } from "@/lib/world/service";
import type { DiscoveryId } from "@/lib/world/kcs";
import type { Lang } from "@/lib/world/i18n";

export type Res<T> = ({ success: true } & { data: T }) | { success: false; error: string };

/** Server gateway: the real page passes server actions; the dev preview passes an in-browser simulation */
export interface WorldApi {
  state(lang?: Lang): Promise<Res<WorldState>>;
  request(req: ChallengeRequest, lang?: Lang): Promise<Res<IssuedChallenge>>;
  submit(input: SubmitInput): Promise<Res<SubmitResult>>;
  predict(id: DiscoveryId, predictionId: string, lang?: Lang): Promise<Res<{ ok: true }>>;
  explain(id: DiscoveryId, text: string, lang?: Lang): Promise<Res<{ ok: true }>>;
  /** Địa chỉ + token máy chủ realtime (null nếu chưa cấu hình) */
  realtime?(): Promise<Res<{ url: string; token: string } | null>>;
}

export const WorldApiContext = createContext<WorldApi | null>(null);
export function useApi(): WorldApi {
  const a = useContext(WorldApiContext);
  if (!a) throw new Error("Missing WorldApiContext");
  return a;
}
