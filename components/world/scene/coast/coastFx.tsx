"use client";
/**
 * Bờ Sóng — bầu trời, biển, mặt Đầm Giao thoa: toàn shader (không ảnh panorama).
 *  - CoastSky: trời chiều biển (thiên đỉnh xanh thẫm → chân trời vàng cam), mặt trời thấp phía đông trên biển, mây tầng mỏng.
 *  - Ocean: 6 sóng Gerstner — ĐÚNG mảng SEA + hàm shoal + mực triều của lib/world/waves.ts (logic tính độ cao bằng cùng công thức).
 *    Pháp tuyến giải tích tính lại TỪNG ĐIỂM ẢNH (lưới đỉnh thưa ngoài xa vẫn có sóng nhỏ), bọt đỉnh sóng từ định thức Jacobi
 *    (mặt nước bị nén), bọt bờ từ độ sâu giải tích (cùng hàm mặt đất bãi / doi cát / đảo), tô màu cel 3 bậc + fresnel Schlick.
 *  - LagoonWater: h = A·sin(k r₁ − ωt) + A·sin(k r₂ − ωt + φ) (lagoonH) ở đỉnh; điểm ảnh tô theo biên độ M (lagoonAmp):
 *    dải LẶNG M ≤ SAFE_M sáng ngọc + viền đứng yên (đọc được là "đường an toàn", khác chỗ sóng chỉ tạm đi qua 0), bụng sóng có bọt.
 * Đồng hồ: uT = coastClock(Date.now()) — chung cho mọi máy.
 */
import { useEffect, useMemo } from "react";
import { useFrame } from "@react-three/fiber";
import * as THREE from "three";
import { CAUSEWAY, HEADLAND, ISLE } from "@/lib/world/coastWorld";
import { LAGOON, LAG_K, LAG_W, SAFE_M, SEA, coastClock, tideLevel } from "@/lib/world/waves";
import { useCoast } from "./coastState";

export const COAST_SUN = new THREE.Vector3(0.78, 0.3, -0.36).normalize();
export const COAST_FOG = "#bfd8e6";
const f = (n: number) => (Number.isInteger(n) ? n.toFixed(1) : String(n));

const SKY_FRAG = /* glsl */ `uniform float uT; uniform vec3 uSun; varying vec3 vD;
  float h2(vec2 p){ p = fract(p * vec2(0.1031, 0.103)); p += dot(p, p.yx + 33.33); return fract((p.x + p.y) * p.x); }
  float n2(vec2 p){ vec2 i = floor(p), q = fract(p); q = q*q*(3.0-2.0*q);
    return mix(mix(h2(i), h2(i+vec2(1.0,0.0)), q.x), mix(h2(i+vec2(0.0,1.0)), h2(i+vec2(1.0,1.0)), q.x), q.y); }
  float fbm(vec2 p){ float s = 0.0, a = 0.5; for (int i = 0; i < 4; i++) { s += a * n2(p); p = p * 2.07 + 5.3; a *= 0.5; } return s; }
  void main(){
    vec3 d = normalize(vD);
    float y = d.y;
    float sd = max(dot(d, uSun), 0.0);
    float az = dot(normalize(vec2(d.x, d.z) + 1e-4), normalize(vec2(uSun.x, uSun.z)));
    vec3 zen = vec3(0.16, 0.36, 0.72);
    vec3 mid = vec3(0.42, 0.66, 0.92);
    vec3 hor = mix(vec3(0.80, 0.88, 0.96), vec3(1.0, 0.80, 0.56), smoothstep(-0.2, 1.0, az));
    vec3 c = mix(mid, zen, smoothstep(0.1, 0.8, y));
    c = mix(c, hor, pow(1.0 - clamp(y, 0.0, 1.0), 4.0));
    c = mix(c, vec3(0.749, 0.847, 0.902), smoothstep(0.02, -0.1, y));
    c += vec3(1.0, 0.7, 0.45) * pow(sd, 6.0) * 0.45 + vec3(1.0, 0.9, 0.7) * pow(sd, 80.0) * 0.8;
    c += vec3(1.0, 0.97, 0.9) * smoothstep(0.9992, 0.9995, sd) * 4.0;
    // mây tầng mỏng trôi theo gió biển
    if (y > 0.02) {
      vec2 q = d.xz / (y + 0.12) * 1.3 + vec2(uT * 0.004, uT * 0.0015);
      float cl = smoothstep(0.52, 0.78, fbm(q * vec2(1.0, 2.2)));
      vec3 lit = mix(vec3(1.0), vec3(1.0, 0.86, 0.7), pow(sd, 3.0));
      c = mix(c, lit, cl * 0.75 * smoothstep(0.02, 0.2, y));
    }
    gl_FragColor = vec4(c, 1.0);
  }`;

