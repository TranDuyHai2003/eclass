"use client";
/**
 * Căn phòng Trung Hoa — mé tây sân Sảnh Bất Khả.
 * Blender (`props/chinese_room.glb`, GI nướng: nắng + đèn lồng): căn phòng kín có khe IN / OUT và cửa sổ giấy ở mặt đông,
 * mặt tây mở để người chơi vào ngồi bàn sách quy tắc. Lan đứng ngoài gửi câu hỏi tiếng Trung thật qua khe;
 * mẩu giấy (CanvasTexture) trượt qua khe vào bàn, rồi câu trả lời trượt ra khe OUT tới tay Lan.
 */
import { useEffect, useMemo, useRef } from "react";
import { useFrame } from "@react-three/fiber";
import { useGLTF } from "@react-three/drei";
import * as THREE from "three";
import { create } from "zustand";
import { worldAsset, AVATAR_BY_ID } from "@/lib/world/avatars";
import { ROUNDS, isCorrect } from "@/lib/world/chineseRoom";
import { sfx } from "@/lib/world/sfx";
import { bakedMaterial } from "../fx/baked";
import { Avatar } from "../player/Avatar";
import { Label3D } from "../ui/Labels";

const GLB = worldAsset("props/chinese_room.glb");
useGLTF.preload(GLB);

/** Tâm phòng (game); mặt có khe quay về +x */
export const CROOM = { x: -15, z: -2.5 };
/** Chỗ ngồi trước bàn quy tắc (trong phòng) */
export const SEAT = { x: CROOM.x + 0.05, z: CROOM.z };
export const LAN = { x: CROOM.x + 3.85, z: CROOM.z + 1.55 };
const ROOM_U = { uExposure: { value: 1.15 }, uFloor: { value: 0.3 }, uTint: { value: new THREE.Color(1, 0.97, 0.93) }, uScale: { value: 0.95 } };
const SLIP_MS = 1700;

export type CPhase = "idle" | "incoming" | "writing" | "outgoing" | "done";
export const useCRoom = create<{ round: number; written: string[]; phase: CPhase; t0: number; wrong: number }>(() => ({ round: 0, written: [], phase: "idle", t0: 0, wrong: 0 }));

let timer: ReturnType<typeof setTimeout> | null = null;
function later(ms: number, fn: () => void) {
  if (timer) clearTimeout(timer);
  timer = setTimeout(fn, ms);
}
export function startRoom() {
  useCRoom.setState({ round: 0, written: [], phase: "incoming", t0: performance.now(), wrong: 0 });
  sfx.click();
  later(SLIP_MS, () => useCRoom.setState({ phase: "writing" }));
}
export function submitAnswer() {
  const s = useCRoom.getState();
  if (s.phase !== "writing") return;
  if (!isCorrect(s.round, s.written)) {
    useCRoom.setState({ wrong: s.wrong + 1 });
    sfx.miss();
    return;
  }
  useCRoom.setState({ phase: "outgoing", t0: performance.now() });
  sfx.chime(1);
  later(SLIP_MS + 400, () => {
    const next = s.round + 1;
    if (next >= ROUNDS.length) {
      useCRoom.setState({ phase: "done" });
      sfx.chime(4);
      return;
    }
    useCRoom.setState({ round: next, written: [], phase: "incoming", t0: performance.now() });
    later(SLIP_MS, () => useCRoom.setState({ phase: "writing" }));
  });
}

/** Mẩu giấy viết tay: ký tự tiếng Trung xếp dọc như thư pháp */
function useSlip() {
  return useMemo(() => {
    const canvas = document.createElement("canvas");
    canvas.width = 256;
    canvas.height = 360;
    const tex = new THREE.CanvasTexture(canvas);
    tex.colorSpace = THREE.SRGBColorSpace;
    const draw = (text: string) => {
      const g = canvas.getContext("2d");
      if (!g) return;
      g.fillStyle = "#fbf4e2";
      g.fillRect(0, 0, 256, 360);
      g.strokeStyle = "rgba(160,60,40,0.55)";
      g.lineWidth = 4;
      g.strokeRect(10, 10, 236, 340);
      const ch = Array.from(text);
      const cols = Math.ceil(ch.length / 6);
      g.fillStyle = "#1e1a22";
      g.textAlign = "center";
      g.textBaseline = "middle";
      g.font = `bold ${cols > 1 ? 46 : 52}px "Noto Serif SC", "Noto Sans SC", "Microsoft YaHei", "SimSun", serif`;
      ch.forEach((c, i) => {
        const col = Math.floor(i / 6);
        const row = i % 6;
        g.fillText(c, 256 - 64 - col * 72 - (cols === 1 ? 0 : -20), 48 + row * 52);
      });
      tex.needsUpdate = true;
    };
    const mat = new THREE.MeshBasicMaterial({ map: tex, side: THREE.DoubleSide });
    return { draw, mat, tex };
  }, []);
}

