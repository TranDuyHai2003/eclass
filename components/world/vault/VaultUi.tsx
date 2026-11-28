"use client";
/**
 * Giao diện Hầm Bổ đề (DOM phủ trên cảnh 3D), theo bộ UI sẵn có (w-panel, w-btn, w-chip, w-pill):
 *  - Quảng trường: bảng ở cửa Hầm (chơi một mình / lập tổ đội / vào bằng mã).
 *  - Trong hầm: tên phòng + màn + mục tiêu; danh sách ghế (● ▲ ■ ◆, Tiếng Vọng, vắng); thanh giao tiếp (Ping, Nói nhanh,
 *    3-2-1, Hỏi Tiếng Vọng); vòng đếm ngược chung; bảng trạm (núm ống / phổ của Nhạc trưởng / mô-men / sợi chỉ);
 *    phòng chờ, thẻ bổ đề sau mỗi phòng, màn chúc mừng cuối lượt. KHÔNG chat tự do, KHÔNG giọng nói.
 */
import { useEffect, useMemo, useState } from "react";
import { AnimatePresence, motion } from "motion/react";
import { ChevronsUp, Hourglass, Lightbulb, LogOut, MapPin, MessageCircle, Minus, Plus, RotateCcw, Sparkles, Users, Volume2, VolumeX, X } from "lucide-react";
import { useWorld } from "../store";
import { jump } from "../combat/combat";
import { sfx } from "@/lib/world/sfx";
import { ECHOES, GLYPHS, SEAT_COLORS, STAGES, chamberOf, stuckSeats } from "@/lib/world/vault/run";
import { graphById, type KState } from "@/lib/world/vault/konigsberg";
import { SOCKETS, SW_H, catArms, levelTol, stoneFor, type BState, type Cat } from "@/lib/world/vault/balance";
import { DETENTS, ERR_OK, nudge, onPodium, pedestal, pedestalAt, snap, sounding, type FState } from "@/lib/world/vault/fourier";
import type { TState } from "@/lib/world/vault/threshold";
import { BEATS, CHAMBERS, ECHO_LINES, ECHO_NAMES, HINTS, LEMMAS, MOMENTS, SAYS, SAY_CONTEXT, SAY_PAGES, UI, VAULT_LORE, VAULT_NAME, VAULT_SUB, tx } from "@/lib/world/vault/text";
import { CODE_ABC } from "@/lib/world/vault/run";
import { asRun, enterVault, leaveVault, useVault, vaultAct, vaultNow, type NetRun } from "./vaultClient";

