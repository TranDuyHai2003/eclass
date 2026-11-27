"use client";
/**
 * Bảng điều khiển Thung lũng Hàm số: thanh trượt a, b, c, d · luồng khám phá (lời nhá → dự đoán → thử → xác nhận → gọi tên)
 * · đặt Neo Móc · luyện tập các sinh vật đã thuần hoá.
 */
import { useEffect, useState } from "react";
import { useWorld, useT, useLang } from "../store";
import { tr } from "@/lib/world/i18n";
import { Anchor, ChevronDown, ChevronLeft, ChevronUp, Lightbulb, Sparkles, Undo2, Send } from "lucide-react";
import { useApi } from "../api";
import { ChallengePanel } from "./ChallengePanel";
import { MathText } from "./MathText";
import { DISCOVERIES, KCS, type DiscoveryId, type KcId } from "@/lib/world/kcs";
import { cubicLatex } from "@/lib/world/cubic";
import type { IssuedChallenge, SubmitResult } from "@/lib/world/service";
import { sfx } from "@/lib/world/sfx";

type Step = "teaser" | "predict" | "explore" | "check" | "anchor" | "reveal" | "retry";

const PRESETS = [
  { name: "presetHills", k: { a: 0.5, b: 0, c: -1.5, d: 0 } },
  { name: "presetCube", k: { a: 0.25, b: 0, c: 0, d: 0 } },
  { name: "presetFlip", k: { a: -0.5, b: 0.5, c: 2, d: 0 } },
  { name: "presetGentle", k: { a: 0.25, b: 0, c: 1, d: 0 } },
];

