"use client";
/**
 * Phòng Lăng kính — lý thuyết màu (docs/ai-reviews/color-theory/PLAN.md; logic thuần lib/world/colorTheory.ts).
 * Gắn sau vòm tầng lửng 90° của phòng Siêu khối, sàn y = 5. Sáu trạm F:
 *  (a) sân khấu ánh sáng RGB + bóng màu (bóng của trụ và của chính người chơi — mỗi đèn một mặt nạ che giải tích);
 *  (b) đèn chiếu qua kính lọc C / M / Y (nhân PHỔ truyền qua rồi quy ra sRGB bằng hàm phối màu CIE);
 *  (c) khối RGB / đĩa HSV đi bộ (vị trí = màu) + mạng 5³ khối lơ lửng;
 *  (d) vòng hoà sắc HSV / RYB / OKLCH + đèn lồng nhuộm theo bộ phối;
 *  (e) tường ảo giác: ảnh dư (cờ lam lục → cờ đỏ sao vàng) + tương phản đồng thời;
 *  (f) phòng tối Newton (lăng kính SF11) + giản đồ CIE 1931 + kính mô phỏng mù màu (Machado 2009).
 * Kết xuất: mọi màn màu là MỘT ShaderMaterial (thuộc tính aKind chọn trạm) → 1 lệnh vẽ; vỏ + đạo cụ tĩnh Blender
 * (props/prism_hall.glb, GI nướng, collection COLOR_ROOM) gộp 1; phần phát sáng (nút, thấu kính, đèn lồng) 1; mạng khối 1;
 * kính lọc 1; chùm sáng 1 → 6 lệnh vẽ. Trộn màu trên ánh sáng tuyến tính; màn màu xuất nghịch đảo tone mapping Neutral để
 * màn hình hiện đúng màu dự định (trắng là trắng).
 */
import { useEffect, useMemo, useRef } from "react";
import { useFrame } from "@react-three/fiber";
import * as THREE from "three";
import { mergeGeometries } from "three/examples/jsm/utils/BufferGeometryUtils.js";
import {
  byte,
  CUBE_HIT,
  CUBE_TARGETS,
  cubeColorAt,
  cubeMiss,
  CVD,
  filterSpectral,
  filterShortcut,
  filterTable,
  FILTER_IDS,
  FILTER_TARGETS,
  FLAG_FIELD,
  FLAG_STAR,
  GLASS,
  harmonyColors,
  harmonyHues,
  hexOf,
  HARMONY_OFFSETS,
  inPrismHall,
  LAMP_RGB,
  LIGHT_TARGETS,
  locusXy,
  metamerWeights,
  nextCvd,
  nextHarmony,
  nextLevel,
  nextProbe,
  nextSlice,
  nextWheel,
  PEDESTALS,
  PH,
  POOL_R,
  PRISM,
  PRISM_HOLE,
  PRISM_IN_ANGLE,
  PRISM_INC,
  prismDeviation,
  cauchyN,
  rgbToHsv,
  rgbToXyz,
  sameLevels,
  spectralRgb,
  spectrumHitZ,
  ST,
  STAGE_COLUMN,
  stageColorAt,
  stageLamp,
  toLinear,
  wheelColor,
  xyOf,
  type ColorAct,
  type CubeMode,
  type Cvd,
  type Harmony,
  type RGB,
  type Wheel,
} from "@/lib/world/colorTheory";
import { sfx } from "@/lib/world/sfx";
import { registerAction } from "../actions";
import { useWorld } from "../store";
import { useGfx } from "../gfx";
import { unlockNote } from "../story/quest";
import { Label3D } from "../ui/Labels";
import { usePdxStyle } from "./VoidHybrid";
import { PROP_U, ROOM_U } from "./roomUniforms";
import { worldAsset } from "@/lib/world/avatars";
import { useGLTF } from "@react-three/drei";

const GLB = worldAsset("props/prism_hall.glb");
useGLTF.preload(GLB);

const Y0 = PH.y;
const HEX = (c: RGB) => hexOf(c);

// ───────── Trạng thái (ngoài React) ─────────
export const CT = {
  lv: [1, 1, 1] as number[],
  gel: [false, false, false] as boolean[],
  gelK: [0, 0, 0] as number[],
  slice: 0.5 as number,
  mode: "rgb" as CubeMode,
  target: 0,
  found: 0,
  hue: 0,
  harmony: "complement" as Harmony,
  wheel: "rgb" as Wheel,
  wheelsSeen: new Set<Wheel>(["rgb"]),
  kindsSeen: new Set<Harmony>(["complement"]),
  stare: -1,
  stared: false,
  reveal: 0,
  revealed: false,
  cvd: "normal" as Cvd,
  cvdSeen: new Set<Cvd>(),
  probe: 580 as number,
  lightTarget: 0,
  lightSolved: 0,
  filterTarget: 0,
  filterSolved: 0,
};
const mask = () => CT.gel.reduce((m, on, i) => m | (on ? 1 << i : 0), 0);

const frac = (v: number) => (v === 1 ? "1" : v === 0.75 ? "¾" : v === 0.5 ? "½" : v === 0.25 ? "¼" : "0");
const HNAME: Record<Harmony, { vi: string; en: string }> = {
  complement: { vi: "bù (180°)", en: "complementary (180°)" },
  split: { vi: "bù chia (150°, 210°)", en: "split-complementary (150°, 210°)" },
  triad: { vi: "bộ ba (±120°)", en: "triad (±120°)" },
  analogous: { vi: "tương đồng (±30°)", en: "analogous (±30°)" },
  square: { vi: "vuông (90°)", en: "square (90°)" },
};
const WNAME: Record<Wheel, { vi: string; en: string }> = {
  rgb: { vi: "HSV (ánh sáng)", en: "HSV (light)" },
  ryb: { vi: "RYB (hoạ sĩ)", en: "RYB (painters)" },
  oklch: { vi: "OKLCH (cảm nhận)", en: "OKLCH (perceptual)" },
};
const CVDNAME: Record<Cvd, { vi: string; en: string }> = {
  normal: { vi: "mắt thường", en: "typical vision" },
  protan: { vi: "mù đỏ (protan)", en: "protanopia" },
  deutan: { vi: "mù lục (deutan)", en: "deuteranopia" },
  tritan: { vi: "mù lam (tritan)", en: "tritanopia" },
};
const LAMP_NAME = ["R", "G", "B"];
const GEL_NAME = { c: "C (lam lục)", m: "M (hồng sen)", y: "Y (vàng)" } as const;
const GEL_NAME_EN = { c: "C (cyan)", m: "M (magenta)", y: "Y (yellow)" } as const;

/** Nhãn gợi ý (F) cho Impossible.impNearby */
export function colorHint(a: ColorAct, vi: boolean): string {
  const lampI = a === "lamp-r" ? 0 : a === "lamp-g" ? 1 : a === "lamp-b" ? 2 : -1;
  if (lampI >= 0) return vi ? `Đèn ${LAMP_NAME[lampI]}: ${frac(CT.lv[lampI])} → ${frac(nextLevel(CT.lv[lampI]))}` : `Lamp ${LAMP_NAME[lampI]}: ${frac(CT.lv[lampI])} → ${frac(nextLevel(CT.lv[lampI]))}`;
  const gi = a === "filter-c" ? 0 : a === "filter-m" ? 1 : a === "filter-y" ? 2 : -1;
  if (gi >= 0) {
    const id = FILTER_IDS[gi];
    return vi ? `${CT.gel[gi] ? "Rút" : "Đưa"} kính ${GEL_NAME[id]} ${CT.gel[gi] ? "ra" : "vào chùm sáng"}` : `${CT.gel[gi] ? "Pull out" : "Slide in"} the ${GEL_NAME_EN[id]} filter`;
  }
  switch (a) {
    case "cube-slice":
      return vi ? `Đổi lát ${CT.mode === "rgb" ? "G" : "V"}: ${frac(CT.slice)} → ${frac(nextSlice(CT.slice))}` : `Change the ${CT.mode === "rgb" ? "G" : "V"} slice: ${frac(CT.slice)} → ${frac(nextSlice(CT.slice))}`;
    case "cube-mode":
      return vi ? (CT.mode === "rgb" ? "Đổi sàn sang đĩa HSV" : "Đổi sàn về lát khối RGB") : CT.mode === "rgb" ? "Switch the floor to the HSV disc" : "Switch back to the RGB cube slice";
    case "cube-target":
      return vi ? "Màu mục tiêu khác" : "Another target colour";
    case "wheel-hue":
      return vi ? `Xoay sắc gốc: ${CT.hue}° → ${(CT.hue + 30) % 360}°` : `Rotate the base hue: ${CT.hue}° → ${(CT.hue + 30) % 360}°`;
    case "wheel-kind":
      return vi ? `Kiểu phối: ${HNAME[CT.harmony].vi} → ${HNAME[nextHarmony(CT.harmony)].vi}` : `Harmony: ${HNAME[CT.harmony].en} → ${HNAME[nextHarmony(CT.harmony)].en}`;
    case "wheel-space":
      return vi ? `Vòng màu: ${WNAME[CT.wheel].vi} → ${WNAME[nextWheel(CT.wheel)].vi}` : `Colour wheel: ${WNAME[CT.wheel].en} → ${WNAME[nextWheel(CT.wheel)].en}`;
    case "illusion-stare":
      return vi ? "Nhìn chăm chú vào chấm giữa lá cờ 15 giây" : "Stare at the dot on the flag for 15 seconds";
    case "illusion-reveal":
      return vi ? (CT.reveal === 0 ? "Hút màu hai ô xám (so mã số)" : CT.reveal === 1 ? "Tráo hai nền" : "Đặt lại") : CT.reveal === 0 ? "Eyedrop both grey squares" : CT.reveal === 1 ? "Swap the backgrounds" : "Reset";
    case "prism-probe":
      return vi ? `Đầu dò bước sóng: ${CT.probe} → ${nextProbe(CT.probe)} nm` : `Wavelength probe: ${CT.probe} → ${nextProbe(CT.probe)} nm`;
    case "prism-cvd":
      return vi ? `Kính mô phỏng: ${CVDNAME[CT.cvd].vi} → ${CVDNAME[nextCvd(CT.cvd)].vi}` : `Simulation glasses: ${CVDNAME[CT.cvd].en} → ${CVDNAME[nextCvd(CT.cvd)].en}`;
  }
  return "";
}

