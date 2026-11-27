"use client";
/**
 * Trạng thái phòng Học cùng nhau: ghế đang ngồi, chế độ tập trung, đồng hồ (chung / riêng), mục tiêu phiên,
 * âm thanh nền, thống kê cục bộ. Logic thuần nằm ở lib/world/study*.ts — đây chỉ là kho + hành động.
 */
import { create } from "zustand";
import * as THREE from "three";
import { useWorld } from "../../store";
import { SEATS, seatAt, type Seat } from "@/lib/world/studyRoom";
import { newSolo, type SoloTimer } from "@/lib/world/studyTimer";
import { STATS_KEY, emptyStats, parseStats, type StudyStats } from "@/lib/world/studyStats";
import { netPeers, samplePeer } from "../../net";

export const SIT_EMOTE = "Sitting_Idle_Loop";
/** Hông của động tác ngồi (UAL) thấp hơn mặt ghế → nâng nhân vật lên khi ngồi (đo trên trình duyệt) */
export const SIT_LIFT = 0.02;
/** Nhích người vào trong ghế một chút (về phía bàn) để chân nằm dưới mặt bàn */
export const SIT_FORWARD = 0.06;

export type TimerMode = "room" | "solo";
export type Ambient = "off" | "rain" | "fire" | "both";

type S = {
  seat: number | null;
  focus: boolean;
  mode: TimerMode;
  solo: SoloTimer;
  goal: string;
  /** khi khối học kết thúc: hỏi "đã xong mục tiêu chưa?" */
  askGoal: boolean;
  ambient: Ambient;
  vol: number;
  stats: StudyStats;
  /** bảng thống kê đang mở */
  statsOpen: boolean;
};

const PREF_KEY = "world.study.prefs";
function loadPrefs(): Partial<S> {
  if (typeof window === "undefined") return {};
  try {
    const p = JSON.parse(localStorage.getItem(PREF_KEY) || "{}") as { mode?: TimerMode; plan?: string; ambient?: Ambient; vol?: number; goal?: string };
    return {
      mode: p.mode === "solo" ? "solo" : "room",
      solo: newSolo(p.plan),
      // nghiên cứu: âm nền nên để người học tự bật (mặc định tắt), mức nhỏ
      ambient: p.ambient === "rain" || p.ambient === "fire" || p.ambient === "both" ? p.ambient : "off",
      vol: Number.isFinite(p.vol) ? Math.min(1, Math.max(0, Number(p.vol))) : 0.25,
      goal: typeof p.goal === "string" ? p.goal.slice(0, 120) : "",
      stats: parseStats(localStorage.getItem(STATS_KEY)),
    };
  } catch {
    return {};
  }
}

export const useStudy = create<S>(() => ({
  seat: null,
  focus: false,
  mode: "room",
  solo: newSolo(),
  goal: "",
  askGoal: false,
  ambient: "off",
  vol: 0.25,
  stats: emptyStats(),
  statsOpen: false,
}));

let loaded = false;
/** Nạp tuỳ chọn + thống kê (gọi khi vào phòng; chỉ chạy ở trình duyệt) */
export function loadStudy() {
  if (loaded) return;
  loaded = true;
  useStudy.setState(loadPrefs());
}
export function savePrefs() {
  const s = useStudy.getState();
  try {
    localStorage.setItem(PREF_KEY, JSON.stringify({ mode: s.mode, plan: s.solo.plan, ambient: s.ambient, vol: s.vol, goal: s.goal }));
  } catch {}
}
export function saveStats(stats: StudyStats) {
  useStudy.setState({ stats });
  try {
    localStorage.setItem(STATS_KEY, JSON.stringify(stats));
  } catch {}
}

/** Ghế đang có người khác ngồi (từ ảnh chụp mạng: động tác ngồi + đứng đúng chỗ ghế) */
export function occupiedSeats(): Set<number> {
  const occ = new Set<number>();
  const now = performance.now();
  for (const p of netPeers().values()) {
    const s = samplePeer(p, now);
    if (!s || s.emote !== SIT_EMOTE) continue;
    const id = seatAt(s.x, s.z);
    if (id !== null) occ.add(id);
  }
  return occ;
}
/** Số người đang ngồi học (kể cả mình) và số người trong phòng */
export function presence(): { studying: number; inRoom: number } {
  let studying = useStudy.getState().seat !== null ? 1 : 0;
  const now = performance.now();
  for (const p of netPeers().values()) {
    const s = samplePeer(p, now);
    if (s?.emote === SIT_EMOTE) studying++;
  }
  return { studying, inRoom: netPeers().size + 1 };
}

export function sit(seat: Seat) {
  const w = useWorld.getState();
  // đặt thẳng vào ghế, quay về bàn (bắc); máy quay sau lưng, hơi cao để thấy mặt bàn + cửa sổ
  w.player.set(seat.x, SIT_LIFT, seat.z - SIT_FORWARD);
  useWorld.setState({ playerYaw: seat.yaw, camYaw: seat.yaw + Math.PI, camPitch: 0.2, camDist: 2.6, emote: SIT_EMOTE, input: { x: 0, y: 0, run: false } });
  useStudy.setState({ seat: seat.id });
}
/** Đứng dậy: về chỗ sau lưng ghế (khỏi kẹt trong ghế), thoát chế độ tập trung. move=false: rời cảnh (giữ vị trí mới) */
export function stand(move = true) {
  const id = useStudy.getState().seat;
  if (id === null) return;
  const seat = SEATS[id];
  const w = useWorld.getState();
  if (move) w.player.set(seat.sx, 0, seat.sz);
  if (w.emote === SIT_EMOTE) useWorld.setState({ emote: null });
  useStudy.setState({ seat: null, focus: false });
}
export function setFocus(on: boolean) {
  const s = useStudy.getState();
  if (on && s.seat === null) return;
  useStudy.setState({ focus: on });
  // tập trung: máy quay sát vai, nhìn thẳng về bàn + cửa sổ (ít chuyển động ở rìa tầm nhìn)
  if (on) useWorld.setState({ camYaw: Math.PI + (SEATS[s.seat!]?.yaw ?? Math.PI), camPitch: 0.14, camDist: 2.1 });
}

/** Xử lý phím F / nút tương tác trong phòng (WorldClient gọi khi nearby.kind === "study") */
export function studyInteract(id: string | undefined) {
  if (!id) return;
  if (id === "stand") return stand();
  if (id === "exit") {
    stand();
    window.dispatchEvent(new CustomEvent("world:portal", { detail: "hub" }));
    return;
  }
  if (id.startsWith("seat:")) {
    const seat = SEATS[Number(id.slice(5))];
    if (seat && !occupiedSeats().has(seat.id)) sit(seat);
  }
}

const TMP = new THREE.Vector3();
/** tâm ghế (thế giới) — cho máy quay / hiệu ứng */
export function seatPos(id: number) {
  const s = SEATS[id];
  return TMP.set(s.x, 0, s.z);
}
