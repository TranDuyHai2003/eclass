"use client";
/**
 * T24 — Hiệu ứng 5 phép vẽ (cảm hứng NGUYÊN TẮC VFX của Valorant, hình / màu / tên đều riêng — nghiên cứu Codex valorant/codex_answer.md):
 * mỗi phép đi đủ lớp báo trước → chớp niệm → lõi → va chạm → dư âm, có ngôn ngữ hình riêng (khép / gãy / hút / rơi / quét) đọc được
 * cả khi tắt bloom và hạt; mép GAMEPLAY (bán kính thật của đòn) luôn là hình học mảnh, rõ nhất.
 *
 * Hiệu năng (yêu cầu cứng): 3 pool dùng chung = 3 lệnh vẽ cho MỌI phép:
 *  • vòng (annulus instanced, ≤ 24): chỉ tô dải vòng (không tô cả tấm vuông) — mép phép, vòng va chạm, dấu chân thiên thạch;
 *  • mảnh đặc (bipyramid tam giác instanced, ≤ 32 / 64 / 96 theo mức): ĐẶC (không trong suốt → không overdraw, có viền mực),
 *    co lại thay vì mờ dần — đầu sét, quạt vết chém, tab dấu chân, mảnh khiên vỡ;
 *  • dải (≤ 14 dải × 32 điểm, dựng trên CPU vào bộ đệm có sẵn): sống sét bậc thang, tay xoắn, rèm sóng, đường parabol dự báo, làn sin.
 * Không cấp phát mỗi khung (mọi mảng typed dựng sẵn, màu bảng tính trước), không texture (0 lần đọc), số hạt / mảnh theo ngân sách
 * từng phép × mức hiệu ứng (lib/world/spellFx.ts), LOD theo cỡ chiếu trên màn hình (bỏ lớp phụ < 48 px, chỉ mép chính < 24 px).
 * Shader biên dịch sẵn: pool luôn gắn trong cảnh (đếm 0) → PrewarmShaders biên dịch cùng cảnh.
 */
import { useEffect, useMemo } from "react";
import { useFrame, useThree } from "@react-three/fiber";
import * as THREE from "three";
import { useWorld } from "../store";
import { useGfx } from "../gfx";
import { ENV, GRAVITY, ward, type Projectile } from "../combat/combat";
import { emitSpark, type SparkOpts } from "./Sparks";
import { shockwave } from "./Lensing";
import type { SpellId } from "@/lib/world/sigil";
import { worldAsset } from "@/lib/world/avatars";
import { GLTFLoader } from "three/examples/jsm/loaders/GLTFLoader.js";
import { FX_FREEZE, fxFrozen, fxNow } from "./fxClock";
import { PUFF, emitDustRing, emitPuff } from "./Puffs";
import { vfxRand } from "@/lib/world/vfxRng";
import { impactDip, puffCount } from "@/lib/world/vfxBeats";
import {
  SPELL_PALETTE,
  SHARD_CAP,
  clamp01,
  crestHeight,
  easeInQuad,
  easeOutBack,
  easeOutCubic,
  envelope,
  lodTier,
  parabolaPath,
  projectedPx,
  revealWindow,
  spellParticles,
  spiralPath,
  stepPath,
  tierFeedback,
  type FxLevel,
} from "@/lib/world/spellFx";

// ───────────── Bảng màu (tuyến tính, tính một lần) ─────────────

type Pal = { core: THREE.Color; body: THREE.Color; ink: THREE.Color; accent: THREE.Color };
const PAL = {} as Record<SpellId, Pal>;
for (const id of Object.keys(SPELL_PALETTE) as SpellId[]) {
  const p = SPELL_PALETTE[id];
  PAL[id] = { core: new THREE.Color(p.core), body: new THREE.Color(p.body), ink: new THREE.Color(p.ink), accent: new THREE.Color(p.accent) };
}
const WHITE = new THREE.Color(1, 0.97, 0.9);

/** mức hiệu ứng: cài đặt đồ hoạ (gfx.vfx) và chất lượng máy (useWorld().quality "low" → 0) */
export function fxLevel(): FxLevel {
  const v = (useGfx.getState().vfx ?? 1) as FxLevel;
  return useWorld.getState().quality === "low" ? 0 : v;
}

// ───────────── Pool vòng ─────────────

const MAXR = 24;
const R = {
  pos: new Float32Array(MAXR * 3),
  shape: new Float32Array(MAXR * 4), // bán kính, độ dày (m), phần cung hiện (0..1), số vạch đứt
  misc: new Float32Array(MAXR * 4), // alpha, xói (0..1), góc xoay, kiểu (0 nằm đất, 1 quay mặt máy quay)
  body: new Float32Array(MAXR * 3),
  ink: new Float32Array(MAXR * 3),
  n: 0,
};
/**
 * Hệ số HDR chung cho màu thân: các lời gọi truyền k ≈ 1,6–2,6 ("độ sáng tương đối"), nhân 0,55 → thân ~0,9–1,4 (giữ được SẮC màu
 * phép sau tone mapping, chỉ lõi trắng / đầu loé vượt ngưỡng bloom). Đo trên trình duyệt: k thẳng 2,0 làm mọi vòng thành trắng.
 */
const HDR = 0.55;

function ring(x: number, y: number, z: number, radius: number, thick: number, fill: number, dashes: number, rot: number, alpha: number, erode: number, body: THREE.Color, k: number, ink: THREE.Color, mode = 0) {
  if (R.n >= MAXR || alpha <= 0.003 || fill <= 0 || radius <= 0) return;
  k *= HDR;
  const i = R.n++;
  R.pos[i * 3] = x;
  R.pos[i * 3 + 1] = y;
  R.pos[i * 3 + 2] = z;
  R.shape[i * 4] = radius;
  R.shape[i * 4 + 1] = thick;
  R.shape[i * 4 + 2] = fill;
  R.shape[i * 4 + 3] = dashes;
  R.misc[i * 4] = alpha;
  R.misc[i * 4 + 1] = erode;
  R.misc[i * 4 + 2] = rot;
  R.misc[i * 4 + 3] = mode;
  R.body[i * 3] = body.r * k;
  R.body[i * 3 + 1] = body.g * k;
  R.body[i * 3 + 2] = body.b * k;
  R.ink[i * 3] = ink.r;
  R.ink[i * 3 + 1] = ink.g;
  R.ink[i * 3 + 2] = ink.b;
}

const RING_VS = /* glsl */ `
attribute vec3 iPos; attribute vec4 iShape; attribute vec4 iMisc; attribute vec3 iBody; attribute vec3 iInk;
varying vec2 vUv; varying vec4 vShape; varying vec4 vMisc; varying vec3 vBody; varying vec3 vInk; varying float vRep; varying float vRow;
void main(){
  vUv = uv; vShape = iShape; vMisc = iMisc; vBody = iBody; vInk = iInk;
  // nét cọ lặp quanh vòng: mỗi lần lặp dài ~3,5 × độ dày (giữ tỉ lệ ô 4 : 1 của atlas); vòng đứt: mỗi đốt = một nét vuốt hai đầu
  vRep = max(1.0, floor(6.2831853 * iShape.x / max(iShape.y * 3.5, 0.05)));
  vRow = iShape.w > 0.5 ? 2.0 + step(0.5, fract(iMisc.z * 0.37)) : step(0.5, fract(iMisc.z * 0.37));
  float th = uv.x * 6.2831853 + iMisc.z;
  float r = iShape.x + (uv.y - 0.5) * iShape.y;
  vec3 wp;
  if (iMisc.w < 0.5) wp = iPos + vec3(cos(th) * r, 0.0, sin(th) * r);
  else {
    vec3 Rt = vec3(viewMatrix[0][0], viewMatrix[1][0], viewMatrix[2][0]);
    vec3 Up = vec3(viewMatrix[0][1], viewMatrix[1][1], viewMatrix[2][1]);
    wp = iPos + (Rt * cos(th) + Up * sin(th)) * r;
  }
  gl_Position = projectionMatrix * viewMatrix * vec4(wp, 1.0);
}`;
const RING_FS = /* glsl */ `
uniform sampler2D uBrush; uniform float uBrushK;
varying vec2 vUv; varying vec4 vShape; varying vec4 vMisc; varying vec3 vBody; varying vec3 vInk; varying float vRep; varying float vRow;
float h1(float n){ return fract(sin(n * 91.3458) * 47453.5453); }
void main(){
  float u = vUv.x;
  float fill = vShape.z;
  if (u > fill) discard;
  float dashes = vShape.w;
  if (dashes > 0.5 && fract(u * dashes) > 0.62) discard;
  float seg = floor(u * max(dashes, 28.0));
  // nét cọ (atlas 256², 1 lần đọc): R = độ phủ (mép xơ cọ khô), G = vân vỡ cho xói; mức thấp: không đọc texture
  vec2 bm = vec2(1.0, h1(seg + 0.37 * dashes));
  if (uBrushK > 0.5) {
    float sx = dashes > 0.5 ? fract(u * dashes) / 0.62 : u * vRep;
    float ty = (vRow * 64.0 + 6.0 + vUv.y * 52.0) / 256.0;
    bm = texture2D(uBrush, vec2(sx, 1.0 - ty)).rg;
  }
  // xói: vòng "gãy" thành mảng theo vân cọ rồi bong ra
  if (bm.y < vMisc.y) discard;
  float x = abs(vUv.y * 2.0 - 1.0);
  float aa = fwidth(x) * 1.5;
  float edge = (1.0 - smoothstep(1.0 - aa, 1.0, x)) * mix(1.0, smoothstep(0.08, 0.6, bm.x), uBrushK);
  float core = 1.0 - smoothstep(0.12, 0.38, x);
  float inkB = smoothstep(0.58, 0.8, x);
  // đầu đường nối (seam) sáng khi vòng đang khép
  float head = fill < 0.999 ? (1.0 - smoothstep(0.0, 0.035, fill - u)) : 0.0;
  vec3 c = mix(vBody, vInk, inkB);
  c = mix(c, vec3(2.4, 2.3, 2.05), clamp(core * 0.5 + head, 0.0, 1.0));
  float a = edge * vMisc.x;
  if (a < 0.003) discard;
  // mép mực: pha trộn alpha (tối thấy rõ trên nền sáng) · thân + lõi: cộng sáng (bloom bắt) — cùng 1 lệnh vẽ
  gl_FragColor = vec4(c * a, a * inkB * 0.85);
}`;

