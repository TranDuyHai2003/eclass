"use client";
/**
 * Nhân vật VRM (VRoid) + hoạt ảnh procedural (đi, chạy, thở, tung phép, vui mừng) + vật lý tóc/váy (spring bone) + chớp mắt.
 * Khi chưa có file .vrm: nhân vật chibi dựng bằng khối toon để game vẫn chạy.
 */
import { useEffect, useMemo, useRef, useState } from "react";
import { useFrame } from "@react-three/fiber";
import { Outlines } from "@react-three/drei";
import * as THREE from "three";
import { GLTFLoader } from "three/examples/jsm/loaders/GLTFLoader.js";
import { mergeGeometries } from "three/examples/jsm/utils/BufferGeometryUtils.js";
import { VRMLoaderPlugin, VRMUtils, type VRM, type VRMHumanBoneName } from "@pixiv/three-vrm";
import { toonMaterial } from "../fx/shaders";
import { timeScale, useWorld, type ActClip } from "../store";
import { outlineOn } from "@/lib/world/perfGate";
import { CLIPS, loadLibrary, retargetClip, type ClipKey } from "./retarget";
import { worldAsset } from "@/lib/world/avatars";
import { RENDER_STYLE } from "../fx/renderStyle";
import { loadWithKtx2 } from "../fx/ktx2";
import { groundSpeedFromFeet, locoClip, strideTimeScale, type FootSample } from "@/lib/world/stride";

export type Pose = "idle" | "walk" | "run" | "cast" | "cheer" | "hurt" | "jump" | "slash" | "roll" | "fall" | "land" | "stance" | "swim" | "tread";
/** Vật cầm tay: mô hình + tay + khoảng dịch dọc trục cán (m) để tay nắm đúng chỗ */
export type Held = { obj: THREE.Object3D; hand: "right" | "left"; grip: number } | null;

const cache = new Map<string, Promise<VRM>>();
/**
 * Số chỗ đang dùng mỗi bản VRM (khoá cache). Bản của người chơi khác (`peer:<id>`) hết người dùng quá EVICT_MS thì bỏ khỏi
 * cache + huỷ geometry / vật liệu / texture / skeleton — mỗi bản được nạp riêng (GLTFLoader không dùng chung tài nguyên giữa
 * các lần nạp) nên huỷ không ảnh hưởng bản khác. NPC / người chơi giữ cache (quay lại cảnh không phải nạp lại).
 */
const users = new Map<string, number>();
const EVICT_MS = 15000;
const vrmKey = (url: string, instance: string) => (instance ? `${url}|${instance}` : url);
function retainVrm(key: string) {
  users.set(key, (users.get(key) ?? 0) + 1);
}
function releaseVrm(key: string, evict: boolean) {
  const n = (users.get(key) ?? 1) - 1;
  if (n > 0) return void users.set(key, n);
  users.delete(key);
  if (!evict) return;
  setTimeout(() => {
    if (users.get(key)) return;
    const p = cache.get(key);
    if (!p) return;
    cache.delete(key);
    p.then((vrm) => {
      vrm.scene.removeFromParent();
      VRMUtils.deepDispose(vrm.scene);
    }).catch(() => {});
  }, EVICT_MS);
}
/** dev: số bản VRM đang giữ (kiểm tra thu hồi bộ nhớ) */
if (typeof window !== "undefined" && process.env.NODE_ENV !== "production") (window as unknown as { __vrmCache: unknown }).__vrmCache = () => ({ cached: [...cache.keys()], users: Object.fromEntries(users) });

/** Thêm vật liệu viền (mặt sau, đẩy ra theo pháp tuyến) như cách three-vrm làm — cho model không có sẵn viền */
function addOutlinePass(mesh: THREE.Mesh) {
  const mat = mesh.material as THREE.Material & { isMToonMaterial?: boolean; isOutline?: boolean };
  if (Array.isArray(mesh.material) || !mat?.isMToonMaterial) {
    // Đã có pass viền: chỉ chỉnh độ dày / màu
    if (Array.isArray(mesh.material))
      for (const om of mesh.material as (THREE.Material & Record<string, unknown>)[]) {
        if (!om.isOutline) continue;
        om.outlineWidthMode = "worldCoordinates";
        om.outlineWidthFactor = 0.0032;
        (om.outlineColorFactor as THREE.Color | undefined)?.setRGB(0.16, 0.1, 0.14);
        om.needsUpdate = true;
      }
    return;
  }
  const outline = mat.clone() as typeof mat;
  outline.name += " (Outline)";
  outline.isOutline = true;
  outline.side = THREE.BackSide;
  mesh.material = [mat, outline];
  const g = mesh.geometry;
  const count = g.index ? g.index.count : g.attributes.position.count;
  g.clearGroups();
  g.addGroup(0, count, 0);
  g.addGroup(0, count, 1);
}
/**
 * Gộp các primitive CÙNG vật liệu của một lưới VRM: VRoid xuất tóc / thân thành hàng chục primitive dùng chung một vật liệu
 * (kokia 167, cute-girl 125 primitive → ~15 cặp lưới × vật liệu) → mỗi primitive một lệnh vẽ, ×2 với viền MToon.
 * Chỉ gộp lưới KHÔNG có morph target (biểu cảm trỏ tới từng primitive của mặt), cùng cha / skeleton / bindMatrix / biến đổi
 * cục bộ / bộ thuộc tính → hình giữ nguyên (thứ tự tam giác theo thứ tự primitive, như thứ tự vẽ cũ khi cùng vị trí).
 * Trả số lưới đã bỏ.
 */
