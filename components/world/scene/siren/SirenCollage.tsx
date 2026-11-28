"use client";
/**
 * Nhánh W — trời cắt dán nhiều lớp + thác ký hiệu (docs/ai-reviews/siren-witch/PLAN.md).
 *  - <CollageSky>: 4 lớp mảnh cắt dán (khắc cổ + giấy cắt + bản nhạc, atlas Codex siren/collage.webp) trên các trụ quanh máy quay.
 *    Tâm mỗi lớp bám máy quay theo hệ số riêng → thị sai multiplane; mỗi lớp trôi chu kỳ riêng (khoá nhịp); mảnh "đặt lại bằng tay"
 *    4 Hz (collageTime) — rung lệch nhẹ + đổi khung A/B. MỘT lệnh vẽ (instancing), alpha-test (không blend → không vẽ chồng mờ).
 *  - <NotationFalls>: ký hiệu nhạc cắt giấy rơi xuống rồi vòng ra sau bay NGƯỢC lên (lật gương = nghịch hành), lật 8 Hz;
 *    cùng mesh vẽ luôn "Dấu lặng" khổng lồ ở vùng im lặng. MỘT lệnh vẽ.
 * Phân rã (HARMONIC.decomposition): mảnh / ký hiệu bậc cao rụng trước, màu nhạt dần → cao trào bằng sự biến mất.
 * Mọi chuyển động tính trong vertex shader từ uniform HARMONIC → không cấp phát, không cập nhật ma trận mỗi khung.
 */
import { useEffect, useMemo } from "react";
import { useFrame } from "@react-three/fiber";
import { useTexture } from "@react-three/drei";
import * as THREE from "three";
import { HARMONIC } from "@/lib/world/harmonicState";
import {
  COLLAGE_COLS,
  COLLAGE_LAYERS,
  COLLAGE_ROWS,
  FALL_BEATS,
  NOTES_COLS,
  NOTES_ROWS,
  NOTE_REST_CELL,
  REST_ZONE,
  WATERFALLS,
  collageLayout,
  SIREN_W,
  rng,
} from "@/lib/world/sirenWorld";
import { worldAsset } from "@/lib/world/avatars";
import { reduceMotion } from "./SirenGravity";

const COLLAGE_TEX = worldAsset("siren/collage.webp");
const NOTES_TEX = worldAsset("siren/notes.webp");
useTexture.preload(COLLAGE_TEX);
useTexture.preload(NOTES_TEX);

/** bảng màu PLAN: void / ngà / son / lục gỉ / đồng thau */
const PALETTE_GLSL = /* glsl */ `
const vec3 C_VOID = vec3(0.094, 0.082, 0.122);
const vec3 C_IVORY = vec3(0.875, 0.831, 0.71);
const vec3 C_CARMINE = vec3(0.647, 0.2, 0.275);
float h11(float n){ return fract(sin(n * 12.9898) * 43758.5453); }
float lum(vec3 c){ return dot(c, vec3(0.299, 0.587, 0.114)); }
`;

// ───────────── Trời cắt dán ─────────────

