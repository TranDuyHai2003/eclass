"use client";
/**
 * VFX-AAA (luật 3) — HÌNH 3D RIÊNG cho từng loại đòn / sự kiện, thay "vòng tròn đổi màu" addFx("ring" | "nova" | "vring").
 * Bảng ánh xạ chỗ gọi cũ → hình mới: docs/ai-reviews/vfx-aaa/AUDIT.md §8.
 *
 * 3 pool instanced dùng chung = +3 lệnh vẽ cho MỌI sự kiện (ngân sách mobile ≤ 20):
 *  • DECAL (tấm phẳng sát đất, SDF): nêm / quạt, viền + vết cháy, lưới 90°, bàn cờ mã, mặt đồng hồ, đa giác tụ, trường lục giác,
 *    sao nhọn — mép gameplay (bán kính / góc thật) là nét mảnh sắc + quầng mực tối (đọc được khi tắt bloom);
 *  • DẢI (CPU dựng vào bộ đệm cố định): vết nứt zigzag nằm đất, cung chém, rèm sóng cuộn, tua xoắn, xích catenary, chevron;
 *  • KHỐI ĐẶC (hộp instanced, ghi depth → có viền mực Ink, không overdraw): phiến đá trồi, cột rơi, cột nhịp, vách phản xạ,
 *    thanh lồng, gai pha lê.
 * Mỗi sự kiện chạy nhịp 5 pha (lib/world/strikeShapes.ts beatAt): báo trước (mép vẽ vòng) → nín thở → cao trào (HDR vọt) →
 * duy trì → nguội (nhiệt → muội, xói theo nhiễu, khối thụt xuống) + khói / bụi Puffs ở cao trào / lúc nguội.
 * Bảng màu 3 giá trị: mực tối (viền) · thân (≤ 1, không loé) · lõi HDR (chỉ lõi + mép loé theo nhịp).
 * Zero-alloc mỗi khung (bản ghi sự kiện + mảng typed dựng sẵn), RNG có hạt giống, giảm chuyển động (đỉnh cao trào thấp).
 */
import { useEffect, useMemo } from "react";
import { useFrame, useThree } from "@react-three/fiber";
import * as THREE from "three";
import { useGfx } from "../gfx";
import { useWorld } from "../store";
import { fxNow, fxReducedMotion } from "./fxClock";
import { PUFF, emitDustRing, emitPuff } from "./Puffs";
import { emitSpark, type SparkOpts } from "./Sparks";
import { blankTexture, whenVfxTextures } from "./vfxTextures";
import { vfxRand } from "@/lib/world/vfxRng";
import { STRIKE_BEATS, beatAt, catenary, isKnightCell, lodCount, newBeat, strikeDuration, tendril, zigzagCrack, type StrikeShape } from "@/lib/world/strikeShapes";

type Lv = 0 | 1 | 2;
function level(): Lv {
  const v = (useGfx.getState().vfx ?? 1) as Lv;
  return useWorld.getState().quality === "low" ? 0 : v;
}

// ───────────── Sự kiện (bản ghi dựng sẵn, tái dùng) ─────────────

const MAXE = 16;
type Ev = {
  on: boolean;
  shape: StrikeShape;
  t0: number;
  dur: number;
  x: number;
  y: number;
  z: number;
  yaw: number;
  r: number;
  n: number;
  arc: number;
  seed: number;
  fired: number;
  body: THREE.Color;
  ink: THREE.Color;
  core: THREE.Color;
};
const EVS: Ev[] = Array.from({ length: MAXE }, () => ({
  on: false,
  shape: "rupture" as StrikeShape,
  t0: 0,
  dur: 0,
  x: 0,
  y: 0,
  z: 0,
  yaw: 0,
  r: 1,
  n: 0,
  arc: 0,
  seed: 0,
  fired: 0,
  body: new THREE.Color(),
  ink: new THREE.Color(),
  core: new THREE.Color(),
}));
const DEEP = new THREE.Color("#1d1630");
const WHITE = new THREE.Color(1, 1, 1);
const STATS = { live: 0, peak: 0, decals: 0, strips: 0, solids: 0 };
if (typeof window !== "undefined" && process.env.NODE_ENV !== "production") {
  const w = window as unknown as Record<string, unknown>;
  w.__strikefx = () => {
    const r = { ...STATS };
    STATS.peak = 0;
    return r;
  };
  // DEV: xem thử một hình tại chỗ người chơi — window.__strike("rupture", 3, "#ffd27a")
  w.__strike = (shape: StrikeShape, r = 3, color = "#ffd27a", yaw?: number, n = 0) => {
    const s = useWorld.getState();
    strike(shape, s.player.x, s.player.y + 0.05, s.player.z, { r, color, yaw: yaw ?? s.playerYaw, n });
  };
}

export interface StrikeOpts {
  /** bán kính / tầm (m) — đúng vùng sát thương của luật */
  r?: number;
  /** hướng (rad, như playerYaw: 0 = +z) */
  yaw?: number;
  /** màu thân (chuỗi hex); mực + lõi suy ra (3 giá trị) */
  color?: string;
  /** số phần tử (vết nứt, cột, thanh, cánh sao, cạnh đa giác…) — 0 = mặc định của hình */
  n?: number;
  /** nửa góc mở (rad) cho "wedge" */
  arc?: number;
}

/** Phát một hình tại (x, y = mặt đất, z). Vùng / thời gian luật chơi KHÔNG phụ thuộc hình này (chỉ để nhìn). */
export function strike(shape: StrikeShape, x: number, y: number, z: number, o: StrikeOpts = {}) {
  let e = EVS.find((q) => !q.on);
  if (!e) e = EVS.reduce((a, b) => (a.t0 < b.t0 ? a : b));
  e.on = true;
  e.shape = shape;
  e.t0 = fxNow();
  e.dur = strikeDuration(STRIKE_BEATS[shape]);
  e.x = x;
  e.y = y;
  e.z = z;
  e.yaw = o.yaw ?? 0;
  e.r = Math.max(0.2, o.r ?? 2);
  e.n = o.n ?? 0;
  e.arc = o.arc ?? Math.PI / 6;
  e.seed = Math.floor(vfxRand() * 1e6);
  e.fired = 0;
  e.body.set(o.color ?? "#ffd27a");
  // 3 giá trị: mực = thân tối đi + ngả về tím than; lõi = thân ngả trắng (HDR nhân theo nhịp)
  e.ink.copy(e.body).multiplyScalar(0.25).lerp(DEEP, 0.55);
  e.core.copy(e.body).lerp(WHITE, 0.45);
}

// ───────────── Pool DECAL ─────────────

const MAXD = 16;
const DK = { wedge: 0, rim: 1, grid: 2, knight: 3, dial: 4, sigil: 5, hex: 6, star: 7 } as const;
const D = {
  pos: new Float32Array(MAXD * 3),
  a: new Float32Array(MAXD * 4), // R, yaw, kind, P1
  b: new Float32Array(MAXD * 4), // draw, glow, heat, erode
  c: new Float32Array(MAXD * 4), // P2, P3, seed, alpha
  body: new Float32Array(MAXD * 3),
  ink: new Float32Array(MAXD * 3),
  core: new Float32Array(MAXD * 3),
  n: 0,
};
function decal(e: Ev, kind: number, R: number, p1: number, draw: number, glow: number, heat: number, erode: number, p2 = 0, p3 = 0, alpha = 1, yaw = e.yaw) {
  if (D.n >= MAXD || alpha <= 0.003 || R <= 0) return;
  const i = D.n++;
  D.pos[i * 3] = e.x;
  D.pos[i * 3 + 1] = e.y + 0.025 + i * 0.002;
  D.pos[i * 3 + 2] = e.z;
  D.a[i * 4] = R;
  D.a[i * 4 + 1] = yaw;
  D.a[i * 4 + 2] = kind;
  D.a[i * 4 + 3] = p1;
  D.b[i * 4] = draw;
  D.b[i * 4 + 1] = glow;
  D.b[i * 4 + 2] = heat;
  D.b[i * 4 + 3] = erode;
  D.c[i * 4] = p2;
  D.c[i * 4 + 1] = p3;
  D.c[i * 4 + 2] = (e.seed % 997) / 997;
  D.c[i * 4 + 3] = alpha;
  col3(D.body, i, e.body, 0.85);
  col3(D.ink, i, e.ink, 1);
  col3(D.core, i, e.core, 1);
}
function col3(arr: Float32Array, i: number, c: THREE.Color, k: number) {
  arr[i * 3] = c.r * k;
  arr[i * 3 + 1] = c.g * k;
  arr[i * 3 + 2] = c.b * k;
}