function mergeVrmPrimitives(root: THREE.Object3D): number {
  const groups = new Map<string, THREE.SkinnedMesh[]>();
  root.traverse((o) => {
    const m = o as THREE.SkinnedMesh;
    if (!m.isSkinnedMesh || Array.isArray(m.material) || !m.parent || !m.skeleton) return;
    const g = m.geometry;
    if (Object.keys(g.morphAttributes).length || g.groups.length) return;
    const sig = Object.keys(g.attributes)
      .sort()
      .map((k) => {
        const a = g.attributes[k] as THREE.BufferAttribute;
        return `${k}:${a.itemSize}:${a.normalized}:${a.array.constructor.name}`;
      })
      .join(",");
    const key = `${m.parent.uuid}|${m.material.uuid}|${m.skeleton.uuid}|${g.index ? "i" : "n"}|${sig}`;
    const list = groups.get(key);
    if (list) list.push(m);
    else groups.set(key, [m]);
  });
  let removed = 0;
  for (const list of groups.values()) {
    if (list.length < 2) continue;
    const a = list[0];
    if (!list.every((m) => m.bindMatrix.equals(a.bindMatrix) && m.matrix.equals(a.matrix) && m.renderOrder === a.renderOrder && m.visible === a.visible)) continue;
    const merged = mergeGeometries(
      list.map((m) => m.geometry),
      false,
    );
    if (!merged) continue;
    a.geometry.dispose();
    a.geometry = merged;
    for (const m of list.slice(1)) {
      m.removeFromParent();
      m.geometry.dispose();
    }
    removed += list.length - 1;
  }
  return removed;
}
const NPC_POS = new THREE.Vector3();
// ── Đặt vũ khí vào nắm tay: dựng trục từ xương ngón (không phụ thuộc trục xương riêng của từng model)
const H_P = new THREE.Vector3();
const H_F = new THREE.Vector3();
const H_T = new THREE.Vector3();
const H_X = new THREE.Vector3();
const H_M = new THREE.Matrix4();
const H_INV = new THREE.Matrix4();
function placeHeld(vrm: VRM, held: NonNullable<Held>, group: THREE.Group) {
  const side = held.hand;
  const h = vrm.humanoid;
  const hand = h.getRawBoneNode(`${side}Hand` as VRMHumanBoneName);
  if (!hand) return;
  const mid = h.getRawBoneNode(`${side}MiddleProximal` as VRMHumanBoneName);
  const thumb = h.getRawBoneNode(`${side}ThumbProximal` as VRMHumanBoneName) ?? h.getRawBoneNode(`${side}ThumbMetacarpal` as VRMHumanBoneName);
  const lower = h.getRawBoneNode(`${side}LowerArm` as VRMHumanBoneName);
  hand.getWorldPosition(H_P);
  // F: hướng các ngón (cổ tay → gốc ngón giữa)
  if (mid) H_F.copy(mid.getWorldPosition(H_X)).sub(H_P).normalize();
  else if (lower) H_F.copy(H_P).sub(lower.getWorldPosition(H_X)).normalize();
  else H_F.set(0, -1, 0);
  // T: phía ngón cái, trực giao với F → trục cán vũ khí đi ra từ phía ngón cái của nắm tay
  if (thumb) H_T.copy(thumb.getWorldPosition(H_X)).sub(H_P);
  else H_T.set(0, 1, 0);
  H_T.addScaledVector(H_F, -H_T.dot(H_F));
  if (H_T.lengthSq() < 1e-6) H_T.set(0, 1, 0).addScaledVector(H_F, -H_F.y);
  H_T.normalize();
  // Lòng bàn tay ≈ cổ tay + 4,5 cm theo hướng ngón
  const cx = H_P.x + H_F.x * 0.045;
  const cy = H_P.y + H_F.y * 0.045;
  const cz = H_P.z + H_F.z * 0.045;
  H_X.crossVectors(H_T, H_F).normalize(); // X = Y × Z
  H_F.crossVectors(H_X, H_T).normalize(); // Z trực giao lại
  H_M.makeBasis(H_X, H_T, H_F);
  H_M.setPosition(cx - H_T.x * held.grip, cy - H_T.y * held.grip, cz - H_T.z * held.grip);
  const parent = group.parent;
  if (!parent) return;
  parent.updateWorldMatrix(true, false);
  H_INV.copy(parent.matrixWorld).invert();
  H_M.premultiply(H_INV);
  H_M.decompose(group.position, group.quaternion, group.scale);
}
const CAM_POS = new THREE.Vector3();
type OutlineMat = THREE.Material & { outlineWidthFactor?: number };
/** Giữ viền mực ~1,6 px CSS ở mọi khoảng cách / màn hình (worldCoordinates cố định thì xa là mất viền) */
function fitOutline(vrm: VRM, camera: THREE.Camera, heightPx: number) {
  const mats = vrm.scene.userData.outlineMats as OutlineMat[] | undefined;
  if (!mats?.length) return;
  vrm.scene.getWorldPosition(NPC_POS);
  camera.getWorldPosition(CAM_POS);
  const dist = Math.max(0.5, NPC_POS.distanceTo(CAM_POS));
  const fov = ((camera as THREE.PerspectiveCamera).fov ?? 45) * (Math.PI / 180);
  const pxPerM = heightPx / (2 * dist * Math.tan(fov / 2));
  const w = Math.min(0.012, Math.max(0.0018, 1.6 / pxPerM));
  for (const m of mats) m.outlineWidthFactor = w;
}
type ToonMat = THREE.Material & Record<string, unknown> & { isMToonMaterial?: boolean; isOutline?: boolean };
type ToonSnap = { toony: number; shift: number; gi: number; shade: THREE.Color; rim: THREE.Color; rimPow: number; rimLift: number; base: THREE.Color | null };
/**
 * Đổi phong cách nhân vật theo RENDER_STYLE (gọi mỗi khung, chỉ làm việc khi phong cách đổi):
 *  • hoạt hình: cel 2 mảng (toony 0,95) + viền mực MToon;
 *  • siêu thực (kiểu Endfield): KHÔNG viền, chuyển sáng-tối mềm (toony 0,3), bóng sâu hơn & lạnh (tương phản ~3:1),
 *    ánh môi trường có hướng (giEqualization 0,5), rim xanh lạnh ôm silhouette (thay viền tối); mặt giữ sáng để đọc biểu cảm.
 */
