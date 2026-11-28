"use client";
/**
 * Giao diện Bờ Sóng (lớp DOM): lời gợi ý / à há, thước triều (đồ thị sin + chấm "bây giờ" + vạch "lội qua được"),
 * mục tiêu, bảng số theo khu (con lắc: L, T, nhịp sóng, biên độ, ô "đẩy đúng nhịp"; lăng kính: góc tới / khúc xạ / lệch;
 * đầm: hiệu đường đi r₁ − r₂ tính theo λ, biên độ chỗ đang đứng), và bảng giải thích của các bia.
 */
import { useEffect, useState } from "react";
import { AnimatePresence, motion } from "motion/react";
import { useWorld } from "../../store";
import { CAUSEWAY, SWEEP_DEPTH, prismTrace } from "@/lib/world/coastWorld";
import { BELL_ANGLE, G, GLASS_N, LAGOON, RESONANT_L, SAFE_M, SWELL, TIDE, coastClock, criticalAngle, deviation, lagoonAmp, natPeriod, nodalX, pathDiff, pendAmp, pushQuality, tideLevel, tideTrend, waitBelow } from "@/lib/world/waves";
import { curLength, pend, useCoast } from "./coastState";

const THR = CAUSEWAY.top + SWEEP_DEPTH;
const fmt = (n: number, d = 1, vi = true) => (vi ? n.toFixed(d).replace(".", ",") : n.toFixed(d));
const deg = (r: number) => (r * 180) / Math.PI;

/** số giây còn lại trước khi nước vượt ngưỡng (đang qua được) */
function passLeft(t: number): number {
  for (let s = 0; s < TIDE.T; s += 0.1) if (tideLevel(t + s) > THR) return s;
  return TIDE.T;
}

function TideGraph({ t, w = 132, h = 46 }: { t: number; w?: number; h?: number }) {
  const N = 64;
  const y = (lv: number) => h / 2 - (lv / (TIDE.amp * 1.15)) * (h / 2);
  const phase = (t % TIDE.T) / TIDE.T;
  const pts = Array.from({ length: N + 1 }, (_, i) => `${(i / N) * w},${y(tideLevel((i / N) * TIDE.T))}`).join(" ");
  return (
    <svg width={w} height={h} className="block">
      <rect x={0} y={y(THR)} width={w} height={h - y(THR)} fill="rgba(124,240,208,0.12)" />
      <line x1={0} x2={w} y1={y(THR)} y2={y(THR)} stroke="#7cf0d0" strokeDasharray="3 3" strokeWidth={1} />
      <polyline points={pts} fill="none" stroke="#9fd8ff" strokeWidth={1.6} />
      <circle cx={phase * w} cy={y(tideLevel(t))} r={4} fill="#ffd27a" stroke="#3b2d1a" strokeWidth={1} />
    </svg>
  );
}

function Objectives({ vi }: { vi: boolean }) {
  const s = useCoast();
  const rows: [boolean, string][] = [
    [s.islet, vi ? "Lội Lối Triều ra đảo lúc nước ròng" : "Wade the Tide Path at low tide"],
    [s.lit, vi ? "Bẻ tia sáng thắp Hải đăng" : "Bend the light to fire the Lighthouse"],
    [s.bell, vi ? "Rung Chuông Cộng hưởng" : "Ring the Resonance Bell"],
    [s.lagoon, vi ? "Lội qua Đầm Giao thoa" : "Cross the Interference Lagoon"],
    [s.tir, vi ? "(thêm) Tinh thể phản xạ toàn phần" : "(bonus) The total-reflection crystal"],
  ];
  return (
    <ul className="mt-1.5 space-y-0.5 text-[11px] leading-tight">
      {rows.map(([done, text]) => (
        <li key={text} className={done ? "text-emerald-200/90 line-through decoration-emerald-300/50" : "text-white/90"}>
          <span className="mr-1">{done ? "◆" : "◇"}</span>
          {text}
        </li>
      ))}
    </ul>
  );
}

type Live = { t: number; x: number; z: number; th: number; amp: number; q: number; om: number };

