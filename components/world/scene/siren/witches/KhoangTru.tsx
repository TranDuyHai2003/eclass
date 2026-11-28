"use client";
/**
 * Phù thuỷ hoạ âm #4 — KHOẢNG TRỪ (giao thoa, hoàn toàn trừu tượng). Logic: lib/world/witchKhoangTru.ts (+ test).
 * 3 lệnh vẽ:
 *  1. DẢI SÓNG (InstancedMesh 3 dải giấy khắc 160 đoạn): nguồn 1 (lam), nguồn 2 (hồng — người chơi chỉnh) treo chồng nhau, dải
 *     TỔNG giấy trắng bên dưới; vertex shader uốn bằng CÙNG biểu thức KTR_SUM_EXPR với luật. Vân in khắc lật 10 Hz (giảm chuyển
 *     động: đứng yên). Vòng dự đoán: dải tổng thành giấy nháp gạch xoá (không lộ đáp án) tới lúc dập.
 *  2. SÀN BÁO ĐÒN (KTR_DANGER_EXPR — chuỗi GLSL-cũng-là-JS, test so với luật): báo trước 5 phách; R = 0 → một đường trắng phẳng.
 *  3. SỨ GIẢ (InstancedMesh): Nêm Biên Độ — tam giác xếp tầng = A₂ (mỗi nêm ½); Vạch Đảo Pha — cặp vạch gãy chung gốc, vạch
 *     thứ hai lệch φ/360 bước sóng. Hai núm (phím F) ở hai đầu dải.
 * HUD riêng (DOM, gốc React trong .w-root) chỉ hiện khi tới gần / đã giao chiến. Không cấp phát mỗi khung; đọc HARMONIC.
 */
import { useEffect, useMemo, useRef } from "react";
import { useFrame } from "@react-three/fiber";
import * as THREE from "three";
import { create } from "zustand";
import { createRoot, type Root } from "react-dom/client";
import { HARMONIC } from "@/lib/world/harmonicState";
import { fmtNum } from "@/lib/world/i18n";
import {
  KEV,
  KTR,
  KTR_DANGER_EXPR,
  KTR_K,
  KTR_SUM_EXPR,
  ktrA2,
  ktrBeat,
  ktrHideSum,
  ktrLocked,
  ktrPh,
  ktrR,
  ktrText,
  ktrTheta,
  newKtr,
  tickKtr,
  turnKtr,
  type KtrStage,
} from "@/lib/world/witchKhoangTru";
import { useWorld } from "../../../store";
import { registerAction } from "../../../actions";
import { playerHurt } from "../../../combat/combat";
import { rollDrops } from "../../../combat/items";
import { strike } from "../../../fx/StrikeFx";
import { fxReducedMotion } from "../../../fx/fxClock";
import { floatText } from "../../../ui/Labels";
import { unlockNote } from "../../../story/quest";
import { synth } from "../sirenSynth";
import "./witch.css";

export interface KtrProps {
  /** tâm dải sàn (mặt sàn ở y) — dải dài KTR.L dọc trục x cục bộ, người chơi đứng phía +z cục bộ */
  origin: { x: number; y: number; z: number };
  yaw?: number;
}

const PAL = { paper: "#F3EFE1", ink: "#293945", teal: "#79BFC0", rose: "#C9828C" };
/** độ cao treo + biên độ hình (m) của ba dải */
const RIB = { y1: 3.0, y2: 2.95, ys: 1.25, H: 0.42, band: 0.6, z1: -0.75, z2: -0.55, zs: -0.35 };

// ───────────── trạng thái chung cho HUD + phím F (một phù thuỷ một lúc) ─────────────
const LIVE = { on: false, ax: 0, az: 0, px: 0, pz: 0, sim: newKtr(), t: 0 };
export const useKtrUi = create<{ on: boolean; stage: KtrStage; round: number; a2: number; ph: number; r: number; hide: boolean; tag: string; count: number }>(() => ({
  on: false,
  stage: "dormant",
  round: 0,
  a2: 1,
  ph: 0,
  r: 2,
  hide: false,
  tag: "",
  count: 0,
}));

