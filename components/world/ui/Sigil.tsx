"use client";
/**
 * Sigil overlay: draw one stroke on the screen to cast. A glowing ink trail follows the finger/mouse;
 * on release the stroke is recognised (combat/spells.ts) and the spell fires with a precision multiplier.
 * The overlay owns all pointer input while open, so camera drag and attacks don't fire underneath.
 */
import { useEffect, useRef, useState } from "react";
import { AnimatePresence, motion } from "motion/react";
import { PenLine, X } from "lucide-react";
import { useWorld } from "../store";
import { useCombat } from "../combat/combat";
import { SPELLS, SPELL_CD, castSpell, recognize, tier, type SpellId } from "../combat/spells";
import { CAST, castFlash } from "../fx/CastAura";

const GUIDES: { id: SpellId; d: string }[] = [
  { id: "shield", d: "M20 6 A14 14 0 1 1 19.9 6" },
  { id: "bolt", d: "M4 10 L14 30 L22 10 L30 30 L36 10" },
  { id: "vortex", d: "M20 20 m0 -2 a2 2 0 1 1 -2 2 a5 5 0 1 1 6 -5 a9 9 0 1 1 -12 9 a13 13 0 1 1 15 -14" },
  { id: "meteor", d: "M4 32 Q20 -6 36 32" },
  { id: "wave", d: "M2 20 Q8 6 14 20 T26 20 T38 20" },
];

export function SigilButton({ onOpen }: { onOpen: () => void }) {
  const spellAt = useCombat((s) => s.spellAt);
  const [left, setLeft] = useState(0);
  useEffect(() => {
    const tick = () => setLeft(Math.max(0, SPELL_CD - (performance.now() - spellAt)));
    tick();
    const id = window.setInterval(tick, 100);
    return () => window.clearInterval(id);
  }, [spellAt]);
  return (
    <motion.button type="button" whileTap={{ scale: 0.88 }} onClick={onOpen} className="w-skill w-skill--sigil" style={{ width: "calc(var(--u) * 50px)", height: "calc(var(--u) * 50px)" }} aria-label="Sigil" title="Sigil (T)">
      <PenLine className="w-skill__icon" strokeWidth={2.2} />
      {left > 0 && (
        <>
          <span className="w-skill__cd" style={{ background: `conic-gradient(rgba(10,12,28,.72) ${(left / SPELL_CD) * 360}deg, transparent 0)` }} />
          <span className="w-skill__num">{(left / 1000).toFixed(1)}</span>
        </>
      )}
      <span className="w-key">T</span>
    </motion.button>
  );
}

