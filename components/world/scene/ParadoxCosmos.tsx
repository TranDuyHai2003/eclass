"use client";
/**
 * Hư Không Nghịch Lý — phần mở rộng vũ trụ (khám phá rộng):
 *  - Ba đảo ngoài: Đài Chân Trời Sự Kiện (vòm kim loại hướng hố đen), Quảng trường Dữ liệu (cột hologram phương trình nghịch lý),
 *    Đài Thiên Văn (nghi thiên cầu)
 *  - Năm vùng xa: Rạn San Hô Fractal · Thác Nước Chảy Ngược (cưỡi thác lên đảo trời) · Thành Phố Neon Ngược ·
 *    Rừng Sứa Tinh Vân · Đỉnh Vô Cực (bệ hoà âm Pythagore)
 *  - Siêu cấu trúc: vành Dyson quanh hố đen (`props/paradox_mega.glb`, Blender), vành đai tiểu hành tinh, hành tinh khí có vành
 *  - Luồng gió nâng + cổng dịch chuyển (mở dần khi đã tới vùng) + hồi sinh khi rơi vào hư không
 */
import { useEffect, useMemo, useRef } from "react";
import { useFrame } from "@react-three/fiber";
import { useGLTF } from "@react-three/drei";
import * as THREE from "three";
import { worldAsset } from "@/lib/world/avatars";
import { FAR, ISLES, OUTER, UPDRAFTS } from "@/lib/world/paradoxVoid";
import { sfx } from "@/lib/world/sfx";
import { useWorld } from "../store";
import { Label3D } from "../ui/Labels";
import { MagicCircle } from "../fx/Effects";
import { Updrafts } from "./Props";
import { Armillary } from "./HubDecor";
import { usePdxStyle } from "./VoidHybrid";

const MEGA = worldAsset("props/paradox_mega.glb");
useGLTF.preload(MEGA);
const T = { value: 0 };

// ───────────── Vùng, cổng dịch chuyển ─────────────
export const ZONES = [
  { id: "z1", isle: FAR.z1a, name: { vi: "Rạn San Hô Fractal", en: "Fractal Reef" }, sub: { vi: "mỗi nhánh là bản thu nhỏ của cả cây", en: "every branch is a small copy of the whole tree" }, color: "#7dff9a" },
  { id: "z2", isle: FAR.z2a, name: { vi: "Thác Nước Chảy Ngược", en: "Upstream Falls" }, sub: { vi: "mở tàu lượn trong dòng thác để bay lên", en: "open your glider in the falls to fly up" }, color: "#6fb6ff" },
  { id: "z3", isle: FAR.z3a, name: { vi: "Thành Phố Neon Ngược", en: "Inverted Neon City" }, sub: { vi: "trên – dưới chỉ là quy ước", en: "up and down are just conventions" }, color: "#ff9ec0" },
  { id: "z4", isle: FAR.z4a, name: { vi: "Rừng Sứa Tinh Vân", en: "Nebula Jellyfish Grove" }, sub: { vi: "sinh vật trôi trong biển sao", en: "creatures drifting in a sea of stars" }, color: "#b58bff" },
  { id: "z5", isle: FAR.z5, name: { vi: "Đỉnh Vô Cực", en: "Infinity Peak" }, sub: { vi: "bước lên bệ: chuỗi hoà âm f, 2f, 3f…", en: "step on the pads: harmonic series f, 2f, 3f…" }, color: "#ffd27a" },
] as const;
const ZKEY = "world.pdx.zones";
function loadZones(): Set<string> {
  try {
    const v = JSON.parse(localStorage.getItem(ZKEY) || "[]");
    return new Set(Array.isArray(v) ? v.filter((x) => typeof x === "string") : []);
  } catch {
    return new Set();
  }
}
const VISITED = { set: new Set<string>(), loaded: false };
function visited() {
  if (!VISITED.loaded && typeof window !== "undefined") {
    VISITED.set = loadZones();
    VISITED.loaded = true;
  }
  return VISITED.set;
}
/** Cổng ở đảo tâm (5 cổng quanh rìa, mỗi vùng một cổng — sáng khi đã tới vùng đó) */
const HUB_GATES = ZONES.map((z, i) => {
  const a = (-0.6 + i * 0.3) * Math.PI + Math.PI / 2;
  return { zone: z.id, x: Math.cos(a) * 7.2, z: Math.sin(a) * 7.2 };
});
/** Điểm đặt chân khi dịch chuyển tới vùng */
function zoneLanding(id: string) {
  const z = ZONES.find((q) => q.id === id)!;
  return new THREE.Vector3(z.isle.x + 1.5, z.isle.h, z.isle.z + 1.5);
}
/** Cổng ở mỗi vùng (về đảo tâm) */
const ZONE_GATES = ZONES.map((z) => ({ zone: z.id, x: z.isle.x - z.isle.r * 0.55, z: z.isle.z, h: z.isle.h }));

