"use client";
/**
 * Chợ Xác Suất — hình TẠM (thủ tục) cho quầy hàng, người bán, cột chỉ đường. Mô hình thật làm trong Blender
 * (bảng node ở PLAN.md T19): khi có GLB, thay từng hàm ở đây bằng bản clone theo tên node, giữ nguyên toạ độ gốc.
 */
import { useMemo } from "react";
import * as THREE from "three";
import { GRADIENT } from "../../fx/shaders";
import { useGLTF } from "@react-three/drei";
import { Avatar } from "../../player/Avatar";
import { toonize } from "../../fx/glbToon";
import { worldAsset } from "@/lib/world/avatars";

const toonCache = new Map<string, THREE.MeshToonMaterial>();
export function toon(color: string): THREE.MeshToonMaterial {
  let m = toonCache.get(color);
  if (!m) {
    m = new THREE.MeshToonMaterial({ color, gradientMap: GRADIENT });
    toonCache.set(color, m);
  }
  return m;
}
const glowCache = new Map<string, THREE.MeshBasicMaterial>();
/** vật liệu phát sáng HDR (Bloom bắt) — tên `glow_*` trong Blender */
export function glow(color: string, k = 2.2): THREE.MeshBasicMaterial {
  const key = `${color}:${k}`;
  let m = glowCache.get(key);
  if (!m) {
    m = new THREE.MeshBasicMaterial({
      color: new THREE.Color(color).multiplyScalar(k),
      toneMapped: false,
    });
    glowCache.set(key, m);
  }
  return m;
}

/**
 * Quầy hàng: mặt quầy (gốc = giữa mép trước, sát đất), hai cột sau, mái vải sọc dốc về trước. Quay theo `yaw` (mặt trước = +z cục bộ).
 * Blender: `bz_stall` (rộng 2,4 × sâu 1,0 × cao quầy 1,0; mái tới 2,6 m) — vải mái `cloth_<màu>`.
 */
export const BAZAAR_GLB = worldAsset("bazaar/bazaar_props.glb");
useGLTF.preload(BAZAAR_GLB);
const nodeCache = new Map<string, THREE.Object3D>();
/** bản toon (dùng chung) của một node trong bazaar_props.glb — null nếu không có */
function useBazaarNode(scene: THREE.Object3D, name?: string): THREE.Object3D | null {
  return useMemo(() => {
    if (!name) return null;
    let base = nodeCache.get(name);
    if (!base) {
      const src = scene.getObjectByName(name);
      if (!src) return null;
      base = toonize(src);
      nodeCache.set(name, base);
    }
    return base.clone(true);
  }, [scene, name]);
}

export const BAZAAR_INST_GLB = worldAsset("bazaar/bazaar_inst.glb");
useGLTF.preload(BAZAAR_INST_GLB);
/** hình học (đã đưa về khung node, có màu đỉnh = màu Blender × GI nướng) của node instanced; null nếu thiếu */
export function instGeometry(scene: THREE.Object3D, name: string): THREE.BufferGeometry | null {
  const node = scene.getObjectByName(name);
  if (!node) return null;
  node.updateMatrixWorld(true);
  const inv = node.matrixWorld.clone().invert();
  let out: THREE.BufferGeometry | null = null;
  node.traverse((o) => {
    const m = o as THREE.Mesh;
    if (!out && m.isMesh) out = m.geometry.clone().applyMatrix4(inv.clone().multiply(m.matrixWorld));
  });
  return out;
}

