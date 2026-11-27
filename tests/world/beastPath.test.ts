import { test } from "node:test";
import assert from "node:assert/strict";
import { pathAt, spine, speedAt, type BeastPath } from "@/lib/world/beastPath";

const P: BeastPath = { R: 180, r2: 40, k: 3, H: 60, A: 15, cx: 0, cz: 0 };

test("đường bay khép kín (tham số 0 và 2π trùng nhau), luôn ở trên cao", () => {
  const a = pathAt(P, 0);
  const b = pathAt(P, Math.PI * 2);
  assert.ok(Math.hypot(a[0] - b[0], a[1] - b[1], a[2] - b[2]) < 1e-9);
  for (let t = 0; t < 6.3; t += 0.1) assert.ok(pathAt(P, t)[1] > P.H - P.A * 1.5);
});

test("thân không sóng: các điểm xương cách đều ≈ bodyLen / (n − 1)", () => {
  const n = 64;
  const s = spine(P, 1.0, n, 90, 0, 20, 0);
  const ds = 90 / (n - 1);
  for (let i = 1; i < n; i++) {
    const d = Math.hypot(s.pos[i * 3] - s.pos[i * 3 - 3], s.pos[i * 3 + 1] - s.pos[i * 3 - 2], s.pos[i * 3 + 2] - s.pos[i * 3 - 1]);
    assert.ok(Math.abs(d - ds) < ds * 0.08, `đoạn ${i}: ${d}`);
  }
  assert.ok(speedAt(P, 0.5) > 0);
});

test("khung xương trực chuẩn (T, N, B) và không lật đột ngột giữa hai điểm liền kề", () => {
  const s = spine(P, 2.0, 48, 120, 4, 25, 1.2);
  for (let i = 0; i < 48; i++) {
    const T = [s.tan[i * 3], s.tan[i * 3 + 1], s.tan[i * 3 + 2]];
    const N = [s.nrm[i * 3], s.nrm[i * 3 + 1], s.nrm[i * 3 + 2]];
    const B = [s.bin[i * 3], s.bin[i * 3 + 1], s.bin[i * 3 + 2]];
    const d = (a: number[], b: number[]) => a[0] * b[0] + a[1] * b[1] + a[2] * b[2];
    assert.ok(Math.abs(d(T, N)) < 1e-6 && Math.abs(d(T, B)) < 1e-6 && Math.abs(d(N, B)) < 1e-6);
    assert.ok(Math.abs(d(N, N) - 1) < 1e-6);
    if (i > 0) {
      const Np = [s.nrm[i * 3 - 3], s.nrm[i * 3 - 2], s.nrm[i * 3 - 1]];
      assert.ok(d(N, Np) > 0.9, `lật khung tại ${i}`);
    }
  }
});

test("sóng thân: biên độ ở đuôi lớn hơn ở đầu", () => {
  const flat = spine(P, 2.0, 32, 100, 0, 20, 0);
  const wav = spine(P, 2.0, 32, 100, 5, 20, 0.9);
  const off = (i: number) => Math.hypot(wav.pos[i * 3] - flat.pos[i * 3], wav.pos[i * 3 + 1] - flat.pos[i * 3 + 1], wav.pos[i * 3 + 2] - flat.pos[i * 3 + 2]);
  let head = 0;
  let tail = 0;
  for (let i = 0; i < 6; i++) head = Math.max(head, off(i));
  for (let i = 26; i < 32; i++) tail = Math.max(tail, off(i));
  assert.ok(tail > head * 1.5, `đầu ${head} đuôi ${tail}`);
});
