"use client";
/**
 * Bảng số của Giáo Sin / Khiên Con lắc (chỉ hiện khi đang cầm một trong hai):
 *  - Giáo Sin: A (lớn dần khi giữ chuột), λ, f = v/λ, T; đồng hồ pha Δφ = 2π·Δt/T kể từ bó sóng vừa phát
 *    (kim ở đỉnh = thả lúc này sẽ cùng pha → tăng cường; ở đáy = ngược pha → triệt tiêu).
 *  - Khiên Con lắc: con lắc thu nhỏ lắc đúng góc θ thật, cung xanh ở đáy = cửa sổ đỡ hoàn hảo; L, T, T/4, θ₀ (cộng hưởng), ½mv².
 * Số đổi từng khung đọc thẳng trạng thái (requestAnimationFrame, không re-render React).
 */
import { useEffect, useRef, useState } from "react";
import { useWorld } from "../store";
import { ENV, curWeapon, holdMs } from "../combat/combat";
import { HOLD_MS } from "@/lib/world/combo";
import * as SL from "@/lib/world/sineLance";
import * as PS from "@/lib/world/pendShield";
import { LANCE, SHIELD, curLam, curLen, shieldAngle, shieldGuardInput, tuneLance, tuneShield, useWaveW } from "../combat/waveWeapons";

const fmt = (n: number, d = 2) => n.toFixed(d).replace(".", ",");
const box: React.CSSProperties = {
  position: "absolute",
  left: "calc(var(--pl, 0px) + var(--u) * 14px)",
  top: "40%",
  width: "calc(var(--u) * 212px)",
  padding: "calc(var(--u) * 8px) calc(var(--u) * 10px)",
  borderRadius: 14,
  background: "rgba(12, 16, 38, 0.62)",
  boxShadow: "0 0 0 1px rgba(159, 230, 255, 0.28), 0 6px 20px rgba(0,0,0,.35)",
  color: "#eaf6ff",
  fontSize: "calc(var(--u) * 11px)",
  lineHeight: 1.35,
  backdropFilter: "blur(6px)",
  fontVariantNumeric: "tabular-nums",
};
const btn: React.CSSProperties = {
  padding: "calc(var(--u) * 3px) calc(var(--u) * 8px)",
  borderRadius: 99,
  background: "rgba(122, 216, 255, 0.16)",
  boxShadow: "0 0 0 1px rgba(122, 216, 255, 0.5)",
  fontWeight: 800,
  fontSize: "calc(var(--u) * 11px)",
  color: "#eaf6ff",
};

export function WaveWeaponHud() {
  const [kind, setKind] = useState<"lance" | "shield" | null>(null);
  useEffect(() => {
    let raf = 0;
    const loop = () => {
      const id = ENV.armed ? curWeapon().id : "";
      const k = id === "lance" || id === "shield" ? id : null;
      setKind((v) => (v === k ? v : k));
      raf = requestAnimationFrame(loop);
    };
    raf = requestAnimationFrame(loop);
    return () => cancelAnimationFrame(raf);
  }, []);
  if (kind === "lance") return <LancePanel />;
  if (kind === "shield") return <ShieldPanel />;
  return null;
}

function useTouch() {
  const [touch, setTouch] = useState(false);
  useEffect(() => setTouch(window.matchMedia("(pointer: coarse)").matches), []);
  return touch;
}

