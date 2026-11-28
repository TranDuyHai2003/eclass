"use client";
/**
 * Thư khố bỏ hoang — cảnh tả thực (SCP / Backrooms) mở từ cửa hầm thép ở sân Thế giới Bất Khả.
 * Kế hoạch + tiến độ: docs/ai-reviews/archive-real/PLAN.md. Bố cục / va chạm thuần: lib/world/archiveLayout.ts (+ test).
 *
 *  • Mô-đun 4 × 4 × 3,2 m từ Blender (public/world/archive/archive.glb): UV0 vật liệu PBR (Poly Haven CC0, 1K WebP),
 *    UV1 lightmap Cycles nướng sẵn (path tracing, 2048 mẫu) — mỗi loại mô-đun một InstancedMesh / vật liệu, dùng chung lightmap.
 *  • Ô quanh người chơi (11 × 11) dựng lại khi đổi ô — không cấp phát mỗi khung (ma trận / mảng dựng sẵn).
 *  • Ánh sáng nướng theo ô: mỗi instance nhân lightmap với hệ số đèn còn sáng quanh nó + màu theo độ sâu (instanceColor
 *    dùng chung cho mọi vật liệu của một mô-đun) → ô đèn hỏng tối thật, đèn chập chờn làm cả ô chớp tắt (vũng sáng / bóng tối).
 *  • Đèn pin (ArchiveTorch.tsx): SpotLight bóng PCF + cookie + nón sáng thể tích + bụi; nhân vật (cel) nhận "probe" bán cầu theo ô;
 *    bề mặt nướng bỏ ánh sáng môi trường thời gian thực (chỉ lightmap + đèn pin) → không cộng sáng hai lần.
 *  • Bất khả: ô phòng sau lưng (ngoài tầm nhìn) đổi dạng mỗi lần dựng lại; càng sâu càng tối và lạnh (sương, lightmap).
 *  • Kim loại (cửa hầm, khung kệ): phản chiếu cubemap chụp một lần trong hành lang (PMREM).
 */
import { useEffect, useLayoutEffect, useMemo, useRef } from "react";
import { useFrame, useThree } from "@react-three/fiber";
import { useGLTF, useTexture } from "@react-three/drei";
import * as THREE from "three";
import { useWorld } from "../../store";
import { AVATAR_BY_ID, worldAsset } from "@/lib/world/avatars";
import { t as tt } from "@/lib/world/i18n";
import { Player, type Nearby } from "../Hub";
import { RemotePlayers } from "../RemotePlayers";
import { ARCHIVE_MATS, LM_SCALE } from "./archiveMats";
import { registerAction } from "../../actions";
import { sfx, setHum } from "@/lib/world/sfx";
import { ArchiveTorch } from "./ArchiveTorch";
import { ArchivePages, ArchivePresence, useArchivePages } from "./ArchiveExtras";
import { pageCount } from "@/lib/world/archivePages";
import {
  archiveBlocked,
  cameraReach,
  CELL,
  cellBits,
  ceilingAt,
  DARK,
  depth01,
  depthTint,
  floorLight,
  DIR_ROT,
  DIR_X,
  DIR_Z,
  edgeKind,
  EXIT,
  FLICKER,
  HALF,
  HALL,
  inHall,
  OPEN,
  pageNear,
  pillarAt,
  pillarLight,
  propLight,
  SHELFC,
  CABINET,
  DESK,
  spillAt,
  shouldMutate,
  type EpochFn,
} from "@/lib/world/archiveLayout";

const BASE = "archive/";
/** bán kính cửa sổ ô quanh người chơi (ô) */
const WIN_R = 4;
const N_CELLS = (2 * WIN_R + 1) ** 2;
/** module GLB → khoá lightmap */
const MODS = ["cell", "cell_dark", "wall", "door", "pillar", "shelf", "shelf_near", "cabinet", "desk"] as const;
/** kệ gần (≤ 1 ô quanh người chơi) đổ bóng đèn pin; kệ xa thì không (bóng chỉ thấy rõ ở gần) — cùng lưới GLB */
const NODE: Record<string, string> = { shelf_near: "shelf" };
type Mod = (typeof MODS)[number];
const CAP: Record<Mod, number> = { cell: N_CELLS, cell_dark: N_CELLS, wall: 4 * N_CELLS, door: N_CELLS, pillar: (2 * WIN_R + 2) ** 2, shelf: N_CELLS, shelf_near: 9, cabinet: N_CELLS, desk: N_CELLS };
/** vật thể đổ bóng đèn pin */
const CASTS: Record<Mod, boolean> = { cell: false, cell_dark: false, wall: true, door: true, pillar: true, shelf: false, shelf_near: true, cabinet: true, desk: true };

