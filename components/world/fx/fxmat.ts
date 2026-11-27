"use client";
/**
 * FxMat — one shared anime-VFX material (docs/ai-reviews/game-3d/VFX_PIPELINE.md §2).
 * Every effect = mesh + textures + numbers:
 *  - shape mask (procedural slash from UV, polar ring band, or a texture mask)
 *  - subtractive noise break-up + age-driven erosion (dissolve), UV panning
 *  - colour ONLY from the ramp atlas row (dark hue-shifted edge → body → white core)
 *  - stepped alpha (cel look) and hybrid premultiplied blend: alpha-blended dark edge + additive core in one draw
 */
import * as THREE from "three";

let cache: { noise: THREE.Texture; ramp: THREE.Texture; ring: THREE.Texture } | null = null;
function textures() {
  if (cache) return cache;
  const L = new THREE.TextureLoader();
  const lin = (url: string, repeat = true) => {
    const t = L.load(url);
    t.colorSpace = THREE.NoColorSpace;
    if (repeat) t.wrapS = t.wrapT = THREE.RepeatWrapping;
    return t;
  };
  const ramp = L.load("/world/fx/tex/ramps.png");
  ramp.colorSpace = THREE.SRGBColorSpace;
  ramp.magFilter = THREE.NearestFilter;
  ramp.minFilter = THREE.NearestFilter;
  ramp.generateMipmaps = false;
  cache = { noise: lin("/world/fx/tex/noise_pack.png"), ramp, ring: lin("/world/fx/tex/ring_wave.png") };
  return cache;
}

/** Hàng ramp theo màu vũ khí / loại hiệu ứng (khớp ramps.png) */
const ROW_BY_COLOR: Record<string, number> = {
  "#8fe6ff": 0, "#ffd27a": 1, "#ff9ecb": 2, "#6ff2d0": 3, "#c8a6ff": 4, "#9ec8ff": 5, "#7cf0a0": 6, "#f4f0ff": 7,
  "#ffffff": 8, "#fff6dc": 8, crit: 9, "#ff3d6e": 10, "#9fe6ff": 0, "#8b5cff": 12, "#b48cff": 12, "#ffb45a": 9, "#c8dcff": 5,
};
export function rampRow(color: string): number {
  return ROW_BY_COLOR[color.toLowerCase()] ?? 8;
}

const masks = new Map<string, THREE.Texture>();
/** Mặt nạ hình (đen trắng, tuyến tính) trong public/world/fx/tex */
export function fxMask(name: string): THREE.Texture {
  let t = masks.get(name);
  if (!t) {
    t = new THREE.TextureLoader().load(`/world/fx/tex/${name}.png`);
    t.colorSpace = THREE.NoColorSpace;
    masks.set(name, t);
  }
  return t;
}

export type FxMode = 0 | 1 | 2; // 0 vệt chém, 1 vòng sóng (polar), 2 sprite có mặt nạ

const VERT = /* glsl */ `
varying vec2 vUv;
void main(){ vUv = uv; gl_Position = projectionMatrix * modelViewMatrix * vec4(position, 1.0); }`;

