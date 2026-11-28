"use client";
/**
 * Quảng trường theo GIỜ THẬT (nghiên cứu Codex 2026-11; lib/world/sunClock.ts + lib/world/dayCycle.ts):
 *  • HubDayCycle: mặt trời / trăng theo giờ Việt Nam, bảng màu 9 mốc giờ → trời, đèn chính, ánh trời, ánh nướng (nhuộm + mức),
 *    môi trường phản xạ, cỏ, tán lá, nước (qua DAY dùng chung). GI nướng giữ nguyên (phương án A — rẻ cho điện thoại).
 *  • LampGlow: 26 đèn đường tự sáng khi mặt trời < −2°: kính đèn phát sáng HDR (bloom) + vệt sáng giả trên sàn + quầng sáng
 *    → 2 draw instanced, 0 đèn động.
 *  • Campfire: lửa thủ tục (2 tấm chéo, nhiễu cuộn, ramp đỏ → vàng → lõi HDR) + tia lửa + khói (GPU, không CPU) + ánh lửa nhấp nháy.
 * Thử giờ khác (bản dev): window.__hour = 20.5
 */
import { useEffect, useMemo, useRef } from "react";
import { useFrame, useThree } from "@react-three/fiber";
import * as THREE from "three";
import { CAMPFIRE, PROPS } from "@/lib/world/hubLayout";
import { moonPosition, sunPosition } from "@/lib/world/sunClock";
import { fireFlicker, lampFactor, localHour, sampleDay } from "@/lib/world/dayCycle";
import { DAY } from "../fx/dayState";
import type { BakedUniforms } from "../fx/baked";
import { noiseTex } from "../fx/proceduralTex";
import { LAYER_NO_REFLECT } from "./HubWater";

const MOON_COL = new THREE.Color("#9fb4ff");
const TMP = new THREE.Color();
const TMP2 = new THREE.Color();
const DAY_TINT = new THREE.Color(1.03, 0.99, 0.95);
const WARM = new THREE.Color();

/** ngày hiện tại hoặc giờ thử (window.__hour) */
function nowDate(): Date {
  const o = typeof window !== "undefined" ? (window as unknown as { __hour?: number }).__hour : undefined;
  const d = new Date();
  if (typeof o !== "number") return d;
  const base = Date.UTC(d.getUTCFullYear(), d.getUTCMonth(), d.getUTCDate(), 0, 0, 0);
  return new Date(base + (o - 7) * 3600e3);
}

