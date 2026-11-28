"use client";
/**
 * Hình ảnh boss Fourier Siren — nhánh B "mê cung phù thuỷ" (docs/ai-reviews/siren-witch/PLAN.md). CHỈ HÌNH: luật / nhịp đòn
 * ở lib/world/boss.ts (server: realtime/boss.mjs) giữ nguyên.
 *  - BossBody: thân boss (GLB) chuyển động bằng lò xo (springStep) theo nhịp đòn: dồn lực → báo trước → tung đòn → giữ → hồi;
 *    lớp "mực in lệch" (viền đỏ / lam lệch nhau + rung kép lệch tần) theo HARMONIC.dissonance; mất màu / chi tiết theo
 *    HARMONIC.decomposition; tan biến / hiện lại do lịch epicycle (lib/world/epicycle.ts) điều khiển.
 *  - BossEpicycles: chuỗi vectơ quay (vòng tròn + mũi tên: 1 lệnh vẽ instancing) + dải đường viền do ngọn bút vẽ (1 lệnh vẽ):
 *    xuất hiện = bút vẽ dáng boss rồi thân hiện ra; BREAK = vỡ về bậc thấp rồi dựng lại; gục = mất hoạ âm bậc cao trước.
 *  - CometRibbons: vệt ruy băng mờ dần theo ĐÚNG quỹ đạo Lissajous của 2 sao chổi (lấy mẫu giải tích quá khứ, 1 lệnh vẽ).
 *  - createStandingMat: báo trước "Sóng dừng" thành hình Chladni (cát tụ ở nút = an toàn) — vùng nguy hiểm dùng CHUNG biểu thức
 *    STANDING_DANGER_EXPR (test so với standingDanger).
 * Không cấp phát trong useFrame; "Giảm chuyển động" tắt chớp sáng / rung giật.
 */
import { useEffect, useMemo, useRef } from "react";
import { useFrame } from "@react-three/fiber";
import { useGLTF } from "@react-three/drei";
import * as THREE from "three";
import { ATK, inPhase, lissajous, type BossSim } from "@/lib/world/boss";
import { CHLADNI_GLSL, HARMONIC, springStep, type Spring } from "@/lib/world/harmonicState";
import { DISSOLVE_GONE, SIREN_EPI, STANDING_DANGER_EXPR, bossLook, epicycleJoints, epicycleTip, harmonicKMax, termWeight, type BossLook } from "@/lib/world/epicycle";
import { worldAsset } from "@/lib/world/avatars";
import { toonize, cloneWithOwnMaterials } from "../../fx/glbToon";
import { reduceMotion } from "./SirenGravity";
import { offHub } from "./zones/zoneRuntime";

const SIREN_GLB = worldAsset("boss/siren.glb");
/** scale mô hình (như bản cũ) */
const BOSS_SCALE = 1.6;

/** tư thế + lịch hình dùng chung giữa thân boss và epicycle (một nguồn — BossBody ghi, BossEpicycles đọc) */
export const BOSS_FX: { y: number; look: BossLook; mountAt: number; brokenAt: number; wasBroken: boolean; dbgBreakUntil: number; dbgDeadAt: number } = {
  y: 0.6,
  look: { draw: 0, kMax: SIREN_EPI.kTop, shrink: 1, chain: 0, trail: 0, dissolve: DISSOLVE_GONE, spin: 0 },
  mountAt: -1,
  brokenAt: 0,
  wasBroken: false,
  /** chỉ để xem thử hình (dev): giả BREAK / gục mà KHÔNG đụng BossSim */
  dbgBreakUntil: 0,
  dbgDeadAt: 0,
};
if (typeof window !== "undefined" && process.env.NODE_ENV !== "production") (window as unknown as { __sirenBossFx: typeof BOSS_FX }).__sirenBossFx = BOSS_FX;

/** đồng phục mực in lệch (dùng chung mọi vật liệu thân boss) */
const INK = {
  uDis: { value: 0 },
  uDec: { value: 0 },
  uTime: { value: 0 },
  uInk: { value: new THREE.Vector2(1, 0) },
};

