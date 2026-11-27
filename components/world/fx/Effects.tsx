"use client";
/**
 * Hiệu ứng: vòng tròn phép, hộ thể, nổ hạt, chùm tia phép, rung máy quay.
 */
import { useEffect, useMemo, useRef } from "react";
import { useFrame, useThree, type ThreeElements } from "@react-three/fiber";
import * as THREE from "three";
import { glyphRingTexture, magicCircleShader, shieldShader } from "./shaders";
import { useWorld, timeScale } from "../store";
import { useFxKit } from "./FxKit";

let glyphTex: THREE.CanvasTexture | null = null;
const glyphs = () => (glyphTex ??= glyphRingTexture());

/** Vòng tròn phép nằm ngang (dưới chân) hoặc đứng (cổng) */
export function MagicCircle({
  radius = 2,
  color = "#ffd27a",
  color2 = "#7ad7ff",
  vertical = false,
  intensity = 1,
  revealSpeed = 0.8,
  spin = 1,
  ...props
}: {
  radius?: number;
  color?: string;
  color2?: string;
  vertical?: boolean;
  intensity?: number;
  revealSpeed?: number;
  spin?: number;
} & ThreeElements["mesh"]) {
  const mat = useMemo(
    () =>
      new THREE.ShaderMaterial({
        ...magicCircleShader,
        uniforms: THREE.UniformsUtils.clone(magicCircleShader.uniforms),
        transparent: true,
        depthWrite: false,
        blending: THREE.AdditiveBlending,
        side: THREE.DoubleSide,
      }),
    [],
  );
  useEffect(() => {
    mat.uniforms.uGlyphs.value = glyphs();
    mat.uniforms.uColor.value.set(color);
    mat.uniforms.uColor2.value.set(color2);
    mat.uniforms.uReveal.value = 0;
  }, [mat, color, color2]);
  useFrame((_, dt) => {
    mat.uniforms.uTime.value += dt * spin * timeScale();
    mat.uniforms.uReveal.value = Math.min(1, mat.uniforms.uReveal.value + dt * revealSpeed);
    mat.uniforms.uIntensity.value = intensity;
  });
  return (
    <mesh rotation={vertical ? [0, 0, 0] : [-Math.PI / 2, 0, 0]} material={mat} {...props}>
      <planeGeometry args={[radius * 2, radius * 2]} />
    </mesh>
  );
}

/** Hộ thể: khiên cầu; gọi ref.current.hit(dir) để tạo gợn sóng */
export interface ShieldHandle {
  hit: (dir: THREE.Vector3) => void;
  setCrack: (v: number) => void;
}
export function Shield({ radius = 1.2, color = "#8fe3ff", crack = 0, handle, ...props }: { radius?: number; color?: string; crack?: number; handle?: React.MutableRefObject<ShieldHandle | null> } & ThreeElements["mesh"]) {
  const mat = useMemo(
    () =>
      new THREE.ShaderMaterial({
        ...shieldShader,
        uniforms: THREE.UniformsUtils.clone(shieldShader.uniforms),
        transparent: true,
        depthWrite: false,
        blending: THREE.AdditiveBlending,
      }),
    [],
  );
  useEffect(() => {
    mat.uniforms.uColor.value.set(color);
  }, [mat, color]);
  useEffect(() => {
    mat.uniforms.uCrack.value = crack;
  }, [mat, crack]);
  useEffect(() => {
    if (!handle) return;
    handle.current = {
      hit: (dir) => {
        mat.uniforms.uHitPos.value.copy(dir).normalize();
        mat.uniforms.uHitTime.value = mat.uniforms.uTime.value;
      },
      setCrack: (v) => (mat.uniforms.uCrack.value = v),
    };
  }, [handle, mat]);
  useFrame((_, dt) => {
    mat.uniforms.uTime.value += dt;
  });
  return (
    <mesh material={mat} {...props}>
      <icosahedronGeometry args={[radius, 5]} />
    </mesh>
  );
}

/** Nổ hạt: đọc danh sách bursts trong store */
/**
 * Vụ nổ hạt kiểu anime: sao lấp lánh 4 cánh, mảnh pha lê, chip lục giác (mô hình Blender, fxkit.glb)
 * — 3 InstancedMesh dùng chung cho mọi vụ nổ (≤ 360 hạt), HDR để bloom bắt sáng, xoay + rơi + tắt dần.
 */
const MAXP = 360;
interface Shard {
  type: 0 | 1 | 2;
  pos: THREE.Vector3;
  vel: THREE.Vector3;
  axis: THREE.Vector3;
  spin: number;
  born: number;
  life: number;
  size: number;
  color: THREE.Color;
}
const BM = new THREE.Matrix4();
const BQ = new THREE.Quaternion();
const BS = new THREE.Vector3();
const BC = new THREE.Color();

