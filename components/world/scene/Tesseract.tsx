"use client";
/**
 * The Tesseract Booth — bigger on the inside. A domed console room floating in a mathematical universe:
 *  - hexagonal console (Blender) with a time rotor: nested polyhedra + a rotating 4-D tesseract projection that
 *    pumps up and down (faster while travelling)
 *  - golden-ratio roundel walls, star-map dome, a huge circular viewport open to the outside universe
 *  - travel: choose a destination at the console → the room shakes, lights flicker, stars stretch into warp
 *    streaks, then the viewport shows the new universe (Solar System with Kepler orbits, Black Hole, Lorenz Storm,
 *    Hyperbolic Sky, Tesseract Space).
 */
import { useEffect, useMemo, useRef } from "react";
import { useFrame } from "@react-three/fiber";
import * as THREE from "three";
import { useWorld } from "../store";
import { sfx } from "@/lib/world/sfx";
import { Vistas } from "./TessVistas";
import { IRIS, TRAVEL_MS, useBooth } from "./boothState";
import { TR } from "@/lib/world/tessRoom";

export { DESTS, TRAVEL_MS, travelTo, useBooth } from "./boothState";
export type { Dest } from "./boothState";

// ───────────── Vũ trụ bên ngoài (nhìn qua cửa sổ) ─────────────

const PLANETS = [
  { a: 9, r: 0.5, c: "#c9b8a6" },
  { a: 13, r: 0.8, c: "#f0c48a" },
  { a: 18, r: 0.85, c: "#6fb6ff" },
  { a: 23, r: 0.6, c: "#e0704a" },
  { a: 33, r: 2.0, c: "#e8c49a" },
  { a: 43, r: 1.7, c: "#f2dca0", ring: true },
  { a: 52, r: 1.2, c: "#9fe6ff" },
  { a: 60, r: 1.15, c: "#4b6dff" },
];

/** Hành tinh cel 2 dải + viền khí quyển, chiếu bởi Mặt Trời (uniform) — không dùng đèn three nên không làm cả cảnh biên dịch lại */
function planetMaterial(color: string, sun: { value: THREE.Vector3 }) {
  return new THREE.ShaderMaterial({
    uniforms: { uC: { value: new THREE.Color(color) }, uSun: sun },
    vertexShader: `uniform vec3 uSun; varying vec3 vN; varying vec3 vL; varying vec3 vV; varying float vY;
      void main(){
        vec4 wp = modelMatrix * vec4(position, 1.0);
        vN = normalize(mat3(modelMatrix) * normal);
        vL = normalize(uSun - wp.xyz);
        vV = normalize(cameraPosition - wp.xyz);
        vY = normal.y;
        gl_Position = projectionMatrix * viewMatrix * wp;
      }`,
    fragmentShader: `uniform vec3 uC; varying vec3 vN; varying vec3 vL; varying vec3 vV; varying float vY;
      void main(){
        float d = dot(normalize(vN), vL);
        float lit = smoothstep(-0.05, 0.05, d);
        vec3 shade = uC * vec3(0.22, 0.24, 0.42);
        vec3 c = mix(shade, uC * (1.0 + 0.15 * sin(vY * 14.0)), lit);
        float rim = pow(1.0 - max(dot(normalize(vN), vV), 0.0), 3.0);
        c += mix(vec3(0.35, 0.5, 1.0), vec3(1.0, 0.85, 0.6), lit) * rim * 0.8;
        gl_FragColor = vec4(c, 1.0);
      }`,
  });
}