export function CoastUi() {
  const vi = useWorld((s) => s.lang === "vi");
  const overlay = useWorld((s) => s.overlay);
  const hint = useCoast((s) => s.hint);
  const panel = useCoast((s) => s.panel);
  const area = useCoast((s) => s.area);
  const phi = useCoast((s) => s.phi);
  const lenIdx = useCoast((s) => s.lenIdx);
  const heavy = useCoast((s) => s.heavy);
  const step = useCoast((s) => s.prismStep);
  const [live, setLive] = useState<Live>({ t: 0, x: 0, z: 0, th: 0, amp: 0, q: -1, om: 0 });
  const [showHint, setShowHint] = useState(false);
  useEffect(() => {
    const id = window.setInterval(() => {
      const w = useWorld.getState();
      const L = curLength();
      setLive({ t: coastClock(Date.now()), x: w.player.x, z: w.player.z, th: pend.th, amp: pendAmp(pend, L), q: pushQuality(pend, L), om: pend.om });
    }, 100);
    return () => window.clearInterval(id);
  }, []);
  useEffect(() => {
    if (!hint) return;
    setShowHint(true);
    const t = window.setTimeout(() => setShowHint(false), hint.kind === "aha" ? 13000 : 9000);
    return () => window.clearTimeout(t);
  }, [hint]);
  useEffect(() => {
    if (!panel) return;
    if (document.pointerLockElement) document.exitPointerLock();
    const h = (e: KeyboardEvent) => e.key === "Escape" && useCoast.setState({ panel: null });
    window.addEventListener("keydown", h);
    return () => window.removeEventListener("keydown", h);
  }, [panel]);
  if (overlay) return null;

  const lv = tideLevel(live.t);
  const ok = lv <= THR;
  const wait = waitBelow(THR, live.t);
  const L = curLength();
  const tr = prismTrace(step);
  return (
    <div className="w-hud">
      <div className="pointer-events-none absolute right-[var(--pr)] top-[calc(var(--pt)+var(--u)*64px)] z-10 w-[176px] rounded-2xl bg-slate-900/50 p-2 text-white shadow-lg backdrop-blur-md">
        <div className="mb-1 flex items-center justify-between text-[10px] font-bold uppercase tracking-[0.14em] text-sky-200/90">
          <span>{vi ? "Thước triều" : "Tide gauge"}</span>
          <span className="text-white/80">{tideTrend(live.t) > 0 ? "▲" : "▼"} {fmt(lv, 2, vi)} m</span>
        </div>
        <TideGraph t={live.t} w={160} />
        <div className={`mt-1 text-[11px] font-semibold ${ok ? "text-emerald-200" : "text-white/75"}`}>
          {ok ? (vi ? `Lối Triều: qua được · còn ${fmt(passLeft(live.t), 0)} s` : `Tide Path: passable · ${fmt(passLeft(live.t), 0, false)} s left`) : vi ? `Nước lớn · ròng sau ${fmt(wait, 0)} s` : `High water · low in ${fmt(wait, 0, false)} s`}
        </div>
        <Objectives vi={vi} />
      </div>

      {area === "pier" && (
        <div className="pointer-events-none absolute bottom-[calc(var(--pb,16px)+var(--u)*150px)] left-1/2 z-10 w-[min(92vw,420px)] -translate-x-1/2 rounded-2xl bg-slate-900/60 px-4 py-2 text-[12px] text-white shadow-lg backdrop-blur-md">
          <div className="flex flex-wrap justify-between gap-x-3">
            <span>
              L = <b>{fmt(L, 2, vi)} m</b>
            </span>
            <span>
              T = 2π√(L/g) = <b className={Math.abs(L - RESONANT_L) < 0.05 ? "text-emerald-300" : ""}>{fmt(natPeriod(L), 2, vi)} s</b>
            </span>
            <span>
              {vi ? "sóng lừng" : "swell"} <b>{fmt(SWELL.T, 1, vi)} s</b>
            </span>
            <span className="text-white/70">{heavy ? (vi ? "neo 40 kg" : "40 kg anchor") : vi ? "vỏ ốc 0,3 kg" : "0.3 kg shell"}</span>
          </div>
          <div className="mt-1.5 flex items-center gap-2">
            <span className="w-14 text-[10px] uppercase tracking-wider text-white/60">{vi ? "biên độ" : "swing"}</span>
            <div className="relative h-2 flex-1 rounded-full bg-white/15">
              <div className="h-2 rounded-full bg-amber-300" style={{ width: `${Math.min(100, (live.amp / BELL_ANGLE) * 100)}%` }} />
            </div>
            <span className="w-10 text-right">{fmt(deg(live.amp), 0, vi)}°</span>
          </div>
          <div className="mt-1 flex items-center gap-2">
            <span className="w-14 text-[10px] uppercase tracking-wider text-white/60">{vi ? "nhịp đẩy" : "push"}</span>
            <div className="relative h-2 flex-1 rounded-full bg-white/10">
              {/* vị trí quả lắc: trái ↔ phải; ô xanh = qua đáy theo chiều đẩy */}
              <div className="absolute left-1/2 top-0 h-2 w-[16%] -translate-x-1/2 rounded-full bg-emerald-400/30" />
              <div className={`absolute top-[-3px] h-3.5 w-3.5 -translate-x-1/2 rounded-full ${live.q > 0.6 ? "bg-emerald-300 shadow-[0_0_10px_#6ee7b7]" : live.om < 0 ? "bg-rose-300" : "bg-white"}`} style={{ left: `${50 + Math.max(-1, Math.min(1, live.th / BELL_ANGLE)) * 50}%` }} />
            </div>
            <span className="w-10 text-right">{live.om >= 0 ? "→" : "←"}</span>
          </div>
          <div className="mt-1 text-[10px] text-white/55">{vi ? `chuông ở ±${fmt(deg(BELL_ANGLE), 0)}° · g = ${fmt(G, 1)} m/s²` : `bells at ±${fmt(deg(BELL_ANGLE), 0, false)}° · g = ${G} m/s²`}</div>
        </div>
      )}

      {area === "isle" && (
        <div className="pointer-events-none absolute bottom-[calc(var(--pb,16px)+var(--u)*150px)] left-1/2 z-10 w-[min(92vw,420px)] -translate-x-1/2 rounded-2xl bg-slate-900/60 px-4 py-2 text-[12px] text-white shadow-lg backdrop-blur-md">
          <div className="flex flex-wrap justify-between gap-x-3">
            <span>
              {vi ? "góc tới" : "incidence"} θ₁ = <b>{fmt(tr.inAngle, 1, vi)}°</b>
            </span>
            <span>
              {vi ? "trong kính" : "in glass"} θ₂ = <b>{fmt(tr.inRefr, 1, vi)}°</b>
            </span>
            <span>
              {vi ? "lệch" : "deviation"} <b>{fmt(Math.abs(deviation({ x: 1, z: 0 }, tr.dir)), 1, vi)}°</b>
            </span>
          </div>
          <div className="mt-1 text-white/75">
            1·sin θ₁ = {fmt(GLASS_N.g, 2, vi)}·sin θ₂ · {vi ? "góc tới hạn" : "critical angle"} {fmt(criticalAngle(GLASS_N.g), 1, vi)}°
            {tr.tir > 0 && <b className="ml-1 text-sky-200">· {vi ? `phản xạ toàn phần ×${tr.tir}` : `total internal reflection ×${tr.tir}`}</b>}
          </div>
        </div>
      )}

      {area === "lagoon" && (
        <div className="pointer-events-none absolute bottom-[calc(var(--pb,16px)+var(--u)*150px)] left-1/2 z-10 w-[min(92vw,420px)] -translate-x-1/2 rounded-2xl bg-slate-900/60 px-4 py-2 text-[12px] text-white shadow-lg backdrop-blur-md">
          <div className="flex flex-wrap justify-between gap-x-3">
            <span>
              {vi ? "nguồn 2" : "source 2"}: <b className={phi ? "text-pink-200" : ""}>{phi ? (vi ? "lệch ½ chu kỳ (φ = π)" : "½ cycle behind (φ = π)") : vi ? "cùng pha (φ = 0)" : "in phase (φ = 0)"}</b>
            </span>
            <span>
              r₁ − r₂ = <b>{fmt(pathDiff(live.x, live.z) / LAGOON.lambda, 2, vi)} λ</b>
            </span>
          </div>
          {(() => {
            const M = lagoonAmp(live.x, live.z, phi);
            return (
              <div className="mt-1.5 flex items-center gap-2">
                <span className="w-16 text-[10px] uppercase tracking-wider text-white/60">{vi ? "sóng ở đây" : "waves here"}</span>
                <div className="relative h-2 flex-1 rounded-full bg-white/15">
                  <div className="absolute top-0 h-2 rounded-full bg-emerald-400/40" style={{ width: `${(SAFE_M / (2 * LAGOON.A)) * 100}%` }} />
                  <div className={`h-2 rounded-full ${M <= SAFE_M ? "bg-emerald-300" : "bg-rose-300"}`} style={{ width: `${(M / (2 * LAGOON.A)) * 100}%` }} />
                </div>
                <span className="w-12 text-right">{M <= SAFE_M ? (vi ? "lặng" : "calm") : vi ? "dữ" : "rough"}</span>
              </div>
            );
          })()}
          <div className="mt-1 text-[10px] text-white/55">λ = {fmt(LAGOON.lambda, 0, vi)} m · T = {fmt(LAGOON.T, 1, vi)} s · M = |2A·cos((kΔ − φ)/2)|</div>
        </div>
      )}

      <AnimatePresence>
        {hint && showHint && !panel && (
          <motion.div
            key={hint.at}
            initial={{ y: -12, opacity: 0 }}
            animate={{ y: 0, opacity: 1 }}
            exit={{ y: -10, opacity: 0 }}
            className={`pointer-events-none absolute left-1/2 top-[calc(var(--pt)+var(--u)*58px)] z-10 w-[min(92vw,560px)] -translate-x-1/2 rounded-2xl px-4 py-2.5 text-center text-[13px] leading-snug text-white shadow-xl backdrop-blur-md ${hint.kind === "aha" ? "bg-gradient-to-r from-[#3fb7e0]/70 via-[#3f6fd0]/60 to-[#ffcf7a]/70" : hint.kind === "warn" ? "bg-slate-900/70" : "bg-slate-900/60"}`}
          >
            {hint.kind === "aha" && <div className="mb-0.5 text-[10px] font-bold uppercase tracking-[0.2em] text-amber-100">✦ {vi ? "À há!" : "Aha!"} ✦</div>}
            {vi ? hint.vi : hint.en}
          </motion.div>
        )}
      </AnimatePresence>

      <AnimatePresence>
        {panel && (
          <motion.div key={panel} className="pointer-events-auto absolute inset-0 z-30 flex items-center justify-center bg-black/40 p-4" initial={{ opacity: 0 }} animate={{ opacity: 1 }} exit={{ opacity: 0 }} onClick={() => useCoast.setState({ panel: null })}>
            <motion.div initial={{ y: 20, opacity: 0 }} animate={{ y: 0, opacity: 1 }} className="max-h-[86vh] w-[min(94vw,620px)] overflow-y-auto rounded-3xl bg-slate-900/90 p-5 text-white shadow-2xl ring-1 ring-white/10" onClick={(e) => e.stopPropagation()}>
              {panel === "tide" ? <TideText vi={vi} t={live.t} /> : panel === "lagoon" ? <LagoonText vi={vi} /> : <BellText vi={vi} lenIdx={lenIdx} />}
              <div className="mt-4 text-right">
                <button type="button" onClick={() => useCoast.setState({ panel: null })} className="rounded-full bg-amber-300 px-4 py-1.5 text-sm font-bold text-slate-900">
                  {vi ? "Đã hiểu" : "Got it"}
                </button>
              </div>
            </motion.div>
          </motion.div>
        )}
      </AnimatePresence>
    </div>
  );
}