const DECAL_VS = /* glsl */ `
attribute vec3 iPos; attribute vec4 iA; attribute vec4 iB; attribute vec4 iC; attribute vec3 iBody; attribute vec3 iInk; attribute vec3 iCore;
varying vec2 vP; varying vec4 vA; varying vec4 vB; varying vec4 vC; varying vec3 vBody; varying vec3 vInk; varying vec3 vCore;
void main(){
  vA = iA; vB = iB; vC = iC; vBody = iBody; vInk = iInk; vCore = iCore;
  float S = iA.x * 1.12 + 0.3;
  vP = position.xy * 2.0 * S;            // toạ độ cục bộ (m), +y = phía trước
  float c = cos(iA.y), s = sin(iA.y);
  // yaw kiểu playerYaw: phía trước = (sin yaw, 0, cos yaw)
  vec3 wp = iPos + vec3(vP.x * c + vP.y * s, 0.0, -vP.x * s + vP.y * c);
  gl_Position = projectionMatrix * viewMatrix * vec4(wp, 1.0);
}`;

const DECAL_FS = /* glsl */ `
uniform sampler2D uNoise; uniform float uT;
varying vec2 vP; varying vec4 vA; varying vec4 vB; varying vec4 vC; varying vec3 vBody; varying vec3 vInk; varying vec3 vCore;
float lineAA(float d, float w){ float px = fwidth(d) + 1e-4; float ww = max(w, px * 1.3); return 1.0 - smoothstep(ww, ww + px * 1.2, abs(d)); }
float hexEdge(vec2 p){
  const vec2 s = vec2(1.0, 1.7320508);
  vec4 hc = floor(vec4(p, p - vec2(0.5, 1.0)) / s.xyxy) + 0.5;
  vec4 h = vec4(p - hc.xy * s, p - (hc.zw + 0.5) * s);
  vec2 q = dot(h.xy, h.xy) < dot(h.zw, h.zw) ? h.xy : h.zw;
  q = abs(q);
  return 0.5 - max(dot(q, s * 0.5), q.x);
}
void main(){
  float R = max(vA.x, 0.05); float kind = vA.z; float P1 = vA.w;
  float draw = vB.x; float glow = vB.y; float heat = vB.z; float erode = vB.w;
  vec2 p = vP; float r = length(p);
  float th = atan(p.x, p.y + 1e-5);           // 0 = phía trước
  float a01 = th / 6.2831853 + 0.5;
  float edge = 0.0;   // nét sắc (lõi HDR)
  float halo = 0.0;   // quầng mực tối quanh nét
  float fill = 0.0;   // tô nhạt bên trong (màu thân)
  float soot = 0.0;   // vết cháy tối (nguội)
  if (kind < 0.5) {
    // NÊM / QUẠT: nửa góc P1, bán kính R — mép đúng vùng trúng; chevron trôi ra ngoài
    float inA = step(abs(th), P1);
    float inR = step(r, R * draw);
    float rim = lineAA(r - R, 0.05) * inA;
    float dS = r * sin(clamp(abs(th) - P1, -1.5, 1.5));
    float sides = lineAA(dS, 0.035) * step(r, R) * step(-0.05, abs(th) - P1 + 0.05) * step(abs(th) - P1, 0.4);
    edge = max(rim, sides) * inR;
    halo = max(lineAA(r - R, 0.13) * inA, lineAA(dS, 0.1) * step(r, R) * step(abs(th) - P1, 0.4)) * inR;
    float chev = step(0.62, fract(r / R * 4.0 - abs(th) * 0.9 - uT * 2.2));
    fill = inA * inR * step(r, R) * (0.12 + 0.2 * chev);
  } else if (kind < 1.5) {
    // VIỀN mảnh đúng bán kính (vẽ vòng theo draw) + vết cháy muội khi nguội (P1 = độ đậm muội)
    float dash = step(0.38, fract(a01 * max(8.0, floor(R * 5.0))));
    float rim = lineAA(r - R, 0.035) * step(a01, draw) * dash;
    edge = rim * 0.6;
    halo = lineAA(r - R, 0.1) * step(a01, draw) * dash * 0.8;
    float nz = texture2D(uNoise, p / R * 0.55 + vC.z).r;
    soot = P1 * (1.0 - smoothstep(R * 0.35, R * 0.95, r + (nz - 0.5) * R * 0.35));
  } else if (kind < 2.5) {
    // LƯỚI TRỰC GIAO 90° (ô P1 m) trong vùng R — quét dần theo phía trước (draw)
    float inR = step(r, R);
    vec2 g = abs(fract(p / P1 + 0.5) - 0.5) * P1;
    float ln = max(lineAA(g.x, 0.025), lineAA(g.y, 0.025)) * inR;
    float scan = step(p.y, mix(-R, R, draw));
    edge = max(ln * 0.8, lineAA(r - R, 0.045)) * scan;
    halo = max(max(lineAA(g.x, 0.07), lineAA(g.y, 0.07)) * inR * 0.6, lineAA(r - R, 0.12)) * scan;
    vec2 ci = floor(p / P1);
    fill = inR * scan * 0.1 * step(0.5, fract((ci.x + ci.y) * 0.5));
  } else if (kind < 3.5) {
    // BÀN CỜ MÃ: 5×5 ô P1 m quanh quân Mã, 8 ô nước Mã đậm (đúng ô trúng đòn của luật)
    vec2 ci = floor(p / P1 + 0.5);
    vec2 q = abs(p / P1 - ci) * P1;
    float inB = step(abs(ci.x), 2.0) * step(abs(ci.y), 2.0);
    float kn = step(abs(abs(ci.x) * abs(ci.y) - 2.0), 0.1);   // |x|·|y| = 2 ⇔ (1,2) hoặc (2,1)
    float border = max(lineAA(q.x - P1 * 0.5, 0.025), lineAA(q.y - P1 * 0.5, 0.025)) * inB;
    float kb = max(lineAA(q.x - P1 * 0.42, 0.04), lineAA(q.y - P1 * 0.42, 0.04)) * step(q.x, P1 * 0.43) * step(q.y, P1 * 0.43) * kn;
    float order = fract(atan(ci.x, ci.y + 1e-3) / 6.2831853 + 0.5);
    float on = step(order, draw);
    edge = max(border * 0.35, kb * on);
    halo = border * 0.5 + kb * on * 0.6;
    fill = inB * (0.06 + 0.5 * kn * on);
  } else if (kind < 4.5) {
    // MẶT ĐỒNG HỒ: 12 vạch, 2 vòng, 2 kim quay NGƯỢC (P2 = góc kim)
    float rim = max(lineAA(r - R, 0.05), lineAA(r - R * 0.72, 0.03));
    float tk = abs(fract(a01 * 12.0 + 0.5) - 0.5) / 12.0 * 6.2831853 * r;
    float ticks = lineAA(tk, 0.04) * step(R * 0.8, r) * step(r, R);
    vec2 h1 = vec2(sin(vC.x), cos(vC.x));
    vec2 h2 = vec2(sin(vC.x * 0.0833 + 1.3), cos(vC.x * 0.0833 + 1.3));
    float d1 = abs(p.x * h1.y - p.y * h1.x);
    float d2 = abs(p.x * h2.y - p.y * h2.x);
    float hands = max(lineAA(d1, 0.035) * step(0.0, dot(p, h1)) * step(r, R * 0.9), lineAA(d2, 0.06) * step(0.0, dot(p, h2)) * step(r, R * 0.6));
    float vis = step(a01, draw);
    edge = max(max(rim, ticks), hands) * vis;
    halo = max(lineAA(r - R, 0.13), max(ticks, hands) * 0.6) * vis;
    fill = step(r, R) * 0.08 * vis;
  } else if (kind < 5.5) {
    // ĐA GIÁC TỤ (sigil): P1 cạnh, xoay P2; vòng trong xoay ngược
    float n = max(P1, 3.0);
    float seg = 6.2831853 / n;
    float a1 = th + vC.x;
    float d1 = cos(floor(0.5 + a1 / seg) * seg - a1) * r - R;
    float a2 = th - vC.x * 1.6 + seg * 0.5;
    float d2 = cos(floor(0.5 + a2 / seg) * seg - a2) * r - R * 0.78;
    edge = max(lineAA(d1, 0.045), lineAA(d2, 0.03) * 0.8) * draw;
    halo = max(lineAA(d1, 0.12), lineAA(d2, 0.09)) * draw;
    fill = step(d1, 0.0) * 0.07 * draw;
  } else if (kind < 6.5) {
    // TRƯỜNG LỤC GIÁC (ô P1) trong R + viền
    float inR = step(r, R * draw);
    float he = hexEdge(p / P1);
    float ln = lineAA(he * P1, 0.022) * inR;
    edge = max(ln * 0.75, lineAA(r - R, 0.05) * step(a01, draw));
    halo = max(lineAA(he * P1, 0.06) * inR * 0.5, lineAA(r - R, 0.13) * step(a01, draw));
    fill = inR * step(r, R) * 0.1;
  } else {
    // SAO NHỌN: P1 cánh tới đúng R
    float n = max(P1, 3.0);
    float f = abs(cos(n * th * 0.5));
    float f2 = f * f; float f4 = f2 * f2;
    float rs = R * (0.32 + 0.68 * f4 * f2) * draw;
    edge = lineAA(r - rs, 0.045);
    halo = lineAA(r - rs, 0.12);
    fill = step(r, rs) * 0.16;
  }
  // xói khi nguội (theo nhiễu, không mờ đều) + alpha tổng
  float nz = texture2D(uNoise, p * 0.35 + vC.z * 3.0).r;
  float keep = smoothstep(erode - 0.08, erode + 0.02, nz * 0.92 + 0.04);
  float A = vC.w * keep;
  edge *= A; halo *= A; fill *= A; soot *= vC.w;
  // mực che (alpha pha trộn) · thân tô nhạt · nét lõi cộng sáng HDR theo nhịp (chỉ phần này vượt ngưỡng bloom)
  float ink = max(halo - edge, 0.0) * 0.88;
  vec3 hotC = mix(vBody * 1.2, vCore, 0.55) * (0.6 + 0.9 * glow) + vec3(1.0, 0.55, 0.2) * heat * 0.2 * glow;
  vec3 c = vBody * fill * 0.8 + hotC * edge;
  float occ = ink + fill * 0.35 + soot * 0.6;
  c = c * (1.0 - soot * 0.5) + vInk * ink * 0.6;
  float a = max(occ, edge * 0.2);
  if (a < 0.004 && dot(c, c) < 1e-5) discard;
  gl_FragColor = vec4(c, clamp(occ, 0.0, 0.95));
}`;