function SolarSystem() {
  const refs = useRef<(THREE.Mesh | null)[]>([]);
  const sun = useMemo(
    () =>
      new THREE.ShaderMaterial({
        uniforms: { uT: { value: 0 } },
        vertexShader: "varying vec3 vN; varying vec3 vP; void main(){ vN = normalize(normalMatrix * normal); vP = position; gl_Position = projectionMatrix * modelViewMatrix * vec4(position,1.0); }",
        fragmentShader: `uniform float uT; varying vec3 vN; varying vec3 vP;
          void main(){
            float n = sin(vP.x * 1.7 + uT) * sin(vP.y * 2.1 - uT * 0.7) * sin(vP.z * 1.3 + uT * 0.5);
            float rim = pow(1.0 - abs(vN.z), 2.0);
            vec3 c = mix(vec3(1.0, 0.75, 0.3), vec3(1.0, 0.95, 0.7), 0.5 + 0.5 * n) * 2.4 + vec3(1.0, 0.5, 0.2) * rim * 2.0;
            gl_FragColor = vec4(c, 1.0);
          }`,
        toneMapped: false,
      }),
    [],
  );
  const sunPos = useMemo(() => ({ value: new THREE.Vector3() }), []);
  const root = useRef<THREE.Group>(null);
  const planetMats = useMemo(() => PLANETS.map((p) => planetMaterial(p.c, sunPos)), [sunPos]);
  const orbitMat = useMemo(() => new THREE.LineBasicMaterial({ color: "#8fa6d8", transparent: true, opacity: 0.35 }), []);
  const orbitGeos = useMemo(
    () =>
      PLANETS.map((p) => {
        const pts: THREE.Vector3[] = [];
        for (let i = 0; i <= 96; i++) {
          const t = (i / 96) * Math.PI * 2;
          pts.push(new THREE.Vector3(Math.cos(t) * p.a, 0, Math.sin(t) * p.a * 0.96));
        }
        return new THREE.BufferGeometry().setFromPoints(pts);
      }),
    [],
  );
  useEffect(() => () => [sun, orbitMat, ...orbitGeos, ...planetMats].forEach((x) => x.dispose()), [sun, orbitMat, orbitGeos, planetMats]);
  useFrame(() => {
    const t = performance.now() / 1000;
    sun.uniforms.uT.value = t;
    root.current?.getWorldPosition(sunPos.value);
    PLANETS.forEach((p, i) => {
      const m = refs.current[i];
      if (!m) return;
      // Kepler III: chu kỳ T ∝ a^1,5 → vận tốc góc ∝ a^−1,5
      const w = 6 * Math.pow(p.a, -1.5);
      const th = t * w + i * 1.7;
      m.position.set(Math.cos(th) * p.a, 0, Math.sin(th) * p.a * 0.96);
      m.rotation.y = t * 0.6;
    });
  });
  return (
    <group ref={root} rotation-x={0.42}>
      <mesh material={sun}>
        <sphereGeometry args={[5, 48, 32]} />
      </mesh>
      {PLANETS.map((p, i) => (
        <group key={i}>
          <lineLoop geometry={orbitGeos[i]} material={orbitMat} />
          <mesh ref={(el) => void (refs.current[i] = el)}>
            <sphereGeometry args={[p.r, 24, 16]} />
            <primitive object={planetMats[i]} attach="material" />
            {p.ring && (
              <mesh rotation-x={Math.PI / 2.4}>
                <ringGeometry args={[p.r * 1.4, p.r * 2.3, 48]} />
                <meshBasicMaterial color="#e8d6a8" side={THREE.DoubleSide} transparent opacity={0.8} />
              </mesh>
            )}
          </mesh>
        </group>
      ))}
    </group>
  );
}

/** Bầu trời tinh vân phía sau mọi đích đến: fbm nhiều lớp (tím / lam ngọc / hồng kiểu Madoka–HSR), dải ngân hà, sao lấp lánh */
function nebulaMaterial() {
  return new THREE.ShaderMaterial({
    uniforms: { uT: { value: 0 }, uHue: { value: 0 } },
    vertexShader: "varying vec3 vD; void main(){ vD = normalize(position); gl_Position = projectionMatrix * modelViewMatrix * vec4(position,1.0); }",
    fragmentShader: `uniform float uT; uniform float uHue; varying vec3 vD;
      float h3(vec3 p){ return fract(sin(dot(p, vec3(127.1, 311.7, 74.7))) * 43758.5453); }
      float n3(vec3 p){ vec3 i = floor(p); vec3 f = fract(p); f = f*f*(3.0-2.0*f);
        return mix(mix(mix(h3(i), h3(i+vec3(1,0,0)), f.x), mix(h3(i+vec3(0,1,0)), h3(i+vec3(1,1,0)), f.x), f.y),
                   mix(mix(h3(i+vec3(0,0,1)), h3(i+vec3(1,0,1)), f.x), mix(h3(i+vec3(0,1,1)), h3(i+vec3(1,1,1)), f.x), f.y), f.z); }
      float fbm(vec3 p){ float a = 0.5, s = 0.0; for (int i = 0; i < 5; i++){ s += a * n3(p); p *= 2.03; a *= 0.5; } return s; }
      void main(){
        vec3 d = normalize(vD);
        float band = exp(-pow(dot(d, normalize(vec3(0.25, 1.0, 0.15))) * 3.2, 2.0));
        float n = fbm(d * 3.0 + vec3(0.0, 0.0, uT * 0.004));
        float n2 = fbm(d * 7.0 - vec3(uT * 0.003));
        vec3 vio = vec3(0.32, 0.12, 0.55), teal = vec3(0.05, 0.42, 0.55), rose = vec3(0.75, 0.2, 0.45);
        vec3 neb = mix(vio, teal, smoothstep(0.35, 0.7, n));
        neb = mix(neb, rose, smoothstep(0.55, 0.8, n2) * 0.7);
        neb = mix(neb, neb.gbr, uHue);
        float dens = smoothstep(0.38, 0.85, n * (0.6 + band)) * (0.25 + band * 0.9);
        vec3 c = vec3(0.01, 0.01, 0.03) + neb * dens * 0.9;
        // sao: lưới góc cầu, kích thước nhỏ, lấp lánh
        vec3 q = d * 220.0; vec3 cell = floor(q); vec3 f = fract(q) - 0.5;
        float r = h3(cell);
        float star = step(0.985 - band * 0.012, r) * smoothstep(0.32, 0.0, length(f)) * (0.6 + 0.4 * sin(uT * (1.0 + r * 3.0) + r * 40.0));
        c += vec3(1.0, 0.95, 0.88) * star * (1.2 + band);
        gl_FragColor = vec4(c, 1.0);
      }`,
    side: THREE.BackSide,
    depthWrite: false,
    toneMapped: false,
  });
}

