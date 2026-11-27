"use client";
/**
 * Thế giới Bất Khả mở ra vũ trụ: sân là một đảo nổi giữa trời hoàng hôn vũ trụ; quanh đó là quần đảo kỳ quan toán học
 * (`props/imp_cosmos.glb`, Blender + GI nướng) chỉ tới được bằng cách BAY LƯỢN, và một đường bay vòng sáng có bấm giờ.
 *  - ImpSky: shader "hoàng hôn vũ trụ" — dải chân trời hồng tím, sao đôi lặn (nguồn sáng chính), hành tinh khí có vành,
 *    tinh vân fbm uốn miền, thiên hà xoắn, sao lấp lánh; dưới chân trời là vực sao.
 *  - Kỳ quan: nút ba lá, tháp Sierpiński, hấp dẫn lạ Lorenz, vườn Fibonacci (hoa hướng dương 377 hạt + ốc anh vũ), thớ Hopf.
 *  - FlightCourse: vòng sáng nối các đảo (lib/world/impCosmos), bay qua theo thứ tự → chuông + luồng đẩy; đủ vòng → kỷ lục.
 */
import { useEffect, useMemo, useRef } from "react";
import { useFrame, useThree } from "@react-three/fiber";
import { useGLTF } from "@react-three/drei";
import * as THREE from "three";
import { worldAsset } from "@/lib/world/avatars";
import { ISLE_BY_ID, RING_R, crossesRing, flightPath, flightRings } from "@/lib/world/impCosmos";
import { sfx } from "@/lib/world/sfx";
import { bakedMaterial } from "../fx/baked";
import { FLIGHT, saveBest, useRings } from "../flight";
import { useGfx } from "../gfx";
import { useWorld } from "../store";
import { Label3D, floatText } from "../ui/Labels";
import { glowPulse } from "./ParadoxVfx";
import { GodSun, VoidEnvironment, hybridMaterial } from "./VoidHybrid";
import { COSMOS_NODES } from "../lab";
import { CosmosLab } from "./CosmosLab";

const COSMOS = worldAsset("props/imp_cosmos.glb");
useGLTF.preload(COSMOS);

/** Hướng sao đôi lặn (nguồn sáng chính — khớp đèn nướng trong Blender) */
export const IMP_SUN = new THREE.Vector3(0.55, 0.28, -0.8).normalize();
const U = { uExposure: { value: 1.0 }, uFloor: { value: 0.3 }, uTint: { value: new THREE.Color(1.02, 0.96, 1.04) }, uScale: { value: 1.9 } };

