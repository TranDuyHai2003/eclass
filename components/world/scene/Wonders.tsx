"use client";
/**
 * Mathematical Wonders — real mathematics rendered live (no textures):
 * 4D tesseract projection · Klein bottle · Lorenz attractor (RK4) · Poincaré disk {7,3} tiling (reflection-group shader).
 */
import { useMemo, useRef } from "react";
import { useTexture, Billboard } from "@react-three/drei";
import { worldAsset } from "@/lib/world/avatars";
import { useFrame } from "@react-three/fiber";
import { Float } from "@react-three/drei";
import * as THREE from "three";
import { ParametricGeometry } from "three/examples/jsm/geometries/ParametricGeometry.js";
import { MagicCircle } from "../fx/Effects";
import { useWorld } from "../store";
import type { WonderId } from "@/lib/world/wonders";

export const EXHIBIT: Record<WonderId, (q: string) => React.ReactNode> = {
  tesseract: () => <Tesseract />,
  poincare: () => <PoincareDisk />,
  klein: (q) => <KleinBottle segments={q === "low" ? 40 : 80} />,
  lorenz: (q) => <Lorenz points={q === "low" ? 2500 : 6000} />,
  blackhole: () => <BlackHole />,
};

/** Một kỳ quan đặt ở vị trí bất kỳ (Vùng Kỳ quan vô hạn) */
export function WonderAt({ id, position }: { id: WonderId; position: [number, number, number] }) {
  const quality = useWorld((s) => s.quality);
  const near = useWorld((s) => s.nearby?.kind === "wonder" && s.nearby.id === id);
  return (
    <group position={position}>
      <MagicCircle radius={1.6} position={[0, 0.06, 0]} intensity={near ? 1.1 : 0.5} color="#bfe8ff" color2="#ffd27a" spin={0.4} />
      <Float speed={1.4} rotationIntensity={0.15} floatIntensity={0.5}>
        <group position={[0, 2.6, 0]}>{EXHIBIT[id](quality)}</group>
      </Float>
    </group>
  );
}

// ───────────── Tesseract: hình chiếu 4D → 3D ─────────────

function Tesseract() {
  const verts = useMemo(() => {
    const v: number[][] = [];
    for (let i = 0; i < 16; i++) v.push([i & 1 ? 1 : -1, i & 2 ? 1 : -1, i & 4 ? 1 : -1, i & 8 ? 1 : -1]);
    return v;
  }, []);
  const edges = useMemo(() => {
    const e: [number, number][] = [];
    for (let i = 0; i < 16; i++) for (let b = 0; b < 4; b++) if (!(i & (1 << b))) e.push([i, i | (1 << b)]);
    return e; // 32 cạnh
  }, []);
  const geo = useMemo(() => {
    const g = new THREE.BufferGeometry();
    g.setAttribute("position", new THREE.BufferAttribute(new Float32Array(edges.length * 6), 3));
    return g;
  }, [edges]);
  useFrame((state) => {
    const t = state.clock.elapsedTime * 0.5;
    const [cxw, sxw, czw, szw, cxy, sxy] = [Math.cos(t), Math.sin(t), Math.cos(t * 0.7), Math.sin(t * 0.7), Math.cos(t * 0.3), Math.sin(t * 0.3)];
    const proj = verts.map(([x0, y0, z0, w0]) => {
      // Quay trong mặt phẳng xw, zw (chứa trục ẩn w) và xy
      let x = x0 * cxw - w0 * sxw;
      let w = x0 * sxw + w0 * cxw;
      const z = z0 * czw - w * szw;
      w = z0 * szw + w * czw;
      const y = y0;
      const x2 = x * cxy - y * sxy;
      const y2 = x * sxy + y * cxy;
      x = x2;
      const k = 1.6 / (3 - w); // phối cảnh 4D → 3D
      return [x * k, y2 * k, z * k];
    });
    const arr = geo.attributes.position.array as Float32Array;
    edges.forEach(([a, b], i) => {
      arr.set(proj[a], i * 6);
      arr.set(proj[b], i * 6 + 3);
    });
    geo.attributes.position.needsUpdate = true;
  });
  return (
    <lineSegments geometry={geo} scale={1.2}>
      <lineBasicMaterial color={new THREE.Color("#7fe3ff").multiplyScalar(2.2)} toneMapped={false} />
    </lineSegments>
  );
}

