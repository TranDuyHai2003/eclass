"use client";
/**
 * Bờ Sóng — đạo cụ. Hiện là CHỖ GIỮ thủ tục (khối cơ bản, toon 2 tông, phần phát sáng HDR). Khi có
 * `public/world/coast/coast_props.glb` (dựng ở Blender — bảng node trong PLAN.md T20) thì mỗi node cùng tên thay chỗ giữ:
 * <GlbOr name="cw_lighthouse" …> tự dùng node GLB (toonize) nếu có, không có thì vẽ chỗ giữ. Thiếu file → im lặng dùng chỗ giữ.
 */
import { useEffect, useMemo, useState, type ReactNode } from "react";
import { useFrame, type ThreeElements } from "@react-three/fiber";
import * as THREE from "three";
import { GLTFLoader } from "three/examples/jsm/loaders/GLTFLoader.js";
import { worldAsset } from "@/lib/world/avatars";
import { toonize } from "../../fx/glbToon";
import { GRADIENT } from "../../fx/shaders";
import { BELL_STONE, GROTTO, LAGOON_STONE, LEVER, PIER, PONTOON, PORTAL, SOURCE_R, TIDE_STONE } from "@/lib/world/coastWorld";
import { LAGOON, LAG_K, LAG_W, coastClock } from "@/lib/world/waves";
import { useCoast } from "./coastState";
import { rockSpots } from "./coastTerrain";

export const COAST_GLB = worldAsset("coast/coast_props.glb");
let glbP: Promise<THREE.Object3D | null> | null = null;
/** GLB đạo cụ của vùng (null khi chưa có file) */
export function useCoastGlb(): THREE.Object3D | null {
  const [o, set] = useState<THREE.Object3D | null>(null);
  useEffect(() => {
    if (!glbP)
      glbP = new GLTFLoader()
        .loadAsync(COAST_GLB)
        .then((g) => g.scene)
        .catch(() => null);
    let alive = true;
    void glbP.then((s) => alive && set(s));
    return () => {
      alive = false;
    };
  }, []);
  return o;
}
export function GlbOr({ glb, name, children, ...rest }: { glb: THREE.Object3D | null; name: string; children: ReactNode } & ThreeElements["group"]) {
  const node = useMemo(() => {
    const src = glb?.getObjectByName(name);
    return src ? toonize(src) : null;
  }, [glb, name]);
  return <group {...rest}>{node ? <primitive object={node} /> : children}</group>;
}

const cache = new Map<string, THREE.Material>();
export function toon(color: string): THREE.Material {
  let m = cache.get(color);
  if (!m) cache.set(color, (m = new THREE.MeshToonMaterial({ color, gradientMap: GRADIENT })));
  return m;
}
export function glow(color: string, k = 2): THREE.Material {
  const key = `g${color}${k}`;
  let m = cache.get(key);
  if (!m) cache.set(key, (m = new THREE.MeshBasicMaterial({ color: new THREE.Color(color).multiplyScalar(k), toneMapped: false })));
  return m;
}

/** bia đá có mặt chữ phát sáng (Bia Thuỷ triều / Bia Đầm / Bia Chuông) */
function Stele({ x, z, y, rot = 0, accent }: { x: number; z: number; y: number; rot?: number; accent: string }) {
  return (
    <group position={[x, y, z]} rotation-y={rot}>
      <mesh material={toon("#a7a2b4")} position={[0, 0.9, 0]}>
        <boxGeometry args={[1.0, 1.8, 0.32]} />
      </mesh>
      <mesh material={glow(accent, 1.6)} position={[0, 1.05, 0.17]}>
        <planeGeometry args={[0.7, 0.9]} />
      </mesh>
    </group>
  );
}