/** Nền sao + đích đến; khi du hành: sao kéo thành vệt (warp) */
export function Universe({ cx, cz }: { cx: number; cz: number }) {
  const dest = useBooth((s) => s.dest);
  const stars = useRef<THREE.Points>(null);
  const content = useRef<THREE.Group>(null);
  const starGeo = useMemo(() => {
    const n = 1400;
    const arr = new Float32Array(n * 3);
    let seed = 7;
    const rnd = () => ((seed = (seed * 16807) % 2147483647) / 2147483647);
    for (let i = 0; i < n; i++) {
      const u = rnd() * 2 - 1;
      const th = rnd() * Math.PI * 2;
      const r = 260 + rnd() * 80;
      const s = Math.sqrt(1 - u * u);
      arr.set([s * Math.cos(th) * r, u * r, s * Math.sin(th) * r], i * 3);
    }
    return new THREE.BufferGeometry().setAttribute("position", new THREE.BufferAttribute(arr, 3));
  }, []);
  const starMat = useMemo(() => new THREE.PointsMaterial({ color: new THREE.Color("#ffffff").multiplyScalar(1.6), size: 2.2, sizeAttenuation: false, toneMapped: false, fog: false }), []);
  const nebula = useMemo(() => nebulaMaterial(), []);
  useEffect(() => () => [starGeo, starMat, nebula].forEach((x) => x.dispose()), [starGeo, starMat, nebula]);
  useFrame(() => {
    const b = useBooth.getState();
    const now = performance.now();
    const w = useWorld.getState();
    if (b.to) {
      const k = (now - b.travelAt) / TRAVEL_MS;
      // "The Fold": rung tăng dần, sao kéo thành vệt warp; đổi vũ trụ khi cửa chớp đóng kín
      w.addShake(k < 0.08 ? 0.1 : k > IRIS.shutAt && k < IRIS.openAt ? 0.16 : 0.03 + 0.05 * Math.sin(Math.min(1, k) * Math.PI));
      const stretch = 1 + 22 * Math.sin(Math.min(1, k) * Math.PI);
      if (stars.current) stars.current.scale.set(1, 1, stretch);
      if (k > (IRIS.shutAt + IRIS.openAt) / 2 && b.dest !== b.to) useBooth.setState({ dest: b.to });
      if (k >= 1) {
        useBooth.setState({ to: null });
        sfx.shatter();
        w.addShake(0.35);
      }
    } else if (stars.current) stars.current.scale.set(1, 1, 1);
    if (content.current) content.current.rotation.y += 0.0004;
    nebula.uniforms.uT.value = now / 1000;
    const hues: Record<string, number> = { solar: 0, blackhole: 0.15, lorenz: 0.55, poincare: 0.8, tesseract: 0.35 };
    nebula.uniforms.uHue.value += ((hues[useBooth.getState().dest] ?? 0) - nebula.uniforms.uHue.value) * 0.02;
  });
  return (
    <group position={[cx, TR.WIN.y, cz - TR.R - 62]}>
      <mesh material={nebula} renderOrder={1}>
        <sphereGeometry args={[400, 48, 24]} />
      </mesh>
      <points ref={stars} geometry={starGeo} material={starMat} />
      <group ref={content}>
        {/* Mọi đích luôn được gắn, chỉ bật/tắt hiển thị → du hành không biên dịch shader */}
        <group visible={dest === "solar"}>
          <SolarSystem />
        </group>
        <Vistas dest={dest} />
      </group>
    </group>
  );
}
