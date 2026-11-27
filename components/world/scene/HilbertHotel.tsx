"use client";
/**
 * Khách sạn Hilbert — "hành lang không bao giờ hết" của Sảnh Bất Khả nay là một khách sạn có VÔ HẠN phòng, đang kín chỗ.
 * - Đoạn hành lang Blender (`props/hotel.glb`, GI nướng) lặp 5 lần; đi quá 20 m thì bị "quấn" lùi 10 m (máy quay dời theo)
 *   còn số phòng trên biển cửa thì cứ tăng mãi (biển số vẽ bằng shader 7 đoạn, không texture).
 * - Mỗi phòng có một khách (quả cầu sáng ở ô kính trên cửa). Lễ tân Vô Cực thực hiện ba "phép màu": n→n+1, n→2n,
 *   luỹ thừa nguyên tố — các quả cầu bay sang phòng mới cùng lúc, khách mới (vàng) bay vào phòng trống.
 */
import { useEffect, useMemo, useRef } from "react";
import { useFrame } from "@react-three/fiber";
import { useGLTF } from "@react-three/drei";
import * as THREE from "three";
import { create } from "zustand";
import { worldAsset, AVATAR_BY_ID } from "@/lib/world/avatars";
import { DOORS, SEG, occupantAfter, roomNumber, roomPlace, type Move } from "@/lib/world/hilbert";
import { bakedMaterial } from "../fx/baked";
import { useWorld } from "../store";
import { Avatar } from "../player/Avatar";
import { Label3D } from "../ui/Labels";
import { CAM } from "../combat/combat";
import { toonize } from "../fx/glbToon";

const GLB = worldAsset("props/hotel.glb");
const PODIUM = worldAsset("props/babel_lectern.glb");
useGLTF.preload(GLB);

export const HOTEL_U = { uExposure: { value: 1.25 }, uFloor: { value: 0.32 }, uTint: { value: new THREE.Color(1, 0.98, 0.94) }, uScale: { value: 2.2 } };
export const useHotel = create<{ wraps: number; move: Move | null; t0: number; done: Move[] }>(() => ({ wraps: 0, move: null, t0: 0, done: [] }));
export const MOVE_MS = 3200;
export function hilbertMove(m: Move) {
  const s = useHotel.getState();
  if (s.move && performance.now() - s.t0 < MOVE_MS) return;
  useHotel.setState({ move: m, t0: performance.now(), done: s.done.includes(m) ? s.done : [...s.done, m] });
}

const W = 3;
const NSEG = 5;
const CARPET_LAYER: Record<string, number> = { h_carpet_edge: 1, h_carpet: 2 };

/**
 * Xà trần đầu đoạn thò 6 cm sang đoạn trước (z ∈ [−0,1; 0,06]) → các đoạn lặp đè nhau, mặt trùng nhấp nháy ở mỗi mối nối.
 * Kẹp z ≤ 0 cho lưới xà: mỗi đoạn kết thúc đúng ranh giới SEG, không còn chồng. (Lối vào: mặt tiền che mép này.)
 */
export function clampSeam(g: THREE.BufferGeometry): THREE.BufferGeometry {
  const pos = g.getAttribute("position");
  let over = false;
  for (let i = 0; i < pos.count; i++) if (pos.getZ(i) > 0) over = true;
  if (!over) return g;
  const out = g.clone();
  const p = out.getAttribute("position");
  for (let i = 0; i < p.count; i++) if (p.getZ(i) > 0) p.setZ(i, 0);
  p.needsUpdate = true;
  out.computeBoundingSphere();
  return out;
}
const SIDES: ("left" | "right")[] = ["left", "right"];

/** Vị trí ô kính trên cửa (khách) và biển số của phòng ở đoạn hiển thị k */
function doorPos(cx: number, z0: number, k: number, j: number, side: "left" | "right", y: number, inset: number) {
  const sx = side === "left" ? -1 : 1;
  return new THREE.Vector3(cx + sx * (W / 2 - inset), y, z0 - k * SEG - DOORS[j]);
}

