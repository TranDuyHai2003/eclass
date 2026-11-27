"use client";
/**
 * Lan can đá quanh sân Sảnh Bất Khả (`props/court_rail.glb`, Blender, AO nướng, toon) — thay bốn bức tường hộp cũ.
 * Mỗi cạnh 16 đoạn 2,5 m (trụ + tay vịn + con tiện), cứ 4 đoạn một trụ đèn pha lê; cạnh bắc chừa khe cho hành lang khách sạn.
 * Vẽ bằng instancing: mỗi lưới con một InstancedMesh.
 */
import { useEffect, useMemo, useRef } from "react";
import { useGLTF } from "@react-three/drei";
import * as THREE from "three";
import { worldAsset } from "@/lib/world/avatars";
import { toonize } from "../fx/glbToon";

const GLB = worldAsset("props/court_rail.glb");
useGLTF.preload(GLB);

const SEG = 2.5;
const EDGE = 19.8;
/** khe cho hành lang khách sạn Hilbert ở cạnh bắc */
const GAP = { x0: 5.0, x1: 9.5 };

type Placement = { pos: THREE.Vector3; rotY: number };
function layout() {
  const seg: Placement[] = [];
  const lamp: Placement[] = [];
  const post: Placement[] = [];
  const sides = [
    { start: new THREE.Vector3(-20, 0, -EDGE), d: new THREE.Vector3(1, 0, 0), north: true },
    { start: new THREE.Vector3(EDGE, 0, -20), d: new THREE.Vector3(0, 0, 1), north: false },
    { start: new THREE.Vector3(20, 0, EDGE), d: new THREE.Vector3(-1, 0, 0), north: false },
    { start: new THREE.Vector3(-EDGE, 0, 20), d: new THREE.Vector3(0, 0, -1), north: false },
  ];
  for (const s of sides) {
    const rotY = -Math.atan2(s.d.z, s.d.x);
    for (let k = 0; k < 16; k++) {
      const c = s.start.clone().addScaledVector(s.d, SEG / 2 + SEG * k);
      if (s.north && c.x + SEG / 2 > GAP.x0 && c.x - SEG / 2 < GAP.x1) continue;
      (k % 4 === 2 ? lamp : seg).push({ pos: c, rotY });
    }
  }
  // trụ khép hai mép khe
  post.push({ pos: new THREE.Vector3(GAP.x0, 0, -EDGE), rotY: 0 }, { pos: new THREE.Vector3(GAP.x1 + 0.5, 0, -EDGE), rotY: 0 });
  return { seg, lamp, post };
}

export function CourtRail() {
  const gltf = useGLTF(GLB);
  const parts = useMemo(() => {
    const base = toonize(gltf.scene);
    const L = layout();
    const out: { geo: THREE.BufferGeometry; mat: THREE.Material; list: Placement[] }[] = [];
    const add = (name: string, list: Placement[]) => {
      const o = base.getObjectByName(name);
      if (!o) return;
      o.updateWorldMatrix(true, true);
      o.traverse((c) => {
        const m = c as THREE.Mesh;
        if (!m.isMesh) return;
        // gốc mỗi vật trong GLB = gốc đoạn; chép biến đổi cục bộ vào hình học
        const g = m.geometry.clone();
        g.applyMatrix4(new THREE.Matrix4().copy(o.matrixWorld).invert().multiply(m.matrixWorld));
        out.push({ geo: g, mat: m.material as THREE.Material, list });
      });
    };
    add("rail_seg", L.seg);
    add("rail_lamp", L.lamp);
    add("rail_lamp_crystal", L.lamp);
    add("rail_post", L.post);
    return out;
  }, [gltf]);
  useEffect(() => () => parts.forEach((p) => p.geo.dispose()), [parts]);
  const refs = useRef<(THREE.InstancedMesh | null)[]>([]);
  useEffect(() => {
    const m = new THREE.Matrix4();
    const q = new THREE.Quaternion();
    const s = new THREE.Vector3(1, 1, 1);
    parts.forEach((p, i) => {
      const im = refs.current[i];
      if (!im) return;
      p.list.forEach((pl, k) => im.setMatrixAt(k, m.compose(pl.pos, q.setFromAxisAngle(new THREE.Vector3(0, 1, 0), pl.rotY), s)));
      im.instanceMatrix.needsUpdate = true;
      im.computeBoundingSphere();
    });
  }, [parts]);
  return (
    <group>
      {parts.map((p, i) => (
        <instancedMesh key={i} ref={(el) => void (refs.current[i] = el)} args={[p.geo, p.mat, p.list.length]} />
      ))}
    </group>
  );
}
