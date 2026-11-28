"use client";
/**
 * Thấu kính hấp dẫn quanh hố đen (hậu kỳ, chỉ ở Hư Không Nghịch Lý): điểm ảnh ở góc θ quanh tâm hố đen thật ra đến từ nguồn
 * ở góc β = θ − θE²/θ (phương trình thấu kính điểm) → sao và tinh vân phía sau bị kéo dãn thành vòng cung quanh hố;
 * thêm một chút xoắn (kéo hệ quy chiếu của hố đen quay). Chỉ uốn bầu trời (độ sâu = xa vô cực), vật ở gần giữ nguyên.
 * Phải đứng ĐẦU chuỗi hậu kỳ vì đọc thẳng inputBuffer.
 */
import { forwardRef, useMemo } from "react";
import { useFrame } from "@react-three/fiber";
import { Effect, EffectAttribute } from "postprocessing";
import * as THREE from "three";
import { fxNow, fxReducedMotion } from "./fxClock";

/** Cảnh cập nhật mỗi khung hình: tâm hố đen (uv màn hình), bán kính bắt đầu uốn + bán kính Einstein (đơn vị chiều cao màn hình) */
export const LENS = { on: 0, center: new THREE.Vector2(0.5, 0.5), rin: 0.1, re: 0.06 };
/** Chấn màn hình khi đòn nặng trúng: zoom blur hướng tâm + tách màu (chromatic aberration), tắt dần ~0,3 s */
export const IMPACT = { k: 0 };
export function impact(k: number) {
  IMPACT.k = Math.max(IMPACT.k, Math.min(1.2, k));
}
/**
 * SÓNG XUNG KÍCH thật: một vòng nở ra từ điểm va chạm trên màn hình, điểm ảnh trong dải vòng bị đẩy lệch theo hướng toả
 * (méo không gian kiểu anime sau vụ nổ); vị trí 3D được chiếu ra màn hình mỗi khung (component Lensing nằm trong Canvas).
 */
export const SHOCK = { t0: -1e9, k: 0, world: new THREE.Vector3(), uv: new THREE.Vector2(0.5, 0.5), dur: 0.7, vis: 1 };
/** khe thứ hai (T24): hai sóng xung kích chồng nhau (vd. xoắn sập + thiên thạch rơi cùng lúc) không cướp khe của nhau */
export const SHOCK2 = { t0: -1e9, k: 0, world: new THREE.Vector3(), uv: new THREE.Vector2(0.5, 0.5), dur: 0.7, vis: 1 };
const shockLive = (s: typeof SHOCK, now: number) => now - s.t0 < s.dur * 1000;
export function shockwave(at: THREE.Vector3, k = 1) {
  const now = fxNow();
  // khe rảnh trước; cả hai đang chạy → ghi đè khe cũ hơn
  const s = !shockLive(SHOCK, now) ? SHOCK : !shockLive(SHOCK2, now) ? SHOCK2 : SHOCK.t0 <= SHOCK2.t0 ? SHOCK : SHOCK2;
  s.world.copy(at);
  s.k = Math.min(1.5, k);
  s.t0 = now;
  if (s === SHOCK2) SHOCK2.dur = SHOCK.dur;
}
// DEV: thử sóng xung kích từ console — window.__shock(x, y, z, k)
if (typeof window !== "undefined" && process.env.NODE_ENV !== "production")
  (window as unknown as { __shock: unknown }).__shock = (x: number, y: number, z: number, k = 1, dur = 0.7) => {
    SHOCK.dur = dur;
    shockwave(new THREE.Vector3(x, y, z), k);
  };

