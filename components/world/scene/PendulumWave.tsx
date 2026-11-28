"use client";
/**
 * Con lắc sóng dưới mép tầng lửng tây bắc phòng Siêu khối (lib/world/pendulumWave.ts): 24 quả đồng instanced, dây là
 * LineSegments, thanh treo + móc + cần gạt từ Blender (`props/pendulum_wave.glb`, GI nướng). Góc giải tích → không trôi,
 * mọi máy thấy như nhau theo đồng hồ chung; cần gạt (F) thả lại cùng pha tại chỗ.
 */
import { useEffect, useMemo, useRef } from "react";
import { useFrame } from "@react-three/fiber";
import { useGLTF } from "@react-three/drei";
import * as THREE from "three";
import { worldAsset } from "@/lib/world/avatars";
import { dirOf } from "@/lib/world/tessRoom";
import { PW, angle, bobBearing, length } from "@/lib/world/pendulumWave";
import { sfx } from "@/lib/world/sfx";
import { bakedMaterial } from "../fx/baked";
import { registerAction } from "../actions";
import { useWorld } from "../store";
import { Label3D } from "../ui/Labels";
import { PROP_U, ROOM_U } from "./roomUniforms";

const GLB = worldAsset("props/pendulum_wave.glb");
useGLTF.preload(GLB);
const RAD = Math.PI / 180;
/** mốc thả (ms, đồng hồ máy) — cần gạt đặt lại; mặc định theo phút chẵn để các máy gần như cùng pha */
const PWS = { t0: Math.floor(Date.now() / 90000) * 90000, pull: -1 };

