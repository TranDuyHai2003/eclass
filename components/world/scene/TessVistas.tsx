"use client";
/**
 * Hero vistas seen through the Tesseract Booth's great window (60–90 m away, huge, HDR for bloom).
 * All are mounted ALL the time and only toggle `visible` → travelling never compiles a shader (TESSERACT_BOOTH §10).
 *  - Event Horizon: analytic black-hole billboard — shadow, photon ring, Doppler-beamed accretion disk, lensed far side
 *  - Lorenz Storm: 14 000-point RK4 trajectory, colour by speed, comet heads racing along it
 *  - Hyperbolic Sky: {7,3} tiling of the Poincaré disk by reflection folding, drifting under a Möbius translation
 *  - Tesseract Space: a 15 m tesseract with tube edges, rotating in the xw and yz planes (perspective from 4-D)
 */
import { useEffect, useLayoutEffect, useMemo, useRef } from "react";
import { useFrame } from "@react-three/fiber";
import * as THREE from "three";
import type { Dest } from "./boothState";

const T = { value: 0 };

export function BlackHoleVista() {
  const mat = useMemo(
    () =>
      new THREE.ShaderMaterial({
        uniforms: { uT: T },
        vertexShader: "varying vec2 vUv; void main(){ vUv = uv; gl_Position = projectionMatrix * modelViewMatrix * vec4(position,1.0); }",
        fragmentShader: `uniform float uT; varying vec2 vUv;
          float h(vec2 p){ return fract(sin(dot(p, vec2(127.1, 311.7))) * 43758.5453); }
          float n2(vec2 p){ vec2 i = floor(p), f = fract(p); f = f*f*(3.0-2.0*f);
            return mix(mix(h(i), h(i+vec2(1,0)), f.x), mix(h(i+vec2(0,1)), h(i+vec2(1,1)), f.x), f.y); }
          vec3 diskCol(float rd, float ang, float side){
            // vật chất xoáy (nhiễu theo góc − thời gian), nóng ở trong, Doppler: phía lao tới sáng + xanh hơn
            float swirl = n2(vec2(ang * 3.0 - uT * 0.6 / rd, rd * 3.0)) * 0.6 + n2(vec2(ang * 9.0 - uT * 1.4 / rd, rd * 9.0)) * 0.4;
            float temp = smoothstep(4.6, 1.4, rd);
            vec3 c = mix(vec3(1.0, 0.35, 0.08), vec3(1.0, 0.85, 0.55), temp);
            c = mix(c, vec3(0.75, 0.85, 1.0), smoothstep(0.75, 1.0, temp));
            float dop = 1.0 + 0.75 * side;
            c *= dop * mix(vec3(1.0, 0.85, 0.7), vec3(0.8, 0.9, 1.2), max(side, 0.0));
            float edge = smoothstep(1.35, 1.6, rd) * (1.0 - smoothstep(3.6, 4.8, rd));
            return c * edge * (0.45 + 0.9 * swirl) * 2.2;
          }
          void main(){
            vec2 p = (vUv - 0.5) * 2.0 * 5.0;
            float r = length(p);
            float incl = 0.16;                               // đĩa gần như nằm ngang theo hướng nhìn
            vec3 col = vec3(0.0); float a = 0.0;
            // phía xa của đĩa bị bẻ cong thành vòm phía trên (và một vệt mờ phía dưới) quanh vùng tối
            float rl = r; float lensBand = smoothstep(1.05, 1.25, rl) * (1.0 - smoothstep(1.7, 2.6, rl));
            float upper = smoothstep(-0.2, 0.6, p.y / max(r, 0.001));
            vec3 lens = diskCol(1.5 + (rl - 1.05) * 2.2, atan(p.y, p.x), p.x / max(r, 0.001) * -0.6) * lensBand * (0.35 + 0.9 * upper);
            col += lens; a = max(a, length(lens));
            // bóng tối (shadow) + vành photon
            float shadow = smoothstep(1.02, 0.98, r);
            float ring = exp(-pow((r - 1.04) * 30.0, 2.0)) * 2.8;
            col = mix(col, vec3(0.0), shadow);
            col += vec3(1.0, 0.82, 0.6) * ring;
            // mặt trước của đĩa (elip) đè lên bóng tối
            vec2 q = vec2(p.x, p.y / incl);
            float rd = length(q);
            float front = step(p.y, 0.0) + step(0.0, p.y) * smoothstep(1.0, 1.25, r);
            vec3 dc = diskCol(rd, atan(q.y, q.x), p.x / max(rd, 0.001) * -1.0) * front;
            col = col + dc;
            float alpha = clamp(max(max(a, length(dc)), max(shadow, ring)) * 1.5, 0.0, 1.0);
            // quầng mờ
            col += vec3(1.0, 0.6, 0.3) * exp(-r * 0.9) * 0.18;
            gl_FragColor = vec4(col, alpha);
          }`,
        transparent: true,
        depthWrite: false,
        toneMapped: false,
      }),
    [],
  );
  useEffect(() => () => mat.dispose(), [mat]);
  return (
    <mesh material={mat}>
      <planeGeometry args={[70, 70]} />
    </mesh>
  );
}