// ───────────── Chai Klein ─────────────

function KleinBottle({ segments }: { segments: number }) {
  const geo = useMemo(
    () =>
      new ParametricGeometry(
        (uu, vv, target) => {
          const u = uu * Math.PI;
          const v = vv * 2 * Math.PI;
          const cu = Math.cos(u);
          const su = Math.sin(u);
          const cv = Math.cos(v);
          const sv = Math.sin(v);
          const x = (-2 / 15) * cu * (3 * cv - 30 * su + 90 * cu ** 4 * su - 60 * cu ** 6 * su + 5 * cu * cv * su);
          const y =
            (-1 / 15) *
            su *
            (3 * cv - 3 * cu ** 2 * cv - 48 * cu ** 4 * cv + 48 * cu ** 6 * cv - 60 * su + 5 * cu * cv * su - 5 * cu ** 3 * cv * su - 80 * cu ** 5 * cv * su + 80 * cu ** 7 * cv * su);
          const z = (2 / 15) * (3 + 5 * cu * su) * sv;
          target.set(x, y, z);
        },
        segments,
        Math.round(segments / 2),
      ),
    [segments],
  );
  const ref = useRef<THREE.Group>(null);
  useFrame((_, dt) => {
    if (ref.current) ref.current.rotation.y += dt * 0.35;
  });
  return (
    <group ref={ref} scale={0.42} rotation={[Math.PI, 0, 0]} position={[0, 0.9, 0]}>
      <mesh geometry={geo}>
        <meshPhongMaterial color="#b48cff" emissive="#3a1f73" shininess={80} transparent opacity={0.55} side={THREE.DoubleSide} depthWrite={false} />
      </mesh>
      <mesh geometry={geo}>
        <meshBasicMaterial color={new THREE.Color("#e3d4ff").multiplyScalar(1.4)} wireframe transparent opacity={0.18} toneMapped={false} />
      </mesh>
    </group>
  );
}

// ───────────── Hút Lorenz (RK4) ─────────────

function Lorenz({ points }: { points: number }) {
  const { geo, pts } = useMemo(() => {
    const s = 10;
    const r = 28;
    const b = 8 / 3;
    const f = (p: number[]) => [s * (p[1] - p[0]), p[0] * (r - p[2]) - p[1], p[0] * p[1] - b * p[2]];
    let p = [0.1, 0, 0];
    const h = 0.008;
    const out: THREE.Vector3[] = [];
    for (let i = 0; i < points + 300; i++) {
      const k1 = f(p);
      const k2 = f(p.map((v, j) => v + (h / 2) * k1[j]));
      const k3 = f(p.map((v, j) => v + (h / 2) * k2[j]));
      const k4 = f(p.map((v, j) => v + h * k3[j]));
      p = p.map((v, j) => v + (h / 6) * (k1[j] + 2 * k2[j] + 2 * k3[j] + k4[j]));
      if (i >= 300) out.push(new THREE.Vector3(p[0], p[2] - 25, p[1]).multiplyScalar(0.055));
    }
    const g = new THREE.BufferGeometry().setFromPoints(out);
    const colors = new Float32Array(out.length * 3);
    const c1 = new THREE.Color("#ffb35c");
    const c2 = new THREE.Color("#ff5d9e");
    out.forEach((_, i) => {
      const c = c1.clone().lerp(c2, (Math.sin(i * 0.004) + 1) / 2).multiplyScalar(1.6);
      colors.set([c.r, c.g, c.b], i * 3);
    });
    g.setAttribute("color", new THREE.BufferAttribute(colors, 3));
    const line = new THREE.Line(g, new THREE.LineBasicMaterial({ vertexColors: true, toneMapped: false, transparent: true, opacity: 0.9 }));
    return { geo: line, pts: out };
  }, [points]);
  const bug = useRef<THREE.Mesh>(null);
  useFrame((state) => {
    const i = Math.floor(state.clock.elapsedTime * 120) % pts.length;
    bug.current?.position.copy(pts[i]);
  });
  return (
    <group>
      <primitive object={geo} />
      <mesh ref={bug}>
        <sphereGeometry args={[0.07, 12, 12]} />
        <meshBasicMaterial color={new THREE.Color("#fff3c0").multiplyScalar(3)} toneMapped={false} />
      </mesh>
    </group>
  );
}

