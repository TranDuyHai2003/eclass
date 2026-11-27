"use client";
/**
 * Bảng làm câu hỏi (MCQ · Đúng/Sai 4 ý · trả lời ngắn · chọn nhiều) + độ tự tin + gợi ý + kết quả có giải thích & ngộ nhận.
 * Không có đồng hồ đếm ngược (theo nghiên cứu: không tạo áp lực thời gian ở bài khái niệm).
 */
import { useEffect, useRef, useState } from "react";
import type { IssuedChallenge, SubmitResult } from "@/lib/world/service";
import type { Answer } from "@/lib/world/grading";
import { MathText } from "./MathText";
import { MiniGraph } from "./MiniGraph";
import { fmtNum } from "@/lib/world/i18n";
import { Lightbulb, Sparkles, Star, ArrowRight } from "lucide-react";
import { sfx } from "@/lib/world/sfx";
import { useT, useLang } from "../store";

export interface PanelProps {
  challenge: IssuedChallenge;
  onSubmit: (answer: Answer, meta: { confidence: number; hints: number; responseMs: number }) => Promise<SubmitResult | { error: string }>;
  onDone: (r: SubmitResult) => void;
  hints?: string[];
  title?: string;
}

export function ChallengePanel({ challenge, onSubmit, onDone, hints = [], title }: PanelProps) {
  const p = challenge.prompt;
  const t = useT();
  const lang = useLang();
  const [choice, setChoice] = useState<string | null>(null);
  const [multi, setMulti] = useState<string[]>([]);
  const [marks, setMarks] = useState<(boolean | null)[]>([null, null, null, null]);
  const [text, setText] = useState("");
  const [confidence, setConfidence] = useState(2);
  const [hintN, setHintN] = useState(0);
  const [busy, setBusy] = useState(false);
  const [err, setErr] = useState<string | null>(null);
  const [result, setResult] = useState<SubmitResult | null>(null);
  const t0 = useRef(0);
  useEffect(() => {
    t0.current = Date.now();
    setChoice(null);
    setMulti([]);
    setMarks([null, null, null, null]);
    setText("");
    setHintN(0);
    setResult(null);
    setErr(null);
  }, [challenge.challengeId]);

  const ready =
    p.format === "MCQ" ? !!choice : p.format === "MULTI" ? multi.length > 0 : p.format === "TF4" ? marks.every((m) => m !== null) : p.format === "SHORT" ? text.trim().length > 0 : false;

  async function submit() {
    if (!ready || busy) return;
    const answer: Answer =
      p.format === "MCQ"
        ? { kind: "MCQ", choice: choice! }
        : p.format === "MULTI"
          ? { kind: "MULTI", choices: multi }
          : p.format === "TF4"
            ? { kind: "TF4", marks }
            : { kind: "SHORT", text };
    setBusy(true);
    setErr(null);
    sfx.click();
    const r = await onSubmit(answer, { confidence, hints: hintN, responseMs: Date.now() - t0.current });
    setBusy(false);
    if ("error" in r) {
      setErr(r.error);
      return;
    }
    setResult(r);
  }

  const reveal = (result?.reveal ?? {}) as { correct?: string | string[]; truth?: boolean[]; value?: number };

  return (
    <div className="flex max-h-full flex-col gap-3 overflow-y-auto">
      <div className="flex items-center justify-between gap-2">
        <span className="w-chip w-chip--gold">
          {title ?? t("challenge")}
        </span>
        {hints.length > 0 && !result && (
          <button
            type="button"
            onClick={() => setHintN((n) => Math.min(hints.length, n + 1))}
            disabled={hintN >= hints.length}
            className="rounded-full bg-white/10 px-3 py-1 text-xs font-bold text-amber-200 ring-1 ring-amber-200/40 hover:bg-white/20 disabled:opacity-40"
          >
            <Lightbulb size={14} className="mr-1 inline -translate-y-px" />
            {t("hint", { n: hintN, m: hints.length })}
          </button>
        )}
      </div>
      <MathText text={p.stem} className="text-[15px] leading-relaxed text-white" />
      {p.graph && <MiniGraph graph={p.graph} />}
      {hints.slice(0, hintN).map((h, i) => (
        <div key={i} className="rounded-xl bg-amber-200/10 px-3 py-2 text-sm text-amber-100 ring-1 ring-amber-200/30">
          <b>{t("hintN", { n: i + 1 })}</b> {h}
        </div>
      ))}

      {p.format === "MCQ" && (
        <div className="grid grid-cols-2 gap-2">
          {p.options!.map((o) => {
            const isRight = result && reveal.correct === o.id;
            const isWrongPick = result && choice === o.id && !result.correct;
            return (
              <button
                key={o.id}
                type="button"
                disabled={!!result}
                onClick={() => setChoice(o.id)}
                className={`rounded-xl px-3 py-2.5 text-left text-sm font-semibold ring-1 transition ${
                  isRight
                    ? "bg-emerald-400/30 ring-emerald-300"
                    : isWrongPick
                      ? "bg-rose-500/30 ring-rose-300"
                      : choice === o.id
                        ? "bg-sky-400/30 ring-sky-200"
                        : "bg-white/5 ring-white/15 hover:bg-white/10"
                } text-white`}
              >
                <span className="mr-2 font-black text-amber-200">{o.id}.</span>
                {o.graph ? <MiniGraph graph={o.graph} height={110} /> : <MathText text={o.label} />}
              </button>
            );
          })}
        </div>
      )}

      {p.format === "MULTI" && (
        <div className="flex flex-wrap gap-2">
          {p.options!.map((o) => {
            const on = multi.includes(o.id);
            const right = result && Array.isArray(reveal.correct) && reveal.correct.includes(o.id);
            return (
              <button
                key={o.id}
                type="button"
                disabled={!!result}
                onClick={() => setMulti((m) => (on ? m.filter((x) => x !== o.id) : [...m, o.id]))}
                className={`rounded-xl px-3 py-2 text-sm font-semibold text-white ring-1 ${
                  result ? (right ? "bg-emerald-400/30 ring-emerald-300" : on ? "bg-rose-500/30 ring-rose-300" : "bg-white/5 ring-white/15") : on ? "bg-sky-400/30 ring-sky-200" : "bg-white/5 ring-white/15 hover:bg-white/10"
                }`}
              >
                {on ? "☑ " : "☐ "}
                <MathText text={o.label} />
              </button>
            );
          })}
        </div>
      )}

      {p.format === "TF4" && (
        <div className="flex flex-col gap-2">
          {p.statements!.map((s, i) => {
            const ok = result?.perStatement?.[i];
            return (
              <div key={s.id} className={`flex items-center gap-2 rounded-xl px-3 py-2 ring-1 ${result ? (ok ? "bg-emerald-400/15 ring-emerald-300/60" : "bg-rose-500/15 ring-rose-300/60") : "bg-white/5 ring-white/15"}`}>
                <span className="font-black text-amber-200">{s.id})</span>
                <MathText text={s.text} className="flex-1 text-sm text-white" />
                {([t("trueShort"), t("falseShort")] as const).map((lab, li) => {
                  const v = li === 0;
                  const on = marks[i] === v;
                  return (
                    <button
                      key={lab}
                      type="button"
                      disabled={!!result}
                      onClick={() => setMarks((m) => m.map((x, j) => (j === i ? v : x)))}
                      className={`h-8 w-8 rounded-lg text-sm font-black ring-1 ${on ? (v ? "bg-emerald-400 text-emerald-950 ring-emerald-200" : "bg-rose-400 text-rose-950 ring-rose-200") : "bg-white/10 text-white ring-white/20"}`}
                    >
                      {lab}
                    </button>
                  );
                })}
              </div>
            );
          })}
        </div>
      )}

      {p.format === "SHORT" && (
        <div className="flex items-center gap-2">
          <input
            value={text}
            disabled={!!result}
            maxLength={p.input?.maxChars ?? 4}
            onChange={(e) => setText(e.target.value)}
            onKeyDown={(e) => e.key === "Enter" && submit()}
            inputMode="decimal"
            className="w-32 rounded-xl bg-white/10 px-3 py-2 text-center text-xl font-black tracking-widest text-white outline-none ring-2 ring-amber-200/50 focus:ring-amber-200"
            placeholder="____"
          />
          <span className="text-xs text-white/60">{p.input?.hint}</span>
        </div>
      )}

      {!result && (
        <div className="flex flex-wrap items-center justify-between gap-2 pt-1">
          <div className="flex items-center gap-1 text-xs text-white/70">
            {t("confidence")}
            {[1, 2, 3].map((c) => (
              <button key={c} type="button" onClick={() => setConfidence(c)} className={c <= confidence ? "text-amber-300 drop-shadow-[0_0_6px_rgba(255,210,90,.9)]" : "text-white/25"} aria-label={t("confidenceAria", { n: c })}>
                <Star size={20} fill="currentColor" strokeWidth={1.5} />
              </button>
            ))}
          </div>
          <button
            type="button"
            onClick={submit}
            disabled={!ready || busy}
            className="w-btn"
          >
            <Sparkles size={16} className="mr-1.5 inline -translate-y-px" />
            {busy ? t("casting") : t("cast")}
          </button>
        </div>
      )}
      {err && <p className="text-sm font-bold text-rose-300">{err}</p>}

      {result && (
        <div className="flex flex-col gap-2">
          <div className={`rounded-xl px-3 py-2 text-base font-black ${result.correct ? "bg-emerald-400/20 text-emerald-200" : result.score > 0 ? "bg-amber-400/20 text-amber-100" : "bg-rose-500/20 text-rose-200"}`}>
            {result.correct ? t("correct") : result.score > 0 ? t("partial", { s: fmtNum(result.score, lang) }) : t("wrong")}
            {typeof reveal.value === "number" && !result.correct && <span className="ml-2 text-sm font-bold">{t("answerIs", { v: fmtNum(reveal.value, lang) })}</span>}
          </div>
          {result.misconception && (
            <div className="rounded-xl bg-fuchsia-500/15 px-3 py-2 text-sm text-fuchsia-100 ring-1 ring-fuchsia-300/40">
              <b>{t("trap", { name: result.misconception.name })}</b> {result.misconception.fix}
            </div>
          )}
          <div className="rounded-xl bg-white/5 px-3 py-2 text-sm text-white/90 ring-1 ring-white/10">
            <MathText text={result.explanation} />
          </div>
          <button type="button" onClick={() => onDone(result)} className="self-end w-btn w-btn--ghost w-btn--sm">
            {t("continue").replace(" →", "")}
            <ArrowRight size={16} className="ml-1 inline -translate-y-px" />
          </button>
        </div>
      )}
    </div>
  );
}
