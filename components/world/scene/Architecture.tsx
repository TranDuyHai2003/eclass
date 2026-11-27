"use client";
/**
 * Procedural stylized architecture (no external assets): lathe-profiled columns with base/capital and gold rings,
 * a curved-eave pavilion roof, an arched gate with floating rune stones, an ornate mirror frame,
 * distant floating islands for depth, and blob contact shadows.
 */
import { useMemo } from "react";
import { Float, Outlines } from "@react-three/drei";
import * as THREE from "three";
import { toonMaterial } from "../fx/shaders";

const V = (x: number, y: number) => new THREE.Vector2(x, y);

/** Biên dạng cột: đế bậc → thân hơi thon có rãnh → cổ → mũ cột loe */
const COLUMN_PROFILE = [
  V(0, 0), V(0.42, 0), V(0.42, 0.12), V(0.36, 0.16), V(0.36, 0.26), V(0.3, 0.3),
  V(0.27, 0.34), V(0.25, 2.6), V(0.27, 2.66), V(0.27, 2.72), V(0.24, 2.76),
  V(0.34, 2.86), V(0.42, 2.98), V(0.44, 3.06), V(0, 3.06),
];

export function useArchMaterials() {
  return useMemo(
    () => ({
      marble: toonMaterial("#d6cbb8", { rim: "#fff3dc", rimPower: 3.5 }),
      marbleShade: toonMaterial("#b9aec9", { rim: "#f2eaff" }),
      gold: new THREE.MeshStandardMaterial({ color: "#f0c871", metalness: 0.9, roughness: 0.3, emissive: "#5a3a08", emissiveIntensity: 0.3 }),
      roof: toonMaterial("#5d6fd6", { rim: "#c9d2ff", rimPower: 2.5 }),
      roofEdge: toonMaterial("#2f3a86"),
      rune: toonMaterial("#7fe3ff", { rim: "#ffffff", emissive: "#1d7fb0" }),
      shadow: new THREE.MeshBasicMaterial({ color: "#1d2a22", transparent: true, opacity: 0.22, depthWrite: false }),
    }),
    [],
  );
}

export function Column({ position, height = 1, mats }: { position: [number, number, number]; height?: number; mats: ReturnType<typeof useArchMaterials> }) {
  const geo = useMemo(() => new THREE.LatheGeometry(COLUMN_PROFILE, 20), []);
  return (
    <group position={position} scale={[1, height, 1]}>
      <mesh geometry={geo} material={mats.marble}>
        <Outlines thickness={0.015} color="#6a5f78" />
      </mesh>
      {[0.3, 2.72].map((y) => (
        <mesh key={y} position={[0, y, 0]} rotation={[Math.PI / 2, 0, 0]} material={mats.gold}>
          <torusGeometry args={[0.285, 0.03, 8, 28]} />
        </mesh>
      ))}
    </group>
  );
}

export function BlobShadow({ r = 0.6, position = [0, 0.02, 0] as [number, number, number], mats }: { r?: number; position?: [number, number, number]; mats: ReturnType<typeof useArchMaterials> }) {
  return (
    <mesh rotation={[-Math.PI / 2, 0, 0]} position={position} material={mats.shadow}>
      <circleGeometry args={[r, 24]} />
    </mesh>
  );
}

