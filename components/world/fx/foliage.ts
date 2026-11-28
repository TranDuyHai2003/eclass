/**
 * Tán lá kiểu Genshin (GDC 2021 Haoyu Cai + nghiên cứu Codex 2026-11):
 *  • thẻ lá cắt alpha (atlas thủ tục public/world/fx/tex/leaf_atlas.png, ngưỡng 0,5, ghi depth — không blend);
 *  • pháp tuyến CẦU từ tâm tán (nướng trong GLB) → mảng sáng tối lớn chạy liền qua nhiều thẻ, không lốm đốm;
 *  • ramp 3 bậc 0,55 / 0,77 / 1,0 + ánh xuyên lá (ngược sáng) + rim nhẹ; màu đỉnh = AO tán;
 *  • gió 2 lớp: lắc cả tán 0,7 Hz (biên độ 8 cm, tăng theo độ cao) + rung mép thẻ 1,7 Hz (2,5 cm).
 * Mặt nạ viền mực: bản sao instanced trong INK_MASK.scene ghi 1/z của tán vào RT nửa độ phân giải
 * (fx/InkMask.tsx) → pass Ink bỏ nét ở mọi điểm ảnh thuộc tán và ở các lỗ lá (không thành mạng lưới đen).
 */
import * as THREE from "three";
import { WIND } from "./water";
import { FOCUS, NEAR_FADE_GLSL } from "./nearFade";
import { worldAsset } from "@/lib/world/avatars";

export const FOLIAGE_MASK_LAYER = 3;

let atlas: THREE.Texture | null = null;
function leafAtlas() {
  if (!atlas) {
    atlas = new THREE.TextureLoader().load(worldAsset("fx/tex/leaf_atlas.png"));
    atlas.flipY = false;
    atlas.colorSpace = THREE.NoColorSpace;
    atlas.anisotropy = 4;
  }
  return atlas;
}

const WIND_GLSL = /* glsl */ `
  uniform float uT; uniform float uGust;
  vec3 bend(vec3 p, vec2 tuv, vec3 root){
    float h = clamp((p.y - 2.4) / 3.6, 0.0, 1.0);
    // mép thẻ (xa tâm ô atlas) rung nhiều hơn
    vec2 f = fract(tuv * 2.0) - 0.5;
    float tip = clamp(length(f) * 2.2, 0.0, 1.0);
    float ph = dot(root.xz, vec2(0.71, 0.43));
    float g = 0.7 + uGust * 0.6;
    float sway = 0.08 * g * h * h * sin(4.4 * uT + ph);
    float flutter = 0.025 * h * tip * sin(10.7 * uT + ph + 4.0 * p.x + 3.0 * p.z);
    return p + vec3(sway + flutter * 0.5, flutter * 0.4, 0.35 * sway + flutter);
  }
`;

const VS = /* glsl */ `
  ${WIND_GLSL}
  varying vec2 vUv; varying vec3 vN; varying vec3 vW; varying float vAO;
  void main(){
    vUv = uv;
    vAO = 1.0;
    #ifdef USE_COLOR
      vAO = color.r;
    #endif
    mat4 inst = mat4(1.0);
    #ifdef USE_INSTANCING
      inst = instanceMatrix;
    #endif
    vec3 root = (modelMatrix * inst * vec4(0.0, 0.0, 0.0, 1.0)).xyz;
    vec3 p = bend(position, uv, root);
    vec4 w = modelMatrix * inst * vec4(p, 1.0);
    vN = normalize(mat3(modelMatrix) * mat3(inst) * normal);
    vW = w.xyz;
    gl_Position = projectionMatrix * viewMatrix * w;
  }
`;

const FS = /* glsl */ `
  uniform sampler2D uAtlas; uniform vec3 uSun; uniform vec3 uTintA; uniform vec3 uTintB; uniform vec3 uDark; uniform float uBright; uniform float uLevel;
  varying vec2 vUv; varying vec3 vN; varying vec3 vW; varying float vAO;
  ${NEAR_FADE_GLSL}
  void main(){
    nearFade(vW - cameraPosition, uFocus - cameraPosition);
    vec4 tex = texture2D(uAtlas, vUv);
    if (tex.a < 0.5) discard;
    vec3 N = normalize(vN);
    vec3 V = normalize(cameraPosition - vW);
    float d = dot(N, uSun);
    // ramp 3 bậc (vùng chuyển hẹp, mềm) — kiểu Genshin
    float ramp = 0.55 + 0.22 * smoothstep(0.0, 0.12, d) + 0.23 * smoothstep(0.42, 0.56, d);
    // ánh xuyên lá khi nhìn ngược nắng — mạnh hơn khi nắng thấp (giờ vàng: tán "phát sáng" vàng lục như Genshin)
    float lowSun = 1.0 - smoothstep(0.2, 0.7, uSun.y);
    float back = (0.3 + 0.25 * lowSun) * smoothstep(0.1, 0.8, -d) * (0.4 + 0.6 * pow(max(dot(-uSun, V), 0.0), 2.0));
    // viền nắng ấm CHỈ ở mép tán phía mặt trời (silhouette), không phủ cả tán
    float rim = (0.12 + 0.12 * lowSun) * pow(1.0 - abs(dot(N, V)), 3.0) * smoothstep(0.0, 0.5, d);
    // màu: xám atlas trộn 2 sắc (lá đậm ↔ lá non), lõi tán ngả lam lục mát; ngọn tán (AO cao) ấm vàng hơn
    vec3 base = mix(uTintA, uTintB, smoothstep(0.55, 0.95, tex.r));
    base = mix(uDark, base, smoothstep(0.4, 0.92, vAO));
    base *= mix(vec3(0.96, 0.98, 1.04), vec3(1.06, 1.03, 0.9), smoothstep(0.75, 1.0, vAO));
    vec3 col = base * (ramp * uBright) + base * back * vec3(1.3, 1.12, 0.55) + vec3(1.0, 0.9, 0.68) * rim;
    gl_FragColor = vec4(col * uLevel, 1.0);
    #include <tonemapping_fragment>
    #include <colorspace_fragment>
  }
`;

