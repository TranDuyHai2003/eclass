"use client";
/**
 * Story UI:
 *  - QuestTracker (Genshin-style, under the minimap): chapter, quest title, objective + progress
 *  - DialogueOverlay (Blue Archive-style): large portrait sliding in, name card with title, typewriter text, ▼ to advance
 *  - QuestDone: centre banner when a quest completes
 *  - ArchiveOverlay: codex of theorems and mathematicians unlocked through play
 */
import { useEffect, useState } from "react";
import { AnimatePresence, motion } from "motion/react";
import { BookOpen, ChevronDown, X } from "lucide-react";
import { useWorld } from "../store";
import { allQuests, chapterOf, CODEX, DIALOGUES, NPCS, type CodexId } from "@/lib/world/story";
import { advanceDialogue, initQuest, questProgress, useDialogue, useQuest } from "../story/quest";
import { worldAsset } from "@/lib/world/avatars";

function useLang(): "en" | "vi" {
  return useWorld((s) => (s.lang === "vi" ? "vi" : "en"));
}

export function QuestTracker() {
  const lang = useLang();
  const qi = useQuest((s) => s.qi);
  useQuest((s) => s.progress);
  useEffect(() => initQuest(), []);
  const q = allQuests()[qi];
  if (!q) return null;
  const { have, need } = questProgress();
  return (
    <AnimatePresence mode="wait">
      <motion.div key={q.id} className="w-quest" initial={{ opacity: 0, x: -16 }} animate={{ opacity: 1, x: 0 }} exit={{ opacity: 0, x: -10 }} transition={{ type: "spring", stiffness: 300, damping: 26 }}>
        <span className="w-quest__chapter">{chapterOf(qi).title[lang]}</span>
        <span className="w-quest__title">
          <i className="w-quest__gem" />
          {q.title[lang]}
        </span>
        <span className="w-quest__goal">
          {q.goal[lang]}
          {need > 1 && (
            <b>
              {" "}
              {have}/{need}
            </b>
          )}
        </span>
      </motion.div>
    </AnimatePresence>
  );
}

export function QuestDone() {
  const lang = useLang();
  const done = useQuest((s) => s.done);
  const [show, setShow] = useState<string | null>(null);
  useEffect(() => {
    if (!done) return;
    const q = allQuests().find((x) => x.id === done.title);
    setShow(q ? q.title[lang] : null);
    const t = window.setTimeout(() => setShow(null), 2600);
    return () => window.clearTimeout(t);
  }, [done, lang]);
  return (
    <AnimatePresence>
      {show && (
        <motion.div className="w-qdone" initial={{ opacity: 0, scaleX: 0.6 }} animate={{ opacity: 1, scaleX: 1 }} exit={{ opacity: 0, y: -10 }} transition={{ type: "spring", stiffness: 260, damping: 22 }}>
          <span className="w-qdone__kicker">{lang === "vi" ? "Hoàn thành nhiệm vụ" : "Quest complete"}</span>
          <span className="w-qdone__title">{show}</span>
        </motion.div>
      )}
    </AnimatePresence>
  );
}

/** Chữ chạy từng ký tự; chạm lần 1 hiện hết, lần 2 sang câu */
function useTypewriter(text: string, speed = 28) {
  const [n, setN] = useState(0);
  useEffect(() => {
    setN(0);
    const id = window.setInterval(() => setN((v) => (v >= text.length ? v : v + 1)), speed);
    return () => window.clearInterval(id);
  }, [text, speed]);
  return { shown: text.slice(0, n), full: n >= text.length, finish: () => setN(text.length) };
}

