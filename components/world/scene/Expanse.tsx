"use client";
import { RemotePlayers } from "./RemotePlayers";
/**
 * Wonder Expanse — an infinite, seeded, chunk-streamed world (Minecraft-like): cel-shaded terrain with biomes,
 * water, caves / overhangs, voxel L-system trees, structures (Phyllotaxis Isles, Graph Forest, WFC ruins — lib/world/worldgen)
 * and Mathematical Wonders hidden in chunks. Chunks load/unload around the player.
 */
import { useEffect, useMemo, useRef, useState } from "react";
import { useFrame, useThree } from "@react-three/fiber";
import * as THREE from "three";
import { groundColor } from "@/lib/world/terrain";
import { CombatFx, Enemies } from "../combat/CombatScene";
import { Ouroboros, Sunflowers } from "./Props";
import { Storm } from "./Storm";
import { FORGE, ForgeAnvil } from "./Forge";
import { SymmetryTotem, totemNearby } from "./SymmetryTotem";
import { useWorld } from "../store";
import { MagicCircle } from "../fx/Effects";
import { Player, type Nearby } from "./Hub";
import { WonderAt } from "./Wonders";
import { AVATAR_BY_ID } from "@/lib/world/avatars";
import { ChunkManager } from "../voxel/chunkManager";
import { VOXEL_U, WATER_BLOCK_U, voxelMaterial, voxelWaterMaterial } from "../voxel/voxelMaterial";
import { waterNormalTex } from "../fx/proceduralTex";
import { HubDayCycle } from "./HubNight";
import { VoxelWater } from "../voxel/VoxelWater";
import { TorchSprites } from "../voxel/TorchSprites";
import { HubSky } from "./HubPlaza";
import { DAY } from "../fx/dayState";
import { FarTerrain } from "../voxel/farTerrain";
import { CHUNK, MATH_BIOME_INFO, WATER_LEVEL, biome, blockTop, chunkWonder, nearbyMathCells, type MathBiome } from "@/lib/world/terrain";
import { STRUCT_INFO, structureSigns } from "@/lib/world/structures";
import { Label3D } from "../ui/Labels";
import { B, BLOCK_RGB, EMISSIVE, blockAt, columnRange, isSolidBlock, loadEdits, onChunkDirty, surfaceAt } from "@/lib/world/voxels";
import { BlockInteractor } from "../craft/BlockInteractor";
import { ExpanseBosses } from "../bosses/ExpanseBosses";
import { WONDERS } from "@/lib/world/wonders";
import { t as tt, tr } from "@/lib/world/i18n";
import { LOAD_SIG } from "@/lib/world/loadSignals";
import { genStats } from "@/lib/world/worldgen";

/** bán kính tầm nhìn voxel (chunk 32 m) — dựng trong Web Worker nên nới rộng được */
const RADIUS = { low: 2, mid: 3, high: 4 } as const;
/** chân trời địa hình xa (LOD, m) */
const FAR_R = { low: 170, mid: 280, high: 420 } as const;
/** bộ chạy ngày đêm cần một bộ uniform "nướng" + danh sách đèn — Vùng Kỳ quan không dùng (giá trị bỏ qua) */
const DAY_U = { uExposure: { value: 1 }, uFloor: { value: 0.3 }, uTint: { value: new THREE.Color(1, 1, 1) }, uScale: { value: 1 } };
const NO_LAMPS: { mat: THREE.MeshBasicMaterial; base: THREE.Color }[] = [];
const FOG_DAY = new THREE.Color("#d2def2");
// Nạp các khối người chơi đã sửa (chỉ trên trình duyệt)
if (typeof window !== "undefined") loadEdits();
const SEGMENTS = { low: 16, mid: 28, high: 40 } as const;

/** Điểm tương tác hiện có (cập nhật khi chunk đổi) — tránh setState mỗi khung hình */
let interactables: { kind: Nearby["kind"]; id?: string; x: number; z: number }[] = [];

