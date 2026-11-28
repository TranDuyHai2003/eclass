"use client";
/**
 * Bờ Sóng — Hải đăng Snell. Gương mặt trời (EMITTER) chiếu một tia ngang về phía đông; lăng kính thuỷ tinh đều trên bàn xoay
 * (F: +7,5°) bẻ tia hai lần theo định luật Snell (lib/world/waves.ts traceGlass — logic và hình dùng đúng một hàm).
 * Vẽ: tia trắng tới, pháp tuyến ở mặt vào (vạch mờ), đường trong kính, ba dải đỏ / lục / lam tách nhẹ khi ra (tán sắc N-BK7);
 * logic dùng dải lục. Trúng tinh thể A → hải đăng sáng (đèn quay quét biển). Tinh thể B chỉ trúng khi có phản xạ toàn phần.
 */
import { useEffect, useMemo, useRef } from "react";
import { useFrame } from "@react-three/fiber";
import * as THREE from "three";
import { CRYSTAL_A, CRYSTAL_B, EMITTER, ISLE, LIGHTHOUSE, PRISM, prismRot } from "@/lib/world/coastWorld";
import { GLASS_N, prismPoly, rayHitsDisc, traceGlass, type V2 } from "@/lib/world/waves";
import { useCoast } from "./coastState";
import { GlbOr, glow, toon, useCoastGlb } from "./CoastProps";

const Y = ISLE.top + 1.05;

/** một đoạn tia = hộp mảnh xoay theo hướng */
function segMatrix(a: V2, b: V2, w: number, m: THREE.Matrix4) {
  const dx = b.x - a.x;
  const dz = b.z - a.z;
  const len = Math.hypot(dx, dz) || 1e-4;
  const q = new THREE.Quaternion().setFromUnitVectors(new THREE.Vector3(1, 0, 0), new THREE.Vector3(dx / len, 0, dz / len));
  return m.compose(new THREE.Vector3((a.x + b.x) / 2, Y, (a.z + b.z) / 2), q, new THREE.Vector3(len, w, w));
}

/** điểm cuối tia: dừng ở tinh thể nếu trúng, không thì bay 14 m */
function rayEnd(p: V2, d: V2): V2 {
  for (const c of [CRYSTAL_A, CRYSTAL_B])
    if (rayHitsDisc(p, d, c, c.r)) {
      const t = (c.x - p.x) * d.x + (c.z - p.z) * d.z;
      return { x: p.x + d.x * t, z: p.z + d.z * t };
    }
  return { x: p.x + d.x * 14, z: p.z + d.z * 14 };
}

function prismGeometry() {
  const pts = prismPoly(0, 0, PRISM.side, 0);
  const shape = new THREE.Shape(pts.map((p) => new THREE.Vector2(p.x, -p.z)));
  const g = new THREE.ExtrudeGeometry(shape, { depth: 0.9, bevelEnabled: false });
  g.rotateX(-Math.PI / 2); // (sx, sy, d) → (sx, d, −sy): đỉnh đa giác khớp prismPoly trong mặt x–z
  return g;
}