function applyAvatarStyle(vrm: VRM, real: boolean) {
  if (vrm.scene.userData.styleReal === real) return;
  vrm.scene.userData.styleReal = real;
  vrm.scene.traverse((o) => {
    const mesh = o as THREE.Mesh;
    if (!mesh.isMesh) return;
    for (const m of (Array.isArray(mesh.material) ? mesh.material : [mesh.material]) as ToonMat[]) {
      if (!m?.isMToonMaterial) continue;
      if (m.isOutline) {
        m.visible = !real;
        continue;
      }
      const shade = m.shadeColorFactor as THREE.Color | undefined;
      const rim = m.parametricRimColorFactor as THREE.Color | undefined;
      if (!shade || !rim) continue;
      const snap = (m.userData.toonSnap ??= {
        toony: m.shadingToonyFactor as number,
        shift: m.shadingShiftFactor as number,
        gi: m.giEqualizationFactor as number,
        shade: shade.clone(),
        rim: rim.clone(),
        rimPow: m.parametricRimFresnelPowerFactor as number,
        rimLift: m.parametricRimLiftFactor as number,
        base: (m.color as THREE.Color | undefined)?.clone() ?? null,
      }) as ToonSnap;
      const isFace = /FACE|EYE|Face|Eye|Brow|Mouth/.test(m.name ?? "");
      if (real && !isFace) {
        m.shadingToonyFactor = 0.3;
        m.giEqualizationFactor = 0.6;
        const base = m.color as THREE.Color | undefined;
        // MToon không phơi sáng vật lý: nắng chính 3,2 của cảnh siêu thực làm áo trắng cháy sáng → hạ màu gốc 22%
        if (base && snap.base) base.copy(snap.base).multiplyScalar(0.78);
        // Endfield / Wuthering Waves: bóng có chiều sâu (không bệt sáng), rim chỉ là sợi sáng mảnh ở mép ngược sáng
        if (base) shade.copy(base).multiply(new THREE.Color(0.5, 0.53, 0.66));
        rim.setRGB(0.13, 0.19, 0.28);
        m.parametricRimFresnelPowerFactor = 5;
        m.parametricRimLiftFactor = 0;
        m.shadingShiftFactor = 0.05;
      } else {
        m.shadingToonyFactor = snap.toony;
        m.shadingShiftFactor = snap.shift;
        m.giEqualizationFactor = snap.gi;
        shade.copy(snap.shade);
        rim.copy(real ? new THREE.Color(0.22, 0.32, 0.42) : snap.rim);
        m.parametricRimFresnelPowerFactor = snap.rimPow;
        m.parametricRimLiftFactor = snap.rimLift;
        if (snap.base) (m.color as THREE.Color | undefined)?.copy(snap.base);
      }
    }
  });
}
const FOOT_A = new THREE.Vector3();
/**
 * Sải chân kiểu anime: clip thư viện có sải ngắn (nhân vật VRM thấp) → để chân không trượt ở 4–7 m/s phải phát nhanh 2–3,5 lần
 * (bước lít nhít). Khuếch đại góc khớp đùi / gối sau khi mixer cập nhật → sải dài hơn, nhịp bước chậm lại tự nhiên.
 */
const STRIDE_AMP: Record<string, number> = { walk: 1.15, run: 1.35, sprint: 1.35 };
const AMP_Q = new THREE.Quaternion();
const AMP_AX = new THREE.Vector3();
function scaleRot(o: THREE.Object3D | null, k: number) {
  if (!o || k === 1) return;
  const q = o.quaternion;
  const w = Math.min(1, Math.max(-1, q.w));
  const ang = 2 * Math.acos(Math.abs(w));
  const sn = Math.sqrt(Math.max(0, 1 - w * w));
  if (ang < 1e-4 || sn < 1e-6) return;
  const sg = w < 0 ? -1 : 1;
  AMP_AX.set((q.x / sn) * sg, (q.y / sn) * sg, (q.z / sn) * sg);
  o.quaternion.copy(AMP_Q.setFromAxisAngle(AMP_AX, Math.min(Math.PI * 0.9, ang * k)));
}
function amplifyStride(vrm: VRM, amp: number) {
  if (amp === 1) return;
  const h = vrm.humanoid;
  scaleRot(h.getNormalizedBoneNode("leftUpperLeg"), amp);
  scaleRot(h.getNormalizedBoneNode("rightUpperLeg"), amp);
  const knee = 1 + (amp - 1) * 0.6;
  scaleRot(h.getNormalizedBoneNode("leftLowerLeg"), knee);
  scaleRot(h.getNormalizedBoneNode("rightLowerLeg"), knee);
  // (không khuếch đại tay: tư thế nghỉ normalized là chữ T → góc tay đã gồm ~70° hạ tay, nhân lên sẽ đâm vào người)
}
const NPC_SPHERE = new THREE.Sphere(new THREE.Vector3(), 1.3);
const NPC_PROJ = new THREE.Matrix4();
const NPC_FRUSTUM = new THREE.Frustum();
const MOVE_P = new THREE.Vector3();
const MOVE_S = new THREE.Vector3();
const FOOT_B = new THREE.Vector3();

