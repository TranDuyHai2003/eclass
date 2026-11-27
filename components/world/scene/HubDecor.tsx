"use client";
/**
 * Set-dressing for the plaza: cloud sea under the floating island, waterfalls, a golden armillary centerpiece,
 * drifting petals and soft light shafts. All procedural shaders (cheap; counts scale with quality).
 */
import { useMemo, useRef } from "react";
import { useFrame } from "@react-three/fiber";
import * as THREE from "three";
import { useWorld } from "../store";
import { PLAZA_R } from "./Environment";

// ───────────── Biển mây ─────────────

const cloudSea = {
  uniforms: { uTime: { value: 0 }, uTop: { value: new THREE.Color("#ffffff") }, uShade: { value: new THREE.Color("#c9c3ee") }, uFog: { value: new THREE.Color("#cfdcf5") } },
  vertexShader: /* glsl */ `varying vec2 vP; varying float vD; void main(){ vec4 w = modelMatrix * vec4(position,1.0); vP = w.xz; vD = length(w.xz); gl_Position = projectionMatrix * viewMatrix * w; }`,
  fragmentShader: /* glsl */ `
    uniform float uTime; uniform vec3 uTop; uniform vec3 uShade; uniform vec3 uFog; varying vec2 vP; varying float vD;
    float h(vec2 p){ p = fract(p * vec2(0.1031, 0.103)); p += dot(p, p.yx + 33.33); return fract((p.x + p.y) * p.x); }
    float n(vec2 p){ vec2 i = floor(p), f = fract(p); f = f*f*(3.0-2.0*f);
      return mix(mix(h(i), h(i+vec2(1.0,0.0)), f.x), mix(h(i+vec2(0.0,1.0)), h(i+vec2(1.0,1.0)), f.x), f.y); }
    float fbm(vec2 p){ float s = 0.0, a = 0.5; for (int i = 0; i < 3; i++) { s += a * n(p); p *= 2.03; a *= 0.5; } return s / 0.875; }
    void main(){
      vec2 p = vP * 0.035 + vec2(uTime * 0.012, uTime * 0.006);
      float c = fbm(p + vec2(n(p * 0.5 - uTime * 0.02)) * 0.6);
      // Cuộn mây: vùng dày sáng, khe tối tím nhạt (bóng kiểu anime: chia mảng)
      float puff = smoothstep(0.38, 0.62, c);
      vec3 col = mix(uShade, uTop, puff);
      col += vec3(1.0, 0.9, 0.75) * smoothstep(0.7, 0.9, c) * 0.25;
      float far = smoothstep(80.0, 260.0, vD);
      col = mix(col, uFog, far * 0.8);
      gl_FragColor = vec4(col, 1.0);
      #include <colorspace_fragment>
    }
  `,
};

export function CloudSea() {
  const mat = useMemo(() => new THREE.ShaderMaterial({ ...cloudSea, uniforms: THREE.UniformsUtils.clone(cloudSea.uniforms), fog: false }), []);
  useFrame((_, dt) => {
    mat.uniforms.uTime.value += dt;
  });
  return (
    <mesh rotation={[-Math.PI / 2, 0, 0]} position={[0, -14, 0]} material={mat}>
      <circleGeometry args={[320, 64]} />
    </mesh>
  );
}

// ───────────── Thác nước ─────────────

const fall = {
  uniforms: { uTime: { value: 0 } },
  vertexShader: /* glsl */ `varying vec2 vUv; void main(){ vUv = uv; gl_Position = projectionMatrix * modelViewMatrix * vec4(position,1.0); }`,
  fragmentShader: /* glsl */ `
    uniform float uTime; varying vec2 vUv;
    void main(){
      float streak = fract(vUv.y * 3.0 + uTime * 1.6 + sin(vUv.x * 40.0) * 0.08);
      float band = smoothstep(0.0, 0.25, streak) * (1.0 - smoothstep(0.55, 1.0, streak));
      float edge = smoothstep(0.0, 0.18, vUv.x) * (1.0 - smoothstep(0.82, 1.0, vUv.x));
      float fade = smoothstep(0.0, 0.35, vUv.y);
      vec3 col = mix(vec3(0.55, 0.82, 1.0), vec3(1.0), band * 0.8);
      gl_FragColor = vec4(col * 1.15, (0.45 + band * 0.45) * edge * fade);
      #include <colorspace_fragment>
    }
  `,
};

export function Waterfalls() {
  const mat = useMemo(
    () => new THREE.ShaderMaterial({ ...fall, uniforms: THREE.UniformsUtils.clone(fall.uniforms), transparent: true, depthWrite: false, side: THREE.DoubleSide }),
    [],
  );
  useFrame((_, dt) => {
    mat.uniforms.uTime.value += dt;
  });
  const spots = [2.35, 3.55, 5.6];
  return (
    <group>
      {spots.map((a) => (
        <group key={a} position={[Math.cos(a) * (PLAZA_R + 0.25), -7.2, Math.sin(a) * (PLAZA_R + 0.25)]} rotation={[0, -a + Math.PI / 2, 0]}>
          <mesh material={mat}>
            <planeGeometry args={[2.4, 14, 1, 1]} />
          </mesh>
        </group>
      ))}
    </group>
  );
}

// ───────────── Thiên cầu vàng (điểm nhấn trung tâm) ─────────────