// ───────────── Pool DẢI ─────────────

const K = 24;
const M = 24;
const T = {
  pos: new Float32Array(K * M * 2 * 3),
  uv: new Float32Array(K * M * 2 * 2),
  col: new Float32Array(K * M * 2 * 3),
  ink: new Float32Array(K * M * 2 * 3),
  p: new Float32Array(K * M * 2 * 4), // alpha, head, tail, style
  q: new Float32Array(K * M * 2 * 2), // heat, erode
  n: 0,
};
const PATH = new Float32Array(M * 3);
const HEI = new Float32Array(M);
const CAMP = new THREE.Vector3();
/** style: 0 vết nứt (lõi nóng → muội) · 1 năng lượng · 2 rèm sóng · 3 xích · 4 chevron */
function strip(pts: Float32Array, n: number, orient: 0 | 1 | 2, w0: number, w1: number, head: number, tail: number, alpha: number, style: number, body: THREE.Color, k: number, ink: THREE.Color, heat: number, erode: number, hei?: Float32Array) {
  if (T.n >= K || n < 2 || alpha <= 0.003 || tail >= head) return;
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
    if (orient === 2) oy = hei ? hei[j] : 1;
    else {
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
      const far = Math.min(2.2, Math.max(1, Math.hypot(CAMP.x - px, CAMP.y - py, CAMP.z - pz) / 13));
      const w = (w0 + (w1 - w0) * u) * 0.5 * far;
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
      T.q[q * 2] = heat;
      T.q[q * 2 + 1] = erode;
    }
  }
}
const STRIP_VS = /* glsl */ `
attribute vec3 aCol; attribute vec3 aInk; attribute vec4 aP; attribute vec2 aQ;
varying vec2 vUv; varying vec3 vCol; varying vec3 vInk; varying vec4 vP; varying vec2 vQ;
void main(){ vUv = uv; vCol = aCol; vInk = aInk; vP = aP; vQ = aQ; gl_Position = projectionMatrix * modelViewMatrix * vec4(position, 1.0); }`;
const STRIP_FS = /* glsl */ `
uniform sampler2D uNoise; uniform float uT;
varying vec2 vUv; varying vec3 vCol; varying vec3 vInk; varying vec4 vP; varying vec2 vQ;
void main(){
  float u = vUv.x; float head = vP.y; float tail = vP.z; float st = vP.w;
  if (u > head || u < tail) discard;
  float x = abs(vUv.y * 2.0 - 1.0);
  float heat = vQ.x; float erode = vQ.y;
  float nz = texture2D(uNoise, vec2(u * 3.1 + vP.x * 0.0, vUv.y * 0.5 + u * 0.7)).r;
  if (nz * 0.92 + 0.04 < erode) discard;
  vec3 c; float a = vP.x; float occ = 0.0;
  if (st < 0.5) {
    // VẾT NỨT: lõi nóng mảnh (cam → muội khi nguội), mép mực rộng; đầu mũi nhọn
    float w = mix(1.0, 0.35, smoothstep(0.7, 1.0, u));
    if (x > w) discard;
    float xx = x / w;
    float core = 1.0 - smoothstep(0.1, 0.32, xx);
    float ink = smoothstep(0.4, 0.75, xx);
    vec3 hot = mix(vCol, vec3(2.6, 1.5, 0.6), 0.45) * (0.4 + 1.6 * heat);
    c = mix(mix(hot * core, vInk, ink), vInk * 0.6, 1.0 - heat) ;
    occ = 0.55 + 0.35 * ink;
  } else if (st < 1.5) {
    // NĂNG LƯỢNG: lõi trắng → thân → mép mực, đuôi tắt
    float prof = 1.0 - x * x;
    float ink = smoothstep(0.62, 0.9, x);
    c = mix(mix(vCol, vec3(2.4, 2.3, 2.1), smoothstep(0.55, 1.0, prof)), vInk, ink);
    a *= smoothstep(tail, tail + 0.2, u);
    occ = ink * 0.7;
  } else if (st < 2.5) {
    // RÈM SÓNG: hõm sẫm dưới → thân → bọt sáng ở ngọn (v = 0 chân, 1 đỉnh)
    float y = vUv.y;
    float foamEdge = 0.78 + 0.08 * sin(u * 61.0 + uT * 8.0) + 0.06 * (nz - 0.5);
    c = mix(vCol, vInk, 1.0 - smoothstep(0.05, 0.4, y));
    c = mix(c, vec3(2.4, 2.6, 2.6), smoothstep(foamEdge - 0.06, foamEdge, y));
    a *= (1.0 - smoothstep(0.92, 1.0, y)) * (0.5 + 0.5 * smoothstep(0.0, 0.4, y));
    occ = (1.0 - smoothstep(0.05, 0.4, y)) * 0.6;
  } else if (st < 3.5) {
    // XÍCH: mắt xích oval xen kẽ dọc dải (đặc, có mép mực), loé khi căng
    float lk = fract(u * 16.0);
    vec2 q = vec2((lk - 0.5) * 2.0, vUv.y * 2.0 - 1.0);
    float ov = length(q * vec2(1.0, 1.25));
    float ringL = 1.0 - smoothstep(0.08, 0.2, abs(ov - 0.72));
    if (ringL < 0.05) discard;
    c = mix(vInk, vCol * (0.8 + 1.4 * heat), smoothstep(0.3, 0.9, ringL));
    occ = 0.8;
  } else {
    // CHEVRON: mũi tên đặc lõi sáng
    float ink = smoothstep(0.55, 0.85, x);
    c = mix(vec3(2.2, 2.1, 1.9) * (0.5 + heat), vInk, ink);
    occ = ink * 0.8;
  }
  if (a < 0.004) discard;
  gl_FragColor = vec4(c * a, a * occ);
}`;

// ───────────── Pool KHỐI ĐẶC ─────────────

