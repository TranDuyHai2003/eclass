"use client";
/**
 * Phong cách "siêu thực" cho các cảnh dựng bằng vật liệu nướng GI / toon (dùng ở sân Thế giới Bất Khả):
 *
 *  • Vật liệu GI nướng (fx/baked, MeshBasic + màu đỉnh) → "lightmap + IBL" như engine AAA:
 *    khuếch tán = albedo × ánh sáng NƯỚNG (giữ GI đúng cả trong hang, hành lang, dưới mái — đèn thời gian thực không rọi xuyên tường),
 *    phản xạ gương = bản đồ môi trường (PMREM từ bầu trời) theo Fresnel + độ nhám PBR, nhân "che phản xạ" (specular occlusion)
 *    suy từ độ sáng nướng → góc tối không loé phản chiếu trời.
 *  • Vật liệu toon (fx/glbToon, có / không màu đỉnh) → MeshStandard PBR; màu đỉnh (bóng nướng) giữ làm AO mềm.
 *  • Thông số PBR suy theo từ khoá tên vật liệu Blender (vàng / kim loại / kính / đá / gỗ / vải …).
 *  • Bỏ qua: nhân vật (có khung xương / MToon), shader tự viết, vật liệu phát sáng, quái (có hiệu ứng tan biến).
 * Đổi qua lại không tải lại cảnh: vật liệu gốc cất trong userData, bật lại thì trả về.
 */
import { useEffect, type RefObject } from "react";
import * as THREE from "three";
import { BAKED_U, type BakedUniforms } from "./baked";
import { FOCUS, NEAR_FADE_GLSL } from "./nearFade";

type P = { roughness: number; metalness: number; env: number; clearcoat?: number };
export function pbrFor(name: string): P {
  const n = name.toLowerCase();
  // sàn sân Bất Khả: đá mài bóng gương (phản chiếu trời hoàng hôn), ron vàng kim loại — xem courtRecolor
  if (n === "imp_court") return { roughness: 0.32, metalness: 0, env: 0.95, clearcoat: 0.45 };
  // kim loại bóng (đánh bóng kiểu showcase): nhám thấp + phản xạ môi trường mạnh
  if (/gold|brass|bronze|metal|steel|iron|chrome|silver|copper|gilt/.test(n)) return { roughness: 0.18, metalness: 1, env: 1.45 };
  if (/glass|crystal|window|lens|ice|gem|mirror/.test(n)) return { roughness: 0.05, metalness: 0, env: 1.5, clearcoat: 1 };
  if (/water|liquid|pool|sea/.test(n)) return { roughness: 0.04, metalness: 0, env: 1.4, clearcoat: 1 };
  if (/marble|floor|tile|stone|pearl|porcelain|ceramic|column|pillar|stair|step|plinth/.test(n)) return { roughness: 0.24, metalness: 0, env: 0.85, clearcoat: 0.5 };
  if (/wood|plank|hull|deck|oak|timber|mast|crate|barrel|oar/.test(n)) return { roughness: 0.55, metalness: 0, env: 0.45 };
  if (/cloth|velvet|carpet|fabric|curtain|rope|sail|paper|book|page|rug|cushion|seat|banner|flag/.test(n)) return { roughness: 0.92, metalness: 0, env: 0.22 };
  if (/rock|cave|earth|dirt|soil|sand|ground|cliff|mud/.test(n)) return { roughness: 0.85, metalness: 0, env: 0.3 };
  // sơn mài / tấm ốp / bảng điều khiển: nhựa – sơn bóng có lớp phủ (clearcoat) → ánh highlight sắc như đồ chơi cao cấp
  if (/lacquer|panel|console|dais|vest|collar|band|enamel|plastic|trim/.test(n)) return { roughness: 0.32, metalness: 0, env: 0.9, clearcoat: 0.7 };
  if (/paint|plaster|wall|brick/.test(n)) return { roughness: 0.62, metalness: 0, env: 0.45 };
  return { roughness: 0.46, metalness: 0.02, env: 0.7 };
}

