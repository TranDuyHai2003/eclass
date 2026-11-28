"use client";
/**
 * Quái "quy luật" mới (M1): trạng thái riêng từng con + cách chúng nhận đòn. Không import combat.ts (tránh vòng lặp
 * import) — combat.ts gọi ruleHit() trong damageEnemy; AI chạy theo khung hình nằm ở RuleMonsters.tsx.
 *  • ghoul  — Ma Tham Lam (lib/world/greedyGhoul.ts)
 *  • warden — Hộ Vệ Nguyên Tố (lib/world/primeWarden.ts)
 *  • crab   — Cua Chuông / bàn Galton (lib/world/galtonCrab.ts)
 */
import * as THREE from "three";
import { sfx } from "@/lib/world/sfx";
import { floatText } from "../ui/Labels";
import { unlockNote } from "../story/quest";
import { ghoulDamageMul } from "@/lib/world/greedyGhoul";
import { newWarden, wardenHit, type WardenState } from "@/lib/world/primeWarden";
import { crabDamageMul } from "@/lib/world/galtonCrab";

export type RuleKind = "ghoul" | "warden" | "crab";
export const RULE_KINDS = new Set<string>(["ghoul", "warden", "crab"]);
export function isRuleKind(k: string): k is RuleKind {
  return RULE_KINDS.has(k);
}

export interface GhoulState {
  /** ô hiện tại (tương đối tổ) */
  ci: number;
  cj: number;
  stuck: boolean;
  stuckAt: number;
  nextAt: number;
  /** đã báo "?" cho lần kẹt này chưa */
  told: boolean;
}
export interface CrabState {
  /** 0 rảnh · 1 báo trước · 2 đang thả sỏi */
  st: 0 | 1 | 2;
  t0: number;
  yaw0: number;
  lanes: number[];
  /** bán kính các máng (m) = khoảng cách tới người chơi lúc bắt đầu loạt */
  r: number;
  round: number;
  nextAt: number;
  landed: number;
  /** số sỏi đã rơi ở mỗi máng (vẽ thành cột → biểu đồ chuông) */
  stacks: number[];
  /** gốc của loạt (để sỏi đã rơi đứng yên khi cua bước đi) */
  ox: number;
  oz: number;
  doneAt: number;
}
export interface RuleState {
  ghoul?: GhoulState;
  warden?: WardenState;
  crab?: CrabState;
}

export function initRule(kind: string, seed: number): RuleState {
  const now = typeof performance !== "undefined" ? performance.now() : 0;
  if (kind === "ghoul") return { ghoul: { ci: 0, cj: 0, stuck: false, stuckAt: 0, nextAt: 0, told: false } };
  if (kind === "warden") return { warden: newWarden(Math.floor(seed * 7)) };
  if (kind === "crab") return { crab: { st: 0, t0: 0, yaw0: 0, lanes: [], r: 4, round: Math.floor(seed * 13), nextAt: now + 2500, landed: 0, stacks: new Array(9).fill(0), ox: 0, oz: 0, doneAt: -1e9 } };
  return {};
}

type HitTarget = { kind: string; pos: THREE.Vector3; yaw: number; hitAt: number; rule: RuleState };
const TMP = new THREE.Vector3();

/**
 * Hệ số sát thương theo quy luật (gọi trong damageEnemy trước khi trừ máu).
 * Trả về số âm khi đòn bị "nuốt" hoàn toàn (khiên nguyên tố đang đếm) — damageEnemy dừng lại ở đó.
 */
export function ruleHit(e: HitTarget, from: THREE.Vector3, now: number): number {
  const r = e.rule;
  if (e.kind === "ghoul" && r.ghoul) {
    const g = r.ghoul;
    if (g.stuck) {
      unlockNote("greedy");
      if (now - e.hitAt > 600) floatText(TMP.copy(e.pos).setY(e.pos.y + 2), "local min!", "info");
    } else if (now - e.hitAt > 600) floatText(TMP.copy(e.pos).setY(e.pos.y + 2), "greedy ⇥", "info");
    return ghoulDamageMul(g.stuck);
  }
  if (e.kind === "warden" && r.warden) {
    const s = r.warden;
    if (wardenHit(s, now) === "open") return 1.6;
    // khiên còn: đếm đòn, không gây sát thương
    e.hitAt = now;
    floatText(TMP.copy(e.pos).setY(e.pos.y + 2.3), `${s.count}`, "info");
    sfx.click();
    return -1;
  }
  if (e.kind === "crab" && r.crab) {
    const c = r.crab;
    const facing = c.st ? c.yaw0 : e.yaw;
    const rel = Math.atan2(from.x - e.pos.x, from.z - e.pos.z) - facing;
    const m = crabDamageMul(rel);
    if (m < 1) {
      if (now - e.hitAt > 400) floatText(TMP.copy(e.pos).setY(e.pos.y + 1.8), "shell", "info");
    } else if (c.st) unlockNote("galton");
    return m;
  }
  return 1;
}