export function impSky() {
  return new THREE.ShaderMaterial({
    uniforms: { uT: { value: 0 }, uSun: { value: IMP_SUN.clone() } },
    vertexShader: "varying vec3 vD; void main(){ vD = position; gl_Position = projectionMatrix * modelViewMatrix * vec4(position,1.0); }",
    fragmentShader: `uniform float uT; uniform vec3 uSun; varying vec3 vD;
      float h3(vec3 p){ return fract(sin(dot(p, vec3(127.1, 311.7, 74.7))) * 43758.5453); }
      float n3(vec3 p){ vec3 i = floor(p); vec3 f = fract(p); f = f*f*(3.0-2.0*f);
        return mix(mix(mix(h3(i), h3(i+vec3(1,0,0)), f.x), mix(h3(i+vec3(0,1,0)), h3(i+vec3(1,1,0)), f.x), f.y),
                   mix(mix(h3(i+vec3(0,0,1)), h3(i+vec3(1,0,1)), f.x), mix(h3(i+vec3(0,1,1)), h3(i+vec3(1,1,1)), f.x), f.y), f.z); }
      float fbm(vec3 p){ float a = 0.5, s = 0.0; for (int i = 0; i < 5; i++){ s += a * n3(p); p = p * 2.03 + vec3(1.7, 9.2, 3.1); a *= 0.5; } return s; }
      vec2 tang(vec3 d, vec3 g){ vec3 a = normalize(cross(g, vec3(0.0, 1.0, 0.0001))); vec3 b = cross(a, g); return vec2(dot(d, a), dot(d, b)) / max(dot(d, g), 0.001); }
      void main(){
        vec3 d = normalize(vD);
        float y = d.y;
        float sd = max(dot(d, uSun), 0.0);
        // nền: đỉnh trời chàm đen → chân trời hồng tím; phía mặt trời ửng vàng cam; dưới chân trời: vực sao tím sâu
        vec3 zen = vec3(0.012, 0.01, 0.035);
        vec3 hor = mix(vec3(0.3, 0.1, 0.36), vec3(0.95, 0.42, 0.28), pow(sd, 3.0));
        float hb = exp(-abs(y) * (y > 0.0 ? 5.5 : 3.0));
        vec3 c = mix(zen, hor, hb);
        c += vec3(0.07, 0.03, 0.12) * smoothstep(0.0, -0.8, y);
        // tinh vân uốn miền (trôi rất chậm)
        vec3 p = d * 2.2 + vec3(uT * 0.002, 0.0, 0.0);
        vec3 w = vec3(fbm(p + vec3(3.1)), fbm(p + vec3(7.7)), fbm(p + vec3(1.3)));
        float n = fbm(p + 1.9 * w);
        float n2 = fbm(d * 5.5 + 2.4 * w);
        float band = exp(-pow(dot(d, normalize(vec3(-0.4, 1.0, 0.3))) * 2.3, 2.0));
        vec3 neb = mix(vec3(0.5, 0.16, 0.7), vec3(0.06, 0.45, 0.65), smoothstep(0.35, 0.75, w.x));
        neb = mix(neb, vec3(1.0, 0.35, 0.55), smoothstep(0.5, 0.82, w.y) * 0.7);
        neb = mix(neb, vec3(1.0, 0.75, 0.35), smoothstep(0.62, 0.86, n2) * 0.4);
        float dens = smoothstep(0.42, 0.95, n * (0.68 + band * 0.85));
        c += neb * dens * (0.28 + band * 0.8) * (1.0 - hb * 0.5);
        c *= 1.0 - smoothstep(0.55, 0.8, n2) * band * 0.5;
        // thiên hà xoắn
        vec3 gd = normalize(vec3(-0.7, 0.5, 0.5));
        if (dot(d, gd) > 0.8) {
          vec2 q = tang(d, gd) * 6.0; q.y /= 0.5;
          float r = length(q), th = atan(q.y, q.x);
          float arms = pow(0.5 + 0.5 * cos(2.0 * th - log(r + 0.05) * 5.0 + uT * 0.02), 3.0);
          c += mix(vec3(0.55, 0.65, 1.0), vec3(1.0, 0.85, 0.65), exp(-r * 3.0)) * (exp(-r * 1.6) * (0.35 + arms * 1.3) + exp(-r * 9.0) * 2.2) * 0.85;
        }
        // hành tinh khí khổng lồ có vành (sáng phía sao đôi)
        vec3 pd = normalize(vec3(-0.62, 0.3, -0.72));
        vec2 pq = tang(d, pd) * 5.2;
        float pr = length(pq);
        if (dot(d, pd) > 0.9) {
          float rr = length(vec2(pq.x, pq.y / 0.3));
          float ring = smoothstep(0.05, 0.0, abs(rr - 1.75)) * 0.6 + smoothstep(0.18, 0.0, abs(rr - 1.45)) * (0.5 + 0.5 * sin(rr * 70.0)) * 0.5;
          float front = step(0.0, -pq.y) + step(1.0, pr);
          if (pr < 1.0) {
            vec3 nn = normalize(vec3(pq, sqrt(1.0 - pr * pr)));
            vec3 sl = normalize(vec3(dot(uSun, normalize(cross(pd, vec3(0.0, 1.0, 0.0001)))), dot(uSun, cross(normalize(cross(pd, vec3(0.0, 1.0, 0.0001))), pd)), 0.35));
            float lit = clamp(dot(nn, sl) * 0.9 + 0.1, 0.0, 1.0);
            vec3 bands = mix(vec3(0.62, 0.4, 0.78), vec3(1.0, 0.78, 0.58), 0.5 + 0.5 * sin(pq.y * 13.0 + n * 3.0 + sin(pq.x * 2.0) * 0.6));
            c = bands * (0.035 + lit * 0.75) + vec3(0.7, 0.45, 1.0) * pow(1.0 - nn.z, 3.0) * 0.35;
          }
          c += vec3(1.0, 0.86, 0.7) * ring * 0.6 * front;
          c += vec3(0.55, 0.4, 1.0) * smoothstep(1.2, 1.0, pr) * step(1.0, pr) * 0.3;
        }
        // hai vệ tinh nhỏ
        for (int k = 0; k < 2; k++) {
          vec3 md = normalize(k == 0 ? vec3(-0.25, 0.42, -0.86) : vec3(-0.85, 0.55, -0.2));
          vec2 mq = tang(d, md) * (k == 0 ? 38.0 : 60.0);
          float mr = length(mq);
          if (dot(d, md) > 0.99 && mr < 1.0) c = vec3(0.85, 0.8, 0.95) * (0.05 + 0.9 * clamp(dot(normalize(vec3(mq, sqrt(1.0 - mr * mr))), normalize(vec3(0.7, -0.2, 0.5))), 0.0, 1.0));
        }
        // sao đôi lặn: đĩa trắng vàng + quầng + tia sáng chữ thập mảnh; sao đồng hành xanh nhỏ
        float s1 = smoothstep(0.99935, 0.99965, sd);
        c += vec3(1.0, 0.93, 0.8) * s1 * 6.0;
        c += vec3(1.0, 0.6, 0.35) * pow(sd, 260.0) * 2.4 + vec3(1.0, 0.45, 0.4) * pow(sd, 22.0) * 0.45;
        vec2 sq = tang(d, uSun);
        c += vec3(1.0, 0.8, 0.6) * (exp(-abs(sq.y) * 900.0) * exp(-abs(sq.x) * 9.0) + exp(-abs(sq.x) * 900.0) * exp(-abs(sq.y) * 9.0)) * 0.8 * step(0.0, dot(d, uSun));
        vec3 cd = normalize(uSun + vec3(0.045, 0.02, 0.03));
        c += vec3(0.6, 0.8, 1.0) * smoothstep(0.99985, 0.99993, dot(d, cd)) * 3.0 + vec3(0.4, 0.6, 1.0) * pow(max(dot(d, cd), 0.0), 900.0) * 1.2;
        // sao lấp lánh (thưa gần chân trời phía mặt trời)
        float starMask = 1.0 - hb * 0.85;
        for (int k = 0; k < 2; k++) {
          float sc = k == 0 ? 250.0 : 85.0;
          vec3 qq = d * sc; vec3 cell = floor(qq); vec3 f = fract(qq) - 0.5;
          float r = h3(cell + float(k) * 17.0);
          float thr = k == 0 ? 0.972 - band * 0.02 : 0.993;
          float st = step(thr, r) * smoothstep(k == 0 ? 0.3 : 0.22, 0.0, length(f)) * (0.55 + 0.45 * sin(uT * (1.0 + r * 3.0) + r * 50.0));
          c += mix(vec3(0.75, 0.85, 1.0), vec3(1.0, 0.85, 0.7), h3(cell + 3.0)) * st * (k == 0 ? 1.0 + band : 2.4) * starMask;
        }
        gl_FragColor = vec4(c, 1.0);
      }`,
    side: THREE.BackSide,
    depthWrite: false,
    toneMapped: false,
    fog: false,
  });
}

