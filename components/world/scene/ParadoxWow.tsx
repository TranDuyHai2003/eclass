"use client";
/**
 * Hư Không Nghịch Lý — các điểm nhấn "choáng ngợp":
 *  - StarWhale: cá voi sao (`props/star_whale.glb`, Blender) bơi vòng quanh quần đảo — thân trong mờ viền fresnel với tinh vân bên trong,
 *    đỉnh lưới là sao lấp lánh, cạnh lưới là đường chòm sao, thân uốn sóng; để lại vệt bụi sao; thỉnh thoảng cất tiếng hát
 *  - Constellation: chòm sao ∞ (đường lemniscate Bernoulli) trên trời phía bắc — mỗi trạm nghịch lý đã khám phá thắp một sao,
 *    đủ 10 thì chòm sao nối kín, pháo hoa sao bùng nổ, cực quang rực lên
 *  - MobiusEnergy: đường biên DUY NHẤT của dải Möbius chảy ánh sáng (đi 2 vòng mới khép) + vệt sáng sau "con kiến"
 *  - LensTracker: báo vị trí hố đen trên màn hình cho hiệu ứng thấu kính hấp dẫn (fx/Lensing)
 */
import { useEffect, useMemo, useRef } from "react";
import { useFrame, useThree } from "@react-three/fiber";
import { useGLTF } from "@react-three/drei";
import * as THREE from "three";
import { worldAsset } from "@/lib/world/avatars";
import { lemniscate } from "@/lib/world/paradoxVoid";
import { sfx } from "@/lib/world/sfx";
import { useWorld } from "../store";
import { Label3D } from "../ui/Labels";
import { LENS } from "../fx/Lensing";
import { AURORA_BOOST } from "./ParadoxVfx";
import { usePdx } from "./paradoxData";

const WHALE = worldAsset("props/star_whale.glb");
useGLTF.preload(WHALE);
const T = { value: 0 };

// uốn thân (trục dọc thân = x, đầu +x): sóng chạy từ đầu về đuôi, biên độ lớn dần về phía đuôi
const BEND = /* glsl */ `
uniform float uT;
vec3 bend(vec3 p){
  float w = smoothstep(4.0, -7.5, p.x);
  p.y += sin(p.x * 0.42 - uT * 1.6) * 0.75 * w;
  p.z += sin(p.x * 0.3 - uT * 0.8) * 0.25 * w;
  return p;
}`;

