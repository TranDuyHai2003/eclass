"use client";
/**
 * Cửa hầm thép SCP đứng trơ trọi ở mép đông sân Thế giới Bất Khả — lối vào Thư khố bỏ hoang.
 * Dùng chính mô-đun cửa của Thư khố (archive.glb, vật liệu PBR Poly Haven), chiếu sáng bằng đèn của sân (không lightmap).
 * Tải GLB ở đây cũng làm nóng bộ đệm trước khi vào Thư khố.
 */
import { useEffect, useMemo } from "react";
import { useGLTF, useTexture } from "@react-three/drei";
import * as THREE from "three";
import { worldAsset } from "@/lib/world/avatars";
import { GATE } from "@/lib/world/archiveLayout";
import { ARCHIVE_MATS } from "./archiveMats";
import { Label3D } from "../../ui/Labels";
import { useT } from "../../store";

const FILES = ["bk_concrete", "bk_door", "bk_steel"].flatMap((k) => {
  const m = ARCHIVE_MATS[k];
  return [m.map, m.normalMap, m.roughnessMap].filter(Boolean) as string[];
});

export function ArchiveDoor() {
  const t = useT();
  const gltf = useGLTF(worldAsset("archive/archive.glb"));
  const texs = useTexture(FILES.map((f) => worldAsset("archive/tex/" + f)));
  const meshes = useMemo(() => {
    const tex: Record<string, THREE.Texture> = {};
    FILES.forEach((f, i) => {
      const x = texs[i];
      x.flipY = false;
      x.wrapS = x.wrapT = THREE.RepeatWrapping;
      x.colorSpace = f.endsWith("_d.webp") ? THREE.SRGBColorSpace : THREE.NoColorSpace;
      x.needsUpdate = true;
      tex[f] = x;
    });
    const out: THREE.Mesh[] = [];
    gltf.scene.getObjectByName("m_door")?.traverse((o) => {
      const me = o as THREE.Mesh;
      if (!me.isMesh) return;
      const name = (me.material as THREE.Material).name;
      const d = ARCHIVE_MATS[name] ?? {};
      const m = new THREE.MeshStandardMaterial({
        name: `gate_${name}`,
        color: new THREE.Color().setRGB(...(d.color ?? [1, 1, 1]), THREE.LinearSRGBColorSpace),
        // ngoài sân không có cubemap hành lang → kim loại sơn: bớt kim loại để vẫn nhận ánh nắng
        metalness: Math.min(0.55, d.metal ?? 0),
        roughness: d.rough ?? 0.8,
      });
      if (d.map) m.map = tex[d.map] ?? null;
      if (d.normalMap) m.normalMap = tex[d.normalMap] ?? null;
      if (d.roughnessMap) m.roughnessMap = tex[d.roughnessMap] ?? null;
      if (d.emissive) {
        m.emissive.setRGB(...d.emissive, THREE.LinearSRGBColorSpace);
        m.emissiveIntensity = (d.emissiveIntensity ?? 1) * 0.5;
      }
      const mesh = new THREE.Mesh(me.geometry, m);
      mesh.userData.noReal = true;
      out.push(mesh);
    });
    return out;
  }, [gltf, texs]);
  useEffect(() => () => meshes.forEach((m) => (m.material as THREE.Material).dispose()), [meshes]);
  return (
    <group position={[GATE.x, 0, GATE.z]} rotation={[0, -Math.PI / 2, 0]}>
      {/* mô-đun: khung ở z ∈ [−2,2; −1,6] (cạnh −z của ô) → dời về tâm */}
      <group position={[0, 0, 1.9]}>
        {meshes.map((m, i) => (
          <primitive key={i} object={m} />
        ))}
      </group>
      <Label3D text={t("archiveName")} position={[0, 4.0, 0]} />
    </group>
  );
}
