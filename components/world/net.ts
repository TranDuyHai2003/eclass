"use client";
/**
 * Realtime client: connect, join a realm room, send own state at 10 Hz, keep a snapshot buffer of peers
 * for interpolation, sync voxel edits. Auto-reconnects with backoff. Pure module (no React state per frame).
 */
import { useWorld } from "./store";
import { setBlock } from "@/lib/world/voxels";

export interface PeerSnap {
  at: number;
  x: number;
  y: number;
  z: number;
  yaw: number;
  pose: string;
  emote: string | null;
  expr: string | null;
  /** hướng "lên" lệch khỏi trục y (vùng trọng lực kỳ dị, Mê cung Hoạ âm): quaternion [x, y, z, w]; null = đứng thẳng */
  tilt?: [number, number, number, number] | null;
}
export interface Peer {
  id: string;
  name: string;
  avatar: string;
  snaps: PeerSnap[];
}

const peers = new Map<string, Peer>();
const listeners = new Set<() => void>();
let ws: WebSocket | null = null;
let cfg: { url: string; token: string } | null = null;
/** Lấy token mới (token realtime hết hạn sau ~10 phút → kết nối lại phải xin token mới) */
let refresh: (() => Promise<{ url: string; token: string } | null>) | null = null;
let realm = "";
let tries = 0;
let sendTimer: ReturnType<typeof setInterval> | null = null;
let status: "off" | "connecting" | "online" = "off";
/** id kết nối của chính mình (từ "welcome") — để bỏ mình ra khỏi danh sách người chơi khác */
let selfId: string | null = null;

const emit = () => listeners.forEach((f) => f());
export const netPeers = () => peers;
export const netStatus = () => status;
export function onNet(fn: () => void) {
  listeners.add(fn);
  return () => void listeners.delete(fn);
}

export function netConnect(c: { url: string; token: string }, getFresh?: () => Promise<{ url: string; token: string } | null>) {
  cfg = c;
  refresh = getFresh ?? null;
  open();
}
export function netDisconnect() {
  cfg = null;
  ws?.close();
  ws = null;
  status = "off";
  peers.clear();
  emit();
}
export function netJoin(r: string) {
  realm = r;
  peers.clear();
  emit();
  if (ws?.readyState === 1) ws.send(JSON.stringify({ t: "join", realm, avatar: useWorld.getState().avatar, name: useWorld.getState().playerName }));
}
/** Gửi một khối vừa sửa cho người khác */
/** Trạng thái boss phó bản do server gửi (null = không có / chơi một mình) */
export const netBoss: { data: number[] | null; offset: number; at: number } = { data: null, offset: 0, at: 0 };
/** Đổi tên hiển thị giữa chừng: server cập nhật hồ sơ và báo lại cho cả phòng */
export function netName(name: string) {
  if (ws?.readyState === 1 && realm) ws.send(JSON.stringify({ t: "name", name }));
}
export function netBossHit(d: number, node?: 0 | 1) {
  if (ws?.readyState === 1) ws.send(JSON.stringify({ t: "bh", d: Math.round(d), n: node ?? -1 }));
}

export function netEdit(x: number, y: number, z: number, id: number) {
  if (ws?.readyState === 1) ws.send(JSON.stringify({ t: "edit", e: [x, y, z, id] }));
}