export function paradoxTeleport(id: string) {
  const w = useWorld.getState();
  const [, target] = id.split(":");
  if (target === "hub") w.player.set(0, 0, 4);
  else w.player.set(...(zoneLanding(target).toArray() as [number, number, number]));
  w.burst([w.player.x, w.player.y + 1, w.player.z], "#bfe8ff", 60);
  sfx.chime(4);
}

/** Lân cận: cổng dịch chuyển */
export function cosmosNearby(p: THREE.Vector3): { kind: "paradox"; id: string; label: string } | null {
  const vi = useWorld.getState().lang === "vi";
  for (const g of ZONE_GATES) if (Math.hypot(p.x - g.x, p.z - g.z) < 1.6 && Math.abs(p.y - g.h) < 2) return { kind: "paradox", id: "tp:hub", label: vi ? "Dịch chuyển về đảo tâm" : "Teleport to the central isle" };
  for (const g of HUB_GATES) {
    if (Math.hypot(p.x - g.x, p.z - g.z) > 1.3 || p.y > 2) continue;
    const z = ZONES.find((q) => q.id === g.zone)!;
    if (!visited().has(g.zone)) return { kind: "paradox", id: "locked", label: vi ? `Cổng ${z.name.vi} · hãy tự tìm đường tới đó trước` : `${z.name.en} gate · find your way there first` };
    return { kind: "paradox", id: `tp:${g.zone}`, label: vi ? `Dịch chuyển tới ${z.name.vi}` : `Teleport to ${z.name.en}` };
  }
  return null;
}

/** Vật cản thêm: bệ đài thiên văn, cột hologram */
export function cosmosBlocked(x: number, z: number): boolean {
  if (Math.hypot(x - OUTER.o3.x, z - OUTER.o3.z) < 2.3) return true;
  for (let i = 0; i < 6; i++) {
    const a = (2 * Math.PI * i) / 6 + Math.PI / 6;
    if (Math.hypot(x - (OUTER.o2.x + Math.cos(a) * 5.3), z - (OUTER.o2.z + Math.sin(a) * 5.3)) < 0.55) return true;
  }
  return false;
}

