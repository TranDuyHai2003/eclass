"use client";
/**
 * Hầm Bổ đề — cầu nối client: chọn chế độ (một mình / tổ đội), giữ trạng thái lượt chơi cho cảnh + HUD (zustand),
 * gửi động từ. Một mình: chạy CHÍNH logic lib/world/vault/run.ts ngay trên máy (10 Hz). Tổ đội: server quyết, ở đây chỉ hiển thị.
 */
import { create } from "zustand";
import { useWorld } from "../store";
import { netStatus, netVaultAct, netVaultCode, setNetVault, netClock } from "../net";
import { actRun, addEcho, jumpTo, newRun, packRun, seatJoin, tickRun, type Act, type Ping, type Run, type Ev } from "@/lib/world/vault/run";
import { CHECKPOINT_KEY, parseCheckpoint } from "@/lib/world/vault/checkpoint";
import type { V3 } from "@/lib/world/vault/geom";

/** Ghế như gửi qua mạng (không uid) */
export interface NetSeat {
  h: boolean;
  name: string;
  conn: boolean;
  ready: boolean;
  /** null = người đang kết nối (vị trí lấy từ ảnh chụp mạng) */
  p: V3 | null;
  yaw: number;
  task: string;
  sc: Run["seats"][number]["sc"];
  busy: boolean;
}
export type NetRun = Omit<Run, "seats"> & { seats: NetSeat[] };
/** Dùng các hàm thuần (spawnFor, groundFor…) trên bản mạng: chúng chỉ đọc st / phase / n / số ghế */
export const asRun = (r: NetRun) => r as unknown as Run;

interface VaultStore {
  mode: "off" | "solo" | "party";
  /** mã muốn vào ("new" = lập mới) — đặt trước khi đi qua cửa */
  want: string | null;
  code: string;
  seat: number;
  run: NetRun | null;
  err: string | null;
  /** bảng chọn ở cửa Hầm (Quảng trường) */
  door: boolean;
  /** Tiếng Vọng nhận ping (−1 = gần nhất) */
  to: number;
  /** dự đoán núm của mình (hiện ngay, server xác nhận sau) */
  dial: { i: number; v: number; at: number } | null;
  muted: boolean;
}
const mkStore = () => create<VaultStore>(() => ({ mode: "off", want: null, code: "", seat: 0, run: null, err: null, door: false, to: -1, dial: null, muted: false }));
/** Một kho duy nhất kể cả khi Fast Refresh nạp lại module (tránh HUD / cảnh bám vào kho cũ) */
const G = globalThis as unknown as { __vaultStore?: ReturnType<typeof mkStore> };
export const useVault = G.__vaultStore ?? (G.__vaultStore = mkStore());

let local: Run | null = null;
let timer: ReturnType<typeof setInterval> | null = null;
let lastTick = 0;

/** điểm lưu một mình: ghi khi đổi phòng / màn, xoá khi xong hầm */
let cpKey = "";
function saveCheckpoint(r: Run) {
  try {
    if (r.phase === "done") {
      localStorage.removeItem(CHECKPOINT_KEY);
      return;
    }
    if (r.phase === "lobby") return;
    const k = `${r.ch}.${r.sg}`;
    if (k === cpKey) return;
    cpKey = k;
    localStorage.setItem(CHECKPOINT_KEY, JSON.stringify({ seed: r.seed, n: r.n, ch: r.ch, sg: r.sg, at: Date.now() }));
  } catch {
    /* localStorage bị chặn: bỏ qua */
  }
}

function publish() {
  if (!local) return;
  saveCheckpoint(local);
  // bản sao JSON: React thấy đối tượng mới; giống hệt gói server gửi
  useVault.setState({ run: JSON.parse(JSON.stringify(packRun(local))) as NetRun });
}
const myPos = (): V3 => {
  const p = useWorld.getState().player;
  return [p.x, p.y, p.z];
};

