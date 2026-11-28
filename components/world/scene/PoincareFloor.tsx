"use client";
/**
 * Sàn Poincaré (Thế giới Bất Khả) — Escher "Circle Limit" × bài học hình học hyperbolic (lib/world/hyperbolic.ts):
 *  • đĩa lát thất giác {7,3}: shader gấp điểm vào tam giác cơ bản (phản xạ qua trục, qua tia π/7, nghịch đảo qua đường tròn cạnh),
 *    tô theo số lần nghịch đảo (mod 3), viền vàng ở cạnh thất giác; gạch nhỏ dần vô hạn về mép, cả lưới "chảy" chậm theo
 *    phép tịnh tiến hyperbolic (Möbius z → (z + t) / (1 + t̄z));
 *  • tam giác TRẮC ĐỊA nối chân người chơi với hai cột đá: cạnh là cung tròn vuông góc với mép đĩa;
 *    bảng sống: ba góc, tổng < 180°, diện tích = π − tổng (Gauss–Bonnet). Ra sát mép → tổng góc tụt mạnh.
 */
import { useEffect, useMemo, useRef, useState } from "react";
import { useFrame } from "@react-three/fiber";
import * as THREE from "three";
import { DISK, PILLARS, fromDisk, geodesicPoints, tilingCircle, toDisk, triangleAngles, type P2 } from "@/lib/world/hyperbolic";
import { useWorld } from "../store";
import { Label3D } from "../ui/Labels";
import { shown } from "./shown";

const TC = tilingCircle(7, 3);

const FS = /* glsl */ `
  uniform float uT; uniform vec2 uC; uniform float uR; uniform vec3 uA; uniform vec3 uB; uniform vec3 uCc; uniform vec3 uGold;
  varying vec2 vP;
  vec2 cmul(vec2 a, vec2 b){ return vec2(a.x*b.x - a.y*b.y, a.x*b.y + a.y*b.x); }
  vec2 cdiv(vec2 a, vec2 b){ return vec2(a.x*b.x + a.y*b.y, a.y*b.x - a.x*b.y) / dot(b, b); }
  void main(){
    vec2 z = vP;
    float rr = length(z);
    if (rr > 1.0) discard;
    // tịnh tiến hyperbolic chậm (lưới chảy về một phía rồi quay lại)
    vec2 t = vec2(0.35 * sin(uT * 0.07), 0.25 * sin(uT * 0.05 + 1.0));
    z = cdiv(z + t, vec2(1.0, 0.0) + cmul(vec2(t.x, -t.y), z));
    const float PI = 3.14159265;
    float A = PI / 7.0;
    vec2 n2 = vec2(-sin(A), cos(A));
    float inv = 0.0;
    for (int i = 0; i < 40; i++) {
      bool done = true;
      if (z.y < 0.0) { z.y = -z.y; done = false; }
      float s = dot(z, n2);
      if (s > 0.0) { z -= 2.0 * s * n2; done = false; }
      vec2 d = z - uC;
      float l2 = dot(d, d);
      if (l2 < uR * uR) { z = uC + d * (uR * uR / l2); inv += 1.0; done = false; }
      if (done) break;
    }
    float k = mod(inv, 3.0);
    vec3 col = k < 0.5 ? uA : (k < 1.5 ? uB : uCc);
    // gợn sáng tối theo khoảng cách tới tâm thất giác (tạo khối "vảy")
    col *= 0.82 + 0.18 * smoothstep(0.0, 0.5, length(z));
    // cạnh thất giác = đường tròn cạnh; độ dày quy theo hệ số co của đĩa (mảnh dần về mép giống Escher)
    float e = abs(length(z - uC) - uR);
    float w = 0.012;
    float edge = 1.0 - smoothstep(w * 0.5, w, e);
    col = mix(col, uGold, edge);
    // vành mép đĩa
    col = mix(col, uGold * 0.6, smoothstep(0.985, 0.998, rr));
    gl_FragColor = vec4(col, 1.0);
    #include <tonemapping_fragment>
    #include <colorspace_fragment>
  }`;

