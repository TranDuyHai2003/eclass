"use client";
/**
 * Hư Không Nghịch Lý — quần đảo nổi giữa vũ trụ (`props/paradox_void.glb`, Blender, GI nướng): đảo tâm + 10 đảo trạm trên hai vòng
 * cao thấp lệch nhau, nối bằng cầu phiến đá nổi; bên dưới là vực đĩa Poincaré vô tận, trên cao siêu khối 4D, xa xa hố đen, bão Lorenz
 * và các kỳ quan bất khả (ParadoxVoidFx). Mỗi đảo trạm một vật trưng bày động (`props/paradox_props.glb` + hình toán vẽ bằng code):
 *  Achilles & rùa · Ngày sinh · Simpson · Banach–Tarski · Thợ cạo Russell · Newcomb · Đường bờ biển · Braess · Grandi/đèn Thomson · Anh em sinh đôi.
 * Giữa đảo tâm: dải Möbius vàng xoay chậm. Phía bắc đảo tâm: Hồi âm Zeno (người dẫn). Đảo nhỏ phía nam: cổng về sân.
 */
import { useEffect, useMemo, useRef } from "react";
import { useFrame } from "@react-three/fiber";
import { useGLTF } from "@react-three/drei";
import * as THREE from "three";
import { BEAST_LOOKS, BEAST_PATHS, CosmicBeast } from "../fx/CosmicBeast";
const PDX_BEAST_SUN = new THREE.Vector3(0.3, 0.6, -0.7).normalize();
import { worldAsset, AVATAR_BY_ID } from "@/lib/world/avatars";
import { braess, gamma, kochPoints } from "@/lib/world/paradox";
import { bakedMaterial } from "../fx/baked";
import { toonize } from "../fx/glbToon";
import { useWorld } from "../store";
import { Avatar } from "../player/Avatar";
import { Label3D } from "../ui/Labels";
import { Player, type Nearby } from "./Hub";
import { RemotePlayers } from "./RemotePlayers";
import { PARADOXES } from "./paradoxData";
import { EXIT, ISLES, voidGround } from "@/lib/world/paradoxVoid";
import { EYE, Stardust, VoidSky, VoidWonders } from "./ParadoxVoidFx";
import { Constellation, LensTracker, MobiusEnergy, StarWhale } from "./ParadoxWow";
import { GodSun, HubMirror, ShadowRig, VoidEnvironment, hybridMaterial, usePdxStyle } from "./VoidHybrid";
import { useGfx } from "../gfx";

const HOLE_POS: [number, number, number] = [95, 60, -170];
import { CosmicExpansion, cosmosBlocked, cosmosNearby } from "./ParadoxCosmos";
import { motion } from "../combat/combat";
import { floatText } from "../ui/Labels";
import { sfx } from "@/lib/world/sfx";
import { ArrivalSweep, Aurora, GlyphMotes, ShootingStars, StepRipples, VfxClock, glowPulse } from "./ParadoxVfx";
import { MagicCircle } from "../fx/Effects";

const HALL = worldAsset("props/paradox_void.glb");
const PROPS = worldAsset("props/paradox_props.glb");
useGLTF.preload(HALL);
useGLTF.preload(PROPS);

const PED_Y = 0.86;
const U = { uExposure: { value: 1.0 }, uFloor: { value: 0.32 }, uTint: { value: new THREE.Color(1, 0.97, 1.02) }, uScale: { value: 1.85 } };
/** Tâm 10 đảo trạm (y = mặt đảo) */
export const STATIONS = ISLES.map((s) => new THREE.Vector3(s.x, s.h, s.z));
export const GUIDE = new THREE.Vector3(0, 0, -6.2);
export const PDX_EXIT = new THREE.Vector3(EXIT.x, EXIT.h, EXIT.z);