/** Bấm ở cửa Hầm: chọn chế độ rồi đi qua lỗ sâu */
export function enterVault(how: "solo" | "new" | string) {
  const solo = how === "solo";
  if (!solo && netStatus() !== "online") {
    useVault.setState({ err: "netDown" });
    return;
  }
  useVault.setState({ mode: solo ? "solo" : "party", want: solo ? null : how, code: solo ? "" : how === "new" ? "" : how, seat: 0, run: null, err: null, door: false, to: -1, dial: null });
  netVaultCode(solo ? null : how);
  window.dispatchEvent(new CustomEvent("world:portal", { detail: "vault" }));
}
export function leaveVault() {
  try {
    if (useVault.getState().mode === "solo") localStorage.removeItem(CHECKPOINT_KEY);
  } catch {
    /* bỏ qua */
  }
  netVaultCode(null);
  useVault.setState({ mode: "off", run: null, want: null, dial: null, code: "" });
  window.dispatchEvent(new CustomEvent("world:portal", { detail: "hub" }));
}

/** Cảnh Hầm gắn vào: bắt đầu bộ chạy local (một mình) hoặc nghe tin server (tổ đội) */
export function mountVault(): () => void {
  const st = useVault.getState();
  if (st.mode === "off") useVault.setState({ mode: "solo" });
  if (useVault.getState().mode === "solo") {
    const now = Date.now();
    let cp = null as ReturnType<typeof parseCheckpoint>;
    try {
      cp = parseCheckpoint(localStorage.getItem(CHECKPOINT_KEY), now);
    } catch {
      cp = null;
    }
    local = newRun("SOLO", cp ? cp.seed : (Math.random() * 2 ** 31) | 0, now, true);
    seatJoin(local, "me", useWorld.getState().playerName || "", now);
    // tải lại trang giữa chừng: dựng lại cùng hạt giống + số Tiếng Vọng rồi nhảy tới phòng / màn đã tới
    if (cp) {
      while (local.seats.length < cp.n && addEcho(local));
      jumpTo(local, cp.ch, cp.sg, now);
      cpKey = `${cp.ch}.${cp.sg}`;
    } else cpKey = "";
    useVault.setState({ seat: 0, code: "" });
    lastTick = now;
    timer = setInterval(() => {
      if (!local) return;
      const t = Date.now();
      tickRun(local, [myPos()], t, (t - lastTick) / 1000);
      lastTick = t;
      publish();
    }, 100);
    publish();
    if (process.env.NODE_ENV !== "production")
      Object.assign(window, {
        __vaultJump: (ch: number, sg: number) => {
          if (!local) return;
          jumpTo(local, ch, sg, Date.now());
          publish();
        },
      });
  }
  setNetVault((m) => {
    if (m.t === "vault") {
      if (m.error) useVault.setState({ err: m.error === "nocode" ? "errNocode" : "errFull" });
      else useVault.setState({ code: String(m.code ?? ""), seat: Number(m.seat ?? 0), run: (m.s as NetRun) ?? null, err: null });
    } else if (m.t === "v") useVault.setState({ run: m.s as NetRun });
  });
  // (không đặt lại mode / mã ở đây: React StrictMode gắn – gỡ – gắn lại effect khi phát triển; rời hầm thì leaveVault lo)
  return () => {
    if (timer) clearInterval(timer);
    timer = null;
    local = null;
    setNetVault(null);
  };
}

/** Gửi một động từ (một mình: chạy luôn trên máy) */
export function vaultAct(a: Act): boolean {
  const s = useVault.getState();
  if (s.mode === "solo") {
    if (!local) return false;
    const ok = actRun(local, 0, a, Date.now(), myPos());
    if (ok) publish();
    return ok;
  }
  return netVaultAct(a);
}

/** Giờ "server" (một mình = giờ máy) — đếm ngược chung so theo đồng hồ này */
export function vaultNow(): number {
  return useVault.getState().mode === "party" ? Date.now() + netClock.offset : Date.now();
}
export type { Ping, Ev };
