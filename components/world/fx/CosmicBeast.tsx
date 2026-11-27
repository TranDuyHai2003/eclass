"use client";
/**
 * Sinh vật vũ trụ khổng lồ bay quanh bầu trời (rồng phương Đông / sâu vũ trụ) — lib/world/beastPath.ts:
 *  • THÂN: ống 96 × 14 đoạn, vị trí đỉnh tính trong vertex shader từ texture xương sống 64 × 3 (vị trí, pháp tuyến, phó pháp tuyến)
 *    cập nhật mỗi khung → thân uốn lượn liền mạch theo đường bay + sóng lan dọc thân (không xương, 1 lệnh vẽ);
 *  • da: vảy tròn xếp lớp, lưng sẫm óng ánh ↔ bụng sáng, dải phát sáng chạy dọc sống lưng (HDR → bloom), viền fresnel;
 *  • VÂY / CÁNH: vây lưng gợn sóng + (rồng) đôi cánh màng vỗ chậm 0,25 Hz — trong suốt, fresnel, gân sáng;
 *  • ĐUÔI TINH VÂN: mảng sáng mềm sinh ở đuôi, nở 4 → 18 m, tan trong 6 s (instanced, 1 lệnh vẽ);
 *  • GẦM: mỗi 28–40 s một sóng xung kích cầu nở 0 → 70 m + âm trầm theo khoảng cách.
 */
import { useEffect, useMemo, useRef } from "react";
import { useFrame } from "@react-three/fiber";
import * as THREE from "three";
import { spine, type BeastPath, type Spine } from "@/lib/world/beastPath";
import { noiseTex } from "./proceduralTex";
import { sfx } from "@/lib/world/sfx";

const N = 64;
const LS = 96;
const RS = 14;

export type BeastLook = {
  kind: "dragon" | "worm";
  back: string;
  belly: string;
  glow: string;
  fin: string;
  wake: string;
  /** màu trời / sương để hoà phối cảnh khí quyển */
  fog: string;
};

const BODY_VS = /* glsl */ `
  uniform sampler2D uSpine; uniform float uRad; uniform float uT; uniform float uWorm;
  attribute vec2 aUT;
  varying vec2 vUT; varying vec3 vN; varying vec3 vW; varying float vBelly;
  vec3 sp(int row, float u){ float x = u * ${N - 1}.0; int i0 = int(floor(x)); int i1 = min(i0 + 1, ${N - 1}); float f = x - float(i0);
    return mix(texelFetch(uSpine, ivec2(i0, row), 0).xyz, texelFetch(uSpine, ivec2(i1, row), 0).xyz, f); }
  float radius(float u){
    // rồng: mõm thon → đầu → cổ hơi thắt → thân → đuôi nhọn; sâu: thân đều, đầu tròn to, đốt phồng
    float head = smoothstep(0.0, 0.07, u);
    float neck = 1.0 - 0.18 * exp(-pow((u - 0.13) * 22.0, 2.0));
    float body = 1.0 - 0.82 * smoothstep(0.2, 1.0, u);
    float dr = mix(0.45, 1.0, head) * neck * body;
    float seg = 1.0 + 0.12 * pow(abs(sin(u * 90.0)), 6.0);
    float wr = mix(0.7, 1.15, head) * (1.0 - 0.55 * smoothstep(0.55, 1.0, u)) * seg;
    return mix(dr, wr, uWorm) * (1.0 + 0.03 * sin(uT * 1.7 - u * 8.0));
  }
  void main(){
    float u = aUT.x, th = aUT.y;
    vec3 P = sp(0, u), Nn = normalize(sp(1, u)), B = normalize(sp(2, u));
    vec3 dir = Nn * cos(th) * 0.85 + B * sin(th);
    vec3 w = P + dir * radius(u) * uRad;
    vUT = aUT; vW = w; vN = normalize(Nn * cos(th) + B * sin(th)); vBelly = -cos(th);
    gl_Position = projectionMatrix * viewMatrix * vec4(w, 1.0);
  }`;

