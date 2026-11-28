"use client";
/**
 * Mây tích quanh đảo — thẻ billboard SHADER (không ảnh panorama — bộ nhớ sky-shader-not-panorama), 1 lệnh vẽ instanced:
 *  • hình: 5–7 cục cầu chồng nhau trên một đáy phẳng (mây tích anime), mép xói nhẹ bằng noise;
 *  • sáng kiểu Genshin GDC 2021 (Haoyu Cai: "thân" và "viền" mây tô tách): pháp tuyến giả từ cục cầu → ramp 2 bậc mềm
 *    (bóng lam tím ↔ sáng kem đào), VIỀN BẠC khi mặt trời nằm sau đám mây, chân mây hoà vào sương chân trời;
 *  • theo giờ thật (DAY): hướng nắng / trăng, màu trời, đêm tối lam;
 *  • xếp xa → gần một lần lúc tạo (máy quay luôn ở gần tâm đảo) để trộn alpha không cần sắp xếp mỗi khung; trôi rất chậm quanh đảo.
 */
import { useEffect, useMemo } from "react";
import { useFrame } from "@react-three/fiber";
import * as THREE from "three";
import { useGfx } from "../gfx";
import { DAY } from "../fx/dayState";
import { noiseTex } from "../fx/proceduralTex";

const VS = /* glsl */ `
  attribute vec4 aC; attribute vec4 aS;
  uniform float uT;
  varying vec2 vUv; varying float vSeed; varying vec3 vRight; varying vec3 vFwd; varying vec3 vW; varying float vLow;
  void main(){
    // trôi quanh đảo rất chậm (vòng ~ 3 giờ)
    float ang = aC.w + uT * 0.0006;
    vec3 c = vec3(cos(ang) * aC.x, aC.y, sin(ang) * aC.x);
    vec3 toCam = cameraPosition - c;
    vec3 fwd = normalize(vec3(toCam.x, 0.0, toCam.z));
    vec3 right = normalize(cross(vec3(0.0, 1.0, 0.0), fwd));
    vec3 w = c + right * position.x * aS.x + vec3(0.0, 1.0, 0.0) * position.y * aS.y;
    vUv = position.xy + vec2(0.0, 0.5);
    vSeed = aS.z; vRight = right; vFwd = fwd; vW = w;
    vLow = smoothstep(10.0, -30.0, c.y);
    gl_Position = projectionMatrix * viewMatrix * vec4(w, 1.0);
  }
`;
const FS = /* glsl */ `
  uniform vec3 uSun; uniform vec3 uZen; uniform vec3 uHor; uniform float uSunK; uniform float uNight; uniform sampler2D uNoiseTex;
  varying vec2 vUv; varying float vSeed; varying vec3 vRight; varying vec3 vFwd; varying vec3 vW; varying float vLow;
  float hs(float x){ return fract(sin(x * 91.7 + vSeed * 13.1) * 43758.5); }
  void main(){
    // toạ độ thẻ: x ∈ [−0,5; 0,5] (chiều rộng), y ∈ [0; 1] (đáy → đỉnh)
    vec2 p = vec2(vUv.x, vUv.y);
    float best = -1.0; vec2 bc = vec2(0.0); float br = 1.0;
    float cov = 0.0;
    for (int i = 0; i < 7; i++) {
      float fi = float(i);
      float t = fi / 6.0;
      // cục giữa to + cao, hai bên nhỏ dần (dáng tháp mây)
      float bell = 1.0 - pow(abs(t - 0.5) * 2.0, 1.6);
      float r = (0.11 + 0.17 * bell) * (0.8 + 0.4 * hs(fi));
      vec2 cc = vec2((t - 0.5) * 0.78 + (hs(fi + 7.0) - 0.5) * 0.06, 0.12 + r * (0.55 + 0.35 * hs(fi + 3.0)) * 1.15);
      vec2 dq = (p - cc) / vec2(r, r * 1.15);
      float d2 = dot(dq, dq);
      float h = 1.0 - d2;
      if (h > best) { best = h; bc = cc; br = r; }
    }
    // mép xói noise + đáy phẳng
    float n = texture2D(uNoiseTex, p * vec2(2.2, 1.6) + vSeed * 3.7).r;
    float edge = best + (n - 0.5) * 0.28;
    float aa = fwidth(edge) * 1.2 + 1e-3;
    cov = smoothstep(-aa, aa, edge) * smoothstep(0.08, 0.16, p.y);
    if (cov < 0.01) discard;
    // pháp tuyến giả của cục cầu gần nhất (không gian thẻ: x phải, y lên, z về máy quay)
    vec2 o = (p - bc) / br;
    vec3 nb = normalize(vec3(o.x, o.y / 1.15, sqrt(max(0.05, 1.0 - dot(o, o)))));
    vec3 Lb = vec3(dot(uSun, vRight), uSun.y, dot(uSun, vFwd));
    float ndl = dot(nb, normalize(Lb));
    float up = smoothstep(-0.12, 0.05, uSun.y);
    float low = 1.0 - smoothstep(0.25, 0.7, uSun.y);
    // ramp 2 bậc mềm (thân mây), đáy tối hơn
    float ramp = smoothstep(-0.25, 0.25, ndl) * 0.7 + 0.3 * smoothstep(0.35, 0.75, ndl);
    vec3 litC = mix(vec3(1.0, 0.97, 0.94), vec3(1.0, 0.82, 0.64), low * up);
    vec3 shC = mix(vec3(0.6, 0.62, 0.86), mix(vec3(0.88, 0.66, 0.74), uHor, 0.45), low * up);
    vec3 col = mix(shC, litC, ramp) * mix(0.86, 1.0, smoothstep(0.1, 0.45, p.y));
    // viền bạc: mặt trời sau đám mây → mép mỏng loé sáng
    vec3 V = normalize(cameraPosition - vW);
    float back = pow(max(dot(-V, uSun), 0.0), 5.0);
    float thin = 1.0 - smoothstep(0.0, 0.22, edge);
    col += vec3(1.0, 0.86, 0.62) * thin * (0.35 + 1.6 * back) * up;
    // đêm: lam tối, trăng soi viền nhẹ
    col = mix(col, mix(uZen, uHor, 0.5) * 0.55 + vec3(0.12, 0.14, 0.22) * ramp, uNight * 0.85);
    // chân mây thấp hoà vào sương chân trời
    vec3 haze = mix(uHor, vec3(1.0, 0.86, 0.7), 0.25 * up) * mix(1.0, 0.4, uNight);
    col = mix(col, haze, vLow * (1.0 - smoothstep(0.1, 0.6, p.y)) * 0.75 + 0.12);
    gl_FragColor = vec4(col, cov * 0.97);
  }
`;