export function StarWhale() {
  const gltf = useGLTF(WHALE);
  const res = useMemo(() => {
    let geo: THREE.BufferGeometry | null = null;
    gltf.scene.traverse((o) => {
      const m = o as THREE.Mesh;
      if (m.isMesh && !geo) geo = m.geometry;
    });
    const g = geo as unknown as THREE.BufferGeometry;
    const body = new THREE.ShaderMaterial({
      uniforms: { uT: T },
      vertexShader: `${BEND}
        varying vec3 vN; varying vec3 vV; varying vec3 vP;
        void main(){ vec3 p = bend(position); vP = position;
          vec4 mv = modelViewMatrix * vec4(p, 1.0); vV = -mv.xyz; vN = normalize(normalMatrix * normal);
          gl_Position = projectionMatrix * mv; }`,
      fragmentShader: `uniform float uT; varying vec3 vN; varying vec3 vV; varying vec3 vP;
        float h3(vec3 p){ return fract(sin(dot(p, vec3(127.1, 311.7, 74.7))) * 43758.5453); }
        float n3(vec3 p){ vec3 i = floor(p); vec3 f = fract(p); f = f*f*(3.0-2.0*f);
          return mix(mix(mix(h3(i), h3(i+vec3(1,0,0)), f.x), mix(h3(i+vec3(0,1,0)), h3(i+vec3(1,1,0)), f.x), f.y),
                     mix(mix(h3(i+vec3(0,0,1)), h3(i+vec3(1,0,1)), f.x), mix(h3(i+vec3(0,1,1)), h3(i+vec3(1,1,1)), f.x), f.y), f.z); }
        void main(){
          float fr = pow(1.0 - abs(dot(normalize(vN), normalize(vV))), 2.2);
          float neb = n3(vP * 0.9 + vec3(uT * 0.15, 0.0, 0.0)) * 0.6 + n3(vP * 2.3 - vec3(0.0, uT * 0.2, 0.0)) * 0.4;
          vec3 inner = mix(vec3(0.12, 0.08, 0.45), vec3(0.2, 0.7, 0.95), neb);
          inner = mix(inner, vec3(0.95, 0.4, 0.8), smoothstep(0.6, 0.85, neb) * 0.6);
          vec3 c = inner * (0.25 + neb * 0.35) + vec3(0.55, 0.9, 1.0) * fr * 1.8;
          gl_FragColor = vec4(c, 0.35 + fr * 0.6);
        }`,
      transparent: true,
      depthWrite: false,
      blending: THREE.AdditiveBlending,
      side: THREE.DoubleSide,
      toneMapped: false,
      fog: false,
    });
    const edges = new THREE.EdgesGeometry(g, 8);
    const lines = new THREE.ShaderMaterial({
      uniforms: { uT: T },
      vertexShader: `${BEND} varying float vX; void main(){ vX = position.x; gl_Position = projectionMatrix * modelViewMatrix * vec4(bend(position), 1.0); }`,
      fragmentShader: `uniform float uT; varying float vX;
        void main(){ float pulse = 0.55 + 0.45 * pow(0.5 + 0.5 * sin(vX * 0.8 + uT * 2.5), 4.0);
          gl_FragColor = vec4(vec3(0.6, 0.85, 1.0) * 1.6 * pulse, 0.55 * pulse); }`,
      transparent: true,
      depthWrite: false,
      blending: THREE.AdditiveBlending,
      toneMapped: false,
      fog: false,
    });
    const stars = new THREE.ShaderMaterial({
      uniforms: { uT: T },
      vertexShader: `${BEND} varying float vA;
        void main(){ vec3 p = bend(position); vec4 mv = modelViewMatrix * vec4(p, 1.0); gl_Position = projectionMatrix * mv;
          float r = fract(sin(dot(position, vec3(12.9, 78.2, 37.7))) * 43758.5);
          vA = 0.55 + 0.45 * sin(uT * (1.5 + r * 3.0) + r * 30.0);
          gl_PointSize = (3.0 + r * 5.0) * (1.0 + vA) * 30.0 / -mv.z; }`,
      fragmentShader: `varying float vA;
        void main(){ vec2 q = gl_PointCoord - 0.5; float d = length(q);
          float core = smoothstep(0.5, 0.0, d); float spike = max(0.0, 1.0 - abs(q.x) * 14.0) * smoothstep(0.5, 0.0, abs(q.y)) + max(0.0, 1.0 - abs(q.y) * 14.0) * smoothstep(0.5, 0.0, abs(q.x));
          float a = (pow(core, 3.0) + spike * 0.5) * vA; gl_FragColor = vec4(vec3(1.0, 0.95, 0.85) * 2.6 * a, a); }`,
      transparent: true,
      depthWrite: false,
      blending: THREE.AdditiveBlending,
      toneMapped: false,
      fog: false,
    });
    // vệt bụi sao phía sau đuôi: vòng đệm 140 điểm (vị trí thế giới + tuổi)
    const NT = 140;
    const tpos = new Float32Array(NT * 3);
    const tage = new Float32Array(NT).fill(99);
    const trail = new THREE.BufferGeometry();
    trail.setAttribute("position", new THREE.BufferAttribute(tpos, 3));
    trail.setAttribute("aAge", new THREE.BufferAttribute(tage, 1));
    const trailMat = new THREE.ShaderMaterial({
      vertexShader: `attribute float aAge; varying float vA;
        void main(){ vec4 mv = modelViewMatrix * vec4(position, 1.0); gl_Position = projectionMatrix * mv;
          vA = clamp(1.0 - aAge / 5.0, 0.0, 1.0); gl_PointSize = (2.0 + 7.0 * vA) * 30.0 / -mv.z; }`,
      fragmentShader: `varying float vA; void main(){ float d = length(gl_PointCoord - 0.5); if (d > 0.5) discard;
          float a = smoothstep(0.5, 0.0, d) * vA; gl_FragColor = vec4(mix(vec3(1.0, 0.6, 0.9), vec3(0.6, 0.9, 1.0), vA) * 2.0 * a, a); }`,
      transparent: true,
      depthWrite: false,
      blending: THREE.AdditiveBlending,
      toneMapped: false,
      fog: false,
    });
    return { geo: g, body, edges, lines, stars, trail, trailMat, NT };
  }, [gltf]);
  useEffect(() => () => [res.body, res.edges, res.lines, res.stars, res.trail, res.trailMat].forEach((o) => o.dispose()), [res]);

  const g = useRef<THREE.Group>(null);
  const st = useRef({ k: 0, acc: 0, nextSong: 8 });
  const tmp = useMemo(() => ({ p: new THREE.Vector3(), n: new THREE.Vector3(), q: new THREE.Quaternion(), m: new THREE.Matrix4(), tail: new THREE.Vector3(), up: new THREE.Vector3(0, 1, 0) }), []);
  const path = (th: number, out: THREE.Vector3) => out.set(Math.cos(th) * 54, 15 + Math.sin(th * 2) * 6, Math.sin(th) * 46);
  useFrame((s, dt) => {
    const t = s.clock.elapsedTime;
    T.value = t;
    const th = (t / 95) * Math.PI * 2;
    path(th, tmp.p);
    path(th + 0.02, tmp.n);
    const grp = g.current;
    if (!grp) return;
    grp.position.copy(tmp.p);
    // đầu (+x cục bộ) hướng theo chiều bơi, nghiêng nhẹ theo khúc cua
    const fwd = tmp.n.clone().sub(tmp.p).normalize();
    tmp.m.lookAt(new THREE.Vector3(), fwd, tmp.up);
    tmp.q.setFromRotationMatrix(tmp.m).multiply(new THREE.Quaternion().setFromAxisAngle(tmp.up, Math.PI / 2));
    grp.quaternion.copy(tmp.q).multiply(new THREE.Quaternion().setFromAxisAngle(new THREE.Vector3(1, 0, 0), -0.25));
    // vệt bụi sao
    const S = st.current;
    const pos = res.trail.getAttribute("position") as THREE.BufferAttribute;
    const age = res.trail.getAttribute("aAge") as THREE.BufferAttribute;
    for (let i = 0; i < res.NT; i++) age.array[i] += dt;
    S.acc += dt;
    if (S.acc > 0.04) {
      S.acc = 0;
      const i = S.k++ % res.NT;
      tmp.tail.set(-7.5 + Math.random() * 2, (Math.random() - 0.5) * 1.5, (Math.random() - 0.5) * 3).multiplyScalar(1.4).applyQuaternion(grp.quaternion).add(grp.position);
      pos.setXYZ(i, tmp.tail.x, tmp.tail.y, tmp.tail.z);
      age.array[i] = 0;
      pos.needsUpdate = true;
    }
    age.needsUpdate = true;
    // tiếng hát: to hơn khi ở gần
    if (t > S.nextSong) {
      S.nextSong = t + 22 + Math.random() * 14;
      const d = useWorld.getState().player.distanceTo(grp.position);
      if (d < 90) sfx.whale(0.16 * (1 - d / 90) + 0.03);
    }
  });
  return (
    <group>
      <group ref={g} scale={1.4}>
        <mesh geometry={res.geo} material={res.body} frustumCulled={false} />
        <lineSegments geometry={res.edges} material={res.lines} frustumCulled={false} />
        <points geometry={res.geo} material={res.stars} frustumCulled={false} />
      </group>
      <points geometry={res.trail} material={res.trailMat} frustumCulled={false} />
    </group>
  );
}

