"use client";
/**
 * Quần đảo Xuyến (Torus Archipelago) — vùng XUYẾN PHẲNG: ô vuông 48 × 48 m, hai cặp mép đối dán vào nhau.
 *  - Trạng thái logic MỘT bản (người chơi, mũi tên, Mắt Canh, quả cầu luôn có toạ độ trong ô gốc); hình được vẽ lặp
 *    3 × 3 (5 × 5 với địa hình ở máy khoẻ) bằng InstancedMesh → nhìn xa thấy đảo lặp lại và thấy CHÍNH MÌNH.
 *  - Đi qua mép: dời người chơi ±L và dời máy quay đúng lượng đó (CAM.shift) → không giật, vì cảnh quanh ô mới y hệt.
 *  - Cung Parabol thành Cung Vòng (ArcBow.tsx): mũi tên quấn mép, có đường bay dự đoán, có thể trúng lưng chính bạn.
 *  - Hộp Chuông (bắn vòng qua mép) mở cầu sáng → Đảo Bốn Góc → Mắt Canh Xuyến (khiên quay theo đường ngắn nhất).
 * Logic thuần + test: lib/world/torus.ts, lib/world/torusWorld.ts, tests/world/torus.test.ts. Kế hoạch: PLAN.md T18.
 */
import { useEffect, useMemo } from "react";
import { useFrame } from "@react-three/fiber";
import * as THREE from "three";
import { useGLTF } from "@react-three/drei";
import { useWorld } from "../../store";
import { AVATAR_BY_ID, worldAsset } from "@/lib/world/avatars";
import { Player, type Nearby } from "../Hub";
import { RemotePlayers } from "../RemotePlayers";
import { CombatFx, Enemies } from "../../combat/CombatScene";
import { CAM, curWeapon, endAim, motion, startAim, useCombat } from "../../combat/combat";
import { equip, loadoutList, useBag } from "../../combat/items";
import { GRADIENT } from "../../fx/shaders";
import { MagicCircle } from "../../fx/Effects";
import { Label3D } from "../../ui/Labels";
import { registerAction } from "../../actions";
import { TORUS_L, tiles, torusDist, wrap } from "@/lib/world/torus";
import { BELL_BOX, BELL_Y0, CORNER_STONE, FALL_Y, ISLAND_BY_ID, PORTAL, SENTINEL, SPAWN, STONE, onLand, torusBlocked, torusGround } from "@/lib/world/torusWorld";
import { buildTorusGeo, buildTorusLod, setTorusProps } from "./torusTerrain";
import { TORUS_FOG, TORUS_SUN, TorusSky } from "./TorusSky";
import { TorusHolo } from "./TorusHolo";
import { ArcBow } from "./ArcBow";
import { Sentinel } from "./Sentinel";
import { SelfEchoes } from "./SelfEchoes";
import { loadTorus, torusHint, useTorus } from "./torusState";
import { crossedSeam } from "./torusGame";
import { sfx } from "@/lib/world/sfx";

const TORUS_PROPS_GLB = worldAsset("torus/torus_props.glb");
useGLTF.preload(TORUS_PROPS_GLB);

const L = TORUS_L;
const lit = () => useTorus.getState().bell;
const ground = (x: number, z: number) => torusGround(x, z, lit());
const blocked = (x: number, z: number) => torusBlocked(x, z, lit());
const SUN_POS = TORUS_SUN.clone().multiplyScalar(60).toArray() as [number, number, number];
const SAFE = new THREE.Vector3(SPAWN.x, 0.6, SPAWN.z);
/** lúc vào vùng — 1,5 s đầu (vị trí cảnh trước còn sót lại) quấn / hồi vị trí lặng lẽ, không tính là "khám phá" */
const ENTER = { at: 0 };

function instanced(geo: THREE.BufferGeometry, mat: THREE.Material, offs: [number, number][]) {
  const im = new THREE.InstancedMesh(geo, mat, offs.length);
  const m = new THREE.Matrix4();
  offs.forEach(([i, j], k) => im.setMatrixAt(k, m.makeTranslation(i * L, 0, j * L)));
  im.instanceMatrix.needsUpdate = true;
  im.computeBoundingSphere();
  return im;
}

