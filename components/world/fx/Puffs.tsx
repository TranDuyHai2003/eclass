"use client";
/**
 * VFX-AAA — cụm khói / bụi kiểu cel (pha DƯ ÂM "nguội" của nhịp 5 pha): MỘT batch instanced = 1 lệnh vẽ cho mọi sự kiện.
 *  • dáng + tô sáng 2 nấc từ texture thủ tục nướng sẵn (fx/vfxTextures.ts, 128²), mép bị xói theo vân khói và trôi theo
 *    flowmap 2 pha (không lặp lộ, không cuộn cứng);
 *  • nhiệt: lõi than hồng HDR lúc đầu (bloom bắt) → muội xám khi nguội (lib/world/vfxBeats.ts puffAt), mép cháy khi đang xói;
 *  • pha trộn premultiplied: muội CHE (đọc được khi tắt bloom, hình + giá trị trước bloom), lõi nóng CỘNG sáng;
 *  • tiếp xúc mềm với sàn: không có depth pre-pass (GPU tích hợp / điện thoại) → mặt sàn giải tích (độ cao đất lúc phát, như
 *    uHasDepth = 0 của skill): mờ dần phần tấm chạm sàn thay vì cắt thẳng; cụm khói không chui xuống đất;
 *  • kẹp cỡ trên màn hình (≤ 38 % chiều cao) để không phủ kín màn hình khi sát máy quay; ngân sách sống PUFF_CAP 8 / 18 / 28.
 * API: emitPuff(...), emitDustRing(...) — quỹ đạo dùng vfxRand (có hạt giống), không cấp phát mỗi khung.
 */
import { useEffect, useMemo } from "react";
import { useFrame, useThree } from "@react-three/fiber";
import * as THREE from "three";
import { useGfx } from "../gfx";
import { useWorld } from "../store";
import { fxFrozen, fxNow } from "./fxClock";
import { blankTexture, whenVfxTextures } from "./vfxTextures";
import { PUFF_CAP, puffAt, puffCount, type PuffState } from "@/lib/world/vfxBeats";
import { vfxRand } from "@/lib/world/vfxRng";
import type { FxLevel } from "@/lib/world/spellFx";

const MAX = 32;
const P = {
  pos: new Float32Array(MAX * 3),
  vel: new Float32Array(MAX * 3),
  hot: new Float32Array(MAX * 3),
  soot: new Float32Array(MAX * 3),
  size: new Float32Array(MAX),
  life: new Float32Array(MAX),
  age: new Float32Array(MAX),
  floor: new Float32Array(MAX),
  rot: new Float32Array(MAX),
  spin: new Float32Array(MAX),
  seed: new Float32Array(MAX),
  heat: new Float32Array(MAX),
  rise: new Float32Array(MAX),
  drag: new Float32Array(MAX),
  head: 0,
  live: 0,
  peak: 0,
};
if (typeof window !== "undefined" && process.env.NODE_ENV !== "production")
  (window as unknown as { __puffs: unknown }).__puffs = () => {
    const r = { live: P.live, peak: P.peak };
    P.peak = 0;
    return r;
  };

function level(): FxLevel {
  const v = (useGfx.getState().vfx ?? 1) as FxLevel;
  return useWorld.getState().quality === "low" ? 0 : v;
}

/** bảng màu khói dựng sẵn (tuyến tính): muội / bụi + lõi nóng */
export const PUFF = {
  dust: new THREE.Color("#d9c9b6"),
  ember: new THREE.Color("#ffb45a"),
  soot: new THREE.Color("#9a8580"),
  voidInk: new THREE.Color("#8a7fc0"),
  voidHot: new THREE.Color("#c9c2ff"),
  mist: new THREE.Color("#cfeff0"),
  spark: new THREE.Color("#fff0bf"),
};

/**
 * Một cụm khói: vị trí, vận tốc (m/s), cỡ (m), đời (s), màu muội / màu nóng, nhiệt ban đầu 0..1, độ cao sàn (mặt tiếp xúc),
 * nổi (m/s², dương = bốc lên), cản.
 */
