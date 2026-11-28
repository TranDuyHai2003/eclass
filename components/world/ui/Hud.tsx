"use client";
/**
 * In-game HUD in the anime action-RPG idiom:
 *  - top-left: north-up minimap (canvas, 10 Hz) + realm chip + online count
 *  - top-right: three round glass buttons (emotes, menu, fullscreen); everything else lives in the menu sheet
 *  - bottom-centre: HP bar with a delayed "damage trail"
 *  - bottom-right: action pad — attack, skill (cooldown sweep), burst (energy ring), jump, weapon switch
 *  - right of centre: interact prompt with key cap
 * Every element is absolutely positioned with fixed sizes (no layout shift), scaled by --u and kept inside
 * the safe area (notches, rounded corners) via .w-hud padding.
 */
import { memo, useEffect, useRef, useState } from "react";
import Link from "next/link";
import { AnimatePresence, motion } from "motion/react";
import { Binoculars, BookOpen, Box, ChevronsRight, ChevronsUp, MonitorCog, Crosshair as Crosshair2, Hand, Home, Keyboard, Languages, Maximize2, Menu, Minimize2, Pickaxe, Repeat, Smile, Sparkles, Sword, Users, Volume2, VolumeX, Wind, X, type LucideIcon, Accessibility, Music } from "lucide-react";
import { NameField } from "./NameField";
import { Credit } from "./Credit";
import { reduceMotion, setReduceMotion } from "../scene/siren/SirenGravity";
import { setSirenVolume, sirenVolume } from "../scene/siren/sirenSynth";
import { useWorld, useT } from "../store";
import { attackDown, attackUp, burst, cycleWeapon, dodge, jump, skill, useCombat, SKILL_CD, ENERGY_MAX, STAMINA_MAX, enemies, startAim, endAim, CHARGE_MS } from "../combat/combat";
import { MOVESETS } from "@/lib/world/combo";
import { togglePdxStyle, usePdxStyle } from "../scene/VoidHybrid";
import { applyPreset, setGfx, useGfx, type Preset } from "../gfx";
import { ZOOM_MAX, ZOOM_MIN, toggleScope, useScope, zoomBy } from "../scope";
import { useFlight, useRings } from "../flight";
import { LabCard } from "./LabCard";
import { WEAPON_DEFS, useBag, type WeaponId } from "../combat/items";
import { WaveWeaponHud } from "./WaveWeaponHud";
import { BagButton, BagOverlay, PickupFeed, WeaponReveal } from "./Bag";
import { SigilButton, SigilOverlay } from "./Sigil";
import { ArchiveOverlay, QuestTracker } from "./Story";
import { useBossUi } from "../scene/Siren";
import { ExpanseBossHud } from "../bosses/BossHud";
import { netPeers, netStatus, onNet, samplePeer } from "../net";
import { SPOTS } from "../scene/Hub";
import { isSfxEnabled, setSfxEnabled } from "@/lib/world/sfx";
import { AudioSettings } from "../audio/AudioSettings";
import { AVATAR_BY_ID } from "@/lib/world/avatars";
import type { Lang } from "@/lib/world/i18n";

/** Biểu tượng vũ khí (ảnh vẽ tay kiểu anime; lucide chỉ dùng khi ảnh chưa tải) */
function WeaponGlyph({ id }: { id: WeaponId }) {
  // eslint-disable-next-line @next/next/no-img-element
  return <img src={`/world/items/w_${id}.webp`} alt="" draggable={false} className="w-skill__art" />;
}

export function Hud({ onInteract, readOnly, rootRef, onFullscreen }: { onInteract: () => void; readOnly: boolean; rootRef: React.RefObject<HTMLDivElement | null>; onFullscreen: () => void }) {
  const t = useT();
  const scene = useWorld((s) => s.scene);
  const overlay = useWorld((s) => s.overlay);
  const creatures = useWorld((s) => s.state.creatures);
  const [menu, setMenu] = useState(false);
  const [gfxOpen, setGfxOpen] = useState(false);
  const scopeOn = useScope((s) => s.on);
  const vi = useWorld((s) => s.lang === "vi");
  const [bag, setBag] = useState(false);
  const [sigil, setSigil] = useState(false);
  const [archive, setArchive] = useState(false);
  useEffect(() => {
    const k = (e: KeyboardEvent) => {
      if ((e.key === "i" || e.key === "I" || e.key === "b" || e.key === "B") && !(e.target as HTMLElement)?.closest?.("input,textarea")) setBag((v) => !v);
      if ((e.key === "j" || e.key === "J") && !e.repeat) setArchive((v) => !v);
      if (e.key === "Escape") {
        setArchive(false);
        setBag(false);
        setSigil(false);
      }
      if ((e.key === "t" || e.key === "T") && !e.repeat && (["hub", "expanse", "siren"].includes(useWorld.getState().scene))) setSigil((v) => !v);
    };
    window.addEventListener("keydown", k);
    return () => window.removeEventListener("keydown", k);
  }, []);
  const [fs, setFs] = useState(false);
  useEffect(() => {
    const h = () => setFs(!!document.fullscreenElement);
    document.addEventListener("fullscreenchange", h);
    return () => document.removeEventListener("fullscreenchange", h);
  }, []);
  const armed = scene === "hub" || scene === "expanse" || scene === "siren";
  const feral = creatures.filter((c) => c.state === "feral").length;
  const hidden = scene === "valley";
  void rootRef;
  return (
    <div className="w-hud">
      {!hidden && (
        <div className="pointer-events-auto absolute left-[var(--pl)] top-[var(--pt)] flex flex-col items-start gap-[calc(var(--u)*6px)]">
          <Minimap />
          <RealmChip readOnly={readOnly} />
          <QuestTracker />
        </div>
      )}

      <div className="pointer-events-auto absolute right-[var(--pr)] top-[var(--pt)] flex items-center gap-[calc(var(--u)*8px)]">
        {scene !== "valley" && <BagButton onOpen={() => setBag(true)} />}
        {scene !== "valley" && <RoundBtn icon={Smile} label={t("emotes")} onClick={() => useWorld.setState({ overlay: "emotes" })} />}
        {scene !== "valley" && scene !== "babel" && <RoundBtn icon={Binoculars} label={vi ? "Ống nhòm (Z)" : "Binoculars (Z)"} onClick={() => toggleScope()} />}
        <RoundBtn icon={Menu} label={t("menu")} onClick={() => setMenu(true)} />
        <RoundBtn icon={fs ? Minimize2 : Maximize2} label={t("fullscreen")} onClick={onFullscreen} />
        {/* thoát game về trang chủ: tải lại trang đầy đủ để giải phóng WebGL / âm thanh */}
        <RoundBtn
          icon={Home}
          label={vi ? "Thoát về trang chủ" : "Exit to home"}
          onClick={() => {
            if (document.fullscreenElement) document.exitFullscreen().catch(() => {});
            window.location.assign("/home");
          }}
        />
      </div>

      <AnimatePresence>
        {scene === "hub" && feral > 0 && !overlay && (
          <motion.div key="feral" initial={{ y: -12, opacity: 0 }} animate={{ y: 0, opacity: 1 }} exit={{ y: -12, opacity: 0 }} className="w-banner absolute left-1/2 top-[calc(var(--pt)+var(--u)*52px)] -translate-x-1/2">
            <span>{t("feralBanner", { n: feral })}</span>
          </motion.div>
        )}
      </AnimatePresence>

      {!hidden && !overlay && !scopeOn && <InteractPrompt onInteract={onInteract} />}
      {(scene === "impossible" || scene === "siren") && !overlay && !scopeOn && <FlightHud />}
      {scene === "impossible" && !overlay && !scopeOn && <LabCard />}
      {armed && !overlay && !scopeOn && <HpBar raised={scene === "expanse"} />}
      {armed && !overlay && !scopeOn && <CombatFeedback />}
      {armed && !overlay && !scopeOn && <WaveWeaponHud />}
      {armed && !overlay && !scopeOn && <ActionPad blocks={scene === "expanse"} onSigil={() => setSigil(true)} />}
      <AnimatePresence>{scopeOn && <ScopeOverlay />}</AnimatePresence>
      {(scene === "paradox" || scene === "impossible") && !overlay && <PdxStyleToggle />}
      {(scene === "impossible" || scene === "paradox") && !overlay && (
        <div className="pointer-events-auto absolute bottom-[var(--pb)] right-[var(--pr)]">
          <SkillBtn icon={ChevronsUp} size={60} label={t("jump")} keycap="Space" onPress={jump} />
        </div>
      )}
      <DownVeil />
      <ControlsToast />

      {!hidden && <PickupFeed />}
      {scene === "siren" && <BossBar />}
      {scene === "expanse" && !overlay && <ExpanseBossHud />}
      <Crosshair />
      <WeaponReveal />
      <AnimatePresence>{bag && <BagOverlay onClose={() => setBag(false)} />}</AnimatePresence>
      <AnimatePresence>{sigil && armed && <SigilOverlay onClose={() => setSigil(false)} />}</AnimatePresence>
      <AnimatePresence>{archive && <ArchiveOverlay onClose={() => setArchive(false)} />}</AnimatePresence>
      <AnimatePresence>{menu && <MenuSheet onClose={() => setMenu(false)} onArchive={() => { setMenu(false); setArchive(true); }} onGraphics={() => { setMenu(false); setGfxOpen(true); }} />}</AnimatePresence>
      <AnimatePresence>{gfxOpen && <GraphicsSheet onClose={() => setGfxOpen(false)} />}</AnimatePresence>
      <FpsMeter />
    </div>
  );
}

