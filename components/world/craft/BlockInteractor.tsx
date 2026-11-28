"use client";
/**
 * G4 — Tương tác khối của Vùng Kỳ quan: nhắm (dò tia voxel không cấp phát), GIỮ chuột trái để đào (thời gian theo độ
 * cứng + dụng cụ, vết nứt trên khối), chuột phải đặt khối từ ô đang cầm (sinh tồn: bớt 1), chuột phải lên Bàn Dã chiến
 * để chế tạo. Khối vẫn đi qua setBlock → netEdit (nhiều người chơi như cũ). Đồ rơi: một InstancedMesh (bể cố định).
 */
import { useEffect, useMemo, useRef } from "react";
import { useFrame, useThree } from "@react-three/fiber";
import * as THREE from "three";
import { attack, enemyInFront } from "../combat/combat";
import { useWorld } from "../store";
import { GRADIENT } from "../fx/shaders";
import { B, BLOCK_RGB, blockAt, columnReady, isSolidBlock, isTargetBlock, setBlock } from "@/lib/world/voxels";
import { ITEMS, ITEM_IDS } from "@/lib/world/itemDefs";
import { MiningProgress, breakTime, canHarvest, cellHitsBody, dropFor, raycastInto } from "@/lib/world/mining";
import { sfx } from "@/lib/world/sfx";
import { DROPS, consumeSlot, dropMax, dropRoom, dropTake, isCreative, spawnDrop, useInv } from "./invStore";
import { saveStats, startWorldSave } from "./worldSave";
import { ITEM_USE } from "./itemUse";

/** Trạng thái đào cho HUD (đọc bằng rAF, không qua React) */
export const MINE = { has: false, x: 0, y: 0, z: 0, id: 0, frac: 0, mining: false, harvest: true, need: 0 };

const TMP_DIR = new THREE.Vector3();
const HIT = new Int32Array(6);
/** va chạm đồ rơi (đuốc / nước đi xuyên) */
const solidAt = (x: number, y: number, z: number) => isSolidBlock(blockAt(x, y, z));
/**
 * tia nhắm: trúng mọi khối trừ không khí / nước (đuốc vẫn nhắm để phá được). Chunk chưa có dữ liệu (chưa dựng lưới — cũng chưa
 * hiện) thì coi như trống: tia dò MỖI KHUNG không được kéo việc sinh chunk đồng bộ về luồng chính.
 */
const targetAt = (x: number, y: number, z: number) => columnReady(x, z) && isTargetBlock(blockAt(x, y, z));
const CREATIVE_REPEAT = 0.22;
/** uniform của vết nứt (một khối duy nhất được đào tại một thời điểm) */
const CRACK_U = { uProg: { value: 0 } };

export function openCraft(station: "hand" | "bench") {
  // Máy Ép Hoa văn trong túi + đứng ở bàn → trạm "press" (công thức bậc 2)
  const press = station === "bench" && useInv.getState().slots.some((sl) => sl?.id === "pattern_press");
  useInv.setState({ station: press ? "press" : station, pick: null });
  useWorld.setState({ overlay: "craft" });
}

const tool = () => {
  const s = useInv.getState().slots[useWorld.getState().hotbar];
  return s ? ITEMS[s.id]?.tool ?? null : null;
};