/** phím F ở hai núm (Siren.tsx gọi trong chuỗi findNearby) */
export function ktrNearby(p: THREE.Vector3): { kind: "action"; id: string; label: string } | null {
  if (!LIVE.on || LIVE.sim.stage !== "fight") return null;
  const lang = useWorld.getState().lang === "vi" ? "vi" : "en";
  if (Math.hypot(p.x - LIVE.ax, p.z - LIVE.az) < 1.7) return { kind: "action", id: "witch:ktr:amp", label: ktrText(lang, "dialAmp", { a: fmtNum(ktrA2(LIVE.sim), lang, 1) }) };
  if (Math.hypot(p.x - LIVE.px, p.z - LIVE.pz) < 1.7) return { kind: "action", id: "witch:ktr:phase", label: ktrText(lang, "dialPhase", { p: ktrPh(LIVE.sim) }) };
  return null;
}

// ───────────── Shader ─────────────
const COMMON = /* glsl */ `
uniform float uA1; uniform float uA2; uniform float uPh; uniform float uTh; uniform float uK; uniform float uL; uniform float uW; uniform float uS;
float hsh(vec2 p){ return fract(sin(dot(p, vec2(127.1, 311.7))) * 43758.5453); }`;

const RIB_VERT = /* glsl */ `
${COMMON}
uniform float uH;
uniform float uHide;
attribute float aWhich;
varying vec2 vUv;
varying float vWhich;
varying float vFogDepth;
void main(){
  vUv = uv;
  vWhich = aWhich;
  float u = uv.x * uL;
  float y1 = uA1 * sin(uK * u - uTh);
  float y2 = uA2 * sin(uK * u - uTh + uPh);
  float ys = ${KTR_SUM_EXPR};
  float w = aWhich < 0.5 ? y1 : aWhich < 1.5 ? y2 : ys * (1.0 - uHide);
  vec3 p = position;
  p.y += uH * w;
  vec4 mv = viewMatrix * modelMatrix * instanceMatrix * vec4(p, 1.0);
  vFogDepth = -mv.z;
  gl_Position = projectionMatrix * mv;
}`;
const RIB_FRAG = /* glsl */ `
uniform float uTime;
uniform float uFlip;
uniform float uHide;
uniform float uFlat;
uniform vec3 uC0; uniform vec3 uC1; uniform vec3 uC2; uniform vec3 uInk;
uniform vec3 fogColor; uniform float fogNear; uniform float fogFar;
varying vec2 vUv;
varying float vWhich;
varying float vFogDepth;
float hsh(vec2 p){ return fract(sin(dot(p, vec2(127.1, 311.7))) * 43758.5453); }
void main(){
  vec3 base = vWhich < 0.5 ? uC0 : vWhich < 1.5 ? uC1 : uC2;
  // vân khắc (intaglio): gạch chéo theo dải, lật 10 Hz
  float f = floor(uFlip);
  float ang = 0.7 + 0.25 * (hsh(vec2(f, vWhich)) - 0.5);
  vec2 q = vec2(vUv.x * 60.0, vUv.y * 6.0);
  float hatch = 0.5 + 0.5 * sin((q.x * cos(ang) + q.y * sin(ang)) * 6.2831);
  vec3 c = mix(base, base * 0.78, smoothstep(0.55, 0.9, hatch) * 0.55);
  // mép mực
  float edge = min(vUv.y, 1.0 - vUv.y);
  c = mix(uInk, c, smoothstep(0.04, 0.09, edge));
  // dải tổng bị che (dự đoán): giấy nháp gạch xoá
  if (vWhich > 1.5 && uHide > 0.5) {
    float x = step(0.82, fract((vUv.x * 40.0 + vUv.y * 3.0)));
    c = mix(vec3(0.78, 0.76, 0.7), uInk, x * 0.6);
  }
  // triệt tiêu: dải tổng phát sáng trắng
  if (vWhich > 1.5) c = mix(c, vec3(1.35, 1.32, 1.2), uFlat);
  c = mix(c, fogColor, smoothstep(fogNear, fogFar * 1.3, vFogDepth) * 0.9);
  gl_FragColor = vec4(c, 1.0);
}`;

