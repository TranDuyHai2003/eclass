"use client";
/**
 * Other players in the same realm room: interpolated position/yaw, pose, emote and expression.
 * VRM avatars only for the first few peers (quality-based budget) and only when the model isn't already in use
 * (a loaded VRM instance can't be in two places); others show a light chibi stand-in.
 */
import { useRef, useState, useSyncExternalStore } from "react";
import { useFrame } from "@react-three/fiber";
import { Label3D } from "../ui/Labels";
import * as THREE from "three";
import { useWorld } from "../store";
import { Avatar, type Pose } from "../player/Avatar";
import { netPeers, onNet, samplePeer, type Peer } from "../net";
import { AVATAR_BY_ID, worldAsset } from "@/lib/world/avatars";

let version = 0;
const subscribe = (fn: () => void) =>
  onNet(() => {
    version++;
    fn();
  });

export function RemotePlayers() {
  useSyncExternalStore(subscribe, () => version, () => 0);
  const quality = useWorld((s) => s.quality);
  const myAvatar = useWorld((s) => s.avatar);
  const budget = quality === "low" ? 2 : quality === "mid" ? 5 : 8;
  void myAvatar;
  return (
    <>
      {[...netPeers().values()].map((p, i) => (
        // Mỗi người chơi một bản VRM riêng (trình duyệt dùng lại file đã tải; chỉ tốn bộ nhớ GPU) — quá ngân sách thì dùng hình nhẹ
        <RemotePeer key={p.id} peer={p} vrm={i < budget && !!AVATAR_BY_ID[p.avatar]} />
      ))}
    </>
  );
}

type Look = { pose: Pose; emote: string | null; expr: string | null };

const YAXIS = new THREE.Vector3(0, 1, 0);
const TQ = new THREE.Quaternion();
const YQ = new THREE.Quaternion();

function RemotePeer({ peer, vrm }: { peer: Peer; vrm: boolean }) {
  const g = useRef<THREE.Group>(null);
  // khung "lên" làm mượt (ảnh chụp 10 Hz → không giật khi đổi mặt hành tinh / tường)
  const up = useRef(new THREE.Quaternion());
  const last = useRef("");
  const [look, setLook] = useState<Look>({ pose: "idle", emote: null, expr: null });
  useFrame(() => {
    const s = samplePeer(peer, performance.now());
    if (!s || !g.current) return;
    g.current.position.set(s.x, s.y, s.z);
    if (s.tilt) TQ.set(s.tilt[0], s.tilt[1], s.tilt[2], s.tilt[3]).normalize();
    else TQ.identity();
    up.current.slerp(TQ, 0.18);
    YQ.setFromAxisAngle(YAXIS, s.yaw);
    g.current.quaternion.copy(YQ).premultiply(up.current);
    const key = `${s.pose}|${s.emote}|${s.expr}`;
    if (key !== last.current) {
      last.current = key;
      setLook({ pose: (s.pose as Pose) || "idle", emote: s.emote, expr: s.expr });
    }
  });
  return (
    <group ref={g}>
      <Avatar url={vrm ? worldAsset(AVATAR_BY_ID[peer.avatar].file) : undefined} instance={`peer:${peer.id}`} pose={look.pose} speed={1} npc emote={look.emote} expression={look.expr} />
      <Label3D text={peer.name} position={[0, 2.05, 0]} variant="name" />
    </group>
  );
}
