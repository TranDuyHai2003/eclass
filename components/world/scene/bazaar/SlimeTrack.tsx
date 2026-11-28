"use client";
/**
 * Ruộng Slime (tổng xúc xắc → hình chuông): đường ray ô 0…18, ổ trứng ở ô 0. Slime k xúc xắc nhảy k bước, mỗi bước dài đúng
 * một mặt xúc xắc (hiện số trên đầu) → rơi ở ô = tổng, rồi CHỒNG lên nhau → chồng slime chính là biểu đồ (phẳng / tam giác / chuông).
 * Lưới (cắm bằng F khi đứng trên ô) bắt slime rơi đúng ô đó — slime bị bắt hoá vàng.
 */
import { useGLTF } from "@react-three/drei";
import { BAZAAR_INST_GLB, instGeometry } from "./bazaarProps";
import { useEffect, useMemo, useRef } from "react";
import { useFrame } from "@react-three/fiber";
import * as THREE from "three";
import { SLIME_MAX, SLIME_STAGES } from "@/lib/world/bazaar";
import { SLIME_KEEPER, SLIME_TRACK, tileX } from "@/lib/world/bazaarWorld";
import { useWorld } from "../../store";
import { floatText } from "../../ui/Labels";
import { sfx } from "@/lib/world/sfx";
import { Keeper, Stall, glow, toon } from "./bazaarProps";
import { SLIME_GAP, SLIME_HOP, slimeFx, useBazaar } from "./bazaarState";

const MAX = 30;
const TZ = SLIME_TRACK.z;
const COLORS = ["#7fe08a", "#5fc8ff", "#ff8ac8"];
const GOLD = new THREE.Color(2.4, 1.8, 0.5);

function numberStrip(): THREE.CanvasTexture {
  const cv = document.createElement("canvas");
  cv.width = 2048;
  cv.height = 96;
  const g = cv.getContext("2d")!;
  g.fillStyle = "#2b2148";
  g.fillRect(0, 0, cv.width, cv.height);
  g.font = "bold 60px system-ui, sans-serif";
  g.textAlign = "center";
  g.textBaseline = "middle";
  for (let s = 0; s <= SLIME_MAX; s++) {
    const x = ((s + 0.5) / (SLIME_MAX + 1)) * cv.width;
    g.fillStyle = s === 0 ? "#ff9ec0" : "#ffe9b0";
    g.fillText(s === 0 ? "●" : String(s), x, 50);
  }
  const t = new THREE.CanvasTexture(cv);
  t.colorSpace = THREE.SRGBColorSpace;
  t.anisotropy = 4;
  return t;
}