export function HubDayCycle({ U, lampMats, warm = false }: { U: BakedUniforms; lampMats: { mat: THREE.MeshBasicMaterial; base: THREE.Color }[]; warm?: boolean }) {
  const { scene } = useThree();
  const lights = useRef<{ key: THREE.DirectionalLight | null; hemi: THREE.HemisphereLight | null }>({ key: null, hemi: null });
  const acc = useRef(1);
  useEffect(() => {
    DAY.active = true;
    return () => {
      DAY.active = false;
    };
  }, []);
  useFrame((_, dt) => {
    // 4 lần / giây là đủ (giờ thật đổi chậm); lần đầu chạy ngay
    acc.current += dt;
    if (acc.current < 0.25) return;
    acc.current = 0;
    const L = lights.current;
    if (!L.key || !L.key.parent) L.key = scene.getObjectByName("sunKey") as THREE.DirectionalLight | null;
    if (!L.hemi || !L.hemi.parent) L.hemi = scene.getObjectByName("hemi") as THREE.HemisphereLight | null;
    const date = nowDate();
    const sp = sunPosition(date);
    const mp = moonPosition(date);
    const s = sampleDay(localHour(date));
    // nắng tắt êm khi mặt trời sát chân trời (bảng màu tính cho xuân phân — giờ mọc / lặn thật lệch theo mùa)
    const sunK = s.sunK * Math.min(1, Math.max(0, (sp.elevation + 1) / 6));
    const night = lampFactor(sp.elevation);
    DAY.sun.value.set(...sp.dir);
    DAY.moon.value.set(...mp.dir);
    DAY.sunK.value = sunK;
    DAY.night.value = night;
    // nguồn tô khối: mặt trời (cao độ tối thiểu 6° để không quét sát mặt sân) hoặc trăng
    const useSun = sunK > 0.04;
    const src = useSun ? sp : mp;
    const el = Math.max(6, src.elevation) * (Math.PI / 180);
    const az = src.azimuth * (Math.PI / 180);
    DAY.light.value.set(Math.cos(el) * Math.sin(az), Math.sin(el), -Math.cos(el) * Math.cos(az));
    const K = useSun ? sunK : 0.22;
    TMP.setRGB(...s.sun, THREE.SRGBColorSpace);
    const col = useSun ? TMP : MOON_COL;
    DAY.lightCol.value.copy(col);
    // ánh nướng: mức theo ánh trời + nắng; nhuộm từ ánh trời (đêm lam) → nắng (ngày ấm)
    // hoàng hôn / bình minh (mặt trời −9°…+5°): "giờ vàng" — ánh chân trời cam hồng còn hắt lên sân, không tụt xám bùn
    const twi = Math.max(0, 1 - Math.abs(sp.elevation + 2) / 7) * (1 - Math.min(1, sunK * 2.5));
    const scale = Math.min(1, Math.max(0.2 + 0.25 * twi, (0.3 * s.ambK) / 0.48 + 0.7 * sunK));
    DAY.level.value = scale;
    U.uExposure.value = 1.08 * scale;
    TMP2.setRGB(...s.amb, THREE.SRGBColorSpace);
    const ambN = TMP2.clone().multiplyScalar(1 / Math.max(TMP2.r, TMP2.g, TMP2.b, 1e-3));
    U.uTint.value.copy(ambN).lerp(DAY_TINT.clone().multiply(TMP.clone().multiplyScalar(1 / Math.max(TMP.r, TMP.g, TMP.b, 1e-3))), sunK);
    if (twi > 0) {
      TMP2.setRGB(...s.hor, THREE.SRGBColorSpace);
      U.uTint.value.lerp(TMP2.multiplyScalar(1 / Math.max(TMP2.r, TMP2.g, TMP2.b, 1e-3)), 0.75 * twi);
    }
    if (warm) {
      // Quảng trường kiểu Genshin: nhuộm GI nướng bớt rực một nửa + ngả kem ấm — đá trắng / sa thạch đọc là đá dưới nắng,
      // không lăng tím hồng lúc hoàng hôn (đêm vẫn lam theo ánh trời)
      const t = U.uTint.value;
      const g = (t.r + t.g + t.b) / 3;
      const k = 1 - night;
      t.setRGB(g + (t.r - g) * 0.55, g + (t.g - g) * 0.55, g + (t.b - g) * 0.55);
      WARM.setRGB(t.r * 1.05, t.g, t.b * 0.9);
      t.lerp(WARM, k);
    }
    scene.environmentIntensity = 0.9 * (0.3 + 0.7 * scale);
    // trời
    DAY.zen.value.setRGB(...s.zen, THREE.SRGBColorSpace);
    DAY.hor.value.setRGB(...s.hor, THREE.SRGBColorSpace);
    // cỏ
    DAY.grassAmb.value.copy(ambN).multiplyScalar(0.6 * Math.max(0.25, s.ambK / 0.48));
    if (twi > 0) DAY.grassAmb.value.lerp(TMP2.multiplyScalar(0.6 * Math.max(0.25, s.ambK / 0.48)), 0.3 * twi);
    DAY.grassSun.value.copy(col).multiplyScalar(0.78 * K);
    // đèn cảnh
    if (L.key) {
      L.key.intensity = 2.6 * K;
      L.key.color.copy(col);
      L.key.position.copy(DAY.light.value).multiplyScalar(40);
    }
    if (L.hemi) {
      L.hemi.intensity = 1.05 * Math.max(0.3, s.ambK / 0.48);
      L.hemi.color.setRGB(...s.amb, THREE.SRGBColorSpace);
    }
    // kính đèn đường: HDR khi đêm (bloom), dịu ban ngày
    for (const l of lampMats) l.mat.color.copy(l.base).multiplyScalar(0.55 + 3.6 * night);
  });
  return null;
}

