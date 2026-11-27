"use client";
/**
 * Thư viện Babel (theo Borges, 1941) — một vùng riêng, vô hạn.
 * - Một đơn vị Blender (`props/babel.glb`: phòng lục giác + hành lang + giếng cầu thang, GI nướng vào màu đỉnh) được vẽ
 *   instanced ở 18 ô: dọc hành lang (−1…+2) và theo giếng thông gió (±4 tầng) → nhìn qua cửa hay qua lan can đều thấy
 *   các phòng giống hệt nối tiếp mãi rồi chìm vào sương hổ phách.
 * - Vô hạn thật: đi qua hết một chu kỳ, thế giới "quấn" người chơi về ô giống hệt (kèm máy quay) và đổi số hiệu phòng
 *   (một số nguyên ~2 871 chữ số cơ số 36). Cầu thang xoắn: đi vòng một vòng là lên / xuống một tầng.
 * - 11 520 cuốn sách instanced, màu gáy tất định theo địa chỉ (phòng, tường, kệ, cuốn); mở ra đọc được trang thật.
 * - Thủ thư Tịnh ở phòng lối vào; gương trong hành lang phản chiếu thật (chỉ bật khi đứng gần).
 */
import { useEffect, useMemo, useRef } from "react";
import { useFrame, useThree } from "@react-three/fiber";
import { useGLTF } from "@react-three/drei";
import * as THREE from "three";
import { Reflector } from "three/examples/jsm/objects/Reflector.js";
import { worldAsset, AVATAR_BY_ID } from "@/lib/world/avatars";
import { BR, babelFree, babelSpot, clampBabelCam, SHELF_WALLS, wrapX } from "@/lib/world/babelRoom";
import { hashStr, neighborHex } from "@/lib/world/babel";
import { useWorld } from "../store";
import { Player, type Nearby } from "./Hub";
import { Avatar } from "../player/Avatar";
import { RemotePlayers } from "./RemotePlayers";
import { bakedMaterial } from "../fx/baked";
import { toonize } from "../fx/glbToon";
import { CAM, motion } from "../combat/combat";
import { atEntry, stepHex, useBabel } from "./babelState";
import { Label3D } from "../ui/Labels";

const GLB = worldAsset("props/babel.glb");
const LECTERN = worldAsset("props/babel_lectern.glb");
useGLTF.preload(GLB);
useGLTF.preload(LECTERN);

/** Ô vẽ: (dx theo hành lang, dy theo tầng) */
const SLOTS: [number, number][] = [];
for (let fy = -4; fy <= 4; fy++) SLOTS.push([0, fy]);
for (const dx of [-1, 1, 2]) for (let fy = -1; fy <= 1; fy++) SLOTS.push([dx, fy]);
const BOOKS_PER_UNIT = 4 * 5 * 32;

export const BAB_U = {
  uExposure: { value: 1.35 },
  uFloor: { value: 0.3 },
  uTint: { value: new THREE.Color(1, 0.97, 0.92) },
  uScale: { value: 1.6 },
};
/** Thủ thư + bàn đọc trong phòng lối vào */
export const LIBRARIAN = { x: -2.9, z: 1.0 };
export const DESK = { x: -2.0, z: 2.75 };
const LEATHER = ["#7a2f3a", "#2f4a7a", "#8f6a2a", "#3f6b4a", "#5a3b6e", "#8a4a2a", "#2a5f66", "#6b5a3a", "#4a2a2a", "#9a7a4a"].map((c) => new THREE.Color(c));