// ───────────── Đĩa Poincaré: lát gạch hyperbolic {7,3} ─────────────

const poincareShader = {
  uniforms: { uTime: { value: 0 }, uP: { value: 7 }, uQ: { value: 3 } },
  vertexShader: /* glsl */ `varying vec2 vUv; void main(){ vUv = uv; gl_Position = projectionMatrix * modelViewMatrix * vec4(position,1.0); }`,
  fragmentShader: /* glsl */ `
    uniform float uTime; uniform float uP; uniform float uQ; varying vec2 vUv;
    vec2 cmul(vec2 a, vec2 b){ return vec2(a.x*b.x - a.y*b.y, a.x*b.y + a.y*b.x); }
    vec2 cdiv(vec2 a, vec2 b){ return cmul(a, vec2(b.x, -b.y)) / dot(b, b); }
    void main(){
      vec2 z = vUv * 2.0 - 1.0;
      float r = length(z);
      if (r >= 1.0) discard;
      // Phép dịch hyperbolic (Möbius) theo thời gian: z -> (z + a) / (1 + conj(a) z)
      vec2 a = 0.45 * vec2(cos(uTime * 0.25), sin(uTime * 0.31));
      z = cdiv(z + a, vec2(1.0, 0.0) + cmul(vec2(a.x, -a.y), z));
      float A = 3.14159265 / uP, B = 3.14159265 / uQ;
      float c = cos(B) / sqrt(cos(B) * cos(B) - sin(A) * sin(A));   // tâm gương tròn trên trục hoành
      float R = sqrt(c * c - 1.0);                                    // bán kính (vuông góc với đường tròn đơn vị)
      vec2 n = vec2(-sin(A), cos(A));
      float flips = 0.0;
      for (int i = 0; i < 60; i++) {
        bool moved = false;
        if (z.y < 0.0) { z.y = -z.y; flips += 1.0; moved = true; }
        float d = dot(z, n);
        if (d > 0.0) { z -= 2.0 * d * n; flips += 1.0; moved = true; }
        vec2 w = z - vec2(c, 0.0);
        float l2 = dot(w, w);
        if (l2 < R * R) { z = vec2(c, 0.0) + w * (R * R / l2); flips += 1.0; moved = true; }
        if (!moved) break;
      }
      float edge = abs(length(z - vec2(c, 0.0)) - R);
      float parity = mod(flips, 2.0);
      vec3 col = mix(vec3(0.16, 0.2, 0.42), vec3(0.98, 0.86, 0.55), parity * 0.85);
      col = mix(col, vec3(1.6, 1.3, 0.7), (1.0 - smoothstep(0.0, 0.02, edge)));
      col *= mix(1.0, 0.55, smoothstep(0.85, 1.0, r));
      gl_FragColor = vec4(col, 1.0);
    }
  `,
};

function PoincareDisk() {
  const mat = useMemo(() => new THREE.ShaderMaterial({ ...poincareShader, uniforms: THREE.UniformsUtils.clone(poincareShader.uniforms), side: THREE.DoubleSide, toneMapped: false }), []);
  useFrame((_, dt) => {
    mat.uniforms.uTime.value += dt;
  });
  return (
    <group rotation={[0, -0.5, 0]}>
      <mesh material={mat}>
        <circleGeometry args={[1.3, 96]} />
      </mesh>
      <mesh>
        <torusGeometry args={[1.32, 0.04, 8, 96]} />
        <meshBasicMaterial color={new THREE.Color("#ffd27a").multiplyScalar(1.8)} toneMapped={false} />
      </mesh>
    </group>
  );
}

// ───────────── Hố đen: thấu kính hấp dẫn ─────────────

