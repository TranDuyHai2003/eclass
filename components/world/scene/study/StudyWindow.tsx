"use client";
/**
 * Khung cảnh ngoài cửa sổ: hoàng hôn tím–cam sau mưa, phố mái nhà xa có ô cửa sáng đèn, mưa rơi chéo
 * + giọt nước đọng / chảy trên kính. Tất cả là MỘT tấm shader phía sau tường bắc (tường che phần giữa)
 * và MỘT tấm kính (hai ô cửa gộp) — 2 lệnh vẽ. Chế độ tập trung: mưa chậm lại (ít chuyển động ở rìa tầm nhìn).
 */
import { useEffect, useMemo, useRef } from "react";
import { useFrame } from "@react-three/fiber";
import * as THREE from "three";
import { mergeGeometries } from "three/examples/jsm/utils/BufferGeometryUtils.js";
import { SR, WINDOWS } from "@/lib/world/studyRoom";
import { useStudy } from "./studyState";

const COMMON = /* glsl */ `
  float h1(float n) { return fract(sin(n * 127.1) * 43758.5453); }
  float h2(vec2 p) { return fract(sin(dot(p, vec2(127.1, 311.7))) * 43758.5453); }
  float vn(vec2 p) { vec2 i = floor(p), f = fract(p); f = f * f * (3.0 - 2.0 * f);
    return mix(mix(h2(i), h2(i + vec2(1, 0)), f.x), mix(h2(i + vec2(0, 1)), h2(i + vec2(1, 1)), f.x), f.y); }
`;

const outsideShader = {
  uniforms: { uTime: { value: 0 }, uRain: { value: 1 } },
  vertexShader: /* glsl */ `
    varying vec2 vUv;
    void main() { vUv = uv; gl_Position = projectionMatrix * modelViewMatrix * vec4(position, 1.0); }`,
  fragmentShader: /* glsl */ `
    uniform float uTime;
    uniform float uRain;
    varying vec2 vUv;
    ${COMMON}
    void main() {
      vec2 p = vUv;
      // trời hoàng hôn: chàm sẫm trên cao → hồng tím → cam vàng sát chân trời
      vec3 top = vec3(0.16, 0.13, 0.32);
      vec3 mid = vec3(0.62, 0.34, 0.48);
      vec3 low = vec3(1.0, 0.62, 0.38);
      float y = p.y;
      vec3 col = mix(low, mid, smoothstep(0.28, 0.55, y));
      col = mix(col, top, smoothstep(0.55, 0.95, y));
      // mặt trời đỏ cam lặn sau mây
      vec2 sp = vec2(0.36, 0.33);
      float d = length((p - sp) * vec2(1.9, 1.0));
      col += vec3(1.0, 0.55, 0.25) * (smoothstep(0.06, 0.0, d) * 0.9 + exp(-d * 7.0) * 0.45);
      // dải mây trôi chậm
      float c = vn(vec2(p.x * 6.0 + uTime * 0.012, p.y * 18.0)) * vn(vec2(p.x * 2.0 - uTime * 0.006, p.y * 7.0));
      col = mix(col, mix(vec3(0.45, 0.27, 0.42), vec3(1.0, 0.72, 0.55), smoothstep(0.5, 0.25, y)), smoothstep(0.25, 0.55, c) * smoothstep(0.32, 0.5, y) * 0.75);
      // phố mái nhà hai lớp (xa nhạt, gần đậm) + ô cửa sáng đèn vàng
      float bx = floor(p.x * 34.0);
      float hb = 0.2 + h1(bx) * 0.12 + step(0.85, h1(bx + 7.0)) * 0.1;
      float far = step(y, hb);
      col = mix(col, vec3(0.36, 0.24, 0.38), far * 0.85);
      float nx = floor(p.x * 18.0);
      float hn = 0.12 + h1(nx + 31.0) * 0.1;
      // mái dốc kiểu phố cổ
      float roof = hn + (0.5 - abs(fract(p.x * 18.0) - 0.5)) * 0.05;
      float near = step(y, roof);
      col = mix(col, vec3(0.14, 0.1, 0.18), near);
      vec2 cell = vec2(p.x * 120.0, y * 90.0);
      float win = step(0.72, h2(floor(cell))) * step(0.25, fract(cell.x)) * step(fract(cell.x), 0.75) * step(0.3, fract(cell.y)) * step(fract(cell.y), 0.8);
      col += vec3(1.0, 0.72, 0.35) * win * near * step(y, roof - 0.015) * 0.9;
      col += vec3(1.0, 0.75, 0.45) * win * far * (1.0 - near) * step(y, hb - 0.01) * 0.35;
      // mưa rơi chéo: các vệt mảnh, nhiều lớp
      float rain = 0.0;
      for (int k = 0; k < 3; k++) {
        float fk = float(k);
        vec2 q = vec2(p.x * (90.0 + fk * 50.0) + p.y * 8.0, p.y * (6.0 + fk * 3.0) + uTime * (2.2 + fk * 0.9));
        float colId = floor(q.x);
        float off = h1(colId + fk * 17.0);
        float s = fract(q.y + off * 10.0);
        rain += smoothstep(0.92, 1.0, s) * step(0.55, h1(colId * 1.7 + fk)) * (0.35 - fk * 0.08);
      }
      col += vec3(0.75, 0.8, 0.95) * rain * uRain;
      // hơi nước: ngoài trời mờ, hơi sương sát chân trời
      col = mix(col, vec3(0.7, 0.5, 0.55), smoothstep(0.35, 0.05, y) * 0.25);
      gl_FragColor = vec4(col, 1.0);
      #include <colorspace_fragment>
    }`,
};