// ───────────── Pool mảnh đặc ─────────────

const MAXS = 96;
const S = {
  pos: new Float32Array(MAXS * 3),
  dir: new Float32Array(MAXS * 3),
  sc: new Float32Array(MAXS * 4), // rộng X, dài (trục dir), dày Z, xoay quanh trục
  body: new Float32Array(MAXS * 3),
  ink: new Float32Array(MAXS * 3),
  /** biến thể hình mảnh (shards.glb): 0 khối pha lê lục giác (thiên thạch), 1 kim thoi (sét), 2 phiến mỏng (khiên) */
  var: new Float32Array(MAXS),
  n: 0,
  cap: MAXS,
};
/** biến thể mảnh theo phép (mảnh bay) */
const SHARD_VAR: Partial<Record<SpellId, number>> = { shield: 2, bolt: 1 };
function shard(x: number, y: number, z: number, dx: number, dy: number, dz: number, w: number, len: number, wz: number, spin: number, body: THREE.Color, k: number, ink: THREE.Color, variant = 0) {
  if (S.n >= S.cap || w <= 0.002 || len <= 0.002) return;
  k *= HDR;
  const i = S.n++;
  S.pos[i * 3] = x;
  S.pos[i * 3 + 1] = y;
  S.pos[i * 3 + 2] = z;
  S.dir[i * 3] = dx;
  S.dir[i * 3 + 1] = dy;
  S.dir[i * 3 + 2] = dz;
  S.sc[i * 4] = w;
  S.sc[i * 4 + 1] = len;
  S.sc[i * 4 + 2] = wz;
  S.sc[i * 4 + 3] = spin;
  S.var[i] = variant;
  S.body[i * 3] = body.r * k;
  S.body[i * 3 + 1] = body.g * k;
  S.body[i * 3 + 2] = body.b * k;
  S.ink[i * 3] = ink.r;
  S.ink[i * 3 + 1] = ink.g;
  S.ink[i * 3 + 2] = ink.b;
}

/** mảnh bay (mô phỏng đơn giản, vòng đệm cố định) */
const SIM = 64;
const D = {
  pos: new Float32Array(SIM * 3),
  vel: new Float32Array(SIM * 3),
  dir: new Float32Array(SIM * 3),
  sz: new Float32Array(SIM * 3), // rộng, dài, dày
  spin: new Float32Array(SIM * 2), // góc, tốc độ quay
  age: new Float32Array(SIM),
  life: new Float32Array(SIM),
  grav: new Float32Array(SIM),
  drag: new Float32Array(SIM),
  align: new Uint8Array(SIM),
  floor: new Float32Array(SIM).fill(-1e9),
  pal: new Uint8Array(SIM), // chỉ số bảng màu
  head: 0,
};
const PAL_IDS: SpellId[] = ["shield", "bolt", "vortex", "meteor", "wave"];
function emitShard(id: SpellId, x: number, y: number, z: number, vx: number, vy: number, vz: number, w: number, len: number, life: number, grav = 6, drag = 3, align = true, floorY = -1e9) {
  const i = D.head++ % SIM;
  D.pos[i * 3] = x;
  D.pos[i * 3 + 1] = y;
  D.pos[i * 3 + 2] = z;
  D.vel[i * 3] = vx;
  D.vel[i * 3 + 1] = vy;
  D.vel[i * 3 + 2] = vz;
  D.dir[i * 3] = vx;
  D.dir[i * 3 + 1] = vy + 1e-3;
  D.dir[i * 3 + 2] = vz;
  D.sz[i * 3] = w;
  D.sz[i * 3 + 1] = len;
  D.sz[i * 3 + 2] = w * 0.7;
  D.spin[i * 2] = vfxRand() * 6.28;
  D.spin[i * 2 + 1] = (vfxRand() - 0.5) * 16;
  D.age[i] = 0;
  D.life[i] = life;
  D.grav[i] = grav;
  D.drag[i] = drag;
  D.align[i] = align ? 1 : 0;
  D.floor[i] = floorY;
  D.pal[i] = PAL_IDS.indexOf(id);
}

const SHARD_VS = /* glsl */ `
attribute vec3 iPos; attribute vec3 iDir; attribute vec4 iSc; attribute vec3 iBody; attribute vec3 iInk; attribute float iVar; attribute float aVar;
varying vec3 vN; varying vec3 vBody; varying vec3 vInk; varying float vY;
void main(){
  // hình học = 3 biến thể gộp (aVar); đỉnh không thuộc biến thể của mảnh này → đẩy ra ngoài vùng cắt (vẫn 1 lệnh vẽ)
  if (abs(aVar - iVar) > 0.5) { vN = vec3(0.0); vBody = vec3(0.0); vInk = vec3(0.0); vY = 0.0; gl_Position = vec4(0.0, 0.0, 2.0, 1.0); return; }
  vec3 Y = normalize(iDir);
  vec3 ref = abs(Y.y) > 0.95 ? vec3(1.0, 0.0, 0.0) : vec3(0.0, 1.0, 0.0);
  vec3 X = normalize(cross(ref, Y));
  vec3 Z = cross(X, Y);
  float c = cos(iSc.w), s = sin(iSc.w);
  vec3 X2 = X * c + Z * s;
  vec3 Z2 = Z * c - X * s;
  vec3 wp = iPos + X2 * position.x * iSc.x + Y * position.y * iSc.y + Z2 * position.z * iSc.z;
  vN = normalize(X2 * normal.x / max(iSc.x, 1e-3) + Y * normal.y / max(iSc.y, 1e-3) + Z2 * normal.z / max(iSc.z, 1e-3));
  vBody = iBody; vInk = iInk; vY = position.y;
  gl_Position = projectionMatrix * viewMatrix * vec4(wp, 1.0);
}`;
const SHARD_FS = /* glsl */ `
varying vec3 vN; varying vec3 vBody; varying vec3 vInk; varying float vY;
void main(){
  // mặt vát 2 tông kiểu cel (sáng / tối rõ ràng) + chóp sáng
  float l = dot(normalize(vN), vec3(0.32, 0.86, 0.39));
  float lit = step(0.18, abs(l)) * (l > 0.0 ? 1.0 : 0.62);
  vec3 c = mix(vInk, vBody, 0.25 + 0.75 * lit);
  c += vec3(1.6, 1.5, 1.3) * smoothstep(0.62, 0.98, vY);
  gl_FragColor = vec4(c, 1.0);
}`;

// ───────────── Pool dải ─────────────

const K = 14;
const M = 32;
const T = {
  pos: new Float32Array(K * M * 2 * 3),
  uv: new Float32Array(K * M * 2 * 2),
  col: new Float32Array(K * M * 2 * 3),
  ink: new Float32Array(K * M * 2 * 3),
  p: new Float32Array(K * M * 2 * 4), // alpha, đầu, đuôi, kiểu
  n: 0,
};
const CAMP = new THREE.Vector3();
const PATH = new Float32Array(M * 3);
const HEI = new Float32Array(M);
/**
 * Một dải qua n điểm (PATH-like): hướng 0 = quay mặt máy quay, 1 = nằm phẳng (pháp tuyến lên), 2 = rèm đứng (cao HEI[i]).
 * Bề rộng nội suy w0 (đuôi, u = 0) → w1 (đầu, u = 1). Hiện trên u ∈ [tail, head]. Kiểu: 0 sét, 1 dấu phẩy xoắn, 2 rèm sóng,
 * 3 nét đứt dự báo, 4 làn sin.
 */
function strip(pts: Float32Array, n: number, orient: 0 | 1 | 2, w0: number, w1: number, head: number, tail: number, alpha: number, style: number, body: THREE.Color, k: number, ink: THREE.Color, hei?: Float32Array) {
  if (T.n >= K || n < 2 || alpha <= 0.003 || tail >= head) return;
  k *= HDR;
  n = Math.min(n, M);
  const s = T.n++;
  for (let i = 0; i < M; i++) {
    const j = Math.min(i, n - 1);
    const px = pts[j * 3];
    const py = pts[j * 3 + 1];
    const pz = pts[j * 3 + 2];
    const u = j / (n - 1);
    let ox = 0;
    let oy = 0;
    let oz = 0;
    if (orient === 2) {
      oy = hei ? hei[j] : 1;
    } else {
      const a = Math.max(0, j - 1);
      const b = Math.min(n - 1, j + 1);
      const tx = pts[b * 3] - pts[a * 3];
      const ty = pts[b * 3 + 1] - pts[a * 3 + 1];
      const tz = pts[b * 3 + 2] - pts[a * 3 + 2];
      let sx: number;
      let sy: number;
      let sz: number;
      if (orient === 0) {
        const cx = CAMP.x - px;
        const cy = CAMP.y - py;
        const cz = CAMP.z - pz;
        sx = ty * cz - tz * cy;
        sy = tz * cx - tx * cz;
        sz = tx * cy - ty * cx;
      } else {
        sx = -tz;
        sy = 0;
        sz = tx;
      }
      const l = Math.hypot(sx, sy, sz) || 1;
      const w = (w0 + (w1 - w0) * u) * 0.5;
      ox = (sx / l) * w;
      oy = (sy / l) * w;
      oz = (sz / l) * w;
    }
    const v = (s * M + i) * 2;
    for (let e = 0; e < 2; e++) {
      const q = v + e;
      if (orient === 2) {
        T.pos[q * 3] = px;
        T.pos[q * 3 + 1] = py + oy * e;
        T.pos[q * 3 + 2] = pz;
      } else {
        const sg = e ? 1 : -1;
        T.pos[q * 3] = px + ox * sg;
        T.pos[q * 3 + 1] = py + oy * sg;
        T.pos[q * 3 + 2] = pz + oz * sg;
      }
      T.uv[q * 2] = u;
      T.uv[q * 2 + 1] = e;
      T.col[q * 3] = body.r * k;
      T.col[q * 3 + 1] = body.g * k;
      T.col[q * 3 + 2] = body.b * k;
      T.ink[q * 3] = ink.r;
      T.ink[q * 3 + 1] = ink.g;
      T.ink[q * 3 + 2] = ink.b;
      T.p[q * 4] = alpha;
      T.p[q * 4 + 1] = head;
      T.p[q * 4 + 2] = tail;
      T.p[q * 4 + 3] = style;
    }
  }
}