export function Bursts() {
  const kit = useFxKit();
  const star = useRef<THREE.InstancedMesh>(null);
  const shard = useRef<THREE.InstancedMesh>(null);
  const hex = useRef<THREE.InstancedMesh>(null);
  const parts = useRef<Shard[]>([]);
  const seen = useRef(new Set<number>());
  const mat = useMemo(() => new THREE.MeshBasicMaterial({ color: new THREE.Color(1.6, 1.6, 1.6), toneMapped: false, side: THREE.DoubleSide }), []);
  useEffect(() => () => mat.dispose(), [mat]);
  useFrame((_, rawDt) => {
    const dt = Math.min(0.05, rawDt) * timeScale();
    const now = performance.now();
    const live = new Set<number>();
    for (const b of useWorld.getState().bursts) {
      live.add(b.id);
      if (seen.current.has(b.id)) continue;
      seen.current.add(b.id);
      const base = new THREE.Color(b.color);
      for (let i = 0; i < b.count && parts.current.length < MAXP; i++) {
        // Bung ra nửa cầu trên, nhanh — chậm ngẫu nhiên; 45% sao, 35% mảnh, 20% chip
        const u = Math.random() * 2 - 1;
        const th = Math.random() * Math.PI * 2;
        const rr = Math.sqrt(1 - u * u);
        const sp = 2.5 + Math.random() * 6;
        const r = Math.random();
        parts.current.push({
          type: r < 0.45 ? 0 : r < 0.8 ? 1 : 2,
          pos: new THREE.Vector3(...b.pos),
          vel: new THREE.Vector3(rr * Math.cos(th) * sp, (Math.abs(u) * 1.1 + 0.3) * sp, rr * Math.sin(th) * sp),
          axis: new THREE.Vector3(Math.random() - 0.5, Math.random() - 0.5, Math.random() - 0.5).normalize(),
          spin: (Math.random() - 0.5) * 18,
          born: now,
          life: 450 + Math.random() * 650,
          size: 0.14 + Math.random() * 0.2,
          color: base.clone().lerp(new THREE.Color("#ffffff"), Math.random() * 0.45),
        });
      }
    }
    for (const id of seen.current) if (!live.has(id)) seen.current.delete(id);
    const meshes = [star.current, shard.current, hex.current];
    const counts = [0, 0, 0];
    const arr = parts.current;
    for (let i = arr.length - 1; i >= 0; i--) {
      const q = arr[i];
      const k = (now - q.born) / q.life;
      if (k >= 1) {
        arr.splice(i, 1);
        continue;
      }
      q.vel.y -= 9 * dt;
      q.vel.multiplyScalar(1 - 2.2 * dt);
      q.pos.addScaledVector(q.vel, dt);
      const m = meshes[q.type];
      if (!m) continue;
      // Nảy to nhanh rồi thu nhỏ (cảm giác "loé"), xoay quanh trục riêng
      const s = q.size * (k < 0.12 ? k / 0.12 : 1 - (k - 0.12) / 0.88) * (q.type === 0 ? 1.6 : 1);
      BQ.setFromAxisAngle(q.axis, q.spin * (now - q.born) / 1000);
      BM.compose(q.pos, BQ, BS.set(s, s, s));
      const idx = counts[q.type]++;
      m.setMatrixAt(idx, BM);
      m.setColorAt(idx, BC.copy(q.color).multiplyScalar(1 - k * 0.6));
    }
    meshes.forEach((m, t) => {
      if (!m) return;
      m.count = counts[t];
      m.instanceMatrix.needsUpdate = true;
      if (m.instanceColor) m.instanceColor.needsUpdate = true;
    });
  });
  return (
    <>
      <instancedMesh ref={star} args={[kit.geo.fx_star, mat, MAXP]} frustumCulled={false} renderOrder={11} />
      <instancedMesh ref={shard} args={[kit.geo.fx_shard, mat, MAXP]} frustumCulled={false} renderOrder={11} />
      <instancedMesh ref={hex} args={[kit.geo.fx_hex, mat, MAXP]} frustumCulled={false} renderOrder={11} />
    </>
  );
}

/** Chùm tia phép từ A tới B */
export function Beam({ from, to, color = "#fff2b0", life = 0.35, born }: { from: THREE.Vector3; to: THREE.Vector3; color?: string; life?: number; born: number }) {
  const ref = useRef<THREE.Mesh>(null);
  const { mid, len, quat } = useMemo(() => {
    const dir = to.clone().sub(from);
    const q = new THREE.Quaternion().setFromUnitVectors(new THREE.Vector3(0, 1, 0), dir.clone().normalize());
    return { mid: from.clone().add(to).multiplyScalar(0.5), len: dir.length(), quat: q };
  }, [from, to]);
  useFrame(() => {
    const t = (performance.now() - born) / 1000;
    if (!ref.current) return;
    const k = Math.max(0, 1 - t / life);
    ref.current.scale.set(k * 1.4 + 0.1, 1, k * 1.4 + 0.1);
    (ref.current.material as THREE.MeshBasicMaterial).opacity = k;
    ref.current.visible = k > 0;
  });
  return (
    <mesh ref={ref} position={mid} quaternion={quat}>
      <cylinderGeometry args={[0.12, 0.12, len, 12, 1, true]} />
      <meshBasicMaterial color={color} transparent blending={THREE.AdditiveBlending} depthWrite={false} />
    </mesh>
  );
}

/** Rung máy quay theo store.shake (giảm dần) */
export function CameraShake() {
  const { camera } = useThree();
  const offset = useRef(new THREE.Vector3());
  useFrame((_, dt) => {
    const s = useWorld.getState();
    camera.position.sub(offset.current);
    if (s.shake > 0.001) {
      const a = s.shake * s.shake * 0.35;
      offset.current.set((Math.random() - 0.5) * a, (Math.random() - 0.5) * a, (Math.random() - 0.5) * a);
      camera.position.add(offset.current);
      useWorld.setState({ shake: Math.max(0, s.shake - dt * 2.2) });
    } else offset.current.set(0, 0, 0);
  });
  return null;
}