function plaqueMaterial() {
  return new THREE.ShaderMaterial({
    vertexShader: `attribute float aNum; varying float vNum; varying vec2 vUv;
      void main(){ vNum = aNum; vUv = uv; gl_Position = projectionMatrix * modelViewMatrix * instanceMatrix * vec4(position, 1.0); }`,
    fragmentShader: `varying float vNum; varying vec2 vUv;
      float segD(vec2 p, vec2 a, vec2 b){ vec2 pa = p - a, ba = b - a; float h = clamp(dot(pa, ba) / dot(ba, ba), 0.0, 1.0); return length(pa - ba * h); }
      float bit(float m, float i){ return mod(floor(m / pow(2.0, i)), 2.0); }
      float digit(vec2 p, float d){
        // 7 đoạn: a b c d e f g ; mặt nạ cho 0–9
        float m = d < 0.5 ? 63.0 : d < 1.5 ? 6.0 : d < 2.5 ? 91.0 : d < 3.5 ? 79.0 : d < 4.5 ? 102.0 : d < 5.5 ? 109.0 : d < 6.5 ? 125.0 : d < 7.5 ? 7.0 : d < 8.5 ? 127.0 : 111.0;
        float w = 0.07; float r = 1.0;
        r = min(r, bit(m, 0.0) > 0.5 ? segD(p, vec2(0.2, 0.9), vec2(0.8, 0.9)) : 1.0);
        r = min(r, bit(m, 1.0) > 0.5 ? segD(p, vec2(0.8, 0.9), vec2(0.8, 0.5)) : 1.0);
        r = min(r, bit(m, 2.0) > 0.5 ? segD(p, vec2(0.8, 0.5), vec2(0.8, 0.1)) : 1.0);
        r = min(r, bit(m, 3.0) > 0.5 ? segD(p, vec2(0.2, 0.1), vec2(0.8, 0.1)) : 1.0);
        r = min(r, bit(m, 4.0) > 0.5 ? segD(p, vec2(0.2, 0.5), vec2(0.2, 0.1)) : 1.0);
        r = min(r, bit(m, 5.0) > 0.5 ? segD(p, vec2(0.2, 0.9), vec2(0.2, 0.5)) : 1.0);
        r = min(r, bit(m, 6.0) > 0.5 ? segD(p, vec2(0.2, 0.5), vec2(0.8, 0.5)) : 1.0);
        return 1.0 - smoothstep(w * 0.6, w, r);
      }
      void main(){
        float n = floor(vNum + 0.5);
        float nd = n < 10.0 ? 1.0 : n < 100.0 ? 2.0 : n < 1000.0 ? 3.0 : n < 10000.0 ? 4.0 : n < 100000.0 ? 5.0 : 6.0;
        // khung đồng
        vec2 q = vUv;
        float border = step(min(min(q.x, 1.0 - q.x), min(q.y, 1.0 - q.y)), 0.06);
        float cw = 0.16; float x0 = 0.5 - nd * cw * 0.5;
        float ink = 0.0;
        float k = floor((q.x - x0) / cw);
        if (k >= 0.0 && k < nd && q.y > 0.18 && q.y < 0.82) {
          float d = mod(floor(n / pow(10.0, nd - 1.0 - k)), 10.0);
          vec2 p = vec2((q.x - x0 - k * cw) / cw, (q.y - 0.18) / 0.64);
          ink = digit(p, d);
        }
        vec3 col = mix(vec3(0.08, 0.05, 0.04), vec3(1.0, 0.8, 0.42) * 1.6, max(ink, border * 0.8));
        gl_FragColor = vec4(col, 1.0);
      }`,
    toneMapped: false,
  });
}