export function ImpSky() {
  const mat = useMemo(() => impSky(), []);
  useEffect(() => () => mat.dispose(), [mat]);
  const g = useRef<THREE.Mesh>(null);
  const { camera } = useThree();
  useFrame(() => {
    mat.uniforms.uT.value = performance.now() / 1000;
    g.current?.position.copy(camera.position);
  });
  return (
    <mesh ref={g} material={mat} renderOrder={-1} frustumCulled={false}>
      <sphereGeometry args={[480, 64, 32]} />
    </mesh>
  );
}

/** Quần đảo + kỳ quan (GLB nướng); kỳ quan lơ lửng xoay chậm quanh gốc của chính nó */
function CosmosIsles({ real }: { real: boolean }) {
  const gltf = useGLTF(COSMOS);
  const { root, mats, spin } = useMemo(() => {
    const cache = new Map<string, THREE.Material>();
    const root = gltf.scene.clone(true);
    root.traverse((o) => {
      const m = o as THREE.Mesh;
      if (!m.isMesh) return;
      const conv = (sm: THREE.Material) => {
        const s = sm as THREE.MeshStandardMaterial;
        let mat = cache.get(s.name);
        if (!mat) {
          if (s.name.startsWith("glow_")) {
            const g = new THREE.MeshBasicMaterial({ color: s.color.clone().multiplyScalar(real ? 3.0 : 2.2), toneMapped: false, side: THREE.DoubleSide });
            glowPulse(g, s.name);
            mat = g;
          } else mat = real ? hybridMaterial(s, true, s.name) : bakedMaterial(s, U);
          cache.set(s.name, mat);
        }
        return mat;
      };
      m.material = Array.isArray(m.material) ? m.material.map(conv) : conv(m.material);
    });
    const spin = (["ic_knot", "ic_knot_glow", "ic_hopf", "ic_lorenz"] as const).map((n) => root.getObjectByName(n)).filter(Boolean) as THREE.Object3D[];
    return { root, mats: [...cache.values()], spin };
  }, [gltf, real]);
  useEffect(() => () => mats.forEach((m) => m.dispose()), [mats]);
  useEffect(() => {
    COSMOS_NODES.knot = root.getObjectByName("ic_knot") ?? null;
    COSMOS_NODES.lorenz = root.getObjectByName("ic_lorenz") ?? null;
    COSMOS_NODES.hopf = root.getObjectByName("ic_hopf") ?? null;
    return () => {
      COSMOS_NODES.knot = COSMOS_NODES.lorenz = COSMOS_NODES.hopf = null;
    };
  }, [root]);
  useFrame((_, dt) => {
    for (const o of spin) o.rotation.y += dt * (o.name === "ic_hopf" ? 0.12 : o.name === "ic_lorenz" ? 0.08 : 0.18);
  });
  return <primitive object={root} />;
}

