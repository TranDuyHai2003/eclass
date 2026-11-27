"use client";
/**
 * Hang của Platon — Sảnh Bất Khả (góc đông bắc sân).
 * Hang đá Blender (`props/cave.glb`, GI nướng: lửa + nắng ở miệng hang). Ba vật được "khiêng" sau gờ tường thấp:
 * hình trụ (bóng tròn ↔ bóng chữ nhật tuỳ hướng), lập phương (nhìn theo đường chéo: bóng lục giác!) và siêu khối 4D.
 * Bóng trên vách KHÔNG dùng đèn: mỗi khung vẽ các vật thành bóng đen nhìn từ ngọn lửa vào một render target nhỏ,
 * vách chiếu lấy mẫu theo phép chiếu từ ngọn lửa (máy chiếu bóng) + lửa bập bùng + mép bóng mềm.
 * Chế độ "tù nhân": ngồi lên ghế đá → máy quay khoá nhìn vách → đoán vật từ bóng → quay đầu nhìn vật thật.
 */
import { useEffect, useMemo, useRef } from "react";
import { useFrame, useThree } from "@react-three/fiber";
import { useGLTF } from "@react-three/drei";
import * as THREE from "three";
import { create } from "zustand";
import { worldAsset, AVATAR_BY_ID } from "@/lib/world/avatars";
import { bakedMaterial } from "../fx/baked";
import { useWorld } from "../store";
import { Avatar } from "../player/Avatar";
import { Label3D } from "../ui/Labels";

const GLB = worldAsset("props/cave.glb");
useGLTF.preload(GLB);
/** Miệng hang (giữa, trên sàn); hang chạy về −z */
export const CAVE = { x: 14.2, z: -8 };
const FIRE = new THREE.Vector3(CAVE.x, 0.7, CAVE.z - 1.6);
/** Nguồn chiếu bóng = đỉnh ngọn lửa (cao hơn vật một chút → bóng rơi giữa vách) */
const SRC = new THREE.Vector3(CAVE.x, 1.42, CAVE.z - 1.6);
const SCREEN_Z = CAVE.z - 6.5;
const CARRY_Z = CAVE.z - 2.8;
export const BENCH = { x: CAVE.x, z: CAVE.z - 4.45 };
export const SAGE = { x: CAVE.x + 3.2, z: CAVE.z + 1.2 };
const CAVE_U = { uExposure: { value: 1.2 }, uFloor: { value: 0.28 }, uTint: { value: new THREE.Color(1, 0.96, 0.9) }, uScale: { value: 4.8 } };

/** Bước của trải nghiệm tù nhân */
export type CaveStep = "off" | "sit" | "q1" | "turn" | "q2" | "done";
export const useCave = create<{ step: CaveStep; answer: string | null }>(() => ({ step: "off", answer: null }));

function tesseractEdges() {
  const v4: number[][] = [];
  for (let i = 0; i < 16; i++) v4.push([i & 1 ? 1 : -1, i & 2 ? 1 : -1, i & 4 ? 1 : -1, i & 8 ? 1 : -1]);
  const e: [number, number][] = [];
  for (let i = 0; i < 16; i++) for (let b = 0; b < 4; b++) if (!(i & (1 << b))) e.push([i, i | (1 << b)]);
  return { v4, e };
}

/** Ba vật được khiêng (dùng cho cả cảnh chính lẫn cảnh bóng): đặt vị trí theo thời gian + bước tù nhân */
function useCarried() {
  return useMemo(() => {
    const cyl = new THREE.CylinderGeometry(0.17, 0.17, 0.5, 24);
    const box = new THREE.BoxGeometry(0.34, 0.34, 0.34);
    const tube = new THREE.CylinderGeometry(1, 1, 1, 6, 1);
    const node = new THREE.SphereGeometry(1, 8, 6);
    return { cyl, box, tube, node, T: tesseractEdges() };
  }, []);
}