export function CoastStatics({ ground }: { ground: (x: number, z: number) => number }) {
  const glb = useCoastGlb();
  const rocks = useMemo(() => {
    const spots = rockSpots();
    const geo = new THREE.DodecahedronGeometry(1, 0);
    const im = new THREE.InstancedMesh(geo, toon("#8b8796"), spots.length);
    const m = new THREE.Matrix4();
    const q = new THREE.Quaternion();
    spots.forEach(([x, y, z, s], i) => {
      q.setFromEuler(new THREE.Euler(x * 0.7, z * 1.3, x * z * 0.01));
      im.setMatrixAt(i, m.compose(new THREE.Vector3(x, y - s * 0.3, z), q, new THREE.Vector3(s, s * 0.8, s)));
    });
    im.instanceMatrix.needsUpdate = true;
    im.computeBoundingSphere();
    return { im, geo };
  }, []);
  useEffect(() => () => rocks.geo.dispose(), [rocks]);
  const pierLen = PIER.x1 - PIER.x0;
  const posts = useMemo(() => {
    const out: [number, number][] = [];
    for (let x = PIER.x0 + 1; x <= PIER.x1; x += 3) for (const z of [PIER.z0 + 0.2, PIER.z1 - 0.2]) out.push([x, z]);
    return out;
  }, []);
  return (
    <group>
      <primitive object={rocks.im} />
      {/* cầu tàu gỗ */}
      <GlbOr glb={glb} name="cw_pier" position={[(PIER.x0 + PIER.x1) / 2, PIER.top, (PIER.z0 + PIER.z1) / 2]}>
        <mesh material={toon("#a0774f")} position={[0, -0.12, 0]}>
          <boxGeometry args={[pierLen, 0.24, PIER.z1 - PIER.z0]} />
        </mesh>
        {posts.map(([x, z]) => (
          <mesh key={`${x},${z}`} material={toon("#6f5136")} position={[x - (PIER.x0 + PIER.x1) / 2, -1.9, z - (PIER.z0 + PIER.z1) / 2]}>
            <cylinderGeometry args={[0.16, 0.18, 3.6, 8]} />
          </mesh>
        ))}
      </GlbOr>
      {/* cầu phao (khung con lắc vẽ ở ResonanceBell) */}
      <GlbOr glb={glb} name="cw_pontoon" position={[(PONTOON.x0 + PONTOON.x1) / 2, PONTOON.top, (PONTOON.z0 + PONTOON.z1) / 2]}>
        <mesh material={toon("#8a6a4a")} position={[0, -0.15, 0]}>
          <boxGeometry args={[PONTOON.x1 - PONTOON.x0, 0.3, PONTOON.z1 - PONTOON.z0]} />
        </mesh>
        <mesh material={toon("#d65a4a")} position={[0, -0.55, 0]}>
          <boxGeometry args={[PONTOON.x1 - PONTOON.x0 - 0.3, 0.5, PONTOON.z1 - PONTOON.z0 - 0.3]} />
        </mesh>
      </GlbOr>
      {/* bia */}
      <GlbOr glb={glb} name="cw_stele_tide" position={[TIDE_STONE.x, ground(TIDE_STONE.x, TIDE_STONE.z), TIDE_STONE.z]} rotation-y={Math.PI / 2}>
        <Stele x={0} z={0} y={0} accent="#7fd8ff" />
      </GlbOr>
      <GlbOr glb={glb} name="cw_stele_lagoon" position={[LAGOON_STONE.x, ground(LAGOON_STONE.x, LAGOON_STONE.z), LAGOON_STONE.z]}>
        <Stele x={0} z={0} y={0} accent="#7cf0d0" />
      </GlbOr>
      <GlbOr glb={glb} name="cw_stele_bell" position={[BELL_STONE.x, ground(BELL_STONE.x, BELL_STONE.z), BELL_STONE.z]}>
        <Stele x={0} z={0} y={0} accent="#ffd27a" />
      </GlbOr>
      {/* vòm cổng về Quảng trường */}
      <GlbOr glb={glb} name="cw_portal_arch" position={[PORTAL.x - 1.4, ground(PORTAL.x, PORTAL.z), PORTAL.z]} rotation-y={Math.PI / 2}>
        {[-1.6, 1.6].map((s) => (
          <mesh key={s} material={toon("#b9b2c6")} position={[s, 1.6, 0]}>
            <boxGeometry args={[0.45, 3.2, 0.45]} />
          </mesh>
        ))}
        <mesh material={toon("#b9b2c6")} position={[0, 3.35, 0]}>
          <boxGeometry args={[3.9, 0.4, 0.5]} />
        </mesh>
      </GlbOr>
      {/* hang Nàng Tiên Cá */}
      <GlbOr glb={glb} name="cw_grotto" position={[GROTTO.x, ground(GROTTO.x, GROTTO.z), GROTTO.z - 1.2]}>
        <mesh material={toon("#5f5a6e")} position={[0, 0, 0]}>
          <torusGeometry args={[2.6, 0.7, 8, 20, Math.PI]} />
        </mesh>
        <mesh material={glow("#5a2f8a", 1)} position={[0, 1.2, -0.3]}>
          <circleGeometry args={[2.2, 24, 0, Math.PI]} />
        </mesh>
      </GlbOr>
    </group>
  );
}

