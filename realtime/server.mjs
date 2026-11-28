/**
 * Math World realtime server (WebSocket, no framework).
 * - Rooms per realm + channel (max 40 players): presence snapshots at 10 Hz.
 * - Voxel edits for the Wonder Expanse: validated, rate-limited, persisted to data/edits-<realm>.jsonl, broadcast.
 * - Auth: short-lived HMAC token signed by the Next.js app (WORLD_RT_SECRET). ALLOW_ANON=1 allows LAN testing.
 * - Hầm Bổ đề (realm "vault"): phòng TỔ ĐỘI ≤ 4 người vào bằng mã 4 ký tự, ghế theo uid (kết nối lại giữ ghế),
 *   câu đố do server quyết (realtime/vault.mjs, sinh từ lib/world/vault/*.ts); trạng thái gửi kèm ảnh chụp ở trường "v"
 *   (chỉ khi đổi). Bộ ảnh chụp p giữ nguyên thứ tự [id, ...state(7), name, avatar, tilt] (+ zone ở vị trí 11 khi người đó
 *   đang ở một khu khác hub của Mê cung Hoạ âm — đồ thị khu, docs/ai-reviews/siren-witch/PHASE2_PLAN.md). Cờ câu đố của đồ thị khu
 *   (tin "zf": đê / vé / mode sa mạc) giữ theo phòng "siren", gửi người vào sau.
 * - Boss / sự kiện Vùng Kỳ quan nhiều người: chỗ trận theo phòng, "chủ trận" giữ mô phỏng (bfight / bstate / bhit / bhost / bend).
 * Never grants coins/XP — rewards only go through the web app's server actions + database.
 */
import { WebSocketServer } from "ws";
import { createHmac, timingSafeEqual, randomUUID } from "node:crypto";
import { mkdirSync, readFileSync, appendFileSync, existsSync, writeFileSync } from "node:fs";
import { createServer } from "node:http";

const PORT = Number(process.env.PORT || 2567);
const SECRET = process.env.WORLD_RT_SECRET || "";
const ALLOW_ANON = process.env.ALLOW_ANON === "1";
const MAX_PER_ROOM = 40;
/** id khu hợp lệ (đồ thị khu Mê cung Hoạ âm — cùng mẫu với lib/world/zoneId.ts ZONE_WIRE) */
const ZONE_WIRE = /^[a-z][a-z0-9_-]{0,15}$/;
/**
 * Cờ câu đố dùng chung của đồ thị khu Mê cung Hoạ âm (phòng "siren"): { dike, ticket: 0/1 — đã mở thì giữ (chốt), desert: mode 0…15 }.
 * Cùng luật với lib/world/zoneId.ts zfMerge (test: tests/world/zoneGraph.test.ts + selftest). ≤ 8 khoá mỗi phòng.
 */
const ZF_KEY = /^[a-z][a-z0-9_]{0,15}$/;
const ZF_LATCH = new Set(["dike", "ticket"]);
function zfMerge(f, k, v) {
  if (typeof k !== "string" || !ZF_KEY.test(k)) return false;
  const n = v === true ? 1 : v === false ? 0 : typeof v === "number" ? v : NaN;
  if (!Number.isInteger(n) || n < 0 || n > 15) return false;
  if (!Object.prototype.hasOwnProperty.call(f, k) && Object.keys(f).length >= 8) return false;
  if (ZF_LATCH.has(k) && f[k] === 1) return false;
  if (f[k] === n) return false;
  f[k] = n;
  return true;
}
const TICK_MS = 100;
import { newBoss, tickBoss, hitBoss, hitNode, packBoss } from "./boss.mjs";
import { newRun, seatJoin, seatLeave, tickRun, actRun, packRun, validCode, makeCode, MAX_SEATS } from "./vault.mjs";
import { validForge, expandForge, forgePivot } from "./forge.mjs";
import { BR, validFight, slotNear, pickHost, takeToken, validHit } from "./bossrelay.mjs";
/** id khối lớn nhất được sửa qua mạng — khớp độ dài BLOCKS trong lib/world/blocks.ts (khối mới luôn thêm ở cuối) */
const MAX_BLOCK_ID = 21;
const DATA = process.env.DATA_DIR || "./data";
const REALMS = new Set(["hub", "valley", "expanse", "impossible", "siren", "babel", "paradox", "study", "torus", "bazaar", "coast"]);
mkdirSync(DATA, { recursive: true });

