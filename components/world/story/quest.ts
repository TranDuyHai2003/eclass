"use client";
/**
 * Quest + dialogue state (persisted per browser). Gameplay code reports events through questEvent();
 * the active quest advances, pays rewards, unlocks Archive (codex) entries and starts the next quest
 * (opening its intro dialogue). NPC talks route through talkTo().
 */
import { create } from "zustand";
import { allQuests, DIALOGUES, NPCS, type CodexId, type NpcId, type Quest } from "@/lib/world/story";
import { addMat, type MatId } from "../combat/items";
import { sfx } from "@/lib/world/sfx";
import { useWorld } from "../store";

export type QuestEvent = { type: "kill"; kind: string } | { type: "cast"; mult: number } | { type: "collect"; n: number } | { type: "enter"; scene: string } | { type: "talk"; npc: NpcId };

interface QuestState {
  qi: number;
  progress: number;
  codex: CodexId[];
  seenIntro: string[];
  /** Mục Thư khố mới chưa đọc */
  freshCodex: CodexId[];
  /** Thông báo hoàn thành nhiệm vụ (hiệu ứng banner) */
  done: { title: string; at: number } | null;
  /** Ghi chép thực địa mới (quy luật quái vừa khám phá) */
  note?: { id: CodexId; at: number } | null;
}
const KEY = "world.quest.v1";
const START: QuestState = { qi: 0, progress: 0, codex: [], seenIntro: [], freshCodex: [], done: null };

export const useQuest = create<QuestState>(() => START);
let loaded = false;
export function initQuest() {
  if (loaded || typeof window === "undefined") return;
  loaded = true;
  try {
    const raw = localStorage.getItem(KEY);
    if (raw) useQuest.setState({ ...START, ...(JSON.parse(raw) as Partial<QuestState>), done: null });
  } catch {}
  useQuest.subscribe((s) => {
    try {
      const { done: _d, ...rest } = s;
      void _d;
      localStorage.setItem(KEY, JSON.stringify(rest));
    } catch {}
  });
}

export function currentQuest(): Quest | null {
  return allQuests()[useQuest.getState().qi] ?? null;
}

// ───────────── Hội thoại ─────────────

export const useDialogue = create<{ id: string | null; i: number; onDone: (() => void) | null }>(() => ({ id: null, i: 0, onDone: null }));
export function openDialogue(id: string, onDone?: () => void) {
  if (!DIALOGUES[id]) return;
  useDialogue.setState({ id, i: 0, onDone: onDone ?? null });
}
export function advanceDialogue() {
  const d = useDialogue.getState();
  if (!d.id) return;
  if (d.i + 1 < DIALOGUES[d.id].length) {
    useDialogue.setState({ i: d.i + 1 });
    sfx.click();
    return;
  }
  const done = d.onDone;
  closedAt = performance.now();
  useDialogue.setState({ id: null, i: 0, onDone: null });
  done?.();
}

/** Bắt chuyện với NPC: đúng mục tiêu nhiệm vụ thì kể chuyện chính, không thì gợi ý nhiệm vụ hiện tại */
let closedAt = -1e9;
let babelTalks = 0;
export function talkTo(npc: NpcId) {
  if (useDialogue.getState().id || performance.now() - closedAt < 400) return;
  // Thủ thư Babel: lần đầu kể về Thư viện, các lần sau là những suy ngẫm (và mở trang Thư khố)
  if (npc === "zeno") {
    openDialogue("paradox_intro", () => unlockNote("paradoxes"));
    return;
  }
  if (npc === "lan") {
    openDialogue("croom_intro", () => useWorld.setState({ overlay: "croom" }));
    return;
  }
  if (npc === "demon") {
    openDialogue("maxwell_intro", () => useWorld.setState({ overlay: "maxwell" }));
    return;
  }
  if (npc === "shipwright") {
    openDialogue("theseus_intro", () => useWorld.setState({ overlay: "theseus" }));
    return;
  }
  if (npc === "host") {
    openDialogue("monty_intro", () => useWorld.setState({ overlay: "monty" }));
    return;
  }
  if (npc === "plato") {
    openDialogue("cave_intro", () => useWorld.setState({ overlay: "cave" }));
    return;
  }
  if (npc === "concierge") {
    openDialogue("hilbert_intro", () => {
      unlockNote("hilbert");
      useWorld.setState({ overlay: "hilbert" });
    });
    return;
  }
  if (npc === "librarian") {
    openDialogue(babelTalks++ === 0 ? "babel_intro" : "babel_more", () => unlockNote("babel"));
    return;
  }
  const q = currentQuest();
  if (q && q.obj.type === "talk" && q.obj.npc === npc) {
    openDialogue(q.obj.dialogue, () => questEvent({ type: "talk", npc }));
    return;
  }
  if (q?.intro) openDialogue(q.intro);
  else openDialogue(npc === "diep" ? "sigil" : "intro");
}

export function npcName(npc: NpcId, lang: "en" | "vi") {
  return NPCS[npc].name[lang];
}

// ───────────── Tiến trình ─────────────

export function questEvent(ev: QuestEvent) {
  const s = useQuest.getState();
  const q = allQuests()[s.qi];
  if (!q) return;
  const o = q.obj;
  let add = 0;
  if (o.type === "kill" && ev.type === "kill" && (o.kind === "any" || o.kind === ev.kind)) add = 1;
  else if (o.type === "cast" && ev.type === "cast" && ev.mult >= o.minMult) add = 1;
  else if (o.type === "collect" && ev.type === "collect") add = ev.n;
  else if (o.type === "enter" && ev.type === "enter" && ev.scene === o.scene) add = 1;
  else if (o.type === "talk" && ev.type === "talk" && ev.npc === o.npc) add = 1;
  if (!add) return;
  const need = o.type === "kill" || o.type === "cast" || o.type === "collect" ? o.n : 1;
  const progress = s.progress + add;
  if (progress < need) {
    useQuest.setState({ progress });
    return;
  }
  // Hoàn thành: trao thưởng, mở Thư khố, chuyển nhiệm vụ sau
  for (const [id, n] of q.reward.mats ?? []) addMat(id as MatId, n);
  const newCodex = (q.reward.codex ?? []).filter((c) => !s.codex.includes(c));
  useQuest.setState({
    qi: s.qi + 1,
    progress: 0,
    codex: [...s.codex, ...newCodex],
    freshCodex: [...s.freshCodex, ...newCodex],
    done: { title: q.id, at: performance.now() },
  });
  sfx.chime(4);
  const next = allQuests()[s.qi + 1];
  if (next?.intro && !useQuest.getState().seenIntro.includes(next.id)) {
    window.setTimeout(() => {
      useQuest.setState((st) => ({ seenIntro: [...st.seenIntro, next.id] }));
      openDialogue(next.intro!);
    }, 2200);
  }
}

export function questProgress(): { have: number; need: number } {
  const q = currentQuest();
  if (!q) return { have: 0, need: 0 };
  const o = q.obj;
  return { have: useQuest.getState().progress, need: o.type === "kill" || o.type === "cast" || o.type === "collect" ? o.n : 1 };
}

/** Khám phá quy luật của quái → mở trang Thư khố (Ghi chép thực địa) + thông báo nhỏ */
export function unlockNote(id: CodexId) {
  const s = useQuest.getState();
  if (s.codex.includes(id)) return;
  useQuest.setState({ codex: [...s.codex, id], freshCodex: [...s.freshCodex, id], note: { id, at: performance.now() } });
  sfx.chime(2);
}
