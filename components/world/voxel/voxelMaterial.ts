"use client";
/**
 * Vật liệu địa hình voxel: MeshToonMaterial (2–3 dải toon + viền mực của hậu kỳ) + ánh sáng kiểu Minecraft:
 *  - aLight.x = ánh trời (0..1), aLight.y = ánh khối (0..1) — nội suy mịn trên mặt (đã lấy trung bình 4 ô quanh đỉnh);
 *  - độ sáng = max(trời × uDay, khối), cong gamma + sàn uFloor (hang không đen kịt); ánh khối ấm (đèn / pha lê);
 *  - sắc độ ngẫu nhiên từng khối tính ở fragment theo ô nguyên (floor(vị trí − pháp tuyến·0,5)) — không phá việc gộp mặt.
 * Ngày đêm chỉ đổi uniform (VOXEL_U), không dựng lại lưới.
 */
import * as THREE from "three";
import { GRADIENT } from "../fx/shaders";
import { DETAIL_TILES, TILE_NAMES, TILE_PX, tileBase } from "@/lib/world/voxel/tiles";
import { worldAsset } from "@/lib/world/avatars";

/**
 * Hoạ tiết khối: DataArrayTexture (mỗi lớp TILE_PX², phóng = gần nhất, thu = mipmap tuyến tính). Tạo ngay bằng màu gốc
 * (giống hệt trước khi có ảnh), nạp `tiles.png` (dải dọc, đã chuẩn hoá khi đóng gói) rồi thay dữ liệu.
 */
// ảnh ô gạch: worldAsset("voxel/tiles.png") (CDN ở production)
let tilesTex: THREE.DataArrayTexture | null = null;
function voxelTiles(): THREE.DataArrayTexture {
  if (tilesTex) return tilesTex;
  const N = TILE_NAMES.length;
  const P = TILE_PX * TILE_PX;
  const data = new Uint8Array(P * N * 4);
  for (let l = 0; l < N; l++) {
    const b = DETAIL_TILES.has(l) ? ([0.5, 0.5, 0.5] as const) : (tileBase(l) ?? [0.5, 0.5, 0.5]);
    for (let i = 0; i < P; i++) {
      const o = (l * P + i) * 4;
      data[o] = Math.round(b[0] * 255);
      data[o + 1] = Math.round(b[1] * 255);
      data[o + 2] = Math.round(b[2] * 255);
      data[o + 3] = 255;
    }
  }
  const t = new THREE.DataArrayTexture(data, TILE_PX, TILE_PX, N);
  t.magFilter = THREE.NearestFilter;
  t.minFilter = THREE.LinearMipmapLinearFilter;
  t.generateMipmaps = true;
  t.wrapS = t.wrapT = THREE.RepeatWrapping;
  t.anisotropy = 4;
  t.needsUpdate = true;
  tilesTex = t;
  if (typeof window !== "undefined") {
    const img = new Image();
    img.onload = () => {
      if (img.width !== TILE_PX || img.height !== TILE_PX * N) return;
      const c = document.createElement("canvas");
      c.width = img.width;
      c.height = img.height;
      const g = c.getContext("2d", { willReadFrequently: true });
      if (!g) return;
      g.drawImage(img, 0, 0);
      data.set(g.getImageData(0, 0, img.width, img.height).data);
      t.needsUpdate = true;
    };
    img.src = worldAsset("voxel/tiles.png");
  }
  return t;
}

export const VOXEL_U = {
  uDay: { value: 1 },
  uFloor: { value: 0.07 },
  uWarm: { value: new THREE.Color(1.0, 0.7, 0.4) },
  /** nhuộm ánh trời (trắng ban ngày → lam trăng ban đêm) */
  uSkyTint: { value: new THREE.Color(1, 1, 1) },
};