function LancePanel() {
  const vi = useWorld((s) => s.lang === "vi");
  const lamIdx = useWaveW((s) => s.lamIdx);
  const lam = SL.LANCE_LAMBDAS[lamIdx];
  const wp = SL.waveParams(SL.A_CHAIN, lam);
  const aText = useRef<HTMLElement>(null);
  const aBar = useRef<HTMLDivElement>(null);
  const needle = useRef<SVGLineElement>(null);
  const curve = useRef<SVGPathElement>(null);
  const phaseText = useRef<HTMLSpanElement>(null);
  useEffect(() => {
    let raf = 0;
    const loop = () => {
      const held = holdMs();
      const A = held > 0 ? SL.chargeAmplitude(held, HOLD_MS) : SL.A_CHAIN;
      if (aText.current) aText.current.textContent = `${fmt(A)} m`;
      if (aBar.current) {
        aBar.current.style.width = `${(A / SL.A_MAX) * 100}%`;
        aBar.current.style.background = held >= HOLD_MS ? "linear-gradient(90deg,#ffd27a,#fff2b0)" : "linear-gradient(90deg,#4fb8ff,#bfe8ff)";
      }
      const t = performance.now() / 1000;
      const lamNow = curLam();
      const k = (Math.PI * 2) / lamNow;
      const om = k * SL.WAVE_V;
      if (curve.current) {
        // đồ thị y = A·sin(kx − ωt) chạy trong ô 120 × 34 (x: 0..4 m)
        let d = "";
        for (let i = 0; i <= 48; i++) {
          const x = (4 * i) / 48;
          const y = (A / SL.A_MAX) * 14 * Math.sin(k * x - om * t);
          d += `${i ? "L" : "M"}${(i * 120) / 48},${17 - y} `;
        }
        curve.current.setAttribute("d", d);
      }
      const last = LANCE.last;
      if (needle.current && phaseText.current) {
        if (!last || t - last.t > 6) {
          needle.current.setAttribute("opacity", "0.25");
          phaseText.current.textContent = vi ? "chưa phát sóng" : "no wave yet";
          phaseText.current.style.color = "#9fb4cc";
        } else {
          const phi = SL.phaseFromDelay(t - last.t, last.T);
          const gap = SL.phaseGap(phi);
          needle.current.setAttribute("opacity", "1");
          needle.current.setAttribute("x2", String(20 + 15 * Math.sin(phi)));
          needle.current.setAttribute("y2", String(20 - 15 * Math.cos(phi)));
          const same = last.lam === lamNow;
          const deg = Math.round((phi * 180) / Math.PI);
          const label = !same ? (vi ? "λ khác — không giao thoa đều" : "different λ") : gap < Math.PI / 4 ? (vi ? "cùng pha → tăng cường" : "in phase → constructive") : gap > (3 * Math.PI) / 4 ? (vi ? "ngược pha → triệt tiêu" : "out of phase → cancels") : vi ? "lệch pha" : "partly out of phase";
          phaseText.current.textContent = `Δφ = ${deg}° · ${label}`;
          phaseText.current.style.color = !same ? "#9fb4cc" : gap < Math.PI / 4 ? "#8ff0a8" : gap > (3 * Math.PI) / 4 ? "#ff9ab0" : "#ffe08a";
        }
      }
      raf = requestAnimationFrame(loop);
    };
    raf = requestAnimationFrame(loop);
    return () => cancelAnimationFrame(raf);
  }, [vi]);
  return (
    <div style={box} className="pointer-events-auto" onPointerDown={(e) => e.stopPropagation()}>
      <div style={{ display: "flex", justifyContent: "space-between", alignItems: "baseline" }}>
        <b style={{ fontStyle: "italic", color: "#7ad8ff" }}>{vi ? "Giáo Sin" : "Sine Lance"}</b>
        <span style={{ opacity: 0.8 }}>y = A·sin(kx − ωt)</span>
      </div>
      <svg viewBox="0 0 120 34" style={{ width: "100%", height: "calc(var(--u) * 34px)", margin: "2px 0" }}>
        <line x1="0" y1="17" x2="120" y2="17" stroke="rgba(255,255,255,.18)" strokeWidth="0.6" />
        <path ref={curve} fill="none" stroke="#9fe6ff" strokeWidth="1.6" />
      </svg>
      <div style={{ display: "grid", gridTemplateColumns: "auto 1fr", columnGap: 8 }}>
        <span>A</span>
        <span style={{ display: "flex", alignItems: "center", gap: 6 }}>
          <b ref={aText} style={{ minWidth: "3.6em" }} />
          <span style={{ flex: 1, height: 4, borderRadius: 99, background: "rgba(255,255,255,.12)", overflow: "hidden" }}>
            <div ref={aBar} style={{ height: "100%", borderRadius: 99 }} />
          </span>
        </span>
        <span>λ</span>
        <b>{fmt(lam, 1)} m</b>
        <span>f</span>
        <span>
          <b>{fmt(wp.f)} Hz</b> <span style={{ opacity: 0.7 }}>= v/λ, v = {SL.WAVE_V} m/s</span>
        </span>
        <span>T</span>
        <b>{fmt(wp.T)} s</b>
      </div>
      <div style={{ display: "flex", alignItems: "center", gap: 8, marginTop: 4 }}>
        <svg viewBox="0 0 40 40" style={{ width: "calc(var(--u) * 34px)", height: "calc(var(--u) * 34px)", flex: "none" }}>
          <circle cx="20" cy="20" r="17" fill="none" stroke="rgba(255,255,255,.25)" strokeWidth="1.5" />
          <path d="M20 3 A17 17 0 0 1 32 8" fill="none" stroke="#8ff0a8" strokeWidth="3" />
          <path d="M20 3 A17 17 0 0 0 8 8" fill="none" stroke="#8ff0a8" strokeWidth="3" />
          <path d="M8 32 A17 17 0 0 0 32 32" fill="none" stroke="#ff9ab0" strokeWidth="3" opacity="0.7" />
          <line ref={needle} x1="20" y1="20" x2="20" y2="5" stroke="#fff" strokeWidth="2" strokeLinecap="round" />
        </svg>
        <span ref={phaseText} style={{ fontWeight: 700 }} />
      </div>
      <div style={{ display: "flex", justifyContent: "space-between", marginTop: 6, gap: 6 }}>
        <button type="button" style={btn} onClick={tuneLance}>
          λ ⟳ <span style={{ opacity: 0.7 }}>X</span>
        </button>
        <span style={{ opacity: 0.75, alignSelf: "center" }}>{vi ? `đỉnh: s = ${crestHint(lam)}` : `crests: s = ${crestHint(lam)}`}</span>
      </div>
    </div>
  );
}

