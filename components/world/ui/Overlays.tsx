"use client";
/**
 * Lớp phủ: Bảo tàng Khám phá · Gương Hoá Thân (chọn nhân vật) · Trận thuần hoá Sinh vật Hồi âm.
 */
import { useCallback, useEffect, useState } from "react";
import { useWorld, useT, useLang } from "../store";
import { tr } from "@/lib/world/i18n";
import { useApi } from "../api";
import { ChallengePanel } from "./ChallengePanel";
import { DISCOVERIES, KCS, type KcId } from "@/lib/world/kcs";
import { PLAYABLE, worldAsset } from "@/lib/world/avatars";
import type { IssuedChallenge, SubmitResult } from "@/lib/world/service";
import { creatureHome } from "../scene/Hub";
import { sfx } from "@/lib/world/sfx";
import { WBackdrop, WChip, WPanel, motion } from "./kit";
import { WONDERS, type WonderId } from "@/lib/world/wonders";
import { EMOTES, EXPRESSIONS } from "../player/retarget";

export function Panel({ children, onClose, title, wide }: { children: React.ReactNode; onClose?: () => void; title: string; wide?: boolean }) {
  return (
    <WBackdrop>
      <WPanel title={title} onClose={onClose} wide={wide}>
        {children}
      </WPanel>
    </WBackdrop>
  );
}

// ───────────── Động tác & biểu cảm ─────────────

export function EmoteOverlay({ onClose }: { onClose: () => void }) {
  const t = useT();
  const lang = useLang();
  const emote = useWorld((s) => s.emote);
  const expression = useWorld((s) => s.expression);
  return (
    <Panel title={t("emotes")} onClose={onClose}>
      <div className="mb-2 text-[11px] font-black uppercase tracking-widest text-[#ecd7a9]">{t("emoteMoves")}</div>
      <div className="grid grid-cols-3 gap-2 sm:grid-cols-4">
        {EMOTES.map((e) => (
          <button
            key={e.id}
            type="button"
            data-on={emote === e.id}
            onClick={() => {
              sfx.click();
              useWorld.setState({ emote: e.id, overlay: null });
            }}
            className="w-option px-2 py-2.5 text-sm font-black italic text-white"
          >
            {tr(lang, e.label)}
          </button>
        ))}
      </div>
      <div className="mb-2 mt-4 text-[11px] font-black uppercase tracking-widest text-[#ecd7a9]">{t("emoteFaces")}</div>
      <div className="flex flex-wrap gap-2">
        {EXPRESSIONS.map((x) => (
          <button
            key={x.id}
            type="button"
            data-on={expression === x.id}
            onClick={() => useWorld.setState({ expression: expression === x.id ? null : x.id })}
            className="w-option px-3 py-1.5 text-sm font-bold text-white"
          >
            {tr(lang, x.label)}
          </button>
        ))}
      </div>
      <p className="mt-3 text-[11px] text-white/50">{t("emoteHint")}</p>
    </Panel>
  );
}

// ───────────── Kỳ quan Toán học ─────────────

export function WonderOverlay({ onClose }: { onClose: () => void }) {
  const t = useT();
  const lang = useLang();
  const id = useWorld((s) => s.wonderId) as WonderId | null;
  if (!id || !WONDERS[id]) return null;
  const w = WONDERS[id];
  return (
    <Panel title={tr(lang, w.name)} onClose={onClose}>
      <motion.div initial="h" animate="s" variants={{ s: { transition: { staggerChildren: 0.08 } } }} className="flex flex-col gap-3">
        {[
          <div key="c" className="flex flex-wrap items-center gap-2">
            <WChip tone="gold">{t("wonderTitle")}</WChip>
            <WChip>{tr(lang, w.level)}</WChip>
          </div>,
          <p key="h" className="text-lg font-black italic" style={{ color: w.color }}>
            {tr(lang, w.hook)}
          </p>,
          <p key="s" className="text-sm leading-relaxed text-white/90">
            {tr(lang, w.story)}
          </p>,
          <div key="q" className="rounded-xl bg-white/5 p-3 ring-1 ring-[#ecd7a9]/30">
            <div className="mb-1 text-[11px] font-black uppercase tracking-widest text-[#ecd7a9]">{t("wonderQuestion")}</div>
            <p className="text-sm text-white">{tr(lang, w.question)}</p>
          </div>,
          <div key="a" className="text-xs text-white/70">
            <span className="font-black text-sky-200">{t("wonderSee")}: </span>
            {tr(lang, w.seeAlso)}
          </div>,
        ].map((el) => (
          <motion.div key={el.key} variants={{ h: { opacity: 0, x: -14 }, s: { opacity: 1, x: 0 } }}>
            {el}
          </motion.div>
        ))}
      </motion.div>
    </Panel>
  );
}

