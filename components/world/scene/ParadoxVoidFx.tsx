"use client";
/**
 * Hư Không Nghịch Lý — bầu trời và các kỳ quan bất khả quanh quần đảo:
 *  - VoidSky: shader tinh vân nhiều lớp (fbm uốn miền), dải ngân hà, thiên hà xoắn, hành tinh có vành, đường quỹ đạo vàng, sao lấp lánh
 *  - Stardust: bụi sao trôi lên chậm quanh đảo
 *  - Tam giác Penrose THẬT (3 dầm trong không gian) — chỉ khép kín khi nhìn từ "Mắt Penrose" trên đảo tâm (penroseEye())
 *  - Chai Klein, kèn Gabriel, bọt biển Menger, cầu thang đi lên mãi mãi (`props/paradox_wonders.glb`, Blender)
 *  - Dùng lại vista của Bốt Siêu khối: hố đen, bão Lorenz, siêu khối 4D trên cao, đĩa Poincaré làm "đáy vực" vô tận
 */
import { useEffect, useMemo, useRef } from "react";
import { useFrame, useThree } from "@react-three/fiber";
import { useGLTF } from "@react-three/drei";
import * as THREE from "three";
import { worldAsset } from "@/lib/world/avatars";
import { toonize } from "../fx/glbToon";
import { useWorld } from "../store";
import { useGfx } from "../gfx";
import { Label3D } from "../ui/Labels";
import { EyeBurst, triggerEyeBurst } from "./ParadoxVfx";
import { BlackHoleVista, LorenzVista, PoincareVista, TesseractVista, VistaClock } from "./TessVistas";

const WONDERS = worldAsset("props/paradox_wonders.glb");
useGLTF.preload(WONDERS);

// ── Mắt Penrose: đứng ở đây, máy quay đặt đúng vào đường chéo (1,1,1) của tam giác → ba dầm khép kín
export const EYE = { x: -6.0, z: -1.95, camYaw: 1.256, camPitch: -0.22, camDist: 3.4, playerYaw: -1.886 };
const TRI_DIST = 34;
const TRI_UP = 0.2;
const TRI_ROLL = 0.35;
/** Vị trí máy quay khi đứng ở Mắt (khớp phép tính máy quay trong Hub.tsx: mục tiêu = người chơi + 1,3 m) */
function eyeCamera() {
  const cp = Math.cos(EYE.camPitch);
  return new THREE.Vector3(Math.sin(EYE.camYaw) * cp, Math.sin(EYE.camPitch), Math.cos(EYE.camYaw) * cp).multiplyScalar(EYE.camDist).add(new THREE.Vector3(EYE.x, 1.3, EYE.z));
}
export function penroseEye() {
  const s = useWorld.getState();
  s.player.set(EYE.x, 0, EYE.z);
  useWorld.setState({ playerYaw: EYE.playerYaw, camYaw: EYE.camYaw, camPitch: EYE.camPitch, camDist: EYE.camDist });
  // máy quay cần ~0,6 s để trượt vào đúng điểm nhìn → lúc đó mới bừng sáng
  setTimeout(triggerEyeBurst, 650);
}

