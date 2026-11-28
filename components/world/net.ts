"use client";
/**
 * Realtime client: connect, join a realm room, send own state at 10 Hz, keep a snapshot buffer of peers
 * for interpolation, sync voxel edits. Auto-reconnects with backoff. Pure module (no React state per frame).
 */
import { useWorld } from "./store";
import { BLOCKS, setBlock } from "@/lib/world/voxels";
import { CHUNK } from "@/lib/world/terrain";
import { expandForge, forgePivot, validForge, type ForgeOp } from "@/lib/world/matrixForge";

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
  /** khu của đồ thị khu Mê cung Hoạ âm (lib/world/zoneGraph.ts); thiếu = "hub" — người ở khu khác không hiện avatar */
  zone?: string;
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
  if (ws?.readyState === 1) sendJoin(ws);
}
/** Hầm Bổ đề: mã tổ đội ("new" = lập mới; null = chơi một mình → rời phòng, không vào phòng nào) */
let vaultCode: string | null = null;
export function netVaultCode(code: string | null) {
  vaultCode = code;
}
/** Bộ nhận tin Hầm Bổ đề (cảnh tự đăng ký — net không import cảnh): {t:"vault"} khi vào phòng, {t:"v"} trạng thái mới */
let vaultFn: ((m: { t: string; [k: string]: unknown }) => void) | null = null;
export function setNetVault(fn: typeof vaultFn) {
  vaultFn = fn;
}
/** Gửi động từ Hầm Bổ đề (false nếu chưa kết nối / không ở phòng tổ đội) */
export function netVaultAct(a: { k: string; [k: string]: unknown }): boolean {
  if (ws?.readyState !== 1 || realm !== "vault" || !vaultCode) return false;
  ws.send(JSON.stringify({ t: "va", a }));
  return true;
}
/** Đồng hồ server − đồng hồ máy (ms), lấy từ ảnh chụp (đếm ngược chung chạy theo giờ server) */
export const netClock = { offset: 0, at: 0 };
function sendJoin(sock: WebSocket) {
  const s = useWorld.getState();
  if (realm === "vault" && !vaultCode) sock.send(JSON.stringify({ t: "leave" }));
  else sock.send(JSON.stringify({ t: "join", realm, avatar: s.avatar, name: s.playerName, ...(realm === "vault" ? { code: vaultCode } : {}), ...(realm === "expanse" ? { sub: true } : {}) }));
}
/**
 * G6 — Vùng Kỳ quan: đăng ký khối đã sửa theo cột chunk (9 × 9 quanh người chơi). Server gửi ảnh chụp các cột mới ("chunks")
 * và chỉ phát "edit" của cột đang đăng ký → vào phòng không còn tải toàn bộ thế giới; rời cột rồi quay lại nhận lại ảnh chụp.
 */