export function ParadoxHall() {
  const avatar = useWorld((s) => s.avatar);
  const lang = useWorld((s) => (s.lang === "vi" ? "vi" : "en"));
  const gltf = useGLTF(HALL);
  const real = usePdxStyle((s) => s.real);
  const gfx = useGfx();
  const { root, mats } = useMemo(() => {
    const cache = new Map<string, THREE.Material>();
    const root = gltf.scene.clone(true);
    root.traverse((o) => {
      const m = o as THREE.Mesh;
      if (!m.isMesh) return;
      // GLB đảo xuất không kèm pháp tuyến (kiểu nướng không cần) — vật liệu PBR cần → tính một lần khi nạp
      if (real && !m.geometry.getAttribute("normal")) m.geometry.computeVertexNormals();
      const debris = /^v_debris/.test(m.name) || /^v_debris/.test(m.parent?.name ?? "");
      const conv = (sm: THREE.Material) => {
        const s = sm as THREE.MeshStandardMaterial;
        const key = real && debris && s.name === "v_floor_b" ? "debris_top" : s.name;
        let mat = cache.get(key);
        if (!mat) {
          if (s.name.startsWith("glow_")) {
            const g = new THREE.MeshBasicMaterial({ color: s.color.clone().multiplyScalar(real ? 3.0 : 2.2), toneMapped: false, side: THREE.DoubleSide });
            glowPulse(g, s.name);
            mat = g;
          } else mat = real ? hybridMaterial(s, true, key) : bakedMaterial(s, U);
          cache.set(key, mat);
        }
        return mat;
      };
      m.material = Array.isArray(m.material) ? m.material.map(conv) : conv(m.material);
    });
    return { root, mats: [...cache.values()] };
  }, [gltf, real]);
  useEffect(() => () => mats.forEach((m) => m.dispose()), [mats]);
  return (
    <group>
      <fog attach="fog" args={["#22184c", 70, 260]} />
      <ambientLight intensity={real ? 0.25 : 0.45} color="#c9b8ff" />
      <directionalLight position={[95, 60, -170]} intensity={real ? 2.2 : 1.3} color="#ffe2c4" />
      <directionalLight position={[-60, -30, 80]} intensity={real ? 0.9 : 0.4} color={real ? "#7a5cff" : "#8fb8ff"} />
      {real && <VoidEnvironment intensity={1} />}
      {real && gfx.reflections && <HubMirror resolution={gfx.preset === "ultra" ? 1024 : 512} />}
      {real && gfx.godrays && <GodSun position={HOLE_POS} radius={14} />}
      {gfx.shadows && <ShadowRig />}
      <CosmicExpansion />
      <FallGuard />
      <VfxClock />
      <ArrivalSweep />
      <VoidSky />
      <Aurora />
      <ShootingStars />
      <Stardust />
      <GlyphMotes />
      <StepRipples />
      <StarWhale />
      {/* sâu vũ trụ dài 140 m, đốt sáng, uốn lượn quanh hư không */}
      <CosmicBeast path={BEAST_PATHS.paradox} look={BEAST_LOOKS.void} bodyLen={140} radius={3.6} speed={9} sun={PDX_BEAST_SUN} phase0={4.0} />
      <Constellation />
      <LensTracker />
      <primitive object={root} />
      <Exhibits />
      <VoidWonders />
      {STATIONS.map((p, i) => (
        <Label3D key={i} text={`${i + 1} · ${PARADOXES[i].title[lang]}`} position={[p.x, p.y + 3.3, p.z]} maxDist={34} />
      ))}
      <group position={[GUIDE.x, 0, GUIDE.z]}>
        <Avatar url={worldAsset(AVATAR_BY_ID["cute-cat"]?.file ?? "avatars/cute-cat.vrm")} pose="idle" npc instance="npc-zeno" />
        <Label3D text="Hồi âm Zeno · Người giữ nghịch lý" position={[0, 2.05, 0]} variant="name" />
      </group>
      <MagicCircle vertical radius={1.35} position={[PDX_EXIT.x, PDX_EXIT.y + 1.9, PDX_EXIT.z + 0.6]} color="#ffd27a" color2="#8be0ff" />
      <MagicCircle radius={1.15} intensity={1.1} color="#ffe9a8" color2="#9fe6ff" position={[PDX_EXIT.x, PDX_EXIT.y + 0.03, PDX_EXIT.z]} spin={0.5} />
      <Label3D text={lang === "vi" ? "Lối ra · về Sảnh Bất Khả" : "Exit · back to the Impossible Halls"} position={[PDX_EXIT.x, PDX_EXIT.y + 3.0, PDX_EXIT.z]} />
      <MagicCircle radius={0.6} intensity={0.8} color="#b9f0ff" color2="#ffd27a" position={[EYE.x, 0.03, EYE.z]} spin={-0.4} />
      <RemotePlayers />
      <Player avatarFile={AVATAR_BY_ID[avatar]?.file} blocked={pdxBlocked} findNearby={pdxNearby} ground={pdxGround} />
    </group>
  );
}

