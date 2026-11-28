"use client";
/**
 * Thunderstorms in the voxel Expanse (VOXEL_WORLD.md W4): every ~100 s a 35 s storm rolls in.
 * Lightning takes the easiest path to ground — it strikes the HIGHEST point nearby (and prefers conductors:
 * gold blocks). Standing on a peak gets you struck… unless you stand inside a Faraday cage: a shell of
 * conductive (gold) blocks around you carries the charge around the outside, so the field inside is zero.
 * Storm clock is derived from wall-clock time, so every player sees the same storm phase.
 */
import { useMemo, useRef } from "react";
import { useFrame, useThree } from "@react-three/fiber";
import * as THREE from "three";
import { useWorld } from "../store";
import { B, blockAt, columnTop, setBlock } from "@/lib/world/voxels";
import { ROLL_R, fulgurite, rollingSphereTarget, type StrikeCand } from "@/lib/world/lightning";
import { addFx, playerHurt } from "../combat/combat";
import { strike } from "../fx/StrikeFx";
import { floatText } from "../ui/Labels";
import { unlockNote } from "../story/quest";
import { sfx } from "@/lib/world/sfx";
import { createRng } from "@/lib/world/rng";

const PERIOD = 100_000;
const STORM = 35_000;
export function stormPhase(now = Date.now()): number {
  const t = now % PERIOD;
  return t < STORM ? t / STORM : -1;
}

/** Lồng Faraday: đếm khối vàng trên lớp vỏ 3×4×3 quanh người chơi (≥ 14 khối ≈ bao kín) */
function inFaradayCage(x: number, y: number, z: number): boolean {
  const ix = Math.floor(x);
  const iy = Math.floor(y);
  const iz = Math.floor(z);
  let gold = 0;
  for (let dx = -1; dx <= 1; dx++)
    for (let dz = -1; dz <= 1; dz++)
      for (let dy = -1; dy <= 2; dy++) {
        const shell = Math.abs(dx) === 1 || Math.abs(dz) === 1 || dy === -1 || dy === 2;
        if (shell && blockAt(ix + dx, iy + dy, iz + dz) === B.gold) gold++;
      }
  return gold >= 14;
}

