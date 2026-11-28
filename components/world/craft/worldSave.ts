"use client";
/**
 * G4 — Lưu Vùng Kỳ quan vào IndexedDB: khối đã sửa theo chunk + túi đồ, ghi CÙNG một giao dịch (trễ 1,5 s, tối đa 6 s,
 * ghi ngay khi ẩn trang). Chuyển dữ liệu localStorage cũ (`world.edits.v1`) một lần, luỹ đẳng; xong mới bật cờ để
 * voxels.ts thôi nạp / ghi localStorage. IndexedDB lỗi (chế độ riêng tư…) → giữ localStorage như cũ, túi đồ chỉ trong phiên.
 * Định dạng bản ghi (thuần, có test): lib/world/voxelSave.ts.
 */
import { BLOCKS } from "@/lib/world/blocks";
import { IDB_FLAG, applySavedEdits, forEachEdit, loadEdits, onAnyEdit, setExternalPersistence } from "@/lib/world/voxels";
import {
  DirtyRevs,
  LEGACY_KEY,
  chunkNum,
  chunkOfNum,
  chunkRecordKey,
  indexCell,
  invRecord,
  mergeLegacy,
  packChunk,
  parseInvRecord,
  parseLegacy,
  unpackChunk,
} from "@/lib/world/voxelSave";
import { loadInv, onInvChange, useInv } from "./invStore";

const DB_NAME = "eclass-world";
const DB_VER = 1;
const MAX_ID = BLOCKS.length - 1;
const DEBOUNCE = 1500;
const MAX_DELAY = 6000;

export const saveStats = { state: "idle" as "idle" | "loading" | "ready" | "fallback", chunks: 0, cells: 0, writes: 0, lastMs: 0, migrated: 0, error: "" };

let db: IDBDatabase | null = null;
let started = false;
let applying = false;
/** mọi khối đã sửa theo chunk (bản sao để ghi nguyên bản ghi của chunk bẩn) */
const byChunk = new Map<number, Map<number, number>>();
const dirty = new DirtyRevs<number>();
let invDirty = 0;
let invCommitted = 0;
let timer: ReturnType<typeof setTimeout> | null = null;
let firstDirtyAt = 0;
let writing = false;

const req = <T>(r: IDBRequest<T>) =>
  new Promise<T>((res, rej) => {
    r.onsuccess = () => res(r.result);
    r.onerror = () => rej(r.error);
  });
const done = (tx: IDBTransaction) =>
  new Promise<void>((res, rej) => {
    tx.oncomplete = () => res();
    tx.onerror = () => rej(tx.error);
    tx.onabort = () => rej(tx.error ?? new Error("abort"));
  });

function open(): Promise<IDBDatabase> {
  return new Promise((res, rej) => {
    const r = indexedDB.open(DB_NAME, DB_VER);
    r.onupgradeneeded = () => {
      const d = r.result;
      if (!d.objectStoreNames.contains("chunks")) d.createObjectStore("chunks", { keyPath: "k" });
      if (!d.objectStoreNames.contains("meta")) d.createObjectStore("meta", { keyPath: "k" });
    };
    r.onsuccess = () => res(r.result);
    r.onerror = () => rej(r.error);
    r.onblocked = () => rej(new Error("blocked"));
  });
}

/** Chuyển localStorage cũ → IndexedDB trong MỘT giao dịch; đánh dấu "migrated" trong cùng giao dịch (luỹ đẳng) */
async function migrate(d: IDBDatabase) {
  const tx = d.transaction(["chunks", "meta"], "readwrite");
  const meta = tx.objectStore("meta");
  const chunks = tx.objectStore("chunks");
  const fin = done(tx);
  const mark = await req(meta.get("migrated"));
  if (!mark) {
    let raw: string | null = null;
    try {
      raw = localStorage.getItem(LEGACY_KEY);
    } catch {}
    const legacy = parseLegacy(raw, MAX_ID);
    let n = 0;
    for (const [k, cells] of legacy) {
      const [cx, cz] = chunkOfNum(k);
      const rec = mergeLegacy(cx, cz, await req(chunks.get(chunkRecordKey(cx, cz))), cells, MAX_ID);
      if (rec) {
        chunks.put(rec);
        n += cells.size;
      }
    }
    meta.put({ k: "migrated", at: Date.now(), n });
    saveStats.migrated = n;
  }
  await fin;
}