function bookMaterial() {
  const m = new THREE.MeshBasicMaterial({ color: "#ffffff" });
  m.onBeforeCompile = (sh) => {
    sh.vertexShader = sh.vertexShader
      .replace("#include <common>", "#include <common>\nvarying vec2 vBookUv; varying vec3 vBookW;")
      .replace("#include <begin_vertex>", "#include <begin_vertex>\nvBookUv = uv; vBookW = (modelMatrix * instanceMatrix * vec4(transformed, 1.0)).xyz;");
    sh.fragmentShader = sh.fragmentShader
      .replace("#include <common>", "#include <common>\nvarying vec2 vBookUv; varying vec3 vBookW;")
      .replace(
        "#include <color_fragment>",
        `#include <color_fragment>
        // hai vạch nhũ vàng trên gáy
        float band = smoothstep(0.025, 0.0, abs(vBookUv.y - 0.14)) + smoothstep(0.025, 0.0, abs(vBookUv.y - 0.86));
        diffuseColor.rgb = mix(diffuseColor.rgb, vec3(0.86, 0.66, 0.3), band * 0.75);
        // ánh đèn cầu của đơn vị (toạ độ quy về một đơn vị)
        float P = ${BR.PERIOD.toFixed(4)}; float FH = ${BR.FH.toFixed(4)}; float AP = ${BR.AP.toFixed(4)};
        vec3 q = vec3(vBookW.x - floor((vBookW.x + AP) / P) * P, vBookW.y - floor(vBookW.y / FH) * FH, vBookW.z);
        vec3 l0 = q - vec3(0.0, 2.45, -3.05); vec3 l1 = q - vec3(0.0, 2.45, 3.05);
        float lit = 1.0 / (1.0 + dot(l0, l0) * 0.12) + 1.0 / (1.0 + dot(l1, l1) * 0.12);
        float low = smoothstep(0.0, 2.6, q.y);
        diffuseColor.rgb *= (0.32 + 1.05 * lit) * (0.8 + 0.2 * low) * vec3(1.05, 0.93, 0.78);`,
      );
  };
  return m;
}

function slotHex(base: bigint, dx: number, dy: number) {
  return dx === 0 && dy === 0 ? base : neighborHex(base, dx, dy);
}

function Units() {
  const gltf = useGLTF(GLB);
  const { meshes, mats, mirrorGeo } = useMemo(() => {
    const cache = new Map<string, THREE.Material>();
    const list: { geo: THREE.BufferGeometry; mat: THREE.Material }[] = [];
    let mirrorGeo: THREE.BufferGeometry | null = null;
    gltf.scene.traverse((o) => {
      const m = o as THREE.Mesh;
      if (!m.isMesh) return;
      const src = m.material as THREE.MeshStandardMaterial;
      if (m.name.startsWith("bab_mirror") && src.name === "glow_mirror") {
        mirrorGeo = m.geometry;
      }
      let mat = cache.get(src.name);
      if (!mat) {
        if (src.name === "glow_lamp") mat = new THREE.MeshBasicMaterial({ color: new THREE.Color("#ffd9a0").multiplyScalar(2.6), toneMapped: false });
        else if (src.name === "glow_mirror") mat = new THREE.MeshBasicMaterial({ color: new THREE.Color("#6e7c8a") });
        else mat = bakedMaterial(src, BAB_U);
        cache.set(src.name, mat);
      }
      list.push({ geo: m.geometry, mat });
    });
    return { meshes: list, mats: [...cache.values()], mirrorGeo: mirrorGeo as THREE.BufferGeometry | null };
  }, [gltf]);
  useEffect(() => () => mats.forEach((m) => m.dispose()), [mats]);
  const refs = useRef<(THREE.InstancedMesh | null)[]>([]);
  useEffect(() => {
    const mtx = new THREE.Matrix4();
    refs.current.forEach((im) => {
      if (!im) return;
      SLOTS.forEach(([dx, dy], i) => {
        mtx.makeTranslation(dx * BR.PERIOD, dy * BR.FH, 0);
        im.setMatrixAt(i, mtx);
      });
      im.instanceMatrix.needsUpdate = true;
      im.computeBoundingSphere();
    });
  }, [meshes]);
  return (
    <group>
      {meshes.map((m, i) => (
        <instancedMesh key={i} ref={(el) => void (refs.current[i] = el)} args={[m.geo, m.mat, SLOTS.length]} frustumCulled={false} />
      ))}
      {mirrorGeo && <Mirror geo={mirrorGeo} />}
    </group>
  );
}

