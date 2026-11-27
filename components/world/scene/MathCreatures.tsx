"use client";
/**
 * Echo Creatures built purely from mathematics (no textures, no external models):
 * - Slopewisp: a cloud-dragon whose spine is a travelling sine wave
 * - Peakfox: superellipsoid fox whose tail wags along a parabola (the tip is the extremum)
 * - Twistwyrm: a serpent swimming along a trefoil knot around a crystal core
 * - Gemcrest: crystal bird with phyllotaxis (golden-angle) feathers
 * - Edgewarden: counter-rotating nested Platonic solids with two "endpoint" rings
 */
import { useMemo, useRef } from "react";
import { useFrame } from "@react-three/fiber";
import * as THREE from "three";
import { Outlines } from "@react-three/drei";
import { toonMaterial } from "../fx/shaders";
import { timeScale } from "../store";

type Props = { kc: string; color: string; feral: boolean; fading: boolean };

const GOLDEN = Math.PI * (3 - Math.sqrt(5)); // 137,5°
const SPHERE = new THREE.SphereGeometry(1, 20, 14);
const TMP = new THREE.Vector3();

function useMats(color: string) {
  return useMemo(() => {
    const c = new THREE.Color(color);
    return {
      body: toonMaterial(c, { rim: "#ffffff", rimPower: 2.5 }),
      belly: toonMaterial(c.clone().lerp(new THREE.Color("#ffffff"), 0.55), { rim: "#ffffff" }),
      glow: new THREE.MeshBasicMaterial({ color: c.clone().multiplyScalar(2.2), toneMapped: false }),
      crystal: new THREE.MeshPhysicalMaterial({ color: c, roughness: 0.08, metalness: 0.1, transmission: 0.0, clearcoat: 1, emissive: c, emissiveIntensity: 0.35 }),
      eyeW: new THREE.MeshBasicMaterial({ color: "#ffffff" }),
      eyeB: new THREE.MeshBasicMaterial({ color: "#1b1730" }),
    };
  }, [color]);
}

/** Đôi mắt tròn to (nét dễ thương) */
function Eyes({ y = 0, z = 0.5, gap = 0.17, size = 0.11, mats }: { y?: number; z?: number; gap?: number; size?: number; mats: ReturnType<typeof useMats> }) {
  return (
    <>
      {[-gap, gap].map((x) => (
        <group key={x} position={[x, y, z]}>
          <mesh geometry={SPHERE} material={mats.eyeW} scale={size} />
          <mesh geometry={SPHERE} material={mats.eyeB} scale={size * 0.62} position={[0, -size * 0.1, size * 0.5]} />
          <mesh geometry={SPHERE} material={mats.eyeW} scale={size * 0.22} position={[size * 0.3, size * 0.3, size * 0.85]} />
        </group>
      ))}
    </>
  );
}

/**
 * Chuỗi khối cầu đặt theo một đường cong tham số (thân rắn / rồng).
 * 2 InstancedMesh (thân / bụng xen kẽ) thay n mesh + n viền drei → 2 lệnh vẽ thay 2n (pass Ink đã vẽ viền silhouette).
 */
function Chain({ n, curve, radius, mats, head }: { n: number; curve: (u: number, t: number, out: THREE.Vector3) => void; radius: (u: number) => number; mats: ReturnType<typeof useMats>; head?: React.ReactNode }) {
  const ims = useMemo(() => {
    // số đốt bụng = số i ∈ [0, n) có i % 3 === 1
    const nb = Math.floor((n + 1) / 3);
    const body = new THREE.InstancedMesh(SPHERE, mats.body, n - nb);
    const belly = new THREE.InstancedMesh(SPHERE, mats.belly, nb);
    body.frustumCulled = belly.frustumCulled = false;
    return { body, belly };
  }, [n, mats]);
  const headRef = useRef<THREE.Group>(null);
  const M4 = useMemo(() => new THREE.Matrix4(), []);
  const S3 = useMemo(() => new THREE.Vector3(), []);
  const Q = useMemo(() => new THREE.Quaternion(), []);
  useFrame((state) => {
    const t = state.clock.elapsedTime * timeScale();
    let kb = 0;
    let kl = 0;
    for (let i = 0; i < n; i++) {
      const u = i / (n - 1);
      curve(u, t, TMP);
      const r = radius(u);
      M4.compose(TMP, Q, S3.set(r, r, r));
      if (i % 3 === 1) ims.belly.setMatrixAt(kl++, M4);
      else ims.body.setMatrixAt(kb++, M4);
    }
    ims.body.instanceMatrix.needsUpdate = true;
    ims.belly.instanceMatrix.needsUpdate = true;
    if (headRef.current) {
      curve(0, t, TMP);
      headRef.current.position.copy(TMP);
      curve(0.04, t, TMP);
      headRef.current.lookAt(TMP.multiplyScalar(-1).add(headRef.current.position.clone().multiplyScalar(2)));
    }
  });
  return (
    <group>
      <primitive object={ims.body} />
      <primitive object={ims.belly} />
      <group ref={headRef}>{head}</group>
    </group>
  );
}

