"use client";
/**
 * Sương theo độ cao (Endfield / Frostbite): tích phân GIẢI TÍCH mật độ e^(−|y − y0| / H) dọc tia nhìn — 1 lần đọc depth / pixel,
 * không raymarch. Lớp dày nhất thấp hơn mặt sân (y0 = −3 m) → bay lên thì trời mở ra, lao xuống thì đảo chìm trong sương.
 * Số liệu (Codex 2026-11): H = 6 m, mật độ đỉnh 0,012 m⁻¹ → ở cao độ sân, nhìn ngang 40 / 100 / 180 m còn ~75 / 48 / 27% ánh sáng.
 * Ghép trong không gian HDR tuyến tính, trước bloom / tone mapping. Bầu trời (depth = 1) giữ nguyên (đã có shader trời riêng).
 */
import { forwardRef, useMemo } from "react";
import { useThree } from "@react-three/fiber";
import { Effect, EffectAttribute } from "postprocessing";
import * as THREE from "three";

const FRAG = /* glsl */ `
uniform mat4 uProjInv;
uniform mat4 uCamWorld;
uniform vec3 uEye;
uniform vec3 uFogCol;
uniform vec3 uSunCol;
uniform vec3 uSunDir;
uniform float uY0;
uniform float uInvH;
uniform float uK;

float meanSide(float a, float b) {
  float x = abs(a - b) * uInvH;
  float m = x < 0.001 ? 1.0 - 0.5 * x + x * x / 6.0 : (1.0 - exp(-x)) / x;
  return exp(-min(a, b) * uInvH) * m;
}

void mainImage(const in vec4 inputColor, const in vec2 uv, const in float depth, out vec4 outputColor) {
  if (depth >= 0.99999) { outputColor = inputColor; return; }
  vec4 v = uProjInv * vec4(uv * 2.0 - 1.0, depth * 2.0 - 1.0, 1.0);
  vec3 wp = (uCamWorld * vec4(v.xyz / v.w, 1.0)).xyz;
  // (cameraPosition trong pass hậu kỳ là camera của quad toàn màn hình → dùng vị trí camera cảnh truyền vào)
  vec3 eye = uEye;
  float a = eye.y - uY0, b = wp.y - uY0;
  float avg = a * b < 0.0
    ? mix(meanSide(0.0, abs(b)), meanSide(abs(a), 0.0), abs(a) / (abs(a) + abs(b)))
    : meanSide(abs(a), abs(b));
  float dist = distance(eye, wp);
  float T = exp(-uK * dist * avg);
  // tán xạ về phía mặt trời (sương sáng ấm khi nhìn ngược nắng)
  vec3 dir = (wp - eye) / max(dist, 1e-3);
  float mie = pow(max(dot(dir, uSunDir), 0.0), 6.0);
  vec3 fog = uFogCol + uSunCol * mie * 0.6;
  outputColor = vec4(mix(fog, inputColor.rgb, T), inputColor.a);
}
`;

class HeightFogEffect extends Effect {
  cam: THREE.Camera | null = null;
  constructor() {
    super("HeightFogEffect", FRAG, {
      attributes: EffectAttribute.DEPTH,
      uniforms: new Map<string, THREE.Uniform>([
        ["uProjInv", new THREE.Uniform(new THREE.Matrix4())],
        ["uCamWorld", new THREE.Uniform(new THREE.Matrix4())],
        ["uEye", new THREE.Uniform(new THREE.Vector3())],
        ["uFogCol", new THREE.Uniform(new THREE.Color("#6d5a9e"))],
        ["uSunCol", new THREE.Uniform(new THREE.Color("#ffb98a"))],
        ["uSunDir", new THREE.Uniform(new THREE.Vector3(0.55, 0.28, -0.8).normalize() /* = IMP_SUN */)],
        ["uY0", new THREE.Uniform(-3)],
        ["uInvH", new THREE.Uniform(1 / 6)],
        ["uK", new THREE.Uniform(0.012)],
      ]),
    });
  }
  update() {
    const c = this.cam;
    if (!c) return;
    (this.uniforms.get("uProjInv")!.value as THREE.Matrix4).copy(c.projectionMatrixInverse);
    (this.uniforms.get("uCamWorld")!.value as THREE.Matrix4).copy(c.matrixWorld);
    (this.uniforms.get("uEye")!.value as THREE.Vector3).setFromMatrixPosition(c.matrixWorld);
  }
}

export const HeightFog = forwardRef<HeightFogEffect, object>(function HeightFog(_, ref) {
  const camera = useThree((s) => s.camera);
  const effect = useMemo(() => new HeightFogEffect(), []);
  effect.cam = camera;
  if (process.env.NODE_ENV !== "production" && typeof window !== "undefined") (window as unknown as { __fog: unknown }).__fog = effect;
  return <primitive ref={ref} object={effect} dispose={null} />;
});
