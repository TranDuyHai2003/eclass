"use client";
/**
 * Boss / sự kiện Vùng Kỳ quan NHIỀU NGƯỜI — phía client (mô hình "chủ trận"; server: realtime/server.mjs + bossrelay.mjs).
 *  • Người triệu hồi gửi bfight → server lập CHỖ TRẬN (fid), chọn người đó làm chủ, phát cho cả phòng.
 *  • Chủ chạy mô phỏng có thẩm quyền như khi chơi một mình (thêm vị trí người khác trong trận), gửi bstate 8 lần / s.
 *  • Khách (trong bán kính JOIN_R khi trận mở, hoặc bước vào đấu trường sau đó) áp bstate vào mô phỏng cục bộ, vẽ y hệt,
 *    tự tính sát thương lên mình; đòn của khách → bhit → chủ áp hệ số giáp / pha.
 *  • Chủ rời → server chọn chủ mới (bhost) — khách đó tiếp tục mô phỏng từ trạng thái đã đồng bộ. Không ai → bend.
 * Không mạng / ngoài phòng expanse → mọi thứ chạy một mình như trước (role "solo").
 */
import { netClock, netEncounter, netPeers, netSelf, netStatus, setNetEncounter } from "../net";
import { useWorld } from "../store";
import { clockShift } from "@/lib/world/bossNet";
import { BR } from "@/lib/world/bossRelay";
import { useFight, type BossId } from "./bossStore";

export type Role = "solo" | "host" | "guest";
export type EncKind = BossId | "lantern";
export interface Slot {
  fid: string;
  kind: EncKind;
  f: { cx: number; cz: number; y: number; seed: number; rot: number };
  host: string;
  state: unknown;
  ver: number;
  /** đòn của khách chờ chủ áp (chỉ ở máy chủ) */
  hits: { k: string; d: number }[];
  /** lý do kết thúc (bend) */
  ended: string | null;
}

/** khoảng cách tự vào trận khi trận vừa mở / khi bước tới gần sau đó */
export const JOIN_R = 60;
export const WALK_IN_R = 22;
const slots = new Map<string, Slot>();
/** seed của trận cục bộ → fid (seed là khoá của component — đổi fid không làm dựng lại cảnh) */
const bySeed = new Map<number, string>();
/** trận khách vừa rời: không tự vào lại trong 12 s */
const leftAt = new Map<string, number>();

export const isOnline = () => netStatus() === "online" && useWorld.getState().scene === "expanse";
/** đồng hồ máy → đồng hồ server (ms cộng thêm) */
export const shiftNow = () => clockShift(performance.now(), Date.now(), netClock.offset);

export function encSlot(seed: number): Slot | null {
  const fid = bySeed.get(seed);
  return fid ? (slots.get(fid) ?? null) : null;
}
export function encRole(seed: number): Role {
  const s = encSlot(seed);
  if (!s || s.ended) return "solo";
  return s.host === netSelf() ? "host" : "guest";
}

function isBoss(k: EncKind): k is BossId {
  return k === "surveyor" || k === "ledger";
}
function localSeed(kind: EncKind): number | null {
  const st = useFight.getState();
  if (isBoss(kind)) return st.fight ? st.fight.seed : null;
  return st.ev ? st.ev.key : null;
}
function joinAsGuest(sl: Slot) {
  bySeed.set(sl.f.seed, sl.fid);
  if (isBoss(sl.kind)) useFight.setState({ fight: { id: sl.kind, cx: sl.f.cx, cz: sl.f.cz, y: sl.f.y, seed: sl.f.seed, rot: sl.f.rot } });
  else useFight.setState({ eventOn: true, ev: { cx: sl.f.cx, cz: sl.f.cz, y: sl.f.y, key: sl.f.seed } });
}