/** Màu ở chế độ siêu thực: tăng bão hoà ×1,22 trong HSL (PBR + AgX làm nhạt màu) — giữ sắc độ gốc để bảng màu vẫn hài hoà */
const HSL = { h: 0, s: 0, l: 0 };
export function realColor(c: THREE.Color): THREE.Color {
  c.getHSL(HSL);
  return c.setHSL(HSL.h, Math.min(1, HSL.s * 1.22), HSL.l);
}

/**
 * Sàn sân: texture lát Penrose tím nhạt + kem → ô thoi sẫm xanh ngọc (bổ sắc với trời hoàng hôn tím – hồng),
 * ô kem thành ngà ấm, ron vàng thành KIM LOẠI thật (metalness 1, nhám 0,2) → lấp lánh khi máy quay di chuyển.
 */
function courtRecolor(sh: THREE.WebGLProgramParametersWithUniforms) {
  sh.fragmentShader = sh.fragmentShader
    .replace("#include <common>", "#include <common>\nfloat gGoldMask = 0.0;")
    .replace(
      "#include <map_fragment>",
      `#include <map_fragment>
      {
        vec3 c = diffuseColor.rgb;
        float mx = max(c.r, max(c.g, c.b)), mn = min(c.r, min(c.g, c.b));
        float sat = (mx - mn) / max(mx, 1e-3);
        float lilac = smoothstep(0.01, 0.06, c.b - c.g);
        gGoldMask = smoothstep(0.3, 0.5, sat) * smoothstep(0.0, 0.04, c.r - c.b);
        float l = dot(c, vec3(0.3, 0.59, 0.11));
        // xanh ngọc SẪM (giá trị thấp) ↔ ngà sáng: tương phản giá trị mạnh để công trình nổi trên sàn
        vec3 teal = mix(vec3(0.008, 0.045, 0.06), vec3(0.03, 0.15, 0.18), clamp(l * 1.6, 0.0, 1.0));
        vec3 ivory = c * vec3(1.03, 0.98, 0.9);
        vec3 gold = vec3(1.0, 0.72, 0.32);
        diffuseColor.rgb = mix(mix(ivory, teal, lilac), gold, gGoldMask);
      }`,
    )
    .replace("#include <metalnessmap_fragment>", "#include <metalnessmap_fragment>\nmetalnessFactor = mix(metalnessFactor, 1.0, gGoldMask);")
    .replace("#include <roughnessmap_fragment>", "#include <roughnessmap_fragment>\nroughnessFactor = mix(roughnessFactor, 0.3, gGoldMask);");
}

function make(p: P, base: Partial<THREE.MeshStandardMaterialParameters>) {
  return p.clearcoat
    ? new THREE.MeshPhysicalMaterial({ ...base, roughness: p.roughness, metalness: p.metalness, envMapIntensity: p.env, clearcoat: p.clearcoat, clearcoatRoughness: 0.08 })
    : new THREE.MeshStandardMaterial({ ...base, roughness: p.roughness, metalness: p.metalness, envMapIntensity: p.env });
}
function copyCommon(src: THREE.Material, dst: THREE.Material) {
  dst.name = src.name;
  dst.transparent = src.transparent;
  dst.opacity = src.opacity;
  dst.side = src.side;
  dst.alphaTest = src.alphaTest;
  dst.depthWrite = src.depthWrite;
  dst.polygonOffset = src.polygonOffset;
  dst.polygonOffsetFactor = src.polygonOffsetFactor;
  dst.polygonOffsetUnits = src.polygonOffsetUnits;
  dst.clippingPlanes = src.clippingPlanes;
  dst.clipShadows = src.clipShadows;
}