/** Các vật trưng bày động trên bệ */
function Exhibits() {
  const props = useGLTF(PROPS);
  const P = useMemo(() => {
    const base = toonize(props.scene);
    const take = (...names: string[]) => {
      const g = new THREE.Group();
      names.forEach((n) => {
        const o = base.getObjectByName(n);
        if (o) g.add(o.clone(true));
      });
      return g;
    };
    const mob = take("pd_mobius");
    mob.traverse((o) => {
      const m = (o as THREE.Mesh).material as THREE.Material | undefined;
      if (m) m.side = THREE.DoubleSide;
    });
    return {
      tortoise: take("px_tortoise"),
      helmet: take("px_helmet"),
      cake: take("px_cake", "px_cake_flame"),
      pole: take("px_pole"),
      boxA: take("px_boxA"),
      boxB: take("px_boxB"),
      eye: take("px_eye"),
      lamp: take("px_lamp"),
      bulb: take("px_bulb"),
      rocket: take("px_rocket"),
      clockE: take("px_clock"),
      clockR: take("px_clock"),
      handsE: [take("px_hand_h"), take("px_hand_m")],
      handsR: [take("px_hand_h"), take("px_hand_m")],
      dio: take("px_diorama", "px_roads"),
      bridge: take("px_bridge"),
      mobius: mob,
    };
  }, [props]);
  // Banach–Tarski: quả cầu chia 5 mảnh (theo hướng pháp tuyến mặt), mảnh tách ra rồi ráp thành HAI quả cầu
  const bt = useMemo(() => {
    const src = new THREE.IcosahedronGeometry(0.32, 3).toNonIndexed();
    const pos = src.getAttribute("position");
    const groups: number[][] = [[], [], [], [], []];
    const v = new THREE.Vector3();
    for (let f = 0; f < pos.count / 3; f++) {
      v.set(0, 0, 0);
      for (let k = 0; k < 3; k++) v.add(new THREE.Vector3().fromBufferAttribute(pos, f * 3 + k));
      v.normalize();
      // 5 mảnh lồng vào nhau kiểu "nhiễu": phân theo hàm sin của hướng — mảnh rời rạc, lốm đốm
      const g = Math.abs(Math.floor((Math.sin(v.x * 7.1) + Math.sin(v.y * 9.3) + Math.sin(v.z * 8.7) + 3) * 0.83)) % 5;
      groups[g].push(f);
    }
    const cols = ["#ff7a9a", "#ffd27a", "#7fe3ff", "#b58bff", "#7dff9a"];
    return groups.map((faces, i) => {
      const arr = new Float32Array(faces.length * 9);
      faces.forEach((f, j) => {
        for (let k = 0; k < 9; k++) arr[j * 9 + k] = pos.array[f * 9 + k];
      });
      const g = new THREE.BufferGeometry();
      g.setAttribute("position", new THREE.BufferAttribute(arr, 3));
      g.computeVertexNormals();
      return { geo: g, mat: new THREE.MeshToonMaterial({ color: cols[i], side: THREE.DoubleSide }) };
    });
  }, []);
  useEffect(() => () => bt.forEach((p) => (p.geo.dispose(), p.mat.dispose())), [bt]);
  // Đường bờ biển: bông tuyết Koch các mức 0..5
  const koch = useMemo(() => {
    return [0, 1, 2, 3, 4, 5].map((k) => {
      const seg = kochPoints(k);
      const pts: THREE.Vector3[] = [];
      for (let side = 0; side < 3; side++) {
        const a = (side * 2 * Math.PI) / 3 + Math.PI / 2;
        const b = a - (2 * Math.PI) / 3;
        const A = new THREE.Vector2(Math.cos(a), Math.sin(a));
        const B = new THREE.Vector2(Math.cos(b), Math.sin(b));
        const d = B.clone().sub(A);
        const n = new THREE.Vector2(d.y, -d.x);
        seg.forEach(([x, y], i) => {
          if (side > 0 && i === 0) return;
          const p = A.clone().addScaledVector(d, x).addScaledVector(n, y);
          pts.push(new THREE.Vector3(p.x * 0.55, p.y * 0.55, 0));
        });
      }
      const g = new THREE.BufferGeometry().setFromPoints(pts);
      return g;
    });
  }, []);
  const kochMat = useMemo(() => new THREE.LineBasicMaterial({ color: new THREE.Color("#7fd0ff").multiplyScalar(2), toneMapped: false }), []);
  useEffect(() => () => (koch.forEach((g) => g.dispose()), kochMat.dispose()), [koch, kochMat]);
  // Ngày sinh: vòng lịch 365 ô + 23 "người" rơi xuống ngày ngẫu nhiên
  const cal = useMemo(() => ({ geo: new THREE.BoxGeometry(0.018, 0.05, 0.03), mat: new THREE.MeshBasicMaterial({ toneMapped: false }) }), []);
  useEffect(() => () => (cal.geo.dispose(), cal.mat.dispose()), [cal]);
  const calRef = useRef<THREE.InstancedMesh>(null);
  const days = useRef<number[]>([]);
  const daysCls = useRef(-1);
  // Braess: 40 xe chạy theo tuyến
  const car = useMemo(() => ({ geo: new THREE.BoxGeometry(0.06, 0.035, 0.035), mat: new THREE.MeshToonMaterial({ color: "#ffffff" }) }), []);
  useEffect(() => () => (car.geo.dispose(), car.mat.dispose()), [car]);
  const carRef = useRef<THREE.InstancedMesh>(null);
  useEffect(() => {
    const im = carRef.current;
    if (!im) return;
    const pal = ["#ff6b6b", "#ffd27a", "#7fe3ff", "#7dff9a", "#b58bff", "#ffffff"].map((c) => new THREE.Color(c));
    for (let i = 0; i < 40; i++) im.setColorAt(i, pal[i % pal.length]);
    if (im.instanceColor) im.instanceColor.needsUpdate = true;
  }, [car]);

  const refs = useRef<Record<string, THREE.Object3D | null>>({});
  const set = (k: string) => (el: THREE.Object3D | null) => void (refs.current[k] = el);
  const tmp = useMemo(() => ({ m: new THREE.Matrix4(), q: new THREE.Quaternion(), p: new THREE.Vector3(), s: new THREE.Vector3(1, 1, 1), c: new THREE.Color(), e: new THREE.Euler() }), []);
  const clocks = useRef({ earth: 0, rocket: 0 });
  useFrame((st, dtRaw) => {
    const t = st.clock.elapsedTime;
    const dt = Math.min(dtRaw, 0.1);
    const r = refs.current;
    // 1. Achilles đuổi rùa theo bước Zeno: mỗi bước dài bằng 1/10 bước trước, thời gian cũng vậy; lặp lại sau ~6 s
    {
      const cyc = t % 6.5;
      const head = 0.55;
      // vị trí liên tục (Achilles 10 đv/s, rùa 1 đv/s) trên đoạn [−0.6, 0.6]
      const tt = Math.min(cyc, 1.15) * 0.55;
      const ach = -0.6 + tt * 1.75;
      const tor = -0.6 + head + tt * 0.175;
      if (r.helmet) r.helmet.position.set(Math.min(ach, tor + 0.02), PED_Y + 0.12 + Math.abs(Math.sin(t * 14)) * 0.03, 0);
      if (r.tortoise) r.tortoise.position.set(tor + 0.12, PED_Y, 0);
    }
    // 2. Ngày sinh: mỗi 6 s một lớp 23 người mới; ngày trùng sáng đỏ
    if (calRef.current) {
      const cls = Math.floor(t / 6);
      if (daysCls.current !== cls) {
        let seed = cls * 9301 + 49297;
        const rnd = () => ((seed = (seed * 233280 + 49297) % 233280) / 233280);
        days.current = Array.from({ length: 23 }, () => Math.floor(rnd() * 365));
        daysCls.current = cls;
      }
      const shown = Math.min(23, Math.floor(((t % 6) / 4) * 23));
      const counts = new Map<number, number>();
      days.current.slice(0, shown).forEach((d) => counts.set(d, (counts.get(d) ?? 0) + 1));
      for (let d = 0; d < 365; d++) {
        const a = (d / 365) * Math.PI * 2;
        const n = counts.get(d) ?? 0;
        tmp.p.set(Math.cos(a) * 0.85, PED_Y + 0.75 + (n ? 0.05 * n : 0), Math.sin(a) * 0.85);
        tmp.q.setFromAxisAngle(new THREE.Vector3(0, 1, 0), -a);
        tmp.s.set(1, n ? 2.2 + n : 1, 1);
        tmp.m.compose(tmp.p, tmp.q, tmp.s);
        calRef.current.setMatrixAt(d, tmp.m);
        calRef.current.setColorAt(d, tmp.c.set(n >= 2 ? "#ff3b5c" : n === 1 ? "#ffd27a" : d % 30 < 1 ? "#ffffff" : "#6f6aa8").multiplyScalar(n >= 2 ? 2.4 : 1));
      }
      calRef.current.instanceMatrix.needsUpdate = true;
      if (calRef.current.instanceColor) calRef.current.instanceColor.needsUpdate = true;
    }
    // 3. Simpson: cột A/B theo nhóm rồi gộp — cột "gộp" đổi bên thắng (xem bảng để rõ số liệu)
    for (let i = 0; i < 6; i++) {
      const o = r[`simp${i}`];
      if (!o) continue;
      const vals = [81 / 87, 234 / 270, 192 / 263, 55 / 80, 273 / 350, 289 / 350];
      const k = Math.min(1, ((t % 8) - (i < 4 ? 0 : 3)) / 1.2);
      o.scale.y = Math.max(0.001, vals[i] * Math.max(0, k));
      o.position.y = 0.7 * o.scale.y; // cột mọc từ mặt bệ
    }
    // 4. Banach–Tarski: 1 quả cầu → mảnh bay ra → ráp thành 2 quả cầu → hợp lại
    for (let i = 0; i < 5; i++) {
      const o = r[`bt${i}`];
      if (!o) continue;
      const cyc = (t % 9) / 9;
      const out = Math.sin(Math.min(1, cyc * 2) * Math.PI); // 0→1→0
      const two = cyc > 0.5 ? Math.min(1, (cyc - 0.5) * 4) * (cyc < 0.9 ? 1 : (1 - cyc) * 10) : 0;
      const ang = (i / 5) * Math.PI * 2 + t * 0.3;
      const side = i < 2 ? -1 : 1;
      o.position.set(Math.cos(ang) * 0.6 * out + side * 0.42 * two, PED_Y + 0.55 + Math.sin(ang) * 0.25 * out, Math.sin(ang) * 0.3 * out);
      o.rotation.set(t * 0.7 * out, t * (0.5 + i * 0.13), 0);
      // pha cuối: mỗi bên "đủ" một quả cầu (xoay mảnh để lấp kín — minh hoạ, không phải phép dời hình thật)
      o.scale.setScalar(1 + (side < 0 ? 0.25 : -0.12) * two);
    }
    // 5. Cột thợ cạo xoay đều
    if (r.pole) r.pole.rotation.y = t * 1.5;
    // 7. Newcomb: mắt tiên tri lơ lửng, nhìn người chơi
    if (r.eye) {
      r.eye.position.y = PED_Y + 1.25 + Math.sin(t * 1.4) * 0.06;
      const pl = useWorld.getState().player;
      const ew = r.eye.getWorldPosition(tmp.p);
      r.eye.rotation.y = Math.atan2(pl.x - ew.x, pl.z - ew.z) + Math.PI - (r.eye.parent?.rotation.y ?? 0);
    }
    // 8. Bờ biển: bông tuyết Koch tăng mức mỗi 1,6 s
    for (let k = 0; k < 6; k++) {
      const o = r[`koch${k}`];
      if (o) o.visible = Math.floor(t / 1.6) % 6 === k;
    }
    // 9. Braess: cầu tắt bật/tắt mỗi 8 s; xe chạy theo tuyến cân bằng
    const withBridge = Math.floor(t / 8) % 2 === 1;
    if (r.bridge) r.bridge.visible = withBridge;
    if (carRef.current) {
      const Sx = -0.75, Ex = 0.75, Xz = -0.42, Yz = 0.42; // game z = −y Blender
      const speed = withBridge ? 1 / braess(4000, true).time : 1 / braess(4000, false).time;
      for (let i = 0; i < 40; i++) {
        const u = (t * speed * 6 + i / 40) % 1;
        let x: number, z: number;
        const route = withBridge ? 2 : i % 2;
        if (route === 0) [x, z] = u < 0.5 ? [Sx + (0 - Sx) * u * 2, Xz * u * 2] : [Ex * (u - 0.5) * 2, Xz + (0 - Xz) * (u - 0.5) * 2];
        else if (route === 1) [x, z] = u < 0.5 ? [Sx + (0 - Sx) * u * 2, Yz * u * 2] : [Ex * (u - 0.5) * 2, Yz + (0 - Yz) * (u - 0.5) * 2];
        else [x, z] = u < 0.33 ? [Sx + (0 - Sx) * u * 3, Xz * u * 3] : u < 0.66 ? [0, Xz + (Yz - Xz) * (u - 0.33) * 3] : [Ex * (u - 0.66) * 3, Yz + (0 - Yz) * (u - 0.66) * 3];
        tmp.p.set(x, PED_Y + 0.1, z);
        tmp.m.compose(tmp.p, tmp.q.identity(), tmp.s.set(1, 1, 1));
        carRef.current.setMatrixAt(i, tmp.m);
      }
      carRef.current.instanceMatrix.needsUpdate = true;
    }
    // 10. Đèn Thomson: bật/tắt sau 1, 1/2, 1/4… giây — đến cuối phút thì…?
    if (r.bulb) {
      const cyc = t % 3;
      const k = cyc < 2 ? Math.floor(-Math.log2(1 - cyc / 2 + 1e-9)) : -1;
      r.bulb.visible = k >= 0 ? k % 2 === 0 : Math.sin(t * 40) > 0;
    }
    // 11. Anh em sinh đôi: tên lửa bay ra rồi quay về; đồng hồ tên lửa chạy chậm γ lần khi bay
    if (r.rocket) {
      const cyc = (t % 8) / 8;
      const fly = cyc < 0.85;
      const k = fly ? cyc / 0.85 : 0;
      const a = k * Math.PI * 2;
      r.rocket.position.set(Math.sin(a) * 0.7, PED_Y + 0.6 + Math.sin(a) * 0.35, Math.cos(a) * 0.7 - 0.7);
      r.rocket.rotation.set(0, a + Math.PI / 2, fly ? -1.2 : 0);
    }
    // đồng hồ: Trái Đất chạy đều; đồng hồ tên lửa chậm γ lần khi đang bay (v = 0,8c → γ = 5/3)
    const flying = (t % 8) / 8 < 0.85;
    clocks.current.earth += dt * 2;
    clocks.current.rocket += (dt * 2) / (flying ? gamma(0.8) : 1);
    const earthT = clocks.current.earth;
    const rocketT = clocks.current.rocket;
    const hand = (hs: THREE.Object3D[], tt: number) => {
      if (hs[0]) hs[0].rotation.z = -tt / 12;
      if (hs[1]) hs[1].rotation.z = -tt;
    };
    hand(P.handsE, earthT);
    hand(P.handsR, rocketT);
    // Möbius giữa sảnh + con kiến
    if (r.mobius) {
      r.mobius.rotation.y = t * 0.12;
      r.mobius.rotation.x = 0.55 + Math.sin(t * 0.2) * 0.08;
    }
    if (r.ant) {
      const u = (t * 0.5) % (4 * Math.PI);
      // P(u, w) theo toạ độ Blender (R = 1,9) → game (x, z, −y)
      const Pm = (uu: number, w: number) => new THREE.Vector3((1.9 + w * Math.cos(uu / 2)) * Math.cos(uu), w * Math.sin(uu / 2), -(1.9 + w * Math.cos(uu / 2)) * Math.sin(uu));
      const p0 = Pm(u, 0);
      const du = Pm(u + 0.01, 0).sub(p0);
      const dw = Pm(u, 0.01).sub(p0);
      const n = du.cross(dw).normalize();
      r.ant.position.copy(p0).addScaledVector(n, 0.08);
    }
  });
  const at = (i: number) => {
    const p = STATIONS[i];
    // quay mặt vật về tâm sảnh
    return { position: [p.x, p.y, p.z] as [number, number, number], rotation: [0, Math.atan2(-p.x, -p.z), 0] as [number, number, number] };
  };
  return (
    <group>
      {/* 1 Zeno */}
      <group {...at(0)}>
        <primitive object={P.tortoise} ref={set("tortoise")} />
        <primitive object={P.helmet} ref={set("helmet")} />
        <mesh position={[0, PED_Y + 0.005, 0]} rotation-x={-Math.PI / 2}>
          <planeGeometry args={[1.5, 0.12]} />
          <meshBasicMaterial color="#ffd27a" transparent opacity={0.35} />
        </mesh>
      </group>
      {/* 2 Ngày sinh */}
      <group {...at(1)}>
        <primitive object={P.cake} position={[0, PED_Y, 0]} />
        <instancedMesh ref={calRef} args={[cal.geo, cal.mat, 365]} frustumCulled={false} />
      </group>
      {/* 3 Simpson: 3 cặp cột (nhóm nhỏ, nhóm lớn, gộp) */}
      <group {...at(2)}>
        {[0, 1, 2, 3, 4, 5].map((i) => (
          <group key={i} position={[-0.55 + Math.floor(i / 2) * 0.55 + (i % 2) * 0.18, PED_Y, 0]}>
            <mesh ref={set(`simp${i}`)} position={[0, 0, 0]}>
              <boxGeometry args={[0.14, 1.4, 0.14]} />
              <meshToonMaterial color={i % 2 ? "#7fe3ff" : "#ff9ec0"} />
            </mesh>
          </group>
        ))}
      </group>
      {/* 4 Banach–Tarski */}
      <group {...at(3)}>
        {bt.map((p, i) => (
          <mesh key={i} ref={set(`bt${i}`)} geometry={p.geo} material={p.mat} />
        ))}
      </group>
      {/* 5 Russell */}
      <group {...at(4)}>
        <primitive object={P.pole} ref={set("pole")} position={[0, PED_Y, 0]} />
      </group>
      {/* 7 Newcomb */}
      <group {...at(5)}>
        <primitive object={P.boxA} position={[-0.35, PED_Y, 0]} />
        <primitive object={P.boxB} position={[0.35, PED_Y, 0]} />
        <primitive object={P.eye} ref={set("eye")} position={[0, PED_Y + 1.25, 0]} />
      </group>
      {/* 8 Đường bờ biển */}
      <group {...at(6)}>
        {koch.map((g, k) => (
          <lineLoop key={k} ref={set(`koch${k}`)} geometry={g} material={kochMat} position={[0, PED_Y + 0.85, 0]} />
        ))}
      </group>
      {/* 9 Braess */}
      <group {...at(7)}>
        <primitive object={P.dio} position={[0, PED_Y, 0]} />
        <primitive object={P.bridge} ref={set("bridge")} position={[0, PED_Y, 0]} />
        <instancedMesh ref={carRef} args={[car.geo, car.mat, 40]} frustumCulled={false} />
      </group>
      {/* 10 Grandi / Thomson */}
      <group {...at(8)}>
        <primitive object={P.lamp} position={[0, PED_Y, 0]} />
        <primitive object={P.bulb} ref={set("bulb")} position={[0, PED_Y, 0]} />
      </group>
      {/* 11 Anh em sinh đôi */}
      <group {...at(9)}>
        <primitive object={P.rocket} ref={set("rocket")} />
        <group position={[-0.4, PED_Y + 0.3, 0.45]}>
          <primitive object={P.clockE} />
          {P.handsE.map((h, i) => (
            <primitive key={i} object={h} />
          ))}
          <Label3D text="Trái Đất" position={[0, 0.36, 0]} maxDist={10} />
        </group>
        <group position={[0.4, PED_Y + 0.3, 0.45]}>
          <primitive object={P.clockR} />
          {P.handsR.map((h, i) => (
            <primitive key={i} object={h} />
          ))}
          <Label3D text="Tên lửa" position={[0, 0.36, 0]} maxDist={10} />
        </group>
      </group>
      <group ref={set("mobius")} position={[0, 3.4, 0]}>
        <primitive object={P.mobius} />
        <MobiusEnergy />
        {/* "con kiến" bò dọc đường giữa dải: sau MỘT vòng nó ở mặt bên kia, sau HAI vòng mới về chỗ cũ — dải chỉ có một mặt */}
        <mesh ref={set("ant")}>
          <sphereGeometry args={[0.07, 12, 8]} />
          <meshBasicMaterial color={new THREE.Color("#7fe3ff").multiplyScalar(2.2)} toneMapped={false} />
        </mesh>
      </group>
    </group>
  );
}