/** Bắt đầu (một lần, trên trình duyệt): mở DB → chuyển dữ liệu cũ → nạp khối + túi → theo dõi sửa / túi để lưu */
export function startWorldSave() {
  if (started || typeof window === "undefined") return;
  started = true;
  // khối có sẵn trong bộ nhớ (localStorage cũ nạp đồng bộ, hoặc khối từ server) → bảng theo chunk
  forEachEdit((x, y, z, id) => void indexCell(byChunk, x, y, z, id));
  onAnyEdit((x, y, z, id) => {
    const k = indexCell(byChunk, x, y, z, id);
    if (applying) return;
    dirty.mark(k);
    schedule();
  });
  onInvChange(() => {
    invDirty++;
    schedule();
  });
  if (typeof indexedDB === "undefined") return fallback("no-idb");
  saveStats.state = "loading";
  void (async () => {
    try {
      const d = await open();
      await migrate(d);
      const tx = d.transaction(["chunks", "meta"], "readonly");
      const [recs, inv] = await Promise.all([req(tx.objectStore("chunks").getAll()), req(tx.objectStore("meta").get("inv"))]);
      applying = true;
      try {
        let cells = 0;
        for (const r of recs as unknown[]) {
          const flat = unpackChunk(r, MAX_ID);
          cells += flat.length / 4;
          const rr = r as { cx: number; cz: number; rev?: number };
          if (flat.length) dirty.setRev(chunkNum(rr.cx, rr.cz), rr.rev ?? 0);
          applySavedEdits(flat);
        }
        saveStats.chunks = recs.length;
        saveStats.cells = cells;
      } finally {
        applying = false;
      }
      const iv = parseInvRecord(inv);
      // túi đổi TRƯỚC khi nạp xong (nhặt đồ rất sớm) → gộp: giữ túi trong bộ lưu, bỏ phần phiên (hiếm, chấp nhận)
      if (iv) loadInv(iv.slots, iv.mode);
      else useInv.setState({ loaded: true });
      db = d;
      try {
        localStorage.setItem(IDB_FLAG, "1");
      } catch {}
      setExternalPersistence(true);
      saveStats.state = "ready";
      d.onversionchange = () => d.close();
      window.addEventListener("pagehide", flushNow);
      document.addEventListener("visibilitychange", () => document.visibilityState === "hidden" && flushNow());
      if (dirty.size || invDirty) schedule();
    } catch (e) {
      fallback(String((e as Error)?.message ?? e));
    }
  })();
}

function fallback(why: string) {
  saveStats.state = "fallback";
  saveStats.error = why;
  setExternalPersistence(false);
  useInv.setState({ loaded: true });
  // cờ đã bật từ trước mà giờ IndexedDB hỏng → nạp lại bản localStorage (cũ) cho khỏi mất công trình
  try {
    if (localStorage.getItem(IDB_FLAG) === "1") loadEdits(true);
  } catch {}
}

function schedule() {
  if (!db) return;
  const now = Date.now();
  if (!timer) firstDirtyAt = now;
  if (timer) clearTimeout(timer);
  const wait = Math.max(0, Math.min(DEBOUNCE, firstDirtyAt + MAX_DELAY - now));
  timer = setTimeout(() => {
    timer = null;
    void flush();
  }, wait);
}

function flushNow() {
  if (timer) clearTimeout(timer);
  timer = null;
  void flush();
}

async function flush() {
  if (!db) return;
  if (writing) return schedule();
  const snap = dirty.snapshot();
  const inv = invDirty;
  if (!snap.length && inv === invCommitted) return;
  writing = true;
  const t0 = performance.now();
  try {
    const tx = db.transaction(["chunks", "meta"], "readwrite");
    const fin = done(tx);
    const cs = tx.objectStore("chunks");
    for (const [k, rev] of snap) {
      const [cx, cz] = chunkOfNum(k);
      const cells = byChunk.get(k);
      if (cells?.size) cs.put(packChunk(cx, cz, cells, rev));
      else cs.delete(chunkRecordKey(cx, cz));
    }
    const st = useInv.getState();
    if (inv !== invCommitted && st.loaded) tx.objectStore("meta").put(invRecord(st.slots, st.mode, inv));
    await fin;
    dirty.committed(snap);
    invCommitted = inv;
    saveStats.writes++;
    saveStats.lastMs = performance.now() - t0;
  } catch (e) {
    saveStats.error = String((e as Error)?.message ?? e);
  } finally {
    writing = false;
  }
  if (dirty.size || invDirty !== invCommitted) schedule();
}