function RoundBtn({ icon: Icon, label, onClick, active }: { icon: LucideIcon; label: string; onClick: () => void; active?: boolean }) {
  return (
    <motion.button type="button" whileTap={{ scale: 0.9 }} aria-label={label} title={label} onClick={onClick} className={`w-round ${active ? "w-round--on" : ""}`}>
      <Icon strokeWidth={2.2} />
    </motion.button>
  );
}

// ───────────── Minimap ─────────────

function Minimap() {
  const cv = useRef<HTMLCanvasElement>(null);
  const scene = useWorld((s) => s.scene);
  useEffect(() => {
    const c = cv.current;
    if (!c) return;
    const ctx = c.getContext("2d");
    if (!ctx) return;
    const draw = () => {
      const dpr = Math.min(2, window.devicePixelRatio || 1);
      const css = c.clientWidth;
      if (c.width !== Math.round(css * dpr)) {
        c.width = c.height = Math.round(css * dpr);
      }
      const W = c.width;
      if (W < 8) return; // canvas chưa có kích thước (đang ẩn) → bỏ qua, tránh bán kính âm
      const R = W / 2;
      const w = useWorld.getState();
      const p = w.player;
      const scale = (R * 0.92) / (w.scene === "expanse" ? 34 : 18); // px mỗi mét
      ctx.clearRect(0, 0, W, W);
      ctx.save();
      ctx.beginPath();
      ctx.arc(R, R, R - 1, 0, Math.PI * 2);
      ctx.clip();
      const bg = ctx.createRadialGradient(R, R, R * 0.1, R, R, R);
      bg.addColorStop(0, "rgba(46,58,104,0.78)");
      bg.addColorStop(1, "rgba(18,22,43,0.82)");
      ctx.fillStyle = bg;
      ctx.fillRect(0, 0, W, W);
      // Vòng lưới
      ctx.strokeStyle = "rgba(236,215,169,0.16)";
      ctx.lineWidth = dpr;
      for (const k of [0.33, 0.66]) {
        ctx.beginPath();
        ctx.arc(R, R, R * k, 0, Math.PI * 2);
        ctx.stroke();
      }
      const toMap = (x: number, z: number) => [R + (x - p.x) * scale, R + (z - p.z) * scale] as const;
      // Sảnh: vành quảng trường + cổng
      if (w.scene === "hub") {
        const [cx, cy] = toMap(0, 0);
        ctx.strokeStyle = "rgba(236,215,169,0.45)";
        ctx.lineWidth = 2 * dpr;
        ctx.beginPath();
        ctx.arc(cx, cy, 15 * scale, 0, Math.PI * 2);
        ctx.stroke();
        for (const s of [SPOTS.portal, SPOTS.gate, SPOTS.gate2, SPOTS.museum]) {
          const [x, y] = toMap(s.x, s.z);
          ctx.fillStyle = "#ffd27a";
          ctx.beginPath();
          ctx.moveTo(x, y - 4 * dpr);
          ctx.lineTo(x + 4 * dpr, y);
          ctx.lineTo(x, y + 4 * dpr);
          ctx.lineTo(x - 4 * dpr, y);
          ctx.fill();
        }
      }
      // Quái
      for (const e of enemies) {
        if (e.deadAt) continue;
        const [x, y] = toMap(e.pos.x, e.pos.z);
        ctx.fillStyle = "#ff5d7a";
        ctx.beginPath();
        ctx.arc(x, y, 3 * dpr, 0, Math.PI * 2);
        ctx.fill();
      }
      // Người chơi khác
      const now = performance.now();
      for (const peer of netPeers().values()) {
        const sp = samplePeer(peer, now);
        if (!sp) continue;
        const [x, y] = toMap(sp.x, sp.z);
        ctx.fillStyle = "#7fe3ff";
        ctx.beginPath();
        ctx.arc(x, y, 3 * dpr, 0, Math.PI * 2);
        ctx.fill();
      }
      // Hình quạt tầm nhìn của máy quay
      const va = Math.atan2(-Math.cos(w.camYaw), -Math.sin(w.camYaw)); // hướng nhìn trên bản đồ (x=dx, y=dz)
      const cone = ctx.createRadialGradient(R, R, 0, R, R, R * 0.7);
      cone.addColorStop(0, "rgba(255,255,255,0.35)");
      cone.addColorStop(1, "rgba(255,255,255,0)");
      ctx.fillStyle = cone;
      ctx.beginPath();
      ctx.moveTo(R, R);
      ctx.arc(R, R, R * 0.7, va - 0.55, va + 0.55);
      ctx.fill();
      ctx.restore();
      // Mũi tên người chơi
      ctx.save();
      ctx.translate(R, R);
      ctx.rotate(Math.atan2(Math.cos(w.playerYaw), Math.sin(w.playerYaw)) + Math.PI / 2);
      ctx.fillStyle = "#fff6dc";
      ctx.strokeStyle = "#3a2440";
      ctx.lineWidth = 1.5 * dpr;
      ctx.beginPath();
      ctx.moveTo(0, -7 * dpr);
      ctx.lineTo(5 * dpr, 6 * dpr);
      ctx.lineTo(0, 3 * dpr);
      ctx.lineTo(-5 * dpr, 6 * dpr);
      ctx.closePath();
      ctx.fill();
      ctx.stroke();
      ctx.restore();
    };
    draw();
    const id = window.setInterval(draw, 100);
    return () => window.clearInterval(id);
  }, [scene]);
  return (
    <div className="w-minimap">
      <canvas ref={cv} className="h-full w-full rounded-full" />
      <span className="w-minimap__n">N</span>
    </div>
  );
}