const LABELS: { id: string; vi: string; en: string; dy: number }[] = [
  { id: "knot", vi: "Nút Ba Lá · nút đơn giản nhất không thể gỡ thành một vòng tròn", en: "Trefoil Knot · the simplest knot that can't be untied into a plain circle", dy: 19 },
  { id: "sierp", vi: "Tháp Sierpiński · chia mãi: thể tích → 0, diện tích mặt giữ nguyên — vật thể 2 chiều trong không gian 3 chiều", en: "Sierpiński Tower · keep subdividing: volume → 0, surface stays — a 2-dimensional object in 3D", dy: 13 },
  { id: "lorenz", vi: "Hấp dẫn lạ Lorenz · hiệu ứng cánh bướm: lệch một li, đi một dặm", en: "Lorenz Attractor · the butterfly effect: a tiny nudge, a different future", dy: 19 },
  { id: "fib", vi: "Vườn Fibonacci · 21 và 34 đường xoắn (hai số Fibonacci liền nhau) nhờ góc vàng 137,5°", en: "Fibonacci Garden · 21 and 34 spirals (consecutive Fibonacci numbers) from the golden angle 137.5°", dy: 16 },
  { id: "hopf", vi: "Thớ Hopf · mỗi vòng tròn là một điểm của mặt cầu — hai vòng bất kỳ đều móc vào nhau", en: "Hopf Fibration · each circle is one point of a sphere — any two circles are linked", dy: 18 },
];