export function PrismLight() {
  const glb = useCoastGlb();
  const step = useCoast((s) => s.prismStep);
  const hit = useCoast((s) => s.beamHit);
  const lit = useCoast((s) => s.lit);
  const tir = useCoast((s) => s.tir);
  const prism = useRef<THREE.Group>(null);
  const sweep = useRef<THREE.Group>(null);

  const geo = useMemo(() => ({ prism: prismGeometry(), seg: new THREE.BoxGeometry(1, 1, 1), cone: new THREE.ConeGeometry(2.2, 26, 20, 1, true).rotateZ(Math.PI / 2).translate(13, 0, 0) }), []);
  const mats = useMemo(
    () => ({
      glass: new THREE.MeshPhysicalMaterial({ color: "#dff6ff", transparent: true, opacity: 0.42, roughness: 0.05, metalness: 0, side: THREE.DoubleSide, depthWrite: false }),
      beam: new THREE.MeshBasicMaterial({ toneMapped: false, transparent: true, opacity: 0.95, depthWrite: false, blending: THREE.AdditiveBlending, vertexColors: false }),
      cone: new THREE.MeshBasicMaterial({ color: new THREE.Color("#fff2c4").multiplyScalar(0.5), transparent: true, opacity: 0.22, depthWrite: false, blending: THREE.AdditiveBlending, side: THREE.DoubleSide, toneMapped: false }),
    }),
    [],
  );
  const beams = useMemo(() => {
    const im = new THREE.InstancedMesh(geo.seg, mats.beam, 24);
    im.frustumCulled = false;
    return im;
  }, [geo, mats]);
  useEffect(
    () => () => {
      Object.values(geo).forEach((g) => g.dispose());
      Object.values(mats).forEach((m) => m.dispose());
      beams.dispose();
    },
    [geo, mats, beams],
  );

  // dựng lại các đoạn tia khi xoay lăng kính (cùng hàm logic)
  useEffect(() => {
    const poly = prismPoly(PRISM.x, PRISM.z, PRISM.side, prismRot(step));
    const m = new THREE.Matrix4();
    const col = new THREE.Color();
    let k = 0;
    const put = (a: V2, b: V2, w: number, c: string, s = 1) => {
      if (k >= 24) return;
      beams.setMatrixAt(k, segMatrix(a, b, w, m));
      beams.setColorAt(k, col.set(c).multiplyScalar(s));
      k++;
    };
    const base = traceGlass(EMITTER, { x: 1, z: 0 }, poly, GLASS_N.g);
    // tia trắng tới
    put(base.pts[0], base.pts[1] ?? rayEnd(EMITTER, { x: 1, z: 0 }), 0.07, "#fff6e0", 3);
    if (base.hitPrism) {
      // pháp tuyến ở mặt vào (vạch mờ, dài 0,7 m hai phía)
      const p1 = base.pts[1];
      const e = poly.map((v, i) => ({ a: v, b: poly[(i + 1) % 3] })).find(({ a, b }) => Math.abs((b.x - a.x) * (p1.z - a.z) - (b.z - a.z) * (p1.x - a.x)) < 1e-6);
      if (e) {
        const nx = e.b.z - e.a.z;
        const nz = -(e.b.x - e.a.x);
        const l = Math.hypot(nx, nz);
        put({ x: p1.x - (nx / l) * 0.7, z: p1.z - (nz / l) * 0.7 }, { x: p1.x + (nx / l) * 0.7, z: p1.z + (nz / l) * 0.7 }, 0.018, "#9fb8ff", 1.2);
      }
      // ba dải màu
      for (const [n, c] of [
        [GLASS_N.r, "#ff5a4a"],
        [GLASS_N.g, "#6dff7a"],
        [GLASS_N.b, "#5a8cff"],
      ] as const) {
        const tr = traceGlass(EMITTER, { x: 1, z: 0 }, poly, n);
        for (let i = 1; i < tr.pts.length - 1; i++) put(tr.pts[i], tr.pts[i + 1], 0.04, c, 1.6);
        const p = tr.pts[tr.pts.length - 1];
        put(p, rayEnd(p, tr.dir), 0.045, c, 2.6);
      }
    }
    beams.count = k;
    beams.instanceMatrix.needsUpdate = true;
    if (beams.instanceColor) beams.instanceColor.needsUpdate = true;
  }, [step, beams]);

  useFrame((_, dt) => {
    if (prism.current) prism.current.rotation.y += (-prismRot(step) - prism.current.rotation.y) * Math.min(1, dt * 10);
    // xoay lăng kính theo đường ngắn (bỏ qua bước quấn 360°)
    if (prism.current && Math.abs(-prismRot(step) - prism.current.rotation.y) > Math.PI) prism.current.rotation.y = -prismRot(step);
    if (sweep.current) {
      sweep.current.visible = lit;
      sweep.current.rotation.y += dt * 0.6;
    }
  });

  return (
    <group>
      {/* gương mặt trời */}
      <GlbOr glb={glb} name="cw_sun_mirror" position={[EMITTER.x, ISLE.top, EMITTER.z]}>
        <mesh material={toon("#8a8496")} position={[0, 0.5, 0]}>
          <cylinderGeometry args={[0.12, 0.16, 1.0, 8]} />
        </mesh>
        <mesh material={glow("#fff2c4", 2.4)} position={[0.05, 1.05, 0]} rotation-y={Math.PI / 2}>
          <circleGeometry args={[0.32, 20]} />
        </mesh>
      </GlbOr>
      {/* bàn xoay + lăng kính */}
      <group position={[PRISM.x, ISLE.top, PRISM.z]}>
        <GlbOr glb={glb} name="cw_turntable">
          <mesh material={toon("#7a7486")} position={[0, 0.3, 0]}>
            <cylinderGeometry args={[0.75, 0.85, 0.6, 24]} />
          </mesh>
        </GlbOr>
        <group ref={prism} position={[0, 0.6, 0]}>
          <GlbOr glb={glb} name="cw_prism">
            <mesh geometry={geo.prism} material={mats.glass} />
          </GlbOr>
        </group>
      </group>
      <primitive object={beams} />
      {/* tinh thể A / B */}
      {[
        { c: CRYSTAL_A, on: hit === "A" || lit, col: "#ffd27a", name: "cw_crystal_a" },
        { c: CRYSTAL_B, on: hit === "B" || tir, col: "#9ec8ff", name: "cw_crystal_b" },
      ].map(({ c, on, col, name }) => (
        <group key={name} position={[c.x, ISLE.top, c.z]}>
          <mesh material={toon("#77718a")} position={[0, 0.4, 0]}>
            <cylinderGeometry args={[0.28, 0.34, 0.8, 8]} />
          </mesh>
          <GlbOr glb={glb} name={name} position={[0, 1.05, 0]}>
            <mesh material={on ? glow(col, 3) : toon("#b9b4cc")}>
              <octahedronGeometry args={[0.28, 0]} />
            </mesh>
          </GlbOr>
        </group>
      ))}
      {/* hải đăng: tháp + phòng đèn (glow khi sáng) + chùm sáng quay */}
      <group position={[LIGHTHOUSE.x, ISLE.top, LIGHTHOUSE.z]}>
        <GlbOr glb={glb} name="cw_lighthouse">
          <mesh material={toon("#f4efe6")} position={[0, LIGHTHOUSE.h / 2, 0]}>
            <cylinderGeometry args={[LIGHTHOUSE.r * 0.72, LIGHTHOUSE.r, LIGHTHOUSE.h, 20]} />
          </mesh>
          {[0.25, 0.55, 0.8].map((f) => (
            <mesh key={f} material={toon("#d8584a")} position={[0, LIGHTHOUSE.h * f, 0]}>
              <cylinderGeometry args={[LIGHTHOUSE.r * (1 - 0.28 * f) + 0.02, LIGHTHOUSE.r * (1 - 0.28 * f) + 0.02, 0.9, 20]} />
            </mesh>
          ))}
          <mesh material={toon("#3d3a48")} position={[0, LIGHTHOUSE.h + 1.6, 0]}>
            <coneGeometry args={[1.15, 1.2, 16]} />
          </mesh>
        </GlbOr>
        <GlbOr glb={glb} name="glow_lantern" position={[0, LIGHTHOUSE.h + 0.5, 0]}>
          <mesh material={lit ? glow("#fff2c4", 4) : toon("#556070")}>
            <cylinderGeometry args={[0.85, 0.85, 1.0, 16]} />
          </mesh>
        </GlbOr>
        <group ref={sweep} position={[0, LIGHTHOUSE.h + 0.5, 0]} visible={false}>
          <mesh geometry={geo.cone} material={mats.cone} />
          <mesh geometry={geo.cone} material={mats.cone} rotation-y={Math.PI} />
        </group>
      </group>
      <pointLight position={[LIGHTHOUSE.x, ISLE.top + LIGHTHOUSE.h + 0.5, LIGHTHOUSE.z]} color="#ffe6b0" intensity={lit ? 30 : 0} distance={30} />
    </group>
  );
}