const SUB_R = 4;
const sub = { sent: new Set<string>(), cx: NaN, cz: NaN };
function subTick(sock: WebSocket, px: number, pz: number) {
  const cx = Math.floor(px / CHUNK);
  const cz = Math.floor(pz / CHUNK);
  if (cx === sub.cx && cz === sub.cz) return;
  const want = new Set<string>();
  for (let dz = -SUB_R; dz <= SUB_R; dz++) for (let dx = -SUB_R; dx <= SUB_R; dx++) want.add(`${cx + dx},${cz + dz}`);
  const a: number[][] = [];
  const d: number[][] = [];
  for (const k of want) if (!sub.sent.has(k)) a.push(k.split(",").map(Number));
  for (const k of sub.sent) if (!want.has(k)) d.push(k.split(",").map(Number));
  sub.cx = cx;
  sub.cz = cz;
  sub.sent = want;
  if (a.length || d.length) sock.send(JSON.stringify({ t: "sub", a, d }));
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
/**
 * Boss / sự kiện Vùng Kỳ quan nhiều người (components/world/bosses/encounterNet.ts tự đăng ký — net không import cảnh):
 * nhận bfight / bstate / bhit / bhost / bend (+ "breset" khi vào phòng mới), gửi bằng netEncounter (chỉ trong phòng expanse).
 */
let encFn: ((m: { t: string; [k: string]: unknown }) => void) | null = null;
export function setNetEncounter(fn: typeof encFn) {
  encFn = fn;
}
export function netEncounter(m: { t: string; [k: string]: unknown }): boolean {
  if (ws?.readyState !== 1 || realm !== "expanse") return false;
  ws.send(JSON.stringify(m));
  return true;
}
/** id kết nối của chính mình (null = chưa vào mạng) */
export const netSelf = () => selfId;
export const netRealm = () => realm;

/** Lò rèn Ma trận: gửi MỘT thông điệp cho cả phép biến đổi (máy khác + server tự khai triển giống hệt) */
export function netForge(op: ForgeOp) {
  if (ws?.readyState === 1 && realm === "expanse") ws.send(JSON.stringify({ t: "forge", m: op.m, y: op.y, c: op.c }));
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
      if (realm) sendJoin(sock);
      startSending();
      emit();
    } else if (m.t === "joined") {
      peers.clear();
      for (const p of (m.peers as { id: string; name: string; avatar: string }[]) ?? []) if (p.id !== selfId) peers.set(p.id, { id: p.id, name: p.name, avatar: p.avatar, snaps: [] });
      for (const [x, y, z, id] of (m.edits as number[][]) ?? []) setBlock(x, y, z, id, true);
      // kết nối / phòng mới: server chưa giữ đăng ký nào → gửi lại từ đầu ở nhịp gửi kế tiếp
      sub.sent = new Set();
      sub.cx = sub.cz = NaN;
      encFn?.({ t: "breset" });
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
    } else if (m.t === "vault") {
      // vào tổ đội thành công → nhớ mã thật (lập mới bằng "new"; kết nối lại phải dùng mã này)
      if (typeof m.code === "string" && !m.error) vaultCode = m.code;
      vaultFn?.(m);
    } else if (m.t === "snap") {
      const at = performance.now();
      if (typeof m.at === "number") {
        const off = m.at - Date.now();
        netClock.offset = netClock.at ? netClock.offset + (off - netClock.offset) * 0.2 : off;
        netClock.at = at;
      }
      if (m.v && realm === "vault") vaultFn?.({ t: "v", s: m.v });
      if (Array.isArray(m.b)) {
        netBoss.data = m.b as number[];
        netBoss.offset = (m.at as number) - Date.now();
        netBoss.at = at;
      }
      let changed = false;
      for (const [id, x, y, z, yaw, pose, emote, expr, name, avatar, tilt, zone] of m.p as [string, number, number, number, number, string, string | null, string | null, string, string, [number, number, number, number] | null | undefined, string | undefined][]) {
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
        // đổi khu (qua cửa) → làm mới bộ đệm nội suy, không nội suy xuyên hai khu
        const zn = typeof zone === "string" ? zone : "";
        if (p.snaps.length && (p.snaps[p.snaps.length - 1].zone ?? "") !== zn) p.snaps.length = 0;
        p.snaps.push({ at, x, y, z, yaw, pose, emote, expr, tilt: tilt ?? null, zone: zn });
        if (p.snaps.length > 12) p.snaps.shift();
      }
      if (changed) emit();
    } else if (m.t === "bfight" || m.t === "bstate" || m.t === "bhit" || m.t === "bhost" || m.t === "bend") {
      encFn?.(m);
    } else if (m.t === "chunks") {
      const e = m.e as number[];
      for (let i = 0; i + 3 < e.length; i += 4) setBlock(e[i], e[i + 1], e[i + 2], e[i + 3], true);
    } else if (m.t === "edit") {
      const [x, y, z, id] = m.e as number[];
      setBlock(x, y, z, id, true);
    } else if (m.t === "forge") {
      const op = validForge(m, BLOCKS.length - 1);
      if (!op) return;
      for (const [x, y, z, id] of expandForge(op)) setBlock(x, y, z, id, true);
      const p = forgePivot(op.y);
      useWorld.getState().burst([p.x, op.y + 2, p.z], "#ffd27a", 40);
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
/** Đồ thị khu (Mê cung Hoạ âm) đăng ký hàm trả id khu hiện tại; "hub" / null = không gửi (server cũ vẫn nhận gói 9 phần tử) */
let zoneFn: (() => string) | null = null;
export function setNetZone(fn: typeof zoneFn) {
  zoneFn = fn;
}
/** id khu của chính mình ("hub" nếu cảnh không có đồ thị khu) */
export const netZone = () => zoneFn?.() ?? "hub";
function startSending() {
  stopSending();
  sendTimer = setInterval(() => {
    if (ws?.readyState !== 1) return;
    const s = useWorld.getState();
    const pose = s.action && performance.now() < s.action.until ? s.action.pose : Math.hypot(s.input.x, s.input.y) > 0.05 ? (s.input.run ? "run" : "walk") : "idle";
    const tq = tiltFn?.() ?? null;
    const zn = zoneFn?.() ?? "hub";
    const st: unknown[] = [s.player.x, s.player.y, s.player.z, s.playerYaw, pose, s.emote, s.expression, s.avatar, tq ? tq.map((v) => Math.round(v * 1000) / 1000) : null];
    if (zn !== "hub") st.push(zn);
    ws.send(JSON.stringify({ t: "s", s: st }));
    if (realm === "expanse") subTick(ws, s.player.x, s.player.z);
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