const CSS = `
.w-vault{position:absolute;inset:0;z-index:22;pointer-events:none;color:#f6f1e4;font-family:var(--font-nunito),var(--font-bvp),system-ui,sans-serif}
.w-vault *{box-sizing:border-box}
.w-vault button{-webkit-tap-highlight-color:transparent}
.w-vault__banner{position:absolute;left:50%;top:max(10px,env(safe-area-inset-top));transform:translateX(-50%);display:flex;flex-direction:column;align-items:center;gap:4px;width:min(64vw,560px);text-align:center}
.w-vault__room{font-family:var(--font-chakra),var(--font-bvp),sans-serif;font-weight:700;letter-spacing:.06em;font-size:calc(var(--u,1)*15px);color:#fff;text-shadow:0 2px 8px rgba(8,10,30,.8)}
.w-vault__stage{display:inline-flex;align-items:center;gap:6px;font-size:calc(var(--u,1)*12px);font-weight:800;color:#ecd7a9}
.w-vault__pips{display:inline-flex;gap:3px}
.w-vault__pips i{width:14px;height:4px;border-radius:2px;background:rgba(255,255,255,.22)}
.w-vault__pips i.on{background:linear-gradient(90deg,#fff1c4,#e3bf6e);box-shadow:0 0 6px rgba(236,215,169,.8)}
.w-vault__goal{font-size:calc(var(--u,1)*12.5px);font-weight:700;color:rgba(255,255,255,.92);background:rgba(14,17,38,.55);padding:4px 12px;border-radius:999px;box-shadow:inset 0 0 0 1px rgba(236,215,169,.3);backdrop-filter:blur(6px);max-width:100%}
.w-vault__party{position:absolute;right:max(12px,env(safe-area-inset-right));top:calc(max(10px,env(safe-area-inset-top)) + var(--u,1)*54px);display:flex;flex-direction:column;gap:5px;pointer-events:auto;width:calc(var(--u,1)*188px)}
.w-vault__seat{display:flex;align-items:center;gap:7px;padding:4px 9px 4px 5px!important;border-radius:999px!important;background:rgba(14,17,38,.62)!important;box-shadow:inset 0 0 0 1px rgba(255,255,255,.14);backdrop-filter:blur(6px);font-size:calc(var(--u,1)*12px);font-weight:800;text-align:left;min-width:0;transition:box-shadow .15s}
.w-vault__seat[data-sel=true]{box-shadow:inset 0 0 0 2px #ecd7a9,0 0 12px rgba(236,215,169,.45)}
.w-vault__glyph{flex:none;width:22px;height:22px;border-radius:999px;display:grid;place-items:center;font-size:12px;color:#12162b;font-weight:900}
.w-vault__sname{flex:1;min-width:0;overflow:hidden;text-overflow:ellipsis;white-space:nowrap}
.w-vault__tag{flex:none;font-size:9.5px;font-weight:900;letter-spacing:.04em;padding:1px 6px;border-radius:999px;background:rgba(255,255,255,.12);color:#cfe7ff}
.w-vault__tag--me{background:#ecd7a9;color:#2b1d05}
.w-vault__tag--ok{background:#5ee6a8;color:#06301e}
.w-vault__bar{position:absolute;left:50%;bottom:calc(max(10px,env(safe-area-inset-bottom)) + var(--u,1)*6px);transform:translateX(-50%);display:flex;gap:calc(var(--u,1)*8px);pointer-events:auto;align-items:flex-end}
.w-vault__act{display:flex;flex-direction:column;align-items:center;gap:3px;min-width:calc(var(--u,1)*54px);padding:6px 8px!important;border-radius:14px!important;background:radial-gradient(circle at 50% 25%,rgba(60,70,120,.6),rgba(14,17,38,.72))!important;box-shadow:inset 0 0 0 1.5px rgba(255,255,255,.55),0 3px 12px rgba(10,12,30,.35);backdrop-filter:blur(6px);font-size:calc(var(--u,1)*10.5px);font-weight:900;color:#fff;transition:transform .1s}
.w-vault__act:active{transform:scale(.94)}
.w-vault__act svg{width:calc(var(--u,1)*20px);height:calc(var(--u,1)*20px)}
.w-vault__act--gold{box-shadow:inset 0 0 0 2px #ecd7a9,0 0 16px rgba(236,215,169,.55)}
.w-vault__act--hot{animation:w-vault-pulse 1.2s ease-in-out infinite}
@keyframes w-vault-pulse{50%{box-shadow:inset 0 0 0 2px #ffd27a,0 0 22px rgba(255,210,122,.85)}}
.w-vault__key{font-size:9px;opacity:.65;font-weight:800}
.w-vault__wheel{position:absolute;left:50%;bottom:calc(max(10px,env(safe-area-inset-bottom)) + var(--u,1)*82px);transform:translateX(-50%);width:min(92vw,440px);pointer-events:auto;padding:10px!important}
.w-vault__phr{display:grid;grid-template-columns:repeat(3,1fr);gap:6px}
.w-vault__phr button{padding:7px 6px!important;border-radius:10px!important;background:rgba(255,255,255,.08)!important;box-shadow:inset 0 0 0 1px rgba(236,215,169,.3);font-weight:800;font-size:calc(var(--u,1)*12px)}
.w-vault__phr button:hover{background:rgba(236,215,169,.2)!important}
.w-vault__feed{position:absolute;left:max(12px,env(safe-area-inset-left));bottom:calc(max(10px,env(safe-area-inset-bottom)) + var(--u,1)*150px);display:flex;flex-direction:column;gap:4px;width:min(42vw,300px)}
.w-vault__msg{display:flex;gap:6px;align-items:baseline;font-size:calc(var(--u,1)*12px);font-weight:800;padding:4px 10px;border-radius:12px;background:rgba(14,17,38,.62);backdrop-filter:blur(6px);box-shadow:inset 0 0 0 1px rgba(255,255,255,.12)}
.w-vault__count{position:absolute;left:50%;top:30%;transform:translate(-50%,-50%);width:calc(var(--u,1)*120px);height:calc(var(--u,1)*120px);display:grid;place-items:center}
.w-vault__count b{font-family:var(--font-chakra),sans-serif;font-size:calc(var(--u,1)*56px);font-weight:700;color:#fff;text-shadow:0 0 18px rgba(255,210,122,.9),0 2px 8px rgba(0,0,0,.6)}
.w-vault__count svg{position:absolute;inset:0}
.w-vault__hint{position:absolute;left:50%;top:calc(max(10px,env(safe-area-inset-top)) + var(--u,1)*74px);transform:translateX(-50%);width:min(80vw,460px);pointer-events:auto;padding:10px 14px!important;font-size:calc(var(--u,1)*13px);font-weight:700}
.w-vault__station{position:absolute;right:max(12px,env(safe-area-inset-right));bottom:calc(max(10px,env(safe-area-inset-bottom)) + var(--u,1)*84px);width:min(70vw,calc(var(--u,1)*300px));pointer-events:auto;padding:10px 12px!important}
.w-vault__row{display:flex;align-items:center;gap:6px}
.w-vault__val{font-family:var(--font-chakra),monospace;font-weight:700;font-size:calc(var(--u,1)*22px);min-width:64px;text-align:center}
.w-vault__btn{display:inline-flex;align-items:center;justify-content:center;gap:4px;min-width:34px;height:34px;padding:0 8px!important;border-radius:10px!important;background:rgba(255,255,255,.1)!important;box-shadow:inset 0 0 0 1px rgba(236,215,169,.4);font-weight:900;font-size:14px}
.w-vault__btn:hover{background:rgba(236,215,169,.22)!important}
.w-vault__range{width:100%;accent-color:#ecd7a9}
.w-vault__ticks{position:relative;height:8px;margin:0 8px}
.w-vault__ticks i{position:absolute;top:0;width:1px;height:6px;background:rgba(236,215,169,.55)}
.w-vault__meter{height:8px;border-radius:6px;background:rgba(255,255,255,.12);overflow:hidden}
.w-vault__meter i{display:block;height:100%;border-radius:6px;transition:width .2s}
.w-vault__small{font-size:calc(var(--u,1)*11px);color:rgba(255,255,255,.72);font-weight:700}
.w-vault__center{position:absolute;inset:0;display:flex;align-items:center;justify-content:center;pointer-events:none;padding:64px 12px 90px}
.w-vault__card{position:relative;width:min(92vw,520px);max-height:86vh;overflow:auto;pointer-events:auto;padding:18px 20px!important;display:flex;flex-direction:column;gap:10px}
.w-vault__code{font-family:var(--font-chakra),monospace;font-weight:700;font-size:calc(var(--u,1)*34px);letter-spacing:.3em;color:#fff3c4;text-shadow:0 0 14px rgba(255,210,122,.6)}
.w-vault__input{width:7.2em;text-align:center;letter-spacing:.3em;font-family:var(--font-chakra),monospace;font-weight:700;font-size:20px;text-transform:uppercase;background:rgba(0,0,0,.3)!important;border:1px solid rgba(236,215,169,.5)!important;border-radius:10px!important;padding:6px 8px!important;color:#fff;outline:none}
.w-vault__formula{font-family:var(--font-chakra),monospace;font-size:calc(var(--u,1)*20px);color:#fff3c4;text-align:center;padding:8px;border-radius:12px;background:rgba(0,0,0,.25);box-shadow:inset 0 0 0 1px rgba(236,215,169,.35)}
.w-vault__flash{position:absolute;left:50%;top:30%;transform:translateX(-50%)}
.w-vault__flash span{font-family:var(--font-chakra),sans-serif;font-weight:700;font-size:clamp(26px,6vh,48px);letter-spacing:.08em;color:#fff;text-shadow:0 0 24px rgba(255,210,122,.9),0 2px 10px rgba(10,14,40,.8)}
.w-vault__close{position:absolute;right:10px;top:10px}
@media (max-height:460px){.w-vault__party{width:calc(var(--u,1)*150px)}.w-vault__feed{bottom:calc(var(--u,1)*140px)}.w-vault__goal{display:none}}
`;