const glassShader = {
  uniforms: { uTime: { value: 0 }, uRain: { value: 1 } },
  vertexShader: /* glsl */ `
    varying vec2 vUv;
    void main() { vUv = uv; gl_Position = projectionMatrix * modelViewMatrix * vec4(position, 1.0); }`,
  fragmentShader: /* glsl */ `
    uniform float uTime;
    uniform float uRain;
    varying vec2 vUv;
    ${COMMON}
    void main() {
      vec2 p = vUv * vec2(2.4, 3.4);
      float a = 0.0;
      // giọt đọng tĩnh (lưới ô ngẫu nhiên)
      vec2 g = p * 9.0;
      vec2 id = floor(g);
      vec2 f = fract(g) - 0.5;
      vec2 o = vec2(h2(id), h2(id + 3.1)) - 0.5;
      float r = 0.08 + h2(id + 7.7) * 0.14;
      float dd = length(f - o * 0.6);
      float drop = smoothstep(r, r * 0.4, dd) * step(0.45, h2(id + 1.3));
      a += drop * 0.5;
      // giọt chảy dài: theo cột, trượt xuống theo thời gian, để lại vệt
      vec2 g2 = vec2(p.x * 5.0, p.y);
      float cid = floor(g2.x);
      float speed = 0.12 + h1(cid) * 0.2;
      float yy = fract(p.y * 0.4 + uTime * speed * uRain + h1(cid + 2.0));
      float fx = fract(g2.x) - 0.5 + sin(p.y * 6.0 + cid) * 0.06;
      float head = smoothstep(0.06, 0.0, length(vec2(fx, (yy - 0.08) * 1.4)));
      float trail = smoothstep(0.025, 0.0, abs(fx)) * smoothstep(0.08, 0.6, yy) * (1.0 - yy) * 0.6;
      a += (head + trail) * step(0.4, h1(cid + 9.0));
      // kính mờ hơi nước nhẹ phía dưới
      a += smoothstep(0.35, 0.0, vUv.y) * 0.12;
      gl_FragColor = vec4(vec3(0.95, 0.9, 1.0), clamp(a, 0.0, 0.7) * 0.75);
    }`,
};

export function StudyWindow() {
  const outside = useMemo(() => new THREE.ShaderMaterial({ ...outsideShader, uniforms: THREE.UniformsUtils.clone(outsideShader.uniforms), fog: false }), []);
  const glass = useMemo(() => new THREE.ShaderMaterial({ ...glassShader, uniforms: THREE.UniformsUtils.clone(glassShader.uniforms), transparent: true, depthWrite: false }), []);
  const glassGeo = useMemo(
    () =>
      mergeGeometries(
        WINDOWS.map((w) => new THREE.PlaneGeometry(w.hw * 2, w.y1 - w.y0).translate(w.x, (w.y0 + w.y1) / 2, -SR.D - 0.04)),
        false,
      ),
    [],
  );
  const t = useRef(0);
  const rain = useRef(1);
  useEffect(
    () => () => {
      outside.dispose();
      glass.dispose();
      glassGeo.dispose();
    },
    [outside, glass, glassGeo],
  );
  useFrame((_, dt) => {
    const focus = useStudy.getState().focus;
    rain.current += ((focus ? 0.45 : 1) - rain.current) * Math.min(1, dt * 2);
    t.current += Math.min(0.05, dt) * rain.current;
    outside.uniforms.uTime.value = t.current;
    glass.uniforms.uTime.value = t.current;
  });
  return (
    <group>
      {/* phía sau tường bắc, đủ rộng để nhìn xiên qua cửa sổ vẫn thấy trời */}
      {/* chân trời (mái phố, uv.y ≈ 0,3) ngang tầm mắt người ngồi nhìn qua cửa sổ */}
      <mesh position={[0, 4.6, -SR.D - 5]} material={outside}>
        <planeGeometry args={[34, 15]} />
      </mesh>
      <mesh geometry={glassGeo} material={glass} renderOrder={2} />
    </group>
  );
}