const BODY_FS = /* glsl */ `
  uniform vec3 uBack; uniform vec3 uBelly; uniform vec3 uGlow; uniform vec3 uSun; uniform float uT; uniform float uLen; uniform float uRad; uniform vec3 uFog;
  varying vec2 vUT; varying vec3 vN; varying vec3 vW; varying float vBelly;
  void main(){
    vec3 n = normalize(vN);
    vec3 V = normalize(cameraPosition - vW);
    // vảy tròn xếp lớp (lưới lệch nửa ô theo hàng)
    vec2 g = vec2(vUT.x * uLen / (uRad * 0.9), vUT.y / 6.2831853 * 14.0);
    g.y += floor(g.x) * 0.5;
    vec2 f = fract(g) - vec2(0.5, 0.5);
    float scale = smoothstep(0.5, 0.25, length(f * vec2(1.0, 1.25)));
    float belly = smoothstep(0.2, 0.75, vBelly);
    vec3 base = mix(uBack, uBelly, belly);
    base *= 0.75 + 0.35 * scale;
    // óng ánh theo góc nhìn trên lưng
    float nv = abs(dot(n, V));
    base += (1.0 - belly) * vec3(0.25, 0.1, 0.4) * pow(1.0 - nv, 2.0);
    float lam = 0.35 + 0.65 * max(dot(n, uSun), 0.0);
    vec3 col = base * lam;
    // dải phát sáng chạy dọc sống lưng + nhịp sáng lan từ đầu tới đuôi
    float spineLine = exp(-pow(vBelly + 1.0, 2.0) * 40.0);
    float pulse = pow(0.5 + 0.5 * sin(vUT.x * 38.0 - uT * 3.2), 10.0);
    col += uGlow * (spineLine * (0.6 + 2.4 * pulse) + scale * pulse * 0.35 * (1.0 - belly));
    // viền fresnel
    col += uGlow * pow(1.0 - nv, 3.0) * 0.9;
    // mắt (gần đầu, hai bên)
    float eye = exp(-pow((vUT.x - 0.045) * 90.0, 2.0)) * exp(-pow((abs(vBelly) - 0.05) * 9.0, 2.0)) * step(0.0, -vBelly + 0.3);
    col += vec3(3.0, 2.6, 1.2) * eye;
    // phối cảnh khí quyển: xa thì hoà vào màu trời (exp(−0,003 d): 16% / 45% / 70% ở 60 / 200 / 400 m) — cảm giác khổng lồ ở xa
    col = mix(uFog, col, exp(-0.003 * length(cameraPosition - vW)));
    gl_FragColor = vec4(col, 1.0);
    #include <tonemapping_fragment>
    #include <colorspace_fragment>
  }`;

