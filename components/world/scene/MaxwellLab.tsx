"use client";
/**
 * Phòng thí nghiệm Quỷ Maxwell — góc tây nam sân Sảnh Bất Khả.
 * Blender (`props/maxwell.glb`, AO nướng, toon): bệ tròn, bàn đồng, hộp khí kính chia đôi có cửa sập (xoay quanh bản lề),
 * nhiệt kế (cột chất lỏng co giãn theo nhiệt độ), đồng hồ áp suất (kim quay theo n·T), bảng phấn, và chú quỷ mũ chóp.
 * Khí: 140 phân tử (lib/world/maxwell, va đàn hồi), tô màu theo tốc độ (xanh chậm → đỏ nhanh), chạy nhanh gấp 2.
 * Chế độ: quỷ tự động · bạn làm quỷ (giữ để mở cửa) · cửa luôn mở · cửa đóng.
 */
import { useEffect, useMemo, useRef } from "react";
import { useFrame } from "@react-three/fiber";
import { useGLTF } from "@react-three/drei";
import * as THREE from "three";
import { create } from "zustand";
import { worldAsset } from "@/lib/world/avatars";
import { BOX, chambers, closedPolicy, createGas, demonPolicy, gasEntropy, openPolicy, speedHeat, stepGas, type Gas } from "@/lib/world/maxwell";
import { toonize } from "../fx/glbToon";
import { useWorld } from "../store";
import { Label3D } from "../ui/Labels";
import { shown } from "./shown";

const GLB = worldAsset("props/maxwell.glb");
useGLTF.preload(GLB);

export const LAB = { x: -13, z: 14.5 };
/** Lab quay mặt về phía đông (tâm sân) — tượng Penrose ở phía bắc sẽ che máy quay nếu nhìn từ đó */
const LAB_ROT = -Math.PI / 2;
/** Chỗ đứng xem (phía đông bệ, nhìn về −x) */
export const LAB_VIEW = { x: LAB.x + 3.95, z: LAB.z };
const BOX_Y = 1.21; // đáy hộp khí (game y)
const TIME_SCALE = 2;

export type MxMode = "auto" | "manual" | "open" | "closed";
type MxStats = { tL: number; tR: number; nL: number; nR: number; bits: number; dS: number; erased: number; heat: number };
export const useMaxwell = create<{ mode: MxMode; held: boolean; stats: MxStats; seed: number }>(() => ({
  mode: "closed",
  held: false,
  stats: { tL: 1, tR: 1, nL: 70, nR: 70, bits: 0, dS: 0, erased: 0, heat: 0 },
  seed: 1867,
}));

/** Khí dùng chung (ngoài React: mô phỏng chạy trong useFrame, bảng đọc số liệu qua store) */
const SIM: { gas: Gas; s0: number } = (() => {
  const gas = createGas(140, 1867);
  return { gas, s0: gasEntropy(gas) };
})();
export function resetGas() {
  const seed = (useMaxwell.getState().seed * 7 + 13) % 100000;
  SIM.gas = createGas(140, seed);
  SIM.s0 = gasEntropy(SIM.gas);
  useMaxwell.setState({ seed, stats: { tL: 1, tR: 1, nL: 70, nR: 70, bits: 0, dS: 0, erased: 0, heat: 0 } });
}
/** Xoá trí nhớ của quỷ: mỗi bit toả ít nhất kT ln 2 nhiệt ra môi trường (Landauer) */
export function eraseMemory() {
  const s = useMaxwell.getState().stats;
  const bits = SIM.gas.bits;
  SIM.gas.bits = 0;
  useMaxwell.setState({ stats: { ...s, bits: 0, erased: s.erased + bits, heat: s.heat + bits * Math.LN2 } });
}