const MAXS = 64;
const S = {
  pos: new Float32Array(MAXS * 3),
  dir: new Float32Array(MAXS * 3),
  sc: new Float32Array(MAXS * 4), // rộng X, cao (trục dir), dày Z, xoay quanh trục
  body: new Float32Array(MAXS * 3),
  ink: new Float32Array(MAXS * 3),
  hot: new Float32Array(MAXS * 4), // lõi rgb, nhiệt
  n: 0,
};
function solid(x: number, y: number, z: number, dx: number, dy: number, dz: number, w: number, h: number, d: number, spin: number, e: Ev, heat: number, glow: number) {
  if (S.n >= MAXS || w <= 0.002 || h <= 0.002) return;
  const i = S.n++;
  S.pos[i * 3] = x;
  S.pos[i * 3 + 1] = y;
  S.pos[i * 3 + 2] = z;
  S.dir[i * 3] = dx;
  S.dir[i * 3 + 1] = dy;
  S.dir[i * 3 + 2] = dz;
  S.sc[i * 4] = w;
  S.sc[i * 4 + 1] = h;
  S.sc[i * 4 + 2] = d;
  S.sc[i * 4 + 3] = spin;
  // khối: thân tối hơn (đá / pha lê mờ), mép mực; lõi nóng chỉ ở đỉnh khi đang nóng
  S.body[i * 3] = e.body.r * 0.55 + e.ink.r * 0.45;
  S.body[i * 3 + 1] = e.body.g * 0.55 + e.ink.g * 0.45;
  S.body[i * 3 + 2] = e.body.b * 0.55 + e.ink.b * 0.45;
  col3(S.ink, i, e.ink, 1);
  S.hot[i * 4] = e.core.r * glow;
  S.hot[i * 4 + 1] = e.core.g * glow;
  S.hot[i * 4 + 2] = e.core.b * glow;
  S.hot[i * 4 + 3] = heat;
}
const SOLID_VS = /* glsl */ `
attribute vec3 iPos; attribute vec3 iDir; attribute vec4 iSc; attribute vec3 iBody; attribute vec3 iInk; attribute vec4 iHot;
varying vec3 vN; varying vec3 vBody; varying vec3 vInk; varying vec4 vHot; varying float vY;
void main(){
  vec3 Y = normalize(iDir + vec3(0.0, 1e-5, 0.0));
  vec3 ref = abs(Y.y) > 0.95 ? vec3(1.0, 0.0, 0.0) : vec3(0.0, 1.0, 0.0);
  vec3 X = normalize(cross(ref, Y));
  vec3 Z = cross(X, Y);
  float c = cos(iSc.w), s = sin(iSc.w);
  vec3 X2 = X * c + Z * s;
  vec3 Z2 = Z * c - X * s;
  // hộp gốc ở đáy (y ∈ [0, 1]), đỉnh vát nhẹ
  float taper = 1.0 - 0.28 * position.y;
  vec3 wp = iPos + X2 * position.x * iSc.x * taper + Y * position.y * iSc.y + Z2 * position.z * iSc.z * taper;
  vN = normalize(X2 * normal.x / max(iSc.x, 1e-3) + Y * normal.y / max(iSc.y, 1e-3) + Z2 * normal.z / max(iSc.z, 1e-3) + vec3(0.0, 1e-5, 0.0));
  vBody = iBody; vInk = iInk; vHot = iHot; vY = position.y;
  gl_Position = projectionMatrix * viewMatrix * vec4(wp, 1.0);
}`;
const SOLID_FS = /* glsl */ `
varying vec3 vN; varying vec3 vBody; varying vec3 vInk; varying vec4 vHot; varying float vY;
void main(){
  // cel 2 nấc (đá / pha lê vát) + đỉnh nóng (nhiệt) — HDR chỉ ở phần nóng
  float l = dot(normalize(vN + vec3(0.0, 1e-5, 0.0)), vec3(0.32, 0.86, 0.39));
  float lit = l > 0.15 ? 1.0 : l > -0.35 ? 0.66 : 0.45;
  vec3 c = mix(vInk, vBody, lit);
  c += vHot.rgb * vHot.w * smoothstep(0.55, 1.0, vY);
  gl_FragColor = vec4(c, 1.0);
}`;

// ───────────── Vẽ từng hình (mỗi khung, không cấp phát) ─────────────

const BT = newBeat();
const O_SUCK: SparkOpts = { size: 0.04, life: 0.25, stretch: 0.05, drag: 0.5, gravity: 0 };
const O_CHIP: SparkOpts = { size: 0.035, life: 0.35, stretch: 0.04, drag: 3, gravity: 8 };
const O_GLINT: SparkOpts = { kind: 1, size: 0.3, life: 0.18, bright: 3 };
const outBack = (t: number) => {
  const x = Math.min(1, Math.max(0, t)) - 1;
  return 1 + 2.70158 * x * x * x + 1.70158 * x * x;
};
const outCubic = (t: number) => 1 - (1 - Math.min(1, Math.max(0, t))) ** 3;
const inQuad = (t: number) => Math.min(1, Math.max(0, t)) ** 2;

/** chiều cao "trồi" của khối theo pha: trồi outBack trong cao trào, giữ, thụt dần khi nguội */
function riseK(b: typeof BT): number {
  if (b.phase < 2) return 0;
  if (b.phase === 2) return outBack(b.k);
  if (b.phase === 3) return 1;
  if (b.phase === 4) return 1 - inQuad(b.k);
  return 0;
}
/** phát một lần (cờ bit) — trả true lần đầu */
function once(e: Ev, bit: number): boolean {
  if (e.fired & bit) return false;
  e.fired |= bit;
  return true;
}

