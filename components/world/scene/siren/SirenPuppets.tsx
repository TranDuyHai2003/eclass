"use client";
/**
 * Con rối giấy của Mê cung Hoạ âm — MỘT lệnh vẽ cho cả đoàn (InstancedMesh quad, alpha-test, atlas tranh khắc cắt giấy
 * public/world/siren/puppets.webp sinh bằng Codex; xử lý: scripts/siren-puppets.py). Logic thuần: lib/world/sirenPuppets.ts.
 * Mỗi khung (không cấp phát): gốc theo quỹ đạo 60 Hz → mặt phẳng rối quay về máy quay (2D trong 3D, không theo phối cảnh)
 * → thân nghiêng theo vận tốc (lò xo) → lật mặt giấy khi đổi hướng (lò xo vượt đích = tờ giấy lật) → khớp 12 Hz → dây treo
 * rung sau gia tốc (lò xo) → mặt flipbook 8 Hz → bóng đổ riêng. Bất hoà (pha boss) → lệch lớp mực in; phân rã → rã thành vụn giấy.
 */
import { useEffect, useMemo } from "react";
import { useFrame } from "@react-three/fiber";
import { useTexture } from "@react-three/drei";
import * as THREE from "three";
import { worldAsset } from "@/lib/world/avatars";
import { HARMONIC, springStep, type Spring } from "@/lib/world/harmonicState";
import { PUPPET_ATLAS, PUPPET_RECTS } from "@/lib/world/sirenPuppetAtlas";
import { CELL, GROUNDED, POSE_STRIDE, RIGS, SPECIES_SCALE, TOTAL_PARTS, TROUPE, animate, compose, faceFrame, puppetBeat, rootPos } from "@/lib/world/sirenPuppets";
import { reduceMotion } from "./SirenGravity";

const VERT = /* glsl */ `
attribute vec4 aRect;
attribute vec4 aTint;
varying vec2 vUv;
varying vec4 vTint;
varying float vFogDepth;
void main(){
  vUv = mix(aRect.xy, aRect.zw, uv);
  vTint = aTint;
  vec4 w = modelMatrix * instanceMatrix * vec4(position, 1.0);
  vec4 mv = viewMatrix * w;
  vFogDepth = -mv.z;
  gl_Position = projectionMatrix * mv;
}`;
const FRAG = /* glsl */ `
uniform sampler2D uMap;
uniform vec3 fogColor;
uniform float fogNear;
uniform float fogFar;
uniform float uMis;
uniform float uDecomp;
varying vec2 vUv;
varying vec4 vTint;
varying float vFogDepth;
float hash(vec2 p){ return fract(sin(dot(p, vec2(127.1, 311.7))) * 43758.5453); }
void main(){
  vec4 t = texture2D(uMap, vUv);
  vec3 c = t.rgb * vTint.rgb;
  if (t.a < 0.5) {
    // lệch lớp mực in (bất hoà): bản in đỏ son trượt khỏi hình giấy
    if (uMis < 1e-4 || texture2D(uMap, vUv + vec2(uMis, -uMis * 0.6)).a < 0.5) discard;
    c = vec3(0.78, 0.24, 0.39);
  }
  // phân rã: con rối có hạt giống < mức phân rã vụn dần thành mảnh giấy
  if (uDecomp > vTint.a && hash(floor(vUv * 220.0)) < (uDecomp - vTint.a) * 1.8) discard;
  c = mix(c, fogColor, smoothstep(fogNear, fogFar * 1.3, vFogDepth) * 0.9);
  gl_FragColor = vec4(c, 1.0);
}`;

type Slot = { start: number; n: number; face: number; shadow: number };

/** trạng thái động mỗi con rối (mảng phẳng, cấp phát một lần) */
const N = TROUPE.length;
const PREV = new Float32Array(N * 3);
const VLAT = new Float32Array(N);
const FACE = new Int8Array(N);
const LEAN: Spring[] = TROUPE.map(() => ({ x: 0, v: 0 }));
const FLIP: Spring[] = TROUPE.map(() => ({ x: 1, v: 0 }));
const SWAY: Spring[] = TROUPE.map(() => ({ x: 0, v: 0 }));
const FACING = new Float32Array(N).fill(1);
const ROOT = new Float32Array(3);
const ROT = new Float32Array(32);
const SX = new Float32Array(32);
const POSE = new Float32Array(32 * POSE_STRIDE);
const RM = { on: false, at: -1 };