function onMsg(m: { t: string; [k: string]: unknown }) {
  if (m.t === "breset") {
    slots.clear();
    bySeed.clear();
    return;
  }
  const fid = m.fid as string;
  if (m.t === "bfight") {
    if (m.error || typeof fid !== "string") return;
    const f = m.f as Slot["f"];
    const kind = m.kind as EncKind;
    const old = slots.get(fid);
    const sl: Slot = old ?? { fid, kind, f, host: m.host as string, state: null, ver: 0, hits: [], ended: null };
    sl.host = m.host as string;
    slots.set(fid, sl);
    const mine = localSeed(kind);
    if (mine === f.seed) {
      bySeed.set(f.seed, fid);
      return;
    }
    // đang có trận / sự kiện cùng loại chưa được xác nhận, gần trận này → trận của mình bị gộp vào trận đang có (vào làm khách)
    const st = useFight.getState();
    const busy = st.fight || st.ev;
    const p = useWorld.getState().player;
    const near = Math.hypot(p.x - f.cx, p.z - f.cz) <= JOIN_R;
    if (mine !== null && !bySeed.has(mine) && near) {
      joinAsGuest(sl);
      return;
    }
    if (!busy && near) joinAsGuest(sl);
  } else if (m.t === "bstate") {
    const sl = slots.get(fid);
    if (!sl) return;
    sl.state = m.s;
    sl.ver++;
  } else if (m.t === "bhit") {
    const sl = slots.get(fid);
    if (sl && sl.host === netSelf() && sl.hits.length < 64) sl.hits.push({ k: String(m.k), d: Number(m.d) || 0 });
  } else if (m.t === "bhost") {
    const sl = slots.get(fid);
    if (sl) sl.host = m.host as string;
  } else if (m.t === "bend") {
    const sl = slots.get(fid);
    if (sl) sl.ended = (m.r as string) || "lost";
    // dọn sau một lúc (component đã kịp đọc lý do)
    setTimeout(() => {
      if (slots.get(fid)?.ended) slots.delete(fid);
    }, 15000);
  }
}
if (typeof window !== "undefined") setNetEncounter(onMsg);

/** Triệu hồi (chủ): gửi yêu cầu lập chỗ trận; không mạng → chơi một mình */
export function encSummon(kind: EncKind, f: Slot["f"]) {
  if (!isOnline()) return;
  netEncounter({ t: "bfight", f: { kind, cx: f.cx, cz: f.cz, y: f.y, seed: f.seed, rot: f.rot } });
}
export function encSend(seed: number, s: unknown) {
  const fid = bySeed.get(seed);
  if (fid) netEncounter({ t: "bstate", fid, s });
}
export function encHit(seed: number, k: string, d: number) {
  const fid = bySeed.get(seed);
  if (fid) netEncounter({ t: "bhit", fid, k, d: Math.round(d) });
}
/** chủ kết thúc trận (thắng / rút lui); khách rời trận thì chỉ ghi lại để khỏi tự vào lại ngay */
export function encEnd(seed: number, r: "win" | "retreat") {
  const fid = bySeed.get(seed);
  if (!fid) return;
  const sl = slots.get(fid);
  if (sl && sl.host === netSelf() && !sl.ended) netEncounter({ t: "bend", fid, r });
  else leftAt.set(fid, performance.now());
}
/** Lấy (và xoá) đòn khách đang chờ — chỉ chủ */
export function encTakeHits(seed: number): { k: string; d: number }[] | null {
  const sl = encSlot(seed);
  if (!sl || !sl.hits.length) return null;
  const h = sl.hits;
  sl.hits = [];
  return h;
}

/** Vị trí (x, z) mới nhất của người khác trong bán kính r quanh (cx, cz) → ghi vào out (mảng phẳng, tái dùng) */
export function encPeers(cx: number, cz: number, r: number, out: number[]): number[] {
  out.length = 0;
  if (netStatus() !== "online") return out;
  for (const p of netPeers().values()) {
    const s = p.snaps[p.snaps.length - 1];
    if (!s || performance.now() - s.at > 3000) continue;
    if (Math.hypot(s.x - cx, s.z - cz) <= r) out.push(s.x, s.z);
  }
  return out;
}

/** Gọi thưa (2 s): không có trận cục bộ mà đang đứng trong đấu trường của trận người khác → vào làm khách */
export function encAutoJoin(px: number, pz: number) {
  const st = useFight.getState();
  if (st.fight || st.ev) return;
  const now = performance.now();
  for (const sl of slots.values()) {
    if (sl.ended || now - (leftAt.get(sl.fid) ?? -1e9) < 12000) continue;
    if (Math.hypot(px - sl.f.cx, pz - sl.f.cz) <= WALK_IN_R) {
      joinAsGuest(sl);
      return;
    }
  }
}

/** HUD / gỡ lỗi */
export function encDebug() {
  return { self: netSelf(), slots: [...slots.values()].map((s) => ({ fid: s.fid, kind: s.kind, host: s.host, ver: s.ver, ended: s.ended })), gap: BR.GAP_R };
}
