"use client";
/**
 * Hạt kiểu HoYo (nghiên cứu Codex 2026-11) — MỘT batch instanced, cộng sáng HDR, thay toàn bộ hạt khối đặc (sao / pha lê / lục giác):
 *  • kind 0 "tia": billboard kéo dài theo vận tốc CHIẾU TRÊN MÀN HÌNH (rộng 0,03–0,08 m, kéo 0,025–0,055 s × vận tốc),
 *    mặt nạ Gauss mềm; gần như đứng yên → thành chấm mềm;
 *  • kind 1 "glint": chữ thập mảnh + quầng (điểm nhấn hồi máu / trúng đòn);
 *  • màu: lõi trắng ấm → thân màu phép → đuôi tắt dần (ramp theo tuổi), độ sáng 2–5 (bloom bắt).
 * Mô phỏng CPU nhẹ (≤ 480 hạt), giới hạn cỡ trên màn hình để tránh overdraw khi sát camera.
 * API: emitSpark(...), emitBurst(...) — gọi từ bất cứ đâu (combat, phép, cảnh).
 */
import { useEffect, useMemo } from "react";
import { useFrame, useThree } from "@react-three/fiber";
import * as THREE from "three";
import { useWorld } from "../store";
import { timeScale } from "../store";

const MAX = 480;
const P = {
  pos: new Float32Array(MAX * 3),
  vel: new Float32Array(MAX * 3),
  col: new Float32Array(MAX * 3),
  life: new Float32Array(MAX),
  age: new Float32Array(MAX),
  size: new Float32Array(MAX),
  stretch: new Float32Array(MAX),
  kind: new Float32Array(MAX),
  drag: new Float32Array(MAX),
  grav: new Float32Array(MAX),
  head: 0,
};
const C = new THREE.Color();

export type SparkOpts = { size?: number; life?: number; stretch?: number; kind?: 0 | 1; drag?: number; gravity?: number; bright?: number };

/** một hạt: vị trí, vận tốc (m/s), màu (chuỗi hoặc Color) */
export function emitSpark(x: number, y: number, z: number, vx: number, vy: number, vz: number, color: string | THREE.Color, o: SparkOpts = {}) {
  const i = P.head++ % MAX;
  P.pos.set([x, y, z], i * 3);
  P.vel.set([vx, vy, vz], i * 3);
  C.set(color as THREE.ColorRepresentation).multiplyScalar(o.bright ?? 2.6);
  P.col.set([C.r, C.g, C.b], i * 3);
  P.life[i] = o.life ?? 0.5;
  P.age[i] = 0;
  P.size[i] = o.size ?? 0.05;
  P.stretch[i] = o.stretch ?? 0.04;
  P.kind[i] = o.kind ?? 0;
  P.drag[i] = o.drag ?? 2.5;
  P.grav[i] = o.gravity ?? 4;
}

/** chùm tia toả nửa cầu trên (thay vụ nổ khối hình học cũ) + vài glint */
export function emitBurst(x: number, y: number, z: number, color: string, n = 24, speed = 5, o: SparkOpts = {}) {
  for (let k = 0; k < n; k++) {
    const u = Math.random() * 2 - 1;
    const th = Math.random() * Math.PI * 2;
    const rr = Math.sqrt(1 - u * u);
    const sp = speed * (0.35 + Math.random() * 0.8);
    const glint = k % 6 === 0;
    emitSpark(x, y, z, rr * Math.cos(th) * sp, (Math.abs(u) * 1.1 + 0.25) * sp, rr * Math.sin(th) * sp, k % 3 === 0 ? "#fff4d4" : color, {
      size: glint ? 0.22 : 0.035 + Math.random() * 0.035,
      life: glint ? 0.35 : 0.35 + Math.random() * 0.45,
      kind: glint ? 1 : 0,
      ...o,
    });
  }
}