const COLLAGE_VERT = /* glsl */ `
${PALETTE_GLSL}
attribute vec4 aP0; // layer, angle, y, size
attribute vec4 aP1; // cell, cellB, phase, rank
uniform vec4 uLayer[4]; // radius, follow, drift(rad/beat), haze
uniform vec3 uCam;
uniform float uBeat, uTime, uCollage, uDecomp, uDiss, uSwap;
varying vec2 vUv;
varying float vHaze;
varying float vRank;
void main(){
  int li = int(aP0.x + 0.5);
  vec4 L = uLayer[li];
  float ph = aP1.z;
  // còn sống theo phân rã (giống pieceAlive trong lib/world/sirenWorld.ts)
  float keep = 1.0 - uDecomp * (li == 0 ? 0.75 : 1.2);
  float alive = clamp((keep + 0.16 - aP1.w) / 0.16, 0.0, 1.0);
  // khung tay 4 Hz: mỗi mảnh "được đặt lại" lệch pha nhau
  float hand = floor(uCollage * 4.0 + ph * 1.3);
  float j1 = h11(hand + ph * 7.0) - 0.5;
  float j2 = h11(hand * 1.7 + ph * 3.0) - 0.5;
  // trôi chu kỳ riêng của lớp; bất hoà → các lớp lệch nhịp nhau
  float ang = aP0.y + uBeat * L.z * (1.0 + uDiss * 0.6 * sin(ph * 3.0)) + j1 * 0.004 * uSwap;
  vec3 center = uCam * L.y;
  float bob = sin(uTime * (0.11 + 0.05 * float(li)) + ph) * aP0.w * 0.06;
  vec3 base = center + vec3(cos(ang) * L.x, aP0.z + bob, sin(ang) * L.x);
  vec3 right = vec3(-sin(ang), 0.0, cos(ang));
  vec3 up = vec3(0.0, 1.0, 0.0);
  // giấy lắc chậm trong mặt phẳng + giật nhẹ mỗi lần đặt lại
  float rot = 0.12 * sin(uTime * 0.17 + ph * 2.0) + j2 * 0.05 * uSwap;
  float cr = cos(rot), sr = sin(rot);
  vec2 q = vec2(position.x * cr - position.y * sr, position.x * sr + position.y * cr);
  // co lại từ chân (như mảnh giấy bị gỡ) khi phân rã
  float s = aP0.w * alive;
  vec3 w = base + (right * q.x + up * (q.y + 0.5 * (1.0 - alive))) * s;
  // đổi khung A/B theo nhịp tay (4 Hz): mỗi lần đặt lại có xác suất ½ đổi
  float useB = uSwap * step(0.5, h11(hand * 0.37 + ph));
  float cell = mix(aP1.x, aP1.y, useB);
  float cx = mod(cell, ${COLLAGE_COLS.toFixed(1)});
  float cy = floor(cell / ${COLLAGE_COLS.toFixed(1)});
  vUv = (vec2(cx, ${(COLLAGE_ROWS - 1).toFixed(1)} - cy) + uv) / vec2(${COLLAGE_COLS.toFixed(1)}, ${COLLAGE_ROWS.toFixed(1)});
  vHaze = L.w;
  vRank = aP1.w;
  gl_Position = projectionMatrix * viewMatrix * vec4(w, 1.0);
  if (alive <= 0.0) gl_Position = vec4(2.0, 2.0, 2.0, 1.0);
}`;
const COLLAGE_FRAG = /* glsl */ `
${PALETTE_GLSL}
uniform sampler2D uMap;
uniform vec3 uHazeCol;
uniform float uDecomp, uDiss, uRest;
varying vec2 vUv;
varying float vHaze;
varying float vRank;
void main(){
  vec4 t = texture2D(uMap, vUv);
  if (t.a < 0.5) discard;
  vec3 c = t.rgb;
  // lệch lớp mực in (cục bộ) khi bất hoà: kênh son trượt khỏi bản khắc
  float mis = uDiss * 0.006;
  c.r = mix(c.r, texture2D(uMap, vUv + vec2(mis, -mis * 0.5)).r, step(0.001, mis));
  // không khí: lớp xa ngả màu trời
  c = mix(c, uHazeCol, vHaze);
  // phân rã: bớt hoạ âm → bớt màu rồi bớt chi tiết (bẹt dần thành bóng giấy)
  float l = lum(c);
  c = mix(c, vec3(l), clamp(uDecomp * 1.1, 0.0, 1.0));
  c = mix(c, mix(C_VOID, C_IVORY, step(0.42, l)) * (0.85 + 0.15 * vRank), smoothstep(0.55, 1.0, uDecomp));
  // Dấu lặng: rút hoạ tiết → giấy trắng phẳng
  c = mix(c, C_IVORY * (0.82 + 0.18 * step(0.35, l)), uRest * 0.85);
  gl_FragColor = vec4(c, 1.0);
}`;

export function CollageSky() {
  const tex = useTexture(COLLAGE_TEX);
  const { geo, mat } = useMemo(() => {
    tex.colorSpace = THREE.SRGBColorSpace;
    tex.anisotropy = 4;
    const pieces = collageLayout();
    const g = new THREE.InstancedBufferGeometry();
    const plane = new THREE.PlaneGeometry(1, 1);
    g.index = plane.index;
    g.setAttribute("position", plane.getAttribute("position"));
    g.setAttribute("uv", plane.getAttribute("uv"));
    const p0 = new Float32Array(pieces.length * 4);
    const p1 = new Float32Array(pieces.length * 4);
    pieces.forEach((p, i) => {
      p0.set([p.layer, p.angle, p.y, p.size], i * 4);
      p1.set([p.cell, p.cellB, p.phase, p.rank], i * 4);
    });
    g.setAttribute("aP0", new THREE.InstancedBufferAttribute(p0, 4));
    g.setAttribute("aP1", new THREE.InstancedBufferAttribute(p1, 4));
    g.instanceCount = pieces.length;
    const haze = [0.55, 0.36, 0.16, 0.0];
    const m = new THREE.ShaderMaterial({
      vertexShader: COLLAGE_VERT,
      fragmentShader: COLLAGE_FRAG,
      uniforms: {
        uMap: { value: tex },
        uLayer: { value: COLLAGE_LAYERS.map((L, i) => new THREE.Vector4(L.radius, L.follow, L.drift, haze[i])) },
        uCam: { value: new THREE.Vector3() },
        uHazeCol: { value: new THREE.Color("#6a3f8f") },
        uBeat: { value: 0 },
        uTime: { value: 0 },
        uCollage: { value: 0 },
        uDecomp: { value: 0 },
        uDiss: { value: 0 },
        uRest: { value: 0 },
        uSwap: { value: reduceMotion() ? 0 : 1 },
      },
      side: THREE.DoubleSide,
      fog: false,
      toneMapped: false,
    });
    return { geo: g, mat: m };
  }, [tex]);
  useEffect(
    () => () => {
      geo.dispose();
      mat.dispose();
    },
    [geo, mat],
  );
  useFrame(({ camera }) => {
    const u = mat.uniforms;
    u.uCam.value.copy(camera.position);
    u.uBeat.value = HARMONIC.beat;
    u.uTime.value = HARMONIC.time;
    u.uCollage.value = HARMONIC.collageTime;
    u.uDecomp.value = HARMONIC.decomposition;
    u.uDiss.value = HARMONIC.dissonance;
    u.uRest.value = SIREN_W.rest;
  });
  // vẽ sau vật đục (đất / mê cung che mảnh xa), trước bầu trời (renderOrder 1)
  return <mesh geometry={geo} material={mat} frustumCulled={false} renderOrder={0} name="perf:collage" />;
}