export function nebulaSky() {
  return new THREE.ShaderMaterial({
    uniforms: { uT: { value: 0 } },
    vertexShader: "varying vec3 vD; void main(){ vD = position; gl_Position = projectionMatrix * modelViewMatrix * vec4(position,1.0); }",
    fragmentShader: `uniform float uT; varying vec3 vD;
      float h3(vec3 p){ return fract(sin(dot(p, vec3(127.1, 311.7, 74.7))) * 43758.5453); }
      float n3(vec3 p){ vec3 i = floor(p); vec3 f = fract(p); f = f*f*(3.0-2.0*f);
        return mix(mix(mix(h3(i), h3(i+vec3(1,0,0)), f.x), mix(h3(i+vec3(0,1,0)), h3(i+vec3(1,1,0)), f.x), f.y),
                   mix(mix(h3(i+vec3(0,0,1)), h3(i+vec3(1,0,1)), f.x), mix(h3(i+vec3(0,1,1)), h3(i+vec3(1,1,1)), f.x), f.y), f.z); }
      float fbm(vec3 p){ float a = 0.5, s = 0.0; for (int i = 0; i < 5; i++){ s += a * n3(p); p = p * 2.03 + vec3(1.7, 9.2, 3.1); a *= 0.5; } return s; }
      // khung toạ độ tiếp tuyến quanh hướng g → toạ độ phẳng (u, v) của điểm trên bầu trời
      vec2 tang(vec3 d, vec3 g){ vec3 a = normalize(cross(g, vec3(0.0, 1.0, 0.0001))); vec3 b = cross(a, g); return vec2(dot(d, a), dot(d, b)) / max(dot(d, g), 0.001); }
      void main(){
        vec3 d = normalize(vD);
        float y = d.y;
        // nền: chàm sâu ở chân trời, đen tím trên đỉnh, ánh hồng tím từ vực bên dưới
        vec3 c = mix(vec3(0.035, 0.03, 0.09), vec3(0.008, 0.006, 0.02), smoothstep(0.0, 0.9, y));
        c += vec3(0.16, 0.05, 0.22) * smoothstep(0.1, -0.7, y);
        // tinh vân: fbm uốn miền hai lớp
        vec3 p = d * 2.4 + vec3(0.0, 0.0, uT * 0.003);
        vec3 w = vec3(fbm(p + vec3(3.1)), fbm(p + vec3(7.7)), fbm(p + vec3(1.3)));
        float n = fbm(p + 1.8 * w);
        float n2 = fbm(d * 6.0 + 2.5 * w - vec3(uT * 0.002));
        float band = exp(-pow(dot(d, normalize(vec3(0.35, 1.0, -0.2))) * 2.6, 2.0));
        vec3 vio = vec3(0.42, 0.14, 0.72), teal = vec3(0.04, 0.5, 0.62), rose = vec3(0.95, 0.25, 0.55), gold = vec3(1.0, 0.72, 0.32);
        vec3 neb = mix(vio, teal, smoothstep(0.35, 0.75, w.x));
        neb = mix(neb, rose, smoothstep(0.5, 0.8, w.y) * 0.75);
        neb = mix(neb, gold, smoothstep(0.62, 0.85, n2) * 0.45);
        float dens = smoothstep(0.42, 0.95, n * (0.7 + band * 0.8));
        c += neb * dens * (0.35 + band * 0.9);
        // vệt bụi tối cắt qua dải ngân hà
        c *= 1.0 - smoothstep(0.55, 0.8, n2) * band * 0.55;
        // thiên hà xoắn ốc nghiêng
        vec3 gd = normalize(vec3(-0.55, 0.42, -0.72));
        if (dot(d, gd) > 0.8) {
          vec2 q = tang(d, gd) * 6.5; q.y /= 0.45;
          float r = length(q), th = atan(q.y, q.x);
          float arms = pow(0.5 + 0.5 * cos(2.0 * th - log(r + 0.05) * 5.0 + uT * 0.02), 3.0);
          float gal = exp(-r * 1.6) * (0.35 + arms * 1.3) + exp(-r * 9.0) * 2.2;
          c += mix(vec3(0.55, 0.65, 1.0), vec3(1.0, 0.85, 0.65), exp(-r * 3.0)) * gal * 0.9;
        }
        // hành tinh khí khổng lồ có vành, xa
        vec3 pd = normalize(vec3(0.75, 0.16, 0.62));
        vec2 pq = tang(d, pd) * 15.0;
        float pr = length(pq);
        if (dot(d, pd) > 0.97) {
          float ring = smoothstep(0.06, 0.0, abs(length(vec2(pq.x, pq.y / 0.28)) - 1.9)) * (0.6 + 0.4 * sin(length(vec2(pq.x, pq.y / 0.28)) * 60.0));
          float front = step(0.0, -pq.y) + step(1.0, pr);
          if (pr < 1.0) {
            float lit = clamp(0.25 + 0.75 * dot(normalize(vec3(pq, sqrt(1.0 - pr * pr))), normalize(vec3(-0.6, 0.5, 0.6))), 0.0, 1.0);
            vec3 bands = mix(vec3(0.55, 0.42, 0.75), vec3(0.95, 0.75, 0.6), 0.5 + 0.5 * sin(pq.y * 14.0 + n * 3.0));
            c = bands * (0.08 + lit * 0.7);
          }
          c += vec3(1.0, 0.9, 0.75) * ring * 0.55 * front;
          c += vec3(0.6, 0.5, 1.0) * smoothstep(1.25, 1.0, pr) * step(1.0, pr) * 0.25;
        }
        // đường quỹ đạo vàng mảnh vắt ngang trời (đường tròn lớn)
        float orb = 0.0;
        orb += smoothstep(0.0025, 0.0, abs(dot(d, normalize(vec3(0.2, 1.0, 0.35))))) * (0.5 + 0.5 * sin(atan(d.z, d.x) * 40.0 - uT * 0.4));
        orb += smoothstep(0.002, 0.0, abs(dot(d, normalize(vec3(-0.8, 0.6, 0.1))))) * 0.6;
        c += vec3(1.0, 0.8, 0.45) * orb * 0.35 * smoothstep(-0.2, 0.2, y);
        // sao hai cỡ, có màu, lấp lánh
        for (int k = 0; k < 2; k++) {
          float sc = k == 0 ? 260.0 : 90.0;
          vec3 qq = d * sc; vec3 cell = floor(qq); vec3 f = fract(qq) - 0.5;
          float r = h3(cell + float(k) * 17.0);
          float thr = k == 0 ? 0.972 - band * 0.02 : 0.993;
          float st = step(thr, r) * smoothstep(k == 0 ? 0.3 : 0.22, 0.0, length(f)) * (0.55 + 0.45 * sin(uT * (1.0 + r * 3.0) + r * 50.0));
          vec3 sc3 = mix(vec3(0.75, 0.85, 1.0), vec3(1.0, 0.85, 0.7), h3(cell + 3.0));
          c += sc3 * st * (k == 0 ? 1.1 + band : 2.6);
        }
        gl_FragColor = vec4(c, 1.0);
      }`,
    side: THREE.BackSide,
    depthWrite: false,
    toneMapped: false,
    fog: false,
  });
}