function open() {
  if (!cfg) return;
  status = "connecting";
  emit();
  const sock = new WebSocket(cfg.url);
  selfId = null;
  ws = sock;
  sock.onopen = () => {
    tries = 0;
    sock.send(JSON.stringify({ t: "hello", token: cfg!.token }));
  };
  sock.onmessage = (ev) => {
    let m: { t: string; [k: string]: unknown };
    try {
      m = JSON.parse(String(ev.data));
    } catch {
      return;
    }
    if (m.t === "welcome") {
      // id của chính mình: ảnh chụp phòng gồm MỌI người, kể cả mình → phải bỏ qua, nếu không sẽ thấy "bóng ma" của chính mình
      selfId = (m.id as string) ?? null;
      status = "online";
      if (realm) sock.send(JSON.stringify({ t: "join", realm, avatar: useWorld.getState().avatar, name: useWorld.getState().playerName }));
      startSending();
      emit();
    } else if (m.t === "joined") {
      peers.clear();
      for (const p of (m.peers as { id: string; name: string; avatar: string }[]) ?? []) if (p.id !== selfId) peers.set(p.id, { id: p.id, name: p.name, avatar: p.avatar, snaps: [] });
      for (const [x, y, z, id] of (m.edits as number[][]) ?? []) setBlock(x, y, z, id, true);
      emit();
    } else if (m.t === "peer") {
      if (m.id === selfId) return;
      const old = peers.get(m.id as string);
      if (old) Object.assign(old, { name: m.name as string, avatar: m.avatar as string });
      else peers.set(m.id as string, { id: m.id as string, name: m.name as string, avatar: m.avatar as string, snaps: [] });
      emit();
    } else if (m.t === "left") {
      peers.delete(m.id as string);
      emit();
    } else if (m.t === "snap") {
      const at = performance.now();
      if (Array.isArray(m.b)) {
        netBoss.data = m.b as number[];
        netBoss.offset = (m.at as number) - Date.now();
        netBoss.at = at;
      }
      let changed = false;
      for (const [id, x, y, z, yaw, pose, emote, expr, name, avatar, tilt] of m.p as [string, number, number, number, number, string, string | null, string | null, string, string, [number, number, number, number] | null | undefined][]) {
        if (id === selfId) continue;
        let p = peers.get(id);
        if (!p) {
          p = { id, name: name || "…", avatar: avatar || "", snaps: [] };
          peers.set(id, p);
          changed = true;
        } else if ((name && p.name !== name) || (avatar && p.avatar !== avatar)) {
          p.name = name || p.name;
          p.avatar = avatar || p.avatar;
          changed = true;
        }
        p.snaps.push({ at, x, y, z, yaw, pose, emote, expr, tilt: tilt ?? null });
        if (p.snaps.length > 12) p.snaps.shift();
      }
      if (changed) emit();
    } else if (m.t === "edit") {
      const [x, y, z, id] = m.e as number[];
      setBlock(x, y, z, id, true);
    }
  };
  sock.onclose = () => {
    if (ws !== sock) return;
    status = "off";
    stopSending();
    emit();
    if (!cfg) return;
    // Thử lại có giãn cách (1, 2, 4… tối đa 30 s)
    const wait = Math.min(30000, 1000 * 2 ** tries++);
    setTimeout(async () => {
      if (!cfg || ws !== sock) return;
      // Xin token mới trước khi mở lại (token cũ có thể đã hết hạn)
      if (refresh) {
        const fresh = await refresh().catch(() => null);
        if (!cfg) return;
        if (fresh) cfg = fresh;
      }
      open();
    }, wait);
  };
}

/** Cảnh đang có trọng lực kỳ dị đăng ký hàm trả quaternion "lên" (null = thẳng) — net không phải import cảnh */
let tiltFn: (() => [number, number, number, number] | null) | null = null;
export function setNetTilt(fn: typeof tiltFn) {
  tiltFn = fn;
}
function startSending() {
  stopSending();
  sendTimer = setInterval(() => {
    if (ws?.readyState !== 1) return;
    const s = useWorld.getState();
    const pose = s.action && performance.now() < s.action.until ? s.action.pose : Math.hypot(s.input.x, s.input.y) > 0.05 ? (s.input.run ? "run" : "walk") : "idle";
    const tq = tiltFn?.() ?? null;
    ws.send(JSON.stringify({ t: "s", s: [s.player.x, s.player.y, s.player.z, s.playerYaw, pose, s.emote, s.expression, s.avatar, tq ? tq.map((v) => Math.round(v * 1000) / 1000) : null] }));
  }, 100);
}
function stopSending() {
  if (sendTimer) clearInterval(sendTimer);
  sendTimer = null;
}

/** Nội suy vị trí của một người chơi khác (trễ ~200 ms để luôn có 2 ảnh chụp kẹp hai bên) */
export function samplePeer(p: Peer, now: number): PeerSnap | null {
  const n = p.snaps.length;
  if (!n) return null;
  const t = now - 200;
  for (let i = n - 1; i > 0; i--) {
    const a = p.snaps[i - 1];
    const b = p.snaps[i];
    if (a.at <= t && t <= b.at) {
      const k = (t - a.at) / Math.max(1, b.at - a.at);
      let dy = b.yaw - a.yaw;
      dy = Math.atan2(Math.sin(dy), Math.cos(dy));
      return { ...b, x: a.x + (b.x - a.x) * k, y: a.y + (b.y - a.y) * k, z: a.z + (b.z - a.z) * k, yaw: a.yaw + dy * k };
    }
  }
  return p.snaps[n - 1];
}
