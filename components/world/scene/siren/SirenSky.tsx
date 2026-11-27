"use client";
/**
 * Bầu trời Mê cung Hoạ âm — shader thủ tục (không dùng ảnh toàn cảnh):
 *  - nền chàm → tím hồng ở chân trời → lục thẫm phía dưới
 *  - ba lớp "đồi giấy" răng cưa hình sin trôi chậm ở chân trời (mỗi lớp có bóng đổ lệch), mây vỏ sò phía trên
 *  - chấm bán sắc, sao lấp lánh, dải nốt sóng chạy ngang trời
 * Lỗ hổng vòng lặp: xoáy lục axit ở đáy (WRAP_BOT) và trên trần (WRAP_TOP) — rơi qua xoáy đáy thì rơi ra từ xoáy trời.
 * Màn sân khấu tại WRAP_R: hiện rõ khi người chơi tới gần (đi xuyên → bước ra ở màn đối tâm).
 */
import { useEffect, useMemo, useRef } from "react";
import { useFrame, useThree } from "@react-three/fiber";
import * as THREE from "three";
import { useWorld } from "../../store";
import { WRAP_BOT, WRAP_R, WRAP_TOP } from "@/lib/world/sirenMaze";

/** màu sương / chân trời dùng chung (Siren.tsx đặt cho scene.fog) */
export const SIREN_FOG = "#6a3f8f";

const SKY_VERT = /* glsl */ `
varying vec3 vDir;
void main(){
  vDir = normalize(position);
  vec4 p = projectionMatrix * modelViewMatrix * vec4(position, 1.0);
  gl_Position = p.xyww;
}`;
const SKY_FRAG = /* glsl */ `
uniform float uTime;
varying vec3 vDir;
float hash(vec2 p){ return fract(sin(dot(p, vec2(127.1, 311.7))) * 43758.5453); }
float aa(float x, float e){ float w = fwidth(x) + 1e-4; return smoothstep(e - w, e + w, x); }
void main(){
  vec3 d = normalize(vDir);
  float y = d.y;
  float th = atan(d.z, d.x);
  // nền
  vec3 top = vec3(0.07, 0.04, 0.2);
  vec3 mid = vec3(0.32, 0.12, 0.45);
  vec3 hor = vec3(0.95, 0.45, 0.72);
  vec3 low = vec3(0.03, 0.16, 0.14);
  vec3 col = y > 0.0 ? mix(hor, mix(mid, top, smoothstep(0.25, 0.9, y)), smoothstep(0.0, 0.25, y)) : mix(hor * 0.55, low, smoothstep(0.0, 0.35, -y));
  // chấm bán sắc theo độ sáng (in giấy)
  vec2 g = vec2(th * 40.0, y * 40.0);
  float dots = 1.0 - aa(length(fract(g) - 0.5), 0.12 + 0.25 * smoothstep(0.5, 0.0, abs(y)));
  col = mix(col, col * 1.25 + 0.03, dots * 0.35);
  // sao
  vec2 sc = floor(vec2(th * 90.0, y * 90.0));
  float st = step(0.985, hash(sc)) * smoothstep(0.08, 0.4, y);
  col += st * (0.6 + 0.4 * sin(uTime * 3.0 + hash(sc + 3.0) * 30.0)) * vec3(1.0, 0.92, 0.8);
  // dải nốt sóng chạy ngang trời
  float wave = y - (0.32 + 0.05 * sin(th * 5.0 + uTime * 0.15));
  col = mix(col, vec3(1.0, 0.82, 0.45), (1.0 - aa(abs(wave), 0.004)) * 0.8);
  col = mix(col, vec3(1.0, 0.82, 0.45), (1.0 - aa(abs(wave - 0.025), 0.002)) * 0.5);
  // ba lớp đồi giấy ở chân trời (xa → gần), răng sin + bóng đổ
  vec3 layers[3];
  layers[0] = vec3(0.55, 0.25, 0.62);
  layers[1] = vec3(0.86, 0.33, 0.58);
  layers[2] = vec3(0.24, 0.62, 0.66);
  for (int i = 0; i < 3; i++) {
    float fi = float(i);
    float k = 3.0 + fi * 2.0;
    float h = 0.12 - fi * 0.05 + 0.035 * sin(th * k + uTime * (0.02 + fi * 0.015) + fi * 1.7) + 0.012 * sin(th * k * 3.1 + fi);
    float scal = 0.012 * pow(abs(sin(th * k * 6.0)), 0.5);
    float edge = h + scal;
    float shadow = 1.0 - aa(y, edge - 0.012);
    col = mix(col, col * 0.55, shadow * 0.6);
    float inside = 1.0 - aa(y, edge);
    vec3 lc = layers[i];
    lc *= 0.92 + 0.08 * aa(fract(th * 30.0 + y * 8.0), 0.5);
    col = mix(col, lc, inside);
    col = mix(col, vec3(1.0, 0.92, 0.8), inside * (1.0 - aa(edge - y, 0.004)) * 0.9);
  }
  // mây vỏ sò (cắt giấy) trôi
  float cy = y - 0.5;
  float sc2 = 0.03 * pow(abs(sin(th * 9.0 + uTime * 0.03)), 0.5) + 0.02 * sin(th * 2.0 - uTime * 0.02);
  float cloud = (1.0 - aa(abs(cy - sc2), 0.035)) * smoothstep(0.6, 1.0, sin(th * 2.0 + uTime * 0.02));
  col = mix(col, vec3(0.98, 0.72, 0.86), cloud * 0.85);
  // xoáy thiên đỉnh / thiên để (gợi lỗ hổng vòng lặp)
  float pole = smoothstep(0.82, 0.98, abs(y));
  float sw = sin(th * 3.0 + (1.0 - abs(y)) * 60.0 - uTime * 2.0);
  col = mix(col, mix(vec3(0.08, 0.3, 0.2), vec3(0.66, 1.0, 0.33), aa(sw, 0.3)), pole * 0.8);
  gl_FragColor = vec4(col, 1.0);
}`;

