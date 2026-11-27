"use client";
/**
 * Con tàu của Theseus — dải phía bắc sân Sảnh Bất Khả (sau bốt): hai ụ khô nằm cạnh nhau theo trục x, mạn tàu quay về phía nam.
 * Ụ A: thuyền chiến Hy Lạp (`props/theseus.glb`, vỏ ghép từ 24 tấm ván RIÊNG, AO nướng vào màu đỉnh, toon).
 * Mỗi lần thay: tấm ván cũ bay vòng sang ụ B (được ráp dần thành con tàu thứ hai), tấm mới vàng óng hạ xuống ụ A.
 * Đủ 24 tấm: tàu B nhận nốt sống thuyền / boong / cột buồm cũ, tàu A khoác toàn đồ mới → hai con tàu, một cái tên.
 */
import { useEffect, useMemo, useRef } from "react";
import { useFrame } from "@react-three/fiber";
import { useGLTF } from "@react-three/drei";
import * as THREE from "three";
import { create } from "zustand";
import { worldAsset, AVATAR_BY_ID } from "@/lib/world/avatars";
import { N_PLANKS, replaceOrder } from "@/lib/world/theseus";
import { sfx } from "@/lib/world/sfx";
import { toonize } from "../fx/glbToon";
import { Avatar } from "../player/Avatar";
import { Label3D } from "../ui/Labels";

const GLB = worldAsset("props/theseus.glb");
useGLTF.preload(GLB);

export const DOCK_A = { x: -14, z: -15.2 };
export const DOCK_B = { x: -3.5, z: -15.2 };
export const WRIGHT = { x: -8.75, z: -12 };
/** Chỗ đứng xem cả hai ụ */
export const VIEW = { x: -8.75, z: -10 };
const FLY_MS = 1700;
const ORDER = replaceOrder();

export type Vote = "a" | "b" | "both" | "neither";
export const useTheseus = create<{ k: number; t0: number[]; vote: Vote | null; limit: number | null; done: number }>(() => ({
  k: 0,
  t0: Array(N_PLANKS).fill(-1),
  vote: null,
  limit: null,
  done: -1,
}));

export function replaceNext() {
  const s = useTheseus.getState();
  if (s.k >= N_PLANKS) return;
  const idx = ORDER[s.k];
  const t0 = [...s.t0];
  t0[idx] = performance.now();
  const k = s.k + 1;
  useTheseus.setState({ k, t0, done: k >= N_PLANKS ? performance.now() + FLY_MS : s.done });
  sfx.knock();
}
let batch: ReturnType<typeof setTimeout>[] = [];
export function replaceMany(n: number) {
  batch.forEach(clearTimeout);
  batch = Array.from({ length: n }, (_, i) => setTimeout(replaceNext, i * 320));
}
export function resetShip() {
  batch.forEach(clearTimeout);
  batch = [];
  useTheseus.setState({ k: 0, t0: Array(N_PLANKS).fill(-1), vote: null, limit: null, done: -1 });
}

const OLD = new THREE.Color("#8d7a66");
const NEW = new THREE.Color("#f2c58c");
const GLINT = new THREE.Color("#ffb347");
const isPlank = (n: string) => n.startsWith("th_plank_");
const plankIdx = (n: string) => parseInt(n.slice(9), 10);
/** bệ đá + giá đỡ luôn hiện ở cả hai ụ (lưới nhiều vật liệu được GLTFLoader tách thành "th_dock_1", "th_dock_2"…) */
const isStatic = (n: string) => n.startsWith("th_dock") || n.startsWith("th_cradle");

/** Màu ván cũ: phong hoá khác nhau từng tấm, dải gần đáy hơi rêu */
function oldColor(i: number) {
  const k = Math.floor((i % 12) / 2);
  const h = ((i * 7919) % 97) / 97;
  const c = OLD.clone().offsetHSL((h - 0.5) * 0.03, (h - 0.5) * 0.08, (h - 0.5) * 0.08);
  if (k < 2) c.lerp(new THREE.Color("#6f7a58"), 0.35);
  return c;
}

function useShip() {
  const gltf = useGLTF(GLB);
  return useMemo(() => {
    const build = () => {
      const root = toonize(gltf.scene);
      const planks: THREE.Mesh[] = [];
      const parts: THREE.Object3D[] = [];
      root.traverse((o) => {
        const m = o as THREE.Mesh;
        if (!m.isMesh) return;
        if (isPlank(m.name)) planks[plankIdx(m.name)] = m;
        else if (!isStatic(m.name)) parts.push(m);
      });
      return { root, planks, parts };
    };
    return { a: build(), b: build() };
  }, [gltf]);
}

