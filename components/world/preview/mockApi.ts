"use client";
/**
 * DEV ONLY — in-browser simulation of lib/world/service for /world/preview (no DB, no login).
 * Mirrors the real rules (seeded generation, grading, FSRS) so the visuals can be tested end to end.
 */
import { FAMILY_BY_ID, generate, practiceFamilies } from "@/lib/world/generators";
import { grade, parseShort, revealAnswer } from "@/lib/world/grading";
import { DISCOVERIES, DISCOVERY_IDS, KCS, KC_IDS, MISCONCEPTIONS, type DiscoveryId, type KcId } from "@/lib/world/kcs";
import { EMPTY_MEMORY, Rating, creatureState, fsrsGrade, retrievability, review, type MemoryState } from "@/lib/world/memory";
import { tr, type Lang } from "@/lib/world/i18n";
import type { WorldApi } from "../api";
import type { SubmitResult, WorldState } from "@/lib/world/service";

// Bản xem thử: tên định lý lấy từ reveals (dev — không quan trọng việc lộ trong bundle)
import { DISCOVERY_REVEALS } from "@/lib/world/reveals";

interface Mem {
  disc: Record<string, { stage: string; prediction?: string; explanation?: string }>;
  know: Record<string, MemoryState & { tamed: boolean }>;
  ch: Record<string, { familyId: string; seed: number; kc: KcId; context: string; discoveryId?: DiscoveryId; lang: Lang; answered?: boolean }>;
}

const DAY = 86400000;