/** tia trúng đòn dùng chung: 1 glint + 5–9 tia ngắn xoè theo hướng (dx, dz) */
export function emitHit(x: number, y: number, z: number, color: string, dx = 0, dz = 0, k = 1) {
  emitSpark(x, y, z, 0, 0, 0, "#fff4d4", { kind: 1, size: 0.26 * k, life: 0.16, bright: 3.2 });
  const n = 5 + Math.floor(Math.random() * 5);
  const l = Math.hypot(dx, dz) || 1;
  for (let i = 0; i < n; i++) {
    const a = Math.random() * Math.PI * 2;
    const s = 4 + Math.random() * 5;
    emitSpark(x, y, z, Math.cos(a) * s * 0.7 + (dx / l) * 3, (Math.random() * 0.9 + 0.2) * s * 0.7, Math.sin(a) * s * 0.7 + (dz / l) * 3, i % 2 ? color : "#fff4d4", { size: 0.03, life: 0.12 + Math.random() * 0.12, stretch: 0.045, drag: 6, gravity: 2 });
  }
}

const VS = /* glsl */ `
  attribute vec3 iPos; attribute vec3 iVel; attribute vec4 iCol; attribute vec3 iSzK;
  uniform vec2 uViewport;
  varying vec2 vUv; varying vec4 vCol; varying float vKind;
  void main(){
    vUv = uv; vCol = iCol; vKind = iSzK.z;
    vec4 clip = projectionMatrix * viewMatrix * vec4(iPos, 1.0);
    if (clip.w <= 0.0001 || iCol.a <= 0.0) { gl_Position = vec4(2.0, 2.0, 2.0, 1.0); return; }
    vec2 hv = uViewport * 0.5;
    float w;
    vec2 q = uv - 0.5;
    if (iSzK.z > 0.5) {
      // glint: hình vuông cố định trên màn hình
      w = clamp(iSzK.x * projectionMatrix[1][1] * hv.y / clip.w, 4.0, 90.0);
      clip.xy += q * w * 2.0 / hv * clip.w;
    } else {
      vec4 dClip = projectionMatrix * viewMatrix * vec4(iVel, 0.0);
      vec2 vpx = (dClip.xy - clip.xy / clip.w * dClip.w) / clip.w * hv;
      float sp = length(vpx);
      vec2 dir = sp > 0.01 ? vpx / sp : vec2(1.0, 0.0);
      vec2 acr = vec2(-dir.y, dir.x);
      w = clamp(iSzK.x * projectionMatrix[1][1] * hv.y / clip.w, 1.5, 24.0);
      float len = clamp(w + sp * iSzK.y, w, 110.0);
      clip.xy += (dir * q.x * len + acr * q.y * w) / hv * clip.w;
    }
    gl_Position = clip;
  }`;

const FS = /* glsl */ `
  varying vec2 vUv; varying vec4 vCol; varying float vKind;
  void main(){
    vec2 q = vUv * 2.0 - 1.0;
    float m;
    if (vKind > 0.5) {
      // chữ thập mảnh + quầng tròn
      float cross = exp(-abs(q.x) * 28.0) * exp(-q.y * q.y * 2.2) + exp(-abs(q.y) * 28.0) * exp(-q.x * q.x * 2.2);
      float halo = exp(-dot(q, q) * 7.0) * 0.55;
      m = cross + halo;
    } else {
      float r2 = dot(q, q);
      m = exp2(-4.5 * r2) * (1.0 - smoothstep(0.55, 1.0, r2));
    }
    float a = vCol.a * m;
    if (a < 0.003) discard;
    gl_FragColor = vec4(vCol.rgb * a, 1.0);
  }`;

