"use client";
/**
 * Hầm Bổ đề — hiệu ứng dùng chung (toàn shader, không vẽ art bằng code):
 *  - VaultSky: bầu trời đêm vũ trụ (gradient + tinh vân fbm + sao lấp lánh), bảng màu theo phòng;
 *  - FogSea: biển sương "chưa được chứng minh" (fbm cuộn, phân dải kiểu cel);
 *  - EchoSpirits: Tiếng Vọng — linh hồn trong mờ màu ghế, vầng hào quang, bong bóng thoại;
 *  - PingMarkers: cột sáng + vòng + ký hiệu ghế tại chỗ được ping.
 */
import { useEffect, useMemo, useRef, useState } from "react";
import { useFrame } from "@react-three/fiber";
import * as THREE from "three";
import { Label3D } from "../ui/Labels";
import { useWorld } from "../store";
import { GLYPHS, SEAT_COLORS } from "@/lib/world/vault/run";
import { ECHO_LINES, ECHO_NAMES, tx } from "@/lib/world/vault/text";
import { useVault, vaultNow, asRun } from "./vaultClient";

export type SkyPalette = { top: string; mid: string; low: string; neb: string; neb2: string };
export const SKIES: Record<string, SkyPalette> = {
  threshold: { top: "#070a1e", mid: "#1a1946", low: "#3b2d63", neb: "#7f6bff", neb2: "#ff9ad5" },
  konigsberg: { top: "#040b1c", mid: "#0f2347", low: "#1f4a6a", neb: "#38d4ff", neb2: "#9a7bff" },
  balance: { top: "#0c0818", mid: "#2b1a3d", low: "#6a3e3a", neb: "#ffb35c", neb2: "#c36bff" },
  fourier: { top: "#0b0617", mid: "#29103f", low: "#4c1d5e", neb: "#ff6fd0", neb2: "#5fc8ff" },
  finale: { top: "#080716", mid: "#221b46", low: "#4d3b2a", neb: "#ffd27a", neb2: "#7fa8ff" },
};

const skyVert = /* glsl */ `
varying vec3 vDir;
void main() {
  vDir = normalize(position);
  vec4 p = modelViewMatrix * vec4(position, 1.0);
  gl_Position = projectionMatrix * p;
  gl_Position.z = gl_Position.w; // luôn ở xa nhất
}`;
const skyFrag = /* glsl */ `
uniform vec3 uTop, uMid, uLow, uNeb, uNeb2;
uniform float uTime;
varying vec3 vDir;
float h3(vec3 p) { return fract(sin(dot(p, vec3(127.1, 311.7, 74.7))) * 43758.5453); }
float n3(vec3 p) {
  vec3 i = floor(p), f = fract(p);
  f = f * f * (3.0 - 2.0 * f);
  return mix(mix(mix(h3(i), h3(i + vec3(1,0,0)), f.x), mix(h3(i + vec3(0,1,0)), h3(i + vec3(1,1,0)), f.x), f.y),
             mix(mix(h3(i + vec3(0,0,1)), h3(i + vec3(1,0,1)), f.x), mix(h3(i + vec3(0,1,1)), h3(i + vec3(1,1,1)), f.x), f.y), f.z);
}
float fbm(vec3 p) { float s = 0.0, a = 0.5; for (int i = 0; i < 5; i++) { s += a * n3(p); p *= 2.03; a *= 0.5; } return s; }
void main() {
  vec3 d = normalize(vDir);
  float y = d.y;
  vec3 col = mix(uLow, uMid, smoothstep(-0.25, 0.25, y));
  col = mix(col, uTop, smoothstep(0.2, 0.9, y));
  // dải tinh vân chéo trời
  float band = exp(-pow((d.y - 0.35 * d.x + 0.1) * 2.6, 2.0));
  float neb = fbm(d * 3.0 + vec3(0.0, uTime * 0.01, 0.0));
  float neb2 = fbm(d * 6.0 - vec3(uTime * 0.008));
  col += uNeb * band * smoothstep(0.45, 0.85, neb) * 0.55;
  col += uNeb2 * band * smoothstep(0.55, 0.95, neb2) * 0.35;
  // sao (hai lớp, lấp lánh)
  for (int k = 0; k < 2; k++) {
    float sc = k == 0 ? 160.0 : 320.0;
    vec3 g = d * sc;
    vec3 id = floor(g);
    float r = h3(id);
    if (r > (k == 0 ? 0.985 : 0.992)) {
      vec3 f = fract(g) - 0.5;
      float tw = 0.6 + 0.4 * sin(uTime * (1.5 + r * 3.0) + r * 40.0);
      col += vec3(1.0, 0.95, 0.85) * smoothstep(0.32, 0.0, length(f)) * tw * smoothstep(-0.15, 0.1, y) * (k == 0 ? 1.2 : 0.7);
    }
  }
  gl_FragColor = vec4(col, 1.0);
}`;

