"use client";
/**
 * Hình ảnh của Giáo Sin + Khiên Con lắc (gắn trong CombatFx):
 *  - dải sóng cho từng bó sóng: vẽ TỔNG y = Σ Aᵢ·sin θᵢ tại mỗi điểm → chỗ hai bó chồng lên thấy rõ cộng / triệt tiêu;
 *  - sóng xem trước khi đang giữ chuột (biên độ A lớn dần, chạy với ω), chấm ĐỈNH (xanh) / NÚT (đỏ nhạt) trên đất trước mặt;
 *  - nút / bụng của Sóng dừng;
 *  - xoay `pend_pivot` của khiên theo trọng lực (luôn treo thẳng xuống, lắc trong mặt phẳng trước – sau của nhân vật).
 */
import { useEffect, useMemo, useRef } from "react";
import { useFrame } from "@react-three/fiber";
import * as THREE from "three";
import { useWorld } from "../store";
import { HOLD_MS } from "@/lib/world/combo";
import * as SL from "@/lib/world/sineLance";
import { ENV, curWeapon, holdMs } from "./combat";
import { LANCE, PEND_RIGS, curLam, curLen, shieldAngle, tickWaveWeapons } from "./waveWeapons";

const RIB = 10; // số dải tối đa (9 bó + 1 xem trước)
const SEG = 64; // điểm mỗi dải
const VPR = SEG * 4; // đỉnh mỗi dải (2 dải chéo × 2 mép)

const VS = /* glsl */ `
attribute float aI; attribute float aU; attribute float aV; attribute vec3 aCol;
varying float vI; varying float vU; varying float vV; varying vec3 vCol;
void main(){ vI = aI; vU = aU; vV = aV; vCol = aCol; gl_Position = projectionMatrix * modelViewMatrix * vec4(position, 1.0); }`;
const FS = /* glsl */ `
varying float vI; varying float vU; varying float vV; varying vec3 vCol;
void main(){
  if (vI <= 0.001) discard;
  float x = vV * 2.0 - 1.0;
  float prof = 1.0 - x * x;
  float fade = smoothstep(0.0, 0.12, vU) * smoothstep(1.0, 0.85, vU);
  float core = smoothstep(0.6, 1.0, prof);
  vec3 c = mix(vCol * (0.8 + 1.8 * vI), vec3(2.4), core * vI * 0.7);
  float a = prof * fade * (0.35 + 0.65 * vI);
  if (a < 0.01) discard;
  gl_FragColor = vec4(c * a, 1.0);
}`;

const SRC_COL: Record<string, string> = { chain: "#7ad8ff", charged: "#c6f6ff", skill: "#ffe9a8" };
const Y_UP = new THREE.Vector3(0, 1, 0);
const X_AX = new THREE.Vector3(1, 0, 0);