export function expanseNearby(p: THREE.Vector3): Nearby | null {
  const lang = useWorld.getState().lang;
  let best: Nearby | null = null;
  let bd = 3;
  // Lò rèn Ma trận: đứng cạnh / trên đế 7×7
  if (Math.hypot(FORGE.x + 3.5 - p.x, FORGE.z + 3.5 - p.z) < 5.5) return { kind: "forge", label: lang === "vi" ? "Mở Lò rèn Ma trận" : "Open the Matrix Forge" };
  const totem = totemNearby(p, lang);
  if (totem) return totem;
  for (const it of interactables) {
    const d = Math.hypot(it.x - p.x, it.z - p.z);
    if (d < bd) {
      bd = d;
      best =
        it.kind === "wonder" && it.id
          ? { kind: "wonder", id: it.id, label: tt(lang, "wonderLook", { name: tr(lang, WONDERS[it.id as keyof typeof WONDERS].name) }) }
          : { kind: "portal", id: "hub", label: tt(lang, "returnHub") };
    }
  }
  return best;
}

export function Expanse() {
  const quality = useWorld((s) => s.quality);
  const avatar = useWorld((s) => s.avatar);
  const R = RADIUS[quality];
  const [center, setCenter] = useState<[number, number]>([0, 0]);
  useFrame(() => {
    const p = useWorld.getState().player;
    const cx = Math.floor(p.x / CHUNK);
    const cz = Math.floor(p.z / CHUNK);
    if (cx !== center[0] || cz !== center[1]) setCenter([cx, cz]);
  });
  const wanted = useMemo(() => {
    const out: [number, number][] = [];
    for (let dz = -R; dz <= R; dz++) for (let dx = -R; dx <= R; dx++) out.push([center[0] + dx, center[1] + dz]);
    // Gần trước, xa sau
    return out.sort((a, b) => Math.hypot(a[0] - center[0], a[1] - center[1]) - Math.hypot(b[0] - center[0], b[1] - center[1]));
  }, [center, R]);
  // Địa hình: ChunkManager mệnh lệnh + Web Worker (sinh + ánh sáng + lưới tham lam) — React không dựng lại theo chunk
  const mat = useMemo(() => voxelMaterial(), []);
  const glowMat = useMemo(() => voxelMaterial({ emissive: "#9fe6ff", emissiveIntensity: 0.9 }), []);
  const waterMat = useMemo(() => voxelWaterMaterial(waterNormalTex()), []);
  // tạo / huỷ trong effect (StrictMode gắn – gỡ – gắn lại: mỗi lần gắn có bộ quản lý + worker riêng)
  const [manager, setManager] = useState<ChunkManager | null>(null);
  useEffect(() => {
    const cores = typeof navigator !== "undefined" ? navigator.hardwareConcurrency || 4 : 4;
    const q = useWorld.getState().quality;
    const workers = q === "low" ? 1 : Math.max(1, Math.min(3, cores - 2));
    const m = new ChunkManager(mat, glowMat, RADIUS[q], workers, waterMat);
    setManager(m);
    if (process.env.NODE_ENV !== "production") Object.assign(window, { __voxel: m.stats, __voxelMgr: m, __voxGen: genStats });
    // màn chờ: tiến độ "dựng thế giới" = chunk gần đã có lưới
    const near = () => m.nearProgress();
    LOAD_SIG.build = near;
    return () => {
      if (LOAD_SIG.build === near) LOAD_SIG.build = null;
      m.dispose();
    };
  }, [mat, glowMat, waterMat]);
  useEffect(() => manager?.setRadius(R), [manager, R]);
  useEffect(() => () => waterMat.dispose(), [waterMat]);
  // địa hình xa (LOD) — worker riêng
  const farMat = useMemo(() => voxelMaterial({ far: true }), []);
  const [far, setFar] = useState<FarTerrain | null>(null);
  useEffect(() => {
    const q = useWorld.getState().quality;
    const f = new FarTerrain(farMat, FAR_R[q], RADIUS[q] * CHUNK);
    setFar(f);
    if (process.env.NODE_ENV !== "production") Object.assign(window, { __far: f.stats, __farMgr: f });
    return () => f.dispose();
  }, [farMat]);
  useEffect(() => far?.setRadius(FAR_R[quality], R * CHUNK), [far, quality, R]);
  useEffect(() => () => farMat.dispose(), [farMat]);
  useEffect(() => () => (mat.dispose(), glowMat.dispose()), [mat, glowMat]);
  const { camera } = useThree();
  const fogRef = useRef<THREE.Fog>(null);
  useFrame(() => {
    if (!manager) return;
    const p = useWorld.getState().player;
    manager.update(camera, p.x, p.z);
    WATER_BLOCK_U.uT.value = performance.now() / 1000;
    far?.update(p.x, p.z);
    // ánh trời của khối theo độ sáng ban ngày; sương nhuộm màu chân trời
    // đêm: ánh trăng lam (không tối đen như Minecraft — người chơi là học sinh); đuốc / pha lê vẫn nổi bật nhờ ánh khối ấm
    const night = DAY.night.value;
    VOXEL_U.uDay.value = Math.max(0.2 + 0.2 * night, DAY.level.value);
    VOXEL_U.uSkyTint.value.setRGB(1 - 0.38 * night, 1 - 0.26 * night, 1 + 0.08 * night);
    fogRef.current?.color.copy(DAY.hor.value).lerp(FOG_DAY, 0.35 * DAY.level.value);
  });
  const wonders = useMemo(() => wanted.map(([cx, cz]) => chunkWonder(cx, cz)).filter(Boolean) as NonNullable<ReturnType<typeof chunkWonder>>[], [wanted]);
  useEffect(() => {
    interactables = [{ kind: "portal", id: "hub", x: 0, z: -6 }, ...wonders.map((w) => ({ kind: "wonder" as const, id: w.id, x: w.x, z: w.z }))];
  }, [wonders]);

  const fogFar = FAR_R[quality];
  const fogNear = Math.min(fogFar * 0.55, (R + 0.5) * CHUNK);

  return (
    <group>
      <fog ref={fogRef} attach="fog" args={["#d2def2", fogNear, fogFar]} />
      {/* ngày đêm theo giờ thật (dùng chung bộ chạy của Quảng trường): trời shader, mặt trời / trăng, ánh trời voxel */}
      <HubDayCycle U={DAY_U} lampMats={NO_LAMPS} />
      <HubSky />
      {manager && <primitive object={manager.group} />}
      {far && <primitive object={far.group} />}
      <VoxelWater far={far} />
      <TorchSprites />
      <Ouroboros position={[6, blockTop(6, -10) + 4, -10]} scale={1.4} />
      <Sunflowers spots={[[3, 4], [-4, 6], [7, 9], [-8, -3], [9, -2]]} ground={(x, z) => blockTop(x, z)} />
      {wonders.map((w) => (
        <WonderAt key={`${w.id}@${w.x},${w.z}`} id={w.id} position={[w.x, blockTop(w.x, w.z), w.z]} />
      ))}
      {/* Cổng về sảnh */}
      <group position={[0, 0, -6]}>
        <MagicCircle vertical radius={2} position={[0, 2.4, 0]} intensity={1} color="#ffd27a" color2="#8be0ff" />
        <MagicCircle radius={2.4} position={[0, 0.05, 0]} intensity={0.6} spin={-0.6} />
      </group>
      <RemotePlayers />
      <BiomeSigns />
      <SymmetryTotem />
      <BlockInteractor />
      <ExpanseBosses />
      <Enemies ground={enemyGround} spawner={{ kind: "ring", count: 10, min: 12, max: 26, kinds: ["slime", "knight", "wisp", "zeno", "mite", "ghoul", "warden", "crab"], extra: [{ kind: "twinA", at: [10, 0, -12] }, { kind: "twinB", at: [14, 0, -12] }] }} />
      <CombatFx />
      <Storm />
      <ForgeAnvil />
      <Player
        armed
        avatarFile={AVATAR_BY_ID[avatar]?.file}
        blocked={voxelBlocked}
        ground={expanseGround} findNearby={expanseNearby} field={EXPANSE_FIELD} />
    </group>
  );
}