export function PoincareFloor() {
  const mat = useMemo(
    () =>
      new THREE.ShaderMaterial({
        uniforms: {
          uT: { value: 0 },
          uC: { value: new THREE.Vector2(TC.d, 0) },
          uR: { value: TC.r },
          uA: { value: new THREE.Color("#1d4f5c") },
          uB: { value: new THREE.Color("#e8dcc0") },
          uCc: { value: new THREE.Color("#b5476b") },
          uGold: { value: new THREE.Color("#ffd078") },
        },
        vertexShader: "varying vec2 vP; void main(){ vP = vec2(position.x, position.y); gl_Position = projectionMatrix * modelViewMatrix * vec4(position, 1.0); }",
        fragmentShader: FS,
        polygonOffset: true,
        polygonOffsetFactor: -2,
      }),
    [],
  );
  // tam giác trắc địa: 3 cung × 33 điểm → dải ruy băng sáng rộng 7 cm nằm sát sàn (đường 1 px khó thấy)
  const tri = useMemo(() => {
    const g = new THREE.BufferGeometry();
    const N = 3 * 33;
    g.setAttribute("position", new THREE.BufferAttribute(new Float32Array(N * 2 * 3), 3).setUsage(THREE.DynamicDrawUsage));
    const idx: number[] = [];
    for (let arc = 0; arc < 3; arc++)
      for (let i = 0; i < 32; i++) {
        const v = (arc * 33 + i) * 2;
        idx.push(v, v + 1, v + 2, v + 1, v + 3, v + 2);
      }
    g.setIndex(idx);
    const m = new THREE.MeshBasicMaterial({ color: new THREE.Color(2.4, 1.7, 0.6), toneMapped: false, side: THREE.DoubleSide });
    const mesh = new THREE.Mesh(g, m);
    mesh.frustumCulled = false;
    return mesh;
  }, []);
  useEffect(
    () => () => {
      mat.dispose();
      tri.geometry.dispose();
      (tri.material as THREE.Material).dispose();
    },
    [mat, tri],
  );
  const [label, setLabel] = useState("");
  const last = useRef({ t: 0, key: "" });
  const root = useRef<THREE.Group>(null);
  /** đỉnh A lần dựng cung gần nhất — đứng yên (hoặc ngoài đĩa: điểm mặc định) thì khỏi dựng lại 3 cung trắc địa */
  const lastA = useRef<P2 | null>(null);
  useFrame((state) => {
    // sân bị ẩn (đang trong đại sảnh của bốt): bỏ qua
    if (!shown(root.current)) {
      lastA.current = null;
      return;
    }
    mat.uniforms.uT.value = state.clock.elapsedTime;
    const p = useWorld.getState().player;
    let a: P2 = toDisk(p.x, p.z);
    const r = Math.hypot(a[0], a[1]);
    const on = r < 1 && p.y < 1;
    if (!on) a = [0.05, 0.55];
    else if (r > 0.97) a = [(a[0] / r) * 0.97, (a[1] / r) * 0.97];
    const la = lastA.current;
    const changed = !la || Math.abs(la[0] - a[0]) > 1e-5 || Math.abs(la[1] - a[1]) > 1e-5;
    lastA.current = a;
    const pos = tri.geometry.attributes.position as THREE.BufferAttribute;
    const [b, c] = PILLARS;
    let k = 0;
    if (changed) for (const [u, v] of [
      [a, b],
      [b, c],
      [c, a],
    ] as [P2, P2][]) {
      const pts = geodesicPoints(u, v, 32).map((q) => fromDisk(q));
      for (let i = 0; i < pts.length; i++) {
        const [x, z] = pts[i];
        const [x0, z0] = pts[Math.max(0, i - 1)];
        const [x1, z1] = pts[Math.min(pts.length - 1, i + 1)];
        const dx = x1 - x0;
        const dz = z1 - z0;
        const l = Math.hypot(dx, dz) || 1;
        const nx = (-dz / l) * 0.035;
        const nz = (dx / l) * 0.035;
        pos.setXYZ(k++, x + nx, 0.045, z + nz);
        pos.setXYZ(k++, x - nx, 0.045, z - nz);
      }
    }
    if (changed) pos.needsUpdate = true;
    // bảng số liệu ~5 lần / giây
    const now = state.clock.elapsedTime;
    if (now - last.current.t < 0.2) return;
    last.current.t = now;
    const ang = triangleAngles(a, b, c).map((x) => (x * 180) / Math.PI);
    const s = ang[0] + ang[1] + ang[2];
    const txt = on
      ? `∠ ${ang.map((x) => x.toFixed(1).replace(".", ",")).join("° + ")}° = ${s.toFixed(1).replace(".", ",")}° < 180° · diện tích = π − tổng = ${(((180 - s) * Math.PI) / 180).toFixed(2).replace(".", ",")}`
      : "Đĩa Poincaré · bước vào: tổng ba góc tam giác < 180°";
    if (txt !== last.current.key) {
      last.current.key = txt;
      setLabel(txt);
    }
  });
  const pillars = useMemo(() => PILLARS.map((q) => fromDisk(q)), []);
  return (
    <group name="poincare" ref={root}>
      <mesh rotation-x={-Math.PI / 2} position={[DISK.x, 0.02, DISK.z]} scale={DISK.R} material={mat}>
        <circleGeometry args={[1, 128]} />
      </mesh>
      <primitive object={tri} />
      {pillars.map(([x, z], i) => (
        <mesh key={i} position={[x, 0.45, z]}>
          <cylinderGeometry args={[0.09, 0.14, 0.9, 6]} />
          <meshStandardMaterial color="#e8dcc0" roughness={0.4} metalness={0.1} />
        </mesh>
      ))}
      <Label3D text={label} position={[DISK.x, 2.4, DISK.z]} />
    </group>
  );
}
