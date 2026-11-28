"use client";
/**
 * Phòng V — Dàn hợp xướng Fourier: giếng tròn ở giữa, trên giếng là dải sóng một chu kỳ (vàng = sóng đích, xanh = tổng của
 * cả đội), các ống đàn quanh vòng cung phía bắc (cao theo 1/k, sáng nhịp theo tần số k khi có người đứng), bục Nhạc trưởng
 * phía nam (màn 3). Dải sóng luôn quay mặt về máy quay. Tiếng = đúng tổng hoạ âm đang kêu (choirVoice.ts).
 */
import { useEffect, useMemo, useRef } from "react";
import { useFrame, useThree } from "@react-three/fiber";
import * as THREE from "three";
import { MagicCircle } from "../../fx/Effects";
import { toonMaterial } from "../../fx/shaders";
import { Label3D } from "../../ui/Labels";
import { useWorld } from "../../store";
import { SEAT_COLORS } from "@/lib/world/vault/run";
import { CHOIR_R, ERR_OK, PODIUM, pedestal, sample, sounding, type FState } from "@/lib/world/vault/fourier";
import { useVault } from "../vaultClient";
import { setChoir, stopChoir } from "../choirVoice";
import { useVaultProp } from "../vaultProps";

const PTS = 128;
const W = 6.4;
const AMP = 1.15;

function stripGeometry(): THREE.BufferGeometry {
  const g = new THREE.BufferGeometry();
  g.setAttribute("position", new THREE.BufferAttribute(new Float32Array(PTS * 2 * 3), 3));
  const idx: number[] = [];
  for (let i = 0; i < PTS - 1; i++) {
    const a = i * 2;
    idx.push(a, a + 1, a + 2, a + 1, a + 3, a + 2);
  }
  g.setIndex(idx);
  return g;
}
/** Dải sóng dày `th` theo pháp tuyến của đường cong (nét đều kể cả chỗ dốc) */
function fillStrip(g: THREE.BufferGeometry, ks: number[], amps: number[], th: number) {
  const pos = g.attributes.position as THREE.BufferAttribute;
  const ys: number[] = [];
  for (let i = 0; i < PTS; i++) ys.push(sample(amps, ks, (i / (PTS - 1)) * Math.PI * 2) * AMP);
  for (let i = 0; i < PTS; i++) {
    const x = -W / 2 + (i / (PTS - 1)) * W;
    const y0 = ys[Math.max(0, i - 1)];
    const y1 = ys[Math.min(PTS - 1, i + 1)];
    const dx = (2 * W) / (PTS - 1);
    const L = Math.hypot(dx, y1 - y0) || 1;
    const nx = (-(y1 - y0) / L) * th;
    const ny = (dx / L) * th;
    pos.setXYZ(i * 2, x + nx, ys[i] + ny, 0);
    pos.setXYZ(i * 2 + 1, x - nx, ys[i] - ny, 0);
  }
  pos.needsUpdate = true;
  g.computeBoundingSphere();
}

/** Ống đàn Blender (vp_pipe): chân + miệng cố định, thân co giãn theo chiều cao, vành đỉnh; miệng quay vào giếng */
function OrganPipe({ x, z, h }: { x: number; z: number; h: number }) {
  const base = useVaultProp("vp_pipe");
  const parts = useMemo(() => {
    if (!base) return null;
    const get = (n: string) => base.getObjectByName(n)?.clone(true) ?? null;
    return { foot: get("pipe_foot"), body: get("pipe_body"), top: get("pipe_top") };
  }, [base]);
  if (!parts) return null;
  return (
    <group position={[x, 0, z]} rotation-y={Math.atan2(-x, -z)}>
      {parts.foot && <primitive object={parts.foot} />}
      {parts.body && <primitive object={parts.body} position={[0, 0.5, 0]} scale={[1, Math.max(0.1, h - 0.5), 1]} />}
      {parts.top && <primitive object={parts.top} position={[0, h, 0]} />}
    </group>
  );
}