export function CoastSky() {
  const mat = useMemo(
    () =>
      new THREE.ShaderMaterial({
        uniforms: { uT: { value: 0 }, uSun: { value: COAST_SUN.clone() } },
        vertexShader: "varying vec3 vD; void main(){ vD = position; gl_Position = projectionMatrix * modelViewMatrix * vec4(position,1.0); }",
        fragmentShader: SKY_FRAG,
        side: THREE.BackSide,
        depthWrite: false,
        fog: false,
      }),
    [],
  );
  const sky = useMemo(() => {
    const m = new THREE.Mesh(new THREE.SphereGeometry(420, 32, 16), mat);
    m.renderOrder = -10;
    m.frustumCulled = false;
    return m;
  }, [mat]);
  useEffect(
    () => () => {
      mat.dispose();
      sky.geometry.dispose();
    },
    [mat, sky],
  );
  useFrame(({ camera }, dt) => {
    mat.uniforms.uT.value += dt;
    sky.position.copy(camera.position);
  });
  return <primitive object={sky} />;
}

// ───────────── Biển ─────────────
/** mặt đất giải tích (chỉ cho độ sâu / bọt bờ) — đúng các hàm trong lib/world/coastWorld.ts, bỏ gợn nhỏ */
const GROUND_GLSL = /* glsl */ `
  float beachG(float x){
    if (x <= -14.0) return 1.2;
    if (x <= -6.0) return mix(1.2, 0.3, (x + 14.0) / 8.0);
    return max(-2.4, 0.3 - 0.12 * (x + 6.0) - max(0.0, x - 10.0) * 0.1);
  }
  float isleG(vec2 p){
    float d = length(p - vec2(${f(ISLE.x)}, ${f(ISLE.z)}));
    if (d <= ${f(ISLE.flat)}) return ${f(ISLE.top)};
    float t = (d - ${f(ISLE.flat)}) / ${f(ISLE.r - ISLE.flat)};
    return ${f(ISLE.top)} - 3.2 * t * t;
  }
  float causeG(vec2 p){
    if (p.x < ${f(CAUSEWAY.x0 - 2)} || p.x > ${f(CAUSEWAY.x1 + 2)}) return -9.0;
    float u = abs(p.y) / ${f(CAUSEWAY.half)};
    return ${f(CAUSEWAY.top)} - (u < 1.0 ? 0.18 * u * u : 0.18 + (u - 1.0) * 2.4);
  }
  float headG(vec2 p){
    float t = smoothstep(${f(HEADLAND.z + HEADLAND.ramp)}, ${f(HEADLAND.z)}, p.y);
    float c = smoothstep(16.0, 11.0, p.x);
    return mix(-2.4, ${f(HEADLAND.top)}, t * c);
  }
  float groundG(vec2 p){ return max(max(beachG(p.x), isleG(p)), max(causeG(p), headG(p))); }
`;

const WAVES_GLSL = /* glsl */ `
  uniform vec4 uWa[6]; // dx, dz, k, ω
  uniform vec4 uWb[6]; // a, qa, φ, 0
  float shoal(float x){ return 0.15 + 0.85 * smoothstep(-6.0, 16.0, x); }
`;

