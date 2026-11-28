"use client";
/**
 * Thư khố bỏ hoang — cảnh tả thực (SCP / Backrooms) mở từ cửa hầm thép ở sân Thế giới Bất Khả.
 * Kế hoạch + tiến độ: docs/ai-reviews/archive-real/PLAN.md. Bố cục / va chạm thuần: lib/world/archiveLayout.ts (+ test).
 *
 *  • Mô-đun 4 × 4 × 3,2 m từ Blender (public/world/archive/archive.glb): UV0 vật liệu PBR (Poly Haven CC0, 1K WebP),
 *    UV1 lightmap Cycles nướng sẵn (path tracing, 2048 mẫu) — mỗi loại mô-đun một InstancedMesh / vật liệu, dùng chung lightmap.
 *  • Ô quanh người chơi (11 × 11) dựng lại khi đổi ô — không cấp phát mỗi khung (ma trận / mảng dựng sẵn).
 *  • Đèn pin: SpotLight có bóng PCF + cookie; nhân vật (cel) nhận ánh sáng từ "probe" bán cầu khớp ô đang đứng;
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
import { sfx } from "@/lib/world/sfx";
import {
  archiveBlocked,
  cameraReach,
  CELL,
  cellBits,
  ceilingAt,
  DARK,
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
  pillarAt,
  SHELFC,
  shouldMutate,
  type EpochFn,
} from "@/lib/world/archiveLayout";

const BASE = "archive/";
/** bán kính cửa sổ ô quanh người chơi (ô) */
const WIN_R = 4;
const N_CELLS = (2 * WIN_R + 1) ** 2;
/** module GLB → khoá lightmap */
const MODS = ["cell", "cell_dark", "wall", "door", "pillar", "shelf", "shelf_near"] as const;
/** kệ gần (≤ 1 ô quanh người chơi) đổ bóng đèn pin; kệ xa thì không (bóng chỉ thấy rõ ở gần) — cùng lưới GLB */
const NODE: Record<string, string> = { shelf_near: "shelf" };
type Mod = (typeof MODS)[number];
const CAP: Record<Mod, number> = { cell: N_CELLS, cell_dark: N_CELLS, wall: 4 * N_CELLS, door: N_CELLS, pillar: (2 * WIN_R + 2) ** 2, shelf: N_CELLS, shelf_near: 9 };
/** vật thể đổ bóng đèn pin */
const CASTS: Record<Mod, boolean> = { cell: false, cell_dark: false, wall: true, door: true, pillar: true, shelf: false, shelf_near: true };

// ───────────── epoch "bất khả" (ô phòng đổi dạng sau lưng) ─────────────
const EPOCH = new Map<number, number>();
const key = (i: number, j: number) => (i + 32768) * 65536 + (j + 32768);
const epochOf: EpochFn = (i, j) => EPOCH.get(key(i, j)) ?? 0;
const STATE = { ci: 1e9, cj: 1e9, tick: 0, dirty: true };
export const archiveBlockedNow = (x: number, z: number) => archiveBlocked(x, z, 0.3, epochOf);

// ───────────── vật liệu ─────────────
/** bề mặt nướng: bỏ ánh sáng môi trường thời gian thực (bán cầu cho nhân vật) — chỉ lightmap + đèn pin */
function bakedOnly(sh: THREE.WebGLProgramParametersWithUniforms) {
  sh.fragmentShader = sh.fragmentShader.replace("#include <lights_fragment_maps>", "#if defined( RE_IndirectDiffuse )\n irradiance = vec3( 0.0 );\n#endif\n#include <lights_fragment_maps>");
}
/** đèn huỳnh quang: độ sáng phát xạ theo màu instance (chập chờn từng ô) */
function lampFlicker(sh: THREE.WebGLProgramParametersWithUniforms) {
  bakedOnly(sh);
  sh.fragmentShader = sh.fragmentShader.replace("#include <emissivemap_fragment>", "#include <emissivemap_fragment>\n#ifdef USE_INSTANCING_COLOR\n totalEmissiveRadiance *= vColor;\n#endif");
}