export function WaveWeaponsFx() {
  const rib = useMemo(() => {
    const geo = new THREE.BufferGeometry();
    const pos = new Float32Array(RIB * VPR * 3);
    const aI = new Float32Array(RIB * VPR);
    const aU = new Float32Array(RIB * VPR);
    const aV = new Float32Array(RIB * VPR);
    const col = new Float32Array(RIB * VPR * 3);
    const idx: number[] = [];
    for (let r = 0; r < RIB; r++)
      for (let i = 0; i < SEG - 1; i++)
        for (const off of [0, 2]) {
          const a = r * VPR + i * 4 + off;
          const b = a + 4;
          idx.push(a, a + 1, b, a + 1, b + 1, b);
        }
    for (let k = 0; k < RIB * VPR; k++) aV[k] = k % 2;
    geo.setIndex(idx);
    geo.setAttribute("position", new THREE.BufferAttribute(pos, 3).setUsage(THREE.DynamicDrawUsage));
    geo.setAttribute("aI", new THREE.BufferAttribute(aI, 1).setUsage(THREE.DynamicDrawUsage));
    geo.setAttribute("aU", new THREE.BufferAttribute(aU, 1).setUsage(THREE.DynamicDrawUsage));
    geo.setAttribute("aV", new THREE.BufferAttribute(aV, 1));
    geo.setAttribute("aCol", new THREE.BufferAttribute(col, 3).setUsage(THREE.DynamicDrawUsage));
    const mat = new THREE.ShaderMaterial({ vertexShader: VS, fragmentShader: FS, transparent: true, depthWrite: false, side: THREE.DoubleSide, blending: THREE.AdditiveBlending, toneMapped: false });
    return { geo, mat, pos, aI, aU, col, c: new THREE.Color() };
  }, []);
  const dotMats = useMemo(
    () => ({
      crest: new THREE.MeshBasicMaterial({ color: new THREE.Color("#7ad8ff").multiplyScalar(2), transparent: true, opacity: 0.6, depthWrite: false, blending: THREE.AdditiveBlending, toneMapped: false }),
      node: new THREE.MeshBasicMaterial({ color: new THREE.Color("#ff7a9c").multiplyScalar(1.4), transparent: true, opacity: 0.35, depthWrite: false, blending: THREE.AdditiveBlending, toneMapped: false }),
      anti: new THREE.MeshBasicMaterial({ color: new THREE.Color("#ffd27a").multiplyScalar(2.2), transparent: true, opacity: 0.8, depthWrite: false, blending: THREE.AdditiveBlending, toneMapped: false }),
      still: new THREE.MeshBasicMaterial({ color: new THREE.Color("#ffffff").multiplyScalar(1.6), transparent: true, opacity: 0.7, depthWrite: false, blending: THREE.AdditiveBlending, toneMapped: false }),
    }),
    [],
  );
  const dotGeo = useMemo(() => new THREE.CircleGeometry(0.14, 20).rotateX(-Math.PI / 2), []);
  const ringGeo = useMemo(() => new THREE.RingGeometry(0.16, 0.22, 24).rotateX(-Math.PI / 2), []);
  useEffect(
    () => () => {
      rib.geo.dispose();
      rib.mat.dispose();
      Object.values(dotMats).forEach((m) => m.dispose());
      dotGeo.dispose();
      ringGeo.dispose();
    },
    [rib, dotMats, dotGeo, ringGeo],
  );
  const crests = useRef<THREE.InstancedMesh>(null);
  const nodes = useRef<THREE.InstancedMesh>(null);
  const antis = useRef<THREE.InstancedMesh>(null);
  const stills = useRef<THREE.InstancedMesh>(null);
  const M = useMemo(() => new THREE.Matrix4(), []);
  const S = useMemo(() => new THREE.Vector3(), []);
  const Q = useMemo(() => new THREE.Quaternion(), []);
  const QP = useMemo(() => new THREE.Quaternion(), []);
  const QX = useMemo(() => new THREE.Quaternion(), []);
  const SC = useMemo(() => new THREE.Vector3(), []);
  const P = useMemo(() => new THREE.Vector3(), []);

  useFrame(() => {
    tickWaveWeapons();
    const w = useWorld.getState();
    const now = performance.now();
    const t = now / 1000;
    const wid = ENV.armed ? curWeapon().id : "";

    // ── Khiên: treo theo trọng lực, lắc trong mặt phẳng trước – sau
    if (PEND_RIGS.size) {
      const th = shieldAngle(now);
      const L = curLen();
      Q.setFromAxisAngle(Y_UP, w.playerYaw);
      QX.setFromAxisAngle(X_AX, -th);
      Q.multiply(QX);
      for (const r of PEND_RIGS) {
        const parent = r.pivot.parent;
        if (!parent) continue;
        parent.getWorldQuaternion(QP);
        parent.getWorldScale(SC);
        r.pivot.quaternion.copy(QP.invert()).multiply(Q);
        const s = Math.max(1e-3, SC.y);
        if (r.chain) r.chain.scale.y = L / s;
        if (r.bob) r.bob.position.y = -L / s;
      }
    }

    // ── Dải sóng: mỗi bó vẽ TỔNG chồng chập dọc trục của nó
    const ps = LANCE.packets;
    let r = 0;
    const put = (k: number, x: number, y: number, z: number, px: number, pz: number, wd: number, inten: number, u: number) => {
      const base = r * VPR + k * 4;
      const o = base * 3;
      const p = rib.pos;
      p[o] = x + px * wd;
      p[o + 1] = y;
      p[o + 2] = z + pz * wd;
      p[o + 3] = x - px * wd;
      p[o + 4] = y;
      p[o + 5] = z - pz * wd;
      p[o + 6] = x;
      p[o + 7] = y + wd;
      p[o + 8] = z;
      p[o + 9] = x;
      p[o + 10] = y - wd;
      p[o + 11] = z;
      for (let j = 0; j < 4; j++) {
        rib.aI[base + j] = inten;
        rib.aU[base + j] = u;
        rib.col[(base + j) * 3] = rib.c.r;
        rib.col[(base + j) * 3 + 1] = rib.c.g;
        rib.col[(base + j) * 3 + 2] = rib.c.b;
      }
    };
    for (const q of ps) {
      if (r >= RIB - 1) break;
      const span = SL.packetSpan(q, t);
      if (!span) continue;
      rib.c.set(SRC_COL[q.src] ?? "#7ad8ff");
      const [a, b] = span;
      const front = q.v * (t - q.t0);
      const back = front - q.cycles * q.lam;
      for (let k = 0; k < SEG; k++) {
        const s = a + ((b - a) * k) / (SEG - 1);
        const x = q.ox + q.dx * s;
        const z = q.oz + q.dz * s;
        const sp = SL.superpose(ps, x, z, t);
        const g = ENV.ground(x, z) + 1.1;
        const inten = Math.min(1, Math.abs(sp.y) / Math.max(0.3, q.A));
        put(k, x, g + sp.y, z, q.dz, -q.dx, 0.045 + 0.03 * Math.min(2, sp.amp), inten, (s - back) / (front - back));
      }
      r++;
    }
    // sóng xem trước khi giữ chuột (Giáo Sin): A lớn dần theo thời gian giữ
    const held = wid === "lance" ? holdMs() : 0;
    if (held > 120) {
      const A = SL.chargeAmplitude(held, HOLD_MS);
      const lam = curLam();
      const k = (Math.PI * 2) / lam;
      const om = k * SL.WAVE_V;
      const fx = Math.sin(w.playerYaw);
      const fz = Math.cos(w.playerYaw);
      const p = w.player;
      rib.c.set(held >= HOLD_MS ? "#fff2b0" : "#bfe8ff");
      for (let j = 0; j < SEG; j++) {
        const s = 0.4 + (3.8 * j) / (SEG - 1);
        const y = A * Math.sin(k * s - om * t);
        put(j, p.x + fx * s, p.y + 1.15 + y, p.z + fz * s, fz, -fx, 0.04 + 0.03 * (A / SL.A_MAX), 0.3 + 0.7 * Math.abs(Math.sin(k * s - om * t)), j / (SEG - 1));
      }
      r++;
    }
    for (let k = r * VPR; k < RIB * VPR; k++) rib.aI[k] = 0;
    for (const n of ["position", "aI", "aU", "aCol"]) (rib.geo.getAttribute(n) as THREE.BufferAttribute).needsUpdate = true;
    rib.geo.computeBoundingSphere();

    // ── Chấm đỉnh / nút trên đất trước mặt (Giáo Sin)
    const cm = crests.current;
    const nm = nodes.current;
    if (cm && nm) {
      const show = wid === "lance";
      cm.visible = nm.visible = show;
      if (show) {
        const lam = curLam();
        const fx = Math.sin(w.playerYaw);
        const fz = Math.cos(w.playerYaw);
        const p = w.player;
        const hot = held > 0 || now - LANCE.thrustAt < 1200;
        dotMats.crest.opacity = hot ? 0.85 : 0.3;
        dotMats.node.opacity = hot ? 0.45 : 0.14;
        const cs = SL.crestPositions(lam, 4.2);
        for (let i = 0; i < 8; i++) {
          const s = cs[i];
          if (s === undefined) S.set(0, 0, 0);
          else S.set(1, 1, 1).multiplyScalar(1 + 0.15 * Math.sin(t * 6 + i));
          const x = p.x + fx * (s ?? 0);
          const z = p.z + fz * (s ?? 0);
          M.compose(P.set(x, ENV.ground(x, z) + 0.06, z), Q.identity(), S);
          cm.setMatrixAt(i, M);
          // nút ở s = n·λ/2 (n ≥ 1)
          const sn = ((i + 1) * lam) / 2;
          const xn = p.x + fx * sn;
          const zn = p.z + fz * sn;
          S.setScalar(sn <= 4.2 ? 0.6 : 0);
          M.compose(P.set(xn, ENV.ground(xn, zn) + 0.05, zn), Q.identity(), S);
          nm.setMatrixAt(i, M);
        }
        cm.instanceMatrix.needsUpdate = true;
        nm.instanceMatrix.needsUpdate = true;
      }
    }
    // ── Sóng dừng: nút đứng yên (vòng trắng) + bụng đập (đĩa vàng nhấp nháy theo |cos ωt|)
    const am = antis.current;
    const sm = stills.current;
    if (am && sm) {
      const st = LANCE.standing;
      am.visible = sm.visible = !!st;
      if (st) {
        const k = (Math.PI * 2) / st.lam;
        const om = k * SL.WAVE_V;
        const beat = Math.abs(Math.sin(k * st.D * 0.5 - om * (t - st.t0)));
        dotMats.anti.opacity = 0.3 + 0.7 * beat;
        let ia = 0;
        let iz = 0;
        for (let n = -8; n <= 8; n++) {
          const sa = st.D / 2 + (n * Math.PI) / k;
          const sz = st.D / 2 + (Math.PI / 2 + n * Math.PI) / k;
          if (sa >= 0 && sa <= st.D && ia < 8) {
            const x = st.ox + st.dx * sa;
            const z = st.oz + st.dz * sa;
            M.compose(P.set(x, ENV.ground(x, z) + 0.07, z), Q.identity(), S.setScalar(1.3 + 0.6 * beat));
            am.setMatrixAt(ia++, M);
          }
          if (sz >= 0 && sz <= st.D && iz < 8) {
            const x = st.ox + st.dx * sz;
            const z = st.oz + st.dz * sz;
            M.compose(P.set(x, ENV.ground(x, z) + 0.07, z), Q.identity(), S.setScalar(1.6));
            sm.setMatrixAt(iz++, M);
          }
        }
        for (; ia < 8; ia++) am.setMatrixAt(ia, M.makeScale(0, 0, 0));
        for (; iz < 8; iz++) sm.setMatrixAt(iz, M.makeScale(0, 0, 0));
        am.instanceMatrix.needsUpdate = true;
        sm.instanceMatrix.needsUpdate = true;
      }
    }
  });

  return (
    <group>
      <mesh geometry={rib.geo} material={rib.mat} frustumCulled={false} renderOrder={11} />
      <instancedMesh ref={crests} args={[dotGeo, dotMats.crest, 8]} frustumCulled={false} visible={false} renderOrder={4} />
      <instancedMesh ref={nodes} args={[ringGeo, dotMats.node, 8]} frustumCulled={false} visible={false} renderOrder={4} />
      <instancedMesh ref={antis} args={[dotGeo, dotMats.anti, 8]} frustumCulled={false} visible={false} renderOrder={4} />
      <instancedMesh ref={stills} args={[ringGeo, dotMats.still, 8]} frustumCulled={false} visible={false} renderOrder={4} />
    </group>
  );
}