/** thêm lớp mực in lệch + phân rã màu vào vật liệu toon đã có tan biến (addDissolve) — nối tiếp onBeforeCompile cũ */
function addInk(mat: THREE.MeshToonMaterial) {
  const prev = mat.onBeforeCompile;
  mat.onBeforeCompile = (sh, r) => {
    prev.call(mat, sh, r);
    sh.uniforms.uInkDis = INK.uDis;
    sh.uniforms.uInkDec = INK.uDec;
    sh.uniforms.uInkTime = INK.uTime;
    sh.uniforms.uInkDir = INK.uInk;
    sh.vertexShader = sh.vertexShader
      .replace(
        "#include <common>",
        `#include <common>
uniform float uInkDis;
uniform float uInkTime;`,
      )
      .replace(
        "#include <begin_vertex>",
        `#include <begin_vertex>
        // rung kép lệch tần (detune): hai sóng 7,0 và 7,6 rad/s → phách chậm, chỉ khi bất hoà
        transformed.x += uInkDis * 0.035 * sin(position.y * 5.0 + uInkTime * 7.0) * sin(uInkTime * 0.6 + position.y);
        transformed.z += uInkDis * 0.025 * sin(position.y * 4.0 - uInkTime * 7.6);`,
      );
    sh.fragmentShader = sh.fragmentShader
      .replace(
        "#include <common>",
        `#include <common>
uniform float uInkDis;
uniform float uInkDec;
uniform vec2 uInkDir;`,
      )
      .replace(
        "#include <dithering_fragment>",
        `#include <dithering_fragment>
        {
          // lệch lớp mực (cục bộ trên thân): viền đỏ phía uInkDir, viền lam phía ngược lại — như bản in hai lớp lệch khuôn
          vec3 vd = normalize(vViewPosition);
          float rim = 1.0 - abs(dot(normal, vd));
          vec2 nd = normal.xy / max(1e-4, length(normal.xy));
          float side = dot(nd, uInkDir);
          float fr = smoothstep(0.3, 0.85, rim) * uInkDis * abs(side);
          gl_FragColor.rgb += fr * (side > 0.0 ? vec3(1.1, -0.25, -0.2) : vec3(-0.3, 0.6, 0.95));
          // phân rã: rút màu + dồn bậc sáng (ít hệ số Fourier = ít sắc độ)
          float l = dot(gl_FragColor.rgb, vec3(0.299, 0.587, 0.114));
          vec3 grey = vec3(l) * vec3(0.93, 0.96, 1.06);
          gl_FragColor.rgb = mix(gl_FragColor.rgb, grey, uInkDec * 0.8);
          float steps = mix(24.0, 3.0, uInkDec);
          gl_FragColor.rgb = mix(gl_FragColor.rgb, floor(gl_FragColor.rgb * steps + 0.5) / steps, uInkDec);
          gl_FragColor.rgb = max(gl_FragColor.rgb, vec3(0.0));
        }`,
      );
  };
  mat.customProgramCacheKey = () => "siren-ink";
  mat.needsUpdate = true;
}

const sp = (): Spring => ({ x: 0, v: 0 });
const GLOW_TMP = new THREE.Color();
const GREY = new THREE.Color();