/** vây / cánh: aFin = (u, v ∈ [0,1], side: 0 lưng, ±1 cánh) */
const FIN_VS = /* glsl */ `
  uniform sampler2D uSpine; uniform float uRad; uniform float uT; uniform float uSpan;
  attribute vec3 aFin;
  varying vec2 vF; varying float vSide; varying vec3 vW; varying vec3 vN;
  vec3 sp(int row, float u){ float x = u * ${N - 1}.0; int i0 = int(floor(x)); int i1 = min(i0 + 1, ${N - 1}); float f = x - float(i0);
    return mix(texelFetch(uSpine, ivec2(i0, row), 0).xyz, texelFetch(uSpine, ivec2(i1, row), 0).xyz, f); }
  void main(){
    float u = aFin.x, v = aFin.y, side = aFin.z;
    vec3 P = sp(0, u), Nn = normalize(sp(1, u)), B = normalize(sp(2, u));
    vec3 w;
    if (abs(side) > 1.5) {
      // râu rồng: mọc từ hai bên mõm, chạy ngược về sau dọc 35% thân, uốn sóng trễ pha (dải mảnh)
      float us = u * 0.35;
      vec3 Ps = sp(0, us), Ns = normalize(sp(1, us)), Bs = normalize(sp(2, us));
      float sg = sign(side);
      float spread = uRad * (0.7 + u * 3.5);
      float wav = sin(uT * 2.2 - u * 14.0) * uRad * (0.3 + 1.6 * u);
      w = Ps + Bs * sg * spread + Ns * (wav + uRad * 0.2) + Bs * sg * (v - 0.5) * uRad * 0.22 * (1.0 - u);
      vN = Ns;
    } else if (abs(side) < 0.5) {
      // vây lưng: gợn sóng theo thân
      float h = uRad * (0.9 + 0.6 * sin(u * 60.0 - uT * 4.0)) * (1.0 - smoothstep(0.75, 0.95, u));
      w = P + Nn * (uRad * 0.8 + v * h) + B * sin(u * 30.0 - uT * 3.0) * v * uRad * 0.25;
      vN = B;
    } else {
      // cánh màng: vỗ chậm, mép sau trễ pha
      // vỗ chậm ~0,14 Hz, mép ngoài trễ ~0,4 s (khổng lồ thì chuyển động chậm)
      float flap = 0.5 * sin(uT * 0.9 - v * 0.9) + 0.25;
      vec3 out_ = normalize(B * side * cos(flap) + Nn * sin(flap));
      w = P + out_ * (uRad * 0.8 + v * uSpan);
      vN = normalize(cross(out_, B));
    }
    vF = vec2(u, v); vSide = side; vW = w;
    gl_Position = projectionMatrix * viewMatrix * vec4(w, 1.0);
  }`;

const FIN_FS = /* glsl */ `
  uniform vec3 uFin; uniform float uT;
  varying vec2 vF; varying float vSide; varying vec3 vW; varying vec3 vN;
  void main(){
    vec3 V = normalize(cameraPosition - vW);
    float fr = pow(1.0 - abs(dot(normalize(vN), V)), 1.5);
    // gân màng: tia toả theo v + mép sáng
    float ribs = pow(0.5 + 0.5 * cos(vF.x * (abs(vSide) > 0.5 ? 160.0 : 220.0)), 14.0);
    float edge = smoothstep(0.82, 1.0, vF.y);
    float a = (0.12 + 0.5 * fr + 0.45 * ribs + 0.7 * edge) * (1.0 - smoothstep(0.92, 1.0, vF.y) * 0.4);
    a *= smoothstep(0.0, 0.08, vF.y);
    vec3 col = uFin * (1.0 + 1.5 * edge + 0.8 * ribs);
    gl_FragColor = vec4(col * a, 1.0);
  }`;

const WAKE_VS = /* glsl */ `
  attribute vec4 aW; // xyz tâm, w = lúc sinh
  uniform float uT; uniform float uLife;
  varying vec2 vUv; varying float vK; varying float vSeed;
  void main(){
    vUv = uv; vSeed = fract(aW.w * 7.13);
    float k = clamp((uT - aW.w) / uLife, 0.0, 1.0); vK = k;
    float size = mix(4.0, 18.0, sqrt(k));
    vec3 right = vec3(viewMatrix[0][0], viewMatrix[1][0], viewMatrix[2][0]);
    vec3 up = vec3(viewMatrix[0][1], viewMatrix[1][1], viewMatrix[2][1]);
    vec3 w = aW.xyz + vec3(0.0, k * 4.0, 0.0) + (right * position.x + up * position.y) * size;
    gl_Position = projectionMatrix * viewMatrix * vec4(w, 1.0);
  }`;

const WAKE_FS = /* glsl */ `
  uniform sampler2D uNoise; uniform vec3 uWake;
  varying vec2 vUv; varying float vK; varying float vSeed;
  void main(){
    vec2 q = vUv - 0.5;
    float n = texture2D(uNoise, vUv * 0.8 + vSeed).b;
    float shape = smoothstep(0.5, 0.0, length(q) + (n - 0.5) * 0.35);
    float a = shape * (1.0 - vK) * smoothstep(0.0, 0.08, vK) * 0.22;
    if (a < 0.003) discard;
    gl_FragColor = vec4(mix(uWake, vec3(1.0, 0.95, 0.9), (1.0 - vK) * 0.3) * a, 1.0);
  }`;