export function VaultSky({ palette }: { palette: SkyPalette }) {
  const mat = useMemo(
    () =>
      new THREE.ShaderMaterial({
        uniforms: { uTop: { value: new THREE.Color() }, uMid: { value: new THREE.Color() }, uLow: { value: new THREE.Color() }, uNeb: { value: new THREE.Color() }, uNeb2: { value: new THREE.Color() }, uTime: { value: 0 } },
        vertexShader: skyVert,
        fragmentShader: skyFrag,
        side: THREE.BackSide,
        depthWrite: false,
        fog: false,
      }),
    [],
  );
  useEffect(() => {
    mat.uniforms.uTop.value.set(palette.top);
    mat.uniforms.uMid.value.set(palette.mid);
    mat.uniforms.uLow.value.set(palette.low);
    mat.uniforms.uNeb.value.set(palette.neb);
    mat.uniforms.uNeb2.value.set(palette.neb2);
  }, [mat, palette]);
  useEffect(() => () => mat.dispose(), [mat]);
  useFrame((_, dt) => (mat.uniforms.uTime.value += dt));
  return (
    <mesh material={mat} renderOrder={-10} frustumCulled={false}>
      <sphereGeometry args={[480, 32, 16]} />
    </mesh>
  );
}

const fogFrag = /* glsl */ `
uniform float uTime;
uniform vec3 uA, uB, uSky;
varying vec3 vW;
float h2(vec2 p) { return fract(sin(dot(p, vec2(127.1, 311.7))) * 43758.5453); }
float n2(vec2 p) { vec2 i = floor(p), f = fract(p); f = f * f * (3.0 - 2.0 * f);
  return mix(mix(h2(i), h2(i + vec2(1,0)), f.x), mix(h2(i + vec2(0,1)), h2(i + vec2(1,1)), f.x), f.y); }
float fbm(vec2 p) { float s = 0.0, a = 0.5; for (int i = 0; i < 5; i++) { s += a * n2(p); p = p * 2.07 + 1.3; a *= 0.5; } return s; }
void main() {
  vec2 p = vW.xz * 0.045;
  float f = fbm(p + vec2(uTime * 0.012, uTime * 0.007));
  float g = fbm(p * 1.7 - vec2(uTime * 0.02, -uTime * 0.01) + f);
  float v = f * 0.6 + g * 0.6;
  // phân dải kiểu cel + viền sáng mảnh giữa các dải
  float bands = floor(v * 4.0) / 4.0;
  float edge = smoothstep(0.035, 0.0, abs(fract(v * 4.0) - 0.5) - 0.46);
  vec3 col = mix(uA, uB, bands) + uB * edge * 0.25;
  float d = length(vW.xz);
  col = mix(col, uSky, smoothstep(60.0, 220.0, d));
  gl_FragColor = vec4(col, 1.0);
}`;
export function FogSea({ y, a, b, sky }: { y: number; a: string; b: string; sky: string }) {
  const mat = useMemo(
    () =>
      new THREE.ShaderMaterial({
        uniforms: { uTime: { value: 0 }, uA: { value: new THREE.Color(a) }, uB: { value: new THREE.Color(b) }, uSky: { value: new THREE.Color(sky) } },
        vertexShader: "varying vec3 vW; void main(){ vec4 w = modelMatrix * vec4(position,1.0); vW = w.xyz; gl_Position = projectionMatrix * viewMatrix * w; }",
        fragmentShader: fogFrag,
        fog: false,
      }),
    [a, b, sky],
  );
  useEffect(() => () => mat.dispose(), [mat]);
  useFrame((_, dt) => (mat.uniforms.uTime.value += dt));
  return (
    <mesh material={mat} rotation-x={-Math.PI / 2} position={[0, y, 0]}>
      <planeGeometry args={[520, 520]} />
    </mesh>
  );
}

