"use client";
/**
 * Phòng II · màn 3 — Máy bắn đá: sân đá phía sau đòn cân, bập bênh 6 m (bệ đáp đầu ngắn / ghế bắn đầu dài), điểm tựa trượt
 * theo 3 ổ (cần gạt), tháp gió + cột gió trên bệ đáp, hai chuông A (4,5 m) / B (9 m) treo quanh cột bay trên ghế, thước đo
 * độ cao + vạch "cú bắn vừa rồi", Quả cân Bổ đề (nặng 1) bay khi ghế trống.
 * HÌNH THỦ TỤC TẠM (chờ mô hình Blender — bảng tên node ở docs/ai-reviews/game-3d/PLAN.md T13). Vị trí / kích thước khớp
 * hằng số trong lib/world/vault/balance.ts (CAT, COURT, TOWER, LEVER, SW_H).
 */
import { useEffect, useMemo, useRef } from "react";
import { useFrame } from "@react-three/fiber";
import * as THREE from "three";
import { toonMaterial } from "../../fx/shaders";
import { Label3D } from "../../ui/Labels";
import { Updrafts } from "../../scene/Props";
import { useWorld } from "../../store";
import { BEAM, CAT, COURT, G_UP, LEVER, SOCKETS, SW_H, TOWER, catArms, type BState } from "@/lib/world/vault/balance";
import { UI, tx } from "@/lib/world/vault/text";
import { useVault, vaultNow } from "../vaultClient";
import { useVaultPropClone } from "../vaultProps";

const fmt = (x: number, vi: boolean) => (vi ? x.toFixed(1).replace(".", ",") : x.toFixed(1));
const ratio = (i: number, vi: boolean) => (vi ? SOCKETS[i].toFixed(2).replace(".", ",") : SOCKETS[i].toFixed(2));
/** thời gian bay của vật được bắn lên với vận tốc v (lên + xuống) */
const flightT = (v: number) => (2 * v) / G_UP;