/** Thân nhân vật chiếm ô (y+1): có khối ở đó là tường (ô y có khối = bậc 1 khối → leo được) */
function voxelBlocked(x: number, z: number, y: number) {
  const iy = Math.floor(y + 0.05);
  for (const [ox, oz] of [[0, 0], [0.28, 0], [-0.28, 0], [0, 0.28], [0, -0.28]]) {
    const ix = Math.floor(x + ox);
    const iz = Math.floor(z + oz);
    if (isSolidBlock(blockAt(ix, iy + 1, iz))) return true;
  }
  return false;
}

/**
 * Mặt đất cho Player. Có y → mặt đất thật dưới chân (hang, đảo nổi, khối tự xây). Không có y (máy quay) → mặt cột như cũ;
 * riêng khi nhân vật đang Ở TRONG HANG thì lấy sàn hang dưới máy quay và không cao quá đầu nhân vật (máy quay khỏi bật lên mặt đất).
 * Mức nước chỉ chặn khi cột mở ra trời (hang luôn cao hơn mặt nước, xem density.CAVE_FLOOR).
 */
function expanseGround(x: number, z: number, y?: number): number {
  if (y === undefined) {
    const p = useWorld.getState().player;
    if (p.y < blockTop(p.x, p.z) - 2.5) return Math.min(surfaceAt(x, z, p.y + 1), p.y + 0.6);
    return Math.max(blockTop(x, z), WATER_LEVEL - 0.6);
  }
  // người chơi (có y): đáy thật — biển / hồ nước khối thì BƠI (expanseWater), không còn "sàn" ở mực nước
  return surfaceAt(x, z, y);
}

