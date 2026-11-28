"use client";
/**
 * Chuyển animation của Quaternius Universal Animation Library (rig kiểu UE: pelvis, spine_01, upperarm_l…) sang VRM.
 * Cách làm theo ví dụ humanoidAnimation của three-vrm: đổi quaternion về không gian "normalized" của VRM
 * (q' = parentRestWorld · q · restWorld⁻¹), tư thế nghỉ lấy từ clip A_TPose; VRM0 lật trục x, z.
 */
import * as THREE from "three";
import { GLTFLoader } from "three/examples/jsm/loaders/GLTFLoader.js";
import type { VRM, VRMHumanBoneName } from "@pixiv/three-vrm";

const MAP: Record<string, VRMHumanBoneName> = {
  pelvis: "hips",
  spine_01: "spine",
  spine_02: "chest",
  spine_03: "upperChest",
  neck_01: "neck",
  Head: "head",
  clavicle_l: "leftShoulder",
  upperarm_l: "leftUpperArm",
  lowerarm_l: "leftLowerArm",
  hand_l: "leftHand",
  clavicle_r: "rightShoulder",
  upperarm_r: "rightUpperArm",
  lowerarm_r: "rightLowerArm",
  hand_r: "rightHand",
  thigh_l: "leftUpperLeg",
  calf_l: "leftLowerLeg",
  foot_l: "leftFoot",
  ball_l: "leftToes",
  thigh_r: "rightUpperLeg",
  calf_r: "rightLowerLeg",
  foot_r: "rightFoot",
  ball_r: "rightToes",
  thumb_01_l: "leftThumbMetacarpal",
  thumb_02_l: "leftThumbProximal",
  thumb_03_l: "leftThumbDistal",
  index_01_l: "leftIndexProximal",
  index_02_l: "leftIndexIntermediate",
  index_03_l: "leftIndexDistal",
  middle_01_l: "leftMiddleProximal",
  middle_02_l: "leftMiddleIntermediate",
  middle_03_l: "leftMiddleDistal",
  ring_01_l: "leftRingProximal",
  ring_02_l: "leftRingIntermediate",
  ring_03_l: "leftRingDistal",
  pinky_01_l: "leftLittleProximal",
  pinky_02_l: "leftLittleIntermediate",
  pinky_03_l: "leftLittleDistal",
  thumb_01_r: "rightThumbMetacarpal",
  thumb_02_r: "rightThumbProximal",
  thumb_03_r: "rightThumbDistal",
  index_01_r: "rightIndexProximal",
  index_02_r: "rightIndexIntermediate",
  index_03_r: "rightIndexDistal",
  middle_01_r: "rightMiddleProximal",
  middle_02_r: "rightMiddleIntermediate",
  middle_03_r: "rightMiddleDistal",
  ring_01_r: "rightRingProximal",
  ring_02_r: "rightRingIntermediate",
  ring_03_r: "rightRingDistal",
  pinky_01_r: "rightLittleProximal",
  pinky_02_r: "rightLittleIntermediate",
  pinky_03_r: "rightLittleDistal",
};

/** Tên clip trong thư viện → động tác của game */
export const CLIPS = {
  idle: "Idle_Loop",
  walk: "Walk_Loop",
  run: "Jog_Fwd_Loop",
  sprint: "Sprint_Loop",
  cast: "Spell_Simple_Shoot",
  castIdle: "Spell_Simple_Idle_Loop",
  cheer: "Dance_Loop",
  hurt: "Hit_Chest",
  jump: "Jump_Start",
  fall: "Jump_Loop",
  land: "Jump_Land",
  stance: "Sword_Idle",
  slash: "Sword_Attack",
  roll: "Roll",
  interact: "Interact",
  swim: "Swim_Fwd_Loop",
  tread: "Swim_Idle_Loop",
} as const;
export type ClipKey = keyof typeof CLIPS;

/** Động tác học sinh chọn được (tên clip trong thư viện) */
export const EMOTES = [
  { id: "Dance_Loop", label: { en: "Dance", vi: "Nhảy múa" } },
  { id: "Sitting_Idle_Loop", label: { en: "Sit", vi: "Ngồi" } },
  { id: "Idle_Talking_Loop", label: { en: "Chat", vi: "Trò chuyện" } },
  { id: "Spell_Simple_Idle_Loop", label: { en: "Channel", vi: "Niệm phép" } },
  { id: "Crouch_Idle_Loop", label: { en: "Crouch", vi: "Ngồi xổm" } },
  { id: "Idle_Torch_Loop", label: { en: "Torch", vi: "Cầm đuốc" } },
  { id: "Interact", label: { en: "Interact", vi: "Tương tác" } },
  { id: "Jump_Start", label: { en: "Jump", vi: "Bật nhảy" } },
  { id: "Roll", label: { en: "Roll", vi: "Lộn" } },
  { id: "Sword_Attack", label: { en: "Slash", vi: "Chém" } },
  { id: "Punch_Jab", label: { en: "Jab", vi: "Đấm" } },
  { id: "Spell_Simple_Shoot", label: { en: "Cast", vi: "Tung phép" } },
] as const;

