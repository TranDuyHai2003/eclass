"use client";
/**
 * Bờ Sóng — Chuông Cộng hưởng trên cầu phao. Cầu phao (và giá treo) lắc ngang theo sóng lừng x_p = X·sin(2πt/3);
 * con lắc mô phỏng bằng RK4 bước cố định 1/120 s theo ĐỒNG HỒ CHUNG (lib/world/waves.ts: stepPend) → mọi máy lắc giống nhau
 * nếu cùng chiều dài + cùng cú đẩy. Tời đổi chiều dài (5 nấc), giá quả lắc đổi quả nặng / nhẹ (không đổi gì — à há),
 * bấm F cạnh khung để đẩy. Hai thanh chuông ở ±0,62 rad (bellStrike).
 */
import { useEffect, useMemo } from "react";
import { useFrame } from "@react-three/fiber";
import * as THREE from "three";
import { GANTRY, PONTOON, WEIGHTS, WINCH } from "@/lib/world/coastWorld";
import { BELL_ANGLE, PEND_H, bellStrike, coastClock, pivotX, stepPend } from "@/lib/world/waves";
import { curLength, pend, useCoast } from "./coastState";
import { bellRang } from "./coastGame";
import { GlbOr, glow, toon, useCoastGlb } from "./CoastProps";

const TOP = PONTOON.top;
const H = GANTRY.pivotY - TOP;
const TMP = new THREE.Vector3();

/** chạy mô phỏng tới thời điểm chung t (gọi mỗi khung) */
export function advancePendulum(t: number) {
  if (pend.simT < 0 || Math.abs(t - pend.simT) > 2) {
    // mới vào / tab ngủ lâu / đồng hồ quấn 240 s: bắt kịp ngay (không mô phỏng bù hàng nghìn bước)
    if (pend.simT >= 0 && t < pend.simT && pend.simT - t > 200) pend.simT -= 240;
    else pend.simT = t;
  }
  const L = curLength();
  const m = useCoast.getState().heavy ? 40 : 0.3;
  let n = 0;
  while (pend.simT + PEND_H <= t && n < 240) {
    stepPend(pend, L, m, pend.simT);
    pend.simT += PEND_H;
    n++;
    const s = bellStrike(pend);
    if (s) pend.side = s;
  }
}

