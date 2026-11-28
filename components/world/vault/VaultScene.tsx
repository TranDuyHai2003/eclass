"use client";
/**
 * Cảnh "vault" — Hầm Bổ đề (The Lemma Vaults), phó bản giải đố co-op 2–4 người (thiết kế: docs/ai-reviews/game-3d/COOP_PUZZLE.md).
 * Mỗi lúc chỉ dựng MỘT phòng theo trạng thái lượt chơi (Ngưỡng cửa → Königsberg → Cân → Hợp xướng → Cỗ máy Định lý).
 * Mặt đất / va chạm của Player lấy từ logic thuần (lib/world/vault) — cùng hàm server dùng cho Tiếng Vọng.
 * Ping: X / chuột giữa (desktop), nhấn giữ 350 ms không rê (cảm ứng) → điểm trên mặt đất, tự chọn nghĩa theo ngữ cảnh.
 */
import { useEffect, useRef } from "react";
import { useFrame, useThree } from "@react-three/fiber";
import * as THREE from "three";
import { useWorld } from "../store";
import { AVATAR_BY_ID } from "@/lib/world/avatars";
import { Player, type Nearby } from "../scene/Hub";
import { RemotePlayers } from "../scene/RemotePlayers";
import { air, motion } from "../combat/combat";
import { registerAction } from "../actions";
import { sfx } from "@/lib/world/sfx";
import { impact, shockwave } from "../fx/Lensing";
import { blockedFor, chamberOf, groundFor, spawnFor, stuckSeats, type ChamberId } from "@/lib/world/vault/run";
import { graphById, locate, type KState } from "@/lib/world/vault/konigsberg";
import { BEAM, CAT, LEVER, SOCKETS, STONE_Z, bGround, fallV, onPad, slideDir, slideSpeed, type BState } from "@/lib/world/vault/balance";
import { PODIUM, pedestal, pedestalAt, type FState } from "@/lib/world/vault/fourier";
import { ROPES, ropeAt, type TState } from "@/lib/world/vault/threshold";
import type { V3 } from "@/lib/world/vault/geom";
import { UI, tx } from "@/lib/world/vault/text";
import { asRun, mountVault, useVault, vaultAct, type NetRun } from "./vaultClient";
import { EchoSpirits, PingMarkers, SKIES, VaultSky, runOf } from "./vaultFx";
import { ThresholdRoom } from "./chambers/Threshold";
import { KonigsbergRoom } from "./chambers/Konigsberg";
import { BEAM_VIEW, BalanceRoom } from "./chambers/Balance";
import { ChoirRoom } from "./chambers/Choir";
import { FinaleRoom } from "./chambers/Finale";

/** Phòng đang dựng (phòng chờ = Ngưỡng cửa; xong lượt = Cỗ máy) */
export function viewChamber(r: NetRun | null): ChamberId {
  if (!r || r.phase === "lobby") return "threshold";
  if (r.phase === "done") return "finale";
  return chamberOf(asRun(r));
}

function teleport(p: V3, look: [number, number]) {
  const w = useWorld.getState();
  w.player.set(p[0], p[1], p[2]);
  motion.vy = 0;
  motion.gliding = false;
  motion.plunging = false;
  const yaw = Math.atan2(look[0] - p[0], look[1] - p[2]);
  useWorld.setState({ playerYaw: yaw, camYaw: yaw + Math.PI, camPitch: 0.3, camDist: 4 });
}
/** Hướng nhìn khi xuất hiện: tâm cụm đảo (Königsberg) / tâm phòng */
function lookTarget(r: NetRun): [number, number] {
  if (viewChamber(r) === "konigsberg" && r.st) {
    const g = graphById((r.st as KState).g);
    const far = g.islands.reduce((b, I) => (Math.hypot(I.x - g.look.x, I.z - g.look.z) > Math.hypot(b.x - g.look.x, b.z - g.look.z) ? I : b), g.islands[0]);
    return [far.x, far.z];
  }
  if (viewChamber(r) === "balance" && (r.st as BState | null)?.cat) return [CAT.seatX, CAT.z];
  if (viewChamber(r) === "balance") return [8, 0];
  return [0, 0];
}
const SPAWN_PENDING = { on: false };
function respawn() {
  const s = useVault.getState();
  const r = runOf();
  if (!r || !s.run) return;
  teleport(spawnFor(r, s.seat), lookTarget(s.run));
}

