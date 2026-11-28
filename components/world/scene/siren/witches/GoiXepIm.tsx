"use client";
/**
 * Phù thuỷ hoạ âm #2 — GỐI XẾP IM (sóng dừng, cú lộ dạng ngang). Logic thuần: lib/world/witchGoiXepIm.ts (+ test).
 * Thiết kế: docs/ai-reviews/siren-witch/WITCHES_CODEX.md §2. Tranh Codex: public/world/siren/witches/goixepim.webp
 * (nguồn blender-src/siren-src/witches/goixepim/, xử lý scripts/siren-witch-goixepim.py).
 *
 * Gắn được ở BẤT KỲ đấu trường: <GoiXepIm origin={{x, y, z}} radius={r} yaw={ψ} /> (khu "Sa Mạc Tấm Đồng" gắn ở tâm khu).
 * Hệ toạ độ cục bộ (xoay yaw quanh trục đứng): vách nằm dọc trục x ở z = −D/2 (u = x + L/2 ∈ [0, L]), dải sàn bị đập ở
 * phía +z (v = z + D/2 ∈ [0, D]); người chơi vào từ phía +z.
 *
 * 3 lệnh vẽ cho cả phù thuỷ + sứ giả + báo đòn (+ pool StrikeFx / Puffs dùng chung):
 *  1. CON RỐI GIẤY (InstancedMesh quad, alpha-test, 1 atlas): gối, mắt chỉ thêu (flipbook 8 Hz), hông gối, hai Kẹp Biên Vải
 *     (thân + hai hàm mở / cắn theo nhịp đòn), ba Suốt Chỉ Lặng (leo lên đường may ở NÚT — đứng yên dù vách rung), túi vải ở
 *     bụng sóng (phập phồng theo biên độ), tua chỉ (flipbook 12 Hz), dải vải mẫu ở cửa (n = 2, Suốt may ở nút giữa);
 *  2. VÁCH VẢI (lưới 160 × 12, vertex shader uốn theo TILT_EXPR — CÙNG chuỗi với luật): mở ngang từ gối xếp (ly gấp sâu,
 *     ép ngang) → vách dài L; đường may ở nút may dần từ dưới lên theo số đòn ghim; bung chỉ khi đổi mode;
 *  3. SÀN BÁO ĐÒN (DANGER_EXPR — CÙNG chuỗi với luật): vùng hiểm vân gạch chéo + viền răng cưa, dải nút viền liền,
 *     sợi chỉ quất, thước 1 m + khung dải khi dự đoán. Alpha-test (discard), không blend.
 * Không cấp phát trong useFrame; đọc HARMONIC (dáng 12 Hz, mặt 8 Hz, dao động hình); lò xo springStep; giảm chuyển động.
 */
import { Suspense, useEffect, useMemo, useRef, useState } from "react";
import { useFrame } from "@react-three/fiber";
import { useTexture } from "@react-three/drei";
import * as THREE from "three";
import { createRoot, type Root } from "react-dom/client";
import { worldAsset } from "@/lib/world/avatars";
import { HARMONIC, springStep, type Spring } from "@/lib/world/harmonicState";
import { GX_ATLAS, GX_CELL, GX_RECTS } from "@/lib/world/witchGoiXepImAtlas";
import {
  ATK_BEATS,
  BEAT,
  DANGER_EXPR,
  EV,
  GXI,
  TILT_EXPR,
  gxiPhase,
  gxiHudOn,
  gxiWallLength,
  gxiText,
  gxiVisual,
  hitGxi,
  modeN,
  newGxi,
  newVisual,
  reach,
  tickGxi,
  wallTilt,
  type GxiSim,
  type GxiTextKey,
} from "@/lib/world/witchGoiXepIm";
import { useWorld } from "../../../store";
import { enemies, playerHurt, spawnEnemy, type Enemy } from "../../../combat/combat";
import { rollDrops } from "../../../combat/items";
import { strike } from "../../../fx/StrikeFx";
import { PUFF, emitDustRing } from "../../../fx/Puffs";
import { emitHit } from "../../../fx/Sparks";
import { fxNow, fxReducedMotion } from "../../../fx/fxClock";
import { floatText } from "../../../ui/Labels";
import { questEvent, unlockNote } from "../../../story/quest";
import { synth } from "../sirenSynth";
import { useWitchUi } from "./witchUi";
import { WitchHud } from "./WitchHud";

export interface WitchArenaProps {
  /** tâm đấu trường (mặt sàn ở y) */
  origin: { x: number; y: number; z: number };
  /** bán kính đấu trường (m) — vách dài min(12, ~1,8·(r − 1,4)) */
  radius: number;
  /** hướng (rad): vách quay lưng về −z cục bộ; 0 = người chơi vào từ +z thế giới */
  yaw?: number;
  /** hạt giống (nhiều người chơi: cùng seed + cùng mốc → cùng chuỗi đòn) */
  seed?: number;
  /** gọi một lần khi phù thuỷ ngủ say (thắng) */
  onDefeat?: () => void;
  /** vách vải dựng / hạ (khu chứa dùng để bật va chạm vách — chỉ gọi khi đổi) */
  onWall?: (up: boolean) => void;
}

export function GoiXepIm(props: WitchArenaProps) {
  return (
    <Suspense fallback={null}>
      <GoiXepImInner {...props} />
    </Suspense>
  );
}

// ───────────── Shader ─────────────

const FOG_FRAG = /* glsl */ `
uniform vec3 fogColor;
uniform float fogNear;
uniform float fogFar;
varying float vFogDepth;
vec3 applyFog(vec3 c){ return mix(c, fogColor, smoothstep(fogNear, fogFar * 1.3, vFogDepth) * 0.9); }`;

const PUP_VERT = /* glsl */ `
attribute vec4 aRect;
attribute vec4 aTint;
varying vec2 vUv;
varying vec4 vTint;
varying float vFogDepth;
void main(){
  vUv = mix(aRect.xy, aRect.zw, uv);
  vTint = aTint;
  vec4 mv = viewMatrix * modelMatrix * instanceMatrix * vec4(position, 1.0);
  vFogDepth = -mv.z;
  gl_Position = projectionMatrix * mv;
}`;
const PUP_FRAG = /* glsl */ `
uniform sampler2D uMap;
uniform float uFlash;
varying vec2 vUv;
varying vec4 vTint;
${FOG_FRAG}
void main(){
  vec4 t = texture2D(uMap, vUv);
  if (t.a < 0.5) discard;
  vec3 c = t.rgb * vTint.rgb;
  c += vec3(1.0, 0.85, 0.6) * uFlash * vTint.a;
  gl_FragColor = vec4(applyFog(c), 1.0);
}`;