export function SirenSky() {
  const mesh = useRef<THREE.Mesh>(null);
  const mat = useMemo(() => new THREE.ShaderMaterial({ vertexShader: SKY_VERT, fragmentShader: SKY_FRAG, uniforms: { uTime: { value: 0 } }, side: THREE.BackSide, depthWrite: false, fog: false }), []);
  useEffect(() => () => mat.dispose(), [mat]);
  // vẽ SAU mọi vật đục (renderOrder 1, độ sâu = 1) → chỉ tô phần nền trống, che luôn bầu trời ảnh chung của WorldClient
  // bám theo máy quay đang vẽ (cả máy quay ảo của cổng) → không bao giờ ra khỏi bầu trời
  useEffect(() => {
    const m = mesh.current;
    if (!m) return;
    m.onBeforeRender = (_r, _s, cam) => {
      m.position.copy(cam.position);
      m.updateMatrixWorld();
    };
  }, []);
  useFrame((_, dt) => {
    mat.uniforms.uTime.value += dt;
  });
  return (
    <mesh ref={mesh} material={mat} renderOrder={1} frustumCulled={false} name="perf:sky">
      <sphereGeometry args={[400, 48, 24]} />
    </mesh>
  );
}

const VORTEX_FRAG = /* glsl */ `
uniform float uTime;
varying vec2 vUv;
float aa(float x, float e){ float w = fwidth(x) + 1e-4; return smoothstep(e - w, e + w, x); }
void main(){
  vec2 p = vUv * 2.0 - 1.0;
  float r = length(p);
  if (r > 1.0) discard;
  float a = atan(p.y, p.x);
  // xoắn ốc logarit 3 nhánh (cánh tay xoáy rõ khi nhìn xiên)
  float tw = a * 3.0 + log(r + 0.02) * 3.2 - uTime * 0.9;
  float band = aa(sin(tw), 0.55);
  float band2 = aa(sin(tw * 2.0 + 1.3), 0.85);
  vec3 deep = vec3(0.03, 0.12, 0.09);
  vec3 acid = vec3(0.66, 1.0, 0.33);
  vec3 col = mix(deep, acid * 1.1, band * 0.7);
  col = mix(col, vec3(0.9, 1.0, 0.75) * 1.6, band2 * band * 0.35);
  // mắt xoáy sáng ở tâm
  col += acid * 2.0 * smoothstep(0.1, 0.0, r);
  float alpha = (1.0 - smoothstep(0.35, 1.0, r)) * 0.75;
  gl_FragColor = vec4(col, alpha);
}`;
const PLAIN_VERT = /* glsl */ `
varying vec2 vUv;
void main(){ vUv = uv; gl_Position = projectionMatrix * modelViewMatrix * vec4(position, 1.0); }`;

