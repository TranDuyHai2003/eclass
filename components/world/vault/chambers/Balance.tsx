"use client";
/**
 * Phòng II — Cân Archimedes: sảnh cân vàng – đá trên vực sương. Đòn cân 16 m trên điểm tựa, 14 khắc đánh số (cánh tay đòn),
 * Tảng Bổ đề trượt trên ray mép sau, đồng hồ nghiêng hình cung trên điểm tựa, cổng ra ở bệ phải sáng lên khi qua màn.
 * Góc nghiêng lấy từ server (θ) rồi làm mượt tại chỗ.
 */
import { useEffect, useMemo, useRef } from "react";
import { useFrame } from "@react-three/fiber";
import * as THREE from "three";
import { MagicCircle } from "../../fx/Effects";
import { toonMaterial } from "../../fx/shaders";
import { Label3D } from "../../ui/Labels";
import { useWorld } from "../../store";
import { BEAM, PLAT, STONE_Z, levelTol, type BState } from "@/lib/world/vault/balance";
import { useVault } from "../vaultClient";
import { FogSea } from "../vaultFx";
import { useVaultPropClone } from "../vaultProps";
import { CatapultCourt } from "./Catapult";

/** θ hiển thị (làm mượt) — Player dùng chung để đi trên đòn khớp hình */
export const BEAM_VIEW = { th: 0, sx: 0 };

/** bệ đá nổi (Blender vp_dais: 6,6 × 6,4, mặt trên y = 0) — khớp hộp va chạm PLAT */
function Dais({ x }: { x: number }) {
  const obj = useVaultPropClone("vp_dais");
  return obj ? <primitive object={obj} position={[x, BEAM.y, 0]} /> : null;
}

