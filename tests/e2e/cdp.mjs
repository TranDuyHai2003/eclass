// Điều khiển Chrome headless qua DevTools Protocol (không cần cài thêm thư viện)
import { spawn } from "child_process";
import fs from "fs";
import os from "os";
import path from "path";

const CHROME_CANDIDATES = [
  process.env.CHROME_PATH,
  "/usr/bin/google-chrome",
  "/usr/bin/chromium",
  "/usr/bin/chromium-browser",
  path.join(os.homedir(), ".cache/ms-playwright/chromium-1248/chrome-linux64/chrome"),
].filter(Boolean);

export const sleep = (ms) => new Promise((r) => setTimeout(r, ms));

export async function openBrowser({ baseUrl, token, width = 1366, height = 900 }) {
  const bin = CHROME_CANDIDATES.find((p) => fs.existsSync(p));
  if (!bin) throw new Error("Không tìm thấy Chrome — đặt biến CHROME_PATH");
  const port = 9300 + Math.floor(Math.random() * 600);
  const dir = fs.mkdtempSync(path.join(os.tmpdir(), "points-e2e-"));
  const chrome = spawn(bin, ["--headless=new", `--remote-debugging-port=${port}`, "--no-first-run", "--no-sandbox", `--user-data-dir=${dir}`, "about:blank"], { stdio: "ignore" });
  let target;
  for (let i = 0; i < 75 && !target; i++) {
    try {
      target = (await (await fetch(`http://127.0.0.1:${port}/json`)).json()).find((t) => t.type === "page");
    } catch {}
    if (!target) await sleep(200);
  }
  if (!target) throw new Error("Chrome không khởi động được");
  const ws = new WebSocket(target.webSocketDebuggerUrl);
  await new Promise((r) => (ws.onopen = r));
  let id = 0;
  const pending = new Map();
  const errors = [];
  ws.onmessage = (e) => {
    const m = JSON.parse(e.data);
    if (m.id && pending.has(m.id)) {
      pending.get(m.id)(m);
      pending.delete(m.id);
    }
    if (m.method === "Runtime.exceptionThrown") errors.push(m.params.exceptionDetails.exception?.description?.split("\n")[0]);
    // Hộp thoại (vd "Rời trang khi chưa lưu?") chặn mọi lệnh khác → tự đồng ý để test không treo
    if (m.method === "Page.javascriptDialogOpening") ws.send(JSON.stringify({ id: ++id, method: "Page.handleJavaScriptDialog", params: { accept: true } }));
  };
  const send = (method, params = {}) =>
    new Promise((r) => {
      const i = ++id;
      pending.set(i, r);
      ws.send(JSON.stringify({ id: i, method, params }));
    });
  const setSize = (w, h) => send("Emulation.setDeviceMetricsOverride", { width: w, height: h, deviceScaleFactor: 1, mobile: w < 600 });
  await setSize(width, height);
  await send("Network.enable");
  await send("Runtime.enable");
  await send("Page.enable");
  const host = new URL(baseUrl).hostname;
  if (token) await send("Network.setCookie", { name: "authjs.session-token", value: token, domain: host, path: "/", httpOnly: true });

  const ev = async (expr) => {
    const r = await send("Runtime.evaluate", { expression: `(async()=>{${expr}})()`, awaitPromise: true, returnByValue: true });
    if (r.result?.exceptionDetails) throw new Error("JS lỗi: " + r.result.exceptionDetails.exception?.description?.slice(0, 200));
    return r.result?.result?.value;
  };
  // Chờ tới khi có đoạn chữ xuất hiện (hoặc hết giờ)
  const waitText = async (re, timeout = 15000) => {
    const start = Date.now();
    while (Date.now() - start < timeout) {
      const t = await ev("return document.body?.innerText || ''");
      if (re.test(t)) return true;
      await sleep(250);
    }
    return false;
  };
  return {
    errors,
    ev,
    waitText,
    setSize,
    async goto(p, readyRe) {
      await send("Page.navigate", { url: baseUrl + p });
      await sleep(800);
      if (readyRe && !(await waitText(readyRe, 30000))) throw new Error(`Trang ${p} không hiện "${readyRe}"`);
      await sleep(400);
    },
    async screenshot(file, { fullPage = false } = {}) {
      let restore = null;
      try {
        if (fullPage) {
          // Trang có thể cuộn bên trong khung → tạm kéo cao khung nhìn bằng chiều cao thật của nội dung (số nguyên cho CDP)
          const vp = await ev("return [innerWidth, innerHeight]");
          const full = Math.ceil(
            await ev("return Math.min(7000, Math.max(document.documentElement.scrollHeight, document.body.scrollHeight, ...[...document.querySelectorAll('main')].map(m => m.scrollHeight + m.getBoundingClientRect().top)))"),
          );
          if (full > vp[1]) {
            restore = vp;
            await setSize(vp[0], full);
            await sleep(500);
          }
        }
        const r = await send("Page.captureScreenshot", { format: "png" });
        fs.writeFileSync(file, Buffer.from(r.result.data, "base64"));
      } finally {
        if (restore) await setSize(restore[0], restore[1]);
      }
    },
    /** Bấm phần tử đang hiện có chữ khớp regex (không phân biệt hoa thường vì CSS có thể viết hoa) */
    async click(re, selector = "button,a,label", { optional = false } = {}) {
      const src = re.source.replace(/\\/g, "\\\\").replace(/"/g, '\\"');
      const ok = await ev(`const re=new RegExp("${src}","i"); const el=[...document.querySelectorAll(${JSON.stringify(selector)})].find(e=>re.test((e.innerText||"").trim())&&e.offsetParent!==null&&!e.disabled); if(!el) return false; el.click(); return true;`);
      if (!ok && !optional) throw new Error(`Không thấy nút /${re.source}/ (${selector})`);
      await sleep(700);
      return ok;
    },
    async isDisabled(re, selector = "button") {
      const src = re.source.replace(/\\/g, "\\\\").replace(/"/g, '\\"');
      return ev(`const re=new RegExp("${src}","i"); const el=[...document.querySelectorAll(${JSON.stringify(selector)})].find(e=>re.test((e.innerText||"").trim())&&e.offsetParent!==null); return el ? el.disabled : null;`);
    },
    /** Gõ vào ô (đúng cách để React nhận) */
    async fill(selector, value) {
      const ok = await ev(`const el=document.querySelector(${JSON.stringify(selector)}); if(!el) return false; const proto=el.tagName==="SELECT"?HTMLSelectElement.prototype:el.tagName==="TEXTAREA"?HTMLTextAreaElement.prototype:HTMLInputElement.prototype; Object.getOwnPropertyDescriptor(proto,"value").set.call(el,${JSON.stringify(String(value))}); el.dispatchEvent(new Event(el.tagName==="SELECT"?"change":"input",{bubbles:true})); return true;`);
      if (!ok) throw new Error(`Không thấy ô ${selector}`);
      await sleep(400);
    },
    text: () => ev("return document.body.innerText"),
    /** Bấm chuột thật tại toạ độ màn hình (kèm Shift/Alt/Ctrl) — để thử các thao tác có phím bổ trợ */
    async mouseClick(x, y, { shift = false, alt = false, ctrl = false } = {}) {
      const modifiers = (alt ? 1 : 0) | (ctrl ? 2 : 0) | (shift ? 8 : 0);
      await send("Input.dispatchMouseEvent", { type: "mouseMoved", x, y, modifiers });
      await send("Input.dispatchMouseEvent", { type: "mousePressed", x, y, button: "left", clickCount: 1, modifiers });
      await send("Input.dispatchMouseEvent", { type: "mouseReleased", x, y, button: "left", clickCount: 1, modifiers });
      await sleep(400);
    },
    /** Kéo chuột từ (x1,y1) tới (x2,y2) */
    async mouseDrag(x1, y1, x2, y2, steps = 8) {
      await send("Input.dispatchMouseEvent", { type: "mouseMoved", x: x1, y: y1 });
      await send("Input.dispatchMouseEvent", { type: "mousePressed", x: x1, y: y1, button: "left", clickCount: 1 });
      for (let i = 1; i <= steps; i++) {
        await send("Input.dispatchMouseEvent", { type: "mouseMoved", x: x1 + ((x2 - x1) * i) / steps, y: y1 + ((y2 - y1) * i) / steps, button: "left", buttons: 1 });
        await sleep(30);
      }
      await send("Input.dispatchMouseEvent", { type: "mouseReleased", x: x2, y: y2, button: "left", clickCount: 1 });
      await sleep(400);
    },
    /** Gõ phím (vd "z" với ctrl:true → Ctrl+Z) */
    async press(key, { ctrl = false, shift = false } = {}) {
      const modifiers = (ctrl ? 2 : 0) | (shift ? 8 : 0);
      const code = key.length === 1 ? "Key" + key.toUpperCase() : key;
      const vk = key.length === 1 ? key.toUpperCase().charCodeAt(0) : { ArrowDown: 40, ArrowUp: 38, Escape: 27 }[key];
      await send("Input.dispatchKeyEvent", { type: "keyDown", key, code, modifiers, windowsVirtualKeyCode: vk });
      await send("Input.dispatchKeyEvent", { type: "keyUp", key, code, modifiers, windowsVirtualKeyCode: vk });
      await sleep(400);
    },
    /** Phần tử tràn ra ngoài màn hình (không tính phần nằm trong khung cuộn ngang) */
    layoutProblems: () =>
      ev(`
        const vw = document.documentElement.clientWidth;
        const out = [];
        if (document.documentElement.scrollWidth > vw + 1) out.push("trang cuộn ngang: " + document.documentElement.scrollWidth + " > " + vw);
        // Tổ tiên gần nhất có cắt nội dung (overflow-x khác visible)
        const clipper = (el) => { for (let p = el.parentElement; p; p = p.parentElement) { const o = getComputedStyle(p).overflowX; if (o !== "visible") return p; } return null; };
        const label = (el) => el.tagName.toLowerCase() + " '" + (el.innerText || "").trim().replace(/\s+/g, " ").slice(0, 30) + "'";
        for (const el of document.querySelectorAll("main *, header *")) {
          const cs = getComputedStyle(el);
          const r = el.getBoundingClientRect();
          if (!r.width || !r.height || cs.visibility === "hidden" || cs.display === "none") continue;
          // Phần trang trí (absolute/fixed, aria-hidden) được phép tràn ra và bị cắt
          if (cs.position === "absolute" || cs.position === "fixed" || el.closest("[aria-hidden=true]")) continue;
          // Phần tử con có chữ vượt ra khỏi khung cha (vd hàng flex không xuống dòng bị ép quá hẹp → đè lên phần tử bên cạnh).
          // Bỏ qua con absolute/fixed (nhãn trang trí đặt chồng có chủ đích).
          if (cs.overflowX === "visible" && cs.display !== "inline" && el.clientWidth > 0) {
            for (const ch of el.children) {
              const ccs = getComputedStyle(ch);
              if (ccs.position === "absolute" || ccs.position === "fixed" || ccs.display === "none" || !(ch.innerText || "").trim()) continue;
              const chr = ch.getBoundingClientRect();
              if (chr.width && (chr.right > r.right + 2 || chr.left < r.left - 2)) {
                out.push("tràn khung: " + label(ch) + " vượt khỏi " + label(el) + " (" + Math.round(chr.right) + " > " + Math.round(r.right) + ")");
                break;
              }
            }
          }
          const c = clipper(el);
          if (!c) {
            if (r.right > vw + 1 || r.left < -1) out.push("tràn màn hình: " + label(el) + " right=" + Math.round(r.right));
            continue;
          }
          const co = getComputedStyle(c).overflowX;
          if (co === "auto" || co === "scroll") continue; // khung cuộn ngang có chủ đích
          const cr = c.getBoundingClientRect();
          // Chỉ xét phần tử có chữ (chữ bị cắt là lỗi; ô 'truncate' tự cắt bên trong nên không tính)
          if ((el.innerText || "").trim() && (r.right > Math.min(cr.right, vw) + 1)) out.push("bị cắt: " + label(el) + " right=" + Math.round(r.right) + " > " + Math.round(Math.min(cr.right, vw)));
        }
        // Thừa khoảng trống: ở màn rộng, <main> phải dùng gần hết bề ngang vùng dành cho nó (vd đặt nhầm max-w nhỏ hơn các trang khác)
        const main = document.querySelector("main");
        if (main && main.parentElement && innerWidth >= 1280) {
          const gap = main.parentElement.getBoundingClientRect().right - main.getBoundingClientRect().right;
          if (gap > 160) out.push("thừa khoảng trống bên phải nội dung chính: " + Math.round(gap) + "px");
        }
        return [...new Set(out)].slice(0, 8);
      `),
    async close() {
      ws.close();
      chrome.kill();
      await sleep(300);
      try {
        fs.rmSync(dir, { recursive: true, force: true });
      } catch {}
    },
  };
}