const WALL_VERT = /* glsl */ `
uniform float uL, uN, uS, uK, uAmp, uOsc, uPull, uSlam;
uniform float uXs, uH, uPleat, uPleatW, uZw, uTime, uShiver;
varying vec2 vUv;
varying float vShade;
varying float vFogDepth;
void main(){
  float u = uv.x * uL;
  float s = uv.y;
  // CÙNG chuỗi với luật (lib/world/witchGoiXepIm.ts TILT_EXPR): đỉnh lúc đập = mép vùng hiểm
  float tilt = clamp(${TILT_EXPR}, -0.9, 1.0);
  vec2 T = vec2(uH * tilt, uH * sqrt(1.0 - tilt * tilt));
  vec2 C = vec2(0.0, uH * 0.6);
  vec2 P = 2.0 * s * (1.0 - s) * C + s * s * T;
  // ly gấp (sóng tam giác) — sâu khi còn xếp, nông khi mở hết
  float pf = u / uPleatW;
  float tri = abs(fract(pf) - 0.5) * 4.0 - 1.0;
  vShade = step(0.5, fract(pf));
  P.x += tri * uPleat * (0.35 + 0.65 * s) + uShiver * sin(uTime * 41.0 + u * 7.0) * s;
  vec3 pos = vec3((u - 0.5 * uL) * uXs, P.y, uZw + P.x);
  vUv = vec2(u, s);
  vec4 mv = viewMatrix * modelMatrix * vec4(pos, 1.0);
  vFogDepth = -mv.z;
  gl_Position = projectionMatrix * mv;
}`;
const WALL_FRAG = /* glsl */ `
uniform sampler2D uMap;
uniform vec4 uPanel;
uniform vec4 uSeam;
uniform float uL, uH, uTileW, uSeamN, uSeamA, uHit, uHitU;
uniform vec3 uPins;
varying vec2 vUv;
varying float vShade;
${FOG_FRAG}
float hash(vec2 p){ return fract(sin(dot(p, vec2(127.1, 311.7))) * 43758.5453); }
void main(){
  float u = vUv.x;
  float s = vUv.y;
  float tu = fract(u / uTileW);
  vec4 t = texture2D(uMap, vec2(mix(uPanel.x, uPanel.z, mix(0.05, 0.95, tu)), mix(uPanel.y, uPanel.w, mix(0.015, 0.985, s))));
  if (t.a < 0.5) discard;
  vec3 c = t.rgb * mix(0.8, 1.05, vShade);
  // nút (đứng yên): vạch khâu chấm luôn có; đã ghim → dải đường may thật, may dần từ chân lên theo tiến độ
  for (int k = 1; k < 4; k++) {
    float fk = float(k);
    if (fk < uSeamN - 0.5) {
      float d = u - fk * uL / uSeamN;
      float pin = k == 1 ? uPins.x : (k == 2 ? uPins.y : uPins.z);
      float bung = hash(vec2(floor(s * 46.0), fk * 3.1));
      if (abs(d) < 0.19 && s < pin && bung < uSeamA) {
        vec4 sc = texture2D(uMap, vec2(mix(uSeam.x, uSeam.z, d / 0.38 + 0.5), mix(uSeam.y, uSeam.w, fract(s * uH / 1.4))));
        if (sc.a > 0.5) c = sc.rgb;
      } else if (abs(d) < 0.03 && fract(s * uH / 0.17) < 0.55 && bung < uSeamA) {
        c = vec3(0.19, 0.15, 0.235);
      }
    }
  }
  // chỗ vừa ghim loé sáng
  c += vec3(1.0, 0.82, 0.55) * uHit * smoothstep(0.8, 0.0, abs(u - uHitU));
  gl_FragColor = vec4(applyFog(c), 1.0);
}`;

const FLOOR_VERT = /* glsl */ `
uniform float uL, uZw;
varying vec2 vUV;
varying float vFogDepth;
void main(){
  vUV = vec2(position.x + 0.5 * uL, position.z - uZw);
  vec4 mv = viewMatrix * modelMatrix * vec4(position, 1.0);
  vFogDepth = -mv.z;
  gl_Position = projectionMatrix * mv;
}`;
const FLOOR_FRAG = /* glsl */ `
uniform float uL, uD, uN, uS, uK, uVc, uHw, uAw, uAtk;
uniform float uTele, uCommit, uPreview, uPredict, uWhip, uWhipOsc, uCalm, uTime;
varying vec2 vUV;
${FOG_FRAG}
// CÙNG chuỗi với luật (lib/world/witchGoiXepIm.ts DANGER_EXPR) — tập an toàn vẽ ra == tập an toàn của luật (test)
bool danger(float u, float v){ return ${DANGER_EXPR}; }
bool rim(float u, float v, bool d, float e){
  return danger(u + e, v) != d || danger(u - e, v) != d || danger(u, v + e) != d || danger(u, v - e) != d;
}
float hash(vec2 p){ return fract(sin(dot(p, vec2(127.1, 311.7))) * 43758.5453); }
void main(){
  float u = vUV.x;
  float v = vUV.y;
  vec3 INK = vec3(0.19, 0.15, 0.235);
  vec3 ROSE = vec3(0.85, 0.42, 0.55);
  vec3 SLATE = vec3(0.4, 0.48, 0.51);
  vec3 CREAM = vec3(0.96, 0.85, 0.76);
  vec3 col = vec3(0.0);
  float draw = 0.0;
  float vis = max(uTele, uPreview);
  if (vis > 0.01) {
    bool d = danger(u, v);
    if (d) {
      // răng cưa: bề dày viền mực đổi theo sóng răng cưa dọc mép → mép hiểm lởm chởm, chỉ vẽ BÊN TRONG vùng hiểm
      float saw = 0.05 + 0.2 * fract((u + v) / 0.34);
      bool edge = rim(u, v, d, saw);
      if (uTele > 0.01) {
        float h = fract((u + v) / 0.46);
        if (hash(floor(vec2(u, v) * 5.0)) < uTele) {
          if (edge) { col = mix(INK, vec3(1.0, 0.95, 0.9), uCommit * (1.0 - uCalm) * 0.85); draw = 1.0; }
          else if (h < 0.42) { col = mix(ROSE, vec3(1.0, 0.55, 0.62), uCommit * (1.0 - uCalm)); draw = 1.0; }
          else if (h < 0.5) { col = INK; draw = 1.0; }
        }
      } else if (edge && fract((u - v) / 0.5) < 0.55) { col = ROSE; draw = 1.0; }
    } else if (u >= 0.0 && u <= uL && rim(u, v, d, 0.07)) {
      // vùng trú: viền LIỀN
      col = vis > 0.5 ? SLATE : mix(SLATE, CREAM, 0.4);
      draw = 1.0;
    } else if (uAtk < 0.5 && u > 0.0 && u < uL && v > 0.0 && v < uD && uTele > 0.01) {
      // giữa dải nút: đường khâu chấm (nút = đường may đứng yên)
      float kn = u * uN / uL;
      float dn = abs(kn - floor(kn + 0.5)) * uL / uN;
      if (dn < 0.035 && fract(v / 0.3) < 0.5) { col = SLATE; draw = 1.0; }
    }
  }
  // sợi chỉ quất: z = VC + AW·sin(nπu/L)·rung — vùng nó quét qua đúng bằng bao hiểm (luật)
  if (uWhip > 0.01 && u >= 0.0 && u <= uL) {
    float tv = uVc + uAw * sin(3.141592653589793 * uN * u / uL) * uWhipOsc;
    float dv = abs(v - tv);
    // chỉ vàng lõi + viền mực — nổi trên vân gạch
    if (dv < 0.06 * (0.5 + uWhip)) { col = vec3(1.0, 0.86, 0.45); draw = 1.0; }
    else if (dv < 0.13 * (0.5 + 0.5 * uWhip)) { col = INK; draw = 1.0; }
  }
  // lượt dự đoán: khung dải (nét đứt) + thước 1 m ở mép phía người chơi + hai đầu kẹp cố định — KHÔNG lộ nút mới
  if (uPredict > 0.5) {
    bool inU = u >= 0.0 && u <= uL;
    bool frameV = inU && (abs(v - uD) < 0.06 || abs(v) < 0.06) && fract(u / 0.5) < 0.6;
    bool frameU = v >= -0.3 && v <= uD + 0.6 && (abs(u) < 0.12 || abs(u - uL) < 0.12);
    float tick = abs(fract(u + 0.5) - 0.5);
    bool ruler = inU && v > uD && v < uD + (abs(u - floor(u + 0.5)) < 0.01 ? 0.5 : 0.28) && tick < 0.025;
    if (frameU) { col = SLATE; draw = 1.0; }
    else if (frameV || ruler) { col = INK; draw = 1.0; }
  }
  if (draw < 0.5) discard;
  gl_FragColor = vec4(applyFog(col), 1.0);
}`;