function TideText({ vi, t }: { vi: boolean; t: number }) {
  return (
    <div className="space-y-3 text-[14px] leading-relaxed">
      <h2 className="text-lg font-bold text-sky-200">{vi ? "Bia Thuỷ triều — mực nước là một hình sin" : "The Tide Stone — sea level is a sine"}</h2>
      <div className="flex flex-wrap items-center gap-4">
        <TideGraph t={t} w={220} h={80} />
        <p className="min-w-[220px] flex-1 font-mono text-[13px] text-white/90">h(t) = {vi ? "0,8" : "0.8"}·sin(2π·t / 48) m</p>
      </div>
      <ol className="list-decimal space-y-1.5 pl-5 text-white/90">
        <li>{vi ? "Ở đây một \"ngày triều\" bị nén còn 48 giây (ngoài đời ~12 giờ 25 phút: Mặt Trăng kéo nước biển, Trái Đất quay dưới chỗ phình đó)." : "Here a 'tidal day' is squeezed into 48 seconds (in real life ~12 h 25 min: the Moon pulls the sea, the Earth turns under the bulge)."}</li>
        <li>{vi ? "Doi cát ra đảo cao −0,9 m. Bạn lội được khi nước sâu dưới 0,62 m — tức mực nước dưới −0,28 m (vạch xanh trên đồ thị)." : "The sandbar to the island sits at −0.9 m. You can wade while the water is under 0.62 m deep — sea level below −0.28 m (the green line)."}</li>
        <li>{vi ? "sin(x) ≤ −0,35 khoảng 38 % mỗi chu kỳ → cửa sổ ~18 giây. Đừng đợi tới đáy mới chạy: lúc đó nước đã sắp lên." : "sin(x) ≤ −0.35 for about 38 % of each cycle → an ~18-second window. Don't wait for the very bottom: by then the water is about to rise."}</li>
      </ol>
    </div>
  );
}

