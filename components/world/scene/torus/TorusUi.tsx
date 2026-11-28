"use client";
/**
 * Giao diện Quần đảo Xuyến (lớp DOM): lời gợi ý / khám phá, bản đồ "ô vuông dán mép" (miền cơ bản) có các đảo vắt qua mép
 * và chấm vị trí + hướng nhìn của bạn, danh sách mục tiêu, máu Mắt Canh, cảnh báo "đường bay này trúng lưng bạn",
 * và bảng giải thích của Bia Xuyến / Bia Bốn Góc (kèm hình vẽ mũi tên ra mép phải, vào mép trái, trúng lưng).
 */
import { useEffect, useState } from "react";
import { AnimatePresence, motion } from "motion/react";
import { useWorld } from "../../store";
import { useCombat } from "../../combat/combat";
import { TORUS_L, torusDist } from "@/lib/world/torus";
import { ISLANDS, SEAM_X_COLOR, SEAM_Z_COLOR, SENTINEL } from "@/lib/world/torusWorld";
import { useTorus } from "./torusState";

const L = TORUS_L;
const SZ = 112;
const k = SZ / L;
const px = (x: number) => (x + L / 2) * k;

/** mũi tên nhỏ trên mép (đánh dấu cặp mép dán: một vạch = mép x, hai vạch = mép z) */
function EdgeArrow({ x, y, rot, color, n }: { x: number; y: number; rot: number; color: string; n: 1 | 2 }) {
  return (
    <g transform={`translate(${x} ${y}) rotate(${rot})`}>
      {Array.from({ length: n }, (_, i) => (
        <path key={i} d={`M ${-4 + i * 5} -3.5 L ${1 + i * 5} 0 L ${-4 + i * 5} 3.5`} fill="none" stroke={color} strokeWidth={1.8} strokeLinecap="round" strokeLinejoin="round" />
      ))}
    </g>
  );
}

function Square({ px0, pz0, yaw, size = SZ, path }: { px0: number; pz0: number; yaw: number; size?: number; path?: boolean }) {
  const s = size / SZ;
  return (
    <svg width={size} height={size} viewBox={`-6 -6 ${SZ + 12} ${SZ + 12}`} className="block">
      <defs>
        <clipPath id="tq-clip">
          <rect x={0} y={0} width={SZ} height={SZ} />
        </clipPath>
      </defs>
      <rect x={0} y={0} width={SZ} height={SZ} rx={3} fill="rgba(160,190,255,0.16)" />
      <g clipPath="url(#tq-clip)">
        {/* đảo + ảnh của nó qua mép (thấy rõ đảo vắt mép bị "cắt đôi") */}
        {ISLANDS.map((is) =>
          [-1, 0, 1].flatMap((i) =>
            [-1, 0, 1].map((j) => <circle key={`${is.id}${i}${j}`} cx={px(is.x + i * L)} cy={px(is.z + j * L)} r={is.R * k} fill={is.id === "corner" ? "rgba(255,158,203,0.55)" : "rgba(124,207,122,0.7)"} />),
          ),
        )}
        {path && (
          <>
            {/* mũi tên bắn về phía đông từ (−12, 8): ra mép phải, vào mép trái, trúng lưng */}
            <line x1={px(-11)} y1={px(8)} x2={SZ} y2={px(8)} stroke="#ffd27a" strokeWidth={2} strokeDasharray="4 3" />
            <line x1={0} y1={px(8)} x2={px(-13)} y2={px(8)} stroke="#7cf0ff" strokeWidth={2} strokeDasharray="4 3" />
            <circle cx={px(-12)} cy={px(8)} r={3.4} fill="#fff" />
          </>
        )}
      </g>
      {/* hai cặp mép dán */}
      <line x1={0} y1={0} x2={0} y2={SZ} stroke={SEAM_X_COLOR} strokeWidth={2.4} />
      <line x1={SZ} y1={0} x2={SZ} y2={SZ} stroke={SEAM_X_COLOR} strokeWidth={2.4} />
      <line x1={0} y1={0} x2={SZ} y2={0} stroke={SEAM_Z_COLOR} strokeWidth={2.4} />
      <line x1={0} y1={SZ} x2={SZ} y2={SZ} stroke={SEAM_Z_COLOR} strokeWidth={2.4} />
      <EdgeArrow x={-0.5} y={SZ / 2} rot={-90} color={SEAM_X_COLOR} n={1} />
      <EdgeArrow x={SZ + 0.5} y={SZ / 2} rot={-90} color={SEAM_X_COLOR} n={1} />
      <EdgeArrow x={SZ / 2 - 2} y={-0.5} rot={0} color={SEAM_Z_COLOR} n={2} />
      <EdgeArrow x={SZ / 2 - 2} y={SZ + 0.5} rot={0} color={SEAM_Z_COLOR} n={2} />
      {/* bạn */}
      <g transform={`translate(${px(px0)} ${px(pz0)}) rotate(${(-yaw * 180) / Math.PI + 180})`}>
        <path d="M 0 -6 L 4 4 L 0 2 L -4 4 Z" fill="#ffd27a" stroke="#3b2d1a" strokeWidth={0.8 / s} />
      </g>
    </svg>
  );
}

