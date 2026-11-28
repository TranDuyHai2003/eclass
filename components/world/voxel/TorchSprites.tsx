"use client";
/**
 * Đuốc (khối "sprite" — lưới chunk không sinh mặt, ánh sáng khối vẫn toả từ ô đó): hai mặt bắt chéo dùng tranh đuốc
 * pixel-art (public/world/voxel/torch_sprite.png, tách nền từ hoạ tiết sinh bằng Codex), một InstancedMesh cho mọi đuốc.
 * Lửa lay nhẹ (đỉnh vẽ phía trên dịch theo sin + pha theo ô) và sáng HDR (không tone map) để bloom bắt.
 * Vị trí lấy từ kho sửa khối (đuốc chỉ do người chơi đặt): duyệt một lần + nghe onAnyEdit — không quét địa hình.
 */
import { useEffect, useMemo, useRef } from "react";
import { useFrame } from "@react-three/fiber";
import * as THREE from "three";
import { mergeGeometries } from "three/examples/jsm/utils/BufferGeometryUtils.js";
import { forEachEdit, onAnyEdit } from "@/lib/world/voxels";
import { B } from "@/lib/world/blocks";

const MAX = 512;
const T_U = { uT: { value: 0 } };
const M = new THREE.Matrix4();

export function TorchSprites() {
  const ref = useRef<THREE.InstancedMesh>(null);
  const res = useMemo(() => {
    const tex = new THREE.TextureLoader().load("/world/voxel/torch_sprite.png");
    tex.magFilter = THREE.NearestFilter;
    tex.minFilter = THREE.NearestMipmapLinearFilter;
    tex.colorSpace = THREE.SRGBColorSpace;
    // hai mặt 1 × 1 bắt chéo qua tâm ô (gốc ở góc ô: cộng 0,5)
    const a = new THREE.PlaneGeometry(1, 1).rotateY(Math.PI / 4).translate(0.5, 0.5, 0.5);
    const b = new THREE.PlaneGeometry(1, 1).rotateY(-Math.PI / 4).translate(0.5, 0.5, 0.5);
    const geo = mergeGeometries([a, b])!;
    a.dispose();
    b.dispose();
    const mat = new THREE.ShaderMaterial({
      side: THREE.DoubleSide,
      fog: true,
      toneMapped: false,
      uniforms: { ...THREE.UniformsUtils.clone(THREE.UniformsLib.fog), uMap: { value: tex }, uT: T_U.uT },
      vertexShader: /* glsl */ `
        #include <common>
        #include <fog_pars_vertex>
        uniform float uT;
        varying vec2 vUv;
        void main() {
          vUv = uv;
          vec3 p = position;
          vec4 o = instanceMatrix * vec4(0.0, 0.0, 0.0, 1.0);
          float ph = dot(o.xyz, vec3(1.7, 3.1, 2.3));
          // lửa (nửa trên) lay nhẹ, que đứng yên
          float k = smoothstep(0.55, 1.0, uv.y);
          p.x += k * 0.035 * sin(uT * 7.0 + ph);
          p.z += k * 0.035 * cos(uT * 5.3 + ph * 1.3);
          vec4 mvPosition = viewMatrix * modelMatrix * instanceMatrix * vec4(p, 1.0);
          gl_Position = projectionMatrix * mvPosition;
          #include <fog_vertex>
        }`,
      fragmentShader: /* glsl */ `
        #include <common>
        #include <fog_pars_fragment>
        uniform sampler2D uMap; uniform float uT;
        varying vec2 vUv;
        void main() {
          vec4 c = texture2D(uMap, vUv);
          if (c.a < 0.5) discard;
          // điểm ảnh lửa (sáng, ấm) → HDR cho bloom, nhấp nháy nhẹ
          float flame = smoothstep(0.55, 0.85, max(c.r, c.g)) * step(0.55, vUv.y);
          vec3 col = c.rgb * (1.0 + flame * (1.4 + 0.25 * sin(uT * 11.0)));
          gl_FragColor = vec4(col, 1.0);
          #include <fog_fragment>
        }`,
    });
    return { geo, mat, tex };
  }, []);
  useEffect(() => () => (res.geo.dispose(), res.mat.dispose(), res.tex.dispose()), [res]);

  // vị trí đuốc: kho sửa khối (khoá số → toạ độ)
  const state = useRef({ map: new Map<string, [number, number, number]>(), dirty: true });
  useEffect(() => {
    const st = state.current;
    forEachEdit((x, y, z, id) => {
      if (id === B.torch) st.map.set(`${x},${y},${z}`, [x, y, z]);
    });
    st.dirty = true;
    return onAnyEdit((x, y, z, id) => {
      const k = `${x},${y},${z}`;
      if (id === B.torch) st.map.set(k, [x, y, z]);
      else if (!st.map.delete(k)) return;
      st.dirty = true;
    });
  }, []);

  useFrame((_, dt) => {
    T_U.uT.value += Math.min(dt, 0.1);
    const st = state.current;
    const mesh = ref.current;
    if (!mesh || !st.dirty) return;
    st.dirty = false;
    let n = 0;
    for (const [x, y, z] of st.map.values()) {
      if (n >= MAX) break;
      mesh.setMatrixAt(n++, M.makeTranslation(x, y, z));
    }
    mesh.count = n;
    mesh.instanceMatrix.needsUpdate = true;
    mesh.computeBoundingSphere();
  });
  return <instancedMesh ref={ref} args={[res.geo, res.mat, MAX]} frustumCulled={false} />;
}