export function SigilOverlay({ onClose }: { onClose: () => void }) {
  const lang = useWorld((s) => (s.lang === "vi" ? "vi" : "en"));
  const cv = useRef<HTMLCanvasElement>(null);
  const pts = useRef<{ x: number; y: number }[]>([]);
  const drawing = useRef(false);
  const [result, setResult] = useState<{ id: SpellId; label: string; mult: number } | null>(null);
  const [miss, setMiss] = useState(0);
  // hào quang niệm phép tắt khi đóng bảng vẽ (huỷ giữa chừng)
  useEffect(
    () => () => {
      if (CAST.on) {
        CAST.on = false;
        CAST.endAt = performance.now();
      }
    },
    [],
  );
  useEffect(() => {
    if (document.pointerLockElement) document.exitPointerLock();
    const c = cv.current;
    if (!c) return;
    const dpr = Math.min(2, window.devicePixelRatio || 1);
    c.width = c.clientWidth * dpr;
    c.height = c.clientHeight * dpr;
    c.getContext("2d")?.scale(dpr, dpr);
  }, []);
  const paint = () => {
    const c = cv.current;
    const g = c?.getContext("2d");
    if (!c || !g) return;
    g.clearRect(0, 0, c.width, c.height);
    const P = pts.current;
    if (P.length < 2) return;
    g.lineCap = "round";
    g.lineJoin = "round";
    // Nét mực phát sáng 2 lớp: quầng màu + lõi trắng
    for (const [wd, col, blur] of [[10, "rgba(180,140,255,.55)", 18], [3.5, "#fff6dc", 6]] as const) {
      g.strokeStyle = col;
      g.lineWidth = wd;
      g.shadowColor = "#b48cff";
      g.shadowBlur = blur;
      g.beginPath();
      g.moveTo(P[0].x, P[0].y);
      for (let i = 1; i < P.length; i++) g.lineTo(P[i].x, P[i].y);
      g.stroke();
    }
  };
  const pos = (e: React.PointerEvent) => {
    const r = cv.current!.getBoundingClientRect();
    return { x: e.clientX - r.left, y: e.clientY - r.top };
  };
  return (
    <motion.div className="w-sigil pointer-events-auto" initial={{ opacity: 0 }} animate={{ opacity: 1 }} exit={{ opacity: 0 }}>
      <canvas
        ref={cv}
        className="absolute inset-0 h-full w-full touch-none"
        onPointerDown={(e) => {
          e.stopPropagation();
          try {
            (e.target as HTMLElement).setPointerCapture(e.pointerId);
          } catch {
            /* một số thiết bị / sự kiện giả lập không cho capture — vẫn vẽ được */
          }
          drawing.current = true;
          pts.current = [pos(e)];
          // hào quang dưới chân bật ngay khi bắt đầu vẽ
          CAST.on = true;
          CAST.born = performance.now();
          CAST.progress = 0;
          CAST.color = "#ffe6a8";
          setResult(null);
          paint();
        }}
        onPointerMove={(e) => {
          if (!drawing.current) return;
          const ev = e.nativeEvent as PointerEvent & { getCoalescedEvents?: () => PointerEvent[] };
          const r = cv.current!.getBoundingClientRect();
          // getCoalescedEvents có thể trả mảng rỗng (một số trình duyệt / sự kiện không tin cậy) → dùng chính sự kiện
          const list = ev.getCoalescedEvents?.();
          for (const c of list && list.length ? list : [ev]) pts.current.push({ x: c.clientX - r.left, y: c.clientY - r.top });
          CAST.progress = Math.min(1, pts.current.length / 140);
          paint();
        }}
        onPointerUp={() => {
          if (!drawing.current) return;
          drawing.current = false;
          const r = recognize(pts.current);
          if (!r) {
            setMiss((m) => m + 1);
            CAST.on = false;
            CAST.endAt = performance.now();
            return;
          }
          const t = tier(r.score);
          setResult({ id: r.id, ...t });
          // nhận ra phép: hào quang đổi sang màu phép, giữ tới lúc phát
          CAST.color = SPELLS[r.id].color;
          CAST.progress = 1;
          window.setTimeout(() => {
            if (castSpell(r.id, t.mult)) castFlash(SPELLS[r.id].color);
            CAST.on = false;
            CAST.endAt = performance.now();
            onClose();
          }, 520);
        }}
      />
      <div className="w-sigil__ring" />
      <AnimatePresence mode="wait">
        {result ? (
          <motion.div key="res" className="w-sigil__result" initial={{ scale: 0.6, opacity: 0 }} animate={{ scale: 1, opacity: 1 }} transition={{ type: "spring", stiffness: 420, damping: 18 }} style={{ ["--sc" as string]: SPELLS[result.id].color }}>
            <span className="w-sigil__tier">
              {result.label} ×{result.mult}
            </span>
            <span className="w-sigil__name">{SPELLS[result.id].name[lang]}</span>
            <span className="w-sigil__idea">{SPELLS[result.id].idea[lang]}</span>
          </motion.div>
        ) : (
          <motion.p key={`hint${miss}`} className="w-sigil__hint" initial={{ x: miss ? -10 : 0, opacity: 0 }} animate={{ x: 0, opacity: 1 }} transition={{ type: "spring", stiffness: 600, damping: 12 }}>
            {miss ? (lang === "vi" ? "Chưa nhận ra hình — thử vẽ to và liền một nét" : "Shape not recognised — draw bigger, in one stroke") : lang === "vi" ? "Vẽ một nét để niệm phép" : "Draw one stroke to cast"}
          </motion.p>
        )}
      </AnimatePresence>
      <div className="w-sigil__guides">
        {GUIDES.map((g) => (
          <div key={g.id} className="w-sigil__guide" style={{ ["--sc" as string]: SPELLS[g.id].color }}>
            <svg viewBox="0 0 40 40">
              <path d={g.d} />
            </svg>
            <span>{SPELLS[g.id].name[lang]}</span>
          </div>
        ))}
      </div>
      <button type="button" className="w-round w-sigil__close" onClick={onClose} aria-label="Close">
        <X strokeWidth={2.4} />
      </button>
    </motion.div>
  );
}