// ── Chòm sao ∞ ───────────────────────────────────────────────────────────────
const SEEN_KEY = "world.pdx.seen";
function loadSeen(): number[] {
  try {
    const v = JSON.parse(localStorage.getItem(SEEN_KEY) || "[]");
    return Array.isArray(v) ? v.filter((x) => Number.isInteger(x) && x >= 0 && x < 10) : [];
  } catch {
    return [];
  }
}
const CON = { pos: new THREE.Vector3(-58, 30, -88), scale: 19 };
export function Constellation() {
  const lang = useWorld((s) => (s.lang === "vi" ? "vi" : "en"));
  const seen = useRef<Set<number>>(new Set());
  const flare = useRef<number[]>(Array(10).fill(-10));
  const burstAt = useRef(-100);
  const pts = useMemo(() => lemniscate(10).map(([x, y]) => new THREE.Vector3(x * CON.scale, y * CON.scale, 0)), []);
  const res = useMemo(() => {
    const sgeo = new THREE.BufferGeometry().setFromPoints(pts);
    sgeo.setAttribute("aLit", new THREE.BufferAttribute(new Float32Array(10), 1));
    const smat = new THREE.ShaderMaterial({
      uniforms: { uT: T },
      vertexShader: `uniform float uT; attribute float aLit; varying float vL;
        void main(){ vL = aLit; vec4 mv = modelViewMatrix * vec4(position, 1.0); gl_Position = projectionMatrix * mv;
          gl_PointSize = (aLit > 0.5 ? 26.0 + 6.0 * sin(uT * 2.0 + position.x) : 12.0) * 110.0 / -mv.z * (1.0 + max(0.0, aLit - 1.0)); }`,
      fragmentShader: `varying float vL;
        void main(){ vec2 q = gl_PointCoord - 0.5; float d = length(q);
          float core = pow(smoothstep(0.5, 0.0, d), 3.0);
          float spike = (max(0.0, 1.0 - abs(q.x) * 16.0) * smoothstep(0.5, 0.0, abs(q.y)) + max(0.0, 1.0 - abs(q.y) * 16.0) * smoothstep(0.5, 0.0, abs(q.x)));
          float lit = step(0.5, vL);
          vec3 c = mix(vec3(0.5, 0.55, 0.8), vec3(1.0, 0.85, 0.5), lit);
          float a = (core + spike * 0.7 * lit) * mix(0.35, 1.0, lit);
          gl_FragColor = vec4(c * (1.0 + 2.2 * lit) * a, a); }`,
      transparent: true,
      depthWrite: false,
      blending: THREE.AdditiveBlending,
      toneMapped: false,
      fog: false,
    });
    // đường nối: đi đúng theo đường cong ∞ giữa sao k và k+1 (chia 24 đoạn nhỏ); sáng khi cả hai sao đã thắp
    const SUB = 24;
    const lp: THREE.Vector3[] = [];
    const seg: number[] = [];
    const L = (t: number) => {
      const d = 1 + Math.sin(t) ** 2;
      return new THREE.Vector3((Math.cos(t) / d) * CON.scale, ((Math.sin(t) * Math.cos(t)) / d) * CON.scale, 0);
    };
    for (let k = 0; k < 10; k++)
      for (let j = 0; j < SUB; j++) {
        const t0 = (2 * Math.PI * (k + j / SUB)) / 10 + Math.PI / 10;
        const t1 = (2 * Math.PI * (k + (j + 1) / SUB)) / 10 + Math.PI / 10;
        lp.push(L(t0), L(t1));
        seg.push(k, k);
      }
    const lgeo = new THREE.BufferGeometry().setFromPoints(lp);
    lgeo.setAttribute("aLit", new THREE.BufferAttribute(new Float32Array(lp.length), 1));
    lgeo.setAttribute("aSeg", new THREE.BufferAttribute(new Float32Array(seg), 1));
    const lmat = new THREE.ShaderMaterial({
      uniforms: { uT: T },
      vertexShader: "attribute float aLit; varying float vL; varying vec3 vP; void main(){ vL = aLit; vP = position; gl_Position = projectionMatrix * modelViewMatrix * vec4(position, 1.0); }",
      fragmentShader: `uniform float uT; varying float vL; varying vec3 vP;
        void main(){ float flow = 0.6 + 0.4 * sin(vP.x * 0.6 - uT * 3.0);
          gl_FragColor = vec4(vec3(1.0, 0.8, 0.45) * 1.8 * flow * vL, vL * 0.9); }`,
      transparent: true,
      depthWrite: false,
      blending: THREE.AdditiveBlending,
      toneMapped: false,
      fog: false,
    });
    // pháo hoa sao khi hoàn thành: 500 hạt bắn ra từ các sao
    const NB = 500;
    const bpos = new Float32Array(NB * 3);
    const bvel = new Float32Array(NB * 3);
    const bcol = new Float32Array(NB);
    let seed = 99;
    const rnd = () => ((seed = (seed * 16807) % 2147483647) / 2147483647);
    for (let i = 0; i < NB; i++) {
      const p = pts[i % 10];
      bpos.set([p.x, p.y, p.z], i * 3);
      const z = rnd() * 2 - 1;
      const a = rnd() * Math.PI * 2;
      const v = new THREE.Vector3(Math.sqrt(1 - z * z) * Math.cos(a), z, Math.sqrt(1 - z * z) * Math.sin(a)).multiplyScalar(6 + rnd() * 14);
      bvel.set([v.x, v.y, v.z], i * 3);
      bcol[i] = rnd();
    }
    const bgeo = new THREE.BufferGeometry();
    bgeo.setAttribute("position", new THREE.BufferAttribute(bpos, 3));
    bgeo.setAttribute("aV", new THREE.BufferAttribute(bvel, 3));
    bgeo.setAttribute("aC", new THREE.BufferAttribute(bcol, 1));
    const bmat = new THREE.ShaderMaterial({
      uniforms: { uK: { value: -1 } },
      vertexShader: `uniform float uK; attribute vec3 aV; attribute float aC; varying float vA; varying float vC;
        void main(){ float k = max(uK, 0.0); vec3 p = position + aV * (1.0 - exp(-k * 1.6)) * 1.6 - vec3(0.0, 2.0 * k * k, 0.0);
          vec4 mv = modelViewMatrix * vec4(p, 1.0); gl_Position = projectionMatrix * mv;
          vA = step(0.0, uK) * clamp(1.0 - k / 3.5, 0.0, 1.0) * (0.6 + 0.4 * sin(k * 20.0 + aC * 40.0)); vC = aC;
          gl_PointSize = (5.0 + aC * 8.0) * 260.0 / -mv.z; }`,
      fragmentShader: `varying float vA; varying float vC;
        void main(){ float d = length(gl_PointCoord - 0.5); if (d > 0.5) discard;
          vec3 c = vC < 0.33 ? vec3(1.0, 0.8, 0.4) : vC < 0.66 ? vec3(0.5, 0.9, 1.0) : vec3(1.0, 0.5, 0.85);
          float a = smoothstep(0.5, 0.0, d) * vA; gl_FragColor = vec4(c * 3.0 * a, a); }`,
      transparent: true,
      depthWrite: false,
      blending: THREE.AdditiveBlending,
      toneMapped: false,
      fog: false,
    });
    // sóng sáng loang ra từ tâm chòm sao
    const rgeo = new THREE.TorusGeometry(1, 0.04, 8, 128);
    const rmat = new THREE.MeshBasicMaterial({ color: new THREE.Color("#ffe3a0").multiplyScalar(3), transparent: true, opacity: 0, depthWrite: false, blending: THREE.AdditiveBlending, toneMapped: false, fog: false });
    return { sgeo, smat, lgeo, lmat, bgeo, bmat, rgeo, rmat };
  }, [pts]);
  useEffect(() => () => Object.values(res).forEach((o) => o.dispose()), [res]);

  // trạng thái đã khám phá (đọc lại từ máy) + lắng nghe bảng nghịch lý đang mở
  useEffect(() => {
    seen.current = new Set(loadSeen());
  }, []);
  const done = useRef(false);
  const ring = useRef<THREE.Mesh>(null);
  useFrame((s) => {
    const t = s.clock.elapsedTime;
    if (useWorld.getState().overlay === "paradox") {
      const id = usePdx.getState().id;
      if (id >= 0 && id < 10 && !seen.current.has(id)) {
        seen.current.add(id);
        flare.current[id] = t;
        try {
          localStorage.setItem(SEEN_KEY, JSON.stringify([...seen.current]));
        } catch {}
        sfx.chime(id % 5);
        if (seen.current.size === 10 && !done.current) {
          burstAt.current = t + 0.6;
          setTimeout(() => sfx.constellation(), 600);
        }
      }
    }
    done.current = seen.current.size === 10;
    const sl = res.sgeo.getAttribute("aLit") as THREE.BufferAttribute;
    for (let k = 0; k < 10; k++) {
      const f = t - flare.current[k];
      sl.array[k] = seen.current.has(k) ? 1 + (f < 2 ? 1.5 * (1 - f / 2) : 0) : 0;
    }
    sl.needsUpdate = true;
    const ll = res.lgeo.getAttribute("aLit") as THREE.BufferAttribute;
    const sg = res.lgeo.getAttribute("aSeg") as THREE.BufferAttribute;
    for (let i = 0; i < ll.count; i++) {
      const k = sg.array[i];
      ll.array[i] = seen.current.has(k) && seen.current.has((k + 1) % 10) ? 1 : 0;
    }
    ll.needsUpdate = true;
    const bk = t - burstAt.current;
    res.bmat.uniforms.uK.value = bk >= 0 && bk < 4 ? bk : -1;
    if (ring.current) {
      const rk = bk / 2.2;
      ring.current.visible = rk >= 0 && rk < 1;
      ring.current.scale.setScalar(2 + rk * 40);
      res.rmat.opacity = (1 - rk) * (1 - rk);
    }
    AURORA_BOOST.value = bk >= 0 && bk < 8 ? 1.5 * Math.sin((bk / 8) * Math.PI) : done.current ? 0.35 : 0;
  });
  const n = useWorld((s) => (s.overlay === "paradox" ? 1 : 0)); // vẽ lại nhãn khi đóng / mở bảng
  void n;
  return (
    <group position={CON.pos} rotation={[0.1, Math.atan2(-CON.pos.x, -CON.pos.z), 0]}>
      <points geometry={res.sgeo} material={res.smat} frustumCulled={false} />
      <lineSegments geometry={res.lgeo} material={res.lmat} frustumCulled={false} />
      <points geometry={res.bgeo} material={res.bmat} frustumCulled={false} />
      <mesh ref={ring} geometry={res.rgeo} material={res.rmat} visible={false} frustumCulled={false} />
      <Label3D text={`${lang === "vi" ? "Chòm sao Vô Cực" : "The Infinity Constellation"} · ${seen.current.size}/10`} position={[0, -12, 0]} maxDist={160} />
    </group>
  );
}

