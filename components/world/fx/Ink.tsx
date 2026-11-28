"use client";
/**
 * Ink lines for EVERY map (hub, valley, voxel expanse, impossible halls) in one screen pass:
 * Laplacian of inverse depth (1/z is affine across a plane, so flat surfaces give 0 and only
 * silhouettes and creases are inked). Lines take a darker shade of the colour beneath them
 * (coloured line art as in anime games) and fade out with distance so far terrain stays clean.
 * Cheap enough for phones: 5 depth taps, merged into the same EffectPass as the other effects.
 */
import { forwardRef, useMemo } from "react";
import { Effect, EffectAttribute } from "postprocessing";
import * as THREE from "three";
import { INK_MASK } from "./InkMask";

const FRAG = /* glsl */ `
uniform vec3 uInk;
uniform float uWidth;
uniform float uFar;
uniform float uStrength;
uniform float uTone;
uniform float uDedither;
uniform sampler2D uMask;
uniform float uMaskOn;

// điểm ảnh thuộc tán lá? (mặt nạ lưu 1/z của tán; trùng 1/z cảnh → đúng là tán, không bị vật khác che)
float fol(const in vec2 p, const in float iz) {
  if (uMaskOn < 0.5 || iz <= 0.0) return 0.0;
  float m = texture2D(uMask, p).r;
  return (m > 0.0 && abs(m - iz) < 0.04 * iz + 0.002) ? 1.0 : 0.0;
}

float invZ(const in vec2 p) {
  float d = readDepth(p);
  if (d >= 0.99999) return 0.0;
  return -1.0 / getViewZ(d);
}

void mainImage(const in vec4 inputColor, const in vec2 uv, const in float depth, out vec4 outputColor) {
  vec2 o = texelSize * uWidth;
  float c = invZ(uv);
  float l = invZ(uv - vec2(o.x, 0.0));
  float r = invZ(uv + vec2(o.x, 0.0));
  float b = invZ(uv - vec2(0.0, o.y));
  float t = invZ(uv + vec2(0.0, o.y));
  float near = max(max(c, max(l, r)), max(b, t));
  float lap = abs(l + r - 2.0 * c) + abs(t + b - 2.0 * c);
  float e = lap / max(near, 1e-5);
  float edge = smoothstep(0.04, 0.12, e);
  // tán lá: không viền bên trong tán / quanh lỗ lá; điểm ảnh ở SAU tán (lộ qua lỗ lá) cũng không viền,
  // vật đứng TRƯỚC tán (nhân vật) vẫn giữ viền
  float sup = fol(uv, c);
  sup = max(sup, fol(uv - vec2(o.x, 0.0), l) * step(c, l * 1.05));
  sup = max(sup, fol(uv + vec2(o.x, 0.0), r) * step(c, r * 1.05));
  sup = max(sup, fol(uv - vec2(0.0, o.y), b) * step(c, b * 1.05));
  sup = max(sup, fol(uv + vec2(0.0, o.y), t) * step(c, t * 1.05));
  edge *= 1.0 - sup;
  float dist = 1.0 / max(near, 1e-5);
  edge *= 1.0 - smoothstep(uFar * 0.45, uFar, dist);
  if (uDedither > 0.5) {
    // vật đang tan dither (fx/nearFade: thân / tán chắn máy quay) không bị kẻ thành lưới chấm:
    // sát máy quay (< 3 m) không kẻ; điểm ảnh "cô lập" (cả 2 trục cùng lệch một phía = lỗ dither / điểm dither) bỏ nét
    edge *= smoothstep(2.6, 3.6, dist);
    float isoX = step(0.0, (l - c) * (r - c)) * step(0.08 * near, abs(l - c));
    float isoY = step(0.0, (t - c) * (b - c)) * step(0.08 * near, abs(t - c));
    edge *= 1.0 - 0.85 * isoX * isoY;
  }
  vec3 col = inputColor.rgb;
  // uTone 0,16 = nét gần đen (mặc định); cao hơn = nét MÀU (sắc tối hơn của chính bề mặt — kiểu nền Genshin, không kẻ đen)
  vec3 inked = col * uTone + uInk * 0.12 * (1.0 - uTone);
  outputColor = vec4(mix(col, inked, edge * uStrength), inputColor.a);
}
`;

class InkEffect extends Effect {
  constructor({ width = 1, far = 80, strength = 1, color = "#3a2440", tone = 0.16, dedither = false }: InkProps) {
    super("InkEffect", FRAG, {
      attributes: EffectAttribute.DEPTH,
      uniforms: new Map<string, THREE.Uniform>([
        ["uInk", new THREE.Uniform(new THREE.Color(color))],
        ["uWidth", new THREE.Uniform(width)],
        ["uFar", new THREE.Uniform(far)],
        ["uStrength", new THREE.Uniform(strength)],
        ["uTone", new THREE.Uniform(tone)],
        ["uDedither", new THREE.Uniform(dedither ? 1 : 0)],
        ["uMask", new THREE.Uniform(null)],
        ["uMaskOn", new THREE.Uniform(0)],
      ]),
    });
  }
  update() {
    this.uniforms.get("uMask")!.value = INK_MASK.tex;
    this.uniforms.get("uMaskOn")!.value = INK_MASK.on && INK_MASK.tex ? 1 : 0;
  }
}

type InkProps = { width?: number; far?: number; strength?: number; color?: string; tone?: number; dedither?: boolean };

export const Ink = forwardRef<InkEffect, InkProps>(function Ink({ width = 1, far = 80, strength = 1, color = "#3a2440", tone = 0.16, dedither = false }, ref) {
  const effect = useMemo(() => new InkEffect({ width, far, strength, color, tone, dedither }), [width, far, strength, color, tone, dedither]);
  return <primitive ref={ref} object={effect} dispose={null} />;
});
