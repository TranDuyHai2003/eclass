"use client";
/**
 * Bờ Sóng (Wave Coast) — vùng mà cơ chế CHÍNH LÀ toán sóng (vật lý 11 + lượng giác):
 *  I.   Lối Triều — mực nước = sin chậm 48 s; doi cát chỉ lội qua lúc nước ròng, nước lên thì bị cuốn về bờ.
 *  II.  Hải đăng Snell — xoay lăng kính bẻ tia sáng (n₁ sin θ₁ = n₂ sin θ₂) trúng tinh thể; tinh thể thứ hai cần phản xạ toàn phần.
 *  III. Chuông Cộng hưởng — cầu phao lắc theo sóng lừng 3 s; chọn dây L để T = 2π√(L/g) = 3 s (hoặc đẩy tay đúng nhịp).
 *  IV.  Đầm Giao thoa — hai nguồn sóng, đi trên đường nút (hyperbol) hoặc đảo pha để đường giữa lặng → Hang Nàng Tiên Cá
 *       (cổng tới Mê cung Hoạ âm, boss Fourier Siren có sẵn — không làm lại).
 * Logic thuần + test: lib/world/waves.ts, lib/world/coastWorld.ts, tests/world/waveCoast.test.ts. Kế hoạch: PLAN.md T20.
 * Đồng hồ sóng chung: coastClock(Date.now()) — hai người chơi thấy cùng con sóng, cùng mực triều.
 */
import { useEffect, useMemo } from "react";
import { useFrame } from "@react-three/fiber";
import * as THREE from "three";
import { useWorld } from "../../store";
import { AVATAR_BY_ID } from "@/lib/world/avatars";
import { Player, type Nearby } from "../Hub";
import { RemotePlayers } from "../RemotePlayers";
import { CombatFx, Enemies } from "../../combat/CombatScene";
import { CAM, motion } from "../../combat/combat";
import { GRADIENT } from "../../fx/shaders";
import { MagicCircle } from "../../fx/Effects";
import { Label3D } from "../../ui/Labels";
import { registerAction } from "../../actions";
import { sfx } from "@/lib/world/sfx";
import {
  BELL_STONE,
  GANTRY,
  GROTTO,
  ISLE,
  LAGOON_STONE,
  LEVER,
  LIGHTHOUSE,
  PIER,
  PORTAL,
  PRISM,
  PUSH_SPOT,
  SPAWN,
  SWEEP_DEPTH,
  TIDE_STONE,
  WEIGHTS,
  WINCH,
  coastArea,
  coastBlocked,
  coastGround,
  inLagoon,
  seaDepth,
  sweepTarget,
} from "@/lib/world/coastWorld";
import { LAGOON, coastClock, lagoonSlam, tideLevel } from "@/lib/world/waves";
import { COAST_FOG, COAST_SUN, CoastSky, LagoonWater, Ocean } from "./coastFx";
import { buildCoastTerrain } from "./coastTerrain";
import { CoastStatics, LagoonRig } from "./CoastProps";
import { ResonanceBell } from "./ResonanceBell";
import { PrismLight } from "./PrismLight";
import { coastHint, loadCoast, pend, useCoast } from "./coastState";
import { crossedLagoon, cycleLength, lagoonSlammed, pushPendulum, reachedIslet, rotatePrism, swept, togglePhase, toggleWeight } from "./coastGame";

const SUN_POS = COAST_SUN.clone().multiplyScalar(80).toArray() as [number, number, number];
const ground = (x: number, z: number) => coastGround(x, z);
const blocked = (x: number, z: number) => coastBlocked(x, z);
const ENTER = { at: 0, slamAt: 0 };
const MIDS = new THREE.Vector3((LAGOON.s1.x + LAGOON.s2.x) / 2, 0, (LAGOON.s1.z + LAGOON.s2.z) / 2);
const PUSH = new THREE.Vector3();