export function createMockApi(preset: "fresh" | "demo"): { api: WorldApi; initial: WorldState } {
  const m: Mem = { disc: {}, know: {}, ch: {} };
  if (preset === "demo") {
    // Đã khám phá điều 1; hai sinh vật đang hoang dã để thử trận thuần hoá
    m.disc.D_STILLPOINT = { stage: "confirmed", prediction: "flat" };
    const past = new Date(Date.now() - 9 * DAY);
    for (const kc of ["kc.extremum_value", "kc.cubic_shape"] as KcId[]) m.know[kc] = { ...review(EMPTY_MEMORY, Rating.Good, past), tamed: true };
  }
  const state = (lang: Lang = "en"): WorldState => {
    const now = new Date();
    const discoveries = DISCOVERY_IDS.map((id) => {
      const row = m.disc[id];
      const confirmed = !!row && row.stage !== "hunch";
      return {
        id,
        stage: (row?.stage as "hunch") ?? null,
        prediction: row?.prediction ?? null,
        explanation: row?.explanation ?? null,
        unlocked: DISCOVERIES[id].requires.every((r) => m.disc[r] && m.disc[r].stage !== "hunch"),
        ...(confirmed ? { title: tr(lang, DISCOVERY_REVEALS[id].title), statement: tr(lang, DISCOVERY_REVEALS[id].statement) } : {}),
      };
    });
    const creatures = KC_IDS.map((kc) => {
      const k = m.know[kc];
      return {
        kc,
        name: tr(lang, KCS[kc].name),
        creature: tr(lang, KCS[kc].creature),
        color: KCS[kc].color,
        state: creatureState(k ?? null, !!k?.tamed, now),
        recall: k?.tamed ? retrievability(k, now) : 0,
        dueAt: k?.dueAt?.toISOString() ?? null,
      };
    });
    return {
      discoveries,
      creatures,
      abilities: discoveries.filter((d) => d.stage && d.stage !== "hunch").map((d) => DISCOVERIES[d.id].ability.id),
      dueCount: creatures.filter((c) => c.state === "feral").length,
    };
  };
  const ok = <T,>(data: T) => ({ success: true as const, data });
  const fail = (error: string) => ({ success: false as const, error });
  let n = 0;

  const api: WorldApi = {
    async state(lang) {
      return ok(state(lang));
    },
    async request(req, lang = "en") {
      let familyId: string;
      let kc: KcId;
      let discoveryId: DiscoveryId | undefined;
      if (req.mode === "discovery") {
        familyId = DISCOVERIES[req.discoveryId].checkFamily;
        kc = FAMILY_BY_ID[familyId].kc;
        discoveryId = req.discoveryId;
      } else {
        const target = req.mode === "practice" || req.kc ? req.kc! : (KC_IDS.find((k) => m.know[k]?.tamed) as KcId);
        if (!target || !m.know[target]?.tamed) return fail("Not tamed yet");
        kc = target;
        const fams = practiceFamilies(kc);
        familyId = fams[Math.floor(Math.random() * fams.length)].id;
      }
      const seed = Math.floor(Math.random() * 1e9);
      const id = `mock-${++n}`;
      m.ch[id] = { familyId, seed, kc, context: req.mode, discoveryId, lang };
      return ok({ challengeId: id, context: req.mode, kc, prompt: generate(familyId, seed, lang).prompt, ...(discoveryId ? { discoveryId } : {}) });
    },
    async submit(input) {
      const ch = m.ch[input.challengeId];
      if (!ch || ch.answered) return fail("Already submitted");
      if (input.answer.kind === "SHORT" && parseShort(input.answer.text, 4, ch.lang).value === null) return fail(parseShort(input.answer.text, 4, ch.lang).error!);
      ch.answered = true;
      const g = generate(ch.familyId, ch.seed, ch.lang);
      const r = grade(g.key, input.answer, ch.lang);
      const mis = r.misconception && MISCONCEPTIONS[r.misconception];
      const out: SubmitResult = {
        correct: r.correct,
        score: r.score,
        perStatement: r.perStatement,
        misconception: mis ? { id: mis.id, name: tr(ch.lang, mis.name), fix: tr(ch.lang, mis.fix) } : null,
        explanation: g.explanation,
        reveal: revealAnswer(g.key),
      };
      const now = new Date();
      if (ch.context === "discovery" && r.correct && ch.discoveryId) {
        const def = DISCOVERIES[ch.discoveryId];
        m.disc[ch.discoveryId] = { ...(m.disc[ch.discoveryId] ?? {}), stage: "confirmed" };
        for (const k of def.kcs) if (!m.know[k]?.tamed) m.know[k] = { ...review(EMPTY_MEMORY, Rating.Good, now), tamed: true };
        out.discovery = {
          id: ch.discoveryId,
          title: tr(ch.lang, DISCOVERY_REVEALS[ch.discoveryId].title),
          statement: tr(ch.lang, DISCOVERY_REVEALS[ch.discoveryId].statement),
          ability: { id: def.ability.id, name: tr(ch.lang, def.ability.name), desc: tr(ch.lang, def.ability.desc) },
        };
      } else if (ch.context !== "discovery" && m.know[ch.kc]) {
        const rating = fsrsGrade({ correct: r.correct, score: r.score, hints: input.hints ?? 0, responseMs: input.responseMs ?? null, confidence: input.confidence ?? null, expectedMs: 60000 });
        m.know[ch.kc] = { ...review(m.know[ch.kc], rating, now), tamed: true };
      }
      return ok(out);
    },
    async predict(id, p) {
      m.disc[id] = { ...(m.disc[id] ?? { stage: "hunch" }), prediction: m.disc[id]?.prediction ?? p };
      return ok({ ok: true as const });
    },
    async realtime() {
      // DEV: máy chủ realtime trong LAN (ALLOW_ANON=1) — đặt NEXT_PUBLIC_WORLD_RT_URL khi chạy dev
      const url = process.env.NEXT_PUBLIC_WORLD_RT_URL;
      let id = "";
      try {
        // mỗi TAB là một khách riêng (sessionStorage) — mở 2 tab để thử tổ đội (Hầm Bổ đề xếp ghế theo uid)
        id = sessionStorage.getItem("world.anon") || "";
        if (!id) sessionStorage.setItem("world.anon", (id = crypto.randomUUID()));
      } catch {
        id = crypto.randomUUID();
      }
      return ok(url ? { url, token: `anon:${id}` } : null);
    },
    async explain(id, text) {
      if (!m.disc[id] || m.disc[id].stage === "hunch") return fail("Confirm first");
      m.disc[id] = { ...m.disc[id], explanation: text, stage: "explained" };
      return ok({ ok: true as const });
    },
  };
  return { api, initial: state("en") };
}