/** Gương trong hành lang ô gốc: phản chiếu thật (Reflector), chỉ bật khi đứng gần để không tốn một lượt vẽ cả cảnh */
function Mirror({ geo }: { geo: THREE.BufferGeometry }) {
  const refl = useMemo(() => {
    geo.computeBoundingBox();
    const bb = geo.boundingBox!;
    const w = bb.max.x - bb.min.x;
    const h = bb.max.y - bb.min.y;
    const c = new THREE.Vector3();
    bb.getCenter(c);
    const r = new Reflector(new THREE.PlaneGeometry(w, h), { textureWidth: 384, textureHeight: 768, color: new THREE.Color("#c9d4dc"), clipBias: 0.003 });
    // mặt gương quay về −z (vào lòng hành lang); lùi ra 1 cm khỏi khung
    r.position.set(c.x, c.y, c.z - 0.01);
    r.rotation.y = Math.PI;
    return r;
  }, [geo]);
  useEffect(() => () => refl.dispose(), [refl]);
  useFrame(() => {
    const p = useWorld.getState().player;
    const { lx } = wrapX(p.x);
    refl.visible = Math.abs(p.y) < 1 && lx > BR.AP - 2.5 && Math.abs(p.z) < 3;
  });
  return <primitive object={refl} />;
}

function Books() {
  const ref = useRef<THREE.InstancedMesh>(null);
  const { geo, mat } = useMemo(() => {
    const g = new THREE.BoxGeometry(1, 1, 1);
    g.translate(0, 0.5, 0);
    return { geo: g, mat: bookMaterial() };
  }, []);
  useEffect(() => () => [geo, mat].forEach((x) => x.dispose()), [geo, mat]);
  const rev = useBabel((s) => s.rev);
  // Vị trí: tính một lần (đơn vị gốc) rồi nhân lên các ô
  useEffect(() => {
    const im = ref.current;
    if (!im) return;
    const m = new THREE.Matrix4();
    const basis = new THREE.Matrix4();
    const sd = new THREE.Vector3();
    const inw = new THREE.Vector3();
    const up = new THREE.Vector3(0, 1, 0);
    const W = BR.RH - 0.5;
    let n = 0;
    SLOTS.forEach(([dx, dy]) => {
      SHELF_WALLS.forEach((s, w) => {
        sd.set(-s.nz, 0, s.nx);
        inw.set(-s.nx, 0, -s.nz);
        basis.makeBasis(sd, up, inw);
        for (let sh = 0; sh < 5; sh++)
          for (let v = 0; v < 32; v++) {
            const h = 0.36 + ((hashStr(`${w}${sh}${v}`) % 97) / 97) * 0.09;
            const off = -W / 2 + ((v + 0.5) * W) / 32;
            const depth = BR.CASE_D / 2 + 0.02;
            m.copy(basis).scale(new THREE.Vector3((W / 32) * 0.86, h, 0.26));
            m.setPosition(s.nx * BR.AP - s.nx * depth + sd.x * off + dx * BR.PERIOD, BR.SHELF_Z[sh] + 0.025 + dy * BR.FH, s.nz * BR.AP - s.nz * depth + sd.z * off);
            im.setMatrixAt(n++, m);
          }
      });
    });
    im.instanceMatrix.needsUpdate = true;
  }, [geo, mat]);
  // Màu gáy: tất định theo (phòng, tường, kệ, cuốn) — đổi khi sang phòng khác
  useEffect(() => {
    const im = ref.current;
    if (!im) return;
    const base = useBabel.getState().hex;
    let n = 0;
    SLOTS.forEach(([dx, dy]) => {
      const tag = slotHex(base, dx, dy).toString(36).slice(-10);
      for (let w = 0; w < 4; w++)
        for (let sh = 0; sh < 5; sh++)
          for (let v = 0; v < 32; v++) {
            const h = hashStr(`${tag}:${w}:${sh}:${v}`);
            const c = LEATHER[h % LEATHER.length];
            im.setColorAt(n++, c);
          }
    });
    if (im.instanceColor) im.instanceColor.needsUpdate = true;
  }, [rev, geo, mat]);
  return <instancedMesh ref={ref} args={[geo, mat, SLOTS.length * BOOKS_PER_UNIT]} frustumCulled={false} />;
}

