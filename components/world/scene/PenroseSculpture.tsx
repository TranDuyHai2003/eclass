"use client";
/**
 * Impossible Halls court — the Penrose triangle sculpture (Reutersvärd / Penrose).
 * Three straight bars (Blender `props/penrose.glb`) that do NOT touch: A→B→C→D with D exactly behind A along one axis.
 * From that single viewpoint their 2-D projections close into an "impossible" triangle. The player hunts for the spot:
 * the neon seam warms up as the camera direction approaches the magic axis; lining it up snaps a magenta flash and
 * unlocks the field note "The impossible triangle". A glowing footprint ring hints where to stand.
 */
import { useEffect, useMemo, useRef } from "react";
import { useFrame, useThree } from "@react-three/fiber";
import { useGLTF } from "@react-three/drei";
import * as THREE from "three";
import { worldAsset } from "@/lib/world/avatars";
import { toonize } from "../fx/glbToon";
import { unlockNote } from "../story/quest";
import { floatText } from "../ui/Labels";
import { useWorld } from "../store";
import { sfx } from "@/lib/world/sfx";

const GLB = worldAsset("props/penrose.glb");
useGLTF.preload(GLB);
/** Trục "khép kín" trong toạ độ của mô hình (Blender (1,1,1) → game (1,1,−1)) và tâm khối */
const LOCAL_AXIS = new THREE.Vector3(1, 1, -1).normalize();
const LOCAL_CENTER = new THREE.Vector3(1.5, 1.5, -1.5);
const TOL = Math.cos((2.6 * Math.PI) / 180);

export function PenroseSculpture({ position, view }: { position: [number, number, number]; view: [number, number, number] }) {
  const gltf = useGLTF(GLB);
  const { camera } = useThree();
  const obj = useMemo(() => toonize(gltf.scene), [gltf]);
  const neon = useMemo(() => {
    let m: THREE.MeshBasicMaterial | null = null;
    obj.traverse((o) => {
      const mesh = o as THREE.Mesh;
      if (mesh.isMesh && mesh.name.startsWith("penrose_neon")) {
        m = (mesh.material as THREE.MeshBasicMaterial).clone();
        mesh.material = m;
      }
    });
    return m as THREE.MeshBasicMaterial | null;
  }, [obj]);
  // Quay mô hình sao cho trục khép kín trỏ về phía người xem (view: hướng từ tượng tới điểm nhìn)
  const { quat, axisW, centerW, spot } = useMemo(() => {
    const want = new THREE.Vector3(...view).normalize();
    const q = new THREE.Quaternion().setFromUnitVectors(LOCAL_AXIS, want);
    const centerW = new THREE.Vector3(...position);
    // điểm đứng gợi ý: theo hướng nhìn, cách ~6 m, trên mặt đất (máy quay ở sau lưng ~ trên trục)
    const spot = centerW.clone().add(want.clone().setY(0).normalize().multiplyScalar(6.2));
    return { quat: q, axisW: want, centerW, spot };
  }, [position, view]);
  const ring = useMemo(
    () =>
      new THREE.ShaderMaterial({
        uniforms: { uT: { value: 0 }, uK: { value: 0 } },
        vertexShader: "varying vec2 vUv; void main(){ vUv = uv; gl_Position = projectionMatrix * modelViewMatrix * vec4(position,1.0); }",
        fragmentShader: `uniform float uT; uniform float uK; varying vec2 vUv;
          void main(){ vec2 p = (vUv - 0.5) * 2.0; float r = length(p);
            float ring = smoothstep(0.05, 0.0, abs(r - 0.82 - 0.04 * sin(uT * 3.0)));
            float tri = 0.0;
            for (int i = 0; i < 3; i++) { float a = 6.2831853 * float(i) / 3.0 + uT * 0.4; tri += smoothstep(0.035, 0.0, abs(dot(p, vec2(cos(a), sin(a))) - 0.38)) * step(r, 0.78); }
            vec3 c = mix(vec3(0.25, 0.95, 1.0), vec3(1.0, 0.3, 0.75), uK);
            gl_FragColor = vec4(c * (ring + tri * 0.6) * 1.6, 1.0); }`,
        transparent: true,
        depthWrite: false,
        blending: THREE.AdditiveBlending,
        toneMapped: false,
      }),
    [],
  );
  useEffect(() => () => ring.dispose(), [ring]);
  const solved = useRef(false);
  const lastAligned = useRef(false);
  const tmp = useMemo(() => new THREE.Vector3(), []);
  useFrame(() => {
    const t = performance.now() / 1000;
    ring.uniforms.uT.value = t;
    tmp.copy(camera.position).sub(centerW);
    const dist = tmp.length();
    const d = tmp.normalize().dot(axisW);
    // "ấm dần": càng gần trục khép kín, viền neon càng sáng và chuyển hồng
    const warm = THREE.MathUtils.clamp((d - 0.9) / (1 - 0.9), 0, 1);
    const aligned = d > TOL && dist > 4 && dist < 18;
    ring.uniforms.uK.value = aligned ? 1 : warm * 0.6;
    if (neon) {
      neon.color.setRGB(0.22 + 0.78 * warm, 0.95 - 0.65 * warm, 1.0 - 0.25 * warm).multiplyScalar(2.2 + (aligned ? 2.2 + Math.sin(t * 12) * 0.6 : warm));
    }
    if (aligned && !lastAligned.current) {
      sfx.chime(4);
      floatText(centerW.clone().add(new THREE.Vector3(0, 2.6, 0)), useWorld.getState().lang === "vi" ? "Khép kín! (chỉ từ góc này)" : "Closed! (only from here)", "info");
      if (!solved.current) {
        solved.current = true;
        unlockNote("penrose");
      }
    }
    lastAligned.current = aligned;
  });
  return (
    <group>
      <group position={position} quaternion={quat}>
        <primitive object={obj} position={LOCAL_CENTER.clone().negate().toArray()} />
      </group>
      {/* Bệ đá dưới tượng */}
      <mesh position={[position[0], 0.15, position[2]]}>
        <cylinderGeometry args={[1.6, 1.8, 0.3, 8]} />
        <meshToonMaterial color="#5d5277" />
      </mesh>
      {/* Vòng chân gợi ý điểm đứng */}
      <mesh material={ring} rotation-x={-Math.PI / 2} position={[spot.x, 0.02, spot.z]} renderOrder={2}>
        <planeGeometry args={[1.8, 1.8]} />
      </mesh>
    </group>
  );
}