export function TheseusDocks() {
  const { a, b } = useShip();
  useEffect(() => {
    a.planks.forEach((p, i) => (p.material as THREE.MeshToonMaterial).color.copy(oldColor(i)));
    b.planks.forEach((p, i) => (p.material as THREE.MeshToonMaterial).color.copy(oldColor(i)));
    return () => [a.root, b.root].forEach((r) => r.traverse((o) => ((o as THREE.Mesh).material as THREE.Material | undefined)?.dispose?.()));
  }, [a, b]);
  const offset = useMemo(() => new THREE.Vector3(DOCK_A.x - DOCK_B.x, 0, DOCK_A.z - DOCK_B.z), []);
  const rise = useRef(0);
  useFrame((st, dt) => {
    const now = performance.now();
    const s = useTheseus.getState();
    const pulse = 0.5 + 0.5 * Math.sin(st.clock.elapsedTime * 4);
    const next = s.k < N_PLANKS ? ORDER[s.k] : -1;
    for (let i = 0; i < N_PLANKS; i++) {
      const pa = a.planks[i];
      const pb = b.planks[i];
      if (!pa || !pb) continue;
      const ma = pa.material as THREE.MeshToonMaterial;
      const t0 = s.t0[i];
      if (t0 < 0) {
        // chưa thay: ván cũ; tấm sắp thay khẽ nhấp nháy
        pa.position.set(0, 0, 0);
        ma.color.copy(oldColor(i));
        ma.emissive.setRGB(0, 0, 0);
        if (i === next) ma.emissive.copy(GLINT).multiplyScalar(0.18 * pulse);
        pb.visible = false;
        continue;
      }
      const k = Math.min(1, (now - t0) / FLY_MS);
      const e = k < 0.5 ? 2 * k * k : 1 - Math.pow(-2 * k + 2, 2) / 2;
      // tàu A: tấm mới từ trên cao hạ xuống, ánh vàng tắt dần
      pa.position.set(0, (1 - e) * 4.5, 0);
      ma.color.copy(NEW);
      ma.emissive.copy(GLINT).multiplyScalar(Math.max(0, 0.9 - k * 0.8));
      // tàu B: tấm cũ bay vòng từ ụ A sang
      pb.visible = true;
      pb.position.copy(offset).multiplyScalar(1 - e);
      pb.position.y = Math.sin(e * Math.PI) * 3.2;
      pb.rotation.set(Math.sin(e * Math.PI) * 0.35, 0, 0);
    }
    // Đủ 24 tấm: tàu B mọc nốt phần còn lại (cũ) từ dưới ụ lên, tàu A đổi sang đồ mới
    const complete = s.done > 0 && now > s.done;
    rise.current += ((complete ? 1 : 0) - rise.current) * Math.min(1, dt * 1.5);
    b.parts.forEach((p) => {
      p.visible = rise.current > 0.01;
      p.scale.setScalar(Math.max(0.001, rise.current));
    });
    a.parts.forEach((p) => {
      const m = (p as THREE.Mesh).material as THREE.MeshToonMaterial;
      if (!m?.emissive) return;
      m.emissive.copy(GLINT).multiplyScalar(complete ? 0.06 + 0.06 * pulse * Math.max(0, 1 - (now - s.done) / 3000) : 0);
    });
  });
  return (
    <group>
      <primitive object={a.root} position={[DOCK_A.x, 0, DOCK_A.z]} />
      <primitive object={b.root} position={[DOCK_B.x, 0, DOCK_B.z]} />
      <Label3D text="Tàu A · Tàu của Theseus?" position={[DOCK_A.x, 6.4, DOCK_A.z]} />
      <Label3D text="Tàu B · ráp từ ván cũ" position={[DOCK_B.x, 3.0, DOCK_B.z]} />
      <group position={[WRIGHT.x, 0, WRIGHT.z]} rotation-y={0.25}>
        <Avatar url={worldAsset(AVATAR_BY_ID["sample-a"]?.file ?? "avatars/sample-a.vrm")} pose="idle" npc instance="npc-shipwright" />
        <Label3D text="Mộc · Thợ đóng tàu" position={[0, 2.05, 0]} variant="name" />
      </group>
    </group>
  );
}

export function theseusBlocked(x: number, z: number) {
  for (const d of [DOCK_A, DOCK_B]) if (Math.abs(x - d.x) < 5.0 && Math.abs(z - d.z) < 2.1) return true;
  return Math.hypot(x - WRIGHT.x, z - WRIGHT.z) < 0.4;
}