const STRIP_VS = /* glsl */ `
attribute vec3 aCol; attribute vec3 aInk; attribute vec4 aP;
varying vec2 vUv; varying vec3 vCol; varying vec3 vInk; varying vec4 vP;
void main(){ vUv = uv; vCol = aCol; vInk = aInk; vP = aP; gl_Position = projectionMatrix * modelViewMatrix * vec4(position, 1.0); }`;
const STRIP_FS = /* glsl */ `
uniform float uT; uniform sampler2D uBrush; uniform float uBrushK;
varying vec2 vUv; varying vec3 vCol; varying vec3 vInk; varying vec4 vP;
// một lần đọc atlas nét cọ: hàng row (0–1 dải lặp, 2–3 nét vuốt), sx dọc nét, v ngang nét
vec2 brushAt(float row, float sx, float v){ return texture2D(uBrush, vec2(sx, 1.0 - (row * 64.0 + 6.0 + v * 52.0) / 256.0)).rg; }
void main(){
  float u = vUv.x; float head = vP.y; float tail = vP.z; float st = vP.w;
  if (u > head || u < tail) discard;
  float x = abs(vUv.y * 2.0 - 1.0);
  vec3 c; float occ = 0.0; float a = vP.x;
  vec2 bm = vec2(1.0, 0.5);
  if (uBrushK > 0.5) {
    float d0 = fract(u * 7.0 - uT * 1.15);
    bm = st < 0.5 ? brushAt(0.0, u * 5.0, vUv.y)
       : st < 1.5 ? brushAt(2.0 + step(0.5, fract(floor(u * 7.0 - uT * 1.15) * 0.5)), d0 / 0.72, vUv.y)
       : st < 2.5 ? vec2(1.0, texture2D(uBrush, vec2(u * 3.0, vUv.y * 0.5)).g)
       : brushAt(1.0, u * 6.0, vUv.y);
    // đuôi bị "ăn" theo vân cọ (không cắt thẳng)
    if (tail > 0.001 && u < tail + 0.12 * bm.y) discard;
  }
  float cov = mix(1.0, smoothstep(0.08, 0.6, bm.x), uBrushK);
  if (st < 0.5) {
    // SÉT: lõi trắng – thân nghệ – mép nâu mực, đuôi vuốt nhọn, đầu loé
    float w = mix(0.3, 1.0, smoothstep(tail, tail + 0.18, u));
    if (x > w) discard;
    a *= cov;
    float xx = x / w;
    float core = 1.0 - smoothstep(0.14, 0.34, xx);
    float ink = smoothstep(0.6, 0.78, xx);
    c = mix(mix(vCol, vInk, ink), vec3(3.0, 2.85, 2.4), core);
    c += vec3(2.2) * (1.0 - smoothstep(0.0, 0.07, head - u));
    occ = ink * 0.9;
  } else if (st < 1.5) {
    // XOẮN: dấu phẩy trôi vào tâm (đầu tròn to, đuôi mảnh), mép mực cà tím
    float d = fract(u * 7.0 - uT * 1.15);
    if (d > 0.72) discard;
    float wv = mix(1.0, 0.22, d / 0.72);
    if (x > wv) discard;
    float ink = smoothstep(0.62 * wv, wv, x);
    c = mix(mix(vCol, vInk, ink), vec3(2.3, 2.2, 2.7), (1.0 - smoothstep(0.0, 0.12, d)) * (1.0 - ink));
    a *= smoothstep(0.0, 0.08, u - tail) * (0.45 + 0.55 * u) * cov;
    occ = ink * 0.8;
  } else if (st < 2.5) {
    // RÈM SÓNG: hõm sẫm dưới → thân xanh biển → bọt phấn ở mép trên (v = 0 chân, 1 đỉnh)
    float y = vUv.y;
    float foamEdge = 0.8 + 0.06 * sin(u * 57.0 + uT * 9.0) + 0.04 * sin(u * 23.0 - uT * 5.0) + 0.1 * (bm.y - 0.5) * uBrushK;
    float trough = 1.0 - smoothstep(0.08, 0.34, y);
    c = mix(vCol, vInk, trough);
    float foam = smoothstep(foamEdge - 0.05, foamEdge, y);
    c = mix(c, vec3(2.5, 2.7, 2.6), foam);
    a *= (1.0 - smoothstep(0.94, 1.0, y)) * (0.55 + 0.45 * smoothstep(0.0, 0.5, y)) * smoothstep(0.0, 0.06, u) * (1.0 - smoothstep(0.94, 1.0, u));
    occ = trough * 0.7;
  } else if (st < 3.5) {
    // DỰ BÁO: nét đứt mảnh trôi về đích (đường bao thay vì khối trong suốt)
    if (fract(u * 26.0 - uT * 3.0) > 0.55) discard;
    float ink = smoothstep(0.5, 0.8, x);
    c = mix(vCol, vInk, ink);
    occ = ink * 0.8;
  } else {
    // LÀN SIN: lõi trắng → màu, đuôi tắt
    float prof = 1.0 - x * x;
    c = mix(vCol, vec3(2.6, 2.8, 2.7), smoothstep(0.55, 1.0, prof));
    a *= prof * smoothstep(tail, tail + 0.25, u) * cov;
  }
  if (a < 0.004) discard;
  gl_FragColor = vec4(c * a, a * occ);
}`;

// ───────────── Texture art (Codex sinh, xử lý bằng scripts/spell-fx-art.py) ─────────────

let brushTex: THREE.Texture | null = null;
let runeTex: THREE.Texture | null = null;
/** atlas nét cọ 256² (R phủ, G vân vỡ) — lặp theo chiều ngang, kẹp chiều dọc (4 hàng có đệm) */
function brushAtlas(): THREE.Texture {
  if (brushTex) return brushTex;
  const t = new THREE.TextureLoader().load(worldAsset("fx/tex/brush_atlas.png"));
  t.colorSpace = THREE.NoColorSpace;
  t.wrapS = THREE.RepeatWrapping;
  t.wrapT = THREE.ClampToEdgeWrapping;
  t.anisotropy = 4;
  return (brushTex = t);
}
/** 5 rune phép (1280 × 256 xám): khiên, sét, xoắn, thiên thạch, sóng */
function runeSheet(): THREE.Texture {
  if (runeTex) return runeTex;
  const t = new THREE.TextureLoader().load(worldAsset("fx/tex/spell_runes.png"));
  t.colorSpace = THREE.NoColorSpace;
  return (runeTex = t);
}
const RUNE_INDEX: Record<SpellId, number> = { shield: 0, bolt: 1, vortex: 2, meteor: 3, wave: 4 };

// ───────────── Pool rune (dấu phép nằm trên đất) ─────────────

const MAXU = 6;
const U = {
  pos: new Float32Array(MAXU * 3),
  misc: new Float32Array(MAXU * 4), // cỡ (m), góc xoay, alpha, chỉ số rune
  col: new Float32Array(MAXU * 3),
  n: 0,
};
function rune(id: SpellId, x: number, y: number, z: number, size: number, rot: number, alpha: number, col: THREE.Color, k: number) {
  if (U.n >= MAXU || alpha <= 0.003 || size <= 0) return;
  const i = U.n++;
  U.pos[i * 3] = x;
  U.pos[i * 3 + 1] = y;
  U.pos[i * 3 + 2] = z;
  U.misc[i * 4] = size;
  U.misc[i * 4 + 1] = rot;
  U.misc[i * 4 + 2] = alpha;
  U.misc[i * 4 + 3] = RUNE_INDEX[id];
  k *= HDR;
  U.col[i * 3] = col.r * k;
  U.col[i * 3 + 1] = col.g * k;
  U.col[i * 3 + 2] = col.b * k;
}
const RUNE_VS = /* glsl */ `
attribute vec3 iPos; attribute vec4 iMisc; attribute vec3 iCol;
varying vec2 vUv; varying vec4 vMisc; varying vec3 vCol;
void main(){
  vUv = uv; vMisc = iMisc; vCol = iCol;
  float c = cos(iMisc.y), s = sin(iMisc.y);
  vec2 q = (uv - 0.5) * iMisc.x;
  vec3 wp = iPos + vec3(q.x * c - q.y * s, 0.0, q.x * s + q.y * c);
  gl_Position = projectionMatrix * viewMatrix * vec4(wp, 1.0);
}`;
const RUNE_FS = /* glsl */ `
uniform sampler2D uRunes;
varying vec2 vUv; varying vec4 vMisc; varying vec3 vCol;
void main(){
  float m = texture2D(uRunes, vec2((vMisc.w + vUv.x) / 5.0, vUv.y)).r;
  float a = m * vMisc.z;
  if (a < 0.01) discard;
  // nét rune: thân màu phép, chỗ đậm nhất ngả trắng (bloom bắt) — cộng sáng, 1 lần đọc texture
  gl_FragColor = vec4(mix(vCol, vec3(2.2, 2.1, 1.9), m * m * m) * a, 0.0);
}`;