const OCEAN_VERT = /* glsl */ `
  uniform float uT; uniform float uTide;
  ${WAVES_GLSL}
  varying vec2 vRest; varying vec3 vW;
  void main(){
    vec2 p = position.xz;
    float s = shoal(p.x);
    vec3 o = vec3(p.x, 0.0, p.y);
    for (int i = 0; i < 6; i++) {
      float th = uWa[i].z * dot(uWa[i].xy, p) - uWa[i].w * uT + uWb[i].z;
      float c = cos(th) * uWb[i].y * s;
      o.x += uWa[i].x * c;
      o.z += uWa[i].y * c;
      o.y += uWb[i].x * s * sin(th);
    }
    o.y += uTide;
    vRest = p;
    vW = o;
    gl_Position = projectionMatrix * viewMatrix * vec4(o, 1.0);
  }`;

const OCEAN_FRAG = /* glsl */ `
  uniform float uT; uniform float uTide; uniform vec3 uSun; uniform vec3 uFog; uniform float uFogD;
  ${WAVES_GLSL}
  ${GROUND_GLSL}
  varying vec2 vRest; varying vec3 vW;
  void main(){
    vec2 p = vRest;
    float s = shoal(p.x);
    float J11 = 1.0, J12 = 0.0, J22 = 1.0;
    vec2 g = vec2(0.0);
    for (int i = 0; i < 6; i++) {
      vec2 D = uWa[i].xy;
      float k = uWa[i].z;
      float th = k * dot(D, p) - uWa[i].w * uT + uWb[i].z;
      float sn = sin(th), cs = cos(th);
      float qk = uWb[i].y * k * s * sn;
      J11 -= qk * D.x * D.x; J12 -= qk * D.x * D.y; J22 -= qk * D.y * D.y;
      g += uWb[i].x * s * k * cs * D;
    }
    vec3 Pu = vec3(J11, g.x, J12);
    vec3 Pv = vec3(J12, g.y, J22);
    vec3 N = normalize(cross(Pv, Pu));
    float detJ = J11 * J22 - J12 * J12;
    vec3 V = normalize(cameraPosition - vW);
    float depth = vW.y - groundG(vW.xz);
    // màu nước: sâu xanh thẫm → nông ngọc lam → sát bờ cát ấm
    vec3 deep = vec3(0.05, 0.26, 0.42);
    vec3 shallow = vec3(0.16, 0.66, 0.70);
    vec3 sandy = vec3(0.62, 0.78, 0.68);
    vec3 col = mix(shallow, deep, smoothstep(0.2, 2.6, depth));
    col = mix(sandy, col, smoothstep(0.0, 0.45, depth));
    // ánh sáng cel 3 bậc
    float ndl = dot(N, uSun);
    float band = ndl > 0.55 ? 1.0 : ndl > 0.2 ? 0.86 : 0.72;
    col *= band;
    // đỉnh sóng ngược sáng: ngọc trong (tán xạ dưới bề mặt giả)
    float sss = pow(max(dot(V, -uSun), 0.0), 3.0) * smoothstep(-0.05, 0.25, vW.y - uTide);
    col += vec3(0.1, 0.55, 0.5) * sss * 0.6;
    // fresnel Schlick → màu trời
    float F = 0.02 + 0.98 * pow(1.0 - clamp(dot(N, V), 0.0, 1.0), 5.0);
    vec3 skyc = mix(vec3(0.55, 0.74, 0.92), vec3(0.95, 0.86, 0.72), pow(max(dot(reflect(-V, N), uSun), 0.0), 2.0));
    col = mix(col, skyc, F * 0.85);
    // đốm nắng (bậc cứng kiểu hoạt hình)
    float spec = pow(max(dot(reflect(-uSun, N), V), 0.0), 220.0);
    col += vec3(1.0, 0.95, 0.85) * step(0.35, spec) * 1.4;
    // bọt đỉnh: mặt nước bị nén (det J nhỏ), vỡ thành mảng
    float brk = 0.5 + 0.5 * sin(p.x * 3.1 + uT * 0.7) * sin(p.y * 2.7 - uT * 0.5);
    float crest = (1.0 - smoothstep(0.62, 0.84, detJ)) * smoothstep(0.25, 0.75, brk + 0.2);
    // bọt bờ: các vạch chạy vào bờ theo độ sâu
    float shore = smoothstep(0.42, 0.0, depth);
    float lines = smoothstep(0.55, 0.9, sin(depth * 26.0 + uT * 2.6 + sin(p.y * 0.6) * 1.5));
    float foam = max(crest, shore * max(lines, smoothstep(0.12, 0.0, depth)));
    col = mix(col, vec3(0.97, 0.99, 1.0), clamp(foam, 0.0, 1.0) * 0.9);
    // sương xa
    float dist = length(cameraPosition - vW);
    col = mix(uFog, col, exp(-uFogD * dist));
    float alpha = mix(0.7, 1.0, smoothstep(0.0, 0.9, depth));
    gl_FragColor = vec4(col, alpha);
  }`;