const crestHint = (lam: number) =>
  SL.crestPositions(lam, 3.6)
    .slice(0, 3)
    .map((s) => fmt(s, 1))
    .join(" · ") + " m";

function ShieldPanel() {
  const vi = useWorld((s) => s.lang === "vi");
  const touch = useTouch();
  const lenIdx = useWaveW((s) => s.lenIdx);
  const streak = useWaveW((s) => s.streak);
  const L = PS.SHIELD_LENGTHS[lenIdx];
  const T = PS.period(L);
  const arm = useRef<SVGLineElement>(null);
  const bob = useRef<SVGCircleElement>(null);
  const win = useRef<SVGPathElement>(null);
  const thText = useRef<HTMLElement>(null);
  const keText = useRef<HTMLElement>(null);
  const resBar = useRef<HTMLDivElement>(null);
  const gradeText = useRef<HTMLSpanElement>(null);
  useEffect(() => {
    let raf = 0;
    const loop = () => {
      const now = performance.now();
      const th = shieldAngle(now);
      const Ln = curLen();
      // con lắc thu nhỏ: dây dài theo L (0,6 m → 46 px), góc thật (− vì + là ra sau lưng = trái màn hình)
      const len = 16 + (Ln / 0.6) * 30;
      const x = 50 - len * Math.sin(th);
      const y = 6 + len * Math.cos(th);
      arm.current?.setAttribute("x2", String(x));
      arm.current?.setAttribute("y2", String(y));
      bob.current?.setAttribute("cx", String(x));
      bob.current?.setAttribute("cy", String(y));
      // cửa sổ hoàn hảo: góc quét được trong ±PERFECT_S quanh đáy
      if (win.current) {
        const dpsi = (PS.PERFECT_S / PS.period(Ln)) * Math.PI * 2;
        const a = SHIELD.theta0 * Math.sin(dpsi);
        const r = len;
        win.current.setAttribute("d", `M${50 - r * Math.sin(a)},${6 + r * Math.cos(a)} A${r} ${r} 0 0 0 ${50 + r * Math.sin(a)},${6 + r * Math.cos(a)}`);
        win.current.setAttribute("stroke-width", SHIELD.guarding ? "5" : "3");
        win.current.setAttribute("opacity", SHIELD.guarding ? "1" : "0.55");
      }
      if (bob.current) bob.current.setAttribute("fill", SHIELD.guarding ? (PS.parryGrade(SHIELD.psi, Ln) === "perfect" ? "#8ff0a8" : "#ffc86b") : "#b8742e");
      if (thText.current) thText.current.textContent = `${Math.round((SHIELD.theta0 * 180) / Math.PI)}°`;
      if (keText.current) keText.current.textContent = `${fmt(PS.kineticMax(Ln, SHIELD.theta0))} J`;
      if (resBar.current) resBar.current.style.width = `${((SHIELD.theta0 - PS.THETA_BASE) / (PS.THETA_MAX - PS.THETA_BASE)) * 100}%`;
      const g = useWaveW.getState();
      if (gradeText.current) {
        const fresh = g.grade && now - g.gradeAt < 1400;
        gradeText.current.textContent = fresh ? (g.grade === "perfect" ? (vi ? "ĐỠ HOÀN HẢO" : "PERFECT") : g.grade === "good" ? (vi ? "đỡ tốt" : "good block") : vi ? "đỡ yếu" : "weak block") : SHIELD.guarding ? (vi ? "đang đỡ" : "guarding") : "";
        gradeText.current.style.color = g.grade === "perfect" && fresh ? "#8ff0a8" : "#ffe08a";
      }
      raf = requestAnimationFrame(loop);
    };
    raf = requestAnimationFrame(loop);
    return () => cancelAnimationFrame(raf);
  }, [vi]);
  return (
    <div style={box} className="pointer-events-auto" onPointerDown={(e) => e.stopPropagation()}>
      <div style={{ display: "flex", justifyContent: "space-between", alignItems: "baseline" }}>
        <b style={{ fontStyle: "italic", color: "#ffc86b" }}>{vi ? "Khiên Con lắc" : "Pendulum Shield"}</b>
        <span style={{ opacity: 0.8 }}>T = 2π√(L/g)</span>
      </div>
      <div style={{ display: "flex", gap: 8, alignItems: "center" }}>
        <svg viewBox="0 0 100 62" style={{ width: "calc(var(--u) * 92px)", height: "calc(var(--u) * 57px)", flex: "none" }}>
          <line x1="30" y1="6" x2="70" y2="6" stroke="rgba(255,255,255,.4)" strokeWidth="1.5" />
          <path ref={win} fill="none" stroke="#8ff0a8" strokeLinecap="round" />
          <line ref={arm} x1="50" y1="6" x2="50" y2="50" stroke="#c9d1de" strokeWidth="1.4" />
          <circle ref={bob} cx="50" cy="50" r="6" stroke="#ffe9a8" strokeWidth="1.2" />
        </svg>
        <div style={{ display: "grid", gridTemplateColumns: "auto 1fr", columnGap: 6 }}>
          <span>L</span>
          <b>{fmt(L)} m</b>
          <span>T</span>
          <b>{fmt(T)} s</b>
          <span>T/4</span>
          <b>{fmt(T / 4)} s</b>
          <span>θ₀</span>
          <b ref={thText} />
          <span>½mv²</span>
          <b ref={keText} />
        </div>
      </div>
      <div style={{ display: "flex", alignItems: "center", gap: 6, marginTop: 4 }}>
        <span style={{ opacity: 0.8 }}>{vi ? "Cộng hưởng" : "Resonance"}</span>
        <span style={{ flex: 1, height: 5, borderRadius: 99, background: "rgba(255,255,255,.12)", overflow: "hidden" }}>
          <div ref={resBar} style={{ height: "100%", borderRadius: 99, background: "linear-gradient(90deg,#ffb36b,#fff2b0)" }} />
        </span>
        {streak > 1 && <b style={{ color: "#8ff0a8" }}>×{streak}</b>}
      </div>
      <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", marginTop: 6, gap: 6 }}>
        <button type="button" style={btn} onClick={tuneShield}>
          L ⟳ <span style={{ opacity: 0.7 }}>X</span>
        </button>
        <span ref={gradeText} style={{ fontWeight: 800 }} />
        {touch && (
          <button
            type="button"
            style={{ ...btn, background: "rgba(255,200,107,.22)", boxShadow: "0 0 0 1px rgba(255,200,107,.6)" }}
            onPointerDown={() => shieldGuardInput(true)}
            onPointerUp={() => shieldGuardInput(false)}
            onPointerLeave={() => shieldGuardInput(false)}
          >
            {vi ? "Đỡ" : "Guard"}
          </button>
        )}
      </div>
      <div style={{ opacity: 0.7, marginTop: 4 }}>{vi ? "Chuột phải: buông từ đỉnh → đáy sau T/4" : "Right mouse: release from the top → bottom after T/4"}</div>
    </div>
  );
}