function RealmChip({ readOnly }: { readOnly: boolean }) {
  const t = useT();
  const scene = useWorld((s) => s.scene);
  const [, setV] = useState(0);
  useEffect(() => onNet(() => setV((v) => v + 1)), []);
  const st = netStatus();
  const name = scene === "hub" ? t("plazaName") : scene === "expanse" ? t("expanseName") : scene === "impossible" ? t("impossibleName") : scene === "siren" ? t("sirenName") : scene === "babel" ? t("babelName") : scene === "paradox" ? t("paradoxName") : scene === "study" ? t("studyName") : scene === "vault" ? t("vaultName") : scene === "torus" ? t("torusName") : scene === "coast" ? t("coastName") : scene === "bazaar" ? t("bazaarName") : scene === "archive" ? t("archiveName") : t("title");
  return (
    <div className="flex items-center gap-[calc(var(--u)*6px)]">
      <span className="w-chip w-chip--gold">
        <span>{name}</span>
      </span>
      {st !== "off" && (
        <span className="w-pill">
          <span className={`inline-block h-1.5 w-1.5 rounded-full ${st === "online" ? "bg-emerald-400 shadow-[0_0_6px_#34d399]" : "animate-pulse bg-amber-300"}`} />
          {st === "online" ? netPeers().size + 1 : "…"}
        </span>
      )}
      {readOnly && <span className="w-pill w-pill--rose">{t("viewOnly")}</span>}
    </div>
  );
}

// ───────────── Thanh máu ─────────────

function HpBar({ raised }: { raised: boolean }) {
  const hp = useCombat((s) => s.hp);
  const maxHp = useCombat((s) => s.maxHp);
  const avatar = useWorld((s) => s.avatar);
  const [trail, setTrail] = useState(hp);
  useEffect(() => {
    // Vệt trắng tụt chậm sau khi mất máu (thấy rõ lượng vừa mất)
    if (hp >= trail) {
      setTrail(hp);
      return;
    }
    const id = window.setTimeout(() => setTrail(hp), 450);
    return () => window.clearTimeout(id);
  }, [hp, trail]);
  const a = AVATAR_BY_ID[avatar];
  const r = hp / maxHp;
  return (
    <div className={`w-hp ${raised ? "w-hp--raised" : ""}`}>
      <div className="w-hp__row">
        <span className="w-hp__name">{a?.name ?? ""}</span>
        <span className="w-hp__num">
          {Math.ceil(hp)} <span className="opacity-60">/ {maxHp}</span>
        </span>
      </div>
      <div className="w-hp__track">
        <div className="w-hp__trail" style={{ width: `${(trail / maxHp) * 100}%` }} />
        <div className={`w-hp__fill ${r < 0.3 ? "w-hp__fill--low" : ""}`} style={{ width: `${r * 100}%` }} />
      </div>
    </div>
  );
}

/**
 * Kính + thước ngắm của ống nhòm: SVG TĨNH (mặt nạ có lọc Gaussian toàn màn hình) — tách riêng + memo + layer riêng
 * để không bị raster lại mỗi khi la bàn / khoảng cách đổi (trước đây vẽ lại theo từng khung xoay máy quay → cực lag).
 */
const ScopeGlass = memo(function ScopeGlass() {
  return (
    <div style={{ position: "absolute", inset: 0, willChange: "transform", contain: "strict" }}>
      {/* hai vòng kính (mép mềm) khoét trong nền tối — SVG mask, toạ độ vuông (luôn tròn) */}
      <svg className="w-scope__mask" viewBox="0 0 100 100" preserveAspectRatio="xMidYMid meet">
        <defs>
          <filter id="scopeSoft" x="-50%" y="-50%" width="200%" height="200%">
            <feGaussianBlur stdDeviation="1.4" />
          </filter>
          <mask id="scopeHole" maskUnits="userSpaceOnUse" x="-500" y="-500" width="1100" height="1100">
            <rect x="-500" y="-500" width="1100" height="1100" fill="white" />
            <g filter="url(#scopeSoft)">
              <circle cx="34" cy="50" r="33" fill="black" />
              <circle cx="66" cy="50" r="33" fill="black" />
            </g>
          </mask>
        </defs>
        <rect x="-500" y="-500" width="1100" height="1100" fill="rgba(4,6,14,0.96)" mask="url(#scopeHole)" />
        <circle cx="34" cy="50" r="33" fill="none" stroke="rgba(140,210,255,.18)" strokeWidth="0.4" />
        <circle cx="66" cy="50" r="33" fill="none" stroke="rgba(140,210,255,.18)" strokeWidth="0.4" />
      </svg>
      <svg className="w-scope__reticle" viewBox="-100 -100 200 200">
        <circle r="38" fill="none" stroke="rgba(190,240,255,.55)" strokeWidth="0.8" />
        <path d="M-70 0H-12M12 0H70M0 -70V-12M0 12V70" stroke="rgba(190,240,255,.8)" strokeWidth="0.9" />
        {[-48, -36, -24, 24, 36, 48].map((x) => (
          <path key={x} d={`M${x} -3V3`} stroke="rgba(190,240,255,.7)" strokeWidth="0.8" />
        ))}
        {[-48, -36, -24, 24, 36, 48].map((y) => (
          <path key={`y${y}`} d={`M-3 ${y}H3`} stroke="rgba(190,240,255,.7)" strokeWidth="0.8" />
        ))}
        <circle r="1.6" fill="#ffd27a" />
      </svg>
    </div>
  );
});