export function SirenPuppets() {
  const tex = useTexture(worldAsset(PUPPET_ATLAS));
  const { mesh, mat, slots, rect } = useMemo(() => {
    // atlas sRGB → giải mã khi lấy mẫu; hậu kỳ mã hoá lại ở cuối (như phông cắt giấy CollageFlats)
    tex.colorSpace = THREE.SRGBColorSpace;
    tex.anisotropy = 4;
    const geo = new THREE.PlaneGeometry(1, 1);
    const rectA = new Float32Array(TOTAL_PARTS * 4);
    const tint = new Float32Array(TOTAL_PARTS * 4);
    const slots: Slot[] = [];
    let k = 0;
    const put = (cell: number, r: number, g: number, b: number, seed: number) => {
      rectA.set(PUPPET_RECTS[cell], k * 4);
      tint.set([r, g, b, seed], k * 4);
      return k++;
    };
    TROUPE.forEach((p) => {
      const rig = RIGS[p.sp];
      const start = k;
      let face = -1;
      // hạt giống phân rã: con rối xa tâm / nhỏ rã trước (0,05…0,85)
      const ds = 0.05 + ((p.seed * 7.31) % 1) * 0.8;
      // biến thể màu nhẹ giữa các con (giấy in lệch tông)
      const v = 0.94 + ((p.seed * 3.7) % 1) * 0.08;
      rig.forEach((d) => {
        const ink = d.cell === CELL.string;
        const i = ink ? put(d.cell, 0.14, 0.1, 0.2, ds) : put(d.cell, v, 0.97 + (v - 0.98) * 0.5, 1.02 - (v - 0.94), ds);
        if (d.face) face = i;
      });
      const shadow = GROUNDED[p.sp] ? put(CELL.shadow, 0.17, 0.09, 0.27, ds) : -1;
      slots.push({ start, n: rig.length, face, shadow });
    });
    geo.setAttribute("aRect", new THREE.InstancedBufferAttribute(rectA, 4).setUsage(THREE.DynamicDrawUsage));
    geo.setAttribute("aTint", new THREE.InstancedBufferAttribute(tint, 4));
    const m = new THREE.ShaderMaterial({
      vertexShader: VERT,
      fragmentShader: FRAG,
      side: THREE.DoubleSide,
      fog: true,
      uniforms: THREE.UniformsUtils.merge([THREE.UniformsLib.fog, { uMap: { value: null }, uMis: { value: 0 }, uDecomp: { value: 0 } }]),
    });
    m.uniforms.uMap.value = tex;
    const im = new THREE.InstancedMesh(geo, m, TOTAL_PARTS);
    im.instanceMatrix.setUsage(THREE.DynamicDrawUsage);
    im.frustumCulled = false;
    im.name = "perf:puppets";
    PREV.fill(NaN);
    FACE.fill(-1);
    return { mesh: im, mat: m, slots, rect: geo.getAttribute("aRect") as THREE.InstancedBufferAttribute };
  }, [tex]);
  useEffect(
    () => () => {
      mesh.geometry.dispose();
      mat.dispose();
    },
    [mesh, mat],
  );

  useFrame((st, rawDt) => {
    const dt = Math.min(Math.max(rawDt, 1e-3), 0.1);
    const H = HARMONIC;
    if (H.time - RM.at > 1 || H.time < RM.at) {
      RM.at = H.time;
      RM.on = reduceMotion();
    }
    const calm = RM.on;
    mat.uniforms.uMis.value = calm ? 0 : 0.0035 * H.dissonance;
    mat.uniforms.uDecomp.value = H.decomposition;
    const cam = st.camera.position;
    const pbBase = puppetBeat(H.puppetTime);
    const M = mesh.instanceMatrix.array as Float32Array;
    let rectDirty = false;
    for (let i = 0; i < N; i++) {
      const p = TROUPE[i];
      const sl = slots[i];
      rootPos(p, H.beat, ROOT);
      const px = ROOT[0];
      const py = ROOT[1];
      const pz = ROOT[2];
      if (Number.isNaN(PREV[i * 3])) {
        PREV[i * 3] = px;
        PREV[i * 3 + 1] = py;
        PREV[i * 3 + 2] = pz;
      }
      const vx = (px - PREV[i * 3]) / dt;
      const vz = (pz - PREV[i * 3 + 2]) / dt;
      PREV[i * 3] = px;
      PREV[i * 3 + 1] = py;
      PREV[i * 3 + 2] = pz;
      // mặt phẳng rối quay về máy quay: phải r = (cos yaw, 0, −sin yaw), pháp tuyến n = (sin yaw, 0, cos yaw)
      const yaw = Math.atan2(cam.x - px, cam.z - pz);
      const rx = Math.cos(yaw);
      const rz = -Math.sin(yaw);
      const nx = -rz;
      const nz = rx;
      const vlat = vx * rx + vz * rz;
      const alat = (vlat - VLAT[i]) / dt;
      VLAT[i] = vlat;
      // lật giấy theo hướng đi (lò xo vượt đích: tờ giấy co về 0 rồi bật ra mặt kia)
      // (hợp xướng đứng hát quay mặt về trước — chỉ con rối đi đường mới lật)
      if (p.sp !== "peg" && Math.abs(vlat) > 0.6) FACING[i] = vlat > 0 ? 1 : -1;
      springStep(FLIP[i], FACING[i], 13, 0.45, dt);
      const f = FLIP[i].x;
      // thân nghiêng theo vận tốc, dây treo rung sau gia tốc
      springStep(LEAN[i], Math.max(-0.32, Math.min(0.32, -vlat * 0.09)) * (calm ? 0.4 : 1), 9, 0.65, dt);
      springStep(SWAY[i], Math.max(-0.5, Math.min(0.5, -alat * 0.035)) * (calm ? 0.3 : 1), 6, 0.18, dt);
      // dáng 12 Hz: đoàn diễu đồng bộ (nghi thức), các loài khác lệch pha theo hạt giống
      const pb = p.sp === "hammer" || p.sp === "peg" ? pbBase : pbBase + p.seed * 2;
      const lift = animate(p, pb, ROT, SX);
      const rig = RIGS[p.sp];
      // tư thế ghép trong hệ "chưa lật" → lật cả hình x → f·x: nghiêng / lệch dây đổi dấu theo f để đúng chiều thế giới
      const sg = f >= 0 ? 1 : -1;
      compose(rig, ROT, SX, LEAN[i].x * sg, SWAY[i].x * sg, POSE);
      const bx = px;
      const sc = SPECIES_SCALE[p.sp];
      const by = py + lift * sc;
      const bz = pz;
      for (let k = 0; k < sl.n; k++) {
        const o = k * POSE_STRIDE;
        const cx = POSE[o] * f * sc;
        const cy = POSE[o + 1] * sc;
        const a = POSE[o + 2];
        const w = POSE[o + 3] * sc;
        const h = POSE[o + 4] * sc;
        const z = POSE[o + 5] * sc;
        const ca = Math.cos(a);
        const sa = Math.sin(a);
        // trục X = R(a)·(w, 0), trục Y = R(a)·(0, h) trong mặt phẳng rối; lật: thành phần ngang × f; rồi đưa lên 3D theo (r, lên, n)
        const xx = f * w * ca;
        const yx = -f * h * sa;
        const m = (sl.start + k) * 16;
        M[m] = rx * xx;
        M[m + 1] = w * sa;
        M[m + 2] = rz * xx;
        M[m + 3] = 0;
        M[m + 4] = rx * yx;
        M[m + 5] = h * ca;
        M[m + 6] = rz * yx;
        M[m + 7] = 0;
        M[m + 8] = nx;
        M[m + 9] = 0;
        M[m + 10] = nz;
        M[m + 11] = 0;
        M[m + 12] = bx + rx * cx + nx * z;
        M[m + 13] = by + cy;
        M[m + 14] = bz + rz * cx + nz * z;
        M[m + 15] = 1;
      }
      if (sl.shadow >= 0) {
        // bóng: elip phẳng trên sàn, co khi thân nhấc, lệch nhẹ theo nắng — chuyển động riêng với con rối
        const s = 1.3 * sc * (1 - lift * 1.5);
        const m = sl.shadow * 16;
        M[m] = s;
        M[m + 1] = 0;
        M[m + 2] = 0;
        M[m + 3] = 0;
        M[m + 4] = 0;
        M[m + 5] = 0;
        M[m + 6] = -s * 0.75;
        M[m + 7] = 0;
        M[m + 8] = 0;
        M[m + 9] = 1;
        M[m + 10] = 0;
        M[m + 11] = 0;
        M[m + 12] = px - 0.25 - LEAN[i].x * 0.6;
        M[m + 13] = 0.025;
        M[m + 14] = pz - 0.15;
        M[m + 15] = 1;
      }
      // mặt flipbook 8 Hz
      const fr = faceFrame(H.stopTime, p.seed, H.beat, H.dissonance, calm);
      if (fr !== FACE[i] && sl.face >= 0) {
        FACE[i] = fr;
        (rect.array as Float32Array).set(PUPPET_RECTS[CELL.face0 + fr], sl.face * 4);
        rectDirty = true;
      }
    }
    mesh.instanceMatrix.needsUpdate = true;
    if (rectDirty) rect.needsUpdate = true;
  });
  return <primitive object={mesh} />;
}