export function emitPuff(x: number, y: number, z: number, vx: number, vy: number, vz: number, size: number, life: number, soot: THREE.Color, hot: THREE.Color, heat: number, floorY: number, rise = 0.5, drag = 2.4) {
  if (P.live >= PUFF_CAP[level()]) return;
  P.live++;
  // ô kế tiếp đã chết (hoặc cũ nhất) — vòng đệm cố định
  let i = P.head++ % MAX;
  for (let n = 0; n < MAX && P.age[i] < P.life[i]; n++) i = P.head++ % MAX;
  P.pos[i * 3] = x;
  P.pos[i * 3 + 1] = y;
  P.pos[i * 3 + 2] = z;
  P.vel[i * 3] = vx;
  P.vel[i * 3 + 1] = vy;
  P.vel[i * 3 + 2] = vz;
  P.soot[i * 3] = soot.r;
  P.soot[i * 3 + 1] = soot.g;
  P.soot[i * 3 + 2] = soot.b;
  P.hot[i * 3] = hot.r;
  P.hot[i * 3 + 1] = hot.g;
  P.hot[i * 3 + 2] = hot.b;
  P.size[i] = size;
  P.life[i] = life;
  P.age[i] = 0;
  P.floor[i] = floorY;
  P.rot[i] = vfxRand() * 6.283;
  P.spin[i] = (vfxRand() - 0.5) * 0.9;
  P.seed[i] = vfxRand();
  P.heat[i] = heat;
  P.rise[i] = rise;
  P.drag[i] = drag;
}

/**
 * Vành bụi bám đất (đáp đất, va chạm): n cụm toả ra từ bán kính r0 theo hướng ngang, hơi bốc lên. Cỡ / đời / tốc độ có
 * lệch ngẫu nhiên có hạt giống.
 */
export function emitDustRing(x: number, groundY: number, z: number, r0: number, n: number, speed: number, size: number, life: number, soot: THREE.Color, hot: THREE.Color, heat: number) {
  const a0 = vfxRand() * 6.283;
  for (let k = 0; k < n; k++) {
    const a = a0 + (k / n) * 6.283 + (vfxRand() - 0.5) * 0.5;
    const c = Math.cos(a);
    const s = Math.sin(a);
    const sp = speed * (0.75 + 0.5 * vfxRand());
    const sz = size * (0.8 + 0.4 * vfxRand());
    emitPuff(x + c * r0, groundY + sz * 0.32, z + s * r0, c * sp, 0.25 + 0.35 * vfxRand(), s * sp, sz, life * (0.8 + 0.4 * vfxRand()), soot, hot, heat, groundY, 0.35, 3.2);
  }
}

const COL_TMP = new THREE.Color();
/**
 * Quái gục: thân "sụp" thành vành bụi thấp + một làn hơi màu quái bốc lên rồi nguội (dư âm) — thay quả cầu hạt toả đều.
 */
export function emitCollapse(x: number, groundY: number, z: number, color: string) {
  const lv = level();
  COL_TMP.set(color);
  emitDustRing(x, groundY, z, 0.3, puffCount(5, lv, 2), 1.8, 0.7, 0.9, PUFF.dust, COL_TMP, 0.45);
  emitPuff(x, groundY + 0.7, z, 0, 1.1, 0, 0.8, 1.1, PUFF.dust, COL_TMP, 0.8, groundY, 1.0, 2.0);
}

const VS = /* glsl */ `
attribute vec3 iPos; attribute vec4 iSz; attribute vec4 iSt; attribute vec3 iHot; attribute vec3 iSoot;
uniform vec2 uViewport; uniform float uMaxFrac;
varying vec2 vUv; varying vec4 vSt; varying vec3 vHot; varying vec3 vSoot; varying float vH; varying float vSeed;
void main(){
  vUv = uv; vSt = iSt; vHot = iHot; vSoot = iSoot; vSeed = iSz.w;
  if (iSt.x <= 0.0) { vH = 0.0; gl_Position = vec4(2.0, 2.0, 2.0, 1.0); return; }
  vec4 cc = projectionMatrix * viewMatrix * vec4(iPos, 1.0);
  float size = iSz.x;
  // kẹp cỡ trên màn hình (sát máy quay không phủ kín màn hình → bớt overdraw)
  if (cc.w > 0.0001) {
    float frac = size * projectionMatrix[1][1] / cc.w;
    size *= min(1.0, uMaxFrac / max(frac, 1e-4));
  }
  float c = cos(iSz.y), s = sin(iSz.y);
  vec2 q = vec2(position.x * c - position.y * s, position.x * s + position.y * c);
  vec3 Rt = vec3(viewMatrix[0][0], viewMatrix[1][0], viewMatrix[2][0]);
  vec3 Up = vec3(viewMatrix[0][1], viewMatrix[1][1], viewMatrix[2][1]);
  vec3 wp = iPos + (Rt * q.x + Up * q.y) * size;
  vH = (wp.y - iSz.z) / max(size, 0.05);
  gl_Position = projectionMatrix * viewMatrix * vec4(wp, 1.0);
}`;