/** Thân boss: lò xo + mực in lệch + tan biến theo lịch epicycle */
export function BossBody({ boss }: { boss: React.RefObject<BossSim> }) {
  const gltf = useGLTF(SIREN_GLB);
  const model = useMemo(() => {
    const src = gltf.scene.getObjectByName("b_siren");
    if (!src) return null;
    const m = cloneWithOwnMaterials(toonize(src));
    for (const t of m.toon) addInk(t);
    return m;
  }, [gltf]);
  const g = useRef<THREE.Group>(null);
  const rm = useMemo(() => reduceMotion(), []);
  const S = useMemo(() => ({ lift: { x: 0.6, v: 0 }, sy: { x: 1, v: 0 }, lean: sp(), tilt: sp(), yaw: sp(), glow: { x: 0.6, v: 0 }, kick: sp() }), []);
  useEffect(() => {
    BOSS_FX.mountAt = -1;
    BOSS_FX.wasBroken = false;
    BOSS_FX.dbgBreakUntil = 0;
    BOSS_FX.dbgDeadAt = 0;
    return () => {
      INK.uDis.value = 0;
      INK.uDec.value = 0;
    };
  }, []);
  useFrame((_, rawDt) => {
    if (offHub()) return; // đang ở khu khác của đồ thị khu
    const b = boss.current;
    if (!g.current || !model || !b) return;
    const dt = Math.min(rawDt, 0.05);
    const now = Date.now();
    if (BOSS_FX.mountAt < 0) BOSS_FX.mountAt = now;
    const brokenUntil = Math.max(b.brokenUntil, BOSS_FX.dbgBreakUntil);
    const deadAt = b.deadAt || BOSS_FX.dbgDeadAt;
    const broken = now < brokenUntil && !deadAt;
    if (broken && !BOSS_FX.wasBroken) BOSS_FX.brokenAt = now;
    BOSS_FX.wasBroken = broken;
    // lịch epicycle (xuất hiện / BREAK / gục) — bậc nền theo phân rã (mượt, không theo số hoạ âm làm tròn)
    const baseK = harmonicKMax(8 - 7 * HARMONIC.decomposition, SIREN_EPI.kTop);
    const L = bossLook(BOSS_FX.look, now - BOSS_FX.mountAt, now, BOSS_FX.brokenAt, brokenUntil, deadAt, baseK, SIREN_EPI.kTop);

    // ── nhịp đòn: dồn lực (anticipation) → báo trước → tung đòn (commit) → giữ (active) → hồi (recovery). Thời gian = luật cũ.
    let tLift = 0.6 + Math.sin((HARMONIC.beat * Math.PI) / 4) * 0.25;
    let tSy = 1;
    let tLean = 0;
    if (broken) {
      tLift = 0.1;
      tSy = 0.92;
    } else if (b.atk && !deadAt) {
      const a = ATK[b.atk];
      const since = now - b.atkAt;
      if (since < a.tele * 0.3) {
        // dồn lực: co người, ngả ra sau, hạ thấp
        tSy = 0.88;
        tLean = -0.16;
        tLift -= 0.2;
      } else if (since < a.tele) {
        // báo trước: vươn dần lên
        const k = (since - a.tele * 0.3) / (a.tele * 0.7);
        tSy = 0.92 + 0.16 * k;
        tLean = -0.12 + 0.06 * k;
        tLift += 0.35 * k;
      } else if (since < a.tele + 160) {
        // tung đòn: giật dài người + đổ về trước (lò xo thiếu giảm chấn → vượt đích rồi rung)
        tSy = 1.14;
        tLean = 0.22;
        tLift += b.atk === "standing" ? -0.45 : 0.1;
      } else if (since < a.tele + a.dur) {
        tSy = 1.02;
        tLean = 0.06;
        if (b.atk === "beat") {
          // mỗi vòng nhịp phát ra: nhói một nhịp
          const ph = (since - a.tele) % 650;
          if (ph < 90) tSy = 1.1;
        }
      }
    }
    springStep(S.lift, tLift, 7, 0.55, dt);
    springStep(S.sy, tSy, 15, 0.38, dt);
    springStep(S.lean, tLean, 9, 0.45, dt);
    springStep(S.tilt, broken ? 0.25 : 0, 5, 0.4, dt);
    const spin = b.atk === "lissajous" && now - b.atkAt > ATK.lissajous.tele ? HARMONIC.time * 0.9 : 0;
    springStep(S.yaw, Math.sin(HARMONIC.time * 0.25) * 0.6 + spin, 4, 0.9, dt);
    const phaseOn = inPhase(now);
    springStep(S.glow, phaseOn ? 1.6 : 0.6, 6, 0.7, dt);

    const sy = Math.max(0.6, S.sy.x);
    const sx = 1 / Math.sqrt(sy); // giữ thể tích (squash & stretch)
    g.current.position.y = S.lift.x;
    g.current.rotation.set(S.lean.x, S.yaw.x, S.tilt.x);
    g.current.scale.set(BOSS_SCALE * sx, BOSS_SCALE * sy, BOSS_SCALE * sx);
    BOSS_FX.y = S.lift.x;

    // ── mực in lệch / phân rã
    const dis = Math.min(1, HARMONIC.dissonance + (broken ? 0.45 : 0));
    INK.uDis.value = dis;
    INK.uDec.value = HARMONIC.decomposition;
    INK.uTime.value = rm ? 0 : HARMONIC.time;
    // hướng lệch khuôn đổi 8 lần/giây (stop-motion) — giảm chuyển động: đứng yên
    const q = rm ? 0.7 : HARMONIC.stopTime * 3.7;
    INK.uInk.value.set(Math.cos(q), Math.sin(q));

    for (const m of model.glow) {
      GLOW_TMP.copy(m.userData.base as THREE.Color).multiplyScalar(S.glow.x);
      GREY.setScalar(GLOW_TMP.r * 0.3 + GLOW_TMP.g * 0.59 + GLOW_TMP.b * 0.11);
      m.color.copy(GLOW_TMP).lerp(GREY, HARMONIC.decomposition * 0.75);
      m.visible = L.dissolve < 0.9;
    }
    for (const m of model.toon) {
      (m.userData.dissolve as { value: number }).value = L.dissolve;
      m.emissive.setScalar(b.shield ? 0.25 : 0);
    }
    g.current.visible = L.dissolve < DISSOLVE_GONE - 0.01;
  });
  if (!model) return null;
  return (
    <group ref={g} scale={BOSS_SCALE} position-y={0.6}>
      <primitive object={model.obj} />
    </group>
  );
}

// ───────────── Epicycle: chuỗi vectơ quay + dải đường viền ─────────────
const MAXC = 36;
const SEG = 200;