function fmtVal(v: number): string {
  if (Math.abs(v) < 1e-6) return "0";
  const s = v < 0 ? "−" : "";
  const a = Math.abs(v);
  if (Math.abs(a - 1) < 1e-6) return `${s}1`;
  for (let k = 2; k <= 8; k++) if (Math.abs(a - 1 / k) < 1e-5) return `${s}1/${k}`;
  for (let m = 1; m < 12; m++)
    if (Math.abs(a - m / 12) < 1e-5) {
      const g = gcd(m, 12);
      return `${s}${m / g}/${12 / g}`;
    }
  return `${s}${a.toFixed(2)}`;
}
function gcd(a: number, b: number): number {
  return b ? gcd(b, a % b) : a;
}
function seatName(r: NetRun, i: number, vi: boolean): string {
  const n = r.seats[i]?.name ?? "";
  if (n.startsWith("@")) return tx(ECHO_NAMES[n.slice(1)] ?? ECHO_NAMES[ECHOES[i]], vi);
  return n || `${vi ? "Người chơi" : "Player"} ${i + 1}`;
}

// ───────────── Cửa Hầm ở Quảng trường ─────────────

function DoorPanel() {
  const vi = useWorld((s) => s.lang === "vi");
  const err = useVault((s) => s.err);
  const [code, setCode] = useState("");
  const close = () => useVault.setState({ door: false, err: null });
  useEffect(() => {
    const k = (e: KeyboardEvent) => e.key === "Escape" && close();
    window.addEventListener("keydown", k);
    return () => window.removeEventListener("keydown", k);
  }, []);
  return (
    <div className="w-modal pointer-events-auto" onPointerDown={(e) => e.target === e.currentTarget && close()}>
      <motion.div initial={{ scale: 0.94, opacity: 0 }} animate={{ scale: 1, opacity: 1 }} className="w-panel relative flex w-[min(92vw,460px)] flex-col gap-3 p-5">
        <button type="button" className="w-round w-round--sm w-vault__close" aria-label="close" onClick={close}>
          <X />
        </button>
        <div className="w-title text-2xl">{tx(VAULT_NAME, vi)}</div>
        <div className="text-sm font-bold text-[#ecd7a9]">{tx(VAULT_SUB, vi)}</div>
        <p className="text-[13px] leading-snug text-white/80">{tx(VAULT_LORE, vi)}</p>
        <div className="w-divider" />
        <div className="text-[12px] font-bold text-white/70">{tx(UI.players, vi)}</div>
        <button type="button" className="w-btn w-btn--gold" onClick={() => enterVault("solo")}>
          <span>
            <Sparkles size={16} className="mr-1 inline -translate-y-0.5" />
            {tx(UI.solo, vi)}
          </span>
        </button>
        <button type="button" className="w-btn" onClick={() => enterVault("new")}>
          <span>
            <Users size={16} className="mr-1 inline -translate-y-0.5" />
            {tx(UI.create, vi)}
          </span>
        </button>
        <div className="flex items-center justify-center gap-2">
          <input
            className="w-vault__input"
            value={code}
            maxLength={4}
            placeholder={tx(UI.enterCode, vi)}
            aria-label={tx(UI.code, vi)}
            onChange={(e) => setCode([...e.target.value.toUpperCase()].filter((c) => CODE_ABC.includes(c)).join("").slice(0, 4))}
            onKeyDown={(e) => e.key === "Enter" && code.length === 4 && enterVault(code)}
          />
          <button type="button" className="w-btn w-btn--ghost w-btn--sm" disabled={code.length !== 4} onClick={() => enterVault(code)}>
            <span>{tx(UI.join, vi)}</span>
          </button>
        </div>
        {err && <div className="rounded-lg bg-rose-500/25 px-3 py-2 text-center text-[13px] font-bold text-rose-100">{tx(UI[err as keyof typeof UI] ?? UI.errNocode, vi)}</div>}
      </motion.div>
    </div>
  );
}

// ───────────── Trong hầm ─────────────

function Banner({ r, vi }: { r: NetRun; vi: boolean }) {
  const c = r.phase === "lobby" ? "threshold" : r.phase === "done" ? "finale" : chamberOf(asRun(r));
  const def = CHAMBERS[c];
  const total = STAGES[c];
  const sg = Math.min(r.sg, def.stages.length - 1);
  let goal = tx(def.stages[sg].goal, vi);
  if (c === "threshold" && r.phase === "play" && r.st) goal = tx(BEATS[Math.min(2, (r.st as TState).beat)], vi);
  if (r.phase === "lobby") goal = tx(UI.lobby, vi);
  return (
    <div className="w-vault__banner">
      <div className="w-vault__room">{tx(def.name, vi)}</div>
      {r.phase !== "lobby" && total > 1 && (
        <div className="w-vault__stage">
          <span className="w-vault__pips">
            {Array.from({ length: total }, (_, i) => (
              <i key={i} className={i <= r.sg ? "on" : ""} />
            ))}
          </span>
          {tx(UI.stage, vi)} {r.sg + 1}/{total} · {tx(def.stages[sg].name, vi)}
        </div>
      )}
      <div className="w-vault__goal">{goal}</div>
    </div>
  );
}

function Party({ r, vi }: { r: NetRun; vi: boolean }) {
  const me = useVault((s) => s.seat);
  const to = useVault((s) => s.to);
  return (
    <div className="w-vault__party">
      {r.seats.map((s, i) => {
        const echo = !s.h || !s.conn;
        return (
          <button
            key={i}
            type="button"
            className="w-vault__seat"
            data-sel={to === i}
            title={echo ? `${tx(UI.target, vi)}: ${seatName(r, i, vi)}` : seatName(r, i, vi)}
            onClick={() => echo && useVault.setState({ to: to === i ? -1 : i })}
          >
            <span className="w-vault__glyph" style={{ background: SEAT_COLORS[i] }}>
              {GLYPHS[i]}
            </span>
            <span className="w-vault__sname">{seatName(r, i, vi)}</span>
            {i === me && <span className="w-vault__tag w-vault__tag--me">{tx(UI.you, vi)}</span>}
            {!s.h && <span className="w-vault__tag">{tx(UI.echo, vi)}</span>}
            {s.h && !s.conn && <span className="w-vault__tag">{vi ? "vắng" : "away"}</span>}
            {(r.phase === "lobby" || r.phase === "reveal") && s.h && s.conn && s.ready && <span className="w-vault__tag w-vault__tag--ok">✓</span>}
          </button>
        );
      })}
      {r.seats.some((s) => !s.h || !s.conn) && (
        <div className="w-vault__small px-2">
          {tx(UI.target, vi)}: <b className="text-[#ecd7a9]">{to >= 0 ? `${GLYPHS[to]} ${seatName(r, to, vi)}` : tx(UI.nearest, vi)}</b>
        </div>
      )}
    </div>
  );
}