/** Màn sương hổ phách che "rìa thế giới" (ngoài 4 tầng / 2 phòng) */
function Haze() {
  const mat = useMemo(() => new THREE.MeshBasicMaterial({ color: "#6d4527", side: THREE.BackSide, fog: false, depthWrite: false }), []);
  useEffect(() => () => mat.dispose(), [mat]);
  return (
    <mesh material={mat} renderOrder={-2}>
      <sphereGeometry args={[60, 24, 12]} />
    </mesh>
  );
}

/** Bục đọc của Thủ thư (bàn "sách từ bên ngoài") — chỉ ở phòng lối vào */
function Lectern() {
  const gltf = useGLTF(LECTERN);
  const obj = useMemo(() => toonize(gltf.scene), [gltf]);
  const g = useRef<THREE.Group>(null);
  useFrame(() => {
    if (g.current) g.current.visible = atEntry();
  });
  return (
    <group ref={g} position={[DESK.x, 0, DESK.z]} rotation-y={Math.atan2(-DESK.x, -DESK.z) + Math.PI}>
      <primitive object={obj} />
    </group>
  );
}

function Librarian() {
  const g = useRef<THREE.Group>(null);
  const lamp = useMemo(() => new THREE.MeshBasicMaterial({ color: new THREE.Color("#ffd9a0").multiplyScalar(2.4), toneMapped: false }), []);
  useEffect(() => () => lamp.dispose(), [lamp]);
  useFrame(() => {
    if (g.current) g.current.visible = atEntry();
  });
  return (
    <group ref={g}>
      <group position={[LIBRARIAN.x, 0, LIBRARIAN.z]} rotation-y={1.9}>
        <Avatar url={worldAsset(AVATAR_BY_ID.savi?.file ?? "avatars/savi.vrm")} pose="idle" npc />
        <mesh position={[0.32, 1.05, 0.18]} material={lamp}>
          <sphereGeometry args={[0.09, 16, 12]} />
        </mesh>
        <Label3D text="Tịnh · Thủ thư Babel" position={[0, 2.05, 0]} variant="name" />
      </group>
    </group>
  );
}

