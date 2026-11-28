"use client";
/**
 * V1 — dải vệt (trail ribbon) cho vật bay: mũi tên, thiên thạch, quả lắc tròn, đĩa xoắn ốc vàng.
 * Một mesh duy nhất (pool K dải × M điểm), dải luôn quay mặt về máy quay, u = tuổi (0 mới → 1 cũ), v = ngang dải;
 * lõi trắng giữa dải → màu vũ khí → tắt dần theo tuổi, vân năng lượng trôi dọc dải. Cộng sáng HDR (bloom bắt).
 * Số dải tối đa theo mức hiệu ứng trong cài đặt đồ hoạ (lib/world/vfxBudget.ts RIBBON_CAP).
 */
import { useEffect, useMemo } from "react";
import { useFrame, useThree } from "@react-three/fiber";
import * as THREE from "three";
import { orbiters, projectiles } from "../combat/combat";
import { useGfx } from "../gfx";
import { RIBBON_CAP } from "@/lib/world/vfxBudget";

const K = 16; // số dải tối đa
const M = 16; // điểm mỗi dải

type Slot = { key: object | null; n: number; pts: Float32Array; t: Float32Array; color: THREE.Color; colStr: string; width: number; life: number; seen: number };
type Feed = { slots: Slot[]; map: Map<object, Slot>; now: number; cap: number };

/** nạp một điểm cho dải của `key` (hàm cấp module: không tạo closure mỗi khung; màu chỉ phân tích lại khi đổi) */
function feed(F: Feed, key: object, x: number, y: number, z: number, color: string, width: number, life: number) {
  let s = F.map.get(key);
  if (!s) {
    let used = 0;
    let free: Slot | null = null;
    for (const q of F.slots) {
      if (q.key) used++;
      else if (!free) free = q;
    }
    if (used >= F.cap || !free) return;
    s = free;
    s.key = key;
    s.n = 0;
    F.map.set(key, s);
  }
  s.seen = F.now;
  if (s.colStr !== color) {
    s.colStr = color;
    s.color.set(color);
  }
  s.width = width;
  s.life = life;
  const p = s.pts;
  if (s.n && Math.hypot(p[0] - x, p[1] - y, p[2] - z) < 0.04) {
    s.t[0] = F.now;
    return;
  }
  // dời lịch sử một ô, điểm mới ở đầu
  p.copyWithin(3, 0, (M - 1) * 3);
  s.t.copyWithin(1, 0, M - 1);
  p[0] = x;
  p[1] = y;
  p[2] = z;
  s.t[0] = F.now;
  s.n = Math.min(M, s.n + 1);
}

const VS = /* glsl */ `
attribute vec3 aCol; varying vec2 vUv; varying vec3 vCol;
void main(){ vUv = uv; vCol = aCol; gl_Position = projectionMatrix * modelViewMatrix * vec4(position, 1.0); }`;
const FS = /* glsl */ `
uniform float uT; varying vec2 vUv; varying vec3 vCol;
void main(){
  float age = vUv.x;
  if (age >= 0.999) discard;
  float v = abs(vUv.y * 2.0 - 1.0);
  float prof = 1.0 - v * v;
  float tail = pow(1.0 - age, 1.6);
  float streak = 0.7 + 0.3 * sin(age * 28.0 - uT * 22.0);
  float core = smoothstep(0.55, 1.0, prof) * (1.0 - age);
  vec3 c = mix(vCol * 1.7, vec3(2.6), core * 0.8);
  float a = prof * tail * streak;
  if (a < 0.01) discard;
  gl_FragColor = vec4(c * a, 1.0);
}`;

