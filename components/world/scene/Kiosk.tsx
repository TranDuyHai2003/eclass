"use client";
/**
 * Hyperkiosk — the Tesseract Booth exterior (TESSERACT_BOOTH.md §3): an original Victorian-cyber kiosk, not a police box.
 * Blender GLB `props/kiosk.glb` (AO baked into vertex colours → toon + soft contact shadows), plus live parts:
 *  - sliding door leaves that open as you approach (the doorway portal widens with them)
 *  - side windows with an INTERIOR-MAPPING shader: a ray-marched cyber hall ~30 m deep behind 1.2 m of glass
 *  - a floating 4-D tesseract lantern (rotating in the xw and yz planes, perspective-projected) + spinning halo
 *  - an additive neon light pool on the ground (fakes the kiosk lighting the court, no light object)
 */
import { useEffect, useMemo, useRef } from "react";
import { useFrame } from "@react-three/fiber";
import { useGLTF } from "@react-three/drei";
import * as THREE from "three";
import { worldAsset } from "@/lib/world/avatars";
import { toonize } from "../fx/glbToon";
import { useWorld } from "../store";
import { sfx } from "@/lib/world/sfx";

const KIOSK_GLB = worldAsset("props/kiosk.glb");
useGLTF.preload(KIOSK_GLB);
/** Độ mở cửa 0..1 (đọc bởi portal ở cửa) */
export const KIOSK = { open: 0 };

/** Cửa sổ "sâu vô hạn": tia từ mắt đi vào một sảnh hộp sau tấm kính, tô lưới neon + sương theo độ sâu */
function interiorMaterial() {
  return new THREE.ShaderMaterial({
    uniforms: { uT: { value: 0 } },
    vertexShader: `varying vec3 vWP; varying vec3 vN;
      void main(){ vec4 wp = modelMatrix * vec4(position, 1.0); vWP = wp.xyz; vN = normalize(mat3(modelMatrix) * normal); gl_Position = projectionMatrix * viewMatrix * wp; }`,
    fragmentShader: `uniform float uT; varying vec3 vWP; varying vec3 vN;
      void main(){
        vec3 n = normalize(vN);
        vec3 rd = normalize(vWP - cameraPosition);
        // hệ trục của mặt kính: u ngang, v đứng, w = vào trong
        vec3 w = -n; vec3 v = vec3(0.0, 1.0, 0.0); vec3 u = normalize(cross(v, w));
        vec3 d = vec3(dot(rd, u), dot(rd, v), dot(rd, w));
        // sảnh ảo: rộng 6, cao 5, sâu 30; điểm vào = vị trí trên kính (toạ độ cục bộ theo mặt)
        vec2 p0 = vec2(dot(vWP, u), vWP.y);
        vec2 c = vec2(floor(dot(vWP, u) / 1.2 + 0.5) * 1.2, 1.6);
        vec2 q = p0 - c;
        float tx = d.x > 0.0 ? (3.0 - q.x) / d.x : (-3.0 - q.x) / d.x;
        float ty = d.y > 0.0 ? (3.4 - q.y) / d.y : (-1.6 - q.y) / d.y;
        float tz = 30.0 / max(d.z, 1e-3);
        float t = min(min(tx, ty), tz);
        vec3 hit = vec3(q + d.xy * t, d.z * t);
        vec3 col;
        float fog = 1.0 - exp(-hit.z * 0.08);
        if (t == tz) {
          // tường cuối: cổng tròn phát sáng
          float r = length(hit.xy - vec2(0.0, 0.9));
          col = vec3(0.25, 0.9, 1.0) * (smoothstep(0.08, 0.0, abs(r - 1.2)) * 2.0 + 0.05) + vec3(1.0, 0.3, 0.7) * smoothstep(0.6, 0.0, r) * 0.6;
        } else {
          vec2 g = t == tx ? hit.yz : hit.xz;
          vec2 f = abs(fract(g * vec2(1.0, 0.5)) - 0.5);
          float grid = smoothstep(0.47, 0.5, max(f.x, f.y));
          float strip = smoothstep(0.02, 0.0, abs(fract(hit.z * 0.12 - uT * 0.25) - 0.5) - 0.46);
          vec3 base = t == ty && d.y < 0.0 ? vec3(0.06, 0.05, 0.14) : vec3(0.1, 0.07, 0.2);
          col = base + vec3(0.2, 0.85, 1.0) * grid * 0.9 + vec3(1.0, 0.35, 0.75) * strip * 0.7;
        }
        col = mix(col, vec3(0.12, 0.1, 0.3), fog * 0.7);
        // phản chiếu nhẹ trên kính (fresnel)
        float fr = pow(1.0 - abs(dot(-rd, n)), 3.0);
        col += vec3(0.6, 0.8, 1.0) * fr * 0.35;
        gl_FragColor = vec4(col * 1.25, 1.0);
      }`,
    toneMapped: false,
  });
}