export function BlockInteractor() {
  const { camera, gl } = useThree();
  const box = useRef<THREE.LineSegments>(null);
  const crack = useRef<THREE.Mesh>(null);
  const st = useRef({ has: false, mining: false, once: false, cool: 0, tick: 0, prog: new MiningProgress() });
  const edges = useMemo(() => new THREE.EdgesGeometry(new THREE.BoxGeometry(1.02, 1.02, 1.02)), []);
  const crackMat = useMemo(() => crackMaterial(), []);
  useEffect(() => {
    startWorldSave();
    if (process.env.NODE_ENV !== "production") Object.assign(window, { __craft: { DROPS, MINE, inv: useInv, save: saveStats, setBlock } });
  }, []);
  useEffect(() => () => (edges.dispose(), crackMat.dispose()), [edges, crackMat]);

  useEffect(() => {
    const S = st.current;
    const place = () => {
      if (useWorld.getState().overlay) return;
      // vật phẩm "dùng được" (Chìa Khảo sát, Thẻ Rút…): xử lý trước khi đặt khối / mở bàn
      const held = useInv.getState().slots[useWorld.getState().hotbar];
      const onUse = held ? ITEM_USE[held.id] : undefined;
      if (onUse && onUse({ bench: S.has && blockAt(HIT[0], HIT[1], HIT[2]) === B.bench })) return;
      if (!S.has) return;
      const [x, y, z, nx, ny, nz] = HIT;
      if (blockAt(x, y, z) === B.bench) return openCraft("bench");
      const slot = useWorld.getState().hotbar;
      const s = useInv.getState().slots[slot];
      const block = s ? ITEMS[s.id]?.block : undefined;
      if (block === undefined) return;
      const px = x + nx;
      const py = y + ny;
      const pz = z + nz;
      const p = useWorld.getState().player;
      if (cellHitsBody(px, py, pz, p.x, p.y, p.z)) return;
      const cur = blockAt(px, py, pz);
      if ((cur !== B.air && cur !== B.water) || py < -40 || py > 80) return;
      if (!consumeSlot(slot)) return;
      setBlock(px, py, pz, block);
      sfx.click();
    };
    const down = (e: MouseEvent) => {
      if (document.pointerLockElement !== gl.domElement) return;
      if (e.button === 0) {
        const w = useWorld.getState();
        if (enemyInFront(w.player, w.playerYaw)) attack();
        else S.mining = true;
      }
      if (e.button === 2) place();
    };
    const up = (e: MouseEvent) => {
      if (e.button === 0) S.mining = false;
    };
    const stop = () => {
      S.mining = false;
      S.once = false;
    };
    const ctx = (e: MouseEvent) => e.preventDefault();
    // nút cảm ứng (Hud): "mine-start"/"mine-stop" (giữ để đào), "break" (chạm một lần = đào tới khi vỡ), "place"
    const ui = (e: Event) => {
      const d = (e as CustomEvent).detail;
      if (d === "place") place();
      else if (d === "mine-start") S.mining = true;
      else if (d === "mine-stop") stop();
      else if (d === "break") {
        S.mining = true;
        S.once = true;
      }
    };
    window.addEventListener("mousedown", down);
    window.addEventListener("mouseup", up);
    window.addEventListener("blur", stop);
    document.addEventListener("pointerlockchange", stop);
    gl.domElement.addEventListener("contextmenu", ctx);
    window.addEventListener("world-block", ui);
    return () => {
      window.removeEventListener("mousedown", down);
      window.removeEventListener("mouseup", up);
      window.removeEventListener("blur", stop);
      document.removeEventListener("pointerlockchange", stop);
      gl.domElement.removeEventListener("contextmenu", ctx);
      window.removeEventListener("world-block", ui);
    };
  }, [gl]);

  useFrame((_, dt) => {
    const S = st.current;
    camera.getWorldDirection(TMP_DIR);
    const o = camera.position;
    const w = useWorld.getState();
    // tầm với tính từ nhân vật: dò xa hơn khoảng cách máy quay
    S.has = raycastInto(HIT, targetAt, o.x, o.y, o.z, TMP_DIR.x, TMP_DIR.y, TMP_DIR.z, w.camDist + 6);
    const x = HIT[0];
    const y = HIT[1];
    const z = HIT[2];
    const id = S.has ? blockAt(x, y, z) : B.air;
    const tl = tool();
    const creative = isCreative();
    MINE.has = S.has;
    MINE.x = x;
    MINE.y = y;
    MINE.z = z;
    MINE.id = id;
    MINE.harvest = creative || canHarvest(id, tl);
    MINE.mining = S.mining;
    if (box.current) {
      box.current.visible = S.has;
      if (S.has) box.current.position.set(x + 0.5, y + 0.5, z + 0.5);
    }
    S.cool = Math.max(0, S.cool - dt);
    let frac = 0;
    if (S.mining && S.has && !w.overlay) {
      if (creative) {
        // sáng tạo: phá ngay, giữ chuột thì lặp mỗi 0,22 s (đỡ phá nhầm cả hàng — và giới hạn 6 khối/s của server)
        if (S.cool <= 0) {
          breakBlock(x, y, z, id, true);
          S.cool = CREATIVE_REPEAT;
          if (S.once) S.mining = S.once = false;
        }
      } else {
        const need = breakTime(id, tl);
        MINE.need = need;
        if (S.prog.step(x, y, z, id, need, dt)) {
          breakBlock(x, y, z, id, false);
          if (S.once) S.mining = S.once = false;
        } else {
          frac = S.prog.frac;
          S.tick += dt;
          if (S.tick > 0.24) {
            S.tick = 0;
            sfx.step();
          }
        }
      }
    } else S.prog.reset();
    MINE.frac = frac;
    if (crack.current) {
      crack.current.visible = frac > 0;
      if (frac > 0) {
        crack.current.position.set(x + 0.5, y + 0.5, z + 0.5);
        CRACK_U.uProg.value = frac;
      }
    }
    // đồ rơi: mô phỏng (va chạm khối, nam châm, nhặt = giao dịch túi đồ)
    const p = w.player;
    DROPS.step(dt, solidAt, p.x, p.y, p.z, dropRoom, dropTake, dropMax);
  });

  return (
    <>
      <lineSegments ref={box} geometry={edges}>
        <lineBasicMaterial color="#ffffff" transparent opacity={0.85} />
      </lineSegments>
      <mesh ref={crack} material={crackMat} visible={false} renderOrder={2}>
        <boxGeometry args={[1.003, 1.003, 1.003]} />
      </mesh>
      <ItemDrops />
    </>
  );
}