const FS = /* glsl */ `
uniform sampler2D uPuff; uniform sampler2D uFlow; uniform float uT;
varying vec2 vUv; varying vec4 vSt; varying vec3 vHot; varying vec3 vSoot; varying float vH; varying float vSeed;
void main(){
  // flowmap 2 pha: hai lần đẩy UV lệch nửa chu kỳ, trộn tam giác → trôi xoáy liên tục, không giật khi đặt lại
  vec2 fl = (texture2D(uFlow, vUv * 0.6 + vec2(vSeed, vSeed * 1.7)).gb * 2.0 - 1.0) * 0.07;
  float ft = uT * 0.55 + vSeed * 3.0;
  float p0 = fract(ft);
  float p1 = fract(ft + 0.5);
  float bl = abs(p0 * 2.0 - 1.0);
  vec4 P = mix(texture2D(uPuff, vUv + fl * p0), texture2D(uPuff, vUv + fl * p1), bl);
  float shape = P.a;
  if (shape < 0.01) discard;
  float heat = vSt.y;
  float erode = vSt.z;
  // xói theo vân khói (thô + mịn): mép "bị ăn" chứ không mờ đều; mép cháy khi còn nóng
  float ero = P.b * 0.5 + P.g * 0.5;
  float th = erode * 1.1 - 0.06;
  float mask = smoothstep(th, th + 0.1, ero);
  float rim = mask * (1.0 - smoothstep(th + 0.1, th + 0.2, ero)) * step(0.001, erode);
  // tô cel 2 nấc (sáng trên / tối dưới) — đọc được dáng khi tắt bloom
  float tone = mix(0.52, 1.1, smoothstep(0.5, 0.58, P.r));
  vec3 col = vSoot * tone;
  float core = smoothstep(0.45, 0.95, shape) * heat;
  col = mix(col, vHot * (1.1 + 1.6 * heat), core);
  col += vHot * rim * heat * 1.8;
  float a = shape * mask * vSt.x * 0.85;
  // tiếp xúc mềm với mặt sàn (giải tích): phần tấm sát / dưới sàn mờ dần thay vì bị cắt thẳng
  a *= smoothstep(0.0, 0.3, vH);
  if (a < 0.008) discard;
  // premultiplied: muội che (alpha), lõi nóng cộng sáng (giảm alpha theo lõi)
  gl_FragColor = vec4(col * a, a * (1.0 - core * 0.7));
}`;

function upload(a: THREE.InstancedBufferAttribute, n: number) {
  a.clearUpdateRanges();
  a.addUpdateRange(0, Math.max(1, n) * a.itemSize);
  a.needsUpdate = true;
}

const ST: PuffState = { scale: 1, alpha: 0, heat: 0, erode: 0 };