const ROAR_FS = /* glsl */ `uniform vec3 uCol; uniform float uK; varying vec3 vN; varying vec3 vW;
  void main(){ vec3 V = normalize(cameraPosition - vW); float fr = pow(1.0 - abs(dot(normalize(vN), V)), 3.0);
    float a = fr * (1.0 - uK) * smoothstep(0.0, 0.05, uK) * 0.9; if (a < 0.003) discard; gl_FragColor = vec4(uCol * a, 1.0); }`;

const WAKE_N = 80;

export function CosmicBeast({ path, look, bodyLen, radius, speed, sun, phase0 = 0 }: { path: BeastPath; look: BeastLook; bodyLen: number; radius: number; speed: number; sun: THREE.Vector3; phase0?: number }) {
  const worm = look.kind === "worm";
  const res = useMemo(() => {
    const data = new Float32Array(N * 3 * 4);
    const tex = new THREE.DataTexture(data, N, 3, THREE.RGBAFormat, THREE.FloatType);
    tex.minFilter = tex.magFilter = THREE.NearestFilter;
    tex.needsUpdate = true;
    // thân
    const ut: number[] = [];
    const idx: number[] = [];
    for (let j = 0; j <= LS; j++) for (let k = 0; k <= RS; k++) ut.push(j / LS, (k / RS) * Math.PI * 2);
    for (let j = 0; j < LS; j++)
      for (let k = 0; k < RS; k++) {
        const a = j * (RS + 1) + k;
        const b = a + RS + 1;
        idx.push(a, b, a + 1, a + 1, b, b + 1);
      }
    const body = new THREE.BufferGeometry();
    body.setAttribute("aUT", new THREE.Float32BufferAttribute(ut, 2));
    body.setAttribute("position", new THREE.Float32BufferAttribute(new Float32Array((ut.length / 2) * 3), 3));
    body.setIndex(idx);
    const common = { uSpine: { value: tex }, uRad: { value: radius }, uT: { value: 0 } };
    const bodyMat = new THREE.ShaderMaterial({
      uniforms: {
        ...common,
        uWorm: { value: worm ? 1 : 0 },
        uBack: { value: new THREE.Color(look.back) },
        uBelly: { value: new THREE.Color(look.belly) },
        uGlow: { value: new THREE.Color(look.glow).multiplyScalar(2.2) },
        uSun: { value: sun.clone().normalize() },
        uLen: { value: bodyLen },
        uFog: { value: new THREE.Color(look.fog) },
      },
      vertexShader: BODY_VS,
      fragmentShader: BODY_FS,
    });
    // vây lưng (u 0,08 → 0,95) + cánh (rồng: u 0,16 → 0,3, hai bên)
    const fin: number[] = [];
    const fidx: number[] = [];
    const strip = (u0: number, u1: number, side: number, nu: number, nv: number) => {
      const base = fin.length / 3;
      for (let i = 0; i <= nu; i++) for (let j = 0; j <= nv; j++) fin.push(u0 + ((u1 - u0) * i) / nu, j / nv, side);
      for (let i = 0; i < nu; i++)
        for (let j = 0; j < nv; j++) {
          const a = base + i * (nv + 1) + j;
          const b = a + nv + 1;
          fidx.push(a, b, a + 1, a + 1, b, b + 1);
        }
    };
    strip(0.08, 0.95, 0, 80, 3);
    if (!worm) {
      strip(0.16, 0.3, 1, 16, 6);
      strip(0.16, 0.3, -1, 16, 6);
      // râu: u 0 → 1 dọc chiều dài râu (đổi sang 0 → 35% thân trong shader), v = bề ngang
      strip(0, 1, 2, 40, 1);
      strip(0, 1, -2, 40, 1);
    }
    const finGeo = new THREE.BufferGeometry();
    finGeo.setAttribute("aFin", new THREE.Float32BufferAttribute(fin, 3));
    finGeo.setAttribute("position", new THREE.Float32BufferAttribute(new Float32Array(fin.length), 3));
    finGeo.setIndex(fidx);
    const finMat = new THREE.ShaderMaterial({
      uniforms: { ...common, uSpan: { value: radius * 9 }, uFin: { value: new THREE.Color(look.fin).multiplyScalar(1.6) } },
      vertexShader: FIN_VS,
      fragmentShader: FIN_FS,
      transparent: true,
      depthWrite: false,
      blending: THREE.AdditiveBlending,
      side: THREE.DoubleSide,
      toneMapped: false,
    });
    // đuôi tinh vân
    const wake = new THREE.InstancedBufferGeometry();
    const q = new THREE.PlaneGeometry(1, 1);
    wake.setIndex(q.index);
    wake.setAttribute("position", q.attributes.position);
    wake.setAttribute("uv", q.attributes.uv);
    wake.setAttribute("aW", new THREE.InstancedBufferAttribute(new Float32Array(WAKE_N * 4).fill(-1e4), 4).setUsage(THREE.DynamicDrawUsage));
    wake.instanceCount = WAKE_N;
    const wakeMat = new THREE.ShaderMaterial({
      uniforms: { uT: { value: 0 }, uLife: { value: 6 }, uNoise: { value: noiseTex() }, uWake: { value: new THREE.Color(look.wake).multiplyScalar(1.4) } },
      vertexShader: WAKE_VS,
      fragmentShader: WAKE_FS,
      transparent: true,
      depthWrite: false,
      blending: THREE.AdditiveBlending,
      toneMapped: false,
    });
    const roarMat = new THREE.ShaderMaterial({
      uniforms: { uCol: { value: new THREE.Color(look.glow).multiplyScalar(1.8) }, uK: { value: 1 } },
      vertexShader: "varying vec3 vN; varying vec3 vW; void main(){ vec4 w = modelMatrix * vec4(position, 1.0); vW = w.xyz; vN = normalize(mat3(modelMatrix) * normal); gl_Position = projectionMatrix * viewMatrix * w; }",
      fragmentShader: ROAR_FS,
      transparent: true,
      depthWrite: false,
      blending: THREE.AdditiveBlending,
      toneMapped: false,
      side: THREE.DoubleSide,
    });
    return { tex, data, body, bodyMat, finGeo, finMat, wake, wakeMat, roarMat, sp: null as Spine | null };
  }, [look, radius, bodyLen, worm, sun]);
  useEffect(
    () => () => {
      [res.tex, res.body, res.bodyMat, res.finGeo, res.finMat, res.wake, res.wakeMat, res.roarMat].forEach((o) => o.dispose());
    },
    [res],
  );
  const st = useRef({ a: phase0, wakeK: 0, wakeAcc: 0, roarAt: -1e9, nextRoar: 14 + phase0 * 3 });
  const roar = useRef<THREE.Mesh>(null);
  useFrame((state, dt) => {
    const t = state.clock.elapsedTime;
    const S = st.current;
    // tốc độ dài cố định (m/s) → tham số tăng theo 1 / tốc độ cung
    const r = Math.hypot(path.R, path.r2);
    S.a += (speed / r) * Math.min(dt, 0.05);
    // sóng thân: bước sóng ~0,3 thân, ~0,2 Hz (Codex: 24 m / 0,22 Hz cho thân 80 m)
    res.sp = spine(path, S.a, N, bodyLen, radius * (worm ? 0.8 : 1.0), bodyLen * 0.3, t * (worm ? 1.5 : 1.3), res.sp ?? undefined);
    const d = res.data;
    for (let i = 0; i < N; i++) {
      d.set([res.sp.pos[i * 3], res.sp.pos[i * 3 + 1], res.sp.pos[i * 3 + 2], 1], i * 4);
      d.set([res.sp.nrm[i * 3], res.sp.nrm[i * 3 + 1], res.sp.nrm[i * 3 + 2], 1], (N + i) * 4);
      d.set([res.sp.bin[i * 3], res.sp.bin[i * 3 + 1], res.sp.bin[i * 3 + 2], 1], (2 * N + i) * 4);
    }
    res.tex.needsUpdate = true;
    res.bodyMat.uniforms.uT.value = t;
    // đuôi tinh vân: sinh mảng ở 85–100% thân, 12 lần / giây
    S.wakeAcc += dt * 12;
    const wa = res.wake.attributes.aW as THREE.InstancedBufferAttribute;
    while (S.wakeAcc > 1) {
      S.wakeAcc--;
      const i = Math.floor(N * (0.85 + Math.random() * 0.14));
      wa.setXYZW(S.wakeK++ % WAKE_N, res.sp.pos[i * 3] + (Math.random() - 0.5) * radius * 2, res.sp.pos[i * 3 + 1] + (Math.random() - 0.5) * radius * 2, res.sp.pos[i * 3 + 2] + (Math.random() - 0.5) * radius * 2, t);
      wa.needsUpdate = true;
    }
    res.wakeMat.uniforms.uT.value = t;
    // gầm: sóng xung kích cầu từ đầu + âm trầm theo khoảng cách
    if (t > S.nextRoar) {
      S.nextRoar = t + 28 + Math.random() * 12;
      S.roarAt = t;
      if (roar.current) roar.current.position.set(res.sp.pos[0], res.sp.pos[1], res.sp.pos[2]);
      const dist = state.camera.position.distanceTo(roar.current?.position ?? state.camera.position);
      if (dist < 400) sfx.whale(0.22 * (1 - dist / 400) + 0.04);
    }
    const rk = (t - S.roarAt) / 0.8;
    if (roar.current) {
      roar.current.visible = rk < 1;
      roar.current.scale.setScalar(12 + rk * 60);
      res.roarMat.uniforms.uK.value = Math.min(1, Math.max(0, rk));
    }
  });
  return (
    <group name="perf:beasts">
      <mesh geometry={res.body} material={res.bodyMat} frustumCulled={false} />
      <mesh geometry={res.finGeo} material={res.finMat} frustumCulled={false} renderOrder={5} />
      <mesh geometry={res.wake} material={res.wakeMat} frustumCulled={false} renderOrder={4} />
      <mesh ref={roar} material={res.roarMat} visible={false} renderOrder={6}>
        <icosahedronGeometry args={[1, 3]} />
      </mesh>
    </group>
  );
}