// ───────────── Bảo tàng ─────────────

export function MuseumOverlay({ onClose }: { onClose: () => void }) {
  const state = useWorld((s) => s.state);
  const api = useApi();
  const t = useT();
  const lang = useLang();
  const [drafts, setDrafts] = useState<Record<string, string>>({});
  const [msg, setMsg] = useState<string | null>(null);
  async function saveExplain(id: (typeof state.discoveries)[number]["id"]) {
    const r = await api.explain(id, drafts[id] ?? "");
    if (!r.success) return setMsg(r.error);
    sfx.chime(1);
    setMsg(t("explainSaved"));
    const st = await api.state();
    if (st.success) useWorld.setState({ state: st.data });
  }
  return (
    <Panel title={t("museum")} onClose={onClose} wide>
      <div className="grid gap-3 sm:grid-cols-3">
        {state.discoveries.map((d) => {
          const def = DISCOVERIES[d.id];
          const found = d.stage && d.stage !== "hunch";
          return (
            <div key={d.id} className={`rounded-2xl p-3 ring-1 ${found ? "bg-amber-200/10 ring-amber-200/50" : "bg-white/5 ring-white/10"}`}>
              <div className="mb-1 text-3xl">{found ? "✦" : "?"}</div>
              <div className="text-sm font-black text-white">{found ? d.title : t("unfound")}</div>
              <div className="mt-1 text-xs text-white/70">{found ? d.statement : tr(lang, def.teaser)}</div>
              {d.stage && <div className="mt-2 inline-block rounded-full bg-white/10 px-2 py-0.5 text-[11px] font-bold text-amber-200">{t(`stage_${d.stage}`)}</div>}
              {d.prediction && (
                <div className="mt-2 text-[11px] text-white/60">
                  {t("firstGuess")} <b className="text-white/80">{tr(lang, def.predictOptions.find((o) => o.id === d.prediction)?.label ?? { en: "", vi: "" })}</b>
                </div>
              )}
              {found && <div className="mt-1 text-[11px] text-sky-200">{t("ability", { name: tr(lang, def.ability.name) })}</div>}
              {found && (
                <div className="mt-2">
                  {d.explanation ? (
                    <p className="rounded-lg bg-white/5 p-2 text-xs italic text-white/80">“{d.explanation}”</p>
                  ) : (
                    <>
                      <textarea
                        value={drafts[d.id] ?? ""}
                        onChange={(e) => setDrafts((x) => ({ ...x, [d.id]: e.target.value }))}
                        placeholder={t("explainPh")}
                        className="h-16 w-full rounded-lg bg-white/10 p-2 text-xs text-white outline-none ring-1 ring-white/20 focus:ring-amber-200"
                      />
                      <button type="button" onClick={() => saveExplain(d.id)} className="mt-1 w-btn w-btn--gold w-btn--sm">
                        {t("save")}
                      </button>
                    </>
                  )}
                </div>
              )}
            </div>
          );
        })}
      </div>
      {msg && <p className="mt-2 text-sm font-bold text-amber-200">{msg}</p>}
      <h3 className="mb-2 mt-5 text-sm font-black text-sky-200">{t("echoes")}</h3>
      <div className="grid gap-2 sm:grid-cols-2">
        {state.creatures.map((c) => (
          <div key={c.kc} className="flex items-center gap-3 rounded-2xl bg-white/5 p-2 ring-1 ring-white/10">
            <div className="h-10 w-10 shrink-0 rounded-full" style={{ background: c.state === "wild" ? "#333" : `radial-gradient(circle at 35% 35%, #fff, ${c.color})`, boxShadow: c.state === "wild" ? "none" : `0 0 16px ${c.color}` }} />
            <div className="min-w-0 flex-1">
              <div className="truncate text-sm font-black text-white">{c.state === "wild" ? "???" : c.creature}</div>
              <div className="truncate text-[11px] text-white/60">{c.state === "wild" ? t("untamed") : c.name}</div>
              {c.state !== "wild" && (
                <div className="mt-1 h-1.5 overflow-hidden rounded-full bg-white/10">
                  <div className="h-full rounded-full" style={{ width: `${Math.round(c.recall * 100)}%`, background: c.state === "feral" ? "#ff5d7a" : c.color }} />
                </div>
              )}
            </div>
            <span className={`shrink-0 rounded-full px-2 py-0.5 text-[10px] font-black ${c.state === "feral" ? "bg-rose-500 text-white" : c.state === "fading" ? "bg-amber-300 text-indigo-950" : c.state === "tamed" ? "bg-emerald-300 text-emerald-950" : "bg-white/10 text-white/50"}`}>
              {c.state === "wild" ? "—" : t(`st_${c.state}`)}
            </span>
          </div>
        ))}
      </div>
      <p className="mt-3 text-xs text-white/50">{t("echoesNote")}</p>
    </Panel>
  );
}