const CLIMB_MS = 2600;
export function Babel() {
  const avatar = useWorld((s) => s.avatar);
  const shift = useMemo(() => new THREE.Vector3(), []);
  const { scene, gl } = useThree();
  useEffect(() => {
    if (process.env.NODE_ENV !== "production") (window as unknown as { __babel: unknown }).__babel = { scene, gl, useBabel };
  }, [scene, gl]);
  useEffect(() => {
    CAM.shift = null;
    return () => {
      CAM.shift = null;
    };
  }, []);
  useFrame(() => {
    const st = useWorld.getState();
    const p = st.player;
    // Cầu thang xoắn: đi một vòng quanh cột giữa, lên/xuống đúng một tầng, rồi quấn về tầng 0 + đổi phòng
    const climb = useBabel.getState().climb;
    if (climb) {
      const k = Math.min(1, (performance.now() - climb.t0) / CLIMB_MS);
      const e = k * k * (3 - 2 * k);
      const a = -Math.PI / 2 + 0.6 + (climb.dir > 0 ? 1 : -1) * e * Math.PI * 2;
      const { k: cell } = wrapX(p.x);
      p.x = cell * BR.PERIOD + BR.STAIR.x + Math.cos(a) * 0.72;
      p.z = BR.STAIR.z - Math.sin(a) * 0.72;
      p.y = climb.dir * BR.FH * e;
      useWorld.setState({ playerYaw: -a + (climb.dir > 0 ? 0 : Math.PI) });
      motion.vy = 0;
      motion.grounded = true;
      if (k >= 1) {
        p.y -= climb.dir * BR.FH;
        CAM.shift = shift.set(0, -climb.dir * BR.FH, 0).clone();
        // ra cửa giếng cầu thang
        p.x = cell * BR.PERIOD + BR.STAIR.x;
        p.z = -BR.HALL_W / 2 + 0.45;
        p.y = 0;
        stepHex(0, climb.dir);
        useBabel.setState({ climb: null });
      }
      return;
    }
    // Quấn theo hành lang: luôn giữ người chơi ở ô gốc (các ô xung quanh giống hệt)
    const { k } = wrapX(p.x);
    if (k !== 0) {
      p.x -= k * BR.PERIOD;
      CAM.shift = shift.set(-k * BR.PERIOD, 0, 0).clone();
      stepHex(k, 0);
    }
  });
  return (
    <group>
      <fog attach="fog" args={["#6d4527", 7, 30]} />
      <hemisphereLight args={["#ffe2b8", "#5a3a24", 0.6]} />
      <Haze />
      <Units />
      <Books />
      <Librarian />
      <Lectern />
      <RemotePlayers />
      <Player avatarFile={AVATAR_BY_ID[avatar]?.file} ground={() => 0} blocked={babelBlocked} findNearby={babelNearby} camClamp={clampCam} />
    </group>
  );
}

/** Va chạm: hình học đơn vị + bục đọc và Thủ thư ở phòng lối vào */
function babelBlocked(x: number, z: number) {
  if (!babelFree(x, z)) return true;
  if (!atEntry()) return false;
  const { lx } = wrapX(x);
  return Math.hypot(lx - DESK.x, z - DESK.z) < 0.6 || Math.hypot(lx - LIBRARIAN.x, z - LIBRARIAN.z) < 0.5;
}

const CAM_T = { x: 0, y: 0, z: 0 };
function clampCam(pos: THREE.Vector3, target: THREE.Vector3) {
  CAM_T.x = pos.x;
  CAM_T.y = pos.y;
  CAM_T.z = pos.z;
  if (clampBabelCam(CAM_T, target)) pos.set(CAM_T.x, CAM_T.y, CAM_T.z);
}

function babelNearby(p: THREE.Vector3): Nearby | null {
  if (useBabel.getState().climb) return null;
  const vi = useWorld.getState().lang === "vi";
  const { lx } = wrapX(p.x);
  if (atEntry()) {
    if (Math.hypot(lx - LIBRARIAN.x, p.z - LIBRARIAN.z) < 1.8) return { kind: "npc", id: "librarian", label: vi ? "Trò chuyện với Thủ thư Tịnh" : "Talk to Tịnh, the Librarian" };
  }
  const s = babelSpot(p.x, p.z);
  if (!s) return null;
  if (s.kind === "stair") return { kind: "stair", label: vi ? "Cầu thang xoắn — lên / xuống" : "Spiral stair — up / down" };
  if (s.kind === "mirror") return null;
  if (atEntry() && s.wall === 2 && Math.hypot(lx - DESK.x, p.z - DESK.z) < 1.6) return { kind: "shelf", id: "desk", label: vi ? "Bàn đọc của Thủ thư" : "The Librarian's desk" };
  return { kind: "shelf", id: String(s.wall), label: vi ? `Xem giá sách · tường ${s.wall + 1}` : `Browse the shelves · wall ${s.wall + 1}` };
}