// ───────────── epoch "bất khả" (ô phòng đổi dạng sau lưng) ─────────────
const EPOCH = new Map<number, number>();
const key = (i: number, j: number) => (i + 32768) * 65536 + (j + 32768);
const epochOf: EpochFn = (i, j) => EPOCH.get(key(i, j)) ?? 0;
const STATE = { ci: 1e9, cj: 1e9, tick: 0, dirty: true };
export const archiveBlockedNow = (x: number, z: number) => archiveBlocked(x, z, 0.3, epochOf);

// ───────────── vật liệu ─────────────
/**
 * lightmap × hệ số ánh sáng của ô (instanceColor) — lúc onBeforeCompile #include chưa được mở → chèn đoạn chunk đã sửa.
 * Shader mảnh chỉ có USE_COLOR (USE_INSTANCING_COLOR chỉ định nghĩa ở shader đỉnh); GLB xuất không có màu đỉnh.
 */
const LFM = THREE.ShaderChunk.lights_fragment_maps.replace(
  "vec3 lightMapIrradiance = lightMapTexel.rgb * lightMapIntensity;",
  "vec3 lightMapIrradiance = lightMapTexel.rgb * lightMapIntensity;\n#ifdef USE_COLOR\n lightMapIrradiance *= vColor.rgb;\n#endif",
);
/** bề mặt nướng: bỏ ánh sáng môi trường thời gian thực (bán cầu cho nhân vật) — chỉ lightmap + đèn pin */
function bakedOnly(sh: THREE.WebGLProgramParametersWithUniforms) {
  sh.fragmentShader = sh.fragmentShader
    .replace("#include <lights_fragment_maps>", "#if defined( RE_IndirectDiffuse )\n irradiance = vec3( 0.0 );\n#endif\n" + LFM)
    // instanceColor = hệ số ánh sáng nướng của ô (không phải màu bề mặt): bỏ khỏi albedo
    .replace("#include <color_fragment>", "");
}
/** đèn huỳnh quang: độ sáng phát xạ theo màu instance (chập chờn từng ô) */
function lampFlicker(sh: THREE.WebGLProgramParametersWithUniforms) {
  bakedOnly(sh);
  sh.fragmentShader = sh.fragmentShader.replace("#include <emissivemap_fragment>", "#include <emissivemap_fragment>\n#ifdef USE_COLOR\n totalEmissiveRadiance *= vColor.rgb;\n#endif");
}

type Tex = Record<string, THREE.Texture>;
function texList() {
  const s = new Set<string>();
  for (const m of Object.values(ARCHIVE_MATS)) for (const k of ["map", "normalMap", "roughnessMap", "metalnessMap"] as const) if (m[k]) s.add(m[k]!);
  return [...s];
}
const TEX_FILES = texList();
const LM_KEYS = ["mod_cell", "mod_cell_dark", "mod_wall", "mod_door", "mod_pillar", "mod_shelf", "mod_cabinet", "mod_desk", "arch_hall"] as const;

/** vật liệu PBR cho (mô-đun, tên vật liệu Blender) — lightmap riêng mỗi mô-đun */
function makeMat(name: string, tex: Tex, lm: THREE.Texture | null, lmScale: number): THREE.MeshStandardMaterial {
  const d = ARCHIVE_MATS[name] ?? {};
  const m = new THREE.MeshStandardMaterial({
    name: `ar_${name}`,
    color: new THREE.Color().setRGB(...(d.color ?? [1, 1, 1]), THREE.LinearSRGBColorSpace),
    roughness: d.rough ?? 0.8,
    metalness: d.metal ?? 0,
  });
  if (d.map) m.map = tex[d.map];
  if (d.normalMap) {
    m.normalMap = tex[d.normalMap];
    m.normalScale.setScalar(d.normalScale ?? 1);
  }
  if (d.roughnessMap) m.roughnessMap = tex[d.roughnessMap];
  if (d.metalnessMap) m.metalnessMap = tex[d.metalnessMap];
  if (d.emissive) {
    m.emissive.setRGB(...d.emissive, THREE.LinearSRGBColorSpace);
    m.emissiveIntensity = (d.emissiveIntensity ?? 1) * 0.55;
  }
  const metal = (d.metal ?? 0) > 0.5;
  if (lm && !d.emissive) {
    m.lightMap = lm;
    // lightmap Cycles = bức xạ / albedo (pass khuếch tán, không màu) → three nhân albedo / π → bù π
    m.lightMapIntensity = lmScale * Math.PI;
    m.userData.lmBase = m.lightMapIntensity;
  }
  // kim loại: không có khuếch tán (lightmap = 0 ở đó) → phản chiếu cubemap hành lang (gắn sau khi chụp, xem Archive)
  m.userData.metal = metal;
  if (name === "glass") {
    m.transparent = true;
    m.opacity = 0.14;
    m.depthWrite = false;
    m.roughness = 0.05;
  }
  m.onBeforeCompile = d.emissive ? lampFlicker : bakedOnly;
  return m;
}