/** lưới biển: dày ở vùng chơi, thưa dần ra xa (x = c + R·(0,22u + 0,78u³)) */
function oceanGeometry(cx: number, cz: number, R: number, n: number) {
  const g = new THREE.BufferGeometry();
  const pos = new Float32Array((n + 1) * (n + 1) * 3);
  const map = (u: number) => R * (0.22 * u + 0.78 * u * u * u);
  for (let j = 0; j <= n; j++)
    for (let i = 0; i <= n; i++) {
      const k = (j * (n + 1) + i) * 3;
      pos[k] = cx + map((i / n) * 2 - 1);
      pos[k + 1] = 0;
      pos[k + 2] = cz + map((j / n) * 2 - 1);
    }
  const idx: number[] = [];
  for (let j = 0; j < n; j++)
    for (let i = 0; i < n; i++) {
      const a = j * (n + 1) + i;
      idx.push(a, a + n + 1, a + 1, a + 1, a + n + 1, a + n + 2);
    }
  g.setAttribute("position", new THREE.BufferAttribute(pos, 3));
  g.setIndex(idx);
  g.boundingSphere = new THREE.Sphere(new THREE.Vector3(cx, 0, cz), R * 1.5);
  return g;
}

export function Ocean({ quality }: { quality: string }) {
  const n = quality === "low" ? 110 : 170;
  const geo = useMemo(() => oceanGeometry(14, -6, 330, n), [n]);
  const mat = useMemo(
    () =>
      new THREE.ShaderMaterial({
        uniforms: {
          uT: { value: 0 },
          uTide: { value: 0 },
          uSun: { value: COAST_SUN.clone() },
          uFog: { value: new THREE.Color(COAST_FOG) },
          uFogD: { value: 0.0075 },
          uWa: { value: SEA.map((w) => new THREE.Vector4(w.dx, w.dz, w.k, w.w)) },
          uWb: { value: SEA.map((w) => new THREE.Vector4(w.a, w.qa, w.ph, 0)) },
        },
        vertexShader: OCEAN_VERT,
        fragmentShader: OCEAN_FRAG,
        transparent: true,
        depthWrite: true,
      }),
    [],
  );
  useEffect(
    () => () => {
      geo.dispose();
      mat.dispose();
    },
    [geo, mat],
  );
  useFrame(() => {
    const t = coastClock(Date.now());
    mat.uniforms.uT.value = t;
    mat.uniforms.uTide.value = tideLevel(t);
  });
  return <mesh geometry={geo} material={mat} frustumCulled={false} renderOrder={1} />;
}

// ───────────── Đầm Giao thoa ─────────────
const LAG_COMMON = /* glsl */ `
  uniform float uT; uniform float uPhi;
  const vec2 S1 = vec2(${f(LAGOON.s1.x)}, ${f(LAGOON.s1.z)});
  const vec2 S2 = vec2(${f(LAGOON.s2.x)}, ${f(LAGOON.s2.z)});
  const float K = ${LAG_K};
  const float W = ${LAG_W};
  const float A = ${f(LAGOON.A)};
`;
const LAG_VERT = /* glsl */ `
  ${LAG_COMMON}
  varying vec2 vP; varying float vH; varying vec3 vW;
  void main(){
    vec2 p = position.xz;
    float r1 = length(p - S1), r2 = length(p - S2);
    float h = A * (sin(K * r1 - W * uT) + sin(K * r2 - W * uT + uPhi));
    vP = p; vH = h;
    vec3 w = vec3(p.x, ${f(LAGOON.water)} + h, p.y);
    vW = w;
    gl_Position = projectionMatrix * viewMatrix * vec4(w, 1.0);
  }`;
