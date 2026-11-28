// Tự kiểm server realtime (chạy: node realtime/selftest.mjs) — server tạm cổng 2599, ALLOW_ANON, dữ liệu trong thư mục tạm:
//   tên tự đặt (lọc), tên mặc định, đổi tên (gộp trong 2 s, phát tên mới nhất), quaternion nghiêng s[8] (hợp lệ / rác),
//   Hầm Bổ đề: lập tổ đội theo mã, vào bằng mã, mã sai, sẵn sàng → bắt đầu, ghế theo uid khi kết nối lại, đầy ghế, bộ ảnh chụp giữ thứ tự cũ
//   Lò rèn Ma trận: một thông điệp "forge" → người khác nhận đúng 1 tin + đúng khối, người vào sau thấy, op sai / đứng xa / dồn dập bị bỏ
//   G6: đăng ký theo cột chunk — "joined" rỗng, ảnh chụp "chunks" đúng cột, "edit" chỉ tới người đăng ký, đăng ký lại nhận khối mới
//   Boss Vùng Kỳ quan nhiều người: triệu hồi (rác / xa bị bỏ), chủ trận, trạng thái chủ → khách, đòn khách → chủ (kẹp), trận gần
//   → vào trận cũ, người vào sau nhận trạng thái, chủ rời → chọn chủ mới, chỉ chủ kết thúc trận
import { spawn } from "node:child_process";
import { createRequire } from "node:module";
const require = createRequire(import.meta.url);
import { mkdtempSync } from "node:fs";
import { tmpdir } from "node:os";
import { join, dirname } from "node:path";
import { fileURLToPath } from "node:url";
const HERE = dirname(fileURLToPath(import.meta.url));
const WebSocket = require("ws");
const PORT = 2599;
const srv = spawn(process.execPath, [join(HERE, "server.mjs")], {
  env: { ...process.env, PORT: String(PORT), ALLOW_ANON: "1", DATA_DIR: mkdtempSync(join(tmpdir(), "rt-")) },
  stdio: "inherit",
});
const sleep = (ms) => new Promise((r) => setTimeout(r, ms));
await sleep(800);
function client(uid, name) {
  const ws = new WebSocket(`ws://127.0.0.1:${PORT}`);
  const got = [];
  ws.on("message", (raw) => got.push(JSON.parse(raw.toString())));
  return new Promise((res) =>
    ws.on("open", () => {
      ws.send(JSON.stringify({ t: "hello", token: "anon:" + uid }));
      setTimeout(() => {
        ws.send(JSON.stringify({ t: "join", realm: "siren", avatar: "", name }));
        res({ ws, got });
      }, 200);
    }),
  );
}
const fails = [];
const check = (ok, msg) => { console.log(ok ? "PASS" : "FAIL", msg); if (!ok) fails.push(msg); };
const a = await client("aaaaaaaa-0000-0000-0000-000000000001", "  Lê <b>Đức</b>\tAnh  ");
const b = await client("bbbbbbbb-0000-0000-0000-000000000002", "");
await sleep(300);
const q = [0, 0, Math.sin(Math.PI / 4), Math.cos(Math.PI / 4)];
a.ws.send(JSON.stringify({ t: "s", s: [1, 2, 3, 0.5, "walk", null, null, "", q] }));
b.ws.send(JSON.stringify({ t: "s", s: [4, 0, 6, 0, "idle", null, null, "", [5, 5, 5, 5]] }));
await sleep(350);
const snapB = b.got.filter((m) => m.t === "snap").pop();
const rowA = snapB?.p.find((r) => r[1] === 1 && r[3] === 3);
check(!!rowA, "B nhận ảnh chụp của A");
check(rowA?.[8] === "Lê bĐứcb Anh", `tên A đã lọc: ${JSON.stringify(rowA?.[8])}`);
check(Array.isArray(rowA?.[10]) && Math.abs(rowA[10][2] - 0.707) < 0.002, `quaternion nghiêng của A: ${JSON.stringify(rowA?.[10])}`);
const snapA = a.got.filter((m) => m.t === "snap").pop();
const rowB = snapA?.p.find((r) => r[1] === 4);
check(rowB?.[8] === "Guest", `B không đặt tên → tên tài khoản: ${JSON.stringify(rowB?.[8])}`);
check(rowB?.[10] === null, "quaternion rác của B bị bỏ (null)");
a.ws.send(JSON.stringify({ t: "name", name: "Minh" }));
await sleep(200);
const ren = b.got.filter((m) => m.t === "peer").pop();
check(ren?.name === "Minh", `đổi tên phát cho cả phòng: ${JSON.stringify(ren?.name)}`);
a.ws.send(JSON.stringify({ t: "name", name: "Spam" }));
await sleep(200);
const ren2 = b.got.filter((m) => m.t === "peer").pop();
check(ren2?.name === "Minh", "đổi tên lần 2 trong 2 s chưa phát ngay");
a.ws.send(JSON.stringify({ t: "name", name: "Minh Anh" }));
await sleep(2000);
const ren3 = b.got.filter((m) => m.t === "peer").pop();
check(ren3?.name === "Minh Anh", `hết cửa sổ 2 s → phát tên MỚI NHẤT: ${JSON.stringify(ren3?.name)}`);
// ───── Đồ thị khu Mê cung Hoạ âm: s[9] = id khu → ảnh chụp vị trí 11 (chỉ khi khác hub) ─────
a.ws.send(JSON.stringify({ t: "s", s: [2000.5, 0, 1, 0, "walk", null, null, "", null, "desert"] }));
await sleep(350);
let zr = b.got.filter((m) => m.t === "snap").pop()?.p.find((r) => r[1] === 2000.5);
check(Array.isArray(zr) && zr.length === 12 && zr[11] === "desert", `id khu đi qua ảnh chụp ở vị trí 11: ${JSON.stringify(zr?.[11])}`);
const zb = a.got.filter((m) => m.t === "snap").pop()?.p.find((r) => r[1] === 4);
check(Array.isArray(zb) && zb.length === 11, "người ở hub (gói cũ 9 phần tử) giữ dòng 11 phần tử");
a.ws.send(JSON.stringify({ t: "s", s: [2000.25, 0, 1, 0, "walk", null, null, "", null, "Bad Zone!"] }));
await sleep(350);
zr = b.got.filter((m) => m.t === "snap").pop()?.p.find((r) => r[1] === 2000.25);
check(Array.isArray(zr) && zr.length === 11, "id khu bậy bị lọc (coi như hub)");
a.ws.send(JSON.stringify({ t: "s", s: [3, 0, 1, 0, "walk", null, null, "", null, "keys", "extra"] }));
await sleep(350);
zr = b.got.filter((m) => m.t === "snap").pop()?.p.find((r) => r[1] === 3);
check(!zr, "gói quá 10 phần tử bị bỏ");
a.ws.close(); b.ws.close();