export function LorenzVista() {
  const { geo, mat } = useMemo(() => {
    const N = 14000;
    const pos = new Float32Array(N * 3);
    const spd = new Float32Array(N);
    const idx = new Float32Array(N);
    let x = 0.1;
    let y = 0;
    let z = 0;
    const f = (a: number, b: number, c: number) => [10 * (b - a), a * (28 - c) - b, a * b - (8 / 3) * c];
    const dt = 0.006;
    for (let i = 0; i < N + 300; i++) {
      const k1 = f(x, y, z);
      const k2 = f(x + (dt / 2) * k1[0], y + (dt / 2) * k1[1], z + (dt / 2) * k1[2]);
      const k3 = f(x + (dt / 2) * k2[0], y + (dt / 2) * k2[1], z + (dt / 2) * k2[2]);
      const k4 = f(x + dt * k3[0], y + dt * k3[1], z + dt * k3[2]);
      const vx = (k1[0] + 2 * k2[0] + 2 * k3[0] + k4[0]) / 6;
      const vy = (k1[1] + 2 * k2[1] + 2 * k3[1] + k4[1]) / 6;
      const vz = (k1[2] + 2 * k2[2] + 2 * k3[2] + k4[2]) / 6;
      x += dt * vx;
      y += dt * vy;
      z += dt * vz;
      if (i >= 300) {
        const j = i - 300;
        pos.set([x * 0.9, (z - 25) * 0.9, y * 0.9], j * 3);
        spd[j] = Math.min(1, Math.hypot(vx, vy, vz) / 160);
        idx[j] = j / N;
      }
    }
    const geo = new THREE.BufferGeometry();
    geo.setAttribute("position", new THREE.BufferAttribute(pos, 3));
    geo.setAttribute("aSpd", new THREE.BufferAttribute(spd, 1));
    geo.setAttribute("aIdx", new THREE.BufferAttribute(idx, 1));
    const mat = new THREE.ShaderMaterial({
      uniforms: { uT: T },
      vertexShader: "attribute float aSpd; attribute float aIdx; varying float vS; varying float vI; void main(){ vS = aSpd; vI = aIdx; gl_Position = projectionMatrix * modelViewMatrix * vec4(position,1.0); }",
      fragmentShader: `uniform float uT; varying float vS; varying float vI;
        void main(){
          vec3 slow = vec3(0.35, 0.3, 1.0), fast = vec3(1.0, 0.35, 0.75), hot = vec3(1.0, 0.9, 0.6);
          vec3 c = mix(slow, fast, vS);
          // 4 đầu sao chổi chạy dọc quỹ đạo
          float head = 0.0;
          for (int k = 0; k < 4; k++) {
            float hp = fract(uT * 0.018 + float(k) * 0.25);
            float d = fract(hp - vI);
            head += exp(-d * 260.0);
          }
          gl_FragColor = vec4(c * 0.55 + hot * head * 3.5, 1.0);
        }`,
      transparent: true,
      depthWrite: false,
      blending: THREE.AdditiveBlending,
      toneMapped: false,
    });
    return { geo, mat };
  }, []);
  useEffect(() => () => [geo, mat].forEach((o) => o.dispose()), [geo, mat]);
  const g = useRef<THREE.Group>(null);
  useFrame((_, dt) => {
    if (g.current) g.current.rotation.y += dt * 0.06;
  });
  return (
    <group ref={g}>
      <line>
        <primitive object={geo} attach="geometry" />
        <primitive object={mat} attach="material" />
      </line>
    </group>
  );
}

