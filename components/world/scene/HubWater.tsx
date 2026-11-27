"use client";
/**
 * Nước ở Quảng trường Khởi nguyên — công thức "layered" của nước anime (xem fx/water.ts, docs/ai-reviews/game-3d/WATER.md):
 *  • Hồ: mô phỏng sóng GPU 128² (tia rơi + người lội đánh vào trường sóng) + shader mặt nước 4 lớp pháp tuyến, LUT độ sâu,
 *    phản chiếu mặt phẳng 384² cập nhật 20 Hz (chỉ layer 0 — bỏ cỏ / cây / hạt), caustics chiếu theo tia nắng khúc xạ.
 *  • Tia phun / màn nước tràn: MESH (ống theo quỹ đạo parabol, vành loe) + vệt chảy trôi theo dòng; hạt chỉ cho giọt tách ra / văng.
 *  • Tương tác (v2, số liệu Codex + Jeschke/Yuksel/Enshrouded): bộ đệm BỌT GPU 256² (trôi theo sóng + dòng xoáy, nửa đời 1,1 s)
 *    nhận dấu từ bước lội / cú đáp / tia rơi / nhát chém; 8 vòng gợn giải tích lan 2 m/s (chuỗi vòng từ người chạy tự thành wake chữ V);
 *    cú đáp: vương miện nước + cột nước + 30–88 giọt theo vận tốc chạm; chém trong nước: màn nước cong theo cung kiếm.
 *  • Lên bờ: nhỏ giọt + vết chân ướt.
 *  • Hơi nước + cầu vồng vật lý (dải 40,6°–42,4° quanh điểm đối nhật).
 */
import { useEffect, useMemo, useRef } from "react";
import { useFrame, useThree } from "@react-three/fiber";
import { Reflector } from "three/examples/jsm/objects/Reflector.js";
import * as THREE from "three";
import { FOUNTAINS, POOL } from "@/lib/world/hubLayout";
import { TRAIL_TIP, motion, useCombat } from "../combat/combat";
import { useGfx } from "../gfx";
import { useWorld } from "../store";
import { FoamSim, RippleSim, WIND, causticMaterial, flowMaterial, tickWind, waterShader } from "../fx/water";
import { SplashFX, splashStrength } from "../fx/splash";
import { DAY } from "../fx/dayState";
import { causticTex, noiseTex, streakTex, waterLUT, waterNormalTex } from "../fx/proceduralTex";
import { sfx } from "@/lib/world/sfx";

const G = 9.81;
/** layer chỉ camera chính thấy (phản chiếu bỏ qua): cỏ, cây, hạt, tia phun… */
export const LAYER_NO_REFLECT = 1;
const BLACK = typeof document !== "undefined" ? new THREE.DataTexture(new Uint8Array([0, 0, 0, 255]), 1, 1) : null;
if (BLACK) BLACK.needsUpdate = true;

// ───────────── Hình học dòng chảy (có aFlow = (ngang m, dọc m), aFall = 0…1) ─────────────
interface Jet {
  o: THREE.Vector3;
  v: THREE.Vector3;
  T: number;
}
function jetTo(o: THREE.Vector3, to: THREE.Vector3, apex: number): Jet {
  const vy = Math.sqrt(2 * G * apex);
  const T = (vy + Math.sqrt(vy * vy - 2 * G * (to.y - o.y))) / G;
  return { o, v: new THREE.Vector3((to.x - o.x) / T, vy, (to.z - o.z) / T), T };
}
const jetAt = (j: Jet, t: number, out = new THREE.Vector3()) => out.copy(j.o).addScaledVector(j.v, t).add(new THREE.Vector3(0, -0.5 * G * t * t, 0));
/** ống theo quỹ đạo tia, thon ở vòi, phình nhẹ ở cuối */
function jetTube(j: Jet, radius: number, seg = 40, radial = 8) {
  const pts = Array.from({ length: seg + 1 }, (_, i) => jetAt(j, (i / seg) * j.T));
  const curve = new THREE.CatmullRomCurve3(pts);
  const g = new THREE.TubeGeometry(curve, seg, radius, radial, false);
  const lens = curve.getLengths(seg);
  const flow = new Float32Array((seg + 1) * (radial + 1) * 2);
  const fall = new Float32Array((seg + 1) * (radial + 1));
  const pos = g.attributes.position as THREE.BufferAttribute;
  const P = new THREE.Vector3();
  for (let i = 0; i <= seg; i++) {
    const c = curve.getPointAt(i / seg);
    for (let k = 0; k <= radial; k++) {
      const idx = i * (radial + 1) + k;
      flow[idx * 2] = (k / radial) * Math.PI * 2 * radius;
      flow[idx * 2 + 1] = lens[i];
      fall[idx] = i / seg;
      P.fromBufferAttribute(pos, idx).sub(c).multiplyScalar(0.7 + 0.6 * (i / seg)).add(c);
      pos.setXYZ(idx, P.x, P.y, P.z);
    }
  }
  g.setAttribute("aFlow", new THREE.BufferAttribute(flow, 2));
  g.setAttribute("aFall", new THREE.BufferAttribute(fall, 1));
  return g;
}
/** màn nước tràn: vành loe từ mép bát (rTop, yTop) xuống (rBot, yTop − h); bán kính lượn ±2 cm theo góc */
function curtain(rTop: number, rBot: number, yTop: number, h: number, seg = 56, vseg = 8) {
  const P: number[] = [];
  const N: number[] = [];
  const F: number[] = [];
  const A: number[] = [];
  const idx: number[] = [];
  for (let i = 0; i <= vseg; i++) {
    const t = i / vseg;
    for (let k = 0; k <= seg; k++) {
      const a = (k / seg) * Math.PI * 2;
      const wob = 0.018 * Math.sin(a * 5 + 1.3) + 0.01 * Math.sin(a * 11);
      const r = rTop + (rBot - rTop) * Math.pow(t, 0.7) + wob * t + 0.03 * Math.sin(t * Math.PI);
      P.push(Math.cos(a) * r, yTop - t * h, Math.sin(a) * r);
      N.push(Math.cos(a), 0.15, Math.sin(a));
      F.push((k / seg) * Math.PI * 2 * rTop, t * h);
      A.push(t);
    }
  }
  for (let i = 0; i < vseg; i++)
    for (let k = 0; k < seg; k++) {
      const a = i * (seg + 1) + k;
      const b = a + seg + 1;
      idx.push(a, b, a + 1, a + 1, b, b + 1);
    }
  const g = new THREE.BufferGeometry();
  g.setAttribute("position", new THREE.Float32BufferAttribute(P, 3));
  g.setAttribute("normal", new THREE.Float32BufferAttribute(N, 3));
  g.setAttribute("aFlow", new THREE.Float32BufferAttribute(F, 2));
  g.setAttribute("aFall", new THREE.Float32BufferAttribute(A, 1));
  g.setIndex(idx);
  return g;
}