/** instance: khoá phân biệt nhiều bản của cùng một model (một VRM không thể ở hai nơi cùng lúc) */
function loadVrm(url: string, instance = ""): Promise<VRM> {
  const key = vrmKey(url, instance);
  if (!cache.has(key)) {
    const loader = new GLTFLoader();
    loader.register((parser) => new VRMLoaderPlugin(parser));
    const p = loadWithKtx2(loader, url).then((gltf) => {
        const vrm = gltf.userData.vrm as VRM;
        VRMUtils.removeUnnecessaryVertices(gltf.scene);
        VRMUtils.combineSkeletons(gltf.scene);
        // hàng chục primitive tóc / thân cùng vật liệu → một lưới (giảm lệnh vẽ ở mọi cảnh; hình không đổi)
        const merged = mergeVrmPrimitives(gltf.scene);
        if (process.env.NODE_ENV !== "production" && merged) console.debug("[world] VRM gộp primitive", url.split("/").pop(), "−" + merged);
        VRMUtils.rotateVRM0(vrm); // VRM0 nhìn về -Z → quay về +Z như VRM1
        vrm.scene.traverse((o) => {
          const mesh = o as THREE.Mesh;
          if (!mesh.isMesh) return;
          // khối bao bảo thủ thay cho frustumCulled = false: khối bao của tư thế gốc (chữ T) nới thêm cho tóc / váy lò xo, đòn
          // đánh, cú lăn → nhân vật ngoài khung nhìn (theo TỪNG máy quay: chính, phản chiếu, cổng, bóng) không bị gửi lệnh vẽ
          if ((mesh as THREE.SkinnedMesh).isSkinnedMesh) {
            const g = mesh.geometry;
            g.computeBoundingBox();
            const sphere = g.boundingBox!.getBoundingSphere(new THREE.Sphere());
            sphere.radius = Math.max(sphere.radius, 0.9) + 0.6;
            (mesh as THREE.SkinnedMesh).boundingSphere = sphere;
          }
          for (const m of (Array.isArray(mesh.material) ? mesh.material : [mesh.material]) as (THREE.Material & Record<string, unknown>)[]) {
            if (!m) continue;
            // Lọc anisotropic cho texture nhân vật — sắc nét khi nhìn cận
            for (const k of ["map", "shadeMultiplyTexture", "normalMap", "emissiveMap"]) {
              const tex = m[k] as THREE.Texture | undefined;
              if (tex && (tex as THREE.Texture).isTexture) tex.anisotropy = 8;
            }
            if (!(m as { isMToonMaterial?: boolean }).isMToonMaterial) continue;
            // Mặt / mắt VRoid được chỉnh sẵn để luôn sáng (quy ước anime) — không ép bóng cứng lên mặt
            const isFace = /FACE|EYE|Face|Eye|Brow|Mouth/.test(m.name ?? "");
            // Viền sáng ấm (rim) + vùng tối gọn, hơi tím — tông anime
            (m.parametricRimColorFactor as THREE.Color | undefined)?.setRGB(0.45, 0.36, 0.3);
            m.parametricRimFresnelPowerFactor = 4;
            m.parametricRimLiftFactor = 0.02;
            // Chia mảng sáng/tối dứt khoát kiểu vẽ tay
            if (!isFace) {
              m.shadingToonyFactor = 0.95;
              // Mảng sáng rộng hơn (mép bóng lùi về phía sau) như nhân vật Genshin / Honkai
              m.shadingShiftFactor = -0.28;
              // Vùng tối = màu gốc pha sắc tím hồng, chỉ tối hơn ~25% (không bệt xám)
              const shade = m.shadeColorFactor as THREE.Color | undefined;
              const base = m.color as THREE.Color | undefined;
              if (shade && base) shade.copy(base).multiply(new THREE.Color(0.8, 0.74, 0.9)).lerp(shade, 0.25);
            }
            // Ánh sáng môi trường chia đều (không bị đen phía khuất)
            m.giEqualizationFactor = 0.95;
            // Viền mực (outline) — sinh pass viền như three-vrm nếu model chưa có
            m.outlineWidthMode = "worldCoordinates";
            m.outlineWidthFactor = 0.0032;
            // Viền mang sắc của bề mặt (nâu đỏ trên da, sẫm màu tóc trên tóc) như Guilty Gear / Genshin
            (m.outlineColorFactor as THREE.Color | undefined)?.setRGB(0.4, 0.33, 0.4);
            m.outlineLightingMixFactor = 0.85;
            m.needsUpdate = true;
          }
          addOutlinePass(mesh);
          const outs = (vrm.scene.userData.outlineMats ??= []) as OutlineMat[];
          for (const m of (Array.isArray(mesh.material) ? mesh.material : [mesh.material]) as (THREE.Material & { isOutline?: boolean })[])
            if (m?.isOutline && !outs.includes(m)) outs.push(m);
        });
        return vrm;
      });
    // nạp lỗi: bỏ promise hỏng khỏi cache (lần sau thử lại được)
    p.catch(() => cache.get(key) === p && cache.delete(key));
    cache.set(key, p);
  }
  return cache.get(key)!;
}

export function Avatar({ url, pose = "idle", speed = 0, scale = 1, npc = false, emote = null, expression = null, instance = "", actId = 0, actClip = null, held = null }: { url?: string; pose?: Pose; speed?: number; scale?: number; npc?: boolean; emote?: string | null; expression?: string | null; instance?: string; actId?: number; actClip?: ActClip | null; held?: Held }) {
  const [vrm, setVrm] = useState<VRM | null>(null);
  const [failed, setFailed] = useState(false);
  useEffect(() => {
    let alive = true;
    setVrm(null);
    setFailed(false);
    if (!url) {
      setFailed(true);
      return;
    }
    const key = vrmKey(url, instance);
    retainVrm(key);
    loadVrm(url, instance)
      .then((v) => alive && setVrm(v))
      .catch((e) => {
        console.warn("[world] không tải được VRM", url, e);
        if (alive) setFailed(true);
      });
    return () => {
      alive = false;
      releaseVrm(key, instance.startsWith("peer:"));
    };
  }, [url, instance]);

  if (vrm) return <VrmRig vrm={vrm} pose={pose} speed={speed} scale={scale} npc={npc} emote={emote} expression={expression} actId={actId} actClip={actClip} held={held} />;
  return <ChibiFallback pose={pose} speed={speed} loading={!failed} />;
}

const POSE_CLIP: Record<Pose, ClipKey> = { idle: "idle", walk: "walk", run: "run", cast: "cast", cheer: "cheer", hurt: "hurt", jump: "jump", slash: "slash", roll: "roll", fall: "fall", land: "land", stance: "stance", swim: "swim", tread: "tread" };
/** Động tác một lần (đòn đánh…): vào nhanh 0,06 s như game hành động; còn lại chuyển mềm */
const ONE_SHOT = new Set<Pose>(["slash", "cast", "roll", "jump", "hurt", "land"]);

/** Animation thật (Quaternius UAL retarget) — trả về null nếu không tải được → dùng hoạt ảnh procedural */
/**
 * Tốc độ mặt đất của clip tại chỗ (m/s ở tốc độ phát 1): lấy mẫu 48 lần một chu kỳ bằng mixer tạm,
 * đo bàn chân trụ lùi về sau so với hông (lib/world/stride.ts). Mixer chính ghi đè tư thế ở khung kế tiếp.
 */