function Feed({ r, vi }: { r: NetRun; vi: boolean }) {
  const [items, setItems] = useState<{ id: number; by: number; text: string; until: number }[]>([]);
  const [seen, setSeen] = useState(0);
  useEffect(() => {
    const fresh = r.ev.filter((e) => e.id > seen);
    if (!fresh.length) return;
    setSeen(fresh[fresh.length - 1].id);
    if (!seen) return; // lần đầu: bỏ sự kiện cũ
    const add: typeof items = [];
    for (const e of fresh) {
      let text = "";
      if (e.k === "say" && e.s) text = tx(SAYS[e.s] ?? SAYS.nice, vi);
      else if (e.k === "echo" && e.s) text = tx(ECHO_LINES[e.s] ?? ECHO_LINES["e.ok"], vi);
      else if (e.k === "join") text = vi ? "đã vào hầm" : "joined";
      else if (e.k === "left") text = vi ? "mất kết nối — Tiếng Vọng giữ ghế" : "disconnected — an Echo holds the seat";
      else if (e.k === "notyet") text = vi ? "muốn tự nghĩ thêm" : "wants to keep thinking";
      else if (e.k === "reset") text = vi ? "làm lại màn" : "reset the stage";
      else if (e.k === "late") text = tx(UI.late, vi);
      else if (e.k === "launch" && e.s) text = `${tx(UI.launched, vi)} ${num1(Number(e.s.split("|")[1]), vi)} m`;
      if (text && e.by >= 0) add.push({ id: e.id, by: e.by, text, until: performance.now() + 5200 });
    }
    if (add.length) setItems((old) => [...old.filter((x) => x.until > performance.now()), ...add].slice(-5));
  }, [r.ev, seen, vi]);
  useEffect(() => {
    const t = setInterval(() => setItems((old) => (old.some((x) => x.until < performance.now()) ? old.filter((x) => x.until > performance.now()) : old)), 600);
    return () => clearInterval(t);
  }, []);
  return (
    <div className="w-vault__feed">
      <AnimatePresence>
        {items.map((m) => (
          <motion.div key={m.id} initial={{ opacity: 0, x: -14 }} animate={{ opacity: 1, x: 0 }} exit={{ opacity: 0 }} className="w-vault__msg">
            <b style={{ color: SEAT_COLORS[m.by] }}>
              {GLYPHS[m.by]} {seatName(r, m.by, vi)}
            </b>
            <span>{m.text}</span>
          </motion.div>
        ))}
      </AnimatePresence>
    </div>
  );
}

function Countdown({ r }: { r: NetRun }) {
  const [left, setLeft] = useState<number | null>(null);
  const at = r.count.at;
  useEffect(() => {
    if (!at) return setLeft(null);
    let raf = 0;
    let lastN = -1;
    const loop = () => {
      const ms = at - vaultNow();
      if (ms < -900) return setLeft(null);
      setLeft(ms);
      const n = Math.ceil(ms / 1000);
      if (n !== lastN) {
        lastN = n;
        if (n > 0) sfx.click();
        else sfx.chime(2);
      }
      raf = requestAnimationFrame(loop);
    };
    loop();
    return () => cancelAnimationFrame(raf);
  }, [at]);
  if (left === null) return null;
  const n = Math.ceil(left / 1000);
  const frac = Math.max(0, Math.min(1, (left % 1000) / 1000));
  return (
    <div className="w-vault__count">
      <svg viewBox="0 0 100 100">
        <circle cx="50" cy="50" r="44" fill="rgba(14,17,38,.5)" stroke="rgba(255,255,255,.18)" strokeWidth="5" />
        {n > 0 && <circle cx="50" cy="50" r="44" fill="none" stroke={SEAT_COLORS[Math.max(0, r.count.by)]} strokeWidth="5" strokeDasharray={`${276 * frac} 276`} transform="rotate(-90 50 50)" strokeLinecap="round" />}
      </svg>
      <b>{n > 0 ? n : "GO!"}</b>
    </div>
  );
}

function HintBox({ r, vi }: { r: NetRun; vi: boolean }) {
  const [open, setOpen] = useState(true);
  const lv = r.hint.lv;
  useEffect(() => setOpen(true), [lv]);
  const c = chamberOf(asRun(r));
  const asking = r.hint.ask > 0;
  if (!asking && (!lv || !open)) return null;
  return (
    <motion.div initial={{ y: -8, opacity: 0 }} animate={{ y: 0, opacity: 1 }} className="w-panel w-vault__hint">
      {asking ? (
        <div className="flex items-center gap-2">
          <Hourglass size={16} className="text-[#ecd7a9]" />
          <span className="flex-1">
            <b style={{ color: SEAT_COLORS[r.hint.by] }}>{GLYPHS[r.hint.by]}</b> {tx(UI.hintAsk, vi)}…
          </span>
          <button type="button" className="w-btn w-btn--ghost w-btn--sm" onClick={() => vaultAct({ k: "notyet" })}>
            <span>{tx(UI.notYet, vi)}</span>
          </button>
        </div>
      ) : (
        <div className="flex items-start gap-2">
          <Lightbulb size={16} className="mt-0.5 flex-none text-[#ffd27a]" />
          <span className="flex-1">
            <span className="mr-1 text-[11px] font-black text-[#ecd7a9]">{lv}/3</span>
            {tx((HINTS[`${c}.${r.sg}`] ?? HINTS[c] ?? HINTS.finale)[lv - 1], vi)}
          </span>
          <button type="button" className="w-round w-round--sm flex-none" aria-label="close" onClick={() => setOpen(false)}>
            <X />
          </button>
        </div>
      )}
    </motion.div>
  );
}

function QuickChat({ chamber, vi, onClose }: { chamber: string; vi: boolean; onClose: () => void }) {
  const [page, setPage] = useState(0);
  const pages = useMemo(() => [...SAY_PAGES, SAY_CONTEXT[chamber] ?? []].filter((p) => p.length), [chamber]);
  const ids = pages[Math.min(page, pages.length - 1)];
  return (
    <motion.div initial={{ y: 10, opacity: 0 }} animate={{ y: 0, opacity: 1 }} exit={{ y: 10, opacity: 0 }} className="w-panel w-vault__wheel">
      <div className="mb-2 flex items-center gap-2">
        <MessageCircle size={15} className="text-[#ecd7a9]" />
        <b className="flex-1 text-[13px] text-[#ecd7a9]">{tx(UI.chat, vi)}</b>
        {pages.map((_, i) => (
          <button key={i} type="button" className={`w-vault__btn ${i === page ? "!bg-[#ecd7a9] !text-[#12162b]" : ""}`} onClick={() => setPage(i)}>
            {i + 1}
          </button>
        ))}
        <button type="button" className="w-vault__btn" aria-label="close" onClick={onClose}>
          <X size={14} />
        </button>
      </div>
      <div className="w-vault__phr">
        {ids.map((id) => (
          <button
            key={id}
            type="button"
            onClick={() => {
              vaultAct({ k: "say", id });
              onClose();
            }}
          >
            {tx(SAYS[id], vi)}
          </button>
        ))}
      </div>
    </motion.div>
  );
}