export function Stall({
  node,
  position,
  yaw = 0,
  cloth = "#d9485f",
  cloth2 = "#f6e7c8",
  wood = "#8a5a3c",
  width = 2.4,
  roof = true,
}: {
  position: [number, number, number];
  yaw?: number;
  cloth?: string;
  cloth2?: string;
  wood?: string;
  width?: number;
  roof?: boolean;
  /** node Blender (bz_stall_wisp / _slime / _mimic) — có thì thay hình tạm */
  node?: string;
}) {
  const stripes = useMemo(() => Array.from({ length: 6 }, (_, i) => i), []);
  const glb = useGLTF(BAZAAR_GLB);
  const model = useBazaarNode(glb.scene, node);
  if (model)
    return (
      <group position={position} rotation-y={yaw}>
        <primitive object={model} />
      </group>
    );
  return (
    <group position={position} rotation-y={yaw}>
      <mesh material={toon(wood)} position={[0, 0.5, -0.5]}>
        <boxGeometry args={[width, 1.0, 1.0]} />
      </mesh>
      <mesh material={toon("#f3dfb5")} position={[0, 1.02, -0.5]}>
        <boxGeometry args={[width + 0.12, 0.06, 1.1]} />
      </mesh>
      {roof &&
        [-1, 1].map((s) => (
          <mesh
            key={s}
            material={toon(wood)}
            position={[(s * width) / 2 - s * 0.08, 1.35, -0.95]}
          >
            <cylinderGeometry args={[0.06, 0.06, 2.7, 6]} />
          </mesh>
        ))}
      {roof &&
        stripes.map((i) => (
          <mesh
            key={i}
            material={toon(i % 2 ? cloth2 : cloth)}
            position={[-width / 2 + (width / 6) * (i + 0.5), 2.55, -0.45]}
            rotation-x={-0.42}
          >
            <boxGeometry args={[width / 6, 0.04, 1.35]} />
          </mesh>
        ))}
    </group>
  );
}

/**
 * Người bán: nhân vật anime VRM (cùng bộ với NPC Quảng trường, đứng idle) khi có `vrm`; không thì hình nhân tạm
 * (thân chóp + đầu + mũ).
 */
export function Keeper({
  position,
  yaw = 0,
  body = "#5b4a8a",
  hat = "#ffd27a",
  hatKind = "cone",
  vrm,
}: {
  position: [number, number, number];
  yaw?: number;
  body?: string;
  hat?: string;
  hatKind?: "cone" | "brim";
  /** đường dẫn avatar (vd. "avatars/rougan.vrm") */
  vrm?: string;
}) {
  if (vrm)
    return (
      <group position={position} rotation-y={yaw}>
        <Avatar url={worldAsset(vrm)} pose="idle" npc />
      </group>
    );
  return (
    <group position={position} rotation-y={yaw}>
      <mesh material={toon(body)} position={[0, 0.6, 0]}>
        <coneGeometry args={[0.38, 1.2, 10]} />
      </mesh>
      <mesh material={toon("#f2d2b6")} position={[0, 1.36, 0]}>
        <sphereGeometry args={[0.22, 14, 10]} />
      </mesh>
      {hatKind === "cone" ? (
        <mesh material={toon(hat)} position={[0, 1.68, 0]}>
          <coneGeometry args={[0.22, 0.45, 10]} />
        </mesh>
      ) : (
        <group position={[0, 1.55, 0]}>
          <mesh material={toon(hat)}>
            <cylinderGeometry args={[0.36, 0.36, 0.03, 16]} />
          </mesh>
          <mesh material={toon(hat)} position={[0, 0.12, 0]}>
            <cylinderGeometry args={[0.16, 0.19, 0.24, 12]} />
          </mesh>
        </group>
      )}
      {/* mắt */}
      {[-1, 1].map((s) => (
        <mesh
          key={s}
          material={toon("#1d1830")}
          position={[s * 0.075, 1.39, 0.2]}
        >
          <sphereGeometry args={[0.03, 6, 6]} />
        </mesh>
      ))}
    </group>
  );
}

/** Cột chỉ đường: trụ gỗ + tấm biển. Blender: `bz_sign` (cao 2,4 m, biển 1,4 × 0,5). */
export function SignPost({
  position,
  yaw = 0,
  board = "#3b2d6a",
}: {
  position: [number, number, number];
  yaw?: number;
  board?: string;
}) {
  const glb = useGLTF(BAZAAR_GLB);
  const model = useBazaarNode(glb.scene, "bz_sign");
  if (model)
    return (
      <group position={position} rotation-y={yaw}>
        <primitive object={model} />
      </group>
    );
  return (
    <group position={position} rotation-y={yaw}>
      <mesh material={toon("#7a5236")} position={[0, 1.2, 0]}>
        <cylinderGeometry args={[0.07, 0.08, 2.4, 6]} />
      </mesh>
      <mesh material={toon(board)} position={[0, 2.0, 0.08]}>
        <boxGeometry args={[1.4, 0.5, 0.06]} />
      </mesh>
      <mesh material={glow("#ffd27a", 1.6)} position={[0, 2.0, 0.115]}>
        <boxGeometry args={[1.3, 0.04, 0.01]} />
      </mesh>
    </group>
  );
}