function drawEvent(e: Ev, now: number, lv: Lv, rm: boolean) {
  const age = now - e.t0;
  const b = beatAt(age, STRIKE_BEATS[e.shape], BT, rm);
  if (b.phase >= 5) {
    e.on = false;
    return;
  }
  const { x, y, z, r } = e;
  const fx = Math.sin(e.yaw);
  const fz = Math.cos(e.yaw);
  const climax = b.phase >= 2;
  switch (e.shape) {
    case "wedge": {
      decal(e, DK.wedge, r, e.arc, b.draw, b.glow, b.heat, b.erode);
      // cung quét ngang ngực theo góc mở (lõi năng lượng), đuôi đuổi theo
      const n = 16;
      for (let i = 0; i < n; i++) {
        const a = e.yaw - e.arc + (2 * e.arc * i) / (n - 1);
        PATH[i * 3] = x + Math.sin(a) * r * 0.82;
        PATH[i * 3 + 1] = y + 0.9 + 0.15 * Math.sin((Math.PI * i) / (n - 1));
        PATH[i * 3 + 2] = z + Math.cos(a) * r * 0.82;
      }
      strip(PATH, n, 1, 0.04, 0.34, Math.min(1, b.draw * 1.2), b.phase >= 3 ? b.k * (b.phase === 4 ? 1 : 0.6) : 0, Math.min(1, b.glow), 1, e.body, 1.1, e.ink, b.heat, b.erode);
      if (climax && once(e, 1)) emitDustRing(x + fx * r * 0.6, y, z + fz * r * 0.6, 0.3, lodCount(3, lv), 2.2, 0.55, 0.6, PUFF.dust, e.core, 0.3);
      break;
    }
    case "rupture":
    case "crater": {
      const crater = e.shape === "crater";
      decal(e, DK.rim, r, b.phase >= 3 ? (crater ? 0.6 : 0.3) * (1 - b.erode * 0.8) : 0, b.draw, b.glow, b.heat, b.erode * 0.6);
      const cracks = e.n || lodCount(crater ? 9 : 6, lv, 3);
      const grow = b.phase === 0 ? b.draw * 0.6 : b.phase === 1 ? 0.6 + 0.1 * b.k : b.phase === 2 ? 0.7 + 0.3 * outCubic(b.k) : 1;
      for (let k = 0; k < cracks; k++) {
        const ang = e.yaw + (k / cracks) * Math.PI * 2 + (((e.seed >> (k % 16)) & 7) / 7 - 0.5) * 0.5;
        const n = zigzagCrack(PATH, x, y + 0.035, z, ang, r, 7, 0.22 * (crater ? 1.3 : 1), e.seed + k * 13);
        strip(PATH, n, 1, crater ? 0.34 : 0.24, 0.05, grow, 0, 1, 0, e.body, 1, e.ink, b.heat, b.erode);
        // phiến đá / pha lê trồi lên dọc vết nứt (nghiêng ra ngoài), thụt xuống khi nguội
        const rk = riseK(b);
        if (rk > 0.01 && (lv >= 1 || k % 2 === 0)) {
          const sx = Math.sin(ang);
          const sz = Math.cos(ang);
          const tilt = crater ? 0.75 : 0.35;
          for (let j = 0; j < (crater ? 2 : 1); j++) {
            const rr = r * (crater ? 0.42 + 0.22 * j : 0.62);
            const h = (crater ? 0.9 - 0.25 * j : 0.65) * rk * (0.75 + 0.5 * ((e.seed >> (k + j)) & 1));
            solid(x + sx * rr, y - 0.15, z + sz * rr, sx * tilt, 1, sz * tilt, crater ? 0.42 : 0.3, h + 0.15, crater ? 0.26 : 0.2, ang + k, e, b.heat, b.glow);
          }
        }
      }
      if (climax && once(e, 1)) {
        emitDustRing(x, y, z, r * (crater ? 0.45 : 0.55), lodCount(crater ? 9 : 6, lv, 3), crater ? 4 : 2.8, crater ? 1.0 : 0.7, crater ? 1.2 : 0.8, PUFF.soot, e.core, crater ? 0.9 : 0.5);
        for (let k = 0; k < lodCount(crater ? 14 : 8, lv, 3); k++) {
          const a = vfxRand() * Math.PI * 2;
          const s = 3 + vfxRand() * 4;
          emitSpark(x, y + 0.2, z, Math.sin(a) * s, 2 + vfxRand() * 3, Math.cos(a) * s, k % 2 ? e.body : e.core, O_CHIP, y);
        }
      }
      break;
    }
    case "grid":
      decal(e, DK.grid, r, 0.9, b.draw, b.glow, b.heat, b.erode);
      break;
    case "knight": {
      decal(e, DK.knight, r, 1.2, b.draw, b.glow, b.heat, b.erode);
      // 8 cột nhỏ trồi đúng ô nước Mã (ô 1,2 m quanh quân Mã)
      const rk = riseK(b);
      if (rk > 0.01)
        for (let cx = -2; cx <= 2; cx++)
          for (let cz = -2; cz <= 2; cz++) {
            if (!isKnightCell(cx, cz)) continue;
            solid(x + cx * 1.2, y - 0.05, z + cz * 1.2, 0, 1, 0, 0.5, 0.38 * rk, 0.5, Math.PI / 4, e, b.heat, b.glow);
          }
      break;
    }
    case "dial": {
      // kim quay NGƯỢC (khúc xạ thời gian), chậm dần
      decal(e, DK.dial, r, 0, b.draw, b.glow, b.heat, b.erode, -age * 0.012 * (1 - 0.5 * b.t));
      break;
    }
    case "sigil": {
      // DỒN LỰC: đa giác co từ 1,7 R về R trong pha báo trước, tia bị hút vào tâm; cao trào: nở bật
      const R = b.phase === 0 ? r * (1.7 - 0.7 * outCubic(b.k)) : b.phase === 2 ? r * (1 + 0.25 * outBack(b.k)) : r;
      decal(e, DK.sigil, R, e.n || 6, b.phase === 0 ? 0.4 + 0.6 * b.k : 1, b.glow, b.heat, b.erode, age * 0.0025);
      if (b.phase === 0 && lv >= 1 && vfxRand() < 0.45) {
        const a = vfxRand() * Math.PI * 2;
        const rr = R * 1.1;
        emitSpark(x + Math.sin(a) * rr, y + 0.2 + vfxRand() * 0.8, z + Math.cos(a) * rr, -Math.sin(a) * rr * 3, 0.4, -Math.cos(a) * rr * 3, e.core, O_SUCK);
      }
      break;
    }
    case "hex": {
      decal(e, DK.hex, r, 0.55, b.draw, b.glow, b.heat, b.erode);
      // vách cong khúc xạ: 3 cung rèm đứng ở mép, dựng lên rồi tụt
      const hk = b.phase === 0 ? 0.3 * b.draw : riseK(b);
      if (hk > 0.01)
        for (let s = 0; s < 3; s++) {
          const n = 12;
          for (let i = 0; i < n; i++) {
            const a = e.yaw + (s * Math.PI * 2) / 3 + (i / (n - 1) - 0.5) * 1.5;
            PATH[i * 3] = x + Math.sin(a) * r;
            PATH[i * 3 + 1] = y;
            PATH[i * 3 + 2] = z + Math.cos(a) * r;
            HEI[i] = 1.3 * hk * (1 - 0.35 * Math.abs(i / (n - 1) - 0.5) * 2);
          }
          strip(PATH, n, 2, 1, 1, 1, 0, 0.6, 2, e.body, 0.9, e.ink, b.heat, b.erode, HEI);
        }
      break;
    }
    case "star": {
      const n = e.n || 6;
      decal(e, DK.star, r, n, b.draw, b.glow, b.heat, b.erode);
      // gai pha lê ở mũi sao, chĩa ra ngoài – lên
      const rk = riseK(b);
      if (rk > 0.01)
        for (let k = 0; k < n; k++) {
          const a = e.yaw + (k / n) * Math.PI * 2;
          const sx = Math.sin(a);
          const sz = Math.cos(a);
          solid(x + sx * r * 0.82, y - 0.1, z + sz * r * 0.82, sx * 0.9, 1, sz * 0.9, 0.16, 0.9 * rk, 0.16, a, e, b.heat, b.glow);
        }
      break;
    }
    case "crest": {
      decal(e, DK.rim, r, 0, b.draw, b.glow, b.heat, b.erode);
      // vương miện sóng: rèm khép kín nở tới đúng bán kính, ngọn nhọn xen kẽ (6 đỉnh), sụp khi nguội
      const R = r * (b.phase === 0 ? 0.4 + 0.3 * b.draw : b.phase === 1 ? 0.7 : b.phase === 2 ? 0.7 + 0.3 * outCubic(b.k) : 1);
      const hk = b.phase === 0 ? 0.4 * b.draw : riseK(b);
      const n = M;
      for (let i = 0; i < n; i++) {
        const a = e.yaw + (i / (n - 1)) * Math.PI * 2;
        PATH[i * 3] = x + Math.sin(a) * R;
        PATH[i * 3 + 1] = y;
        PATH[i * 3 + 2] = z + Math.cos(a) * R;
        const sp = Math.abs(Math.sin(a * 3 + e.seed));
        HEI[i] = (0.35 + 0.9 * sp * sp) * hk;
      }
      if (hk > 0.01) strip(PATH, n, 2, 1, 1, 1, 0, 0.85, 2, e.body, 1, e.ink, b.heat, b.erode, HEI);
      if (b.phase === 4 && once(e, 1)) emitDustRing(x, y, z, R * 0.9, lodCount(6, lv, 2), 1.4, 0.8, 0.9, PUFF.mist, e.core, 0.2);
      break;
    }
    case "tendril": {
      decal(e, DK.rim, r, 0, b.draw, b.glow * 0.7, b.heat, b.erode, 0, 0, 0.6);
      const n = e.n || lodCount(5, lv, 3);
      const grow = b.phase === 0 ? 0.5 * b.draw : b.phase <= 2 ? 0.5 + 0.5 * outCubic(b.phase === 2 ? b.k : 0) : 1;
      const tail = b.phase === 4 ? b.k : 0;
      for (let k = 0; k < n; k++) {
        const c = tendril(PATH, x, y + 0.05, z, e.yaw + (k / n) * Math.PI * 2, r, 0.35, 0.35, 0.9, grow, 16);
        strip(PATH, c, 0, 0.26, 0.04, 1, tail, 1, 1, e.body, 1, e.ink, b.heat, b.erode);
      }
      break;
    }
    case "chain": {
      decal(e, DK.rim, r, 0, b.draw, b.glow, b.heat, b.erode, 0, 0, 0.7);
      const n = e.n || lodCount(6, lv, 3);
      // căng dần (võng 0,6 → 0,05) tới cao trào, rồi ĐỨT: hai nửa võng sâu và rơi
      const sag = b.phase <= 1 ? 0.6 - 0.4 * (b.phase === 1 ? 1 : b.draw) : b.phase === 2 ? 0.05 : 0.05 + 1.4 * inQuad(b.phase === 3 ? b.k * 0.4 : 0.4 + 0.6 * b.k);
      const head = b.phase === 0 ? b.draw : 1;
      for (let k = 0; k < n; k++) {
        const a = e.yaw + (k / n) * Math.PI * 2;
        const ex = x + Math.sin(a) * r;
        const ez = z + Math.cos(a) * r;
        const c = catenary(PATH, x, y + 0.9, z, ex, y + 0.15, ez, sag, 18);
        if (b.phase <= 2) strip(PATH, c, 0, 0.16, 0.16, head, 0, 1, 3, e.body, 1 + (b.phase === 2 ? 1.2 * b.glow : 0), e.ink, b.heat, b.erode);
        else {
          // đứt ở giữa: hai nửa
          strip(PATH, c, 0, 0.16, 0.16, 0.46, 0, 1, 3, e.body, 1, e.ink, b.heat, b.erode);
          strip(PATH, c, 0, 0.16, 0.16, 1, 0.56, 1, 3, e.body, 1, e.ink, b.heat, b.erode);
        }
      }
      if (b.phase >= 3 && once(e, 1))
        for (let k = 0; k < n; k++) {
          const a = e.yaw + (k / n) * Math.PI * 2;
          emitSpark(x + Math.sin(a) * r * 0.5, y + 0.6, z + Math.cos(a) * r * 0.5, Math.sin(a) * 3, 2.5, Math.cos(a) * 3, e.core, O_CHIP, y);
        }
      break;
    }
    case "drop": {
      // RƠI KIẾN TRÚC: cột đá rơi thẳng từ trên (báo trước + nín thở), cắm đúng lúc cao trào quanh vùng, nứt + bụi, nguội thụt xuống
      decal(e, DK.rim, r, b.phase >= 3 ? 0.35 * (1 - b.erode * 0.8) : 0, b.draw, b.glow, b.heat, b.erode * 0.5);
      const n = e.n || lodCount(6, lv, 4);
      const fallK = b.phase === 0 ? 0.35 * b.k : b.phase === 1 ? 0.35 + 0.65 * inQuad(b.k) : 1;
      for (let k = 0; k < n; k++) {
        const a = e.yaw + (k / n) * Math.PI * 2 + 0.3;
        const rr = r * 0.78;
        const px = x + Math.sin(a) * rr;
        const pz = z + Math.cos(a) * rr;
        const sink = b.phase === 4 ? 2.6 * inQuad(b.k) : 0;
        solid(px, y + 9 * (1 - fallK) - 0.3 - sink, pz, 0, 1, 0, 0.75, 2.6, 0.75, a, e, b.phase >= 2 ? b.heat : 0.3, b.glow);
        if (climax) {
          const c = zigzagCrack(PATH, px, y + 0.035, pz, a, r * 0.22, 4, 0.12, e.seed + k);
          strip(PATH, c, 1, 0.22, 0.05, b.phase === 2 ? outCubic(b.k) : 1, 0, 1, 0, e.body, 1, e.ink, b.heat, b.erode);
        }
      }
      if (climax && once(e, 1))
        for (let k = 0; k < n; k++) {
          const a = e.yaw + (k / n) * Math.PI * 2 + 0.3;
          emitDustRing(x + Math.sin(a) * r * 0.78, y, z + Math.cos(a) * r * 0.78, 0.4, lodCount(3, lv), 3, 0.9, 1.1, PUFF.soot, e.core, 0.7);
        }
      break;
    }
    case "piston": {
      decal(e, DK.rim, r, 0, b.draw, b.glow, b.heat, b.erode, 0, 0, 0.8);
      const n = e.n || lodCount(8, lv, 4);
      const rk = riseK(b);
      if (rk > 0.01)
        for (let k = 0; k < n; k++) {
          const a = e.yaw + (k / n) * Math.PI * 2;
          solid(x + Math.sin(a) * r * 0.92, y - 0.1, z + Math.cos(a) * r * 0.92, 0, 1, 0, 0.32, 0.85 * rk, 0.32, a, e, b.heat, b.glow);
        }
      break;
    }
    case "wall": {
      // VÁCH PHẢN XẠ: tấm đứng vuông góc hướng sóng, dựng lên trong pha báo trước, giữ suốt sóng dừng
      const hk = b.phase === 0 ? b.draw : b.phase === 4 ? 1 - inQuad(b.k) : 1;
      solid(x, y - 0.05, z, 0, 1, 0, 2.4, 2.1 * hk, 0.1, Math.PI / 2 - e.yaw, e, b.heat, b.glow);
      // vạch chân vách (mép năng lượng nằm đất)
      for (let i = 0; i < 2; i++) {
        PATH[i * 3] = x + Math.cos(e.yaw) * 1.25 * (i ? 1 : -1);
        PATH[i * 3 + 1] = y + 0.04;
        PATH[i * 3 + 2] = z - Math.sin(e.yaw) * 1.25 * (i ? 1 : -1);
      }
      strip(PATH, 2, 1, 0.12, 0.12, 1, 0, Math.min(1, b.glow), 1, e.body, 1.2, e.ink, b.heat, b.erode);
      break;
    }
    case "cage": {
      // LỒNG TRỰC GIAO: n thanh vuông dựng quanh (n = số ước), dầm ngang nối đỉnh lúc cao trào
      const n = Math.max(2, Math.min(8, e.n || 4));
      const hk = b.phase === 0 ? outCubic(b.draw) : b.phase === 4 ? 1 - inQuad(b.k) : 1;
      for (let k = 0; k < n; k++) {
        const a = e.yaw + (k / n) * Math.PI * 2 + Math.PI / 4;
        solid(x + Math.sin(a) * r, y - 0.05, z + Math.cos(a) * r, 0, 1, 0, 0.22, 2.4 * hk, 0.22, Math.PI / 4, e, b.heat, b.glow);
      }
      if (climax && b.phase <= 3) {
        const m = n + 1;
        for (let k = 0; k < m; k++) {
          const a = e.yaw + (k / n) * Math.PI * 2 + Math.PI / 4;
          PATH[k * 3] = x + Math.sin(a) * r;
          PATH[k * 3 + 1] = y + 2.4 * hk;
          PATH[k * 3 + 2] = z + Math.cos(a) * r;
        }
        strip(PATH, m, 0, 0.1, 0.1, 1, 0, 1, 1, e.body, 1.2, e.ink, b.heat, b.erode);
      }
      break;
    }
    case "scorch": {
      // vết cháy Lichtenberg: nhánh chính zigzag tới đúng r + 2 nhánh con mỗi nhánh; điện xanh trắng → muội; không phiến đá
      decal(e, DK.rim, r, b.phase >= 2 ? 0.55 * (1 - b.erode * 0.7) : 0, b.draw, b.glow * 0.8, b.heat, b.erode * 0.5);
      const br = e.n || lodCount(5, lv, 3);
      const grow = b.phase === 0 ? b.draw : 1;
      for (let k = 0; k < br; k++) {
        const ang = e.yaw + (k / br) * Math.PI * 2 + (((e.seed >> (k % 16)) & 7) / 7 - 0.5) * 0.7;
        const n = zigzagCrack(PATH, x, y + 0.035, z, ang, r, 9, 0.3, e.seed + k * 7);
        strip(PATH, n, 1, 0.14, 0.03, grow, 0, 1, 1, e.body, 1.3, e.ink, b.heat, b.erode);
        if (lv >= 1)
          for (let s = -1; s <= 1; s += 2) {
            const mx = PATH[3 * 3];
            const mz = PATH[3 * 3 + 2];
            const m = zigzagCrack(PATH, mx, y + 0.036, mz, ang + s * 0.65, r * 0.42, 4, 0.12, e.seed + k * 7 + s);
            strip(PATH, m, 1, 0.08, 0.02, b.phase === 0 ? 0 : b.phase === 1 ? b.k : 1, 0, 0.9, 1, e.body, 1.1, e.ink, b.heat, b.erode);
            zigzagCrack(PATH, x, y + 0.035, z, ang, r, 9, 0.3, e.seed + k * 7);
          }
      }
      if (climax && once(e, 1))
        for (let k = 0; k < lodCount(8, lv, 3); k++) {
          const a = vfxRand() * Math.PI * 2;
          const rr = vfxRand() * r;
          emitSpark(x + Math.sin(a) * rr, y + 0.15, z + Math.cos(a) * rr, 0, 0.6, 0, e.core, O_GLINT);
        }
      break;
    }
    case "converge": {
      // TỤ (tuyệt kỹ): 8 gai pha lê từ 2,2 R trượt vào vòng R, nghiêng vào tâm; cao trào loé, rồi bật ra
      const n = e.n || lodCount(8, lv, 5);
      const slide = b.phase === 0 ? outCubic(b.k) : 1;
      const rr = r * (2.2 - 1.2 * slide) + (b.phase >= 3 ? r * 0.5 * outCubic(b.phase === 3 ? b.k : 1) : 0);
      const hk = b.phase === 4 ? 1 - inQuad(b.k) : Math.min(1, 0.3 + slide);
      for (let k = 0; k < n; k++) {
        const a = e.yaw + (k / n) * Math.PI * 2;
        const sx = Math.sin(a);
        const sz = Math.cos(a);
        solid(x + sx * rr, y - 0.05, z + sz * rr, -sx * 0.45, 1, -sz * 0.45, 0.14, 1.6 * hk, 0.14, a, e, b.heat, b.glow);
      }
      decal(e, DK.sigil, r * 0.9, n, b.phase === 0 ? b.k : 1, b.glow, b.heat, b.erode, -age * 0.002, 0, 0.7);
      break;
    }
    case "helix": {
      // ĐỔI VŨ KHÍ: dải xoắn 1,5 vòng bốc từ chân lên đầu quanh người
      const n = 22;
      const grow = b.phase === 0 ? b.k : 1;
      for (let i = 0; i < n; i++) {
        const u = (i / (n - 1)) * grow;
        const a = e.yaw + u * Math.PI * 3;
        PATH[i * 3] = x + Math.sin(a) * r * (1 - 0.3 * u);
        PATH[i * 3 + 1] = y + 0.1 + 2.0 * u;
        PATH[i * 3 + 2] = z + Math.cos(a) * r * (1 - 0.3 * u);
      }
      strip(PATH, n, 0, 0.14, 0.04, 1, b.phase === 4 ? b.k : b.phase === 3 ? 0.3 * b.k : 0, Math.min(1, b.glow), 1, e.body, 1.1, e.ink, b.heat, b.erode);
      break;
    }
    case "shell": {
      // DỰNG KHIÊN: 6 tấm vỏ cong (rèm đứng) khép từ ngoài vào quanh hộ vệ, không vẽ sàn
      const hk = b.phase === 0 ? outCubic(b.k) : b.phase === 4 ? 1 - inQuad(b.k) : 1;
      const R = r * (1.35 - 0.35 * (b.phase === 0 ? outCubic(b.k) : 1));
      for (let s = 0; s < 6; s++) {
        const n = 7;
        for (let i = 0; i < n; i++) {
          const a = e.yaw + (s * Math.PI) / 3 + (i / (n - 1) - 0.5) * 0.85;
          PATH[i * 3] = x + Math.sin(a) * R;
          PATH[i * 3 + 1] = y;
          PATH[i * 3 + 2] = z + Math.cos(a) * R;
          HEI[i] = 1.9 * hk * (1 - 0.25 * Math.abs(i / (n - 1) - 0.5) * 2);
        }
        strip(PATH, n, 2, 1, 1, 1, 0, 0.55, 2, e.body, 0.9, e.ink, b.heat, b.erode, HEI);
      }
      break;
    }
    case "spring": {
      // ĐỆM NẢY: 3 chevron đứng (mũi lên) chồng nhau vút lên theo cú bật
      for (let k = 0; k < 3; k++) {
        const h = y + 0.25 + k * 0.42 + 1.4 * b.t;
        const w = (0.55 - k * 0.1) * r;
        PATH[0] = x - w * Math.cos(e.yaw + 1.2);
        PATH[1] = h - 0.25;
        PATH[2] = z + w * Math.sin(e.yaw + 1.2);
        PATH[3] = x;
        PATH[4] = h;
        PATH[5] = z;
        PATH[6] = x + w * Math.cos(e.yaw + 1.2);
        PATH[7] = h - 0.25;
        PATH[8] = z - w * Math.sin(e.yaw + 1.2);
        strip(PATH, 3, 0, 0.09, 0.09, b.draw, 0, Math.min(1, b.glow) * (1 - b.erode), 4, e.body, 1, e.ink, b.heat, b.erode);
      }
      if (climax && once(e, 1)) emitDustRing(x, y, z, 0.3, lodCount(4, lv, 2), 1.6, 0.45, 0.6, PUFF.dust, e.core, 0.3);
      break;
    }
    case "spokes": {
      // BẬT LÊN: chùm tia toả quay mặt máy quay (đầu chạy ra, đuôi đuổi theo)
      const n = e.n || lodCount(10, lv, 6);
      const head = b.phase === 0 ? b.draw * 0.5 : b.phase <= 2 ? 0.5 + 0.5 * outCubic(b.phase === 2 ? b.k : 0) : 1;
      const tail = b.phase === 3 ? 0.5 * b.k : b.phase === 4 ? 0.5 + 0.5 * b.k : 0;
      // trục vuông góc hướng nhìn: vẽ trong mặt phẳng đối diện máy quay
      const vx = CAMP.x - x;
      const vy = CAMP.y - y;
      const vz = CAMP.z - z;
      const vl = Math.hypot(vx, vy, vz) || 1;
      // hai trục của mặt phẳng: ngang (u) và dọc (v)
      let ux = -vz / vl;
      let uz = vx / vl;
      const ul = Math.hypot(ux, uz) || 1;
      ux /= ul;
      uz /= ul;
      const wx = (vy / vl) * uz;
      const wy = (vz / vl) * ux - (vx / vl) * uz;
      const wz = -(vy / vl) * ux;
      for (let k = 0; k < n; k++) {
        const a = (k / n) * Math.PI * 2 + e.seed * 0.001;
        const len = r * (0.7 + 0.3 * (((e.seed >> k) & 3) / 3));
        const ca = Math.cos(a);
        const sa = Math.sin(a);
        PATH[0] = x + (ux * ca + wx * sa) * 0.15;
        PATH[1] = y + wy * sa * 0.15;
        PATH[2] = z + (uz * ca + wz * sa) * 0.15;
        PATH[3] = x + (ux * ca + wx * sa) * len;
        PATH[4] = y + wy * sa * len;
        PATH[5] = z + (uz * ca + wz * sa) * len;
        strip(PATH, 2, 0, 0.16, 0.02, head, tail, 1, 1, e.body, 1.2, e.ink, b.heat, b.erode);
      }
      break;
    }
    case "iris": {
      // TỚI CỔNG: 6 lá cong (quay mặt máy quay) quanh tâm cổng, xoay vào rồi mở ra như mống mắt
      const vx = CAMP.x - x;
      const vz = CAMP.z - z;
      const vl = Math.hypot(vx, vz) || 1;
      const ux = -vz / vl;
      const uz = vx / vl;
      const open = b.phase === 0 ? 1 - outCubic(b.k) * 0.6 : b.phase <= 2 ? 0.4 : 0.4 + 0.9 * outCubic(b.phase === 3 ? b.k : 1);
      const rot = age * 0.004;
      for (let s = 0; s < 6; s++) {
        const n = 8;
        for (let i = 0; i < n; i++) {
          const t = i / (n - 1);
          const a = rot + (s * Math.PI) / 3 + t * 1.1;
          const rr = r * (0.25 + open * 0.6) * (1 - 0.5 * t) + r * 0.35 * t;
          PATH[i * 3] = x + ux * Math.cos(a) * rr;
          PATH[i * 3 + 1] = y + Math.sin(a) * rr;
          PATH[i * 3 + 2] = z + uz * Math.cos(a) * rr;
        }
        strip(PATH, n, 0, 0.2, 0.04, b.phase === 0 ? b.draw : 1, 0, Math.min(1, b.glow) * (1 - b.erode), 1, e.body, 1.1, e.ink, b.heat, b.erode);
      }
      break;
    }
    case "gate": {
      // MÉP SÂN KHẤU: khung cổng trực giao (2 cột + xà) vuông góc hướng đi, dựng nhanh rồi thụt
      const hk = b.phase === 0 ? outCubic(b.k) : b.phase === 4 ? 1 - inQuad(b.k) : 1;
      const px = Math.cos(e.yaw);
      const pz = -Math.sin(e.yaw);
      const half = r * 0.6;
      for (let s = -1; s <= 1; s += 2) solid(x + px * half * s, y - 0.05, z + pz * half * s, 0, 1, 0, 0.18, 2.3 * hk, 0.18, -e.yaw, e, b.heat, b.glow);
      // xà ngang = khối nằm (trục dọc theo bề ngang cổng)
      if (hk > 0.6) solid(x - px * (half + 0.1), y + 2.3 * hk - 0.1, z - pz * (half + 0.1), px, 0, pz, 0.2, half * 2 + 0.2, 0.2, 0, e, b.heat, b.glow);
      break;
    }
    case "land": {
      // TIẾP ĐẤT: 6 vệt trượt ngắn nằm đất toả ra + bụi thấp
      const n = lodCount(6, lv, 4);
      for (let k = 0; k < n; k++) {
        const a = e.yaw + (k / n) * Math.PI * 2 + 0.3;
        const r0 = r * 0.3;
        const r1 = r * (0.3 + 0.7 * outCubic(b.phase === 0 ? b.k : 1));
        PATH[0] = x + Math.sin(a) * r0;
        PATH[1] = y + 0.03;
        PATH[2] = z + Math.cos(a) * r0;
        PATH[3] = x + Math.sin(a) * r1;
        PATH[4] = y + 0.03;
        PATH[5] = z + Math.cos(a) * r1;
        strip(PATH, 2, 1, 0.1, 0.03, 1, b.phase === 4 ? b.k : 0, 0.8, 0, e.body, 0.8, e.ink, b.heat * 0.4, b.erode);
      }
      if (once(e, 1)) emitDustRing(x, y, z, r * 0.35, lodCount(5, lv, 2), 2.2, 0.45, 0.6, PUFF.dust, e.core, 0);
      break;
    }
    case "muzzle": {
      // CHEVRON nối tiếp dọc trục bắn (đường ray tăng tốc), vụt ra ngoài
      for (let k = 0; k < 3; k++) {
        const d = 0.25 + k * 0.32 + 0.6 * b.t;
        const w = (0.45 - k * 0.08) * (1 - 0.5 * b.t);
        const cxp = x + fx * d;
        const czp = z + fz * d;
        PATH[0] = cxp - fz * w - fx * 0.22;
        PATH[1] = y + 0.18;
        PATH[2] = czp + fx * w - fz * 0.22;
        PATH[3] = cxp;
        PATH[4] = y;
        PATH[5] = czp;
        PATH[6] = cxp + fz * w - fx * 0.22;
        PATH[7] = y - 0.18;
        PATH[8] = czp - fx * w - fz * 0.22;
        strip(PATH, 3, 0, 0.07, 0.07, b.draw, 0, Math.min(1, b.glow) * (1 - b.erode), 4, e.body, 1, e.ink, b.heat, b.erode);
      }
      break;
    }
  }
}

