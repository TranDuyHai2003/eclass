"use client";
import { RemotePlayers } from "./RemotePlayers";
/**
 * Wonder Expanse — an infinite, seeded, chunk-streamed world (Minecraft-like): cel-shaded terrain with biomes,
 * water, instanced trees, and Mathematical Wonders hidden in chunks. Chunks load/unload around the player.
 */
import { useEffect, useMemo, useRef, useState } from "react";
import { useFrame, useThree } from "@react-three/fiber";
import * as THREE from "three";
import { attack, enemyInFront } from "../combat/combat";
import { groundColor } from "@/lib/world/terrain";
import { CombatFx, Enemies } from "../combat/CombatScene";
import { Ouroboros, Sunflowers } from "./Props";
import { Storm } from "./Storm";
import { FORGE, ForgeAnvil } from "./Forge";
import { useWorld } from "../store";
import { GRADIENT } from "../fx/shaders";
import { MagicCircle } from "../fx/Effects";
import { Player, type Nearby } from "./Hub";
import { WonderAt } from "./Wonders";
import { AVATAR_BY_ID } from "@/lib/world/avatars";
import { CHUNK, WATER_LEVEL, biome, blockTop, chunkTrees, chunkWonder } from "@/lib/world/terrain";
import { B, BLOCK_RGB, EMISSIVE, PLACEABLE, blockAt, columnRange, loadEdits, onChunkDirty, raycastVoxel, setBlock, surfaceAt } from "@/lib/world/voxels";
import { sfx } from "@/lib/world/sfx";
import { WONDERS } from "@/lib/world/wonders";
import { t as tt, tr } from "@/lib/world/i18n";

const RADIUS = { low: 1, mid: 2, high: 3 } as const;
const TMP_DIR = new THREE.Vector3();
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
  // Streaming: sinh tối đa 2 chunk mỗi khung hình để không khựng; bỏ chunk ra khỏi bán kính
  const [chunks, setChunks] = useState<[number, number][]>([]);
  useFrame(() => {
    const keys = new Set(wanted.map(([x, z]) => `${x},${z}`));
    const kept = chunks.filter(([x, z]) => keys.has(`${x},${z}`));
    const have = new Set(kept.map(([x, z]) => `${x},${z}`));
    const missing = wanted.filter(([x, z]) => !have.has(`${x},${z}`)).slice(0, 2);
    if (missing.length || kept.length !== chunks.length) setChunks([...kept, ...missing]);
  });
  const wonders = useMemo(() => chunks.map(([cx, cz]) => chunkWonder(cx, cz)).filter(Boolean) as NonNullable<ReturnType<typeof chunkWonder>>[], [chunks]);
  useEffect(() => {
    interactables = [{ kind: "portal", id: "hub", x: 0, z: -6 }, ...wonders.map((w) => ({ kind: "wonder" as const, id: w.id, x: w.x, z: w.z }))];
  }, [wonders]);

  const mat = useMemo(() => new THREE.MeshToonMaterial({ vertexColors: true, gradientMap: GRADIENT }), []);
  const glowMat = useMemo(() => new THREE.MeshToonMaterial({ vertexColors: true, gradientMap: GRADIENT, emissive: "#9fe6ff", emissiveIntensity: 0.9 }), []);
  const fogFar = (R + 0.6) * CHUNK;

  return (
    <group>
      <fog attach="fog" args={["#d2def2", fogFar * 0.45, fogFar]} />
      {chunks.map(([cx, cz]) => (
        <Chunk key={`${cx},${cz}`} cx={cx} cz={cz} material={mat} glow={glowMat} />
      ))}
      <Water />
      <Trees chunks={chunks} />
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
      <BlockInteractor />
      <Enemies ground={(x, z) => Math.max(blockTop(x, z), WATER_LEVEL - 0.6)} spawner={{ kind: "ring", count: 7, min: 12, max: 26, kinds: ["slime", "knight", "wisp", "zeno", "mite"], extra: [{ kind: "twinA", at: [10, 0, -12] }, { kind: "twinB", at: [14, 0, -12] }] }} />
      <CombatFx />
      <Storm />
      <ForgeAnvil />
      <Player
        armed
        avatarFile={AVATAR_BY_ID[avatar]?.file}
        blocked={voxelBlocked}
        ground={(x, z, y) => Math.max(y === undefined ? blockTop(x, z) : surfaceAt(x, z, y), WATER_LEVEL - 0.6)} findNearby={expanseNearby} />
    </group>
  );
}

const FACES: { n: [number, number, number]; v: number[][]; shade: number }[] = [
  { n: [0, 1, 0], v: [[0, 1, 1], [1, 1, 1], [1, 1, 0], [0, 1, 0]], shade: 1 },
  { n: [0, -1, 0], v: [[0, 0, 0], [1, 0, 0], [1, 0, 1], [0, 0, 1]], shade: 0.55 },
  { n: [1, 0, 0], v: [[1, 0, 1], [1, 0, 0], [1, 1, 0], [1, 1, 1]], shade: 0.82 },
  { n: [-1, 0, 0], v: [[0, 0, 0], [0, 0, 1], [0, 1, 1], [0, 1, 0]], shade: 0.82 },
  { n: [0, 0, 1], v: [[0, 0, 1], [1, 0, 1], [1, 1, 1], [0, 1, 1]], shade: 0.72 },
  { n: [0, 0, -1], v: [[1, 0, 0], [0, 0, 0], [0, 1, 0], [1, 1, 0]], shade: 0.72 },
];