function LagoonText({ vi }: { vi: boolean }) {
  // sơ đồ: hai nguồn, đường giữa, hai hyperbol nút λ/2
  const W = 220;
  const H = 150;
  const sx = (x: number) => ((x - LAGOON.x0) / (LAGOON.x1 - LAGOON.x0)) * W;
  const sz = (z: number) => ((z - LAGOON.z0) / (LAGOON.z1 - LAGOON.z0)) * H;
  const hyper = (sign: number) => {
    const out: string[] = [];
    for (let z = LAGOON.z0 + 2.2; z < LAGOON.z1; z += 0.5) {
      // điểm trên hyperbol r₁ − r₂ = ±λ/2 ở hàng z (cùng hàm test dùng)
      const x = nodalX((sign * LAGOON.lambda) / 2, z);
      if (x !== null) out.push(`${sx(x)},${sz(z)}`);
    }
    return out.join(" ");
  };
  return (
    <div className="space-y-3 text-[14px] leading-relaxed">
      <h2 className="text-lg font-bold text-teal-200">{vi ? "Bia Đầm — hai con sóng cộng nhau" : "The Lagoon Stone — two waves add up"}</h2>
      <div className="flex flex-wrap items-center gap-4">
        <svg width={W} height={H} className="rounded-xl bg-sky-950/60">
          <polyline points={hyper(1)} fill="none" stroke="#7cf0d0" strokeWidth={2} strokeDasharray="5 3" />
          <polyline points={hyper(-1)} fill="none" stroke="#7cf0d0" strokeWidth={2} strokeDasharray="5 3" />
          <line x1={sx(-2)} x2={sx(-2)} y1={sz(LAGOON.s1.z)} y2={H} stroke="#ff9ecb" strokeWidth={2} />
          <circle cx={sx(LAGOON.s1.x)} cy={sz(LAGOON.s1.z)} r={5} fill="#7cf0ff" />
          <circle cx={sx(LAGOON.s2.x)} cy={sz(LAGOON.s2.z)} r={5} fill="#ff9ecb" />
        </svg>
        <ol className="min-w-[220px] flex-1 list-decimal space-y-1.5 pl-5 text-white/90">
          <li>{vi ? "Tại mỗi điểm, hai sóng tới sau quãng đường r₁ và r₂. Lệch nhau một số nguyên bước sóng: đỉnh gặp đỉnh, sóng gấp đôi (bụng)." : "At every point the two waves arrive after travelling r₁ and r₂. A whole number of wavelengths apart: crest meets crest, double waves (antinode)."}</li>
          <li>{vi ? "Lệch nhau nửa bước sóng (r₁ − r₂ = ±λ/2): đỉnh gặp đáy, nước phẳng lặng (nút). Tập điểm có hiệu khoảng cách tới hai tiêu điểm không đổi là một HYPERBOL (nét đứt xanh)." : "Half a wavelength apart (r₁ − r₂ = ±λ/2): crest meets trough, flat water (node). Points with a fixed difference of distances to two foci form a HYPERBOLA (green dashes)."}</li>
          <li>{vi ? "Đường giữa (hồng) cách đều hai nguồn → luôn là bụng… trừ khi một nguồn chậm đi nửa chu kỳ." : "The middle line (pink) is equidistant → always an antinode… unless one source runs half a cycle late."}</li>
        </ol>
      </div>
      <p className="rounded-xl bg-white/5 p-3 text-white/80">{vi ? "Thomas Young (1801) thấy đúng các vân này với ánh sáng qua hai khe — bằng chứng ánh sáng là sóng. Tai nghe chống ồn phát sóng ngược pha để \"đường giữa\" là tai bạn." : "Thomas Young (1801) saw exactly these fringes with light through two slits — proof that light is a wave. Noise-cancelling headphones emit an inverted wave so that the 'middle line' is your ear."}</p>
    </div>
  );
}