export function ChineseRoomScene() {
  const gltf = useGLTF(GLB);
  const { root, mats } = useMemo(() => {
    const cache = new Map<string, THREE.Material>();
    const root = gltf.scene.clone(true);
    root.traverse((o) => {
      const m = o as THREE.Mesh;
      if (!m.isMesh) return;
      const conv = (sm: THREE.Material) => {
        const s = sm as THREE.MeshStandardMaterial;
        let mat = cache.get(s.name);
        if (!mat) {
          mat = s.name.startsWith("glow_") ? new THREE.MeshBasicMaterial({ color: s.color.clone().multiplyScalar(1.8), toneMapped: false }) : bakedMaterial(s, ROOM_U);
          cache.set(s.name, mat);
        }
        return mat;
      };
      m.material = Array.isArray(m.material) ? m.material.map(conv) : conv(m.material);
    });
    return { root, mats: [...cache.values()] };
  }, [gltf]);
  useEffect(() => () => mats.forEach((m) => m.dispose()), [mats]);
  const slipIn = useSlip();
  const slipOut = useSlip();
  const geo = useMemo(() => new THREE.PlaneGeometry(0.3, 0.42), []);
  useEffect(() => () => [geo, slipIn.mat, slipIn.tex, slipOut.mat, slipOut.tex].forEach((x) => x.dispose()), [geo, slipIn, slipOut]);
  const round = useCRoom((s) => s.round);
  useEffect(() => {
    slipIn.draw(ROUNDS[round].see);
    slipOut.draw(ROUNDS[round].write);
  }, [round, slipIn, slipOut]);
  const inRef = useRef<THREE.Mesh>(null);
  const outRef = useRef<THREE.Mesh>(null);
  // Đường đi cục bộ (x đông, y lên, z = −y Blender): ngoài khe IN → qua khe → nằm trên bàn; bàn → khe OUT → tay Lan
  const path = useMemo(
    () => ({
      inA: new THREE.Vector3(3.0, 1.35, 0.75),
      inB: new THREE.Vector3(2.15, 1.16, 0.75),
      inC: new THREE.Vector3(1.05, 1.0, 0.25),
      outA: new THREE.Vector3(1.05, 1.0, -0.3),
      outB: new THREE.Vector3(2.15, 1.16, -0.75),
      outC: new THREE.Vector3(3.6, 1.15, 0.6),
      v: new THREE.Vector3(),
    }),
    [],
  );
  useFrame((st) => {
    const s = useCRoom.getState();
    const k = Math.min(1, (performance.now() - s.t0) / SLIP_MS);
    const e = k < 0.5 ? 2 * k * k : 1 - Math.pow(-2 * k + 2, 2) / 2;
    const seg = (a: THREE.Vector3, b: THREE.Vector3, c: THREE.Vector3, t: number) => (t < 0.45 ? path.v.copy(a).lerp(b, t / 0.45) : path.v.copy(b).lerp(c, (t - 0.45) / 0.55));
    const pi = inRef.current;
    const po = outRef.current;
    if (pi) {
      const show = s.phase === "incoming" || s.phase === "writing" || s.phase === "outgoing";
      pi.visible = show;
      if (show) {
        const t = s.phase === "incoming" ? e : 1;
        pi.position.copy(seg(path.inA, path.inB, path.inC, t));
        // dựng đứng khi qua khe, nằm phẳng trên bàn
        pi.rotation.set(-Math.PI / 2 * Math.min(1, Math.max(0, (t - 0.45) / 0.4)), Math.PI / 2, 0, "YXZ");
        pi.position.y += Math.sin(st.clock.elapsedTime * 3) * 0.002;
      }
    }
    if (po) {
      po.visible = s.phase === "outgoing";
      if (po.visible) {
        po.position.copy(seg(path.outA, path.outB, path.outC, e));
        po.rotation.set(-Math.PI / 2 * (1 - Math.min(1, e / 0.45)), Math.PI / 2, 0, "YXZ");
      }
    }
  });
  return (
    <group position={[CROOM.x, 0, CROOM.z]}>
      <primitive object={root} />
      <mesh ref={inRef} geometry={geo} material={slipIn.mat} visible={false} />
      <mesh ref={outRef} geometry={geo} material={slipOut.mat} visible={false} />
      <Label3D text="入 IN" position={[2.35, 1.5, 0.75]} />
      <Label3D text="出 OUT" position={[2.35, 1.5, -0.75]} />
      <Label3D text="Căn phòng Trung Hoa" position={[0, 5.0, 0]} />
      <group position={[LAN.x - CROOM.x, 0, LAN.z - CROOM.z]} rotation-y={-Math.PI / 2 - 0.25}>
        <Avatar url={worldAsset(AVATAR_BY_ID["ki"]?.file ?? "avatars/ki.vrm")} pose="idle" npc instance="npc-lan" />
        <Label3D text="Lan · Người gửi thư ngoài cửa" position={[0, 2.05, 0]} variant="name" />
      </group>
    </group>
  );
}

/** Nền đá cao 0,18 trong phạm vi móng */
export function croomGround(x: number, z: number) {
  const lx = x - CROOM.x;
  const lz = z - CROOM.z;
  return Math.abs(lx) < 2.4 && Math.abs(lz) < 2.4 ? 0.18 : null;
}
/** Tường + nội thất chặn; chừa lối vào từ phía tây và khoảng trống trước bàn */
export function croomBlocked(x: number, z: number) {
  const lx = x - CROOM.x;
  const lz = z - CROOM.z;
  if (Math.hypot(x - LAN.x, z - LAN.z) < 0.4) return true;
  if (Math.hypot(lx - 3.7, lz - 0.75) < 0.35 || Math.hypot(lx - 3.3, lz + 0.4) < 0.45) return true;
  if (Math.abs(lx) > 2.6 || Math.abs(lz) > 2.6) return false;
  const inside = lx > -2.6 && lx < 0.32 && Math.abs(lz) < 1.42;
  return !inside;
}
