"use client";
/**
 * Sigil overlay: draw one stroke on the screen to cast. A glowing ink trail follows the finger/mouse;
 * on release the stroke is recognised (combat/spells.ts) and the spell fires with a precision multiplier.
 * The overlay owns all pointer input while open, so camera drag and attacks don't fire underneath.
 * T24 (VFX phép vẽ): nét graphite sắc + lõi nhạt + đầu sao chổi và ngòi sáng bám con trỏ (vẽ theo rAF, không shadowBlur);
 * nhận dạng tạm thời ~14 lần/s, kết quả ổn định ≥ 75 ms → nét + hào quang đổi màu phép, glyph chuẩn nhỏ cạnh ngòi, gợi ý sáng lên;
 * thả tay đúng: màu quét dọc nét 60 ms → glyph chuẩn "khớp" lên nét (150 ms) + vòng loé theo bậc (Perfect 3 · Good 2 · OK 1,
 * Rough rung); không nhận ra: nét tan từ đuôi 130 ms + đánh dấu điểm đầu / cuối để thấy chỗ hở.
 */
import { useEffect, useRef, useState } from "react";
import { AnimatePresence, motion } from "motion/react";
import { PenLine, X } from "lucide-react";
import { useWorld } from "../store";
import { useCombat } from "../combat/combat";
import { SPELLS, SPELL_CD, castSpell, recognize, tier, type SpellId } from "../combat/spells";
import { CAST } from "../fx/CastAura";
import { fxCast } from "../fx/SpellFx";
import { SPELL_PALETTE, StableMatch, clamp01, easeInQuad, easeOutCubic, idealGlyph, tierFeedback } from "@/lib/world/spellFx";
import { sfx } from "@/lib/world/sfx";
import { worldAsset } from "@/lib/world/avatars";

// rune 5 phép (public/world/fx/tex/spell_runes.png, 5 ô 256² xám — scripts/spell-fx-art.py): tải một lần, nhuộm màu phép một lần
const RUNE_ORDER: SpellId[] = ["shield", "bolt", "vortex", "meteor", "wave"];
let runeImg: HTMLImageElement | null = null;
const runeTint = new Map<SpellId, HTMLCanvasElement>();
function loadRunes() {
  if (runeImg || typeof Image === "undefined") return;
  runeImg = new Image();
  runeImg.src = worldAsset("fx/tex/spell_runes.png");
}
function tintedRune(id: SpellId): HTMLCanvasElement | null {
  const hit = runeTint.get(id);
  if (hit) return hit;
  if (!runeImg?.complete || !runeImg.naturalWidth) return null;
  const c = document.createElement("canvas");
  c.width = c.height = 256;
  const g = c.getContext("2d");
  if (!g) return null;
  g.drawImage(runeImg, RUNE_ORDER.indexOf(id) * 256, 0, 256, 256, 0, 0, 256, 256);
  // trắng × màu phép = rune màu trên nền đen
  g.globalCompositeOperation = "multiply";
  g.fillStyle = SPELL_PALETTE[id].body;
  g.fillRect(0, 0, 256, 256);
  runeTint.set(id, c);
  return c;
}

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

// ───────────── Nét vẽ (T24): canvas 2D, vẽ theo khung hình (rAF), KHÔNG shadowBlur ─────────────
const MAXPTS = 2048;
const NEUTRAL = "#c9b8ff";
type Phase = { kind: "idle" | "draw" | "accept" | "reject"; t0: number };
type Spark2 = { x: number; y: number; vx: number; vy: number; life: number };

function strokePath(g: CanvasRenderingContext2D, b: Float32Array, from: number, to: number) {
  g.beginPath();
  g.moveTo(b[from * 2], b[from * 2 + 1]);
  for (let i = from + 1; i < to; i++) g.lineTo(b[i * 2], b[i * 2 + 1]);
  g.stroke();
}