/** Khung ống nhòm: mặt nạ hai vòng kính, thước ngắm, độ phóng, khoảng cách, la bàn, mục tiêu đang nhìn; thanh phóng cho điện thoại */
function ScopeOverlay() {
  const zoom = useScope((s) => s.zoom);
  const target = useScope((s) => s.target);
  const dist = useScope((s) => s.dist);
  // hướng nhìn (độ nguyên, 0 = bắc / −z, theo chiều kim đồng hồ) — chỉ re-render khi đổi ≥ 1°
  const heading = useWorld((s) => Math.round(((((-s.camYaw * 180) / Math.PI) % 360) + 360) % 360) % 360);
  const vi = useWorld((s) => s.lang === "vi");
  const dirs = vi ? ["B", "ĐB", "Đ", "ĐN", "N", "TN", "T", "TB"] : ["N", "NE", "E", "SE", "S", "SW", "W", "NW"];
  const dir = dirs[Math.round(heading / 45) % 8];
  return (
    <motion.div className="w-scope" initial={{ opacity: 0, scale: 1.08 }} animate={{ opacity: 1, scale: 1 }} exit={{ opacity: 0, scale: 1.05 }} transition={{ duration: 0.25 }}>
      <ScopeGlass />
      <div className="w-scope__hud">
        <span className="w-scope__zoom">×{zoom.toFixed(1)}</span>
        <span>
          {dir} {Math.round(heading)}°
        </span>
        <span>{dist != null ? `${dist < 100 ? dist.toFixed(1) : Math.round(dist)} m` : "∞"}</span>
      </div>
      <AnimatePresence mode="wait">
        {target && (
          <motion.div key={target} className="w-scope__target" initial={{ opacity: 0, y: 6 }} animate={{ opacity: 1, y: 0 }} exit={{ opacity: 0 }}>
            <small>{vi ? "Đang quan sát" : "Observing"}</small>
            {target}
          </motion.div>
        )}
      </AnimatePresence>
      <div className="w-scope__ctrl pointer-events-auto">
        <button type="button" onClick={() => zoomBy(1 / 1.4)} aria-label="zoom out">
          −
        </button>
        <input type="range" min={Math.log(ZOOM_MIN)} max={Math.log(ZOOM_MAX)} step={0.01} value={Math.log(zoom)} onChange={(e) => useScope.setState({ zoom: Math.exp(Number(e.target.value)) })} />
        <button type="button" onClick={() => zoomBy(1.4)} aria-label="zoom in">
          +
        </button>
        <button type="button" className="w-scope__close" onClick={() => toggleScope(false)}>
          {vi ? "Thoát (Z)" : "Exit (Z)"}
        </button>
      </div>
      <p className="w-scope__hint">{vi ? "Rê chuột / vuốt để nhìn quanh · lăn chuột để phóng" : "Move mouse / swipe to look · scroll to zoom"}</p>
    </motion.div>
  );
}

/** Bay lượn (sân Bất Khả): độ cao · tốc độ · đường bay vòng sáng (vòng / giờ / kỷ lục) · gợi ý điều khiển · vệt gió khi được đẩy */
function FlightHud() {
  const { enabled, soaring, alt, spd, boost } = useFlight();
  const { passed, total, startedAt, best, finishedAt, lastTime } = useRings();
  const vi = useWorld((s) => s.lang === "vi");
  const [now, setNow] = useState(0);
  const racing = passed > 0;
  useEffect(() => {
    if (!racing && !finishedAt) return;
    const id = window.setInterval(() => setNow(performance.now()), 100);
    return () => window.clearInterval(id);
  }, [racing, finishedAt]);
  const fmt = (ms: number) => `${Math.floor(ms / 60000)}:${((ms / 1000) % 60).toFixed(1).padStart(4, "0")}`;
  const justDone = finishedAt > 0 && now - finishedAt < 6000;
  return (
    <>
      <AnimatePresence>
        {(soaring || racing || justDone) && (
          <motion.div className="w-fly" initial={{ opacity: 0, y: -8 }} animate={{ opacity: 1, y: 0 }} exit={{ opacity: 0, y: -8 }}>
            {soaring && (
              <span className="w-fly__gauge">
                <b>{alt}</b> m <i /> <b>{Math.round(spd * 3.6)}</b> km/h
              </span>
            )}
            {racing && (
              <span className="w-fly__race">
                {vi ? "Vòng" : "Ring"} <b>{passed}</b>/{total} · {fmt(Math.max(0, now - startedAt))}
              </span>
            )}
            {!racing && justDone && (
              <span className="w-fly__race is-done">
                {vi ? "Về đích" : "Finished"} {fmt(lastTime)} {best !== null && Math.abs(best - lastTime) < 1 ? (vi ? "· KỶ LỤC MỚI" : "· NEW RECORD") : best !== null ? `· ${vi ? "kỷ lục" : "best"} ${fmt(best)}` : ""}
              </span>
            )}
            {!racing && !justDone && soaring && best !== null && <span className="w-fly__best">{vi ? "Kỷ lục vòng bay" : "Ring record"} {fmt(best)}</span>}
          </motion.div>
        )}
      </AnimatePresence>
      {enabled && (
      <p className="w-fly__hint">
        {soaring
          ? vi
            ? "Nhìn lên: bay lên · nhìn xuống: lao xuống · Shift: tăng tốc · Space: gập cánh"
            : "Look up: climb · look down: dive · Shift: boost · Space: fold wings"
          : vi
            ? "Nhảy rồi bấm nhảy lần nữa trên không để giang cánh bay"
            : "Jump, then press jump again in mid-air to spread your wings"}
      </p>
      )}
      <div className={`w-fly__wind ${boost ? "is-on" : ""}`} />
    </>
  );
}

/** Công tắc phong cách Hư Không Nghịch Lý: lai siêu thực ↔ hoạt hình (cel) */
function PdxStyleToggle() {
  const real = usePdxStyle((s) => s.real);
  const vi = useWorld((s) => s.lang === "vi");
  return (
    <button type="button" onClick={togglePdxStyle} className="w-style-toggle pointer-events-auto" title={vi ? "Đổi phong cách đồ hoạ" : "Switch art style"}>
      <Sparkles size={14} />
      <span className={real ? "is-on" : ""}>{vi ? "Siêu thực" : "Hyper-real"}</span>
      <i />
      <span className={real ? "" : "is-on"}>{vi ? "Hoạt hình" : "Anime"}</span>
    </button>
  );
}

// ───────────── Phản hồi chiến đấu: thể lực, combo, đánh giá nhịp, Khúc xạ thời gian ─────────────

function CombatFeedback() {
  const stamina = useCombat((s) => s.stamina);
  const combo = useCombat((s) => s.combo);
  const comboAt = useCombat((s) => s.comboAt);
  const judge = useCombat((s) => s.judge);
  const slowAt = useCombat((s) => s.slowAt);
  // đồng hồ HUD (cập nhật 10 lần/giây) — để ẩn combo / lời đánh giá khi hết hạn
  const [now, setNow] = useState(0);
  useEffect(() => {
    const id = window.setInterval(() => setNow(performance.now()), 100);
    return () => window.clearInterval(id);
  }, []);
  const showCombo = combo >= 2 && now - comboAt < 2600;
  const slow = now - slowAt < 2200;
  return (
    <>
      <div className={`w-stam ${stamina >= STAMINA_MAX - 0.5 ? "w-stam--full" : ""}`}>
        <div className="w-stam__fill" style={{ width: `${(stamina / STAMINA_MAX) * 100}%` }} />
      </div>
      <AnimatePresence>
        {showCombo && (
          <motion.div key="combo" className="w-combo" initial={{ opacity: 0, x: 20 }} animate={{ opacity: 1, x: 0 }} exit={{ opacity: 0 }}>
            <motion.b key={combo} initial={{ scale: 1.45 }} animate={{ scale: 1 }} transition={{ type: "spring", stiffness: 520, damping: 18 }}>
              {combo}
            </motion.b>
            <span>COMBO</span>
          </motion.div>
        )}
      </AnimatePresence>
      <AnimatePresence>
        {judge && now - judge.at < 1100 && (
          <motion.div key={judge.at} className={`w-judge w-judge--${judge.kind}`} initial={{ opacity: 0, y: 10, scale: 0.8 }} animate={{ opacity: 1, y: 0, scale: 1 }} exit={{ opacity: 0, y: -12 }} transition={{ type: "spring", stiffness: 480, damping: 22 }}>
            {judge.text}
          </motion.div>
        )}
      </AnimatePresence>
      {slow && <div className="w-slowmo" key={slowAt} />}
    </>
  );
}