// ───────────── Thác ký hiệu ─────────────

const NOTES_VERT = /* glsl */ `
${PALETTE_GLSL}
attribute vec4 aN; // fall (-1 = Dấu lặng), seed, cell, size
attribute vec2 aL; // lệch ngang trong thác (-1…1), rank
uniform vec4 uFall[3]; // x, z, top, bottom
uniform float uW[3];
uniform vec3 uCam;
uniform vec3 uRestAt;
uniform float uBeat, uStop, uTime, uDecomp, uFlutter, uLoop;
varying vec2 vUv;
varying float vShade;
void main(){
  float cell = aN.z;
  vec3 w;
  vec2 q = position.xy;
  float s = aN.w;
  vec3 toCam;
  if (aN.x < -0.5) {
    // Dấu lặng: đứng yên, thở rất chậm (im lặng — không theo phách)
    w = uRestAt + vec3(0.0, 0.25 * sin(uTime * 0.4), 0.0);
    toCam = normalize(vec3(uCam.x - w.x, 0.0, uCam.z - w.z) + 1e-4);
    vShade = 0.0;
  } else {
    int fi = int(aN.x + 0.5);
    vec4 F = uFall[fi];
    float width = uW[fi];
    float u = fract(uBeat / uLoop + aN.y);
    // vòng rơi → bay ngược (fallLoop trong lib/world/sirenWorld.ts), mép đáy / đỉnh lượn mượt
    float y = u < 0.5 ? 1.0 - (u / 0.5) * (u / 0.5) : smoothstep(0.0, 1.0, (u - 0.5) / 0.5);
    float side = cos(3.14159265 * smoothstep(0.44, 0.56, u));
    side = u > 0.94 ? mix(-1.0, 1.0, smoothstep(0.94, 1.0, u)) : side;
    vec3 n = normalize(vec3(-F.x, 0.0, -F.y) + 1e-4);
    vec3 tg = vec3(-n.z, 0.0, n.x);
    // gợn ngang kiểu dây đàn: dịch theo chuỗi sin (hai hoạ âm)
    float sway = sin(y * 9.0 + uTime * 0.7 + aN.y * 20.0) * 0.5 + sin(y * 27.0 - uTime) * 0.15;
    w = vec3(F.x, mix(F.w, F.z, y), F.y) + n * side * 2.6 + tg * (aL.x * width + sway);
    // ẩn ở đỉnh (sinh ra từ trời) + rụng theo phân rã
    float alive = clamp((1.0 - uDecomp * 1.15 + 0.15 - aL.y) / 0.15, 0.0, 1.0);
    s *= alive * smoothstep(0.0, 0.03, u) * (1.0 - smoothstep(0.985, 1.0, u));
    // lật gương khi bay ngược (nghịch hành): co theo side → tờ giấy lật qua
    q.x *= side;
    // lật / rung stop-motion 8 Hz
    float k = floor(uStop * 8.0 + aN.y * 5.0);
    float rot = uFlutter * (0.35 * (h11(k + aN.y * 31.0) - 0.5)) + 0.2 * sin(uTime * 1.3 + aN.y * 9.0);
    float cr = cos(rot), sr = sin(rot);
    q = vec2(q.x * cr - q.y * sr, q.x * sr + q.y * cr);
    toCam = normalize(vec3(uCam.x - w.x, 0.0, uCam.z - w.z) + 1e-4);
    vShade = 0.25 * (1.0 - abs(side));
  }
  vec3 right = vec3(toCam.z, 0.0, -toCam.x);
  w += (right * q.x + vec3(0.0, q.y, 0.0)) * s;
  float cx = mod(cell, ${NOTES_COLS.toFixed(1)});
  float cy = floor(cell / ${NOTES_COLS.toFixed(1)});
  vUv = (vec2(cx, ${(NOTES_ROWS - 1).toFixed(1)} - cy) + uv) / vec2(${NOTES_COLS.toFixed(1)}, ${NOTES_ROWS.toFixed(1)});
  gl_Position = projectionMatrix * viewMatrix * vec4(w, 1.0);
  if (s <= 0.0) gl_Position = vec4(2.0, 2.0, 2.0, 1.0);
}`;
const NOTES_FRAG = /* glsl */ `
${PALETTE_GLSL}
uniform sampler2D uMap;
uniform float uDecomp, uRest;
varying vec2 vUv;
varying float vShade;
void main(){
  vec4 t = texture2D(uMap, vUv);
  if (t.a < 0.5) discard;
  vec3 c = t.rgb * (1.0 - vShade);
  float l = lum(c);
  c = mix(c, vec3(l), clamp(uDecomp, 0.0, 1.0));
  c = mix(c, C_IVORY * (0.7 + 0.3 * step(0.4, l)), uRest * 0.7);
  gl_FragColor = vec4(c, 1.0);
}`;