// ───────── Uniform dùng chung (mù màu + nghịch đảo tone mapping) ─────────
const CU = {
  uCvd: { value: new THREE.Matrix3() },
  uInvTM: { value: 1 },
  uT: ROOM_U.uT,
};
const COMMON = /* glsl */ `
uniform mat3 uCvd; uniform float uInvTM;
vec3 neutralInv(vec3 d){
  d = clamp(d, 0.0, 0.995);
  float np = max(d.r, max(d.g, d.b));
  if (np >= 0.76) {
    float peak = 0.0576 / (1.0 - np) - 0.24 + 0.76;
    float gm = 1.0 - 1.0 / (0.15 * (peak - np) + 1.0);
    d = max((d - np * gm) / (1.0 - gm) * (peak / np), 0.0);
  }
  float mo = min(d.r, min(d.g, d.b));
  float x = mo < 0.04 ? sqrt(mo / 6.25) : mo + 0.04;
  float off = x < 0.08 ? x - 6.25 * x * x : 0.04;
  return d + off;
}
vec3 outCol(vec3 d){ d = max(uCvd * d, 0.0); return uInvTM > 0.5 ? neutralInv(d) : d; }
vec3 outGlow(vec3 c){ return max(uCvd * c, 0.0); }
vec3 s2l(vec3 c){ return mix(c / 12.92, pow((c + 0.055) / 1.055, vec3(2.4)), step(0.04045, c)); }
vec3 hsv2rgb(float h, float s, float v){
  vec3 k = mod(vec3(5.0, 3.0, 1.0) + h / 60.0, 6.0);
  return v - v * s * clamp(min(k, 4.0 - k), 0.0, 1.0);
}
float g1(float x, float mu, float s1, float s2){ float t = (x - mu) / (x < mu ? s1 : s2); return exp(-0.5 * t * t); }
vec3 cmf(float l){
  return vec3(1.056 * g1(l, 599.8, 37.9, 31.0) + 0.362 * g1(l, 442.0, 16.0, 26.7) - 0.065 * g1(l, 501.1, 20.4, 26.2),
              0.821 * g1(l, 568.8, 46.9, 40.5) + 0.286 * g1(l, 530.9, 16.3, 31.1),
              1.217 * g1(l, 437.0, 11.8, 36.0) + 0.681 * g1(l, 459.0, 26.0, 13.8));
}
const mat3 XYZ2RGB = mat3(3.2404542, -0.969266, 0.0556434, -1.5371385, 1.8760108, -0.2040259, -0.4985314, 0.041556, 1.0572252);
/* kéo về điểm trắng giữ độ chói Y tới khi hết kênh âm (giữ bước sóng trội) */
vec3 gamutY(vec3 xyz){
  vec3 c = XYZ2RGB * xyz; float Y = xyz.y; float t = 1.0;
  if (c.r < 0.0) t = min(t, Y / (Y - c.r));
  if (c.g < 0.0) t = min(t, Y / (Y - c.g));
  if (c.b < 0.0) t = min(t, Y / (Y - c.b));
  return max(vec3(Y) + t * (c - vec3(Y)), 0.0);
}
vec3 spectral(float l){
  vec3 x = cmf(l); vec3 d = gamutY(x); float mx = max(d.r, max(d.g, d.b));
  float fade = min(1.0, 0.22 + 1.5 * max(x.y, l < 500.0 ? x.z * 0.3 : 0.0));
  return mx > 1e-6 ? d / mx * fade : vec3(0.0);
}
`;