/** Thẻ "Thế võ" của vũ khí đang cầm: chuỗi đòn, tụ lực, kỹ năng, mẹo luyện */
function MovesetCard({ id, color, onClose }: { id: WeaponId; color: string; onClose: () => void }) {
  const lang = useWorld((s) => (s.lang === "vi" ? "vi" : "en"));
  const ms = MOVESETS[id];
  const vi = lang === "vi";
  return (
    <motion.div className="w-moves" style={{ ["--wc" as string]: color }} initial={{ opacity: 0, y: 12 }} animate={{ opacity: 1, y: 0 }} exit={{ opacity: 0, y: 12 }} onPointerDown={(e) => e.stopPropagation()}>
      <div className="w-moves__head">
        <b>{vi ? "Thế võ" : "Moveset"}</b>
        <button type="button" onClick={onClose} aria-label="close">
          <X size={14} />
        </button>
      </div>
      <ol className="w-moves__chain">
        {ms.chain.map((m, i) => (
          <li key={i}>
            <span>{i + 1}</span>
            {m.name[lang]}
          </li>
        ))}
      </ol>
      <div className="w-moves__row">
        <i>{vi ? "Giữ chuột" : "Hold"}</i> {ms.charged.name[lang]}
      </div>
      <div className="w-moves__row">
        <i>E</i> {ms.skill.name[lang]}
      </div>
      <div className="w-moves__row">
        <i>Shift</i> {vi ? "Né — né sát lúc bị đánh = Khúc xạ thời gian" : "Dodge — dodge right before a hit = Time Refraction"}
      </div>
      <p className="w-moves__tip">{ms.tip[lang]}</p>
      <p className="w-moves__rule">
        {vi
          ? "Nhịp: bấm nhát kế ngay khi vũ khí loé (sau mỗi nhát trúng) → +35% sát thương, nhát sau nhanh hơn; 3 Nhịp liền → nhát kết cường hoá. Bấm loạn ≥ 3 lần một nhát → mất Nhịp."
          : "Rhythm: press the next hit right as the weapon flashes (after each impact) → +35% damage, faster follow-up; 3 in a row → empowered finisher. Mashing ≥ 3 times in one hit breaks the Rhythm."}
      </p>
    </motion.div>
  );
}

// ───────────── Bảng hành động ─────────────

function ActionPad({ blocks, onSigil }: { blocks: boolean; onSigil: () => void }) {
  const t = useT();
  const lang = useWorld((s) => s.lang);
  const weapon = useCombat((s) => s.weapon);
  const energy = useCombat((s) => s.energy);
  const skillAt = useCombat((s) => s.skillAt);
  const loadout = useBag((s) => s.loadout).filter(Boolean) as WeaponId[];
  const curId = loadout[weapon % Math.max(1, loadout.length)] ?? "blade";
  const wp = WEAPON_DEFS[curId];
  const [touch, setTouch] = useState(false);
  useEffect(() => setTouch(window.matchMedia("(pointer: coarse)").matches), []);
  const fire = (d: "mine-start" | "mine-stop" | "place") => window.dispatchEvent(new CustomEvent("world-block", { detail: d }));
  const [moves, setMoves] = useState(false);
  useEffect(() => {
    const k = (e: KeyboardEvent) => {
      if (e.key.toLowerCase() === "h" && !(e.target instanceof HTMLInputElement) && !(e.target instanceof HTMLTextAreaElement)) setMoves((v) => !v);
    };
    window.addEventListener("keydown", k);
    return () => window.removeEventListener("keydown", k);
  }, []);
  return (
    <div className="w-pad" style={{ ["--wc" as string]: wp.color }}>
      <div className="w-pad__slot" style={{ right: "calc(var(--u) * 14px)", bottom: "calc(var(--u) * 14px)" }}>
        <SkillBtn icon={Sword} art={<WeaponGlyph id={curId} />} size={80} label={t("attack")} keycap="LMB" onPress={attackDown} onRelease={attackUp} tone="attack" />
      </div>
      <div className="w-pad__slot" style={{ right: "calc(var(--u) * 104px)", bottom: "calc(var(--u) * 10px)" }}>
        <SkillBtn icon={Wind} size={58} label={t("skill")} keycap="E" onPress={skill} cooldownFrom={skillAt} cooldownMs={SKILL_CD} />
      </div>
      <div className="w-pad__slot" style={{ right: "calc(var(--u) * 26px)", bottom: "calc(var(--u) * 106px)" }}>
        <SkillBtn icon={Sparkles} size={62} label={t("burst")} keycap="Q" onPress={burst} energy={energy / ENERGY_MAX} tone="burst" />
      </div>
      <div className="w-pad__slot" style={{ right: "calc(var(--u) * 100px)", bottom: "calc(var(--u) * 82px)" }}>
        <SkillBtn icon={ChevronsUp} size={50} label={t("jump")} keycap="Space" onPress={jump} />
      </div>
      <div className="w-pad__slot" style={{ right: "calc(var(--u) * 168px)", bottom: "calc(var(--u) * 14px)" }}>
        <SkillBtn icon={ChevronsRight} size={52} label={lang === "vi" ? "Né" : "Dodge"} keycap="Shift" onPress={dodge} />
      </div>
      <div className="w-pad__slot" style={{ right: "calc(var(--u) * 166px)", bottom: "calc(var(--u) * 70px)" }}>
        <motion.button type="button" whileTap={{ scale: 0.9 }} onClick={() => cycleWeapon(1)} className="w-weapon" aria-label={t("switchWeapon")} title={wp.name[lang as Lang] ?? wp.name.en}>
          <span className="w-weapon__inner">
            <Repeat strokeWidth={2.4} />
            <span className="w-weapon__dots">
              {loadout.map((w, i) => (
                <i key={w} style={{ background: i === weapon % loadout.length ? WEAPON_DEFS[w].color : "rgba(255,255,255,.35)" }} />
              ))}
            </span>
            <span className="w-key">R</span>
          </span>
        </motion.button>
      </div>
      <div className="w-pad__slot" style={{ right: "calc(var(--u) * 30px)", bottom: "calc(var(--u) * 176px)" }}>
        <SigilButton onOpen={onSigil} />
      </div>
      {curId === "bow" && (
        <div className="w-pad__slot" style={{ right: "calc(var(--u) * 92px)", bottom: "calc(var(--u) * 150px)" }}>
          <AimButton />
        </div>
      )}
      {blocks && touch && (
        <>
          <div className="w-pad__slot" style={{ right: "calc(var(--u) * 168px)", bottom: "calc(var(--u) * 128px)" }}>
            <SkillBtn icon={Box} size={46} label={t("place")} onPress={() => fire("place")} />
          </div>
          <div className="w-pad__slot" style={{ right: "calc(var(--u) * 112px)", bottom: "calc(var(--u) * 146px)" }}>
            <SkillBtn icon={Pickaxe} size={46} label={t("break")} onPress={() => fire("mine-start")} onRelease={() => fire("mine-stop")} />
          </div>
        </>
      )}
      <AnimatePresence mode="popLayout">
        <motion.button key={weapon} type="button" onClick={() => setMoves((v) => !v)} initial={{ opacity: 0, x: 10 }} animate={{ opacity: 1, x: 0 }} exit={{ opacity: 0 }} className="w-weapon__name" title={lang === "vi" ? "Thế võ (H)" : "Moveset (H)"}>
          {wp.name[lang as Lang] ?? wp.name.en}
        </motion.button>
      </AnimatePresence>
      <AnimatePresence>{moves && MOVESETS[curId] && <MovesetCard id={curId} color={wp.color} onClose={() => setMoves(false)} />}</AnimatePresence>
    </div>
  );
}