// ───────────── Hologram phương trình (Quảng trường Dữ liệu) ─────────────
const HOLO = [
  { eq: "e^{iπ} + 1 = 0", t: { vi: "Đồng nhất thức Euler", en: "Euler's identity" } },
  { eq: "1 + ¼ + ⅑ + … = π²/6", t: { vi: "Bài toán Basel", en: "The Basel problem" } },
  { eq: "1 + 2 + 3 + … “=” −1/12", t: { vi: "Tổng Ramanujan (nghịch lý)", en: "Ramanujan sum (paradox)" } },
  { eq: "xₙ₊₁ = r·xₙ(1 − xₙ)", t: { vi: "Ánh xạ logistic · hỗn loạn", en: "Logistic map · chaos" } },
  { eq: "ℵ₀ < 2^ℵ₀", t: { vi: "Cantor: vô hạn có nhiều cỡ", en: "Cantor: infinities have sizes" } },
  { eq: "0,999… = 1", t: { vi: "Hai cách viết, một con số", en: "Two spellings, one number" } },
];
function holoTexture(eq: string, title: string) {
  const cv = document.createElement("canvas");
  cv.width = 512;
  cv.height = 256;
  const g = cv.getContext("2d")!;
  g.fillStyle = "rgba(10, 30, 60, 0.0)";
  g.fillRect(0, 0, 512, 256);
  g.strokeStyle = "rgba(120, 240, 255, 0.9)";
  g.lineWidth = 3;
  g.strokeRect(8, 8, 496, 240);
  g.fillStyle = "rgba(120, 240, 255, 0.85)";
  g.font = "600 26px sans-serif";
  g.textAlign = "center";
  g.fillText(title, 256, 62);
  g.shadowColor = "#7ff0ff";
  g.shadowBlur = 18;
  g.fillStyle = "#e8fdff";
  g.font = "700 44px 'Times New Roman', serif";
  g.fillText(eq, 256, 158);
  const t = new THREE.CanvasTexture(cv);
  t.colorSpace = THREE.SRGBColorSpace;
  return t;
}
function Holograms() {
  const lang = useWorld((s) => (s.lang === "vi" ? "vi" : "en"));
  const res = useMemo(
    () =>
      HOLO.map((h, hi) => {
        const tex = holoTexture(h.eq, h.t[lang]);
        const mat = new THREE.ShaderMaterial({
          uniforms: { uTex: { value: tex }, uT: T, uSeed: { value: hi * 1.7 + 0.3 } },
          vertexShader: "varying vec2 vUv; void main(){ vUv = uv; gl_Position = projectionMatrix * modelViewMatrix * vec4(position, 1.0); }",
          fragmentShader: `uniform sampler2D uTex; uniform float uT; uniform float uSeed; varying vec2 vUv;
            void main(){
              vec2 uv = vUv;
              // nhiễu ngang thỉnh thoảng (glitch) + đường quét
              float g = step(0.985, fract(sin(floor(uT * 7.0 + uSeed) * 12.9898) * 43758.5));
              uv.x += g * (fract(sin(floor(uv.y * 30.0) * 78.2 + uT) * 4375.5) - 0.5) * 0.05;
              vec4 c = texture2D(uTex, uv);
              float scan = 0.75 + 0.25 * sin(uv.y * 240.0 - uT * 8.0);
              float flick = 0.88 + 0.12 * sin(uT * 23.0 + uSeed);
              vec3 tint = vec3(0.45, 0.95, 1.0);
              float a = (c.a * 0.95 + 0.08) * scan * flick;
              gl_FragColor = vec4((c.rgb * 1.6 + tint * 0.15) * a, a);
            }`,
          transparent: true,
          depthWrite: false,
          side: THREE.DoubleSide,
          blending: THREE.AdditiveBlending,
          toneMapped: false,
        });
        return { tex, mat };
      }),
    [lang],
  );
  useEffect(() => () => res.forEach((r) => (r.tex.dispose(), r.mat.dispose())), [res]);
  const refs = useRef<(THREE.Group | null)[]>([]);
  useFrame((st) => {
    const t = st.clock.elapsedTime;
    refs.current.forEach((g, i) => {
      if (!g) return;
      g.position.y = OUTER.o2.h + 2.4 + Math.sin(t * 0.9 + i) * 0.12;
      g.lookAt(OUTER.o2.x, g.position.y, OUTER.o2.z);
      g.rotateY(Math.PI);
    });
  });
  return (
    <group>
      {res.map((r, i) => {
        const a = (2 * Math.PI * i) / 6 + Math.PI / 6;
        return (
          <group key={i} ref={(el) => void (refs.current[i] = el)} position={[OUTER.o2.x + Math.cos(a) * 5.3, OUTER.o2.h + 2.4, OUTER.o2.z + Math.sin(a) * 5.3]}>
            <mesh material={r.mat}>
              <planeGeometry args={[3.2, 1.6]} />
            </mesh>
            {/* chùm sáng chiếu từ cột lên tấm */}
            <mesh position={[0, -1.0, 0]}>
              <coneGeometry args={[0.9, 1.9, 6, 1, true]} />
              <meshBasicMaterial color={new THREE.Color("#7ff0ff").multiplyScalar(1.2)} transparent opacity={0.08} depthWrite={false} blending={THREE.AdditiveBlending} toneMapped={false} side={THREE.DoubleSide} />
            </mesh>
          </group>
        );
      })}
    </group>
  );
}