export function ResonanceBell() {
  const glb = useCoastGlb();
  const parts = useMemo(() => {
    const sway = new THREE.Group();
    const swing = new THREE.Group();
    const rope = new THREE.Mesh(new THREE.CylinderGeometry(0.025, 0.025, 1, 6).translate(0, -0.5, 0), toon("#d9c7a0"));
    const bob = new THREE.Group();
    const chimes = [new THREE.Group(), new THREE.Group()];
    return { sway, swing, rope, bob, chimes };
  }, []);
  useEffect(() => () => parts.rope.geometry.dispose(), [parts]);
  const heavy = useCoast((s) => s.heavy);
  const lenIdx = useCoast((s) => s.lenIdx);

  useFrame(() => {
    const t = coastClock(Date.now());
    advancePendulum(t);
    const L = curLength();
    parts.sway.position.x = pivotX(t);
    parts.swing.rotation.z = pend.th;
    parts.rope.scale.y = L;
    parts.bob.position.y = -L;
    // chuông: cùng bán kính L với quả lắc, ở ±BELL_ANGLE
    parts.chimes.forEach((c, i) => {
      const a = (i ? -1 : 1) * BELL_ANGLE;
      c.position.set(Math.sin(a) * (L + 0.05), -Math.cos(a) * (L + 0.05), 0);
      c.rotation.z = a;
    });
    // vừa chạm: rung + báo sự kiện
    if (pend.side) {
      const side = pend.side;
      pend.side = 0;
      const now = performance.now();
      if (now - pend.ringAt > 400) {
        pend.ringAt = now;
        const c = parts.chimes[side > 0 ? 0 : 1];
        c.getWorldPosition(TMP);
        bellRang(TMP, useCoast.getState().goodPush > 0 && pend.simT - pend.pushAt < 6);
      }
    }
    const since = performance.now() - useCoast.getState().bellAt;
    for (const c of parts.chimes) c.scale.setScalar(1 + Math.max(0, 1 - since / 500) * 0.25 * Math.sin(since / 25));
  });

  const bobR = heavy ? 0.36 : 0.2;
  return (
    <group>
      {/* giá treo + chuông lắc cùng cầu phao */}
      <primitive object={parts.sway}>
        <group position={[GANTRY.x, TOP, GANTRY.z]}>
          <GlbOr glb={glb} name="cw_gantry">
            {[-1, 1].map((s) => (
              <mesh key={s} material={toon("#7a5a3c")} position={[0, H / 2, s * GANTRY.post]}>
                <boxGeometry args={[0.26, H, 0.26]} />
              </mesh>
            ))}
            <mesh material={toon("#7a5a3c")} position={[0, H, 0]}>
              <boxGeometry args={[0.3, 0.3, GANTRY.post * 2 + 0.5]} />
            </mesh>
          </GlbOr>
          <primitive object={parts.swing} position={[0, H, 0]}>
            <primitive object={parts.rope} />
            <primitive object={parts.bob}>
              {/* quả lắc: vỏ ốc nhẹ / neo đá nặng — node GLB cw_bob_light / cw_bob_heavy, gốc ở móc treo */}
              <GlbOr key={heavy ? "h" : "l"} glb={glb} name={heavy ? "cw_bob_heavy" : "cw_bob_light"}>
                <mesh material={heavy ? toon("#6e6a76") : toon("#f3d3c1")} position={[0, -bobR, 0]}>
                  {heavy ? <dodecahedronGeometry args={[bobR, 0]} /> : <sphereGeometry args={[bobR, 14, 10]} />}
                </mesh>
              </GlbOr>
            </primitive>
            {parts.chimes.map((c, i) => (
              <primitive key={i} object={c}>
                <GlbOr glb={glb} name="cw_chime">
                  <mesh material={glow("#ffd27a", 1.8)} position={[0, 0, 0]}>
                    <boxGeometry args={[0.14, 0.7, 0.5]} />
                  </mesh>
                </GlbOr>
              </primitive>
            ))}
          </primitive>
        </group>
      </primitive>
      {/* tời (5 nấc dây) + giá quả lắc */}
      <GlbOr glb={glb} name="cw_winch" position={[WINCH.x, TOP, WINCH.z]}>
        <mesh material={toon("#5d4a3a")} position={[0, 0.45, 0]}>
          <boxGeometry args={[0.7, 0.9, 0.7]} />
        </mesh>
        <mesh material={toon("#c8b48a")} position={[0, 0.95, 0]} rotation-x={Math.PI / 2}>
          <cylinderGeometry args={[0.28, 0.28, 0.6, 12]} />
        </mesh>
        {Array.from({ length: 5 }, (_, i) => (
          <mesh key={i} material={i === lenIdx ? glow("#7cf0ff", 2) : toon("#3a3340")} position={[-0.36, 0.2 + i * 0.13, 0]}>
            <boxGeometry args={[0.04, 0.08, 0.3]} />
          </mesh>
        ))}
      </GlbOr>
      <GlbOr glb={glb} name="cw_weight_rack" position={[WEIGHTS.x, TOP, WEIGHTS.z]}>
        <mesh material={toon("#5d4a3a")} position={[0, 0.35, 0]}>
          <boxGeometry args={[1.0, 0.7, 0.5]} />
        </mesh>
        <mesh material={toon(heavy ? "#f3d3c1" : "#6e6a76")} position={[0, 0.9, 0]}>
          {heavy ? <sphereGeometry args={[0.2, 12, 8]} /> : <dodecahedronGeometry args={[0.32, 0]} />}
        </mesh>
      </GlbOr>
    </group>
  );
}