function SkillBtn({
  icon: Icon,
  size,
  label,
  keycap,
  onPress,
  onRelease,
  cooldownFrom,
  cooldownMs,
  energy,
  hold,
  tone,
  art,
}: {
  art?: React.ReactNode;
  icon: LucideIcon;
  size: number;
  label: string;
  keycap?: string;
  onPress: () => void;
  onRelease?: () => void;
  cooldownFrom?: number;
  cooldownMs?: number;
  energy?: number;
  hold?: boolean;
  tone?: "attack" | "burst";
}) {
  const [left, setLeft] = useState(0);
  const holdRef = useRef<number | null>(null);
  useEffect(() => {
    if (!cooldownMs || cooldownFrom === undefined) return;
    const tick = () => setLeft(Math.max(0, cooldownMs - (performance.now() - cooldownFrom)));
    tick();
    const id = window.setInterval(tick, 100);
    return () => window.clearInterval(id);
  }, [cooldownFrom, cooldownMs]);
  const cd = cooldownMs ? left / cooldownMs : 0;
  const ready = energy === undefined || energy >= 1;
  const stop = () => {
    if (holdRef.current) window.clearInterval(holdRef.current);
    holdRef.current = null;
  };
  useEffect(() => stop, []);
  return (
    <motion.button
      type="button"
      aria-label={label}
      title={label}
      whileTap={{ scale: 0.88 }}
      onPointerDown={(e) => {
        e.stopPropagation();
        onPress();
        // Giữ nút tấn công = đánh liên hoàn
        if (hold) {
          stop();
          holdRef.current = window.setInterval(onPress, 120);
        }
      }}
      onPointerUp={() => (stop(), onRelease?.())}
      onPointerLeave={() => (stop(), onRelease?.())}
      onPointerCancel={() => (stop(), onRelease?.())}
      className={`w-skill ${tone ? `w-skill--${tone}` : ""} ${energy !== undefined && ready ? "w-skill--ready" : ""}`}
      style={{ width: `calc(var(--u) * ${size}px)`, height: `calc(var(--u) * ${size}px)` }}
    >
      {energy !== undefined && (
        <svg className="w-skill__ring" viewBox="0 0 100 100">
          <circle cx="50" cy="50" r="46" pathLength={100} className="w-skill__ring-bg" />
          <circle cx="50" cy="50" r="46" pathLength={100} className="w-skill__ring-fg" style={{ strokeDasharray: `${Math.min(1, energy) * 100} 100` }} />
        </svg>
      )}
      {art ?? <Icon className="w-skill__icon" strokeWidth={2.2} />}
      {cd > 0 && (
        <>
          <span className="w-skill__cd" style={{ background: `conic-gradient(rgba(10,12,28,.72) ${cd * 360}deg, transparent 0)` }} />
          <span className="w-skill__num">{(left / 1000).toFixed(1)}</span>
        </>
      )}
      {keycap && <span className="w-key">{keycap}</span>}
    </motion.button>
  );
}

// ───────────── Tương tác ─────────────

function InteractPrompt({ onInteract }: { onInteract: () => void }) {
  const nearby = useWorld((s) => s.nearby);
  return (
    <div className="pointer-events-none absolute left-[57%] top-[44%]">
      <AnimatePresence>
        {nearby && (
          <motion.button
            key={`${nearby.kind}:${nearby.id ?? ""}`}
            type="button"
            initial={{ opacity: 0, x: 18 }}
            animate={{ opacity: 1, x: 0 }}
            exit={{ opacity: 0, x: 18 }}
            transition={{ type: "spring", stiffness: 420, damping: 32 }}
            onClick={onInteract}
            className="w-prompt pointer-events-auto"
          >
            <span className="w-prompt__key">F</span>
            <span className="w-prompt__body">
              <Hand size={15} strokeWidth={2.4} />
              <span className="truncate">{nearby.label}</span>
            </span>
          </motion.button>
        )}
      </AnimatePresence>
    </div>
  );
}

function DownVeil() {
  const t = useT();
  const down = useCombat((s) => s.downUntil);
  const [on, setOn] = useState(false);
  useEffect(() => {
    const ms = down - performance.now();
    if (ms <= 0) return;
    setOn(true);
    const id = window.setTimeout(() => setOn(false), ms);
    return () => window.clearTimeout(id);
  }, [down]);
  return (
    <AnimatePresence>
      {on && (
        <motion.div initial={{ opacity: 0 }} animate={{ opacity: 1 }} exit={{ opacity: 0 }} className="absolute inset-0 flex items-center justify-center bg-[radial-gradient(circle,transparent_30%,rgba(90,10,40,.55))]">
          <span className="w-banner">
            <span>{t("recovering")}</span>
          </span>
        </motion.div>
      )}
    </AnimatePresence>
  );
}

function ControlsToast() {
  const t = useT();
  const [show, setShow] = useState(false);
  useEffect(() => {
    if (!window.matchMedia("(pointer: fine)").matches) return;
    setShow(true);
    const id = window.setTimeout(() => setShow(false), 9000);
    return () => window.clearTimeout(id);
  }, []);
  return (
    <AnimatePresence>
      {show && (
        <motion.div initial={{ opacity: 0, y: 8 }} animate={{ opacity: 1, y: 0 }} exit={{ opacity: 0 }} className="w-toast absolute left-1/2 top-[calc(var(--pt)+var(--u)*96px)] -translate-x-1/2">
          <Keyboard size={14} />
          {t("controlsHint")}
        </motion.div>
      )}
    </AnimatePresence>
  );
}

// ───────────── Menu ─────────────