// ───────────── Siêu cấu trúc ─────────────
function DysonRing() {
  const gltf = useGLTF(MEGA);
  const real = usePdxStyle((s) => s.real);
  const obj = useMemo(() => {
    const g = new THREE.Group();
    for (const n of ["vm_dyson", "vm_dyson_neon"]) {
      const o = gltf.scene.getObjectByName(n);
      if (!o) continue;
      const c = o.clone(true);
      c.traverse((x) => {
        const m = x as THREE.Mesh;
        if (!m.isMesh) return;
        const conv = (mm: THREE.Material) => {
          const s = mm as THREE.MeshStandardMaterial;
          if (s.name.startsWith("glow_")) return new THREE.MeshBasicMaterial({ color: s.color.clone().multiplyScalar(3.2), toneMapped: false, fog: false });
          const p = s.clone();
          p.fog = false;
          if (!real) {
            p.metalness = 0.3;
            p.roughness = 0.6;
          }
          return p;
        };
        m.material = Array.isArray(m.material) ? m.material.map(conv) : conv(m.material);
      });
      g.add(c);
    }
    return g;
  }, [gltf, real]);
  const g = useRef<THREE.Group>(null);
  useFrame((_, dt) => {
    if (g.current) g.current.rotation.z += dt * 0.012;
  });
  return (
    <group position={[95, 60, -170]} rotation={[1.25, 0.25, 0]} scale={1.55}>
      <group ref={g}>
        <primitive object={obj} />
      </group>
    </group>
  );
}

function AsteroidBelt() {
  const gltf = useGLTF(MEGA);
  const N = 70;
  const parts = useMemo(() => {
    const out: { geo: THREE.BufferGeometry; mat: THREE.Material }[] = [];
    for (let k = 0; k < 3; k++) {
      const o = gltf.scene.getObjectByName(`vm_rock_${k}`);
      o?.traverse((x) => {
        const m = x as THREE.Mesh;
        if (!m.isMesh) return;
        // đá vũ trụ: tối, nhám, ít phản chiếu (đứng ngược sáng hố đen trông như bóng đen viền sáng)
        const src = m.material as THREE.MeshStandardMaterial;
        const mat = src.clone();
        mat.color.set(src.name === "a_rock2" ? "#2a2240" : "#1c1830");
        mat.roughness = 0.85;
        mat.metalness = 0.1;
        mat.envMapIntensity = 0.25;
        out.push({ geo: m.geometry, mat });
      });
    }
    return out;
  }, [gltf]);
  const refs = useRef<(THREE.InstancedMesh | null)[]>([]);
  useEffect(() => {
    let seed = 7;
    const r = () => ((seed = (seed * 16807) % 2147483647) / 2147483647);
    const m = new THREE.Matrix4();
    const q = new THREE.Quaternion();
    const e = new THREE.Euler();
    parts.forEach((p, pi) => {
      const im = refs.current[pi];
      if (!im) return;
      for (let i = 0; i < N; i++) {
        const a = r() * Math.PI * 2;
        const rr = 122 + r() * 34;
        const s = 0.8 + Math.pow(r(), 3) * 7;
        e.set(r() * 6, r() * 6, r() * 6);
        m.compose(new THREE.Vector3(Math.cos(a) * rr, (r() - 0.5) * 16, Math.sin(a) * rr), q.setFromEuler(e), new THREE.Vector3(s, s * (0.7 + r() * 0.5), s));
        im.setMatrixAt(i, m);
      }
      im.instanceMatrix.needsUpdate = true;
    });
  }, [parts]);
  const g = useRef<THREE.Group>(null);
  useFrame((_, dt) => {
    if (g.current) g.current.rotation.y += dt * 0.004;
  });
  return (
    <group rotation={[0.12, 0, 0.05]}>
      <group ref={g}>
        {parts.map((p, i) => (
          <instancedMesh key={i} ref={(el) => void (refs.current[i] = el)} args={[p.geo, p.mat, N]} frustumCulled={false} />
        ))}
      </group>
    </group>
  );
}

