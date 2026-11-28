"use client";
/**
 * Đèn Năm (Birthday Wisps): cột giữa + 12 dây tháng + 365 đèn lồng (InstancedMesh, màu từng đèn).
 * Đom đóm bay từ vò của bà chủ quầy tới đèn ngẫu nhiên (cung cong), đèn sáng vàng; con bay vào ĐÈN ĐÃ SÁNG → hai con hoà
 * thành pháo hoa hồng + chữ "Trùng! con thứ N". Đọc wispFx (bazaarState) — không React mỗi khung.
 */
import { useGLTF } from "@react-three/drei";
import { toonize } from "../../fx/glbToon";
import { BAZAAR_GLB } from "./bazaarProps";
import { useEffect, useMemo } from "react";
import { useFrame } from "@react-three/fiber";
import * as THREE from "three";
import { DAYS } from "@/lib/world/bazaar";
import {
  LANTERNS,
  WISP_KEEPER,
  WISP_POSTS,
  WISP_TREE,
  lanternPos,
} from "@/lib/world/bazaarWorld";
import { useWorld } from "../../store";
import { floatText } from "../../ui/Labels";
import { sfx } from "@/lib/world/sfx";
import { Keeper, Stall, glow, toon } from "./bazaarProps";
import { wispFx } from "./bazaarState";

const MAX_WISPS = 120;
const FLY = 0.9;
const DIM = new THREE.Color(0.7, 0.42, 0.26);
const LIT = new THREE.Color(3.2, 2.1, 0.7);
const HIT = new THREE.Color(4.5, 0.9, 2.2);
const JAR = new THREE.Vector3(WISP_KEEPER.x - 0.3, 1.3, WISP_KEEPER.z - 0.5);