// ───────────── Phiên phép đang chạy ─────────────

type CastI = { t0: number; id: SpellId; rings: number; rough: boolean };
type BoltI = { t0: number; hops: Float32Array; n: number; miss: boolean; fired: number; lod: FxLevel };
type VortexRef = { pos: THREE.Vector3; born: number; dur: number; done: boolean };
type VortexI = { v: VortexRef; lod: FxLevel; boom: boolean; acc: number };
type MeteorI = { t0: number; pr: Projectile; T: number; tx: number; ty: number; tz: number; impactAt: number; ix: number; iy: number; iz: number; lod: FxLevel; rot: number };
type WaveI = { t0: number; ox: number; oy: number; oz: number; fx: number; fz: number; sx: number; sz: number; gy: number; lod: FxLevel; mist: boolean };

const casts: CastI[] = [];
const bolts: BoltI[] = [];
const vorts: VortexI[] = [];
const meteors: MeteorI[] = [];
const waves: WaveI[] = [];
const shieldSt = { hitSeen: -1e9, endFor: 0, lod: 2 as FxLevel };
const V0 = new THREE.Vector3();
const swapRemove = <X,>(a: X[], i: number) => {
  a[i] = a[a.length - 1];
  a.pop();
};

// tuỳ chọn hạt dựng sẵn (không tạo object mỗi lần phát)
const O_GLINT: SparkOpts = { kind: 1, size: 0.75, life: 0.2, bright: 3.4 };
const O_RAD: SparkOpts = { size: 0.04, life: 0.3, stretch: 0.05, drag: 5, gravity: 1 };
const O_HEAL: SparkOpts = { size: 0.04, life: 0.9, drag: 0.8, gravity: -0.3, stretch: 0.05 };
const O_HEALG: SparkOpts = { kind: 1, size: 0.2, life: 0.9, drag: 0.8, gravity: -0.3 };
const O_CHIP: SparkOpts = { size: 0.03, life: 0.16, stretch: 0.045, drag: 6, gravity: 2 };
const O_MOTE: SparkOpts = { size: 0.04, life: 0.45, stretch: 0.05, drag: 0.5, gravity: 0 };
const O_DROP: SparkOpts = { size: 0.05, life: 0.42, stretch: 0.035, drag: 2.2, gravity: 5 };
const O_EMBER: SparkOpts = { size: 0.06, life: 0.5, stretch: 0.05, drag: 3, gravity: 9 };
const O_CORE: SparkOpts = { kind: 1, size: 2.2, life: 0.09, bright: 3.5 };
const O_BOOM: SparkOpts = { size: 0.05, life: 0.5, stretch: 0.05, drag: 2.5, gravity: 1.5 };

// ───────────── API gọi từ combat/spells.ts và ui/Sigil.tsx ─────────────

/** Chớp niệm (vừa phát phép): vòng dấu dưới chân khép trong 45 ms theo màu phép + vòng theo bậc chính xác + tia toả */
export function fxCast(id: SpellId, tierLabel: string) {
  const p = useWorld.getState().player;
  const tf = tierFeedback(tierLabel);
  casts.push({ t0: fxNow(), id, rings: tf.rings, rough: tf.shake });
  if (casts.length > 4) casts.shift();
  const lv = fxLevel();
  emitSpark(p.x, p.y + 1.1, p.z, 0, 0, 0, PAL[id].core, O_GLINT);
  const n = Math.round(tf.sparks * (lv === 0 ? 0.5 : lv === 1 ? 0.75 : 1));
  for (let i = 0; i < n; i++) {
    const a = (i / n) * Math.PI * 2;
    const s = 5 + vfxRand() * 2;
    emitSpark(p.x, p.y + 1.0, p.z, Math.cos(a) * s, 0.6 + vfxRand(), Math.sin(a) * s, i % 3 ? PAL[id].body : PAL[id].core, O_RAD);
  }
}

/** Khiên: hạt hồi máu (theo ngân sách) — phần vòng / mảnh đọc thẳng trạng thái `ward` mỗi khung */
export function fxShield() {
  const p = useWorld.getState().player;
  const n = spellParticles("shield", fxLevel());
  for (let i = 0; i < n; i++) {
    const a = (i / n) * Math.PI * 2;
    emitSpark(p.x + Math.cos(a) * 0.7, p.y + 0.3 + vfxRand() * 0.8, p.z + Math.sin(a) * 0.7, 0, 0.9 + vfxRand() * 0.6, 0, i % 3 ? PAL.shield.body : PAL.shield.core, i % 3 ? O_HEAL : O_HEALG);
  }
}

/** Sét: danh sách bước nảy [ax, ay, az, bx, by, bz]… (miss = không trúng ai, vuốt nhọn theo hướng đi) */
export function fxBolt(hops: number[], miss: boolean) {
  const n = Math.min(5, Math.floor(hops.length / 6));
  if (!n) return;
  const h = new Float32Array(n * 6);
  for (let i = 0; i < n * 6; i++) h[i] = hops[i];
  bolts.push({ t0: fxNow(), hops: h, n, miss, fired: 0, lod: 2 });
  if (bolts.length > 3) bolts.shift();
}

export function fxVortex(v: VortexRef) {
  vorts.push({ v, lod: 2, boom: false, acc: 0 });
  if (vorts.length > 3) vorts.shift();
}

export function fxMeteor(pr: Projectile, target: THREE.Vector3, T: number) {
  meteors.push({ t0: fxNow(), pr, T, tx: target.x, ty: target.y, tz: target.z, impactAt: -1, ix: 0, iy: 0, iz: 0, lod: 2, rot: vfxRand() * 6.28 });
  if (meteors.length > 3) meteors.shift();
}

export function fxWave(ox: number, oy: number, oz: number, fx: number, fz: number) {
  const gy = ENV.ground(ox + fx * 3, oz + fz * 3);
  waves.push({ t0: fxNow(), ox, oy, oz, fx, fz, sx: fz, sz: -fx, gy: Number.isFinite(gy) ? gy : oy, lod: 2, mist: false });
  if (waves.length > 3) waves.shift();
  // giọt bọt bong khỏi ngọn (bị bỏ lại phía sau khi mặt sóng chậm dần)
  const n = spellParticles("wave", fxLevel());
  for (let i = 0; i < n; i++) {
    const u = (i + 0.5) / n - 0.5;
    const sp = 9 + vfxRand() * 5;
    emitSpark(ox + fz * u * 3.4 + fx * 0.8, oy + 0.9 + vfxRand() * 0.5, oz - fx * u * 3.4 + fz * 0.8, fx * sp, 1.5 + vfxRand() * 2, fz * sp, i % 3 ? PAL.wave.body : PAL.wave.core, O_DROP);
  }
}

// ───────────── Vẽ từng phép (mỗi khung, không cấp phát) ─────────────

let VIEW_H = 800;
let FOV = 50;
function lodAt(x: number, y: number, z: number, diam: number, prev: FxLevel): FxLevel {
  const d = Math.hypot(x - CAMP.x, y - CAMP.y, z - CAMP.z);
  return lodTier(projectedPx(diam, d, FOV, VIEW_H), prev);
}

function drawCasts(now: number) {
  const p = useWorld.getState().player;
  for (let i = casts.length - 1; i >= 0; i--) {
    const c = casts[i];
    const age = now - c.t0;
    if (age > 520) {
      swapRemove(casts, i);
      continue;
    }
    const P = PAL[c.id];
    // rune của phép in xuống đất dưới chân: nở 1,5 → 2 m, quay chậm, giữ 120 ms rồi tắt 300 ms (mọi mức)
    rune(c.id, p.x, p.y + 0.03, p.z, 1.5 + 0.5 * easeOutCubic(age / 220), age / 900, envelope(age, 0, 120, 300), P.body, 2.2);
    // dấu niệm: vòng khép 0–45 ms (đường nối chạy quanh), nở nhẹ, giữ, tắt 300 ms
    for (let k = 0; k < c.rings; k++) {
      const a = age - k * 55;
      if (a < 0) continue;
      const env = envelope(a, 0, 90, 300);
      const r = 0.95 + k * 0.32 + 0.35 * easeOutCubic(a / 220);
      ring(p.x, p.y + 0.04 + k * 0.01, p.z, r, k ? 0.05 : 0.09, clamp01(a / 45), k === 2 ? 18 : 0, k * 1.3, env, c.rough ? 0.35 : easeInQuad((a - 200) / 300), k ? P.core : P.body, k ? 1.6 : 2.2, P.ink);
    }
  }
}