/** Đình bát giác: nền 2 bậc, 8 cột, xà vàng, mái cong (lathe) có đầu mái vàng */
export function Pavilion({ mats }: { mats: ReturnType<typeof useArchMaterials> }) {
  const roofGeo = useMemo(() => {
    // Mái cong: loe ra ở mép (kiểu mái đình), 8 cạnh
    const pts: THREE.Vector2[] = [];
    for (let i = 0; i <= 16; i++) {
      const t = i / 16;
      const r = 3.2 * (1 - t) ** 1.6 + 0.12;
      const y = t * 2.1 + Math.sin(t * Math.PI) * 0.05 - (1 - t) ** 6 * 0.35;
      pts.push(V(r, y));
    }
    return new THREE.LatheGeometry(pts, 8);
  }, []);
  const cols = useMemo(() => Array.from({ length: 8 }, (_, i) => (i / 8) * Math.PI * 2 + Math.PI / 8), []);
  return (
    <group>
      {[2.9, 2.55].map((r, i) => (
        <mesh key={r} position={[0, 0.12 + i * 0.22, 0]} material={i ? mats.marble : mats.marbleShade}>
          <cylinderGeometry args={[r, r + 0.08, 0.24, 8]} />
          <Outlines thickness={0.02} color="#6a5f78" />
        </mesh>
      ))}
      {cols.map((a) => (
        <Column key={a} position={[Math.cos(a) * 2.2, 0.56, Math.sin(a) * 2.2]} height={0.95} mats={mats} />
      ))}
      <mesh position={[0, 3.5, 0]} rotation={[Math.PI / 2, 0, Math.PI / 8]} material={mats.gold}>
        <torusGeometry args={[2.3, 0.08, 6, 8]} />
      </mesh>
      <mesh geometry={roofGeo} position={[0, 3.45, 0]} material={mats.roof}>
        <Outlines thickness={0.03} color="#232a66" />
      </mesh>
      <mesh position={[0, 5.75, 0]} material={mats.gold}>
        <octahedronGeometry args={[0.28, 0]} />
      </mesh>
    </group>
  );
}

/** Cổng vòm: hai cột + vòm cung + đá rune lơ lửng quanh đỉnh */
export function ArchGate({ mats, color = "#7fe3ff" }: { mats: ReturnType<typeof useArchMaterials>; color?: string }) {
  const rune = useMemo(() => toonMaterial(color, { rim: "#ffffff", emissive: new THREE.Color(color).multiplyScalar(0.35) }), [color]);
  return (
    <group>
      <Column position={[-2.9, 0, 0]} height={1.65} mats={mats} />
      <Column position={[2.9, 0, 0]} height={1.65} mats={mats} />
      <mesh position={[0, 5.05, 0]} material={mats.marble}>
        <torusGeometry args={[2.9, 0.22, 10, 40, Math.PI]} />
        <Outlines thickness={0.02} color="#6a5f78" />
      </mesh>
      <mesh position={[0, 5.05, 0]} material={mats.gold}>
        <torusGeometry args={[2.9, 0.06, 6, 40, Math.PI]} />
      </mesh>
      {Array.from({ length: 5 }, (_, i) => {
        const a = (i / 4) * Math.PI;
        return (
          <Float key={i} speed={2 + i * 0.2} floatIntensity={0.6} rotationIntensity={0.8}>
            <mesh position={[Math.cos(a) * 3.6, 5.05 + Math.sin(a) * 3.6, 0]} material={rune} scale={0.22}>
              <octahedronGeometry args={[1, 0]} />
            </mesh>
          </Float>
        );
      })}
    </group>
  );
}

/** Đảo nổi xa (hậu cảnh) — chìm dần vào sương tạo chiều sâu */
export function DistantIslands() {
  const mats = useMemo(() => {
    const top = toonMaterial("#5c9e58", { rim: "#d9ffb0" });
    const rock = toonMaterial("#6f5f86", { rim: "#e6d8ff" });
    top.fog = false;
    rock.fog = false;
    return { top, rock };
  }, []);
  const isles = useMemo(
    () =>
      Array.from({ length: 9 }, (_, i) => {
        const a = (i / 9) * Math.PI * 2 + 0.4;
        const r = 70 + (i % 3) * 28;
        return { p: [Math.cos(a) * r, -6 + (i % 4) * 7, Math.sin(a) * r] as [number, number, number], s: 3 + (i % 4) * 2.2 };
      }),
    [],
  );
  return (
    <group>
      {isles.map((it, i) => (
        <Float key={i} speed={0.4} floatIntensity={2} rotationIntensity={0.05}>
          <group position={it.p} scale={it.s}>
            <mesh material={mats.top}>
              <cylinderGeometry args={[1.2, 1.1, 0.25, 9]} />
            </mesh>
            <mesh position={[0, -1.1, 0]} rotation={[Math.PI, 0, 0]} material={mats.rock}>
              <coneGeometry args={[1.1, 2, 7]} />
            </mesh>
          </group>
        </Float>
      ))}
    </group>
  );
}