function RingedPlanet() {
  const res = useMemo(() => {
    const body = new THREE.ShaderMaterial({
      uniforms: { uT: T, uSun: { value: new THREE.Vector3(0.7, 0.35, -0.6).normalize() } },
      vertexShader: "varying vec3 vN; varying vec3 vP; varying vec3 vW; void main(){ vN = normalize(mat3(modelMatrix) * normal); vP = position; vec4 w = modelMatrix * vec4(position,1.0); vW = w.xyz; gl_Position = projectionMatrix * viewMatrix * w; }",
      fragmentShader: `uniform float uT; uniform vec3 uSun; varying vec3 vN; varying vec3 vP; varying vec3 vW;
        float h(float x){ return fract(sin(x * 127.1) * 43758.5453); }
        float n1(float x){ float i = floor(x), f = fract(x); f = f*f*(3.0-2.0*f); return mix(h(i), h(i+1.0), f); }
        void main(){
          vec3 p = normalize(vP);
          float lat = p.y * 9.0 + n1(p.x * 3.0 + uT * 0.02) * 0.8 + sin(atan(p.z, p.x) * 3.0 + p.y * 12.0) * 0.15;
          float b = 0.5 + 0.5 * sin(lat * 2.2) * 0.7 + 0.3 * n1(lat * 3.1);
          vec3 c = mix(vec3(0.42, 0.28, 0.62), vec3(0.98, 0.72, 0.52), b);
          c = mix(c, vec3(0.3, 0.75, 0.95), smoothstep(0.7, 0.95, n1(lat * 1.7 + 4.0)) * 0.5);
          vec3 N = normalize(vN); // pháp tuyến thế giới (modelMatrix không có trong fragment shader)
          float lit = clamp(dot(N, uSun) * 0.9 + 0.15, 0.03, 1.0);
          vec3 V = normalize(cameraPosition - vW);
          float rim = pow(1.0 - abs(dot(N, V)), 3.0);
          gl_FragColor = vec4(c * lit + vec3(0.55, 0.65, 1.0) * rim * 0.9, 1.0);
        }`,
      fog: false,
    });
    const ring = new THREE.ShaderMaterial({
      uniforms: {},
      vertexShader: "varying vec3 vP; void main(){ vP = position; gl_Position = projectionMatrix * modelViewMatrix * vec4(position,1.0); }",
      fragmentShader: `varying vec3 vP;
        void main(){
          float r = length(vP.xy);
          float t = (r - 46.0) / 30.0;
          float bands = 0.55 + 0.45 * sin(r * 1.7) * sin(r * 0.43 + 1.0);
          float a = smoothstep(0.0, 0.06, t) * (1.0 - smoothstep(0.85, 1.0, t)) * bands * 0.8;
          vec3 c = mix(vec3(0.95, 0.85, 0.72), vec3(0.7, 0.6, 0.95), t);
          gl_FragColor = vec4(c * 1.2, a);
        }`,
      transparent: true,
      depthWrite: false,
      side: THREE.DoubleSide,
      fog: false,
    });
    return { body, ring };
  }, []);
  useEffect(() => () => (res.body.dispose(), res.ring.dispose()), [res]);
  return (
    <group position={[-175, -30, 150]} rotation={[0.35, 0.4, 0.22]}>
      <mesh material={res.body}>
        <sphereGeometry args={[34, 64, 32]} />
      </mesh>
      <mesh material={res.ring} rotation={[Math.PI / 2 - 0.15, 0, 0]}>
        <ringGeometry args={[46, 76, 128, 1]} />
      </mesh>
    </group>
  );
}

