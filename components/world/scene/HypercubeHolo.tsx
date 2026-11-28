"use client";
/**
 * Siêu khối có tay cầm trên sàn chính phòng Siêu khối (phương vị 135°, lib/world/hypercube.ts): ảnh nổi siêu khối 4D
 * (32 cạnh, 16 đỉnh) quay trong MỘT mặt phẳng; F ở máy chiếu đổi mặt phẳng xy → xz → yz → xw → yw → zw.
 * Ba mặt chứa w làm điều "bất khả" với mắt 3D: khối trong lộn dần ra thành khối ngoài. Cạnh tô theo w (lam = gần, hồng = xa).
 * Máy chiếu: Blender `props/hypercube_projector.glb`; ảnh nổi là hiệu ứng (instanced).
 */
import { useEffect, useMemo, useState } from "react";
import { useFrame } from "@react-three/fiber";
import { useGLTF } from "@react-three/drei";
import * as THREE from "three";
import { worldAsset } from "@/lib/world/avatars";
import { EDGES, HC, PLANES, VERTS, project, rotate, type V4 } from "@/lib/world/hypercube";
import { sfx } from "@/lib/world/sfx";
import { registerAction } from "../actions";
import { useWorld } from "../store";
import { Label3D } from "../ui/Labels";
import { useRoomProps } from "./roomProps";

const GLB = worldAsset("props/hypercube_projector.glb");
useGLTF.preload(GLB);
const HS = { plane: 3, ang: 0 };
const NEAR = new THREE.Color("#6fe6ff");
const TMP = new THREE.Vector3();
const FAR = new THREE.Color("#ff6fd0");

export function HypercubeHolo() {
  const props = useRoomProps(GLB);
  const vi = useWorld((s) => s.lang === "vi");
  const [plane, setPlane] = useState(HS.plane);
  const proj = useMemo(() => props.clone("hc_projector"), [props]);
  const fx = useMemo(() => {
    const edgeGeo = new THREE.CylinderGeometry(1, 1, 1, 6, 1, true).rotateX(Math.PI / 2);
    const edgeMat = new THREE.MeshBasicMaterial({ toneMapped: false, transparent: true, opacity: 0.9, blending: THREE.AdditiveBlending, depthWrite: false });
    const edges = new THREE.InstancedMesh(edgeGeo, edgeMat, EDGES.length);
    const nodeGeo = new THREE.SphereGeometry(1, 8, 6);
    const nodeMat = new THREE.MeshBasicMaterial({ color: new THREE.Color("#ffe6a0").multiplyScalar(2), toneMapped: false });
    const nodes = new THREE.InstancedMesh(nodeGeo, nodeMat, VERTS.length);
    edges.frustumCulled = false;
    nodes.frustumCulled = false;
    for (let i = 0; i < EDGES.length; i++) edges.setColorAt(i, NEAR);
    return { edges, nodes };
  }, []);
  useEffect(
    () => () => {
      for (const m of [fx.edges, fx.nodes]) {
        m.geometry.dispose();
        (m.material as THREE.Material).dispose();
        m.dispose();
      }
    },
    [fx],
  );
  useEffect(
    () =>
      registerAction("hypercube-plane", () => {
        HS.plane = (HS.plane + 1) % PLANES.length;
        HS.ang = 0;
        setPlane(HS.plane);
        sfx.chime(PLANES[HS.plane].w ? 3 : 1);
      }),
    [],
  );
  const o = useMemo(() => new THREE.Object3D(), []);
  const P = useMemo(() => VERTS.map(() => new THREE.Vector3()), []);
  const W = useMemo(() => new Float32Array(VERTS.length), []);
  const c = useMemo(() => new THREE.Color(), []);
  useFrame((_, dt) => {
    HS.ang += dt * 0.6;
    const pl = PLANES[HS.plane];
    const t = performance.now() / 1000;
    VERTS.forEach((v, i) => {
      // nghiêng nhẹ trong mặt xz để luôn thấy chiều sâu, rồi quay trong mặt đang chọn
      let r: V4 = rotate(v, PLANES[1], 0.45);
      r = rotate(r, PLANES[2], 0.3);
      r = rotate(r, pl, HS.ang);
      const [x, y, z] = project(r);
      P[i].set(x * HC.size, y * HC.size, z * HC.size);
      W[i] = r[3];
      o.position.copy(P[i]);
      o.quaternion.identity();
      const s = 0.035 + 0.02 * (r[3] + 1);
      o.scale.set(s, s, s);
      o.updateMatrix();
      fx.nodes.setMatrixAt(i, o.matrix);
    });
    EDGES.forEach(([a, b], i) => {
      const len = P[a].distanceTo(P[b]);
      o.position.copy(P[a]).add(P[b]).multiplyScalar(0.5);
      o.lookAt(TMP.copy(o.position).add(P[b]).sub(P[a]));
      const w = 0.012 + 0.006 * ((W[a] + W[b]) / 2 + 1);
      o.scale.set(w, w, len);
      o.updateMatrix();
      fx.edges.setMatrixAt(i, o.matrix);
      fx.edges.setColorAt(i, c.copy(NEAR).lerp(FAR, ((W[a] + W[b]) / 2 + 1) / 2).multiplyScalar(1.8 + 0.3 * Math.sin(t * 2 + i)));
    });
    fx.nodes.instanceMatrix.needsUpdate = true;
    fx.edges.instanceMatrix.needsUpdate = true;
    if (fx.edges.instanceColor) fx.edges.instanceColor.needsUpdate = true;
  });
  const b = (HC.bearing * Math.PI) / 180;
  const pl = PLANES[plane];
  return (
    <group position={[Math.sin(b) * HC.r, 0, -Math.cos(b) * HC.r]}>
      <primitive object={proj} />
      <group position={[0, HC.y, 0]}>
        <primitive object={fx.edges} />
        <primitive object={fx.nodes} />
      </group>
      <Label3D
        text={
          vi
            ? `Siêu khối · quay trong mặt ${pl.id}${pl.w ? " — mặt chứa w: khối trong lộn ra ngoài (bất khả trong 3D)" : ""} · F đổi mặt`
            : `Tesseract · rotating in the ${pl.id} plane${pl.w ? " — a w-plane: the inner cube turns inside-out" : ""} · F to change`
        }
        position={[0, 3.25, 0]}
        variant="small"
        maxDist={14}
      />
    </group>
  );
}