export function HilbertHotel({ cx, z0 }: { cx: number; z0: number }) {
  const gltf = useGLTF(GLB);
  const podium = useGLTF(PODIUM);
  const podiumObj = useMemo(() => toonize(podium.scene), [podium]);
  const { parts, mats } = useMemo(() => {
    const cache = new Map<string, THREE.Material>();
    const list: { geo: THREE.BufferGeometry; mat: THREE.Material }[] = [];
    gltf.scene.traverse((o) => {
      const m = o as THREE.Mesh;
      if (!m.isMesh) return;
      const src = m.material as THREE.MeshStandardMaterial;
      if (src.name === "h_plaque") return; // biển số do shader vẽ
      let mat = cache.get(src.name);
      if (!mat) {
        mat = src.name.startsWith("glow_") ? new THREE.MeshBasicMaterial({ color: src.color.clone().multiplyScalar(2.2), toneMapped: false }) : bakedMaterial(src, HOTEL_U);
        // trong nhà: không nhận sương của sân (hành lang dài 50 m sẽ bị phủ trắng ở cuối)
        (mat as THREE.MeshBasicMaterial).fog = false;
        // thảm + viền thảm nằm ĐÚNG mặt sàn (y = 0) → ưu tiên độ sâu theo lớp: sàn < viền < thảm (hết nhấp nháy)
        const layer = CARPET_LAYER[src.name];
        if (layer) {
          mat.polygonOffset = true;
          mat.polygonOffsetFactor = -layer;
          mat.polygonOffsetUnits = -2 * layer;
        }
        cache.set(src.name, mat);
      }
      list.push({ geo: m.name === "ht_beams" ? clampSeam(m.geometry) : m.geometry, mat });
    });
    return { parts: list, mats: [...cache.values()] };
  }, [gltf]);
  useEffect(() => () => mats.forEach((m) => m.dispose()), [mats]);
  const segRefs = useRef<(THREE.InstancedMesh | null)[]>([]);
  useEffect(() => {
    const m = new THREE.Matrix4();
    segRefs.current.forEach((im) => {
      if (!im) return;
      for (let k = 0; k < NSEG; k++) im.setMatrixAt(k, m.makeTranslation(cx, 0.012, z0 - k * SEG)); // nhấc 1 cm khỏi sàn sân (tránh z-fighting)
      im.instanceMatrix.needsUpdate = true;
    });
  }, [parts, cx, z0]);

  // Biển số (40) + khách (40)
  const N = NSEG * 4 * 2;
  const plaque = useMemo(() => {
    const g = new THREE.PlaneGeometry(0.34, 0.16);
    g.setAttribute("aNum", new THREE.InstancedBufferAttribute(new Float32Array(N), 1));
    return { geo: g, mat: plaqueMaterial() };
  }, [N]);
  const orb = useMemo(
    () => ({ geo: new THREE.SphereGeometry(0.11, 14, 10), mat: new THREE.MeshBasicMaterial({ color: "#ffffff", toneMapped: false }) }),
    [],
  );
  useEffect(() => () => [plaque.geo, plaque.mat, orb.geo, orb.mat].forEach((x) => x.dispose()), [plaque, orb]);
  const plaques = useRef<THREE.InstancedMesh>(null);
  const orbs = useRef<THREE.InstancedMesh>(null);
  const tmp = useMemo(() => ({ m: new THREE.Matrix4(), q: new THREE.Quaternion(), s: new THREE.Vector3(1, 1, 1), c: new THREE.Color(), teal: new THREE.Color("#7fe8ff").multiplyScalar(2.2), gold: new THREE.Color("#ffd27a").multiplyScalar(2.6) }), []);
  const lastWraps = useRef(-1);
  useFrame(() => {
    const st = useWorld.getState();
    const p = st.player;
    const hs = useHotel.getState();
    // Quấn hành lang (cùng quy tắc cũ: quá 2 đoạn thì lùi 1 đoạn) + dời máy quay + số phòng tăng tiếp
    // chỉ khi đang ở TRONG lòng hành lang (bay ngang trên mái thì không quấn)
    if (Math.abs(p.x - cx) < W / 2 && p.z < z0 - 2 * SEG && p.y < 3.3) {
      p.z += SEG;
      CAM.shift = new THREE.Vector3(0, 0, SEG);
      useHotel.setState({ wraps: hs.wraps + 1 });
    }
    if (p.z > z0 + 1.5 && hs.wraps !== 0) useHotel.setState({ wraps: 0 });
    const wraps = useHotel.getState().wraps;
    // Biển số
    if (plaques.current && lastWraps.current !== wraps) {
      lastWraps.current = wraps;
      const arr = plaque.geo.getAttribute("aNum") as THREE.InstancedBufferAttribute;
      let i = 0;
      for (let k = 0; k < NSEG; k++)
        for (let j = 0; j < 4; j++)
          for (const side of SIDES) {
            const pos = doorPos(cx, z0, k, j, side, 1.62, 0.04);
            tmp.q.setFromAxisAngle(new THREE.Vector3(0, 1, 0), side === "left" ? Math.PI / 2 : -Math.PI / 2);
            tmp.m.compose(pos, tmp.q, tmp.s);
            plaques.current.setMatrixAt(i, tmp.m);
            arr.setX(i, roomNumber(k + wraps, j, side));
            i++;
          }
      plaques.current.instanceMatrix.needsUpdate = true;
      arr.needsUpdate = true;
    }
    // Khách: đứng yên ở ô kính trên cửa; khi có phép chuyển thì bay từ phòng cũ sang phòng mới
    if (orbs.current) {
      const now = performance.now();
      const t = hs.move ? Math.min(1, (now - hs.t0) / MOVE_MS) : 1;
      const e = t < 0.5 ? 2 * t * t : 1 - Math.pow(-2 * t + 2, 2) / 2;
      let i = 0;
      const place = (n: number) => {
        const r = roomPlace(n);
        return doorPos(cx, z0, r.g - wraps, r.j, r.side, 2.48, 0.12);
      };
      for (let k = 0; k < NSEG; k++)
        for (let j = 0; j < 4; j++)
          for (const side of SIDES) {
            const n = roomNumber(k + wraps, j, side);
            const dest = doorPos(cx, z0, k, j, side, 2.48, 0.12);
            let pos = dest;
            let col = tmp.teal;
            let scale = 1;
            if (hs.move) {
              const occ = occupantAfter(hs.move, n);
              if (!occ) scale = 0;
              else if (occ.kind === "old") {
                // xuất phát từ phòng cũ; bay vòng lên trần cho dễ thấy
                const from = place(occ.from);
                pos = from.clone().lerp(dest, e);
                pos.y += Math.sin(e * Math.PI) * 0.5;
                if (Math.abs(from.z - dest.z) > 60) pos.z = dest.z + (1 - e) * 30;
              } else {
                // khách mới từ lối vào bay tới
                col = tmp.gold;
                const from = new THREE.Vector3(cx, 1.6, z0 + 3);
                pos = from.clone().lerp(dest, e);
                pos.y += Math.sin(e * Math.PI) * 0.8;
              }
            }
            tmp.m.compose(pos, tmp.q.identity(), tmp.s.setScalar(scale));
            orbs.current.setMatrixAt(i, tmp.m);
            orbs.current.setColorAt(i, col);
            tmp.s.set(1, 1, 1);
            i++;
          }
      orbs.current.instanceMatrix.needsUpdate = true;
      if (orbs.current.instanceColor) orbs.current.instanceColor.needsUpdate = true;
    }
  });
  return (
    <group>
      {parts.map((pt, i) => (
        <instancedMesh key={i} ref={(el) => void (segRefs.current[i] = el)} args={[pt.geo, pt.mat, NSEG]} frustumCulled={false} />
      ))}
      {/* Vỏ ngoài: tường đá + mái + nẹp vàng (nhìn từ sân là một toà nhà dài, không phải hộp cắt dở) */}
      {[-1, 1].map((sx) => (
        <group key={sx}>
          <mesh position={[cx + sx * (W / 2 + 0.21), 1.75, z0 - (NSEG * SEG) / 2]}>
            <boxGeometry args={[0.36, 3.5, NSEG * SEG]} />
            <meshToonMaterial color="#cfc3d9" />
          </mesh>
          <mesh position={[cx + sx * (W / 2 + 0.2), 3.52, z0 - (NSEG * SEG) / 2]}>
            <boxGeometry args={[0.44, 0.1, NSEG * SEG]} />
            <meshToonMaterial color="#e0b96a" emissive="#5a3a08" />
          </mesh>
        </group>
      ))}
      <mesh position={[cx, 3.62, z0 - (NSEG * SEG) / 2]}>
        <boxGeometry args={[W + 0.8, 0.16, NSEG * SEG]} />
        <meshToonMaterial color="#8f84a8" />
      </mesh>
      {/* Mặt tiền: vòm cửa + biển */}
      <mesh position={[cx, 3.25, z0 + 0.02]}>
        <boxGeometry args={[W + 0.8, 0.6, 0.3]} />
        <meshToonMaterial color="#6b2f3a" />
      </mesh>
      <Label3D text="KHÁCH SẠN HILBERT · ∞ phòng · hết chỗ" position={[cx, 4.15, z0 + 0.2]} variant="default" />
      {/* Cuối hành lang chìm vào bóng tối ấm (không lộ chỗ hết hình) */}
      <mesh position={[cx, 1.6, z0 - NSEG * SEG + 0.4]}>
        <planeGeometry args={[W + 0.2, 3.4]} />
        <shaderMaterial
          vertexShader="varying vec2 vUv; void main(){ vUv = uv; gl_Position = projectionMatrix * modelViewMatrix * vec4(position,1.0); }"
          fragmentShader="varying vec2 vUv; void main(){ float v = smoothstep(0.0, 0.5, vUv.y) * smoothstep(1.0, 0.6, vUv.y); vec3 c = mix(vec3(0.05, 0.02, 0.015), vec3(0.22, 0.09, 0.05), v * (1.0 - abs(vUv.x - 0.5) * 1.6)); gl_FragColor = vec4(c, 1.0); }"
        />
      </mesh>
      <instancedMesh ref={plaques} args={[plaque.geo, plaque.mat, N]} frustumCulled={false} />
      <instancedMesh ref={orbs} args={[orb.geo, orb.mat, N]} frustumCulled={false} />
      {/* Quầy lễ tân + Vô Cực ở cửa khách sạn */}
      <group position={[cx + 2.7, 0, z0 + 1.3]} rotation-y={-Math.PI / 2 - 0.5}>
        <primitive object={podiumObj} position={[0, 0, 0.6]} />
        <Avatar url={worldAsset(AVATAR_BY_ID["sample-b"]?.file ?? "avatars/sample-b.vrm")} pose="idle" npc />
        <Label3D text="Vô Cực · Lễ tân Khách sạn Hilbert" position={[0, 2.05, 0]} variant="name" />
      </group>
    </group>
  );
}

/** Vị trí lễ tân (để tương tác) */
export const conciergePos = (cx: number, z0: number) => ({ x: cx + 2.7, z: z0 + 1.3 });
