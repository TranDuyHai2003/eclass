"use client";
/**
 * Tesseract console — a cyberpunk HOLOGRAM UI (TESSERACT_BOOTH.md §7.6), not a web card grid.
 * Opens with a scan-in (clip-path wipe + flicker); a star map with the five universes on a pentagon (same 5-fold
 * symmetry as the console); each node has its own animated SVG line glyph; selecting draws a dashed jump route from
 * "you are here"; the info panel shows the idea + pseudo coordinates and a big ENGAGE bar. Esc / outside click closes.
 */
import { useEffect, useState } from "react";
import { motion } from "motion/react";
import { X } from "lucide-react";
import { useWorld } from "../store";
import { DESTS, travelTo, useBooth, type Dest } from "../scene/boothState";
import "./holo.css";

const R = 118; // bán kính ngũ giác trên bản đồ (px trong hệ 320×320)
const C = 160;
const nodePos = (i: number) => {
  const a = -Math.PI / 2 + (i * 2 * Math.PI) / 5;
  return { x: C + Math.cos(a) * R, y: C + Math.sin(a) * R };
};

/** Biểu tượng nét mảnh động cho từng vũ trụ */
function Glyph({ id }: { id: Dest }) {
  switch (id) {
    case "solar":
      return (
        <svg viewBox="-20 -20 40 40" className="w-holo__glyph">
          <circle r="4" className="g-fill" />
          {[8, 12.5, 17].map((r, i) => (
            <g key={r} className="g-spin" style={{ animationDuration: `${3 * Math.pow(r / 8, 1.5)}s` }}>
              <ellipse rx={r} ry={r * 0.92} className="g-line g-dim" />
              <circle cx={r} r={1.6 + i * 0.3} className="g-fill" />
            </g>
          ))}
        </svg>
      );
    case "blackhole":
      return (
        <svg viewBox="-20 -20 40 40" className="w-holo__glyph">
          <ellipse rx="17" ry="5" className="g-line g-spin-x" />
          <circle r="7" className="g-void" />
          <circle r="8.2" className="g-line g-pulse" />
          <path d="M-17 0 A17 9 0 0 1 17 0" className="g-line g-dim" />
        </svg>
      );
    case "lorenz": {
      // vẽ sẵn một đoạn quỹ đạo Lorenz (Euler) chiếu xz
      let x = 0.1;
      let y = 0;
      let z = 0;
      const pts: string[] = [];
      for (let i = 0; i < 1400; i++) {
        const dt = 0.008;
        const dx = 10 * (y - x);
        const dy = x * (28 - z) - y;
        const dz = x * y - (8 / 3) * z;
        x += dx * dt;
        y += dy * dt;
        z += dz * dt;
        if (i > 100 && i % 3 === 0) pts.push(`${(x * 0.75).toFixed(1)},${(17 - z * 0.62).toFixed(1)}`);
      }
      return (
        <svg viewBox="-20 -20 40 40" className="w-holo__glyph">
          <polyline points={pts.join(" ")} className="g-line g-draw" />
        </svg>
      );
    }
    case "poincare":
      return (
        <svg viewBox="-20 -20 40 40" className="w-holo__glyph">
          <circle r="17" className="g-line" />
          {[0, 1, 2, 3, 4, 5].map((k) => {
            const a = (k * Math.PI) / 3;
            const b = a + Math.PI / 3;
            return <path key={k} d={`M${17 * Math.cos(a)} ${17 * Math.sin(a)} A 9.8 9.8 0 0 0 ${17 * Math.cos(b)} ${17 * Math.sin(b)}`} className="g-line g-dim" />;
          })}
          <polygon points="0,-8 6.9,4 -6.9,4" className="g-line g-spin" />
        </svg>
      );
    default:
      return (
        <svg viewBox="-20 -20 40 40" className="w-holo__glyph">
          <rect x="-14" y="-14" width="28" height="28" className="g-line" />
          <rect x="-6" y="-6" width="12" height="12" className="g-line g-pulse" />
          <path d="M-14 -14 L-6 -6 M14 -14 L6 -6 M14 14 L6 6 M-14 14 L-6 6" className="g-line g-dim" />
        </svg>
      );
  }
}

const coord = (id: string) => {
  let h = 0;
  for (const ch of id) h = (h * 31 + ch.charCodeAt(0)) >>> 0;
  return `${(h % 360).toString().padStart(3, "0")}°${((h >> 9) % 60).toString().padStart(2, "0")}′ · ${(((h >> 3) % 180) - 90).toString()}°${((h >> 14) % 60).toString().padStart(2, "0")}′ · ${((h >> 5) % 9000) / 10} ly`;
};