/** Bảng trạm: núm ống (đứng trên bệ) / phổ của Nhạc trưởng (đứng trên bục) */
function ChoirStation({ r, vi }: { r: NetRun; vi: boolean }) {
  const st = r.st as FState;
  const [pos, setPos] = useState<{ x: number; z: number }>({ x: 0, z: 99 });
  const dial = useVault((s) => s.dial);
  useEffect(() => {
    const t = setInterval(() => {
      const p = useWorld.getState().player;
      setPos((o) => (Math.abs(o.x - p.x) + Math.abs(o.z - p.z) > 0.05 ? { x: p.x, z: p.z } : o));
    }, 120);
    return () => clearInterval(t);
  }, []);
  const pi = pedestalAt(st, pos.x, pos.z);
  const podium = st.cond && onPodium(pos.x, pos.z);
  const showSpec = podium || r.hint.lv >= 3;
  const cur = pi >= 0 ? (dial && dial.i === pi && performance.now() - dial.at < 600 ? dial.v : st.amp[pi]) : 0;
  const set = (v: number) => {
    if (pi < 0) return;
    const nv = snap(v);
    useVault.setState({ dial: { i: pi, v: nv, at: performance.now() } });
    vaultAct({ k: "dial", i: pi, v: nv });
  };
  useEffect(() => {
    if (pi < 0) return;
    const k = (e: KeyboardEvent) => {
      if (e.key === "q" || e.key === "Q") set(nudge(cur, -1));
      if (e.key === "e" || e.key === "E") set(nudge(cur, 1));
    };
    window.addEventListener("keydown", k);
    return () => window.removeEventListener("keydown", k);
  });
  const snd = sounding(st);
  const errPct = Math.round(st.err * 100);
  const errCol = st.err <= ERR_OK ? "#5ee6a8" : st.err < 0.35 ? "#ffd27a" : "#ff7f9a";
  const meter = (
    <div className="mt-2">
      <div className="w-vault__row w-vault__small">
        <span className="flex-1">{tx(UI.error, vi)}</span>
        <b style={{ color: errCol }}>{errPct}%</b>
      </div>
      <div className="w-vault__meter">
        <i style={{ width: `${Math.max(4, 100 - Math.min(100, errPct))}%`, background: errCol }} />
      </div>
    </div>
  );
  if (pi < 0 && !showSpec) return <div className="w-panel w-vault__station">{meter}</div>;
  return (
    <div className="w-panel w-vault__station">
      {pi >= 0 && (
        <>
          <div className="w-vault__row">
            <b className="flex-1 text-[13px] text-[#ecd7a9]">
              {tx(UI.pipe, vi)} k = {st.ks[pi]}
            </b>
            <button
              type="button"
              className="w-vault__btn"
              title={tx(UI.mute, vi)}
              onClick={() => useVault.setState((s) => ({ muted: !s.muted }))}
            >
              {useVault.getState().muted ? <VolumeX size={15} /> : <Volume2 size={15} />}
            </button>
          </div>
          <div className="w-vault__row mt-1">
            <button type="button" className="w-vault__btn" onClick={() => set(nudge(cur, -1))} aria-label="−">
              <Minus size={16} />
            </button>
            <span className="w-vault__val flex-1">{fmtVal(cur)}</span>
            <button type="button" className="w-vault__btn" onClick={() => set(nudge(cur, 1))} aria-label="+">
              <Plus size={16} />
            </button>
          </div>
          <input className="w-vault__range mt-1" type="range" min={-1} max={1} step={1 / 120} value={cur} onChange={(e) => set(Number(e.target.value))} aria-label={`${tx(UI.pipe, vi)} ${st.ks[pi]}`} />
          <div className="w-vault__ticks">
            {DETENTS.filter((d) => [0, 1, 0.5, 1 / 3, 0.25].some((q) => Math.abs(Math.abs(d) - q) < 1e-6) || d === 0).map((d) => (
              <i key={d} style={{ left: `${((d + 1) / 2) * 100}%` }} />
            ))}
          </div>
          <div className="w-vault__row mt-1 justify-center gap-2">
            <button type="button" className="w-vault__btn" onClick={() => set(0)}>
              0
            </button>
            <button type="button" className="w-vault__btn" onClick={() => set(-cur)} title={vi ? "Đảo dấu" : "Flip sign"}>
              ⇅
            </button>
            <span className="w-vault__small">Q / E</span>
          </div>
        </>
      )}
      {showSpec && (
        <div className={pi >= 0 ? "mt-2" : ""}>
          <div className="w-vault__small mb-1">{podium ? tx(UI.spectrum, vi) : tx(HINTS.fourier[2], vi)}</div>
          <svg viewBox={`0 0 ${st.ks.length * 60} 120`} className="w-full" style={{ maxHeight: 130 }}>
            <line x1="0" y1="60" x2={st.ks.length * 60} y2="60" stroke="rgba(255,255,255,.35)" />
            {st.ks.map((k, i) => {
              const t = st.tg[i];
              const s = snd[i];
              const h = Math.abs(t) * 52;
              return (
                <g key={k}>
                  <rect x={i * 60 + 16} y={t >= 0 ? 60 - h : 60} width={28} height={h} rx={3} fill="#ffd27a" opacity={0.85} />
                  <line x1={i * 60 + 10} x2={i * 60 + 50} y1={60 - s * 52} y2={60 - s * 52} stroke="#6fe6ff" strokeWidth={3} />
                  <text x={i * 60 + 30} y={116} textAnchor="middle" fontSize="12" fill="#ecd7a9" fontWeight="800">
                    k={k}
                  </text>
                </g>
              );
            })}
          </svg>
          {podium && (
            <div className="mt-1 flex flex-col gap-1">
              <div className="w-vault__small">{tx(UI.tellPiper, vi)}</div>
              {st.ks.map((k, i) => {
                const p = pedestal(st, i);
                const val = (v: string) => vaultAct({ k: "ping", kind: "val", x: p.x, y: 1, z: p.z, t: i, v });
                return (
                  <div key={k} className="w-vault__row">
                    <span className="w-vault__small w-10">k={k}</span>
                    <button type="button" className="w-vault__btn" onClick={() => val("+")}>
                      ＋
                    </button>
                    <button type="button" className="w-vault__btn" onClick={() => val("-")}>
                      －
                    </button>
                    <button type="button" className="w-vault__btn" onClick={() => val("0")}>
                      0
                    </button>
                    <button type="button" className="w-vault__btn" onClick={() => val("f")}>
                      ⇅
                    </button>
                  </div>
                );
              })}
            </div>
          )}
        </div>
      )}
      {meter}
      {podium && <div className="w-vault__small mt-1 text-center">{tx(UI.conductor, vi)}</div>}
    </div>
  );
}