// ───── Hầm Bổ đề: tổ đội theo mã ─────
function vclient(uid, name, code) {
  const ws = new WebSocket(`ws://127.0.0.1:${PORT}`);
  const got = [];
  ws.on("message", (raw) => got.push(JSON.parse(raw.toString())));
  return new Promise((res) =>
    ws.on("open", () => {
      ws.send(JSON.stringify({ t: "hello", token: "anon:" + uid }));
      setTimeout(() => {
        ws.send(JSON.stringify({ t: "join", realm: "vault", avatar: "", name, code }));
        setTimeout(() => res({ ws, got, last: (t) => got.filter((m) => m.t === t).pop() }), 250);
      }, 150);
    }),
  );
}
const lastV = (c) => c.got.filter((m) => m.t === "snap" && m.v).map((m) => m.v).pop() ?? c.last("vault")?.s;
const va = (c, a) => c.ws.send(JSON.stringify({ t: "va", a }));
const UA = "cccccccc-0000-0000-0000-00000000000a";
const UB = "dddddddd-0000-0000-0000-00000000000b";
const pa = await vclient(UA, "Lan", "new");
const code = pa.last("vault")?.code;
check(/^[ACDEFHJKMNPRTUVWXY3479]{4}$/.test(code ?? ""), `lập tổ đội → mã ${code}`);
check(pa.last("vault")?.seat === 0, "người lập ngồi ghế 0");
const pb = await vclient(UB, "Minh", code);
check(pb.last("vault")?.seat === 1, "vào bằng mã → ghế 1");
const bad = await vclient("eeeeeeee-0000-0000-0000-00000000000e", "X", "AAAA");
check(bad.last("vault")?.error === "nocode", "mã không tồn tại → báo lỗi");
bad.ws.close();
pa.ws.send(JSON.stringify({ t: "s", s: [0, 0, 6.6, 0, "idle", null, null, "", null] }));
pb.ws.send(JSON.stringify({ t: "s", s: [1, 0, 6.6, 0, "idle", null, null, "", null] }));
va(pa, { k: "start" });
await sleep(300);
check(lastV(pa)?.phase === "lobby", "chưa đủ người sẵn sàng thì chưa bắt đầu");
va(pa, { k: "ready" });
va(pb, { k: "ready" });
await sleep(400);
const v1 = lastV(pa);
check(v1?.phase === "play" && v1?.n === 2 && v1?.ch === 0, `cả hai sẵn sàng → bắt đầu Ngưỡng cửa (N = ${v1?.n})`);
check(!JSON.stringify(v1).includes(UA), "trạng thái gửi đi không chứa uid");
const row = pa.got.filter((m) => m.t === "snap" && m.p.length).pop()?.p.find((r) => r[8] === "Minh");
check(Array.isArray(row) && row.length === 11 && row[1] === 1, "ảnh chụp tổ đội giữ thứ tự [id, …state(7), name, avatar, tilt]");
va(pb, { k: "say", id: "nice" });
va(pb, { k: "say", id: "<script>" });
await sleep(300);
const says = (lastV(pa)?.ev ?? []).filter((e) => e.k === "say");
check(says.length === 1 && says[0].s === "nice" && says[0].by === 1, "nói nhanh: chỉ câu có sẵn được chuyển tiếp");
// máy bắn đá: cú chạm / dời điểm tựa ngoài phòng Cân (hoặc số rác) bị bỏ — không có sự kiện plunge / launch
va(pb, { k: "plunge", vy: 28.3 });
va(pb, { k: "plunge", vy: 1e9 });
va(pa, { k: "socket", i: 2 });
await sleep(300);
check(!(lastV(pa)?.ev ?? []).some((e) => e.k === "plunge" || e.k === "launch"), "máy bắn: cú chạm sai phòng / vy rác bị server bỏ");
pb.ws.close();
await sleep(400);
check(lastV(pa)?.seats?.[1]?.conn === false, "B rời → ghế 1 do Tiếng Vọng giữ");
const pc = await vclient("ffffffff-0000-0000-0000-00000000000f", "C", code);
check(pc.last("vault")?.error === "full", "người lạ vào khi N đã khoá và ghế B còn hạn giữ → đầy");
pc.ws.close();
const pb2 = await vclient(UB, "Minh", code);
check(pb2.last("vault")?.seat === 1, "B kết nối lại (cùng uid) → lấy lại ghế 1");
await sleep(300);
check(lastV(pa)?.seats?.[1]?.conn === true, "ghế 1 trở lại là người");
pa.ws.close(); pb2.ws.close();