const SPEED_A = new THREE.Vector3();
const SPEED_B = new THREE.Vector3();
const SPEED_H = new THREE.Vector3();
function clipGroundSpeed(vrm: VRM, clip: THREE.AnimationClip): number {
  const lf = vrm.humanoid.getRawBoneNode("leftFoot");
  const rf = vrm.humanoid.getRawBoneNode("rightFoot");
  const hips = vrm.humanoid.getRawBoneNode("hips");
  if (!lf || !rf || !hips) return 0;
  const m = new THREE.AnimationMixer(vrm.scene);
  const a = m.clipAction(clip);
  a.play();
  const samples: FootSample[] = [];
  const N = 48;
  for (let i = 0; i <= N; i++) {
    const t = (i / N) * clip.duration;
    m.setTime(t);
    vrm.humanoid.update();
    vrm.scene.updateMatrixWorld(true);
    // toạ độ trong hệ của vrm.scene (mặt nhân vật = +z), trừ hông để bỏ chuyển động gốc nếu clip có
    vrm.scene.worldToLocal(hips.getWorldPosition(SPEED_H));
    vrm.scene.worldToLocal(lf.getWorldPosition(SPEED_A));
    vrm.scene.worldToLocal(rf.getWorldPosition(SPEED_B));
    samples.push({ t, lz: SPEED_A.z - SPEED_H.z, ly: SPEED_A.y, rz: SPEED_B.z - SPEED_H.z, ry: SPEED_B.y });
  }
  a.stop();
  m.uncacheRoot(vrm.scene);
  return groundSpeedFromFeet(samples);
}

function useClips(vrm: VRM) {
  const [mixer, setMixer] = useState<{ mixer: THREE.AnimationMixer; actions: Partial<Record<ClipKey, THREE.AnimationAction>>; lib: Awaited<ReturnType<typeof loadLibrary>>; extra: Map<string, THREE.AnimationAction>; ground: Partial<Record<ClipKey, number>> } | null>(null);
  useEffect(() => {
    let alive = true;
    loadLibrary(worldAsset("anim/ual.glb"), worldAsset("anim/ual2.glb"))
      .then((lib) => {
        if (!alive) return;
        const m = new THREE.AnimationMixer(vrm.scene);
        const actions: Partial<Record<ClipKey, THREE.AnimationAction>> = {};
        (Object.keys(CLIPS) as ClipKey[]).forEach((k) => {
          const clip = retargetClip(lib, CLIPS[k], vrm);
          if (!clip) return;
          const a = m.clipAction(clip);
          if (k === "cast" || k === "hurt" || k === "jump" || k === "interact" || k === "slash" || k === "roll" || k === "land") {
            a.setLoop(THREE.LoopOnce, 1);
            a.clampWhenFinished = true;
          }
          actions[k] = a;
        });
        // đo một lần / model (giữ trong vrm.userData — các bản NPC cùng model dùng lại)
        const ground = ((vrm.scene.userData.clipGround as Partial<Record<ClipKey, number>> | undefined) ??= {});
        for (const k of ["walk", "run", "sprint"] as ClipKey[]) if (ground[k] === undefined && actions[k]) ground[k] = clipGroundSpeed(vrm, actions[k]!.getClip());
        if (actions.idle) {
          actions.idle.play();
          setMixer({ mixer: m, actions, lib, extra: new Map(), ground });
        }
      })
      .catch((e) => console.warn("[world] không tải được thư viện animation", e));
    return () => {
      alive = false;
    };
  }, [vrm]);
  return mixer;
}

/** Chiều cao cổ chân lúc đứng nghỉ (đo một lần khi nạp) */
function restFootHeight(vrm: VRM): number {
  const k = "__footRest";
  const store = vrm as unknown as Record<string, number>;
  if (store[k] === undefined) {
    vrm.scene.updateMatrixWorld(true);
    const base = vrm.scene.getWorldPosition(new THREE.Vector3()).y;
    const lf = vrm.humanoid.getRawBoneNode("leftFoot");
    const rf = vrm.humanoid.getRawBoneNode("rightFoot");
    const ys = [lf, rf].filter(Boolean).map((b) => b!.getWorldPosition(new THREE.Vector3()).y - base);
    store[k] = ys.length ? Math.min(...ys) : 0.08;
  }
  return store[k];
}