/** Độ cao mặt đất dưới chân; trên vực = rất sâu (đang bay / lượn thì rơi thật) */
function pdxGround(x: number, z: number, y?: number) {
  return voidGround(x, z, y ?? Infinity) ?? -200;
}

function pdxBlocked(x: number, z: number, y?: number) {
  // đang đi bộ: không tự bước khỏi mép; đang ở trên không (nhảy / lượn / cưỡi gió): bay đi đâu cũng được
  if (voidGround(x, z, y ?? Infinity) === null) return motion.grounded;
  if (cosmosBlocked(x, z)) return true;
  if (Math.hypot(x, z) < 2.15) return true;
  for (const p of STATIONS) if (Math.hypot(x - p.x, z - p.z) < 1.3) return true;
  return Math.hypot(x - GUIDE.x, z - GUIDE.z) < 0.4;
}

function pdxNearby(p: THREE.Vector3): Nearby | null {
  const lang = useWorld.getState().lang;
  if (Math.hypot(p.x - PDX_EXIT.x, p.z - PDX_EXIT.z) < 1.8) return { kind: "portal", id: "impossible", label: lang === "vi" ? "Về Sảnh Bất Khả" : "Back to the Impossible Halls" };
  if (Math.hypot(p.x - GUIDE.x, p.z - GUIDE.z) < 2.2) return { kind: "npc", id: "zeno", label: lang === "vi" ? "Nói chuyện với Hồi âm Zeno" : "Talk to the Echo of Zeno" };
  if (Math.hypot(p.x - EYE.x, p.z - EYE.z) < 1.4) return { kind: "paradox", id: "eye", label: lang === "vi" ? "Nhìn qua Mắt Penrose" : "Look through the Penrose Eye" };
  const cz = cosmosNearby(p);
  if (cz) return cz;
  for (let i = 0; i < STATIONS.length; i++) {
    const s = STATIONS[i];
    if (Math.hypot(p.x - s.x, p.z - s.z) < 3.2) return { kind: "paradox", id: String(i), label: `${lang === "vi" ? "Khám phá" : "Explore"}: ${PARADOXES[i].title[lang === "vi" ? "vi" : "en"]}` };
  }
  return null;
}

/** Rơi vào hư không → hồi về chỗ đứng an toàn gần nhất (kèm loé sáng) */
function FallGuard() {
  const safe = useRef(new THREE.Vector3(0, 0, 4));
  useFrame(() => {
    const w = useWorld.getState();
    const p = w.player;
    if (motion.grounded && voidGround(p.x, p.z, p.y) !== null) safe.current.copy(p);
    if (p.y < -38) {
      p.copy(safe.current);
      motion.vy = 0;
      motion.gliding = false;
      motion.plunging = false;
      motion.grounded = true;
      w.burst([p.x, p.y + 1, p.z], "#bfe8ff", 50);
      floatText(p.clone().setY(p.y + 2), w.lang === "vi" ? "Hư không đưa bạn trở lại" : "The void returns you", "info");
      sfx.chime(2);
    }
  });
  return null;
}