// ───────────── Xác thực ─────────────
function verify(token) {
  if (!token || typeof token !== "string") return null;
  if (token.startsWith("anon:") && ALLOW_ANON) return { uid: token.slice(5, 41) || randomUUID(), name: "Guest", demo: false, anon: true };
  const [body, sig] = token.split(".");
  if (!body || !sig || !SECRET) return null;
  const want = createHmac("sha256", SECRET).update(body).digest("base64url");
  const a = Buffer.from(sig);
  const b = Buffer.from(want);
  if (a.length !== b.length || !timingSafeEqual(a, b)) return null;
  try {
    const p = JSON.parse(Buffer.from(body, "base64url").toString("utf8"));
    if (!p.uid || typeof p.exp !== "number" || p.exp < Date.now()) return null;
    return { uid: String(p.uid), name: String(p.name || "Player").slice(0, 24), demo: !!p.demo, anon: false };
  } catch {
    return null;
  }
}

// ───────────── Khối đã sửa (voxel) ─────────────
/** cột chunk (m) — khớp CHUNK trong lib/world/terrain.ts (test tests/world/blockIds.test.ts) */
const CHUNK = 32;
const ckeyOf = (x, z) => `${Math.floor(x / CHUNK)},${Math.floor(z / CHUNK)}`;
const edits = new Map(); // realm -> Map("x,y,z" -> id)
/** chỉ mục theo cột chunk: realm -> Map("cx,cz" -> Map("x,y,z" -> id)) — ảnh chụp theo chunk cho người đăng ký (G6) */
const editsByChunk = new Map();
function indexEdit(realm, x, y, z, id) {
  let byC = editsByChunk.get(realm);
  if (!byC) editsByChunk.set(realm, (byC = new Map()));
  const ck = ckeyOf(x, z);
  let m = byC.get(ck);
  if (!m) byC.set(ck, (m = new Map()));
  m.set(`${x},${y},${z}`, id);
}
function loadEdits(realm) {
  if (edits.has(realm)) return edits.get(realm);
  const m = new Map();
  const f = `${DATA}/edits-${realm}.jsonl`;
  if (existsSync(f)) {
    for (const line of readFileSync(f, "utf8").split("\n")) {
      if (!line) continue;
      try {
        const [x, y, z, id] = JSON.parse(line);
        m.set(`${x},${y},${z}`, id);
      } catch {}
    }
    // Gộp lại file (bỏ bản ghi trùng)
    writeFileSync(f, [...m].map(([k, id]) => JSON.stringify([...k.split(",").map(Number), id])).join("\n") + "\n");
  }
  edits.set(realm, m);
  for (const [k, id] of m) {
    const [x, y, z] = k.split(",").map(Number);
    indexEdit(realm, x, y, z, id);
  }
  return m;
}
/** khối đã sửa trong các cột chunk "cx,cz" → mảng phẳng [x, y, z, id]* */
function editsInChunks(realm, keys) {
  loadEdits(realm);
  const byC = editsByChunk.get(realm);
  const out = [];
  if (!byC) return out;
  for (const ck of keys) {
    const m = byC.get(ck);
    if (!m) continue;
    for (const [k, id] of m) {
      const [x, y, z] = k.split(",").map(Number);
      out.push(x, y, z, id);
    }
  }
  return out;
}
function saveEdit(realm, x, y, z, id) {
  loadEdits(realm).set(`${x},${y},${z}`, id);
  indexEdit(realm, x, y, z, id);
  appendFileSync(`${DATA}/edits-${realm}.jsonl`, JSON.stringify([x, y, z, id]) + "\n");
}
const forgeAll = { tokens: 3, at: Date.now() };
/** Lưu một loạt khối (khai triển của thông điệp "forge") bằng MỘT lần ghi */
function saveEdits(realm, list) {
  const m = loadEdits(realm);
  for (const [x, y, z, id] of list) {
    m.set(`${x},${y},${z}`, id);
    indexEdit(realm, x, y, z, id);
  }
  if (list.length) appendFileSync(`${DATA}/edits-${realm}.jsonl`, list.map((e) => JSON.stringify(e)).join("\n") + "\n");
}