// ───── Lò rèn Ma trận: MỘT thông điệp "forge" thay hàng trăm "edit" (Vùng Kỳ quan) ─────
const forge = await import("./forge.mjs");
function eclient(uid, pos) {
  const ws = new WebSocket(`ws://127.0.0.1:${PORT}`);
  const got = [];
  ws.on("message", (raw) => got.push(JSON.parse(raw.toString())));
  return new Promise((res) =>
    ws.on("open", () => {
      ws.send(JSON.stringify({ t: "hello", token: "anon:" + uid }));
      setTimeout(() => {
        ws.send(JSON.stringify({ t: "join", realm: "expanse", avatar: "", name: "F" }));
        if (pos) ws.send(JSON.stringify({ t: "s", s: [pos[0], pos[1], pos[2], 0, "idle", null, null, "", null] }));
        setTimeout(() => res({ ws, got }), 250);
      }, 150);
    }),
  );
}
const FY = 10;
const FP = forge.forgePivot(FY);
const fa = await eclient("11111111-0000-0000-0000-000000000001", [FP.x, FY, FP.z]);
const fb = await eclient("22222222-0000-0000-0000-000000000002", [FP.x + 3, FY, FP.z]);
const tower = [];
for (let dx = 3; dx < 5; dx++) for (let dz = 3; dz < 5; dz++) for (let dy = 0; dy < 2; dy++) tower.push({ x: forge.FORGE_AT.x + dx, y: FY + dy, z: forge.FORGE_AT.z + dz, id: 7 });
const op = forge.encodeForge(tower, [2, 0, 0, 0, 2, 0, 0, 0, 2], FY);
fa.ws.send(JSON.stringify({ t: "forge", ...op }));
await sleep(400);
const fmsg = fb.got.filter((m) => m.t === "forge");
const want = forge.expandForge(op);
check(fmsg.length === 1 && !fb.got.some((m) => m.t === "edit"), `B nhận đúng MỘT thông điệp forge, không có edit lẻ (${fmsg.length})`);
const gotE = fmsg[0] ? forge.expandForge(forge.validForge(fmsg[0], 16)) : [];
check(JSON.stringify(gotE) === JSON.stringify(want) && want.length === 8 + 64, `B khai triển ra đúng các khối (8 xoá + 64 đặt = ${gotE.length})`);
check(!fa.got.some((m) => m.t === "forge"), "người rèn không nhận lại op của mình");
const late = await eclient("33333333-0000-0000-0000-000000000003", null);
const jn = late.got.find((m) => m.t === "joined");
const expect = new Map();
for (const [x, y, z, id] of want) expect.set(`${x},${y},${z}`, id);
const have = new Map((jn?.edits ?? []).map(([x, y, z, id]) => [`${x},${y},${z}`, id]));
check(have.size === expect.size && [...expect].every(([k, id]) => have.get(k) === id), `người vào sau nhận đủ khối đã rèn trong "joined" (${have.size}/${expect.size})`);
// sai: ma trận ngoài −2…2, quá nhiều khối, đứng xa đế → server bỏ, không phát
const many = [];
for (let i = 0; i <= forge.FORGE_MAX_SRC; i++) many.push(i, 3);
fa.ws.send(JSON.stringify({ t: "forge", ...op, m: [3, 0, 0, 0, 1, 0, 0, 0, 1] }));
fa.ws.send(JSON.stringify({ t: "forge", ...op, c: many }));
const far = await eclient("44444444-0000-0000-0000-000000000004", [FP.x + 60, FY, FP.z]);
far.ws.send(JSON.stringify({ t: "forge", ...op }));
await sleep(400);
check(fb.got.filter((m) => m.t === "forge").length === 1, "ma trận sai / quá nhiều khối / đứng xa đế → bị bỏ");
// giới hạn: mỗi người ≤ 1 lần / 2 s (dồn 2) → gửi dồn 3 lần chỉ qua được 1–2
for (let i = 0; i < 3; i++) fa.ws.send(JSON.stringify({ t: "forge", ...op }));
await sleep(400);
const extra = fb.got.filter((m) => m.t === "forge").length - 1;
check(extra >= 1 && extra < 3, `giới hạn tốc độ rèn (${extra}/3 qua)`);
// ───── G6: đăng ký khối theo cột chunk (client mới gửi sub: true) ─────
function sclient(uid, pos) {
  const ws = new WebSocket(`ws://127.0.0.1:${PORT}`);
  const got = [];
  ws.on("message", (raw) => got.push(JSON.parse(raw.toString())));
  return new Promise((res) =>
    ws.on("open", () => {
      ws.send(JSON.stringify({ t: "hello", token: "anon:" + uid }));
      setTimeout(() => {
        ws.send(JSON.stringify({ t: "join", realm: "expanse", avatar: "", name: "S", sub: true }));
        ws.send(JSON.stringify({ t: "s", s: [pos[0], pos[1], pos[2], 0, "idle", null, null, "", null] }));
        setTimeout(() => res({ ws, got }), 250);
      }, 150);
    }),
  );
}
const s1 = await sclient("55555555-0000-0000-0000-000000000005", [200, 10, 200]);
const s2 = await sclient("66666666-0000-0000-0000-000000000006", [205, 10, 200]);
const sj = s1.got.find((m) => m.t === "joined");
check(Array.isArray(sj?.edits) && sj.edits.length === 0, `client đăng ký: "joined" không kèm toàn bộ khối (${sj?.edits?.length})`);
// s1 đăng ký cột của khối rèn + cột (6, 6); s2 chỉ đăng ký cột (6, 6)
const fck = [Math.floor(want[0][0] / 32), Math.floor(want[0][2] / 32)];
s1.ws.send(JSON.stringify({ t: "sub", a: [fck, [6, 6]], d: [] }));
s2.ws.send(JSON.stringify({ t: "sub", a: [[6, 6]], d: [] }));
await sleep(300);
const ch = s1.got.find((m) => m.t === "chunks");
// theo ô duy nhất (ô xoá rồi đặt lại trong cùng phép rèn chỉ còn một bản ghi — như "joined")
const inF = [...expect.keys()].map((k) => k.split(",").map(Number)).filter(([x, , z]) => Math.floor(x / 32) === fck[0] && Math.floor(z / 32) === fck[1]);
check(ch && ch.e.length === inF.length * 4, `"chunks": ảnh chụp đúng các khối trong cột đăng ký (${ch?.e?.length / 4}/${inF.length})`);
// s2 sửa khối trong cột (6, 6) → s1 (đăng ký) nhận; người không đăng ký cột đó (fb, client cũ vẫn nhận hết) — late2 đăng ký cột khác thì không
const late2 = await sclient("77777777-0000-0000-0000-000000000007", [205, 10, 205]);
late2.ws.send(JSON.stringify({ t: "sub", a: [[0, 0]], d: [] }));
await sleep(300);
s2.ws.send(JSON.stringify({ t: "edit", e: [205, 12, 200, 3] }));
await sleep(300);
check(s1.got.some((m) => m.t === "edit" && m.e[0] === 205), "người đăng ký cột nhận sửa khối");
check(!late2.got.some((m) => m.t === "edit" && m.e[0] === 205), "người không đăng ký cột đó không nhận");
// bỏ đăng ký rồi đăng ký lại → nhận lại ảnh chụp có khối vừa sửa
late2.ws.send(JSON.stringify({ t: "sub", a: [[6, 6]], d: [[0, 0]] }));
await sleep(300);
const ch2 = late2.got.filter((m) => m.t === "chunks").pop();
check(ch2 && ch2.e.join(",").includes("205,12,200,3"), "đăng ký cột sau → ảnh chụp có khối đã sửa");
s1.ws.close(); s2.ws.close(); late2.ws.close();
fa.ws.close(); fb.ws.close(); late.ws.close(); far.ws.close();