// ───────── Màn màu "uber": 8 loại tấm trong một lưới ─────────
const K = { stage: 0, cmy: 1, cube: 2, wheel: 3, after: 4, contrast: 5, spectrum: 6, cie: 7 } as const;
const UBER_FRAG = /* glsl */ `
${COMMON}
uniform float uT;
uniform vec3 uPlayer; uniform float uPlayerIn;
uniform vec3 uLv; uniform vec2 uLamp[3]; uniform float uLH; uniform vec4 uColumn; uniform vec3 uStage; uniform float uPoolR;
uniform vec3 uFT[8]; uniform vec3 uGel;
uniform float uCubeMode; uniform float uSlice; uniform vec3 uCube;
uniform vec3 uWheel[36]; uniform vec4 uHarmA; uniform float uHarmN; uniform vec3 uHarmCol[4];
uniform float uStare; uniform float uReveal; uniform vec3 uFlagF; uniform vec3 uFlagS;
uniform vec4 uPrism; uniform float uInAng; uniform float uInc; uniform vec2 uGlass; uniform float uProbe;
uniform vec2 uLocus[33]; uniform vec2 uDot[4]; uniform vec3 uDotCol[4]; uniform vec4 uDotOn;
varying vec2 vUv; varying float vKind; varying vec3 vP; varying vec2 vSize;

float pool(vec2 p, vec2 c){ float d = length(p - c) / uPoolR; return d >= 1.0 ? 0.0 : (d <= 0.85 ? 1.0 : 1.0 - (d - 0.85) / 0.15); }
bool cylBlock(vec3 F, vec3 L, vec2 C, float r, float h){
  vec2 d = L.xz - F.xz; vec2 o = F.xz - C;
  float a = dot(d, d); float b = 2.0 * dot(o, d); float c = dot(o, o) - r * r;
  if (c <= 0.0) return true;
  float disc = b * b - 4.0 * a * c;
  if (disc < 0.0) return false;
  float t = (-b - sqrt(disc)) / (2.0 * a);
  if (t <= 0.0 || t >= 1.0) return false;
  return F.y + t * (L.y - F.y) <= h;
}
vec3 stage(){
  vec2 p = vP.xz; float rr = length(p - uStage.xy);
  if (rr > uStage.z) discard;
  vec3 F = vec3(p.x, ${Y0.toFixed(1)}, p.y);
  vec3 sum = vec3(0.0);
  for (int i = 0; i < 3; i++) {
    float k = uLv[i] * pool(p, uLamp[i]);
    if (k <= 0.0) continue;
    vec3 L = vec3(uLamp[i].x, uLH, uLamp[i].y);
    if (cylBlock(F, L, uColumn.xy, uColumn.z, ${Y0.toFixed(1)} + uColumn.w)) continue;
    if (uPlayerIn > 0.5 && cylBlock(F, L, uPlayer.xz, 0.24, uPlayer.y + 1.62)) continue;
    sum[i] += k;
  }
  float rim = smoothstep(uStage.z - 0.08, uStage.z - 0.03, rr);
  vec3 c = 0.9 * sum + 0.012;
  return mix(c, vec3(0.32, 0.22, 0.1), rim);
}
vec3 cmyScreen(){
  vec2 q = (vUv - 0.5) * vSize;
  float r = length(q);
  vec3 bg = vec3(0.03, 0.028, 0.035);
  if (r > 1.0) return bg;
  int bits = 0;
  for (int i = 0; i < 3; i++) {
    float a = radians(90.0 + 120.0 * float(i));
    vec2 c = vec2(cos(a), sin(a)) * 0.36;
    c += normalize(c) * (1.0 - uGel[i]) * 2.2;
    if (length(q - c) < 0.62) bits += (i == 0 ? 1 : (i == 1 ? 2 : 4));
  }
  float edge = smoothstep(1.0, 0.97, r);
  return mix(bg, uFT[bits] * 0.92, edge);
}
vec3 cubeFloor(){
  float h = uCube.z * 0.5;
  float u = (vP.x - (uCube.x - h)) / uCube.z;
  float v = ((uCube.y + h) - vP.z) / uCube.z;
  vec3 c;
  bool inside = true;
  if (uCubeMode < 0.5) {
    c = s2l(vec3(u, uSlice, v));
    vec2 gq = abs(fract(vec2(u, v) * 4.0 + 0.5) - 0.5);
    c *= 1.0 - 0.12 * (1.0 - smoothstep(0.0, 0.012, min(gq.x, gq.y)));
  } else {
    vec2 d = vec2(vP.x - uCube.x, uCube.y - vP.z);
    float s = length(d) / h;
    if (s > 1.0) { inside = false; c = vec3(0.02); }
    else {
      float hue = mod(degrees(atan(d.y, d.x)) + 360.0, 360.0);
      c = s2l(hsv2rgb(hue, s, uSlice));
      float ring = abs(fract(s * 4.0 + 0.5) - 0.5);
      c *= 1.0 - 0.1 * (1.0 - smoothstep(0.0, 0.02, ring));
    }
  }
  float border = max(abs(u - 0.5), abs(v - 0.5));
  c = mix(c, vec3(0.32, 0.22, 0.1), smoothstep(0.49, 0.5, border));
  if (uPlayerIn > 0.5 && inside) {
    float pr = length(vP.xz - uPlayer.xz);
    c = mix(c, vec3(0.95), (1.0 - smoothstep(0.015, 0.03, abs(pr - 0.36))));
  }
  return c * 0.92;
}
vec3 wheelAt(float a){
  float f = mod(a, 360.0) / 10.0; int i = int(floor(f)); int j = i == 35 ? 0 : i + 1;
  return mix(uWheel[i], uWheel[j], fract(f));
}
vec3 wheel(){
  vec2 q = (vUv - 0.5) * 2.0; float r = length(q);
  if (r > 1.0) discard;
  float a = mod(degrees(atan(q.x, q.y)) + 360.0, 360.0);
  vec3 c = vec3(0.025);
  if (r > 0.64 && r < 0.97) c = wheelAt(a) * 0.9;
  if (r < 0.58) {
    float n = max(uHarmN, 1.0);
    int s = int(floor(a / 360.0 * n));
    c = (s == 0 ? uHarmCol[0] : s == 1 ? uHarmCol[1] : s == 2 ? uHarmCol[2] : uHarmCol[3]) * 0.9;
  }
  // vạch 30°
  float tick = step(0.975, r) * (1.0 - smoothstep(0.6, 1.4, abs(mod(a + 15.0, 30.0) - 15.0)));
  c = mix(c, vec3(0.9, 0.75, 0.4), tick);
  // kim chỉ các màu trong bộ phối
  for (int i = 0; i < 4; i++) {
    if (float(i) >= uHarmN) break;
    float ha = uHarmA[i];
    vec2 dir = vec2(sin(radians(ha)), cos(radians(ha)));
    float along = dot(q, dir); float lat = abs(q.x * dir.y - q.y * dir.x);
    float line = (1.0 - smoothstep(0.008, 0.016, lat)) * step(0.58, along) * step(along, 1.0);
    vec2 dp = dir * 0.805;
    float dotR = length(q - dp);
    c = mix(c, vec3(0.95), line * 0.85);
    c = mix(c, vec3(0.02), 1.0 - smoothstep(0.075, 0.085, dotR));
    c = mix(c, i == 0 ? vec3(0.95) : vec3(0.7), (1.0 - smoothstep(0.055, 0.065, dotR)) * smoothstep(0.035, 0.045, dotR));
  }
  return c;
}
float star5(vec2 p, float r){
  // SDF ngôi sao 5 cánh (đỉnh hướng lên)
  const float an = 3.141593 / 5.0; const float en = 3.141593 / 2.5;
  vec2 acs = vec2(cos(an), sin(an)); vec2 ecs = vec2(cos(en), sin(en));
  float bn = mod(atan(p.x, p.y), 2.0 * an) - an;
  p = length(p) * vec2(cos(bn), abs(sin(bn)));
  p -= r * acs; p += ecs * clamp(-dot(p, ecs), 0.0, r * acs.y / ecs.y);
  return length(p) * sign(p.x);
}
vec3 afterPanel(){
  vec2 q = (vUv - 0.5) * vSize;
  float H = vSize.y;
  if (uStare > 1.5) {
    // tường trắng + chấm ngắm: mắt tự thấy ảnh dư
    vec3 c = vec3(0.9);
    return mix(c, vec3(0.0), 1.0 - smoothstep(0.012, 0.02, length(q)));
  }
  vec3 c = star5(q, H * 0.3) < 0.0 ? uFlagS : uFlagF;
  if (uStare < 0.0) c *= 0.7;
  c = mix(c, vec3(0.0), 1.0 - smoothstep(0.012, 0.02, length(q)));
  if (uStare >= 0.0 && uStare <= 1.0) {
    // vòng đếm ngược mảnh quanh mép
    vec2 e = abs(q) - vSize * 0.5 + 0.03;
    float frame = step(max(e.x, e.y), 0.0) * step(-0.02, max(e.x, e.y));
    float ang = mod(degrees(atan(q.x, q.y)) + 360.0, 360.0) / 360.0;
    c = mix(c, vec3(0.9), frame * step(ang, uStare));
  }
  return c;
}
vec3 contrastPanel(){
  vec2 q = (vUv - 0.5) * vSize;
  float H = vSize.y;
  bool left = q.x < 0.0;
  bool swapBg = uReveal > 1.5;
  vec3 yel = vec3(0.85, 0.62, 0.0); vec3 blu = vec3(0.02, 0.06, 0.55);
  vec3 c = (left != swapBg) ? yel : blu;
  vec2 lc = vec2(left ? -vSize.x * 0.25 : vSize.x * 0.25, 0.0);
  float sq = max(abs(q.x - lc.x), abs(q.y - lc.y));
  vec3 grey = vec3(0.2159);
  if (sq < H * 0.16) c = grey;
  if (uReveal > 0.5 && uReveal < 1.5 && abs(q.y) < H * 0.035 && abs(q.x) < vSize.x * 0.25) c = grey;
  return c;
}
float hitZ(float nm){
  float n = uGlass.x + uGlass.y / pow(nm / 1000.0, 2.0);
  float r1 = asin(sin(uInc) / n);
  float r2 = radians(60.0) - r1;
  float s = clamp(n * sin(r2), -1.0, 1.0);
  float d = uInc + asin(s) - radians(60.0);
  return uPrism.y + tan(uInAng - d) * (uPrism.z - uPrism.x);
}
vec3 spectrumScreen(){
  float z = vP.z; float y = vP.y;
  vec3 bg = vec3(0.05, 0.048, 0.045);
  float z0 = hitZ(390.0); float z1 = hitZ(710.0);
  float beam = exp(-pow((y - (${Y0.toFixed(1)} + ${PRISM.y.toFixed(2)})) / 0.14, 2.0));
  vec3 c = bg;
  if (z > z0 && z < z1) {
    float lo = 390.0; float hi = 710.0;
    for (int i = 0; i < 12; i++) { float m = 0.5 * (lo + hi); if (hitZ(m) < z) lo = m; else hi = m; }
    c = bg + spectral(0.5 * (lo + hi)) * beam * 0.95;
  }
  // đầu dò: hai vạch trắng trên / dưới dải phổ
  float pz = hitZ(uProbe);
  float mark = (1.0 - smoothstep(0.004, 0.008, abs(z - pz))) * step(0.16, abs(y - (${Y0.toFixed(1)} + ${PRISM.y.toFixed(2)}))) * step(abs(y - (${Y0.toFixed(1)} + ${PRISM.y.toFixed(2)})), 0.32);
  return mix(c, vec3(0.9), mark);
}
float segD(vec2 p, vec2 a, vec2 b){ vec2 pa = p - a, ba = b - a; float h = clamp(dot(pa, ba) / dot(ba, ba), 0.0, 1.0); return length(pa - ba * h); }
vec3 cie(){
  vec2 xy = vec2(-0.02, -0.02) + vUv * vec2(0.8, 0.9);
  float px = 0.8 / vSize.x; // đơn vị xy trên mỗi mét
  vec3 c = vec3(0.022, 0.02, 0.03);
  vec2 g = abs(fract(xy * 10.0 + 0.5) - 0.5) / 10.0;
  c += vec3(0.05) * (1.0 - smoothstep(0.0, px * 0.006, min(g.x, g.y)));
  // trong móng ngựa?
  bool inside = false;
  for (int i = 0; i < 33; i++) {
    vec2 a = uLocus[i]; vec2 b = uLocus[i == 32 ? 0 : i + 1];
    if (((a.y > xy.y) != (b.y > xy.y)) && (xy.x < (b.x - a.x) * (xy.y - a.y) / (b.y - a.y) + a.x)) inside = !inside;
  }
  if (inside && xy.y > 0.0) {
    vec3 XYZ = vec3(xy.x / xy.y, 1.0, (1.0 - xy.x - xy.y) / xy.y);
    vec3 rgb = XYZ2RGB * XYZ;
    bool inGamut = min(rgb.r, min(rgb.g, rgb.b)) >= 0.0;
    vec3 d = gamutY(XYZ * 0.25);
    d /= max(d.r, max(d.g, d.b));
    if (inGamut) c = d * 0.85;
    else {
      float hatch = step(0.5, fract((xy.x + xy.y) / px / 0.06));
      c = d * (0.42 + 0.1 * hatch);
    }
  }
  float lw = px * 0.012;
  // tam giác sRGB + điểm trắng D65
  float tri = min(segD(xy, vec2(0.64, 0.33), vec2(0.3, 0.6)), min(segD(xy, vec2(0.3, 0.6), vec2(0.15, 0.06)), segD(xy, vec2(0.15, 0.06), vec2(0.64, 0.33))));
  c = mix(c, vec3(0.95), 1.0 - smoothstep(lw * 0.5, lw, tri));
  float wd = length(xy - vec2(0.3127, 0.329));
  c = mix(c, vec3(0.0), 1.0 - smoothstep(px * 0.03, px * 0.04, wd));
  c = mix(c, vec3(0.95), 1.0 - smoothstep(px * 0.018, px * 0.026, wd));
  // vạch bước sóng mỗi 20 nm trên đường phổ
  for (int i = 2; i < 33; i += 2) c = mix(c, vec3(0.9), 1.0 - smoothstep(px * 0.016, px * 0.024, length(xy - uLocus[i])));
  // đồng sắc: đoạn đỏ 630 – lục 532 (nét đứt) qua vàng 580
  vec3 a6 = cmf(630.0); vec3 a5 = cmf(532.0); vec3 a8 = cmf(580.0);
  vec2 p6 = a6.xy / (a6.x + a6.y + a6.z); vec2 p5 = a5.xy / (a5.x + a5.y + a5.z); vec2 p8 = a8.xy / (a8.x + a8.y + a8.z);
  float dash = step(0.5, fract(dot(xy - p5, normalize(p6 - p5)) / px / 0.08));
  c = mix(c, vec3(0.95), (1.0 - smoothstep(lw * 0.4, lw * 0.8, segD(xy, p5, p6))) * dash);
  c = mix(c, vec3(0.0), 1.0 - smoothstep(px * 0.04, px * 0.05, length(xy - p8)));
  c = mix(c, spectral(580.0) * 0.9, 1.0 - smoothstep(px * 0.028, px * 0.036, length(xy - p8)));
  // đầu dò bước sóng
  vec3 pc = cmf(uProbe); vec2 pp = pc.xy / (pc.x + pc.y + pc.z);
  float pr = length(xy - pp);
  c = mix(c, vec3(0.95), (1.0 - smoothstep(px * 0.012, px * 0.02, abs(pr - px * 0.075))));
  // chấm sống: màu đang pha ở các trạm
  for (int i = 0; i < 4; i++) {
    if (uDotOn[i] < 0.5) continue;
    float dd = length(xy - uDot[i]);
    c = mix(c, vec3(0.0), 1.0 - smoothstep(px * 0.05, px * 0.06, dd));
    c = mix(c, uDotCol[i], 1.0 - smoothstep(px * 0.035, px * 0.045, dd));
  }
  return c;
}
void main(){
  int k = int(vKind + 0.5);
  vec3 d;
  if (k == ${K.stage}) d = stage();
  else if (k == ${K.cmy}) d = cmyScreen();
  else if (k == ${K.cube}) d = cubeFloor();
  else if (k == ${K.wheel}) d = wheel();
  else if (k == ${K.after}) d = afterPanel();
  else if (k == ${K.contrast}) d = contrastPanel();
  else if (k == ${K.spectrum}) d = spectrumScreen();
  else d = cie();
  gl_FragColor = vec4(outCol(d), 1.0);
}`;