function vGround(x: number, z: number, y?: number): number {
  const r = runOf();
  if (!r || r.phase === "lobby") return 0;
  if (chamberOf(r) === "balance") return bGround(BEAM_VIEW.th, x, z, (r.st as BState | null)?.sg ?? 0);
  return groundFor(r, x, z, y ?? 0);
}
function vBlocked(x: number, z: number, y: number): boolean {
  const r = runOf();
  if (!r) return Math.hypot(x, z) > 8.6;
  if (r.phase === "done") return Math.hypot(x, z) > 10.6 || Math.hypot(x, z) < 2.2;
  return blockedFor(r, x, z, y);
}
/** Máy quay ở lại trong phòng tròn (Ngưỡng cửa, Hợp xướng, Cỗ máy) — không lùi ra ngoài vòng cột / vách */
function vCam(pos: THREE.Vector3) {
  const r = useVault.getState().run;
  const c = viewChamber(r);
  const R = c === "threshold" ? 8.2 : c === "fourier" ? 10.6 : c === "finale" ? 10.4 : 0;
  if (!R) return;
  const d = Math.hypot(pos.x, pos.z);
  if (d > R) {
    pos.x *= R / d;
    pos.z *= R / d;
  }
  pos.y = Math.max(0.6, pos.y);
}
function vNearby(p: THREE.Vector3): Nearby | null {
  const s = useVault.getState();
  const r = s.run;
  const vi = useWorld.getState().lang === "vi";
  if (!r || r.phase !== "play" || !r.st) return null;
  const c = chamberOf(asRun(r));
  if (c === "konigsberg") {
    const st = r.st as KState;
    const tr = st.tr[s.seat];
    if (!tr || tr.a < 0) return null;
    const stuck = stuckSeats(asRun(r)).includes(s.seat);
    return { kind: "action", id: "vault:rewind", label: stuck ? tx(UI.knot, vi) : tx(UI.rewind, vi) };
  }
  if (c === "balance" && (r.st as BState).cat) {
    const cat = (r.st as BState).cat!;
    // máy bắn đá: đang lượn / bay cao trên bệ đáp → bổ nhào; đứng ở cần gạt → dời điểm tựa
    if (!motion.grounded && !motion.plunging && air.height > 1.6 && Math.hypot(p.x - CAT.padX, p.z - CAT.z) < CAT.upR + 0.6)
      return { kind: "action", id: "vault:plunge", label: tx(UI.plunge, vi) };
    if (Math.hypot(p.x - LEVER.x, p.z - LEVER.z) < LEVER.r) {
      const k = (cat.sock + 1) % SOCKETS.length;
      return { kind: "action", id: "vault:socket", label: `${tx(UI.socket, vi)} → ${tx(UI.sockN, vi)} ${k + 1} (d₂/d₁ = ${SOCKETS[k].toFixed(2)})` };
    }
    return null;
  }
  if (c === "balance") {
    const st = r.st as BState;
    if (st.mov && Math.hypot(p.x - st.sx, p.z - STONE_Z) < 1.9) return { kind: "action", id: "vault:push", label: `${tx(UI.push, vi)} ${p.x <= st.sx ? "→" : "←"}` };
  }
  if (c === "threshold") {
    const st = r.st as TState;
    if (st.beat === 1 && ropeAt(p.x, p.z) >= 0) return { kind: "action", id: "vault:ring", label: tx(UI.ring, vi) };
  }
  return null;
}