/** Một chunk voxel: duyệt các cột, chỉ sinh mặt giáp không khí → một mesh (dựng lại khi có khối bị sửa) */
function Chunk({ cx, cz, material, glow }: { cx: number; cz: number; seg?: number; material: THREE.Material; glow: THREE.Material }) {
  const [version, setVersion] = useState(0);
  useEffect(() => onChunkDirty((x, z) => x === cx && z === cz && setVersion((v) => v + 1)), [cx, cz]);
  const geos = useMemo(() => {
    void version;
    const out = { solid: { p: [] as number[], n: [] as number[], c: [] as number[] }, glow: { p: [] as number[], n: [] as number[], c: [] as number[] } };
    const col = new THREE.Color();
    for (let i = 0; i < CHUNK; i++) {
      for (let j = 0; j < CHUNK; j++) {
        const x = cx * CHUNK + i;
        const z = cz * CHUNK + j;
        const [lo, hi] = columnRange(x, z);
        const bi = biome(x, z);
        const vary = 0.93 + (((Math.imul(x, 73856093) ^ Math.imul(z, 19349663)) >>> 0) % 100) / 100 * 0.12;
        for (let y = lo; y < hi; y++) {
          const id = blockAt(x, y, z);
          if (id === B.air) continue;
          const tgt = EMISSIVE.has(id) ? out.glow : out.solid;
          for (const f of FACES) {
            if (blockAt(x + f.n[0], y + f.n[1], z + f.n[2]) !== B.air) continue;
            let rgb = BLOCK_RGB[id][f.n[1] === 1 ? 0 : 1];
            if (id === B.grass && f.n[1] === 1 && bi !== "meadow") {
              if (bi === "crystal") rgb = [0.36, 0.66, 0.68];
              else if (bi === "dusk") rgb = [0.72, 0.5, 0.66];
              else rgb = groundColor(x, z, y + 1) as [number, number, number]; // biome toán học: giấy kẻ ô, Sierpiński, fractal, yên ngựa
            }
            const k = f.shade * vary;
            col.setRGB(rgb[0] * k, rgb[1] * k, rgb[2] * k, THREE.SRGBColorSpace);
            for (const q of [0, 1, 2, 0, 2, 3]) {
              const v = f.v[q];
              tgt.p.push(x + v[0], y + v[1], z + v[2]);
              tgt.n.push(...f.n);
              tgt.c.push(col.r, col.g, col.b);
            }
          }
        }
      }
    }
    const make = (d: typeof out.solid) => {
      const g = new THREE.BufferGeometry();
      g.setAttribute("position", new THREE.Float32BufferAttribute(d.p, 3));
      g.setAttribute("normal", new THREE.Float32BufferAttribute(d.n, 3));
      g.setAttribute("color", new THREE.Float32BufferAttribute(d.c, 3));
      g.computeBoundingSphere();
      return g;
    };
    return { solid: make(out.solid), glow: out.glow.p.length ? make(out.glow) : null };
  }, [cx, cz, version]);
  useEffect(
    () => () => {
      geos.solid.dispose();
      geos.glow?.dispose();
    },
    [geos],
  );
  return (
    <>
      <mesh geometry={geos.solid} material={material} />
      {geos.glow && <mesh geometry={geos.glow} material={glow} />}
    </>
  );
}