export function VoidSky() {
  const mat = useMemo(() => nebulaSky(), []);
  useEffect(() => () => mat.dispose(), [mat]);
  const g = useRef<THREE.Mesh>(null);
  const { camera } = useThree();
  useFrame(() => {
    mat.uniforms.uT.value = performance.now() / 1000;
    // bầu trời đi theo máy quay (vô cực)
    g.current?.position.copy(camera.position);
  });
  return (
    <mesh ref={g} material={mat} renderOrder={-1} frustumCulled={false}>
      <sphereGeometry args={[480, 64, 32]} />
    </mesh>
  );
}

/** Bụi sao trôi chậm quanh quần đảo */
export function Stardust() {
  const vfx = useGfx((s) => s.vfx);
  const { geo, mat } = useMemo(() => {
    const n = Math.round(2200 * [0.35, 0.65, 1][vfx]);
    const pos = new Float32Array(n * 3);
    const rnd = new Float32Array(n);
    let seed = 11;
    const r = () => ((seed = (seed * 16807) % 2147483647) / 2147483647);
    for (let i = 0; i < n; i++) {
      const a = r() * Math.PI * 2;
      const rr = 6 + Math.sqrt(r()) * 70;
      pos.set([Math.cos(a) * rr, -18 + r() * 50, Math.sin(a) * rr], i * 3);
      rnd[i] = r();
    }
    const geo = new THREE.BufferGeometry();
    geo.setAttribute("position", new THREE.BufferAttribute(pos, 3));
    geo.setAttribute("aR", new THREE.BufferAttribute(rnd, 1));
    const mat = new THREE.ShaderMaterial({
      uniforms: { uT: { value: 0 } },
      vertexShader: `uniform float uT; attribute float aR; varying float vA; varying float vR;
        void main(){
          vec3 p = position; p.y = mod(p.y + 18.0 + uT * (0.15 + aR * 0.35), 50.0) - 18.0;
          p.x += sin(uT * 0.2 + aR * 30.0) * 0.6;
          vec4 mv = modelViewMatrix * vec4(p, 1.0);
          gl_Position = projectionMatrix * mv;
          gl_PointSize = (1.5 + aR * 3.5) * 60.0 / -mv.z;
          vA = (0.4 + 0.6 * sin(uT * (1.5 + aR * 3.0) + aR * 40.0)) * smoothstep(-18.0, -12.0, p.y) * smoothstep(32.0, 24.0, p.y); vR = aR;
        }`,
      fragmentShader: `varying float vA; varying float vR;
        void main(){ vec2 q = gl_PointCoord - 0.5; float d = length(q); if (d > 0.5) discard;
          vec3 c = mix(vec3(0.6, 0.85, 1.0), vec3(1.0, 0.8, 0.95), vR);
          gl_FragColor = vec4(c * 2.0, smoothstep(0.5, 0.0, d) * vA); }`,
      transparent: true,
      depthWrite: false,
      blending: THREE.AdditiveBlending,
      toneMapped: false,
    });
    return { geo, mat };
  }, [vfx]);
  useEffect(() => () => [geo, mat].forEach((o) => o.dispose()), [geo, mat]);
  useFrame(() => (mat.uniforms.uT.value = performance.now() / 1000));
  return <points geometry={geo} material={mat} frustumCulled={false} />;
}