/** Ngữ cảnh ping: chạm vào cầu = "đi đường này", đảo / khắc = "đứng đây", dây chuông / ống / đá = "dùng cái này" */
export function resolvePing(x: number, y: number, z: number): { kind: string; x: number; y: number; z: number; t?: number } {
  const r = useVault.getState().run;
  if (!r || !r.st || r.phase !== "play") return { kind: "here", x, y, z };
  const c = chamberOf(asRun(r));
  if (c === "konigsberg") {
    const g = graphById((r.st as KState).g);
    const l = locate(g, x, Math.min(y, 0.5), z);
    if (l.k === "bridge") return { kind: "go", x, y, z, t: l.e };
    return { kind: "here", x, y, z };
  }
  if (c === "threshold") {
    const i = ropeAt(x, z);
    if (i >= 0) return { kind: "use", x: ROPES[i][0], y: 0, z: ROPES[i][1] };
  }
  if (c === "balance" && (r.st as BState).cat) {
    if (Math.hypot(x - LEVER.x, z - LEVER.z) < 1.4) return { kind: "use", x: LEVER.x, y: BEAM.y, z: LEVER.z };
    if (Math.hypot(x - CAT.padX, z - CAT.z) < 1.6 || Math.hypot(x - (CAT.padX - 2.4), z - CAT.z) < 1.3) return { kind: "use", x: CAT.padX, y: CAT.y, z: CAT.z };
    if (Math.hypot(x - CAT.seatX, z - CAT.z) < 1.4) return { kind: "here", x: CAT.seatX, y: CAT.y, z: CAT.z };
    return { kind: "here", x, y, z };
  }
  if (c === "balance") {
    const st = r.st as BState;
    if (st.mov && Math.hypot(x - st.sx, z - STONE_Z) < 1.6) return { kind: "use", x: st.sx, y, z: STONE_Z };
    if (Math.abs(x) <= BEAM.half && Math.abs(z) <= 1.2) return { kind: "here", x: Math.round(x), y, z: 0 };
  }
  if (c === "fourier") {
    const st = r.st as FState;
    const i = pedestalAt(st, x, z);
    if (i >= 0) {
      const p = pedestal(st, i);
      return { kind: "use", x: p.x, y: 0, z: p.z, t: i };
    }
    if (st.cond && Math.hypot(x - PODIUM.x, z - PODIUM.z) < 1.6) return { kind: "use", x: PODIUM.x, y: 0, z: PODIUM.z };
  }
  return { kind: "here", x, y, z };
}
export function sendPing(x: number, y: number, z: number, extra: Record<string, unknown> = {}) {
  const p = resolvePing(x, y, z);
  const to = useVault.getState().to;
  if (vaultAct({ k: "ping", ...p, ...(to >= 0 ? { to } : {}), ...extra })) {
    sfx.click();
    try {
      navigator.vibrate?.(12);
    } catch {}
  }
}

/** Bổ nhào (máy bắn đá): Hầm không bật chiến đấu (ENV.armed) nên tự làm phần bổ nhào của attackDown */
function vaultPlunge() {
  if (motion.grounded || motion.plunging || air.height < 1.6) return;
  motion.plunging = true;
  motion.gliding = false;
  motion.vy = -26;
  motion.plungeFrom = useWorld.getState().player.y;
  useWorld.getState().act("slash", 900);
  sfx.whiff();
}
const isCatapult = () => {
  const r = runOf();
  return !!r && r.phase === "play" && chamberOf(r) === "balance" && !!(r.st as BState | null)?.cat;
};

/** Máy bắn đá: chuột trái khi đang bay = bổ nhào; chạm bệ → gửi cú chạm (vy = √(2·40·độ rơi)); cú bắn của mình → motion.vy */
function CatapultInput() {
  const { gl } = useThree();
  useEffect(() => {
    const el = gl.domElement;
    const down = (e: PointerEvent) => {
      if (e.pointerType === "mouse" && e.button === 0 && isCatapult()) vaultPlunge();
    };
    el.addEventListener("pointerdown", down);
    return () => el.removeEventListener("pointerdown", down);
  }, [gl]);
  const was = useRef(false);
  useFrame(() => {
    const plunging = motion.plunging;
    if (was.current && !plunging && motion.grounded && isCatapult()) {
      const p = useWorld.getState().player;
      const fall = motion.plungeFrom - p.y;
      if (onPad(p.x, p.z) && fall > 1) vaultAct({ k: "plunge", vy: Math.round(fallV(fall) * 100) / 100 });
    }
    was.current = plunging;
  });
  return null;
}

const RAY = new THREE.Raycaster();
const NDC = new THREE.Vector2();
const P = new THREE.Vector3();
/** Bắn tia từ máy quay qua điểm màn hình, bước dọc tia tới khi chạm mặt đất của phòng */
function pickGround(camera: THREE.Camera, nx: number, ny: number): V3 | null {
  NDC.set(nx, ny);
  RAY.setFromCamera(NDC, camera);
  let t = 0.4;
  while (t < 140) {
    RAY.ray.at(t, P);
    const gy = vGround(P.x, P.z, P.y + 0.4);
    if (P.y <= gy && gy > -5) return [P.x, gy, P.z];
    if (P.y < -4) return [P.x, Math.max(-2.4, P.y), P.z];
    t += Math.min(1.2, 0.15 + t * 0.03);
  }
  return null;
}