const FRAG = /* glsl */ `
uniform vec2 uC;
uniform float uRin;
uniform float uRE;
uniform float uOn;
uniform float uAspect;
uniform float uImpact;
uniform vec3 uShock; // xy = tâm (uv), z = tiến trình 0..1 (âm = tắt)
uniform float uShockK;
uniform vec3 uShock2; // khe thứ hai
uniform float uShockK2;
vec2 shockUV(vec2 uv, vec3 sh, float shk, out float glow) {
  glow = 0.0;
  if (sh.z < 0.0 || sh.z > 1.0) return uv;
  vec2 d = uv - sh.xy; d.x *= uAspect;
  float r = length(d);
  float R = 0.04 + sh.z * 0.62;
  float w = 0.035 + sh.z * 0.05;
  float x = (r - R) / w;
  if (abs(x) >= 1.0) return uv;
  float fade = (1.0 - sh.z) * (1.0 - sh.z) * shk;
  vec2 n = d / max(r, 1e-4); n.x /= uAspect;
  float prof = x * (1.0 - x * x) * (1.0 - x * x);
  glow = (1.0 - x * x) * (1.0 - x * x) * fade * 0.28;
  return uv - n * prof * 0.075 * fade;
}
/** mẫu ảnh qua vòng sóng: lệch R/B ngược nhau theo hướng toả (viền cầu vồng mảnh kiểu anime) */
vec3 shockSample(vec2 uv, vec2 suv, float glow) {
  vec2 off = (suv - uv) * 0.35;
  vec3 c = vec3(texture2D(inputBuffer, suv + off).r, texture2D(inputBuffer, suv).g, texture2D(inputBuffer, suv - off).b);
  return c + vec3(1.0, 0.95, 0.85) * glow;
}
vec3 impactBlur(vec2 uv) {
  // zoom blur hướng tâm màn hình + tách kênh đỏ / lam theo bán kính
  vec2 d = uv - 0.5;
  vec3 acc = vec3(0.0);
  float s = uImpact * 0.09;
  for (int i = 0; i < 8; i++) {
    float f = float(i) / 7.0;
    vec2 p = 0.5 + d * (1.0 - s * f);
    acc.r += texture2D(inputBuffer, 0.5 + (p - 0.5) * (1.0 + uImpact * 0.012)).r;
    acc.g += texture2D(inputBuffer, p).g;
    acc.b += texture2D(inputBuffer, 0.5 + (p - 0.5) * (1.0 - uImpact * 0.012)).b;
  }
  acc /= 8.0;
  float vig = smoothstep(0.2, 0.75, length(d));
  return acc * (1.0 + uImpact * 0.18) + vec3(1.0, 0.95, 0.9) * uImpact * 0.06 * (1.0 - vig);
}
void mainImage(const in vec4 inputColor, const in vec2 uv, const in float depth, out vec4 outputColor) {
  float sg, sg2;
  vec2 suv0 = shockUV(uv, uShock, uShockK, sg);
  suv0 = shockUV(suv0, uShock2, uShockK2, sg2);
  sg += sg2;
  outputColor = sg > 0.0 ? vec4(shockSample(uv, suv0, sg), inputColor.a) : inputColor;
  if (uImpact > 0.01) {
    outputColor = vec4(impactBlur(suv0) + vec3(1.0, 0.95, 0.85) * sg, inputColor.a);
    return;
  }
  if (uOn < 0.5 || depth < 0.9999) return;
  vec2 d = uv - uC; d.x *= uAspect;
  float r = length(d);
  float k = smoothstep(uRin, uRin * 1.25, r) * (1.0 - smoothstep(uRin * 3.2, uRin * 5.0, r));
  if (k <= 0.0) return;
  float rs = max(r, 1e-4);
  float beta = max(r - uRE * uRE / rs, 0.0);
  float ang = 0.5 * uRE * uRE / (rs * rs);
  vec2 n = d / rs;
  vec2 rn = vec2(n.x * cos(ang) - n.y * sin(ang), n.x * sin(ang) + n.y * cos(ang));
  vec2 s = rn * beta; s.x /= uAspect;
  vec2 suv = mix(uv, uC + s, k);
  vec3 c = texture2D(inputBuffer, suv).rgb;
  // vành sáng mảnh ở bán kính Einstein (ảnh nhân lên của nguồn sáng phía sau)
  // (x * x thay pow(x, 2.0): pow với cơ số âm không xác định trong GLSL ES → NaN → bloom HalfFloat đen cả màn hình)
  float rx = (r - uRE * 1.7) / max(uRE * 0.08, 1e-4);
  float ring = exp(-rx * rx) * 0.35 * k;
  outputColor = vec4(c + vec3(1.0, 0.85, 0.65) * ring, inputColor.a);
}
`;