// ───────────── Tiếng Vọng ─────────────

const echoFrag = /* glsl */ `
uniform vec3 uColor;
uniform float uTime;
varying vec3 vN;
varying vec3 vV;
varying float vY;
void main() {
  float fr = pow(1.0 - abs(dot(normalize(vN), normalize(vV))), 2.0);
  float flick = 0.85 + 0.15 * sin(uTime * 3.0 + vY * 6.0);
  float a = (0.18 + fr * 0.75) * flick * smoothstep(-0.1, 0.35, vY);
  gl_FragColor = vec4(uColor * (0.6 + fr * 1.8), a);
}`;
const echoVert = /* glsl */ `
varying vec3 vN; varying vec3 vV; varying float vY;
uniform float uTime;
void main() {
  vec3 p = position;
  // vạt áo dưới chân lay nhẹ
  float sway = smoothstep(0.6, -0.6, p.y) * 0.08;
  p.x += sin(uTime * 2.0 + p.y * 3.0) * sway;
  vY = p.y + 0.6;
  vec4 mv = modelViewMatrix * vec4(p, 1.0);
  vN = normalMatrix * normal;
  vV = -mv.xyz;
  gl_Position = projectionMatrix * mv;
}`;

function EchoSpirit({ seat }: { seat: number }) {
  const g = useRef<THREE.Group>(null);
  const vi = useWorld((s) => s.lang === "vi");
  const color = SEAT_COLORS[seat];
  const mat = useMemo(
    () =>
      new THREE.ShaderMaterial({
        uniforms: { uColor: { value: new THREE.Color(color) }, uTime: { value: 0 } },
        vertexShader: echoVert,
        fragmentShader: echoFrag,
        transparent: true,
        depthWrite: false,
        blending: THREE.AdditiveBlending,
      }),
    [color],
  );
  const halo = useMemo(() => new THREE.MeshBasicMaterial({ color, transparent: true, opacity: 0.9, toneMapped: false }), [color]);
  useEffect(
    () => () => {
      mat.dispose();
      halo.dispose();
    },
    [mat, halo],
  );
  const name = useVault((s) => s.run?.seats[seat]?.name ?? "");
  const label = name.startsWith("@") ? tx(ECHO_NAMES[name.slice(1)] ?? ECHO_NAMES.euler, vi) : `${name} · ${vi ? "Tiếng Vọng giữ ghế" : "Echo holds"}`;
  const [line, setLine] = useState<{ text: string; until: number } | null>(null);
  useEffect(
    () =>
      useVault.subscribe((s, prev) => {
        const evs = s.run?.ev ?? [];
        const last = prev.run?.ev?.[prev.run.ev.length - 1]?.id ?? 0;
        for (const e of evs) if (e.id > last && e.k === "echo" && e.by === seat && e.s) setLine({ text: tx(ECHO_LINES[e.s] ?? ECHO_LINES["e.ok"], useWorld.getState().lang === "vi"), until: performance.now() + 3600 });
      }),
    [seat],
  );
  useFrame((_, dt) => {
    const s = useVault.getState().run?.seats[seat];
    if (!s?.p || !g.current) return;
    mat.uniforms.uTime.value += dt;
    const k = 1 - Math.exp(-dt * 10);
    const o = g.current.position;
    // lần đầu / dịch chuyển xa: đặt thẳng
    if (o.distanceToSquared(new THREE.Vector3(s.p[0], s.p[1], s.p[2])) > 64) o.set(s.p[0], s.p[1], s.p[2]);
    else o.set(o.x + (s.p[0] - o.x) * k, o.y + (s.p[1] - o.y) * k, o.z + (s.p[2] - o.z) * k);
    let dy = s.yaw - g.current.rotation.y;
    dy = Math.atan2(Math.sin(dy), Math.cos(dy));
    g.current.rotation.y += dy * k;
    const bob = Math.sin(performance.now() / 420 + seat) * 0.06;
    g.current.children[0].position.y = 0.95 + bob;
    if (line && performance.now() > line.until) setLine(null);
  });
  return (
    <group ref={g}>
      <group>
        <mesh material={mat}>
          <capsuleGeometry args={[0.32, 0.95, 6, 16]} />
        </mesh>
        <mesh material={mat} position={[0, 0.85, 0]}>
          <sphereGeometry args={[0.26, 16, 12]} />
        </mesh>
        <mesh material={halo} position={[0, 1.32, 0]} rotation-x={Math.PI / 2}>
          <torusGeometry args={[0.22, 0.025, 6, 28]} />
        </mesh>
      </group>
      <Label3D text={`${GLYPHS[seat]} ${label}`} position={[0, 2.05, 0]} variant="name" />
      {line && <Label3D text={line.text} position={[0, 2.55, 0]} variant="small" maxDist={40} />}
    </group>
  );
}