function Slopewisp({ mats }: { mats: ReturnType<typeof useMats> }) {
  return (
    <Chain
      n={16}
      mats={mats}
      radius={(u) => 0.26 * (1 - u * 0.8)}
      curve={(u, t, o) => o.set(Math.sin(t * 2.4 - u * 6) * 0.35, Math.sin(t * 1.6 - u * 4) * 0.18 + u * 0.15, -u * 2.2 + 0.6)}
      head={
        <group>
          <mesh geometry={SPHERE} material={mats.body} scale={0.32} />
          <Eyes y={0.06} z={0.24} gap={0.13} size={0.09} mats={mats} />
          {[-1, 1].map((s) => (
            <mesh key={s} position={[s * 0.18, 0.28, -0.05]} rotation={[-0.5, 0, s * 0.4]} material={mats.glow}>
              <coneGeometry args={[0.05, 0.3, 8]} />
            </mesh>
          ))}
        </group>
      }
    />
  );
}

function Peakfox({ mats }: { mats: ReturnType<typeof useMats> }) {
  const body = useMemo(() => {
    // Siêu-ellipsoid |x|^p + |y|^p + |z|^p = 1 (p = 2,6): thân tròn đầy
    const g = new THREE.SphereGeometry(1, 28, 20);
    const p = g.attributes.position as THREE.BufferAttribute;
    for (let i = 0; i < p.count; i++) {
      const v = TMP.fromBufferAttribute(p, i);
      const f = (Math.abs(v.x) ** 2.6 + Math.abs(v.y) ** 2.6 + Math.abs(v.z) ** 2.6) ** (-1 / 2.6);
      p.setXYZ(i, v.x * f, v.y * f, v.z * f);
    }
    g.computeVertexNormals();
    return g;
  }, []);
  return (
    <group>
      <mesh geometry={body} material={mats.body} scale={[0.42, 0.36, 0.5]} position={[0, 0.4, 0]}>
        <Outlines thickness={0.025} color="#2a1d33" />
      </mesh>
      <group position={[0, 0.85, 0.32]}>
        <mesh geometry={body} material={mats.body} scale={[0.32, 0.28, 0.3]}>
          <Outlines thickness={0.03} color="#2a1d33" />
        </mesh>
        <mesh geometry={SPHERE} material={mats.belly} scale={[0.14, 0.1, 0.12]} position={[0, -0.08, 0.24]} />
        <Eyes y={0.05} z={0.25} gap={0.12} size={0.08} mats={mats} />
        {[-1, 1].map((s) => (
          <mesh key={s} position={[s * 0.17, 0.3, -0.02]} rotation={[0, 0, -s * 0.25]} material={mats.body}>
            <coneGeometry args={[0.1, 0.28, 4]} />
          </mesh>
        ))}
      </group>
      {/* Đuôi vẫy theo parabol y = −k(x − x₀)² — đầu đuôi là điểm cực trị */}
      <Chain n={10} mats={mats} radius={(u) => 0.1 + u * 0.1} curve={(u, t, o) => o.set(Math.sin(t * 3) * 0.35 * u, 0.5 + 0.9 * u - 0.6 * u * u, -0.45 - u * 0.55)} />
      <mesh position={[0, 1.0, -0.95]} geometry={SPHERE} material={mats.glow} scale={0.09} />
    </group>
  );
}

function Twistwyrm({ mats }: { mats: ReturnType<typeof useMats> }) {
  // Nút ba lá: (sin t + 2 sin 2t, cos t − 2 cos 2t, −sin 3t)
  const knot = (s: number, o: THREE.Vector3) => o.set(Math.sin(s) + 2 * Math.sin(2 * s), Math.cos(s) - 2 * Math.cos(2 * s), -Math.sin(3 * s)).multiplyScalar(0.22);
  return (
    <group position={[0, 0.9, 0]}>
      <Chain
        n={22}
        mats={mats}
        radius={(u) => 0.13 * (1 - u * 0.7)}
        curve={(u, t, o) => knot(t * 0.8 - u * 3.2, o)}
        head={
          <group>
            <mesh geometry={SPHERE} material={mats.body} scale={[0.16, 0.14, 0.2]} />
            <Eyes y={0.05} z={0.13} gap={0.08} size={0.06} mats={mats} />
          </group>
        }
      />
      <mesh material={mats.crystal} scale={0.22}>
        <octahedronGeometry args={[1, 0]} />
      </mesh>
    </group>
  );
}