const CHAIN_VERT = /* glsl */ `
attribute vec4 aC;   // tâm x, y; bán kính; góc mũi tên
attribute float aA;  // độ hiện
varying vec2 vL;
varying float vR;
varying float vA;
varying vec2 vDir;
void main(){
  float s = aC.z + 0.08;
  vL = position.xy * s;
  vR = aC.z;
  vA = aA;
  vDir = vec2(cos(aC.w), sin(aC.w));
  gl_Position = projectionMatrix * modelViewMatrix * vec4(aC.xy + vL, 0.0, 1.0);
}`;
const CHAIN_FRAG = /* glsl */ `
uniform float uAlpha;
uniform float uMis;
uniform vec2 uMisDir;
varying vec2 vL;
varying float vR;
varying float vA;
varying vec2 vDir;
float lineMask(vec2 p){
  float w = 0.03;
  float aa = fwidth(p.x) + fwidth(p.y) + 1e-4;
  // vòng tròn (mảnh, mờ) + mũi tên bán kính (đậm) + đầu mũi tên
  float ring = 1.0 - smoothstep(w * 0.5, w * 0.5 + aa, abs(length(p) - vR));
  float t = clamp(dot(p, vDir), 0.0, vR);
  float arm = 1.0 - smoothstep(w, w + aa, length(p - vDir * t));
  vec2 q = p - vDir * vR;
  float along = dot(q, vDir);
  float across = abs(dot(q, vec2(-vDir.y, vDir.x)));
  float headLen = min(0.16, vR * 0.45);
  float head = step(-headLen, along) * step(along, 0.0) * (1.0 - smoothstep(0.0, aa, across - (-along) * 0.45));
  return max(ring * 0.55, max(arm, head));
}
void main(){
  // mực in hai lớp lệch khuôn: lớp đỏ + lớp lam lệch theo uMisDir, nét mực tím than ở giữa
  vec2 o = uMisDir * uMis;
  float r = lineMask(vL + o);
  float g = lineMask(vL);
  float b = lineMask(vL - o);
  vec3 col = g > 0.5 ? vec3(0.1, 0.04, 0.16) : (r > b ? vec3(0.95, 0.16, 0.3) : vec3(0.08, 0.66, 0.95));
  float a = max(g, max(r, b) * 0.9) * vA * uAlpha;
  if (a < 0.02) discard;
  gl_FragColor = vec4(col, a);
}`;

const TRAIL_VERT = /* glsl */ `
attribute float aU;
varying float vU;
varying float vS;
attribute float aSide;
void main(){
  vU = aU;
  vS = aSide;
  gl_Position = projectionMatrix * modelViewMatrix * vec4(position, 1.0);
}`;
const TRAIL_FRAG = /* glsl */ `
uniform float uAlpha;
uniform float uHead;   // 1 = có ngọn bút sáng ở đầu
uniform float uMis;
uniform vec3 uCol;
varying float vU;
varying float vS;
float prof(float s){ return 1.0 - smoothstep(0.35, 1.0, abs(s)); }
void main(){
  // giấy cắt: viền giấy trắng (|s| < 1) bao lõi mực tím than (|s| < 0,45); lớp đỏ / lam của lõi lệch khuôn theo uMis
  float paper = 1.0 - smoothstep(0.82, 1.0, abs(vS));
  float r = 1.0 - smoothstep(0.38, 0.48, abs(vS + uMis));
  float g = 1.0 - smoothstep(0.38, 0.48, abs(vS));
  float b = 1.0 - smoothstep(0.38, 0.48, abs(vS - uMis));
  float fade = mix(1.0, smoothstep(0.0, 0.35, vU), uHead);
  float nib = uHead * smoothstep(0.96, 1.0, vU);
  vec3 col = vec3(1.0, 0.97, 0.9);
  col = mix(col, vec3(0.08, 0.66, 0.95), b * (1.0 - g));
  col = mix(col, vec3(0.95, 0.16, 0.3), r * (1.0 - g));
  col = mix(col, uCol, g);
  col = mix(col, vec3(3.0, 2.3, 1.1), nib);
  float a = paper * fade * uAlpha;
  if (a < 0.02) discard;
  gl_FragColor = vec4(col, a);
}`;

const JOINTS = new Float32Array((SIREN_EPI.n + 1) * 2);
const PTS = new Float32Array((SEG + 1) * 2);
const CAM_V = new THREE.Vector3();