const FLOOR_VERT = /* glsl */ `
varying vec2 vUv;
varying float vFogDepth;
void main(){
  vUv = uv;
  vec4 mv = viewMatrix * modelMatrix * vec4(position, 1.0);
  vFogDepth = -mv.z;
  gl_Position = projectionMatrix * mv;
}`;
const FLOOR_FRAG = /* glsl */ `
${COMMON}
uniform float uTele;
uniform float uFlash;
uniform float uFlat;
uniform float uTime;
uniform vec3 uInk; uniform vec3 uRose; uniform vec3 uPaper;
uniform vec3 fogColor; uniform float fogNear; uniform float fogFar;
varying vec2 vUv;
varying float vFogDepth;
void main(){
  float u = vUv.x * uL;
  float v = vUv.y * uW;
  bool dz = ${KTR_DANGER_EXPR};
  vec3 c = uPaper * 0.92;
  // khung in (biên mực) + vạch bước sóng
  float fr = min(min(vUv.x, 1.0 - vUv.x) * uL, min(vUv.y, 1.0 - vUv.y) * uW);
  c = mix(uInk, c, smoothstep(0.05, 0.12, fr));
  float tick = 1.0 - smoothstep(0.0, 0.03, abs(fract(u / (3.14159265 / uK)) - 0.5) - 0.47);
  c = mix(c, uInk, tick * 0.25 * step(vUv.y, 0.12));
  if (dz) {
    float hatch = step(0.5, fract((u + v) * 3.0));
    c = mix(c, mix(uRose, uInk, hatch * 0.35), clamp(uTele, 0.0, 1.0) * 0.85);
  }
  c += vec3(1.0, 0.85, 0.75) * uFlash * (dz ? 0.9 : 0.15);
  // khoảng lặng: một đường trắng phẳng chạy giữa dải
  c = mix(c, vec3(1.4, 1.38, 1.3), uFlat * (1.0 - smoothstep(0.04, 0.09, abs(v - uW * 0.5))));
  c = mix(c, fogColor, smoothstep(fogNear, fogFar * 1.3, vFogDepth) * 0.9);
  gl_FragColor = vec4(c, 1.0);
}`;

function ktrUni() {
  return {
    uA1: { value: KTR.A1 },
    uA2: { value: 1 },
    uPh: { value: 0 },
    uTh: { value: 0 },
    uK: { value: KTR_K },
    uL: { value: KTR.L },
    uW: { value: KTR.W },
    uS: { value: KTR.S },
  };
}

// ───────────── HUD ─────────────
const SW = 240;
const SH = 54;
function wavePath(a: number, ph: number, yc: number, amp: number): string {
  let d = "";
  for (let i = 0; i <= 80; i++) {
    const x = (i / 80) * SW;
    const y = yc - amp * a * Math.sin((i / 80) * 4 * Math.PI + (ph * Math.PI) / 180);
    d += `${i ? "L" : "M"}${x.toFixed(1)} ${y.toFixed(1)}`;
  }
  return d;
}
function KtrHud() {
  const lang = useWorld((s) => (s.lang === "vi" ? "vi" : "en"));
  const u = useKtrUi();
  if (!u.on) return null;
  const sum = (i: number) => KTR.A1 * Math.sin(i) + u.a2 * Math.sin(i + (u.ph * Math.PI) / 180);
  let ds = "";
  for (let i = 0; i <= 80; i++) ds += `${i ? "L" : "M"}${((i / 80) * SW).toFixed(1)} ${(SH * 0.72 - 6 * sum((i / 80) * 4 * Math.PI)).toFixed(1)}`;
  return (
    <div className="w-witch">
      <div className="w-boss__name">
        <span>{ktrText(lang, "name")}</span>
        <i>{u.stage === "fight" ? ktrText(lang, "round", { i: u.round + 1 }) : ""}</i>
      </div>
      {u.tag && <div className={`w-boss__tag ${u.count > 0 ? "w-boss__tag--warn" : ""}`}>{u.tag}{u.count > 0 ? ` · ${u.count}` : ""}</div>}
      {u.stage === "fight" && (
        <div className="w-witch__card">
          <svg width={SW} height={SH} viewBox={`0 0 ${SW} ${SH}`} aria-hidden>
            <path d={wavePath(KTR.A1, 0, SH * 0.25, 6)} fill="none" stroke={PAL.teal} strokeWidth={2} />
            <path d={wavePath(u.a2, u.ph, SH * 0.25, 6)} fill="none" stroke={PAL.rose} strokeWidth={2} strokeDasharray="5 3" />
            <line x1={0} y1={SH * 0.72} x2={SW} y2={SH * 0.72} className="w-witch__axis" />
            {u.hide ? (
              <text x={SW / 2} y={SH * 0.72 + 6} textAnchor="middle" className="w-witch__q">
                ? ? ?
              </text>
            ) : (
              <path d={ds} fill="none" stroke={u.r < 1e-6 ? "#ffffff" : PAL.paper} strokeWidth={u.r < 1e-6 ? 3 : 2} />
            )}
          </svg>
          <div className="w-witch__row">
            A₁ = 1 · A₂ = {fmtNum(u.a2, lang, 1)} · φ = {u.ph}° · R = {u.hide ? "?" : fmtNum(u.r, lang, 2)}
          </div>
          <div className="w-witch__row w-witch__row--dim">{ktrText(lang, "formula")}</div>
        </div>
      )}
    </div>
  );
}