function VrmRig({ vrm, pose, speed, scale, npc, emote, expression, actId, actClip, held }: { vrm: VRM; pose: Pose; speed: number; scale: number; npc: boolean; emote: string | null; expression: string | null; actId: number; actClip: ActClip | null; held: Held }) {
  const heldGroup = useRef<THREE.Group>(null);
  const acc = useRef(0);
  const footRest = useMemo(() => restFootHeight(vrm), [vrm]);
  /** Đặt chân bám đất: dịch cả model sao cho bàn chân thấp nhất chạm mặt (y = 0 của nhóm cha) */
  const plantFeet = () => {
    const lf = vrm.humanoid.getRawBoneNode("leftFoot");
    const rf = vrm.humanoid.getRawBoneNode("rightFoot");
    const parent = vrm.scene.parent;
    if (!lf || !rf || !parent) return;
    // getWorldPosition tự cập nhật chuỗi cha của bàn chân — không cần cập nhật lại cả cây xương (~1 ms / khung)
    const groundY = parent.getWorldPosition(NPC_POS).y;
    const footY = Math.min(lf.getWorldPosition(FOOT_A).y, rf.getWorldPosition(FOOT_B).y) - groundY;
    const err = footRest - footY; // >0: chân đang thấp hơn mặt đất
    vrm.scene.position.y += err * 0.5;
  };
  const anim = useClips(vrm);
  const current = useRef<ClipKey>("idle");
  const playing = useRef<THREE.AnimationAction | null>(null);
  useEffect(() => {
    if (!anim) return;
    let next: THREE.AnimationAction | undefined;
    // Clip tự do (thế võ / động tác tự chọn) — retarget lần đầu rồi giữ trong bộ nhớ
    const extraClip = (name: string, once: boolean) => {
      let a = anim.extra.get(name);
      if (!a) {
        const clip = retargetClip(anim.lib, name, vrm);
        if (!clip) return undefined;
        a = anim.mixer.clipAction(clip);
        if (once) {
          a.setLoop(THREE.LoopOnce, 1);
          a.clampWhenFinished = true;
        }
        anim.extra.set(name, a);
      }
      return a;
    };
    // Thế võ: đoạn clip riêng của từng nhát (chỉ khi đang ở động tác một lần tương ứng)
    const useAct = !!actClip && (pose === "slash" || pose === "cast" || pose === "roll");
    if (useAct) next = extraClip(actClip!.name, true);
    // Động tác tự chọn (chỉ khi đứng yên) — retarget lần đầu rồi giữ trong bộ nhớ
    if (!next && emote && pose === "idle") next = extraClip(emote, !emote.endsWith("_Loop"));
    if (!next) {
      const key = POSE_CLIP[pose];
      current.current = key;
      next = anim.actions[key] ?? anim.actions.idle!;
    }
    const prev = playing.current;
    const oneShot = ONE_SHOT.has(pose) && !(emote && pose === "idle");
    // Đòn chém: mỗi nhát trong chuỗi bắt đầu ở điểm khác + tốc độ khác (đỡ lặp, nhanh dứt khoát)
    const shape = () => {
      if (useAct) {
        next!.time = actClip!.from;
        next!.setEffectiveTimeScale(actClip!.speed);
      } else if (pose === "slash") {
        const v = actId % 3;
        next!.time = [0.08, 0.18, 0.02][v];
        next!.setEffectiveTimeScale([1.55, 1.75, 1.25][v]);
      } else if (pose === "cast") next!.setEffectiveTimeScale(1.4);
      else if (pose === "roll") next!.setEffectiveTimeScale(1.5);
      else next!.setEffectiveTimeScale(1);
    };
    if (prev === next) {
      // Cùng động tác nhưng là lần bấm mới → phát lại ngay (đánh liên hoàn)
      if (oneShot && actId !== lastAct.current) {
        lastAct.current = actId;
        next.reset().setEffectiveWeight(1).play();
        shape();
      }
      return;
    }
    lastAct.current = actId;
    playing.current = next;
    const fade = oneShot ? 0.06 : prev && ONE_SHOT.has(lastPoseRef.current) ? 0.14 : 0.22;
    next.reset().setEffectiveWeight(1).fadeIn(fade).play();
    shape();
    if (prev) prev.fadeOut(fade);
    lastPoseRef.current = pose;
  }, [anim, pose, emote, vrm, actId, actClip]);
  const lastAct = useRef(0);
  const lastPoseRef = useRef<Pose>("idle");
  const phase = useRef(0);
  const blink = useRef({ next: 2, t: 0 });
  const poseT = useRef(0);
  const lastPose = useRef<Pose>(pose);
  const moveRef = useRef({ p: new THREE.Vector3(), v: 0, init: false, dir: new THREE.Vector3(0, 0, 1), foot: new THREE.Vector3(), footSide: 0, hold: 0, ts: 1 });

  useFrame((state, rawDt) => {
    applyAvatarStyle(vrm, RENDER_STYLE.real);
    // viền MToon (thêm một lượt vẽ toàn bộ lưới da) chỉ cho nhân vật gần; NPC / người khác ở xa hoặc máy yếu: tắt (viền mực
    // hậu kỳ Ink vẫn vẽ bóng dáng) — lib/world/perfGate.outlineOn, có trễ để khỏi nháy
    const ud = vrm.scene.userData as { outlineNear?: boolean; outlineMats?: OutlineMat[] };
    const dist = npc ? vrm.scene.getWorldPosition(NPC_POS).distanceTo(state.camera.position) : 0;
    ud.outlineNear = outlineOn(dist, ud.outlineNear ?? true, npc, useWorld.getState().quality);
    const on = !RENDER_STYLE.real && ud.outlineNear;
    const outs = ud.outlineMats;
    if (outs?.length && outs[0].visible !== on) for (const m of outs) m.visible = on;
    const dt = rawDt * timeScale();
    const h = vrm.humanoid;
    const bone = (n: VRMHumanBoneName) => h.getNormalizedBoneNode(n);
    // NPC xa (> 14 m): cập nhật ~12 lần/giây thay vì mỗi khung hình
    // NPC: xương lò xo (tóc / áo) + hoạt ảnh là phần tốn CPU nhất của khung hình → giảm tần số cập nhật:
    // ngoài khung nhìn 4 Hz, xa (> 14 m) 12 Hz, gần 30 Hz; người chơi luôn mỗi khung
    if (npc) {
      vrm.scene.getWorldPosition(NPC_POS);
      acc.current += rawDt;
      NPC_SPHERE.center.copy(NPC_POS).y += 0.9;
      NPC_PROJ.multiplyMatrices(state.camera.projectionMatrix, state.camera.matrixWorldInverse);
      NPC_FRUSTUM.setFromProjectionMatrix(NPC_PROJ);
      const hz = !NPC_FRUSTUM.intersectsSphere(NPC_SPHERE) ? 4 : NPC_POS.distanceTo(state.camera.position) > 14 ? 12 : 30;
      if (acc.current < 1 / hz) return;
    }
    if (on) fitOutline(vrm, state.camera, state.size.height);
    const stepDt = npc ? Math.min(0.25, acc.current) * timeScale() : dt;
    acc.current = 0;
    // vận tốc ngang THẬT của nhân vật (làm mượt ~0,1 s) → tốc độ phát clip đi / chạy khớp bước chân (không trượt)
    vrm.scene.getWorldPosition(MOVE_P);
    vrm.scene.getWorldScale(MOVE_S);
    if (moveRef.current.init && stepDt > 0) {
      const v = Math.hypot(MOVE_P.x - moveRef.current.p.x, MOVE_P.z - moveRef.current.p.z) / Math.max(1e-3, npc ? Math.max(stepDt, rawDt) : rawDt);
      // dịch chuyển tức thời (dịch chuyển / hồi sinh) không tính
      if (v < 30) moveRef.current.v += (v - moveRef.current.v) * (1 - Math.exp(-rawDt / 0.12));
      const ddx = MOVE_P.x - moveRef.current.p.x;
      const ddz = MOVE_P.z - moveRef.current.p.z;
      const dl = Math.hypot(ddx, ddz);
      if (dl > 1e-4 && v < 30) moveRef.current.dir.set(ddx / dl, 0, ddz / dl);
    }
    moveRef.current.p.copy(MOVE_P);
    moveRef.current.init = true;
    if (anim) {
      const vNow = moveRef.current.v / Math.max(1e-3, timeScale());
      // đang di chuyển: chọn clip theo VẬN TỐC THẬT (đi / chạy / chạy nước rút) rồi chuyển mượt 0,25 s
      if (pose === "walk" || pose === "run") {
        const cur = current.current;
        const want = locoClip(vNow, cur === "walk" || cur === "run" || cur === "sprint" ? cur : null);
        const next = anim.actions[want];
        moveRef.current.hold -= rawDt;
        // giữ clip ≥ 0,4 s (khung không đều / đang tăng tốc không làm clip nhảy qua lại)
        if (want !== cur && next && moveRef.current.hold <= 0) {
          moveRef.current.hold = 0.4;
          next.reset().setEffectiveWeight(1).fadeIn(0.25).play();
          anim.actions[cur]?.fadeOut(0.25);
          playing.current = next;
          current.current = want;
        }
      }
      const k = current.current;
      const loco = k === "walk" || k === "run" || k === "sprint";
      // tốc độ phát = vận tốc thật / tốc độ mặt đất của clip (đo khi nạp) → bàn chân trụ đứng yên trên mặt đất
      // sải chân đã khuếch đại (amplifyStride) → clip "đi" được xa hơn mỗi chu kỳ → nhịp bước chậm lại tương ứng
      const clipV = (loco ? (anim.ground[k] ?? 0) * STRIDE_AMP[k] : 0) * MOVE_S.x;
      const cal = ((vrm.scene.userData.clipCal ??= {}) as Record<string, number>);
      const target = loco ? (clipV > 0.05 ? strideTimeScale(vNow * (cal[k] ?? 1), clipV, 0.6, 3.2) : Math.max(0.7, speed)) : 1;
      // tốc độ phát tiến dần về đích (hằng thời gian ~0,15 s) — không giật theo từng khung khi FPS dao động
      const M0 = moveRef.current;
      M0.ts = loco ? M0.ts + (target - M0.ts) * (1 - Math.exp(-rawDt / 0.15)) : 1;
      const walkScale = M0.ts;
      anim.actions[k]?.setEffectiveTimeScale(walkScale);
      anim.mixer.update(stepDt);
      if (loco) amplifyStride(vrm, STRIDE_AMP[k]);
      updateFace(vrm, pose, stepDt, blink.current, expression);
      vrm.update(stepDt);
      plantFeet();
      // tự hiệu chỉnh chống trượt: bàn chân đang chạm đất trôi THEO hướng đi → hoạt ảnh chậm hơn thân → tăng tốc phát (và ngược lại)
      if (loco && !npc && vNow > 0.8 && rawDt > 0) {
        const lf = vrm.humanoid.getRawBoneNode("leftFoot");
        const rf = vrm.humanoid.getRawBoneNode("rightFoot");
        if (lf && rf) {
          lf.getWorldPosition(FOOT_A);
          rf.getWorldPosition(FOOT_B);
          const side = FOOT_A.y < FOOT_B.y ? 1 : 2;
          const low = side === 1 ? FOOT_A : FOOT_B;
          const groundY = vrm.scene.parent ? vrm.scene.parent.getWorldPosition(NPC_POS).y : 0;
          const M = moveRef.current;
          if (low.y - groundY < footRest + 0.04 && M.footSide === side) {
            const along = ((low.x - M.foot.x) * M.dir.x + (low.z - M.foot.z) * M.dir.z) / rawDt;
            const e = Math.max(-0.6, Math.min(0.6, along / vNow));
            cal[k] = Math.max(0.5, Math.min(3, (cal[k] ?? 1) * Math.exp(e * rawDt * 1.2)));
          }
          M.foot.copy(low);
          M.footSide = side;
        }
      }
      if (held && heldGroup.current) placeHeld(vrm, held, heldGroup.current);
      return;
    }
    if (lastPose.current !== pose) {
      lastPose.current = pose;
      poseT.current = 0;
    }
    poseT.current += dt;
    const moving = pose === "walk" || pose === "run";
    const amp = pose === "run" ? 1 : pose === "walk" ? 0.6 : 0;
    phase.current += dt * (pose === "run" ? 11 : 7) * (moving ? Math.max(0.6, speed) : 0);
    const s = Math.sin(phase.current);
    const c = Math.cos(phase.current);
    const t = state.clock.elapsedTime;
    const breathe = Math.sin(t * 2) * 0.03;
    const lerp = (o: THREE.Object3D | null, x: number, y: number, z: number, k = 12) => {
      if (!o) return;
      const a = Math.min(1, dt * k);
      o.rotation.x += (x - o.rotation.x) * a;
      o.rotation.y += (y - o.rotation.y) * a;
      o.rotation.z += (z - o.rotation.z) * a;
    };
    // Chân
    lerp(bone("leftUpperLeg"), -s * 0.7 * amp, 0, 0);
    lerp(bone("rightUpperLeg"), s * 0.7 * amp, 0, 0);
    lerp(bone("leftLowerLeg"), Math.max(0, c) * 1.1 * amp, 0, 0);
    lerp(bone("rightLowerLeg"), Math.max(0, -c) * 1.1 * amp, 0, 0);
    // Thân + đầu
    const hips = bone("hips");
    if (hips) hips.position.y = Math.abs(s) * 0.04 * amp + breathe * 0.3;
    lerp(bone("spine"), (pose === "run" ? 0.18 : 0.05 * amp) + breathe, s * 0.08 * amp, 0);
    // Tay: hạ khỏi tư thế chữ T, vung theo bước
    let lArm: [number, number, number] = [s * 0.5 * amp, 0, -1.2 + breathe];
    let rArm: [number, number, number] = [-s * 0.5 * amp, 0, 1.2 - breathe];
    const lFore: [number, number, number] = [0, 0, 0];
    let rFore: [number, number, number] = [0, pose === "run" ? -1.2 : -0.25, 0];
    let head: [number, number, number] = [0, 0, 0];
    if (pose === "cast") {
      // Đưa tay phải ra trước niệm phép, tay trái giữ thăng bằng
      rArm = [-1.3, 0.3, 0.15];
      rFore = [0, -0.2, 0];
      lArm = [0.2, 0, -1.0];
      head = [0.1, -0.1, 0];
    } else if (pose === "cheer") {
      const w = Math.sin(poseT.current * 12) * 0.25;
      lArm = [0, 0, 0.3 + w];
      rArm = [0, 0, -0.3 - w];
      head = [-0.15, 0, 0];
    } else if (pose === "hurt") {
      lArm = [-0.6, 0, -0.6];
      rArm = [-0.6, 0, 0.6];
      head = [0.25, 0, 0];
    }
    lerp(bone("leftUpperArm"), ...lArm);
    lerp(bone("rightUpperArm"), ...rArm);
    lerp(bone("leftLowerArm"), ...lFore);
    lerp(bone("rightLowerArm"), ...rFore);
    lerp(bone("head"), ...head, 8);

    updateFace(vrm, pose, dt, blink.current);
    vrm.update(dt);
  });

  return (
    <>
      <primitive object={vrm.scene} scale={scale} />
      <group ref={heldGroup}>{held && <primitive object={held.obj} />}</group>
    </>
  );
}