/** Lưới đường tham số phát sáng của chai Klein (cùng công thức với vp_klein trong Blender, đã đổi trục Blender → game) */
function kleinLines() {
  const S = 0.55;
  const K = (u: number, v: number) => {
    const cu = Math.cos(u), su = Math.sin(u), cv = Math.cos(v), sv = Math.sin(v);
    const x = (-2 / 15) * cu * (3 * cv - 30 * su + 90 * cu ** 4 * su - 60 * cu ** 6 * su + 5 * cu * cv * su);
    const y = (-1 / 15) * su * (3 * cv - 3 * cu ** 2 * cv - 48 * cu ** 4 * cv + 48 * cu ** 6 * cv - 60 * su + 5 * cu * cv * su - 5 * cu ** 3 * cv * su - 80 * cu ** 5 * cv * su + 80 * cu ** 7 * cv * su);
    const z = (2 / 15) * (3 + 5 * cu * su) * sv;
    // Blender (x, z, −y)·S → game (X, Z_b, −Y_b) = (x, −y, −z)·S
    return new THREE.Vector3(x, -y, -z).multiplyScalar(S);
  };
  const pts: THREE.Vector3[] = [];
  const all: THREE.Vector3[] = [];
  const NU = 120, NV = 36;
  for (let i = 0; i <= NU; i++) for (let j = 0; j < NV; j++) all.push(K((Math.PI * i) / NU, (2 * Math.PI * j) / NV));
  const box = new THREE.Box3().setFromPoints(all);
  const c = box.getCenter(new THREE.Vector3());
  // 14 vòng v (quanh thân) + 12 đường u (dọc chai)
  for (let a = 0; a < 14; a++) {
    const u = (Math.PI * (a + 0.5)) / 14;
    for (let j = 0; j < 48; j++) pts.push(K(u, (2 * Math.PI * j) / 48).sub(c), K(u, (2 * Math.PI * (j + 1)) / 48).sub(c));
  }
  for (let b = 0; b < 12; b++) {
    const v = (2 * Math.PI * b) / 12;
    for (let i = 0; i < 160; i++) pts.push(K((Math.PI * i) / 160, v).sub(c), K((Math.PI * (i + 1)) / 160, v).sub(c));
  }
  return new THREE.BufferGeometry().setFromPoints(pts);
}