/** GI nướng → lightmap + IBL. flat = lưới không có pháp tuyến (GLB nướng bỏ NORMAL) → pháp tuyến từ đạo hàm màn hình */
export function bakedPBR(src: THREE.MeshBasicMaterial, U: BakedUniforms, flat: boolean, as?: string): THREE.Material {
  const p = pbrFor(as ?? src.name);
  // chỉ đường Realify (as = undefined) mới tăng bão hoà; Quảng trường gọi kèm "as" → giữ màu gốc
  const m = make(p, { color: as ? src.color.clone() : realColor(src.color.clone()), vertexColors: true, map: src.map ?? null, flatShading: flat });
  copyCommon(src, m);
  // lá / gỗ (tán, thân cây, ghế) chắn máy quay → tan dither thay vì lấp kín màn hình
  const fade = as === "leaf" || as === "wood";
  m.onBeforeCompile = (sh) => {
    if (fade) sh.uniforms.uFocus = FOCUS;
    if (fade)
      sh.fragmentShader = sh.fragmentShader
        .replace("#include <common>", `#include <common>\n${NEAR_FADE_GLSL}`)
        .replace("#include <clipping_planes_fragment>", "#include <clipping_planes_fragment>\nnearFade(-vViewPosition, (viewMatrix * vec4(uFocus, 1.0)).xyz);");
    if (as) sh.fragmentShader = "#define HUE_SHADOW\n" + sh.fragmentShader;
    sh.uniforms.uExposure = U.uExposure;
    sh.uniforms.uFloor = U.uFloor;
    sh.uniforms.uTint = U.uTint;
    sh.uniforms.uScale = U.uScale;
    sh.fragmentShader = sh.fragmentShader
      .replace("#include <common>", "#include <common>\nuniform float uExposure; uniform float uFloor; uniform vec3 uTint; uniform float uScale;\nvec3 gBaked = vec3(1.0);")
      .replace(
        "#include <color_fragment>",
        `#if defined( USE_COLOR ) || defined( USE_COLOR_ALPHA )
          vec3 irr = pow(max(vColor.rgb, vec3(0.0)), vec3(1.818)) * uScale;
          float lum = dot(irr, vec3(0.3, 0.59, 0.11));
          vec3 tint = min((irr + 0.06) / (lum + 0.06), vec3(2.2));
          gBaked = tint * max(lum, uFloor) * uExposure * uTint;
          #ifdef HUE_SHADOW
            // bóng lệch sắc (Quảng trường): tối → lam-tím, sáng → kem ấm — không xám bùn
            gBaked *= mix(vec3(0.82, 0.87, 1.12), vec3(1.035, 1.0, 0.95), smoothstep(0.22, 0.85, lum));
          #endif
        #endif`,
      )
      .replace(
        "#include <aomap_fragment>",
        `#include <aomap_fragment>
        // khuếch tán = ánh sáng nướng (GI), bỏ khuếch tán thời gian thực; phản xạ gương giữ nhưng bị che theo độ tối nướng
        reflectedLight.directDiffuse = vec3(0.0);
        reflectedLight.indirectDiffuse = material.diffuseColor * gBaked;
        float specOcc = clamp(dot(gBaked, vec3(0.3, 0.59, 0.11)) * 1.15, 0.06, 1.0);
        reflectedLight.indirectSpecular *= specOcc;
        reflectedLight.directSpecular *= specOcc;`,
      );
  };
  m.customProgramCacheKey = () => `real-baked${fade ? "-fade" : ""}${as ? "-hue" : ""}`;
  return m;
}