function placeCarried(t: number, step: CaveStep, groups: (THREE.Object3D | null)[], tess: THREE.InstancedMesh | null, tessNodes: THREE.InstancedMesh | null, T: ReturnType<typeof tesseractEdges>, tmp: { m: THREE.Matrix4; q: THREE.Quaternion; s: THREE.Vector3; a: THREE.Vector3; b: THREE.Vector3; up: THREE.Vector3 }) {
  const [cylG, boxG, tesG] = groups;
  // Chế độ tù nhân: trụ dừng giữa (nhìn dọc trục → bóng tròn); khi "quay đầu" trụ xoay ngang → bóng chữ nhật
  const lane = (phase: number) => CAVE.x - 3 + 6 * (0.5 + 0.5 * Math.sin(t * 0.32 + phase));
  if (cylG) {
    const prisoner = step === "sit" || step === "q1" || step === "turn";
    cylG.position.set(prisoner ? CAVE.x : lane(0), 1.5 + Math.sin(t * 2.2) * 0.03, CARRY_Z);
    const target = step === "turn" ? 0 : prisoner ? Math.PI / 2 : t * 0.6;
    cylG.rotation.set(step === "turn" ? THREE.MathUtils.lerp(cylG.rotation.x, 0, 0.04) : target, 0, 0);
    if (prisoner && step !== "turn") cylG.rotation.x = Math.PI / 2;
    cylG.visible = step !== "q2";
  }
  if (boxG) {
    boxG.position.set(lane(2.1), 1.52, CARRY_Z - 0.15);
    // quay quanh đường chéo: có lúc bóng là lục giác
    boxG.rotation.set(Math.atan(Math.SQRT1_2), t * 0.5, Math.PI / 4);
    boxG.visible = step === "off" || step === "done";
  }
  if (tesG && tess && tessNodes) {
    const show = step === "off" || step === "done" || step === "q2";
    tesG.visible = show;
    tesG.position.set(step === "q2" ? CAVE.x : lane(4.2), 1.5, CARRY_Z + 0.1);
    const a1 = t * 0.45;
    const a2 = t * 0.27;
    const P: THREE.Vector3[] = [];
    for (const v of T.v4) {
      const x = v[0] * Math.cos(a1) - v[3] * Math.sin(a1);
      const w = v[0] * Math.sin(a1) + v[3] * Math.cos(a1);
      const y = v[1] * Math.cos(a2) - v[2] * Math.sin(a2);
      const z = v[1] * Math.sin(a2) + v[2] * Math.cos(a2);
      const f = 0.24 / (2.6 - w);
      P.push(new THREE.Vector3(x * f, y * f, z * f));
    }
    T.e.forEach(([i, j], n) => {
      tmp.a.copy(P[i]);
      tmp.b.copy(P[j]);
      const len = Math.max(0.001, tmp.a.distanceTo(tmp.b));
      tmp.q.setFromUnitVectors(tmp.up, tmp.b.clone().sub(tmp.a).normalize());
      tmp.m.compose(tmp.a.clone().add(tmp.b).multiplyScalar(0.5), tmp.q, tmp.s.set(0.014, len, 0.014));
      tess.setMatrixAt(n, tmp.m);
    });
    P.forEach((p, i) => {
      tmp.m.compose(p, tmp.q.identity(), tmp.s.set(0.026, 0.026, 0.026));
      tessNodes.setMatrixAt(i, tmp.m);
    });
    tess.instanceMatrix.needsUpdate = true;
    tessNodes.instanceMatrix.needsUpdate = true;
  }
}

function Carried({ mats, refs, shadowRefs }: { mats: { a: THREE.Material; b: THREE.Material; c: THREE.Material }; refs: React.MutableRefObject<{ g: (THREE.Object3D | null)[]; tess: THREE.InstancedMesh | null; nodes: THREE.InstancedMesh | null }>; shadowRefs?: boolean }) {
  const geo = useCarried();
  void shadowRefs;
  return (
    <group>
      <group ref={(el) => void (refs.current.g[0] = el)}>
        <mesh geometry={geo.cyl} material={mats.a} />
      </group>
      <group ref={(el) => void (refs.current.g[1] = el)}>
        <mesh geometry={geo.box} material={mats.b} />
      </group>
      <group ref={(el) => void (refs.current.g[2] = el)}>
        <instancedMesh ref={(el) => void (refs.current.tess = el)} args={[geo.tube, mats.c, 32]} frustumCulled={false} />
        <instancedMesh ref={(el) => void (refs.current.nodes = el)} args={[geo.node, mats.c, 16]} frustumCulled={false} />
      </group>
    </group>
  );
}