/**
 * Mặt nước tại chỗ người chơi: cột nước nguồn (khối water quanh thân → mặt = đỉnh cột + 0,875) hoặc biển (cột mở ra trời
 * có mặt đất dưới mực nước). null = không ở trong nước. Dòng chảy (tính trong worker) chỉ nông — lội, không bơi.
 */
function expanseWater(p: THREE.Vector3): number | null {
  const ix = Math.floor(p.x);
  const iz = Math.floor(p.z);
  const iy = Math.floor(p.y + 0.3);
  for (let y = iy; y <= iy + 1; y++)
    if (blockAt(ix, y, iz) === B.water) {
      let t = y;
      while (t < y + 64 && blockAt(ix, t + 1, iz) === B.water) t++;
      return t + 0.875;
    }
  if (p.y < WATER_LEVEL + 0.5 && blockTop(ix, iz) < WATER_LEVEL) return WATER_LEVEL;
  return null;
}
const EXPANSE_FIELD = { water: expanseWater };

/** Mặt đất cho quái: có y → sàn thật dưới chân (hang, phần nhô, đảo); không có y (chỗ xuất hiện) → mặt cột */
function enemyGround(x: number, z: number, y?: number): number {
  return Math.max(y === undefined ? blockTop(x, z) : surfaceAt(x, z, y), WATER_LEVEL - 0.6);
}

/** Biển báo biome toán học: tên + công thức nổi trên tâm mỗi vùng trong bán kính 220 m (quét lại mỗi giây) */
function BiomeSigns() {
  const lang = useWorld((st) => st.lang);
  const [cells, setCells] = useState<{ kind: MathBiome; cx: number; cz: number; y: number }[]>([]);
  // công trình (W5/W6): Đảo Phyllotaxis, Rừng Đồ thị, Tàn tích WFC, miệng hang
  const [structs, setStructs] = useState<ReturnType<typeof structureSigns>>([]);
  const last = useRef({ x: 1e9, z: 1e9, t: 0 });
  useFrame((st) => {
    const p = useWorld.getState().player;
    const L = last.current;
    if (st.clock.elapsedTime - L.t < 1 || Math.hypot(p.x - L.x, p.z - L.z) < 20) return;
    L.t = st.clock.elapsedTime;
    L.x = p.x;
    L.z = p.z;
    const next = nearbyMathCells(p.x, p.z, 220).map((c) => ({ ...c, y: blockTop(Math.round(c.cx), Math.round(c.cz)) + 9 }));
    setCells((prev) => (prev.length === next.length && prev.every((c, i) => c.cx === next[i].cx && c.cz === next[i].cz) ? prev : next));
    const ss = structureSigns(p.x, p.z, 220);
    setStructs((prev) => (prev.length === ss.length && prev.every((c, i) => c.x === ss[i].x && c.z === ss[i].z) ? prev : ss));
  });
  return (
    <>
      {cells.map((c) => {
        const info = MATH_BIOME_INFO[c.kind];
        return <Label3D key={`${c.cx},${c.cz}`} text={`${lang === "vi" ? info.vi : info.en} · ${info.formula}`} position={[c.cx, c.y, c.cz]} variant="math" maxDist={200} />;
      })}
      {structs.map((c) => {
        const info = STRUCT_INFO[c.kind];
        return <Label3D key={`s${c.kind}${c.x},${c.z}`} text={`${lang === "vi" ? info.vi : info.en} · ${info.formula}`} position={[c.x, c.y, c.z]} variant="math" maxDist={c.kind === "grotto" ? 60 : 200} />;
      })}
    </>
  );
}