/** bầu trời đêm sau ô cửa sổ vòm: dải chân trời lạnh, trăng mờ sau mây, sao lấm tấm (shader, không ảnh) */
function moonSkyMaterial() {
  return new THREE.ShaderMaterial({
    fog: false,
    uniforms: { uT: { value: 0 } },
    vertexShader: "varying vec2 vUv; void main(){ vUv = uv; gl_Position = projectionMatrix * modelViewMatrix * vec4(position,1.0); }",
    fragmentShader: `varying vec2 vUv; uniform float uT;
      float h(vec2 p){ return fract(sin(dot(p, vec2(127.1, 311.7))) * 43758.5453); }
      float n(vec2 p){ vec2 i = floor(p), f = fract(p); f = f*f*(3.0-2.0*f);
        return mix(mix(h(i), h(i+vec2(1,0)), f.x), mix(h(i+vec2(0,1)), h(i+vec2(1,1)), f.x), f.y); }
      void main(){
        vec2 p = vUv;
        vec3 col = mix(vec3(0.05,0.08,0.16), vec3(0.006,0.01,0.03), smoothstep(0.1, 0.95, p.y));
        // trăng (góc trên phải), quầng
        vec2 m = vec2(0.66, 0.72);
        float d = length((p - m) * vec2(1.25, 1.0));
        col += vec3(0.75,0.82,1.0) * (smoothstep(0.075, 0.065, d) * 3.0 + exp(-d * 9.0) * 0.55);
        // mây trôi chậm che trăng
        float c = n(p * vec2(5.0, 9.0) + vec2(uT * 0.01, 0.0)) * 0.6 + n(p * vec2(11.0, 19.0) - vec2(uT * 0.006, 0.0)) * 0.4;
        col = mix(col, vec3(0.04,0.05,0.08) + exp(-d * 5.0) * vec3(0.18,0.2,0.26), smoothstep(0.55, 0.85, c) * 0.85);
        // sao
        vec2 g = floor(p * 180.0);
        float s = step(0.996, h(g)) * (0.6 + 0.4 * sin(uT * 2.0 + h(g + 3.0) * 40.0));
        col += vec3(s) * 0.9 * (1.0 - smoothstep(0.5, 0.9, c));
        gl_FragColor = vec4(col * 1.6, 1.0);
      }`,
  });
}

const POOL_CAP = 24;
/** vũng sáng đèn bàn trên sàn: quầng ấm cộng màu (decal) — sàn là lưới mô-đun ô tối, không nướng đèn bàn */
function poolMaterial() {
  return new THREE.ShaderMaterial({
    transparent: true,
    depthWrite: false,
    blending: THREE.AdditiveBlending,
    fog: true,
    uniforms: THREE.UniformsUtils.merge([THREE.UniformsLib.fog, { uC: { value: new THREE.Color("#ffb066") } }]),
    vertexShader: `varying vec2 vUv;
      #include <common>
      #include <fog_pars_vertex>
      void main(){ vUv = uv; vec4 mvPosition = modelViewMatrix * instanceMatrix * vec4(position, 1.0); gl_Position = projectionMatrix * mvPosition;
      #include <fog_vertex>
      }`,
    fragmentShader: `varying vec2 vUv; uniform vec3 uC;
      #include <common>
      #include <fog_pars_fragment>
      void main(){ float r = length(vUv - 0.5) * 2.0; float a = exp(-r * r * 5.0) * (1.0 - smoothstep(0.8, 1.0, r));
        gl_FragColor = vec4(uC * a * 0.22, 1.0);
        #include <fog_fragment>
      }`,
  });
}

type Inst = { im: THREE.InstancedMesh; mod: Mod; lamp: boolean };
/** ánh sáng nướng của từng instance (rgb, dùng chung cho mọi vật liệu của một mô-đun) + bản gốc để chập chờn */
type Light = { attr: THREE.InstancedBufferAttribute; base: Float32Array };
const MOD_I = Object.fromEntries(MODS.map((m, i) => [m, i])) as Record<Mod, number>;
const TINT: [number, number, number] = [1, 1, 1];
/** giá trị chập chờn của đèn huỳnh quang (tất định theo hạt giống ô) — phần lớn thời gian sáng, thỉnh thoảng một tràng chớp tắt */
function flickerAt(time: number, sd: number): number {
  const burst = Math.sin(time * 0.53 + sd) * Math.sin(time * 0.21 + sd * 1.7) > 0.42;
  if (!burst) return 1;
  const ph = time * (9 + (sd % 7)) + sd;
  return Math.sin(ph) * Math.sin(ph * 2.3 + 1.0) > 0.05 ? 0.9 : 0.04;
}