/** Đường bay vòng sáng: vòng kế tiếp vàng rực, hai vòng sau xanh, còn lại mờ; qua vòng → loé + nở to rồi tắt */
function FlightCourse() {
  const rings = useMemo(() => flightRings(), []);
  const n = rings.length;
  const { geo, mat, mesh, line } = useMemo(() => {
    const geo = new THREE.TorusGeometry(RING_R, 0.13, 8, 56);
    const st = new Float32Array(n * 2); // trạng thái (0 mờ · 1 kế tiếp · 2 sắp tới), thời điểm vừa qua (s)
    geo.setAttribute("aSt", new THREE.InstancedBufferAttribute(st, 2));
    const mat = new THREE.ShaderMaterial({
      uniforms: { uT: { value: 0 } },
      vertexShader: `attribute vec2 aSt; uniform float uT; varying float vS; varying float vAge; varying vec3 vP;
        void main(){
          vS = aSt.x; vAge = aSt.y > 0.0 ? uT - aSt.y : 99.0; vP = position;
          float grow = vAge < 1.2 ? 1.0 + vAge * 0.9 : 1.0;
          float pulse = vS > 0.5 && vS < 1.5 ? 1.0 + 0.06 * sin(uT * 6.0) : 1.0;
          gl_Position = projectionMatrix * viewMatrix * instanceMatrix * vec4(position * grow * pulse, 1.0);
        }`,
      fragmentShader: `uniform float uT; varying float vS; varying float vAge; varying vec3 vP;
        void main(){
          float a = atan(vP.y, vP.x);
          float chase = 0.6 + 0.4 * pow(0.5 + 0.5 * sin(a * 6.0 - uT * 5.0), 6.0);
          vec3 c = vS > 0.5 && vS < 1.5 ? vec3(1.0, 0.8, 0.35) * 3.2 * chase : vS > 1.5 ? vec3(0.45, 0.9, 1.0) * 1.6 : vec3(0.6, 0.45, 1.0) * 0.55;
          float al = vS > 0.5 ? 0.95 : 0.4;
          if (vAge < 1.2) { c = mix(vec3(1.0, 0.95, 0.8) * 4.0, c, vAge / 1.2); al = (1.0 - vAge / 1.2); }
          gl_FragColor = vec4(c, al);
        }`,
      transparent: true,
      depthWrite: false,
      blending: THREE.AdditiveBlending,
      toneMapped: false,
    });
    const mesh = new THREE.InstancedMesh(geo, mat, n);
    const q = new THREE.Quaternion();
    const Z = new THREE.Vector3(0, 0, 1);
    const m4 = new THREE.Matrix4();
    rings.forEach((r, i) => {
      q.setFromUnitVectors(Z, new THREE.Vector3(...r.n));
      m4.compose(new THREE.Vector3(...r.p), q, new THREE.Vector3(1, 1, 1));
      mesh.setMatrixAt(i, m4);
    });
    mesh.frustumCulled = false;
    // vệt dẫn đường mờ nối các vòng (chấm sáng chạy dọc)
    const pts = flightPath(16);
    const lg = new THREE.BufferGeometry().setFromPoints(pts.map((p) => new THREE.Vector3(...p)));
    const along = new Float32Array(pts.length);
    let acc = 0;
    for (let i = 1; i < pts.length; i++) along[i] = acc += Math.hypot(pts[i][0] - pts[i - 1][0], pts[i][1] - pts[i - 1][1], pts[i][2] - pts[i - 1][2]);
    lg.setAttribute("aL", new THREE.BufferAttribute(along, 1));
    const lm = new THREE.ShaderMaterial({
      uniforms: { uT: mat.uniforms.uT },
      vertexShader: "attribute float aL; varying float vL; void main(){ vL = aL; gl_Position = projectionMatrix * modelViewMatrix * vec4(position, 1.0); }",
      fragmentShader: "uniform float uT; varying float vL; void main(){ float d = pow(0.5 + 0.5 * sin(vL * 0.6 - uT * 6.0), 10.0); gl_FragColor = vec4(vec3(0.7, 0.85, 1.0) * (0.25 + d * 1.8), 0.18 + d * 0.5); }",
      transparent: true,
      depthWrite: false,
      blending: THREE.AdditiveBlending,
      toneMapped: false,
    });
    const line = new THREE.LineLoop(lg, lm);
    line.frustumCulled = false;
    return { geo, mat, mesh, line };
  }, [rings, n]);
  useEffect(
    () => () => {
      geo.dispose();
      mat.dispose();
      line.geometry.dispose();
      (line.material as THREE.Material).dispose();
    },
    [geo, mat, line],
  );
  useEffect(() => useRings.setState({ total: n, next: 0, passed: 0, startedAt: 0 }), [n]);
  const prev = useRef<[number, number, number] | null>(null);
  const lastPass = useRef(0);
  const shown = useRef(-1);
  useFrame(() => {
    const t = performance.now() / 1000;
    mat.uniforms.uT.value = t;
    const p = useWorld.getState().player;
    const cur: [number, number, number] = [p.x, p.y + 1.0, p.z];
    const R = useRings.getState();
    const st = geo.getAttribute("aSt") as THREE.InstancedBufferAttribute;
    if (prev.current && FLIGHT.enabled) {
      const k = R.next;
      if (crossesRing(prev.current, cur, rings[k], RING_R + 0.4)) {
        const now = performance.now();
        lastPass.current = now;
        FLIGHT.boostUntil = now + 1800;
        st.setY(k, t);
        sfx.harmonic((R.passed % 8) + 1);
        const startedAt = R.passed === 0 ? now : R.startedAt;
        const passed = R.passed + 1;
        if (passed >= n) {
          const ms = now - startedAt;
          const rec = saveBest(ms);
          sfx.fanfare();
          floatText(new THREE.Vector3(...rings[k].p), `${(ms / 1000).toFixed(1)} s${rec ? " ★" : ""}`, "crit");
          useRings.setState({ next: 0, passed: 0, startedAt: 0, finishedAt: now, lastTime: ms });
        } else useRings.setState({ next: (k + 1) % n, passed, startedAt });
      }
    }
    prev.current = cur;
    // bỏ cuộc: 30 s không qua vòng nào → đặt lại về vòng xuất phát
    if (R.passed > 0 && performance.now() - lastPass.current > 30000) useRings.setState({ next: 0, passed: 0, startedAt: 0 });
    const nx = useRings.getState().next;
    if (shown.current !== nx) {
      shown.current = nx;
      for (let i = 0; i < n; i++) st.setX(i, i === nx ? 1 : i === (nx + 1) % n || i === (nx + 2) % n ? 2 : 0);
    }
    st.needsUpdate = true;
  });
  const lang = useWorld((s) => (s.lang === "vi" ? "vi" : "en"));
  const r0 = rings[0].p;
  return (
    <>
      <primitive object={mesh} />
      <primitive object={line} />
      <Label3D text={lang === "vi" ? "Đường bay vòng sáng · bay qua vòng vàng để bắt đầu bấm giờ" : "Ring flight course · fly through the gold ring to start the clock"} position={[r0[0], r0[1] + RING_R + 1.2, r0[2]]} maxDist={90} />
    </>
  );
}