function PingInput() {
  const { camera, gl } = useThree();
  useEffect(() => {
    const el = gl.domElement;
    let mouse: [number, number] = [0, 0];
    const at = (cx: number, cy: number) => {
      const r = el.getBoundingClientRect();
      return [((cx - r.left) / r.width) * 2 - 1, -((cy - r.top) / r.height) * 2 + 1] as [number, number];
    };
    const fire = (nx: number, ny: number) => {
      const hit = pickGround(camera, nx, ny);
      if (hit) sendPing(hit[0], hit[1], hit[2]);
    };
    const aim = (): [number, number] => (document.pointerLockElement ? [0, 0] : mouse);
    const key = (e: KeyboardEvent) => {
      const t = e.target as HTMLElement | null;
      if (t && (t.tagName === "INPUT" || t.tagName === "TEXTAREA")) return;
      if ((e.key === "x" || e.key === "X") && !e.repeat) fire(...aim());
    };
    const move = (e: PointerEvent) => {
      if (e.pointerType === "mouse") mouse = at(e.clientX, e.clientY);
    };
    let press: { id: number; x: number; y: number; tm: ReturnType<typeof setTimeout> } | null = null;
    const down = (e: PointerEvent) => {
      if (e.pointerType === "mouse") {
        if (e.button === 1) {
          e.preventDefault();
          fire(...(document.pointerLockElement ? ([0, 0] as [number, number]) : at(e.clientX, e.clientY)));
        }
        return;
      }
      // cảm ứng: nhấn giữ 350 ms, không rê quá 8 px
      if (press) clearTimeout(press.tm);
      const id = e.pointerId;
      const cx = e.clientX;
      const cy = e.clientY;
      press = { id, x: cx, y: cy, tm: setTimeout(() => (press = null, fire(...at(cx, cy))), 350) };
    };
    const tmove = (e: PointerEvent) => {
      if (press && e.pointerId === press.id && Math.hypot(e.clientX - press.x, e.clientY - press.y) > 8) {
        clearTimeout(press.tm);
        press = null;
      }
    };
    const up = (e: PointerEvent) => {
      if (press && e.pointerId === press.id) {
        clearTimeout(press.tm);
        press = null;
      }
    };
    window.addEventListener("keydown", key);
    el.addEventListener("pointermove", move);
    el.addEventListener("pointerdown", down);
    el.addEventListener("pointermove", tmove);
    window.addEventListener("pointerup", up);
    window.addEventListener("pointercancel", up);
    const pingCenter = () => fire(0, -0.1);
    window.addEventListener("vault:ping-center", pingCenter);
    return () => {
      window.removeEventListener("keydown", key);
      el.removeEventListener("pointermove", move);
      el.removeEventListener("pointerdown", down);
      el.removeEventListener("pointermove", tmove);
      window.removeEventListener("pointerup", up);
      window.removeEventListener("pointercancel", up);
      window.removeEventListener("vault:ping-center", pingCenter);
      if (press) clearTimeout(press.tm);
    };
  }, [camera, gl]);
  return null;
}