/** chuỗi epicycle + dải đường viền, quay mặt về máy quay, đặt tại thân boss */
export function BossEpicycles() {
  const g = useRef<THREE.Group>(null);
  const lastK = useRef(-1);
  const rm = useMemo(() => reduceMotion(), []);
  const { chain, chainMat, aC, aA, trail, trailMat, tPos } = useMemo(() => {
    const geo = new THREE.InstancedBufferGeometry();
    const quad = new THREE.PlaneGeometry(2, 2);
    geo.index = quad.index;
    geo.setAttribute("position", quad.getAttribute("position"));
    const aC = new THREE.InstancedBufferAttribute(new Float32Array(MAXC * 4), 4).setUsage(THREE.DynamicDrawUsage);
    const aA = new THREE.InstancedBufferAttribute(new Float32Array(MAXC), 1).setUsage(THREE.DynamicDrawUsage);
    geo.setAttribute("aC", aC);
    geo.setAttribute("aA", aA);
    geo.instanceCount = MAXC;
    const chainMat = new THREE.ShaderMaterial({
      vertexShader: CHAIN_VERT,
      fragmentShader: CHAIN_FRAG,
      uniforms: { uAlpha: { value: 0 }, uMis: { value: 0 }, uMisDir: { value: new THREE.Vector2(1, 0) } },
      transparent: true,
      depthWrite: false,
      side: THREE.DoubleSide,
      toneMapped: false,
    });
    const chain = new THREE.Mesh(geo, chainMat);
    chain.frustumCulled = false;
    chain.renderOrder = 6;
    // dải: SEG + 1 điểm × 2 đỉnh (2 mép), chỉ số tĩnh
    const tg = new THREE.BufferGeometry();
    const tPos = new THREE.BufferAttribute(new Float32Array((SEG + 1) * 2 * 3), 3).setUsage(THREE.DynamicDrawUsage);
    const u = new Float32Array((SEG + 1) * 2);
    const side = new Float32Array((SEG + 1) * 2);
    const idx: number[] = [];
    for (let i = 0; i <= SEG; i++) {
      u[i * 2] = u[i * 2 + 1] = i / SEG;
      side[i * 2] = -1;
      side[i * 2 + 1] = 1;
      if (i < SEG) idx.push(i * 2, i * 2 + 1, i * 2 + 2, i * 2 + 1, i * 2 + 3, i * 2 + 2);
    }
    tg.setAttribute("position", tPos);
    tg.setAttribute("aU", new THREE.BufferAttribute(u, 1));
    tg.setAttribute("aSide", new THREE.BufferAttribute(side, 1));
    tg.setIndex(idx);
    const trailMat = new THREE.ShaderMaterial({
      vertexShader: TRAIL_VERT,
      fragmentShader: TRAIL_FRAG,
      uniforms: { uAlpha: { value: 0 }, uHead: { value: 1 }, uMis: { value: 0 }, uCol: { value: new THREE.Color(0.12, 0.05, 0.2) } },
      transparent: true,
      depthWrite: false,
      side: THREE.DoubleSide,
      toneMapped: false,
    });
    const trail = new THREE.Mesh(tg, trailMat);
    trail.frustumCulled = false;
    trail.renderOrder = 5;
    return { chain, chainMat, aC, aA, trail, trailMat, tPos };
  }, []);
  useEffect(
    () => () => {
      chain.geometry.dispose();
      chainMat.dispose();
      trail.geometry.dispose();
      trailMat.dispose();
    },
    [chain, chainMat, trail, trailMat],
  );
  useFrame(({ camera }) => {
    const grp = g.current;
    if (!grp) return;
    const L = BOSS_FX.look;
    // bóng ma đường viền khi đã phân rã (đọc số hoạ âm còn sống) — chiến đấu thường
    const ghost = L.chain === 0 && L.trail === 0 ? HARMONIC.decomposition * 0.35 : 0;
    const trailA = Math.max(L.trail, ghost) * L.shrink;
    const chainA = L.chain * L.shrink;
    grp.visible = trailA > 0.005 || chainA > 0.005;
    if (!grp.visible) return;
    // quay mặt về máy quay (trục đứng), đặt theo thân boss
    camera.getWorldPosition(CAM_V);
    // co về tâm hình (hệ số k = 0), không co về chân
    grp.position.set(0, BOSS_FX.y + SIREN_EPI.c0y * BOSS_SCALE * (1 - L.shrink), 0);
    grp.rotation.set(0, Math.atan2(CAM_V.x, CAM_V.z), 0);
    const sc = BOSS_SCALE * Math.max(0.001, L.shrink);
    grp.scale.setScalar(sc);
    const e = SIREN_EPI;
    const kMax = L.kMax;
    // tham số bút: xuất hiện = vẽ một lượt; BREAK / gục = quay liên tục; bóng ma = đứng yên, khép kín
    const head = L.draw < 1 || L.chain > 0.01 ? 1 : 0;
    const pen = head === 0 ? 0 : L.spin > 0 || L.draw >= 1 ? (HARMONIC.time * (L.spin || 0.3)) % 1 : L.draw;
    const span = L.draw >= 1 ? 1 : L.draw;
    const dis = Math.min(1, HARMONIC.dissonance + (L.spin > 0 ? 0.4 : 0));
    trailMat.uniforms.uAlpha.value = trailA;
    trailMat.uniforms.uHead.value = head;
    trailMat.uniforms.uMis.value = 0.12 + dis * 0.35;
    // vòng khép kín đứng yên (bóng ma / cuối lúc gục): chỉ dựng lại khi số bậc đổi đáng kể — không tốn CPU mỗi khung
    if (head === 0 && Math.abs(kMax - lastK.current) < 0.02) {
      chain.visible = false;
      return;
    }
    lastK.current = head === 0 ? kMax : -1;
    // ── dải: các điểm trên đường viền từ (pen − span) tới pen
    for (let i = 0; i <= SEG; i++) epicycleTip(e, pen - span * (1 - i / SEG), kMax, 1, PTS, i * 2);
    const arr = tPos.array as Float32Array;
    const hw = 0.085;
    for (let i = 0; i <= SEG; i++) {
      const i0 = Math.max(0, i - 1);
      const i1 = Math.min(SEG, i + 1);
      let tx = PTS[i1 * 2] - PTS[i0 * 2];
      let ty = PTS[i1 * 2 + 1] - PTS[i0 * 2 + 1];
      const l = Math.hypot(tx, ty) || 1;
      tx /= l;
      ty /= l;
      const x = PTS[i * 2];
      const y = PTS[i * 2 + 1];
      arr[i * 6] = x + ty * hw;
      arr[i * 6 + 1] = y - tx * hw;
      arr[i * 6 + 2] = 0;
      arr[i * 6 + 3] = x - ty * hw;
      arr[i * 6 + 4] = y + tx * hw;
      arr[i * 6 + 5] = 0.002;
    }
    tPos.needsUpdate = true;
    // ── chuỗi vectơ (MAXC số hạng đầu, to trước nhỏ sau)
    const n = epicycleJoints(e, pen, kMax, 1, JOINTS);
    const c = aC.array as Float32Array;
    const al = aA.array as Float32Array;
    for (let i = 0; i < MAXC; i++) {
      if (i + 1 >= n) {
        al[i] = 0;
        continue;
      }
      const x0 = JOINTS[i * 2];
      const y0 = JOINTS[i * 2 + 1];
      const dx = JOINTS[i * 2 + 2] - x0;
      const dy = JOINTS[i * 2 + 3] - y0;
      const r = Math.hypot(dx, dy);
      c[i * 4] = x0;
      c[i * 4 + 1] = y0;
      c[i * 4 + 2] = r;
      c[i * 4 + 3] = Math.atan2(dy, dx);
      al[i] = r < 0.004 ? 0 : termWeight(e.k[i], kMax) * (1 - (i / MAXC) * 0.6);
    }
    aC.needsUpdate = true;
    aA.needsUpdate = true;
    chainMat.uniforms.uAlpha.value = chainA;
    chainMat.uniforms.uMis.value = 0.006 + dis * 0.03;
    const q = rm ? 0.7 : HARMONIC.stopTime * 3.7;
    (chainMat.uniforms.uMisDir.value as THREE.Vector2).set(Math.cos(q), Math.sin(q));
    chain.visible = chainA > 0.005;
  });
  return (
    <group ref={g} name="perf:bossEpicycles">
      <primitive object={trail} />
      <primitive object={chain} />
    </group>
  );
}