export function Puffs() {
  const { gl, size } = useThree();
  const res = useMemo(() => {
    const g = new THREE.InstancedBufferGeometry();
    const q = new THREE.PlaneGeometry(1, 1);
    g.setIndex(q.index);
    g.setAttribute("position", q.attributes.position);
    g.setAttribute("uv", q.attributes.uv);
    const dyn = (n: number) => new THREE.InstancedBufferAttribute(new Float32Array(MAX * n), n).setUsage(THREE.DynamicDrawUsage);
    g.setAttribute("iPos", dyn(3));
    g.setAttribute("iSz", dyn(4));
    g.setAttribute("iSt", dyn(4));
    g.setAttribute("iHot", dyn(3));
    g.setAttribute("iSoot", dyn(3));
    g.instanceCount = 0;
    const m = new THREE.ShaderMaterial({
      uniforms: { uPuff: { value: blankTexture() as THREE.Texture }, uFlow: { value: blankTexture() as THREE.Texture }, uT: { value: 0 }, uViewport: { value: new THREE.Vector2(1, 1) }, uMaxFrac: { value: 0.38 } },
      vertexShader: VS,
      fragmentShader: FS,
      transparent: true,
      depthWrite: false,
      blending: THREE.CustomBlending,
      blendSrc: THREE.OneFactor,
      blendDst: THREE.OneMinusSrcAlphaFactor,
      toneMapped: false,
    });
    const mesh = new THREE.Mesh(g, m);
    mesh.frustumCulled = false;
    mesh.renderOrder = 10;
    return { g, q, m, mesh, prev: 0 };
  }, []);
  useEffect(
    () => () => {
      res.g.dispose();
      res.q.dispose();
      res.m.dispose();
    },
    [res],
  );
  // nướng texture thủ tục lúc trình duyệt rảnh (không chặn khung hình lúc vào cảnh)
  useEffect(
    () =>
      whenVfxTextures((t) => {
        res.m.uniforms.uPuff.value = t.puff;
        res.m.uniforms.uFlow.value = t.noiseFlow;
      }),
    [res],
  );
  useEffect(() => {
    res.m.uniforms.uViewport.value.set(size.width * gl.getPixelRatio(), size.height * gl.getPixelRatio());
  }, [gl, size, res]);
  useFrame((_, rawDt) => {
    const dt = fxFrozen() ? 0 : Math.min(0.05, rawDt);
    const g = res.g;
    const ip = g.attributes.iPos as THREE.InstancedBufferAttribute;
    const isz = g.attributes.iSz as THREE.InstancedBufferAttribute;
    const ist = g.attributes.iSt as THREE.InstancedBufferAttribute;
    const ih = g.attributes.iHot as THREE.InstancedBufferAttribute;
    const is = g.attributes.iSoot as THREE.InstancedBufferAttribute;
    let n = 0;
    for (let i = 0; i < MAX; i++) {
      if (P.age[i] >= P.life[i]) continue;
      P.age[i] += dt;
      const k = P.age[i] / P.life[i];
      if (k >= 1) continue;
      const d = Math.exp(-P.drag[i] * dt);
      P.vel[i * 3] *= d;
      P.vel[i * 3 + 1] = P.vel[i * 3 + 1] * d + P.rise[i] * dt;
      P.vel[i * 3 + 2] *= d;
      P.pos[i * 3] += P.vel[i * 3] * dt;
      P.pos[i * 3 + 1] += P.vel[i * 3 + 1] * dt;
      P.pos[i * 3 + 2] += P.vel[i * 3 + 2] * dt;
      puffAt(k, ST);
      const sz = P.size[i] * ST.scale;
      // không chui xuống đất: tâm cụm luôn trên sàn ≥ 0,3 cỡ (phần chạm sàn được làm mềm trong shader)
      const minY = P.floor[i] + sz * 0.3;
      if (P.pos[i * 3 + 1] < minY) {
        P.pos[i * 3 + 1] = minY;
        if (P.vel[i * 3 + 1] < 0) P.vel[i * 3 + 1] = 0;
      }
      ip.setXYZ(n, P.pos[i * 3], P.pos[i * 3 + 1], P.pos[i * 3 + 2]);
      isz.setXYZW(n, sz, P.rot[i] + P.spin[i] * P.age[i], P.floor[i], P.seed[i]);
      ist.setXYZW(n, ST.alpha, ST.heat * P.heat[i], ST.erode, 0);
      ih.setXYZ(n, P.hot[i * 3], P.hot[i * 3 + 1], P.hot[i * 3 + 2]);
      is.setXYZ(n, P.soot[i * 3], P.soot[i * 3 + 1], P.soot[i * 3 + 2]);
      n++;
    }
    P.live = n;
    if (n > P.peak) P.peak = n;
    if (n || res.prev) {
      g.instanceCount = n;
      upload(ip, n);
      upload(isz, n);
      upload(ist, n);
      upload(ih, n);
      upload(is, n);
    }
    res.prev = n;
    res.mesh.visible = n > 0;
    res.m.uniforms.uT.value = (fxNow() / 1000) % 1000;
  });
  // nhóm "perf:puffs": window.__toggle("puffs") (dev) bật / tắt để đo phần đóng góp
  return (
    <group name="perf:puffs">
      <primitive object={res.mesh} />
    </group>
  );
}