/** địa hình nặng: mỗi ô một Mesh (chung hình học) để máy quay tự bỏ ô ngoài khung nhìn — thêm vài lệnh vẽ, bớt ~40 % tam giác */
function tileGroup(geo: THREE.BufferGeometry, mat: THREE.Material, offs: [number, number][]) {
  const g = new THREE.Group();
  for (const [i, j] of offs) {
    const m = new THREE.Mesh(geo, mat);
    m.position.set(i * L, 0, j * L);
    m.matrixAutoUpdate = false;
    m.updateMatrix();
    g.add(m);
  }
  return g;
}

/**
 * Chọn Cung Parabol khi vào vùng (câu đố cần cung). Chưa mang thì trang bị vào ô trống; hết ô trống thì TẠM thay ô 3
 * và trả lại vũ khí cũ khi rời vùng (hàm trả về dùng để khôi phục).
 */
function readyBow(): () => void {
  let restore = () => {};
  let idx = loadoutList().indexOf("bow");
  if (idx < 0) {
    const b = useBag.getState();
    if (!b.owned.includes("bow")) return restore;
    const empty = b.loadout.indexOf(null);
    if (empty > 0) equip(empty as 1 | 2, "bow");
    else {
      const prev = b.loadout[2];
      equip(2, "bow");
      restore = () => {
        if (useBag.getState().loadout[2] === "bow") equip(2, prev);
      };
      torusHint("Cung Parabol tạm thay ô vũ khí thứ ba trong vùng này (rời vùng sẽ trả lại).", "The Parabola Bow temporarily takes your third weapon slot here (restored when you leave).");
    }
    idx = loadoutList().indexOf("bow");
  }
  if (idx >= 0) useCombat.setState({ weapon: idx });
  return restore;
}