export function MaxwellLab() {
  const gltf = useGLTF(GLB);
  const { root, door, liqL, liqR, needleL, needleR, demon, glassMats } = useMemo(() => {
    const root = toonize(gltf.scene);
    const glassMats: THREE.Material[] = [];
    root.traverse((o) => {
      const m = o as THREE.Mesh;
      if (!m.isMesh || !m.name.startsWith("mx_glass")) return;
      // kính: viền fresnel xanh nhạt, trong suốt ở giữa (thấy rõ phân tử)
      const mat = new THREE.ShaderMaterial({
        vertexShader: "varying vec3 vN; varying vec3 vV; void main(){ vec4 mv = modelViewMatrix * vec4(position,1.0); vN = normalize(normalMatrix * normal); vV = normalize(-mv.xyz); gl_Position = projectionMatrix * mv; }",
        fragmentShader: "varying vec3 vN; varying vec3 vV; void main(){ float f = pow(1.0 - abs(dot(normalize(vN), normalize(vV))), 2.2); gl_FragColor = vec4(mix(vec3(0.75,0.92,1.0), vec3(1.0), f), 0.06 + 0.4 * f); }",
        transparent: true,
        depthWrite: false,
        side: THREE.DoubleSide,
      });
      m.material = mat;
      m.renderOrder = 6;
      glassMats.push(mat);
    });
    const by = (n: string) => root.getObjectByName(n) ?? null;
    const demon = new THREE.Group();
    return {
      root,
      door: by("mx_door"),
      liqL: by("mx_liquid_L"),
      liqR: by("mx_liquid_R"),
      needleL: by("mx_needle_L"),
      needleR: by("mx_needle_R"),
      demon: Object.assign(demon, { userData: { parts: ["mx_demon_body", "mx_demon_horns", "mx_demon_wings", "mx_demon_tail", "mx_demon_hat", "mx_demon_face"].map(by).filter(Boolean) as THREE.Object3D[] } }),
      glassMats,
    };
  }, [gltf]);
  useEffect(() => () => glassMats.forEach((m) => m.dispose()), [glassMats]);

  // Phân tử khí (cầu phát sáng, màu theo tốc độ)
  const N = SIM.gas.n;
  const mol = useMemo(() => ({ geo: new THREE.SphereGeometry(BOX.r, 10, 8), mat: new THREE.MeshBasicMaterial({ toneMapped: false }) }), []);
  useEffect(() => () => [mol.geo, mol.mat].forEach((x) => x.dispose()), [mol]);
  const molRef = useRef<THREE.InstancedMesh>(null);
  const tmp = useMemo(() => ({ m: new THREE.Matrix4(), c: new THREE.Color(), cold: new THREE.Color("#4aa8ff").multiplyScalar(1.8), mid: new THREE.Color("#ffffff").multiplyScalar(1.4), hot: new THREE.Color("#ff4a3a").multiplyScalar(2.0) }), []);
  const doorAng = useRef(0);
  const statTick = useRef(0);
  const liqCol = useMemo(() => ({ cold: new THREE.Color("#4aa8ff"), warm: new THREE.Color("#f4f0e8"), hot: new THREE.Color("#ff5a4a"), t: new THREE.Color() }), []);
  const rootRef = useRef<THREE.Group>(null);
  /** khí lần cuối đã tải lên GPU (đổi khi đặt lại) + số liệu buồng tương ứng — khí đứng yên thì khỏi tải lại 140 phân tử */
  const drawn = useRef<{ gas: Gas | null; c: ReturnType<typeof chambers> | null }>({ gas: null, c: null });
  useFrame((st, dtRaw) => {
    // nhánh bị ẩn (người chơi trong đại sảnh của bốt): không mô phỏng, không cập nhật hình
    if (!shown(rootRef.current)) {
      drawn.current.gas = null;
      return;
    }
    const dt = Math.min(dtRaw, 1 / 30);
    const s = useMaxwell.getState();
    const p = useWorld.getState().player;
    const near = Math.hypot(p.x - LAB.x, p.z - LAB.z) < 30;
    const g = SIM.gas;
    let doorOpen = false;
    if (near) {
      const policy = s.mode === "auto" ? demonPolicy : s.mode === "open" ? openPolicy : s.mode === "manual" ? (s.held ? openPolicy : closedPolicy) : null;
      // chế độ người chơi: người chơi không "đo" phân tử → không tính bit của quỷ
      const h = (dt * TIME_SCALE) / 2;
      const before = g.passed;
      stepGas(g, h, policy, s.mode === "auto");
      stepGas(g, h, policy, s.mode === "auto");
      doorOpen = s.mode === "open" || (s.mode === "manual" && s.held) || (s.mode === "auto" && g.passed !== before);
    }
    // cửa sập: mở nhanh, khép chậm (ở chế độ tự động, quỷ bật cửa trong chớp mắt khi có phân tử được cho qua)
    const target = doorOpen || s.mode === "open" ? 1.2 : 0;
    doorAng.current += (target - doorAng.current) * Math.min(1, dt * (target > doorAng.current ? 30 : 6));
    if (door) door.rotation.z = doorAng.current;
    // phân tử: mô phỏng ngăn trái (x < 0) hiện bên TRÁI khán giả = +x game
    // chỉ tải lại khi khí đổi: đang mô phỏng (gần), vừa hiện lại, hoặc vừa đặt lại khí
    const fresh = near || drawn.current.gas !== g || !drawn.current.c;
    const im = molRef.current;
    if (im && fresh) {
      for (let i = 0; i < N; i++) {
        tmp.m.makeTranslation(-g.px[i], BOX_Y + g.py[i], g.pz[i]); // toạ độ cục bộ của lab
        im.setMatrixAt(i, tmp.m);
        const hv = speedHeat(Math.hypot(g.vx[i], g.vy[i], g.vz[i]));
        if (hv < 0.5) tmp.c.copy(tmp.cold).lerp(tmp.mid, hv * 2);
        else tmp.c.copy(tmp.mid).lerp(tmp.hot, (hv - 0.5) * 2);
        im.setColorAt(i, tmp.c);
      }
      im.instanceMatrix.needsUpdate = true;
      if (im.instanceColor) im.instanceColor.needsUpdate = true;
    }
    // nhiệt kế / áp kế / số liệu (5 lần mỗi giây)
    const c = fresh ? chambers(g) : drawn.current.c!;
    drawn.current.gas = g;
    drawn.current.c = c;
    const liq = (o: THREE.Object3D | null, t: number) => {
      if (!o) return;
      const k = THREE.MathUtils.clamp(0.35 + 0.42 * t, 0.15, 1.05);
      o.scale.y += (k - o.scale.y) * Math.min(1, dt * 3);
      const m = (o as THREE.Mesh).material as THREE.MeshToonMaterial | undefined;
      if (m?.color) m.color.copy(t < 1 ? liqCol.t.copy(liqCol.cold).lerp(liqCol.warm, Math.max(0, t - 0.4) / 0.6) : liqCol.t.copy(liqCol.warm).lerp(liqCol.hot, Math.min(1, t - 1)));
    };
    liq(liqL, c.tL);
    liq(liqR, c.tR);
    const needle = (o: THREE.Object3D | null, n: number, t: number) => {
      if (!o) return;
      const pr = (n * t) / 70; // áp suất tương đối (1 = ban đầu)
      const a = THREE.MathUtils.clamp((pr - 1) * 2.2, -2.3, 2.3);
      o.rotation.z += (-a - o.rotation.z) * Math.min(1, dt * 4);
    };
    needle(needleL, c.nL, c.tL);
    needle(needleR, c.nR, c.tR);
    // quỷ nhún nhảy; hào hứng hơn khi đang phân loại
    const bob = Math.sin(st.clock.elapsedTime * (s.mode === "auto" ? 7 : 2.2)) * (s.mode === "auto" ? 0.02 : 0.008);
    (demon.userData.parts as THREE.Object3D[]).forEach((o) => (o.position.y = bob));
    if ((statTick.current += dt) > 0.2 && fresh) {
      statTick.current = 0;
      const prev = s.stats;
      useMaxwell.setState({ stats: { ...prev, tL: c.tL, tR: c.tR, nL: c.nL, nR: c.nR, bits: g.bits, dS: gasEntropy(g) - SIM.s0 } });
    }
  });
  return (
    <group ref={rootRef} position={[LAB.x, 0, LAB.z]} rotation-y={LAB_ROT}>
      <primitive object={root} />
      <instancedMesh ref={molRef} args={[mol.geo, mol.mat, N]} frustumCulled={false} />
      <Label3D text="Quỷ Maxwell · Maxwell's Demon" position={[0, 4.25, 0.6]} variant="name" />
    </group>
  );
}

export const maxwellBlocked = (x: number, z: number) => Math.hypot(x - LAB.x, z - LAB.z) < 3.55;
export const nearDemon = (x: number, z: number) => Math.hypot(x - LAB.x, z - LAB.z) < 5.2;