// ───────────── Vệt ruy băng Lissajous ─────────────
const TR = 56;
const TR_DT = 24; // ms giữa 2 điểm vệt → vệt dài ~1,3 s quỹ đạo thật
const RIB_VERT = /* glsl */ `
attribute vec3 aPrev;
attribute float aSide;
attribute float aU;
attribute float aK;
uniform vec3 uCam;
varying float vU;
varying float vS;
varying float vK;
void main(){
  vec3 t = position - aPrev;
  if (dot(t, t) < 1e-8) t = vec3(1.0, 0.0, 0.0);
  vec3 vd = normalize(uCam - position);
  vec3 sd = cross(normalize(t), vd);
  float sl = length(sd);
  sd = sl > 1e-5 ? sd / sl : vec3(0.0, 1.0, 0.0);
  float w = 0.42 * (1.0 - aU * 0.85);
  vU = aU;
  vS = aSide;
  vK = aK;
  gl_Position = projectionMatrix * viewMatrix * vec4(position + sd * aSide * w, 1.0);
}`;
const RIB_FRAG = /* glsl */ `
uniform vec2 uOn;
uniform float uMis;
varying float vU;
varying float vS;
varying float vK;
float prof(float s){ return 1.0 - smoothstep(0.2, 1.0, abs(s)); }
void main(){
  float on = vK < 0.5 ? uOn.x : uOn.y;
  float fade = pow(1.0 - vU, 1.4) * on;
  vec3 base = vK < 0.5 ? vec3(1.6, 0.35, 0.9) : vec3(0.3, 1.2, 1.7);
  float r = prof(vS + uMis);
  float g = prof(vS);
  float b = prof(vS - uMis);
  // lõi sáng (HDR, nở bloom) + mép mực; lệch khuôn: lớp đỏ / lam lòi ra hai mép
  float core = 1.0 - smoothstep(0.0, 0.45, abs(vS));
  vec3 col = g > 0.5 ? mix(vec3(0.12, 0.05, 0.18), base * 1.8, core) : (r > b ? vec3(0.95, 0.16, 0.3) : vec3(0.08, 0.66, 0.95));
  float a = max(g, max(r, b) * 0.8) * fade;
  if (a < 0.02) discard;
  gl_FragColor = vec4(col, a);
}`;

