/**
 * Math World realtime server (WebSocket, no framework).
 * - Rooms per realm + channel (max 40 players): presence snapshots at 10 Hz.
 * - Voxel edits for the Wonder Expanse: validated, rate-limited, persisted to data/edits-<realm>.jsonl, broadcast.
 * - Auth: short-lived HMAC token signed by the Next.js app (WORLD_RT_SECRET). ALLOW_ANON=1 allows LAN testing.
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
const TICK_MS = 100;
import { newBoss, tickBoss, hitBoss, hitNode, packBoss } from "./boss.mjs";
const DATA = process.env.DATA_DIR || "./data";
const REALMS = new Set(["hub", "valley", "expanse", "impossible", "siren", "babel", "paradox", "study"]);
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
const edits = new Map(); // realm -> Map("x,y,z" -> id)
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
  return m;
}
function saveEdit(realm, x, y, z, id) {
  loadEdits(realm).set(`${x},${y},${z}`, id);
  appendFileSync(`${DATA}/edits-${realm}.jsonl`, JSON.stringify([x, y, z, id]) + "\n");
}

// ───────────── Phòng ─────────────
/** roomKey = realm#channel */
const rooms = new Map();
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
function leave(ws) {
  const r = ws.room;
  if (!r) return;
  r.clients.delete(ws);
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
  ws.editBudget = { tokens: 10, at: Date.now() };
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
    if (m.t === "join") {
      if (!REALMS.has(m.realm)) return;
      leave(ws);
      const r = pickRoom(m.realm);
      ws.room = r;
      r.clients.add(ws);
      ws.profile = { name: cleanName(m.name) || ws.user.name, avatar: String(m.avatar || "").slice(0, 32) };
      send(ws, {
        t: "joined",
        room: r.key,
        peers: [...r.clients].filter((c) => c !== ws && c.state).map((c) => ({ id: c.id, ...c.profile, s: c.state })),
        edits: r.realm === "expanse" ? [...loadEdits("expanse")].map(([k, id]) => [...k.split(",").map(Number), id]) : [],
      });
      broadcast(r, { t: "peer", id: ws.id, ...ws.profile }, ws);
      // Phó bản: boss do server giữ (máu theo số người lúc mở trận)
      if (r.realm === "siren" && (!r.boss || r.boss.deadAt)) r.boss = newBoss(r.clients.size, Date.now());
      ws.hitBudget = { tokens: 12, at: Date.now() };
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
    if (m.t === "s" && ws.room && Array.isArray(m.s) && m.s.length <= 9) {
      if (typeof m.s[7] === "string" && ws.profile) ws.profile.avatar = m.s[7].slice(0, 32);
      // s[8]: quaternion hướng "lên" (trọng lực kỳ dị) — 4 số hữu hạn trong [−1, 1], gần đơn vị; còn lại = thẳng
      const tq = m.s[8];
      ws.tilt = Array.isArray(tq) && tq.length === 4 && tq.every((v) => Number.isFinite(v) && Math.abs(v) <= 1) && Math.abs(Math.hypot(...tq) - 1) < 0.05 ? tq.map((v) => Math.round(v * 1000) / 1000) : null;
      // s = [x, y, z, yaw, pose, emote, expression]
      const [x, y, z, yaw] = m.s.map(Number);
      if (![x, y, z, yaw].every(Number.isFinite) || Math.abs(x) > 1e5 || Math.abs(z) > 1e5 || Math.abs(y) > 500) return;
      ws.state = [Math.round(x * 100) / 100, Math.round(y * 100) / 100, Math.round(z * 100) / 100, Math.round(yaw * 100) / 100, String(m.s[4] || "idle").slice(0, 8), m.s[5] ? String(m.s[5]).slice(0, 32) : null, m.s[6] ? String(m.s[6]).slice(0, 12) : null];
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
      if (![x, y, z, id].every(Number.isInteger) || y < -40 || y > 80 || id < 0 || id > 9) return;
      // Chỉ sửa trong tầm với của chính người chơi (chống sửa từ xa)
      const s = ws.state;
      if (s && Math.hypot(s[0] - x, s[2] - z) > 16) return;
      saveEdit("expanse", x, y, z, id);
      broadcast(ws.room, { t: "edit", e: [x, y, z, id] }, ws);
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
    for (const c of r.clients) if (c.state) list.push([c.id, ...c.state, c.profile?.name ?? "", c.profile?.avatar ?? "", c.tilt ?? null]);
    if (r.boss) {
      const now = Date.now();
      tickBoss(r.boss, now);
      // Boss chết: 20 s sau mở trận mới cho người còn trong phòng
      if (r.boss.deadAt && now - r.boss.deadAt > 20000) r.boss = newBoss(r.clients.size, now);
    }
    if (list.length) broadcast(r, { t: "snap", at: Date.now(), p: list, ...(r.boss ? { b: packBoss(r.boss) } : {}) });
  }
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