// ───────────── Thác nước chảy ngược (z2) ─────────────
function ReverseFalls() {
  const u = UPDRAFTS[0];
  const top = u.top;
  const base = FAR.z2a.h + 0.1;
  const mat = useMemo(
    () =>
      new THREE.ShaderMaterial({
        uniforms: { uT: T },
        vertexShader: "varying vec2 vUv; void main(){ vUv = uv; gl_Position = projectionMatrix * modelViewMatrix * vec4(position,1.0); }",
        fragmentShader: `uniform float uT; varying vec2 vUv;
          float h(vec2 p){ return fract(sin(dot(p, vec2(127.1, 311.7))) * 43758.5453); }
          float n2(vec2 p){ vec2 i = floor(p), f = fract(p); f = f*f*(3.0-2.0*f); return mix(mix(h(i), h(i+vec2(1,0)), f.x), mix(h(i+vec2(0,1)), h(i+vec2(1,1)), f.x), f.y); }
          void main(){
            // nước chảy NGƯỢC lên: vân dòng chảy trượt theo +v
            vec2 q = vec2(vUv.x * 10.0, vUv.y * 6.0 - uT * 1.6);
            float s = n2(q) * 0.6 + n2(q * 2.3 + 3.0) * 0.4;
            float streak = smoothstep(0.45, 0.9, s);
            float fade = smoothstep(0.0, 0.05, vUv.y) * (1.0 - smoothstep(0.85, 1.0, vUv.y));
            vec3 c = mix(vec3(0.25, 0.55, 1.0), vec3(0.85, 0.97, 1.0), streak);
            float a = (0.18 + streak * 0.55) * fade;
            gl_FragColor = vec4(c * 1.5 * a, a);
          }`,
        transparent: true,
        depthWrite: false,
        side: THREE.DoubleSide,
        blending: THREE.AdditiveBlending,
        toneMapped: false,
      }),
    [],
  );
  useEffect(() => () => mat.dispose(), [mat]);
  return (
    <group position={[u.x, base, u.z]}>
      <mesh material={mat} position={[0, (top - base) / 2, 0]}>
        <cylinderGeometry args={[1.6, 2.2, top - base, 32, 1, true]} />
      </mesh>
      <mesh material={mat} position={[0, (top - base) / 2, 0]} scale={[0.6, 1, 0.6]}>
        <cylinderGeometry args={[1.6, 2.2, top - base, 24, 1, true]} />
      </mesh>
    </group>
  );
}