/** Chớp mắt ngẫu nhiên + biểu cảm theo động tác */
function updateFace(vrm: VRM, pose: Pose, dt: number, b: { next: number; t: number }, held: string | null = null) {
  const em = vrm.expressionManager;
  if (!em) return;
  b.t += dt;
  let v = 0;
  if (b.t > b.next) {
    const k = (b.t - b.next) / 0.14;
    v = k < 1 ? Math.sin(k * Math.PI) : 0;
    if (k >= 1) {
      b.t = 0;
      b.next = 2 + Math.random() * 3;
    }
  }
  for (const k of ["happy", "relaxed", "surprised", "sad", "angry"]) em.setValue(k, 0);
  const face = held ?? (pose === "cheer" ? "happy" : pose === "hurt" ? "sad" : null);
  if (face) em.setValue(face, face === "sad" && !held ? 0.6 : 1);
  em.setValue("blink", face === "happy" || face === "relaxed" ? 0 : v);
}

/** Nhân vật dự phòng: chibi khối toon (đầu to, tóc, áo choàng) */
function ChibiFallback({ pose, speed, loading }: { pose: Pose; speed: number; loading: boolean }) {
  const g = useRef<THREE.Group>(null);
  const legL = useRef<THREE.Mesh>(null);
  const legR = useRef<THREE.Mesh>(null);
  const armL = useRef<THREE.Group>(null);
  const armR = useRef<THREE.Group>(null);
  const mats = useMemo(
    () => ({
      skin: toonMaterial("#ffe1cf", { rim: "#ffd6c4" }),
      hair: toonMaterial("#5b6cff", { rim: "#b8c3ff" }),
      cloth: toonMaterial("#ffffff", { rim: "#cfe9ff" }),
      accent: toonMaterial("#ff7eb6", { rim: "#ffd0e6" }),
      dark: toonMaterial("#2b2d42"),
    }),
    [],
  );
  const phase = useRef(0);
  useFrame((state, rawDt) => {
    const dt = rawDt * timeScale();
    const moving = pose === "walk" || pose === "run";
    phase.current += dt * (pose === "run" ? 12 : 8) * (moving ? Math.max(0.6, speed) : 0);
    const s = Math.sin(phase.current) * (moving ? 0.7 : 0);
    if (legL.current) legL.current.rotation.x = s;
    if (legR.current) legR.current.rotation.x = -s;
    if (armL.current) armL.current.rotation.x = pose === "cheer" ? -2.6 : -s;
    if (armR.current) armR.current.rotation.x = pose === "cast" ? -1.5 : pose === "cheer" ? -2.6 : s;
    if (g.current) g.current.position.y = Math.abs(Math.sin(phase.current)) * 0.06 + Math.sin(state.clock.elapsedTime * 2) * 0.015 + (loading ? Math.sin(state.clock.elapsedTime * 4) * 0.05 : 0);
  });
  return (
    <group ref={g}>
      {/* Đầu */}
      <mesh position={[0, 1.25, 0]} material={mats.skin} castShadow>
        <sphereGeometry args={[0.32, 32, 24]} />
        <Outlines thickness={0.02} color="#2b2d42" />
      </mesh>
      {/* Tóc */}
      <mesh position={[0, 1.33, -0.04]} material={mats.hair} castShadow>
        <sphereGeometry args={[0.35, 32, 24, 0, Math.PI * 2, 0, Math.PI * 0.62]} />
        <Outlines thickness={0.02} color="#2b2d42" />
      </mesh>
      <mesh position={[0, 1.0, -0.2]} rotation={[0.2, 0, 0]} material={mats.hair}>
        <coneGeometry args={[0.3, 0.7, 16]} />
      </mesh>
      {/* Mắt */}
      {[-0.11, 0.11].map((x) => (
        <mesh key={x} position={[x, 1.22, 0.29]} material={mats.dark}>
          <sphereGeometry args={[0.045, 12, 12]} />
        </mesh>
      ))}
      {/* Thân + áo choàng */}
      <mesh position={[0, 0.72, 0]} material={mats.cloth} castShadow>
        <capsuleGeometry args={[0.2, 0.32, 8, 16]} />
        <Outlines thickness={0.02} color="#2b2d42" />
      </mesh>
      <mesh position={[0, 0.55, 0]} material={mats.accent}>
        <coneGeometry args={[0.32, 0.4, 24, 1, true]} />
      </mesh>
      {/* Tay */}
      <group ref={armL} position={[-0.26, 0.92, 0]}>
        <mesh position={[0, -0.18, 0]} material={mats.cloth}>
          <capsuleGeometry args={[0.06, 0.26, 6, 10]} />
        </mesh>
      </group>
      <group ref={armR} position={[0.26, 0.92, 0]}>
        <mesh position={[0, -0.18, 0]} material={mats.cloth}>
          <capsuleGeometry args={[0.06, 0.26, 6, 10]} />
        </mesh>
      </group>
      {/* Chân */}
      <mesh ref={legL} position={[-0.1, 0.28, 0]} material={mats.dark}>
        <capsuleGeometry args={[0.07, 0.3, 6, 10]} />
      </mesh>
      <mesh ref={legR} position={[0.1, 0.28, 0]} material={mats.dark}>
        <capsuleGeometry args={[0.07, 0.3, 6, 10]} />
      </mesh>
    </group>
  );
}