function Lantern() {
  const g = useRef<THREE.Group>(null);
  const res = useMemo(() => {
    const v4: number[][] = [];
    for (let i = 0; i < 16; i++) v4.push([i & 1 ? 1 : -1, i & 2 ? 1 : -1, i & 4 ? 1 : -1, i & 8 ? 1 : -1]);
    const outer: [number, number][] = [];
    const inner: [number, number][] = [];
    const cross: [number, number][] = [];
    for (let i = 0; i < 16; i++)
      for (let b = 0; b < 4; b++)
        if (!(i & (1 << b))) {
          const j = i | (1 << b);
          if (b === 3) cross.push([i, j]);
          else if (i & 8) inner.push([i, j]);
          else outer.push([i, j]);
        }
    const mk = (e: [number, number][]) => {
      const geo = new THREE.BufferGeometry();
      geo.setAttribute("position", new THREE.BufferAttribute(new Float32Array(e.length * 6), 3));
      return geo;
    };
    const line = (hex: string, k: number) => new THREE.LineBasicMaterial({ color: new THREE.Color(hex).multiplyScalar(k), toneMapped: false });
    return { v4, sets: [outer, inner, cross], geos: [mk(outer), mk(inner), mk(cross)], mats: [line("#39f3ff", 2.6), line("#ff3fb4", 2.6), line("#ffd27a", 1.8)] };
  }, []);
  useEffect(() => () => [...res.geos, ...res.mats].forEach((x) => x.dispose()), [res]);
  useFrame(() => {
    const t = performance.now() / 1000;
    const a = t * 0.7;
    const c = Math.cos(a);
    const s = Math.sin(a);
    const c2 = Math.cos(a * 0.45);
    const s2 = Math.sin(a * 0.45);
    res.sets.forEach((set, k) => {
      const arr = res.geos[k].attributes.position.array as Float32Array;
      set.forEach(([i, j], n) => {
        for (const [vi, off] of [
          [i, n * 6],
          [j, n * 6 + 3],
        ] as const) {
          const v = res.v4[vi];
          const x = v[0] * c - v[3] * s;
          const w = v[0] * s + v[3] * c;
          const y = v[1] * c2 - v[2] * s2;
          const z = v[1] * s2 + v[2] * c2;
          const f = 0.62 / (3 - w);
          arr[off] = x * f;
          arr[off + 1] = y * f;
          arr[off + 2] = z * f;
        }
      });
      res.geos[k].attributes.position.needsUpdate = true;
    });
    if (g.current) {
      g.current.position.y = 3.95 + Math.sin(t * 1.3) * 0.06;
      g.current.rotation.y = t * 0.25;
    }
  });
  return (
    <group ref={g}>
      {res.geos.map((geo, k) => (
        <lineSegments key={k} geometry={geo} material={res.mats[k]} />
      ))}
    </group>
  );
}