// ───────────── Sứa tinh vân (z4) ─────────────
function Jellyfish() {
  const N = 9;
  const res = useMemo(() => {
    const bellGeo = new THREE.SphereGeometry(1, 32, 16, 0, Math.PI * 2, 0, Math.PI / 2);
    const bell = new THREE.ShaderMaterial({
      uniforms: { uT: T },
      vertexShader: `uniform float uT; varying vec3 vN; varying vec3 vV; varying float vY;
        void main(){ vec3 p = position; float pulse = sin(uT * 2.0 + float(gl_InstanceID) * 1.3);
          p.xz *= 1.0 + 0.12 * pulse * (1.0 - p.y); p.y *= 1.0 - 0.1 * pulse; vY = p.y;
          vec4 mv = modelViewMatrix * instanceMatrix * vec4(p, 1.0); vV = -mv.xyz; vN = normalize(normalMatrix * mat3(instanceMatrix) * normal);
          gl_Position = projectionMatrix * mv; }`,
      fragmentShader: `varying vec3 vN; varying vec3 vV; varying float vY;
        void main(){ float fr = pow(1.0 - abs(dot(normalize(vN), normalize(vV))), 2.0);
          vec3 c = mix(vec3(0.9, 0.45, 1.0), vec3(0.45, 0.9, 1.0), vY);
          float a = 0.15 + fr * 0.75; gl_FragColor = vec4(c * (0.6 + fr * 1.8) * a, a); }`,
      transparent: true,
      depthWrite: false,
      side: THREE.DoubleSide,
      blending: THREE.AdditiveBlending,
      toneMapped: false,
    });
    // xúc tu: 8 sợi mỗi con, uốn sóng
    const pts: number[] = [];
    const aI: number[] = [];
    for (let j = 0; j < 8; j++)
      for (let k = 0; k < 14; k++) {
        const a = (j / 8) * Math.PI * 2;
        pts.push(Math.cos(a) * 0.6, -k * 0.32, Math.sin(a) * 0.6, Math.cos(a) * 0.6, -(k + 1) * 0.32, Math.sin(a) * 0.6);
        aI.push(k / 14, (k + 1) / 14);
      }
    const tentGeo = new THREE.BufferGeometry();
    tentGeo.setAttribute("position", new THREE.Float32BufferAttribute(pts, 3));
    tentGeo.setAttribute("aK", new THREE.Float32BufferAttribute(aI, 1));
    const tent = new THREE.ShaderMaterial({
      uniforms: { uT: T },
      vertexShader: `uniform float uT; attribute float aK; varying float vK;
        void main(){ vec3 p = position; vK = aK; float seed = modelMatrix[3].x * 0.37 + modelMatrix[3].z * 0.21;
          p.x += sin(uT * 1.7 + aK * 6.0 + seed) * 0.35 * aK; p.z += cos(uT * 1.3 + aK * 5.0 + seed) * 0.3 * aK;
          gl_Position = projectionMatrix * modelViewMatrix * vec4(p, 1.0); }`,
      fragmentShader: `varying float vK; void main(){ gl_FragColor = vec4(vec3(0.75, 0.6, 1.0) * 1.8 * (1.0 - vK), 1.0 - vK); }`,
      transparent: true,
      depthWrite: false,
      blending: THREE.AdditiveBlending,
      toneMapped: false,
    });
    return { bellGeo, bell, tentGeo, tent };
  }, []);
  useEffect(() => () => Object.values(res).forEach((o) => o.dispose()), [res]);
  const bells = useRef<THREE.InstancedMesh>(null);
  const tents = useRef<(THREE.LineSegments | null)[]>([]);
  const tmp = useMemo(() => ({ m: new THREE.Matrix4(), q: new THREE.Quaternion(), p: new THREE.Vector3(), s: new THREE.Vector3() }), []);
  useFrame((st) => {
    const t = st.clock.elapsedTime;
    for (let i = 0; i < N; i++) {
      const a = (i / N) * Math.PI * 2 + t * 0.05 * (i % 2 ? 1 : -1);
      const R = 9 + (i % 3) * 6;
      tmp.p.set(FAR.z4a.x + Math.cos(a) * R, FAR.z4a.h + 4 + (i % 4) * 2.2 + Math.sin(t * 0.6 + i) * 1.2, FAR.z4a.z + 6 + Math.sin(a) * R);
      tmp.s.setScalar(1.2 + (i % 3) * 0.7);
      tmp.m.compose(tmp.p, tmp.q.identity(), tmp.s);
      bells.current?.setMatrixAt(i, tmp.m);
      const tl = tents.current[i];
      if (tl) {
        tl.position.copy(tmp.p);
        tl.scale.copy(tmp.s);
      }
    }
    if (bells.current) bells.current.instanceMatrix.needsUpdate = true;
  });
  return (
    <group>
      <instancedMesh ref={bells} args={[res.bellGeo, res.bell, N]} frustumCulled={false} />
      {Array.from({ length: N }, (_, i) => (
        <lineSegments key={i} ref={(el) => void (tents.current[i] = el)} geometry={res.tentGeo} material={res.tent} frustumCulled={false} />
      ))}
    </group>
  );
}

// ───────────── Bệ hoà âm (z5) ─────────────
const PADS = 8;
function HarmonicPads() {
  const lit = useRef<number[]>(Array(PADS).fill(-10));
  const on = useRef(-1);
  const refs = useRef<(THREE.Mesh | null)[]>([]);
  const mats = useMemo(() => Array.from({ length: PADS }, (_, i) => new THREE.MeshBasicMaterial({ color: new THREE.Color().setHSL(0.08 + i * 0.09, 0.8, 0.6), toneMapped: false, transparent: true, opacity: 0.55 })), []);
  useEffect(() => () => mats.forEach((m) => m.dispose()), [mats]);
  useFrame((st) => {
    const t = st.clock.elapsedTime;
    const p = useWorld.getState().player;
    let cur = -1;
    for (let i = 0; i < PADS; i++) {
      const a = (i / PADS) * Math.PI * 2;
      if (Math.hypot(p.x - (FAR.z5.x + Math.cos(a) * 3.4), p.z - (FAR.z5.z + Math.sin(a) * 3.4)) < 0.75 && Math.abs(p.y - FAR.z5.h) < 1) cur = i;
    }
    if (cur !== on.current) {
      on.current = cur;
      if (cur >= 0) {
        lit.current[cur] = t;
        sfx.harmonic(cur + 1);
      }
    }
    for (let i = 0; i < PADS; i++) {
      const k = Math.max(0, 1 - (t - lit.current[i]) / 1.2);
      mats[i].color.setHSL(0.08 + i * 0.09, 0.8, 0.6).multiplyScalar(1 + k * 3);
      mats[i].opacity = 0.45 + k * 0.5;
      const m = refs.current[i];
      if (m) m.scale.setScalar(1 + k * 0.25);
    }
  });
  return (
    <group position={[FAR.z5.x, FAR.z5.h + 0.03, FAR.z5.z]}>
      {mats.map((m, i) => {
        const a = (i / PADS) * Math.PI * 2;
        return (
          <mesh key={i} ref={(el) => void (refs.current[i] = el)} material={m} position={[Math.cos(a) * 3.4, 0, Math.sin(a) * 3.4]} rotation-x={-Math.PI / 2}>
            <circleGeometry args={[0.7, 6]} />
          </mesh>
        );
      })}
    </group>
  );
}