export function Archive() {
  const avatar = useWorld((s) => s.avatar);
  const quality = useWorld((s) => s.quality);
  const { gl, scene, camera } = useThree();
  const gltf = useGLTF(worldAsset(BASE + "archive.glb"));
  const texArr = useTexture(TEX_FILES.map((f) => worldAsset(BASE + "tex/" + f)));
  const lmArr = useTexture(LM_KEYS.map((k) => worldAsset(BASE + `lm_${k}.webp`)));
  const envRef = useRef<THREE.Texture | null>(null);

  // texture: UV kiểu glTF (không lật), lặp, sRGB cho màu / lightmap
  const { tex, lms } = useMemo(() => {
    const tex: Tex = {};
    TEX_FILES.forEach((f, i) => {
      const t = texArr[i];
      t.flipY = false;
      t.wrapS = t.wrapT = THREE.RepeatWrapping;
      t.anisotropy = 8;
      t.colorSpace = f.endsWith("_d.webp") ? THREE.SRGBColorSpace : THREE.NoColorSpace;
      t.needsUpdate = true;
      tex[f] = t;
    });
    const lms: Record<string, THREE.Texture> = {};
    LM_KEYS.forEach((k, i) => {
      const t = lmArr[i];
      t.flipY = false;
      t.channel = 1;
      t.colorSpace = THREE.SRGBColorSpace;
      t.needsUpdate = true;
      lms[k] = t;
    });
    return { tex, lms };
  }, [texArr, lmArr]);

  // InstancedMesh cho mỗi (mô-đun × vật liệu)
  const { insts, mats, hall, sky, lights } = useMemo(() => {
    const mats: THREE.MeshStandardMaterial[] = [];
    const insts: Inst[] = [];
    const lights = MODS.map((mod) => ({ attr: new THREE.InstancedBufferAttribute(new Float32Array(CAP[mod] * 3).fill(1), 3), base: new Float32Array(CAP[mod] * 3) }) as Light);
    for (const mod of MODS) {
      const base = NODE[mod] ?? mod;
      const node = gltf.scene.getObjectByName("m_" + base);
      if (!node) continue;
      const meshes: THREE.Mesh[] = [];
      node.traverse((o) => (o as THREE.Mesh).isMesh && meshes.push(o as THREE.Mesh));
      for (const me of meshes) {
        const src = me.material as THREE.Material;
        const mat = makeMat(src.name, tex, lms["mod_" + base], LM_SCALE["mod_" + base] ?? 1);
        mats.push(mat);
        const im = new THREE.InstancedMesh(me.geometry, mat, CAP[mod]);
        im.count = 0;
        im.frustumCulled = false;
        // cửa hầm 6 vật liệu: chỉ khung bê tông + cánh thép đổ bóng (sọc cảnh báo / đèn đỏ / chốt nhỏ không cần) → bớt 4 lượt bóng
        // tủ / bàn: chỉ thân (thép sơn / gỗ) đổ bóng, bỏ tay nắm, giấy, chụp đèn
        im.castShadow = CASTS[mod] && (mod !== "door" || src.name === "bk_concrete" || src.name === "bk_door") && (mod !== "cabinet" || src.name === "bk_cabinet") && (mod !== "desk" || src.name === "bk_trim");
        im.receiveShadow = true;
        im.name = `perf:ar_${mod}`;
        const lamp = !!ARCHIVE_MATS[src.name]?.emissive && mod === "cell";
        im.instanceColor = lights[MOD_I[mod]].attr;
        insts.push({ im, mod, lamp });
      }
    }
    // sảnh vào: lưới tĩnh, lightmap riêng
    const hall = new THREE.Group();
    hall.name = "perf:ar_hall";
    hall.position.z = HALL.dz;
    for (const nm of ["arch_hall", "x_glass", "x_moonsky"]) {
      const node = gltf.scene.getObjectByName(nm);
      if (!node) continue;
      node.traverse((o) => {
        const me = o as THREE.Mesh;
        if (!me.isMesh) return;
        const src = me.material as THREE.Material;
        const mat = nm === "x_moonsky" ? moonSkyMaterial() : makeMat(src.name, tex, nm === "arch_hall" ? lms.arch_hall : null, LM_SCALE.arch_hall ?? 1);
        if ((mat as THREE.MeshStandardMaterial).isMeshStandardMaterial) mats.push(mat as THREE.MeshStandardMaterial);
        const m = new THREE.Mesh(me.geometry, mat);
        me.updateWorldMatrix(true, false);
        m.applyMatrix4(me.matrixWorld);
        m.receiveShadow = nm === "arch_hall";
        m.renderOrder = nm === "x_glass" ? 2 : 0;
        hall.add(m);
      });
    }
    const sky = hall.children.find((o) => (o as THREE.Mesh).material instanceof THREE.ShaderMaterial) as THREE.Mesh | undefined;
    return { insts, mats, hall, sky: sky ? (sky.material as THREE.ShaderMaterial) : null, lights };
  }, [gltf, tex, lms]);
  useEffect(
    () => () => {
      insts.forEach((x) => x.im.dispose());
      mats.forEach((m) => m.dispose());
    },
    [insts, mats],
  );

  // ───────────── dựng lại ô quanh người chơi (khi đổi ô) ─────────────
  // ô chập chờn: hạt giống + dải [e0, e1) trong danh sách (mô-đun, instance) của ô đó (sàn, tường, cửa, kệ)
  const flick = useMemo(() => ({ n: 0, seed: new Float32Array(N_CELLS), x: new Float32Array(N_CELLS), z: new Float32Array(N_CELLS), e0: new Int32Array(N_CELLS), e1: new Int32Array(N_CELLS), last: new Float32Array(N_CELLS), ne: 0, em: new Int8Array(N_CELLS * 8), ei: new Int32Array(N_CELLS * 8) }), []);
  const M = useMemo(() => new THREE.Matrix4(), []);
  const pools = useMemo(() => {
    const g = new THREE.PlaneGeometry(3.2, 3.2);
    g.rotateX(-Math.PI / 2);
    const im = new THREE.InstancedMesh(g, poolMaterial(), POOL_CAP);
    im.count = 0;
    im.frustumCulled = false;
    im.renderOrder = 1;
    im.name = "perf:ar_pool";
    return { im, n: 0 };
  }, []);
  useEffect(
    () => () => {
      pools.im.geometry.dispose();
      (pools.im.material as THREE.Material).dispose();
      pools.im.dispose();
    },
    [pools],
  );
  const byMod = useMemo(() => {
    const r = {} as Record<Mod, Inst[]>;
    for (const m of MODS) r[m] = insts.filter((x) => x.mod === m);
    return r;
  }, [insts]);
  const counts = useMemo(() => Object.fromEntries(MODS.map((m) => [m, 0])) as Record<Mod, number>, []);
  const FWD = useMemo(() => new THREE.Vector3(), []);

  /** đặt một instance; l = hệ số ánh sáng nướng (× màu theo độ sâu TINT); ghi vào danh sách chập chờn nếu ô đang chập chờn */
  function put(mod: Mod, x: number, z: number, rot: number, l: number, fl: boolean) {
    const n = counts[mod];
    if (n >= CAP[mod]) return -1;
    M.makeRotationY(rot).setPosition(x, 0, z);
    for (const it of byMod[mod]) it.im.setMatrixAt(n, M);
    const a = lights[MOD_I[mod]].attr.array as Float32Array;
    a[n * 3] = l * TINT[0];
    a[n * 3 + 1] = l * TINT[1];
    a[n * 3 + 2] = l * TINT[2];
    if (fl && flick.ne < flick.em.length) {
      flick.em[flick.ne] = MOD_I[mod];
      flick.ei[flick.ne++] = n;
    }
    counts[mod] = n + 1;
    return n;
  }
  function rebuild(ci: number, cj: number) {
    STATE.tick++;
    // ô phòng sau lưng đổi dạng (không thấy) — trước khi dựng
    camera.getWorldDirection(FWD);
    const fl = Math.hypot(FWD.x, FWD.z) || 1;
    const p = useWorld.getState().player;
    for (let j = cj - WIN_R; j <= cj + WIN_R; j++)
      for (let i = ci - WIN_R; i <= ci + WIN_R; i++) if (shouldMutate(i, j, p.x, p.z, FWD.x / fl, FWD.z / fl, STATE.tick)) EPOCH.set(key(i, j), STATE.tick);
    for (const m of MODS) counts[m] = 0;
    flick.n = 0;
    pools.n = 0;
    flick.ne = 0;
    for (let j = cj - WIN_R; j <= cj + WIN_R; j++)
      for (let i = ci - WIN_R; i <= ci + WIN_R; i++) {
        const b = cellBits(i, j, epochOf);
        if (!(b & OPEN)) continue;
        const x = i * CELL;
        const z = j * CELL;
        depthTint(depth01(x, z), TINT);
        const fl = (b & FLICKER) !== 0 && !(b & DARK);
        if (fl) {
          flick.seed[flick.n] = ((i * 92821) ^ (j * 68917)) & 1023;
          flick.x[flick.n] = x;
          flick.z[flick.n] = z;
          flick.last[flick.n] = 1;
          flick.e0[flick.n] = flick.ne;
        }
        const pl = propLight(i, j, epochOf);
        put(b & DARK ? "cell_dark" : "cell", x, z, 0, floorLight(i, j, epochOf), fl);
        if (b & SHELFC) put(b & CABINET ? "cabinet" : Math.abs(i - ci) <= 1 && Math.abs(j - cj) <= 1 ? "shelf_near" : "shelf", x, z, Math.PI / 2, pl, fl);
        if (b & DESK) {
          // đèn bàn luôn sáng (nướng sẵn) + chút ánh sáng tràn từ ô kề; hướng bàn tất định theo ô
          const rot = (((i * 7 + j * 13) % 4) + 4) % 4;
          const n = put("desk", x, z, (rot * Math.PI) / 2, b & DARK ? 0.75 + 0.25 * spillAt(i, j, epochOf) : 1, fl);
          if (n >= 0 && pools.n < POOL_CAP) {
            const a = (rot * Math.PI) / 2;
            // vũng sáng ấm dưới đèn bàn (đèn ở (0,42; 0,16) cục bộ Blender → three: (x, −y))
            M.makeRotationY(a).setPosition(x + Math.cos(a) * 0.42 + Math.sin(a) * -0.16, 0.012, z - Math.sin(a) * 0.42 + Math.cos(a) * -0.16);
            pools.im.setMatrixAt(pools.n++, M);
          }
        }
        for (let d = 0; d < 4; d++) {
          const k = edgeKind(i, j, d, epochOf);
          if (k) put(k === 2 ? "door" : "wall", x, z, DIR_ROT[d], pl, fl);
        }
        if (fl) flick.e1[flick.n++] = flick.ne;
      }
    for (let j = cj - WIN_R; j <= cj + WIN_R + 1; j++)
      for (let i = ci - WIN_R; i <= ci + WIN_R + 1; i++)
        if (pillarAt(i, j, epochOf)) {
          depthTint(depth01(i * CELL - HALF, j * CELL - HALF), TINT);
          // lightmap cột nướng sát đèn (thang 31) → hạ 40 % cho khỏi "phát sáng" trong vùng tối
          put("pillar", i * CELL - HALF, j * CELL - HALF, 0, 0.6 * pillarLight(i, j, epochOf), false);
        }
    for (const it of insts) {
      it.im.count = counts[it.mod];
      it.im.instanceMatrix.needsUpdate = true;
    }
    pools.im.count = pools.n;
    pools.im.instanceMatrix.needsUpdate = true;
    for (const L of lights) {
      L.base.set(L.attr.array as Float32Array);
      L.attr.needsUpdate = true;
    }
    STATE.ci = ci;
    STATE.cj = cj;
  }

  // gắn cảnh: bóng đổ (PCF), dựng ô đầu tiên, chụp cubemap phản chiếu cho kim loại
  useLayoutEffect(() => {
    EPOCH.clear();
    STATE.ci = STATE.cj = 1e9;
    const p = useWorld.getState().player;
    rebuild(Math.round(p.x / CELL), Math.round(p.z / CELL));
    const prevEn = gl.shadowMap.enabled;
    const prevType = gl.shadowMap.type;
    gl.shadowMap.enabled = quality !== "low";
    gl.shadowMap.type = THREE.PCFShadowMap;
    // cubemap hành lang (một lần) → PMREM cho kim loại
    const cubeRT = new THREE.WebGLCubeRenderTarget(128, { type: THREE.HalfFloatType });
    const cam = new THREE.CubeCamera(0.1, 40, cubeRT);
    cam.position.set(0, 1.6, 4);
    const pm = new THREE.PMREMGenerator(gl);
    scene.add(cam);
    const hidden: THREE.Object3D[] = [];
    scene.traverse((o) => {
      if ((o as THREE.SkinnedMesh).isSkinnedMesh && o.visible) {
        o.visible = false;
        hidden.push(o);
      }
    });
    cam.update(gl, scene);
    hidden.forEach((o) => (o.visible = true));
    scene.remove(cam);
    const env = pm.fromCubemap(cubeRT.texture).texture;
    envRef.current = env;
    for (const m of mats) {
      if (m.userData.metal || m.name === "ar_glass") {
        m.envMap = env;
        m.envMapIntensity = m.name === "ar_glass" ? 1.4 : 0.9;
        m.needsUpdate = true;
      }
    }
    cubeRT.dispose();
    pm.dispose();
    if (process.env.NODE_ENV !== "production") Object.assign(window, { __archive: { EPOCH, STATE, insts, rebuild, cellBits, edgeKind, pillarAt, epochOf, mats, camera, hall, lights, flick, THREE } });
    return () => {
      gl.shadowMap.enabled = prevEn;
      gl.shadowMap.type = prevType;
      env.dispose();
      envRef.current = null;
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps -- dựng một lần khi gắn cảnh
  }, [gl, scene, insts, mats]);

  // rời cảnh: tắt tiếng ù
  useEffect(() => () => setHum(0), []);

  // cửa hầm niêm phong: gõ (âm thanh + rung nhẹ)
  useEffect(
    () =>
      registerAction("archive-door", () => {
        sfx.knock();
        useWorld.getState().addShake(0.12);
      }),
    [],
  );

  // ───────────── đèn pin (ArchiveTorch) + probe nhân vật + sương theo độ sâu ─────────────
  const torchPower = useMemo(() => ({ v: 1 }), []);
  const reach = useMemo(() => (x: number, z: number, dx: number, dz: number, max: number) => cameraReach(x, z, x + dx * max, z + dz * max, epochOf, 0.05) * max, []);
  const hemi = useRef<THREE.HemisphereLight>(null);
  const fog = useMemo(() => new THREE.FogExp2("#15130f", 0.085), []);
  const C = useMemo(
    () => ({ litSky: new THREE.Color("#fff0dc"), litGnd: new THREE.Color("#4a3c2c"), darkSky: new THREE.Color("#4a5468"), darkGnd: new THREE.Color("#120f0c"), hallSky: new THREE.Color("#9fb6ff"), hallGnd: new THREE.Color("#3a2c22"), fogNear: new THREE.Color("#17140f"), fogDeep: new THREE.Color("#0b1016"), tmp: new THREE.Color(), probe: { k: 1 }, dirty: new Uint8Array(MODS.length), zapAt: 0, hum: 0 }),
    [],
  );
  useEffect(() => {
    // nền = màu sương (cùng một Color, đổi theo độ sâu) → mép cửa sổ ô (≈ 16 m) tan vào sương, không lộ khoảng trống
    const prevBg = scene.background;
    scene.fog = fog;
    scene.background = fog.color;
    return () => {
      if (scene.fog === fog) scene.fog = null;
      if (scene.background === fog.color) scene.background = prevBg;
    };
  }, [scene, fog]);

  useFrame((st, dt) => {
    const s = useWorld.getState();
    const p = s.player;
    const ci = Math.round(p.x / CELL);
    const cj = Math.round(p.z / CELL);
    if (ci !== STATE.ci || cj !== STATE.cj) rebuild(ci, cj);
    const time = st.clock.elapsedTime;
    // độ sâu: sương dày + lạnh hơn (ánh sáng nướng tối / lạnh dần theo từng ô — depthTint trong rebuild)
    const depth = depth01(p.x, p.z);
    const lk = 1 - 0.5 * depth;
    fog.density = 0.085 + 0.035 * depth;
    fog.color.lerpColors(C.fogNear, C.fogDeep, depth);
    // đèn huỳnh quang chập chờn: cả ô (sàn, trần, tường, kệ, cửa) chớp tắt cùng bóng đèn; tiếng tách khi bật lại gần người chơi
    let here = 1;
    let zapD = 99;
    const dirty = C.dirty;
    dirty.fill(0);
    for (let k = 0; k < flick.n; k++) {
      const v = flickerAt(time, flick.seed[k]);
      const d = Math.hypot(flick.x[k] - p.x, flick.z[k] - p.z);
      if (d < HALF * 1.2) here = v;
      if (v === flick.last[k]) continue;
      if (v > flick.last[k] && d < zapD) zapD = d;
      flick.last[k] = v;
      for (let e = flick.e0[k]; e < flick.e1[k]; e++) {
        const L = lights[flick.em[e]];
        const a = L.attr.array as Float32Array;
        const o = flick.ei[e] * 3;
        a[o] = L.base[o] * v;
        a[o + 1] = L.base[o + 1] * v;
        a[o + 2] = L.base[o + 2] * v;
        dirty[flick.em[e]] = 1;
      }
    }
    for (let m = 0; m < lights.length; m++) if (dirty[m]) lights[m].attr.needsUpdate = true;
    if (zapD < 14 && time - C.zapAt > 0.09) {
      C.zapAt = time;
      sfx.zap(Math.max(0.15, 1 - zapD / 14));
    }
    // probe nhân vật: khớp ô đang đứng (sáng / đèn hỏng / sảnh trăng)
    const h = hemi.current;
    if (h) {
      const b = cellBits(ci, cj, epochOf);
      const hallNow = inHall(p.x, p.z);
      const target = hallNow ? 0.9 : b & DARK ? 0.06 + 0.3 * floorLight(ci, cj, epochOf) : 1.2 * here;
      C.probe.k += (target - C.probe.k) * Math.min(1, dt * 3);
      h.intensity = C.probe.k * lk;
      // tiếng ù huỳnh quang 100 Hz theo đèn quanh chỗ đứng (ô tối: xa xăm)
      C.hum += ((hallNow ? 0.05 : b & DARK ? 0.25 * floorLight(ci, cj, epochOf) : here > 0.5 ? 0.85 : 0.1) * lk - C.hum) * Math.min(1, dt * 2);
      setHum(C.hum);
      h.color.lerp(hallNow ? C.hallSky : b & DARK ? C.darkSky : C.litSky, Math.min(1, dt * 3));
      h.groundColor.lerp(hallNow ? C.hallGnd : b & DARK ? C.darkGnd : C.litGnd, Math.min(1, dt * 3));
    }
    if (sky) sky.uniforms.uT.value = time;
  });

  return (
    <group>
      <hemisphereLight ref={hemi} args={["#fff0dc", "#4a3c2c", 1.2]} />
      {insts.map((x, i) => (
        <primitive key={i} object={x.im} />
      ))}
      <primitive object={hall} />
      <primitive object={pools.im} />
      <HallSconces />
      <ArchiveTorch quality={quality} reach={reach} power={torchPower} />
      <ArchivePages />
      <ArchivePresence epochOf={epochOf} power={torchPower} />
      <RemotePlayers />
      <Player avatarFile={AVATAR_BY_ID[avatar]?.file} blocked={archiveBlockedNow} findNearby={archiveNearby} camClamp={clampCam} />
    </group>
  );
}

/** đèn tường sảnh (khớp vị trí đèn nướng L_sconce0..2 trong archive.blend): bóng đèn sợi đốt ấm + đế đồng */
const SCONCES: [number, number][] = [
  [1, 4.2],
  [-1, 11.4],
  [1, 18.6],
];
function HallSconces() {
  const { bulb, base, geoB, geoP } = useMemo(
    () => ({
      bulb: new THREE.MeshStandardMaterial({ color: "#ffd9a8", emissive: new THREE.Color("#ffb46a"), emissiveIntensity: 6, roughness: 0.3 }),
      base: new THREE.MeshStandardMaterial({ color: "#3a2a18", metalness: 1, roughness: 0.35 }),
      geoB: new THREE.SphereGeometry(0.07, 16, 12),
      geoP: new THREE.CylinderGeometry(0.09, 0.11, 0.05, 20),
    }),
    [],
  );
  useEffect(
    () => () => {
      bulb.dispose();
      base.dispose();
      geoB.dispose();
      geoP.dispose();
    },
    [bulb, base, geoB, geoP],
  );
  // 3 đèn × (đế + bóng) = 2 InstancedMesh (2 lệnh vẽ thay vì 6)
  const { ims } = useMemo(() => {
    const a = new THREE.InstancedMesh(geoP, base, SCONCES.length);
    const b = new THREE.InstancedMesh(geoB, bulb, SCONCES.length);
    const m = new THREE.Matrix4();
    const q = new THREE.Quaternion().setFromEuler(new THREE.Euler(0, 0, Math.PI / 2));
    const one = new THREE.Vector3(1, 1, 1);
    const pos = new THREE.Vector3();
    SCONCES.forEach(([sx, y], k) => {
      pos.set(sx * 2.97, 2.35, -y + HALL.dz);
      a.setMatrixAt(k, m.compose(pos, q, one));
      pos.x += -sx * 0.12;
      b.setMatrixAt(k, m.identity().setPosition(pos));
    });
    return { ims: [a, b] };
  }, [geoP, geoB, base, bulb]);
  return (
    <group name="perf:ar_sconce">
      {ims.map((o, k) => (
        <primitive key={k} object={o} />
      ))}
    </group>
  );
}

function clampCam(pos: THREE.Vector3, target: THREE.Vector3) {
  const t = cameraReach(target.x, target.z, pos.x, pos.z, epochOf);
  if (t < 1) {
    pos.x = target.x + (pos.x - target.x) * t;
    pos.z = target.z + (pos.z - target.z) * t;
  }
  pos.y = Math.min(pos.y, ceilingAt(pos.x, pos.z) - 0.3);
}

function archiveNearby(p: THREE.Vector3): Nearby | null {
  const lang = useWorld.getState().lang;
  if (Math.hypot(p.x - EXIT.x, p.z - EXIT.z) < EXIT.r) return { kind: "portal", id: "impossible", label: tt(lang, "archiveExit") };
  // trang "Hồi âm" trên sàn
  const got = useArchivePages.getState().got;
  if (pageNear(p.x, p.z, got) >= 0) return { kind: "action", id: "archive-page", label: tt(lang, "archivePage", { n: pageCount(got) + 1 }) };
  // cửa hầm gần nhất (niêm phong)
  const ci = Math.round(p.x / CELL);
  const cj = Math.round(p.z / CELL);
  for (let d = 0; d < 4; d++) {
    if (edgeKind(ci, cj, d, epochOf) !== 2) continue;
    const ex = ci * CELL + DIR_X[d] * HALF;
    const ez = cj * CELL + DIR_Z[d] * HALF;
    if (Math.hypot(p.x - ex, p.z - ez) < 1.6) return { kind: "action", id: "archive-door", label: tt(lang, "archiveSealed") };
  }
  return null;
}

useGLTF.preload(worldAsset(BASE + "archive.glb"));