/** Xoáy lỗ hổng ở đáy và trên trời */
export function LoopVortices() {
  const mat = useMemo(
    () => new THREE.ShaderMaterial({ vertexShader: PLAIN_VERT, fragmentShader: VORTEX_FRAG, uniforms: { uTime: { value: 0 } }, transparent: true, depthWrite: false, side: THREE.DoubleSide, fog: false, toneMapped: false }),
    [],
  );
  useEffect(() => () => mat.dispose(), [mat]);
  useFrame((_, dt) => {
    mat.uniforms.uTime.value += dt;
  });
  return (
    <group name="perf:vortex">
      <mesh material={mat} rotation-x={-Math.PI / 2} position-y={WRAP_BOT + 2} frustumCulled={false}>
        <planeGeometry args={[220, 220]} />
      </mesh>
      <mesh material={mat} rotation-x={Math.PI / 2} position-y={WRAP_TOP - 2} frustumCulled={false}>
        <planeGeometry args={[220, 220]} />
      </mesh>
    </group>
  );
}

const CURTAIN_VERT = /* glsl */ `
varying vec3 vW;
void main(){ vec4 w = modelMatrix * vec4(position, 1.0); vW = w.xyz; gl_Position = projectionMatrix * viewMatrix * w; }`;
const CURTAIN_FRAG = /* glsl */ `
uniform vec3 uPlayer;
uniform float uTime;
varying vec3 vW;
void main(){
  float th = atan(vW.z, vW.x);
  // nếp màn nhung + hoa văn sóng
  float fold = 0.5 + 0.5 * sin(th * 260.0 + sin(vW.y * 0.3 + uTime) * 0.6);
  vec3 col = mix(vec3(0.42, 0.05, 0.22), vec3(0.85, 0.2, 0.45), fold);
  float wave = abs(fract(vW.y * 0.08 + 0.15 * sin(th * 40.0)) - 0.5);
  col = mix(col, vec3(1.0, 0.8, 0.4), (1.0 - smoothstep(0.02, 0.035, wave)) * 0.8);
  float d = distance(vW, uPlayer);
  float a = 0.05 + 0.8 * (1.0 - smoothstep(6.0, 28.0, d));
  gl_FragColor = vec4(col, a);
}`;

/** Màn sân khấu bao quanh — chạm vào là bước ra phía đối tâm */
export function StageCurtain() {
  const mat = useMemo(
    () => new THREE.ShaderMaterial({ vertexShader: CURTAIN_VERT, fragmentShader: CURTAIN_FRAG, uniforms: { uPlayer: { value: new THREE.Vector3() }, uTime: { value: 0 } }, transparent: true, depthWrite: false, side: THREE.DoubleSide, fog: false }),
    [],
  );
  useEffect(() => () => mat.dispose(), [mat]);
  useFrame((_, dt) => {
    mat.uniforms.uPlayer.value.copy(useWorld.getState().player);
    mat.uniforms.uTime.value += dt;
  });
  return (
    <mesh material={mat} position-y={(WRAP_BOT + WRAP_TOP) / 2} frustumCulled={false} name="perf:curtain">
      <cylinderGeometry args={[WRAP_R, WRAP_R, WRAP_TOP - WRAP_BOT, 96, 1, true]} />
    </mesh>
  );
}

/** Đặt sương theo tông mê cung khi vào cảnh, trả lại khi rời */
export function SirenFog() {
  const scene = useThree((s) => s.scene);
  useEffect(() => {
    const f = scene.fog as THREE.Fog | null;
    if (!f || !(f as THREE.Fog).isFog) return;
    const prev = { color: f.color.clone(), near: f.near, far: f.far };
    f.color.set(SIREN_FOG);
    f.near = 55;
    f.far = 210;
    return () => {
      f.color.copy(prev.color);
      f.near = prev.near;
      f.far = prev.far;
    };
  }, [scene]);
  return null;
}