function drawShield(now: number, lv: FxLevel) {
  if (ward.until <= 0) return;
  const active = now < ward.until;
  const since = now - ward.until;
  if (!active && since > 260) return;
  const p = useWorld.getState().player;
  const P = PAL.shield;
  const age = now - ward.born;
  const total = Math.max(1, ward.until - ward.born);
  shieldSt.lod = lodAt(p.x, p.y + 1, p.z, 2.4, shieldSt.lod);
  // VÒNG KHÉP dưới chân: đường nối chạy quanh trong 65 ms; sau đó phần cung = thời gian còn lại (báo sắp hết rõ ràng)
  const fill = age < 65 ? easeOutCubic(age / 65) : active ? Math.max(0.04, (ward.until - now) / total) : 1;
  const blink = active && ward.until - now < 1000 ? 0.6 + 0.4 * Math.sin(now / 45) : 1;
  const erode = active ? 0 : clamp01(since / 180);
  ring(p.x, p.y + 0.05, p.z, 1.16, 0.1, fill, 0, -Math.PI / 2, blink * (active ? 1 : 1 - erode * 0.6), erode, P.body, 2.0, P.ink);
  if (lv >= 1 && shieldSt.lod >= 2) ring(p.x, p.y + 0.06, p.z, 1.34, 0.035, active ? 1 : 0, 24, now / 1400, 0.7 * blink, 0, P.core, 1.4, P.ink);
  // rune khiên mờ trong vòng khép (lớp phụ)
  if (lv >= 1 && shieldSt.lod >= 1 && active) rune("shield", p.x, p.y + 0.035, p.z, 2.1, now / 2500, 0.4 * blink * clamp01(age / 120), P.body, 1.8);
  // chạm khiên (đòn bị chặn): mảnh ngọc bắn ra tại phía bị đánh (8 / 12 / 16)
  if (ward.hitAt > shieldSt.hitSeen && now - ward.hitAt < 120 && active) {
    shieldSt.hitSeen = ward.hitAt;
    const d = ward.hitDir;
    const hx = p.x + d.x * 1.1;
    const hy = p.y + 0.95 + d.y * 1.1;
    const hz = p.z + d.z * 1.1;
    const n = shieldSt.lod >= 1 ? Math.round(spellParticles("shield", lv) * 0.6) : 3;
    for (let i = 0; i < n; i++) emitShard("shield", hx, hy, hz, d.x * 4 + (vfxRand() - 0.5) * 3, d.y * 4 + vfxRand() * 2.5, d.z * 4 + (vfxRand() - 0.5) * 3, 0.05, 0.14, 0.16 + vfxRand() * 0.06, 4, 5, true, p.y);
    for (let i = 0; i < Math.ceil(n / 2); i++) emitSpark(hx, hy, hz, d.x * 5 + (vfxRand() - 0.5) * 4, vfxRand() * 3, d.z * 5 + (vfxRand() - 0.5) * 4, i % 2 ? P.body : P.core, O_CHIP);
  }
  // hết khiên: bong vài mảnh thưa khỏi bong bóng (180 ms)
  if (!active && shieldSt.endFor !== ward.until) {
    shieldSt.endFor = ward.until;
    const n = Math.round(spellParticles("shield", lv) * (shieldSt.lod >= 1 ? 0.7 : 0.3));
    for (let i = 0; i < n; i++) {
      const a = (i / n) * Math.PI * 2 + vfxRand() * 0.4;
      const yy = (vfxRand() - 0.3) * 0.9;
      const cx = Math.cos(a) * 1.05;
      const cz = Math.sin(a) * 1.05;
      emitShard("shield", p.x + cx, p.y + 0.95 + yy, p.z + cz, cx * 2.2, 1.2 + yy, cz * 2.2, 0.06, 0.18, 0.18 + vfxRand() * 0.08, 3, 3, true, p.y);
    }
  }
}

function drawBolts(now: number, lv: FxLevel) {
  const P = PAL.bolt;
  for (let b = bolts.length - 1; b >= 0; b--) {
    const B = bolts[b];
    const age = now - B.t0;
    if (age > B.n * 45 + 320) {
      swapRemove(bolts, b);
      continue;
    }
    const h0 = B.hops;
    B.lod = lodAt(h0[3], h0[4], h0[5], 1.6, B.lod);
    const perHop = Math.max(2, Math.floor(spellParticles("bolt", lv) / B.n));
    for (let k = 0; k < B.n; k++) {
      // mỗi bước nảy chậm hơn bước trước 45 ms → đọc được thành "bậc" lan dần
      const la = age - k * 45;
      if (la < 0) break;
      const o = k * 6;
      const ax = h0[o], ay = h0[o + 1], az = h0[o + 2], bx = h0[o + 3], by = h0[o + 4], bz = h0[o + 5];
      // đầu chạy 40 ms → giữ 45 ms → đuôi xoá 100 ms (trượt: đuôi chạy chậm hơn, vuốt nhọn dọc hướng đi)
      const win = revealWindow(la, 40, 85, B.miss ? 160 : 100);
      if (win.tail < 1) {
        const len = Math.hypot(bx - ax, by - ay, bz - az);
        const steps = Math.max(2, Math.min(5, Math.round(len / 1.3)));
        // hình gãy giữ nguyên 90 ms đầu (đọc được), rồi giật một lần
        const n = stepPath(PATH, ax, ay, az, bx, by, bz, steps, 0.34, k * 13.7 + (la > 90 ? 5.1 : 0));
        strip(PATH, n, 0, B.miss ? 0.04 : 0.1, lv === 0 ? 0.17 : 0.22, win.head, win.tail, 1, 0, P.body, 2.4, P.ink);
        // đầu nhọn vát mặt (đọc được cả khi tia lao thẳng vào máy quay)
        if (win.head < 0.999 && B.lod >= 1) {
          const f = win.head * (n - 1);
          const j = Math.min(n - 2, Math.floor(f));
          const t = f - j;
          const hx = PATH[j * 3] + (PATH[j * 3 + 3] - PATH[j * 3]) * t;
          const hy = PATH[j * 3 + 1] + (PATH[j * 3 + 4] - PATH[j * 3 + 1]) * t;
          const hz = PATH[j * 3 + 2] + (PATH[j * 3 + 5] - PATH[j * 3 + 2]) * t;
          shard(hx, hy, hz, bx - ax, by - ay, bz - az, 0.09, 0.42, 0.09, la / 30, P.body, 1.8, P.ink, 1);
        }
      }
      // tới đích: quạt vết gãy góc cạnh trong mặt phẳng trúng + vài tia (một lần)
      if (la >= 40 && !(B.fired & (1 << k)) && !B.miss) {
        B.fired |= 1 << k;
        const l = Math.hypot(bx - ax, bz - az) || 1;
        const dx = (bx - ax) / l;
        const dz = (bz - az) / l;
        const fan = B.lod >= 2 ? (lv === 0 ? 3 : 5) : B.lod >= 1 ? 3 : 0;
        for (let i = 0; i < fan; i++) {
          const ang = (i - (fan - 1) / 2) * 0.55;
          const sp = 3.2;
          emitShard("bolt", bx, by, bz, dx * Math.cos(ang) * sp, Math.sin(ang) * sp, dz * Math.cos(ang) * sp, 0.05, 0.36, 0.16, 0, 9);
        }
        // dư âm: một làn muội khét bốc lên từ chỗ trúng (lõi nghệ nóng → xám), mức ≥ vừa
        if (lv >= 1 && B.lod >= 1) {
          const g = ENV.ground(bx, bz, by + 1);
          emitPuff(bx, by, bz, dx * 0.6, 0.7, dz * 0.6, 0.5, 0.7, PUFF.soot, P.accent, 0.8, Number.isFinite(g) ? g : by - 0.6, 0.8, 2.6);
        }
        for (let i = 0; i < perHop; i++) {
          const a = vfxRand() * Math.PI * 2;
          const s = 4 + vfxRand() * 4;
          emitSpark(bx, by, bz, Math.cos(a) * s * 0.7 + dx * 3, vfxRand() * 3, Math.sin(a) * s * 0.7 + dz * 3, i % 2 ? P.body : P.core, O_CHIP);
        }
      }
    }
  }
}