const lensShader = {
  uniforms: { uSky: { value: null as THREE.Texture | null }, uCenter: { value: new THREE.Vector3() }, uRs: { value: 0.35 } },
  vertexShader: /* glsl */ `varying vec3 vWorld; void main(){ vec4 w = modelMatrix * vec4(position,1.0); vWorld = w.xyz; gl_Position = projectionMatrix * viewMatrix * w; }`,
  fragmentShader: /* glsl */ `
    uniform sampler2D uSky; uniform vec3 uCenter; uniform float uRs; varying vec3 vWorld;
    vec3 sky(vec3 d){ vec2 uv = vec2(atan(d.z, d.x) / 6.2831853 + 0.5, asin(clamp(d.y,-1.0,1.0)) / 3.1415926 + 0.5); return texture2D(uSky, uv).rgb; }
    void main(){
      vec3 ro = cameraPosition;
      vec3 rd = normalize(vWorld - ro);
      // Tham số va chạm b: khoảng cách gần nhất từ tia nhìn tới tâm hố đen
      vec3 oc = uCenter - ro;
      vec3 closest = ro + rd * dot(oc, rd) - uCenter;
      float b = length(closest);
      float shadow = 2.598 * uRs;                 // bán kính bóng = (√27 / 2) · Rs
      if (b < shadow) { gl_FragColor = vec4(0.0, 0.0, 0.0, 1.0); return; }
      // Góc lệch ≈ 2Rs / b (gần đúng trường yếu): bẻ tia về phía tâm
      float alpha = 2.0 * uRs / b;
      vec3 d = normalize(rd - normalize(closest) * tan(min(alpha, 1.4)));
      vec3 col = sky(d);
      col += vec3(1.6, 1.1, 0.6) * (1.0 - smoothstep(0.0, 0.05, abs(b - shadow))) * 1.6;   // vòng photon
      float fade = (1.0 - smoothstep(shadow * 2.5, shadow * 3.4, b));
      gl_FragColor = vec4(col, fade);
    }
  `,
};

const diskShader = {
  uniforms: { uTime: { value: 0 } },
  vertexShader: /* glsl */ `varying vec2 vUv; void main(){ vUv = uv; gl_Position = projectionMatrix * modelViewMatrix * vec4(position,1.0); }`,
  fragmentShader: /* glsl */ `
    uniform float uTime; varying vec2 vUv;
    void main(){
      vec2 p = vUv * 2.0 - 1.0; float r = length(p); float a = atan(p.y, p.x);
      if (r < 0.42 || r > 1.0) discard;
      float swirl = sin(a * 6.0 + uTime * 3.0 - r * 18.0) * 0.5 + 0.5;
      float heat = (1.0 - smoothstep(0.42, 1.0, r));
      vec3 col = mix(vec3(1.4, 0.35, 0.08), vec3(2.6, 2.1, 1.4), heat) * (0.6 + 0.6 * swirl);
      float alpha = (1.0 - smoothstep(0.75, 1.0, r)) * smoothstep(0.42, 0.5, r);
      gl_FragColor = vec4(col, alpha);
    }
  `,
};

function BlackHole() {
  const sky = useTexture(worldAsset("art/sky_panorama.webp"));
  const g = useRef<THREE.Group>(null);
  const lens = useMemo(() => new THREE.ShaderMaterial({ ...lensShader, uniforms: THREE.UniformsUtils.clone(lensShader.uniforms), transparent: true, depthWrite: false, toneMapped: false }), []);
  const disk = useMemo(
    () => new THREE.ShaderMaterial({ ...diskShader, uniforms: THREE.UniformsUtils.clone(diskShader.uniforms), transparent: true, depthWrite: false, side: THREE.DoubleSide, blending: THREE.AdditiveBlending, toneMapped: false }),
    [],
  );
  useFrame((_, dt) => {
    sky.colorSpace = THREE.SRGBColorSpace;
    lens.uniforms.uSky.value = sky;
    g.current?.getWorldPosition(lens.uniforms.uCenter.value);
    disk.uniforms.uTime.value += dt;
  });
  return (
    <group ref={g}>
      <Billboard>
        <mesh material={lens}>
          <planeGeometry args={[3.4, 3.4]} />
        </mesh>
      </Billboard>
      <mesh material={disk} rotation={[-Math.PI / 2 + 0.35, 0, 0.2]}>
        <planeGeometry args={[2.6, 2.6]} />
      </mesh>
    </group>
  );
}