function Objectives({ vi }: { vi: boolean }) {
  const s = useTorus();
  const rows: [boolean, string][] = [
    [s.crossed, vi ? "Đi qua một mép của ô vuông" : "Walk across an edge of the square"],
    [s.selfHit, vi ? "Bắn trúng lưng chính mình" : "Shoot yourself in the back"],
    [s.bell, vi ? "Rung Chuông trong Hộp kín" : "Ring the Bell in the closed box"],
    [s.warden, vi ? "Hạ Mắt Canh ở Đảo Bốn Góc" : "Defeat the Warden on the Corner Isle"],
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

export function TorusUi() {
  const vi = useWorld((s) => s.lang === "vi");
  const overlay = useWorld((s) => s.overlay);
  const hint = useTorus((s) => s.hint);
  const panel = useTorus((s) => s.panel);
  const aimSelf = useTorus((s) => s.aimSelf);
  const aiming = useCombat((s) => s.aiming);
  const hp = useTorus((s) => s.wardenHp);
  const bell = useTorus((s) => s.bell);
  const [pos, setPos] = useState({ x: 0, z: 0, yaw: 0, nearW: false });
  const [showHint, setShowHint] = useState(false);
  useEffect(() => {
    const id = window.setInterval(() => {
      const w = useWorld.getState();
      setPos({ x: w.player.x, z: w.player.z, yaw: w.playerYaw, nearW: torusDist(w.player.x, w.player.z, SENTINEL.x, SENTINEL.z) < SENTINEL.aggro + 4 });
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
    const h = (e: KeyboardEvent) => e.key === "Escape" && useTorus.setState({ panel: null });
    window.addEventListener("keydown", h);
    return () => window.removeEventListener("keydown", h);
  }, [panel]);
  if (overlay) return null;
  return (
    // .w-hud: cùng lớp + biến lề (--pt, --pr, --u) với HUD chung
    <div className="w-hud">
      <div className="pointer-events-none absolute right-[var(--pr)] top-[calc(var(--pt)+var(--u)*64px)] z-10 w-[148px] rounded-2xl bg-slate-900/50 p-2 text-white shadow-lg backdrop-blur-md">
        <div className="mb-1 text-[10px] font-bold uppercase tracking-[0.14em] text-amber-200/90">{vi ? "Ô vuông dán mép" : "Square, edges glued"}</div>
        <Square px0={pos.x} pz0={pos.z} yaw={pos.yaw} size={132} />
        <Objectives vi={vi} />
      </div>

      <AnimatePresence>
        {hint && showHint && !panel && (
          <motion.div
            key={hint.at}
            initial={{ y: -12, opacity: 0 }}
            animate={{ y: 0, opacity: 1 }}
            exit={{ y: -10, opacity: 0 }}
            className={`pointer-events-none absolute left-1/2 top-[calc(var(--pt)+var(--u)*58px)] z-10 w-[min(92vw,560px)] -translate-x-1/2 rounded-2xl px-4 py-2.5 text-center text-[13px] leading-snug text-white shadow-xl backdrop-blur-md ${hint.kind === "aha" ? "bg-gradient-to-r from-[#ff8a6a]/70 via-[#7a5cff]/60 to-[#5fe0d0]/70" : hint.kind === "warn" ? "bg-slate-900/70" : "bg-slate-900/60"}`}
          >
            {hint.kind === "aha" && <div className="mb-0.5 text-[10px] font-bold uppercase tracking-[0.2em] text-amber-100">✦ {vi ? "À há!" : "Aha!"} ✦</div>}
            {vi ? hint.vi : hint.en}
          </motion.div>
        )}
      </AnimatePresence>

      {aiming && aimSelf && (
        <div className="pointer-events-none absolute left-1/2 top-[58%] z-10 -translate-x-1/2 rounded-full bg-rose-500/80 px-3 py-1 text-[12px] font-bold text-white shadow-lg">{vi ? "Đường bay này vòng qua mép và trúng LƯNG bạn!" : "This shot wraps round and hits your BACK!"}</div>
      )}

      {bell && hp > 0 && pos.nearW && (
        <div className="pointer-events-none absolute left-1/2 top-[calc(var(--pt)+var(--u)*16px)] z-10 -translate-x-1/2 rounded-full bg-slate-900/60 px-4 py-1.5 text-center text-white shadow-lg backdrop-blur-md">
          <div className="text-[11px] font-bold tracking-wide text-pink-200">{vi ? "Mắt Canh Xuyến — khiên luôn nhìn theo đường ngắn nhất" : "Torus Warden — its shield faces the shortest path"}</div>
          <div className="mt-1 flex justify-center gap-1.5">
            {Array.from({ length: SENTINEL.hp }, (_, i) => (
              <span key={i} className={`h-2.5 w-7 rounded-full ${i < hp ? "bg-pink-400 shadow-[0_0_8px_#f472b6]" : "bg-white/15"}`} />
            ))}
          </div>
        </div>
      )}

      <AnimatePresence>
        {panel && (
          <motion.div key={panel} className="pointer-events-auto absolute inset-0 z-30 flex items-center justify-center bg-black/40 p-4" initial={{ opacity: 0 }} animate={{ opacity: 1 }} exit={{ opacity: 0 }} onClick={() => useTorus.setState({ panel: null })}>
            <motion.div initial={{ y: 20, opacity: 0 }} animate={{ y: 0, opacity: 1 }} className="max-h-[86vh] w-[min(94vw,620px)] overflow-y-auto rounded-3xl bg-slate-900/90 p-5 text-white shadow-2xl ring-1 ring-white/10" onClick={(e) => e.stopPropagation()}>
              {panel === "stone" ? <StoneText vi={vi} /> : <CornerText vi={vi} />}
              <div className="mt-4 text-right">
                <button type="button" onClick={() => useTorus.setState({ panel: null })} className="rounded-full bg-amber-300 px-4 py-1.5 text-sm font-bold text-slate-900">
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

function StoneText({ vi }: { vi: boolean }) {
  return (
    <div className="space-y-3 text-[14px] leading-relaxed">
      <h2 className="text-lg font-bold text-amber-200">{vi ? "Bia Xuyến — xuyến phẳng là ô vuông dán mép" : "The Torus Stone — a flat torus is a square with glued edges"}</h2>
      <div className="flex flex-wrap items-center gap-4">
        <Square px0={-12} pz0={8} yaw={Math.PI / 2} size={170} path />
        <ol className="min-w-[220px] flex-1 list-decimal space-y-1.5 pl-5 text-white/90">
          <li>{vi ? "Thế giới này là một ô vuông 48 × 48 m. Mép trái (san hô) DÁN vào mép phải; mép trên (ngọc lam) dán vào mép dưới." : "This world is a 48 × 48 m square. The left edge (coral) is GLUED to the right edge; the top (teal) to the bottom."}</li>
          <li>{vi ? "Dán một cặp mép: được cái ống. Dán cặp còn lại: ống khép thành chiếc bánh vòng — xem ảnh nổi trên bia, và chiếc xuyến trên trời (chấm vàng là bạn)." : "Glue one pair: a tube. Glue the other: the tube closes into a doughnut — watch the hologram above the stone, and the torus in the sky (the gold dot is you)."}</li>
          <li>{vi ? "Ánh sáng cũng đi qua mép, nên nhìn xa bạn thấy đảo — và chính mình — lặp lại sau mỗi 48 m." : "Light crosses the edges too, so far away you see the islands — and yourself — repeating every 48 m."}</li>
          <li>{vi ? "Bắn thẳng ra trước (đường vàng): mũi tên ra mép phải, vào lại từ mép trái — ngay sau lưng bạn (đường lam) — và trúng lưng bạn." : "Shoot straight ahead (gold): the arrow leaves through the right edge and re-enters through the left — right behind you (blue) — and hits your back."}</li>
        </ol>
      </div>
      <p className="rounded-xl bg-white/5 p-3 text-white/80">
        {vi
          ? "Khoảng cách trên xuyến là đường NGẮN NHẤT, có thể đi qua mép. Nhưng tới cùng một điểm có vô số đường thẳng: thẳng tới, hoặc vòng 1 lần, 2 lần… Hộp Chuông chỉ mở về phía biển mây — hãy tìm đường vòng."
          : "Distance on a torus is the SHORTEST way, possibly across an edge. But infinitely many straight lines reach the same point: direct, or wrapping once, twice… The Bell Box opens only towards the clouds — find the way round."}
      </p>
    </div>
  );
}

function CornerText({ vi }: { vi: boolean }) {
  return (
    <div className="space-y-3 text-[14px] leading-relaxed">
      <h2 className="text-lg font-bold text-pink-200">{vi ? "Bia Bốn Góc — bốn góc là một điểm" : "The Corner Stone — four corners, one point"}</h2>
      <p className="text-white/90">
        {vi
          ? "Dán mép trái vào mép phải thì góc trên-trái chạm góc trên-phải. Dán tiếp mép trên vào mép dưới thì cả BỐN góc của ô vuông gặp nhau ở một điểm — chính là chỗ bạn đang đứng. Vì thế Đảo Bốn Góc hiện ra ở cả bốn góc của bản đồ, và đứng ở đây bạn thấy nó tròn trịa, không bị cắt."
          : "Glue left to right and the top-left corner meets the top-right one. Glue top to bottom as well and all FOUR corners of the square meet at one point — right where you stand. That is why the Corner Isle shows up in all four corners of the map, yet here it is whole."}
      </p>
      <p className="rounded-xl bg-white/5 p-3 text-white/80">
        {vi
          ? "Quanh một điểm bất kỳ, bốn góc 90° ghép lại vừa đủ 360°: mặt xuyến này phẳng ở MỌI nơi, kể cả ở góc — khác chiếc bánh vòng 3D trên trời, vốn phải co giãn để khép kín. Đường thẳng hệ số góc p/q khép lại sau L·√(p² + q²); hệ số góc vô tỉ thì không bao giờ khép, và đi qua sát mọi điểm."
          : "Around any point, four 90° corners add up to exactly 360°: this torus is flat EVERYWHERE, corners included — unlike the 3D doughnut in the sky, which has to stretch to close up. A line of slope p/q closes after L·√(p² + q²); an irrational slope never closes and passes arbitrarily close to every point."}
      </p>
    </div>
  );
}