export function Coast() {
  const avatar = useWorld((s) => s.avatar);
  const quality = useWorld((s) => s.quality);
  const vi = useWorld((s) => s.lang === "vi");
  const lagoonDone = useCoast((s) => s.lagoon);

  useEffect(() => {
    loadCoast();
    ENTER.at = performance.now();
    if (useWorld.getState().camDist > 7) useWorld.setState({ camDist: 4.8 });
    if (process.env.NODE_ENV !== "production") Object.assign(window, { __coast: useCoast, __pend: pend });
    const offs = [
      registerAction("coast:tide", () => useCoast.setState({ panel: "tide" })),
      registerAction("coast:lagoonStone", () => useCoast.setState({ panel: "lagoon" })),
      registerAction("coast:bellStone", () => useCoast.setState({ panel: "bell" })),
      registerAction("coast:phase", togglePhase),
      registerAction("coast:winch", cycleLength),
      registerAction("coast:weight", toggleWeight),
      registerAction("coast:push", () => pushPendulum(pend.simT)),
      registerAction("coast:prism", () => rotatePrism(1)),
    ];
    const t = window.setTimeout(
      () =>
        coastHint(
          "Bờ Sóng: mọi con sóng ở đây là một hình sin. Hải đăng ngoài đảo chỉ tới được lúc nước ròng — Bia Thuỷ triều bên trái kể cách đoán.",
          "Wave Coast: every wave here is a sine. The lighthouse island can only be reached at low tide — the Tide Stone to your left tells you how to predict it.",
        ),
      3500,
    );
    return () => {
      offs.forEach((f) => f());
      window.clearTimeout(t);
      useCoast.setState({ hint: null, panel: null });
    };
  }, []);

  const terrain = useMemo(() => {
    const geo = buildCoastTerrain(quality === "low" ? 0.75 : 0.5);
    const mat = new THREE.MeshToonMaterial({ color: "#ffffff", vertexColors: true, gradientMap: GRADIENT });
    return { geo, mat };
  }, [quality]);
  useEffect(
    () => () => {
      terrain.geo.dispose();
      terrain.mat.dispose();
    },
    [terrain],
  );

  useFrame(() => {
    const s = useWorld.getState();
    const p = s.player;
    const now = performance.now();
    const t = coastClock(Date.now());
    const quiet = now - ENTER.at < 1500;
    // gió biển giật: không bung tàu lượn (lượn qua đầm / biển phá câu đố)
    if (motion.gliding) {
      motion.gliding = false;
      const h = useCoast.getState().hint;
      if (!h || now - h.at > 6000) coastHint("Gió biển giật quá mạnh — tàu lượn không bung được ở đây.", "The sea wind gusts too hard — the glider won't open here.", "warn");
    }
    const gy = coastGround(p.x, p.z);
    const onFeet = p.y - gy < 0.45;
    // ── thuỷ triều: lội chậm; sâu quá thì bị cuốn về bờ
    const level = tideLevel(t);
    const depth = seaDepth(p.x, p.z, level);
    motion.wade = inLagoon(p.x, p.z) ? 0.7 : depth > 0.12 ? 0.62 : 1;
    if (onFeet && depth > SWEEP_DEPTH) {
      const to = sweepTarget(p.x, p.z, level);
      const back = new THREE.Vector3(to.x - p.x, 0, to.z - p.z);
      p.set(to.x, coastGround(to.x, to.z) + 0.05, to.z);
      CAM.shift = (CAM.shift ?? new THREE.Vector3()).add(back);
      motion.vy = 0;
      motion.grounded = true;
      if (!quiet) swept();
    }
    // ── Đầm Giao thoa: đỉnh sóng ở bụng đánh bạt người chơi ra xa hai nguồn
    if (onFeet && inLagoon(p.x, p.z) && now - ENTER.slamAt > 900 && now >= motion.dashUntil + 120 && lagoonSlam(p.x, p.z, t, useCoast.getState().phi)) {
      ENTER.slamAt = now;
      PUSH.set(p.x - MIDS.x, 0, p.z - MIDS.z);
      if (PUSH.lengthSq() < 0.01) PUSH.set(0, 0, 1);
      PUSH.normalize();
      if (!quiet) lagoonSlammed(PUSH);
    }
    // ── tiến trình theo vị trí
    if (Math.hypot(p.x - ISLE.x, p.z - ISLE.z) < ISLE.flat && onFeet && !quiet) reachedIslet();
    if (p.z < LAGOON.z0 - 0.3 && !quiet) crossedLagoon();
    const area = coastArea(p.x, p.z);
    if (area !== useCoast.getState().area) useCoast.setState({ area });
    // rơi khỏi thế giới (không nên xảy ra)
    if (p.y < -8) {
      p.set(SPAWN.x, coastGround(SPAWN.x, SPAWN.z), SPAWN.z);
      motion.vy = 0;
      sfx.whiff();
    }
  });

  const y = (x: number, z: number) => coastGround(x, z);
  return (
    <group>
      <color attach="background" args={[COAST_FOG]} />
      <fog attach="fog" args={[COAST_FOG, 60, 230]} />
      <hemisphereLight args={["#d6ecff", "#e6cf9c", 1.1]} />
      <directionalLight position={SUN_POS} intensity={2.4} color="#fff0d8" />
      <directionalLight position={[-20, 14, 18]} intensity={0.3} color="#b9d3ff" />
      <CoastSky />
      <mesh geometry={terrain.geo} material={terrain.mat} />
      <Ocean quality={quality} />
      <LagoonWater />
      <CoastStatics ground={y} />
      <LagoonRig />
      <ResonanceBell />
      <PrismLight />
      <MagicCircle radius={1.5} position={[PORTAL.x, y(PORTAL.x, PORTAL.z) + 0.08, PORTAL.z]} color="#7fd8ff" color2="#ffd27a" intensity={0.8} spin={0.6} />
      <MagicCircle radius={1.7} position={[GROTTO.x, y(GROTTO.x, GROTTO.z) + 0.08, GROTTO.z]} color="#ff5fb0" color2="#6a3fd0" intensity={lagoonDone ? 1 : 0.5} spin={0.4} />
      <RemotePlayers />
      <Player armed avatarFile={AVATAR_BY_ID[avatar]?.file} ground={ground} blocked={blocked} findNearby={coastNearby} />
      {/* không có quái thường — chỉ để bật vũ khí + mặt đất cho đạn (ENV) */}
      <Enemies ground={ground} spawner={{ kind: "fixed", points: [] }} />
      <CombatFx />
      <Label3D text={vi ? "Về Quảng trường" : "Back to the Plaza"} position={[PORTAL.x, y(PORTAL.x, PORTAL.z) + 3.9, PORTAL.z]} maxDist={26} />
      <Label3D text={vi ? "Bia Thuỷ triều" : "Tide Stone"} position={[TIDE_STONE.x, y(TIDE_STONE.x, TIDE_STONE.z) + 2.4, TIDE_STONE.z]} maxDist={22} />
      <Label3D text={vi ? "Lối Triều → Đảo Hải Đăng" : "Tide Path → Lighthouse Isle"} position={[2, 1.6, 0]} maxDist={40} />
      <Label3D text={vi ? "Hải đăng Snell" : "Snell Lighthouse"} position={[LIGHTHOUSE.x, ISLE.top + LIGHTHOUSE.h + 3, LIGHTHOUSE.z]} maxDist={90} />
      <Label3D text={vi ? "Lăng kính" : "Prism"} position={[PRISM.x, ISLE.top + 2.2, PRISM.z]} maxDist={16} />
      <Label3D text={vi ? "Chuông Cộng hưởng" : "Resonance Bell"} position={[GANTRY.x, GANTRY.pivotY + 1, GANTRY.z]} maxDist={50} />
      <Label3D text={vi ? "Bia Chuông" : "Bell Stone"} position={[BELL_STONE.x, y(BELL_STONE.x, BELL_STONE.z) + 2.4, BELL_STONE.z]} maxDist={22} />
      <Label3D text={vi ? "Đầm Giao thoa" : "Interference Lagoon"} position={[(LAGOON.x0 + LAGOON.x1) / 2, 4, LAGOON.z1 + 1]} maxDist={60} />
      <Label3D text={vi ? "Cần đảo pha" : "Phase lever"} position={[LEVER.x, 3.4, LEVER.z]} maxDist={18} />
      <Label3D text={vi ? "Bia Đầm" : "Lagoon Stone"} position={[LAGOON_STONE.x, 3.6, LAGOON_STONE.z]} maxDist={20} />
      <Label3D text={vi ? "Hang Nàng Tiên Cá · Fourier Siren" : "Siren's Grotto · Fourier Siren"} position={[GROTTO.x, y(GROTTO.x, GROTTO.z) + 4.4, GROTTO.z]} maxDist={70} />
      <Label3D text={vi ? "Tời (chiều dài dây)" : "Winch (rope length)"} position={[WINCH.x, PIER.top + 1.9, WINCH.z]} maxDist={12} />
      <Label3D text={vi ? "Quả lắc nặng / nhẹ" : "Heavy / light bob"} position={[WEIGHTS.x, PIER.top + 1.9, WEIGHTS.z]} maxDist={12} />
    </group>
  );
}