// ───────────── Cảnh ─────────────
export function KhoangTru({ origin, yaw = 0 }: KtrProps) {
  const c = Math.cos(yaw);
  const s = Math.sin(yaw);
  /** cục bộ (lx dọc dải, lz trước dải) → thế giới */
  const wx = (lx: number, lz: number) => origin.x + lx * c + lz * s;
  const wz = (lx: number, lz: number) => origin.z - lx * s + lz * c;

  const parts = useMemo(() => {
    // 1) ba dải giấy (một hình, 3 instance)
    const geo = new THREE.PlaneGeometry(KTR.L, RIB.band, 160, 1);
    geo.setAttribute("aWhich", new THREE.InstancedBufferAttribute(new Float32Array([0, 1, 2]), 1));
    const ribMat = new THREE.ShaderMaterial({
      vertexShader: RIB_VERT,
      fragmentShader: RIB_FRAG,
      side: THREE.DoubleSide,
      fog: true,
      uniforms: THREE.UniformsUtils.merge([
        THREE.UniformsLib.fog,
        ktrUni(),
        {
          uH: { value: RIB.H },
          uHide: { value: 0 },
          uTime: { value: 0 },
          uFlip: { value: 0 },
          uFlat: { value: 0 },
          uC0: { value: new THREE.Color(PAL.teal) },
          uC1: { value: new THREE.Color(PAL.rose) },
          uC2: { value: new THREE.Color(PAL.paper) },
          uInk: { value: new THREE.Color(PAL.ink) },
        },
      ]),
    });
    const rib = new THREE.InstancedMesh(geo, ribMat, 3);
    const M = new THREE.Matrix4();
    // dải dọc trục x cục bộ, tâm u = L/2 ↔ lx = 0
    rib.setMatrixAt(0, M.makeTranslation(0, RIB.y1, RIB.z1));
    rib.setMatrixAt(1, M.makeTranslation(0, RIB.y2, RIB.z2));
    rib.setMatrixAt(2, M.makeTranslation(0, RIB.ys, RIB.zs));
    rib.frustumCulled = false;
    rib.name = "perf:ktr-ribbons";
    // 2) sàn báo đòn
    const floorMat = new THREE.ShaderMaterial({
      vertexShader: FLOOR_VERT,
      fragmentShader: FLOOR_FRAG,
      fog: true,
      uniforms: THREE.UniformsUtils.merge([
        THREE.UniformsLib.fog,
        ktrUni(),
        { uTele: { value: 0 }, uFlash: { value: 0 }, uFlat: { value: 0 }, uTime: { value: 0 }, uInk: { value: new THREE.Color(PAL.ink) }, uRose: { value: new THREE.Color(PAL.rose) }, uPaper: { value: new THREE.Color(PAL.paper) } },
      ]),
    });
    const floor = new THREE.Mesh(new THREE.PlaneGeometry(KTR.L, KTR.W).rotateX(-Math.PI / 2).translate(0, 0.035, KTR.W / 2), floorMat);
    floor.name = "perf:ktr-floor";
    // 3) sứ giả: 3 nêm (tam giác) + 4 vạch (2 cặp) — lăng trụ tam giác / hộp mảnh, màu theo instance
    const tri = new THREE.Shape([new THREE.Vector2(-0.5, 0), new THREE.Vector2(0.5, 0), new THREE.Vector2(0, 0.62)]);
    const wedgeGeo = new THREE.ExtrudeGeometry(tri, { depth: 0.08, bevelEnabled: false }).translate(0, 0, -0.04);
    const msgMat = new THREE.MeshLambertMaterial({ color: "#ffffff" });
    const msg = new THREE.InstancedMesh(wedgeGeo, msgMat, 7);
    msg.frustumCulled = false;
    msg.name = "perf:ktr-messengers";
    const C = new THREE.Color();
    for (let i = 0; i < 7; i++) msg.setColorAt(i, C.set(i < 3 ? PAL.rose : i % 2 ? PAL.ink : PAL.teal));
    return { rib, ribMat, floor, floorMat, msg, msgMat };
  }, []);
  useEffect(
    () => () => {
      parts.rib.geometry.dispose();
      parts.ribMat.dispose();
      parts.floor.geometry.dispose();
      parts.floorMat.dispose();
      parts.msg.geometry.dispose();
      parts.msgMat.dispose();
      parts.rib.dispose();
      parts.msg.dispose();
    },
    [parts],
  );

  // HUD + vị trí núm + phím F
  useEffect(() => {
    LIVE.on = true;
    LIVE.sim = newKtr();
    LIVE.ax = wx(-KTR.L / 2 - 1.1, KTR.W * 0.55);
    LIVE.az = wz(-KTR.L / 2 - 1.1, KTR.W * 0.55);
    LIVE.px = wx(KTR.L / 2 + 1.1, KTR.W * 0.55);
    LIVE.pz = wz(KTR.L / 2 + 1.1, KTR.W * 0.55);
    const host = document.querySelector(".w-root");
    let root: Root | null = null;
    let el: HTMLDivElement | null = null;
    if (host) {
      el = document.createElement("div");
      el.className = "w-hud";
      host.appendChild(el);
      root = createRoot(el);
      root.render(<KtrHud />);
    }
    const turn = (dial: "amp" | "phase") => {
      const lang = useWorld.getState().lang === "vi" ? "vi" : "en";
      const sim = LIVE.sim;
      const at = new THREE.Vector3(dial === "amp" ? LIVE.ax : LIVE.px, origin.y + 2.2, dial === "amp" ? LIVE.az : LIVE.pz);
      if (!turnKtr(sim, LIVE.t, dial)) {
        floatText(at, ktrText(lang, "locked"), "info");
        synth.impact("wood", 2);
        return;
      }
      if (dial === "amp") {
        floatText(at, ktrText(lang, "amp", { a: fmtNum(ktrA2(sim), lang, 1) }), "info");
        synth.pluck(220, 0.25 + 0.3 * ktrA2(sim), 1.2);
      } else {
        floatText(at, ktrText(lang, "phase", { p: ktrPh(sim) }), "info");
        synth.impact("paper", 4);
      }
    };
    const offs = [registerAction("witch:ktr:amp", () => turn("amp")), registerAction("witch:ktr:phase", () => turn("phase"))];
    if (process.env.NODE_ENV !== "production")
      (window as unknown as { __ktr: unknown }).__ktr = {
        sim: () => LIVE.sim,
        turn: (d: "amp" | "phase") => turn(d),
        tp: (lx: number, lz: number) => {
          const w = useWorld.getState();
          w.player.set(wx(lx, lz), origin.y, wz(lx, lz));
          useWorld.setState({ playerYaw: yaw + Math.PI, camYaw: yaw, camPitch: 0.45, camDist: 9 });
          return 1;
        },
      };
    return () => {
      LIVE.on = false;
      offs.forEach((f) => f());
      useKtrUi.setState({ on: false });
      setTimeout(() => {
        root?.unmount();
        el?.remove();
      }, 0);
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  const st = useRef({ uiAt: 0, flash: 0, flat: 0, wasDone: false });
  const M = useMemo(() => new THREE.Matrix4(), []);
  const Q = useMemo(() => new THREE.Quaternion(), []);
  const P = useMemo(() => new THREE.Vector3(), []);
  const SC = useMemo(() => new THREE.Vector3(), []);
  useFrame((_, rawDt) => {
    const dt = Math.min(0.05, Math.max(1e-3, rawDt));
    const S = st.current;
    const sim = LIVE.sim;
    // đồng hồ nhạc (cùng nhịp với phách) — không có thì đồng hồ thật
    const t = HARMONIC.time > 0 ? HARMONIC.time : performance.now() / 1000;
    LIVE.t = t;
    const calm = fxReducedMotion();
    const w = useWorld.getState();
    const p = w.player;
    const dx = p.x - origin.x;
    const dz = p.z - origin.z;
    const lx = dx * c - dz * s;
    const lz = dx * s + dz * c;
    const dist = Math.hypot(lx, lz - KTR.W / 2);
    const ev = tickKtr(sim, t, lx + KTR.L / 2, lz, dist);
    const lang = w.lang === "vi" ? "vi" : "en";
    const R = ktrR(sim);
    // ── sự kiện
    if (ev & KEV.REVEAL) {
      synth.whoosh(300, 760, 0.8, 0.4);
      floatText(new THREE.Vector3(origin.x, origin.y + 3.6, origin.z), ktrText(lang, "reveal"), "info");
    }
    if (ev & KEV.TELE) synth.interval(220, 220 * (1 + 0.004 * ktrPh(sim)), 0.25);
    if (ev & KEV.STAMP) {
      S.flash = 1;
      synth.impact("paper", 9);
      if (!calm) strike("crest", origin.x, origin.y + 0.05, origin.z, { r: KTR.L / 2, color: R < 1e-6 ? "#ffffff" : PAL.rose });
      if (ev & KEV.HURT) playerHurt(Math.round(KTR.DMG * Math.min(1, sim.lastR / 1.5 + 0.3)));
      if (ev & KEV.CLEAR) {
        synth.resolve(220);
        floatText(new THREE.Vector3(origin.x, origin.y + 2.4, origin.z), ktrText(lang, "clear"), "crit");
      } else floatText(new THREE.Vector3(origin.x, origin.y + 2.4, origin.z), ktrText(lang, "left", { r: fmtNum(sim.lastR, lang, 2) }), "info");
    }
    if (ev & KEV.WIN && !S.wasDone) {
      S.wasDone = true;
      unlockNote("cancel");
      floatText(new THREE.Vector3(origin.x, origin.y + 3.2, origin.z), ktrText(lang, "win"), "crit");
      for (let i = 0; i < 3; i++) rollDrops("mite", new THREE.Vector3(wx(i - 1, KTR.W + 0.6), origin.y + 0.5, wz(i - 1, KTR.W + 0.6)));
      w.burst([origin.x, origin.y + 2, origin.z], PAL.paper, 80);
    }
    // ── pha hiển thị: trượt chậm; lúc dập đóng băng đúng θ của luật
    const { b } = ktrBeat(sim, t);
    const fight = sim.stage === "fight";
    const inStamp = fight && b >= KTR.STAMP && b < KTR.STAMP + KTR.ACTIVE;
    const th = inStamp ? sim.lastTheta : calm ? 0 : ktrTheta(t);
    const hide = ktrHideSum(sim, t);
    S.flash = Math.max(0, S.flash - dt * 2.2);
    const flatTarget = sim.stage === "done" || (fight && R < 1e-6) ? 1 : 0;
    S.flat += (flatTarget - S.flat) * Math.min(1, dt * 4);
    const ru = parts.ribMat.uniforms;
    const fu = parts.floorMat.uniforms;
    for (const U of [ru, fu]) {
      U.uA2.value = ktrA2(sim);
      U.uPh.value = (ktrPh(sim) * Math.PI) / 180;
      U.uTh.value = th;
      U.uTime.value = t;
      U.uFlat.value = S.flat;
    }
    ru.uHide.value = hide ? 1 : 0;
    ru.uFlip.value = calm ? 0 : HARMONIC.time * 10;
    // ngủ: dải gần như phẳng, treo thấp; lộ diện: căng dần
    // thắng: hai dải thành phần cũng lặng dần (phù thuỷ tự xoá mình) — chỉ còn đường trắng
    const wake = sim.stage === "dormant" ? 0.15 : sim.stage === "reveal" ? Math.min(1, (t - sim.at) / KTR.REVEAL) : sim.stage === "done" ? Math.max(0, 1 - (t - sim.at) / 2.5) : 1;
    ru.uH.value = RIB.H * wake;
    const teleK = fight && b >= KTR.TELE && b < KTR.STAMP + KTR.ACTIVE ? Math.min(1, (b - KTR.TELE) / (KTR.STAMP - KTR.TELE)) : 0;
    fu.uTele.value = hide ? 0 : teleK;
    fu.uFlash.value = S.flash;
    parts.floor.visible = sim.stage !== "dormant";
    // ── sứ giả: nêm biên độ (số nêm = A₂ / ½) ở núm trái, cặp vạch pha ở núm phải
    const nW = Math.round(ktrA2(sim) / 0.5);
    for (let i = 0; i < 3; i++) {
      const on = i < nW;
      P.set(-KTR.L / 2 - 1.1, on ? 0.02 + i * 0.66 : -50, KTR.W * 0.55);
      Q.identity();
      SC.set(1, 1, 1);
      parts.msg.setMatrixAt(i, M.compose(P, Q, SC));
    }
    const off = (ktrPh(sim) / 360) * 1.6;
    for (let k = 0; k < 2; k++)
      for (let j = 0; j < 2; j++) {
        // cặp vạch gãy chung gốc: vạch gốc (k = 0) đứng yên, vạch k = 1 lệch theo φ — nêm dựng đứng mảnh làm vạch
        P.set(KTR.L / 2 + 0.5 + (k ? off : 0), j * 0.7, KTR.W * 0.55);
        Q.setFromAxisAngle(AXZ, j ? Math.PI : 0);
        if (j) P.y += 1.3;
        SC.set(0.22, 1.1, 1);
        parts.msg.setMatrixAt(3 + k * 2 + j, M.compose(P, Q, SC));
      }
    parts.msg.instanceMatrix.needsUpdate = true;
    // ── HUD (≤ 8 lần / giây)
    const now = performance.now();
    if (now - S.uiAt > 125) {
      S.uiAt = now;
      const on = sim.stage !== "dormant" || dist <= KTR.WAKE_R + 3;
      const locked = fight && ktrLocked(sim, t);
      const count = fight && b >= KTR.TELE && b < KTR.STAMP ? Math.ceil(KTR.STAMP - b) : 0;
      const tag =
        sim.stage === "dormant"
          ? ktrText(lang, "dormant")
          : sim.stage === "reveal"
            ? ktrText(lang, "reveal")
            : sim.stage === "done"
              ? ktrText(lang, "win")
              : locked
                ? ktrText(lang, "locked")
                : hide
                  ? ktrText(lang, "predict")
                  : count > 0
                    ? ktrText(lang, "tele")
                    : "";
      const u0 = useKtrUi.getState();
      if (u0.on !== on || u0.stage !== sim.stage || u0.round !== sim.round || u0.a2 !== ktrA2(sim) || u0.ph !== ktrPh(sim) || u0.hide !== hide || u0.tag !== tag || u0.count !== count)
        useKtrUi.setState({ on, stage: sim.stage, round: sim.round, a2: ktrA2(sim), ph: ktrPh(sim), r: R, hide, tag, count });
    }
  });

  return (
    <group position={[origin.x, origin.y, origin.z]} rotation-y={yaw} name="perf:witch-khoangtru">
      <primitive object={parts.rib} />
      <primitive object={parts.floor} />
      <primitive object={parts.msg} />
    </group>
  );
}
const AXZ = new THREE.Vector3(0, 0, 1);