export function PoincareVista() {
  const mat = useMemo(() => {
    const p = 7;
    const q = 3;
    const s = Math.sin(Math.PI / p);
    const cq = Math.cos(Math.PI / q);
    const x0 = 1 / Math.sqrt(1 - (s * s) / (cq * cq));
    const r = (x0 * s) / cq;
    return new THREE.ShaderMaterial({
      uniforms: { uT: T, uC: { value: x0 }, uR: { value: r } },
      vertexShader: "varying vec2 vUv; void main(){ vUv = uv; gl_Position = projectionMatrix * modelViewMatrix * vec4(position,1.0); }",
      fragmentShader: `uniform float uT; uniform float uC; uniform float uR; varying vec2 vUv;
        vec2 cmul(vec2 a, vec2 b){ return vec2(a.x*b.x - a.y*b.y, a.x*b.y + a.y*b.x); }
        vec2 cdiv(vec2 a, vec2 b){ return vec2(a.x*b.x + a.y*b.y, a.y*b.x - a.x*b.y) / dot(b, b); }
        void main(){
          vec2 z = (vUv - 0.5) * 2.0;
          float rr = length(z);
          if (rr > 1.0) discard;
          // tịnh tiến hyperbol (biến đổi Möbius bảo toàn đĩa) → các ô "trôi" ra biên và co lại vô hạn
          vec2 w = 0.42 * vec2(cos(uT * 0.13), sin(uT * 0.17));
          z = cdiv(z - w, vec2(1.0, 0.0) - cmul(vec2(w.x, -w.y), z));
          float PI = 3.14159265; float A = PI / 7.0;
          float flips = 0.0;
          for (int i = 0; i < 40; i++) {
            bool done = true;
            // gấp về hình quạt [0, 2π/7) bằng phép quay, rồi phản xạ qua đường phân giác
            float ang = atan(z.y, z.x);
            float sec = floor(ang / (2.0 * A));
            float rot = -sec * 2.0 * A;
            z = vec2(z.x * cos(rot) - z.y * sin(rot), z.x * sin(rot) + z.y * cos(rot));
            if (atan(z.y, z.x) > A) { float c2 = cos(2.0 * A), s2 = sin(2.0 * A); z = vec2(z.x * c2 + z.y * s2, z.x * s2 - z.y * c2); flips += 1.0; }
            if (z.y < 0.0) { z.y = -z.y; flips += 1.0; }
            vec2 d = z - vec2(uC, 0.0);
            float dd = dot(d, d);
            if (dd < uR * uR) { z = vec2(uC, 0.0) + d * (uR * uR / dd); flips += 1.0; done = false; }
            if (done) break;
          }
          // tô màu bàn cờ theo số lần phản xạ + đường biên tam giác
          float par = mod(flips, 2.0);
          float e1 = abs(z.y);
          float e2 = abs(sin(A) * z.x - cos(A) * z.y);
          float e3 = abs(length(z - vec2(uC, 0.0)) - uR);
          float e = min(min(e1, e2), e3);
          float shrink = 1.0 - rr * rr;
          float line = smoothstep(0.012 * shrink + 0.002, 0.0, e);
          vec3 a = vec3(0.12, 0.08, 0.35), b = vec3(0.04, 0.3, 0.45);
          vec3 col = mix(a, b, par) * (0.8 + 0.4 * shrink);
          col += vec3(1.0, 0.82, 0.45) * line * 2.2;
          col += vec3(0.3, 0.9, 1.0) * smoothstep(0.96, 1.0, rr) * 2.0;
          gl_FragColor = vec4(col, 1.0);
        }`,
      toneMapped: false,
    });
  }, []);
  useEffect(() => () => mat.dispose(), [mat]);
  return (
    <mesh material={mat}>
      <circleGeometry args={[19, 96]} />
    </mesh>
  );
}