// ───────────── Giọt văng / tách khỏi tia (CPU, ít hạt, alpha blend — không cộng sáng) ─────────────
const MAXD = 320;
class Droplets {
  pos = new Float32Array(MAXD * 3);
  vel = new Float32Array(MAXD * 3);
  life = new Float32Array(MAXD);
  size = new Float32Array(MAXD);
  geo = new THREE.BufferGeometry();
  i = 0;
  constructor() {
    this.geo.setAttribute("position", new THREE.BufferAttribute(this.pos, 3).setUsage(THREE.DynamicDrawUsage));
    this.geo.setAttribute("aL", new THREE.BufferAttribute(this.life, 1).setUsage(THREE.DynamicDrawUsage));
    this.geo.setAttribute("aS", new THREE.BufferAttribute(this.size, 1).setUsage(THREE.DynamicDrawUsage));
  }
  emit(x: number, y: number, z: number, vx: number, vy: number, vz: number, life = 0.8, size = 0.03) {
    const k = this.i++ % MAXD;
    this.pos.set([x, y, z], k * 3);
    this.vel.set([vx, vy, vz], k * 3);
    this.life[k] = life;
    this.size[k] = size;
  }
  /** n giọt từ vành bán kính r0; 1/3 là giọt chính (~smax, Codex: 5–9 cm), còn lại giọt phụ */
  burst(x: number, y: number, z: number, n: number, up: number, spread: number, smin = 0.025, smax = 0.07, r0 = 0.15) {
    for (let i = 0; i < n; i++) {
      const a = Math.random() * Math.PI * 2;
      const s = spread * (0.35 + Math.random() * 0.8);
      const big = i % 3 === 0;
      const size = big ? smax * (0.7 + Math.random() * 0.3) : smin + Math.random() * (smax - smin) * 0.5;
      this.emit(x + Math.cos(a) * r0, y, z + Math.sin(a) * r0, Math.cos(a) * s, up * (0.45 + Math.random() * 0.8) * (big ? 0.8 : 1), Math.sin(a) * s, 0.5 + Math.random() * 0.7, size);
    }
  }
  step(dt: number, floorY: (x: number, z: number) => number) {
    for (let k = 0; k < MAXD; k++) {
      if (this.life[k] <= 0) continue;
      this.life[k] -= dt;
      this.vel[k * 3 + 1] -= G * dt;
      this.pos[k * 3] += this.vel[k * 3] * dt;
      this.pos[k * 3 + 1] += this.vel[k * 3 + 1] * dt;
      this.pos[k * 3 + 2] += this.vel[k * 3 + 2] * dt;
      if (this.pos[k * 3 + 1] < floorY(this.pos[k * 3], this.pos[k * 3 + 2])) this.life[k] = 0;
    }
    (this.geo.attributes.position as THREE.BufferAttribute).needsUpdate = true;
    (this.geo.attributes.aL as THREE.BufferAttribute).needsUpdate = true;
    (this.geo.attributes.aS as THREE.BufferAttribute).needsUpdate = true;
  }
}
const dropMat = () =>
  new THREE.ShaderMaterial({
    vertexShader: /* glsl */ "attribute float aL; attribute float aS; varying float vL; void main(){ vL = aL; vec4 mv = modelViewMatrix * vec4(position,1.0); gl_PointSize = aL > 0.0 ? aS * 1400.0 / -mv.z : 0.0; gl_Position = projectionMatrix * mv; }",
    fragmentShader: /* glsl */ `varying float vL; void main(){ vec2 q = gl_PointCoord * 2.0 - 1.0; float d = dot(q, q); if (d > 1.0 || vL <= 0.0) discard;
      vec3 c = mix(vec3(0.55, 0.82, 0.9), vec3(0.97, 1.0, 1.0), smoothstep(0.7, 0.0, length(q - vec2(-0.3, 0.3))));
      c *= mix(1.0, 0.72, smoothstep(0.55, 1.0, d));
      gl_FragColor = vec4(c, (1.0 - d * 0.35) * min(1.0, vL * 4.0) * 0.95);
      #include <colorspace_fragment>
    }`,
    transparent: true,
    depthWrite: false,
  });