const LAG_FRAG = /* glsl */ `
  ${LAG_COMMON}
  uniform vec3 uSun; uniform float uSafe;
  varying vec2 vP; varying float vH; varying vec3 vW;
  void main(){
    vec2 p = vP;
    float r1 = length(p - S1), r2 = length(p - S2);
    float a1 = K * r1 - W * uT, a2 = K * r2 - W * uT + uPhi;
    float h = A * (sin(a1) + sin(a2));
    // gradient giải tích → pháp tuyến từng điểm ảnh
    vec2 g = A * K * (cos(a1) * (p - S1) / max(r1, 1e-3) + cos(a2) * (p - S2) / max(r2, 1e-3));
    vec3 N = normalize(vec3(-g.x, 1.0, -g.y));
    float M = abs(2.0 * A * cos((K * (r1 - r2) - uPhi) * 0.5));
    vec3 V = normalize(cameraPosition - vW);
    vec3 col = mix(vec3(0.10, 0.46, 0.56), vec3(0.05, 0.30, 0.42), smoothstep(0.0, 0.44, M));
    float ndl = dot(N, uSun);
    col *= ndl > 0.6 ? 1.0 : ndl > 0.25 ? 0.85 : 0.7;
    // dải LẶNG (M ≤ uSafe): ngọc sáng + vạch giữa đứng yên
    float calm = smoothstep(uSafe, uSafe * 0.55, M);
    col = mix(col, vec3(0.42, 0.95, 0.88), calm * 0.55);
    float core = smoothstep(uSafe * 0.28, 0.0, M);
    col += vec3(0.5, 1.0, 0.92) * core * 0.55;
    float edge = smoothstep(0.035, 0.0, abs(M - uSafe));
    col = mix(col, vec3(0.85, 1.0, 0.98), edge * 0.6);
    // bụng sóng: đỉnh có bọt chạy ra xa nguồn
    float crest = smoothstep(0.72, 0.95, h / max(M, 1e-3)) * smoothstep(uSafe, uSafe * 2.2, M);
    col = mix(col, vec3(0.97, 0.99, 1.0), crest * 0.85);
    float F = 0.02 + 0.98 * pow(1.0 - clamp(dot(N, V), 0.0, 1.0), 5.0);
    col = mix(col, vec3(0.62, 0.8, 0.95), F * 0.7);
    float spec = pow(max(dot(reflect(-uSun, N), V), 0.0), 160.0);
    col += step(0.4, spec) * vec3(1.0, 0.95, 0.85);
    // gợn tròn quanh mỗi nguồn
    float ring = smoothstep(0.06, 0.0, abs(fract(min(r1, r2) / ${f(LAGOON.lambda)} - uT / ${f(LAGOON.T)}) - 0.5) - 0.44) * smoothstep(3.5, 0.8, min(r1, r2));
    col += vec3(0.8, 0.95, 1.0) * ring * 0.4;
    gl_FragColor = vec4(col, 0.88);
  }`;

export function LagoonWater() {
  const geo = useMemo(() => {
    const w = LAGOON.x1 - LAGOON.x0;
    const d = LAGOON.z1 - LAGOON.z0;
    const g = new THREE.PlaneGeometry(w, d, Math.round(w * 3), Math.round(d * 3));
    g.rotateX(-Math.PI / 2);
    g.translate((LAGOON.x0 + LAGOON.x1) / 2, 0, (LAGOON.z0 + LAGOON.z1) / 2);
    return g;
  }, []);
  const mat = useMemo(
    () =>
      new THREE.ShaderMaterial({
        uniforms: { uT: { value: 0 }, uPhi: { value: 0 }, uSun: { value: COAST_SUN.clone() }, uSafe: { value: SAFE_M } },
        vertexShader: LAG_VERT,
        fragmentShader: LAG_FRAG,
        transparent: true,
      }),
    [],
  );
  useEffect(
    () => () => {
      geo.dispose();
      mat.dispose();
    },
    [geo, mat],
  );
  useFrame(() => {
    mat.uniforms.uT.value = coastClock(Date.now());
    mat.uniforms.uPhi.value = useCoast.getState().phi;
  });
  return <mesh geometry={geo} material={mat} renderOrder={2} />;
}