function breakBlock(x: number, y: number, z: number, id: number, creative: boolean) {
  const tl = tool();
  setBlock(x, y, z, B.air);
  sfx.hit(0);
  const c = BLOCK_RGB[id]?.[1] ?? [0.9, 0.86, 0.75];
  useWorld.getState().burst([x + 0.5, y + 0.5, z + 0.5], `rgb(${Math.round(c[0] * 255)},${Math.round(c[1] * 255)},${Math.round(c[2] * 255)})`, 12);
  if (creative) return;
  const d = dropFor(id, tl, Math.random());
  if (d) spawnDrop(d.id, d.n, x + 0.5, y + 0.5, z + 0.5);
}

/**
 * Vết nứt: mặt nạ pixel-art (public/world/voxel/crack.png, tách từ tranh Codex — scripts/voxel-items.py), mỗi điểm nứt mang
 * NGƯỠNG LỘ theo khoảng cách tới tâm → 8 nấc lan dần từ giữa mặt ra cùng một hình vẽ; mỗi mặt xoay / lật khác nhau.
 * Đặt sát mặt khối, lệch độ sâu để khỏi nhấp nháy.
 */
let crackTex: THREE.Texture | null = null;
function crackMaterial() {
  if (!crackTex) {
    crackTex = new THREE.TextureLoader().load("/world/voxel/crack.png");
    crackTex.magFilter = crackTex.minFilter = THREE.NearestFilter;
    crackTex.generateMipmaps = false;
  }
  return new THREE.ShaderMaterial({
    uniforms: { ...CRACK_U, uCrack: { value: crackTex } },
    transparent: true,
    depthWrite: false,
    polygonOffset: true,
    polygonOffsetFactor: -2,
    polygonOffsetUnits: -2,
    vertexShader: /* glsl */ `
      varying vec3 vP; varying vec3 vN;
      void main() { vP = position; vN = normal; gl_Position = projectionMatrix * modelViewMatrix * vec4(position, 1.0); }`,
    fragmentShader: /* glsl */ `
      uniform float uProg; uniform sampler2D uCrack; varying vec3 vP; varying vec3 vN;
      void main() {
        vec3 a = abs(vN);
        vec2 uv = (a.x > 0.5 ? vP.zy : a.y > 0.5 ? vP.xz : vP.xy) + 0.5;
        // mỗi mặt một hướng (xoay 90° / lật theo pháp tuyến) — 6 mặt không giống hệt nhau
        float f = dot(vN, vec3(1.0, 2.0, 3.0));
        if (f > 0.0) uv = vec2(1.0 - uv.y, uv.x);
        if (abs(f) > 1.5) uv.x = 1.0 - uv.x;
        float stage = ceil(uProg * 8.0) / 8.0;
        float thr = texture2D(uCrack, clamp(uv, 0.001, 0.999)).r;
        float line = step(0.002, thr) * step(thr, stage * 1.02);
        float alpha = max(line * 0.82, stage * 0.14);
        gl_FragColor = vec4(mix(vec3(0.16, 0.11, 0.2), vec3(0.07, 0.05, 0.08), line), alpha);
      }`,
  });
}

// ───────────── Đồ rơi: một InstancedMesh, ≤ DROPS.cap thực thể, không cấp phát mỗi khung ─────────────

const DUMMY = new THREE.Object3D();
const COLORS: THREE.Color[] = ITEM_IDS.map((id) => new THREE.Color(ITEMS[id].color));

function ItemDrops() {
  const ref = useRef<THREE.InstancedMesh>(null);
  const geo = useMemo(() => new THREE.BoxGeometry(0.28, 0.28, 0.28), []);
  const mat = useMemo(() => new THREE.MeshToonMaterial({ gradientMap: GRADIENT, emissive: "#ffffff", emissiveIntensity: 0.12 }), []);
  useEffect(() => () => (geo.dispose(), mat.dispose()), [geo, mat]);
  useEffect(() => {
    const m = ref.current;
    if (!m) return;
    // instanceColor phải có trước lần vẽ đầu (tạo một lần, cập nhật tại chỗ)
    for (let i = 0; i < DROPS.cap; i++) m.setColorAt(i, COLORS[0]);
    m.count = 0;
  }, []);
  useFrame((s) => {
    const m = ref.current;
    if (!m) return;
    const t = s.clock.elapsedTime;
    let k = 0;
    for (let i = 0; i < DROPS.cap; i++) {
      const it = DROPS.item[i];
      if (it < 0) continue;
      const a = DROPS.age[i];
      const n = DROPS.count[i];
      DUMMY.position.set(DROPS.px[i], DROPS.py[i] + (DROPS.rest[i] ? 0.06 + Math.sin(t * 2.6 + i) * 0.05 : 0), DROPS.pz[i]);
      DUMMY.rotation.set(0.35, a * 1.7 + i, 0.2);
      DUMMY.scale.setScalar(n > 1 ? 1 + Math.min(n, 32) / 64 : 1);
      DUMMY.updateMatrix();
      m.setMatrixAt(k, DUMMY.matrix);
      m.setColorAt(k, COLORS[it]);
      k++;
    }
    m.count = k;
    m.instanceMatrix.needsUpdate = true;
    if (m.instanceColor) m.instanceColor.needsUpdate = true;
  });
  return <instancedMesh ref={ref} args={[geo, mat, DROPS.cap]} frustumCulled={false} />;
}