export function ValleyPanel({ onExit }: { onExit: () => void }) {
  const api = useApi();
  const t = useT();
  const lang = useLang();
  const state = useWorld((s) => s.state);
  const k = useWorld((s) => s.valleyCubic);
  const challengeCubic = useWorld((s) => s.challengeCubic);
  const anchors = useWorld((s) => s.anchors);
  const current = state.discoveries.find((d) => d.unlocked && (!d.stage || d.stage === "hunch"));
  const [step, setStep] = useState<Step>("teaser");
  const [hintN, setHintN] = useState(0);
  const [ch, setCh] = useState<IssuedChallenge | null>(null);
  const [reveal, setReveal] = useState<SubmitResult["discovery"] | null>(null);
  const [msg, setMsg] = useState<string | null>(null);
  const [practice, setPractice] = useState<{ kc: KcId; ch: IssuedChallenge; streak: number } | null>(null);
  const [collapsed, setCollapsed] = useState(false);

  useEffect(() => {
    setStep(current?.prediction ? "explore" : "teaser");
    setHintN(0);
  }, [current?.id, current?.prediction]);

  const def = current ? DISCOVERIES[current.id] : null;

  async function refresh() {
    const st = await api.state();
    if (st.success) useWorld.setState({ state: st.data });
  }

  async function predict(opt: string) {
    if (!current) return;
    sfx.click();
    await api.predict(current.id, opt);
    await refresh();
    setStep("explore");
  }

  async function startCheck() {
    if (!current) return;
    setMsg(null);
    const r = await api.request({ mode: "discovery", discoveryId: current.id });
    if (!r.success) return setMsg(r.error);
    setCh(r.data);
    sfx.circle();
    if (r.data.prompt.format === "ANCHOR" && r.data.prompt.graph) {
      useWorld.setState({ challengeCubic: r.data.prompt.graph.cubic, anchors: [], valleyX: r.data.prompt.graph.xMin + 0.3 });
      setStep("anchor");
    } else setStep("check");
  }

  function celebrate(r: SubmitResult) {
    const w = useWorld.getState();
    if (r.discovery) {
      setReveal(r.discovery);
      setStep("reveal");
      sfx.shatter();
      w.act("cheer", 2400);
      w.addShake(0.4);
      w.burst([w.valleyX * 2.2, 6, 0], "#ffd27a", 140);
      w.burst([w.valleyX * 2.2, 6, 0], "#8be0ff", 100);
    } else {
      setStep("retry");
      sfx.miss();
    }
  }

  async function submitAnchors() {
    if (!ch) return;
    useWorld.getState().act("cast", 900);
    sfx.cast();
    const r = await api.submit({ challengeId: ch.challengeId, answer: { kind: "ANCHOR", xs: anchors }, hints: hintN });
    if (!r.success) return setMsg(r.error);
    useWorld.setState({ challengeCubic: null, anchors: [] });
    if (!r.data.correct) setMsg(r.data.misconception ? `${r.data.misconception.name}: ${r.data.misconception.fix}` : t("anchorWrong"));
    celebrate(r.data);
  }

  async function startPractice(kc: KcId, streak = 0) {
    const r = await api.request({ mode: "practice", kc });
    if (!r.success) return setMsg(r.error);
    setPractice({ kc, ch: r.data, streak });
    sfx.circle();
  }

  const tamed = state.creatures.filter((c) => c.state !== "wild");

  return (
    <div className="w-panel pointer-events-auto absolute bottom-3 right-3 z-20 flex max-h-[62dvh] w-[min(420px,calc(100vw-24px))] flex-col overflow-hidden sm:top-16 sm:max-h-none">
      <div className="flex items-center justify-between gap-2 px-4 pt-3">
        <button type="button" onClick={onExit} className="w-btn w-btn--ghost w-btn--sm">
          <ChevronLeft size={14} className="-ml-1 mr-0.5 inline -translate-y-px" />
          {t("backPlaza")}
        </button>
        <span className="w-title text-base">{t("valleyName")}</span>
        <button type="button" onClick={() => setCollapsed((c) => !c)} className="rounded-full bg-white/10 px-2 py-1 text-xs font-bold text-white">
          {collapsed ? <ChevronUp size={16} /> : <ChevronDown size={16} />}
        </button>
      </div>
      {!collapsed && (
        <div className="min-h-0 flex-1 overflow-y-auto px-4 pb-4 pt-2">
          {/* Đường ray: thanh trượt */}
          {!challengeCubic && (
            <div className="mb-3 rounded-2xl bg-white/5 p-3 ring-1 ring-white/10">
              <MathText text={`$f(x) = ${cubicLatex(k, lang === "vi" ? "{,}" : ".")}$`} className="text-sm text-amber-100" />
              {(["a", "b", "c", "d"] as const).map((key) => (
                <label key={key} className="mt-1 flex items-center gap-2 text-xs text-white/80">
                  <span className="w-4 font-black text-sky-200">{key}</span>
                  <input
                    type="range"
                    min={-3}
                    max={3}
                    step={0.25}
                    value={k[key]}
                    onChange={(e) => useWorld.setState({ valleyCubic: { ...k, [key]: Number(e.target.value) } })}
                    className="flex-1 accent-amber-300"
                  />
                  <span className="w-10 text-right font-mono">{lang === "vi" ? String(k[key]).replace(".", ",") : String(k[key])}</span>
                </label>
              ))}
              <div className="mt-2 flex flex-wrap gap-1">
                {PRESETS.map((p) => (
                  <button key={p.name} type="button" onClick={() => useWorld.setState({ valleyCubic: p.k })} className="rounded-full bg-white/10 px-2 py-0.5 text-[11px] font-bold text-white hover:bg-white/20">
                    {t(p.name)}
                  </button>
                ))}
              </div>
              <p className="mt-2 text-[11px] text-white/50">{t("rideHint")}</p>
            </div>
          )}

          {/* Luồng khám phá */}
          {def && current && !practice && (
            <div className="rounded-2xl bg-amber-200/5 p-3 ring-1 ring-amber-200/30">
              <div className="mb-1 text-[11px] font-black uppercase tracking-wider text-amber-200">{t("mystery")}</div>
              {step === "teaser" && (
                <>
                  <p className="text-sm text-white">{tr(lang, def.teaser)}</p>
                  <button type="button" onClick={() => setStep("predict")} className="mt-2 w-btn w-btn--gold w-btn--sm">
                    {t("investigate")}
                  </button>
                </>
              )}
              {step === "predict" && (
                <>
                  <p className="text-sm font-bold text-white">{t("predictFirst", { q: tr(lang, def.predictPrompt) })}</p>
                  <div className="mt-2 flex flex-col gap-1">
                    {def.predictOptions.map((o) => (
                      <button key={o.id} type="button" onClick={() => predict(o.id)} className="rounded-xl bg-white/10 px-3 py-1.5 text-left text-sm text-white hover:bg-white/20">
                        {tr(lang, o.label)}
                      </button>
                    ))}
                  </div>
                </>
              )}
              {step === "explore" && (
                <>
                  <p className="text-sm text-white">{tr(lang, def.teaser)}</p>
                  <p className="mt-1 text-xs text-white/70">{t("exploreNote")}</p>
                  {def.hints.slice(0, hintN).map((h, i) => (
                    <p key={i} className="mt-1 rounded-lg bg-white/5 px-2 py-1 text-xs text-amber-100">
                      <Lightbulb size={12} className="mr-1 inline -translate-y-px text-amber-200" />
                      {tr(lang, h)}
                    </p>
                  ))}
                  <div className="mt-2 flex flex-wrap gap-2">
                    {hintN < def.hints.length && (
                      <button type="button" onClick={() => setHintN((n) => n + 1)} className="rounded-full bg-white/10 px-3 py-1 text-xs font-bold text-amber-200">
                        <Lightbulb size={13} className="mr-1 inline -translate-y-px" />
                        {t("hintBtn", { n: hintN, m: def.hints.length })}
                      </button>
                    )}
                    <button type="button" onClick={startCheck} className="w-btn w-btn--sm">
                      <Sparkles size={14} className="mr-1 inline -translate-y-px" />
                      {t("confirm")}
                    </button>
                  </div>
                </>
              )}
              {step === "anchor" && ch && (
                <>
                  <MathText text={ch.prompt.stem} className="text-sm text-white" />
                  <p className="mt-1 text-xs text-white/70">{t("anchorNote", { n: anchors.length })}</p>
                  <div className="mt-2 flex flex-wrap gap-2">
                    <button
                      type="button"
                      onClick={() => {
                        const w = useWorld.getState();
                        useWorld.setState({ anchors: [...w.anchors, Math.round(w.valleyX * 20) / 20] });
                        sfx.circle();
                      }}
                      className="w-btn w-btn--gold w-btn--sm"
                    >
                      <Anchor size={14} className="mr-1 inline -translate-y-px" />
                      {t("dropAnchor")}
                    </button>
                    <button type="button" onClick={() => useWorld.setState({ anchors: anchors.slice(0, -1) })} className="w-btn w-btn--ghost w-btn--sm">
                      <Undo2 size={13} className="mr-1 inline -translate-y-px" />
                      {t("undoAnchor")}
                    </button>
                    <button type="button" onClick={submitAnchors} disabled={!anchors.length} className="w-btn w-btn--sm">
                      <Send size={13} className="mr-1 inline -translate-y-px" />
                      {t("submit")}
                    </button>
                  </div>
                </>
              )}
              {step === "check" && ch && (
                <ChallengePanel
                  challenge={ch}
                  hints={def.hints.map((h) => tr(lang, h))}
                  title={t("confirmTitle")}
                  onSubmit={async (answer, meta) => {
                    useWorld.getState().act("cast", 900);
                    sfx.cast();
                    const r = await api.submit({ challengeId: ch.challengeId, answer, ...meta });
                    return r.success ? r.data : { error: r.error };
                  }}
                  onDone={(r) => celebrate(r)}
                />
              )}
              {step === "retry" && (
                <>
                  <p className="text-sm text-white">{t("retryNote")}</p>
                  {msg && <p className="mt-1 text-xs text-fuchsia-200">{msg}</p>}
                  <button type="button" onClick={() => setStep("explore")} className="mt-2 rounded-full bg-white px-4 py-1 text-sm font-black text-indigo-950">
                    {t("retry")}
                  </button>
                </>
              )}
            </div>
          )}
          {step === "reveal" && reveal && (
            <div className="mt-3 rounded-2xl bg-gradient-to-br from-amber-200/30 to-pink-300/20 p-4 text-center ring-2 ring-amber-200">
              <div className="text-xs font-black uppercase tracking-widest text-amber-200">{t("newDiscovery")}</div>
              <div className="mt-1 text-lg font-black text-white">{reveal.title}</div>
              <p className="mt-1 text-sm text-white/90">{reveal.statement}</p>
              <div className="mt-3 rounded-xl bg-indigo-950/50 p-2">
                <div className="text-xs text-sky-200">{t("newAbility")}</div>
                <div className="font-black text-white">{reveal.ability.name}</div>
                <div className="text-xs text-white/70">{reveal.ability.desc}</div>
              </div>
              <button
                type="button"
                onClick={async () => {
                  setReveal(null);
                  setStep("teaser");
                  await refresh();
                }}
                className="mt-3 w-btn w-btn--gold w-btn--sm"
              >
                {t("toMuseum")}
              </button>
            </div>
          )}

          {/* Luyện tập */}
          {!current && !practice && step !== "reveal" && (
            <div className="rounded-2xl bg-white/5 p-3 ring-1 ring-white/10">
              <div className="text-sm font-black text-white">{t("allFound")}</div>
              <p className="mt-1 text-xs text-white/70">{t("practiceWith")}</p>
              <div className="mt-2 flex flex-wrap gap-1">
                {tamed.map((c) => (
                  <button key={c.kc} type="button" onClick={() => startPractice(c.kc as KcId)} className="rounded-full px-3 py-1 text-xs font-black text-indigo-950" style={{ background: c.color }}>
                    {c.creature}
                  </button>
                ))}
              </div>
            </div>
          )}
          {practice && (
            <div className="rounded-2xl bg-white/5 p-3 ring-1 ring-white/10">
              <div className="mb-2 flex items-center justify-between text-xs text-white/70">
                <span>
                  {t("practicing")} <b style={{ color: KCS[practice.kc].color }}>{tr(lang, KCS[practice.kc].creature)}</b>
                </span>
                <span>{t("streak", { n: practice.streak })}</span>
                <button type="button" onClick={() => setPractice(null)} className="rounded-full bg-white/10 px-2 py-0.5 font-bold text-white">
                  {t("stop")}
                </button>
              </div>
              <ChallengePanel
                challenge={practice.ch}
                onSubmit={async (answer, meta) => {
                  useWorld.getState().act("cast", 800);
                  sfx.cast();
                  const r = await api.submit({ challengeId: practice.ch.challengeId, answer, ...meta });
                  if (r.success) (r.data.correct ? sfx.chime(practice.streak) : sfx.miss());
                  return r.success ? r.data : { error: r.error };
                }}
                onDone={(r) => startPractice(practice.kc, r.correct ? practice.streak + 1 : 0)}
              />
            </div>
          )}
          {msg && step !== "retry" && <p className="mt-2 text-xs font-bold text-rose-300">{msg}</p>}
        </div>
      )}
    </div>
  );
}

export type { DiscoveryId };