function BellText({ vi, lenIdx }: { vi: boolean; lenIdx: number }) {
  return (
    <div className="space-y-3 text-[14px] leading-relaxed">
      <h2 className="text-lg font-bold text-amber-200">{vi ? "Bia Chuông — cộng hưởng" : "The Bell Stone — resonance"}</h2>
      <p className="font-mono text-[13px] text-white/90">T = 2π·√(L / g)</p>
      <table className="w-full text-left text-[13px]">
        <tbody>
          {[0.9, 1.4, 2.24, 3.4, 4.4].map((L, i) => (
            <tr key={L} className={i === lenIdx ? "text-amber-200" : "text-white/80"}>
              <td className="py-0.5">L = {fmt(L, 2, vi)} m</td>
              <td>T = ? s</td>
            </tr>
          ))}
        </tbody>
      </table>
      <ol className="list-decimal space-y-1.5 pl-5 text-white/90">
        <li>{vi ? "Cầu phao lắc qua lắc lại theo sóng lừng, đều đặn mỗi 3 giây — nó \"đẩy\" điểm treo con lắc." : "The pontoon rocks with the swell, steadily every 3 seconds — it 'pushes' the pendulum's pivot."}</li>
        <li>{vi ? "Nếu chu kỳ riêng của con lắc khớp với nhịp đẩy, mỗi cú đẩy đều tới đúng lúc và biên độ lớn dần: CỘNG HƯỞNG. Lệch nhịp thì cú đẩy lúc giúp lúc cản." : "If the pendulum's own period matches the pushing rhythm, every push arrives on time and the swing grows: RESONANCE. Out of step, pushes help one moment and hinder the next."}</li>
        <li>{vi ? "Tự tính T cho từng chiều dài (g = 9,8 m/s²) — hoặc cứ thử. Quả nặng hay nhẹ có quan trọng không?" : "Work out T for each length (g = 9.8 m/s²) — or just experiment. Does a heavy or light bob matter?"}</li>
      </ol>
      <p className="rounded-xl bg-white/5 p-3 text-white/80">{vi ? "Cầu Tacoma Narrows (1940) đổ vì dao động do gió tự nuôi; lính đi đều bước được dặn phá nhịp khi qua cầu; xích đu được đẩy đúng nhịp thì bay cao." : "The Tacoma Narrows bridge (1940) failed from wind-fed oscillation; marching soldiers break step on bridges; a swing pushed in rhythm flies high."}</p>
    </div>
  );
}