/** 2 vệt ruy băng theo đúng quỹ đạo sao chổi Lissajous (lấy mẫu quá khứ bằng chính hàm lissajous của luật) */
export function CometRibbons({ boss }: { boss: React.RefObject<BossSim> }) {
  const { mesh, mat, pos, prev } = useMemo(() => {
    const n = 2 * TR * 2;
    const geo = new THREE.BufferGeometry();
    const pos = new THREE.BufferAttribute(new Float32Array(n * 3), 3).setUsage(THREE.DynamicDrawUsage);
    const prev = new THREE.BufferAttribute(new Float32Array(n * 3), 3).setUsage(THREE.DynamicDrawUsage);
    const side = new Float32Array(n);
    const u = new Float32Array(n);
    const kk = new Float32Array(n);
    const idx: number[] = [];
    for (let k = 0; k < 2; k++) {
      for (let j = 0; j < TR; j++) {
        const v = (k * TR + j) * 2;
        side[v] = -1;
        side[v + 1] = 1;
        u[v] = u[v + 1] = j / (TR - 1);
        kk[v] = kk[v + 1] = k;
        if (j < TR - 1) idx.push(v, v + 1, v + 2, v + 1, v + 3, v + 2);
      }
    }
    geo.setAttribute("position", pos);
    geo.setAttribute("aPrev", prev);
    geo.setAttribute("aSide", new THREE.BufferAttribute(side, 1));
    geo.setAttribute("aU", new THREE.BufferAttribute(u, 1));
    geo.setAttribute("aK", new THREE.BufferAttribute(kk, 1));
    geo.setIndex(idx);
    const mat = new THREE.ShaderMaterial({
      vertexShader: RIB_VERT,
      fragmentShader: RIB_FRAG,
      uniforms: { uCam: { value: new THREE.Vector3() }, uOn: { value: new THREE.Vector2() }, uMis: { value: 0 } },
      transparent: true,
      depthWrite: false,
      side: THREE.DoubleSide,
      toneMapped: false,
    });
    const mesh = new THREE.Mesh(geo, mat);
    mesh.frustumCulled = false;
    mesh.name = "perf:cometRibbons";
    return { mesh, mat, pos, prev };
  }, []);
  useEffect(
    () => () => {
      mesh.geometry.dispose();
      mat.dispose();
    },
    [mesh, mat],
  );
  const on = useRef<Spring[]>([sp(), sp()]);
  useFrame(({ camera }, rawDt) => {
    const b = boss.current;
    if (!b) return;
    const dt = Math.min(rawDt, 0.05);
    const now = Date.now();
    const s = now - b.atkAt - ATK.lissajous.tele;
    const live = b.atk === "lissajous" && s >= 0 && !b.deadAt;
    // tắt: lò xo tới hạn (mờ mượt khi đòn kết thúc — vệt đứng yên, không còn sát thương)
    springStep(on.current[0], live ? 1 : 0, 10, 1, dt);
    springStep(on.current[1], live ? 1 : 0, 10, 1, dt);
    const a0 = Math.max(0, on.current[0].x);
    mesh.visible = a0 > 0.01;
    if (!mesh.visible || !live) {
      (mat.uniforms.uOn.value as THREE.Vector2).set(a0, a0);
      return;
    }
    const P = pos.array as Float32Array;
    const Q = prev.array as Float32Array;
    for (let k = 0; k < 2; k++) {
      for (let j = 0; j < TR; j++) {
        const tj = Math.max(0, s - j * TR_DT);
        const c = lissajous(k as 0 | 1, tj);
        const y = (k === 1 ? 5.4 : 1.0) + Math.sin((now - j * TR_DT) / 150 + k) * 0.15;
        const v = (k * TR + j) * 2;
        for (let e = 0; e < 2; e++) {
          P[(v + e) * 3] = c.x;
          P[(v + e) * 3 + 1] = y;
          P[(v + e) * 3 + 2] = c.z;
        }
      }
      // điểm "trước" để lấy tiếp tuyến: điểm kề phía đầu (j − 1); j = 0 dùng điểm j = 1 đảo chiều
      for (let j = 0; j < TR; j++) {
        const v = (k * TR + j) * 2;
        const o = j === 0 ? (k * TR + 1) * 2 : (k * TR + j - 1) * 2;
        const sg = j === 0 ? -1 : 1;
        for (let e = 0; e < 2; e++) {
          const px = P[o * 3], py = P[o * 3 + 1], pz = P[o * 3 + 2];
          const cx = P[v * 3], cy = P[v * 3 + 1], cz = P[v * 3 + 2];
          Q[(v + e) * 3] = sg > 0 ? px : 2 * cx - px;
          Q[(v + e) * 3 + 1] = sg > 0 ? py : 2 * cy - py;
          Q[(v + e) * 3 + 2] = sg > 0 ? pz : 2 * cz - pz;
        }
      }
    }
    pos.needsUpdate = true;
    prev.needsUpdate = true;
    camera.getWorldPosition(mat.uniforms.uCam.value as THREE.Vector3);
    (mat.uniforms.uOn.value as THREE.Vector2).set(a0, Math.max(0, on.current[1].x));
    mat.uniforms.uMis.value = 0.12 + HARMONIC.dissonance * 0.4;
  });
  return <primitive object={mesh} />;
}

// ───────────── Báo trước Sóng dừng: tấm Chladni ─────────────
/**
 * Vật liệu đĩa sàn (circleGeometry bán kính ARENA_R, mặt XY xoay nằm): vùng NGUY HIỂM = STANDING_DANGER_EXPR (đúng luật);
 * phần trang trí Chladni chỉ đổi độ sáng TRONG vùng (không bao giờ làm vùng nguy hiểm trông như an toàn và ngược lại).
 */