// ───────────── Ghép lại ─────────────
export function CosmicExpansion() {
  const lang = useWorld((s) => (s.lang === "vi" ? "vi" : "en"));
  const vi = lang === "vi";
  const lists = useMemo(
    () => [
      { ...UPDRAFTS[0], y: FAR.z2a.h },
      { ...UPDRAFTS[1], y: ISLES[6].h },
    ],
    [],
  );
  // ghi nhận vùng đã tới (mở cổng dịch chuyển ở đảo tâm)
  useFrame((st) => {
    T.value = st.clock.elapsedTime;
    const p = useWorld.getState().player;
    for (const z of ZONES) {
      if (visited().has(z.id)) continue;
      if (Math.hypot(p.x - z.isle.x, p.z - z.isle.z) < z.isle.r && Math.abs(p.y - z.isle.h) < 2) {
        visited().add(z.id);
        try {
          localStorage.setItem(ZKEY, JSON.stringify([...visited()]));
        } catch {}
        useWorld.getState().burst([p.x, p.y + 1, p.z], z.color, 60);
        sfx.chime(5);
      }
    }
  });
  return (
    <group>
      <DysonRing />
      <AsteroidBelt />
      <RingedPlanet />
      <Holograms />
      <ReverseFalls />
      <Jellyfish />
      <HarmonicPads />
      <Updrafts list={lists} />
      <group position={[OUTER.o3.x, OUTER.o3.h + 0.6 - 3.4 + 1.2, OUTER.o3.z]} scale={1.6}>
        <Armillary />
      </group>
      <Label3D text={vi ? "Đài Chân Trời Sự Kiện · gần hố đen, thời gian trôi chậm" : "Event Horizon Deck · near the black hole, time runs slow"} position={[OUTER.o1.x, OUTER.o1.h + 5.6, OUTER.o1.z]} maxDist={70} />
      <Label3D text={vi ? "Quảng trường Dữ liệu · phương trình kỳ lạ" : "Data Plaza · strange equations"} position={[OUTER.o2.x, OUTER.o2.h + 4.6, OUTER.o2.z]} maxDist={70} />
      <Label3D text={vi ? "Đài Thiên Văn · nghi thiên cầu" : "Observatory · armillary sphere"} position={[OUTER.o3.x, OUTER.o3.h + 6.2, OUTER.o3.z]} maxDist={70} />
      {ZONES.map((z) => (
        <Label3D key={z.id} text={`${z.name[lang]} · ${z.sub[lang]}`} position={[z.isle.x, z.isle.h + 6.5, z.isle.z]} maxDist={140} />
      ))}
      {/* cổng ở mỗi vùng (về đảo tâm) + cổng ở đảo tâm (tới vùng đã khám phá) */}
      {ZONE_GATES.map((g) => (
        <MagicCircle key={g.zone} radius={1.1} intensity={1.2} color="#bfe8ff" color2="#ffd27a" position={[g.x, g.h + 0.04, g.z]} spin={0.8} />
      ))}
      {HUB_GATES.map((g, i) => (
        <MagicCircle key={g.zone} radius={0.75} intensity={0.9} color={ZONES[i].color} color2="#ffffff" position={[g.x, 0.035, g.z]} spin={0.6} />
      ))}
    </group>
  );
}