function drawVortices(now: number, lv: FxLevel, dt: number) {
  const P = PAL.vortex;
  for (let i = vorts.length - 1; i >= 0; i--) {
    const V = vorts[i];
    const v = V.v;
    const age = now - v.born;
    if (age > v.dur + 420) {
      swapRemove(vorts, i);
      continue;
    }
    const x = v.pos.x;
    const y = v.pos.y;
    const z = v.pos.z;
    V.lod = lodAt(x, y, z, 5.6, V.lod);
    const live = age < v.dur;
    const ca = age - v.dur; // tuổi sau khi sập
    if (live) {
      // MÉP CỐ ĐỊNH = vùng nổ khi sập (2,8 m): hiện ra bằng đường nối chạy quanh 160 ms; 300 ms cuối nhấp nháy báo sắp sập
      const warn = v.dur - age < 300 ? 0.55 + 0.45 * Math.sin(now / 38) : 1;
      ring(x, y + 0.05, z, 2.8, 0.11, easeOutCubic(age / 160), 0, 0, warn, 0, P.body, 2.0, P.ink);
      // vùng hút 7 m: vạch đứt mảnh (lớp phụ)
      if (lv >= 1 && V.lod >= 2) ring(x, y + 0.04, z, 7, 0.05, easeOutCubic(age / 260), 40, -now / 900, 0.45, 0, P.accent, 1.3, P.ink);
      // rune xoắn trong lòng mép, quay ngược chiều tay xoắn (lớp phụ)
      if (lv >= 1 && V.lod >= 1) rune("vortex", x, y + 0.06, z, 3.2, -age / 600, 0.65 * warn * easeOutCubic(age / 200), P.body, 1.8);
      // hạt bị hút: chỉ TRONG mép, số sống ≈ ngân sách
      const cap = spellParticles("vortex", lv) * (V.lod >= 1 ? 1 : 0.4);
      V.acc += dt * (cap / 0.45);
      while (V.acc > 1) {
        V.acc--;
        const a = vfxRand() * Math.PI * 2;
        const r = 1.6 + vfxRand() * 1.1;
        emitSpark(x + Math.cos(a) * r, y + 0.3 + vfxRand() * 1.1, z + Math.sin(a) * r, -Math.cos(a) * r * 2.2 - Math.sin(a) * 3, 0.5, -Math.sin(a) * r * 2.2 + Math.cos(a) * 3, vfxRand() < 0.3 ? P.core : P.accent, O_MOTE);
      }
    }
    // 2 tay xoắn bất đối xứng nằm sát đất, cuộn vào trong (1 vòng / 1,05 s), dấu phẩy trôi vào tâm; khi sập: xói từ ngoài vào 220 ms
    const arms = lv === 0 || V.lod === 0 ? 1 : 2;
    const head = easeOutCubic(age / 160);
    const tail = live ? 0 : easeInQuad(ca / 220);
    for (let a = 0; a < arms; a++) {
      const n = spiralPath(PATH, 28, a ? 0.95 : 1.15, a ? 2.45 : 2.7, 0.3, a * Math.PI + (age / 1050) * Math.PI * 2);
      for (let j = 0; j < n; j++) {
        PATH[j * 3] += x;
        PATH[j * 3 + 1] += y + 0.07 + a * 0.01;
        PATH[j * 3 + 2] += z;
      }
      strip(PATH, n, 1, a ? 0.26 : 0.36, 0.08, head, tail, 1, 1, P.body, 1.8, P.ink);
    }
    if (!live) {
      // SẬP: vòng co 2,8 → 0,2 trong 120 ms rồi bung vòng gãy 0,3 → 3,2 m (160 ms) + chớp lõi
      if (ca < 120) ring(x, y + 0.08, z, 0.2 + 2.6 * (1 - easeInQuad(ca / 120)), 0.16, 1, 0, 0, 1, 0, P.core, 2.4, P.ink);
      const cb = ca - 120;
      if (cb >= 0) ring(x, y + 0.08, z, 0.3 + 2.9 * easeOutCubic(cb / 160), 0.22 - 0.12 * clamp01(cb / 160), 1, 16, 0.4, envelope(cb, 0, 45, 200), clamp01(cb / 240), P.body, 2.6, P.ink);
      if (cb >= 0 && !V.boom) {
        V.boom = true;
        emitSpark(x, y + 0.9, z, 0, 0, 0, P.core, O_CORE);
        const n = spellParticles("vortex", lv);
        for (let k = 0; k < n; k++) {
          const a = (k / n) * Math.PI * 2;
          const s = 6 + vfxRand() * 4;
          emitSpark(x, y + 0.5, z, Math.cos(a) * s, 1 + vfxRand() * 2.5, Math.sin(a) * s, k % 3 ? P.body : P.core, O_BOOM);
        }
        if (V.lod >= 1) for (let k = 0; k < (lv === 0 ? 4 : 8); k++) emitShard("vortex", x, y + 0.6, z, Math.cos(k * 0.785) * 5, 2 + vfxRand() * 2, Math.sin(k * 0.785) * 5, 0.07, 0.24, 0.3, 7, 3, true, y);
        // dư âm: vành khói mực cà tím bị phun ra sát đất, lõi phấn tím nguội dần
        emitDustRing(x, y, z, 0.6, puffCount(7, lv, 3), 4.2, 0.95, 1.0, PUFF.voidInk, PUFF.voidHot, 0.85);
        if (lv >= 1 && V.lod >= 2) shockwave(V0.set(x, y + 0.8, z), 0.55);
      }
    }
  }
}

function drawMeteors(now: number, lv: FxLevel) {
  const P = PAL.meteor;
  for (let i = meteors.length - 1; i >= 0; i--) {
    const m = meteors[i];
    const age = now - m.t0;
    if (m.impactAt < 0 && !m.pr.alive) {
      m.impactAt = now;
      m.ix = m.pr.pos.x;
      m.iz = m.pr.pos.z;
      const g = ENV.ground(m.ix, m.iz);
      m.iy = (Number.isFinite(g) ? g : m.pr.pos.y) + 0.06;
      // chạm: lõi loé 45 ms + mảnh mặt vỡ kem + tia lửa thấp (16 / 22 / 30 tổng)
      emitSpark(m.ix, m.iy + 0.6, m.iz, 0, 0, 0, P.core, O_CORE);
      const budget = spellParticles("meteor", lv);
      const chips = m.lod >= 1 ? Math.round(budget * 0.35) : 0;
      for (let k = 0; k < chips; k++) {
        const a = vfxRand() * Math.PI * 2;
        const s = 4 + vfxRand() * 4;
        emitShard("meteor", m.ix, m.iy + 0.2, m.iz, Math.cos(a) * s, 3 + vfxRand() * 3, Math.sin(a) * s, 0.08, 0.2, 0.55 + vfxRand() * 0.3, 14, 1.5, false, m.iy - 0.06);
      }
      for (let k = 0; k < budget - chips; k++) {
        const a = vfxRand() * Math.PI * 2;
        const s = 6 + vfxRand() * 6;
        emitSpark(m.ix, m.iy + 0.2, m.iz, Math.cos(a) * s, 1 + vfxRand() * 3, Math.sin(a) * s, k % 3 ? P.body : P.core, O_EMBER, m.iy);
      }
      // DƯ ÂM (nguội): vành bụi than hồng toả sát đất tới ~mép dấu chân + cột khói bốc lên giữa tâm; lõi cam → muội xám
      emitDustRing(m.ix, m.iy - 0.06, m.iz, 0.9, puffCount(12, lv, 4), 5.2, 1.15, 1.25, PUFF.soot, PUFF.ember, 1);
      for (let k = 0, nk = puffCount(3, lv, 1); k < nk; k++)
        emitPuff(m.ix + (vfxRand() - 0.5) * 0.8, m.iy + 0.5 + k * 0.35, m.iz + (vfxRand() - 0.5) * 0.8, (vfxRand() - 0.5) * 0.6, 1.4 + k * 0.5, (vfxRand() - 0.5) * 0.6, 1.25, 1.7, PUFF.soot, PUFF.ember, 0.9, m.iy - 0.06, 0.7, 1.8);
      if (lv >= 1 && m.lod >= 1) shockwave(V0.set(m.ix, m.iy + 0.5, m.iz), 0.8);
    }
    if (m.impactAt < 0) {
      if (age > m.T * 1000 + 2600) {
        swapRemove(meteors, i);
        continue;
      }
      m.lod = lodAt(m.tx, m.ty, m.tz, 6.4, m.lod);
      // DẤU CHÂN thật (bán kính trúng 3,2 m) hiện đủ ngay khi chốt mục tiêu: vòng mảnh san hô / mép mận
      const x = m.tx;
      const y = m.ty + 0.05;
      const z = m.tz;
      // thời gian còn lại tới lúc chạm đất, giải từ vị trí / vận tốc THẬT của thiên thạch (máy chậm: vật lý kẹp dt nên
      // chạy chậm hơn đồng hồ thật — đếm ngược và đường dự báo vẫn khớp với viên đá đang bay)
      const pr = m.pr;
      const vy = pr.vel.y;
      const trem = (vy + Math.sqrt(vy * vy + 2 * GRAVITY * Math.max(0, pr.pos.y - m.ty))) / GRAVITY;
      // NHỊP NÍN THỞ (VFX-AAA, pha 3): 90 ms cuối dấu báo trước tối dần về 30 % → cú loé lúc chạm nổi hẳn lên.
      // Bán kính mép (đúng vùng sát thương 3,2 m) KHÔNG đổi — chỉ độ sáng.
      const dip = impactDip(trem);
      ring(x, y, z, 3.2, 0.16, easeOutCubic(age / 120), 0, m.rot, dip, 0, P.body, 2.0, P.ink);
      if (lv >= 1 && m.lod >= 2) ring(x, y + 0.005, z, 2.95, 0.035, easeOutCubic(age / 200), 30, m.rot - age / 700, 0.6 * dip, 0, P.accent, 1.4, P.ink);
      // rune đích ở tâm dấu chân (lớp phụ)
      if (lv >= 1 && m.lod >= 1) rune("meteor", x, y + 0.04, z, 2.2, m.rot, 0.7 * dip * easeOutCubic(age / 150), P.body, 1.9);
      // 3 tab tam giác TRONG dấu chân trượt vào tâm 300 ms đầu (đếm ngược tới lúc rơi)
      if (m.lod >= 1) {
        const slide = easeOutCubic(age / 300);
        const close = clamp01(1 - trem / 0.18);
        const d = 2.75 - 1.15 * slide - 0.9 * easeInQuad(close);
        for (let k = 0; k < 3; k++) {
          const a = m.rot + (k * Math.PI * 2) / 3;
          const cx = Math.cos(a);
          const cz = Math.sin(a);
          shard(x + cx * d, y + 0.06, z + cz * d, -cx, 0, -cz, 0.46, 0.8, 0.06, 0, P.body, 1.9 * dip, P.ink);
        }
      }
      // ĐƯỜNG DỰ BÁO: phần parabol còn lại (nét đứt mảnh) — chính phương trình thiên thạch đang bay
      if (lv >= 1 && m.lod >= 1 && trem > 0.02) {
        const n = parabolaPath(PATH, 24, pr.pos, pr.vel, GRAVITY, 0, trem);
        strip(PATH, n, 0, 0.05, 0.07, 1, 0, 0.85, 3, P.body, 1.6, P.ink);
      }
    } else {
      const ia = now - m.impactAt;
      if (ia > 460) {
        swapRemove(meteors, i);
        continue;
      }
      // vòng gãy nở tới đúng mép 3,2 m trong 110 ms (outCubic), lõi kem nhanh hơn, rồi tắt
      ring(m.ix, m.iy + 0.04, m.iz, 0.4 + 2.8 * easeOutCubic(ia / 110), 0.28 - 0.18 * clamp01(ia / 110), 1, 14, m.rot, envelope(ia, 0, 45, 180), clamp01((ia - 60) / 200), P.body, 2.6, P.ink);
      if (m.lod >= 1) ring(m.ix, m.iy + 0.05, m.iz, 0.2 + 1.6 * easeOutCubic(ia / 70), 0.14, 1, 0, 0, envelope(ia, 0, 35, 120), 0, P.core, 2.4, P.ink);
    }
  }
}

