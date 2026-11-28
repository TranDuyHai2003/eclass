"use client";
/**
 * Sảnh Ngưỡng cửa: sảnh tròn 18 m, vòng cột, N ấn ký trên sàn, hai dây chuông hai bên, phiến ẩn (chỉ người cầm đèn ● thấy),
 * cửa đá tròn phía bắc có 3 lỗ khoá sáng dần theo từng nhịp. Cũng là phòng chờ trước khi bắt đầu lượt.
 */
import { useEffect, useMemo, useRef } from "react";
import { useFrame } from "@react-three/fiber";
import * as THREE from "three";
import { MagicCircle } from "../../fx/Effects";
import { toonMaterial } from "../../fx/shaders";
import { Label3D } from "../../ui/Labels";
import { useWorld } from "../../store";
import { GLYPHS, SEAT_COLORS } from "@/lib/world/vault/run";
import { HALL_R, ROPES, sigil, type TState } from "@/lib/world/vault/threshold";
import { useVault } from "../vaultClient";

const COLS = 18;

export function ThresholdRoom() {
  const vi = useWorld((s) => s.lang === "vi");
  const lobby = useVault((s) => s.run?.phase === "lobby" || !s.run);
  const n = useVault((s) => (s.run?.n || s.run?.seats.length || 2) as number);
  const st = useVault((s) => (s.run?.phase !== "lobby" && s.run?.ch === 0 ? (s.run.st as TState) : null));
  const seat = useVault((s) => s.seat);
  const beat = st?.beat ?? (lobby ? -1 : 3);
  const mats = useMemo(
    () => ({
      floor: toonMaterial("#2a2648", { rim: "#6d5fc0", rimPower: 9 }),
      col: toonMaterial("#463e68", { rim: "#a898ff" }),
      door: toonMaterial("#4a4166", { rim: "#8a7ad8", rimPower: 6 }),
      rope: toonMaterial("#d8b46a"),
      bell: toonMaterial("#e9c25c", { rim: "#fff2c0", emissive: "#3a2600" }),
    }),
    [],
  );
  useEffect(() => () => Object.values(mats).forEach((m) => m.dispose()), [mats]);
  const cols = useMemo(() => {
    const geo = new THREE.CylinderGeometry(0.42, 0.55, 7, 10);
    const m = new THREE.InstancedMesh(geo, mats.col, COLS);
    const o = new THREE.Object3D();
    for (let i = 0; i < COLS; i++) {
      const a = (i / COLS) * Math.PI * 2;
      o.position.set(Math.cos(a) * (HALL_R + 0.6), 3.5, Math.sin(a) * (HALL_R + 0.6));
      o.updateMatrix();
      m.setMatrixAt(i, o.matrix);
    }
    m.computeBoundingSphere();
    return m;
  }, [mats]);
  const bells = useRef<THREE.Group[]>([]);
  const rings = useVault((s) => (s.run?.ch === 0 && s.run.st ? (s.run.st as TState).ring?.join(",") : ""));
  const swing = useRef([0, 0]);
  useEffect(() => {
    const r = (rings || "0,0").split(",").map(Number);
    r.forEach((t, i) => t && (swing.current[i] = 1));
  }, [rings]);
  useFrame((_, dt) => {
    bells.current.forEach((b, i) => {
      if (!b) return;
      swing.current[i] = Math.max(0, swing.current[i] - dt * 0.6);
      b.rotation.z = Math.sin(performance.now() / 120) * 0.35 * swing.current[i];
    });
  });
  const plateVisible = st && (seat === 0 || beat >= 3);
  return (
    <group>
      <mesh material={mats.floor} position={[0, -0.25, 0]}>
        <cylinderGeometry args={[HALL_R + 1.2, HALL_R + 0.6, 0.5, 48]} />
      </mesh>
      <MagicCircle radius={HALL_R - 0.6} position={[0, 0.02, 0]} color="#8d7bff" color2="#ffd27a" intensity={0.16} spin={0.2} />
      <primitive object={cols} />
      {/* ấn ký: mỗi ghế một vòng phép màu ghế */}
      {Array.from({ length: n }, (_, i) => {
        const [x, z] = sigil(n, i);
        const on = (st?.sig[i] ?? -1) >= 0;
        return (
          <group key={i} position={[x, 0.04, z]}>
            <MagicCircle radius={0.95} color={SEAT_COLORS[i]} color2="#ffffff" intensity={on ? 1.6 : beat === 0 ? 0.8 : 0.35} spin={on ? 2.2 : 0.6} />
            <Label3D text={GLYPHS[i]} position={[0, 0.5, 0]} variant="small" maxDist={30} />
          </group>
        );
      })}
      {/* dây chuông */}
      {ROPES.map(([x, z], i) => (
        <group key={i} position={[x, 0, z]}>
          <mesh material={mats.col} position={[0, 3.6, -0.9]}>
            <boxGeometry args={[0.5, 7.2, 0.5]} />
          </mesh>
          <mesh material={mats.col} position={[0, 7.1, -0.35]}>
            <boxGeometry args={[0.5, 0.4, 1.6]} />
          </mesh>
          <group position={[0, 6.9, 0.2]} ref={(g) => void (g && (bells.current[i] = g))}>
            <mesh material={mats.bell} position={[0, -0.45, 0]}>
              <cylinderGeometry args={[0.18, 0.55, 0.8, 18, 1, true]} />
            </mesh>
            <mesh material={mats.rope} position={[0, -3.4, 0]}>
              <cylinderGeometry args={[0.035, 0.035, 5.4, 6]} />
            </mesh>
            <mesh material={mats.rope} position={[0, -6.1, 0]}>
              <sphereGeometry args={[0.12, 10, 8]} />
            </mesh>
          </group>
          {beat === 1 && <MagicCircle radius={1.3} position={[0, 0.03, 0.4]} color="#ffd27a" color2="#fff" intensity={0.9} spin={1.4} />}
          <Label3D text={vi ? "Dây chuông" : "Bell rope"} position={[0, 2.6, 0.4]} variant="small" maxDist={22} />
        </group>
      ))}
      {/* phiến ẩn: chỉ người cầm đèn ● thấy (thông tin bất đối xứng) */}
      {plateVisible && st && <MagicCircle radius={0.95} position={[st.plate[0], 0.05, st.plate[1]]} color="#fff3c4" color2="#ffd27a" intensity={st.on > 0 ? 2.4 : 1.9} spin={1.4} />}
      {/* cửa đá tròn phía bắc: 3 lỗ khoá sáng theo nhịp */}
      <group position={[0, 3.2, -HALL_R - 0.4]}>
        <mesh material={mats.door} rotation-x={Math.PI / 2}>
          <cylinderGeometry args={[3, 3, 0.6, 40]} />
        </mesh>
        {[0, 1, 2].map((k) => (
          <mesh key={k} position={[(k - 1) * 1.3, 0, 0.35]}>
            <circleGeometry args={[0.32, 20]} />
            <meshBasicMaterial color={beat > k ? "#ffd27a" : "#2a2446"} toneMapped={false} />
          </mesh>
        ))}
      </group>
      <hemisphereLight args={["#8f86d8", "#1a1530", 0.7]} />
      <directionalLight position={[6, 14, 8]} intensity={1.1} color="#e6dcff" />
      <pointLight position={[0, 5, 0]} intensity={8} distance={18} color="#b9a8ff" decay={1.4} />
    </group>
  );
}