export function PendulumWave() {
  const gltf = useGLTF(GLB);
  const vi = useWorld((s) => s.lang === "vi");
  const parts = useMemo(() => {
    const cache = new Map<string, THREE.Material>();
    const conv = (src: THREE.Material) => {
      const std = src as THREE.MeshStandardMaterial;
      let m = cache.get(std.name);
      if (!m) {
        m = std.name.startsWith("glow_") ? new THREE.MeshBasicMaterial({ color: std.color.clone().multiplyScalar(2.2), toneMapped: false }) : bakedMaterial(std, PROP_U);
        cache.set(std.name, m);
      }
      return m;
    };
    const meshesOf = (name: string) => {
      const root = gltf.scene.getObjectByName(name);
      const out: { geo: THREE.BufferGeometry; mat: THREE.Material }[] = [];
      root?.updateMatrixWorld(true);
      const inv = root ? root.matrixWorld.clone().invert() : new THREE.Matrix4();
      root?.traverse((o) => {
        const m = o as THREE.Mesh;
        if (!m.isMesh) return;
        const geo = m.geometry.clone().applyMatrix4(inv.clone().multiply(m.matrixWorld));
        out.push({ geo, mat: conv(m.material as THREE.Material) });
      });
      return out;
    };
    const clone = (name: string) => {
      const o = gltf.scene.getObjectByName(name)?.clone(true) ?? new THREE.Group();
      o.position.set(0, 0, 0);
      o.traverse((x) => {
        const mesh = x as THREE.Mesh;
        if (mesh.isMesh) mesh.material = conv(mesh.material as THREE.Material);
      });
      return o;
    };
    return { bob: meshesOf("pw_bob"), hook: meshesOf("pw_hook"), rail: meshesOf("pw_rail"), lever: clone("pw_lever"), arm: clone("pw_lever_arm"), cache };
  }, [gltf]);

  // instanced: quả lắc + móc (24), thanh treo (5 đoạn theo cung)
  const RAILS = 5;
  const inst = useMemo(() => {
    const mk = (list: { geo: THREE.BufferGeometry; mat: THREE.Material }[], n: number) => list.map(({ geo, mat }) => new THREE.InstancedMesh(geo, mat, n));
    const bob = mk(parts.bob, PW.n);
    bob.forEach((im) => (im.frustumCulled = false)); // ma trận đổi mỗi khung (1 nhóm nhỏ, không đáng để tính lại hình cầu bao)
    return { bob, hook: mk(parts.hook, PW.n), rail: mk(parts.rail, RAILS) };
  }, [parts]);
  useEffect(() => {
    // tĩnh: móc + thanh treo
    const o = new THREE.Object3D();
    for (let k = 1; k <= PW.n; k++) {
      const b = bobBearing(k);
      const [dx, dz] = dirOf(b);
      o.position.set(dx * PW.r, PW.pivotY, dz * PW.r);
      o.rotation.set(0, -b * RAD, 0);
      o.updateMatrix();
      inst.hook.forEach((im) => im.setMatrixAt(k - 1, o.matrix));
    }
    const arc = (PW.b1 - PW.b0 + 2) * RAD * PW.r;
    for (let i = 0; i < RAILS; i++) {
      const b = PW.b0 - 1 + ((PW.b1 - PW.b0 + 2) * (i + 0.5)) / RAILS;
      const [dx, dz] = dirOf(b);
      o.position.set(dx * PW.r, PW.pivotY + 0.08, dz * PW.r);
      o.rotation.set(0, -b * RAD, 0);
      o.scale.set((arc / RAILS) * 1.02, 1, 1);
      o.updateMatrix();
      inst.rail.forEach((im) => im.setMatrixAt(i, o.matrix));
    }
    [...inst.hook, ...inst.rail].forEach((im) => {
      im.instanceMatrix.needsUpdate = true;
      im.computeBoundingSphere();
    });
  }, [inst]);
  useEffect(
    () => () => {
      [...inst.bob, ...inst.hook, ...inst.rail].forEach((im) => {
        im.geometry.dispose();
        im.dispose();
      });
      parts.cache.forEach((m) => m.dispose());
    },
    [inst, parts],
  );

  const strings = useMemo(() => {
    const g = new THREE.BufferGeometry();
    g.setAttribute("position", new THREE.BufferAttribute(new Float32Array(PW.n * 6), 3));
    const m = new THREE.LineBasicMaterial({ color: new THREE.Color("#e9d7a8"), transparent: true, opacity: 0.7 });
    const l = new THREE.LineSegments(g, m);
    l.frustumCulled = false;
    return l;
  }, []);
  useEffect(() => () => {
    strings.geometry.dispose();
    (strings.material as THREE.Material).dispose();
  }, [strings]);

  useEffect(
    () =>
      registerAction("pendulum-release", () => {
        PWS.t0 = Date.now();
        PWS.pull = performance.now();
        sfx.click();
        sfx.chime(2);
      }),
    [],
  );

  const [ldx, ldz] = dirOf(PW.leverB);
  const armRef = useRef<THREE.Group>(null);
  const o = useMemo(() => new THREE.Object3D(), []);
  useFrame(() => {
    const t = (Date.now() - PWS.t0) / 1000;
    const pos = strings.geometry.attributes.position as THREE.BufferAttribute;
    for (let k = 1; k <= PW.n; k++) {
      const b = bobBearing(k);
      const [dx, dz] = dirOf(b);
      const th = angle(k, t);
      const L = length(k);
      const px = dx * PW.r;
      const pz = dz * PW.r;
      // dao động theo phương bán kính (vuông góc hàng quả lắc)
      const s = Math.sin(th) * L;
      const bx = px + dx * s;
      const bz = pz + dz * s;
      const by = PW.pivotY - Math.cos(th) * L;
      o.position.set(bx, by, bz);
      // trục quay = tiếp tuyến; quả nghiêng theo dây
      o.rotation.set(0, -b * RAD, 0);
      o.rotateX(th);
      o.updateMatrix();
      inst.bob.forEach((im) => im.setMatrixAt(k - 1, o.matrix));
      pos.setXYZ((k - 1) * 2, px, PW.pivotY - 0.02, pz);
      pos.setXYZ((k - 1) * 2 + 1, bx, by + 0.1, bz);
    }
    pos.needsUpdate = true;
    inst.bob.forEach((im) => (im.instanceMatrix.needsUpdate = true));
    // cần gạt: kéo xuống rồi bật lại trong 0,8 s
    if (armRef.current) {
      const a = PWS.pull < 0 ? 0 : (performance.now() - PWS.pull) / 800;
      armRef.current.rotation.x = a >= 0 && a < 1 ? -Math.sin(a * Math.PI) * 1.1 : 0;
    }
  });

  return (
    <group>
      {[...inst.rail, ...inst.hook, ...inst.bob].map((im) => (
        <primitive key={im.uuid} object={im} />
      ))}
      <primitive object={strings} />
      <group position={[ldx * PW.leverR, 0, ldz * PW.leverR]} rotation-y={-PW.leverB * RAD}>
        <primitive object={parts.lever} />
        <group ref={armRef} position={[0, 0.75, 0]}>
          <primitive object={parts.arm} position={[0, -0.75, 0]} />
        </group>
        <Label3D text={vi ? "Con lắc sóng · 24 quả, Nₖ = 29 + k dao động / 90 s" : "Pendulum wave · 24 bobs, Nₖ = 29 + k swings / 90 s"} position={[0, 1.9, 0]} variant="small" maxDist={16} />
      </group>
    </group>
  );
}