export function NotationFalls() {
  const tex = useTexture(NOTES_TEX);
  const { geo, mat } = useMemo(() => {
    tex.colorSpace = THREE.SRGBColorSpace;
    tex.anisotropy = 4;
    const r = rng(23);
    const n = 1 + WATERFALLS.reduce((s, f) => s + f.count, 0);
    const aN = new Float32Array(n * 4);
    const aL = new Float32Array(n * 2);
    // 0: Dấu lặng khổng lồ ở vùng im lặng
    aN.set([-1, 0, NOTE_REST_CELL, 5.2], 0);
    aL.set([0, 0], 0);
    let i = 1;
    WATERFALLS.forEach((f, fi) => {
      for (let k = 0; k < f.count; k++, i++) {
        // rải đều pha (không dồn cục), chọn ký hiệu trừ ô Dấu lặng (dành riêng)
        let cell = Math.floor(r() * NOTES_COLS * NOTES_ROWS);
        if (cell === NOTE_REST_CELL) cell = (cell + 1) % (NOTES_COLS * NOTES_ROWS);
        aN.set([fi, (k + r() * 0.6) / f.count, cell, 1.6 + r() * 1.6], i * 4);
        aL.set([r() * 2 - 1, r()], i * 2);
      }
    });
    const g = new THREE.InstancedBufferGeometry();
    const plane = new THREE.PlaneGeometry(1, 1);
    g.index = plane.index;
    g.setAttribute("position", plane.getAttribute("position"));
    g.setAttribute("uv", plane.getAttribute("uv"));
    g.setAttribute("aN", new THREE.InstancedBufferAttribute(aN, 4));
    g.setAttribute("aL", new THREE.InstancedBufferAttribute(aL, 2));
    g.instanceCount = n;
    const m = new THREE.ShaderMaterial({
      vertexShader: NOTES_VERT,
      fragmentShader: NOTES_FRAG,
      uniforms: {
        uMap: { value: tex },
        uFall: { value: WATERFALLS.map((f) => new THREE.Vector4(f.x, f.z, f.top, f.bottom)) },
        uW: { value: WATERFALLS.map((f) => f.width) },
        uCam: { value: new THREE.Vector3() },
        uRestAt: { value: new THREE.Vector3(REST_ZONE.x, 3.4, REST_ZONE.z) },
        uBeat: { value: 0 },
        uStop: { value: 0 },
        uTime: { value: 0 },
        uDecomp: { value: 0 },
        uRest: { value: 0 },
        uFlutter: { value: reduceMotion() ? 0 : 1 },
        uLoop: { value: FALL_BEATS },
      },
      side: THREE.DoubleSide,
      toneMapped: false,
    });
    return { geo: g, mat: m };
  }, [tex]);
  useEffect(
    () => () => {
      geo.dispose();
      mat.dispose();
    },
    [geo, mat],
  );
  useFrame(({ camera }) => {
    const u = mat.uniforms;
    u.uCam.value.copy(camera.position);
    u.uBeat.value = HARMONIC.beat;
    u.uStop.value = HARMONIC.stopTime;
    u.uTime.value = HARMONIC.time;
    u.uDecomp.value = HARMONIC.decomposition;
    u.uRest.value = SIREN_W.rest;
  });
  return <mesh geometry={geo} material={mat} frustumCulled={false} name="perf:notes" />;
}
