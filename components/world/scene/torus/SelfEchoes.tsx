"use client";
/**
 * "Nhìn xa thấy chính mình": vẽ nhân vật của bạn ở 8 ô lân cận (±L) — CÙNG một bộ xương, cùng hình học, cùng vật liệu,
 * cùng biểu cảm với nhân vật thật (không nhân bản model, không chạy hoạt ảnh thêm).
 *
 * Cách làm: SkinnedMesh bản sao dùng chung `skeleton` của avatar. three tính đỉnh = M_mesh · B⁻¹ · Σ(xương) · B · p;
 * avatar thật (bind "attached") có B⁻¹ = M_mesh⁻¹ nên đỉnh = Σ(xương)·B·p (toạ độ thế giới). Bản sao đặt B⁻¹ = I và
 * M_mesh = tịnh tiến (iL, 0, jL) → đỉnh = T · (đỉnh thật): đúng tư thế, dời đúng một ô.
 * Chỉ vẽ bản sao nằm trong khung nhìn (tự cull hình cầu) — thường 1–3 bản. Trên đầu mỗi bản sao có viên kim cương nhỏ
 * sáng dần theo khoảng cách để nhận ra "đó là mình" giữa biển mây (nhấp nháy khi đang giương cung).
 */
import { useEffect, useMemo } from "react";
import { useFrame, useThree } from "@react-three/fiber";
import * as THREE from "three";
import { CAM, useCombat } from "../../combat/combat";
import { useWorld } from "../../store";
import { tiles } from "@/lib/world/torus";

const SPHERE = new THREE.Sphere();
const FRUSTUM = new THREE.Frustum();
const PV = new THREE.Matrix4();
const M = new THREE.Matrix4();
const Q = new THREE.Quaternion();
const S = new THREE.Vector3();
const P = new THREE.Vector3();

function noop() {}
/** vật liệu viền MToon (lượt vẽ thứ hai) — bản sao ở xa ≥ 48 m không cần viền: thay bằng vật liệu ẩn (three bỏ qua nhóm đó) */
const HIDDEN = new THREE.MeshBasicMaterial({ visible: false });
function echoMaterial(m: THREE.Material | THREE.Material[]): THREE.Material | THREE.Material[] {
  if (!Array.isArray(m)) return m;
  return m.map((x) => (/outline/i.test(x.name) || (x as { isOutline?: boolean }).isOutline ? HIDDEN : x));
}

/** SkinnedMesh bản sao: B⁻¹ luôn = I (đè updateMatrixWorld của SkinnedMesh) */
function echoMesh(src: THREE.SkinnedMesh): THREE.SkinnedMesh {
  const m = new THREE.SkinnedMesh(src.geometry, echoMaterial(src.material));
  m.skeleton = src.skeleton;
  m.bindMatrix.copy(src.bindMatrix);
  m.bindMatrixInverse.identity();
  m.morphTargetInfluences = src.morphTargetInfluences;
  m.morphTargetDictionary = src.morphTargetDictionary;
  m.frustumCulled = false;
  m.matrixAutoUpdate = false;
  m.raycast = noop;
  m.renderOrder = src.renderOrder;
  m.updateMatrixWorld = function (force?: boolean) {
    THREE.Object3D.prototype.updateMatrixWorld.call(this, force);
    this.bindMatrixInverse.identity();
  };
  return m;
}

export function SelfEchoes({ L, ring = 1 }: { L: number; ring?: number }) {
  const { camera } = useThree();
  const offsets = useMemo(() => tiles(ring).slice(1), [ring]);
  const st = useMemo(() => ({ src: null as THREE.Object3D | null, meshes: [] as THREE.SkinnedMesh[], roots: [] as THREE.Group[] }), []);
  const group = useMemo(() => new THREE.Group(), []);
  const beaconMat = useMemo(() => new THREE.MeshBasicMaterial({ color: new THREE.Color("#ffd27a").multiplyScalar(2.2), toneMapped: false, fog: false }), []);
  const beaconGeo = useMemo(() => new THREE.OctahedronGeometry(1, 0), []);
  const beacons = useMemo(() => {
    const im = new THREE.InstancedMesh(beaconGeo, beaconMat, 24);
    im.frustumCulled = false;
    im.count = 0;
    return im;
  }, [beaconGeo, beaconMat]);
  useEffect(
    () => () => {
      beaconMat.dispose();
      beaconGeo.dispose();
      beacons.dispose();
    },
    [beaconMat, beaconGeo, beacons],
  );

  useFrame(() => {
    const self = CAM.self;
    if (!self) return;
    // (lần đầu / đổi avatar / avatar tải xong) gom các SkinnedMesh của nhân vật, dựng lại bản sao
    const stale = st.src !== self || !st.meshes.length || st.meshes.some((m) => !m.parent);
    if (stale) {
      const meshes: THREE.SkinnedMesh[] = [];
      self.traverse((o) => {
        const s = o as THREE.SkinnedMesh;
        if (s.isSkinnedMesh) meshes.push(s);
      });
      const same = st.src === self && meshes.length === st.meshes.length && meshes.every((m, i) => m === st.meshes[i]);
      if (!same || !st.roots.length) {
        for (const r of st.roots) group.remove(r);
        st.roots = [];
        st.src = self;
        st.meshes = meshes;
        if (meshes.length)
          for (const [i, j] of offsets) {
            const root = new THREE.Group();
            root.position.set(i * L, 0, j * L);
            for (const m of meshes) root.add(echoMesh(m));
            root.visible = false;
            group.add(root);
            st.roots.push(root);
          }
      }
    }
    if (!st.roots.length) return;
    PV.multiplyMatrices(camera.projectionMatrix, camera.matrixWorldInverse);
    FRUSTUM.setFromProjectionMatrix(PV);
    const p = useWorld.getState().player;
    const aiming = useCombat.getState().aiming;
    const now = performance.now();
    let bi = 0;
    st.roots.forEach((root, k) => {
      const [i, j] = offsets[k];
      P.set(p.x + i * L, p.y + 0.9, p.z + j * L);
      SPHERE.set(P, 1.4);
      const vis = FRUSTUM.intersectsSphere(SPHERE);
      root.visible = vis;
      if (!vis) return;
      // từng mảnh theo trạng thái hiện của mảnh gốc (vd. ẩn vũ khí / tóc)
      root.children.forEach((c, n) => (c.visible = st.meshes[n]?.visible ?? false));
      const d = camera.position.distanceTo(P);
      if (d > 10 && bi < 24) {
        const s = (0.1 + d * 0.0045) * (aiming ? 1 + 0.35 * Math.sin(now / 120) : 1);
        Q.setFromAxisAngle(S.set(0, 1, 0), now / 600);
        M.compose(P.set(p.x + i * L, p.y + 2.35 + d * 0.006, p.z + j * L), Q, S.set(s * 0.7, s, s * 0.7));
        beacons.setMatrixAt(bi++, M);
      }
    });
    beacons.count = bi;
    beacons.instanceMatrix.needsUpdate = true;
  });

  return (
    <>
      <primitive object={group} />
      <primitive object={beacons} />
    </>
  );
}