type Panel = { kind: number; c: [number, number, number]; w: number; h: number; face: "up" | "+x" | "-x" | "+z" };
/** Tấm phẳng: tâm c, rộng w (theo trục ngang của mặt), cao h; uv (0,0) ở góc dưới trái nhìn từ phía mặt */
function panelGeo(p: Panel) {
  const g = new THREE.PlaneGeometry(p.w, p.h);
  if (p.face === "up") g.rotateX(-Math.PI / 2);
  else if (p.face === "+x") g.rotateY(Math.PI / 2);
  else if (p.face === "-x") g.rotateY(-Math.PI / 2);
  g.translate(...p.c);
  const n = g.attributes.position.count;
  g.setAttribute("aKind", new THREE.Float32BufferAttribute(new Array(n).fill(p.kind), 1));
  g.setAttribute("aSize", new THREE.Float32BufferAttribute(new Array(n).fill(0).flatMap(() => [p.w, p.h]), 2));
  return g;
}
const AFTER_W = 2.2;
const AFTER_H = AFTER_W / 1.5;
const CIE_W = 3.4;
const CIE_H = (CIE_W / 0.8) * 0.9;
const CMY_SPOT_Y = Y0 + 1.3;
const PANELS: Panel[] = [
  { kind: K.stage, c: [ST.stage.x, Y0 + 0.014, ST.stage.z], w: ST.stage.R * 2, h: ST.stage.R * 2, face: "up" },
  { kind: K.cmy, c: [PH.MX1 - 0.03, CMY_SPOT_Y, ST.cmy.z], w: 3.0, h: 2.2, face: "-x" },
  { kind: K.cube, c: [ST.cube.x, Y0 + 0.014, ST.cube.z], w: ST.cube.S + 0.06, h: ST.cube.S + 0.06, face: "up" },
  { kind: K.wheel, c: [PH.X0 + 0.04, Y0 + 2.2, ST.wheel.z], w: 2.5, h: 2.5, face: "+x" },
  { kind: K.after, c: [PH.FX1 - 0.04, Y0 + 1.75, ST.illusion.z - 1.4], w: AFTER_W, h: AFTER_H, face: "-x" },
  { kind: K.contrast, c: [PH.FX1 - 0.04, Y0 + 1.75, ST.illusion.z + 1.6], w: AFTER_W, h: AFTER_H, face: "-x" },
  { kind: K.spectrum, c: [PRISM.screenX - 0.03, Y0 + 1.25, PRISM.z - 0.2], w: 2.6, h: 1.7, face: "-x" },
  { kind: K.cie, c: [ST.cie.x, Y0 + 0.35 + CIE_H / 2, PH.MZ0 + 0.04], w: CIE_W, h: CIE_H, face: "+z" },
];

function uberMaterial() {
  return new THREE.ShaderMaterial({
    uniforms: {
      ...CU,
      uPlayer: { value: new THREE.Vector3() },
      uPlayerIn: { value: 0 },
      uLv: { value: new THREE.Vector3(1, 1, 1) },
      uLamp: { value: [0, 1, 2].map((i) => new THREE.Vector2(...stageLamp(i))) },
      uLH: { value: Y0 + ST.stage.LH },
      uColumn: { value: new THREE.Vector4(ST.stage.x, ST.stage.z, STAGE_COLUMN.r, STAGE_COLUMN.h) },
      uStage: { value: new THREE.Vector3(ST.stage.x, ST.stage.z, ST.stage.R) },
      uPoolR: { value: POOL_R },
      uFT: { value: filterTable().map((c) => new THREE.Vector3(...c)) },
      uGel: { value: new THREE.Vector3() },
      uCubeMode: { value: 0 },
      uSlice: { value: 0.5 },
      uCube: { value: new THREE.Vector3(ST.cube.x, ST.cube.z, ST.cube.S) },
      uWheel: { value: Array.from({ length: 36 }, () => new THREE.Vector3()) },
      uHarmA: { value: new THREE.Vector4() },
      uHarmN: { value: 2 },
      uHarmCol: { value: Array.from({ length: 4 }, () => new THREE.Vector3()) },
      uStare: { value: -1 },
      uReveal: { value: 0 },
      uFlagF: { value: new THREE.Vector3(...FLAG_FIELD) },
      uFlagS: { value: new THREE.Vector3(...FLAG_STAR) },
      uPrism: { value: new THREE.Vector4(PRISM.x, PRISM.z, PRISM.screenX, 0) },
      uInAng: { value: PRISM_IN_ANGLE },
      uInc: { value: (PRISM_INC * Math.PI) / 180 },
      uGlass: { value: new THREE.Vector2(GLASS.sf11.A, GLASS.sf11.B) },
      uProbe: { value: 580 },
      uLocus: {
        value: [...Array.from({ length: 33 }, (_, i) => 380 + i * 10)].map((l) => new THREE.Vector2(...locusXy(l))),
      },
      uDot: { value: Array.from({ length: 4 }, () => new THREE.Vector2()) },
      uDotCol: { value: Array.from({ length: 4 }, () => new THREE.Vector3()) },
      uDotOn: { value: new THREE.Vector4() },
    },
    vertexShader: `attribute float aKind; attribute vec2 aSize; varying vec2 vUv; varying float vKind; varying vec3 vP; varying vec2 vSize;
      void main(){ vUv = uv; vKind = aKind; vSize = aSize; vP = position; gl_Position = projectionMatrix * modelViewMatrix * vec4(position, 1.0); }`,
    fragmentShader: UBER_FRAG,
    toneMapped: false,
    side: THREE.DoubleSide,
  });
}

// ───────── Đạo cụ: GLB nướng (props/prism_hall.glb, Blender collection COLOR_ROOM) + phần phát sáng gộp (một lệnh vẽ) ─────────
/** chỉ số phát sáng (uGlow): 1–3 thấu kính đèn R / G / B (× nấc), 4 đèn trắng, 5–8 đèn lồng, 9–16 nút bệ */
const GLOW = { lamp: 1, white: 4, lantern: 5, btnCyan: 9, btnR: 10, btnG: 11, btnB: 12, btnC: 13, btnM: 14, btnY: 15, btnGold: 16 } as const;
const BTN_OF: Record<ColorAct, number> = {
  "lamp-r": GLOW.btnR,
  "lamp-g": GLOW.btnG,
  "lamp-b": GLOW.btnB,
  "filter-c": GLOW.btnC,
  "filter-m": GLOW.btnM,
  "filter-y": GLOW.btnY,
  "cube-slice": GLOW.btnGold,
  "cube-mode": GLOW.btnGold,
  "cube-target": GLOW.btnGold,
  "wheel-hue": GLOW.btnCyan,
  "wheel-kind": GLOW.btnCyan,
  "wheel-space": GLOW.btnCyan,
  "illusion-stare": GLOW.btnGold,
  "illusion-reveal": GLOW.btnGold,
  "prism-probe": GLOW.btnCyan,
  "prism-cvd": GLOW.btnCyan,
};
const LANTERNS: [number, number][] = [
  [17.4, -6.3],
  [17.4, -5.1],
  [17.4, -3.9],
  [17.4, -2.7],
];
/**
 * Vỏ + đạo cụ tĩnh nướng GI (props/prism_hall.glb, 16 vật liệu) gộp thành MỘT lưới / một lệnh vẽ: albedo của từng vật liệu
 * thành thuộc tính đỉnh aAlb, ánh sáng nướng giữ trong màu đỉnh; cùng công thức giải nén + bậc hoá như fx/baked.ts.
 */
function mergeBaked(scene: THREE.Object3D) {
  const parts: THREE.BufferGeometry[] = [];
  scene.updateMatrixWorld(true);
  scene.traverse((o) => {
    const mesh = o as THREE.Mesh;
    if (!mesh.isMesh) return;
    const src = mesh.material as THREE.MeshStandardMaterial;
    const g = new THREE.BufferGeometry();
    g.setAttribute("position", mesh.geometry.getAttribute("position").clone());
    const col = mesh.geometry.getAttribute("color");
    const n = g.attributes.position.count;
    g.setAttribute("color", col ? col.clone() : new THREE.Uint8BufferAttribute(new Uint8Array(n * 4).fill(255), 4, true));
    if (mesh.geometry.index) g.setIndex(mesh.geometry.index.clone());
    g.applyMatrix4(mesh.matrixWorld);
    const glow = src.name.startsWith("glow_");
    const k = glow ? 2.2 : 1;
    const alb = new Float32Array(n * 3);
    for (let i = 0; i < n; i++) alb.set([src.color.r * k, src.color.g * k, src.color.b * k], i * 3);
    g.setAttribute("aAlb", new THREE.BufferAttribute(alb, 3));
    g.setAttribute("aLit", new THREE.BufferAttribute(new Float32Array(n).fill(glow ? 0 : 1), 1));
    parts.push(g);
  });
  const geo = mergeGeometries(parts)!;
  parts.forEach((p) => p.dispose());
  const m = new THREE.MeshBasicMaterial({ vertexColors: true });
  m.onBeforeCompile = (sh) => {
    Object.assign(sh.uniforms, { uExposure: PROP_U.uExposure, uFloor: PROP_U.uFloor, uTint: PROP_U.uTint, uScale: PROP_U.uScale });
    sh.vertexShader = sh.vertexShader
      .replace("#include <common>", "#include <common>\nattribute vec3 aAlb; attribute float aLit; varying vec3 vAlb; varying float vLit;")
      .replace("#include <begin_vertex>", "#include <begin_vertex>\nvAlb = aAlb; vLit = aLit;");
    sh.fragmentShader = sh.fragmentShader
      .replace("#include <common>", "#include <common>\nuniform float uExposure; uniform float uFloor; uniform vec3 uTint; uniform float uScale; varying vec3 vAlb; varying float vLit;")
      .replace(
        "#include <color_fragment>",
        `vec3 irr = pow(max(vColor.rgb, vec3(0.0)), vec3(1.818)) * uScale;
        float lum = dot(irr, vec3(0.3, 0.59, 0.11));
        float lumQ = mix(lum, floor(lum * 2.5 + 0.5) / 2.5, 0.3);
        vec3 tint = min((irr + 0.06) / (lum + 0.06), vec3(2.2));
        diffuseColor.rgb = vLit > 0.5 ? vAlb * tint * max(lumQ, uFloor) * uExposure * uTint : vAlb;`,
      );
  };
  m.customProgramCacheKey = () => "prismHallBaked";
  const mesh = new THREE.Mesh(geo, m);
  mesh.name = "ph_baked";
  mesh.frustumCulled = false;
  return mesh;
}