export function PlatoCave() {
  const gltf = useGLTF(GLB);
  const { gl } = useThree();
  // Vật liệu hang (GI nướng), riêng vách chiếu dùng shader máy chiếu bóng
  const shadow = useMemo(() => {
    const rt = new THREE.WebGLRenderTarget(512, 384);
    const cam = new THREE.PerspectiveCamera(78, 512 / 384, 0.3, 12);
    cam.position.copy(SRC);
    cam.lookAt(CAVE.x, 1.4, SCREEN_Z);
    cam.updateMatrixWorld();
    const scene = new THREE.Scene();
    scene.background = new THREE.Color("#ffffff");
    const black = new THREE.MeshBasicMaterial({ color: "#000000" });
    return { rt, cam, scene, black, vp: new THREE.Matrix4() };
  }, []);
  const screenMat = useMemo(
    () =>
      new THREE.ShaderMaterial({
        uniforms: { uShadow: { value: shadow.rt.texture }, uVP: { value: shadow.vp }, uT: { value: 0 }, uFire: { value: SRC.clone() } },
        vertexShader: "varying vec3 vW; void main(){ vec4 w = modelMatrix * vec4(position, 1.0); vW = w.xyz; gl_Position = projectionMatrix * viewMatrix * w; }",
        fragmentShader: `uniform sampler2D uShadow; uniform mat4 uVP; uniform float uT; uniform vec3 uFire; varying vec3 vW;
          void main(){
            vec4 c = uVP * vec4(vW, 1.0);
            vec2 uv = c.xy / c.w * 0.5 + 0.5;
            float sh = 0.0;
            vec2 px = vec2(1.0 / 512.0, 1.0 / 384.0) * 2.0;
            sh += 1.0 - texture2D(uShadow, uv).r;
            sh += 1.0 - texture2D(uShadow, uv + vec2(px.x, 0.0)).r;
            sh += 1.0 - texture2D(uShadow, uv - vec2(px.x, 0.0)).r;
            sh += 1.0 - texture2D(uShadow, uv + vec2(0.0, px.y)).r;
            sh += 1.0 - texture2D(uShadow, uv - vec2(0.0, px.y)).r;
            sh /= 5.0;
            if (uv.x < 0.0 || uv.x > 1.0 || uv.y < 0.0 || uv.y > 1.0) sh = 0.0;
            float flick = 0.86 + 0.08 * sin(uT * 11.0) + 0.06 * sin(uT * 23.7 + 1.3);
            float d = distance(vW, uFire);
            float lit = flick * (1.3 / (1.0 + d * d * 0.03));
            vec3 base = vec3(0.86, 0.74, 0.56);
            vec3 col = base * lit * vec3(1.15, 0.9, 0.65) * (1.0 - 0.82 * sh) + base * 0.08;
            gl_FragColor = vec4(col, 1.0);
          }`,
      }),
    [shadow],
  );
  const { parts, mats } = useMemo(() => {
    const cache = new Map<string, THREE.Material>();
    const list: { geo: THREE.BufferGeometry; mat: THREE.Material }[] = [];
    gltf.scene.traverse((o) => {
      const m = o as THREE.Mesh;
      if (!m.isMesh) return;
      const src = m.material as THREE.MeshStandardMaterial;
      if (m.name.startsWith("cave_screen")) {
        list.push({ geo: m.geometry, mat: screenMat });
        return;
      }
      let mat = cache.get(src.name);
      if (!mat) {
        mat = src.name.startsWith("glow_") ? new THREE.MeshBasicMaterial({ color: src.color.clone().multiplyScalar(3), toneMapped: false }) : bakedMaterial(src, CAVE_U);
        cache.set(src.name, mat);
      }
      list.push({ geo: m.geometry, mat });
    });
    return { parts: list, mats: [...cache.values()] };
  }, [gltf, screenMat]);
  const objMats = useMemo(
    () => ({
      a: new THREE.MeshToonMaterial({ color: "#c9a25a" }),
      b: new THREE.MeshToonMaterial({ color: "#7fb6ff" }),
      c: new THREE.MeshBasicMaterial({ color: new THREE.Color("#c8a6ff").multiplyScalar(2), toneMapped: false }),
    }),
    [],
  );
  useEffect(() => () => [...mats, screenMat, shadow.rt, shadow.black, objMats.a, objMats.b, objMats.c].forEach((x) => x.dispose()), [mats, screenMat, shadow, objMats]);
  const main = useRef<{ g: (THREE.Object3D | null)[]; tess: THREE.InstancedMesh | null; nodes: THREE.InstancedMesh | null }>({ g: [], tess: null, nodes: null });
  // Cảnh bóng: bản sao hình học các vật, tô đen
  const sh = useMemo(() => {
    const geo = { cyl: new THREE.CylinderGeometry(0.17, 0.17, 0.5, 24), box: new THREE.BoxGeometry(0.34, 0.34, 0.34), tube: new THREE.CylinderGeometry(1, 1, 1, 6, 1), node: new THREE.SphereGeometry(1, 8, 6) };
    const g = [new THREE.Group(), new THREE.Group(), new THREE.Group()];
    g[0].add(new THREE.Mesh(geo.cyl, shadow.black));
    g[1].add(new THREE.Mesh(geo.box, shadow.black));
    const tess = new THREE.InstancedMesh(geo.tube, shadow.black, 32);
    const nodes = new THREE.InstancedMesh(geo.node, shadow.black, 16);
    g[2].add(tess, nodes);
    g.forEach((x) => shadow.scene.add(x));
    // gờ tường thấp cũng đổ bóng (đường chân trời của bóng)
    const wall = new THREE.Mesh(new THREE.BoxGeometry(7.2, 0.9, 0.45), shadow.black);
    wall.position.set(CAVE.x, 0.45, CAVE.z - 3.6);
    shadow.scene.add(wall);
    return { g, tess, nodes, geo, wall };
  }, [shadow]);
  useEffect(() => () => [sh.geo.cyl, sh.geo.box, sh.geo.tube, sh.geo.node, sh.wall.geometry].forEach((x) => x.dispose()), [sh]);
  const T = useMemo(() => tesseractEdges(), []);
  useEffect(() => {
    if (process.env.NODE_ENV !== "production") (window as unknown as { __cave: unknown }).__cave = { shadow, sh, gl };
  }, [shadow, sh, gl]);
  const tmp = useMemo(() => ({ m: new THREE.Matrix4(), q: new THREE.Quaternion(), s: new THREE.Vector3(), a: new THREE.Vector3(), b: new THREE.Vector3(), up: new THREE.Vector3(0, 1, 0) }), []);
  useFrame(() => {
    const t = performance.now() / 1000;
    const step = useCave.getState().step;
    placeCarried(t, step, main.current.g, main.current.tess, main.current.nodes, T, tmp);
    placeCarried(t, step, sh.g, sh.tess, sh.nodes, T, tmp);
    // copy xoay của trụ (lerp ở bản chính) sang bản bóng
    if (main.current.g[0]) sh.g[0].rotation.copy(main.current.g[0].rotation);
    screenMat.uniforms.uT.value = t;
    const p = useWorld.getState().player;
    if (Math.hypot(p.x - CAVE.x, p.z - (CAVE.z - 4)) < 18) {
      shadow.vp.multiplyMatrices(shadow.cam.projectionMatrix, shadow.cam.matrixWorldInverse);
      const prev = gl.getRenderTarget();
      gl.setRenderTarget(shadow.rt);
      gl.render(shadow.scene, shadow.cam);
      gl.setRenderTarget(prev);
    }
  });
  return (
    <group>
      <group position={[CAVE.x, 0.01, CAVE.z]}>
        {parts.map((pt, i) => (
          <mesh key={i} geometry={pt.geo} material={pt.mat} />
        ))}
      </group>
      <Carried mats={objMats} refs={main} />
      {/* Ngọn lửa: lõi sáng + quầng */}
      <mesh position={FIRE.toArray()}>
        <coneGeometry args={[0.22, 0.6, 10]} />
        <meshBasicMaterial color={new THREE.Color("#ffb060").multiplyScalar(3)} toneMapped={false} transparent opacity={0.85} />
      </mesh>
      {/* "Hồi âm của Hang" ở miệng hang */}
      <group position={[SAGE.x, 0, SAGE.z]} rotation-y={-0.6}>
        <Avatar url={worldAsset(AVATAR_BY_ID["sample-c"]?.file ?? "avatars/sample-c.vrm")} pose="idle" npc />
        <Label3D text="Hồi âm của Hang · Echo of the Cave" position={[0, 2.05, 0]} variant="name" />
      </group>
      <Label3D text="Hang của Platon" position={[CAVE.x, 5.4, CAVE.z]} />
    </group>
  );
}

/** Va chạm: vỏ hang (elip), gờ tường thấp, bệ lửa, ghế */
export function caveBlocked(x: number, z: number) {
  const dx = x - CAVE.x;
  const dz = CAVE.z - z; // sâu vào hang (dương)
  if (dz < -0.4) {
    return Math.hypot(x - SAGE.x, z - SAGE.z) < 0.45;
  }
  if (dz > 9.6) return true;
  const e = (dx / 4.2) ** 2 + (dz / 9.4) ** 2;
  if (e > 1 && dz > 0.2) return true;
  if (Math.abs(dx) > 3.9 && dz <= 0.2 && dz > -0.4) return true; // vành miệng hang
  if (Math.abs(dz - 3.6) < 0.4 && Math.abs(dx) < 3.6) return true; // gờ tường
  if (Math.hypot(dx, dz - 1.6) < 0.75) return true; // bệ lửa
  if (dz > 6.2) return true; // vách chiếu
  return false;
}