/** Toon → PBR; màu đỉnh (bóng nướng) giữ làm AO mềm */
export function toonPBR(src: THREE.MeshToonMaterial): THREE.Material {
  const p = pbrFor(src.name);
  const m = make(p, { color: realColor(src.color.clone()), vertexColors: src.vertexColors, map: src.map ?? null, emissive: src.emissive?.clone(), emissiveMap: src.emissiveMap ?? null });
  copyCommon(src, m);
  if (src.name === "imp_court") {
    // lớp phủ hơi mờ: nắng phản chiếu thành vệt sáng mềm, không loá trắng cả mảng sàn
    (m as THREE.MeshPhysicalMaterial).clearcoatRoughness = 0.25;
    m.onBeforeCompile = courtRecolor;
    m.customProgramCacheKey = () => "real-court";
  } else if (src.vertexColors) {
    m.onBeforeCompile = (sh) => {
      sh.fragmentShader = sh.fragmentShader.replace(
        "#include <color_fragment>",
        `#if defined( USE_COLOR ) || defined( USE_COLOR_ALPHA )
          float bakedL = dot(pow(max(vColor.rgb, vec3(0.0)), vec3(1.818)), vec3(0.3, 0.59, 0.11));
          diffuseColor.rgb *= mix(1.0, clamp(bakedL * 1.4, 0.25, 1.15), 0.6);
        #endif`,
      );
    };
    m.customProgramCacheKey = () => "real-toon-ao";
  }
  return m;
}

function convertible(mat: THREE.Material): boolean {
  if (mat.userData.dissolve) return false;
  if ((mat as THREE.MeshBasicMaterial).isMeshBasicMaterial) return BAKED_U.has(mat);
  return !!(mat as THREE.MeshToonMaterial).isMeshToonMaterial;
}

/** Áp phong cách siêu thực lên cả cây con của root (quét lại định kỳ để bắt lưới tải muộn) */
export function Realify({ root, on }: { root: RefObject<THREE.Object3D | null>; on: boolean }) {
  useEffect(() => {
    if (!on) return;
    const cache = new Map<THREE.Material, THREE.Material>();
    const ours = new Set<THREE.Material>();
    const conv = (mat: THREE.Material, flat: boolean) => {
      if (!convertible(mat)) return mat;
      let r = cache.get(mat);
      if (!r) {
        const U = BAKED_U.get(mat);
        r = U ? bakedPBR(mat as THREE.MeshBasicMaterial, U, flat) : toonPBR(mat as THREE.MeshToonMaterial);
        cache.set(mat, r);
        ours.add(r);
      }
      return r;
    };
    const touched = new Set<THREE.Mesh>();
    const apply = () =>
      root.current?.traverse((o) => {
        const m = o as THREE.Mesh;
        if (!m.isMesh || (m as THREE.SkinnedMesh).isSkinnedMesh || m.userData.noReal) return;
        const cur = m.material;
        const list = Array.isArray(cur) ? cur : [cur];
        if (list.some((x) => ours.has(x)) || !list.some(convertible)) return;
        const flat = !m.geometry.getAttribute("normal");
        // nơi khác gán vật liệu mới (React render lại) → coi đó là bản gốc mới
        m.userData.__orig = cur;
        m.material = Array.isArray(cur) ? cur.map((x) => conv(x, flat)) : conv(cur, flat);
        touched.add(m);
        // vật liệu "sống" (cảnh đổi màu / phát sáng mỗi khung, vd. ván tàu Theseus): bản PBR chép lại từ bản gốc trước khi vẽ
        const src = !Array.isArray(cur) && cur.userData.live ? (cur as THREE.MeshToonMaterial) : null;
        const dst = src ? (m.material as THREE.MeshStandardMaterial) : null;
        if (src && dst && (dst as THREE.Material) !== src) {
          m.userData.__liveCb = m.onBeforeRender;
          m.onBeforeRender = () => {
            dst.color.copy(src.color);
            realColor(dst.color);
            dst.emissive.copy(src.emissive);
          };
        }
      });
    apply();
    const id = window.setInterval(apply, 1500);
    return () => {
      window.clearInterval(id);
      for (const m of touched) {
        const list = Array.isArray(m.material) ? m.material : [m.material];
        if (list.some((x) => ours.has(x)) && m.userData.__orig) m.material = m.userData.__orig;
        delete m.userData.__orig;
        if (m.userData.__liveCb) {
          m.onBeforeRender = m.userData.__liveCb;
          delete m.userData.__liveCb;
        }
      }
      ours.forEach((x) => x.dispose());
    };
  }, [on, root]);
  return null;
}