type Tex = Record<string, THREE.Texture>;
function texList() {
  const s = new Set<string>();
  for (const m of Object.values(ARCHIVE_MATS)) for (const k of ["map", "normalMap", "roughnessMap", "metalnessMap"] as const) if (m[k]) s.add(m[k]!);
  return [...s];
}
const TEX_FILES = texList();
const LM_KEYS = ["mod_cell", "mod_cell_dark", "mod_wall", "mod_door", "mod_pillar", "mod_shelf", "arch_hall"] as const;

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

/** cookie đèn pin: lõi sáng, vành mờ, vài vệt bẩn trên kính (vẽ một lần) */
function cookieTexture() {
  const S = 256;
  const c = document.createElement("canvas");
  c.width = c.height = S;
  const g = c.getContext("2d")!;
  g.fillStyle = "#000";
  g.fillRect(0, 0, S, S);
  const r = g.createRadialGradient(S / 2, S / 2, 0, S / 2, S / 2, S / 2);
  r.addColorStop(0, "#fff");
  r.addColorStop(0.22, "#f4efe6");
  r.addColorStop(0.3, "#9a968e");
  r.addColorStop(0.42, "#bdb8ae");
  r.addColorStop(0.62, "#47443f");
  r.addColorStop(0.9, "#0d0c0b");
  r.addColorStop(1, "#000");
  g.fillStyle = r;
  g.fillRect(0, 0, S, S);
  // vệt bẩn / xước trên kính đèn (tất định)
  let s = 7;
  const rnd = () => ((s = (s * 16807) % 2147483647) / 2147483647);
  g.globalCompositeOperation = "multiply";
  for (let k = 0; k < 26; k++) {
    const a = rnd() * Math.PI * 2;
    const rr = rnd() * S * 0.36;
    const x = S / 2 + Math.cos(a) * rr;
    const y = S / 2 + Math.sin(a) * rr;
    const gr = g.createRadialGradient(x, y, 0, x, y, 6 + rnd() * 22);
    const v = Math.round(150 + rnd() * 90);
    gr.addColorStop(0, `rgb(${v},${v},${v})`);
    gr.addColorStop(1, "#fff");
    g.fillStyle = gr;
    g.fillRect(0, 0, S, S);
  }
  const t = new THREE.CanvasTexture(c);
  t.colorSpace = THREE.SRGBColorSpace;
  return t;
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

type Inst = { im: THREE.InstancedMesh; mod: Mod; lamp: boolean };

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
  const { insts, mats, hall, sky, lamp } = useMemo(() => {
    const mats: THREE.MeshStandardMaterial[] = [];
    const insts: Inst[] = [];
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
        im.castShadow = CASTS[mod];
        im.receiveShadow = true;
        im.name = `perf:ar_${mod}`;
        const lamp = !!ARCHIVE_MATS[src.name]?.emissive && mod === "cell";
        if (lamp) im.instanceColor = new THREE.InstancedBufferAttribute(new Float32Array(CAP[mod] * 3).fill(1), 3);
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
    const lamp = insts.find((x) => x.lamp) ?? null;
    return { insts, mats, hall, sky: sky ? (sky.material as THREE.ShaderMaterial) : null, lamp };
  }, [gltf, tex, lms]);
  useEffect(
    () => () => {
      insts.forEach((x) => x.im.dispose());
      mats.forEach((m) => m.dispose());
    },
    [insts, mats],
  );

  // ───────────── dựng lại ô quanh người chơi (khi đổi ô) ─────────────
  const flick = useMemo(() => ({ idx: new Int32Array(N_CELLS), n: 0, seed: new Float32Array(N_CELLS) }), []);
  const M = useMemo(() => new THREE.Matrix4(), []);
  const byMod = useMemo(() => {
    const r = {} as Record<Mod, Inst[]>;
    for (const m of MODS) r[m] = insts.filter((x) => x.mod === m);
    return r;
  }, [insts]);
  const counts = useMemo(() => ({ cell: 0, cell_dark: 0, wall: 0, door: 0, pillar: 0, shelf: 0, shelf_near: 0 }) as Record<Mod, number>, []);
  const FWD = useMemo(() => new THREE.Vector3(), []);

  function put(mod: Mod, x: number, z: number, rot: number) {
    const n = counts[mod];
    if (n >= CAP[mod]) return -1;
    M.makeRotationY(rot).setPosition(x, 0, z);
    for (const it of byMod[mod]) it.im.setMatrixAt(n, M);
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
    for (let j = cj - WIN_R; j <= cj + WIN_R; j++)
      for (let i = ci - WIN_R; i <= ci + WIN_R; i++) {
        const b = cellBits(i, j, epochOf);
        if (!(b & OPEN)) continue;
        const x = i * CELL;
        const z = j * CELL;
        const n = put(b & DARK ? "cell_dark" : "cell", x, z, 0);
        if (b & FLICKER && !(b & DARK) && n >= 0) {
          flick.idx[flick.n] = n;
          flick.seed[flick.n++] = ((i * 92821) ^ (j * 68917)) & 1023;
        }
        if (b & SHELFC) put(Math.abs(i - ci) <= 1 && Math.abs(j - cj) <= 1 ? "shelf_near" : "shelf", x, z, Math.PI / 2);
        for (let d = 0; d < 4; d++) {
          const k = edgeKind(i, j, d, epochOf);
          if (k) put(k === 2 ? "door" : "wall", x, z, DIR_ROT[d]);
        }
      }
    for (let j = cj - WIN_R; j <= cj + WIN_R + 1; j++) for (let i = ci - WIN_R; i <= ci + WIN_R + 1; i++) if (pillarAt(i, j, epochOf)) put("pillar", i * CELL - HALF, j * CELL - HALF, 0);
    for (const it of insts) {
      it.im.count = counts[it.mod];
      it.im.instanceMatrix.needsUpdate = true;
      if (it.im.instanceColor) {
        (it.im.instanceColor.array as Float32Array).fill(1);
        it.im.instanceColor.needsUpdate = true;
      }
    }
    STATE.ci = ci;
    STATE.cj = cj;
  }

  // gắn cảnh: bóng đổ (PCF), dựng ô đầu tiên, chụp cubemap phản chiếu cho kim loại
  const lampMat = lamp ? (lamp.im.material as THREE.MeshStandardMaterial) : null;
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
    if (process.env.NODE_ENV !== "production") Object.assign(window, { __archive: { EPOCH, STATE, insts, rebuild, cellBits, edgeKind, pillarAt, epochOf, torch, mats, camera, hall, THREE } });
    return () => {
      gl.shadowMap.enabled = prevEn;
      gl.shadowMap.type = prevType;
      env.dispose();
      envRef.current = null;
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps -- dựng một lần khi gắn cảnh
  }, [gl, scene, insts, mats]);

  // cửa hầm niêm phong: gõ (âm thanh + rung nhẹ)
  useEffect(
    () =>
      registerAction("archive-door", () => {
        sfx.knock();
        useWorld.getState().addShake(0.12);
      }),
    [],
  );

  // ───────────── đèn pin + probe nhân vật + sương theo độ sâu ─────────────
  const cookie = useMemo(() => (typeof document === "undefined" ? null : cookieTexture()), []);
  useEffect(() => () => cookie?.dispose(), [cookie]);
  const torch = useMemo(() => {
    const l = new THREE.SpotLight("#ffe9cf", 90, 26, 0.52, 0.55, 2);
    l.castShadow = quality !== "low";
    l.shadow.mapSize.setScalar(quality === "high" ? 1024 : 512);
    l.shadow.radius = 3;
    l.shadow.bias = -0.0006;
    l.shadow.normalBias = 0.03;
    l.shadow.camera.near = 0.3;
    l.shadow.camera.far = 26;
    l.map = cookie;
    l.name = "ar_torch";
    return l;
  }, [cookie, quality]);
  useEffect(() => {
    scene.add(torch, torch.target);
    return () => {
      scene.remove(torch, torch.target);
      torch.dispose();
    };
  }, [scene, torch]);
  const hemi = useRef<THREE.HemisphereLight>(null);
  const fog = useMemo(() => new THREE.FogExp2("#15130f", 0.085), []);
  const C = useMemo(
    () => ({ litSky: new THREE.Color("#fff0dc"), litGnd: new THREE.Color("#4a3c2c"), darkSky: new THREE.Color("#4a5468"), darkGnd: new THREE.Color("#120f0c"), hallSky: new THREE.Color("#9fb6ff"), hallGnd: new THREE.Color("#3a2c22"), fogNear: new THREE.Color("#17140f"), fogDeep: new THREE.Color("#0b1016"), tmp: new THREE.Color(), probe: { k: 1 } }),
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
    // đèn pin: trên vai phải nhân vật, chiếu theo hướng máy quay (hơi chúc xuống)
    const yaw = s.camYaw;
    const fx = -Math.sin(yaw);
    const fz = -Math.cos(yaw);
    const pitch = Math.max(-0.6, Math.min(0.5, -s.camPitch * 0.8 + 0.05));
    torch.position.set(p.x + Math.cos(yaw) * 0.28 + fx * 0.15, p.y + 1.45, p.z - Math.sin(yaw) * 0.28 + fz * 0.15);
    torch.target.position.set(torch.position.x + fx * 10, torch.position.y + Math.tan(pitch) * 10 - 0.6, torch.position.z + fz * 10);
    torch.target.updateMatrixWorld();
    // độ sâu: lightmap tối dần, sương dày + lạnh hơn
    const depth = Math.min(1, Math.hypot(p.x, p.z) / 70);
    const lk = 1 - 0.4 * depth;
    for (const m of mats) if (m.userData.lmBase) m.lightMapIntensity = m.userData.lmBase * lk;
    fog.density = 0.082 + 0.03 * depth;
    fog.color.lerpColors(C.fogNear, C.fogDeep, depth);
    // probe nhân vật: khớp ô đang đứng (sáng / đèn hỏng / sảnh trăng)
    const h = hemi.current;
    if (h) {
      const b = cellBits(ci, cj, epochOf);
      const hallNow = inHall(p.x, p.z);
      const target = hallNow ? 0.9 : b & DARK ? 0.22 : 1.25;
      C.probe.k += (target - C.probe.k) * Math.min(1, dt * 3);
      h.intensity = C.probe.k * lk;
      h.color.lerp(hallNow ? C.hallSky : b & DARK ? C.darkSky : C.litSky, Math.min(1, dt * 3));
      h.groundColor.lerp(hallNow ? C.hallGnd : b & DARK ? C.darkGnd : C.litGnd, Math.min(1, dt * 3));
    }
    // đèn huỳnh quang chập chờn (vài ô)
    if (lamp?.im.instanceColor && flick.n) {
      const a = lamp.im.instanceColor.array as Float32Array;
      for (let k = 0; k < flick.n; k++) {
        const sd = flick.seed[k];
        const ph = time * (7 + (sd % 5)) + sd;
        const burst = Math.sin(time * 0.7 + sd) > 0.55;
        const v = burst ? (Math.sin(ph) * Math.sin(ph * 2.3 + 1.0) > 0.1 ? 1 : 0.06) : 1;
        const o = flick.idx[k] * 3;
        a[o] = a[o + 1] = a[o + 2] = v;
      }
      lamp.im.instanceColor.needsUpdate = true;
    }
    if (lampMat) lampMat.emissiveIntensity = (ARCHIVE_MATS.emit_fluoro.emissiveIntensity ?? 14) * 0.55 * lk;
    if (sky) sky.uniforms.uT.value = time;
  });

  return (
    <group>
      <hemisphereLight ref={hemi} args={["#fff0dc", "#4a3c2c", 1.2]} />
      {insts.map((x, i) => (
        <primitive key={i} object={x.im} />
      ))}
      <primitive object={hall} />
      <HallSconces />
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
  return (
    <group name="perf:ar_sconce">
      {SCONCES.map(([sx, y]) => (
        <group key={y} position={[sx * 2.97, 2.35, -y + HALL.dz]}>
          <mesh geometry={geoP} material={base} rotation={[0, 0, Math.PI / 2]} />
          <mesh geometry={geoB} material={bulb} position={[-sx * 0.12, 0, 0]} />
        </group>
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