/** Cài đặt đồ hoạ & hiệu ứng: 4 mức sẵn + từng tuỳ chọn (lưu trong máy) */
function GraphicsSheet({ onClose }: { onClose: () => void }) {
  const g = useGfx();
  const vi = useWorld((s) => s.lang === "vi");
  const L = (a: string, b: string) => (vi ? a : b);
  const presets: { id: Exclude<Preset, "custom">; label: string }[] = [
    { id: "low", label: L("Thấp", "Low") },
    { id: "medium", label: L("Vừa", "Medium") },
    { id: "high", label: L("Cao", "High") },
    { id: "ultra", label: L("Siêu", "Ultra") },
  ];
  type Tk = "aa" | "bloom" | "ao" | "reflections" | "godrays" | "dof" | "shadows" | "grain" | "fps";
  const toggles: { k: Tk; label: string; hint: string }[] = [
    { k: "aa", label: L("Khử răng cưa (SMAA)", "Anti-aliasing (SMAA)"), hint: L("mép mịn", "smooth edges") },
    { k: "bloom", label: L("Quầng sáng HDR", "HDR bloom"), hint: L("vật phát sáng toả quầng", "glowing objects halo") },
    { k: "ao", label: L("Che khuất môi trường (N8AO)", "Ambient occlusion (N8AO)"), hint: L("khe, góc tối tự nhiên", "natural contact darkening") },
    { k: "reflections", label: L("Phản chiếu mặt gương", "Planar reflections"), hint: L("sàn gương Hư Không", "Paradox Void mirror floor") },
    { k: "godrays", label: L("Tia sáng thể tích", "Volumetric god rays"), hint: L("tia sáng từ hố đen", "rays from the black hole") },
    { k: "dof", label: L("Độ sâu trường ảnh (bokeh)", "Depth of field (bokeh)"), hint: L("nền nhoà như ống kính", "lens-like background blur") },
    { k: "shadows", label: L("Bóng đổ thời gian thực", "Real-time shadows"), hint: L("nặng nhất — máy mạnh", "heaviest — strong GPUs") },
    { k: "grain", label: L("Hạt phim & quang sai", "Film grain & aberration"), hint: L("chất điện ảnh", "cinematic texture") },
    { k: "fps", label: L("Hiện FPS", "Show FPS"), hint: L("đo khung hình / giây", "frames per second") },
  ];
  return (
    <>
      <motion.div className="pointer-events-auto absolute inset-0 bg-[#0b0f24]/40" initial={{ opacity: 0 }} animate={{ opacity: 1 }} exit={{ opacity: 0 }} onClick={onClose} />
      <motion.aside className="w-sheet pointer-events-auto" initial={{ x: "105%" }} animate={{ x: 0 }} exit={{ x: "105%" }} transition={{ type: "spring", stiffness: 380, damping: 36 }}>
        <header className="w-sheet__head">
          <span className="w-sheet__title">{L("Đồ hoạ & hiệu ứng", "Graphics & effects")}</span>
          <button type="button" className="w-round w-round--sm" aria-label="close" onClick={onClose}>
            <X strokeWidth={2.4} />
          </button>
        </header>
        <nav className="w-sheet__body">
          <div className="w-row w-row--col">
            <span>{L("Mức chất lượng", "Quality preset")}</span>
            <span className="w-seg w-seg--wide">
              {presets.map((p) => (
                <button key={p.id} type="button" className={g.preset === p.id ? "is-on" : ""} onClick={() => applyPreset(p.id)}>
                  {p.label}
                </button>
              ))}
            </span>
            {g.preset === "custom" && <span className="w-gfx__hint">{L("Đang dùng tuỳ chỉnh riêng", "Using custom settings")}</span>}
          </div>
          <div className="w-row w-row--col">
            <span>
              {L("Độ phân giải render", "Render resolution")} · <b>{Math.round(g.scale * 100)}%</b>
            </span>
            <input type="range" min={50} max={100} step={5} value={Math.round(g.scale * 100)} onChange={(e) => setGfx({ scale: Number(e.target.value) / 100 })} className="w-gfx__range" />
          </div>
          <div className="w-row w-row--col">
            <span>{L("Mật độ hiệu ứng hạt", "Particle density")}</span>
            <span className="w-seg w-seg--wide">
              {([0, 1, 2] as const).map((v) => (
                <button key={v} type="button" className={g.vfx === v ? "is-on" : ""} onClick={() => setGfx({ vfx: v })}>
                  {[L("Thấp", "Low"), L("Vừa", "Mid"), L("Cao", "High")][v]}
                </button>
              ))}
            </span>
          </div>
          {toggles.map((o) => (
            <button key={o.k} type="button" className="w-row" onClick={() => setGfx({ [o.k]: !g[o.k] })}>
              <span className="w-gfx__lab">
                {o.label}
                <small>{o.hint}</small>
              </span>
              <span className={`w-switch ${g[o.k] ? "is-on" : ""}`} />
            </button>
          ))}
        </nav>
      </motion.aside>
    </>
  );
}

/** Bộ đếm khung hình (bật trong cài đặt đồ hoạ) */
function FpsMeter() {
  const on = useGfx((s) => s.fps);
  const [fps, setFps] = useState(0);
  useEffect(() => {
    if (!on) return;
    let n = 0;
    let t0 = performance.now();
    let raf = 0;
    const loop = () => {
      n++;
      const now = performance.now();
      if (now - t0 >= 500) {
        setFps(Math.round((n * 1000) / (now - t0)));
        n = 0;
        t0 = now;
      }
      raf = requestAnimationFrame(loop);
    };
    raf = requestAnimationFrame(loop);
    return () => cancelAnimationFrame(raf);
  }, [on]);
  if (!on) return null;
  return <div className={`w-fps ${fps < 30 ? "is-low" : fps < 50 ? "is-mid" : ""}`}>{fps} FPS</div>;
}

function MenuSheet({ onClose, onArchive, onGraphics }: { onClose: () => void; onArchive: () => void; onGraphics: () => void }) {
  const t = useT();
  const lang = useWorld((s) => s.lang);
  const creatures = useWorld((s) => s.state.creatures);
  const [sound, setSound] = useState(true);
  useEffect(() => setSound(isSfxEnabled()), []);
  const setLang = (l: Lang) => {
    useWorld.setState({ lang: l });
    try {
      localStorage.setItem("world.lang", l);
    } catch {}
  };
  return (
    <>
      <motion.div className="pointer-events-auto absolute inset-0 bg-[#0b0f24]/40" initial={{ opacity: 0 }} animate={{ opacity: 1 }} exit={{ opacity: 0 }} onClick={onClose} />
      <motion.aside
        className="w-sheet pointer-events-auto"
        initial={{ x: "105%" }}
        animate={{ x: 0 }}
        exit={{ x: "105%" }}
        transition={{ type: "spring", stiffness: 380, damping: 36 }}
      >
        <header className="w-sheet__head">
          <span className="w-sheet__title">{t("menu")}</span>
          <button type="button" className="w-round w-round--sm" aria-label={t("close")} onClick={onClose}>
            <X strokeWidth={2.4} />
          </button>
        </header>
        <nav className="w-sheet__body">
          <Link href="/home" className="w-row">
            <Home />
            <span>{t("home")}</span>
          </Link>
          <button type="button" className="w-row" onClick={onArchive}>
            <BookOpen />
            <span>{lang === "vi" ? "Thư khố Định lý" : "Archive of Theorems"}</span>
          </button>
          <button type="button" className="w-row" onClick={onGraphics}>
            <MonitorCog />
            <span>{lang === "vi" ? "Đồ hoạ & hiệu ứng" : "Graphics & effects"}</span>
          </button>
          <button
            type="button"
            className="w-row"
            onClick={() => {
              onClose();
              useWorld.setState({ overlay: "guide" });
            }}
          >
            <BookOpen />
            <span>{lang === "vi" ? "Sổ tay Sảnh Bất Khả" : "Guidebook of the Impossible"}</span>
          </button>
          <button
            type="button"
            className="w-row"
            onClick={() => {
              onClose();
              useWorld.setState({ overlay: "characters" });
            }}
          >
            <Users />
            <span>{t("characters")}</span>
          </button>
          <div className="w-row">
            <Languages />
            <span>{t("language")}</span>
            <span className="w-seg">
              {(["en", "vi"] as const).map((l) => (
                <button key={l} type="button" className={lang === l ? "is-on" : ""} onClick={() => setLang(l)}>
                  {l.toUpperCase()}
                </button>
              ))}
            </span>
          </div>
          <button
            type="button"
            className="w-row"
            onClick={() => {
              setSfxEnabled(!sound);
              setSound(!sound);
            }}
          >
            {sound ? <Volume2 /> : <VolumeX />}
            <span>{t("sound")}</span>
            <span className={`w-switch ${sound ? "is-on" : ""}`} />
          </button>
          <AudioSettings />
          {/* đổi tên hiện trên đầu ngay trong game (gửi cho người khác qua net) */}
          <div className="w-row w-row--col">
            <NameField />
          </div>
          <MazeSettings />
          <div className="w-row w-row--col">
            <span className="flex items-center gap-2">
              <BookOpen />
              <span>{t("bestiary")}</span>
            </span>
            <span className="flex flex-wrap gap-1.5 pl-7">
              {creatures.map((c) => (
                <span
                  key={c.kc}
                  title={c.state === "wild" ? t("untamed") : `${c.creature} — ${c.name}`}
                  className={`h-6 w-6 rounded-full ring-2 ${c.state === "feral" ? "animate-pulse ring-rose-400" : "ring-white/60"}`}
                  style={{ background: c.state === "wild" ? "rgba(30,27,75,.6)" : `radial-gradient(circle at 35% 35%, #fff, ${c.color})`, opacity: c.state === "fading" ? 0.6 : 1 }}
                />
              ))}
            </span>
          </div>
          <div className="w-row w-row--col">
            <span className="flex items-center gap-2">
              <Keyboard />
              <span>{t("controls")}</span>
            </span>
            <span className="pl-7 text-[12px] leading-relaxed text-white/70">{t("controlsHint")}</span>
          </div>
          <Credit className="mt-3 pb-2" />
        </nav>
      </motion.aside>
    </>
  );
}