export function createStandingMat(lam: number, rMax: number): THREE.ShaderMaterial {
  return new THREE.ShaderMaterial({
    uniforms: {
      uK: { value: 0 },
      uLam: { value: lam },
      uRMax: { value: rMax },
      uTime: { value: 0 },
      uMN: { value: new THREE.Vector2(2, 3) },
      uFlash: { value: 0 },
      uMis: { value: 0 },
      uDec: { value: 0 },
    },
    vertexShader: "varying vec2 vP; void main(){ vP = position.xy; gl_Position = projectionMatrix * modelViewMatrix * vec4(position,1.0); }",
    fragmentShader: /* glsl */ `
      uniform float uK; uniform float uLam; uniform float uRMax; uniform float uTime; uniform vec2 uMN;
      uniform float uFlash; uniform float uMis; uniform float uDec;
      varying vec2 vP;
      ${CHLADNI_GLSL}
      float h21(vec2 p){ return fract(sin(dot(p, vec2(12.9898, 78.233))) * 43758.5453); }
      bool dangerAt(float r){ return ${STANDING_DANGER_EXPR}; }
      void main(){
        float r = length(vP);
        bool dz = dangerAt(r);
        bool inArena = r >= 2.0 && r <= uRMax;
        if (!inArena) discard;
        float s = abs(sin(6.283185307179586 * r / uLam));
        // tấm Chladni (trang trí): đường nút của tấm vuông [−1,1]² co theo đấu trường; ít hoạ âm → mẫu đơn giản hơn
        vec2 q = vP / uRMax;
        float F = chladni(q, uMN.x, uMN.y);
        float aaF = fwidth(F) + 1e-4;
        float plate = 1.0 - smoothstep(0.0, 0.06 + aaF, abs(F));
        // hạt cát: lưới hạt nhảy theo 12 Hz (đồng hồ con rối) — vùng bụng sóng "sôi", vùng nút đứng yên
        vec2 cell = floor(vP * 16.0);
        float grain = h21(cell + floor(uTime * 12.0) * (dz ? 1.0 : 0.0));
        vec3 col;
        float a;
        if (dz) {
          // bụng sóng: tấm rung đỏ; vân Chladni là gân sẫm hơn (vẫn đỏ rõ — không giống vùng an toàn)
          col = mix(vec3(1.0, 0.23, 0.19) * (0.85 + 0.35 * grain), vec3(0.55, 0.05, 0.22), 0.6 * plate);
          a = 0.2 + 0.55 * uK;
          col *= 1.0 + uK + uFlash * 1.5;
          // lệch lớp mực ở mép dải (đỏ ra ngoài, lam vào trong) — chỉ là viền màu, không dời vùng
          float rp = r + uMis, rn = r - uMis;
          col.r += (dangerAt(rp) ? 0.0 : 0.9) * step(0.001, uMis);
          col.b += (dangerAt(rn) ? 0.0 : 1.2) * step(0.001, uMis);
        } else {
          // nút sóng (AN TOÀN): cát tụ lại thành vân sáng — dày nhất ở đúng nút (s → 0)
          float sand = 1.0 - smoothstep(0.0, 0.5, s);
          float dots = step(0.55 - 0.35 * sand, grain);
          col = mix(vec3(0.98, 0.9, 0.66), vec3(0.4, 1.0, 0.85), step(s, 0.12));
          a = (0.14 + 0.3 * uK) * (0.35 + 0.65 * dots) * (0.5 + 0.5 * sand) + 0.35 * step(s, 0.12) * (0.5 + 0.5 * uK);
          col *= 1.0 + 0.6 * uK + uFlash * 0.6;
        }
        // phân rã: rút màu
        float l = dot(col, vec3(0.3, 0.59, 0.11));
        col = mix(col, vec3(l), uDec * 0.6);
        gl_FragColor = vec4(col, a);
      }`,
    transparent: true,
    depthWrite: false,
    toneMapped: false,
  });
}

/** tham số Chladni (m, n) cho lần Sóng dừng thứ `n` — ít hoạ âm còn sống → mẫu đơn giản hơn */
const MODES: [number, number][] = [
  [1, 2],
  [2, 3],
  [3, 5],
  [2, 5],
  [1, 4],
  [3, 4],
];
export function standingMode(atkAt: number, harmonics: number, out: THREE.Vector2) {
  const i = Math.abs(Math.floor(atkAt / 997)) % MODES.length;
  const [m, n] = MODES[i];
  const k = harmonics <= 2 ? 0.5 : harmonics <= 4 ? 0.75 : 1;
  const mm = Math.max(1, Math.round(m * k));
  // m = n → F ≡ 0 (cả tấm là nút) — luôn giữ n > m
  out.set(mm, Math.max(mm + 1, Math.round(n * k)));
}

useGLTF.preload(SIREN_GLB);