// ───────────── Gương Hoá Thân ─────────────

export function CharacterOverlay({ onClose }: { onClose: () => void }) {
  const avatar = useWorld((s) => s.avatar);
  const t = useT();
  function pick(id: string) {
    useWorld.setState({ avatar: id });
    try {
      localStorage.setItem("world.avatar", id);
    } catch {}
    sfx.chime(3);
    const p = useWorld.getState().player;
    useWorld.getState().burst([p.x, 1, p.z], "#bfe8ff", 60);
  }
  return (
    <Panel title={t("mirrorName")} onClose={onClose} wide>
      <div className="grid grid-cols-2 gap-2 sm:grid-cols-4">
        {PLAYABLE.map((a) => (
          <button
            key={a.id}
            type="button"
            onClick={() => pick(a.id)}
            className={`group relative overflow-hidden rounded-2xl text-left ring-2 transition hover:-translate-y-0.5 ${avatar === a.id ? "ring-amber-200" : "ring-white/10"}`}
            style={{ background: `radial-gradient(90% 70% at 50% 30%, ${a.color}dd, transparent 70%), linear-gradient(170deg, ${a.color}88, #1e1b4b 75%)` }}
          >
            {/* chân dung dựng từ chính model VRM (Blender, không đổ bóng) */}
            {/* eslint-disable-next-line @next/next/no-img-element */}
            <img
              src={worldAsset(`portraits/avatar_${a.id}.webp`)}
              alt=""
              loading="lazy"
              draggable={false}
              className="block aspect-square w-full object-cover transition duration-300 group-hover:scale-[1.06]"
              style={{ filter: `drop-shadow(0 0 14px ${a.color})` }}
            />
            <div className="absolute inset-x-0 bottom-0 bg-gradient-to-t from-[#140f30] via-[#140f30cc] to-transparent px-3 pb-2.5 pt-8">
              <div className="text-base font-black leading-tight text-white">{a.name}</div>
              <div className="text-[11px] leading-snug text-white/80">{a.tagline}</div>
              {avatar === a.id && <div className="mt-0.5 text-[11px] font-black text-amber-200">{t("transforming")}</div>}
            </div>
          </button>
        ))}
      </div>
      <p className="mt-3 text-[11px] text-white/50">{t("avatarCredits")}</p>
    </Panel>
  );
}

// ───────────── Trận thuần hoá ─────────────

const MAX_ROUNDS = 5;