// ───────────── Hơi nước + cầu vồng vật lý (alpha thấp, không cộng sáng) ─────────────
const mistMat = (sun: THREE.Vector3, noise: THREE.Texture) =>
  new THREE.ShaderMaterial({
    uniforms: { uT: WIND.t, uSun: { value: sun.clone() }, uNoise: { value: noise } },
    vertexShader: "varying vec3 vW; varying vec2 vUv; void main(){ vUv = uv; vec4 w = modelMatrix * vec4(position,1.0); vW = w.xyz; gl_Position = projectionMatrix * viewMatrix * w; }",
    fragmentShader: /* glsl */ `uniform float uT; uniform vec3 uSun; uniform sampler2D uNoise; varying vec3 vW; varying vec2 vUv;
      void main(){
        vec3 d = normalize(vW - cameraPosition);
        float ang = degrees(acos(clamp(dot(d, -uSun), -1.0, 1.0)));
        float x = (ang - 40.6) / 1.8;
        vec3 spec = clamp(vec3(1.5 - abs(x - 1.0) * 3.0, 1.5 - abs(x - 0.55) * 3.0, 1.5 - abs(x - 0.1) * 3.0), 0.0, 1.0);
        float band = smoothstep(-0.2, 0.0, x) * smoothstep(1.2, 1.0, x);
        float dens = texture2D(uNoise, vUv * vec2(2.0, 0.8) + vec2(uT * 0.03, -uT * 0.06)).b;
        dens = smoothstep(0.35, 0.75, dens) * smoothstep(0.0, 0.25, vUv.y) * smoothstep(1.0, 0.45, vUv.y);
        float a = dens * (0.08 + band * 0.22);
        if (a < 0.004) discard;
        gl_FragColor = vec4(mix(vec3(1.0), spec * 1.3, band), a);
      }`,
    transparent: true,
    depthWrite: false,
    side: THREE.DoubleSide,
  });

const MAXF = 40;
/** cập nhật ảnh phản chiếu tối đa 1 lần / ms mili giây (giữ ảnh cũ giữa các lần) */
/**
 * Cập nhật ảnh phản chiếu tối đa 1 lần / ms mili giây; khi MÁY QUAY ĐỨNG YÊN chỉ làm mới ~2 lần / giây
 * (phản chiếu cảnh tĩnh không đổi nếu máy quay không đổi — tiết kiệm cả một lượt vẽ lại cảnh trên CPU).
 */
function throttleRender(r: THREE.Object3D, ms: number, idleMs = 500) {
  const before = r.onBeforeRender;
  let last = 0;
  const lastM = new Float32Array(16);
  r.onBeforeRender = function (...args) {
    const now = performance.now();
    if (now - last < ms) return;
    const cam = args[2] as THREE.Camera;
    const e = cam.matrixWorld.elements;
    let moved = 0;
    for (let i = 0; i < 16; i++) moved = Math.max(moved, Math.abs(e[i] - lastM[i]));
    if (moved < 2e-3 && now - last < idleMs) return;
    lastM.set(e);
    last = now;
    before.apply(r, args);
  };
}
const L1 = (o: THREE.Object3D | null) => {
  o?.layers.set(LAYER_NO_REFLECT);
};