// ── bảng màu + đường bay dùng chung (hằng số: không tạo lại vật liệu mỗi lần render) ──
export const BEAST_LOOKS = {
  /** rồng tím – vàng của Thế giới Bất Khả */
  dusk: { kind: "dragon", back: "#2a1846", belly: "#e8c98a", glow: "#ffb35a", fin: "#c48bff", wake: "#ff9ecb", fog: "#6b4f92" },
  /** rồng ngọc bích của Quảng trường (kiểu rồng gió) */
  jade: { kind: "dragon", back: "#1f5a5a", belly: "#f3e6c2", glow: "#8affd8", fin: "#a8fff0", wake: "#bfefff", fog: "#cfe0f2" },
  /** sâu vũ trụ của Hư Không */
  void: { kind: "worm", back: "#140c26", belly: "#5a3a8c", glow: "#7fe3ff", fin: "#7f9bff", wake: "#8b5cff", fog: "#1c1236" },
} as const satisfies Record<string, BeastLook>;
export const BEAST_PATHS = {
  impossible: { R: 128, r2: 34, k: 3, H: 48, A: 22, cx: 0, cz: 0 },
  hub: { R: 215, r2: 30, k: 2, H: 88, A: 16, cx: 0, cz: 0 },
  paradox: { R: 150, r2: 45, k: 5, H: 35, A: 30, cx: 0, cz: 0 },
} as const satisfies Record<string, BeastPath>;
