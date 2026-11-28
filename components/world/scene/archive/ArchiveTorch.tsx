"use client";
/**
 * Đèn pin của người chơi trong Thư khố — nguồn sáng "nhân vật chính" của cảnh kinh dị:
 *  • SpotLight vật lý (candela, suy giảm bình phương) + cookie kính đèn (lõi nóng, vành, vệt bẩn) + bóng PCF mềm;
 *  • nhắm theo máy quay (hơi chúc xuống như cầm đèn soi đường), lắc nhẹ theo bước chân, thỉnh thoảng chập pin;
 *  • chùm sáng thể tích giả: nón cộng màu, sáng ở trục / mờ ở mép (fresnel), tắt dần theo chiều dài, nhiễu bụi trôi;
 *    chiều dài nón cắt ở tường / sàn gần nhất (dò bằng hàm va chạm thuần, không raycast lưới);
 *  • bụi lơ lửng: 1 lệnh vẽ Points, chỉ hạt nằm trong nón đèn mới lấp lánh (tán xạ theo chùm).
 * Tất cả rẻ: 1 đèn bóng + 2 lệnh vẽ trong suốt.
 */
import { useEffect, useMemo } from "react";
import { useFrame, useThree } from "@react-three/fiber";
import * as THREE from "three";
import { useWorld, type Quality } from "../../store";

/** góc nửa nón (rad) — dùng chung cho đèn, nón sáng, bụi */
const ANGLE = 0.4;
const RANGE = 22;
const DUST_N = 420;
const DUST_BOX = 7;

/** cookie đèn pin: lõi nóng, vành sáng mảnh (phản xạ chóa), quầng ngoài mờ, vệt bẩn trên kính (vẽ một lần) */
function cookieTexture() {
  const S = 256;
  const c = document.createElement("canvas");
  c.width = c.height = S;
  const g = c.getContext("2d")!;
  g.fillStyle = "#000";
  g.fillRect(0, 0, S, S);
  const r = g.createRadialGradient(S / 2, S / 2, 0, S / 2, S / 2, S / 2);
  // giá trị = hệ số tuyến tính (NoColorSpace): lõi 1, vành chóa 0,85, quầng ngoài ~0,3 → 0
  r.addColorStop(0, "#fff");
  r.addColorStop(0.2, "#fbf8f2");
  r.addColorStop(0.27, "#cfc9bf");
  r.addColorStop(0.32, "#e6e0d4");
  r.addColorStop(0.4, "#8a857c");
  r.addColorStop(0.65, "#4a4741");
  r.addColorStop(0.88, "#151412");
  r.addColorStop(1, "#000");
  g.fillStyle = r;
  g.fillRect(0, 0, S, S);
  // vệt bẩn / xước trên kính đèn (nhạt — chỉ làm chùm sáng "có kết cấu", tất định)
  let s = 7;
  const rnd = () => ((s = (s * 16807) % 2147483647) / 2147483647);
  g.globalCompositeOperation = "multiply";
  for (let k = 0; k < 22; k++) {
    const a = rnd() * Math.PI * 2;
    const rr = (0.08 + rnd() * 0.3) * S;
    const x = S / 2 + Math.cos(a) * rr;
    const y = S / 2 + Math.sin(a) * rr;
    const gr = g.createRadialGradient(x, y, 0, x, y, 4 + rnd() * 14);
    const v = Math.round(200 + rnd() * 45);
    gr.addColorStop(0, `rgb(${v},${v},${v})`);
    gr.addColorStop(1, "#fff");
    g.fillStyle = gr;
    g.fillRect(0, 0, S, S);
  }
  const t = new THREE.CanvasTexture(c);
  t.colorSpace = THREE.NoColorSpace;
  return t;
}

const NOISE = `
  float h3(vec3 p){ p = fract(p * 0.3183099 + 0.1); p *= 17.0; return fract(p.x * p.y * p.z * (p.x + p.y + p.z)); }
  float n3(vec3 x){ vec3 i = floor(x), f = fract(x); f = f * f * (3.0 - 2.0 * f);
    return mix(mix(mix(h3(i), h3(i + vec3(1,0,0)), f.x), mix(h3(i + vec3(0,1,0)), h3(i + vec3(1,1,0)), f.x), f.y),
               mix(mix(h3(i + vec3(0,0,1)), h3(i + vec3(1,0,1)), f.x), mix(h3(i + vec3(0,1,1)), h3(i + vec3(1,1,1)), f.x), f.y), f.z); }`;