export function WispTree() {
  // cột giữa (dải lụa xoắn, vương miện vàng 12 móc) + cọc tháng có đèn lồng — Blender; thiếu → hình tạm
  const glb = useGLTF(BAZAAR_GLB);
  const models = useMemo(() => {
    const get = (n: string) => {
      const src = glb.scene.getObjectByName(n);
      return src ? toonize(src) : null;
    };
    const post = get("bz_lantern_post");
    return { pole: get("bz_lantern_pole"), posts: WISP_POSTS.map(() => (post ? post.clone(true) : null)) };
  }, [glb]);
  const geo = useMemo(() => {
    const lamp = new THREE.IcosahedronGeometry(0.11, 1);
    const wisp = new THREE.IcosahedronGeometry(0.07, 0);
    // dây tháng: đường gấp khúc qua các đèn (đỉnh cột → cọc)
    const pts: number[] = [];
    const T = WISP_TREE;
    for (let m = 0; m < 12; m++) {
      const a = (m / 12) * Math.PI * 2 + Math.PI / 12;
      let prev: [number, number, number] = [
        T.x + Math.cos(a) * 0.3,
        T.top,
        T.z + Math.sin(a) * 0.3,
      ];
      for (let k = 1; k <= 32; k++) {
        const t = k / 32;
        const rad = 0.45 + t * (T.R - 0.45);
        const y = T.top + (T.endY - T.top) * t - 4 * t * (1 - t) * 0.55;
        const p: [number, number, number] = [
          T.x + Math.cos(a) * rad,
          y,
          T.z + Math.sin(a) * rad,
        ];
        pts.push(...prev, ...p);
        prev = p;
      }
    }
    const strings = new THREE.BufferGeometry();
    strings.setAttribute("position", new THREE.Float32BufferAttribute(pts, 3));
    return { lamp, wisp, strings };
  }, []);
  const mats = useMemo(
    () => ({
      lamp: new THREE.MeshBasicMaterial({
        color: "#ffffff",
        toneMapped: false,
      }),
      wisp: new THREE.MeshBasicMaterial({
        color: new THREE.Color(0.9, 2.6, 2.4),
        toneMapped: false,
      }),
      string: new THREE.LineBasicMaterial({
        color: "#c9a46a",
        transparent: true,
        opacity: 0.6,
      }),
    }),
    [],
  );
  const meshes = useMemo(() => {
    const lamps = new THREE.InstancedMesh(geo.lamp, mats.lamp, LANTERNS);
    const m = new THREE.Matrix4();
    for (let d = 0; d < LANTERNS; d++) {
      const [x, y, z] = lanternPos(d);
      lamps.setMatrixAt(d, m.makeTranslation(x, y, z));
      lamps.setColorAt(d, DIM);
    }
    lamps.instanceMatrix.needsUpdate = true;
    lamps.computeBoundingSphere();
    const wisps = new THREE.InstancedMesh(geo.wisp, mats.wisp, MAX_WISPS);
    wisps.frustumCulled = false;
    wisps.count = 0;
    return { lamps, wisps };
  }, [geo, mats]);
  useEffect(
    () => () => {
      meshes.lamps.dispose();
      meshes.wisps.dispose();
      Object.values(geo).forEach((g) => g.dispose());
      Object.values(mats).forEach((m) => m.dispose());
    },
    [meshes, geo, mats],
  );

  const run = useMemo(
    () => ({
      t0: -1,
      arrived: 0,
      lit: new Uint8Array(DAYS),
      hitShown: false,
      shimmerOn: false,
    }),
    [],
  );
  const M = useMemo(() => new THREE.Matrix4(), []);
  const V = useMemo(() => new THREE.Vector3(), []);
  const C = useMemo(() => new THREE.Color(), []);
  useFrame(() => {
    const now = performance.now() / 1000;
    const L = meshes.lamps;
    // vò mới → tắt hết đèn
    if (wispFx.t0 !== run.t0) {
      run.t0 = wispFx.t0;
      run.arrived = 0;
      run.lit.fill(0);
      run.hitShown = false;
      for (let d = 0; d < DAYS; d++) L.setColorAt(d, DIM);
      L.instanceColor!.needsUpdate = true;
    }
    const slots = wispFx.slots;
    const el = now - wispFx.t0;
    // đom đóm đang bay
    let k = 0;
    if (el >= 0 && slots.length) {
      const released = Math.min(slots.length, Math.floor(el / wispFx.gap) + 1);
      for (let i = run.arrived; i < released && k < MAX_WISPS; i++) {
        const u = (el - i * wispFx.gap) / FLY;
        if (u >= 1) {
          // tới đèn
          if (i === run.arrived) {
            run.arrived++;
            const s = slots[i];
            const [x, y, z] = lanternPos(s);
            if (run.lit[s]) {
              L.setColorAt(s, HIT);
              const w = useWorld.getState();
              w.burst([x, y, z], "#ff8ad8", 36);
              if (!run.hitShown) {
                run.hitShown = true;
                sfx.chime(2);
                floatText(
                  V.set(x, y + 0.4, z),
                  w.lang === "vi"
                    ? `Trùng! con thứ ${i + 1}`
                    : `Match! wisp #${i + 1}`,
                  "crit",
                );
              }
            } else {
              L.setColorAt(s, LIT);
              if (i % 3 === 0) sfx.harmonic(1 + (i % 7));
            }
            run.lit[s] = 1;
            L.instanceColor!.needsUpdate = true;
          }
          continue;
        }
        const [x, y, z] = lanternPos(slots[i]);
        const e = u * u * (3 - 2 * u);
        V.set(
          JAR.x + (x - JAR.x) * e,
          JAR.y + (y - JAR.y) * e + Math.sin(Math.PI * u) * 2.2,
          JAR.z + (z - JAR.z) * e,
        );
        meshes.wisps.setMatrixAt(k++, M.makeTranslation(V.x, V.y, V.z));
      }
    }
    meshes.wisps.count = k;
    if (k) meshes.wisps.instanceMatrix.needsUpdate = true;
    // 1000 vò: cả cây đèn lấp lánh 2,5 s
    const sh = now - wispFx.shimmer;
    if (sh >= 0 && sh < 2.5) {
      run.shimmerOn = true;
      for (let d = 0; d < DAYS; d++) {
        const f = Math.sin(now * 17 + d * 12.9898) * 43758.5453;
        const on = f - Math.floor(f) > 0.82;
        L.setColorAt(
          d,
          on ? C.copy(LIT).multiplyScalar(1.2) : run.lit[d] ? LIT : DIM,
        );
      }
      L.instanceColor!.needsUpdate = true;
    } else if (run.shimmerOn) {
      run.shimmerOn = false;
      for (let d = 0; d < DAYS; d++) L.setColorAt(d, run.lit[d] ? LIT : DIM);
      L.instanceColor!.needsUpdate = true;
    }
  });

  const T = WISP_TREE;
  return (
    <group>
      {/* cột giữa + vương miện */}
      {models.pole ? (
        <primitive object={models.pole} position={[T.x, 0, T.z]} />
      ) : (
        <mesh material={toon("#4b3a72")} position={[T.x, T.top / 2, T.z]}>
          <cylinderGeometry args={[0.18, T.poleR, T.top, 10]} />
        </mesh>
      )}
      <mesh material={glow("#ffd27a", 2.4)} position={[T.x, T.top + 0.35, T.z]}>
        <octahedronGeometry args={[0.35, 0]} />
      </mesh>
      {WISP_POSTS.map(([x, z], i) => (
        <group key={i} position={[x, 0, z]}>
          {models.posts[i] ? <primitive object={models.posts[i]} /> : null}
          {!models.posts[i] && <mesh material={toon("#5c3f2a")} position={[0, T.endY / 2 + 0.1, 0]}>
            <cylinderGeometry args={[0.06, 0.09, T.endY + 0.2, 6]} />
          </mesh>}
          <mesh
            visible={!models.posts[i]}
            material={glow(i % 2 ? "#ff9ec0" : "#9fd8ff", 1.8)}
            position={[0, T.endY + 0.25, 0]}
          >
            <sphereGeometry args={[0.1, 8, 6]} />
          </mesh>
        </group>
      ))}
      <lineSegments geometry={geo.strings} material={mats.string} />
      <primitive object={meshes.lamps} />
      <primitive object={meshes.wisps} />
      {/* quầy + bà chủ + vò đom đóm */}
      <Stall
        position={[WISP_KEEPER.x + 0.35, 0, WISP_KEEPER.z]}
        yaw={Math.PI / 2}
        node="bz_stall_wisp"
        cloth="#4b3a9a"
        cloth2="#ffd27a"
      />
      <Keeper
        position={[WISP_KEEPER.x - 1.15, 0, WISP_KEEPER.z + 0.5]}
        yaw={Math.PI / 2}
        body="#3d2f7a"
        hat="#ffd27a"
        vrm="avatars/kimono.vrm"
      />
      <mesh
        material={glow("#7ff0e0", 1.3)}
        position={[JAR.x, JAR.y - 0.05, JAR.z]}
      >
        <cylinderGeometry args={[0.16, 0.2, 0.36, 10]} />
      </mesh>
    </group>
  );
}