/** Phần PHÁT SÁNG của đạo cụ (nút bệ, thấu kính đèn, đèn chiếu, lỗ cửa chớp, thân giấy đèn lồng) — vỏ và đạo cụ tĩnh là GLB nướng */
function glowGeometry() {
  const parts: THREE.BufferGeometry[] = [];
  const cyl = (r0: number, r1: number, h: number, x: number, y: number, z: number, glow: number, seg = 16, rotZ = 0, rotX = 0) => {
    const g = new THREE.CylinderGeometry(r0, r1, h, seg);
    if (rotZ) g.rotateZ(rotZ);
    if (rotX) g.rotateX(rotX);
    g.translate(x, y, z);
    const ng = g.toNonIndexed();
    g.dispose();
    const n = ng.attributes.position.count;
    ng.setAttribute("aGlow", new THREE.Float32BufferAttribute(new Array(n).fill(glow), 1));
    ng.deleteAttribute("uv");
    ng.deleteAttribute("normal");
    parts.push(ng);
  };
  for (const [id, x, z] of PEDESTALS) cyl(0.075, 0.075, 0.04, x, Y0 + 1.06, z, BTN_OF[id]);
  const rigY = Y0 + ST.stage.LH;
  for (let i = 0; i < 3; i++) {
    const [lx, lz] = stageLamp(i);
    cyl(0.12, 0.12, 0.02, lx, rigY - 0.005, lz, GLOW.lamp + i, 20);
  }
  cyl(0.12, 0.12, 0.01, ST.cmy.x + 0.535, CMY_SPOT_Y, ST.cmy.z, GLOW.white, 16, Math.PI / 2);
  cyl(0.08, 0.08, 0.02, PRISM_HOLE[0], Y0 + PRISM.y, PH.MZ0 + 0.07, GLOW.white, 16, 0, Math.PI / 2);
  LANTERNS.forEach(([x, z], i) => cyl(0.2, 0.2, 0.42, x, Y0 + 3.17, z, GLOW.lantern + i, 14));
  const g = mergeGeometries(parts)!;
  parts.forEach((p) => p.dispose());
  return g;
}
function glowMaterial() {
  return new THREE.ShaderMaterial({
    uniforms: { ...CU, uGlow: { value: Array.from({ length: 17 }, () => new THREE.Vector3()) } },
    vertexShader: `attribute float aGlow; varying float vGlow;
      void main(){ vGlow = aGlow; gl_Position = projectionMatrix * modelViewMatrix * vec4(position, 1.0); }`,
    fragmentShader: `${COMMON}
      uniform vec3 uGlow[17]; varying float vGlow;
      void main(){ gl_FragColor = vec4(outGlow(uGlow[int(vGlow + 0.5)]), 1.0); }`,
    toneMapped: false,
  });
}

// ───────── Mạng 5³ khối lơ lửng (khối RGB / trụ HSV) ─────────
const LAT_N = 125;
const LAT_Y0 = Y0 + 2.05;
const LAT_Y1 = Y0 + 3.55;
function latticeLayout(mode: CubeMode, slice: number) {
  const out: { p: [number, number, number]; c: RGB; on: boolean }[] = [];
  const h = ST.cube.S / 2 - 0.15;
  for (let gi = 0; gi < 5; gi++) {
    const g = gi / 4;
    const y = LAT_Y0 + (LAT_Y1 - LAT_Y0) * g;
    const on = Math.abs(g - slice) < 1e-6;
    if (mode === "rgb") {
      for (let i = 0; i < 5; i++)
        for (let j = 0; j < 5; j++) out.push({ p: [ST.cube.x - h + (2 * h * i) / 4, y, ST.cube.z + h - (2 * h * j) / 4], c: toLinear([i / 4, g, j / 4]), on });
    } else {
      out.push({ p: [ST.cube.x, y, ST.cube.z], c: toLinear([g, g, g]), on });
      for (const [n, s] of [
        [8, 0.5],
        [16, 1],
      ] as const)
        for (let k = 0; k < n; k++) {
          const hue = (360 * k) / n;
          const a = (hue * Math.PI) / 180;
          const hv = hsvRgb(hue, s, g);
          out.push({ p: [ST.cube.x + Math.cos(a) * h * s, y, ST.cube.z - Math.sin(a) * h * s], c: toLinear(hv), on });
        }
    }
  }
  return out;
}
function hsvRgb(h: number, s: number, v: number): RGB {
  const f = (n: number) => {
    const k = (n + h / 60) % 6;
    return v - v * s * Math.max(0, Math.min(k, 4 - k, 1));
  };
  return [f(5), f(3), f(1)];
}
function latticeMaterial() {
  return new THREE.ShaderMaterial({
    uniforms: { ...CU },
    vertexShader: `attribute vec3 aCol; varying vec3 vC; varying vec3 vN;
      void main(){ vC = aCol; vN = normalize(mat3(instanceMatrix) * normal); gl_Position = projectionMatrix * modelViewMatrix * instanceMatrix * vec4(position, 1.0); }`,
    fragmentShader: `${COMMON} varying vec3 vC; varying vec3 vN;
      void main(){ float l = 0.8 + 0.2 * max(dot(normalize(vN), vec3(0.3, 0.9, 0.3)), 0.0); gl_FragColor = vec4(outCol(vC * l * 0.95), 1.0); }`,
    toneMapped: false,
  });
}

// ───────── Kính lọc (3 tấm trong suốt trượt vào chùm sáng) ─────────
function gelMaterial() {
  return new THREE.ShaderMaterial({
    uniforms: { ...CU },
    vertexShader: `attribute vec3 aCol; varying vec3 vC; varying vec2 vUv;
      void main(){ vC = aCol; vUv = uv; gl_Position = projectionMatrix * modelViewMatrix * instanceMatrix * vec4(position, 1.0); }`,
    fragmentShader: `${COMMON} varying vec3 vC; varying vec2 vUv;
      void main(){ vec2 e = abs(vUv - 0.5); float rim = smoothstep(0.44, 0.48, max(e.x, e.y)); gl_FragColor = vec4(outCol(mix(vC, vec3(0.36, 0.25, 0.1), rim)), mix(0.62, 1.0, rim)); }`,
    transparent: true,
    depthWrite: false,
    side: THREE.DoubleSide,
    toneMapped: false,
  });
}

// ───────── Chùm sáng giả thể tích (cộng): 3 đèn sân khấu, đèn chiếu, tia nắng, quạt phổ ─────────
function beamsGeometry() {
  const parts: THREE.BufferGeometry[] = [];
  const put = (g: THREE.BufferGeometry, col: RGB, id: number) => {
    const ng = g.index ? g.toNonIndexed() : g;
    if (ng !== g) g.dispose();
    const n = ng.attributes.position.count;
    ng.setAttribute("color", new THREE.Float32BufferAttribute(new Array(n).fill(0).flatMap(() => col), 3));
    ng.setAttribute("aId", new THREE.Float32BufferAttribute(new Array(n).fill(id), 1));
    if (!ng.attributes.uv) ng.setAttribute("uv", new THREE.Float32BufferAttribute(new Array(n * 2).fill(0), 2));
    ng.deleteAttribute("normal");
    parts.push(ng);
  };
  // nón từ đèn (trên) xuống vũng sáng
  for (let i = 0; i < 3; i++) {
    const [lx, lz] = stageLamp(i);
    const H = ST.stage.LH;
    const g = new THREE.CylinderGeometry(0.12, POOL_R * 0.92, H, 24, 1, true);
    g.translate(lx, Y0 + H / 2, lz);
    put(g, LAMP_RGB[i], i);
  }
  // đèn chiếu → màn (trục x)
  const L = PH.MX1 - (ST.cmy.x + 0.55);
  const pc = new THREE.CylinderGeometry(0.12, 1.0, L, 24, 1, true);
  pc.rotateZ(-Math.PI / 2);
  pc.translate(ST.cmy.x + 0.55 + L / 2, CMY_SPOT_Y, ST.cmy.z);
  put(pc, [1, 1, 1], 3);
  // tia nắng: lỗ → lăng kính
  const a = new THREE.Vector3(PRISM_HOLE[0], Y0 + PRISM.y, PRISM_HOLE[1]);
  const b = new THREE.Vector3(PRISM.x, Y0 + PRISM.y, PRISM.z);
  const sun = new THREE.CylinderGeometry(0.05, 0.06, a.distanceTo(b), 12, 1, true);
  sun.applyQuaternion(new THREE.Quaternion().setFromUnitVectors(new THREE.Vector3(0, 1, 0), b.clone().sub(a).normalize()));
  sun.translate((a.x + b.x) / 2, (a.y + b.y) / 2, (a.z + b.z) / 2);
  put(sun, [1, 0.97, 0.92], 4);
  // quạt phổ: lăng kính → màn (dải tam giác theo bước sóng, màu từ CMF)
  const pos: number[] = [];
  const col: number[] = [];
  const yb = Y0 + PRISM.y;
  for (let l = 400; l < 700; l += 10) {
    const z0 = spectrumHitZ(l);
    const z1 = spectrumHitZ(l + 10);
    if (z0 === null || z1 === null) continue;
    const c0 = spectralRgb(l);
    const c1 = spectralRgb(l + 10);
    for (const dy of [-0.05, 0.05]) {
      pos.push(PRISM.x, yb, PRISM.z, PRISM.screenX - 0.05, yb + dy, z0, PRISM.screenX - 0.05, yb + dy, z1);
      col.push(...c0, ...c0, ...c1);
    }
  }
  const fan = new THREE.BufferGeometry();
  fan.setAttribute("position", new THREE.Float32BufferAttribute(pos, 3));
  fan.setAttribute("color", new THREE.Float32BufferAttribute(col, 3));
  fan.setAttribute("aId", new THREE.Float32BufferAttribute(new Array(pos.length / 3).fill(5), 1));
  fan.setAttribute("uv", new THREE.Float32BufferAttribute(new Array((pos.length / 3) * 2).fill(0.5), 2));
  parts.push(fan);
  const g = mergeGeometries(parts)!;
  parts.forEach((p) => p.dispose());
  return g;
}
function beamsMaterial() {
  return new THREE.ShaderMaterial({
    uniforms: { ...CU, uK: { value: [1, 1, 1, 1, 1, 1] } },
    vertexShader: `attribute vec3 color; attribute float aId; varying vec3 vC; varying float vId; varying vec2 vUv;
      void main(){ vC = color; vId = aId; vUv = uv; gl_Position = projectionMatrix * modelViewMatrix * vec4(position, 1.0); }`,
    fragmentShader: `${COMMON} uniform float uK[6]; varying vec3 vC; varying float vId; varying vec2 vUv;
      void main(){
        int i = int(vId + 0.5);
        float k = uK[i];
        float a = i < 3 ? 0.05 * (0.35 + 0.65 * vUv.y) : (i == 5 ? 0.22 : 0.07);
        gl_FragColor = vec4(outGlow(vC) * k * a, 1.0);
      }`,
    transparent: true,
    depthWrite: false,
    blending: THREE.AdditiveBlending,
    side: THREE.DoubleSide,
    toneMapped: false,
  });
}

