"use client";
/**
 * Đàn laser Lissajous trên sàn chính phòng Siêu khối (phương vị 330°, lib/world/lissajous.ts): sáu tia tần số 1…6.
 * Đứng vào một tia + F → tia đó thành tần số mới (giữ tia chọn trước làm tần số kia). Tường vẽ x = sin(a·t + δ), y = sin(b·t)
 * (δ trôi chậm nên hình xoay như 3D), loa phát hai âm tỉ lệ a : b — 3 : 2 vừa là "bánh quy" vừa là quãng năm đúng.
 * Mô hình Blender `props/lissajous_harp.glb` (bệ 6 đầu phát, thanh thu, khung màn); tia sáng + nét vẽ là hiệu ứng.
 */
import { useEffect, useMemo, useState } from "react";
import { useFrame } from "@react-three/fiber";
import { useGLTF } from "@react-three/drei";
import * as THREE from "three";
import { worldAsset } from "@/lib/world/avatars";
import { LH, closePeriod, intervalName, ratio } from "@/lib/world/lissajous";
import { sfx } from "@/lib/world/sfx";
import { registerAction } from "../actions";
import { useWorld } from "../store";
import { Label3D } from "../ui/Labels";
import { useRoomProps } from "./roomProps";

const GLB = worldAsset("props/lissajous_harp.glb");
useGLTF.preload(GLB);
const PTS = 1200;
const HARP = { a: 3, b: 2 };
const COL_A = new THREE.Color("#ff8a6a");
const COL_B = new THREE.Color("#5fe0d0");
const COL_OFF = new THREE.Color("#7f8cff");

export function LissajousHarp() {
  const props = useRoomProps(GLB);
  const vi = useWorld((s) => s.lang === "vi");
  const [sel, setSel] = useState<[number, number]>([HARP.a, HARP.b]);
  const parts = useMemo(() => ({ base: props.clone("lh_base"), top: props.clone("lh_top"), frame: props.clone("lh_frame") }), [props]);

  const beams = useMemo(() => {
    const h = LH.topY - 0.36 - 0.58;
    const geo = new THREE.CylinderGeometry(0.018, 0.018, h, 6, 1, true);
    return LH.xs.map(() => {
      const m = new THREE.MeshBasicMaterial({ color: COL_OFF.clone(), transparent: true, opacity: 0.55, toneMapped: false, blending: THREE.AdditiveBlending, depthWrite: false });
      const mesh = new THREE.Mesh(geo, m);
      return mesh;
    });
  }, []);
  useEffect(() => () => {
    beams[0]?.geometry.dispose();
    beams.forEach((b) => (b.material as THREE.Material).dispose());
  }, [beams]);

  // dải nét vẽ: toạ độ tính trong vertex shader từ tham số t (không tốn CPU), bề rộng đều theo pháp tuyến của đường cong
  const curve = useMemo(() => {
    const g = new THREE.BufferGeometry();
    const tt = new Float32Array(PTS * 2);
    const sd = new Float32Array(PTS * 2);
    const idx: number[] = [];
    for (let i = 0; i < PTS; i++) {
      tt[i * 2] = tt[i * 2 + 1] = i / (PTS - 1);
      sd[i * 2] = -1;
      sd[i * 2 + 1] = 1;
      if (i < PTS - 1) idx.push(i * 2, i * 2 + 1, i * 2 + 2, i * 2 + 1, i * 2 + 3, i * 2 + 2);
    }
    g.setAttribute("position", new THREE.BufferAttribute(new Float32Array(PTS * 2 * 3), 3));
    g.setAttribute("aT", new THREE.BufferAttribute(tt, 1));
    g.setAttribute("aSide", new THREE.BufferAttribute(sd, 1));
    g.setIndex(idx);
    const mat = new THREE.ShaderMaterial({
      uniforms: { uA: { value: 3 }, uB: { value: 2 }, uD: { value: 0 }, uT: { value: 2 * Math.PI }, uW: { value: 0.022 }, uC: { value: new THREE.Color("#ffe6a0").multiplyScalar(2.2) } },
      vertexShader: /* glsl */ `
        attribute float aT; attribute float aSide; uniform float uA, uB, uD, uT, uW; varying float vS; varying float vT;
        vec2 P(float t){ return vec2(sin(uA * t + uD), sin(uB * t)) * 1.08; }
        void main(){
          float t = aT * uT;
          vec2 p = P(t);
          vec2 d = P(t + 0.002) - P(t - 0.002);
          vec2 n = normalize(vec2(-d.y, d.x) + 1e-6);
          vS = aSide; vT = aT;
          gl_Position = projectionMatrix * modelViewMatrix * vec4(p + n * aSide * uW, -0.05, 1.0);
        }`,
      fragmentShader: /* glsl */ `
        uniform vec3 uC; varying float vS; varying float vT;
        void main(){ float a = 1.0 - vS * vS; gl_FragColor = vec4(uC * (0.55 + 0.45 * a), 1.0); }`,
      toneMapped: false,
      side: THREE.DoubleSide,
    });
    const m = new THREE.Mesh(g, mat);
    m.frustumCulled = false;
    return m;
  }, []);
  useEffect(() => () => (curve.geometry.dispose(), (curve.material as THREE.Material).dispose()), [curve]);

  useEffect(() => {
    const offs = LH.xs.map((_, k) =>
      registerAction(`harp:${k}`, () => {
        HARP.a = HARP.b;
        HARP.b = k + 1;
        setSel([HARP.a, HARP.b]);
        sfx.harmonic(HARP.a);
        sfx.harmonic(HARP.b);
      }),
    );
    return () => offs.forEach((f) => f());
  }, []);

  useFrame(() => {
    const t = performance.now() / 1000;
    const [a, b] = [HARP.a, HARP.b];
    const T = closePeriod(a, b);
    const u = (curve.material as THREE.ShaderMaterial).uniforms;
    u.uA.value = a;
    u.uB.value = b;
    u.uD.value = t * 0.45;
    u.uT.value = T;
    beams.forEach((m, k) => {
      const mat = m.material as THREE.MeshBasicMaterial;
      const on = k + 1 === a || k + 1 === b;
      mat.color.copy(k + 1 === b ? COL_B : k + 1 === a ? COL_A : COL_OFF).multiplyScalar(on ? 2.2 + 0.4 * Math.sin(t * 6 * (k + 1)) : 0.9);
      mat.opacity = on ? 0.9 : 0.4;
    });
  });

  const [p, q] = ratio(sel[0], sel[1]);
  return (
    <group rotation-y={Math.PI - (LH.bearing * Math.PI) / 180}>
      <group position={[0, 0, LH.r]}>
        <primitive object={parts.base} />
        <primitive object={parts.top} position={[0, LH.topY, 0]} />
        {beams.map((m, k) => (
          <primitive key={k} object={m} position={[LH.xs[k], 0.58 + (LH.topY - 0.36 - 0.58) / 2, 0]} />
        ))}
        <Label3D text={vi ? "Đàn laser Lissajous · đứng vào một tia, bấm F" : "Lissajous laser harp · stand in a beam, press F"} position={[0, 1.15, -0.4]} variant="small" maxDist={10} />
      </group>
      <group position={[0, LH.frameY, LH.frameR]}>
        <primitive object={parts.frame} />
        <primitive object={curve} />
        <Label3D text={`x = sin(${sel[0]}t + δ) · y = sin(${sel[1]}t) · ${p} : ${q} = ${intervalName(sel[0], sel[1], vi)}`} position={[0, 1.55, -0.2]} variant="small" maxDist={16} />
      </group>
    </group>
  );
}