/** cần gạt đảo pha + hai nguồn sóng (pít-tông nhấp nhô ĐÚNG pha của logic: nguồn i dâng theo A·sin(−ωt + φᵢ)) */
export function LagoonRig() {
  const glb = useCoastGlb();
  const p1 = useMemo(() => new THREE.Group(), []);
  const p2 = useMemo(() => new THREE.Group(), []);
  const arm = useMemo(() => new THREE.Group(), []);
  useFrame(() => {
    const t = coastClock(Date.now());
    const phi = useCoast.getState().phi;
    p1.position.y = LAGOON.A * 1.6 * Math.sin(LAG_K * SOURCE_R - LAG_W * t);
    p2.position.y = LAGOON.A * 1.6 * Math.sin(LAG_K * SOURCE_R - LAG_W * t + phi);
    arm.rotation.z += ((phi ? -0.7 : 0.7) - arm.rotation.z) * 0.15;
  });
  return (
    <group>
      {[LAGOON.s1, LAGOON.s2].map((s, i) => (
        <group key={i} position={[s.x, LAGOON.floor, s.z]}>
          <GlbOr glb={glb} name="cw_source">
            <mesh material={toon("#7b7590")} position={[0, 0.45, 0]}>
              <cylinderGeometry args={[SOURCE_R, SOURCE_R * 1.1, 0.9, 20]} />
            </mesh>
          </GlbOr>
          {/* pít-tông nhấp nhô (node GLB riêng, gốc ở tâm mặt trên của thân nguồn) */}
          <primitive object={i === 0 ? p1 : p2}>
            <GlbOr glb={glb} name={i === 0 ? "cw_piston_a" : "cw_piston_b"} position={[0, 0.62, 0]}>
              <mesh material={glow(i === 0 ? "#7cf0ff" : "#ff9ecb", 2.2)}>
                <cylinderGeometry args={[SOURCE_R * 0.8, SOURCE_R * 0.8, 0.16, 20]} />
              </mesh>
            </GlbOr>
          </primitive>
        </group>
      ))}
      <group position={[LEVER.x, 1.4, LEVER.z]}>
        <GlbOr glb={glb} name="cw_lever_base">
          <mesh material={toon("#6d6878")} position={[0, 0.3, 0]}>
            <boxGeometry args={[0.8, 0.6, 0.6]} />
          </mesh>
        </GlbOr>
        {/* cần gạt quay quanh trục z tại đỉnh bệ (gốc node cw_lever_arm = trục quay) */}
        <primitive object={arm} position={[0, 0.6, 0]}>
          <GlbOr glb={glb} name="cw_lever_arm">
            <mesh material={toon("#c8b48a")} position={[0, 0.55, 0]}>
              <boxGeometry args={[0.12, 1.1, 0.12]} />
            </mesh>
            <mesh material={glow("#ff9ecb", 2)} position={[0, 1.15, 0]}>
              <sphereGeometry args={[0.14, 12, 8]} />
            </mesh>
          </GlbOr>
        </primitive>
      </group>
    </group>
  );
}