/** Mọi ghế do Tiếng Vọng giữ (bạn đồng hành, hoặc người đang vắng) */
export function EchoSpirits() {
  const ids = useVault((s) => (s.run ? s.run.seats.map((x, i) => (x.p && (!x.h || !x.conn) ? i : -1)).filter((i) => i >= 0) : []).join(","));
  return (
    <>
      {ids
        .split(",")
        .filter(Boolean)
        .map((i) => (
          <EchoSpirit key={i} seat={Number(i)} />
        ))}
    </>
  );
}

// ───────────── Ping ─────────────

const PING_TEXT: Record<string, { en: string; vi: string }> = {
  here: { en: "Stand here", vi: "Đứng đây" },
  go: { en: "Go this way", vi: "Đi đường này" },
  use: { en: "Use this", vi: "Dùng cái này" },
  look: { en: "Look", vi: "Nhìn kìa" },
  avoid: { en: "Avoid", vi: "Tránh" },
};
const VAL_TEXT: Record<string, string> = { "+": "＋", "-": "－", "0": "0", f: "⇅" };

function PingMark({ id }: { id: number }) {
  const vi = useWorld((s) => s.lang === "vi");
  const p = useVault((s) => s.run?.pings.find((q) => q.id === id));
  const beam = useRef<THREE.Mesh>(null);
  const ring = useRef<THREE.Mesh>(null);
  const color = p ? SEAT_COLORS[p.by] : "#fff";
  const mats = useMemo(
    () => [new THREE.MeshBasicMaterial({ color, transparent: true, opacity: 0.55, depthWrite: false, blending: THREE.AdditiveBlending, toneMapped: false }), new THREE.MeshBasicMaterial({ color, transparent: true, opacity: 0.9, depthWrite: false, side: THREE.DoubleSide, toneMapped: false })],
    [color],
  );
  useEffect(() => () => mats.forEach((m) => m.dispose()), [mats]);
  useFrame(() => {
    if (!p) return;
    const left = (p.until - vaultNow()) / 4000;
    const a = Math.max(0, Math.min(1, left * 3));
    mats[0].opacity = 0.5 * a;
    mats[1].opacity = 0.9 * a;
    const t = (performance.now() / 700) % 1;
    if (ring.current) ring.current.scale.setScalar(0.6 + t * 0.9);
    if (beam.current) beam.current.scale.y = 0.4 + Math.min(1, (1 - left) * 6) * 0.6;
  });
  if (!p) return null;
  const text = p.kind === "val" && p.v ? VAL_TEXT[p.v] : tx(PING_TEXT[p.kind] ?? PING_TEXT.here, vi);
  return (
    <group position={[p.x, p.y, p.z]}>
      <mesh ref={beam} material={mats[0]} position={[0, 1.6, 0]}>
        <cylinderGeometry args={[0.07, 0.16, 3.2, 10, 1, true]} />
      </mesh>
      <mesh ref={ring} material={mats[1]} rotation-x={-Math.PI / 2} position={[0, 0.06, 0]}>
        <ringGeometry args={[0.55, 0.68, 36]} />
      </mesh>
      <Label3D text={`${GLYPHS[p.by]} ${text}`} position={[0, 3.4, 0]} variant="small" maxDist={90} />
    </group>
  );
}
export function PingMarkers() {
  const ids = useVault((s) => (s.run?.pings ?? []).map((p) => p.id).join(","));
  return (
    <>
      {ids
        .split(",")
        .filter(Boolean)
        .map((i) => (
          <PingMark key={i} id={Number(i)} />
        ))}
    </>
  );
}

/** Đổi bản mạng sang Run để gọi hàm thuần (spawn, mặt đất…) */
export const runOf = () => {
  const r = useVault.getState().run;
  return r ? asRun(r) : null;
};