export function BalanceRoom() {
  const vi = useWorld((s) => s.lang === "vi");
  const m = useVault((s) => (s.run?.st as BState | null)?.m ?? 2);
  const mov = useVault((s) => !!(s.run?.st as BState | null)?.mov);
  const level = useVault((s) => {
    const st = s.run?.st as BState | null;
    return !!st && Math.abs(st.tau) < levelTol(st);
  });
  const cleared = useVault((s) => s.run?.phase === "clear" || s.run?.phase === "reveal");
  const catapult = useVault((s) => !!(s.run?.st as BState | null)?.cat);
  const beam = useRef<THREE.Group>(null);
  const stone = useRef<THREE.Group>(null);
  const needle = useRef<THREE.Group>(null);
  // model Blender: điểm tựa + cột, đòn cân (mặt trên y = 0), Tảng Bổ đề (thập nhị diện khắc ∎)
  const fulcrumObj = useVaultPropClone("vp_fulcrum");
  const beamObj = useVaultPropClone("vp_beam");
  const lemmaObj = useVaultPropClone("vp_lemma");
  const gateObj = useVaultPropClone("vp_gate");
  const mats = useMemo(
    () => ({
      brass: toonMaterial("#b9873a", { rim: "#ffe2a0" }),
      notch: new THREE.MeshBasicMaterial({ color: "#ffe3a0", toneMapped: false }),
      notchHot: new THREE.MeshBasicMaterial({ color: "#7fe0ff", toneMapped: false }),
      arc: new THREE.MeshBasicMaterial({ color: "#ffe3a0", transparent: true, opacity: 0.85, side: THREE.DoubleSide, toneMapped: false }),
    }),
    [],
  );
  useEffect(() => () => Object.values(mats).forEach((x) => x.dispose()), [mats]);
  const notches = useMemo(() => {
    const geo = new THREE.CylinderGeometry(0.26, 0.26, 0.05, 18);
    const list = [-7, -6, -5, -4, -3, -2, -1, 1, 2, 3, 4, 5, 6, 7];
    const im = new THREE.InstancedMesh(geo, mats.notch, list.length);
    const o = new THREE.Object3D();
    list.forEach((x, i) => {
      o.position.set(x, 0.03, 0);
      o.updateMatrix();
      im.setMatrixAt(i, o.matrix);
    });
    im.computeBoundingSphere();
    return { im, list };
  }, [mats]);
  useEffect(() => () => notches.im.geometry.dispose(), [notches]);

  useFrame((_, dt) => {
    const st = useVault.getState().run?.st as BState | null;
    if (!st || typeof st.th !== "number") return;
    const k = 1 - Math.exp(-dt * 12);
    BEAM_VIEW.th += (st.th - BEAM_VIEW.th) * k;
    BEAM_VIEW.sx += (st.sx - BEAM_VIEW.sx) * (1 - Math.exp(-dt * 8));
    if (beam.current) beam.current.rotation.z = -BEAM_VIEW.th;
    if (stone.current) stone.current.position.x = BEAM_VIEW.sx;
    if (needle.current) needle.current.rotation.z = -Math.max(-1.2, Math.min(1.2, BEAM_VIEW.th * 4.5));
  });

  return (
    <group>
      <FogSea y={-6} a="#1f1430" b="#7a4a3a" sky="#2b1a3d" />
      {/* màn 3: sân máy bắn đá phía sau đòn cân */}
      {catapult && <CatapultCourt />}
      {/* bệ trái (xuất phát) và bệ phải (lối ra) */}
      {[-1, 1].map((sd) => (
        <Dais key={sd} x={sd * (PLAT.x0 + PLAT.x1) * 0.5} />
      ))}
      {/* cổng ra (bệ phải) */}
      <group position={[PLAT.x1 - 0.6, BEAM.y, 0]}>
        {gateObj && <primitive object={gateObj} />}
        <mesh position={[0, 2, 0]} rotation-y={Math.PI / 2}>
          <planeGeometry args={[3.5, 3.9]} />
          <meshBasicMaterial color={cleared ? "#9fffd2" : "#ffd27a"} transparent opacity={cleared ? 0.55 : 0.18} side={THREE.DoubleSide} toneMapped={false} />
        </mesh>
      </group>
      {/* điểm tựa */}
      {fulcrumObj && <primitive object={fulcrumObj} position={[0, BEAM.y, 0]} />}
      {/* đòn cân + khắc + ray đá (xoay quanh điểm tựa) */}
      <group ref={beam} position={[0, BEAM.y, 0]}>
        {beamObj && <primitive object={beamObj} />}
        <primitive object={notches.im} />
        {notches.list.map((x) => (
          <Label3D key={x} text={String(Math.abs(x))} position={[x, 0.45, 0.7]} variant="small" maxDist={14} />
        ))}
        <mesh material={mats.notchHot} position={[0, 0.03, 0]}>
          <cylinderGeometry args={[0.18, 0.18, 0.06, 12]} />
        </mesh>
        {/* ray mép sau cho Tảng Bổ đề */}
        <mesh material={mats.brass} position={[0, -0.1, STONE_Z]}>
          <boxGeometry args={[BEAM.half * 2, 0.16, 0.9]} />
        </mesh>
        <group ref={stone} position={[0, 0, STONE_Z]}>
          {lemmaObj && <primitive object={lemmaObj} position={[0, 0.62 + m * 0.06, 0]} scale={0.55 + m * 0.07} rotation={[0.35, 0.6, 0]} />}
          <Label3D text={`${vi ? "Tảng Bổ đề" : "Lemma Stone"} · ${m}${mov ? (vi ? " · đẩy được (F)" : " · pushable (F)") : ""}`} position={[0, 1.9 + m * 0.1, 0]} variant="small" maxDist={22} />
        </group>
      </group>
      {/* đồng hồ nghiêng (màn 3 ẩn — che tầm nhìn sang sân máy bắn) */}
      {!catapult && (
        <group position={[0, BEAM.y + 5.2, -0.6]}>
          <mesh material={mats.arc} rotation-z={Math.PI * 0.12}>
            <ringGeometry args={[1.5, 1.62, 40, 1, 0, Math.PI * 0.76]} />
          </mesh>
          <group ref={needle}>
            <mesh material={mats.arc} position={[0, 0.8, 0]}>
              <boxGeometry args={[0.07, 1.6, 0.04]} />
            </mesh>
          </group>
          <MagicCircle vertical radius={0.5} position={[0, 0, -0.05]} color={level ? "#9fffd2" : "#ffb35c"} color2="#ffffff" intensity={level ? 1.6 : 0.6} spin={level ? 2 : 0.4} />
          <Label3D text={level ? (vi ? "THĂNG BẰNG" : "LEVEL") : vi ? "Lệch" : "Tilted"} position={[0, 2.3, 0]} variant={level ? "default" : "small"} maxDist={40} />
        </group>
      )}
      <hemisphereLight args={["#ffd9a8", "#2b1a3d", 0.9]} />
      <directionalLight position={[10, 18, 14]} intensity={1.6} color="#ffe0b0" />
      <pointLight position={[0, BEAM.y + 4, 3]} intensity={16} distance={20} color="#ffc070" decay={1.3} />
    </group>
  );
}