// ───────────── Đèn đường: vệt sáng trên sàn + quầng sáng (instanced) ─────────────
const LAMPS = PROPS.filter((p) => p.kind === "lamp");
const LAMP_Y = 3.2;
export function LampGlow() {
  const { pool, halo } = useMemo(() => {
    const night = DAY.night;
    const pool = new THREE.InstancedMesh(
      new THREE.PlaneGeometry(1, 1).rotateX(-Math.PI / 2),
      new THREE.ShaderMaterial({
        uniforms: { uNight: night, uCol: { value: new THREE.Color("#FFD19A") } },
        vertexShader: "varying vec2 vUv; void main(){ vUv = uv; gl_Position = projectionMatrix * viewMatrix * modelMatrix * instanceMatrix * vec4(position, 1.0); }",
        fragmentShader: /* glsl */ `uniform float uNight; uniform vec3 uCol; varying vec2 vUv;
          void main(){
            float r = length(vUv - 0.5) * 2.0;
            float f = pow(max(0.0, 1.0 - r * r), 2.0) * 0.36 * uNight;
            if (f < 0.002) discard;
            gl_FragColor = vec4(uCol * f, 1.0);
          }`,
        transparent: true,
        depthWrite: false,
        blending: THREE.AdditiveBlending,
        toneMapped: false,
      }),
      LAMPS.length,
    );
    const halo = new THREE.InstancedMesh(
      new THREE.PlaneGeometry(1, 1),
      new THREE.ShaderMaterial({
        uniforms: { uNight: night, uCol: { value: new THREE.Color("#FFD19A") } },
        // billboard: hướng tấm theo camera
        vertexShader: /* glsl */ `varying vec2 vUv; varying float vFade;
          void main(){
            vUv = uv;
            vec3 c = (modelMatrix * instanceMatrix * vec4(0.0, 0.0, 0.0, 1.0)).xyz;
            vec3 right = vec3(viewMatrix[0][0], viewMatrix[1][0], viewMatrix[2][0]);
            vec3 up = vec3(viewMatrix[0][1], viewMatrix[1][1], viewMatrix[2][1]);
            vec3 w = c + (right * position.x + up * position.y) * 1.4;
            vFade = 1.0 - smoothstep(18.0, 30.0, distance(cameraPosition, c));
            gl_Position = projectionMatrix * viewMatrix * vec4(w, 1.0);
          }`,
        fragmentShader: /* glsl */ `uniform float uNight; uniform vec3 uCol; varying vec2 vUv; varying float vFade;
          void main(){
            float r = length(vUv - 0.5) * 2.0;
            float f = exp(-r * r * 5.0) * 0.16 * uNight * (0.4 + 0.6 * vFade);
            if (f < 0.002) discard;
            gl_FragColor = vec4(uCol * f, 1.0);
          }`,
        transparent: true,
        depthWrite: false,
        blending: THREE.AdditiveBlending,
        toneMapped: false,
      }),
      LAMPS.length,
    );
    const m4 = new THREE.Matrix4();
    LAMPS.forEach((l, i) => {
      pool.setMatrixAt(i, m4.makeScale(6, 1, 6).setPosition(l.x, 0.025, l.z));
      halo.setMatrixAt(i, m4.makeTranslation(l.x, LAMP_Y, l.z));
    });
    for (const im of [pool, halo]) {
      im.frustumCulled = false;
      im.layers.set(LAYER_NO_REFLECT);
    }
    return { pool, halo };
  }, []);
  useEffect(
    () => () => {
      for (const im of [pool, halo]) {
        im.geometry.dispose();
        (im.material as THREE.Material).dispose();
      }
    },
    [pool, halo],
  );
  return (
    <group name="perf:lamps">
      <primitive object={pool} />
      <primitive object={halo} />
    </group>
  );
}

// ───────────── Lửa trại ─────────────
const FLAME_FS = /* glsl */ `
  uniform sampler2D uNoise; uniform float uT; uniform float uFlick;
  varying vec2 vUv;
  void main(){
    vec2 uv = vUv;
    float y = uv.y;
    float n = texture2D(uNoise, uv * vec2(1.6, 1.0) - vec2(0.0, 0.85 * uT)).r;
    float detail = texture2D(uNoise, uv * 3.5 - vec2(0.0, 2.1 * uT)).g;
    float width = mix(0.43, 0.025, pow(y, 0.8));
    float x = abs(uv.x - 0.5 - 0.23 * (n - 0.5) * y);
    float edge = width - x + 0.14 * (detail - 0.5);
    float alpha = smoothstep(-0.025, 0.045, edge) * (1.0 - smoothstep(0.83, 1.0, y));
    float core = smoothstep(0.04, 0.32, edge) * (1.0 - 0.6 * y);
    vec3 col = mix(vec3(2.2, 0.2, 0.025), vec3(4.0, 2.1, 0.45), core) * uFlick;
    if (alpha < 0.02) discard;
    gl_FragColor = vec4(col, alpha);
  }`;