// ───────────── Ghi ma trận quad (mức module — không tạo closure mỗi khung) ─────────────

/** ngữ cảnh khung hiện tại cho các hàm ghi quad (đặt đầu puppets(), dùng đồng bộ) */
const Q: { M: Float32Array<ArrayBufferLike>; R: Float32Array<ArrayBufferLike>; dirty: boolean; L: number; zW: number; xs: number; hgt: number; n: number; amp: number; osc: number; pull: number; slam: number } = { M: new Float32Array(16), R: new Float32Array(4), dirty: false, L: 12, zW: -2.5, xs: 1, hgt: 5, n: 2, amp: 0, osc: 0, pull: 0, slam: 0 };
const TUFT = [GX_CELL.thread0, GX_CELL.thread0, GX_CELL.thread1, GX_CELL.thread1, GX_CELL.thread0, GX_CELL.thread0, GX_CELL.thread2, GX_CELL.thread2] as const;

function setRect(i: number, cell: number) {
  const r = GX_RECTS[cell];
  const R = Q.R;
  if (R[i * 4] !== r[0] || R[i * 4 + 1] !== r[1]) {
    R[i * 4] = r[0];
    R[i * 4 + 1] = r[1];
    R[i * 4 + 2] = r[2];
    R[i * 4 + 3] = r[3];
    Q.dirty = true;
  }
}
function hide(i: number) {
  Q.M.fill(0, i * 16, i * 16 + 16);
}
/** quad trong mặt phẳng đứng hướng +z cục bộ: tâm (x, y, z), góc a, rộng w (âm = lật), cao h (âm = lật dọc) */
function flat(i: number, x: number, y: number, z: number, a: number, wd: number, ht: number) {
  const M = Q.M;
  const c = Math.cos(a);
  const sn = Math.sin(a);
  const o = i * 16;
  M[o] = wd * c;
  M[o + 1] = wd * sn;
  M[o + 2] = 0;
  M[o + 3] = 0;
  M[o + 4] = -ht * sn;
  M[o + 5] = ht * c;
  M[o + 6] = 0;
  M[o + 7] = 0;
  M[o + 8] = 0;
  M[o + 9] = 0;
  M[o + 10] = 1;
  M[o + 11] = 0;
  M[o + 12] = x;
  M[o + 13] = y;
  M[o + 14] = z;
  M[o + 15] = 1;
}
/** quad nằm sàn (bóng đổ): rộng w theo x, sâu d theo z */
function ground(i: number, x: number, z: number, wd: number, d: number) {
  flat(i, x, 0.02, z, 0, wd, 1);
  const M = Q.M;
  const o = i * 16;
  M[o + 4] = 0;
  M[o + 5] = 0;
  M[o + 6] = -d;
  M[o + 9] = 1;
  M[o + 10] = 0;
}
/** quad dán lên mặt vách tại (u, phân số chiều cao q): theo tiếp tuyến đường cong Bezier của cột vải (CÙNG wallTilt với shader) */
function onWall(i: number, u: number, q: number, wd: number, ht: number, lift = 0.06) {
  const M = Q.M;
  const hgt = Q.hgt;
  const tilt = Math.max(-0.9, Math.min(1, wallTilt(u, Q.n, Q.amp, Q.osc, Q.pull, Q.slam, Q.L)));
  const Tv = hgt * tilt;
  const Ty = hgt * Math.sqrt(1 - tilt * tilt);
  const Cy = hgt * 0.6;
  const pv = q * q * Tv;
  const py = 2 * q * (1 - q) * Cy + q * q * Ty;
  // đạo hàm theo q
  let dv = 2 * q * Tv;
  let dy = 2 * (1 - 2 * q) * Cy + 2 * q * Ty;
  const l = Math.hypot(dv, dy) || 1;
  dv /= l;
  dy /= l;
  const o = i * 16;
  M[o] = wd;
  M[o + 1] = 0;
  M[o + 2] = 0;
  M[o + 3] = 0;
  M[o + 4] = 0;
  M[o + 5] = ht * dy;
  M[o + 6] = ht * dv;
  M[o + 7] = 0;
  // pháp tuyến = X × Y (hướng ra trước vách)
  M[o + 8] = 0;
  M[o + 9] = -dv;
  M[o + 10] = dy;
  M[o + 11] = 0;
  M[o + 12] = (u - Q.L / 2) * Q.xs;
  M[o + 13] = py - dv * lift;
  M[o + 14] = Q.zW + pv + dy * lift;
  M[o + 15] = 1;
}

// ───────────── Bố cục con rối (chỉ số instance) ─────────────

const S = {
  pillow: 0,
  gussetL: 1,
  gussetR: 2,
  eyeL: 3,
  eyeR: 4,
  tuftL: 5,
  tuftR: 6,
  pillowShadow: 7,
  /** kẹp c: thân 8 + 4c, hàm trên 9 + 4c, hàm dưới 10 + 4c, bóng 11 + 4c */
  clamp: 8,
  /** suốt j: thân 16 + 2j, chỉ 17 + 2j */
  spool: 16,
  pouch: 22,
  wallTuft: 26,
  demo: 30,
  demoSpool: 38,
  demoThread: 39,
  N: 40,
} as const;
const DEMO_N = 8;

const aspect = (cell: number) => {
  const r = GX_RECTS[cell];
  return (r[2] - r[0]) / Math.max(1e-6, r[3] - r[1]);
};

/** trạng thái động (cấp phát một lần cho mỗi lần gắn) */
function makeState(seed: number, L: number) {
  return {
    sim: newGxi(seed, L) as GxiSim,
    V: newVisual(),
    t0: 0,
    unfold: { x: 0, v: 0 } as Spring,
    rise: { x: 0, v: 0 } as Spring,
    slam: { x: 0, v: 0 } as Spring,
    pull: { x: 0, v: 0 } as Spring,
    jaw: { x: 0, v: 0 } as Spring,
    lean: { x: 0, v: 0 } as Spring,
    spoolU: [0, 0, 0].map(() => ({ x: L / 2, v: 0 }) as Spring),
    spoolH: [0, 0, 0].map(() => ({ x: 0.2, v: 0 }) as Spring),
    seamA: { x: 0, v: 0 } as Spring,
    flash: 0,
    hitU: 0,
    hit: 0,
    farSince: -1,
    uiAt: 0,
    infoAt: 0,
    rewarded: false,
    lastBar: -1,
    e: null as Enemy | null,
    calm: false,
    /** toạ độ cục bộ người chơi (cập nhật mỗi khung, đọc khi trúng đòn) */
    pu: 0,
    pv: 0,
  };
}
type St = ReturnType<typeof makeState>;

const TMP = new THREE.Vector3();
const TMP2 = new THREE.Vector3();