function coastNearby(p: THREE.Vector3): Nearby | null {
  const vi = useWorld.getState().lang === "vi";
  const d = (q: { x: number; z: number }) => Math.hypot(p.x - q.x, p.z - q.z);
  if (d(PORTAL) < 2.3) return { kind: "portal", id: "hub", label: vi ? "Về Quảng trường" : "Back to the Plaza" };
  if (d(GROTTO) < 2.4)
    return { kind: "portal", id: "siren", label: vi ? "Vào Mê cung Hoạ âm — đấu Fourier Siren (boss tổ đội)" : "Enter the Labyrinth of Harmonics — face the Fourier Siren (co-op boss)" };
  if (d(TIDE_STONE) < 2.2) return { kind: "action", id: "coast:tide", label: vi ? "Đọc Bia Thuỷ triều" : "Read the Tide Stone" };
  if (d(LAGOON_STONE) < 2.0) return { kind: "action", id: "coast:lagoonStone", label: vi ? "Đọc Bia Đầm" : "Read the Lagoon Stone" };
  if (d(BELL_STONE) < 2.0) return { kind: "action", id: "coast:bellStone", label: vi ? "Đọc Bia Chuông" : "Read the Bell Stone" };
  if (d(LEVER) < 1.8) return { kind: "action", id: "coast:phase", label: vi ? (useCoast.getState().phi ? "Gạt cần: hai nguồn cùng pha" : "Gạt cần: lệch nguồn 2 nửa chu kỳ") : useCoast.getState().phi ? "Pull lever: sources in phase" : "Pull lever: shift source 2 by half a cycle" };
  if (d(WINCH) < 1.4) return { kind: "action", id: "coast:winch", label: vi ? "Quay tời: đổi chiều dài dây" : "Turn the winch: change rope length" };
  if (d(WEIGHTS) < 1.4) return { kind: "action", id: "coast:weight", label: vi ? "Đổi quả lắc nặng / nhẹ" : "Swap heavy / light bob" };
  if (d(PUSH_SPOT) < 1.5) return { kind: "action", id: "coast:push", label: vi ? "Đẩy con lắc" : "Push the pendulum" };
  if (Math.hypot(p.x - PRISM.x, p.z - PRISM.z) < 1.9) return { kind: "action", id: "coast:prism", label: vi ? "Xoay lăng kính 7,5°" : "Turn the prism 7.5°" };
  return null;
}