export function Torus() {
  const avatar = useWorld((s) => s.avatar);
  const quality = useWorld((s) => s.quality);
  const bell = useTorus((s) => s.bell);
  const vi = useWorld((s) => s.lang === "vi");
  // địa hình: 5 × 5 ô ở máy khoẻ (xa thấy thêm một vòng đảo), 3 × 3 ở máy yếu
  const ring = quality === "low" ? 1 : 2;

  useEffect(() => {
    loadTorus();
    ENTER.at = performance.now();
    SAFE.set(SPAWN.x, 0.6, SPAWN.z);
    const unBow = readyBow();
    // đóng / tải lại trang khi đang ở đây: trả vũ khí mượn chỗ trước khi trang mất (hành trang lưu đồng bộ vào localStorage)
    window.addEventListener("pagehide", unBow);
    // máy quay góc ba gần (có cảnh trước để lại khoảng cách xa)
    if (useWorld.getState().camDist > 7) useWorld.setState({ camDist: 4.6 });
    if (process.env.NODE_ENV !== "production") Object.assign(window, { __torus: useTorus, __torusDev: { startAim, endAim, curWeapon, useCombat, readyBow } });
    const offs = [
      registerAction("torus:stone", () => useTorus.setState({ panel: "stone" })),
      registerAction("torus:corner", () => useTorus.setState({ panel: "corner" })),
    ];
    const t = window.setTimeout(() => {
      const s = useTorus.getState();
      if (!s.crossed)
        torusHint(
          "Quần đảo này là một ô vuông 48 × 48 m dán mép. Đi mãi về một hướng — hoặc giữ chuột phải giương Cung Vòng và nhìn xem mũi tên sẽ bay tới đâu.",
          "This archipelago is a 48 × 48 m square with glued edges. Walk on in one direction — or hold right-click to draw the Arc Bow and see where the arrow would go.",
        );
    }, 3800);
    return () => {
      offs.forEach((f) => f());
      window.clearTimeout(t);
      unBow();
      window.removeEventListener("pagehide", unBow);
      useTorus.setState({ hint: null, panel: null });
    };
  }, []);

  // mô hình Blender (cây, Bia, vòm cổng, Hộp Chuông, cột mốc) gộp vào cùng 2 lưới vẽ lặp theo ô
  const props = useGLTF(TORUS_PROPS_GLB);
  const geo = useMemo(() => {
    setTorusProps(props.scene);
    return { ...buildTorusGeo((x, z) => torusGround(x, z, false)), lod: buildTorusLod((x, z) => torusGround(x, z, false)) };
  }, [props]);
  const mats = useMemo(() => {
    const toon = new THREE.MeshToonMaterial({ color: "#ffffff", vertexColors: true, gradientMap: GRADIENT });
    const glow = new THREE.MeshBasicMaterial({ vertexColors: true, toneMapped: false, side: THREE.DoubleSide });
    const light = new THREE.MeshBasicMaterial({ vertexColors: true, toneMapped: false, transparent: true, opacity: 0, depthWrite: false });
    const bellMat = new THREE.MeshBasicMaterial({ color: "#a89cc8", toneMapped: false });
    return { toon, glow, light, bellMat };
  }, []);
  const meshes = useMemo(() => {
    const offs = tiles(ring);
    const near = tiles(1);
    // vòng ngoài (chỉ khi ring = 2): hình rút gọn
    const far = offs.slice(near.length);
    const bellGeo = new THREE.OctahedronGeometry(1, 0).scale(0.32, 0.95, 0.32);
    const bellMesh = new THREE.InstancedMesh(bellGeo, mats.bellMat, near.length);
    const m = new THREE.Matrix4();
    near.forEach(([i, j], k) => bellMesh.setMatrixAt(k, m.makeTranslation(BELL_BOX.back + 0.3 + i * L, BELL_Y0 + 1.3, BELL_BOX.z + j * L)));
    return { toon: tileGroup(geo.toon, mats.toon, near), lod: tileGroup(geo.lod, mats.toon, far), glow: instanced(geo.glow, mats.glow, offs), light: instanced(geo.light, mats.light, near), bell: bellMesh, bellGeo };
  }, [geo, mats, ring]);
  useEffect(
    () => () => {
      for (const k of ["glow", "light", "bell"] as const) meshes[k].dispose();
      meshes.bellGeo.dispose();
    },
    [meshes],
  );
  useEffect(
    () => () => {
      geo.toon.dispose();
      geo.lod.dispose();
      geo.glow.dispose();
      geo.light.dispose();
      Object.values(mats).forEach((m) => m.dispose());
    },
    [geo, mats],
  );

  // ── mỗi khung: quấn người chơi qua mép, rơi khỏi đảo, cầu sáng, chuông
  useFrame((_, dt) => {
    const s = useWorld.getState();
    const p = s.player;
    const now = performance.now();
    // không bung tàu lượn ở đây (lượn qua biển mây sẽ phá câu đố "không có chỗ đứng")
    if (motion.gliding) {
      motion.gliding = false;
      if (!useTorus.getState().hint || now - useTorus.getState().hint!.at > 6000)
        torusHint("Gió quanh xuyến quá xoáy — tàu lượn không bung được ở đây.", "The winds around the torus swirl too hard — the glider won't open here.", "warn");
    }
    const sx = wrap(p.x) - p.x;
    const sz = wrap(p.z) - p.z;
    if (Math.abs(sx) > 1e-9 || Math.abs(sz) > 1e-9) {
      p.x += sx;
      p.z += sz;
      // máy quay + điểm nhìn dời cùng lượng (Player đọc CAM.shift trong khung kế) → hình không giật
      CAM.shift = (CAM.shift ?? new THREE.Vector3()).add(new THREE.Vector3(sx, 0, sz));
      SAFE.x = wrap(SAFE.x + sx);
      SAFE.z = wrap(SAFE.z + sz);
      if (now - ENTER.at > 1500) crossedSeam(Math.abs(sx) > 1e-9 ? "x" : "z");
    }
    // chỗ an toàn gần nhất (để hồi lại khi rơi)
    if (motion.grounded && onLand(p.x, p.z, lit()) && Math.abs(p.y - ground(p.x, p.z)) < 0.3) SAFE.set(p.x, p.y, p.z);
    if (p.y < FALL_Y) {
      const back = new THREE.Vector3(SAFE.x - p.x, 0, SAFE.z - p.z);
      p.set(SAFE.x, ground(SAFE.x, SAFE.z) + 0.05, SAFE.z);
      CAM.shift = (CAM.shift ?? new THREE.Vector3()).add(back);
      motion.vy = 0;
      motion.grounded = true;
      s.addShake(0.2);
      sfx.whiff();
      if (now - ENTER.at > 1500)
        torusHint("Bạn rơi vào biển mây — gió nâng bạn về chỗ cũ.", "You fell into the sea of clouds — the wind lifts you back.", "warn");
    }
    // cầu sáng hiện dần khi rung Chuông; chuông bừng sáng rồi đập nhẹ
    const on = lit();
    meshes.light.visible = on || mats.light.opacity > 0.01;
    mats.light.opacity += ((on ? 0.92 : 0) - mats.light.opacity) * Math.min(1, dt * 1.6);
    const since = now - useTorus.getState().bellAt;
    const pulse = on ? 1.6 + 0.5 * Math.sin(now / 260) + Math.max(0, 1 - since / 1500) * 4 : 0.9 + 0.15 * Math.sin(now / 700);
    mats.bellMat.color.set(on ? "#ffe27a" : "#a89cc8").multiplyScalar(pulse);
  });

  const y = (x: number, z: number) => torusGround(x, z, false);
  return (
    <group>
      <color attach="background" args={[TORUS_FOG]} />
      <fog attach="fog" args={[TORUS_FOG, ring > 1 ? 48 : 34, ring > 1 ? 175 : 110]} />
      <hemisphereLight args={["#cfe3ff", "#e3b3c6", 1.15]} />
      <directionalLight position={SUN_POS} intensity={2.3} color="#fff0dc" />
      <directionalLight position={[-14, 10, -18]} intensity={0.35} color="#b9d3ff" />
      <TorusSky />
      <primitive object={meshes.toon} />
      <primitive object={meshes.lod} />
      <primitive object={meshes.glow} />
      <primitive object={meshes.light} />
      <primitive object={meshes.bell} />
      <TorusHolo x={STONE.x} y={y(STONE.x, STONE.z) + 3.3} z={STONE.z} />
      <MagicCircle radius={1.5} position={[PORTAL.x, y(PORTAL.x, PORTAL.z) + 0.25, PORTAL.z]} color="#7fd8ff" color2="#ffd27a" intensity={0.8} spin={0.6} />
      <ArcBow ground={ground} lit={lit} />
      <Sentinel ground={ground} lit={lit} />
      <SelfEchoes L={L} ring={1} />
      <RemotePlayers />
      <Player armed avatarFile={AVATAR_BY_ID[avatar]?.file} ground={ground} blocked={blocked} findNearby={torusNearby} />
      {/* không có quái thường — chỉ để bật vũ khí + mặt đất cho đạn (ENV) */}
      <Enemies ground={ground} spawner={{ kind: "fixed", points: [] }} />
      <CombatFx />
      <Label3D text={vi ? "Hộp Chuông" : "Bell Box"} position={[(BELL_BOX.back + BELL_BOX.open) / 2, BELL_Y0 + 4.1, BELL_BOX.z]} maxDist={40} />
      <Label3D text={vi ? "Bia Xuyến" : "Torus Stone"} position={[STONE.x, y(STONE.x, STONE.z) + 2.4, STONE.z]} maxDist={24} />
      <Label3D text={vi ? "Về Quảng trường" : "Back to the Plaza"} position={[PORTAL.x, y(PORTAL.x, PORTAL.z) + 4.0, PORTAL.z]} maxDist={26} />
      <Label3D text={vi ? "Đảo Bốn Góc · Mắt Canh Xuyến" : "Corner Isle · Torus Warden"} position={[SENTINEL.x - 0.01, ISLAND_BY_ID.corner.top + 4.6, SENTINEL.z - 0.01]} maxDist={60} />
      {bell && <Label3D text={vi ? "Cầu sáng" : "Light bridge"} position={[24 - 0.01, 2.6, 15.6]} maxDist={40} />}
    </group>
  );
}

function torusNearby(p: THREE.Vector3): Nearby | null {
  const vi = useWorld.getState().lang === "vi";
  if (torusDist(p.x, p.z, PORTAL.x, PORTAL.z) < 2.3) return { kind: "portal", id: "hub", label: vi ? "Về Quảng trường" : "Back to the Plaza" };
  if (torusDist(p.x, p.z, STONE.x, STONE.z) < 2.4) return { kind: "action", id: "torus:stone", label: vi ? "Đọc Bia Xuyến" : "Read the Torus Stone" };
  if (torusDist(p.x, p.z, CORNER_STONE.x, CORNER_STONE.z) < 2.0) return { kind: "action", id: "torus:corner", label: vi ? "Đọc Bia Bốn Góc" : "Read the Corner Stone" };
  return null;
}