/**
 * Nón sáng: mỗi điểm ảnh tính tia nhìn ↔ trục chùm (điểm gần nhất giữa hai đường) → mật độ theo khoảng cách tới trục so với
 * bán kính nón tại đó, suy giảm theo chiều dài, nhiễu bụi trôi. Đúng ở mọi góc nhìn (kể cả nhìn dọc theo chùm từ sau vai),
 * không như kiểu fresnel (mất hết khi nhìn dọc trục). Chỉ vẽ mặt trước → mỗi điểm ảnh một lần.
 */
function beamMaterial() {
  return new THREE.ShaderMaterial({
    transparent: true,
    depthWrite: false,
    blending: THREE.AdditiveBlending,
    side: THREE.FrontSide,
    fog: false,
    uniforms: {
      uT: { value: 0 },
      uI: { value: 1 },
      uColor: { value: new THREE.Color("#ffe2bc") },
      uA: { value: new THREE.Vector3() },
      uD: { value: new THREE.Vector3(0, 0, -1) },
      uTan: { value: Math.tan(ANGLE) },
      uLen: { value: 6 },
    },
    vertexShader: `varying vec3 vW;
      void main(){ vec4 w = modelMatrix * vec4(position, 1.0); vW = w.xyz; gl_Position = projectionMatrix * viewMatrix * w; }`,
    fragmentShader: `varying vec3 vW;
      uniform float uT; uniform float uI; uniform vec3 uColor; uniform vec3 uA; uniform vec3 uD; uniform float uTan; uniform float uLen;
      ${NOISE}
      void main(){
        vec3 ro = cameraPosition; vec3 rd = normalize(vW - ro);
        vec3 w0 = ro - uA; float b = dot(rd, uD); float d = dot(rd, w0); float e = dot(uD, w0);
        float den = max(1e-4, 1.0 - b * b);
        float tr = (b * e - d) / den; float ta = (e - b * d) / den;
        float tc = clamp(ta, 0.0, uLen);
        vec3 pa = uA + uD * tc;
        if (tc != ta) tr = dot(pa - ro, rd);
        ta = tc;
        vec3 pr = ro + rd * max(tr, 0.0);
        float dist = length(pr - pa);
        float r = max(0.02, uTan * ta);
        float q = dist / r;
        float rad = exp(-3.2 * q * q) * (1.0 - smoothstep(0.85, 1.0, q));
        float along = smoothstep(0.0, 0.5, ta) * (1.0 - smoothstep(uLen * 0.3, uLen * 0.95, ta)) / (1.0 + 0.08 * ta * ta);
        float n = n3(pr * 1.6 + vec3(0.0, uT * 0.1, uT * 0.04)) * 0.6 + n3(pr * 4.1 - vec3(uT * 0.17)) * 0.4;
        float a = rad * along * (0.3 + 0.9 * n) * uI;
        gl_FragColor = vec4(uColor * a * 0.065, 1.0);
      }`,
  });
}

function dustMaterial() {
  return new THREE.ShaderMaterial({
    transparent: true,
    depthWrite: false,
    blending: THREE.AdditiveBlending,
    fog: false,
    uniforms: {
      uT: { value: 0 },
      uC: { value: new THREE.Vector3() },
      uP: { value: new THREE.Vector3() },
      uD: { value: new THREE.Vector3(0, 0, -1) },
      uCos: { value: Math.cos(ANGLE) },
      uI: { value: 1 },
      uScale: { value: 300 },
    },
    vertexShader: `uniform float uT; uniform vec3 uC; uniform vec3 uP; uniform vec3 uD; uniform float uCos; uniform float uI; uniform float uScale;
      attribute float aSeed; varying float vA;
      void main(){
        float B = ${DUST_BOX.toFixed(1)};
        vec3 drift = vec3(sin(uT * 0.13 + aSeed * 6.28) * 0.25, -uT * 0.035 * (0.4 + aSeed), cos(uT * 0.11 + aSeed * 9.0) * 0.25);
        vec3 w = uC + mod(position * B + drift - uC, B) - B * 0.5;
        vec3 v = w - uP; float L = length(v); float along = dot(v, uD);
        float inC = smoothstep(uCos, mix(uCos, 1.0, 0.55), along / max(L, 1e-3)) * step(0.0, along);
        float fall = 1.0 / (1.0 + 0.18 * L * L);
        float tw = 0.6 + 0.4 * sin(uT * (1.5 + aSeed * 3.0) + aSeed * 40.0);
        vA = (inC * fall * 6.0 * tw + 0.01) * uI;
        vec4 mv = viewMatrix * vec4(w, 1.0);
        gl_Position = projectionMatrix * mv;
        gl_PointSize = clamp(uScale * (0.008 + 0.01 * aSeed) / -mv.z, 1.5, 7.0);
      }`,
    fragmentShader: `varying float vA;
      void main(){ vec2 q = gl_PointCoord - 0.5; float r = dot(q, q); if (r > 0.25) discard;
        gl_FragColor = vec4(vec3(1.0, 0.93, 0.82) * vA * (1.0 - r * 4.0), 1.0); }`,
  });
}