/** far: địa hình xa (không có aLight — coi như lộ trời hoàn toàn, không sắc độ theo ô), hai mặt */
export function voxelMaterial(opts: { emissive?: THREE.ColorRepresentation; emissiveIntensity?: number; far?: boolean } = {}) {
  const far = !!opts.far;
  const m = new THREE.MeshToonMaterial({
    vertexColors: true,
    gradientMap: GRADIENT,
    emissive: opts.emissive ?? 0x000000,
    emissiveIntensity: opts.emissiveIntensity ?? 1,
    side: far ? THREE.DoubleSide : THREE.FrontSide,
  });
  m.onBeforeCompile = (sh) => {
    sh.uniforms.uDay = VOXEL_U.uDay;
    sh.uniforms.uFloor = VOXEL_U.uFloor;
    sh.uniforms.uWarm = VOXEL_U.uWarm;
    sh.uniforms.uSkyTint = VOXEL_U.uSkyTint;
    if (!far) sh.uniforms.uTiles = { value: voxelTiles() };
    sh.vertexShader = sh.vertexShader
      .replace(
        "#include <common>",
        `#include <common>\n${far ? "" : "attribute vec2 aLight; attribute float aTile; varying float vTile; varying vec3 vWP; varying vec3 vNrm;"}\nvarying vec2 vLight;\nvarying vec3 vCell;`,
      )
      .replace(
        "#include <begin_vertex>",
        `#include <begin_vertex>
        vLight = ${far ? "vec2(1.0, 0.0)" : "aLight"};
        ${far ? "" : "vTile = aTile; vWP = (modelMatrix * vec4(transformed, 1.0)).xyz; vNrm = objectNormal;"}
        vCell = floor((modelMatrix * vec4(transformed - objectNormal * 0.5, 1.0)).xyz + 0.001);`,
      );
    sh.fragmentShader = sh.fragmentShader
      .replace(
        "#include <common>",
        `#include <common>\nuniform float uDay; uniform float uFloor; uniform vec3 uWarm; uniform vec3 uSkyTint;\n${far ? "" : "uniform sampler2DArray uTiles; varying float vTile; varying vec3 vWP; varying vec3 vNrm;"}\nvarying vec2 vLight;\nvarying vec3 vCell;`,
      )
      .replace(
        "#include <color_fragment>",
        `#include <color_fragment>
        ${
          far
            ? ""
            : `// hoạ tiết theo toạ độ thế giới (mặt đã gộp vẫn lặp đúng từng khối); cạnh: hàng 0 của ảnh = đỉnh khối.
        // textureGrad với đạo hàm của uv CHƯA fract → không lộ đường mipmap ở mép ô
        if (vTile < 254.5) {
          vec3 an = abs(vNrm);
          vec2 uv = an.y > 0.5 ? vWP.xz : an.x > 0.5 ? vec2(-sign(vNrm.x) * vWP.z, -vWP.y) : vec2(sign(vNrm.z) * vWP.x, -vWP.y);
          vec4 tx = textureGrad(uTiles, vec3(fract(uv), floor(vTile + 0.5)), dFdx(uv), dFdy(uv));
          diffuseColor.rgb *= tx.rgb * 2.0;
        }
        // sắc độ ngẫu nhiên theo ô (±4%)
        float hcell = fract(sin(dot(vCell, vec3(12.9898, 78.233, 37.719))) * 43758.5453);
        diffuseColor.rgb *= 0.96 + hcell * 0.08;`
        }
        float sky = vLight.x * uDay;
        float blk = vLight.y;
        float L = max(sky, blk);
        float lum = mix(uFloor, 1.0, pow(L, 1.35));
        // ánh khối lấn át ánh trời → nhuốm ấm
        float warm = clamp((blk - sky) * 2.5, 0.0, 1.0);
        diffuseColor.rgb *= lum * mix(uSkyTint, uWarm * 1.35, warm * 0.85);`,
      );
  };
  m.customProgramCacheKey = () => `voxel-${opts.emissive ? 1 : 0}-${far ? 1 : 0}`;
  return m;
}

/**
 * Nước dạng khối (lưới nước của chunk — nguồn + dòng chảy): trong suốt, không ghi độ sâu, sáng theo cùng ánh trời / khối
 * với địa hình (VOXEL_U), mặt trên có gợn trôi + lấp lánh toon, mặt bên sẫm hơn. Một vật liệu dùng chung mọi chunk.
 */
export const WATER_BLOCK_U = { uT: { value: 0 } };
export function voxelWaterMaterial(normalTex: THREE.Texture) {
  return new THREE.ShaderMaterial({
    transparent: true,
    depthWrite: false,
    fog: true,
    side: THREE.DoubleSide,
    uniforms: {
      ...THREE.UniformsUtils.clone(THREE.UniformsLib.fog),
      uDay: VOXEL_U.uDay,
      uFloor: VOXEL_U.uFloor,
      uWarm: VOXEL_U.uWarm,
      uSkyTint: VOXEL_U.uSkyTint,
      uT: WATER_BLOCK_U.uT,
      uNormal: { value: normalTex },
    },
    vertexShader: /* glsl */ `
      #include <common>
      #include <fog_pars_vertex>
      attribute vec2 aLight;
      varying vec2 vLight; varying vec3 vW; varying vec3 vN;
      void main() {
        vLight = aLight;
        vN = normal;
        vec4 w = modelMatrix * vec4(position, 1.0);
        vW = w.xyz;
        vec4 mvPosition = viewMatrix * w;
        gl_Position = projectionMatrix * mvPosition;
        #include <fog_vertex>
      }`,
    fragmentShader: /* glsl */ `
      #include <common>
      #include <fog_pars_fragment>
      uniform float uDay; uniform float uFloor; uniform vec3 uWarm; uniform vec3 uSkyTint; uniform float uT;
      uniform sampler2D uNormal;
      varying vec2 vLight; varying vec3 vW; varying vec3 vN;
      void main() {
        float top = step(0.5, vN.y);
        vec2 sl = texture2D(uNormal, vW.xz * 0.11 + vec2(uT * 0.02, uT * 0.013)).rg * 2.0 - 1.0;
        vec3 V = normalize(cameraPosition - vW);
        vec3 N = normalize(mix(vN, vec3(-sl.x * 0.5, 1.0, -sl.y * 0.5), top));
        float fres = pow(1.0 - clamp(dot(N, V), 0.0, 1.0), 3.0);
        vec3 col = mix(vec3(0.2, 0.52, 0.9), vec3(0.42, 0.82, 0.95), top * 0.6 + fres * 0.4);
        col *= mix(0.78, 1.0, top);
        // gợn sáng (toon): ngưỡng cứng trên độ dốc gợn
        col += top * step(0.62, abs(sl.x + sl.y)) * vec3(0.35, 0.45, 0.5);
        float sky = vLight.x * uDay;
        float blk = vLight.y;
        float lum = mix(uFloor, 1.0, pow(max(sky, blk), 1.35));
        float warm = clamp((blk - sky) * 2.5, 0.0, 1.0);
        col *= lum * mix(uSkyTint, uWarm * 1.35, warm * 0.85);
        gl_FragColor = vec4(col, mix(0.62, 0.8, fres));
        #include <fog_fragment>
      }`,
  });
}