const num1 = (x: number, vi: boolean) => (vi ? x.toFixed(1).replace(".", ",") : x.toFixed(1));

/** Máy bắn đá: điểm tựa (d₁, d₂), hai chuông, cú bắn vừa rồi — thanh "rơi" và "bay" cạnh nhau để thấy bay ≤ rơi */
function CatapultReadout({ r, vi, cat }: { r: NetRun; vi: boolean; cat: Cat }) {
  const a = catArms(cat.sock);
  const L = cat.launch;
  const who = L ? (L.by < 0 ? tx(UI.weight, vi) : `${GLYPHS[L.by]} ${seatName(r, L.by, vi)}`) : "";
  const bar = (h: number, color: string) => (
    <div className="relative h-2 flex-1 rounded-full bg-white/10">
      <i className="absolute left-0 top-0 h-2 rounded-full" style={{ width: `${Math.min(100, (h / 11) * 100)}%`, background: color }} />
    </div>
  );
  return (
    <div className="w-panel w-vault__station">
      <div className="w-vault__row text-[12.5px]">
        <b className="flex-1 text-[#ffd27a]">
          {tx(UI.fulcrum, vi)} · {tx(UI.sockN, vi)} {cat.sock + 1}/3
        </b>
        <span className="w-vault__small">
          d₁ {num1(a.d1, vi)} · d₂ {num1(a.d2, vi)} · d₂/d₁ = {vi ? SOCKETS[cat.sock].toFixed(2).replace(".", ",") : SOCKETS[cat.sock].toFixed(2)}
        </span>
      </div>
      <div className="w-vault__row w-vault__small mt-1.5 gap-3">
        {SW_H.map((h, i) => {
          const on = cat.sw[i];
          const sealed = i === 1 && !cat.sw[0];
          return (
            <span key={i} style={{ color: on ? "#5ee6a8" : sealed ? "rgba(255,255,255,.45)" : "#fff3c4" }}>
              {on ? "✓" : sealed ? "🔒" : "○"} {tx(UI.bell, vi)} {i ? "B" : "A"} · {num1(h, vi)} m
            </span>
          );
        })}
      </div>
      {L ? (
        <div className="mt-2">
          <div className="w-vault__small mb-1">
            {tx(UI.lastShot, vi)}: {L.n} {tx(UI.plungers, vi)} → {who}
          </div>
          <div className="w-vault__row w-vault__small gap-2">
            <span className="w-14">{tx(UI.fell, vi)}</span>
            {bar(L.h1, "#ff9a4a")}
            <b className="w-12 text-right text-white">{num1(L.h1, vi)} m</b>
          </div>
          <div className="w-vault__row w-vault__small mt-1 gap-2">
            <span className="w-14">{tx(UI.flew, vi)}</span>
            {bar(L.h, "#6fe3ff")}
            <b className="w-12 text-right text-white">{num1(L.h, vi)} m</b>
          </div>
          {r.hint.lv >= 1 && <div className="w-vault__small mt-1.5 text-[#ecd7a9]">{tx(UI.energy, vi)}</div>}
        </div>
      ) : (
        <div className="w-vault__small mt-2">{tx(UI.catTip, vi)}</div>
      )}
    </div>
  );
}

function BalanceReadout({ r, vi }: { r: NetRun; vi: boolean }) {
  const st = r.st as BState;
  if (st.cat) return <CatapultReadout r={r} vi={vi} cat={st.cat} />;
  const tol = levelTol(st);
  const lv = Math.abs(st.tau) < tol;
  const left = st.arms.reduce<number>((s, a) => s + (a !== null && a < 0 ? -a : 0), 0);
  const right = st.arms.reduce<number>((s, a) => s + (a !== null && a > 0 ? a : 0), 0) + (st.sx > 0 ? st.m * st.sx : 0);
  const leftAll = left + (st.sx < 0 ? -st.m * st.sx : 0);
  const pct = Math.max(-1, Math.min(1, st.tau / (stoneFor(st.sg, r.n).m * 7 + 7)));
  return (
    <div className="w-panel w-vault__station">
      <div className="w-vault__row">
        <b className="flex-1 text-[13px]" style={{ color: lv ? "#5ee6a8" : "#ffd27a" }}>
          {lv ? tx(UI.level, vi) : `${(st.th * 57.3).toFixed(1)}°`}
        </b>
        {st.hold > 0 && <span className="w-vault__small">{(st.hold / 1000).toFixed(1)} / 2 s</span>}
      </div>
      <div className="relative mt-2 h-3 rounded-full bg-white/10">
        <i className="absolute top-[-3px] h-[18px] w-[3px] rounded bg-white/70" style={{ left: "50%" }} />
        <i className="absolute top-0 h-3 w-3 -translate-x-1/2 rounded-full" style={{ left: `${50 + pct * 50}%`, background: lv ? "#5ee6a8" : "#ffd27a", boxShadow: "0 0 8px currentColor" }} />
      </div>
      {r.hint.lv >= 3 ? (
        <div className="w-vault__row w-vault__small mt-2 justify-between">
          <span>
            ◀ {tx(UI.torque, vi)} <b className="text-white">{leftAll}</b>
          </span>
          <span>
            <b className="text-white">{right}</b> {tx(UI.torque, vi)} ▶
          </span>
        </div>
      ) : (
        <div className="w-vault__small mt-2">
          {vi ? "Tảng Bổ đề" : "Lemma Stone"}: {st.m} × {Math.abs(st.sx)} {st.sx >= 0 ? "▶" : "◀"}
        </div>
      )}
    </div>
  );
}

