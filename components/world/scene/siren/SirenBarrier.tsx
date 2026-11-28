"use client";
/**
 * Nhánh W — "kết giới" khi bước vào Mê cung Hoạ âm: một tờ giấy ngà in bán sắc che màn hình, năm dòng khuông nhạc kéo căng
 * từ tâm ra hai mép (lò xo vượt đích), rồi tờ giấy gấp xếp (accordion) thành các dải dọc, gập dần từ giữa ra ngoài để lộ thế giới.
 * 1,5 s (bắt đầu khi màn tải đã tắt); chạm / bấm phím bất kỳ → tua nhanh ×5 (bỏ qua). Giảm chuyển động: chỉ mờ dần 0,45 s, không kéo / gập.
 * Một tứ giác toàn màn hình (toạ độ clip), chỉ tồn tại trong lúc chuyển — xong thì gỡ hẳn (0 lệnh vẽ).
 * Thời gian lấy từ HARMONIC.time (không đồng hồ riêng).
 */
import { useEffect, useMemo, useRef, useState } from "react";
import { useFrame } from "@react-three/fiber";
import { useProgress } from "@react-three/drei";
import * as THREE from "three";
import { HARMONIC } from "@/lib/world/harmonicState";
import { barrierProgress } from "@/lib/world/sirenWorld";
import { reduceMotion } from "./SirenGravity";

const VERT = /* glsl */ `
varying vec2 vUv;
// ghi độ sâu phẳng sát mặt gần: viền mực (Ink: Laplacian độ sâu) thấy tờ giấy là mặt phẳng → không vẽ viền cảnh xuyên qua giấy
void main(){ vUv = uv; gl_Position = vec4(position.xy, -0.9999, 1.0); }`;
const FRAG = /* glsl */ `
uniform float uP, uAspect, uReduced;
varying vec2 vUv;
const vec3 C_VOID = vec3(0.094, 0.082, 0.122);
const vec3 C_IVORY = vec3(0.875, 0.831, 0.71);
const vec3 C_CARMINE = vec3(0.647, 0.2, 0.275);
const vec3 C_BRASS = vec3(0.718, 0.608, 0.302);
const float N = 7.0;
float aaStep(float e, float x){ float w = fwidth(x) + 1e-5; return smoothstep(e - w, e + w, x); }
float backOut(float t){ float c = 1.9; t -= 1.0; return 1.0 + (c + 1.0) * t * t * t + c * t * t; }
// giấy in: ngà + chấm bán sắc son nhạt + vết xơ giấy
vec3 paper(vec2 q){
  vec2 g = q * vec2(uAspect, 1.0) * 46.0;
  float d = length(fract(g) - 0.5);
  float dotR = 0.18 + 0.18 * smoothstep(0.9, 0.1, length(q - 0.5));
  vec3 c = mix(C_IVORY, mix(C_IVORY, C_CARMINE, 0.35), 1.0 - aaStep(dotR, d));
  return c * (0.96 + 0.04 * sin(q.x * 300.0 + sin(q.y * 80.0) * 3.0));
}
// năm dòng khuông kéo căng từ tâm: nửa độ dài theo lò xo vượt đích
float staff(vec2 q, float t){
  float half_ = 0.62 * backOut(clamp(t, 0.0, 1.0));
  float x = abs(q.x - 0.5) * uAspect;
  float on = 1.0 - aaStep(half_ * uAspect, x);
  float l = 0.0;
  for (int i = 0; i < 5; i++) {
    float y = 0.5 + (float(i) - 2.0) * 0.038;
    l = max(l, 1.0 - aaStep(0.0028, abs(q.y - y)));
  }
  return l * on;
}
void main(){
  if (uReduced > 0.5) {
    vec3 c = paper(vUv);
    c = mix(c, C_VOID, staff(vUv, 1.0));
    gl_FragColor = vec4(c, 1.0 - smoothstep(0.0, 1.0, uP));
    return;
  }
  // 0 → 0,32: khuông kéo căng; 0,28 → 0,92: gấp xếp từ giữa ra
  float tStaff = uP / 0.32;
  float i = floor(vUv.x * N);
  float x0 = i / N;
  float fromMid = abs(i - (N - 1.0) * 0.5) / ((N - 1.0) * 0.5);
  float th = clamp((uP - 0.28 - 0.18 * fromMid) / 0.46, 0.0, 1.0);
  th = th * th * (3.0 - 2.0 * th) * 1.5707963;
  float w = cos(th);
  // dải chẵn neo mép trái, lẻ neo mép phải (nếp gấp xếp)
  float odd = mod(i, 2.0);
  float lx = (vUv.x - x0) * N;            // 0…1 trong dải
  float local = odd > 0.5 ? (lx - (1.0 - w)) / w : lx / w;
  if (local < 0.0 || local > 1.0 || w < 0.002) discard;
  vec2 q = vec2(x0 + local / N, vUv.y);
  vec3 c = paper(q);
  c = mix(c, C_VOID, staff(q, tStaff) * 0.92);
  // vòng giấy cắt đồng thau ở tâm (mặt trời / đĩa than thu nhỏ), mở theo khuông
  vec2 cq = (q - 0.5) * vec2(uAspect, 1.0);
  float rr = length(cq);
  float ring = (1.0 - aaStep(0.006, abs(rr - 0.2 * clamp(tStaff * 1.2, 0.0, 1.0)))) * step(0.02, tStaff);
  c = mix(c, C_BRASS, ring);
  // tô bóng nếp gấp: dải chẵn tối dần, dải lẻ sáng hơn + mép gấp đậm
  float shade = odd > 0.5 ? 1.0 - 0.18 * sin(th) : 1.0 - 0.5 * sin(th);
  c *= shade;
  float crease = 1.0 - aaStep(0.02, min(local, 1.0 - local));
  c = mix(c, C_VOID, crease * sin(th) * 0.6);
  gl_FragColor = vec4(c, 1.0);
}`;