export function ChoirRoom() {
  const vi = useWorld((s) => s.lang === "vi");
  const { camera } = useThree();
  const ks = useVault((s) => ((s.run?.st as FState | null)?.ks ?? [1, 2]).join(","));
  const tg = useVault((s) => ((s.run?.st as FState | null)?.tg ?? []).join(","));
  const cond = useVault((s) => !!(s.run?.st as FState | null)?.cond);
  const on = useVault((s) => ((s.run?.st as FState | null)?.on ?? []).map(Number).join(","));
  const occ = useVault((s) => s.run?.seats.length ?? 0);
  const muted = useVault((s) => s.muted);
  const kArr = useMemo(() => ks.split(",").map(Number), [ks]);
  const tArr = useMemo(() => (tg ? tg.split(",").map(Number) : kArr.map(() => 0)), [tg, kArr]);
  const onArr = useMemo(() => (on ? on.split(",").map((x) => x === "1") : []), [on]);
  const ribbon = useRef<THREE.Group>(null);
  const geos = useMemo(() => ({ target: stripGeometry(), sum: stripGeometry() }), []);
  const mats = useMemo(
    () => ({
      target: new THREE.MeshBasicMaterial({ color: new THREE.Color("#ffd27a").multiplyScalar(1.4), transparent: true, opacity: 0.75, side: THREE.DoubleSide, depthWrite: false, toneMapped: false }),
      sum: new THREE.MeshBasicMaterial({ color: new THREE.Color("#6fe6ff").multiplyScalar(1.6), side: THREE.DoubleSide, toneMapped: false }),
      axis: new THREE.MeshBasicMaterial({ color: "#ffffff", transparent: true, opacity: 0.18, toneMapped: false }),
      floor: toonMaterial("#2a1a3d", { rim: "#d18cff", rimPower: 9 }),
      rim: toonMaterial("#c9a0ff", { rim: "#ffffff", emissive: "#2a0a3a" }),
      well: new THREE.MeshBasicMaterial({ color: "#09040f" }),
    }),
    [],
  );
  useEffect(
    () => () => {
      Object.values(mats).forEach((m) => m.dispose());
      geos.target.dispose();
      geos.sum.dispose();
      stopChoir();
    },
    [mats, geos],
  );
  useEffect(() => fillStrip(geos.target, kArr, tArr, 0.035), [geos, kArr, tArr]);
  const lastSum = useRef("");
  useFrame(() => {
    const st = useVault.getState().run?.st as FState | null;
    if (ribbon.current) ribbon.current.rotation.y = Math.atan2(camera.position.x, camera.position.z);
    if (!st?.amp) return;
    // dự đoán núm của mình (hiện ngay, trước khi server xác nhận)
    const d = useVault.getState().dial;
    const amp = st.amp.slice();
    if (d && performance.now() - d.at < 600 && d.i < amp.length) amp[d.i] = d.v;
    const snd = sounding({ ...st, amp });
    const key = snd.join(",");
    if (key !== lastSum.current) {
      lastSum.current = key;
      fillStrip(geos.sum, st.ks, snd, 0.05);
      mats.sum.color.set(st.err <= ERR_OK ? "#bfffe0" : "#6fe6ff").multiplyScalar(1.6);
    }
    setChoir(st.ks, snd, useVault.getState().muted);
  });
  useEffect(() => {
    if (muted) setChoir([], [], true);
  }, [muted]);
  const pipes = kArr.map((k, i) => {
    const p = pedestal({ ks: kArr }, i);
    const a = Math.atan2(p.z, p.x);
    return { k, i, p, back: { x: Math.cos(a) * (CHOIR_R - 0.25), z: Math.sin(a) * (CHOIR_R - 0.25) }, h: 2.4 + 4 / k };
  });
  void occ;
  return (
    <group>
      <mesh material={mats.floor} position={[0, -0.3, 0]}>
        <cylinderGeometry args={[CHOIR_R + 0.6, CHOIR_R, 0.6, 56]} />
      </mesh>
      <MagicCircle radius={CHOIR_R - 0.8} position={[0, 0.02, 0]} color="#c36bff" color2="#ffd27a" intensity={0.3} spin={0.15} />
      {/* giếng giữa */}
      <mesh material={mats.rim} position={[0, 0.25, 0]} rotation-x={Math.PI / 2}>
        <torusGeometry args={[3.05, 0.22, 10, 48]} />
      </mesh>
      <mesh material={mats.well} rotation-x={-Math.PI / 2} position={[0, 0.03, 0]}>
        <circleGeometry args={[2.9, 40]} />
      </mesh>
      {/* dải sóng một chu kỳ */}
      <group ref={ribbon} position={[0, 2.5, 0]}>
        <mesh geometry={geos.target} material={mats.target} position={[0, 0, -0.03]} />
        <mesh geometry={geos.sum} material={mats.sum} />
        <mesh material={mats.axis}>
          <boxGeometry args={[W, 0.015, 0.01]} />
        </mesh>
      </group>
      {/* ống đàn + bệ */}
      {pipes.map(({ k, i, p, back, h }) => (
        <group key={`${ks}:${i}`}>
          <OrganPipe x={back.x} z={back.z} h={h} />
          <mesh position={[back.x, h + 0.02, back.z]} rotation-x={-Math.PI / 2}>
            <circleGeometry args={[0.38, 18]} />
            <meshBasicMaterial color={onArr[i] ? "#ffe7a0" : "#3a2a4a"} toneMapped={false} />
          </mesh>
          <MagicCircle radius={0.95} position={[p.x, 0.04, p.z]} color={onArr[i] ? "#ffe7a0" : "#9a86c8"} color2={SEAT_COLORS[i % 4]} intensity={onArr[i] ? 1.5 : 0.5} spin={onArr[i] ? k : 0.4} />
          <Label3D text={`${vi ? "Ống" : "Pipe"} k = ${k}`} position={[p.x, 1.3, p.z]} variant="small" maxDist={18} />
        </group>
      ))}
      {cond && (
        <group position={[PODIUM.x, 0, PODIUM.z]}>
          <mesh material={mats.rim} position={[0, 0.12, 0]}>
            <cylinderGeometry args={[PODIUM.r, PODIUM.r + 0.15, 0.24, 28]} />
          </mesh>
          <MagicCircle radius={PODIUM.r} position={[0, 0.26, 0]} color="#ffd27a" color2="#ffffff" intensity={1.2} spin={0.6} />
          <Label3D text={vi ? "Bục Nhạc trưởng · thấy phổ" : "Conductor's podium · see the spectrum"} position={[0, 1.6, 0]} variant="small" maxDist={22} />
        </group>
      )}
      <hemisphereLight args={["#e6c8ff", "#24123a", 0.85]} />
      <directionalLight position={[6, 16, 10]} intensity={1.4} color="#ffe6ff" />
      <pointLight position={[0, 5, 0]} intensity={18} distance={22} color="#d49bff" decay={1.3} />
    </group>
  );
}