/** Rơi khỏi đảo xuống vực → loé sáng, hồi về chỗ đứng an toàn gần nhất */
function FallGuard({ safeGround }: { safeGround: (x: number, z: number, y: number) => boolean }) {
  const safe = useRef(new THREE.Vector3(0, 0, 14));
  useFrame(() => {
    const s = useWorld.getState();
    const p = s.player;
    if (safeGround(p.x, p.z, p.y)) safe.current.copy(p);
    if (p.y < -70) {
      p.copy(safe.current);
      FLIGHT.vel.set(0, 0, 0);
      s.addShake(0.12);
      sfx.circle();
    }
  });
  return null;
}

export function ImpossibleCosmos({ real, safeGround }: { real: boolean; safeGround: (x: number, z: number, y: number) => boolean }) {
  const lang = useWorld((s) => (s.lang === "vi" ? "vi" : "en"));
  const gfx = useGfx();
  const sunPos = useMemo(() => IMP_SUN.clone().multiplyScalar(380).toArray() as [number, number, number], []);
  return (
    <>
      <ImpSky />
      {real && <VoidEnvironment intensity={1} sky={impSky} />}
      {real && gfx.godrays && <GodSun position={sunPos} radius={16} />}
      <CosmosIsles real={real} />
      <FlightCourse />
      <CosmosLab />
      <FallGuard safeGround={safeGround} />
      {LABELS.map((l) => {
        const i = ISLE_BY_ID[l.id];
        return <Label3D key={l.id} text={l[lang]} position={[i.x, i.h + l.dy, i.z]} maxDist={150} />;
      })}
      <Label3D text={lang === "vi" ? "Ốc anh vũ · xoắn logarit nở ×3 mỗi vòng — KHÔNG phải tỉ lệ vàng như lời đồn!" : "Nautilus · a log spiral growing ×3 per turn — NOT the golden ratio, despite the myth!"} position={[-45.2, ISLE_BY_ID.fib.h + 7.8, -65.9]} maxDist={60} />
    </>
  );
}