/** Các kỳ quan bất khả + vista mượn từ Bốt */
export function VoidWonders() {
  const lang = useWorld((s) => (s.lang === "vi" ? "vi" : "en"));
  const t = (vi: string, en: string) => (lang === "vi" ? vi : en);
  const gltf = useGLTF(WONDERS);
  const W = useMemo(() => {
    const base = toonize(gltf.scene);
    const take = (n: string) => {
      const o = base.getObjectByName(n);
      return o ? o.clone(true) : new THREE.Group();
    };
    const klein = take("vp_klein");
    // thuỷ tinh: nhìn xuyên thấy chỗ cổ chai đâm xuyên qua thân (trong R³ chai Klein buộc phải tự cắt)
    klein.traverse((o) => {
      const m = (o as THREE.Mesh).material as THREE.Material | undefined;
      if (m) Object.assign(m, { side: THREE.DoubleSide, transparent: true, opacity: 0.42, depthWrite: false });
    });
    // bậc thang: lấy hình học + vật liệu để nhân bản
    const geoOf = (n: string) => {
      const o = base.getObjectByName(n) as THREE.Mesh | undefined;
      return o?.isMesh ? { geo: o.geometry, mat: o.material as THREE.Material } : null;
    };
    return { tribar: take("vp_tribar"), klein, horn: take("vp_horn"), menger: take("vp_menger"), step: geoOf("vp_step"), edge: geoOf("vp_step_edge") };
  }, [gltf]);

  // Tam giác Penrose: gốc (khối P0) nằm trên tia nhìn từ Mắt, đường chéo (1,1,1) [Blender] = (1,1,−1) [game] trùng tia đó
  const tri = useMemo(() => {
    const C = eyeCamera();
    const look = new THREE.Vector3(EYE.x, 1.3, EYE.z).sub(C).normalize();
    const side = new THREE.Vector3().crossVectors(look, new THREE.Vector3(0, 1, 0)).normalize();
    const u = look.clone().applyAxisAngle(side, TRI_UP).normalize();
    const q = new THREE.Quaternion().setFromUnitVectors(new THREE.Vector3(1, 1, -1).normalize(), u);
    q.premultiply(new THREE.Quaternion().setFromAxisAngle(u, TRI_ROLL));
    const pos = C.clone().addScaledVector(u, TRI_DIST);
    const center = pos.clone().addScaledVector(u, 10 * Math.sqrt(3) * 0.5);
    return { pos, q, center };
  }, []);

  const kl = useMemo(() => ({ geo: kleinLines(), mat: new THREE.LineBasicMaterial({ color: new THREE.Color("#bff4ff").multiplyScalar(1.8), toneMapped: false, transparent: true, opacity: 0.75 }) }), []);
  useEffect(() => () => (kl.geo.dispose(), kl.mat.dispose()), [kl]);
  const N = 64;
  const RISE = 0.42;
  const stepRef = useRef<THREE.InstancedMesh>(null);
  const edgeRef = useRef<THREE.InstancedMesh>(null);
  const r = useRef<Record<string, THREE.Object3D | null>>({});
  const set = (k: string) => (el: THREE.Object3D | null) => void (r.current[k] = el);
  const tmp = useMemo(() => ({ m: new THREE.Matrix4(), q: new THREE.Quaternion(), p: new THREE.Vector3(), s: new THREE.Vector3(), up: new THREE.Vector3(0, 1, 0) }), []);
  const { camera } = useThree();
  useFrame((st) => {
    const t = st.clock.elapsedTime;
    if (r.current.klein) r.current.klein.rotation.set(t * 0.11, t * 0.17, 0.3);
    if (r.current.horn) r.current.horn.rotation.set(t * 0.4, 0.5, 0.25);
    if (r.current.menger) r.current.menger.rotation.set(t * 0.07, t * 0.13, t * 0.05);
    if (r.current.hole) r.current.hole.lookAt(camera.position);
    // cầu thang: các bậc trượt dần lên, bậc trên cùng mờ đi, bậc mới hiện ở dưới → leo mãi không tới đỉnh
    const ph = (t * 0.55) % 1;
    for (let i = 0; i < N; i++) {
      const k = i + ph;
      const fade = Math.min(1, k / 6) * Math.min(1, (N - k) / 6);
      tmp.q.setFromAxisAngle(tmp.up, (k * 20 * Math.PI) / 180);
      tmp.p.set(0, k * RISE - (N * RISE) / 2, 0);
      tmp.m.compose(tmp.p, tmp.q, tmp.s.setScalar(Math.max(0.001, fade)));
      stepRef.current?.setMatrixAt(i, tmp.m);
      edgeRef.current?.setMatrixAt(i, tmp.m);
    }
    if (stepRef.current) stepRef.current.instanceMatrix.needsUpdate = true;
    if (edgeRef.current) edgeRef.current.instanceMatrix.needsUpdate = true;
  });
  return (
    <group>
      <VistaClock />
      {/* Tam giác Penrose + Mắt */}
      <primitive object={W.tribar} position={tri.pos} quaternion={tri.q} />
      <EyeBurst at={tri.center} tribar={W.tribar} />
      <Label3D text={t("Tam giác Penrose · chỉ khép kín khi nhìn từ Mắt Penrose", "Penrose triangle · closes only from the Penrose Eye")} position={[tri.center.x, tri.center.y + 9, tri.center.z]} maxDist={120} />
      <Label3D text={t("Mắt Penrose · đứng đây", "Penrose Eye · stand here")} position={[EYE.x, 0.35, EYE.z]} maxDist={18} />
      {/* Chai Klein: mặt kín KHÔNG có trong / ngoài */}
      <group position={[39.4, 12, -6.9]}>
        <group ref={set("klein")} scale={3.2}>
          <primitive object={W.klein} />
          <lineSegments geometry={kl.geo} material={kl.mat} />
        </group>
        <Label3D text={t("Chai Klein · không có mặt trong, không có mặt ngoài", "Klein bottle · no inside, no outside")} position={[0, 9, 0]} maxDist={120} />
      </group>
      {/* Kèn Gabriel: đổ đầy sơn được nhưng không sơn kín được mặt */}
      <group position={[-14.4, 7, -40]}>
        <group ref={set("horn")}>
          <primitive object={W.horn} scale={1.6} position={[-12, 0, 0]} />
        </group>
        <Label3D text={t("Kèn Gabriel · thể tích hữu hạn, diện tích vô hạn", "Gabriel's horn · finite volume, infinite area")} position={[0, 6, 0]} maxDist={120} />
      </group>
      {/* Bọt biển Menger */}
      <group position={[-24.4, 13, 29.1]}>
        <primitive ref={set("menger")} object={W.menger} scale={2.4} />
        <Label3D text={t("Bọt biển Menger · thể tích → 0, diện tích → ∞", "Menger sponge · volume → 0, area → ∞")} position={[0, 9, 0]} maxDist={120} />
      </group>
      {/* Cầu thang vô tận */}
      <group position={[31, 3, 27]} scale={1.5}>
        {W.step && <instancedMesh ref={stepRef} args={[W.step.geo, W.step.mat, N]} frustumCulled={false} />}
        {W.edge && <instancedMesh ref={edgeRef} args={[W.edge.geo, W.edge.mat, N]} frustumCulled={false} />}
        <Label3D text={t("Cầu thang vô tận · leo mãi vẫn ở chỗ cũ", "Endless staircase · climb forever, stay put")} position={[0, 15, 0]} maxDist={120} />
      </group>
      {/* Vista mượn từ Bốt: siêu khối 4D trên đỉnh trời, hố đen phía bắc, bão Lorenz phía tây, đĩa Poincaré là đáy vực */}
      <group position={[0, 52, 0]} scale={0.8}>
        <TesseractVista />
      </group>
      <group ref={set("hole")} position={[95, 60, -170]} scale={1.8}>
        <BlackHoleVista />
      </group>
      <group position={[-150, 25, -40]} scale={1.4}>
        <LorenzVista />
      </group>
      <group position={[0, -70, 0]} rotation={[-Math.PI / 2, 0, 0]} scale={7}>
        <PoincareVista />
      </group>
    </group>
  );
}