export function Barrier() {
  const [done, setDone] = useState(false);
  const reduced = useMemo(() => reduceMotion(), []);
  const st = useRef({ start: -1, last: 0, elapsed: 0, speed: 1, idle: 0 });
  const mat = useMemo(
    () =>
      new THREE.ShaderMaterial({
        vertexShader: VERT,
        fragmentShader: FRAG,
        uniforms: { uP: { value: 0 }, uAspect: { value: 1 }, uReduced: { value: reduced ? 1 : 0 } },
        transparent: true,
        // WebGL không ghi độ sâu khi tắt depth test → bật test nhưng luôn đạt
        depthTest: true,
        depthFunc: THREE.AlwaysDepth,
        depthWrite: true,
        toneMapped: false,
        fog: false,
      }),
    [reduced],
  );
  useEffect(() => () => mat.dispose(), [mat]);
  // bỏ qua: chạm / bấm phím → tua nhanh
  useEffect(() => {
    if (done) return;
    const skip = () => void (st.current.speed = 5);
    const evs = ["pointerdown", "keydown", "touchstart"] as const;
    evs.forEach((e) => window.addEventListener(e, skip, { passive: true }));
    return () => evs.forEach((e) => window.removeEventListener(e, skip));
  }, [done]);
  useFrame(({ size }) => {
    if (done) return;
    const s = st.current;
    const t = HARMONIC.time;
    if (s.start < 0) {
      s.start = t;
      s.last = t;
    }
    // chặn bước lớn (khung đầu nặng do nạp shader) để không nhảy cóc qua màn chuyển
    const step = Math.min(t - s.last, 1 / 20);
    s.last = t;
    // chờ màn tải (LoadingScreen) tắt hẳn: tờ giấy giữ nguyên che màn hình, ~1,1 s sau khi hết tải mới mở (tối đa chờ 20 s)
    s.idle = useProgress.getState().active ? 0 : s.idle + step;
    if (s.idle < 1.1 && t - s.start < 20 && s.speed === 1) {
      mat.uniforms.uP.value = 0;
      mat.uniforms.uAspect.value = size.width / Math.max(1, size.height);
      return;
    }
    s.elapsed += step * s.speed;
    const p = barrierProgress(s.elapsed, reduced);
    if (p === null) {
      setDone(true);
      return;
    }
    mat.uniforms.uP.value = p;
    mat.uniforms.uAspect.value = size.width / Math.max(1, size.height);
  });
  if (done) return null;
  return (
    <mesh material={mat} frustumCulled={false} renderOrder={10000} name="perf:barrier">
      <planeGeometry args={[2, 2]} />
    </mesh>
  );
}
