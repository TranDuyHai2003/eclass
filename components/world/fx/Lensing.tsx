"use client";
/**
 * Thấu kính hấp dẫn quanh hố đen (hậu kỳ, chỉ ở Hư Không Nghịch Lý): điểm ảnh ở góc θ quanh tâm hố đen thật ra đến từ nguồn
 * ở góc β = θ − θE²/θ (phương trình thấu kính điểm) → sao và tinh vân phía sau bị kéo dãn thành vòng cung quanh hố;
 * thêm một chút xoắn (kéo hệ quy chiếu của hố đen quay). Chỉ uốn bầu trời (độ sâu = xa vô cực), vật ở gần giữ nguyên.
 * Phải đứng ĐẦU chuỗi hậu kỳ vì đọc thẳng inputBuffer.
 */
import { forwardRef, useMemo } from "react";
import { Effect, EffectAttribute } from "postprocessing";
import * as THREE from "three";

/** Cảnh cập nhật mỗi khung hình: tâm hố đen (uv màn hình), bán kính bắt đầu uốn + bán kính Einstein (đơn vị chiều cao màn hình) */
export const LENS = { on: 0, center: new THREE.Vector2(0.5, 0.5), rin: 0.1, re: 0.06 };
/** Chấn màn hình khi đòn nặng trúng: zoom blur hướng tâm + tách màu (chromatic aberration), tắt dần ~0,3 s */
export const IMPACT = { k: 0 };
export function impact(k: number) {
  IMPACT.k = Math.max(IMPACT.k, Math.min(1.2, k));
}

const FRAG = /* glsl */ `
uniform vec2 uC;
uniform float uRin;
uniform float uRE;
uniform float uOn;
uniform float uAspect;
uniform float uImpact;
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
  outputColor = inputColor;
  if (uImpact > 0.01) {
    outputColor = vec4(impactBlur(uv), inputColor.a);
    return;
  }
  if (uOn < 0.5 || depth < 0.9999) return;
  vec2 d = uv - uC; d.x *= uAspect;
  float r = length(d);
  float k = smoothstep(uRin, uRin * 1.25, r) * (1.0 - smoothstep(uRin * 3.2, uRin * 5.0, r));
  if (k <= 0.0) return;
  float beta = max(r - uRE * uRE / r, 0.0);
  float ang = 0.5 * uRE * uRE / (r * r);
  vec2 n = d / r;
  vec2 rn = vec2(n.x * cos(ang) - n.y * sin(ang), n.x * sin(ang) + n.y * cos(ang));
  vec2 s = rn * beta; s.x /= uAspect;
  vec2 suv = mix(uv, uC + s, k);
  vec3 c = texture2D(inputBuffer, suv).rgb;
  // vành sáng mảnh ở bán kính Einstein (ảnh nhân lên của nguồn sáng phía sau)
  float ring = exp(-pow((r - uRE * 1.7) / (uRE * 0.08), 2.0)) * 0.35 * k;
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
      ]),
    });
  }
  update(renderer: THREE.WebGLRenderer, inputBuffer: THREE.WebGLRenderTarget, deltaTime?: number) {
    IMPACT.k *= Math.exp(-(deltaTime ?? 0.016) * 9);
    if (IMPACT.k < 0.01) IMPACT.k = 0;
    this.uniforms.get("uImpact")!.value = IMPACT.k;
    const u = this.uniforms;
    (u.get("uC")!.value as THREE.Vector2).copy(LENS.center);
    u.get("uRin")!.value = LENS.rin;
    u.get("uRE")!.value = LENS.re;
    u.get("uOn")!.value = LENS.on;
    u.get("uAspect")!.value = inputBuffer.width / Math.max(1, inputBuffer.height);
    void renderer;
  }
}

export const Lensing = forwardRef<LensingEffect, object>(function Lensing(_, ref) {
  const effect = useMemo(() => new LensingEffect(), []);
  return <primitive ref={ref} object={effect} dispose={null} />;
});