export function SlimeTrack() {
  const nets = useBazaar((s) => s.nets);
  const stage = useBazaar((s) => s.slimeStage);
  const dice = SLIME_STAGES[Math.min(stage, SLIME_STAGES.length - 1)].dice;
  const W = SLIME_TRACK.w;
  // slime Blender (giọt bẹt đáy, chỏm tóc, mắt long lanh, má hồng) — màu đỉnh × màu từng bản; thiếu → cầu dẹt tạm
  const inst = useGLTF(BAZAAR_INST_GLB);
  const geo = useMemo(
    () => ({
      tile: new THREE.BoxGeometry(W - 0.06, 0.08, SLIME_TRACK.half * 2),
      slime: instGeometry(inst.scene, "bz_slime") ?? new THREE.SphereGeometry(0.26, 14, 10).scale(1, 0.72, 1),
      strip: new THREE.PlaneGeometry((SLIME_MAX + 1) * W, 0.42),
    }),
    [W, inst],
  );
  const strip = useMemo(() => numberStrip(), []);
  const mats = useMemo(
    () => ({
      tile: new THREE.MeshToonMaterial({ color: "#ffffff" }),
      slime: new THREE.MeshToonMaterial({ color: "#ffffff", vertexColors: !!geo.slime.getAttribute("color") }),
      strip: new THREE.MeshBasicMaterial({ map: strip }),
    }),
    [strip, geo.slime],
  );
  const im = useMemo(() => {
    const tiles = new THREE.InstancedMesh(geo.tile, mats.tile, SLIME_MAX + 1);
    const m = new THREE.Matrix4();
    for (let s = 0; s <= SLIME_MAX; s++)
      tiles.setMatrixAt(s, m.makeTranslation(tileX(s), 0.04, TZ));
    tiles.instanceMatrix.needsUpdate = true;
    tiles.computeBoundingSphere();
    const slimes = new THREE.InstancedMesh(geo.slime, mats.slime, MAX);
    slimes.frustumCulled = false;
    slimes.count = 0;
    for (let i = 0; i < MAX; i++)
      slimes.setColorAt(i, new THREE.Color(COLORS[0]));
    return { tiles, slimes };
  }, [geo, mats]);
  useEffect(
    () => () => {
      Object.values(im).forEach((m) => m.dispose());
      Object.values(geo).forEach((g) => g.dispose());
      Object.values(mats).forEach((m) => m.dispose());
      strip.dispose();
    },
    [im, geo, mats, strip],
  );
  // màu ô: ô 0 = ổ trứng; ô < số xúc xắc (không bao giờ tới) tối; ô có lưới vàng nhạt
  useEffect(() => {
    const c = new THREE.Color();
    for (let s = 0; s <= SLIME_MAX; s++) {
      if (s === 0) c.set("#ff9ec0");
      else if (s < dice || s > dice * 6) c.set("#4a4060");
      else if (nets.includes(s)) c.set("#ffe27a");
      else c.set(s % 2 ? "#efe2c4" : "#e2cfa8");
      im.tiles.setColorAt(s, c);
    }
    im.tiles.instanceColor!.needsUpdate = true;
  }, [dice, nets, im]);

  const run = useRef({ t0: -1, hops: [] as number[], col: new THREE.Color() });
  const M = useMemo(() => new THREE.Matrix4(), []);
  const Q = useMemo(() => new THREE.Quaternion(), []);
  const P = useMemo(() => new THREE.Vector3(), []);
  const S = useMemo(() => new THREE.Vector3(), []);
  useFrame(() => {
    const now = performance.now() / 1000;
    const r = run.current;
    const wave = slimeFx.wave;
    if (slimeFx.t0 !== r.t0) {
      r.t0 = slimeFx.t0;
      r.hops = wave.map(() => -1);
    }
    const netSet = useBazaar.getState().nets;
    const el = now - slimeFx.t0;
    const pile = new Array<number>(SLIME_MAX + 1).fill(0);
    let k = 0;
    for (let i = 0; i < wave.length && k < MAX; i++) {
      const w = wave[i];
      const t = el - i * SLIME_GAP;
      if (t < 0) continue;
      const h = Math.floor(t / SLIME_HOP);
      let x: number;
      let y: number;
      let sq = 1;
      if (h >= w.hops.length) {
        // đã rơi: chồng lên đống của ô
        x = tileX(w.sum);
        y = 0.14 + pile[w.sum] * 0.34;
        pile[w.sum]++;
      } else {
        const from = w.hops.slice(0, h).reduce((a, b) => a + b, 0);
        const len = w.hops[h];
        const u = t / SLIME_HOP - h;
        x = tileX(from + len * u);
        y = 0.14 + Math.sin(Math.PI * u) * (0.45 + len * 0.12);
        sq = 1 + 0.25 * Math.cos(Math.PI * 2 * u);
        if (r.hops[i] !== h) {
          r.hops[i] = h;
          if (i < 3) floatText(P.set(x, 1.2, TZ), `+${len}`, "info");
          if (h === 0 && i % 2 === 0) sfx.step();
        }
      }
      if (h >= w.hops.length && r.hops[i] !== 99) {
        r.hops[i] = 99;
        const hit = netSet.includes(w.sum);
        if (hit) {
          sfx.pickup();
          useWorld.getState().burst([x, 0.6, TZ], "#ffe27a", 14);
        }
      }
      const caughtNow = h >= w.hops.length && netSet.includes(w.sum);
      im.slimes.setColorAt(
        k,
        caughtNow ? GOLD : r.col.set(COLORS[Math.min(2, slimeFx.dice - 1)]),
      );
      P.set(x, y, TZ);
      S.set(1 / Math.sqrt(sq), sq, 1 / Math.sqrt(sq));
      im.slimes.setMatrixAt(k++, M.compose(P, Q, S));
    }
    im.slimes.count = k;
    if (k) {
      im.slimes.instanceMatrix.needsUpdate = true;
      im.slimes.instanceColor!.needsUpdate = true;
    }
  });

  return (
    <group>
      <primitive object={im.tiles} />
      <primitive object={im.slimes} />
      <mesh
        geometry={geo.strip}
        material={mats.strip}
        rotation-x={-Math.PI / 2}
        position={[tileX(SLIME_MAX / 2), 0.03, TZ + SLIME_TRACK.half + 0.3]}
      />
      {/* ổ trứng slime */}
      <mesh material={toon("#c25d8a")} position={[tileX(0), 0.3, TZ]}>
        <cylinderGeometry args={[0.42, 0.32, 0.6, 12, 1, true]} />
      </mesh>
      <mesh
        material={glow("#ff9ec0", 1.5)}
        position={[tileX(0), 0.55, TZ]}
        rotation-x={-Math.PI / 2}
      >
        <circleGeometry args={[0.38, 16]} />
      </mesh>
      {nets.map((s) => (
        <group key={s} position={[tileX(s), 0, TZ]}>
          <mesh
            material={glow("#ffd27a", 2.2)}
            position={[0, 0.1, 0]}
            rotation-x={-Math.PI / 2}
          >
            <torusGeometry args={[0.42, 0.035, 6, 24]} />
          </mesh>
          <mesh
            material={toon("#7a5236")}
            position={[0, 1.0, -SLIME_TRACK.half - 0.05]}
          >
            <cylinderGeometry args={[0.04, 0.04, 2.0, 6]} />
          </mesh>
          <mesh
            material={glow("#ffe9a8", 1.8)}
            position={[0, 2.05, -SLIME_TRACK.half - 0.05]}
          >
            <sphereGeometry args={[0.09, 8, 6]} />
          </mesh>
        </group>
      ))}
      <Stall
        position={[SLIME_KEEPER.x + 0.5, 0, SLIME_KEEPER.z]}
        yaw={Math.PI / 2}
        node="bz_stall_slime"
        cloth="#3fae6a"
        cloth2="#ffd9ec"
        width={2.0}
      />
      <Keeper
        position={[SLIME_KEEPER.x - 0.95, 0, SLIME_KEEPER.z]}
        yaw={Math.PI / 2}
        body="#2f8a55"
        hat="#ff9ec0"
        vrm="avatars/cute-cat.vrm"
      />
    </group>
  );
}
