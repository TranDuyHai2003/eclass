"use client";
/**
 * Đài Phép Chiếu — lib/world/anamorph.ts: ~1100 mảnh tam giác (1 draw instanced), mỗi mảnh trôi DỌC tia từ điểm nhìn
 * (giữ nguyên hình chiếu từ điểm đó). Mặt mảnh nghiêng ngẫu nhiên ±25° để bắt nắng khác nhau → mặt phẳng gãy kiểu lập thể;
 * mép mảnh có nét mực mảnh + vân giấy (collage). Đứng lên vòng vàng (F) → máy quay vào đúng điểm nhìn, tranh hiện ra.
 * Mẫu vật "Màu từ ngoài không gian" (Lovecraft): khối 20 mặt màng mỏng — màu đổi theo góc nhìn, lệch hẳn bảng màu cảnh.
 */
import { useEffect, useMemo, useRef } from "react";
import { useFrame } from "@react-three/fiber";
import * as THREE from "three";
import { ANAM, PALETTE, PLANE, makeShards, viewPoint } from "@/lib/world/anamorph";
import { IMP_SUN } from "./ImpossibleCosmos";
import { CAM } from "../combat/combat";
import { useWorld } from "../store";
import { Label3D } from "../ui/Labels";

const N = 1100;

const VS = /* glsl */ `
  attribute vec3 aDir; attribute vec4 aShard; attribute vec3 aColor; attribute vec3 aBary;
  uniform vec3 uV; uniform float uT; uniform float uD0;
  varying vec3 vColor; varying vec3 vBary; varying vec3 vN; varying vec2 vLocal; varying float vSeed;
  void main(){
    float t0 = aShard.x, size = aShard.y, rot = aShard.z, ph = aShard.w;
    // trôi dọc tia (hình chiếu từ điểm nhìn không đổi), biên độ 0,7 m
    float t = t0 + 0.7 * sin(uT * 0.45 + ph);
    vec3 c = uV + aDir * t;
    vec3 fwd = -aDir;
    vec3 right = normalize(cross(vec3(0.0, 1.0, 0.0), fwd));
    vec3 up = cross(fwd, right);
    float cr = cos(rot), sr = sin(rot);
    vec2 q = mat2(cr, sr, -sr, cr) * position.xy * size * t / uD0;
    vec3 w = c + right * q.x + up * q.y;
    // pháp tuyến "gãy": nghiêng mặt mảnh ±25° theo pha → mỗi mảnh bắt nắng một kiểu (mặt phẳng lập thể)
    vec3 tilt = right * sin(ph * 3.1) * 0.45 + up * cos(ph * 2.3) * 0.45;
    vN = normalize(fwd + tilt);
    vColor = aColor; vBary = aBary; vLocal = position.xy; vSeed = ph;
    gl_Position = projectionMatrix * viewMatrix * vec4(w, 1.0);
  }`;

const FS = /* glsl */ `
  uniform vec3 uSun; uniform vec3 uInk;
  varying vec3 vColor; varying vec3 vBary; varying vec3 vN; varying vec2 vLocal; varying float vSeed;
  float h(vec2 p){ return fract(sin(dot(p, vec2(127.1, 311.7))) * 43758.5453); }
  void main(){
    vec3 n = normalize(gl_FrontFacing ? vN : -vN);
    float lam = max(dot(n, uSun), 0.0);
    // ba bậc sáng (giấy dán phẳng), không gradient mềm
    float val = 0.62 + 0.2 * step(0.18, lam) + 0.22 * step(0.55, lam);
    // vân giấy + sợi
    float grain = (h(floor(vLocal * 90.0) + vSeed) - 0.5) * 0.06;
    vec3 col = vColor * (val + grain);
    // nét mực ở mép mảnh (collage cắt dán)
    float e = min(vBary.x, min(vBary.y, vBary.z));
    float ink = 1.0 - smoothstep(0.02, 0.05, e);
    col = mix(col, uInk, ink * 0.85);
    gl_FragColor = vec4(col, 1.0);
    #include <tonemapping_fragment>
    #include <colorspace_fragment>
  }`;

/** "Màu từ ngoài không gian": giao thoa màng mỏng cách điệu (lime ↔ lục ngọc ↔ trắng ngà) theo góc nhìn */
const SPEC_VS = /* glsl */ `varying vec3 vN; varying vec3 vV; void main(){ vec4 w = modelMatrix * vec4(position, 1.0); vN = normalize(mat3(modelMatrix) * normal); vV = normalize(cameraPosition - w.xyz); gl_Position = projectionMatrix * viewMatrix * w; }`;
const SPEC_FS = /* glsl */ `
  uniform vec3 uLime; uniform vec3 uMint; uniform vec3 uPale; uniform float uT;
  varying vec3 vN; varying vec3 vV;
  void main(){
    float nv = clamp(abs(dot(normalize(vN), normalize(vV))), 0.0, 1.0);
    float ior = 1.38;
    float cosF = sqrt(1.0 - (1.0 - nv * nv) / (ior * ior));
    float film = 420.0 + 60.0 * sin(uT * 0.6);
    vec3 ph = (12.566371 * ior * film * cosF) / vec3(610.0, 530.0, 460.0);
    vec3 w = 0.12 + 0.88 * (0.5 + 0.5 * cos(ph));
    vec3 ink = (w.r * uLime + w.g * uMint + w.b * uPale) / (w.r + w.g + w.b);
    gl_FragColor = vec4(ink * mix(1.1, 1.6, pow(1.0 - nv, 3.0)), 1.0);
    #include <tonemapping_fragment>
    #include <colorspace_fragment>
  }`;