export function HubWater({ sun }: { sun: THREE.Vector3 }) {
  const { gl } = useThree();
  const refl = useGfx((s) => s.reflections);
  const preset = useGfx((s) => s.preset);
  const vfx = useGfx((s) => s.vfx);
  const sim = useMemo(() => new RippleSim(128), []);
  const foamSim = useMemo(() => new FoamSim(256), []);
  useEffect(
    () => () => {
      sim.dispose();
      foamSim.dispose();
    },
    [sim, foamSim],
  );
  const tex = useMemo(() => ({ normal: waterNormalTex(), noise: noiseTex(), lut: waterLUT(), caustic: causticTex(), streak: streakTex() }), []);
  const splash = useMemo(() => {
    const f = new SplashFX(tex.noise, POOL.water);
    f.group.traverse((o) => o.layers.set(LAYER_NO_REFLECT));
    return f;
  }, [tex]);
  useEffect(() => () => splash.dispose(), [splash]);
  const depth = POOL.water - POOL.floor;

  // ── mặt hồ ──
  const water = useMemo(() => {
    const shader = waterShader({ radius: POOL.r, inner: 2.42, sun, depth });
    const geo = new THREE.CircleGeometry(POOL.r, 96);
    let mesh: THREE.Mesh;
    if (refl) {
      const res = preset === "ultra" ? 768 : 384;
      const r = new Reflector(geo, { textureWidth: res, textureHeight: res, clipBias: 0.003, shader, multisample: 0 });
      // camera phản chiếu chỉ thấy layer 0 (bỏ cỏ / cây / hạt / tia nước) + cập nhật 20 Hz
      const getCam = r.getReflectionCamera.bind(r);
      r.getReflectionCamera = (cam: THREE.Camera) => {
        const c = getCam(cam);
        c.layers.set(0);
        return c;
      };
      throttleRender(r, 50);
      mesh = r;
    } else mesh = new THREE.Mesh(geo, new THREE.ShaderMaterial({ ...shader }));
    mesh.rotation.x = -Math.PI / 2;
    mesh.position.y = POOL.water;
    mesh.renderOrder = 3;
    const mat = mesh.material as THREE.ShaderMaterial;
    Object.assign(mat.uniforms, { uWindDir: WIND.dir, uT: WIND.t, uGust: WIND.gust });
    mat.uniforms.uNormal.value = tex.normal;
    mat.uniforms.uNoise.value = tex.noise;
    mat.uniforms.uLUT.value = tex.lut;
    mat.uniforms.uLace.value = tex.caustic;
    // ngày ↔ đêm (HubDayCycle): hướng / màu nắng + mức sáng dùng chung
    mat.uniforms.uSun = DAY.light;
    mat.uniforms.uSunCol = DAY.lightCol;
    mat.uniforms.uLevel = DAY.level;
    mat.uniforms.uPlanar.value = refl ? 1 : 0;
    mat.transparent = true;
    // ghi độ sâu: viền mực hậu kỳ chỉ còn ở mép nước (không vẽ xuyên qua nước quanh đế tượng), giọt dưới nước bị che đúng
    mat.depthWrite = true;
    return mesh;
  }, [refl, preset, sun, depth, tex]);
  useEffect(
    () => () => {
      water.geometry.dispose();
      (water.material as THREE.Material).dispose();
      (water as unknown as { dispose?: () => void }).dispose?.();
    },
    [water],
  );
  const basinMat = useMemo(() => {
    const m = new THREE.ShaderMaterial({ ...waterShader({ radius: 1.49, inner: 0.42, sun, depth: 0.3 }), transparent: true, depthWrite: false });
    Object.assign(m.uniforms, { uWindDir: WIND.dir, uT: WIND.t, uGust: WIND.gust });
    m.uniforms.tHeight.value = BLACK;
    m.uniforms.uFoamTex.value = BLACK;
    m.uniforms.uLace.value = BLACK;
    m.uniforms.uSun = DAY.light;
    m.uniforms.uLevel = DAY.level;
    m.uniforms.uNormal.value = tex.normal;
    m.uniforms.uNoise.value = tex.noise;
    m.uniforms.uLUT.value = tex.lut;
    return m;
  }, [sun, tex]);
  useEffect(() => () => basinMat.dispose(), [basinMat]);
  const caustics = useMemo(() => {
    const m = causticMaterial({ radius: POOL.r, inner: 2.42, depth, sun, tex: tex.caustic });
    // ánh sóng dưới đáy chỉ có khi có nắng
    m.uniforms.uLevel = DAY.sunK;
    return m;
  }, [depth, sun, tex]);
  const basinCaustics = useMemo(() => {
    const m = causticMaterial({ radius: 1.45, inner: 0.42, depth: 0.3, sun, tex: tex.caustic, strength: 0.3 });
    m.uniforms.uLevel = DAY.sunK;
    return m;
  }, [sun, tex]);
  useEffect(
    () => () => {
      caustics.dispose();
      basinCaustics.dispose();
    },
    [caustics, basinCaustics],
  );

  // ── tia phun (mesh instanced) ──
  const J = useMemo(() => {
    const mainJets: Jet[] = [];
    const landings: THREE.Vector3[] = [];
    for (let k = 0; k < 8; k++) {
      const a = (k / 8) * Math.PI * 2 + Math.PI / 8;
      const o = new THREE.Vector3(Math.cos(a) * (POOL.r - 0.25), POOL.rimH + 0.2, Math.sin(a) * (POOL.r - 0.25));
      const to = new THREE.Vector3(Math.cos(a) * 3.0, POOL.water, Math.sin(a) * 3.0);
      mainJets.push(jetTo(o, to, 1.9));
      landings.push(to);
    }
    const j0 = jetTo(new THREE.Vector3(POOL.r - 0.25, POOL.rimH + 0.2, 0), new THREE.Vector3(3.0, POOL.water, 0), 1.9);
    const mainGeo = jetTube(j0, 0.06);
    const lionGeo = jetTube(jetTo(new THREE.Vector3(1.02, 1.62, 0), new THREE.Vector3(1.4, 0.42, 0), 0.22), 0.03, 20, 6);
    const topGeo = jetTube(jetTo(new THREE.Vector3(0, 2.78, 0), new THREE.Vector3(0.42, 2.3, 0), 0.5), 0.028, 20, 6);
    const lions: THREE.Matrix4[] = [];
    const tops: THREE.Matrix4[] = [];
    for (const f of FOUNTAINS) {
      for (let k = 0; k < 8; k++) lions.push(new THREE.Matrix4().makeRotationY((-k * Math.PI) / 4).setPosition(f.x, 0, f.z));
      for (let k = 0; k < 6; k++) tops.push(new THREE.Matrix4().makeRotationY((-k * Math.PI) / 3).setPosition(f.x, 0, f.z));
    }
    const jetFlow = flowMaterial({ tex: tex.streak, speed: 6.5, width: 0.16, length: 0.55, wobble: 0.006, alpha: 0.85, core: "#6fc6dc" });
    // đài phun hx_fountain2: bát giữa 16 mũi, bát trên 12 mũi → nước rơi thành dòng từ từng mũi
    const curtainFlow = flowMaterial({ tex: tex.streak, speed: 2.2, width: 0.05, length: 0.7, alpha: 0.7, strands: { n: 16, r: 1.04 } });
    const curtainTopFlow = flowMaterial({ tex: tex.streak, speed: 2.2, width: 0.05, length: 0.7, alpha: 0.7, strands: { n: 12, r: 0.6, phase: Math.PI * 1.5 } });
    jetFlow.uniforms.uLevel = DAY.level;
    curtainFlow.uniforms.uLevel = DAY.level;
    curtainTopFlow.uniforms.uLevel = DAY.level;
    const mk = (g: THREE.BufferGeometry, mats: THREE.Matrix4[]) => {
      const im = new THREE.InstancedMesh(g, jetFlow, mats.length);
      mats.forEach((m, i) => im.setMatrixAt(i, m));
      im.frustumCulled = false;
      im.layers.set(LAYER_NO_REFLECT);
      return im;
    };
    const mainMats = Array.from({ length: 8 }, (_, k) => new THREE.Matrix4().makeRotationY(-((k / 8) * Math.PI * 2 + Math.PI / 8)));
    const ims = [mk(mainGeo, mainMats), mk(lionGeo, lions), mk(topGeo, tops)];
    return { mainJets, landings, ims, geos: [mainGeo, lionGeo, topGeo], jetFlow, curtainFlow, curtainTopFlow, curtTop: curtain(0.6, 0.68, 2.3, 0.66), curtMid: curtain(1.04, 1.2, 1.64, 1.2) };
  }, [tex]);
  useEffect(
    () => () => {
      [...J.geos, J.curtTop, J.curtMid].forEach((g) => g.dispose());
      J.jetFlow.dispose();
      J.curtainFlow.dispose();
      J.curtainTopFlow.dispose();
    },
    [J],
  );
  const mist = useMemo(() => mistMat(sun, tex.noise), [sun, tex]);
  useEffect(() => () => mist.dispose(), [mist]);

  // ── giọt + bọt quanh chân + vết chân ──
  const drops = useMemo(() => new Droplets(), []);
  const dMat = useMemo(() => dropMat(), []);
  useEffect(
    () => () => {
      drops.geo.dispose();
      dMat.dispose();
    },
    [drops, dMat],
  );
  const foam = useRef<THREE.Mesh>(null);
  const foamMat = useMemo(
    () =>
      new THREE.ShaderMaterial({
        uniforms: { uT: WIND.t, uK: { value: 0 }, uNoise: { value: tex.noise } },
        vertexShader: "varying vec2 vUv; void main(){ vUv = uv; gl_Position = projectionMatrix * modelViewMatrix * vec4(position,1.0); }",
        fragmentShader: /* glsl */ `uniform float uT; uniform float uK; uniform sampler2D uNoise; varying vec2 vUv;
          void main(){
            vec2 p = vUv * 2.0 - 1.0; float r = length(p);
            float n = texture2D(uNoise, vUv * 0.6 + vec2(uT * 0.05, -uT * 0.04)).a;
            float ring = smoothstep(0.5, 0.6, r + (n - 0.5) * 0.18) * smoothstep(0.86, 0.72, r + (n - 0.5) * 0.22);
            float f = ring * mix(0.45, 0.8, smoothstep(0.4, 0.65, n)) * uK;
            if (f < 0.03) discard;
            gl_FragColor = vec4(vec3(0.92, 0.98, 1.0), f);
          }`,
        transparent: true,
        depthWrite: false,
      }),
    [tex],
  );
  useEffect(() => () => foamMat.dispose(), [foamMat]);
  const prints = useMemo(() => {
    const m = new THREE.InstancedMesh(new THREE.CircleGeometry(0.11, 10).scale(1, 1.7, 1), new THREE.MeshBasicMaterial({ color: "#6a7886", transparent: true, opacity: 0.3, depthWrite: false, polygonOffset: true, polygonOffsetFactor: -3 }), MAXF);
    m.count = 0;
    m.frustumCulled = false;
    m.layers.set(LAYER_NO_REFLECT);
    return m;
  }, []);
  useEffect(
    () => () => {
      prints.geometry.dispose();
      (prints.material as THREE.Material).dispose();
    },
    [prints],
  );

  const st = useRef({
    inWater: false,
    wetUntil: 0,
    nextStep: 0,
    lastJet: 0,
    jetK: 0,
    lastPrint: new THREE.Vector3(),
    printK: 0,
    printAt: new Float32Array(MAXF),
    side: 1,
    lastY: 0,
    vy: 0,
    prev: new THREE.Vector3(),
    dropAcc: 0,
    ringK: 0,
    wakeAt: new THREE.Vector3(),
    swing: -1e9,
    swingDir: 1,
    tip: new THREE.Vector3(),
    tipLive: false,
  });
  const uvOf = (x: number, z: number): [number, number] => [0.5 + x / (2 * POOL.r), 0.5 - z / (2 * POOL.r)];
  const UVR = 1 / (2 * POOL.r);
  /** vòng gợn giải tích (8 ô xoay vòng): tâm (x, z), độ mạnh k (≈1 bước chân, ≈1,3–1,8 cú đáp) */
  const addRing = (x: number, z: number, k: number) => {
    const rings = (water.material as THREE.ShaderMaterial).uniforms.uRings.value as THREE.Vector4[];
    rings[st.current.ringK++ % rings.length].set(x, z, WIND.t.value, k);
  };
  /** dấu bọt tại (x, z) bán kính r m (r < 0: vành bán kính |r|), lượng k */
  const foamAt = (x: number, z: number, r: number, k: number) => {
    const [u, v] = uvOf(x, z);
    foamSim.stamp(u, v, r * UVR, k);
  };
  const tmp = useMemo(() => new THREE.Vector3(), []);
  useFrame((state, dt) => {
    tickWind(state.clock.elapsedTime);
    const S = st.current;
    const now = performance.now();
    // tia chính rơi xuống hồ: sóng + vài giọt văng; giọt tách khỏi tia (~8 / s / tia)
    if (now - S.lastJet > 60) {
      S.lastJet = now;
      const L = J.landings[S.jetK++ % J.landings.length];
      const [u, v] = uvOf(L.x + (Math.random() - 0.5) * 0.25, L.z + (Math.random() - 0.5) * 0.25);
      sim.drop(u, v, 0.022, -0.018);
      if (S.jetK % 3 === 0) foamSim.stamp(u, v, 0.2 * UVR, 0.3);
      if (vfx > 0) drops.burst(L.x, POOL.water, L.z, 2, 1.4, 0.7, 0.015, 0.035, 0.1);
    }
    S.dropAcc += dt * 8 * J.mainJets.length * (vfx === 0 ? 0.4 : 1);
    while (S.dropAcc > 1) {
      S.dropAcc--;
      const j = J.mainJets[Math.floor(Math.random() * J.mainJets.length)];
      const t = Math.random() * j.T * 0.9;
      jetAt(j, t, tmp);
      drops.emit(tmp.x, tmp.y, tmp.z, j.v.x + (Math.random() - 0.5) * 0.6, j.v.y - G * t + (Math.random() - 0.5) * 0.6, j.v.z + (Math.random() - 0.5) * 0.6, j.T - t, 0.012 + Math.random() * 0.015);
    }
    // người chơi trong hồ
    const w = useWorld.getState();
    const p = w.player;
    const r = Math.hypot(p.x, p.z);
    const inWater = r < POOL.r - 0.05 && r > POOL.monument && p.y < POOL.water + 0.15;
    const moved = Math.hypot(p.x - S.prev.x, p.z - S.prev.z) / Math.max(dt, 1e-3);
    S.prev.copy(p);
    const vyNow = (S.lastY - p.y) / Math.max(dt, 1e-3);
    if (inWater && !S.inWater) {
      // vận tốc chạm nước (m/s) → độ mạnh s; lội từ bậc thềm (chậm) chỉ gợn + bọt, không vương miện
      const vImp = Math.max(vyNow, S.vy, -motion.vy, 0);
      const s = splashStrength(vImp);
      const [u, v] = uvOf(p.x, p.z);
      sim.drop(u, v, 0.05 + 0.03 * s, -0.12 - 0.18 * s);
      addRing(p.x, p.z, 1.3 + 0.5 * s);
      foamAt(p.x, p.z, 0.35 + 0.25 * s, 0.9);
      foamAt(p.x, p.z, -(0.7 + 0.4 * s), 0.6);
      if (vImp > 1.2) {
        const fx = p.x - S.prev.x;
        const fz = p.z - S.prev.z;
        const fl = Math.hypot(fx, fz) || 1;
        splash.land(p.x, p.z, s, fx / fl, fz / fl);
        // giọt: 30 + 58 s, đỉnh 0,25–0,9 m → vy 2,2–4,2 m/s
        drops.burst(p.x, POOL.water + 0.05, p.z, Math.round(30 + 58 * s), 2.6 + 1.6 * s, 1.2 + 1.2 * s, 0.03, 0.08, 0.3 + 0.2 * s);
      }
      sfx.step();
    }
    S.inWater = inWater;
    S.vy = vyNow;
    S.lastY = p.y;
    motion.wade = inWater ? 0.62 : 1;
    const swingAt = useCombat.getState().swingAt;
    const newSwing = swingAt !== S.swing && now - swingAt < 200;
    S.swing = swingAt;
    if (inWater) {
      S.wetUntil = now + 20000;
      const yaw = w.playerYaw;
      // nhịp chạm chân: đi ~2,2 / s, chạy ~3,3 / s (Codex) → vòng gợn + sóng + giọt
      if (moved > 0.4 && now > S.nextStep) {
        const run = w.input.run || moved > 3.2;
        S.nextStep = now + (run ? 300 : 450);
        S.side = -S.side;
        const fx = p.x + Math.cos(yaw) * 0.1 * S.side;
        const fz = p.z - Math.sin(yaw) * 0.1 * S.side;
        const [u, v] = uvOf(fx, fz);
        sim.drop(u, v, 0.03, -0.05 - Math.min(0.05, moved * 0.012));
        addRing(fx, fz, run ? 1.0 : 0.75);
        const n = run ? 10 + Math.floor(Math.random() * 9) : 5 + Math.floor(Math.random() * 5);
        const ax = Math.sin(yaw) * moved * 0.35;
        const az = Math.cos(yaw) * moved * 0.35;
        for (let i = 0; i < n; i++) {
          const size = i % 3 === 0 ? 0.05 + Math.random() * 0.03 : 0.022 + Math.random() * 0.02;
          drops.emit(fx + (Math.random() - 0.5) * 0.3, POOL.water + 0.03, fz + (Math.random() - 0.5) * 0.3, (Math.random() - 0.5) * 1.4 + ax, 1.0 + Math.random() * (run ? 2.2 : 1.4), (Math.random() - 0.5) * 1.4 + az, 0.7, size);
        }
      }
      // vệt bọt theo QUÃNG ĐƯỜNG (mỗi 0,22 m): dấu ở chân + hai dấu lệch sau lưng (mầm wake chữ V)
      const dw = Math.hypot(p.x - S.wakeAt.x, p.z - S.wakeAt.z);
      if (dw > 0.22) {
        const ux = (p.x - S.wakeAt.x) / dw;
        const uz = (p.z - S.wakeAt.z) / dw;
        foamAt(p.x, p.z, 0.2, 0.45);
        foamAt(p.x - ux * 0.35 - uz * 0.24, p.z - uz * 0.35 + ux * 0.24, 0.13, 0.3);
        foamAt(p.x - ux * 0.35 + uz * 0.24, p.z - uz * 0.35 - ux * 0.24, 0.13, 0.3);
        S.wakeAt.copy(p);
      }
      // đánh trong nước: màn nước theo cung chém + vòng gợn + giọt văng theo tiếp tuyến cung
      if (newSwing) {
        S.swingDir = -S.swingDir;
        splash.slash(p.x, p.z, yaw, S.swingDir, 0.7);
        const cx = p.x + Math.sin(yaw) * 0.95;
        const cz = p.z + Math.cos(yaw) * 0.95;
        addRing(cx, cz, 1.2);
        const [u, v] = uvOf(cx, cz);
        sim.drop(u, v, 0.045, -0.12);
        for (let k = -2; k <= 2; k++) {
          const a = yaw + k * 0.32;
          foamAt(p.x + Math.sin(a) * 0.95, p.z + Math.cos(a) * 0.95, 0.18, 0.55);
        }
        for (let i = 0; i < 22; i++) {
          const a = yaw + (Math.random() - 0.5) * 1.6;
          const r0 = 0.8 + Math.random() * 0.3;
          const tx = Math.cos(a) * S.swingDir;
          const tz = -Math.sin(a) * S.swingDir;
          drops.emit(p.x + Math.sin(a) * r0, POOL.water + 0.1, p.z + Math.cos(a) * r0, tx * 1.6 + Math.sin(a) * 0.8, 1.8 + Math.random() * 2.2, tz * 1.6 + Math.cos(a) * 0.8, 0.9, i % 3 === 0 ? 0.06 : 0.03);
        }
      }
      // mũi kiếm quét qua mặt nước: bọt + giọt dọc đường quét (mỗi 0,15 m)
      const tip = TRAIL_TIP.pos;
      const tipIn = TRAIL_TIP.live && tip.y < POOL.water + 0.12 && Math.hypot(tip.x, tip.z) < POOL.r;
      if (tipIn && S.tipLive && S.tip.distanceTo(tip) > 0.15) {
        foamAt(tip.x, tip.z, 0.14, 0.5);
        drops.burst(tip.x, POOL.water + 0.04, tip.z, 3, 2.0, 0.8, 0.025, 0.05, 0.05);
        S.tip.copy(tip);
      } else if (!tipIn || !S.tipLive) S.tip.copy(tip);
      S.tipLive = TRAIL_TIP.live;
    } else S.wakeAt.copy(p);
    if (foam.current) {
      foam.current.visible = inWater;
      foam.current.position.set(p.x, POOL.water + 0.012, p.z);
      const target = inWater ? 0.55 + Math.min(1, moved / 3) * 0.45 : 0;
      foamMat.uniforms.uK.value += (target - foamMat.uniforms.uK.value) * Math.min(1, dt * 6);
      foam.current.scale.setScalar(1 + Math.min(1, moved / 3) * 0.6);
    }
    // ướt sau khi lên bờ: nhỏ giọt + vết chân
    const wet = !inWater && now < S.wetUntil;
    if (wet) {
      const k = (S.wetUntil - now) / 20000;
      if (Math.random() < dt * 16 * k) drops.emit(p.x + (Math.random() - 0.5) * 0.3, p.y + 0.3 + Math.random() * 0.9, p.z + (Math.random() - 0.5) * 0.3, 0, -0.2, 0, 1.2, 0.012);
      if (motion.grounded && k > 0.55 && Math.hypot(p.x - S.lastPrint.x, p.z - S.lastPrint.z) > 0.62 && p.y > 0.01) {
        const yaw = w.playerYaw;
        S.side = -S.side;
        const m4 = new THREE.Matrix4().makeRotationX(-Math.PI / 2).premultiply(new THREE.Matrix4().makeRotationY(yaw)).setPosition(p.x + Math.cos(yaw) * 0.11 * S.side, p.y + 0.012, p.z - Math.sin(yaw) * 0.11 * S.side);
        const i = S.printK++ % MAXF;
        prints.setMatrixAt(i, m4);
        S.printAt[i] = now;
        prints.count = Math.min(MAXF, S.printK);
        S.lastPrint.copy(p);
      }
    } else S.lastPrint.copy(p);
    if (prints.count) {
      const m4 = new THREE.Matrix4();
      const pos = new THREE.Vector3();
      const q = new THREE.Quaternion();
      const sc = new THREE.Vector3();
      for (let i = 0; i < prints.count; i++) {
        prints.getMatrixAt(i, m4);
        m4.decompose(pos, q, sc);
        const s = Math.max(0.001, 1 - (now - S.printAt[i]) / 9000);
        prints.setMatrixAt(i, m4.compose(pos, q, sc.set(s, s, s)));
      }
      prints.instanceMatrix.needsUpdate = true;
    }
    drops.step(dt, (x, z) => (Math.hypot(x, z) < POOL.r ? POOL.water : 0));
    sim.step(gl, dt);
    foamSim.step(gl, dt, sim.texture);
    const wu = (water.material as THREE.ShaderMaterial).uniforms;
    wu.tHeight.value = sim.texture;
    wu.uFoamTex.value = foamSim.texture;
  });

  return (
    <>
      <primitive object={water} name="perf:water" />
      <mesh ref={L1} rotation-x={-Math.PI / 2} position={[0, POOL.floor + 0.012, 0]} material={caustics} renderOrder={1}>
        <circleGeometry args={[POOL.r, 64]} />
      </mesh>
      <group name="perf:jets">
        {J.ims.map((im, i) => (
          <primitive key={i} object={im} />
        ))}
      </group>
      <points ref={L1} geometry={drops.geo} material={dMat} frustumCulled={false} />
      <primitive object={splash.group} name="perf:splash" />
      <mesh
        ref={(o: THREE.Mesh | null) => {
          foam.current = o;
          L1(o);
        }}
        rotation-x={-Math.PI / 2}
        material={foamMat}
        visible={false}
      >
        <planeGeometry args={[0.95, 0.95]} />
      </mesh>
      <primitive object={prints} />
      <mesh ref={L1} position={[0, POOL.water + 1.9, 0]} material={mist}>
        <cylinderGeometry args={[4.4, 5.2, 3.8, 48, 1, true]} />
      </mesh>
      {FOUNTAINS.map((f, i) => (
        <group key={i} position={[f.x, 0, f.z]}>
          <mesh ref={L1} rotation-x={-Math.PI / 2} position={[0, 0.42, 0]} material={basinMat}>
            <circleGeometry args={[1.49, 32]} />
          </mesh>
          <mesh ref={L1} rotation-x={-Math.PI / 2} position={[0, 0.135, 0]} material={basinCaustics}>
            <circleGeometry args={[1.48, 32]} />
          </mesh>
          <mesh ref={L1} geometry={J.curtTop} material={J.curtainTopFlow} />
          <mesh ref={L1} geometry={J.curtMid} material={J.curtainFlow} />
        </group>
      ))}
    </>
  );
}