export function Campfire() {
  const tex = useMemo(() => noiseTex(), []);
  const U = useMemo(() => ({ uT: { value: 0 }, uFlick: { value: 1 }, uNoise: { value: tex }, uNight: DAY.night }), [tex]);
  const mats = useMemo(() => {
    const flame = new THREE.ShaderMaterial({
      uniforms: U,
      vertexShader: "varying vec2 vUv; void main(){ vUv = uv; gl_Position = projectionMatrix * modelViewMatrix * vec4(position, 1.0); }",
      fragmentShader: FLAME_FS,
      transparent: true,
      depthWrite: false,
      side: THREE.DoubleSide,
      toneMapped: false,
    });
    // tia lửa: 22 hạt, vòng đời 0,4–1,2 s, bay lên 0,6–1,6 m/s, lệch ngang theo nhiễu (toàn bộ trong shader)
    const sparks = new THREE.ShaderMaterial({
      uniforms: U,
      vertexShader: /* glsl */ `attribute float aSeed; uniform float uT; varying float vA;
        void main(){
          float life = 0.4 + fract(aSeed * 7.31) * 0.8;
          float age = fract(uT / life + aSeed);
          float up = 0.6 + fract(aSeed * 3.7) * 1.0;
          vec3 p = vec3(sin(aSeed * 40.0 + uT * 2.0) * 0.25 * age, 0.35 + age * up * life, cos(aSeed * 23.0 + uT * 1.7) * 0.25 * age);
          vA = (1.0 - age) * smoothstep(0.0, 0.08, age);
          vec4 mv = modelViewMatrix * vec4(p, 1.0);
          gl_PointSize = (2.0 + fract(aSeed * 11.0) * 3.0) * 60.0 / -mv.z;
          gl_Position = projectionMatrix * mv;
        }`,
      fragmentShader: /* glsl */ `varying float vA; void main(){ vec2 q = gl_PointCoord * 2.0 - 1.0; float d = dot(q, q); if (d > 1.0) discard; gl_FragColor = vec4(vec3(3.5, 1.6, 0.4) * vA * (1.0 - d), 1.0); }`,
      transparent: true,
      depthWrite: false,
      blending: THREE.AdditiveBlending,
      toneMapped: false,
    });
    // khói: 10 tấm mềm, sống 2,5 s, nở 0,25 → 0,9 m, xám ấm → xám tím, alpha đỉnh 0,22
    const smoke = new THREE.ShaderMaterial({
      uniforms: U,
      vertexShader: /* glsl */ `attribute float aSeed; uniform float uT; varying vec2 vUv; varying float vAge; varying float vSeed;
        void main(){
          vUv = uv; vSeed = aSeed;
          float age = fract(uT / 2.5 + aSeed);
          vAge = age;
          vec3 c = vec3(sin(aSeed * 17.0) * 0.12 + age * 0.35, 0.9 + age * 1.6, cos(aSeed * 9.0) * 0.12 + age * 0.12);
          float size = mix(0.25, 0.9, age);
          vec3 right = vec3(viewMatrix[0][0], viewMatrix[1][0], viewMatrix[2][0]);
          vec3 up = vec3(viewMatrix[0][1], viewMatrix[1][1], viewMatrix[2][1]);
          vec3 w = (modelMatrix * vec4(c, 1.0)).xyz + (right * position.x + up * position.y) * size;
          gl_Position = projectionMatrix * viewMatrix * vec4(w, 1.0);
        }`,
      fragmentShader: /* glsl */ `uniform sampler2D uNoise; uniform float uT; uniform float uNight; varying vec2 vUv; varying float vAge; varying float vSeed;
        void main(){
          float r = length(vUv - 0.5) * 2.0;
          float n = texture2D(uNoise, vUv * 0.7 + vec2(vSeed, uT * 0.05)).b;
          float shape = smoothstep(1.0, 0.3, r + (n - 0.5) * 0.6);
          float life = smoothstep(0.0, 0.15, vAge) * (1.0 - smoothstep(0.45, 1.0, vAge));
          float a = 0.22 * shape * life;
          if (a < 0.004) discard;
          vec3 col = mix(vec3(0.68, 0.55, 0.47), vec3(0.38, 0.42, 0.53), vAge) * mix(1.0, 0.45, uNight);
          gl_FragColor = vec4(col, a);
          #include <colorspace_fragment>
        }`,
      transparent: true,
      depthWrite: false,
    });
    // ánh lửa trên sàn: vệt cộng sáng nhấp nháy (mạnh hơn về đêm)
    const glow = new THREE.ShaderMaterial({
      uniforms: U,
      vertexShader: "varying vec2 vUv; void main(){ vUv = uv; gl_Position = projectionMatrix * modelViewMatrix * vec4(position, 1.0); }",
      fragmentShader: /* glsl */ `uniform float uFlick; uniform float uNight; varying vec2 vUv;
        void main(){ float r = length(vUv - 0.5) * 2.0; float f = pow(max(0.0, 1.0 - r * r), 2.0) * (0.08 + 0.3 * uNight) * uFlick;
          if (f < 0.002) discard; gl_FragColor = vec4(vec3(1.0, 0.55, 0.22) * f, 1.0); }`,
      transparent: true,
      depthWrite: false,
      blending: THREE.AdditiveBlending,
      toneMapped: false,
    });
    const stone = new THREE.MeshStandardMaterial({ color: "#8a8079", roughness: 0.85 });
    const log = new THREE.MeshStandardMaterial({ color: "#5a3a26", roughness: 0.9 });
    const ember = new THREE.MeshBasicMaterial({ color: new THREE.Color(2.4, 0.6, 0.15), toneMapped: false });
    return { flame, sparks, smoke, glow, stone, log, ember };
  }, [U]);
  const geos = useMemo(() => {
    const seeds = (n: number) => {
      const g = new THREE.BufferGeometry();
      g.setAttribute("position", new THREE.Float32BufferAttribute(new Float32Array(n * 3), 3));
      g.setAttribute("aSeed", new THREE.Float32BufferAttribute(Array.from({ length: n }, (_, i) => (i * 0.618034) % 1), 1));
      return g;
    };
    const smokeG = new THREE.InstancedBufferGeometry();
    const q = new THREE.PlaneGeometry(1, 1);
    smokeG.setIndex(q.index);
    smokeG.setAttribute("position", q.attributes.position);
    smokeG.setAttribute("uv", q.attributes.uv);
    smokeG.setAttribute("aSeed", new THREE.InstancedBufferAttribute(new Float32Array(Array.from({ length: 10 }, (_, i) => i / 10)), 1));
    smokeG.instanceCount = 10;
    return { sparks: seeds(22), smoke: smokeG, flame: new THREE.PlaneGeometry(0.9, 1.1).translate(0, 0.55 + 0.15, 0) };
  }, []);
  useEffect(
    () => () => {
      Object.values(mats).forEach((m) => m.dispose());
      Object.values(geos).forEach((g) => g.dispose());
    },
    [mats, geos],
  );
  useFrame((state) => {
    const t = state.clock.elapsedTime;
    U.uT.value = t;
    U.uFlick.value = fireFlicker(t);
  });
  // đá kê + củi: 2 lệnh vẽ instanced (thay 12 mesh riêng)
  const ring = useMemo(() => {
    const m4 = new THREE.Matrix4();
    const q = new THREE.Quaternion();
    const st = new THREE.InstancedMesh(new THREE.DodecahedronGeometry(0.2, 0), mats.stone, 9);
    for (let i = 0; i < 9; i++) {
      const a = (i / 9) * Math.PI * 2;
      const k = 0.85 + (i % 3) * 0.15;
      st.setMatrixAt(i, m4.compose(new THREE.Vector3(Math.cos(a) * 0.62, 0.1, Math.sin(a) * 0.62), q.setFromEuler(new THREE.Euler(a, a * 1.7, 0)), new THREE.Vector3(k, k * 0.8, k)));
    }
    const lg = new THREE.InstancedMesh(new THREE.CylinderGeometry(0.07, 0.08, 0.95, 7), mats.log, 3);
    for (let k = 0; k < 3; k++) lg.setMatrixAt(k, m4.compose(new THREE.Vector3(0, 0.16, 0), q.setFromEuler(new THREE.Euler(0, (k * Math.PI) / 3, 0.35, "YXZ")), new THREE.Vector3(1, 1, 1)));
    return { st, lg };
  }, [mats]);
  useEffect(
    () => () => {
      ring.st.geometry.dispose();
      ring.lg.geometry.dispose();
    },
    [ring],
  );
  return (
    <group position={[CAMPFIRE.x, 0, CAMPFIRE.z]} name="perf:campfire">
      <primitive object={ring.st} />
      <primitive object={ring.lg} />
      <mesh position={[0, 0.08, 0]} material={mats.ember}>
        <sphereGeometry args={[0.2, 10, 6, 0, Math.PI * 2, 0, Math.PI / 2]} />
      </mesh>
      {/* lửa: 2 tấm chéo 90° */}
      <mesh geometry={geos.flame} material={mats.flame} />
      <mesh geometry={geos.flame} material={mats.flame} rotation-y={Math.PI / 2} />
      <points geometry={geos.sparks} material={mats.sparks} frustumCulled={false} />
      <mesh geometry={geos.smoke} material={mats.smoke} frustumCulled={false} />
      <mesh rotation-x={-Math.PI / 2} position={[0, 0.03, 0]} material={mats.glow}>
        <planeGeometry args={[5.4, 5.4]} />
      </mesh>
    </group>
  );
}