export function Armillary() {
  const g = useRef<THREE.Group>(null);
  const rings = useRef<THREE.Mesh[]>([]);
  const gold = useMemo(() => new THREE.MeshStandardMaterial({ color: "#f3cd7a", metalness: 0.85, roughness: 0.28, emissive: "#6b4410", emissiveIntensity: 0.35 }), []);
  const core = useMemo(() => new THREE.MeshBasicMaterial({ color: new THREE.Color("#fff1c4").multiplyScalar(2.4), toneMapped: false }), []);
  useFrame((state) => {
    const t = state.clock.elapsedTime;
    rings.current.forEach((r, i) => {
      if (!r) return;
      r.rotation.x = t * (0.25 + i * 0.12) + i;
      r.rotation.y = t * (0.18 - i * 0.07);
    });
    if (g.current) g.current.position.y = 3.4 + Math.sin(t * 0.8) * 0.15;
  });
  return (
    <group ref={g} position={[0, 3.4, 0]}>
      {[1.5, 1.2, 0.92].map((r, i) => (
        <mesh key={r} ref={(m) => void (m && (rings.current[i] = m))} material={gold}>
          <torusGeometry args={[r, 0.05, 10, 72]} />
        </mesh>
      ))}
      <mesh material={core}>
        <icosahedronGeometry args={[0.32, 2]} />
      </mesh>
      <pointLight color="#ffd9a0" intensity={8} distance={9} decay={2} />
    </group>
  );
}

// ───────────── Cánh hoa bay ─────────────

const petals = {
  uniforms: { uTime: { value: 0 } },
  vertexShader: /* glsl */ `
    uniform float uTime; attribute vec3 aSeed; varying float vTint;
    void main(){
      float t = uTime * (0.35 + aSeed.z * 0.3) + aSeed.x * 40.0;
      vec3 base = vec3(sin(aSeed.x * 91.0) * 18.0, mod(aSeed.y * 9.0 - t * 0.6, 9.0) - 1.0, cos(aSeed.x * 53.0) * 18.0);
      base.x += sin(t * 0.9 + aSeed.y * 6.0) * 1.6 + t * 0.4 - floor((t * 0.4 + 18.0) / 36.0) * 36.0;
      base.z += cos(t * 0.7 + aSeed.x * 4.0) * 1.2;
      float a = t * 2.0 + aSeed.y * 10.0;
      vec3 p = position;
      p.xy = mat2(cos(a), -sin(a), sin(a), cos(a)) * p.xy;
      p.yz = mat2(cos(a * 0.7), -sin(a * 0.7), sin(a * 0.7), cos(a * 0.7)) * p.yz;
      vTint = aSeed.z;
      gl_Position = projectionMatrix * viewMatrix * vec4(base + p, 1.0);
    }
  `,
  fragmentShader: /* glsl */ `varying float vTint; void main(){ vec3 c = mix(vec3(1.0, 0.78, 0.86), vec3(1.0, 0.95, 0.98), vTint); gl_FragColor = vec4(c, 0.9);
      #include <colorspace_fragment>
    }`,
};

export function Petals() {
  const quality = useWorld((s) => s.quality);
  const count = quality === "low" ? 60 : quality === "mid" ? 160 : 260;
  const geo = useMemo(() => {
    const base = new THREE.PlaneGeometry(0.11, 0.08);
    const g = new THREE.InstancedBufferGeometry();
    g.index = base.index;
    g.setAttribute("position", base.attributes.position);
    const seeds = new Float32Array(count * 3);
    for (let i = 0; i < count; i++) seeds.set([((i * 0.618) % 1) + 0.001, ((i * 0.377) % 1) + 0.002, (i * 0.131) % 1], i * 3);
    g.setAttribute("aSeed", new THREE.InstancedBufferAttribute(seeds, 3));
    g.instanceCount = count;
    return g;
  }, [count]);
  const mat = useMemo(() => new THREE.ShaderMaterial({ ...petals, uniforms: THREE.UniformsUtils.clone(petals.uniforms), transparent: true, side: THREE.DoubleSide, depthWrite: false }), []);
  useFrame((_, dt) => {
    mat.uniforms.uTime.value += dt;
  });
  return <mesh geometry={geo} material={mat} frustumCulled={false} />;
}

// ───────────── Vệt nắng xuyên ─────────────

const shaft = {
  uniforms: { uTime: { value: 0 } },
  vertexShader: /* glsl */ `varying vec2 vUv; void main(){ vUv = uv; gl_Position = projectionMatrix * modelViewMatrix * vec4(position,1.0); }`,
  fragmentShader: /* glsl */ `
    uniform float uTime; varying vec2 vUv;
    void main(){
      float x = abs(vUv.x - 0.5) * 2.0;
      float a = (1.0 - smoothstep(0.0, 1.0, x)) * smoothstep(0.0, 0.6, vUv.y) * (1.0 - smoothstep(0.75, 1.0, vUv.y));
      a *= 0.12 + 0.04 * sin(uTime * 0.6 + vUv.x * 6.0);
      gl_FragColor = vec4(vec3(1.0, 0.93, 0.78) * a, 1.0);
    }
  `,
};

export function LightShafts() {
  const mat = useMemo(
    () => new THREE.ShaderMaterial({ ...shaft, uniforms: THREE.UniformsUtils.clone(shaft.uniforms), transparent: true, depthWrite: false, blending: THREE.AdditiveBlending, side: THREE.DoubleSide }),
    [],
  );
  useFrame((_, dt) => {
    mat.uniforms.uTime.value += dt;
  });
  const shafts = [
    [-4, 0.5, -5, 0.45, 3.2],
    [3.5, -0.4, -2, 0.52, 2.4],
    [8, 0.3, 4, 0.4, 2.8],
  ];
  return (
    <group>
      {shafts.map(([x, ry, z, tilt, w], i) => (
        <mesh key={i} material={mat} position={[x, 6, z]} rotation={[0, ry, tilt]}>
          <planeGeometry args={[w, 14]} />
        </mesh>
      ))}
    </group>
  );
}