const FWD = new THREE.Vector3();
const TMP = new THREE.Vector3();
const Q = new THREE.Quaternion();
const Z = new THREE.Vector3(0, 0, 1);

/**
 * reach(x, z, dx, dz, max): khoảng cách theo mặt đất tới vật cản đầu tiên (hàm thuần của cảnh).
 * power: 0…1 (cảnh điều khiển — sự kiện "pin yếu" / hiện diện vô hình).
 */
export function ArchiveTorch({ quality, reach, power }: { quality: Quality; reach: (x: number, z: number, dx: number, dz: number, max: number) => number; power: { v: number } }) {
  const { scene, size } = useThree();
  const cookie = useMemo(() => (typeof document === "undefined" ? null : cookieTexture()), []);
  const light = useMemo(() => {
    const l = new THREE.SpotLight("#ffe6c4", 600, RANGE, ANGLE, 0.5, 2);
    l.castShadow = quality !== "low";
    l.shadow.mapSize.setScalar(quality === "high" ? 1024 : 768);
    l.shadow.radius = 4;
    l.shadow.bias = -0.0005;
    l.shadow.normalBias = 0.035;
    l.shadow.camera.near = 0.25;
    l.shadow.camera.far = RANGE;
    l.map = cookie;
    l.name = "ar_torch";
    return l;
  }, [cookie, quality]);
  const { beam, dust, beamMat, dustMat } = useMemo(() => {
    // nón mở: đỉnh ở gốc, trục +z, dài 1, bán kính đáy 1 (co giãn mỗi khung)
    const g = new THREE.ConeGeometry(1, 1, 28, 6, true);
    g.rotateX(-Math.PI / 2);
    g.translate(0, 0, 0.5);
    const beamMat = beamMaterial();
    const beam = new THREE.Mesh(g, beamMat);
    beam.frustumCulled = false;
    beam.renderOrder = 5;
    beam.name = "perf:ar_beam";
    const dg = new THREE.BufferGeometry();
    const pos = new Float32Array(DUST_N * 3);
    const seed = new Float32Array(DUST_N);
    let s = 3;
    const rnd = () => ((s = (s * 16807) % 2147483647) / 2147483647);
    for (let i = 0; i < DUST_N; i++) {
      pos[i * 3] = rnd();
      pos[i * 3 + 1] = rnd();
      pos[i * 3 + 2] = rnd();
      seed[i] = rnd();
    }
    dg.setAttribute("position", new THREE.BufferAttribute(pos, 3));
    dg.setAttribute("aSeed", new THREE.BufferAttribute(seed, 1));
    const dustMat = dustMaterial();
    const dust = new THREE.Points(dg, dustMat);
    dust.frustumCulled = false;
    dust.renderOrder = 6;
    dust.name = "perf:ar_dust";
    return { beam, dust, beamMat, dustMat };
  }, []);
  useEffect(() => {
    scene.add(light, light.target, beam, dust);
    return () => {
      scene.remove(light, light.target, beam, dust);
      light.dispose();
    };
  }, [scene, light, beam, dust]);
  useEffect(
    () => () => {
      cookie?.dispose();
      beam.geometry.dispose();
      dust.geometry.dispose();
      beamMat.dispose();
      dustMat.dispose();
    },
    [cookie, beam, dust, beamMat, dustMat],
  );
  const st = useMemo(() => ({ sway: 0, stutter: 0, nextStutter: 14, scan: 0, off: [] as THREE.Object3D[] }), []);
  // đèn ở ngay vai: tóc / thân nhân vật của chính người chơi bao quanh nguồn sáng → che kín bản đồ bóng. Nhân vật ở gần đèn
  // (≤ 1,2 m) không đổ bóng đèn pin; người khác / NPC phía trước vẫn đổ bóng lên tường. Trả lại khi rời cảnh.
  useEffect(
    () => () => {
      for (const o of st.off) o.castShadow = true;
      st.off.length = 0;
    },
    [st],
  );

  useFrame((state, dt) => {
    const s = useWorld.getState();
    const p = s.player;
    const t = state.clock.elapsedTime;
    const yaw = s.camYaw;
    const fx = -Math.sin(yaw);
    const fz = -Math.cos(yaw);
    // nhắm theo máy quay, chúc xuống ~10° (soi đường như cầm đèn thật); lắc nhẹ khi đi
    const moving = s.moving ? 1 : 0;
    st.sway += dt * (moving ? 7.5 : 1.2);
    const swayA = moving ? 0.018 : 0.006;
    const pitch = Math.max(-0.8, Math.min(0.35, -s.camPitch * 0.9 - 0.12)) + Math.sin(st.sway * 2) * swayA;
    // lệch phải ~6° (đèn cầm tay phải) → vũng sáng không bị chính nhân vật che trước máy quay
    const yawJ = Math.sin(st.sway) * swayA + 0.1;
    const cp = Math.cos(pitch);
    FWD.set((fx * Math.cos(yawJ) - fz * Math.sin(yawJ)) * cp, Math.sin(pitch), (fz * Math.cos(yawJ) + fx * Math.sin(yawJ)) * cp).normalize();
    const px = p.x + Math.cos(yaw) * 0.34 + fx * 0.25;
    const py = p.y + 1.38;
    const pz = p.z - Math.sin(yaw) * 0.34 + fz * 0.25;
    light.position.set(px, py, pz);
    light.target.position.set(px + FWD.x * 10, py + FWD.y * 10, pz + FWD.z * 10);
    light.target.updateMatrixWorld();
    if ((st.scan -= dt) <= 0) {
      st.scan = 0.5;
      scene.traverse((o) => {
        if (!(o as THREE.SkinnedMesh).isSkinnedMesh) return;
        o.getWorldPosition(TMP);
        const near = Math.hypot(TMP.x - p.x, TMP.z - p.z) < 1.2;
        if (near && o.castShadow) {
          o.castShadow = false;
          st.off.push(o);
        } else if (!near && !o.castShadow && st.off.includes(o)) {
          o.castShadow = true;
          st.off.splice(st.off.indexOf(o), 1);
        }
      });
    }
    // chập pin hiếm (≈ 14–40 s một lần) — cộng với power do cảnh điều khiển
    if (t > st.nextStutter) {
      st.stutter = 0.5;
      st.nextStutter = t + 14 + Math.random() * 26;
    }
    st.stutter = Math.max(0, st.stutter - dt);
    const stut = st.stutter > 0 ? (Math.sin(t * 61) * Math.sin(t * 23) > 0 ? 0.25 : 1) : 1;
    const k = power.v * stut * (0.97 + 0.03 * Math.sin(t * 13.7));
    light.intensity = 600 * k;
    // nón sáng: cắt ở tường / sàn gần nhất
    const hl = Math.hypot(FWD.x, FWD.z) || 1;
    const wall = reach(px, pz, FWD.x / hl, FWD.z / hl, 10) / hl;
    const floor = FWD.y < -0.02 ? py / -FWD.y : 99;
    const ceil = FWD.y > 0.02 ? (3.2 - py) / FWD.y : 99;
    const L = Math.max(0.6, Math.min(10, wall + 0.25, floor + 0.15, ceil + 0.15));
    const r = Math.tan(ANGLE) * L * 1.05;
    beam.position.set(px, py, pz);
    beam.quaternion.copy(Q.setFromUnitVectors(Z, FWD));
    beam.scale.set(r, r, L);
    const bu = beamMat.uniforms;
    bu.uT.value = t;
    bu.uI.value = k;
    bu.uA.value.set(px, py, pz);
    bu.uD.value.copy(FWD);
    bu.uLen.value = L;
    const du = dustMat.uniforms;
    du.uT.value = t;
    du.uC.value.set(px + FWD.x * 2.5, py + FWD.y * 2.5, pz + FWD.z * 2.5);
    du.uP.value.set(px, py, pz);
    du.uD.value.copy(FWD);
    du.uI.value = k;
    du.uScale.value = size.height;
  });
  return null;
}