// ───────────── Component ─────────────

const DECAL_ATTRS = ["iPos", "iA", "iB", "iC", "iBody", "iInk", "iCore"];
const SOLID_ATTRS = ["iPos", "iDir", "iSc", "iBody", "iInk", "iHot"];
const STRIP_ATTRS = ["position", "uv", "aCol", "aInk", "aP", "aQ"];

function touch(g: THREE.BufferGeometry, names: string[], n: number) {
  for (const name of names) {
    const a = g.attributes[name] as THREE.BufferAttribute;
    a.clearUpdateRanges();
    a.addUpdateRange(0, Math.max(1, n) * a.itemSize);
    a.needsUpdate = true;
  }
}

export function StrikeFx() {
  const camera = useThree((s) => s.camera);
  const res = useMemo(() => {
    const inst = (arr: Float32Array, n: number) => new THREE.InstancedBufferAttribute(arr, n).setUsage(THREE.DynamicDrawUsage);
    const premult = { transparent: true, depthWrite: false, blending: THREE.CustomBlending, blendSrc: THREE.OneFactor, blendDst: THREE.OneMinusSrcAlphaFactor, toneMapped: false, side: THREE.DoubleSide } as const;
    const noise = { value: blankTexture() as THREE.Texture };
    const uT = { value: 0 };
    // decal
    const q = new THREE.PlaneGeometry(1, 1);
    const dg = new THREE.InstancedBufferGeometry();
    dg.setIndex(q.index);
    dg.setAttribute("position", q.attributes.position);
    dg.setAttribute("iPos", inst(D.pos, 3));
    dg.setAttribute("iA", inst(D.a, 4));
    dg.setAttribute("iB", inst(D.b, 4));
    dg.setAttribute("iC", inst(D.c, 4));
    dg.setAttribute("iBody", inst(D.body, 3));
    dg.setAttribute("iInk", inst(D.ink, 3));
    dg.setAttribute("iCore", inst(D.core, 3));
    dg.instanceCount = 0;
    const dm = new THREE.ShaderMaterial({ vertexShader: DECAL_VS, fragmentShader: DECAL_FS, uniforms: { uNoise: noise, uT }, ...premult, polygonOffset: true, polygonOffsetFactor: -2, polygonOffsetUnits: -2 });
    const decals = new THREE.Mesh(dg, dm);
    decals.frustumCulled = false;
    decals.renderOrder = 9;
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
    tg.setAttribute("aQ", dyn(T.q, 2));
    tg.setDrawRange(0, 0);
    const tm = new THREE.ShaderMaterial({ vertexShader: STRIP_VS, fragmentShader: STRIP_FS, uniforms: { uNoise: noise, uT }, ...premult });
    const strips = new THREE.Mesh(tg, tm);
    strips.frustumCulled = false;
    strips.renderOrder = 12;
    // khối đặc: hộp gốc ở đáy
    const box = new THREE.BoxGeometry(1, 1, 1).translate(0, 0.5, 0);
    const sg = new THREE.InstancedBufferGeometry();
    sg.setIndex(box.index);
    sg.setAttribute("position", box.attributes.position);
    sg.setAttribute("normal", box.attributes.normal);
    sg.setAttribute("iPos", inst(S.pos, 3));
    sg.setAttribute("iDir", inst(S.dir, 3));
    sg.setAttribute("iSc", inst(S.sc, 4));
    sg.setAttribute("iBody", inst(S.body, 3));
    sg.setAttribute("iInk", inst(S.ink, 3));
    sg.setAttribute("iHot", inst(S.hot, 4));
    sg.instanceCount = 0;
    const sm = new THREE.ShaderMaterial({ vertexShader: SOLID_VS, fragmentShader: SOLID_FS, toneMapped: false });
    const solids = new THREE.Mesh(sg, sm);
    solids.frustumCulled = false;
    solids.renderOrder = 1;
    return { q, dg, dm, decals, tg, tm, strips, box, sg, sm, solids, noise, uT, prev: { d: 0, t: 0, s: 0 } };
  }, []);
  useEffect(
    () => () => {
      for (const o of [res.q, res.dg, res.dm, res.tg, res.tm, res.box, res.sg, res.sm]) o.dispose();
    },
    [res],
  );
  useEffect(() => whenVfxTextures((t) => (res.noise.value = t.noiseFlow)), [res]);
  useFrame(() => {
    const now = fxNow();
    const lv = level();
    const rm = fxReducedMotion();
    CAMP.copy(camera.position);
    D.n = 0;
    T.n = 0;
    S.n = 0;
    let live = 0;
    for (const e of EVS) {
      if (!e.on) continue;
      live++;
      drawEvent(e, now, lv, rm);
    }
    STATS.live = live;
    STATS.peak = Math.max(STATS.peak, live);
    STATS.decals = D.n;
    STATS.strips = T.n;
    STATS.solids = S.n;
    const pv = res.prev;
    if (D.n || pv.d) {
      res.dg.instanceCount = D.n;
      touch(res.dg, DECAL_ATTRS, D.n);
    }
    if (S.n || pv.s) {
      res.sg.instanceCount = S.n;
      touch(res.sg, SOLID_ATTRS, S.n);
    }
    if (T.n || pv.t) {
      res.tg.setDrawRange(0, T.n * (M - 1) * 6);
      touch(res.tg, STRIP_ATTRS, T.n * M * 2);
    }
    pv.d = D.n;
    pv.s = S.n;
    pv.t = T.n;
    // pool rỗng → ẩn (không tốn lệnh vẽ)
    res.decals.visible = D.n > 0;
    res.strips.visible = T.n > 0;
    res.solids.visible = S.n > 0;
    res.uT.value = (now / 1000) % 1000;
  });
  return (
    <group name="perf:strikefx">
      <primitive object={res.decals} />
      <primitive object={res.strips} />
      <primitive object={res.solids} />
    </group>
  );
}