export function DialogueOverlay() {
  const lang = useLang();
  const id = useDialogue((s) => s.id);
  const i = useDialogue((s) => s.i);
  const line = id ? DIALOGUES[id]?.[i] : null;
  const npc = line && line.who !== "you" ? NPCS[line.who] : null;
  const tw = useTypewriter(line ? line.text[lang] : "");
  useEffect(() => {
    if (!id) return;
    if (document.pointerLockElement) document.exitPointerLock();
    const k = (e: KeyboardEvent) => {
      if (e.key === " " || e.key === "Enter" || e.key === "f" || e.key === "F") {
        e.preventDefault();
        // Chặn cả listener khác trên window (phím F cũng là "tương tác" → tránh mở lại hội thoại)
        e.stopImmediatePropagation();
        if (tw.full) advanceDialogue();
        else tw.finish();
      }
    };
    window.addEventListener("keydown", k, true);
    return () => window.removeEventListener("keydown", k, true);
  }, [id, tw]);
  return (
    <AnimatePresence>
      {id && line && (
        <motion.div className="w-dlg pointer-events-auto" initial={{ opacity: 0 }} animate={{ opacity: 1 }} exit={{ opacity: 0 }} onClick={() => (tw.full ? advanceDialogue() : tw.finish())}>
          <AnimatePresence mode="wait">
            {npc && (
              <motion.div key={npc.portrait} className="w-dlg__portrait" initial={{ x: -60, opacity: 0 }} animate={{ x: 0, opacity: 1 }} exit={{ x: -30, opacity: 0 }} transition={{ type: "spring", stiffness: 220, damping: 24 }}>
                {/* eslint-disable-next-line @next/next/no-img-element */}
                <img src={worldAsset(`portraits/${npc.portrait}.webp`)} alt="" draggable={false} onError={(e) => ((e.target as HTMLImageElement).style.visibility = "hidden")} />
              </motion.div>
            )}
          </AnimatePresence>
          <motion.div className="w-dlg__box" initial={{ y: 30 }} animate={{ y: 0 }} transition={{ type: "spring", stiffness: 320, damping: 28 }} style={{ ["--nc" as string]: npc?.color ?? "#7fe0d0" }}>
            {npc && (
              <div className="w-dlg__name">
                <b>{npc.name[lang]}</b>
                <span>{npc.title[lang]}</span>
              </div>
            )}
            <p className="w-dlg__text">{tw.shown}</p>
            {tw.full && (
              <motion.span className="w-dlg__next" animate={{ y: [0, 4, 0] }} transition={{ repeat: Infinity, duration: 0.9 }}>
                <ChevronDown size={18} strokeWidth={3} />
              </motion.span>
            )}
          </motion.div>
        </motion.div>
      )}
    </AnimatePresence>
  );
}

export function ArchiveOverlay({ onClose }: { onClose: () => void }) {
  const lang = useLang();
  const codex = useQuest((s) => s.codex);
  const all = Object.keys(CODEX) as CodexId[];
  const [sel, setSel] = useState<CodexId | null>(codex[0] ?? null);
  useEffect(() => {
    useQuest.setState({ freshCodex: [] });
  }, []);
  const e = sel ? CODEX[sel] : null;
  return (
    <motion.div className="w-modal pointer-events-auto" initial={{ opacity: 0 }} animate={{ opacity: 1 }} exit={{ opacity: 0 }} onClick={onClose}>
      <motion.div className="w-bag w-archive" initial={{ y: 24, opacity: 0 }} animate={{ y: 0, opacity: 1 }} exit={{ y: 16, opacity: 0 }} onClick={(ev) => ev.stopPropagation()}>
        <header className="w-bag__head">
          <span className="w-bag__title">
            <BookOpen size={18} /> {lang === "vi" ? "Thư khố Định lý" : "Archive of Theorems"}
          </span>
          <span className="w-archive__count">
            {codex.length}/{all.length}
          </span>
          <button type="button" className="w-round w-round--sm" onClick={onClose} aria-label="Close">
            <X strokeWidth={2.4} />
          </button>
        </header>
        <div className="w-bag__body">
          <div className="w-archive__list">
            {all.map((id) => {
              const open = codex.includes(id);
              return (
                <button key={id} type="button" disabled={!open} className={`w-archive__item ${sel === id ? "is-sel" : ""}`} onClick={() => setSel(id)}>
                  <span className="w-archive__no">{String(all.indexOf(id) + 1).padStart(2, "0")}</span>
                  <span>{open ? CODEX[id].title[lang] : "· · ·"}</span>
                </button>
              );
            })}
          </div>
          <AnimatePresence mode="wait">
            <motion.article key={sel ?? "none"} className="w-bag__detail w-archive__page" initial={{ opacity: 0, x: 12 }} animate={{ opacity: 1, x: 0 }} exit={{ opacity: 0 }}>
              {e ? (
                <>
                  <h3 className="w-detail__name">{e.title[lang]}</h3>
                  <p className="w-detail__meta">{e.who[lang]}</p>
                  <p className="w-detail__text">{e.body[lang]}</p>
                </>
              ) : (
                <p className="w-detail__text opacity-70">{lang === "vi" ? "Hoàn thành nhiệm vụ để mở các trang Thư khố." : "Complete quests to unlock Archive pages."}</p>
              )}
            </motion.article>
          </AnimatePresence>
        </div>
      </motion.div>
    </motion.div>
  );
}