/** mặt nạ: ghi 1/z (dương) của tán — cùng gió, cùng ngưỡng alpha với lượt màu */
const MASK_FS = /* glsl */ `
  uniform sampler2D uAtlas;
  varying vec2 vUv; varying vec3 vN; varying vec3 vW; varying float vAO;
  ${NEAR_FADE_GLSL}
  void main(){
    nearFade(vW - cameraPosition, uFocus - cameraPosition);
    if (texture2D(uAtlas, vUv).a < 0.5) discard;
    float z = -(viewMatrix * vec4(vW, 1.0)).z;
    gl_FragColor = vec4(1.0 / max(z, 1e-3), 0.0, 0.0, 1.0);
  }
`;

export type FoliageKind = "leaf" | "blossom";
const LOOK: Record<FoliageKind, { a: string; b: string; dark: string; bright: number }> = {
  // Genshin: lá tươi sáng (lục non ↔ lục đậm), bóng trong tán lam lục mát (không xám bẩn); anh đào hồng phấn ấm
  leaf: { a: "#4b9744", b: "#b4dd68", dark: "#285a55", bright: 1.1 },
  blossom: { a: "#f6a8c6", b: "#fff0f4", dark: "#c27ea6", bright: 1.08 },
};

export function foliageMaterial(kind: FoliageKind, sun: THREE.Vector3) {
  const L = LOOK[kind];
  return new THREE.ShaderMaterial({
    name: `foliage_${kind}`,
    uniforms: {
      uAtlas: { value: leafAtlas() },
      uT: WIND.t,
      uGust: WIND.gust,
      uSun: { value: sun.clone().normalize() },
      uTintA: { value: new THREE.Color(L.a) },
      uTintB: { value: new THREE.Color(L.b) },
      uDark: { value: new THREE.Color(L.dark) },
      uBright: { value: L.bright },
      uLevel: { value: 1 },
      uFocus: FOCUS,
    },
    vertexShader: VS,
    fragmentShader: FS,
    vertexColors: true,
    side: THREE.DoubleSide,
  });
}

/**
 * Mặt nạ cho KHỐI tán (lõi cầu h_leaf / h_blossom, không có UV) — cùng công thức gió với vật liệu khối trong HubPlaza
 * → pass Ink bỏ cả nét giữa các cục cầu của tán (trước đây tán trông như đống đá viền đen).
 */
const SOLID_MASK_VS = /* glsl */ `
  uniform float uWind;
  varying vec3 vW;
  void main(){
    vec3 p = position;
    mat4 inst = mat4(1.0);
    float ph = 0.0;
    #ifdef USE_INSTANCING
      inst = instanceMatrix;
      ph = instanceMatrix[3].x * 0.31 + instanceMatrix[3].z * 0.17;
    #endif
    float hk = max(0.0, position.y - 2.2) * 0.07;
    p.x += sin(uWind * 1.3 + ph) * hk + sin(uWind * 3.1 + ph * 2.0 + position.y) * hk * 0.25;
    p.z += cos(uWind * 1.1 + ph) * hk * 0.6;
    vec4 w = modelMatrix * inst * vec4(p, 1.0);
    vW = w.xyz;
    gl_Position = projectionMatrix * viewMatrix * w;
  }
`;
const SOLID_MASK_FS = /* glsl */ `
  varying vec3 vW;
  ${NEAR_FADE_GLSL}
  void main(){
    nearFade(vW - cameraPosition, uFocus - cameraPosition);
    float z = -(viewMatrix * vec4(vW, 1.0)).z;
    gl_FragColor = vec4(1.0 / max(z, 1e-3), 0.0, 0.0, 1.0);
  }
`;
export function canopyMaskMaterial() {
  return new THREE.ShaderMaterial({ name: "canopy_mask", uniforms: { uWind: WIND.t, uFocus: FOCUS }, vertexShader: SOLID_MASK_VS, fragmentShader: SOLID_MASK_FS });
}

export function foliageMaskMaterial() {
  return new THREE.ShaderMaterial({
    name: "foliage_mask",
    uniforms: { uAtlas: { value: leafAtlas() }, uT: WIND.t, uGust: WIND.gust, uFocus: FOCUS },
    vertexShader: VS,
    fragmentShader: MASK_FS,
    vertexColors: true,
    side: THREE.DoubleSide,
  });
}