function KonigsbergReadout({ r, vi }: { r: NetRun; vi: boolean }) {
  const me = useVault((s) => s.seat);
  const st = r.st as KState;
  const tr = st.tr[me];
  const g = graphById(st.g);
  const stuck = stuckSeats(asRun(r)).includes(me);
  const lit = st.lit.filter((s) => s >= 0).length;
  return (
    <div className="w-panel w-vault__station">
      <div className="w-vault__row">
        <span className="w-vault__glyph" style={{ background: SEAT_COLORS[me] }}>
          {GLYPHS[me]}
        </span>
        <b className="flex-1 text-[13px] text-[#ecd7a9]">{tx(UI.thread, vi)}</b>
        <span className="w-vault__small">
          {lit}/{g.bridges.length} {tx(UI.bridges, vi)}
        </span>
      </div>
      <div className="w-vault__small mt-1">{!tr || tr.a < 0 ? tx(UI.noThread, vi) : stuck ? <b className="text-[#ff9ab0]">{tx(UI.knot, vi)}</b> : `${tr.e.length} ${tx(UI.bridges, vi)}`}</div>
      {tr && tr.a >= 0 && (
        <button type="button" className="w-btn w-btn--ghost w-btn--sm mt-2 w-full" onClick={() => vaultAct({ k: "rewind" })}>
          <span>
            <RotateCcw size={14} className="mr-1 inline -translate-y-0.5" />
            {tx(UI.rewind, vi)}
          </span>
        </button>
      )}
    </div>
  );
}

function Lobby({ r, vi }: { r: NetRun; vi: boolean }) {
  const code = useVault((s) => s.code);
  const me = useVault((s) => s.seat);
  const mode = useVault((s) => s.mode);
  const [copied, setCopied] = useState(false);
  const humans = r.seats.filter((s) => s.h && s.conn).length;
  const ready = !!r.seats[me]?.ready;
  return (
    <motion.div initial={{ scale: 0.95, opacity: 0 }} animate={{ scale: 1, opacity: 1 }} className="w-panel w-vault__card">
      <div className="w-title text-xl">{tx(UI.lobby, vi)}</div>
      {mode === "party" && code && (
        <div className="flex items-center justify-center gap-3">
          <span className="w-vault__small">{tx(UI.code, vi)}</span>
          <span className="w-vault__code">{code}</span>
          <button
            type="button"
            className="w-vault__btn"
            onClick={() => {
              navigator.clipboard?.writeText(code).then(() => setCopied(true), () => {});
              setTimeout(() => setCopied(false), 1500);
            }}
          >
            {copied ? tx(UI.copied, vi) : tx(UI.copy, vi)}
          </button>
        </div>
      )}
      <p className="text-[12.5px] text-white/80">{tx(UI.lobbyTip, vi)}</p>
      <div className="flex flex-wrap justify-center gap-2">
        <button type="button" className="w-vault__btn" disabled={r.seats.length >= 4} onClick={() => vaultAct({ k: "fill" })}>
          <Plus size={14} className="mr-1" /> {tx(UI.addEcho, vi)}
        </button>
        <button type="button" className="w-vault__btn" disabled={!r.seats.some((s) => !s.h)} onClick={() => vaultAct({ k: "unfill" })}>
          <Minus size={14} className="mr-1" /> {tx(UI.removeEcho, vi)}
        </button>
      </div>
      <div className="w-vault__small text-center">N = {Math.max(2, r.seats.length)} · {vi ? "người + Tiếng Vọng (ít nhất 2)" : "players + Echoes (at least 2)"}</div>
      <div className="flex justify-center gap-2">
        {humans > 1 && (
          <button type="button" className={`w-btn ${ready ? "w-btn--ghost" : ""}`} onClick={() => vaultAct({ k: "ready", on: !ready })}>
            <span>{ready ? tx(UI.notReady, vi) : tx(UI.ready, vi)}</span>
          </button>
        )}
        <button type="button" className="w-btn w-btn--gold" disabled={humans > 1 && r.seats.some((s, i) => s.h && s.conn && i !== me && !s.ready)} onClick={() => vaultAct({ k: "start" })}>
          <span>{tx(UI.start, vi)}</span>
        </button>
      </div>
    </motion.div>
  );
}

function Reveal({ r, vi }: { r: NetRun; vi: boolean }) {
  const me = useVault((s) => s.seat);
  const c = chamberOf(asRun(r));
  const L = LEMMAS[c];
  const waiting = r.seats.filter((s) => s.h && s.conn && !s.ready).length;
  if (!L) return null;
  return (
    <motion.div initial={{ scale: 0.92, opacity: 0 }} animate={{ scale: 1, opacity: 1 }} className="w-panel w-vault__card">
      <div className="w-chip w-chip--gold self-center">
        <span>{tx(UI.clear, vi)}</span>
      </div>
      <div className="w-title text-center text-2xl">{tx(L.title, vi)}</div>
      <p className="text-[13.5px] leading-relaxed text-white/90">{tx(L.why, vi)}</p>
      <div className="w-vault__formula">{L.formula}</div>
      <button type="button" className="w-btn w-btn--gold self-center" disabled={!!r.seats[me]?.ready} onClick={() => vaultAct({ k: "ready" })}>
        <span>{tx(UI.continue, vi)}</span>
      </button>
      {waiting > 0 && r.seats[me]?.ready && (
        <div className="w-vault__small text-center">
          {tx(UI.waiting, vi)} {waiting}…
        </div>
      )}
    </motion.div>
  );
}

function Done({ r, vi }: { r: NetRun; vi: boolean }) {
  const lines = r.seats.map((s, i) => {
    const sc = s.sc;
    const pick = (["br", "push", "dial", "ring", "ping", "hold"] as const).reduce<[string, number]>((best, k) => ((sc[k] ?? 0) > best[1] ? [k, sc[k]] : best), ["hold", 0]);
    return { i, text: tx(MOMENTS[pick[0]], vi).replace("{n}", String(pick[1])) };
  });
  const mins = Math.max(1, Math.round((r.at - r.t0) / 60000));
  return (
    <motion.div initial={{ scale: 0.9, opacity: 0 }} animate={{ scale: 1, opacity: 1 }} className="w-panel w-vault__card">
      <div className="w-title text-center text-3xl">{tx(UI.done, vi)}</div>
      <div className="text-center text-[13px] text-white/80">
        {vi ? `Ba bổ đề, ${r.n} bộ óc, ${mins} phút.` : `Three lemmas, ${r.n} minds, ${mins} min.`} {r.hints === 0 && <b className="text-[#ffd27a]">{tx(UI.unaided, vi)}</b>}
      </div>
      <div className="w-divider" />
      <b className="text-[13px] text-[#ecd7a9]">{tx(UI.moments, vi)}</b>
      {lines.map((l) => (
        <div key={l.i} className="w-vault__row text-[13px]">
          <span className="w-vault__glyph" style={{ background: SEAT_COLORS[l.i] }}>
            {GLYPHS[l.i]}
          </span>
          <b>{seatName(r, l.i, vi)}</b>
          <span className="text-white/80">{l.text}</span>
        </div>
      ))}
      <div className="mt-2 flex justify-center gap-2">
        <button type="button" className="w-btn w-btn--gold" onClick={leaveVault}>
          <span>{tx(UI.back, vi)}</span>
        </button>
      </div>
    </motion.div>
  );
}