export function RibbonTrails() {
  const camera = useThree((s) => s.camera);
  const res = useMemo(() => {
    const geo = new THREE.BufferGeometry();
    const pos = new Float32Array(K * M * 2 * 3);
    const uv = new Float32Array(K * M * 2 * 2);
    const col = new Float32Array(K * M * 2 * 3);
    const idx: number[] = [];
    for (let k = 0; k < K; k++)
      for (let i = 0; i < M - 1; i++) {
        const a = (k * M + i) * 2;
        idx.push(a, a + 1, a + 2, a + 1, a + 3, a + 2);
      }
    geo.setIndex(idx);
    geo.setAttribute("position", new THREE.BufferAttribute(pos, 3).setUsage(THREE.DynamicDrawUsage));
    geo.setAttribute("uv", new THREE.BufferAttribute(uv, 2).setUsage(THREE.DynamicDrawUsage));
    geo.setAttribute("aCol", new THREE.BufferAttribute(col, 3).setUsage(THREE.DynamicDrawUsage));
    for (let i = 0; i < K * M * 2; i++) uv[i * 2] = 1;
    const mat = new THREE.ShaderMaterial({ vertexShader: VS, fragmentShader: FS, uniforms: { uT: { value: 0 } }, transparent: true, depthWrite: false, side: THREE.DoubleSide, blending: THREE.AdditiveBlending, toneMapped: false });
    const slots: Slot[] = Array.from({ length: K }, () => ({ key: null, n: 0, pts: new Float32Array(M * 3), t: new Float32Array(M), color: new THREE.Color(), colStr: "", width: 0.1, life: 0.2, seen: 0 }));
    const map = new Map<object, Slot>();
    return { geo, mat, slots, map, F: { slots, map, now: 0, cap: K } as Feed, a: new THREE.Vector3(), b: new THREE.Vector3(), side: new THREE.Vector3(), toCam: new THREE.Vector3() };
  }, []);
  useEffect(() => () => (res.geo.dispose(), res.mat.dispose()), [res]);
  const mesh = useMemo(() => {
    const m = new THREE.Mesh(res.geo, res.mat);
    m.frustumCulled = false;
    m.renderOrder = 6;
    return m;
  }, [res]);

  useFrame(() => {
    const now = performance.now() / 1000;
    const cap = Math.min(K, RIBBON_CAP[useGfx.getState().vfx] ?? K);
    const { slots, map, F } = res;
    F.now = now;
    F.cap = cap;
    for (const pr of projectiles) if (pr.alive) feed(F, pr, pr.pos.x, pr.pos.y, pr.pos.z, pr.big ? "#ffb45a" : pr.color, pr.big ? 0.42 : pr.pierce ? 0.16 : 0.11, pr.big ? 0.32 : 0.18);
    for (const o of orbiters) feed(F, o, o.pos.x, o.pos.y, o.pos.z, o.kind === "pendulum" ? "#c8a6ff" : "#ffd27a", o.kind === "pendulum" ? 0.24 : 0.28, o.kind === "pendulum" ? 0.34 : 0.3);
    const pos = res.geo.getAttribute("position") as THREE.BufferAttribute;
    const uv = res.geo.getAttribute("uv") as THREE.BufferAttribute;
    const col = res.geo.getAttribute("aCol") as THREE.BufferAttribute;
    let any = false;
    for (let k = 0; k < slots.length; k++) {
      const s = slots[k];
      const base = k * M * 2;
      if (s.key) {
        // nguồn đã biến mất → không thêm điểm; khi điểm cũ nhất cũng hết hạn thì trả slot
        while (s.n && now - s.t[s.n - 1] > s.life) s.n--;
        if (!s.n || now - s.seen > s.life + 0.05) {
          map.delete(s.key);
          s.key = null;
          s.n = 0;
        }
      }
      if (s.n < 2) {
        if (uv.getX(base) !== 1) for (let i = 0; i < M * 2; i++) uv.setX(base + i, 1);
        continue;
      }
      any = true;
      const p = s.pts;
      for (let i = 0; i < M; i++) {
        const j = Math.min(i, s.n - 1);
        const age = i < s.n ? Math.min(1, (now - s.t[j]) / s.life) : 1;
        res.a.set(p[j * 3], p[j * 3 + 1], p[j * 3 + 2]);
        const j0 = Math.max(0, j - 1);
        const j1 = Math.min(s.n - 1, j + 1);
        res.b.set(p[j0 * 3] - p[j1 * 3], p[j0 * 3 + 1] - p[j1 * 3 + 1], p[j0 * 3 + 2] - p[j1 * 3 + 2]);
        res.toCam.subVectors(camera.position, res.a);
        res.side.crossVectors(res.b, res.toCam);
        const l = res.side.length();
        if (l > 1e-6) res.side.multiplyScalar((s.width * (1 - age * 0.7)) / l);
        pos.setXYZ(base + i * 2, res.a.x + res.side.x, res.a.y + res.side.y, res.a.z + res.side.z);
        pos.setXYZ(base + i * 2 + 1, res.a.x - res.side.x, res.a.y - res.side.y, res.a.z - res.side.z);
        uv.setXY(base + i * 2, age, 0);
        uv.setXY(base + i * 2 + 1, age, 1);
        col.setXYZ(base + i * 2, s.color.r, s.color.g, s.color.b);
        col.setXYZ(base + i * 2 + 1, s.color.r, s.color.g, s.color.b);
      }
    }
    mesh.visible = any;
    res.mat.uniforms.uT.value = now;
    pos.needsUpdate = true;
    uv.needsUpdate = true;
    col.needsUpdate = true;
  });
  return <primitive object={mesh} />;
}