function drawWaves(now: number, lv: FxLevel) {
  const P = PAL.wave;
  for (let i = waves.length - 1; i >= 0; i--) {
    const w = waves[i];
    const age = now - w.t0;
    if (age > 640) {
      swapRemove(waves, i);
      continue;
    }
    // mặt sóng đi đúng tầm đòn (11 m) trong 380 ms, ngọn dựng trong 80 ms, tắt 380–640 ms
    const d = 0.6 + 10.4 * easeOutCubic(age / 380);
    const cx = w.ox + w.fx * d;
    const cz = w.oz + w.fz * d;
    w.lod = lodAt(cx, w.oy + 0.8, cz, 3.6, w.lod);
    const rise = easeOutBack(age / 80);
    const fade = 1 - clamp01((age - 380) / 260);
    // RÈM: 20 điểm ngang 3 làn (3,6 m), cong lưỡi liềm (mép lùi sau), cao = chồng chập 3 sin, chân bám đất
    const N = 20;
    const amp = (lv === 0 ? 1.0 : 1.35) * rise;
    for (let j = 0; j < N; j++) {
      const u = j / (N - 1);
      const s = (u - 0.5) * 3.6;
      const back = -0.55 * (2 * u - 1) * (2 * u - 1);
      PATH[j * 3] = cx + w.sx * s + w.fx * back;
      PATH[j * 3 + 1] = w.gy + 0.02;
      PATH[j * 3 + 2] = cz + w.sz * s + w.fz * back;
      HEI[j] = 0.25 + crestHeight(u, amp, age * 0.012);
    }
    strip(PATH, N, 2, 1, 1, 1, 0, fade, 2, P.body, 1.9, P.ink, HEI);
    // DƯ ÂM: mặt sóng dừng ở tầm 11 m → bọt vỡ thành màn sương thấp trôi tiếp rồi tan (mức ≥ vừa)
    if (!w.mist && age >= 380) {
      w.mist = true;
      if (lv >= 1 && w.lod >= 1)
        for (let k = 0, nk = puffCount(4, lv, 2); k < nk; k++) {
          const s = ((k + 0.5) / nk - 0.5) * 3.2;
          emitPuff(cx + w.sx * s, w.gy + 0.7, cz + w.sz * s, w.fx * 2.2, 0.3, w.fz * 2.2, 1.0, 0.9, PUFF.mist, P.core, 0.25, w.gy, 0.2, 2.2);
        }
    }
    // 3 LÀN SIN (đúng 3 tia gây sát thương): dao động ngang λ = 2,2 m, đầu theo mặt sóng, vệt sau tắt 180–420 ms
    if (w.lod >= 1) {
      const tail = clamp01((age - 180) / 240);
      for (let l = -1; l <= 1; l++) {
        const n = 22;
        const start = Math.max(0, d - 7);
        for (let j = 0; j < n; j++) {
          const s = start + ((d - start) * j) / (n - 1);
          const lat = l * 1.1 + 0.2 * Math.sin((s / 2.2) * Math.PI * 2 - age * 0.02 + l * 2.1);
          PATH[j * 3] = w.ox + w.fx * s + w.sx * lat;
          PATH[j * 3 + 1] = w.oy + 0.8 + 0.12 * Math.sin((s / 2.2) * Math.PI * 2 + age * 0.015);
          PATH[j * 3 + 2] = w.oz + w.fz * s + w.sz * lat;
        }
        strip(PATH, n, 0, 0.03, lv === 0 ? 0.09 : 0.12, 1, tail, fade, 4, P.accent, 1.8, P.ink);
      }
    }
  }
}

function simShards(dt: number) {
  for (let i = 0; i < SIM; i++) {
    if (D.age[i] >= D.life[i]) continue;
    D.age[i] += dt;
    const k = D.age[i] / D.life[i];
    if (k >= 1) continue;
    const dr = Math.exp(-D.drag[i] * dt);
    D.vel[i * 3] *= dr;
    D.vel[i * 3 + 1] = D.vel[i * 3 + 1] * dr - D.grav[i] * dt;
    D.vel[i * 3 + 2] *= dr;
    D.pos[i * 3] += D.vel[i * 3] * dt;
    D.pos[i * 3 + 1] += D.vel[i * 3 + 1] * dt;
    D.pos[i * 3 + 2] += D.vel[i * 3 + 2] * dt;
    // chạm sàn: nằm lên mặt đất, nảy thấp, ma sát + quay chậm lại (không cắm xuyên đất)
    const fy = D.floor[i] + D.sz[i * 3] * 0.5;
    if (D.pos[i * 3 + 1] < fy) {
      D.pos[i * 3 + 1] = fy;
      if (D.vel[i * 3 + 1] < 0) D.vel[i * 3 + 1] *= -0.25;
      D.vel[i * 3] *= 0.6;
      D.vel[i * 3 + 2] *= 0.6;
      D.spin[i * 2 + 1] *= 0.7;
    }
    D.spin[i * 2] += D.spin[i * 2 + 1] * dt;
    // nảy to 10 % đầu, giữ, rồi co về 0 (mảnh đặc: co thay vì mờ — không tốn overdraw)
    const s = k < 0.1 ? easeOutBack(k / 0.1) : 1 - easeInQuad((k - 0.1) / 0.9);
    const P = PAL[PAL_IDS[D.pal[i]] ?? "shield"];
    const al = D.align[i];
    shard(
      D.pos[i * 3],
      D.pos[i * 3 + 1],
      D.pos[i * 3 + 2],
      al ? D.vel[i * 3] : D.dir[i * 3],
      al ? D.vel[i * 3 + 1] + 1e-3 : D.dir[i * 3 + 1],
      al ? D.vel[i * 3 + 2] : D.dir[i * 3 + 2],
      D.sz[i * 3] * s,
      D.sz[i * 3 + 1] * s,
      D.sz[i * 3 + 2] * s,
      D.spin[i * 2],
      k < 0.2 ? WHITE : P.body,
      k < 0.2 ? 2.4 : 1.8,
      P.ink,
      SHARD_VAR[PAL_IDS[D.pal[i]]] ?? 0,
    );
  }
}

/** bipyramid tam giác (mũi dài phía +Y): mặt phẳng, normal theo mặt */
function shardGeometry(): THREE.BufferGeometry {
  const top = [0, 1, 0];
  const bot = [0, -0.45, 0];
  const eq = [0, 1, 2].map((k) => {
    const a = (k / 3) * Math.PI * 2;
    return [Math.cos(a) * 0.5, 0.1, Math.sin(a) * 0.5];
  });
  const v: number[] = [];
  for (let k = 0; k < 3; k++) {
    const a = eq[k];
    const b = eq[(k + 1) % 3];
    v.push(...top, ...b, ...a, ...bot, ...a, ...b);
  }
  const g = new THREE.BufferGeometry();
  g.setAttribute("position", new THREE.Float32BufferAttribute(v, 3));
  g.computeVertexNormals();
  return g;
}

/** gộp các biến thể thành một hình học có thuộc tính aVar (chỉ số biến thể của từng đỉnh) */
function mergeVariants(list: THREE.BufferGeometry[]): { position: THREE.BufferAttribute; normal: THREE.BufferAttribute; aVar: THREE.BufferAttribute } {
  const pos: number[] = [];
  const nor: number[] = [];
  const vr: number[] = [];
  list.forEach((g0, k) => {
    const g = g0.index ? g0.toNonIndexed() : g0;
    if (!g.attributes.normal) g.computeVertexNormals();
    pos.push(...(g.attributes.position.array as Float32Array));
    nor.push(...(g.attributes.normal.array as Float32Array));
    for (let i = 0; i < g.attributes.position.count; i++) vr.push(k);
  });
  return { position: new THREE.Float32BufferAttribute(pos, 3), normal: new THREE.Float32BufferAttribute(nor, 3), aVar: new THREE.Float32BufferAttribute(vr, 1) };
}
/** mảnh pha lê vát Blender (shards.glb: shard_a / shard_b / shard_c) — nạp nền, thay hình học của pool khi xong */
const SHARDS_GLB = worldAsset("fx/shards.glb");

const STAT = { cpu: 0, max: 0, frames: 0, pr: 0, ps: 0, pt: 0 };
const RING_ATTRS = ["iPos", "iShape", "iMisc", "iBody", "iInk"];
const SHARD_ATTRS = ["iPos", "iDir", "iSc", "iBody", "iInk", "iVar"];
const STRIP_ATTRS = ["position", "uv", "aCol", "aInk", "aP"];
const RUNE_ATTRS = ["iPos", "iMisc", "iCol"];

