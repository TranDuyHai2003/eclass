"use client";
/**
 * Vệt sáng đầu cánh khi lượn / bay: hai dải ruy băng (theo sải cánh) bám hai mép tàu lượn, mờ dần theo tuổi,
 * cộng sáng (additive) → nở hoa bởi bloom. Tốc độ càng cao vệt càng sáng / dài (độ dài tự nhiên theo quãng đường).
 */
import { useEffect, useMemo, useRef, type RefObject } from "react";
import { useFrame } from "@react-three/fiber";
import * as THREE from "three";
import { FLIGHT } from "../flight";

const N = 40;
const W = 0.07; // nửa bề rộng ruy băng (dọc theo sải cánh)
const LIFE = 0.45; // giây — vệt ngắn, không quét qua máy quay

export function WingTrails({ glider }: { glider: RefObject<THREE.Group | null> }) {
  const { geo, mat, hist } = useMemo(() => {
    const geo = new THREE.BufferGeometry();
    const pos = new Float32Array(2 * N * 2 * 3);
    const uv = new Float32Array(2 * N * 2 * 2);
    const age = new Float32Array(2 * N * 2);
    const idx: number[] = [];
    for (let t = 0; t < 2; t++)
      for (let i = 0; i < N; i++) {
        const b = (t * N + i) * 2;
        uv.set([i / (N - 1), 0, i / (N - 1), 1], b * 2);
        if (i < N - 1) idx.push(b, b + 1, b + 2, b + 1, b + 3, b + 2);
      }
    geo.setAttribute("position", new THREE.BufferAttribute(pos, 3).setUsage(THREE.DynamicDrawUsage));
    geo.setAttribute("uv", new THREE.BufferAttribute(uv, 2));
    geo.setAttribute("aAge", new THREE.BufferAttribute(age, 1).setUsage(THREE.DynamicDrawUsage));
    geo.setIndex(idx);
    const mat = new THREE.ShaderMaterial({
      uniforms: { uOn: { value: 0 }, uBoost: { value: 0 } },
      vertexShader: `attribute float aAge; varying vec2 vUv; varying float vAge; varying float vNear;
        void main(){ vUv = uv; vAge = aAge; vec4 mv = modelViewMatrix * vec4(position, 1.0); vNear = smoothstep(1.5, 5.0, -mv.z); gl_Position = projectionMatrix * mv; }`,
      fragmentShader: `uniform float uOn; uniform float uBoost; varying vec2 vUv; varying float vAge; varying float vNear;
        void main(){
          float age = clamp(vAge, 0.0, 1.0);
          float edge = 1.0 - abs(vUv.y * 2.0 - 1.0);
          float a = pow(1.0 - age, 1.8) * smoothstep(0.0, 0.6, edge) * uOn * vNear;
          vec3 c = mix(vec3(0.75, 0.97, 1.0), vec3(0.72, 0.5, 1.0), age);
          c = mix(c, vec3(1.0, 0.85, 0.5), uBoost * (1.0 - age));
          gl_FragColor = vec4(c * (1.3 + uBoost * 1.2), a * 0.7);
        }`,
      transparent: true,
      depthWrite: false,
      blending: THREE.AdditiveBlending,
      side: THREE.DoubleSide,
      toneMapped: false,
    });
    const hist = [0, 1].map(() => Array.from({ length: N }, () => ({ a: new THREE.Vector3(), b: new THREE.Vector3(), t: 0 })));
    return { geo, mat, hist };
  }, []);
  useEffect(
    () => () => {
      geo.dispose();
      mat.dispose();
    },
    [geo, mat],
  );
  const half = useRef(0);
  const live = useRef(false);
  const inv = useMemo(() => new THREE.Matrix4(), []);
  const tmp = useMemo(() => [new THREE.Vector3(), new THREE.Vector3()], []);
  useFrame((_, dt) => {
    const g = glider.current;
    const on = !!g && g.visible;
    mat.uniforms.uOn.value += ((on ? 1 : 0) - mat.uniforms.uOn.value) * Math.min(1, dt * (on ? 6 : 3));
    mat.uniforms.uBoost.value += ((performance.now() < FLIGHT.boostUntil ? 1 : 0) - mat.uniforms.uBoost.value) * Math.min(1, dt * 4);
    if (!g || !on) {
      live.current = false;
      return;
    }
    g.updateWorldMatrix(true, true);
    if (!half.current) {
      // nửa sải cánh đo từ lưới tàu lượn (toạ độ cục bộ của nhóm)
      inv.copy(g.matrixWorld).invert();
      const box = new THREE.Box3();
      g.traverse((o) => {
        const m = o as THREE.Mesh;
        if (!m.isMesh) return;
        if (!m.geometry.boundingBox) m.geometry.computeBoundingBox();
        box.union(m.geometry.boundingBox!.clone().applyMatrix4(new THREE.Matrix4().multiplyMatrices(inv, m.matrixWorld)));
      });
      if (box.isEmpty()) return;
      half.current = Math.max(Math.abs(box.min.x), Math.abs(box.max.x)) * 0.97;
    }
    const pos = geo.attributes.position as THREE.BufferAttribute;
    const ageA = geo.attributes.aAge as THREE.BufferAttribute;
    const now = performance.now() / 1000;
    for (let t = 0; t < 2; t++) {
      const sx = t === 0 ? -1 : 1;
      tmp[0].set(sx * half.current, 0, 0).applyMatrix4(g.matrixWorld);
      tmp[1].set(sx * (half.current - W * 2), 0, 0).applyMatrix4(g.matrixWorld);
      const H = hist[t];
      if (!live.current) for (const h of H) (h.a.copy(tmp[0]), h.b.copy(tmp[1]), (h.t = now - LIFE));
      else {
        const last = H.pop()!;
        last.a.copy(tmp[0]);
        last.b.copy(tmp[1]);
        last.t = now;
        H.unshift(last);
      }
      for (let i = 0; i < N; i++) {
        const b = (t * N + i) * 2;
        pos.setXYZ(b, H[i].a.x, H[i].a.y, H[i].a.z);
        pos.setXYZ(b + 1, H[i].b.x, H[i].b.y, H[i].b.z);
        const ag = (now - H[i].t) / LIFE;
        ageA.setX(b, ag);
        ageA.setX(b + 1, ag);
      }
    }
    live.current = true;
    pos.needsUpdate = true;
    ageA.needsUpdate = true;
    geo.computeBoundingSphere();
  });
  return <mesh geometry={geo} material={mat} frustumCulled={false} renderOrder={5} />;
}