/** Nhắm khối ở giữa màn hình (dò tia voxel), đánh dấu bằng khung; chuột trái phá, chuột phải đặt */
function BlockInteractor() {
  const box = useRef<THREE.LineSegments>(null);
  const target = useRef<ReturnType<typeof raycastVoxel>>(null);
  const { camera, gl } = useThree();
  const edges = useMemo(() => new THREE.EdgesGeometry(new THREE.BoxGeometry(1.02, 1.02, 1.02)), []);
  useEffect(() => {
    const act = (place: boolean) => {
      const t = target.current;
      if (!t || useWorld.getState().overlay) return;
      if (place) {
        const [px, py, pz] = [t.x + t.n[0], t.y + t.n[1], t.z + t.n[2]];
        const p = useWorld.getState().player;
        // Không đặt khối vào chỗ nhân vật đang đứng
        if (Math.floor(p.x) === px && Math.floor(p.z) === pz && (py === Math.floor(p.y) || py === Math.floor(p.y) + 1)) return;
        setBlock(px, py, pz, PLACEABLE[useWorld.getState().hotbar] ?? B.stone);
        sfx.click();
      } else {
        setBlock(t.x, t.y, t.z, B.air);
        sfx.hit(0);
        useWorld.getState().burst([t.x + 0.5, t.y + 0.5, t.z + 0.5], "#e8dcc0", 18);
      }
    };
    const down = (e: MouseEvent) => {
      if (document.pointerLockElement !== gl.domElement) return;
      if (e.button === 0) {
        const w = useWorld.getState();
        if (enemyInFront(w.player, w.playerYaw)) attack();
        else act(false);
      }
      if (e.button === 2) act(true);
    };
    const ctx = (e: MouseEvent) => e.preventDefault();
    const ui = (e: Event) => act((e as CustomEvent).detail === "place");
    window.addEventListener("mousedown", down);
    gl.domElement.addEventListener("contextmenu", ctx);
    window.addEventListener("world-block", ui);
    return () => {
      window.removeEventListener("mousedown", down);
      gl.domElement.removeEventListener("contextmenu", ctx);
      window.removeEventListener("world-block", ui);
    };
  }, [gl]);
  useFrame(() => {
    camera.getWorldDirection(TMP_DIR);
    const o = camera.position;
    // Tầm với tính từ nhân vật: dò xa hơn khoảng cách máy quay
    const reach = useWorld.getState().camDist + 6;
    const t = raycastVoxel(o.x, o.y, o.z, TMP_DIR.x, TMP_DIR.y, TMP_DIR.z, reach);
    target.current = t;
    if (box.current) {
      box.current.visible = !!t;
      if (t) box.current.position.set(t.x + 0.5, t.y + 0.5, t.z + 0.5);
    }
  });
  return (
    <lineSegments ref={box} geometry={edges}>
      <lineBasicMaterial color="#ffffff" transparent opacity={0.85} />
    </lineSegments>
  );
}

/** Thân nhân vật chiếm ô (y+1): có khối ở đó là tường (ô y có khối = bậc 1 khối → leo được) */
function voxelBlocked(x: number, z: number, y: number) {
  const iy = Math.floor(y + 0.05);
  for (const [ox, oz] of [[0, 0], [0.28, 0], [-0.28, 0], [0, 0.28], [0, -0.28]]) {
    const ix = Math.floor(x + ox);
    const iz = Math.floor(z + oz);
    if (blockAt(ix, iy + 1, iz) !== B.air) return true;
  }
  return false;
}

function Water() {
  const ref = useRef<THREE.Mesh>(null);
  useFrame(() => {
    const p = useWorld.getState().player;
    ref.current?.position.set(p.x, WATER_LEVEL, p.z);
  });
  return (
    <mesh ref={ref} rotation={[-Math.PI / 2, 0, 0]}>
      <planeGeometry args={[400, 400]} />
      <meshToonMaterial color="#5fb7e6" gradientMap={GRADIENT} transparent opacity={0.78} />
    </mesh>
  );
}

/** Cây kiểu toon: hai InstancedMesh (thân + tán) cho mọi chunk → 2 draw call */
function Trees({ chunks }: { chunks: [number, number][] }) {
  const MAX = 1400;
  const trunk = useRef<THREE.InstancedMesh>(null);
  const crown = useRef<THREE.InstancedMesh>(null);
  const mats = useMemo(
    () => ({
      trunk: new THREE.MeshToonMaterial({ color: "#7a5a43", gradientMap: GRADIENT }),
      crown: new THREE.MeshToonMaterial({ color: "#4f9e5a", gradientMap: GRADIENT }),
    }),
    [],
  );
  useEffect(() => {
    const o = new THREE.Object3D();
    const col = new THREE.Color();
    let n = 0;
    for (const [cx, cz] of chunks) {
      for (const t of chunkTrees(cx, cz)) {
        if (n >= MAX) break;
        const h = blockTop(t.x, t.z);
        o.position.set(t.x, h + 0.9 * t.s, t.z);
        o.scale.setScalar(t.s);
        o.rotation.set(0, (t.x * 13 + t.z) % 6.28, 0);
        o.updateMatrix();
        trunk.current?.setMatrixAt(n, o.matrix);
        o.position.y = h + 2.6 * t.s;
        o.updateMatrix();
        crown.current?.setMatrixAt(n, o.matrix);
        col.setHSL(0.28 + ((t.x * 7 + t.z) % 10) * 0.006, 0.45, 0.42 + (t.s - 0.8) * 0.1);
        crown.current?.setColorAt(n, col);
        n++;
      }
    }
    for (const m of [trunk.current, crown.current]) {
      if (!m) continue;
      m.count = n;
      m.instanceMatrix.needsUpdate = true;
      if (m.instanceColor) m.instanceColor.needsUpdate = true;
      m.computeBoundingSphere();
    }
  }, [chunks]);
  return (
    <>
      <instancedMesh ref={trunk} args={[undefined, mats.trunk, MAX]} frustumCulled={false}>
        <cylinderGeometry args={[0.18, 0.26, 1.8, 6]} />
      </instancedMesh>
      <instancedMesh ref={crown} args={[undefined, mats.crown, MAX]} frustumCulled={false}>
        <icosahedronGeometry args={[1.4, 0]} />
      </instancedMesh>
    </>
  );
}