export function Sparks() {
  const { gl, size } = useThree();
  const { mesh, geo, mat } = useMemo(() => {
    const g = new THREE.InstancedBufferGeometry();
    const q = new THREE.PlaneGeometry(1, 1);
    g.setIndex(q.index);
    g.setAttribute("position", q.attributes.position);
    g.setAttribute("uv", q.attributes.uv);
    const dyn = (n: number) => new THREE.InstancedBufferAttribute(new Float32Array(MAX * n), n).setUsage(THREE.DynamicDrawUsage);
    g.setAttribute("iPos", dyn(3));
    g.setAttribute("iVel", dyn(3));
    g.setAttribute("iCol", dyn(4));
    g.setAttribute("iSzK", dyn(3));
    g.instanceCount = 0;
    const m = new THREE.ShaderMaterial({
      uniforms: { uViewport: { value: new THREE.Vector2(1, 1) } },
      vertexShader: VS,
      fragmentShader: FS,
      transparent: true,
      depthWrite: false,
      blending: THREE.AdditiveBlending,
      toneMapped: false,
    });
    const mesh = new THREE.Mesh(g, m);
    mesh.frustumCulled = false;
    mesh.renderOrder = 11;
    return { mesh, geo: g, mat: m };
  }, []);
  useEffect(
    () => () => {
      geo.dispose();
      mat.dispose();
    },
    [geo, mat],
  );
  useEffect(() => {
    mat.uniforms.uViewport.value.set(size.width * gl.getPixelRatio(), size.height * gl.getPixelRatio());
  }, [gl, size, mat]);
  // vụ nổ cũ qua store (useWorld.burst) → chùm tia mềm
  const last = useMemo(() => ({ id: Infinity }), []);
  useFrame((_, rawDt) => {
    const bursts = useWorld.getState().bursts;
    // lần đầu: bỏ qua vụ nổ đã có trước khi gắn
    if (last.id === Infinity) last.id = bursts.reduce((m, b) => Math.max(m, b.id), 0);
    for (const b of bursts) {
      if (b.id <= last.id) continue;
      last.id = b.id;
      emitBurst(b.pos[0], b.pos[1], b.pos[2], b.color, Math.min(48, Math.round(b.count * 0.7)));
    }
    const dt = Math.min(0.05, rawDt) * timeScale();
    const ip = geo.attributes.iPos as THREE.InstancedBufferAttribute;
    const iv = geo.attributes.iVel as THREE.InstancedBufferAttribute;
    const ic = geo.attributes.iCol as THREE.InstancedBufferAttribute;
    const is = geo.attributes.iSzK as THREE.InstancedBufferAttribute;
    let n = 0;
    for (let i = 0; i < MAX; i++) {
      if (P.age[i] >= P.life[i]) continue;
      P.age[i] += dt;
      const k = P.age[i] / P.life[i];
      if (k >= 1) continue;
      const d = Math.exp(-P.drag[i] * dt);
      P.vel[i * 3] *= d;
      P.vel[i * 3 + 1] = P.vel[i * 3 + 1] * d - P.grav[i] * dt;
      P.vel[i * 3 + 2] *= d;
      P.pos[i * 3] += P.vel[i * 3] * dt;
      P.pos[i * 3 + 1] += P.vel[i * 3 + 1] * dt;
      P.pos[i * 3 + 2] += P.vel[i * 3 + 2] * dt;
      // ramp: loé nhanh (0–8%) rồi tắt dần; màu ngả về thân khi già
      const a = k < 0.08 ? k / 0.08 : 1 - (k - 0.08) / 0.92;
      ip.setXYZ(n, P.pos[i * 3], P.pos[i * 3 + 1], P.pos[i * 3 + 2]);
      iv.setXYZ(n, P.vel[i * 3], P.vel[i * 3 + 1], P.vel[i * 3 + 2]);
      ic.setXYZW(n, P.col[i * 3], P.col[i * 3 + 1], P.col[i * 3 + 2], a * a);
      is.setXYZ(n, P.size[i] * (P.kind[i] > 0.5 ? 1 - k * 0.5 : 1), P.stretch[i], P.kind[i]);
      n++;
    }
    geo.instanceCount = n;
    if (n) {
      ip.needsUpdate = iv.needsUpdate = ic.needsUpdate = is.needsUpdate = true;
    }
  });
  return <primitive object={mesh} />;
}
