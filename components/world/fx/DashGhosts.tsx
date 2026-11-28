"use client";
/**
 * V1 — bóng mờ khi lướt (dash afterimage, VFX_PIPELINE "Dash afterimage"): trong lúc lướt / né, mỗi 60 ms để lại
 * một "bóng" của nhân vật đông cứng ở tư thế khung đó, sáng viền (fresnel) màu vũ khí, mờ dần trong ~220 ms.
 * Cách làm rẻ: mỗi bóng = các SkinnedMesh DÙNG CHUNG hình học với avatar, gắn một Skeleton riêng có ma trận xương
 * được CHÉP một lần lúc sinh (update() bị vô hiệu) → không nhân bản model, không cập nhật xương mỗi khung.
 * Số bóng theo mức hiệu ứng (GHOST_CAP: thấp 0 · vừa 2 · cao 4). Nguồn: CAM.self (Player đăng ký nhóm nhân vật).
 */
import { useEffect, useMemo } from "react";
import { useFrame } from "@react-three/fiber";
import * as THREE from "three";
import { CAM, curWeapon, motion } from "../combat/combat";
import { useGfx } from "../gfx";
import { GHOST_CAP } from "@/lib/world/vfxBudget";

const POOL = 4;
const LIFE = 220;
const EVERY = 60;
const INV = new THREE.Matrix4();

type Ghost = { root: THREE.Group; meshes: THREE.SkinnedMesh[]; born: number; mat: THREE.MeshBasicMaterial };

function ghostMaterial(): THREE.MeshBasicMaterial {
  const m = new THREE.MeshBasicMaterial({ color: "#9fe6ff", transparent: true, opacity: 0.6, depthWrite: false, blending: THREE.AdditiveBlending, toneMapped: false });
  m.onBeforeCompile = (sh) => {
    sh.vertexShader = sh.vertexShader
      .replace("#include <common>", "#include <common>\nvarying float vRim;")
      .replace(
        "#include <project_vertex>",
        `#include <project_vertex>
        #ifdef USE_SKINNING
          vRim = 1.0 - abs(dot(normalize(transformedNormal), normalize(-mvPosition.xyz)));
        #else
          vRim = 0.6;
        #endif`,
      );
    sh.fragmentShader = sh.fragmentShader
      .replace("#include <common>", "#include <common>\nvarying float vRim;")
      .replace("vec4 diffuseColor = vec4( diffuse, opacity );", "vec4 diffuseColor = vec4( diffuse * (0.25 + 2.2 * vRim * vRim), opacity * (0.18 + 0.82 * vRim) );");
  };
  return m;
}

export function DashGhosts() {
  const st = useMemo(() => ({ src: null as THREE.Object3D | null, skinned: [] as THREE.SkinnedMesh[], ghosts: [] as Ghost[], last: 0, next: 0 }), []);
  const group = useMemo(() => new THREE.Group(), []);
  useEffect(
    () => () => {
      for (const g of st.ghosts) {
        g.mat.dispose();
        for (const m of g.meshes) m.skeleton.dispose();
      }
      st.ghosts.length = 0;
    },
    [st],
  );

  useFrame(() => {
    const now = performance.now();
    const cap = Math.min(POOL, GHOST_CAP[useGfx.getState().vfx] ?? 0);
    // tàn dần các bóng đang có
    for (const g of st.ghosts) {
      if (!g.root.visible) continue;
      const k = (now - g.born) / LIFE;
      if (k >= 1) g.root.visible = false;
      else g.mat.opacity = 0.62 * (1 - k) * (1 - k);
    }
    const self = CAM.self;
    if (!cap || !self || CAM.hideSelf) return;
    const dashing = now < motion.dashUntil;
    if (!dashing || now < st.next) return;
    st.next = now + EVERY;
    // (lần đầu / đổi avatar) gom các SkinnedMesh của nhân vật
    if (st.src !== self || !st.skinned.length || !st.skinned[0].parent) {
      st.src = self;
      st.skinned = [];
      self.traverse((o) => {
        const s = o as THREE.SkinnedMesh;
        if (s.isSkinnedMesh && s.visible) st.skinned.push(s);
      });
      for (const g of st.ghosts) {
        group.remove(g.root);
        g.mat.dispose();
        for (const m of g.meshes) m.skeleton.dispose();
      }
      st.ghosts.length = 0;
    }
    if (!st.skinned.length) return;
    // lấy bóng rảnh (hoặc bóng cũ nhất) trong giới hạn
    let g = st.ghosts.find((q) => !q.root.visible);
    if (!g && st.ghosts.length < cap) {
      const mat = ghostMaterial();
      const root = new THREE.Group();
      const meshes = st.skinned.map((src) => {
        const sk = new THREE.Skeleton(src.skeleton.bones, src.skeleton.boneInverses);
        sk.update = () => {};
        const m = new THREE.SkinnedMesh(src.geometry, mat);
        m.skeleton = sk;
        m.bindMode = src.bindMode;
        m.bindMatrix.copy(src.bindMatrix);
        m.bindMatrixInverse.copy(src.bindMatrixInverse);
        m.matrixAutoUpdate = false;
        m.frustumCulled = false;
        root.add(m);
        return m;
      });
      g = { root, meshes, born: 0, mat };
      st.ghosts.push(g);
      group.add(root);
    }
    if (!g) g = st.ghosts.reduce((a, b) => (a.born < b.born ? a : b));
    // chép tư thế khung này: ma trận xương + vị trí thế giới của từng mảnh
    g.meshes.forEach((m, i) => {
      const src = st.skinned[i];
      if (!src) return;
      // (renderer nới mảng xương thành cỡ texture ở lần vẽ đầu → chỉ chép phần chung)
      const dst = m.skeleton.boneMatrices!;
      const from = src.skeleton.boneMatrices!;
      dst.set(from.length > dst.length ? from.subarray(0, dst.length) : from);
      if (m.skeleton.boneTexture) m.skeleton.boneTexture.needsUpdate = true;
      m.matrix.copy(INV.copy(group.matrixWorld).invert()).multiply(src.matrixWorld);
      m.matrixWorldNeedsUpdate = true;
    });
    g.mat.color.set(curWeapon().color).multiplyScalar(1.3);
    g.mat.opacity = 0.62;
    g.born = now;
    g.root.visible = true;
  });
  return <primitive object={group} />;
}
