"use client";
/**
 * Vật liệu "GI nướng sẵn" (Blender Cycles → màu đỉnh, đã nén (x/p97)^0,55): vẽ KHÔNG chiếu sáng — albedo × ánh sáng nướng,
 * bậc hoá mềm 3 dải kiểu anime, sàn tối thiểu để bóng không đen kịt. Dùng chung cho phòng Siêu khối và Thư viện Babel.
 * Uniform truyền vào để mỗi cảnh chỉnh phơi sáng / nhuốm màu riêng (vd. khi du hành).
 */
import * as THREE from "three";

export type BakedUniforms = {
  uExposure: { value: number };
  uFloor: { value: number };
  uTint: { value: THREE.Color };
  /** hệ số giải nén (≈ p97 lúc nướng; lớn hơn = sáng hơn) */
  uScale: { value: number };
};

/** Vật liệu nướng → bộ uniform của nó (WeakMap, không để trong userData: material.clone() chép userData qua JSON làm hỏng Color) */
export const BAKED_U = new WeakMap<THREE.Material, BakedUniforms>();

export function bakedMaterial(src: THREE.MeshStandardMaterial, U: BakedUniforms) {
  const m = new THREE.MeshBasicMaterial({ color: src.color.clone(), vertexColors: true });
  // giữ tên vật liệu Blender + bộ uniform → phong cách siêu thực (fx/realify) dựng lại được bản PBR cùng ánh sáng nướng
  m.name = src.name;
  BAKED_U.set(m, U);
  m.onBeforeCompile = (sh) => {
    sh.uniforms.uExposure = U.uExposure;
    sh.uniforms.uFloor = U.uFloor;
    sh.uniforms.uTint = U.uTint;
    sh.uniforms.uScale = U.uScale;
    sh.fragmentShader = sh.fragmentShader
      .replace("#include <common>", "#include <common>\nuniform float uExposure; uniform float uFloor; uniform vec3 uTint; uniform float uScale;")
      .replace(
        "#include <color_fragment>",
        `vec3 bk = vColor.rgb;
        vec3 irr = pow(max(bk, vec3(0.0)), vec3(1.818)) * uScale;
        float lum = dot(irr, vec3(0.3, 0.59, 0.11));
        // bậc hoá mềm (3 dải) giữ sắc độ — chất cel trên nền GI nướng
        float q = floor(lum * 2.5 + 0.5) / 2.5;
        float lumQ = mix(lum, q, 0.3);
        // sắc độ ổn định ở vùng tối (tránh chia cho số rất nhỏ → loang đỏ/xanh)
        vec3 tint = min((irr + 0.06) / (lum + 0.06), vec3(2.2));
        vec3 lightC = tint * max(lumQ, uFloor);
        diffuseColor.rgb *= lightC * uExposure * uTint;`,
      );
  };
  return m;
}