export function Vault() {
  const avatar = useWorld((s) => s.avatar);
  const chamber = useVault((s) => viewChamber(s.run));
  useEffect(() => mountVault(), []);
  useEffect(() => {
    const offs = [
      registerAction("vault:rewind", () => vaultAct({ k: "rewind" })),
      registerAction("vault:push", () => vaultAct({ k: "push" }) && sfx.impact(0.5)),
      registerAction("vault:ring", () => vaultAct({ k: "ring" })),
      registerAction("vault:plunge", vaultPlunge),
      registerAction("vault:socket", () => vaultAct({ k: "socket" }) && sfx.creak()),
    ];
    if (process.env.NODE_ENV !== "production") Object.assign(window, { __vault: useVault, __vaultAct: vaultAct, __vaultSpawn: SPAWN_PENDING });
    return () => offs.forEach((f) => f());
  }, []);
  // đổi màn / tua lại → dịch chuyển tới điểm xuất hiện; âm thanh theo sự kiện
  useEffect(() => {
    let key = "";
    let lastEv = 0;
    let lastPhase = "";
    const check = (s: ReturnType<typeof useVault.getState>) => {
      const r = s.run;
      if (!r) return;
      // mở rương cuối hầm (lần đầu sang "done")
      if (r.phase === "done" && lastPhase && lastPhase !== "done") {
        sfx.chest();
        shockwave(new THREE.Vector3(0, 1.5, 0), 1.3);
      }
      lastPhase = r.phase;
      const k = r.phase === "lobby" ? "lobby" : `${r.ch}.${r.sg}`;
      if (k !== key) {
        const first = !key;
        key = k;
        // dịch chuyển ở khung hình kế (sau khi WorldClient đã đặt chỗ xuất hiện mặc định của cảnh)
        if (r.phase !== "done") SPAWN_PENDING.on = true;
        if (!first) sfx.circle();
      }
      const evs = r.ev ?? [];
      if (!lastEv) lastEv = evs.length ? evs[evs.length - 1].id : 0;
      for (const e of evs) {
        if (e.id <= lastEv) continue;
        if (e.k === "tp" && e.by === s.seat) SPAWN_PENDING.on = true;
        else if (e.k === "lit") sfx.harmonic(2 + e.by);
        else if (e.k === "clear") {
          // qua màn: sóng xung kích quanh người chơi + chấn nhẹ
          sfx.constellation();
          const p = useWorld.getState().player;
          shockwave(new THREE.Vector3(p.x, p.y + 1.2, p.z), 1.0);
          impact(0.35);
        }
        else if (e.k === "ring") sfx.chime(e.by);
        else if (e.k === "launch") {
          // máy bắn đá: server quyết vận tốc; người được bắn (ghế mình) đặt motion.vy — vị trí vẫn do client
          const [v, h] = (e.s ?? "").split("|").map(Number);
          if (e.by === s.seat && Number.isFinite(v) && v > 0) {
            motion.vy = Math.min(v, 40);
            motion.grounded = false;
            motion.gliding = false;
            motion.plunging = false;
            useWorld.getState().act("jump", 650);
          }
          sfx.dash();
          shockwave(new THREE.Vector3(CAT.seatX, CAT.y + 0.6, CAT.z), 0.7);
          if (Number.isFinite(h) && h >= 4.5) sfx.chime(h >= 9 ? 3 : 1);
        } else if (e.k === "plunge" && e.by !== s.seat) {
          // người khác / Tiếng Vọng chạm bệ: chấn + sóng (của mình đã có hiệu ứng bổ nhào)
          shockwave(new THREE.Vector3(CAT.padX, CAT.y + 0.3, CAT.z), 0.6);
          sfx.impact(0.9);
        } else if (e.k === "late") sfx.miss();
        else if (e.k === "hint") sfx.chime(3);
        else if (e.k === "say" || e.k === "echo") sfx.click();
      }
      if (evs.length) lastEv = Math.max(lastEv, evs[evs.length - 1].id);
    };
    check(useVault.getState());
    return useVault.subscribe(check);
  }, []);
  useFrame((_, dt) => {
    const w = useWorld.getState();
    // đổi màn / tua lại / rơi xuống sương / vực → về điểm xuất hiện
    if (SPAWN_PENDING.on && useVault.getState().run) {
      SPAWN_PENDING.on = false;
      respawn();
    }
    if (w.player.y < -5) respawn();
    const r = runOf();
    if (!r || r.phase !== "play" || chamberOf(r) !== "balance") return;
    // đòn nghiêng quá 6° → trượt xuống phía thấp
    const th = BEAM_VIEW.th;
    const p = w.player;
    if (Math.abs(p.x) <= BEAM.half && Math.abs(p.z) <= BEAM.w && Math.abs(p.y - (BEAM.y - p.x * Math.tan(th))) < 0.8 && slideDir(th)) p.x = Math.max(-BEAM.half - 0.4, Math.min(BEAM.half + 0.4, p.x + slideDir(th) * slideSpeed(th) * Math.min(0.05, dt)));
  });
  return (
    <group>
      <VaultSky palette={SKIES[chamber]} />
      {chamber === "threshold" && <ThresholdRoom />}
      {chamber === "konigsberg" && <KonigsbergRoom />}
      {chamber === "balance" && <BalanceRoom />}
      {chamber === "fourier" && <ChoirRoom />}
      {chamber === "finale" && <FinaleRoom />}
      <EchoSpirits />
      <PingMarkers />
      <PingInput />
      {chamber === "balance" && <CatapultInput />}
      <RemotePlayers />
      <Player avatarFile={AVATAR_BY_ID[avatar]?.file} ground={vGround} blocked={vBlocked} findNearby={vNearby} camClamp={vCam} />
    </group>
  );
}