function Gemcrest({ mats }: { mats: ReturnType<typeof useMats> }) {
  const wings = useRef<THREE.Group[]>([]);
  useFrame((state) => {
    const t = state.clock.elapsedTime * timeScale();
    wings.current.forEach((w, i) => w && (w.rotation.z = (i ? -1 : 1) * (0.35 + Math.sin(t * 6) * 0.45)));
  });
  // Lông xếp theo góc vàng (phyllotaxis): r ∝ √k, θ = k·137,5°
  const feathers = useMemo(() => Array.from({ length: 21 }, (_, k) => ({ r: 0.09 * Math.sqrt(k + 1), a: k * GOLDEN })), []);
  return (
    <group position={[0, 0.9, 0]}>
      <mesh material={mats.crystal} scale={[0.3, 0.36, 0.3]}>
        <icosahedronGeometry args={[1, 0]} />
      </mesh>
      <Eyes y={0.12} z={0.24} gap={0.11} size={0.075} mats={mats} />
      <mesh position={[0, 0.02, 0.33]} rotation={[Math.PI / 2, 0, 0]} material={mats.glow}>
        <coneGeometry args={[0.05, 0.14, 4]} />
      </mesh>
      {[1, -1].map((s, i) => (
        <group key={s} ref={(g) => void (g && (wings.current[i] = g))} position={[s * 0.22, 0.05, -0.02]}>
          {feathers.map((f, k) => (
            <mesh key={k} position={[s * (0.12 + Math.abs(Math.cos(f.a)) * f.r * 1.6), Math.sin(f.a) * f.r * 0.7, -0.05]} rotation={[0, 0, s * (0.4 + f.r)]} material={k % 2 ? mats.body : mats.belly}>
              <octahedronGeometry args={[0.06 + f.r * 0.12, 0]} />
            </mesh>
          ))}
        </group>
      ))}
      {[0, 1, 2].map((k) => (
        <mesh key={k} position={[0, 0.42 + k * 0.08, -0.05 - k * 0.06]} material={mats.glow} scale={0.05 - k * 0.01}>
          <octahedronGeometry args={[1, 0]} />
        </mesh>
      ))}
    </group>
  );
}

function Edgewarden({ mats }: { mats: ReturnType<typeof useMats> }) {
  const outer = useRef<THREE.Mesh>(null);
  const inner = useRef<THREE.Mesh>(null);
  const rings = useRef<THREE.Group>(null);
  useFrame((state) => {
    const t = state.clock.elapsedTime * timeScale();
    if (outer.current) outer.current.rotation.set(t * 0.4, t * 0.6, 0);
    if (inner.current) inner.current.rotation.set(-t * 0.7, -t * 0.5, 0);
    if (rings.current) rings.current.rotation.y = t * 0.8;
  });
  return (
    <group position={[0, 1, 0]}>
      <mesh ref={outer} scale={0.55}>
        <dodecahedronGeometry args={[1, 0]} />
        <meshBasicMaterial color={mats.glow.color} wireframe toneMapped={false} />
      </mesh>
      <mesh ref={inner} material={mats.crystal} scale={0.3}>
        <icosahedronGeometry args={[1, 0]} />
      </mesh>
      <Eyes y={0.04} z={0.27} gap={0.1} size={0.07} mats={mats} />
      {/* Hai vành đai = hai đầu mút của đoạn [a; b] */}
      <group ref={rings}>
        {[-0.75, 0.75].map((x) => (
          <mesh key={x} position={[x, 0, 0]} rotation={[0, Math.PI / 2, 0]} material={mats.glow}>
            <torusGeometry args={[0.18, 0.025, 8, 32]} />
          </mesh>
        ))}
      </group>
    </group>
  );
}

const BODY: Record<string, (m: ReturnType<typeof useMats>) => React.ReactNode> = {
  "kc.slope_sign": (m) => <Slopewisp mats={m} />,
  "kc.extremum_from_fprime": (m) => <Peakfox mats={m} />,
  "kc.cubic_shape": (m) => <Twistwyrm mats={m} />,
  "kc.extremum_value": (m) => <Gemcrest mats={m} />,
  "kc.minmax_interval": (m) => <Edgewarden mats={m} />,
};

export function MathCreature({ kc, color, feral, fading }: Props) {
  const mats = useMats(color);
  const g = useRef<THREE.Group>(null);
  useFrame((state) => {
    const t = state.clock.elapsedTime;
    if (!g.current) return;
    g.current.position.y = 0.15 + Math.sin(t * (feral ? 3 : 1.6)) * 0.08;
    const pulse = feral ? 0.5 + 0.5 * Math.sin(t * 8) : 0;
    mats.body.emissive.setRGB(pulse * 0.35, 0, pulse * 0.08);
    for (const m of [mats.body, mats.belly]) {
      m.transparent = fading;
      m.opacity = fading ? 0.65 : 1;
    }
  });
  return (
    <group ref={g} scale={feral ? 1.25 : 0.85}>
      {(BODY[kc] ?? BODY["kc.slope_sign"])(mats)}
    </group>
  );
}
