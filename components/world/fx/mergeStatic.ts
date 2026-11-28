/**
 * Gộp mesh TĨNH của một cây con để bớt lệnh vẽ (CPU): các mesh cùng vật liệu + cùng bộ thuộc tính đỉnh + cùng layer +
 * cùng renderOrder + cùng ô lưới `cell` m → một mesh. Chia theo ô để frustum culling và các phép dò tia theo khối bao
 * (ống nhòm) vẫn hoạt động theo cụm. Bỏ qua: mesh nằm dưới đối tượng trong `keep` (đang chuyển động / được tra theo tên),
 * mesh bị ẩn (kể cả do tổ tiên ẩn), mesh nhiều vật liệu, InstancedMesh / SkinnedMesh.
 * Trả về số lệnh vẽ đã bớt.
 */
import * as THREE from "three";
import { mergeGeometries } from "three/examples/jsm/utils/BufferGeometryUtils.js";

export function mergeStatic(root: THREE.Object3D, keep: THREE.Object3D[], cell = 30): number {
  root.updateMatrixWorld(true);
  const keepSet = new Set(keep);
  const rootInv = root.matrixWorld.clone().invert();
  const groups = new Map<string, THREE.Mesh[]>();
  const box = new THREE.Box3();
  const c = new THREE.Vector3();
  root.traverse((o) => {
    const m = o as THREE.Mesh;
    if (!m.isMesh || (m as unknown as THREE.InstancedMesh).isInstancedMesh || (m as unknown as THREE.SkinnedMesh).isSkinnedMesh) return;
    if (Array.isArray(m.material) || m.morphTargetInfluences) return;
    for (let a: THREE.Object3D | null = m; a; a = a.parent) {
      if (keepSet.has(a) || !a.visible) return;
      if (a === root) break;
    }
    const g = m.geometry as THREE.BufferGeometry;
    const attrs = Object.keys(g.attributes).sort().join(",");
    box.setFromObject(m).getCenter(c);
    const key = `${m.material.uuid}|${attrs}|${g.index ? "i" : "n"}|${m.layers.mask}|${m.renderOrder}|${Math.floor(c.x / cell)},${Math.floor(c.z / cell)}`;
    const list = groups.get(key);
    if (list) list.push(m);
    else groups.set(key, [m]);
  });
  let saved = 0;
  const M = new THREE.Matrix4();
  for (const list of groups.values()) {
    if (list.length < 2) continue;
    const geos = list.map((m) => m.geometry.clone().applyMatrix4(M.multiplyMatrices(rootInv, m.matrixWorld)));
    const merged = mergeGeometries(geos, false);
    geos.forEach((g) => g.dispose());
    if (!merged) continue;
    merged.computeBoundingSphere();
    const first = list[0];
    const mesh = new THREE.Mesh(merged, first.material);
    mesh.name = `merged:${first.name}`;
    mesh.layers.mask = first.layers.mask;
    mesh.renderOrder = first.renderOrder;
    mesh.frustumCulled = first.frustumCulled;
    for (const m of list) m.parent?.remove(m);
    root.add(mesh);
    saved += list.length - 1;
  }
  return saved;
}