export function TesseractVista() {
  const edges = useRef<THREE.InstancedMesh>(null);
  const nodes = useRef<THREE.InstancedMesh>(null);
  const res = useMemo(() => {
    const v4: number[][] = [];
    for (let i = 0; i < 16; i++) v4.push([i & 1 ? 1 : -1, i & 2 ? 1 : -1, i & 4 ? 1 : -1, i & 8 ? 1 : -1]);
    const e: [number, number][] = [];
    for (let i = 0; i < 16; i++) for (let b = 0; b < 4; b++) if (!(i & (1 << b))) e.push([i, i | (1 << b)]);
    const edgeGeo = new THREE.CylinderGeometry(1, 1, 1, 8, 1, true);
    const nodeGeo = new THREE.IcosahedronGeometry(1, 1);
    const edgeMat = new THREE.MeshBasicMaterial({ color: new THREE.Color("#ffffff"), toneMapped: false });
    const nodeMat = new THREE.MeshBasicMaterial({ color: new THREE.Color("#ffd27a").multiplyScalar(2.4), toneMapped: false });
    return { v4, e, edgeGeo, nodeGeo, edgeMat, nodeMat };
  }, []);
  useEffect(() => () => [res.edgeGeo, res.nodeGeo, res.edgeMat, res.nodeMat].forEach((o) => o.dispose()), [res]);
  // Tạo sẵn màu theo instance trước khi cảnh biên dịch sẵn (thêm instanceColor sau sẽ đổi khoá chương trình → khựng)
  useLayoutEffect(() => {
    const c = new THREE.Color("#39f3ff");
    for (let n = 0; n < res.e.length; n++) edges.current?.setColorAt(n, c);
    if (edges.current?.instanceColor) edges.current.instanceColor.needsUpdate = true;
  }, [res]);
  const tmp = useMemo(() => ({ m: new THREE.Matrix4(), q: new THREE.Quaternion(), s: new THREE.Vector3(), a: new THREE.Vector3(), b: new THREE.Vector3(), up: new THREE.Vector3(0, 1, 0), c: new THREE.Color(), cy: new THREE.Color("#39f3ff"), mg: new THREE.Color("#ff3fb4") }), []);
  useFrame(() => {
    const t = T.value;
    const a1 = t * 0.35;
    const a2 = t * 0.22;
    const P: THREE.Vector3[] = [];
    const W: number[] = [];
    for (const v of res.v4) {
      const x = v[0] * Math.cos(a1) - v[3] * Math.sin(a1);
      const w = v[0] * Math.sin(a1) + v[3] * Math.cos(a1);
      const y = v[1] * Math.cos(a2) - v[2] * Math.sin(a2);
      const z = v[1] * Math.sin(a2) + v[2] * Math.cos(a2);
      const f = 17 / (2.6 - w);
      P.push(new THREE.Vector3(x * f, y * f, z * f));
      W.push(w);
    }
    res.e.forEach(([i, j], n) => {
      tmp.a.copy(P[i]);
      tmp.b.copy(P[j]);
      const len = tmp.a.distanceTo(tmp.b);
      tmp.q.setFromUnitVectors(tmp.up, tmp.b.clone().sub(tmp.a).normalize());
      const r = 0.2 + 0.2 * ((W[i] + W[j]) / 2 + 1.5) / 3;
      tmp.m.compose(tmp.a.clone().add(tmp.b).multiplyScalar(0.5), tmp.q, tmp.s.set(r, len, r));
      edges.current?.setMatrixAt(n, tmp.m);
      tmp.c.copy(tmp.cy).lerp(tmp.mg, ((W[i] + W[j]) / 2 + 1.4) / 2.8).multiplyScalar(2.4);
      edges.current?.setColorAt(n, tmp.c);
    });
    P.forEach((p, i) => {
      const r = 0.6 + 0.45 * (W[i] + 1.4) / 2.8;
      tmp.m.compose(p, tmp.q.identity(), tmp.s.set(r, r, r));
      nodes.current?.setMatrixAt(i, tmp.m);
    });
    if (edges.current) {
      edges.current.instanceMatrix.needsUpdate = true;
      if (edges.current.instanceColor) edges.current.instanceColor.needsUpdate = true;
    }
    if (nodes.current) nodes.current.instanceMatrix.needsUpdate = true;
  });
  return (
    <group>
      <instancedMesh ref={edges} args={[res.edgeGeo, res.edgeMat, res.e.length]} frustumCulled={false} />
      <instancedMesh ref={nodes} args={[res.nodeGeo, res.nodeMat, 16]} frustumCulled={false} />
    </group>
  );
}

/** Tất cả cảnh đích (trừ Hệ Mặt Trời), chỉ hiện cái đang ở */
export function Vistas({ dest }: { dest: Dest }) {
  useFrame(() => {
    T.value = performance.now() / 1000;
  });
  return (
    <group>
      <group visible={dest === "blackhole"} position={[0, 2, 0]}>
        <BlackHoleVista />
      </group>
      <group visible={dest === "lorenz"} position={[0, 2.5, 0]}>
        <LorenzVista />
      </group>
      <group visible={dest === "poincare"} position={[0, 1.5, 0]}>
        <PoincareVista />
      </group>
      <group visible={dest === "tesseract"} position={[0, 3, 0]}>
        <TesseractVista />
      </group>
    </group>
  );
}

/** Đồng hồ chung cho các vista khi dùng ngoài Bốt (vd. Hư Không Nghịch Lý) */
export function VistaClock() {
  useFrame(() => {
    T.value = performance.now() / 1000;
  });
  return null;
}