function GroundPool() {
  const mat = useMemo(
    () =>
      new THREE.ShaderMaterial({
        uniforms: { uT: { value: 0 } },
        vertexShader: "varying vec2 vUv; void main(){ vUv = uv; gl_Position = projectionMatrix * modelViewMatrix * vec4(position,1.0); }",
        fragmentShader: `uniform float uT; varying vec2 vUv;
          void main(){
            vec2 p = (vUv - 0.5) * 2.0;
            float r = length(p);
            float pool = (1.0 - smoothstep(0.25, 1.0, r)) * 0.32;
            float door = (1.0 - smoothstep(0.0, 0.55, length(p - vec2(0.0, -0.62)))) * 0.45;
            float ring = smoothstep(0.012, 0.0, abs(r - 0.62 - 0.02 * sin(uT * 2.0))) * 0.5;
            vec3 c = vec3(0.22, 0.85, 1.0) * (pool + ring) + vec3(1.0, 0.3, 0.7) * door * 0.6;
            gl_FragColor = vec4(c, 1.0);
          }`,
        transparent: true,
        depthWrite: false,
        blending: THREE.AdditiveBlending,
        toneMapped: false,
      }),
    [],
  );
  useEffect(() => () => mat.dispose(), [mat]);
  useFrame(() => {
    mat.uniforms.uT.value = performance.now() / 1000;
  });
  return (
    <mesh material={mat} rotation-x={-Math.PI / 2} position-y={0.006} renderOrder={2}>
      <planeGeometry args={[5, 5]} />
    </mesh>
  );
}

/** Vỏ ngoài bốt tại (x, z); cửa quay về +z */
export function Kiosk({ x, z }: { x: number; z: number }) {
  const gltf = useGLTF(KIOSK_GLB);
  const glass = useMemo(() => interiorMaterial(), []);
  const { obj, doors, halo } = useMemo(() => {
    const root = new THREE.Group();
    gltf.scene.children.forEach((c) => {
      const o = toonize(c);
      o.name = c.name;
      o.position.copy(c.position);
      o.quaternion.copy(c.quaternion);
      root.add(o);
    });
    root.traverse((o) => {
      const m = o as THREE.Mesh;
      if (m.isMesh && m.name.startsWith("k_glass")) m.material = glass;
    });
    const find = (n: string) => root.children.find((c) => c.name === n || c.name.startsWith(n + "."));
    return { obj: root, doors: [find("k_door_L"), find("k_door_R")], halo: find("k_halo") };
  }, [gltf, glass]);
  useEffect(() => () => glass.dispose(), [glass]);
  const wasOpen = useRef(false);
  useFrame((_, dt) => {
    const p = useWorld.getState().player;
    // cửa ở mặt +z: mở khi người chơi đứng trước cửa trong 3,4 m (hoặc đang đi qua)
    const dz = p.z - (z + 1.1);
    const near = Math.abs(p.x - x) < 1.6 && dz > -1.2 && dz < 3.4;
    KIOSK.open += ((near ? 1 : 0) - KIOSK.open) * Math.min(1, dt * 5);
    if (near && !wasOpen.current) sfx.chime(2);
    wasOpen.current = near;
    const e = KIOSK.open * KIOSK.open * (3 - 2 * KIOSK.open);
    // Lá cửa thu vào hốc tường (co về mép ngoài) — không trượt lòi ra ngoài thân kiosk
    const sc = 1 - e * 0.96;
    if (doors[0]) {
      doors[0].scale.x = sc;
      doors[0].position.x = -0.75 * (1 - sc);
    }
    if (doors[1]) {
      doors[1].scale.x = sc;
      doors[1].position.x = 0.75 * (1 - sc);
    }
    if (halo) halo.rotation.y += dt * 0.6;
    glass.uniforms.uT.value = performance.now() / 1000;
  });
  return (
    <group position={[x, 0, z]}>
      <primitive object={obj} />
      <Lantern />
      <GroundPool />
    </group>
  );
}