export function AnamorphSculpture() {
  const { geo, mat } = useMemo(() => {
    const shards = makeShards(N);
    const g = new THREE.InstancedBufferGeometry();
    // tam giác gốc (đơn vị) + toạ độ trọng tâm cho nét mép
    g.setAttribute("position", new THREE.Float32BufferAttribute([-0.55, -0.4, 0, 0.6, -0.35, 0, -0.05, 0.62, 0], 3));
    g.setAttribute("aBary", new THREE.Float32BufferAttribute([1, 0, 0, 0, 1, 0, 0, 0, 1], 3));
    const dir = new Float32Array(N * 3);
    const sh = new Float32Array(N * 4);
    const col = new Float32Array(N * 3);
    const c = new THREE.Color();
    shards.forEach((s, i) => {
      dir.set(s.dir, i * 3);
      // cỡ trong mặt phẳng tranh: 0,16 → 0,26 m (phủ kín tranh, chồng nhẹ)
      sh.set([s.t, s.size * 1.6, s.rot, s.phase], i * 4);
      c.set(PALETTE[s.tone]).convertSRGBToLinear();
      col.set([c.r, c.g, c.b], i * 3);
    });
    g.setAttribute("aDir", new THREE.InstancedBufferAttribute(dir, 3));
    g.setAttribute("aShard", new THREE.InstancedBufferAttribute(sh, 4));
    g.setAttribute("aColor", new THREE.InstancedBufferAttribute(col, 3));
    g.instanceCount = shards.length;
    const V = viewPoint();
    g.boundingSphere = new THREE.Sphere(new THREE.Vector3(V[0] + 10, 3, V[2]), 9);
    const m = new THREE.ShaderMaterial({
      uniforms: { uV: { value: new THREE.Vector3(...V) }, uT: { value: 0 }, uD0: { value: PLANE.d }, uSun: { value: IMP_SUN.clone() }, uInk: { value: new THREE.Color(PALETTE.ink).convertSRGBToLinear() } },
      vertexShader: VS,
      fragmentShader: FS,
      side: THREE.DoubleSide,
    });
    return { geo: g, mat: m };
  }, []);
  const spec = useMemo(
    () =>
      new THREE.ShaderMaterial({
        uniforms: { uT: { value: 0 }, uLime: { value: new THREE.Color("#C7F53D") }, uMint: { value: new THREE.Color("#38F5A5") }, uPale: { value: new THREE.Color("#F7FFDB") } },
        vertexShader: SPEC_VS,
        fragmentShader: SPEC_FS,
      }),
    [],
  );
  useEffect(
    () => () => {
      geo.dispose();
      mat.dispose();
      spec.dispose();
    },
    [geo, mat, spec],
  );
  const specRef = useRef<THREE.Mesh>(null);
  const onSpot = useRef(false);
  useFrame((state) => {
    const t = state.clock.elapsedTime;
    mat.uniforms.uT.value = t;
    spec.uniforms.uT.value = t;
    if (specRef.current) {
      specRef.current.rotation.set(t * 0.31, t * 0.47, t * 0.13);
      specRef.current.position.y = 3.4 + Math.sin(t * 0.8) * 0.25;
    }
    // đứng trên vòng điểm nhìn: ẩn chính mình để thấy trọn bức tranh
    const p = useWorld.getState().player;
    const on = Math.hypot(p.x - ANAM.x, p.z - ANAM.z) < 0.7 && p.y < 0.5;
    if (on !== onSpot.current) {
      onSpot.current = on;
      CAM.hideSelf = on;
    }
  });
  useEffect(
    () => () => {
      if (onSpot.current) CAM.hideSelf = false;
    },
    [],
  );
  return (
    <group>
      <mesh geometry={geo} material={mat} frustumCulled={false} name="anamorph" />
      {/* vòng điểm nhìn trên sàn */}
      <mesh rotation-x={-Math.PI / 2} position={[ANAM.x, 0.03, ANAM.z]}>
        <ringGeometry args={[0.55, 0.68, 48]} />
        <meshBasicMaterial color="#FFD078" toneMapped={false} />
      </mesh>
      <mesh rotation-x={-Math.PI / 2} position={[ANAM.x, 0.031, ANAM.z]}>
        <circleGeometry args={[0.16, 24]} />
        <meshBasicMaterial color="#FFD078" toneMapped={false} />
      </mesh>
      <Label3D text="Đài Phép Chiếu · đứng vào vòng vàng" position={[ANAM.x, 2.3, ANAM.z]} />
      {/* mẫu vật "màu từ ngoài không gian" lơ lửng sau đài */}
      <mesh ref={specRef} position={[18.2, 3.4, 2.5]} material={spec} userData={{ noReal: true }}>
        <icosahedronGeometry args={[0.55, 0]} />
      </mesh>
    </group>
  );
}