const FRAG = /* glsl */ `
precision mediump float;
uniform sampler2D uNoise; uniform sampler2D uRamp; uniform sampler2D uRing; uniform sampler2D uMask;
uniform float uAge;      // 0..1 tuổi đời
uniform float uProg;     // tiến trình riêng (đầu vệt chém / bán kính vòng)
uniform float uRow;      // hàng ramp 0..15
uniform float uErode;    // mức xói mòn tối đa
uniform float uNoiseAmt; // độ "gặm" của nhiễu
uniform float uAdd;      // 0 = pha trộn alpha (viền tối thấy rõ trên nền sáng), 1 = cộng sáng
uniform float uIntensity;
uniform float uTime;
uniform float uMode;
uniform vec4 uMaskRect;
varying vec2 vUv;
#define STEPS 3.0

// ramps.png lật dọc khi nạp (flipY) → hàng 0 nằm ở v gần 1
vec3 ramp(float v){ return texture2D(uRamp, vec2(clamp(v, 0.01, 0.99), 1.0 - (uRow + 0.5) / 16.0)).rgb; }

void main(){
  float val; float core = 0.0;
  if (uMode < 0.5) {
    // Vệt chém: u dọc cung (đầu vệt quét từ 0 → 1), v từ mép trong → mép ngoài
    float head = uProg * 1.3;
    float trail = (1.0 - smoothstep(0.0, 0.65, head - vUv.x)) * step(vUv.x, head);
    float body = smoothstep(0.0, 0.28, vUv.y) * (1.0 - smoothstep(0.9, 1.0, vUv.y));
    core = smoothstep(0.55, 0.82, vUv.y) * (1.0 - smoothstep(0.9, 0.98, vUv.y));
    float n = texture2D(uNoise, vec2(vUv.x * 1.5 - uTime * 2.0, vUv.y * 0.5)).b;
    val = clamp(body * trail * (0.55 + 0.45 * core) - (1.0 - n) * uNoiseAmt, 0.0, 1.0);
  } else if (uMode < 1.5) {
    // Vòng sóng toạ độ cực: gợn Fourier 12 hoạ âm trên mép trước
    vec2 p = vUv * 2.0 - 1.0;
    float r = length(p);
    float ang = atan(p.y, p.x);
    float front = uProg + 0.025 * sin(ang * 12.0 + uTime * 18.0);
    float bv = 1.0 - (front - r) / 0.32;
    float band = (bv > 0.0 && bv < 1.0) ? texture2D(uRing, vec2(ang / 6.2832, bv)).r : 0.0;
    core = smoothstep(0.75, 0.95, bv) * step(bv, 1.0);
    float n = texture2D(uNoise, vec2(ang / 6.2832 * 3.0, r * 1.5 - uTime * 0.6)).r;
    val = clamp(band - (1.0 - n) * uNoiseAmt, 0.0, 1.0);
  } else {
    float m = texture2D(uMask, vUv * uMaskRect.zw + uMaskRect.xy).r;
    float n = texture2D(uNoise, vUv * 1.3 + vec2(uTime * 0.3, -uTime * 0.5)).r;
    core = smoothstep(0.7, 1.0, m);
    val = clamp(m - (1.0 - n) * uNoiseAmt, 0.0, 1.0);
  }
  // Xói mòn theo tuổi: ngưỡng tăng dần → hình bị "ăn" từ chỗ mỏng nhất
  float e = uAge * uErode;
  float a = smoothstep(e, e + 0.08, val);
  a = floor(a * STEPS + 0.5) / STEPS;
  if (a <= 0.001) discard;
  vec3 c = ramp(val * 0.85 + core * 0.35) * uIntensity;
  gl_FragColor = vec4(c * a, a * (1.0 - uAdd));
}`;

export function createFxMat(mode: FxMode, mask?: THREE.Texture): THREE.ShaderMaterial {
  const t = textures();
  return new THREE.ShaderMaterial({
    vertexShader: VERT,
    fragmentShader: FRAG,
    uniforms: {
      uNoise: { value: t.noise },
      uRamp: { value: t.ramp },
      uRing: { value: t.ring },
      uMask: { value: mask ?? t.noise },
      uAge: { value: 0 },
      uProg: { value: 0 },
      uRow: { value: 8 },
      uErode: { value: 1 },
      uNoiseAmt: { value: 0.35 },
      uAdd: { value: 0.35 },
      uIntensity: { value: 1.6 },
      uTime: { value: 0 },
      uMode: { value: mode },
      uMaskRect: { value: new THREE.Vector4(0, 0, 1, 1) },
    },
    transparent: true,
    depthWrite: false,
    side: THREE.DoubleSide,
    blending: THREE.CustomBlending,
    blendSrc: THREE.OneFactor,
    blendDst: THREE.OneMinusSrcAlphaFactor,
    toneMapped: false,
  });
}

/** Đường cong thời gian kiểu anime: lên rất nhanh, giữ, rồi tan */
export const ease = {
  outExpo: (t: number) => (t >= 1 ? 1 : 1 - Math.pow(2, -10 * t)),
  outCubic: (t: number) => 1 - Math.pow(1 - t, 3),
  inQuad: (t: number) => t * t,
  outBack: (t: number) => 1 + 2.70158 * Math.pow(t - 1, 3) + 1.70158 * Math.pow(t - 1, 2),
};