export function CatapultCourt() {
  // mô hình Blender (vault_props.glb: vp_cat_*); thiếu node → hình tạm bên dưới
  const mCourt = useVaultPropClone("vp_cat_court");
  const mBeam = useVaultPropClone("vp_cat_beam");
  const mTower = useVaultPropClone("vp_cat_tower");
  const mWeight = useVaultPropClone("vp_cat_weight");
  const mLeverBase = useVaultPropClone("vp_cat_lever_base");
  const mLeverHandle = useVaultPropClone("vp_cat_lever_handle");
  const mRuler = useVaultPropClone("vp_cat_ruler");
  const vi = useWorld((s) => s.lang === "vi");
  const sock = useVault((s) => (s.run?.st as BState | null)?.cat?.sock ?? 1);
  const swA = useVault((s) => !!(s.run?.st as BState | null)?.cat?.sw[0]);
  const swB = useVault((s) => !!(s.run?.st as BState | null)?.cat?.sw[1]);
  const launch = useVault((s) => (s.run?.st as BState | null)?.cat?.launch ?? null);
  const hintLv = useVault((s) => s.run?.hint.lv ?? 0);
  const beam = useRef<THREE.Group>(null);
  const fulcrum = useRef<THREE.Group>(null);
  const weight = useRef<THREE.Group>(null);
  const handle = useRef<THREE.Group>(null);
  const farGlow = useRef<THREE.Mesh>(null);
  const view = useRef({ fx: catArms(1).fx, ang: 0 });
  const updraftList = useMemo(() => [{ x: CAT.padX, z: CAT.z, r: CAT.upR, top: CAT.top, y: CAT.y }], []);
  const mats = useMemo(
    () => ({
      stone: toonMaterial("#5d4a63", { rim: "#ffcf8a" }),
      stoneDark: toonMaterial("#3a2c44", { rim: "#ffcf8a" }),
      wood: toonMaterial("#9a6a3c", { rim: "#ffe2a0" }),
      brass: toonMaterial("#c8963f", { rim: "#fff0c0" }),
      weight: toonMaterial("#6f7fae", { rim: "#d8e6ff" }),
      pad: new THREE.MeshBasicMaterial({ color: "#ff9a4a", toneMapped: false }),
      seat: new THREE.MeshBasicMaterial({ color: "#6fe3ff", toneMapped: false }),
      tick: new THREE.MeshBasicMaterial({ color: "#ffe3a0", toneMapped: false }),
      sockOff: new THREE.MeshBasicMaterial({ color: "#8a7356", toneMapped: false }),
      sockOn: new THREE.MeshBasicMaterial({ color: "#ffe3a0", toneMapped: false }),
      far: new THREE.MeshBasicMaterial({ color: "#7fffd0", transparent: true, opacity: 0.5, toneMapped: false, depthWrite: false }),
      mark: new THREE.MeshBasicMaterial({ color: "#ffffff", transparent: true, opacity: 0.7, side: THREE.DoubleSide, toneMapped: false, depthWrite: false }),
    }),
    [],
  );
  useEffect(() => () => Object.values(mats).forEach((m) => m.dispose()), [mats]);
  const bellMat = useMemo(() => [0, 1].map(() => new THREE.MeshBasicMaterial({ color: "#a08050", toneMapped: false })), []);
  useEffect(() => () => bellMat.forEach((m) => m.dispose()), [bellMat]);
  useEffect(() => {
    bellMat[0].color.set(swA ? "#7fffd0" : "#e0b860");
    bellMat[1].color.set(swB ? "#7fffd0" : swA ? "#e0b860" : "#6b6070");
  }, [bellMat, swA, swB]);

  useFrame((_, dt) => {
    const v = view.current;
    const tgt = catArms(sock).fx;
    v.fx += (tgt - v.fx) * (1 - Math.exp(-dt * 6));
    if (fulcrum.current) fulcrum.current.position.x = v.fx;
    // nghiêng để nhìn: lúc bắn đầu ngắn đập xuống (đầu dài vọt lên) rồi lò xo về ngang — mặt đứng vẫn phẳng (va chạm)
    const t = launch ? (vaultNow() - launch.at) / 1000 : 99;
    const want = t >= 0 && t < 1.4 ? 0.2 * Math.exp(-t * 3) * Math.cos(t * 9) : 0;
    v.ang += (want - v.ang) * (1 - Math.exp(-dt * 30));
    if (beam.current) {
      beam.current.position.x = v.fx;
      beam.current.rotation.z = v.ang;
    }
    // Quả cân Bổ đề bay khi ghế trống
    if (weight.current) {
      let y = 0;
      if (launch && launch.by === -1 && t >= 0 && t < flightT(launch.v)) y = Math.max(0, launch.v * t - 0.5 * G_UP * t * t);
      weight.current.position.y = CAT.y + 0.3 + y;
      weight.current.rotation.y += dt * (y > 0 ? 6 : 0.4);
    }
    if (handle.current) handle.current.rotation.x += ((sock - 1) * 0.6 - handle.current.rotation.x) * (1 - Math.exp(-dt * 8));
    if (farGlow.current) {
      farGlow.current.visible = hintLv >= 3;
      farGlow.current.scale.setScalar(1 + Math.sin(performance.now() / 260) * 0.12);
    }
  });

  const ticks = useMemo(() => Array.from({ length: 11 }, (_, i) => i), []);
  const showMark = !!launch;
  const need = !swA ? SW_H[0] : SW_H[1];
  return (
    <group>
      {/* sân đá */}
      {mCourt ? (
        <primitive object={mCourt} position={[(COURT.x0 + COURT.x1) / 2, BEAM.y, (COURT.z0 + COURT.z1) / 2]} />
      ) : (
        <>
          <mesh material={mats.stone} position={[(COURT.x0 + COURT.x1) / 2, BEAM.y - 0.35, (COURT.z0 + COURT.z1) / 2]}>
            <boxGeometry args={[COURT.x1 - COURT.x0, 0.7, COURT.z1 - COURT.z0]} />
          </mesh>
          <mesh material={mats.stoneDark} position={[(COURT.x0 + COURT.x1) / 2, BEAM.y - 2.2, (COURT.z0 + COURT.z1) / 2]}>
            <cylinderGeometry args={[4, 1.2, 3, 6]} />
          </mesh>
        </>
      )}
      {/* chân bập bênh (bệ đỡ dài dưới đòn) */}
      <mesh material={mats.stoneDark} position={[0, BEAM.y + 0.08, CAT.z]}>
        <boxGeometry args={[CAT.half * 2 + 0.4, 0.16, 1.2]} />
      </mesh>
      {/* 3 ổ điểm tựa: đĩa trên sân cạnh đòn + tỉ số d₂/d₁ */}
      {SOCKETS.map((_, i) => {
        const a = catArms(i);
        return (
          <group key={i} position={[a.fx, BEAM.y + 0.02, CAT.z + 1.35]}>
            <mesh material={i === sock ? mats.sockOn : mats.sockOff}>
              <cylinderGeometry args={[0.22, 0.22, 0.05, 16]} />
            </mesh>
            <Label3D text={`${tx(UI.sockN, vi)} ${i + 1} · d₂/d₁ = ${ratio(i, vi)}`} position={[0, 0.5, 0.2]} variant="small" maxDist={14} />
          </group>
        );
      })}
      <mesh ref={farGlow} material={mats.far} position={[catArms(2).fx, BEAM.y + 0.04, CAT.z + 1.35]} rotation-x={-Math.PI / 2} visible={false}>
        <ringGeometry args={[0.3, 0.55, 24]} />
      </mesh>
      {/* điểm tựa (nêm đồng) */}
      <group ref={fulcrum} position={[catArms(1).fx, BEAM.y + 0.16, CAT.z]}>
        <mesh material={mats.brass} position={[0, 0.2, 0]} rotation-y={Math.PI / 4}>
          <coneGeometry args={[0.42, 0.42, 4]} />
        </mesh>
      </group>
      {/* đòn bập bênh: nhóm xoay quanh điểm tựa; ván + bệ đáp (cam) + ghế bắn (xanh) */}
      <group ref={beam} position={[catArms(1).fx, CAT.y, CAT.z]}>
        <BeamParts mats={mats} plank={mBeam} />
      </group>
      {/* Quả cân Bổ đề (cạnh ghế, cùng cánh tay đòn) */}
      <group ref={weight} position={[CAT.seatX, CAT.y + 0.3, CAT.z - 0.62]}>
        {mWeight ? (
          <primitive object={mWeight} />
        ) : (
          <mesh material={mats.weight}>
            <boxGeometry args={[0.5, 0.5, 0.5]} />
          </mesh>
        )}
        <Label3D text={`${tx(UI.weight, vi)} · 1`} position={[0, 0.75, 0]} variant="small" maxDist={12} />
      </group>
      {/* tháp gió + vương miện quanh đỉnh cột gió */}
      {mTower && <primitive object={mTower} position={[TOWER.x, BEAM.y, TOWER.z]} />}
      {!mTower && <mesh material={mats.stoneDark} position={[TOWER.x, BEAM.y + (CAT.top - BEAM.y) / 2, TOWER.z]}>
        <cylinderGeometry args={[TOWER.r * 0.75, TOWER.r, CAT.top - BEAM.y, 8]} />
      </mesh>}
      {!mTower && [0.25, 0.5, 0.75].map((f) => (
        <mesh key={f} material={mats.brass} position={[TOWER.x, BEAM.y + (CAT.top - BEAM.y) * f, TOWER.z]} rotation-x={Math.PI / 2}>
          <torusGeometry args={[TOWER.r * 0.95, 0.07, 6, 20]} />
        </mesh>
      ))}
      {!mTower && <mesh material={mats.brass} position={[(TOWER.x + CAT.padX) / 2 - 0.3, CAT.top + 0.1, CAT.z]}>
        <boxGeometry args={[Math.abs(TOWER.x - CAT.padX) - 0.6, 0.18, 0.3]} />
      </mesh>}
      {!mTower && <mesh material={mats.brass} position={[CAT.padX, CAT.top + 0.1, CAT.z]} rotation-x={Math.PI / 2}>
        <torusGeometry args={[CAT.upR + 0.15, 0.09, 8, 32]} />
      </mesh>}
      <Label3D text={vi ? `Đỉnh cột gió · ${CAT.up} m` : `Updraft top · ${CAT.up} m`} position={[CAT.padX, CAT.top + 0.9, CAT.z]} variant="small" maxDist={30} />
      <Updrafts list={updraftList} />
      {/* chuông A / B quanh cột bay trên ghế */}
      {SW_H.map((h, i) => (
        <group key={i} position={[CAT.seatX, CAT.y + h, CAT.z]}>
          <mesh material={bellMat[i]} rotation-x={Math.PI / 2}>
            <torusGeometry args={[1.05, 0.08, 8, 36]} />
          </mesh>
          <mesh material={bellMat[i]} position={[0, 0.45, -1.15]}>
            <sphereGeometry args={[0.28, 14, 10]} />
          </mesh>
          <Label3D
            text={`${tx(UI.bell, vi)} ${i ? "B" : "A"} · ${fmt(h, vi)} m${i === 1 && !swA ? ` · ${tx(UI.sealed, vi)}` : ""}${(i ? swB : swA) ? " ✓" : ""}`}
            position={[0, 1.1, -1.15]}
            variant="small"
            maxDist={40}
          />
        </group>
      ))}
      {/* thước đo độ cao (vạch mỗi mét) */}
      <group position={[CAT.seatX + 1.6, CAT.y, CAT.z - 1.3]}>
        {mRuler && <primitive object={mRuler} />}
        {!mRuler && <mesh material={mats.wood} position={[0, 5, 0]}>
          <boxGeometry args={[0.12, 10, 0.12]} />
        </mesh>}
        {!mRuler && ticks.map((i) => (
          <mesh key={i} material={mats.tick} position={[0.16, i, 0]}>
            <boxGeometry args={[i % 5 === 0 ? 0.4 : 0.22, 0.04, 0.04]} />
          </mesh>
        ))}
      </group>
      {/* vạch cú bắn vừa rồi (phấn) */}
      {showMark && launch && (
        <group position={[CAT.seatX, CAT.y + launch.h, CAT.z]}>
          <mesh material={mats.mark} rotation-x={-Math.PI / 2}>
            <ringGeometry args={[0.7, 0.78, 32]} />
          </mesh>
          <Label3D text={`${fmt(launch.h, vi)} m / ${tx(UI.need, vi)} ${fmt(need, vi)} m`} position={[1.9, 0.2, -1.3]} variant="small" maxDist={40} />
        </group>
      )}
      {/* cần gạt điểm tựa */}
      <group position={[LEVER.x, BEAM.y, LEVER.z]}>
        {mLeverBase ? (
          <primitive object={mLeverBase} />
        ) : (
          <mesh material={mats.stoneDark} position={[0, 0.45, 0]}>
            <boxGeometry args={[0.9, 0.9, 0.6]} />
          </mesh>
        )}
        <group ref={handle} position={[0, 0.9, 0]}>
          {mLeverHandle ? (
            <primitive object={mLeverHandle} />
          ) : (
            <>
              <mesh material={mats.brass} position={[0, 0.5, 0]}>
                <cylinderGeometry args={[0.05, 0.05, 1, 8]} />
              </mesh>
              <mesh material={mats.pad} position={[0, 1.02, 0]}>
                <sphereGeometry args={[0.12, 12, 8]} />
              </mesh>
            </>
          )}
        </group>
        <Label3D text={`${tx(UI.fulcrum, vi)} · ${tx(UI.sockN, vi)} ${sock + 1}/3 (F)`} position={[0, 2.4, 0]} variant="small" maxDist={18} />
      </group>
      <pointLight position={[0, CAT.y + 6, CAT.z + 3]} intensity={14} distance={24} color="#ffc98a" decay={1.3} />
    </group>
  );
}

/** Ván đòn + hai đầu (toạ độ theo trục quay; nhóm cha dời theo điểm tựa nên ván dời ngược lại) */
function BeamParts({ mats, plank }: { mats: Record<string, THREE.Material>; plank: THREE.Object3D | null }) {
  const g = useRef<THREE.Group>(null);
  useFrame(() => {
    const p = g.current?.parent;
    if (g.current && p) g.current.position.x = -p.position.x;
  });
  return (
    <group ref={g}>
      {plank ? (
        <primitive object={plank} />
      ) : (
        <mesh material={mats.wood} position={[0, -0.12, 0]}>
          <boxGeometry args={[CAT.half * 2, 0.24, CAT.w * 2]} />
        </mesh>
      )}
      <mesh material={mats.pad} position={[CAT.padX, 0.015, 0]}>
        <cylinderGeometry args={[CAT.padR * 0.8, CAT.padR * 0.8, 0.03, 28]} />
      </mesh>
      <mesh material={mats.seat} position={[CAT.seatX, 0.015, 0]}>
        <cylinderGeometry args={[CAT.seatR * 0.8, CAT.seatR * 0.8, 0.03, 28]} />
      </mesh>
    </group>
  );
}