// ───────── Bảng số ─────────
function mathEl(el: HTMLDivElement) {
  el.style.whiteSpace = "pre";
  el.style.fontFamily = "ui-monospace, SFMono-Regular, Menlo, monospace";
  el.style.fontSize = "11px";
  el.style.lineHeight = "1.4";
  el.style.borderRadius = "10px";
  el.style.background = "rgba(16,12,30,0.84)";
  el.style.border = "1px solid rgba(232,192,112,0.55)";
}
const n2 = (v: number, vi: boolean, d = 2) => (vi ? v.toFixed(d).replace(".", ",") : v.toFixed(d));
const vec = (c: RGB, vi: boolean, d = 2) => `(${c.map((v) => n2(v, vi, d)).join(vi ? "; " : ", ")})`;
const swatch = (c: RGB) => `<span style="display:inline-block;width:12px;height:12px;border-radius:3px;vertical-align:-2px;border:1px solid #fff8;background:${HEX(c)}"></span>`;

export function PrismHall({ cx, cz }: { cx: number; cz: number }) {
  const vi = useWorld((s) => s.lang === "vi");
  const real = usePdxStyle((s) => s.real);
  const quality = useWorld((s) => s.quality);
  const lowQ = quality === "low";
  const root = useRef<THREE.Group>(null);
  const beamsRef = useRef<THREE.Mesh>(null);
  const els = useRef<Record<string, HTMLDivElement | null>>({});

  const gltf = useGLTF(GLB);
  const res = useMemo(() => {
    const uberGeo = mergeGeometries(PANELS.map(panelGeo))!;
    const uber = uberMaterial();
    const baked = mergeBaked(gltf.scene);
    const propGeo = glowGeometry();
    const props = glowMaterial();
    const latGeo = new THREE.BoxGeometry(0.13, 0.13, 0.13);
    latGeo.setAttribute("aCol", new THREE.InstancedBufferAttribute(new Float32Array(LAT_N * 3), 3));
    const lat = new THREE.InstancedMesh(latGeo, latticeMaterial(), LAT_N);
    lat.frustumCulled = false;
    const gelGeo = new THREE.PlaneGeometry(0.5, 0.5);
    gelGeo.rotateY(Math.PI / 2);
    gelGeo.setAttribute("aCol", new THREE.InstancedBufferAttribute(new Float32Array(FILTER_IDS.flatMap((id) => filterSpectral([id]))), 3));
    const gels = new THREE.InstancedMesh(gelGeo, gelMaterial(), 3);
    gels.frustumCulled = false;
    gels.renderOrder = 5;
    const beamGeo = beamsGeometry();
    const beams = beamsMaterial();
    return { uberGeo, uber, baked, propGeo, props, lat, gels, beamGeo, beams };
  }, [gltf]);
  useEffect(
    () => () => {
      [res.uberGeo, res.baked.geometry, res.propGeo, res.beamGeo, res.lat.geometry, res.gels.geometry].forEach((g) => g.dispose());
      [res.uber, res.baked.material as THREE.Material, res.props, res.beams, res.lat.material as THREE.Material, res.gels.material as THREE.Material].forEach((m) => m.dispose());
      res.lat.dispose();
      res.gels.dispose();
    },
    [res],
  );

  // ── cập nhật hình học phụ thuộc trạng thái (hiếm) ──
  const syncLattice = useMemo(
    () => () => {
      const L = latticeLayout(CT.mode, CT.slice);
      const m = new THREE.Matrix4();
      const attr = res.lat.geometry.getAttribute("aCol") as THREE.InstancedBufferAttribute;
      L.forEach((e, i) => {
        const s = e.on ? 1.45 : 0.62;
        m.makeScale(s, s, s).setPosition(e.p[0], e.p[1], e.p[2]);
        res.lat.setMatrixAt(i, m);
        attr.setXYZ(i, e.c[0] * (e.on ? 1 : 0.55), e.c[1] * (e.on ? 1 : 0.55), e.c[2] * (e.on ? 1 : 0.55));
      });
      res.lat.instanceMatrix.needsUpdate = true;
      attr.needsUpdate = true;
      const u = res.uber.uniforms;
      u.uCubeMode.value = CT.mode === "rgb" ? 0 : 1;
      u.uSlice.value = CT.slice;
    },
    [res],
  );
  const syncWheel = useMemo(
    () => () => {
      const u = res.uber.uniforms;
      (u.uWheel.value as THREE.Vector3[]).forEach((v, i) => v.set(...wheelColor(i * 10, CT.wheel)));
      const offs = HARMONY_OFFSETS[CT.harmony];
      const cols = harmonyColors(CT.hue, CT.harmony, CT.wheel);
      u.uHarmN.value = offs.length;
      (u.uHarmA.value as THREE.Vector4).set(...([0, 1, 2, 3].map((i) => (CT.hue + (offs[i] ?? 0) + 360) % 360) as [number, number, number, number]));
      (u.uHarmCol.value as THREE.Vector3[]).forEach((v, i) => v.set(...(cols[i] ?? cols[0])));
      const g = res.props.uniforms.uGlow.value as THREE.Vector3[];
      for (let i = 0; i < 4; i++) {
        const c = cols[i % cols.length];
        g[GLOW.lantern + i].set(c[0] * 1.6, c[1] * 1.6, c[2] * 1.6);
      }
    },
    [res],
  );
  const syncCvd = () => {
    const m = CVD[CT.cvd];
    CU.uCvd.value.set(m[0], m[1], m[2], m[3], m[4], m[5], m[6], m[7], m[8]);
  };
  useEffect(() => {
    const g = res.props.uniforms.uGlow.value as THREE.Vector3[];
    g[GLOW.white].set(2.2, 2.15, 2.0);
    g[GLOW.btnCyan].set(0.3, 1.6, 1.8);
    g[GLOW.btnR].set(2, 0.1, 0.1);
    g[GLOW.btnG].set(0.1, 2, 0.1);
    g[GLOW.btnB].set(0.15, 0.2, 2.4);
    g[GLOW.btnC].set(0.1, 1.6, 1.8);
    g[GLOW.btnM].set(1.8, 0.1, 1.4);
    g[GLOW.btnY].set(1.9, 1.6, 0.1);
    g[GLOW.btnGold].set(1.9, 1.3, 0.45);
    syncLattice();
    syncWheel();
    syncCvd();
  }, [res, syncLattice, syncWheel]);

  // ── hành động F ──
  useEffect(() => {
    const offs: (() => void)[] = [];
    const on = (id: ColorAct, fn: () => void) => offs.push(registerAction(`color:${id}`, fn));
    const checkLight = () => {
      const t = LIGHT_TARGETS[CT.lightTarget];
      if (sameLevels(CT.lv, t.lv)) {
        CT.lightSolved++;
        CT.lightTarget = (CT.lightTarget + 1) % LIGHT_TARGETS.length;
        sfx.chime(2);
        if (CT.lightSolved >= 3) unlockNote("colorlight");
      }
    };
    (["lamp-r", "lamp-g", "lamp-b"] as const).forEach((id, i) =>
      on(id, () => {
        CT.lv[i] = nextLevel(CT.lv[i]);
        sfx.click();
        checkLight();
      }),
    );
    (["filter-c", "filter-m", "filter-y"] as const).forEach((id, i) =>
      on(id, () => {
        CT.gel[i] = !CT.gel[i];
        sfx.click();
        if (mask() === FILTER_TARGETS[CT.filterTarget].mask) {
          CT.filterSolved++;
          CT.filterTarget = (CT.filterTarget + 1) % FILTER_TARGETS.length;
          sfx.chime(2);
          if (CT.filterSolved >= 3) unlockNote("colorsub");
        }
      }),
    );
    on("cube-slice", () => {
      CT.slice = nextSlice(CT.slice);
      sfx.click();
      syncLattice();
    });
    on("cube-mode", () => {
      CT.mode = CT.mode === "rgb" ? "hsv" : "rgb";
      sfx.click();
      syncLattice();
    });
    on("cube-target", () => {
      CT.target = (CT.target + 1) % CUBE_TARGETS.length;
      sfx.click();
    });
    on("wheel-hue", () => {
      CT.hue = (CT.hue + 30) % 360;
      sfx.click();
      syncWheel();
    });
    on("wheel-kind", () => {
      CT.harmony = nextHarmony(CT.harmony);
      CT.kindsSeen.add(CT.harmony);
      sfx.click();
      syncWheel();
    });
    on("wheel-space", () => {
      CT.wheel = nextWheel(CT.wheel);
      CT.wheelsSeen.add(CT.wheel);
      sfx.click();
      syncWheel();
      if (CT.wheelsSeen.size >= 3 && CT.kindsSeen.size >= 3) unlockNote("colorwheel");
    });
    on("illusion-stare", () => {
      CT.stare = performance.now();
      sfx.click();
    });
    on("illusion-reveal", () => {
      CT.reveal = (CT.reveal + 1) % 3;
      if (CT.reveal === 2) CT.revealed = true;
      sfx.click();
      if (CT.revealed && CT.stared) unlockNote("colorperception");
    });
    on("prism-probe", () => {
      CT.probe = nextProbe(CT.probe);
      sfx.click();
    });
    on("prism-cvd", () => {
      CT.cvd = nextCvd(CT.cvd);
      if (CT.cvd !== "normal") CT.cvdSeen.add(CT.cvd);
      syncCvd();
      sfx.click();
      if (CT.cvdSeen.size >= 3) unlockNote("colorcie");
    });
    return () => {
      offs.forEach((f) => f());
      CT.cvd = "normal";
      syncCvd();
    };
  }, [syncLattice, syncWheel]);

  // ── mỗi khung ──
  const gelM = useMemo(() => new THREE.Matrix4(), []);
  const lastRead = useRef(0);
  const prevNear = useRef(false);
  useFrame((_, dt) => {
    const g = root.current;
    if (!g) return;
    let on = true;
    for (let o: THREE.Object3D | null = g.parent; o; o = o.parent) if (!o.visible) on = false;
    const p = useWorld.getState().player;
    const lx = p.x - cx;
    const lz = p.z - cz;
    // chỉ vẽ khi đứng trên tầng lửng gần vòm 90° hoặc đã ở trong phòng
    g.visible = on && lx > 11.5 && p.y > 3.8;
    if (!g.visible) {
      // rời phòng: tháo kính mô phỏng mù màu
      if (prevNear.current && CT.cvd !== "normal") {
        CT.cvd = "normal";
        syncCvd();
      }
      prevNear.current = false;
      return;
    }
    prevNear.current = true;
    const u = res.uber.uniforms;
    CU.uInvTM.value = real ? 0 : 1;
    const inHall = inPrismHall(lx, lz) && Math.abs(p.y - Y0) < 0.6;
    (u.uPlayer.value as THREE.Vector3).set(lx, p.y, lz);
    u.uPlayerIn.value = inHall ? 1 : 0;
    (u.uLv.value as THREE.Vector3).set(CT.lv[0], CT.lv[1], CT.lv[2]);
    const pg = res.props.uniforms.uGlow.value as THREE.Vector3[];
    for (let i = 0; i < 3; i++) pg[GLOW.lamp + i].set(LAMP_RGB[i][0] * CT.lv[i] * 3 + 0.04, LAMP_RGB[i][1] * CT.lv[i] * 3 + 0.04, LAMP_RGB[i][2] * CT.lv[i] * 3 + 0.04);
    const bk = res.beams.uniforms.uK.value as number[];
    bk[0] = CT.lv[0];
    bk[1] = CT.lv[1];
    bk[2] = CT.lv[2];
    if (beamsRef.current) beamsRef.current.visible = !lowQ;
    // kính lọc trượt
    let moved = false;
    for (let i = 0; i < 3; i++) {
      const tgt = CT.gel[i] ? 1 : 0;
      const k = CT.gelK[i] + (tgt - CT.gelK[i]) * Math.min(1, dt * 6);
      if (Math.abs(k - CT.gelK[i]) > 1e-4 || res.gels.userData.init !== true) moved = true;
      CT.gelK[i] = Math.abs(k - tgt) < 1e-3 ? tgt : k;
    }
    if (moved) {
      res.gels.userData.init = true;
      for (let i = 0; i < 3; i++) {
        const a = ((90 + 120 * i) * Math.PI) / 180;
        // trong chùm: lệch nhỏ theo Venn; ngoài: hạ xuống giá
        const yy = CMY_SPOT_Y + Math.sin(a) * 0.1 - (1 - CT.gelK[i]) * 0.75;
        const zz = ST.cmy.z - Math.cos(a) * 0.1;
        gelM.makeTranslation(ST.cmy.x + 0.8 + i * 0.04, yy, zz);
        res.gels.setMatrixAt(i, gelM);
      }
      res.gels.instanceMatrix.needsUpdate = true;
      (u.uGel.value as THREE.Vector3).set(CT.gelK[0], CT.gelK[1], CT.gelK[2]);
    }
    // ảnh dư: 15 s nhìn → 8 s tường trắng
    if (CT.stare >= 0) {
      const s = (performance.now() - CT.stare) / 1000;
      if (s < 15) u.uStare.value = s / 15;
      else if (s < 23) {
        u.uStare.value = 2;
        if (!CT.stared) {
          CT.stared = true;
          sfx.chime(1);
          if (CT.revealed) unlockNote("colorperception");
        }
      } else {
        CT.stare = -1;
        u.uStare.value = -1;
      }
    } else u.uStare.value = -1;
    u.uReveal.value = CT.reveal;
    u.uProbe.value = CT.probe;
    // bảng số: 4 lần / giây
    const now = performance.now();
    if (now - lastRead.current < 250) return;
    // chấm sống trên giản đồ CIE: vùng giữa sân khấu, đốm giữa kính lọc, chỗ đứng trong khối
    const dots = u.uDot.value as THREE.Vector2[];
    const dcol = u.uDotCol.value as THREE.Vector3[];
    const don = u.uDotOn.value as THREE.Vector4;
    const mixC = stageColorAt(ST.stage.x, ST.stage.z, CT.lv);
    const filt = (u.uFT.value as THREE.Vector3[])[mask()];
    const here = cubeColorAt(lx, lz, CT.mode, CT.slice);
    const setDot = (i: number, c: RGB | null) => {
      const ok = !!c && c[0] + c[1] + c[2] > 0.02;
      don.setComponent(i, ok ? 1 : 0);
      if (!ok || !c) return;
      const [x, y] = xyOf(rgbToXyz(c));
      dots[i].set(x, y);
      const m = Math.max(...c);
      dcol[i].set(c[0] / m, c[1] / m, c[2] / m);
    };
    setDot(0, mixC);
    setDot(1, [filt.x, filt.y, filt.z]);
    setDot(2, here && inHall ? toLinear(here) : null);
    // tìm màu trong khối
    if (here && inHall) {
      const t = CUBE_TARGETS[CT.target];
      if (cubeMiss(here, t.c) < CUBE_HIT) {
        CT.found++;
        CT.target = (CT.target + 1) % CUBE_TARGETS.length;
        sfx.chime(2);
        if (CT.found >= 3) unlockNote("colorspace");
      }
    }
    lastRead.current = now;
    writeReadouts(els.current, vi, lx, lz, here, inHall);
  });

  const lab = (k: string) => (el: HTMLDivElement) => {
    els.current[k] = el;
    mathEl(el);
  };
  const t = (a: string, b: string) => (vi ? a : b);
  return (
    <group ref={root} visible={false} name="prism_hall">
      <primitive object={res.baked} />
      <mesh geometry={res.uberGeo} material={res.uber} frustumCulled={false} />
      <mesh geometry={res.propGeo} material={res.props} frustumCulled={false} />
      <primitive object={res.lat} />
      <primitive object={res.gels} />
      <mesh ref={beamsRef} geometry={res.beamGeo} material={res.beams} frustumCulled={false} renderOrder={6} />
      {/* biển tên các trạm (câu hỏi "đoán trước") */}
      <Label3D text={t("Phòng Lăng kính · Lý thuyết màu", "The Prism Hall · Colour theory")} position={[PH.X0 + 0.6, Y0 + PH.AH + 0.5, 0]} variant="small" maxDist={14} />
      <Label3D text={t("Ánh sáng cộng · Đoán: chặn đèn đỏ thì bóng màu gì?", "Light adds · Predict: block the red lamp — what colour is the shadow?")} position={[ST.stage.x, Y0 + 3.0, ST.stage.z + 2.2]} variant="small" maxDist={12} />
      <Label3D text={t("Kính lọc trừ ánh sáng · Đoán: vàng + lam lục = ?", "Filters subtract · Predict: yellow + cyan = ?")} position={[ST.cmy.x + 1.2, Y0 + 2.9, ST.cmy.z]} variant="small" maxDist={12} />
      <Label3D text={t("Vị trí của bạn LÀ một màu", "Where you stand IS a colour")} position={[ST.cube.x, Y0 + 4.0, ST.cube.z]} variant="small" maxDist={12} />
      <Label3D text={t("Vòng màu & phối màu", "Colour wheel & harmonies")} position={[PH.X0 + 0.3, Y0 + 3.75, ST.wheel.z]} variant="small" maxDist={10} />
      <Label3D text={t("Mắt không phải máy đo", "Your eye is not a meter")} position={[PH.FX1 - 0.3, Y0 + 2.9, ST.illusion.z]} variant="small" maxDist={10} />
      <Label3D text={t("Phòng tối của Newton (1666)", "Newton's darkened room (1666)")} position={[PRISM.x + 1.2, Y0 + 2.5, PRISM.z]} variant="small" maxDist={10} />
      <Label3D text={t("Giản đồ sắc độ CIE 1931", "CIE 1931 chromaticity diagram")} position={[ST.cie.x, Y0 + 0.35 + CIE_H + 0.25, PH.MZ0 + 0.3]} variant="small" maxDist={14} />
      {/* bảng số sống */}
      <group position={[ST.stage.x - 3.3, Y0 + 2.4, ST.stage.z + 1.2]}>
        <Label3D variant="math" maxDist={9} onEl={lab("stage")} />
      </group>
      <group position={[ST.cmy.x - 1.0, Y0 + 2.3, ST.cmy.z + 1.9]}>
        <Label3D variant="math" maxDist={9} onEl={lab("cmy")} />
      </group>
      <group position={[ST.cube.x, Y0 + 2.4, ST.cube.z + 3.1]}>
        <Label3D variant="math" maxDist={9} onEl={lab("cube")} />
      </group>
      <group position={[PH.X0 + 0.5, Y0 + 0.7, ST.wheel.z]}>
        <Label3D variant="math" maxDist={8} onEl={lab("wheel")} />
      </group>
      <group position={[PH.FX1 - 0.5, Y0 + 0.55, ST.illusion.z]}>
        <Label3D variant="math" maxDist={8} onEl={lab("illusion")} />
      </group>
      <group position={[PRISM.x + 1.6, Y0 + 2.0, PRISM.z + 2.6]}>
        <Label3D variant="math" maxDist={9} onEl={lab("prism")} />
      </group>
      <group position={[ST.cie.x + CIE_W / 2 + 1.05, Y0 + 2.6, ST.cie.z + 0.6]}>
        <Label3D variant="math" maxDist={10} onEl={lab("cie")} />
      </group>
    </group>
  );
}