/** Biểu cảm khuôn mặt (preset VRM) */
export const EXPRESSIONS = [
  { id: "happy", label: { en: "Happy", vi: "Vui" } },
  { id: "relaxed", label: { en: "Relaxed", vi: "Thư thái" } },
  { id: "surprised", label: { en: "Surprised", vi: "Ngạc nhiên" } },
  { id: "sad", label: { en: "Sad", vi: "Buồn" } },
  { id: "angry", label: { en: "Angry", vi: "Giận" } },
] as const;

interface Library {
  scene: THREE.Group;
  clips: THREE.AnimationClip[];
  /** rig (đã đặt tư thế chữ T) của thư viện chứa từng clip — UAL1 và UAL2 là hai file riêng */
  sceneOf: Map<string, THREE.Group>;
}
let libPromise: Promise<Library> | null = null;

function loadOne(url: string) {
  return new GLTFLoader().loadAsync(url).then((g) => {
    // Đặt rig về tư thế chữ T (clip A_TPose) để lấy tư thế nghỉ khớp với VRM normalized
    const tpose = g.animations.find((a) => a.name === "A_TPose");
    if (tpose) {
      const mixer = new THREE.AnimationMixer(g.scene);
      mixer.clipAction(tpose).play();
      mixer.update(0);
    }
    g.scene.updateMatrixWorld(true);
    return g;
  });
}

/** Nạp thư viện animation (file đầu là chính; các file sau bổ sung clip — vd. UAL2 với các chuỗi đòn kiếm) */
export function loadLibrary(url: string, ...extra: string[]): Promise<Library> {
  if (!libPromise) {
    libPromise = Promise.all([loadOne(url), ...extra.map((u) => loadOne(u).catch(() => null))]).then(([main, ...more]) => {
      const sceneOf = new Map<string, THREE.Group>();
      const clips: THREE.AnimationClip[] = [];
      for (const g of [main, ...more]) {
        if (!g) continue;
        for (const c of g.animations) {
          if (sceneOf.has(c.name)) continue;
          sceneOf.set(c.name, g.scene);
          clips.push(c);
        }
      }
      return { scene: main.scene, clips, sceneOf };
    });
    libPromise.catch(() => (libPromise = null));
  }
  return libPromise;
}

const qA = new THREE.Quaternion();
const restInv = new THREE.Quaternion();
const parentRest = new THREE.Quaternion();
const v3 = new THREE.Vector3();

export function retargetClip(lib: Library, clipName: string, vrm: VRM): THREE.AnimationClip | null {
  const src = lib.clips.find((c) => c.name === clipName);
  if (!src) return null;
  const rig = lib.sceneOf.get(clipName) ?? lib.scene;
  const isVrm0 = vrm.meta?.metaVersion === "0";
  const rigPelvis = rig.getObjectByName("pelvis");
  const rigHipsY = rigPelvis ? rigPelvis.getWorldPosition(v3).y - rig.getWorldPosition(new THREE.Vector3()).y : 1;
  const vrmHips = vrm.humanoid.getNormalizedBoneNode("hips");
  const vrmHipsY = vrmHips ? vrmHips.getWorldPosition(v3).y - vrm.scene.getWorldPosition(new THREE.Vector3()).y : 1;
  const posScale = Math.abs(vrmHipsY / (rigHipsY || 1));

  const tracks: THREE.KeyframeTrack[] = [];
  for (const track of src.tracks) {
    const [rigName, prop] = track.name.split(".");
    const boneName = MAP[rigName];
    if (!boneName) continue;
    const vrmNode = vrm.humanoid.getNormalizedBoneNode(boneName);
    const rigNode = rig.getObjectByName(rigName);
    if (!vrmNode || !rigNode || !rigNode.parent) continue;
    rigNode.getWorldQuaternion(restInv).invert();
    rigNode.parent.getWorldQuaternion(parentRest);

    if (track instanceof THREE.QuaternionKeyframeTrack) {
      const values = new Float32Array(track.values.length);
      for (let i = 0; i < track.values.length; i += 4) {
        qA.fromArray(track.values, i).premultiply(parentRest).multiply(restInv);
        values[i] = isVrm0 ? -qA.x : qA.x;
        values[i + 1] = qA.y;
        values[i + 2] = isVrm0 ? -qA.z : qA.z;
        values[i + 3] = qA.w;
      }
      tracks.push(new THREE.QuaternionKeyframeTrack(`${vrmNode.name}.${prop}`, track.times, values));
    } else if (track instanceof THREE.VectorKeyframeTrack && boneName === "hips" && prop === "position") {
      // Vị trí hông: đổi sang không gian thế giới của rig (rig dựng trục Z), rồi co theo chiều cao hông của VRM
      const parentMat = rigNode.parent.matrixWorld;
      const values = new Float32Array(track.values.length);
      for (let i = 0; i < track.values.length; i += 3) {
        v3.fromArray(track.values, i).applyMatrix4(parentMat);
        values[i] = (isVrm0 ? -v3.x : v3.x) * posScale;
        values[i + 1] = v3.y * posScale;
        values[i + 2] = (isVrm0 ? -v3.z : v3.z) * posScale;
      }
      tracks.push(new THREE.VectorKeyframeTrack(`${vrmNode.name}.${prop}`, track.times, values));
    }
  }
  return new THREE.AnimationClip(clipName, src.duration, tracks);
}