// ───── Boss / sự kiện Vùng Kỳ quan nhiều người: chỗ trận, chủ trận, chuyển tiếp trạng thái / đòn, chọn chủ mới ─────
const BX = 800, BZ = 800;
const h1 = await sclient("88888888-0000-0000-0000-000000000008", [BX, 10, BZ]);
const h2 = await sclient("99999999-0000-0000-0000-000000000009", [BX + 5, 10, BZ]);
const id1 = h1.got.find((m) => m.t === "welcome")?.id;
const id2 = h2.got.find((m) => m.t === "welcome")?.id;
h1.ws.send(JSON.stringify({ t: "bfight", f: { kind: "x", cx: BX, cz: BZ, y: 10, seed: 1, rot: 0 } }));
h1.ws.send(JSON.stringify({ t: "bfight", f: { kind: "surveyor", cx: BX + 100, cz: BZ, y: 10, seed: 1, rot: 0 } }));
await sleep(250);
check(!h2.got.some((m) => m.t === "bfight"), "triệu hồi rác / quá xa chỗ đứng → bị bỏ");
h1.ws.send(JSON.stringify({ t: "bfight", f: { kind: "surveyor", cx: BX + 0.5, cz: BZ + 0.5, y: 10, seed: 42, rot: 0 } }));
await sleep(250);
const bf2 = h2.got.find((m) => m.t === "bfight" && !m.error);
const fid = bf2?.fid;
check(bf2 && bf2.host === id1 && bf2.kind === "surveyor" && bf2.f.seed === 42, "triệu hồi → cả phòng nhận chỗ trận, chủ = người triệu hồi");
check(h1.got.some((m) => m.t === "bfight" && m.fid === fid), "người triệu hồi nhận lại chỗ trận (biết fid)");
h1.ws.send(JSON.stringify({ t: "bstate", fid, s: { hp: 900, md: "fight" } }));
h2.ws.send(JSON.stringify({ t: "bstate", fid, s: { hp: 1, md: "dead" } }));
await sleep(250);
const bs = h2.got.filter((m) => m.t === "bstate");
check(bs.length === 1 && bs[0].s.hp === 900 && typeof bs[0].at === "number", "trạng thái của chủ tới khách (kèm giờ server); khách gửi trạng thái bị bỏ");
h2.ws.send(JSON.stringify({ t: "bhit", fid, k: "b", d: 999 }));
h2.ws.send(JSON.stringify({ t: "bhit", fid, k: "<x>", d: 5 }));
h1.ws.send(JSON.stringify({ t: "bhit", fid, k: "b", d: 5 }));
await sleep(250);
const bh = h1.got.filter((m) => m.t === "bhit");
check(bh.length === 1 && bh[0].d === 150 && bh[0].from === id2, `đòn của khách tới chủ (kẹp 150); mục tiêu rác / chủ tự gửi bị bỏ (${bh.length})`);
h2.ws.send(JSON.stringify({ t: "bfight", f: { kind: "ledger", cx: BX + 5, cz: BZ, y: 10, seed: 7, rot: 1 } }));
await sleep(250);
const again = h2.got.filter((m) => m.t === "bfight" && !m.error);
check(again.length === 2 && again[1].fid === fid && !h1.got.some((m) => m.t === "bfight" && m.f?.seed === 7), "triệu hồi gần trận đang có → nhận lại trận đó (không mở trận mới)");
const h3 = await sclient("aaaaaaaa-1111-0000-0000-00000000000a", [BX + 12, 10, BZ + 2]);
check(h3.got.some((m) => m.t === "bfight" && m.fid === fid) && h3.got.some((m) => m.t === "bstate" && m.fid === fid), "người vào sau nhận chỗ trận + trạng thái gần nhất");
h1.ws.close();
await sleep(300);
const ho = h3.got.find((m) => m.t === "bhost");
check(ho?.fid === fid && ho.host === id2, `chủ rời → người gần tâm nhất làm chủ (${ho?.host === id2})`);
h3.ws.send(JSON.stringify({ t: "bend", fid, r: "win" }));
await sleep(200);
check(!h3.got.some((m) => m.t === "bend"), "khách không kết thúc được trận");
h2.ws.send(JSON.stringify({ t: "bend", fid, r: "win" }));
await sleep(250);
check(h3.got.some((m) => m.t === "bend" && m.fid === fid && m.r === "win"), "chủ kết thúc trận → cả phòng nhận bend");
h2.ws.close(); h3.ws.close();
srv.kill();
console.log(fails.length ? `${fails.length} FAIL` : "ALL PASS");
process.exit(fails.length ? 1 : 0);
