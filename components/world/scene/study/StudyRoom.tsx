"use client";
/**
 * Cảnh "Học cùng nhau" (Study with me): gác thư viện ấm áp lúc hoàng hôn mưa, 12 chỗ ngồi theo bàn.
 * Đi tới ghế, bấm F để ngồi (động tác Sitting_Idle_Loop); đồng hồ Pomodoro chung theo giờ thực; người chơi khác
 * (RemotePlayers) ngồi học cùng — đếm số người đang ngồi từ động tác ngồi trong ảnh chụp mạng (không đổi giao thức).
 * Bảng điều khiển (đồng hồ, mục tiêu, tập trung, âm nền, thống kê) ở ui/StudyPanel.tsx.
 */
import { useEffect } from "react";
import { useFrame } from "@react-three/fiber";
import * as THREE from "three";
import { useWorld } from "../../store";
import { AVATAR_BY_ID } from "@/lib/world/avatars";
import { EXIT_POINT, SR, seatNear, studyBlocked } from "@/lib/world/studyRoom";
import { Player, type Nearby } from "../Hub";
import { RemotePlayers } from "../RemotePlayers";
import { StudyDecor } from "./StudyDecor";
import { StudyWindow } from "./StudyWindow";
import { StudyBoards } from "./StudyBoards";
import { SIT_EMOTE, SIT_LIFT, loadStudy, occupiedSeats, stand, useStudy } from "./studyState";
import { setAmbient, stopAmbient } from "./studyAudio";

const PENDANTS = [-3.6, 0, 3.4];

export function Study() {
  const avatar = useWorld((s) => s.avatar);
  const quality = useWorld((s) => s.quality);
  useEffect(() => {
    loadStudy();
    const s = useStudy.getState();
    // âm nền theo lựa chọn lần trước (người chơi đã bấm vào game → được phép phát)
    if (s.ambient !== "off") setAmbient(s.ambient, s.vol);
    if (process.env.NODE_ENV !== "production") (window as unknown as { __study: unknown }).__study = useStudy;
    return () => {
      stand(false);
      useStudy.setState({ focus: false, askGoal: false });
      stopAmbient();
    };
  }, []);
  // Ngồi: người chơi tự bước đi (Player xoá động tác) → đứng dậy đúng chỗ sau lưng ghế
  useFrame(() => {
    const st = useStudy.getState();
    if (st.seat === null) return;
    if (useWorld.getState().emote !== SIT_EMOTE) stand();
  });
  return (
    <group>
      <color attach="background" args={["#1a120c"]} />
      {/* ánh dội ấm (trần gỗ / sàn gỗ), đèn treo lối giữa, ánh hoàng hôn hắt qua cửa sổ */}
      <hemisphereLight args={["#ffdcb0", "#4a2e20", 1.1]} />
      <directionalLight position={[2, 5, -14]} intensity={1.1} color="#ffa585" />
      {(quality === "low" ? [0] : PENDANTS).map((z) => (
        <pointLight key={z} position={[0, SR.H - 1.6, z]} color="#ffc27a" intensity={quality === "low" ? 14 : 7} distance={quality === "low" ? 14 : 9} decay={1.3} />
      ))}
      <StudyDecor />
      <StudyWindow />
      <StudyBoards />
      <RemotePlayers />
      <Player avatarFile={AVATAR_BY_ID[avatar]?.file} ground={studyGround} blocked={blockedNow} findNearby={studyNearby} camClamp={clampCam} />
    </group>
  );
}

function studyGround() {
  return useStudy.getState().seat !== null ? SIT_LIFT : 0;
}
function blockedNow(x: number, z: number) {
  return studyBlocked(x, z, 0.28, useStudy.getState().seat);
}

/** Máy quay luôn ở trong phòng (không chui qua tường / trần) */
function clampCam(pos: THREE.Vector3) {
  pos.x = Math.max(-SR.W + 0.25, Math.min(SR.W - 0.25, pos.x));
  pos.z = Math.max(-SR.D + 0.25, Math.min(SR.D - 0.25, pos.z));
  pos.y = Math.min(SR.H - 0.35, pos.y);
}

function studyNearby(p: THREE.Vector3): Nearby | null {
  const vi = useWorld.getState().lang === "vi";
  const st = useStudy.getState();
  if (st.seat !== null) return { kind: "study", id: "stand", label: vi ? "Đứng dậy" : "Stand up" };
  if (Math.hypot(p.x - EXIT_POINT.x, p.z - EXIT_POINT.z) < EXIT_POINT.r) return { kind: "study", id: "exit", label: vi ? "Về Quảng trường" : "Back to the Plaza" };
  const s = seatNear(p.x, p.z);
  if (!s) return null;
  if (occupiedSeats().has(s.id)) return { kind: "study", id: "taken", label: vi ? "Ghế này đã có người ngồi" : "This seat is taken" };
  return { kind: "study", id: `seat:${s.id}`, label: vi ? `Ngồi học · chỗ ${s.id + 1}` : `Sit and study · seat ${s.id + 1}` };
}