// ───────────── Phòng ─────────────
/** roomKey = realm#channel (tổ đội Hầm Bổ đề: vault#MÃ) */
const rooms = new Map();
/** Tổ đội Hầm Bổ đề: mã → { run, last (JSON gửi lần trước), at (lúc còn người gần nhất), tickAt } — giữ 30 phút sau khi mọi người rời */
const parties = new Map();
const PARTY_TTL = 30 * 60 * 1000;
function vaultRoom(code) {
  const key = `vault#${code}`;
  const r = rooms.get(key) ?? { key, realm: "vault", clients: new Set(), code };
  if (!rooms.has(key)) rooms.set(key, r);
  return r;
}
function pickRoom(realm) {
  for (let ch = 1; ; ch++) {
    const key = `${realm}#${ch}`;
    const r = rooms.get(key) ?? { key, realm, clients: new Set() };
    if (!rooms.has(key)) rooms.set(key, r);
    if (r.clients.size < MAX_PER_ROOM) return r;
  }
}
function send(ws, msg) {
  if (ws.readyState === 1) ws.send(JSON.stringify(msg));
}
/** Tên tự đặt — cùng quy tắc với lib/world/playerName.ts (cleanName) */
function cleanName(raw) {
  if (typeof raw !== "string") return "";
  const s = raw.normalize("NFC").replace(/\s+/g, " ").replace(/[^\p{L}\p{M}\p{N} ._'-]/gu, "").replace(/ +/g, " ").trim();
  return Array.from(s).slice(0, 24).join("").trim();
}
function broadcast(room, msg, except) {
  const s = JSON.stringify(msg);
  for (const c of room.clients) if (c !== except && c.readyState === 1) c.send(s);
}
/** sửa khối: chỉ gửi người đang đăng ký cột chunk đó (client cũ không đăng ký → subs = null → nhận hết) */
function broadcastChunk(room, ck, msg, except) {
  const s = JSON.stringify(msg);
  for (const c of room.clients) if (c !== except && c.readyState === 1 && (!c.subs || c.subs.has(ck))) c.send(s);
}
// ───────────── Boss / sự kiện Vùng Kỳ quan nhiều người (mô hình "chủ trận", realtime/bossrelay.mjs) ─────────────
// room.bf: [{ fid, kind, f, host, t0, last, lastAt }] — server KHÔNG mô phỏng boss: chỉ giữ chỗ trận, chuyển tiếp trạng thái
// của chủ (bstate) cho cả phòng, đòn của khách (bhit) cho chủ, và chọn chủ mới khi chủ rời. Client cũ bỏ qua các tin này.
const slotMsg = (sl) => ({ t: "bfight", fid: sl.fid, kind: sl.kind, f: sl.f, host: sl.host, t0: sl.t0 });
function endSlot(r, sl, why) {
  r.bf = (r.bf ?? []).filter((x) => x !== sl);
  broadcast(r, { t: "bend", fid: sl.fid, r: why });
}
/** chủ rời phòng / mất kết nối → người còn lại gần tâm nhất làm chủ (hoặc kết thúc trận) */
function bossHandoff(r, gone) {
  for (const sl of [...(r.bf ?? [])]) {
    if (sl.host !== gone.id) continue;
    const cands = [...r.clients].filter((c) => c !== gone && c.state).map((c) => ({ id: c.id, x: c.state[0], z: c.state[2] }));
    const h = pickHost(sl.f.cx, sl.f.cz, cands, BR.HOST_R);
    if (!h) endSlot(r, sl, "lost");
    else {
      sl.host = h;
      sl.lastAt = Date.now();
      broadcast(r, { t: "bhost", fid: sl.fid, host: h });
    }
  }
}

function leave(ws) {
  const r = ws.room;
  if (!r) return;
  r.clients.delete(ws);
  if (r.bf?.length) bossHandoff(r, ws);
  // tổ đội: ghế chuyển cho Tiếng Vọng giữ (trừ khi cùng tài khoản còn một kết nối khác trong phòng)
  const party = r.code ? parties.get(r.code) : null;
  if (party && ws.user && ![...r.clients].some((c) => c.user?.uid === ws.user.uid)) {
    seatLeave(party.run, ws.user.uid, Date.now());
    party.at = Date.now();
  }
  broadcast(r, { t: "left", id: ws.id });
  ws.room = null;
  if (r.clients.size === 0) rooms.delete(r.key);
}

// ───────────── HTTP (kiểm tra sức khoẻ) + WebSocket ─────────────
const http = createServer((req, res) => {
  if (req.url === "/health") {
    res.writeHead(200, { "content-type": "application/json" });
    res.end(JSON.stringify({ ok: true, rooms: rooms.size, players: [...rooms.values()].reduce((s, r) => s + r.clients.size, 0) }));
    return;
  }
  res.writeHead(404);
  res.end();
});
const wss = new WebSocketServer({ server: http, maxPayload: 16 * 1024 });

wss.on("connection", (ws) => {
  ws.id = randomUUID().slice(0, 8);
  ws.alive = true;
  ws.user = null;
  ws.state = null;
  ws.zone = null;
  ws.editBudget = { tokens: 10, at: Date.now() };
  ws.forgeBudget = { tokens: 2, at: Date.now() };
  ws.on("pong", () => (ws.alive = true));
  ws.on("message", (raw) => {
    let m;
    try {
      m = JSON.parse(raw.toString());
    } catch {
      return;
    }
    if (m.t === "hello") {
      const user = verify(m.token);
      if (!user) return send(ws, { t: "error", error: "auth" }), ws.close(4001, "auth");
      ws.user = user;
      return send(ws, { t: "welcome", id: ws.id });
    }
    if (!ws.user) return;
    if (m.t === "leave") return leave(ws);
    if (m.t === "join" && m.realm === "vault") {
      // Hầm Bổ đề: code "new" = lập tổ đội mới; mã hợp lệ = vào tổ đội có sẵn (kể cả kết nối lại)
      const now = Date.now();
      let code = null;
      if (m.code === "new") {
        for (let i = 0; i < 50 && (!code || parties.has(code)); i++) code = makeCode(Math.random);
        if (!code || parties.has(code)) return send(ws, { t: "vault", error: "busy" });
        parties.set(code, { run: newRun(code, (Math.random() * 2 ** 31) | 0, now), last: "", at: now, tickAt: now });
      } else if (validCode(m.code)) code = m.code;
      const party = code ? parties.get(code) : null;
      if (!party) return send(ws, { t: "vault", error: "nocode", code: typeof m.code === "string" ? m.code.slice(0, 4) : "" });
      const humans = new Set([...(rooms.get(`vault#${code}`)?.clients ?? [])].filter((c) => c !== ws).map((c) => c.user?.uid));
      if (!humans.has(ws.user.uid) && humans.size >= MAX_SEATS) return send(ws, { t: "vault", error: "full", code });
      const name = cleanName(m.name) || ws.user.name;
      leave(ws);
      ws.state = null;
      ws.tilt = null;
      ws.zone = null;
      const seat = seatJoin(party.run, ws.user.uid, name, now);
      if (seat < 0) return send(ws, { t: "vault", error: "full", code });
      const r = vaultRoom(code);
      ws.room = r;
      r.clients.add(ws);
      party.at = now;
      party.last = "";
      ws.profile = { name, avatar: String(m.avatar || "").slice(0, 32) };
      ws.vaultBudget = { tokens: 20, at: now };
      send(ws, { t: "joined", room: r.key, peers: [...r.clients].filter((c) => c !== ws && c.state).map((c) => ({ id: c.id, ...c.profile, s: c.state })), edits: [] });
      send(ws, { t: "vault", code, seat, s: packRun(party.run) });
      broadcast(r, { t: "peer", id: ws.id, ...ws.profile }, ws);
      return;
    }
    if (m.t === "va" && ws.room?.code && m.a && typeof m.a === "object") {
      // động từ Hầm Bổ đề: ≤ 20 / giây; hợp lệ hay không do vault.mjs quyết (vị trí, pha, nghỉ, kẹp số)
      const party = parties.get(ws.room.code);
      if (!party) return;
      const now = Date.now();
      const vb = ws.vaultBudget;
      vb.tokens = Math.min(20, vb.tokens + ((now - vb.at) / 1000) * 20);
      vb.at = now;
      if (vb.tokens < 1) return;
      vb.tokens -= 1;
      const seat = party.run.seats.findIndex((x) => x.uid === ws.user.uid);
      if (seat < 0) return;
      const st = ws.state;
      actRun(party.run, seat, m.a, now, st ? [st[0], st[1], st[2]] : null);
      return;
    }
    if (m.t === "join") {
      if (!REALMS.has(m.realm)) return;
      leave(ws);
      const r = pickRoom(m.realm);
      ws.room = r;
      r.clients.add(ws);
      ws.profile = { name: cleanName(m.name) || ws.user.name, avatar: String(m.avatar || "").slice(0, 32) };
      // G6: client mới gửi sub: true → nhận khối theo cột chunk đăng ký ("sub" / "chunks"); client cũ nhận toàn bộ như trước
      ws.subs = r.realm === "expanse" && m.sub === true ? new Set() : null;
      ws.subBudget = { tokens: 8, at: Date.now() };
      send(ws, {
        t: "joined",
        room: r.key,
        peers: [...r.clients].filter((c) => c !== ws && c.state).map((c) => ({ id: c.id, ...c.profile, s: c.state })),
        edits: r.realm === "expanse" && !ws.subs ? [...loadEdits("expanse")].map(([k, id]) => [...k.split(",").map(Number), id]) : [],
      });
      broadcast(r, { t: "peer", id: ws.id, ...ws.profile }, ws);
      // boss / sự kiện Vùng Kỳ quan đang diễn ra → gửi chỗ trận + trạng thái gần nhất (người vào sau thấy ngay)
      for (const sl of r.bf ?? []) {
        send(ws, slotMsg(sl));
        if (sl.last) send(ws, sl.last);
      }
      ws.bfBudget = { tokens: 2, at: Date.now() };
      ws.bsBudget = { tokens: 12, at: Date.now() };
      ws.bhBudget = { tokens: 12, at: Date.now() };
      // Phó bản: boss do server giữ (máu theo số người lúc mở trận)
      if (r.realm === "siren" && (!r.boss || r.boss.deadAt)) r.boss = newBoss(r.clients.size, Date.now());
      ws.hitBudget = { tokens: 12, at: Date.now() };
      // cờ câu đố của đồ thị khu (đê đã hạ, vé đã mở, mode sa mạc) → người vào sau thấy ngay; client cũ bỏ qua tin "zf"
      ws.zfBudget = { tokens: 4, at: Date.now() };
      if (r.realm === "siren" && r.zf && Object.keys(r.zf).length) send(ws, { t: "zf", f: r.zf });
      return;
    }
    if (m.t === "name" && ws.room && ws.profile) {
      // Đổi tên: phát tối đa 1 lần / 2 s; gõ dồn trong cửa sổ đó → giữ tên MỚI NHẤT, phát khi hết cửa sổ (không mất tên cuối)
      ws.pendingName = cleanName(m.name) || ws.user.name;
      const wait = 2000 - (Date.now() - (ws.renamedAt || 0));
      const apply = () => {
        ws.renameTimer = null;
        if (!ws.room || !ws.profile || ws.pendingName == null) return;
        ws.renamedAt = Date.now();
        ws.profile.name = ws.pendingName;
        ws.pendingName = null;
        broadcast(ws.room, { t: "peer", id: ws.id, ...ws.profile });
      };
      if (wait <= 0) apply();
      else if (!ws.renameTimer) ws.renameTimer = setTimeout(apply, wait);
      return;
    }
    if (m.t === "bh" && ws.room?.boss) {
      // Đòn đánh vào boss: giới hạn 12 đòn/giây, sát thương ≤ 150 mỗi đòn (chống gian lận thô)
      const now = Date.now();
      const hb = ws.hitBudget;
      hb.tokens = Math.min(12, hb.tokens + ((now - hb.at) / 1000) * 12);
      hb.at = now;
      if (hb.tokens < 1) return;
      hb.tokens -= 1;
      const d = Math.max(0, Math.min(150, Number(m.d) || 0));
      if (m.n === 0 || m.n === 1) hitNode(ws.room.boss, m.n, d, now);
      else hitBoss(ws.room.boss, d, now);
      return;
    }
    if (m.t === "zf" && ws.room?.realm === "siren" && ws.zfBudget) {
      // cờ câu đố dùng chung (≤ 4 tin / giây): hợp lệ + đổi thật → phát cho cả phòng (kể cả người gửi — xác nhận)
      const now = Date.now();
      const zb = ws.zfBudget;
      zb.tokens = Math.min(4, zb.tokens + ((now - zb.at) / 1000) * 4);
      zb.at = now;
      if (zb.tokens < 1) return;
      zb.tokens -= 1;
      ws.room.zf ??= {};
      if (zfMerge(ws.room.zf, m.k, m.v)) broadcast(ws.room, { t: "zf", f: ws.room.zf });
      return;
    }
    if (m.t === "s" && ws.room && Array.isArray(m.s) && m.s.length <= 10) {
      if (typeof m.s[7] === "string" && ws.profile) ws.profile.avatar = m.s[7].slice(0, 32);
      // s[8]: quaternion hướng "lên" (trọng lực kỳ dị) — 4 số hữu hạn trong [−1, 1], gần đơn vị; còn lại = thẳng
      const tq = m.s[8];
      ws.tilt = Array.isArray(tq) && tq.length === 4 && tq.every((v) => Number.isFinite(v) && Math.abs(v) <= 1) && Math.abs(Math.hypot(...tq) - 1) < 0.05 ? tq.map((v) => Math.round(v * 1000) / 1000) : null;
      // s[9]: id khu của đồ thị khu Mê cung Hoạ âm (lib/world/zoneId.ts — cùng mẫu); thiếu / bậy = hub (gói cũ 9 phần tử vẫn hợp lệ)
      ws.zone = typeof m.s[9] === "string" && ZONE_WIRE.test(m.s[9]) && m.s[9] !== "hub" ? m.s[9] : null;
      // s = [x, y, z, yaw, pose, emote, expression]
      const [x, y, z, yaw] = m.s.map(Number);
      if (![x, y, z, yaw].every(Number.isFinite) || Math.abs(x) > 1e5 || Math.abs(z) > 1e5 || Math.abs(y) > 500) return;
      ws.state = [Math.round(x * 100) / 100, Math.round(y * 100) / 100, Math.round(z * 100) / 100, Math.round(yaw * 100) / 100, String(m.s[4] || "idle").slice(0, 8), m.s[5] ? String(m.s[5]).slice(0, 32) : null, m.s[6] ? String(m.s[6]).slice(0, 12) : null];
      return;
    }
    if (m.t === "sub" && ws.room?.realm === "expanse" && ws.subs) {
      // đăng ký / huỷ cột chunk: a = thêm, d = bỏ ([[cx, cz]…], ≤ 128 mỗi tin, ≤ 400 đang giữ, ≤ 4 tin / giây dồn 8)
      const now = Date.now();
      const sb = ws.subBudget;
      sb.tokens = Math.min(8, sb.tokens + ((now - sb.at) / 1000) * 4);
      sb.at = now;
      if (sb.tokens < 1) return;
      sb.tokens -= 1;
      const ok = (v) => Array.isArray(v) && v.length === 2 && v.every((n) => Number.isInteger(n) && Math.abs(n) < 1e5);
      const del = Array.isArray(m.d) ? m.d.slice(0, 128).filter(ok) : [];
      for (const [cx, cz] of del) ws.subs.delete(`${cx},${cz}`);
      const add = [];
      for (const v of Array.isArray(m.a) ? m.a.slice(0, 128) : []) {
        if (!ok(v) || ws.subs.size >= 400) continue;
        const ck = `${v[0]},${v[1]}`;
        if (ws.subs.has(ck)) continue;
        ws.subs.add(ck);
        add.push(ck);
      }
      if (add.length) send(ws, { t: "chunks", c: add.map((k) => k.split(",").map(Number)), e: editsInChunks("expanse", add) });
      return;
    }
    if (m.t === "bfight" && ws.room?.realm === "expanse" && ws.bfBudget) {
      // triệu hồi: ≤ 1 lần / 3 s (dồn 2); phải đứng gần tâm; gần trận đang có (GAP_R) → trả trận đó (người gửi vào làm khách)
      const r = ws.room;
      const now = Date.now();
      const f = validFight(m.f);
      const st = ws.state;
      if (!f || !st || Math.hypot(st[0] - f.cx, st[2] - f.cz) > BR.SUMMON_R) return;
      if (!takeToken(ws.bfBudget, now, 1 / 3, 2)) return;
      r.bf = r.bf ?? [];
      const near = slotNear(r.bf.map((x) => x.f), f.cx, f.cz, BR.GAP_R);
      if (near >= 0) {
        const sl = r.bf[near];
        send(ws, slotMsg(sl));
        if (sl.last) send(ws, sl.last);
        return;
      }
      if (r.bf.length >= BR.MAX_SLOTS) return send(ws, { t: "bfight", error: "full", kind: f.kind, seed: f.seed });
      const sl = { fid: randomUUID().slice(0, 8), kind: f.kind, f, host: ws.id, t0: now, last: null, lastAt: now };
      r.bf.push(sl);
      broadcast(r, slotMsg(sl));
      return;
    }
    if (m.t === "bstate" && ws.room?.bf && ws.bsBudget) {
      // trạng thái của chủ trận: ≤ 12 / giây, ≤ STATE_MAX byte → lưu (cho người vào sau) + phát cho cả phòng
      const sl = ws.room.bf.find((x) => x.fid === m.fid);
      if (!sl || sl.host !== ws.id || !m.s || typeof m.s !== "object") return;
      if (!takeToken(ws.bsBudget, Date.now(), 12, 12)) return;
      if (JSON.stringify(m.s).length > BR.STATE_MAX) return;
      sl.last = { t: "bstate", fid: sl.fid, at: Date.now(), s: m.s };
      sl.lastAt = Date.now();
      broadcast(ws.room, sl.last, ws);
      return;
    }
    if (m.t === "bhit" && ws.room?.bf && ws.bhBudget) {
      // đòn của khách → chỉ chủ trận nhận (chủ áp hệ số giáp / pha như khi chơi một mình)
      const sl = ws.room.bf.find((x) => x.fid === m.fid);
      const h = validHit(m);
      const st = ws.state;
      if (!sl || !h || sl.host === ws.id || !st || Math.hypot(st[0] - sl.f.cx, st[2] - sl.f.cz) > BR.HIT_R) return;
      if (!takeToken(ws.bhBudget, Date.now(), 12, 12)) return;
      for (const c of ws.room.clients) if (c.id === sl.host) send(c, { t: "bhit", fid: sl.fid, k: h.k, d: h.d, from: ws.id });
      return;
    }
    if (m.t === "bend" && ws.room?.bf) {
      const sl = ws.room.bf.find((x) => x.fid === m.fid);
      if (!sl || sl.host !== ws.id) return;
      endSlot(ws.room, sl, m.r === "win" ? "win" : "retreat");
      return;
    }
    if (m.t === "edit" && ws.room?.realm === "expanse") {
      if (ws.user.demo) return send(ws, { t: "error", error: "demo" });
      const now = Date.now();
      const b = ws.editBudget;
      b.tokens = Math.min(10, b.tokens + ((now - b.at) / 1000) * 6); // 6 khối/giây, dồn tối đa 10
      b.at = now;
      if (b.tokens < 1) return;
      b.tokens -= 1;
      const [x, y, z, id] = (m.e || []).map(Number);
      if (![x, y, z, id].every(Number.isInteger) || y < -40 || y > 80 || id < 0 || id > MAX_BLOCK_ID) return;
      // Chỉ sửa trong tầm với của chính người chơi (chống sửa từ xa)
      const s = ws.state;
      if (s && Math.hypot(s[0] - x, s[2] - z) > 16) return;
      saveEdit("expanse", x, y, z, id);
      broadcastChunk(ws.room, ckeyOf(x, z), { t: "edit", e: [x, y, z, id] }, ws);
    }
    if (m.t === "forge" && ws.room?.realm === "expanse") {
      // Lò rèn Ma trận: MỘT thông điệp cho cả phép biến đổi (thay hàng trăm "edit" bị giới hạn 6/s).
      // Kiểm (ma trận −2…2, ≤ 441 ô nguồn trong hộp đế, id hợp lệ), phải đứng gần đế, ≤ 1 lần / 2 s (dồn 2). Server khai triển
      // y như client (realtime/forge.mjs sinh từ lib/world/matrixForge.ts), LƯU từng khối (người vào sau nhận trong "joined"), phát op.
      if (ws.user.demo) return send(ws, { t: "error", error: "demo" });
      const now = Date.now();
      const fb = ws.forgeBudget;
      fb.tokens = Math.min(2, fb.tokens + ((now - fb.at) / 1000) * 0.5);
      fb.at = now;
      // cả server: ≤ 3 lần rèn / giây (khai triển xấu nhất ~40 ms CPU)
      forgeAll.tokens = Math.min(3, forgeAll.tokens + ((now - forgeAll.at) / 1000) * 3);
      forgeAll.at = now;
      const op = validForge(m, MAX_BLOCK_ID);
      if (!op || fb.tokens < 1 || forgeAll.tokens < 1) return;
      const s = ws.state;
      const p = forgePivot(op.y);
      if (!s || Math.hypot(s[0] - p.x, s[2] - p.z) > 16 || Math.abs(s[1] - op.y) > 24) return;
      fb.tokens -= 1;
      forgeAll.tokens -= 1;
      saveEdits("expanse", expandForge(op));
      broadcast(ws.room, { t: "forge", m: op.m, y: op.y, c: op.c }, ws);
    }
  });
  ws.on("close", () => {
    if (ws.renameTimer) clearTimeout(ws.renameTimer);
    leave(ws);
  });
});

// Ảnh chụp trạng thái 10 Hz cho từng phòng
setInterval(() => {
  for (const r of rooms.values()) {
    const list = [];
    // id khu chỉ thêm ở vị trí 11 khi có (người ở hub giữ dòng 11 phần tử như cũ)
    for (const c of r.clients) if (c.state) list.push(c.zone ? [c.id, ...c.state, c.profile?.name ?? "", c.profile?.avatar ?? "", c.tilt ?? null, c.zone] : [c.id, ...c.state, c.profile?.name ?? "", c.profile?.avatar ?? "", c.tilt ?? null]);
    // chủ trận im lặng quá lâu (treo tab) → huỷ trận
    if (r.bf?.length) {
      const now = Date.now();
      for (const sl of [...r.bf]) if (now - sl.lastAt > BR.STALE_MS) endSlot(r, sl, "lost");
    }
    if (r.boss) {
      const now = Date.now();
      tickBoss(r.boss, now);
      // Boss chết: 20 s sau mở trận mới cho người còn trong phòng
      if (r.boss.deadAt && now - r.boss.deadAt > 20000) r.boss = newBoss(r.clients.size, now);
    }
    // Hầm Bổ đề: tick câu đố bằng vị trí đã nhận; gửi trạng thái (trường v) chỉ khi đổi
    let v = null;
    const party = r.code ? parties.get(r.code) : null;
    if (party) {
      const now = Date.now();
      const ext = party.run.seats.map((s) => {
        if (!s.uid) return null;
        for (const c of r.clients) if (c.user?.uid === s.uid && c.state) return [c.state[0], c.state[1], c.state[2]];
        return null;
      });
      tickRun(party.run, ext, now, (now - party.tickAt) / 1000);
      party.tickAt = now;
      party.at = now;
      const json = JSON.stringify(packRun(party.run));
      if (json !== party.last) {
        party.last = json;
        v = json;
      }
    }
    if (list.length || v) {
      const base = JSON.stringify({ t: "snap", at: Date.now(), p: list, ...(r.boss ? { b: packBoss(r.boss) } : {}) });
      const msg = v ? base.slice(0, -1) + ',"v":' + v + "}" : base;
      for (const c of r.clients) if (c.readyState === 1) c.send(msg);
    }
  }
  // tổ đội bỏ trống quá 30 phút → xoá
  const now = Date.now();
  for (const [code, p] of parties) if (!rooms.has(`vault#${code}`) && now - p.at > PARTY_TTL) parties.delete(code);
}, TICK_MS);

// Heartbeat 20 s: đóng kết nối chết (proxy / tunnel cắt kết nối im lặng)
setInterval(() => {
  for (const ws of wss.clients) {
    if (!ws.alive) {
      ws.terminate();
      continue;
    }
    ws.alive = false;
    ws.ping();
  }
}, 20000);

http.listen(PORT, () => console.log(`[realtime] listening on :${PORT} anon=${ALLOW_ANON}`));