export function HoloConsole({ onClose }: { onClose: () => void }) {
  const lang = useWorld((s) => (s.lang === "vi" ? "vi" : "en"));
  const dest = useBooth((s) => s.dest);
  const traveling = useBooth((s) => !!s.to);
  const [sel, setSel] = useState<Dest>(DESTS.find((d) => d.id !== dest)?.id ?? "blackhole");
  useEffect(() => {
    const k = (e: KeyboardEvent) => {
      if (e.key === "Escape") onClose();
    };
    window.addEventListener("keydown", k);
    return () => window.removeEventListener("keydown", k);
  }, [onClose]);
  const here = DESTS.findIndex((d) => d.id === dest);
  const pick = DESTS.findIndex((d) => d.id === sel);
  const a = nodePos(here);
  const b = nodePos(pick);
  const info = DESTS[pick];
  const engage = () => {
    if (sel === dest || traveling) return;
    travelTo(sel);
    onClose();
  };
  return (
    <motion.div className="w-modal w-holo-modal pointer-events-auto" initial={{ opacity: 0 }} animate={{ opacity: 1 }} exit={{ opacity: 0 }} onClick={onClose}>
      <motion.div
        className="w-holo"
        initial={{ clipPath: "inset(48% 0% 48% 0%)", opacity: 0.2 }}
        animate={{ clipPath: "inset(0% 0% 0% 0%)", opacity: [0.2, 1, 0.6, 1] }}
        exit={{ clipPath: "inset(48% 0% 48% 0%)", opacity: 0 }}
        transition={{ duration: 0.45, ease: [0.16, 1, 0.3, 1] }}
        onClick={(e) => e.stopPropagation()}
      >
        <div className="w-holo__scan" aria-hidden />
        <header className="w-holo__head">
          <span className="w-holo__kicker">HX-4 · TESSERACT CONSOLE</span>
          <h2 className="w-holo__title">{lang === "vi" ? "Chọn vũ trụ đích" : "Select a universe"}</h2>
          <button type="button" className="w-holo__x" onClick={onClose} aria-label="Close">
            <X strokeWidth={2.2} />
          </button>
        </header>
        <div className="w-holo__body">
          <div className="w-holo__map">
            <svg viewBox="0 0 320 320" className="w-holo__mapsvg" aria-hidden>
              {[40, 80, 118, 150].map((r) => (
                <circle key={r} cx={C} cy={C} r={r} className="m-ring" />
              ))}
              <circle cx={C} cy={C} r={150} className="m-ticks" />
              <polygon points={DESTS.map((_, i) => `${nodePos(i).x},${nodePos(i).y}`).join(" ")} className="m-pent" />
              <polygon points={[0, 2, 4, 1, 3].map((i) => `${nodePos(i).x},${nodePos(i).y}`).join(" ")} className="m-star" />
              {pick !== here && <line x1={a.x} y1={a.y} x2={b.x} y2={b.y} className="m-route" />}
              <g className="m-sweep">
                <path d={`M${C} ${C} L${C} ${C - 150} A150 150 0 0 1 ${C + 106} ${C - 106} Z`} />
              </g>
            </svg>
            {DESTS.map((d, i) => {
              const p = nodePos(i);
              return (
                <button
                  key={d.id}
                  type="button"
                  className={`w-holo__node${d.id === sel ? " is-sel" : ""}${d.id === dest ? " is-here" : ""}`}
                  style={{ left: `${(p.x / 320) * 100}%`, top: `${(p.y / 320) * 100}%` }}
                  onClick={() => setSel(d.id)}
                  onDoubleClick={() => {
                    setSel(d.id);
                    if (d.id !== dest) {
                      travelTo(d.id);
                      onClose();
                    }
                  }}
                >
                  <Glyph id={d.id} />
                  <span className="w-holo__nodename">{d.name[lang]}</span>
                  {d.id === dest && <span className="w-holo__here">{lang === "vi" ? "ĐANG Ở ĐÂY" : "YOU ARE HERE"}</span>}
                </button>
              );
            })}
          </div>
          <aside className="w-holo__info">
            <span className="w-holo__label">{lang === "vi" ? "ĐÍCH ĐẾN" : "DESTINATION"}</span>
            <h3 className="w-holo__name">{info.name[lang]}</h3>
            <p className="w-holo__idea">{info.idea[lang]}</p>
            <dl className="w-holo__meta">
              <dt>{lang === "vi" ? "Toạ độ" : "Coords"}</dt>
              <dd>{coord(info.id)}</dd>
              <dt>{lang === "vi" ? "Bước gấp" : "Fold"}</dt>
              <dd>4.8 s · Shepard ↑</dd>
            </dl>
            <button type="button" className="w-holo__engage" disabled={sel === dest || traveling} onClick={engage}>
              <span>{sel === dest ? (lang === "vi" ? "ĐANG Ở ĐÂY" : "YOU ARE HERE") : traveling ? (lang === "vi" ? "ĐANG GẤP KHÔNG GIAN…" : "FOLDING…") : lang === "vi" ? "KHỞI HÀNH" : "ENGAGE"}</span>
              <i aria-hidden />
            </button>
          </aside>
        </div>
      </motion.div>
    </motion.div>
  );
}