export function SpellFx() {
  const camera = useThree((s) => s.camera);
  const size = useThree((s) => s.size);
  const res = useMemo(() => {
    // vòng
    const plane = new THREE.PlaneGeometry(1, 1, 64, 1);
    const rg = new THREE.InstancedBufferGeometry();
    rg.setIndex(plane.index);
    rg.setAttribute("position", plane.attributes.position);
    rg.setAttribute("uv", plane.attributes.uv);
    const inst = (arr: Float32Array, n: number) => new THREE.InstancedBufferAttribute(arr, n).setUsage(THREE.DynamicDrawUsage);
    rg.setAttribute("iPos", inst(R.pos, 3));
    rg.setAttribute("iShape", inst(R.shape, 4));
    rg.setAttribute("iMisc", inst(R.misc, 4));
    rg.setAttribute("iBody", inst(R.body, 3));
    rg.setAttribute("iInk", inst(R.ink, 3));
    rg.instanceCount = 0;
    const premult = { transparent: true, depthWrite: false, blending: THREE.CustomBlending, blendSrc: THREE.OneFactor, blendDst: THREE.OneMinusSrcAlphaFactor, toneMapped: false, side: THREE.DoubleSide } as const;
    // uBrushK: 1 = đọc atlas nét cọ (mức vừa / cao), 0 = không đọc texture (mức thấp) — đặt mỗi khung theo mức
    const brushU = { uBrush: { value: brushAtlas() }, uBrushK: { value: 1 } };
    const rm = new THREE.ShaderMaterial({ vertexShader: RING_VS, fragmentShader: RING_FS, uniforms: brushU, ...premult });
    const rings = new THREE.Mesh(rg, rm);
    rings.frustumCulled = false;
    rings.renderOrder = 12;
    rings.name = "perf:spellfx";
    // mảnh
    const base = shardGeometry();
    const sg = new THREE.InstancedBufferGeometry();
    // tạm: bipyramid cho cả 3 biến thể (tới khi shards.glb nạp xong)
    const tmpV = mergeVariants([base, base, base]);
    sg.setAttribute("position", tmpV.position);
    sg.setAttribute("normal", tmpV.normal);
    sg.setAttribute("aVar", tmpV.aVar);
    sg.setAttribute("iVar", inst(S.var, 1));
    sg.setAttribute("iPos", inst(S.pos, 3));
    sg.setAttribute("iDir", inst(S.dir, 3));
    sg.setAttribute("iSc", inst(S.sc, 4));
    sg.setAttribute("iBody", inst(S.body, 3));
    sg.setAttribute("iInk", inst(S.ink, 3));
    sg.instanceCount = 0;
    const sm = new THREE.ShaderMaterial({ vertexShader: SHARD_VS, fragmentShader: SHARD_FS, toneMapped: false, side: THREE.DoubleSide });
    const shards = new THREE.Mesh(sg, sm);
    shards.frustumCulled = false;
    shards.renderOrder = 11;
    // dải
    const tg = new THREE.BufferGeometry();
    const idx: number[] = [];
    for (let k = 0; k < K; k++)
      for (let i = 0; i < M - 1; i++) {
        const a = (k * M + i) * 2;
        idx.push(a, a + 1, a + 2, a + 1, a + 3, a + 2);
      }
    tg.setIndex(idx);
    const dyn = (arr: Float32Array, n: number) => new THREE.BufferAttribute(arr, n).setUsage(THREE.DynamicDrawUsage);
    tg.setAttribute("position", dyn(T.pos, 3));
    tg.setAttribute("uv", dyn(T.uv, 2));
    tg.setAttribute("aCol", dyn(T.col, 3));
    tg.setAttribute("aInk", dyn(T.ink, 3));
    tg.setAttribute("aP", dyn(T.p, 4));
    tg.setDrawRange(0, 0);
    const tm = new THREE.ShaderMaterial({ vertexShader: STRIP_VS, fragmentShader: STRIP_FS, uniforms: { uT: { value: 0 }, ...brushU }, ...premult });
    const strips = new THREE.Mesh(tg, tm);
    strips.frustumCulled = false;
    strips.renderOrder = 12;
    // rune (dấu phép trên đất): tấm vuông nằm phẳng instanced ≤ 6, cộng sáng, 1 lần đọc texture
    const ug = new THREE.InstancedBufferGeometry();
    const uq = new THREE.PlaneGeometry(1, 1);
    ug.setIndex(uq.index);
    ug.setAttribute("position", uq.attributes.position);
    ug.setAttribute("uv", uq.attributes.uv);
    ug.setAttribute("iPos", inst(U.pos, 3));
    ug.setAttribute("iMisc", inst(U.misc, 4));
    ug.setAttribute("iCol", inst(U.col, 3));
    ug.instanceCount = 0;
    const um = new THREE.ShaderMaterial({ vertexShader: RUNE_VS, fragmentShader: RUNE_FS, uniforms: { uRunes: { value: runeSheet() } }, ...premult, blendDst: THREE.OneFactor });
    const runes = new THREE.Mesh(ug, um);
    runes.frustumCulled = false;
    runes.renderOrder = 11;
    plane.dispose();
    return { rg, rm, rings, base, sg, sm, shards, tg, tm, strips, ug, uq, um, runes, brushU, prev: { r: 0, s: 0, t: 0, u: 0 } };
  }, []);
  useEffect(
    () => () => {
      res.rg.dispose();
      res.rm.dispose();
      res.base.dispose();
      res.sg.dispose();
      res.sm.dispose();
      res.tg.dispose();
      res.tm.dispose();
      res.ug.dispose();
      res.uq.dispose();
      res.um.dispose();
    },
    [res],
  );
  useEffect(() => {
    // nạp mảnh pha lê vát (Blender) nền: chỉ thay thuộc tính hình học của pool — cùng chương trình shader, vẫn 1 lệnh vẽ
    let alive = true;
    new GLTFLoader().load(
      SHARDS_GLB,
      (gltf) => {
        if (!alive) return;
        const list = ["shard_a", "shard_b", "shard_c"].map((n) => (gltf.scene.getObjectByName(n) as THREE.Mesh | undefined)?.geometry);
        if (list.some((g) => !g)) return;
        const v = mergeVariants(list as THREE.BufferGeometry[]);
        res.sg.setAttribute("position", v.position);
        res.sg.setAttribute("normal", v.normal);
        res.sg.setAttribute("aVar", v.aVar);
      },
      undefined,
      () => {},
    );
    return () => {
      alive = false;
    };
  }, [res]);
  useEffect(() => {
    if (process.env.NODE_ENV === "production") return;
    // DEV: số phần tử đang vẽ + thời gian CPU của vòng cập nhật (trung bình / đỉnh từ lần gọi trước, đặt lại sau mỗi lần đọc)
    (window as unknown as { __spellfx: unknown }).__spellfx = () => {
      const r = { rings: R.n, shards: S.n, strips: T.n, peakRings: STAT.pr, peakShards: STAT.ps, peakStrips: STAT.pt, cpuAvgMs: +(STAT.cpu / Math.max(1, STAT.frames)).toFixed(3), cpuMaxMs: +STAT.max.toFixed(3), frames: STAT.frames };
      Object.assign(STAT, { cpu: 0, max: 0, frames: 0, pr: 0, ps: 0, pt: 0 });
      return r;
    };
  }, []);
  useFrame((_, rawDt) => {
    const c0 = performance.now();
    // DEV: window.__fxFreeze(ms) (fx/fxClock.ts) dừng đồng hồ MỌI hiệu ứng sau ms (chụp ảnh kiểm tra từng pha); 0 = chạy lại
    const now = FX_FREEZE.at > 0 ? fxNow() : c0;
    const dt = fxFrozen() ? 0 : Math.min(0.05, rawDt);
    const lv = fxLevel();
    CAMP.copy(camera.position);
    VIEW_H = size.height;
    FOV = (camera as THREE.PerspectiveCamera).fov ?? 50;
    R.n = 0;
    S.n = 0;
    T.n = 0;
    U.n = 0;
    S.cap = SHARD_CAP[lv];
    res.brushU.uBrushK.value = lv >= 1 ? 1 : 0;
    if (casts.length) drawCasts(now);
    drawShield(now, lv);
    if (bolts.length) drawBolts(now, lv);
    if (vorts.length) drawVortices(now, lv, dt);
    if (meteors.length) drawMeteors(now, lv);
    if (waves.length) drawWaves(now, lv);
    simShards(dt);
    // tải lên GPU chỉ phần đang dùng (và một lần khi về 0 để xoá)
    const pv = res.prev;
    if (R.n || pv.r) {
      res.rg.instanceCount = R.n;
      for (const name of RING_ATTRS) {
        const a = res.rg.attributes[name] as THREE.InstancedBufferAttribute;
        a.clearUpdateRanges();
        a.addUpdateRange(0, Math.max(1, R.n) * a.itemSize);
        a.needsUpdate = true;
      }
    }
    if (S.n || pv.s) {
      res.sg.instanceCount = S.n;
      for (const name of SHARD_ATTRS) {
        const a = res.sg.attributes[name] as THREE.InstancedBufferAttribute;
        a.clearUpdateRanges();
        a.addUpdateRange(0, Math.max(1, S.n) * a.itemSize);
        a.needsUpdate = true;
      }
    }
    if (U.n || pv.u) {
      res.ug.instanceCount = U.n;
      for (const name of RUNE_ATTRS) {
        const a = res.ug.attributes[name] as THREE.InstancedBufferAttribute;
        a.clearUpdateRanges();
        a.addUpdateRange(0, Math.max(1, U.n) * a.itemSize);
        a.needsUpdate = true;
      }
    }
    if (T.n || pv.t) {
      res.tg.setDrawRange(0, T.n * (M - 1) * 6);
      for (const name of STRIP_ATTRS) {
        const a = res.tg.attributes[name] as THREE.BufferAttribute;
        a.clearUpdateRanges();
        a.addUpdateRange(0, Math.max(1, T.n) * M * 2 * a.itemSize);
        a.needsUpdate = true;
      }
      res.tm.uniforms.uT.value = (now / 1000) % 1000;
    }
    pv.r = R.n;
    pv.s = S.n;
    pv.t = T.n;
    pv.u = U.n;
    const c = performance.now() - c0;
    STAT.cpu += c;
    STAT.max = Math.max(STAT.max, c);
    STAT.frames++;
    STAT.pr = Math.max(STAT.pr, R.n);
    STAT.ps = Math.max(STAT.ps, S.n);
    STAT.pt = Math.max(STAT.pt, T.n);
  });
  return (
    <>
      <primitive object={res.rings} />
      <primitive object={res.shards} />
      <primitive object={res.strips} />
      <primitive object={res.runes} />
    </>
  );
}