export function HubClouds() {
  const vfx = useGfx((s) => s.vfx);
  const geo = useMemo(() => {
    const n = [8, 13, 18][vfx];
    let seed = 5;
    const R = () => ((seed = (seed * 16807) % 2147483647) / 2147483647);
    const list: { r: number; y: number; a: number; w: number; h: number; s: number }[] = [];
    for (let i = 0; i < n; i++) {
      const a = (i / n) * Math.PI * 2 + R() * 0.35;
      // chừa phía bắc (sau tượng đài trên lối chính) — mây thấp hơn ở đó
      const north = Math.abs(Math.atan2(Math.sin(a + Math.PI / 2), Math.cos(a + Math.PI / 2))) < 0.35;
      const r = 150 + R() * 170;
      const y = north ? -38 + R() * 8 : -36 + R() * 52;
      const w = 80 + R() * 90;
      list.push({ r, y, a, w, h: w * (0.42 + R() * 0.18), s: R() * 10 });
    }
    // xa trước, gần sau (máy quay ở gần tâm) → trộn alpha đúng thứ tự trong cùng một lệnh vẽ
    list.sort((p, q) => q.r - p.r);
    const C = new Float32Array(n * 4);
    const S = new Float32Array(n * 4);
    list.forEach((c, i) => {
      C.set([c.r, c.y, 0, c.a], i * 4);
      S.set([c.w, c.h, c.s, 0], i * 4);
    });
    const q = new THREE.PlaneGeometry(1, 1);
    const g = new THREE.InstancedBufferGeometry();
    g.setIndex(q.index);
    g.setAttribute("position", q.attributes.position);
    g.setAttribute("aC", new THREE.InstancedBufferAttribute(C, 4));
    g.setAttribute("aS", new THREE.InstancedBufferAttribute(S, 4));
    g.instanceCount = n;
    g.boundingSphere = new THREE.Sphere(new THREE.Vector3(), 420);
    q.dispose();
    return g;
  }, [vfx]);
  const mat = useMemo(
    () =>
      new THREE.ShaderMaterial({
        uniforms: { uT: { value: 0 }, uSun: DAY.light, uZen: DAY.zen, uHor: DAY.hor, uSunK: DAY.sunK, uNight: DAY.night, uNoiseTex: { value: noiseTex() } },
        vertexShader: VS,
        fragmentShader: FS,
        transparent: true,
        depthWrite: false,
        toneMapped: false,
        fog: false,
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
  useFrame((state) => {
    mat.uniforms.uT.value = state.clock.elapsedTime;
  });
  return <mesh name="perf:clouds" geometry={geo} material={mat} renderOrder={-0.5} frustumCulled={false} />;
}
