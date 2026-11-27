"use client";
/**
 * Blender-made props (public/world/props/props.glb), cel-shaded via toonize():
 * - <Ouroboros>: the serpent eating its tail along a 3D lemniscate (∞), floating and slowly turning.
 * - <Sunflowers>: golden-angle (137.5°) seed spirals. They sway in the wind, turn their heads toward the
 *   player (heliotropism) and spring-bounce when brushed past (damped spring: x'' = −k·x − c·x').
 */
import { useEffect, useMemo, useRef } from "react";
import { useFrame } from "@react-three/fiber";
import { useGLTF } from "@react-three/drei";
import * as THREE from "three";
import { useWorld } from "../store";
import { toonize } from "../fx/glbToon";
import { updrafts } from "../combat/combat";
import { worldAsset } from "@/lib/world/avatars";

const PROPS_GLB = worldAsset("props/props.glb");
useGLTF.preload(PROPS_GLB);

function useProp(name: string) {
  const gltf = useGLTF(PROPS_GLB);
  const base = useMemo(() => {
    const src = gltf.scene.getObjectByName(name);
    return src ? toonize(src) : null;
  }, [gltf, name]);
  return base;
}

export function Ouroboros({ position, scale = 1 }: { position: [number, number, number]; scale?: number }) {
  const base = useProp("p_ouroboros");
  const obj = useMemo(() => base?.clone(true) ?? null, [base]);
  const g = useRef<THREE.Group>(null);
  useFrame(() => {
    if (!g.current) return;
    const t = performance.now() / 1000;
    g.current.rotation.y = t * 0.25;
    g.current.position.y = position[1] + Math.sin(t * 0.9) * 0.25;
    g.current.rotation.z = Math.sin(t * 0.5) * 0.12;
  });
  if (!obj) return null;
  return (
    <group ref={g} position={position} scale={scale}>
      <primitive object={obj} />
    </group>
  );
}

interface Spring {
  x: number;
  v: number;
  near: boolean;
}

export function Sunflowers({ spots, ground = () => 0 }: { spots: [number, number][]; ground?: (x: number, z: number) => number }) {
  const base = useProp("p_sunflower");
  const quality = useWorld((s) => s.quality);
  const list = useMemo(() => spots.slice(0, quality === "low" ? Math.ceil(spots.length / 2) : spots.length), [spots, quality]);
  const objs = useMemo(() => (base ? list.map(() => base.clone(true)) : []), [base, list]);
  const groups = useRef<(THREE.Group | null)[]>([]);
  const springs = useRef<Spring[]>([]);
  useFrame((_, rawDt) => {
    const dt = Math.min(0.05, rawDt);
    const t = performance.now() / 1000;
    const p = useWorld.getState().player;
    list.forEach(([x, z], i) => {
      const g = groups.current[i];
      if (!g) return;
      const sp = (springs.current[i] ??= { x: 0, v: 0, near: false });
      const dx = p.x - x;
      const dz = p.z - z;
      const d = Math.hypot(dx, dz);
      // Đi ngang qua → đẩy lò xo một cú (nảy lên rồi rung tắt dần)
      const near = d < 1.4;
      if (near && !sp.near) sp.v += 3.2;
      sp.near = near;
      sp.v += (-60 * sp.x - 7 * sp.v) * dt;
      sp.x += sp.v * dt;
      // Co giãn giữ thể tích: cao lên thì gầy đi
      const sy = 1 + sp.x * 0.35;
      const sxz = 1 / Math.sqrt(Math.max(0.5, sy));
      g.scale.set(sxz, sy, sxz);
      // Quay mặt hoa về phía người chơi (hướng dương) khi lại gần, không thì đón gió
      const want = d < 9 ? Math.atan2(dx, dz) : 0.4 * Math.sin(t * 0.2 + i);
      let da = want - g.rotation.y;
      da = Math.atan2(Math.sin(da), Math.cos(da));
      g.rotation.y += da * Math.min(1, dt * 2.5);
      // Lắc theo gió + giật khi bị chạm
      g.rotation.z = Math.sin(t * 1.6 + i * 1.7) * 0.05 + sp.v * 0.03;
      g.position.set(x, ground(x, z), z);
    });
  });
  return (
    <>
      {objs.map((o, i) => (
        <group key={i} ref={(el) => void (groups.current[i] = el)} scale={1.1}>
          <primitive object={o} />
        </group>
      ))}
    </>
  );
}

const GLIDER_GLB = worldAsset("fx/glider.glb");
useGLTF.preload(GLIDER_GLB);
/** Tàu lượn origami (cánh giấy tam giác, gân vàng, xoắn ốc vàng phát sáng) — mô hình Blender */
export function GliderModel() {
  const gltf = useGLTF(GLIDER_GLB);
  const obj = useMemo(() => {
    const src = gltf.scene.getObjectByName("glider");
    return src ? toonize(src) : null;
  }, [gltf]);
  return obj ? <primitive object={obj} /> : null;
}

/** Cột gió: ống sáng có vệt chạy lên + đăng ký vào vật lý lượn */
export function Updrafts({ list }: { list: { x: number; z: number; r: number; top: number; y?: number }[] }) {
  const mat = useMemo(
    () =>
      new THREE.ShaderMaterial({
        uniforms: { uTime: { value: 0 } },
        vertexShader: "varying vec2 vUv; void main(){ vUv = uv; gl_Position = projectionMatrix * modelViewMatrix * vec4(position,1.0); }",
        fragmentShader: `uniform float uTime; varying vec2 vUv;
          void main(){
            float streak = step(0.82, fract(vUv.x * 9.0 + sin(vUv.y * 6.0 + uTime) * 0.08)) * step(0.4, fract(vUv.y * 3.0 - uTime * 1.6));
            float fade = smoothstep(0.0, 0.15, vUv.y) * (1.0 - smoothstep(0.7, 1.0, vUv.y));
            gl_FragColor = vec4(vec3(0.75, 0.95, 1.0) * 1.6, (0.08 + streak * 0.5) * fade);
          }`,
        transparent: true,
        depthWrite: false,
        side: THREE.DoubleSide,
        toneMapped: false,
      }),
    [],
  );
  useEffect(() => {
    for (const u of list) updrafts.push(u);
    return () => {
      for (const u of list) {
        const i = updrafts.indexOf(u);
        if (i >= 0) updrafts.splice(i, 1);
      }
    };
  }, [list]);
  useFrame((_, dt) => {
    mat.uniforms.uTime.value += dt;
  });
  return (
    <>
      {list.map((u, i) => (
        <mesh key={i} position={[u.x, (u.y ?? 0) + (u.top - (u.y ?? 0)) / 2, u.z]} material={mat}>
          <cylinderGeometry args={[u.r, u.r * 0.8, u.top - (u.y ?? 0), 20, 1, true]} />
        </mesh>
      ))}
    </>
  );
}
