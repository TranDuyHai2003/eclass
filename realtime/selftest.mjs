// Tự kiểm server realtime (chạy: node realtime/selftest.mjs) — server tạm cổng 2599, ALLOW_ANON, dữ liệu trong thư mục tạm:
//   tên tự đặt (lọc), tên mặc định, đổi tên (gộp trong 2 s, phát tên mới nhất), quaternion nghiêng s[8] (hợp lệ / rác)
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
a.ws.close(); b.ws.close(); srv.kill();
console.log(fails.length ? `${fails.length} FAIL` : "ALL PASS");
process.exit(fails.length ? 1 : 0);
