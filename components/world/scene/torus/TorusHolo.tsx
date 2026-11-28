"use client";
/**
 * Ảnh nổi trên Bia Xuyến: ô vuông của thế giới này cuộn lại — dán mép trên vào mép dưới thành ỐNG, rồi uốn ống dán hai đầu
 * thành XUYẾN — lặp lại mỗi 12 s. Hai cặp mép tô đúng màu đường khâu ngoài đảo (san hô: mép đông–tây, ngọc lam: mép bắc–nam);
 * chấm vàng là vị trí của bạn. Biến hình hoàn toàn trong vertex shader trên một tấm lưới 48 × 24.
 */
import { useEffect, useMemo } from "react";
import { useFrame } from "@react-three/fiber";
import * as THREE from "three";
import { useWorld } from "../../store";
import { TORUS_L, tiles } from "@/lib/world/torus";
import { SEAM_X_COLOR, SEAM_Z_COLOR } from "@/lib/world/torusWorld";

const VS = /* glsl */ `
uniform float uA; uniform float uB; varying vec2 vUv; varying vec3 vP;
const float PI = 3.14159265;
void main(){
  vUv = uv;
  float W = 2.0; float H = 1.0;
  float x = (uv.x - 0.5) * W;
  float yv = (uv.y - 0.5) * H;
  // 1) cuộn theo v: mép trên chạm mép dưới → ống (trục song song x)
  float Y = yv; float Z = 0.0;
  if (uA > 0.001) { float R = H / (2.0 * PI * uA); float a = yv / R; Y = R * sin(a); Z = R * (1.0 - cos(a)); }
  // 2) uốn trục ống quanh tâm nằm "dưới" tấm → hai đầu ống chạm nhau → xuyến (bán kính lớn W/2π + R, nhỏ R)
  float X = x;
  if (uB > 0.001) { float Rb = W / (2.0 * PI * uB); float b = x / Rb; float d = Rb + Z; X = d * sin(b); Z = d * cos(b) - Rb; }
  vec3 p = vec3(X, Y, Z - 0.16 * uA);
  vec4 w = modelMatrix * vec4(p, 1.0);
  vP = w.xyz;
  gl_Position = projectionMatrix * viewMatrix * w;
}`;
const FS = /* glsl */ `
uniform vec3 uSX; uniform vec3 uSZ; uniform vec2 uP; uniform float uT; varying vec2 vUv; varying vec3 vP;
void main(){
  vec3 n = normalize(cross(dFdx(vP), dFdy(vP)));
  float lam = 0.45 + 0.55 * abs(dot(n, normalize(vec3(0.4, 0.8, 0.45))));
  vec3 c = mix(vec3(0.16, 0.30, 0.78), vec3(0.42, 0.20, 0.70), vUv.y) * (0.55 + 0.6 * lam);
  // lưới 12 × 6
  vec2 g = abs(fract(vUv * vec2(12.0, 6.0)) - 0.5);
  float grid = smoothstep(0.06, 0.0, 0.5 - max(g.x, g.y));
  c += vec3(0.8, 0.95, 1.0) * grid * 0.55;
  // hai cặp mép
  float ex = smoothstep(0.02, 0.0, min(vUv.x, 1.0 - vUv.x));
  float ez = smoothstep(0.035, 0.0, min(vUv.y, 1.0 - vUv.y));
  c = mix(c, uSX * 2.4, ex);
  c = mix(c, uSZ * 2.4, ez);
  // bạn ở đây
  float d = length((vUv - uP) * vec2(2.0, 1.0));
  c += vec3(1.0, 0.85, 0.4) * (smoothstep(0.035, 0.015, d) * 3.0 + smoothstep(0.09, 0.0, d) * (0.4 + 0.3 * sin(uT * 5.0)));
  gl_FragColor = vec4(c, 0.78 + 0.2 * max(ex, ez));
}`;

function stage(t: number) {
  // 0–2 s phẳng · 2–4,5 cuộn ống · 4,5–7 uốn xuyến · 7–10 giữ (xoay) · 10–12 trải phẳng lại
  const s = (a: number, b: number) => THREE.MathUtils.smoothstep(t, a, b);
  const back = s(10, 11.8);
  return { A: s(2, 4.5) * (1 - back), B: s(4.5, 7) * (1 - back) };
}

export function TorusHolo({ x, y, z }: { x: number; y: number; z: number }) {
  const mat = useMemo(
    () =>
      new THREE.ShaderMaterial({
        uniforms: { uA: { value: 0 }, uB: { value: 0 }, uT: { value: 0 }, uP: { value: new THREE.Vector2() }, uSX: { value: new THREE.Color(SEAM_X_COLOR) }, uSZ: { value: new THREE.Color(SEAM_Z_COLOR) } },
        vertexShader: VS,
        fragmentShader: FS,
        side: THREE.DoubleSide,
        transparent: true,
        depthWrite: false,
        toneMapped: false,
      }),
    [],
  );
  const geo = useMemo(() => new THREE.PlaneGeometry(2, 1, 48, 24), []);
  const copies = useMemo(
    () =>
      tiles(1).map(([i, j]) => {
        const g = new THREE.Group();
        g.position.set(x + i * TORUS_L, y, z + j * TORUS_L);
        const m = new THREE.Mesh(geo, mat);
        m.scale.setScalar(1.7);
        m.frustumCulled = false;
        m.renderOrder = 7;
        g.add(m);
        return g;
      }),
    [geo, mat, x, y, z],
  );
  useEffect(
    () => () => {
      mat.dispose();
      geo.dispose();
    },
    [mat, geo],
  );
  useFrame(() => {
    const t = performance.now() / 1000;
    const { A, B } = stage(t % 12);
    mat.uniforms.uA.value = A;
    mat.uniforms.uB.value = B;
    mat.uniforms.uT.value = t;
    const p = useWorld.getState().player;
    (mat.uniforms.uP.value as THREE.Vector2).set((p.x + TORUS_L / 2) / TORUS_L, 1 - (p.z + TORUS_L / 2) / TORUS_L);
    for (const g of copies) {
      g.rotation.y = Math.sin(t * 0.25) * 0.5;
      g.children[0].rotation.x = B * 0.9;
    }
  });
  return (
    <>
      {copies.map((g, k) => (
        <primitive key={k} object={g} />
      ))}
    </>
  );
}