const RAIN = 260;
export function Storm() {
  const { camera } = useThree();
  const rain = useRef<THREE.InstancedMesh>(null);
  const dome = useRef<THREE.Mesh>(null);
  const nextStrike = useRef(0);
  const drops = useMemo(() => {
    // Ngẫu nhiên có hạt (render thuần)
    const r = createRng(1234);
    return Array.from({ length: RAIN }, () => new THREE.Vector3((r.next() - 0.5) * 40, r.next() * 30, (r.next() - 0.5) * 40));
  }, []);
  const M = useMemo(() => new THREE.Matrix4(), []);
  const Q = useMemo(() => new THREE.Quaternion().setFromAxisAngle(new THREE.Vector3(1, 0, 0), 0.2), []);
  const S = useMemo(() => new THREE.Vector3(0.02, 0.9, 0.02), []);
  const P = useMemo(() => new THREE.Vector3(), []);
  useFrame((_, rawDt) => {
    const dt = Math.min(0.05, rawDt);
    const ph = stormPhase();
    const on = ph >= 0;
    // Bầu trời tối dần ở đầu cơn bão và sáng lại ở cuối
    const dark = on ? Math.min(1, ph * 6, (1 - ph) * 6) : 0;
    if (dome.current) {
      dome.current.visible = dark > 0.01;
      (dome.current.material as THREE.MeshBasicMaterial).opacity = dark * 0.42;
      dome.current.position.copy(camera.position);
    }
    if (rain.current) {
      rain.current.visible = dark > 0.05;
      if (rain.current.visible) {
        for (let i = 0; i < RAIN; i++) {
          const d = drops[i];
          d.y -= dt * 24;
          if (d.y < -4) d.y += 32;
          P.set(camera.position.x + d.x, camera.position.y + d.y - 8, camera.position.z + d.z);
          M.compose(P, Q, S);
          rain.current.setMatrixAt(i, M);
        }
        rain.current.instanceMatrix.needsUpdate = true;
      }
    }
    if (!on || dark < 0.6) return;
    const now = performance.now();
    if (now < nextStrike.current) return;
    nextStrike.current = now + 2600 + Math.random() * 2600;
    // Tia tiên đạo hạ xuống gần người chơi; điểm bị đánh theo MÔ HÌNH QUẢ CẦU LĂN (lib/world/lightning):
    // vật cao + dẫn điện (vàng) gần tia hứng sét trước — cột thu lôi vàng tự xây che chở vùng quanh chân nó.
    const p = useWorld.getState().player;
    const lx = p.x + (Math.random() - 0.5) * 12;
    const lz = p.z + (Math.random() - 0.5) * 12;
    const cands: StrikeCand[] = [];
    for (let dx = -ROLL_R; dx <= ROLL_R; dx++)
      for (let dz = -ROLL_R; dz <= ROLL_R; dz++) {
        const x = Math.floor(lx) + dx;
        const z = Math.floor(lz) + dz;
        const top = columnTop(x, z);
        cands.push({ x: x + 0.5, z: z + 0.5, top, conductor: blockAt(x, top - 1, z) === B.gold });
      }
    cands.push({ x: p.x, z: p.z, top: p.y + 1.8, player: true });
    const hit = cands[Math.max(0, rollingSphereTarget(cands, lx, lz))];
    const at = new THREE.Vector3(hit.x, hit.top, hit.z);
    addFx("bolt", at.clone().setY(at.y + 34), { to: at.clone(), color: "#c8dcff" });
    addFx("bolt", at.clone().add(new THREE.Vector3(2, 30, -1)), { to: at.clone(), color: "#ffffff" });
    // sét đánh đất: vết cháy phân nhánh Lichtenberg (khác đứt gãy của đòn tròn)
    strike("scorch", at.x, at.y + 0.05, at.z, { r: 2.2, n: 5, color: "#c8dcff" });
    useWorld.getState().addShake(0.35);
    useWorld.getState().burst([at.x, at.y + 0.3, at.z], "#c8dcff", 30);
    sfx.shatter();
    // Sét xuống cát: nung chảy thành ống thuỷ tinh (fulgurite) — đổi khối tại máy (không gửi mạng)
    if (!hit.player) {
      const bx = Math.floor(hit.x);
      const bz = Math.floor(hit.z);
      const ys = fulgurite(hit.top, (y) => blockAt(bx, y, bz) === B.sand);
      ys.forEach((y) => setBlock(bx, y, bz, B.glass, true));
      if (ys.length) floatText(at.clone().setY(at.y + 1.2), "Fulgurite · cát → thuỷ tinh", "info");
      // cột thu lôi: người đứng gần chân cột mà sét vào cột → an toàn
      if (hit.conductor && Math.hypot(at.x - p.x, at.z - p.z) < ROLL_R && hit.top > p.y + 2) floatText(p.clone().setY(p.y + 2.2), "Cột thu lôi che chở ✓", "info");
    }
    // Trúng người chơi khi chính người là điểm quả cầu chạm trước (hoặc sét rơi sát chân)
    if (hit.player || Math.hypot(at.x - p.x, at.z - p.z) < 1.2) {
      if (inFaradayCage(p.x, p.y, p.z)) {
        floatText(p.clone().setY(p.y + 2.2), "Faraday ✓", "info");
        unlockNote("faraday");
      } else playerHurt(28);
    }
  });
  return (
    <>
      <mesh ref={dome} visible={false} renderOrder={-1}>
        <sphereGeometry args={[60, 24, 12]} />
        <meshBasicMaterial color="#141832" transparent opacity={0} side={THREE.BackSide} depthWrite={false} fog={false} />
      </mesh>
      <instancedMesh ref={rain} args={[undefined, undefined, RAIN]} frustumCulled={false} visible={false}>
        <boxGeometry args={[1, 1, 1]} />
        <meshBasicMaterial color="#bcd2ff" transparent opacity={0.45} depthWrite={false} />
      </instancedMesh>
    </>
  );
}