class LensingEffect extends Effect {
  constructor() {
    super("LensingEffect", FRAG, {
      attributes: EffectAttribute.DEPTH,
      uniforms: new Map<string, THREE.Uniform>([
        ["uC", new THREE.Uniform(new THREE.Vector2(0.5, 0.5))],
        ["uRin", new THREE.Uniform(0.1)],
        ["uRE", new THREE.Uniform(0.06)],
        ["uOn", new THREE.Uniform(0)],
        ["uAspect", new THREE.Uniform(1)],
        ["uImpact", new THREE.Uniform(0)],
        ["uShock", new THREE.Uniform(new THREE.Vector3(0.5, 0.5, -1))],
        ["uShockK", new THREE.Uniform(0)],
        ["uShock2", new THREE.Uniform(new THREE.Vector3(0.5, 0.5, -1))],
        ["uShockK2", new THREE.Uniform(0)],
      ]),
    });
  }
  update(renderer: THREE.WebGLRenderer, inputBuffer: THREE.WebGLRenderTarget, deltaTime?: number) {
    IMPACT.k *= Math.exp(-(deltaTime ?? 0.016) * 9);
    if (IMPACT.k < 0.01) IMPACT.k = 0;
    // giảm chuyển động: bỏ khung chấn (zoom blur + tách màu toàn màn hình), sóng xung kích chỉ còn 35 % độ méo
    const rm = fxReducedMotion();
    this.uniforms.get("uImpact")!.value = rm ? 0 : IMPACT.k;
    const now = fxNow();
    const prog = (now - SHOCK.t0) / 1000 / SHOCK.dur;
    (this.uniforms.get("uShock")!.value as THREE.Vector3).set(SHOCK.uv.x, SHOCK.uv.y, prog >= 0 && prog <= 1 ? prog : -1);
    this.uniforms.get("uShockK")!.value = SHOCK.k * SHOCK.vis * (rm ? 0.35 : 1);
    const prog2 = (now - SHOCK2.t0) / 1000 / SHOCK2.dur;
    (this.uniforms.get("uShock2")!.value as THREE.Vector3).set(SHOCK2.uv.x, SHOCK2.uv.y, prog2 >= 0 && prog2 <= 1 ? prog2 : -1);
    this.uniforms.get("uShockK2")!.value = SHOCK2.k * SHOCK2.vis * (rm ? 0.35 : 1);
    const u = this.uniforms;
    (u.get("uC")!.value as THREE.Vector2).copy(LENS.center);
    u.get("uRin")!.value = LENS.rin;
    u.get("uRE")!.value = LENS.re;
    u.get("uOn")!.value = LENS.on;
    u.get("uAspect")!.value = inputBuffer.width / Math.max(1, inputBuffer.height);
    void renderer;
  }
}

const P = new THREE.Vector3();
const SLOTS = [SHOCK, SHOCK2];
export const Lensing = forwardRef<LensingEffect, object>(function Lensing(_, ref) {
  const effect = useMemo(() => new LensingEffect(), []);
  // chiếu điểm va chạm 3D ra màn hình (uv) cho sóng xung kích
  useFrame(({ camera }) => {
    const now = fxNow();
    for (const s of SLOTS) {
      if (now - s.t0 > s.dur * 1000) continue;
      P.copy(s.world).project(camera);
      // điểm va chạm SAU máy quay: project() lật dấu → vòng sóng hiện sai chỗ ở phía đối diện; tắt dần khi ra khỏi khung
      const behind = P.z > 1 || P.z < -1;
      const off = Math.max(Math.abs(P.x), Math.abs(P.y));
      s.vis = behind ? 0 : off <= 1.3 ? 1 : Math.max(0, 1 - (off - 1.3) / 0.7);
      s.uv.set(P.x * 0.5 + 0.5, P.y * 0.5 + 0.5);
    }
  });
  return <primitive ref={ref} object={effect} dispose={null} />;
});