export function SigilOverlay({ onClose }: { onClose: () => void }) {
  const lang = useWorld((s) => (s.lang === "vi" ? "vi" : "en"));
  const cv = useRef<HTMLCanvasElement>(null);
  // điểm nét vẽ: bộ đệm typed cố định (x, y) — không cấp phát khi di chuột
  const st = useRef({
    buf: new Float32Array(MAXPTS * 2),
    n: 0,
    dirty: false,
    phase: { kind: "idle", t0: 0 } as Phase,
    match: new StableMatch<SpellId>(75),
    lastCheck: 0,
    likely: null as SpellId | null,
    acc: null as null | { id: SpellId; label: string; glyph: Float32Array; gn: number; cx: number; cy: number; size: number; rev: boolean },
    sparks: [] as Spark2[],
    sparked: false,
  });
  const [likely, setLikely] = useState<SpellId | null>(null);
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
    const g = c.getContext("2d");
    if (!g) return;
    g.scale(dpr, dpr);
    g.lineCap = "round";
    g.lineJoin = "round";
    const S = st.current;
    loadRunes();
    let raf = 0;
    const paint = (now: number) => {
      const { buf, n, phase } = S;
      g.clearRect(0, 0, c.clientWidth, c.clientHeight);
      if (n < 2 && phase.kind !== "accept") return;
      const age = now - phase.t0;
      const tint = phase.kind === "accept" && S.acc ? SPELL_PALETTE[S.acc.id].body : S.likely ? SPELL_PALETTE[S.likely].body : NEUTRAL;
      // nét tay: tối dần khi glyph chuẩn "khớp" lên (accept), tan từ đuôi tới ngòi khi không nhận ra (reject 130 ms)
      let from = 0;
      let handA = 1;
      if (phase.kind === "reject") {
        from = Math.min(n - 1, Math.floor(n * easeInQuad(age / 130)));
        handA = 1 - clamp01(age / 130) * 0.4;
      } else if (phase.kind === "accept") handA = 1 - 0.75 * clamp01((age - 60) / 200);
      if (n - from >= 2) {
        g.globalAlpha = handA;
        // 1) quầng màu rộng (cộng sáng) 2) mép mực graphite 3) lõi nhạt — nét luôn sắc, nổi trên cảnh
        g.globalCompositeOperation = "lighter";
        g.strokeStyle = tint;
        g.globalAlpha = 0.16 * handA;
        g.lineWidth = 16;
        strokePath(g, buf, from, n);
        g.globalCompositeOperation = "source-over";
        g.globalAlpha = 0.85 * handA;
        g.strokeStyle = "#1a1430";
        g.lineWidth = 6;
        strokePath(g, buf, from, n);
        g.globalAlpha = handA;
        g.strokeStyle = "#fff6dc";
        g.lineWidth = 2.4;
        strokePath(g, buf, from, n);
        // nhận ra: màu phép quét từ đuôi tới ngòi trong 60 ms
        if (phase.kind === "accept") {
          const sw = Math.max(2, Math.floor(n * easeOutCubic(age / 60)));
          g.strokeStyle = tint;
          g.lineWidth = 3.6;
          strokePath(g, buf, 0, sw);
        }
        // đầu sao chổi: ~28 điểm cuối sáng màu (đi theo con trỏ)
        if (phase.kind === "draw") {
          const h0 = Math.max(0, n - 28);
          g.globalCompositeOperation = "lighter";
          g.globalAlpha = 0.75;
          g.strokeStyle = tint;
          g.lineWidth = 7;
          strokePath(g, buf, h0, n);
          g.globalAlpha = 1;
          g.strokeStyle = "#ffffff";
          g.lineWidth = 2.6;
          strokePath(g, buf, h0, n);
          // ngòi bút: chấm sáng thở nhẹ — vẫn thấy được bên cạnh đầu ngón tay
          const x = buf[n * 2 - 2];
          const y = buf[n * 2 - 1];
          const r = 11 + 2 * Math.sin(now / 90);
          const grd = g.createRadialGradient(x, y, 0, x, y, r);
          grd.addColorStop(0, "rgba(255,255,255,0.95)");
          grd.addColorStop(0.35, tint);
          grd.addColorStop(1, "rgba(0,0,0,0)");
          g.fillStyle = grd;
          g.globalAlpha = 0.9;
          g.beginPath();
          g.arc(x, y, r, 0, Math.PI * 2);
          g.fill();
          // "có vẻ là": glyph chuẩn nhỏ cạnh ngòi (nét tay vẫn giữ nguyên)
          if (S.likely) {
            const gb = GLYPH_TMP;
            const m = idealGlyph(S.likely, gb, 40);
            g.globalAlpha = 0.85;
            g.strokeStyle = tint;
            g.lineWidth = 2;
            g.beginPath();
            for (let i = 0; i < m; i++) {
              const px = x + 30 + gb[i * 2] * 30;
              const py = y - 30 + gb[i * 2 + 1] * 30;
              if (i) g.lineTo(px, py);
              else g.moveTo(px, py);
            }
            g.stroke();
          }
        }
        g.globalCompositeOperation = "source-over";
      }
      // không nhận ra: đánh dấu điểm đầu / cuối 600 ms (thấy chỗ hở của vòng tròn chưa khép, nét bị đứt…)
      if (phase.kind === "reject" && age < 600 && n >= 2) {
        g.globalAlpha = 1 - clamp01((age - 350) / 250);
        g.strokeStyle = "#ff9a9a";
        g.lineWidth = 2;
        for (const i of [0, n - 1]) {
          g.beginPath();
          g.arc(buf[i * 2], buf[i * 2 + 1], 7, 0, Math.PI * 2);
          g.stroke();
        }
      }
      // khớp glyph chuẩn: vẽ lên từ 60 ms (150 ms), vòng loé theo bậc chính xác, tia toả
      const A = S.acc;
      if (phase.kind === "accept" && A && age >= 60) {
        const P = SPELL_PALETTE[A.id];
        const tf = tierFeedback(A.label);
        const k = easeOutCubic((age - 60) / 150);
        const m = Math.max(2, Math.floor(A.gn * k));
        const jx = tf.shake ? Math.sin(age * 0.21) * 3 * (1 - k * 0.5) : 0;
        const jy = tf.shake ? Math.cos(age * 0.17) * 3 * (1 - k * 0.5) : 0;
        const pulse = 0.85 + 0.15 * Math.sin(age / 60);
        const layers: [string, number, number, GlobalCompositeOperation][] = [
          [P.body, 18, 0.32 * pulse, "lighter"],
          [P.ink, 7.5, 0.95, "source-over"],
          [P.body, 4.2, 1, "source-over"],
          [P.core, 1.8, 1, "lighter"],
        ];
        for (const [col, wd, al, op] of layers) {
          g.globalCompositeOperation = op;
          g.globalAlpha = al;
          g.strokeStyle = col;
          g.lineWidth = wd;
          g.beginPath();
          for (let i = 0; i < m; i++) {
            const j = A.rev ? A.gn - 1 - i : i;
            const px = A.glyph[j * 2] + jx;
            const py = A.glyph[j * 2 + 1] + jy;
            if (i) g.lineTo(px, py);
            else g.moveTo(px, py);
          }
          g.stroke();
        }
        g.globalCompositeOperation = "lighter";
        // rune riêng của phép hiện lên giữa glyph: thu 1,25 → 1 trong 160 ms, sáng theo màu phép (cộng sáng: nền đen không thêm gì)
        const rc = tintedRune(A.id);
        if (rc) {
          const ka = easeOutCubic((age - 60) / 160);
          const rs = Math.min(360, Math.max(120, A.size * 1.05)) * (1.25 - 0.25 * ka);
          g.globalAlpha = 0.85 * ka * (0.85 + 0.15 * Math.sin(age / 60));
          g.drawImage(rc, A.cx - rs / 2, A.cy - rs / 2, rs, rs);
        }
        for (let r = 0; r < tf.rings; r++) {
          const ra = age - 60 - r * 55;
          if (ra < 0 || ra > 300) continue;
          g.globalAlpha = 1 - ra / 300;
          g.strokeStyle = r ? tf.color : P.body;
          g.lineWidth = 3 - r * 0.6;
          g.beginPath();
          g.arc(A.cx, A.cy, A.size * (0.55 + 0.5 * easeOutCubic(ra / 300)) + r * 10, 0, Math.PI * 2);
          g.stroke();
        }
        if (!S.sparked) {
          S.sparked = true;
          for (let i = 0; i < tf.sparks; i++) {
            const a = (i / tf.sparks) * Math.PI * 2 + Math.random() * 0.3;
            const sp = 0.5 + Math.random() * 0.6;
            S.sparks.push({ x: A.cx + Math.cos(a) * A.size * 0.45, y: A.cy + Math.sin(a) * A.size * 0.45, vx: Math.cos(a) * sp, vy: Math.sin(a) * sp, life: 0 });
          }
        }
        g.strokeStyle = P.core;
        g.lineWidth = 2;
        for (const s of S.sparks) {
          const t = s.life / 300;
          if (t >= 1) continue;
          g.globalAlpha = 1 - t;
          const x = s.x + s.vx * s.life;
          const y = s.y + s.vy * s.life;
          g.beginPath();
          g.moveTo(x, y);
          g.lineTo(x + s.vx * 18 * (1 - t), y + s.vy * 18 * (1 - t));
          g.stroke();
        }
        g.globalCompositeOperation = "source-over";
      }
      g.globalAlpha = 1;
    };
    let last = performance.now();
    const loop = (now: number) => {
      raf = requestAnimationFrame(loop);
      const dt = now - last;
      last = now;
      for (const s of S.sparks) s.life += dt;
      const k = S.phase.kind;
      const animating = k === "accept" || (k === "reject" && now - S.phase.t0 < 650) || k === "draw";
      if (!S.dirty && !animating) return;
      S.dirty = false;
      paint(now);
    };
    raf = requestAnimationFrame(loop);
    return () => cancelAnimationFrame(raf);
  }, []);
  const add = (x: number, y: number) => {
    const S = st.current;
    const i = S.n;
    if (i >= MAXPTS) return;
    // bỏ điểm sát nhau (< 1,5 px) — giữ nguyên góc gãy vì chỉ lọc theo khoảng cách
    if (i && Math.hypot(x - S.buf[i * 2 - 2], y - S.buf[i * 2 - 1]) < 1.5) return;
    S.buf[i * 2] = x;
    S.buf[i * 2 + 1] = y;
    S.n++;
    S.dirty = true;
  };
  const points = () => {
    const S = st.current;
    const out: { x: number; y: number }[] = new Array(S.n);
    for (let i = 0; i < S.n; i++) out[i] = { x: S.buf[i * 2], y: S.buf[i * 2 + 1] };
    return out;
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
          const S = st.current;
          if (S.phase.kind === "accept") return;
          S.phase = { kind: "draw", t0: performance.now() };
          S.n = 0;
          S.match.reset();
          S.likely = null;
          S.acc = null;
          S.sparks.length = 0;
          S.sparked = false;
          setLikely(null);
          const r = cv.current!.getBoundingClientRect();
          add(e.clientX - r.left, e.clientY - r.top);
          // hào quang dưới chân bật ngay khi bắt đầu vẽ
          CAST.on = true;
          CAST.born = performance.now();
          CAST.progress = 0;
          CAST.color = "#ffe6a8";
          sfx.sigilStart();
          setResult(null);
        }}
        onPointerMove={(e) => {
          const S = st.current;
          if (S.phase.kind !== "draw") return;
          const ev = e.nativeEvent as PointerEvent & { getCoalescedEvents?: () => PointerEvent[] };
          const r = cv.current!.getBoundingClientRect();
          // getCoalescedEvents có thể trả mảng rỗng (một số trình duyệt / sự kiện không tin cậy) → dùng chính sự kiện
          const list = ev.getCoalescedEvents?.();
          if (list && list.length) for (const c of list) add(c.clientX - r.left, c.clientY - r.top);
          else add(ev.clientX - r.left, ev.clientY - r.top);
          CAST.progress = Math.min(1, S.n / 140);
          // nhận dạng tạm thời ~14 lần/s; chỉ báo "có vẻ là" khi kết quả giữ ổn định ≥ 75 ms
          const now = performance.now();
          if (S.n >= 12 && now - S.lastCheck >= 70) {
            S.lastCheck = now;
            const g = recognize(points());
            const s = S.match.push(g ? g.id : null, now);
            if (s !== S.likely) {
              S.likely = s;
              setLikely(s);
              CAST.color = s ? SPELL_PALETTE[s].body : "#ffe6a8";
            }
          }
        }}
        onPointerUp={() => {
          const S = st.current;
          if (S.phase.kind !== "draw") return;
          const now = performance.now();
          const r = recognize(points());
          if (!r) {
            S.phase = { kind: "reject", t0: now };
            S.likely = null;
            setLikely(null);
            sfx.sigilFail();
            setMiss((m) => m + 1);
            CAST.on = false;
            CAST.endAt = now;
            return;
          }
          const t = tier(r.score);
          S.acc = fitGlyph(r.id, t.label, S.buf, S.n);
          S.phase = { kind: "accept", t0: now };
          S.likely = r.id;
          setLikely(r.id);
          setResult({ id: r.id, ...t });
          // nhận ra phép: hào quang đổi sang màu phép, giữ tới lúc phát
          CAST.color = SPELLS[r.id].color;
          CAST.progress = 1;
          sfx.sigilLock(r.id);
          window.setTimeout(() => {
            if (castSpell(r.id, t.mult)) fxCast(r.id, t.label);
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
          <div key={g.id} className={`w-sigil__guide${likely === g.id ? " is-likely" : ""}`} style={{ ["--sc" as string]: SPELLS[g.id].color }}>
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

const GLYPH_TMP = new Float32Array(64 * 2);

/** Đặt glyph chuẩn của phép lên đúng hộp / chiều của nét tay (toạ độ màn hình) */
function fitGlyph(id: SpellId, label: string, b: Float32Array, n: number) {
  let x0 = Infinity;
  let y0 = Infinity;
  let x1 = -Infinity;
  let y1 = -Infinity;
  let area = 0;
  for (let i = 0; i < n; i++) {
    const x = b[i * 2];
    const y = b[i * 2 + 1];
    x0 = Math.min(x0, x);
    x1 = Math.max(x1, x);
    y0 = Math.min(y0, y);
    y1 = Math.max(y1, y);
    if (i) area += b[i * 2 - 2] * y - x * b[i * 2 - 1];
  }
  const cx = (x0 + x1) / 2;
  const cy = (y0 + y1) / 2;
  const w = Math.max(1, x1 - x0);
  const h = Math.max(w * 0.25, y1 - y0);
  const size = Math.max(w, h);
  const gn = 64;
  const glyph = new Float32Array(gn * 2);
  let rev = false;
  let flipY = false;
  let dir = 1;
  const sx = b[0];
  const sy = b[1];
  const ex = b[n * 2 - 2];
  const ey = b[n * 2 - 1];
  if (id === "shield" || id === "vortex") {
    // màn hình y hướng xuống: diện tích có dấu > 0 = quay chiều kim đồng hồ
    dir = area > 0 ? 1 : -1;
    if (id === "vortex") {
      // vẽ từ ngoài vào → glyph (xoắn ra) chạy ngược, chiều quay đảo theo
      rev = Math.hypot(sx - cx, sy - cy) > Math.hypot(ex - cx, ey - cy);
      if (rev) dir = -dir;
    }
  } else {
    dir = ex >= sx ? 1 : -1;
    const q = b[Math.min(n - 1, Math.floor(n * 0.12)) * 2 + 1] - sy;
    if (id === "bolt") flipY = q < 0;
    else if (id === "wave") flipY = q > 0;
    else flipY = b[Math.floor(n / 2) * 2 + 1] > (sy + ey) / 2; // parabol ngửa (đỉnh dưới) → lật
  }
  idealGlyph(id, glyph, gn, dir);
  const roundish = id === "shield" || id === "vortex";
  // glyph dạng đường (sét / parabol / sin): kéo y cho phủ đúng chiều cao nét tay
  let gy = 0;
  for (let i = 0; i < gn; i++) gy = Math.max(gy, Math.abs(glyph[i * 2 + 1]));
  const ys = roundish ? size : h / (2 * Math.max(0.05, gy));
  for (let i = 0; i < gn; i++) {
    glyph[i * 2] = cx + glyph[i * 2] * (roundish ? size : w);
    glyph[i * 2 + 1] = cy + glyph[i * 2 + 1] * ys * (flipY ? -1 : 1);
  }
  return { id, label, glyph, gn, cx, cy, size, rev };
}