// ── Dải Möbius: đường biên duy nhất + vệt sáng sau con kiến ───────────────────
const MR = 1.9;
const MW = 0.33;
const mob = (u: number, w: number, out: THREE.Vector3) => out.set((MR + w * Math.cos(u / 2)) * Math.cos(u), w * Math.sin(u / 2), -(MR + w * Math.cos(u / 2)) * Math.sin(u));
export function MobiusEnergy() {
  const res = useMemo(() => {
    // biên: u chạy 0 → 4π với w = +MW — một đường cong khép kín DUY NHẤT (đi 2 vòng quanh tâm)
    const N = 400;
    const cps: THREE.Vector3[] = [];
    for (let i = 0; i < N; i++) cps.push(mob((4 * Math.PI * i) / N, MW + 0.02, new THREE.Vector3()));
    // ống phát sáng dọc đường biên (u của ống = vị trí dọc đường cong 0 → 1)
    const edge = new THREE.TubeGeometry(new THREE.CatmullRomCurve3(cps, true), 600, 0.035, 6, true);
    const edgeMat = new THREE.ShaderMaterial({
      uniforms: { uT: T },
      vertexShader: "varying float vU; void main(){ vU = uv.x; gl_Position = projectionMatrix * modelViewMatrix * vec4(position, 1.0); }",
      fragmentShader: `uniform float uT; varying float vU;
        void main(){ float f = fract(vU * 3.0 - uT * 0.25); float pulse = pow(f, 10.0) * 3.0 + 0.35;
          vec3 c = mix(vec3(1.0, 0.75, 0.35), vec3(0.55, 0.9, 1.0), 0.5 + 0.5 * sin(vU * 12.566));
          gl_FragColor = vec4(c * pulse * 1.6, 1.0); }`,
      toneMapped: false,
      fog: false,
    });
    const NT = 70;
    const trail = new THREE.BufferGeometry();
    trail.setAttribute("position", new THREE.BufferAttribute(new Float32Array(NT * 3), 3));
    const ta = new Float32Array(NT);
    for (let i = 0; i < NT; i++) ta[i] = i / (NT - 1);
    trail.setAttribute("aA", new THREE.BufferAttribute(ta, 1));
    const trailMat = new THREE.ShaderMaterial({
      vertexShader: "attribute float aA; varying float vA; void main(){ vA = aA; vec4 mv = modelViewMatrix * vec4(position, 1.0); gl_Position = projectionMatrix * mv; gl_PointSize = (1.0 + 7.0 * aA) * 30.0 / -mv.z; }",
      fragmentShader: "varying float vA; void main(){ float d = length(gl_PointCoord - 0.5); if (d > 0.5) discard; float a = smoothstep(0.5, 0.0, d) * vA; gl_FragColor = vec4(vec3(0.5, 0.9, 1.0) * 2.6 * a, a); }",
      transparent: true,
      depthWrite: false,
      blending: THREE.AdditiveBlending,
      toneMapped: false,
      fog: false,
    });
    return { edge, edgeMat, trail, trailMat, NT };
  }, []);
  useEffect(() => () => [res.edge, res.edgeMat, res.trail, res.trailMat].forEach((o) => o.dispose()), [res]);
  const tmp = useMemo(() => ({ a: new THREE.Vector3(), b: new THREE.Vector3(), c: new THREE.Vector3(), n: new THREE.Vector3() }), []);
  useFrame((s) => {
    const u0 = (s.clock.elapsedTime * 0.5) % (4 * Math.PI);
    const pos = res.trail.getAttribute("position") as THREE.BufferAttribute;
    for (let i = 0; i < res.NT; i++) {
      // cùng công thức "con kiến" trong ParadoxHall: đường giữa dải + lệch theo pháp tuyến
      const u = u0 - 2.4 * (1 - i / (res.NT - 1));
      mob(u, 0, tmp.a);
      mob(u + 0.01, 0, tmp.b).sub(tmp.a);
      mob(u, 0.01, tmp.c).sub(tmp.a);
      tmp.n.crossVectors(tmp.b, tmp.c).normalize();
      tmp.a.addScaledVector(tmp.n, 0.08);
      pos.setXYZ(i, tmp.a.x, tmp.a.y, tmp.a.z);
    }
    pos.needsUpdate = true;
  });
  return (
    <group>
      <mesh geometry={res.edge} material={res.edgeMat} />
      <points geometry={res.trail} material={res.trailMat} frustumCulled={false} />
    </group>
  );
}

// ── Báo vị trí hố đen cho hiệu ứng thấu kính ─────────────────────────────────
/** Hố đen: tâm (thế giới), bóng tối ≈ 12,6 m, đĩa bồi tụ tới ≈ 61 m (BlackHoleVista 70 m × 1,8) */
export const HOLE = { pos: new THREE.Vector3(95, 60, -170), disk: 64, einstein: 36 };
export function LensTracker() {
  const { camera } = useThree();
  const v = useMemo(() => new THREE.Vector3(), []);
  useEffect(
    () => () => {
      LENS.on = 0;
    },
    [],
  );
  useFrame(() => {
    const pc = camera as THREE.PerspectiveCamera;
    v.copy(HOLE.pos).project(pc);
    const dist = pc.position.distanceTo(HOLE.pos);
    const behind = v.z > 1 || v.z < -1;
    LENS.on = behind ? 0 : 1;
    LENS.center.set(v.x * 0.5 + 0.5, v.y * 0.5 + 0.5);
    const k = 1 / (2 * Math.tan(THREE.MathUtils.degToRad(pc.fov / 2)) * dist);
    LENS.rin = HOLE.disk * k;
    LENS.re = HOLE.einstein * k;
  });
  return null;
}