function BossBar() {
  const lang = useWorld((st) => (st.lang === "vi" ? "vi" : "en"));
  const b = useBossUi();
  if (!b.on) return null;
  const ATK_NAME: Record<string, { en: string; vi: string }> = {
    standing: { en: "Standing Wave — stand on the nodes!", vi: "Sóng dừng — đứng ở nút sóng!" },
    beat: { en: "Beat Pulse — jump on the beat!", vi: "Nhịp phách — nhảy đúng nhịp!" },
    lissajous: { en: "Lissajous Comets — read the curve!", vi: "Sao chổi Lissajous — đọc đường cong!" },
    twin: { en: "Twin Nodes — break both within 1 s!", vi: "Nút giao thoa — phá cả hai trong 1 giây!" },
  };
  return (
    <div className="w-boss">
      <div className="w-boss__name">
        <span>{lang === "vi" ? "Nàng Tiên Cá Fourier" : "Fourier Siren"}</span>
        <i>{b.phase === 2 ? (lang === "vi" ? "Pha II" : "Phase II") : ""}</i>
      </div>
      <div className="w-boss__hp">
        <div style={{ width: `${(b.hp / b.maxHp) * 100}%` }} className={b.shield ? "is-shield" : ""} />
      </div>
      <div className="w-boss__coh">
        <div style={{ width: `${b.broken ? 100 : (b.coh / b.cohMax) * 100}%` }} className={b.broken ? "is-broken" : ""} />
      </div>
      {b.broken && <div className="w-boss__tag">{lang === "vi" ? "MẤT CỘNG HƯỞNG · sát thương ×1,5" : "DECOHERED · damage ×1.5"}</div>}
      {!b.broken && b.atk && <div className="w-boss__tag w-boss__tag--warn">{ATK_NAME[b.atk]?.[lang]}</div>}
      {b.dead && <div className="w-boss__tag">{lang === "vi" ? "Đã khôi phục Định lý Fourier!" : "Fourier's Theorem restored!"}</div>}
    </div>
  );
}

/** Tâm ngắm kiểu game bắn cung: chữ thập mảnh + vòng tích lực vàng (đầy sau 1 s) */
function Crosshair() {
  const aiming = useCombat((st) => st.aiming);
  const aimAt = useCombat((st) => st.aimAt);
  const [k, setK] = useState(0);
  useEffect(() => {
    if (!aiming) return;
    let raf = 0;
    const tick = () => {
      const v = Math.min(1, (performance.now() - aimAt) / CHARGE_MS);
      setK(v);
      // vòng đã đầy: thôi chạy rAF + setState mỗi khung trong lúc giữ ngắm
      if (v < 1) raf = requestAnimationFrame(tick);
    };
    raf = requestAnimationFrame(tick);
    return () => cancelAnimationFrame(raf);
  }, [aiming, aimAt]);
  if (!aiming) return null;
  return (
    <div className={`w-cross ${k >= 1 ? "is-full" : ""}`}>
      <svg viewBox="0 0 100 100">
        <circle cx="50" cy="50" r="30" pathLength={100} className="w-cross__bg" />
        <circle cx="50" cy="50" r="30" pathLength={100} className="w-cross__fg" style={{ strokeDasharray: `${k * 100} 100` }} />
        <path d="M50 30 V42 M50 58 V70 M30 50 H42 M58 50 H70" className="w-cross__lines" />
        <circle cx="50" cy="50" r="1.8" className="w-cross__dot" />
      </svg>
    </div>
  );
}

/** Nút ngắm (điện thoại): giữ để ngắm + tích lực, thả để bắn */
function AimButton() {
  return (
    <motion.button
      type="button"
      whileTap={{ scale: 0.9 }}
      className="w-skill"
      style={{ width: "calc(var(--u) * 50px)", height: "calc(var(--u) * 50px)" }}
      onPointerDown={(e) => {
        e.stopPropagation();
        startAim();
      }}
      onPointerUp={() => endAim(true)}
      onPointerCancel={() => endAim(false)}
      aria-label="Aim"
    >
      <Crosshair2 className="w-skill__icon" strokeWidth={2.2} />
      <span className="w-key">RMB</span>
    </motion.button>
  );
}

/** Mê cung Hoạ âm: giảm chuyển động (máy quay giữ chân trời) + âm lượng nhạc cụ tổng hợp — chỉ hiện trong cảnh siren */
function MazeSettings() {
  const scene = useWorld((st) => st.scene);
  const lang = useWorld((st) => st.lang);
  const [rm, setRm] = useState(false);
  const [vol, setVol] = useState(0.8);
  useEffect(() => {
    setRm(reduceMotion());
    setVol(sirenVolume());
  }, []);
  if (scene !== "siren") return null;
  return (
    <>
      <button
        type="button"
        className="w-row"
        onClick={() => {
          setReduceMotion(!rm);
          setRm(!rm);
        }}
      >
        <Accessibility />
        <span>{lang === "vi" ? "Giảm chuyển động (giữ chân trời)" : "Reduce motion (keep horizon)"}</span>
        <span className={`w-switch ${rm ? "is-on" : ""}`} />
      </button>
      <label className="w-row">
        <Music />
        <span>{lang === "vi" ? "Âm lượng mê cung" : "Labyrinth volume"}</span>
        <input
          type="range"
          min={0}
          max={1}
          step={0.05}
          value={vol}
          onChange={(e) => {
            const v = Number(e.target.value);
            setVol(v);
            setSirenVolume(v);
          }}
          className="ml-auto w-28 accent-[#ecd7a9]"
          aria-label={lang === "vi" ? "Âm lượng mê cung" : "Labyrinth volume"}
        />
      </label>
    </>
  );
}