/** Nội dung các bảng số (chỉ cập nhật bảng ở gần người chơi) */
function writeReadouts(els: Record<string, HTMLDivElement | null>, vi: boolean, lx: number, lz: number, here: RGB | null, inHall: boolean) {
  const near = (x: number, z: number, r = 7) => Math.hypot(lx - x, lz - z) < r;
  const set = (k: string, html: string) => {
    const el = els[k];
    if (el && el.dataset.v !== html) {
      el.dataset.v = html;
      el.innerHTML = html;
    }
  };
  if (near(ST.stage.x, ST.stage.z, 8)) {
    const c = stageColorAt(ST.stage.x, ST.stage.z, CT.lv);
    const t = LIGHT_TARGETS[CT.lightTarget];
    const tc = t.lv as unknown as RGB;
    set(
      "stage",
      vi
        ? `Ánh sáng CỘNG (vectơ, tuyến tính):\n  ${frac(CT.lv[0])}·(1; 0; 0) + ${frac(CT.lv[1])}·(0; 1; 0) + ${frac(CT.lv[2])}·(0; 0; 1)\n  = ${vec(c, vi)}  ${swatch(c)} ${HEX(c)}\nmã sRGB: R ${byte(c[0])} · G ${byte(c[1])} · B ${byte(c[2])}  (½ ánh sáng = mã 188, không phải 128)\nĐỏ+lục=vàng · lục+lam=cyan · đỏ+lam=magenta · cả ba=trắng\nBóng: chặn một đèn → thấy tổng HAI đèn còn lại\nMục tiêu vùng giữa: ${t.vi} ${vec(tc, vi)} ${swatch(tc)}   ✓ ${CT.lightSolved}/3`
        : `Light ADDS (vectors, linear):\n  ${frac(CT.lv[0])}·(1, 0, 0) + ${frac(CT.lv[1])}·(0, 1, 0) + ${frac(CT.lv[2])}·(0, 0, 1)\n  = ${vec(c, vi)}  ${swatch(c)} ${HEX(c)}\nsRGB code: R ${byte(c[0])} · G ${byte(c[1])} · B ${byte(c[2])}  (½ the light = code 188, not 128)\nred+green=yellow · green+blue=cyan · red+blue=magenta · all=white\nShadows: block one lamp → you see the sum of the OTHER two\nTarget for the centre: ${t.en} ${vec(tc, vi)} ${swatch(tc)}   ✓ ${CT.lightSolved}/3`,
    );
  }
  if (near(ST.cmy.x, ST.cmy.z, 7)) {
    const ids = FILTER_IDS.filter((_, i) => CT.gel[i]);
    const sp = filterSpectral(ids);
    const sc = filterShortcut(ids);
    const t = FILTER_TARGETS[CT.filterTarget];
    const names = ids.length ? ids.map((i) => i.toUpperCase()).join(" · ") : vi ? "(không kính)" : "(no filter)";
    set(
      "cmy",
      vi
        ? `Kính lọc NHÂN (trừ bớt ánh sáng):\n  S_ra(λ) = S(λ) · ${ids.length ? ids.map((i) => `T_${i.toUpperCase()}(λ)`).join(" · ") : "1"}\nĐốm giữa (${names}):\n  nhân PHỔ rồi đổi qua CIE → ${vec(sp, vi)} ${swatch(sp)}\n  "lối tắt RGB" (nhân màu từng kính) → ${vec(sc, vi)} ${swatch(sc)}\nC chặn đỏ · M chặn lục · Y chặn lam\nSơn đỏ + sơn lục thường ra NÂU xỉn — không phải vàng!\nMục tiêu đốm giữa: ${t.vi}   ✓ ${CT.filterSolved}/3`
        : `Filters MULTIPLY (they remove light):\n  S_out(λ) = S(λ) · ${ids.length ? ids.map((i) => `T_${i.toUpperCase()}(λ)`).join(" · ") : "1"}\nCentre spot (${names}):\n  multiply SPECTRA, then CIE → ${vec(sp, vi)} ${swatch(sp)}\n  "RGB shortcut" (multiply filter colours) → ${vec(sc, vi)} ${swatch(sc)}\nC blocks red · M blocks green · Y blocks blue\nRed paint + green paint usually make muddy BROWN — not yellow!\nTarget for the centre: ${t.en}   ✓ ${CT.filterSolved}/3`,
    );
  }
  if (near(ST.cube.x, ST.cube.z, 6)) {
    const t = CUBE_TARGETS[CT.target];
    let line: string;
    if (here && inHall) {
      const lin = toLinear(here);
      const [h, s, v] = rgbToHsv(here);
      const miss = cubeMiss(here, t.c);
      line = vi
        ? `Bạn đang đứng ở màu: ${swatch(lin)} ${HEX(lin)}\n  RGB = ${vec(here, vi)} · H ${Math.round(h)}° S ${Math.round(s * 100)}% V ${Math.round(v * 100)}%\n  ΔE (OKLab) tới mục tiêu: ${n2(miss, vi, 3)}${miss < CUBE_HIT ? " ✓" : ""}`
        : `You are standing on: ${swatch(lin)} ${HEX(lin)}\n  RGB = ${vec(here, vi)} · H ${Math.round(h)}° S ${Math.round(s * 100)}% V ${Math.round(v * 100)}%\n  ΔE (OKLab) to the target: ${n2(miss, vi, 3)}${miss < CUBE_HIT ? " ✓" : ""}`;
    } else line = vi ? "Bước lên sàn để thành một màu." : "Step onto the floor to become a colour.";
    const tl = toLinear(t.c);
    set(
      "cube",
      vi
        ? `${CT.mode === "rgb" ? `Khối RGB — lát G = ${frac(CT.slice)}: đông → R tăng, bắc → B tăng` : `Trụ HSV — đĩa V = ${frac(CT.slice)}: góc → H, bán kính → S`}\n${line}\nTìm màu: ${t.vi} ${swatch(tl)} ${HEX(tl)}   ✓ ${CT.found}/3\n(trục xám: đường chéo đen → trắng, R = G = B)`
        : `${CT.mode === "rgb" ? `RGB cube — slice G = ${frac(CT.slice)}: east → more R, north → more B` : `HSV cylinder — disc V = ${frac(CT.slice)}: angle → H, radius → S`}\n${line}\nFind: ${t.en} ${swatch(tl)} ${HEX(tl)}   ✓ ${CT.found}/3\n(grey axis: the black → white diagonal, R = G = B)`,
    );
  }
  if (near(PH.X0 + 2, ST.wheel.z, 6)) {
    const hs = harmonyHues(CT.hue, CT.harmony);
    const cols = harmonyColors(CT.hue, CT.harmony, CT.wheel);
    const sw = cols.map((c) => `${swatch(c)} ${HEX(c)}`).join("  ");
    const sum = CT.harmony === "complement" && CT.wheel === "rgb" ? (vi ? "\nÁnh sáng: màu + màu bù = (1; 1; 1) trắng" : "\nAs light: colour + complement = (1, 1, 1) white") : "";
    set(
      "wheel",
      vi
        ? `Vòng ${WNAME[CT.wheel].vi} · phối ${HNAME[CT.harmony].vi}\n  H = ${hs.map((h) => `${Math.round(h)}°`).join(", ")}\n  ${sw}${sum}\nĐối của ĐỎ: cyan (HSV) · LỤC (RYB) — hai vòng, hai đáp án\nOKLCH giữ độ sáng đều; HSV thì vàng sáng hơn lam nhiều`
        : `${WNAME[CT.wheel].en} wheel · ${HNAME[CT.harmony].en}\n  H = ${hs.map((h) => `${Math.round(h)}°`).join(", ")}\n  ${sw}${sum}\nComplement of RED: cyan (HSV) · GREEN (RYB) — two wheels, two answers\nOKLCH keeps lightness even; in HSV yellow is far brighter than blue`,
    );
  }
  if (near(PH.FX1 - 1.5, ST.illusion.z, 6)) {
    const s = CT.stare >= 0 ? (performance.now() - CT.stare) / 1000 : -1;
    const st =
      s < 0
        ? vi
          ? "Ảnh dư: bấm F, nhìn chấm giữa lá cờ 15 giây, ĐỪNG chớp."
          : "Afterimage: press F, stare at the dot for 15 s, DON'T blink."
        : s < 15
          ? vi
            ? `Nhìn chăm chú… ${Math.ceil(15 - s)} s`
            : `Keep staring… ${Math.ceil(15 - s)} s`
          : vi
            ? "Giờ nhìn tường trắng: bạn thấy cờ ĐỎ sao VÀNG?\nTế bào nón mỏi màu lam lục → bên đối lập (đỏ) thắng."
            : "Now the white wall: do you see a RED flag with a YELLOW star?\nCones tired of cyan → the opponent (red) wins.";
    const rv = CT.reveal === 0 ? (vi ? "Hai ô xám trông khác nhau?" : "Do the two grey squares look different?") : CT.reveal === 1 ? (vi ? "Hút màu: #808080 = #808080 — GIỐNG HỆT" : "Eyedropper: #808080 = #808080 — IDENTICAL") : vi ? "Tráo nền: ô trông 'đổi màu' theo nền" : "Backgrounds swapped: the square 'changes' with its surround";
    set("illusion", `${st}\n\n${vi ? "Tương phản đồng thời" : "Simultaneous contrast"}: ${rv}`);
  }
  if (near(PRISM.x + 2, PRISM.z + 1, 6)) {
    const n = cauchyN(CT.probe, GLASS.sf11);
    const d = prismDeviation(CT.probe, PRISM_INC, 60, GLASS.sf11) ?? 0;
    const c = spectralRgb(CT.probe);
    const [x, y] = locusXy(CT.probe);
    set(
      "prism",
      vi
        ? `Lăng kính KHÔNG tạo màu — nó TÁCH màu có sẵn trong nắng.\n  n(λ) = 1,739 + 0,0160/λ²  (flint SF11, λ tính bằng µm)\n  λ = ${CT.probe} nm → n = ${n2(n, vi, 4)} → góc lệch δ = ${n2(d, vi, 1)}°\n  xy = (${n2(x, vi, 3)}; ${n2(y, vi, 3)})  màu gần nhất màn hình hiện được ${swatch(c)}\nTím lệch nhiều hơn đỏ (n lớn hơn) → dải cầu vồng`
        : `A prism does NOT make colours — it SEPARATES what is in sunlight.\n  n(λ) = 1.739 + 0.0160/λ²  (SF11 flint, λ in µm)\n  λ = ${CT.probe} nm → n = ${n2(n, vi, 4)} → deviation δ = ${n2(d, vi, 1)}°\n  xy = (${n2(x, vi, 3)}, ${n2(y, vi, 3)})  closest colour a screen can show ${swatch(c)}\nViolet bends more than red (larger n) → a rainbow band`,
    );
  }
  if (near(ST.cie.x, ST.cie.z, 8)) {
    const [ka, kb] = metamerWeights(580, 630, 532);
    set(
      "cie",
      vi
        ? `x = X/(X+Y+Z), y = Y/(X+Y+Z) · móng ngựa = màu phổ, đáy = đường tía (hỗn hợp)\nTam giác sRGB: R(0,64; 0,33) G(0,30; 0,60) B(0,15; 0,06) · trắng D65 (0,313; 0,329)\nVùng gạch chéo: mắt thấy được nhưng MÀN HÌNH không hiện nổi\nĐồng sắc: vàng 580 nm ≈ ${n2(ka, vi)}·đỏ 630 + ${n2(kb, vi)}·lục 532 (phổ khác, mắt thấy như nhau)\nChấm: ● vùng giữa sân khấu ● đốm kính lọc ● chỗ bạn đứng\nKính: ${CVDNAME[CT.cvd].vi} (Machado 2009, nhân ma trận trên RGB tuyến tính)`
        : `x = X/(X+Y+Z), y = Y/(X+Y+Z) · horseshoe = spectral colours, bottom = line of purples (mixtures)\nsRGB triangle: R(0.64, 0.33) G(0.30, 0.60) B(0.15, 0.06) · white D65 (0.313, 0.329)\nHatched: your eye sees it, your SCREEN cannot show it\nMetamers: 580 nm yellow ≈ ${n2(ka, vi)}·red 630 + ${n2(kb, vi)}·green 532 (different spectra, same look)\nDots: ● stage centre ● filter spot ● where you stand\nGlasses: ${CVDNAME[CT.cvd].en} (Machado 2009, matrix on linear RGB)`,
    );
  }
}