function GoiXepImInner({ origin, radius, yaw = 0, seed = 1, onDefeat, onWall: onWallUp }: WitchArenaProps) {
  const tex = useTexture(worldAsset(GX_ATLAS));
  const L = gxiWallLength(radius);
  const zW = -GXI.D / 2;
  const [S0m] = useState(() => makeState(seed, L));
  const st = useRef<St>(S0m);
  const defeatRef = useRef(onDefeat);
  const wallRef = useRef(onWallUp);
  const wallUp = useRef(false);
  useEffect(() => {
    defeatRef.current = onDefeat;
    wallRef.current = onWallUp;
  }, [onDefeat, onWallUp]);
  useEffect(
    () => () => {
      if (wallUp.current) wallRef.current?.(false);
    },
    [],
  );

  const parts = useMemo(() => {
    tex.colorSpace = THREE.SRGBColorSpace;
    tex.anisotropy = 4;
    // 1) con rối giấy
    const geo = new THREE.PlaneGeometry(1, 1);
    const rect = new Float32Array(S.N * 4);
    const tint = new Float32Array(S.N * 4);
    const setCell = (i: number, cell: number) => rect.set(GX_RECTS[cell], i * 4);
    const setTint = (i: number, r: number, g: number, b: number, flash = 0) => tint.set([r, g, b, flash], i * 4);
    for (let i = 0; i < S.N; i++) setTint(i, 1, 1, 1, 0);
    setCell(S.pillow, GX_CELL.pillowfront);
    setCell(S.gussetL, GX_CELL.gusset);
    setCell(S.gussetR, GX_CELL.gusset);
    setCell(S.eyeL, GX_CELL.eyeopen);
    setCell(S.eyeR, GX_CELL.eyeopen);
    setCell(S.tuftL, GX_CELL.thread0);
    setCell(S.tuftR, GX_CELL.thread1);
    setCell(S.pillowShadow, GX_CELL.shadow);
    setTint(S.pillowShadow, 0.19, 0.12, 0.24);
    for (let c = 0; c < 2; c++) {
      setCell(S.clamp + 4 * c, GX_CELL.endclamp);
      setCell(S.clamp + 4 * c + 1, GX_CELL.clamplingjaw);
      setCell(S.clamp + 4 * c + 2, GX_CELL.clamplingjaw);
      setCell(S.clamp + 4 * c + 3, GX_CELL.shadow);
      setTint(S.clamp + 4 * c + 3, 0.19, 0.12, 0.24);
      setTint(S.clamp + 4 * c + 1, 1, 1, 1, 1);
      setTint(S.clamp + 4 * c + 2, 1, 1, 1, 1);
    }
    for (let j = 0; j < 3; j++) {
      setCell(S.spool + 2 * j, GX_CELL.spoolbody);
      setCell(S.spool + 2 * j + 1, GX_CELL.spoolthread);
    }
    for (let k = 0; k < 4; k++) {
      setCell(S.pouch + k, GX_CELL.pouch);
      setTint(S.pouch + k, 1, 1, 1, 1);
      setCell(S.wallTuft + k, GX_CELL.thread0);
    }
    for (let k = 0; k < DEMO_N; k++) setCell(S.demo + k, GX_CELL.pleatpanel);
    setCell(S.demoSpool, GX_CELL.spoolbody);
    setCell(S.demoThread, GX_CELL.spoolthread);
    geo.setAttribute("aRect", new THREE.InstancedBufferAttribute(rect, 4).setUsage(THREE.DynamicDrawUsage));
    geo.setAttribute("aTint", new THREE.InstancedBufferAttribute(tint, 4));
    const fogU = () => THREE.UniformsUtils.clone(THREE.UniformsLib.fog);
    const pupMat = new THREE.ShaderMaterial({ vertexShader: PUP_VERT, fragmentShader: PUP_FRAG, side: THREE.DoubleSide, fog: true, uniforms: { ...fogU(), uMap: { value: tex }, uFlash: { value: 0 } } });
    const pup = new THREE.InstancedMesh(geo, pupMat, S.N);
    pup.instanceMatrix.setUsage(THREE.DynamicDrawUsage);
    pup.frustumCulled = false;
    pup.name = "perf:witch-puppets";
    (pup.instanceMatrix.array as Float32Array).fill(0);

    // 2) vách vải
    const wgeo = new THREE.PlaneGeometry(1, 1, 160, 12);
    const wallMat = new THREE.ShaderMaterial({
      vertexShader: WALL_VERT,
      fragmentShader: WALL_FRAG,
      side: THREE.DoubleSide,
      fog: true,
      uniforms: {
        ...fogU(),
        uMap: { value: tex },
        uPanel: { value: new THREE.Vector4(...GX_RECTS[GX_CELL.pleatpanel]) },
        uSeam: { value: new THREE.Vector4(...GX_RECTS[GX_CELL.seamstrip]) },
        uL: { value: L },
        uN: { value: 2 },
        uS: { value: GXI.S },
        uK: { value: GXI.K },
        uAmp: { value: 0 },
        uOsc: { value: 1 },
        uPull: { value: 0 },
        uSlam: { value: 0 },
        uXs: { value: 1 },
        uH: { value: GXI.D },
        uPleat: { value: 0.1 },
        uPleatW: { value: 0.46 },
        uTileW: { value: GXI.D / 2.2 },
        uZw: { value: zW },
        uTime: { value: 0 },
        uShiver: { value: 0 },
        uSeamN: { value: 2 },
        uSeamA: { value: 0 },
        uPins: { value: new THREE.Vector3() },
        uHit: { value: 0 },
        uHitU: { value: 0 },
      },
    });
    const wall = new THREE.Mesh(wgeo, wallMat);
    wall.frustumCulled = false;
    wall.name = "perf:witch-wall";

    // 3) sàn báo đòn (phẳng trong hệ cục bộ — vUV lấy thẳng từ position)
    const fgeo = new THREE.PlaneGeometry(L + 2, GXI.D + 2.2, 1, 1);
    fgeo.rotateX(-Math.PI / 2);
    fgeo.translate(0, 0, zW + GXI.D / 2 + 0.5);
    const floorMat = new THREE.ShaderMaterial({
      vertexShader: FLOOR_VERT,
      fragmentShader: FLOOR_FRAG,
      fog: true,
      polygonOffset: true,
      polygonOffsetFactor: -2,
      polygonOffsetUnits: -2,
      uniforms: {
        ...fogU(),
        uL: { value: L },
        uD: { value: GXI.D },
        uN: { value: 2 },
        uS: { value: GXI.S },
        uK: { value: GXI.K },
        uVc: { value: GXI.VC },
        uHw: { value: GXI.HW },
        uAw: { value: GXI.AW },
        uAtk: { value: 0 },
        uZw: { value: zW },
        uTele: { value: 0 },
        uCommit: { value: 0 },
        uPreview: { value: 0 },
        uPredict: { value: 0 },
        uWhip: { value: 0 },
        uWhipOsc: { value: 0 },
        uCalm: { value: 0 },
        uTime: { value: 0 },
      },
    });
    const floor = new THREE.Mesh(fgeo, floorMat);
    floor.position.y = 0.035;
    floor.frustumCulled = false;
    floor.name = "perf:witch-floor";
    return { pup, pupMat, wall, wallMat, floor, floorMat, rect: geo.getAttribute("aRect") as THREE.InstancedBufferAttribute };
  }, [tex, L, zW]);
  useEffect(
    () => () => {
      parts.pup.geometry.dispose();
      parts.pupMat.dispose();
      parts.wall.geometry.dispose();
      parts.wallMat.dispose();
      parts.floor.geometry.dispose();
      parts.floorMat.dispose();
    },
    [parts],
  );

  const group = useRef<THREE.Group>(null);
  const cos = Math.cos(yaw);
  const sin = Math.sin(yaw);
  /** cục bộ → thế giới (x, z) */
  const toWorld = (lx: number, lz: number, out: THREE.Vector3, ly = 0) => out.set(origin.x + lx * cos + lz * sin, origin.y + ly, origin.z - lx * sin + lz * cos);

  // HUD (ngoài Canvas): gốc React riêng trong .w-root
  useEffect(() => {
    const host = document.querySelector(".w-root");
    if (!host) return;
    const el = document.createElement("div");
    el.className = "w-hud";
    host.appendChild(el);
    const root: Root = createRoot(el);
    root.render(<WitchHud />);
    // HUD chỉ hiện khi tới gần / đã giao chiến (gxiHudOn) — vòng khung bật lên
    useWitchUi.setState({ on: false, stage: "dormant", L, hp: 1, maxHp: 1 });
    return () => {
      useWitchUi.setState({ on: false });
      // gỡ sau lượt render hiện tại (tránh cảnh báo unmount đồng bộ)
      setTimeout(() => {
        root.unmount();
        el.remove();
      }, 0);
    };
  }, [L]);

  // mục tiêu chiến đấu: một Enemy "node" do module ngoài lái (ext.boss → không qua bossHandler của Siren)
  useEffect(() => {
    const S0 = st.current;
    S0.t0 = fxNow() / 1000;
    const e = spawnEnemy("node", toWorld(0, zW + 0.4, TMP, 0.4));
    // home rất xa: vòng đồng bộ "nút giao thoa" của Siren.tsx (chỉ đụng node có home trong đấu trường giữa) bỏ qua
    e.home.set(1e4, -1e4, 1e4);
    e.ext = { boss: (en, amount) => onHit(S0, en, amount) };
    S0.e = e;
    if (process.env.NODE_ENV !== "production") (window as unknown as { __gxi: unknown }).__gxi = {
        st: S0,
        L,
        force: (stage: string, atk?: string) => devForce(S0, stage, atk),
        // đặt người chơi ở (u dọc vách, v trước chân vách), quay mặt về vách
        tp: (u: number, v: number) => {
          const w = useWorld.getState();
          toWorld(u - L / 2, zW + v, w.player, 0);
          useWorld.setState({ playerYaw: yaw + Math.PI, camYaw: yaw, camPitch: 0.62, camDist: 7.5 });
          return 1;
        },
      };
    return () => {
      const i = enemies.indexOf(e);
      if (i >= 0) enemies.splice(i, 1);
      S0.e = null;
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  /** DEV: nhảy tới một giai đoạn để xem / chụp (window.__gxi.force("fight", "whip") …) — không dùng trong luồng chơi */
  function devForce(S0: St, stage: string, atk?: string) {
    const t = fxNow() / 1000 - S0.t0;
    if (stage === "dormant") {
      S0.sim = newGxi(seed, L);
      return S0.sim.stage;
    }
    const s = S0.sim;
    if (stage === "reveal") {
      s.stage = "reveal";
      s.at = t;
      return s.stage;
    }
    if (s.stage === "dormant" || s.stage === "reveal" || s.stage === "demo") {
      S0.unfold.x = 1;
      S0.rise.x = 1;
    }
    if (stage === "hush") s.mi = GXI.MODES.length - 1;
    if (stage === "predict" || stage === "hush") {
      // may sẵn mọi nút trừ một mũi cuối rồi ghim mũi đó → đúng đường đi của luật (finishMode)
      const n = modeN(s);
      s.stage = "fight";
      for (let k = 0; k < n - 1; k++) s.pins[k] = GXI.PIN_HITS;
      s.pins[n - 2] = GXI.PIN_HITS - 1;
      hitGxi(s, t, ((n - 1) * L) / n, 0.5);
      return s.stage;
    }
    s.stage = "fight";
    s.at = t;
    s.atkAt = t;
    s.lastB = -1;
    s.hurtNo = -1;
    if (atk === "slam" || atk === "whip") s.atk = atk;
    return s.stage;
  }

  function onHit(S0: St, en: Enemy, amount: number) {
    void amount;
    const s = S0.sim;
    const t = fxNow() / 1000 - S0.t0;
    const lang = useWorld.getState().lang === "vi" ? "vi" : "en";
    const n = modeN(s);
    const r = hitGxi(s, t, S0.pu, S0.pv);
    TMP2.copy(en.pos).setY(en.pos.y + 1.6);
    const say = (k: GxiTextKey, kind: "dmg" | "crit" | "info" | "hurt", p?: Record<string, string | number>) => floatText(TMP2, gxiText(lang, k, p), kind);
    if (r === "wake") {
      say("fWake", "info");
      return;
    }
    if (r === "pin" || r === "node" || r === "mode" || r === "win") {
      S0.hit = 1;
      S0.hitU = S0.pu;
      synth.impact("wood", 7);
      emitHit(en.pos.x, en.pos.y + 1.2, en.pos.z, "#ffd27a", 0, 0, 1.2);
      if (r === "pin") say("fPin", "crit");
      else {
        say("fNode", "crit");
        synth.interval(GXI.HZ * n, GXI.HZ * n * 1.5, 0.5);
        unlockNote("standingwave");
      }
      if (r === "mode") synth.chord(GXI.HZ * 2, [1, 5 / 4, 3 / 2, 2], 0.5);
      return;
    }
    if (S0.sim.stage === "fight" && t - S0.infoAt < 0.5) return;
    S0.infoAt = t;
    if (r === "antinode") {
      synth.impact("paper", 2.5);
      say("fAntinode", "info");
    } else if (r === "sewn") say("fSewn", "info");
    else if (r === "far") say("fFar", "info");
    else if (r === "locked") say("fLocked", "info");
  }

  useFrame((state, rawDt) => {
    const S0 = st.current;
    const g = group.current;
    if (!g) return;
    const dt = Math.min(Math.max(rawDt, 1e-3), 0.1);
    const s = S0.sim;
    const t = fxNow() / 1000 - S0.t0;
    const H = HARMONIC;
    const tv = H.time > 0 ? H.time : t;
    S0.calm = fxReducedMotion();
    const calm = S0.calm;
    const w = useWorld.getState();
    const p = w.player;
    // người chơi → hệ cục bộ
    const dx = p.x - origin.x;
    const dz = p.z - origin.z;
    const lx = dx * cos - dz * sin;
    const lz = dx * sin + dz * cos;
    S0.pu = lx + L / 2;
    S0.pv = lz - zW;
    const py = p.y - origin.y;

    // rời đấu trường quá lâu → gối ngủ lại (thử lại từ đầu)
    const dist = Math.hypot(dx, dz);
    if (s.stage !== "dormant" && s.stage !== "done" && s.stage !== "hush") {
      if (dist > radius + 10) {
        if (S0.farSince < 0) S0.farSince = t;
        else if (t - S0.farSince > 6) {
          S0.sim = newGxi(seed, L);
          S0.farSince = -1;
          return;
        }
      } else S0.farSince = -1;
    }

    const ev = tickGxi(s, t, S0.pu, S0.pv, py);
    const n = modeN(s);
    const V = gxiVisual(s, t, tv, S0.V, calm);
    cues(S0, ev, n, lx);

    // lò xo hình (vượt đích nhẹ — vải bật)
    springStep(S0.unfold, V.unfold, 7, 0.55, dt);
    springStep(S0.rise, V.rise, 8, 0.5, dt);
    // đập: lò xo cứng, gần tới hạn (đỉnh không vượt quá mép vùng hiểm); nhấc: theo V
    const slamT = V.slam;
    if (slamT > S0.slam.x) springStep(S0.slam, slamT, 34, 1.0, dt);
    else springStep(S0.slam, slamT, 9, 0.7, dt);
    if (V.slam >= 0.999) S0.slam.x = Math.min(S0.slam.x, 1);
    springStep(S0.pull, V.pull, 12, 0.6, dt);
    springStep(S0.seamA, V.seamA, 6, 1, dt);
    S0.hit = Math.max(0, S0.hit - dt * 2.5);

    // ── vách
    const wu = parts.wallMat.uniforms;
    const unf = Math.max(0, Math.min(1.15, S0.unfold.x));
    const xs = GXI.PILLOW_W / L + (1 - GXI.PILLOW_W / L) * unf;
    const hgt = GXI.PILLOW_H * 0.85 + (GXI.D - GXI.PILLOW_H * 0.85) * Math.max(0, S0.rise.x);
    parts.wall.visible = V.wall > 0.5;
    // va chạm vách (khu chứa bật / tắt tường chặn): vách dựng và đã mở quá nửa
    const up = V.wall > 0.5 && unf > 0.6;
    if (up !== wallUp.current) {
      wallUp.current = up;
      wallRef.current?.(up);
    }
    wu.uN.value = V.n;
    wu.uAmp.value = V.amp;
    wu.uOsc.value = V.osc;
    wu.uPull.value = S0.pull.x;
    wu.uSlam.value = Math.max(0, Math.min(1, S0.slam.x));
    wu.uXs.value = xs;
    wu.uH.value = hgt;
    wu.uPleat.value = 0.06 + 0.3 * (1 - Math.min(1, unf));
    wu.uTime.value = tv;
    wu.uShiver.value = calm ? 0 : s.stage === "fight" && V.count > 0 && s.atk === "slam" ? 0.035 : s.stage === "reveal" && unf < 0.2 ? 0.05 : 0;
    wu.uSeamN.value = V.seamN;
    wu.uSeamA.value = Math.max(0, Math.min(1, S0.seamA.x));
    const pins = wu.uPins.value as THREE.Vector3;
    if (V.seamN === n) pins.set(Math.min(1, s.pins[0] / GXI.PIN_HITS) * 0.94 + 0.06, Math.min(1, s.pins[1] / GXI.PIN_HITS) * 0.94 + 0.06, Math.min(1, s.pins[2] / GXI.PIN_HITS) * 0.94 + 0.06);
    else pins.set(1, 1, 1);
    // trước khi đổi mode, đường may cũ vẫn may đủ
    if (s.stage === "predict" && V.seamN !== n) pins.set(1, 1, 1);
    wu.uHit.value = S0.hit;
    wu.uHitU.value = S0.hitU;

    // ── sàn
    const fu = parts.floorMat.uniforms;
    fu.uN.value = V.n;
    fu.uAtk.value = V.atk;
    fu.uTele.value = V.tele;
    fu.uCommit.value = V.commit;
    fu.uPreview.value = V.preview;
    fu.uPredict.value = V.predict;
    fu.uWhip.value = V.whip;
    fu.uWhipOsc.value = V.whipOsc;
    fu.uCalm.value = calm ? 1 : 0;
    fu.uTime.value = tv;
    parts.floor.visible = V.tele > 0.01 || V.preview > 0.01 || V.predict > 0.5 || V.whip > 0.01;

    // ── mục tiêu chiến đấu: điểm vách gần người chơi nhất (ngủ: cái gối)
    const e = S0.e;
    if (e) {
      if (enemies.indexOf(e) < 0 && s.stage !== "done") enemies.push(e);
      if (s.stage === "dormant" || s.stage === "done" || s.stage === "reveal") toWorld(0, zW + 0.35, e.pos, 0.2);
      else {
        const uu = Math.max(0.4, Math.min(L - 0.4, S0.pu));
        toWorld((uu - L / 2) * xs, zW + 0.4, e.pos, 0.8);
      }
      e.deadAt = s.stage === "done" || s.stage === "hush" ? 1 : 0;
    }

    // ── con rối giấy
    puppets(S0, V, t, tv, n, unf, xs, hgt, calm, dt);

    // ── HUD (≤ 8 lần/s)
    const wall = performance.now() / 1000;
    if (wall - S0.uiAt > 0.125) {
      S0.uiAt = wall;
      const P = useWitchUi.getState().pins;
      const p0 = Math.min(1, s.pins[0] / GXI.PIN_HITS);
      const p1 = Math.min(1, s.pins[1] / GXI.PIN_HITS);
      const p2 = Math.min(1, s.pins[2] / GXI.PIN_HITS);
      const atk = s.stage === "fight" && V.tele > 0.3 ? s.atk : null;
      const u0 = useWitchUi.getState();
      const on = gxiHudOn(s.stage, dist);
      if (u0.on !== on || u0.stage !== s.stage || u0.n !== n || u0.hp !== s.hp || u0.atk !== atk || u0.count !== V.count || P[0] !== p0 || P[1] !== p1 || P[2] !== p2 || u0.prevN !== s.prevN)
        useWitchUi.setState({ on, stage: s.stage, n, prevN: s.prevN, phase: gxiPhase(s), hp: s.hp, maxHp: s.maxHp, atk, count: V.count, pins: [p0, p1, p2], L });
    }
  });

  /** âm / hình theo sự kiện của luật */
  function cues(S0: St, ev: number, n: number, lx: number) {
    const s = S0.sim;
    const w = useWorld.getState();
    const calm = S0.calm;
    const hz = GXI.HZ * n;
    if (ev & EV.STAGE) {
      if (s.stage === "reveal") {
        synth.whoosh(260, 120, 1.4, 0.4);
        synth.pluck(GXI.HZ, 0.5, 3.5);
        if (!calm) w.addShake(0.15);
      } else if (s.stage === "demo") {
        // tiếng chỉ căng nối sang tiếng nỉ đập trầm
        synth.pluck(GXI.HZ * 2, 0.6, 2.5);
        synth.impact("paper", 3.5);
        toWorld(-L / 2, zW, TMP, 0);
        emitDustRing(TMP.x, TMP.y, TMP.z, 0.3, 6, 2.2, 0.5, 0.8, PUFF.dust, PUFF.spark, 0);
        toWorld(L / 2, zW, TMP, 0);
        emitDustRing(TMP.x, TMP.y, TMP.z, 0.3, 6, 2.2, 0.5, 0.8, PUFF.dust, PUFF.spark, 0);
      } else if (s.stage === "predict") {
        synth.whoosh(400, 900, 1.2, 0.35);
      } else if (s.stage === "hush") {
        synth.resolve(GXI.HZ * 2);
      } else if (s.stage === "done" && !S0.rewarded) {
        S0.rewarded = true;
        unlockNote("standingwave");
        questEvent({ type: "kill", kind: "goixepim" });
        toWorld(0, zW + 1.5, TMP, 1.2);
        rollDrops("mite", TMP.clone());
        rollDrops("mite", TMP.clone().setX(TMP.x + 0.8));
        w.burst([TMP.x, TMP.y + 1, TMP.z], "#f4d9c1", 60);
        defeatRef.current?.();
      }
    }
    // dây vải ngân hoạ âm bậc n mỗi ô nhịp khi đang dao động
    const bar = Math.floor(HARMONIC.beat / 4);
    if ((s.stage === "demo" || s.stage === "fight") && bar !== S0.lastBar) {
      S0.lastBar = bar;
      synth.pluck(hz, 0.22, 2.4);
    }
    if (ev & EV.ATK && s.stage === "fight") synth.whoosh(520, 300, 0.6, 0.22);
    if (ev & EV.BEAT) synth.impact("wood", 2.2);
    if (ev & EV.COMMIT) synth.pluck(hz * 2, 0.6, 0.9);
    if (ev & EV.MODE) synth.pluck(hz, 0.7, 2.2);
    if (ev & EV.ACTIVE) {
      const slam = s.stage === "predict" || s.atk === "slam";
      if (slam) {
        synth.impact("paper", 6);
        synth.pluck(GXI.HZ / 2, 0.5, 1.2);
        if (!calm) w.addShake(0.22);
        // bụi + sóng cuộn ở từng bụng (đúng tầm đập của luật)
        for (let k = 0; k < n; k++) {
          const uk = ((k + 0.5) * L) / n;
          toWorld(uk - L / 2, zW + GXI.D * reach(uk, n, L) * 0.7, TMP, 0);
          emitDustRing(TMP.x, TMP.y, TMP.z, 0.5, 5, 2.6, 0.55, 0.9, PUFF.dust, PUFF.spark, 0);
          strike("crest", TMP.x, TMP.y + 0.05, TMP.z, { r: Math.min(2.2, L / n / 2), color: "#d9a2b4" });
        }
      } else {
        synth.pluck(hz * 2, 0.75, 1.6);
        synth.whoosh(900, 1300, 0.4, 0.25);
      }
    }
    if (ev & EV.HURT) {
      toWorld(lx, zW, TMP, 0);
      playerHurt(s.lastDmg, TMP);
    }
    if (ev & (EV.GUESS_OK | EV.GUESS_MISS)) {
      const lang = w.lang === "vi" ? "vi" : "en";
      TMP2.set(w.player.x, w.player.y + 2.2, w.player.z);
      if (ev & EV.GUESS_OK) {
        floatText(TMP2, gxiText(lang, "fGuessOk"), "crit");
        synth.chord(hz, [1, 5 / 4, 3 / 2], 0.55);
        S0.hit = 1;
        S0.hitU = S0.pu;
        unlockNote("standingwave");
      } else {
        floatText(TMP2, gxiText(lang, "fGuessMiss", { n }), "info");
        synth.dissonant(hz * 0.9, 0.5, 0.3);
      }
    }
  }

  /** ghi ma trận các quad (không cấp phát) */
  function puppets(S0: St, V: ReturnType<typeof newVisual>, t: number, tv: number, n: number, unf: number, xs: number, hgt: number, calm: boolean, dt: number) {
    const s = S0.sim;
    const M = parts.pup.instanceMatrix.array as Float32Array;
    Q.M = M;
    Q.R = parts.rect.array as Float32Array;
    Q.dirty = false;
    Q.L = L;
    Q.zW = zW;
    Q.xs = xs;
    Q.hgt = hgt;
    Q.n = V.n;
    Q.amp = V.amp;
    Q.osc = V.osc;
    Q.pull = S0.pull.x;
    Q.slam = Math.max(0, Math.min(1, S0.slam.x));
    const pt = HARMONIC.puppetTime > 0 ? HARMONIC.puppetTime : Math.floor(tv * 12) / 12;
    const stopT = HARMONIC.stopTime > 0 ? HARMONIC.stopTime : Math.floor(tv * 8) / 8;
    const f12 = Math.round(pt * 12);
    const f8 = Math.round(stopT * 8);
    const breathe = calm ? 0 : Math.sin(tv * 2.1);

    // gối (ngủ / lộ dạng / ru ngủ lại)
    const pillowK = V.pillow;
    const pz = zW + 0.42;
    if (pillowK > 0.02) {
      const pw = GXI.PILLOW_W * (1 + 2.6 * (1 - pillowK)) * (1 + 0.03 * breathe);
      const ph = GXI.PILLOW_H * pillowK * (1 - 0.04 * breathe);
      flat(S.pillow, 0, ph * 0.5, pz, 0, pw, ph);
      ground(S.pillowShadow, 0.06, pz + 0.05, pw * 1.25, 0.32 * pillowK);
      // mắt: mở / chớp / bung chỉ (khi bị đánh thức) — mặt bị ép thành đường may khi lộ dạng
      const sq = V.squash;
      let eye: number = GX_CELL.eyeopen;
      if (V.sleep > 0.5) eye = GX_CELL.eyeclosed;
      else if (s.stage === "reveal" || s.stage === "hush") eye = GX_CELL.eyeunravel;
      else if (!calm && (f8 % 37 < 2 || (f8 + 11) % 53 < 2)) eye = GX_CELL.eyeclosed;
      setRect(S.eyeL, eye);
      setRect(S.eyeR, eye);
      const ew = 0.2 * (1 + sq * 0.6);
      const eh = ew / aspect(GX_CELL.eyeopen) * (1 - sq);
      const ex = 0.17 * (1 - sq);
      if (eh > 0.004) {
        flat(S.eyeL, -ex, ph * 0.58, pz + 0.03, 0.06, ew, eh);
        flat(S.eyeR, ex, ph * 0.58, pz + 0.03, -0.06, -ew, eh);
      } else {
        hide(S.eyeL);
        hide(S.eyeR);
      }
      // tua chỉ dưới đáy — flipbook 12 Hz; vài mũi đứng yên khi gối thở (dấu nút đầu tiên)
      setRect(S.tuftL, TUFT[f12 % 8]);
      setRect(S.tuftR, TUFT[(f12 + 3) % 8]);
      const th = 0.16 * pillowK;
      flat(S.tuftL, -0.22, th * 0.1, pz + 0.04, 0, th * aspect(GX_CELL.thread0), th);
      flat(S.tuftR, 0.2, th * 0.1, pz + 0.04, 0, th * aspect(GX_CELL.thread0), th);
    } else {
      hide(S.pillow);
      hide(S.pillowShadow);
      hide(S.eyeL);
      hide(S.eyeR);
      hide(S.tuftL);
      hide(S.tuftR);
    }

    // hai Kẹp Biên Vải: ở hai đầu vách (lúc ngủ: hai bên gối), hàm mở khi dồn lực, cắn khi đập; ngả ra ngoài khi kéo căng
    const fightB = s.stage === "fight" ? (t - s.atkAt) / BEAT : -1;
    const kb = ATK_BEATS[s.atk];
    let jawT = 0.12 + (calm ? 0 : 0.05 * Math.sin(tv * 3));
    let leanT = 0;
    if (s.stage === "reveal") {
      jawT = unf < 0.98 ? 0.05 : 0.4;
      leanT = 0.18 * (1 - unf);
    } else if (fightB >= 0) {
      if (fightB < kb.commit) {
        jawT = 0.55;
        leanT = 0.1;
      } else if (fightB < kb.recover) {
        jawT = 0.02;
        leanT = 0.16;
      }
    } else if (s.stage === "predict") {
      jawT = 0.35;
      leanT = 0.12;
    }
    springStep(S0.jaw, jawT, 16, 0.4, dt);
    springStep(S0.lean, leanT, 9, 0.5, dt);
    const ch = Math.max(GXI.PILLOW_H * 1.2, hgt * 0.62);
    const cw = ch * aspect(GX_CELL.endclamp);
    const awake = s.stage !== "dormant" && s.stage !== "done";
    for (let c = 0; c < 2; c++) {
      const sg = c === 0 ? -1 : 1;
      const xe = sg * (xs * L * 0.5 + cw * 0.38);
      const base = S.clamp + 4 * c;
      const lean = -sg * S0.lean.x;
      flat(base, xe - Math.sin(lean) * ch * 0.5, Math.cos(lean) * ch * 0.5, zW + 0.12, lean, cw, ch);
      // hàm: chốt ở mép trong thân, ~60 % chiều cao, mở đối xứng lên / xuống
      const jw = cw * 1.25 * (awake ? 1 : 0.6);
      const jh = jw / aspect(GX_CELL.clamplingjaw);
      const hx = xe - sg * cw * 0.32;
      const hy = ch * 0.6;
      const op = S0.jaw.x;
      for (let k = 0; k < 2; k++) {
        const up = k === 0 ? 1 : -1;
        const a = -sg * up * op;
        const wdq = -sg * jw;
        const htq = up * jh;
        // tâm = chốt + R(a)·((0,5 − 0,1)·w, (0,5 − 0,8)·h)
        const ox = 0.4 * wdq;
        const oy = -0.3 * htq;
        const ca = Math.cos(a);
        const sa = Math.sin(a);
        flat(base + 1 + k, hx + ca * ox - sa * oy, hy + up * 0.02 + sa * ox + ca * oy, zW + 0.2, a, wdq, htq);
      }
      ground(base + 3, xe, zW + 0.15, cw * 1.6, 0.35);
    }

    // gusset: hai hông gối → hai mép vách bên trong kẹp
    if (V.wall > 0.5 || pillowK > 0.02) {
      const gh = Math.max(GXI.PILLOW_H * 0.95, hgt * 0.92);
      const gw = gh * aspect(GX_CELL.gusset) * (0.5 + 0.5 * (1 - Math.min(1, unf)));
      flat(S.gussetL, -(xs * L * 0.5 + gw * 0.1), gh * 0.5, zW + 0.08, 0, gw, gh);
      flat(S.gussetR, xs * L * 0.5 + gw * 0.1, gh * 0.5, zW + 0.08, 0, -gw, gh);
    } else {
      hide(S.gussetL);
      hide(S.gussetR);
    }

    // túi vải ở bụng sóng (phập phồng theo |biên độ|) + tua chỉ trên mép vách
    const wallOn = V.wall > 0.5 && unf > 0.6;
    for (let k = 0; k < 4; k++) {
      if (wallOn && k < V.n) {
        const uk = ((k + 0.5) * L) / V.n;
        const puff = 0.75 + 0.35 * Math.abs(V.amp * V.osc) / 0.3 + 0.25 * Math.max(0, Math.min(1, S0.slam.x));
        const pw = Math.min(1.5, (L / V.n) * 0.42) * puff * Math.min(1, unf);
        onWall(S.pouch + k, uk, 0.42, pw, pw / aspect(GX_CELL.pouch), 0.08);
        setRect(S.wallTuft + k, TUFT[(f12 + k * 3) % 8]);
        const th = 0.7;
        onWall(S.wallTuft + k, uk + 0.4, Math.max(0.5, 1 - (th * 0.55) / hgt), th * aspect(GX_CELL.thread0), th, 0.04);
      } else {
        hide(S.pouch + k);
        hide(S.wallTuft + k);
      }
    }

    // Suốt Chỉ Lặng: leo lên đường may ở NÚT đã ghim (đứng yên dù vách rung — chính là nút); chưa có việc thì nép ở kẹp
    const dormant = s.stage === "dormant" || s.stage === "done";
    for (let j = 0; j < 3; j++) {
      let ut = j === 1 ? L - 0.7 : 0.7 + j * 0.25;
      let ht = 0.25;
      if (s.stage === "demo" || s.stage === "reveal") {
        if (j === 0) {
          ut = L / 2;
          ht = hgt * 0.4;
        }
      } else if (s.stage === "fight" || s.stage === "hush") {
        if (j < n - 1 && s.pins[j] > 0) {
          ut = ((j + 1) * L) / n;
          ht = hgt * (0.18 + 0.3 * Math.min(1, s.pins[j] / GXI.PIN_HITS));
        }
      } else if (s.stage === "predict" && V.seamN === n && j < n - 1 && s.pins[j] > 0) {
        ut = ((j + 1) * L) / n;
        ht = hgt * 0.4;
      }
      springStep(S0.spoolU[j], ut, 5, 0.75, dt);
      springStep(S0.spoolH[j], ht, 6, 0.8, dt);
      const bi = S.spool + 2 * j;
      if (dormant || !wallOn) {
        hide(bi);
        hide(bi + 1);
        continue;
      }
      const sewing = Math.abs(S0.spoolU[j].x - ut) < 0.15 && ht > 0.3;
      const bob = sewing && !calm ? 0.06 * Math.abs(Math.sin(Math.PI * 2 * (f12 / 12))) : 0;
      const q = Math.max(0.03, Math.min(0.95, (S0.spoolH[j].x + bob) / hgt));
      const sh = 0.55;
      onWall(bi, S0.spoolU[j].x, q, sh * aspect(GX_CELL.spoolbody), sh, 0.22);
      // chỉ treo từ mép trên vách xuống suốt
      const len = Math.max(0.2, hgt * (1 - q));
      onWall(bi + 1, S0.spoolU[j].x + 0.05, Math.min(0.99, q + (1 - q) * 0.5), 0.09, len, 0.2);
    }

    // dải vải mẫu ở cửa (chỉ lúc ngủ): sóng dừng n = 2 thu nhỏ, một Suốt may ở nút giữa
    if (s.stage === "dormant") {
      // cạnh lối vào (lệch sang phải, không chắn tầm nhìn tới gối)
      const dx0 = Math.min(L / 2 - 1, 3.4);
      const dz0 = Math.min(radius - 1.2, GXI.D / 2 + 1.6);
      const seg = 0.22;
      const len = seg * DEMO_N;
      const om = 2 * Math.PI * GXI.F1 * 2;
      const amp = calm ? 0.06 : 0.16;
      for (let k = 0; k < DEMO_N; k++) {
        const xu = (k + 0.5) * seg;
        const y = 0.55 + amp * Math.sin((2 * Math.PI * xu) / len) * Math.cos(om * tv);
        flat(S.demo + k, dx0 - len / 2 + xu, y, dz0, 0, seg * 1.04, 0.5);
      }
      const bob = calm ? 0 : 0.03 * Math.abs(Math.sin(Math.PI * 2 * (f12 / 12)));
      flat(S.demoSpool, dx0, 0.55 + bob, dz0 + 0.06, 0, 0.26 * aspect(GX_CELL.spoolbody), 0.26);
      flat(S.demoThread, dx0 + 0.03, 0.95, dz0 + 0.05, 0, 0.05, 0.6);
    } else {
      for (let k = 0; k < DEMO_N; k++) hide(S.demo + k);
      hide(S.demoSpool);
      hide(S.demoThread);
    }
    parts.pupMat.uniforms.uFlash.value = S0.hit * 0.6;
    parts.pup.instanceMatrix.needsUpdate = true;
    if (Q.dirty) parts.rect.needsUpdate = true;
  }

  return (
    <group ref={group} position={[origin.x, origin.y, origin.z]} rotation-y={yaw} name="perf:witch-goixepim">
      <primitive object={parts.wall} />
      <primitive object={parts.floor} />
      <primitive object={parts.pup} />
    </group>
  );
}