export function BattleOverlay({ kc, onClose }: { kc: KcId; onClose: () => void }) {
  const api = useApi();
  const creatures = useWorld((s) => s.state.creatures);
  const idx = creatures.findIndex((c) => c.kc === kc);
  const t = useT();
  const lang = useLang();
  const def = { color: KCS[kc].color, creature: tr(lang, KCS[kc].creature), name: tr(lang, KCS[kc].name) };
  const [hp, setHp] = useState(3);
  const [round, setRound] = useState(0);
  const [combo, setCombo] = useState(0);
  const [ch, setCh] = useState<IssuedChallenge | null>(null);
  const [phase, setPhase] = useState<"loading" | "question" | "won" | "lost" | "error">("loading");
  const [err, setErr] = useState<string | null>(null);

  const next = useCallback(async () => {
    setPhase("loading");
    const r = await api.request({ mode: "review", kc });
    if (!r.success) {
      setErr(r.error);
      setPhase("error");
      return;
    }
    setCh(r.data);
    setPhase("question");
    sfx.circle();
  }, [api, kc]);

  useEffect(() => {
    next();
  }, [next]);

  const pos = creatureHome(Math.max(0, idx));
  async function onSubmit(answer: Parameters<React.ComponentProps<typeof ChallengePanel>["onSubmit"]>[0], meta: { confidence: number; hints: number; responseMs: number }) {
    const w = useWorld.getState();
    w.act("cast", 900);
    sfx.cast();
    const r = await api.submit({ challengeId: ch!.challengeId, answer, ...meta });
    if (!r.success) return { error: r.error };
    const res = r.data;
    if (res.correct || res.score >= 0.5) {
      setTimeout(() => {
        sfx.hit(combo);
        w.hitstop(110);
        w.addShake(0.55);
        w.burst([pos.x, 1.4, pos.z], def.color, 50 + combo * 10);
      }, 260);
      setCombo((c) => c + 1);
    } else {
      setTimeout(() => {
        w.act("hurt", 700);
        useWorld.setState({ shieldAt: performance.now() });
        sfx.shield();
        w.addShake(0.3);
      }, 200);
      setCombo(0);
    }
    return res;
  }

  async function onDone(res: SubmitResult) {
    const hit = res.correct || res.score >= 0.5;
    const nhp = hit ? hp - 1 : hp;
    const nround = round + 1;
    setHp(nhp);
    setRound(nround);
    const st = await api.state();
    if (st.success) useWorld.setState({ state: st.data });
    if (nhp <= 0) {
      sfx.shatter();
      const w = useWorld.getState();
      w.burst([pos.x, 1.4, pos.z], "#ffffff", 120);
      w.burst([pos.x, 1.4, pos.z], def.color, 120);
      w.act("cheer", 2200);
      setPhase("won");
      return;
    }
    if (nround >= MAX_ROUNDS) {
      setPhase("lost");
      return;
    }
    next();
  }

  return (
    <div className="pointer-events-none absolute inset-0 z-30 flex flex-col justify-end p-3 sm:items-end">
      <motion.div initial={{ x: 80, opacity: 0 }} animate={{ x: 0, opacity: 1 }} transition={{ type: "spring", stiffness: 320, damping: 30 }} className="w-panel pointer-events-auto w-full max-w-lg p-5">
        <div className="mb-3 flex items-center gap-3">
          <div className="h-9 w-9 rounded-full" style={{ background: `radial-gradient(circle at 35% 35%, #fff, ${def.color})`, boxShadow: `0 0 18px ${def.color}` }} />
          <div className="flex-1">
            <div className="text-sm font-black text-white">{t("taming", { name: def.creature })}</div>
            <div className="flex gap-1">
              {Array.from({ length: 3 }, (_, i) => (
                <span key={i} className={`h-2 w-8 rounded-full ${i < hp ? "bg-pink-300 shadow-[0_0_8px_#ff8fb0]" : "bg-white/15"}`} />
              ))}
              <span className="ml-2 text-[11px] text-white/60">
                {t("barrier", { r: Math.min(round + 1, MAX_ROUNDS), m: MAX_ROUNDS })}
              </span>
            </div>
          </div>
          {combo > 1 && <div className="animate-pulse text-lg font-black text-amber-200">COMBO ×{combo}</div>}
          <button type="button" onClick={onClose} className="w-btn w-btn--ghost w-btn--sm">
            {t("retreat")}
          </button>
        </div>
        {phase === "loading" && <p className="py-6 text-center text-sm text-white/70">{t("circleAppears")}</p>}
        {phase === "error" && <p className="py-4 text-center text-sm font-bold text-rose-300">{err}</p>}
        {phase === "question" && ch && <ChallengePanel challenge={ch} onSubmit={onSubmit} onDone={onDone} title={`${def.name}`} />}
        {phase === "won" && (
          <div className="py-4 text-center">
            <div className="text-2xl font-black text-amber-200">{t("tamed")}</div>
            <p className="mt-1 text-sm text-white/80">{t("tamedNote", { name: def.creature })}</p>
            <button type="button" onClick={onClose} className="mt-3 w-btn w-btn--gold w-btn--sm">
              {t("great")}
            </button>
          </div>
        )}
        {phase === "lost" && (
          <div className="py-4 text-center">
            <div className="text-lg font-black text-white">{t("escaped", { name: def.creature })}</div>
            <p className="mt-1 text-sm text-white/70">{t("escapedNote")}</p>
            <button type="button" onClick={onClose} className="mt-3 w-btn w-btn--ghost w-btn--sm">
              {t("toPlaza")}
            </button>
          </div>
        )}
      </motion.div>
    </div>
  );
}