function VaultHud() {
  const vi = useWorld((s) => s.lang === "vi");
  const r = useVault((s) => s.run);
  const err = useVault((s) => s.err);
  const overlay = useWorld((s) => s.overlay);
  const [chat, setChat] = useState(false);
  const [touch, setTouch] = useState(false);
  useEffect(() => setTouch(window.matchMedia("(pointer: coarse)").matches), []);
  useEffect(() => {
    const k = (e: KeyboardEvent) => {
      const t = e.target as HTMLElement | null;
      if (t && (t.tagName === "INPUT" || t.tagName === "TEXTAREA")) return;
      if ((e.key === "c" || e.key === "C") && !e.repeat) setChat((v) => !v);
      if ((e.key === "v" || e.key === "V") && !e.repeat) vaultAct({ k: "count" });
      if ((e.key === "h" || e.key === "H") && !e.repeat) vaultAct({ k: "hint" });
      if (e.key >= "1" && e.key <= "6" && chat) {
        const id = SAY_PAGES[0][Number(e.key) - 1];
        if (id) {
          vaultAct({ k: "say", id });
          setChat(false);
        }
      }
    };
    window.addEventListener("keydown", k);
    return () => window.removeEventListener("keydown", k);
  }, [chat]);
  if (!r) {
    return (
      <div className="w-vault">
        <style>{CSS}</style>
        {err && (
          <div className="w-vault__center"><div className="w-panel w-vault__card">
            <p className="text-center font-bold">{tx(UI[err as keyof typeof UI] ?? UI.errNocode, vi)}</p>
            <div className="flex justify-center gap-2">
              <button type="button" className="w-btn w-btn--gold" onClick={leaveVault}>
                <span>{tx(UI.back, vi)}</span>
              </button>
            </div>
          </div></div>
        )}
      </div>
    );
  }
  const c = r.phase === "lobby" ? "threshold" : chamberOf(asRun(r));
  const play = r.phase === "play";
  return (
    <div className="w-vault" style={{ opacity: overlay ? 0 : 1 }}>
      <style>{CSS}</style>
      <Banner r={r} vi={vi} />
      <Party r={r} vi={vi} />
      <Feed r={r} vi={vi} />
      <Countdown r={r} />
      {play && <HintBox r={r} vi={vi} />}
      {play && c === "fourier" && r.st && <ChoirStation r={r} vi={vi} />}
      {play && c === "balance" && r.st && <BalanceReadout r={r} vi={vi} />}
      {play && c === "konigsberg" && r.st && <KonigsbergReadout r={r} vi={vi} />}
      {play && c === "threshold" && r.st && (r.st as TState).beat === 2 && useVault.getState().seat === 0 && (
        <div className="w-panel w-vault__station text-center text-[13px] font-bold text-[#fff3c4]">
          {tx(UI.lantern, vi)} — {tx(UI.plate, vi)}
        </div>
      )}
      <AnimatePresence>
        {r.phase === "clear" && (
          <motion.div key="clear" initial={{ scale: 0.7, opacity: 0 }} animate={{ scale: 1, opacity: 1 }} exit={{ opacity: 0 }} className="w-vault__flash">
            <span>{tx(UI.clear, vi)}</span>
          </motion.div>
        )}
      </AnimatePresence>
      {(r.phase === "lobby" || r.phase === "reveal" || r.phase === "done") && (
        <div className="w-vault__center">
          {r.phase === "lobby" && <Lobby r={r} vi={vi} />}
          {r.phase === "reveal" && <Reveal r={r} vi={vi} />}
          {r.phase === "done" && <Done r={r} vi={vi} />}
        </div>
      )}
      <AnimatePresence>{chat && <QuickChat chamber={c} vi={vi} onClose={() => setChat(false)} />}</AnimatePresence>
      <div className="w-vault__bar">
        {play && (
          <>
            <button type="button" className="w-vault__act" onClick={() => window.dispatchEvent(new Event("vault:ping-center"))} title={tx(UI.pingTip, vi)}>
              <MapPin />
              {tx(UI.ping, vi)}
              {!touch && <span className="w-vault__key">X</span>}
            </button>
            <button type="button" className="w-vault__act" onClick={() => setChat((v) => !v)}>
              <MessageCircle />
              {tx(UI.chat, vi)}
              {!touch && <span className="w-vault__key">C</span>}
            </button>
            <button type="button" className="w-vault__act" onClick={() => vaultAct({ k: "count" })}>
              <b className="text-[calc(var(--u,1)*15px)] leading-[calc(var(--u,1)*20px)]">3·2·1</b>
              {tx(UI.count, vi)}
              {!touch && <span className="w-vault__key">V</span>}
            </button>
            <button type="button" className={`w-vault__act ${r.hint.offer ? "w-vault__act--hot" : ""}`} disabled={r.hint.lv >= 3} onClick={() => vaultAct({ k: "hint" })}>
              <Lightbulb />
              {tx(UI.hint, vi)}
              {!touch && <span className="w-vault__key">H</span>}
            </button>
            {touch && (
              <button type="button" className="w-vault__act" onClick={() => jump()}>
                <ChevronsUp />
                {vi ? "Nhảy" : "Jump"}
              </button>
            )}
          </>
        )}
        <button type="button" className="w-vault__act" onClick={leaveVault} title={tx(UI.leave, vi)}>
          <LogOut />
          {tx(UI.leave, vi)}
        </button>
      </div>
    </div>
  );
}

/** Gắn một lần trong WorldClient: bảng cửa Hầm (Quảng trường) + HUD trong hầm */
export function VaultUi() {
  const scene = useWorld((s) => s.scene);
  const door = useVault((s) => s.door);
  if (scene === "vault") return <VaultHud />;
  if (scene === "hub" && door) {
    return (
      <>
        <style>{CSS}</style>
        <DoorPanel />
      </>
    );
  }
  return null;
}
