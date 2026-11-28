import { test } from "node:test";
import assert from "node:assert/strict";
import { BUFFER_MS, bufferPress, clearBuf, dashDecision, hasBuffered, newBuf, takeBuffered } from "@/lib/world/inputBuffer";
import { PARTICLE_CAP, bossFrame, canEmit, closeness, particleCap, scaleCount } from "@/lib/world/vfxBudget";

test("đệm phím: bấm sớm ≤ 150 ms → đòn kế ra đúng lúc được phép", () => {
  const b = newBuf();
  assert.equal(takeBuffered(b, 0, 500), "none");
  bufferPress(b, 400); // sớm 100 ms
  assert.equal(takeBuffered(b, 450, 500), "wait");
  assert.equal(takeBuffered(b, 499.9, 500), "wait");
  assert.equal(takeBuffered(b, 500, 500), "fire");
  assert.equal(hasBuffered(b), false);
  assert.equal(takeBuffered(b, 520, 500), "none");
});

test("đệm phím: bấm sớm hơn 150 ms → bỏ (không ra đòn ma)", () => {
  const b = newBuf();
  bufferPress(b, 500 - BUFFER_MS - 1);
  assert.equal(takeBuffered(b, 400, 500), "drop");
  assert.equal(hasBuffered(b), false);
  // đúng biên 150 ms vẫn giữ
  bufferPress(b, 500 - BUFFER_MS);
  assert.equal(takeBuffered(b, 500, 500), "fire");
});

test("đệm phím: bấm lại ghi đè lần bấm cũ (lần bấm quá sớm được cứu bởi lần sau)", () => {
  const b = newBuf();
  bufferPress(b, 100);
  bufferPress(b, 420);
  assert.equal(takeBuffered(b, 500, 500), "fire");
  bufferPress(b, 1);
  clearBuf(b);
  assert.equal(takeBuffered(b, 600, 500), "none");
});

test("đệm phím: tới lúc mới hỏi (khung hình trễ) vẫn ra đòn nếu lần bấm hợp lệ", () => {
  const b = newBuf();
  bufferPress(b, 380);
  assert.equal(takeBuffered(b, 540, 500), "fire");
});

test("lướt huỷ đòn: đang vung → huỷ; rảnh → lướt thường; đang lướt khác → bỏ qua", () => {
  assert.equal(dashDecision(true, 100, 0, 0), "cancel");
  assert.equal(dashDecision(false, 100, 0, 0), "free");
  // đang trong cú lướt (né) khác
  assert.equal(dashDecision(false, 100, 300, 0), "busy");
  assert.equal(dashDecision(true, 100, 300, 0), "busy");
  // bước lao của CHÍNH nhát đang vung → vẫn huỷ được
  assert.equal(dashDecision(true, 100, 300, 300), "cancel");
  // bước lao đã hết, cú lướt đang chạy là cú khác
  assert.equal(dashDecision(true, 400, 500, 300), "busy");
});

test("ngân sách hạt theo mức đồ hoạ", () => {
  assert.ok(particleCap(0) < particleCap(1) && particleCap(1) < particleCap(2));
  assert.equal(particleCap(2), 480);
  assert.equal(scaleCount(24, 2), 24);
  assert.equal(scaleCount(24, 0), 10);
  assert.equal(scaleCount(1, 0), 1);
  assert.equal(scaleCount(0, 2), 0);
  assert.equal(canEmit(PARTICLE_CAP[0] - 1, 0), true);
  assert.equal(canEmit(PARTICLE_CAP[0], 0), false);
});

test("máy quay quanh boss: xa thì giữ nguyên, sát thì lùi xa + hạ góc + nâng điểm nhìn", () => {
  assert.equal(closeness(20, 5, 13), 0);
  assert.equal(closeness(3, 5, 13), 1);
  const mid = closeness(9, 5, 13);
  assert.ok(mid > 0 && mid < 1);
  assert.deepEqual(bossFrame(5, 0.3, 0), { dist: 5, pitch: 0.3, lift: 0 });
  const f = bossFrame(5, 0.3, 1);
  assert.ok(f.dist > 7.9 && f.dist < 8.1);
  assert.ok(f.pitch < 0.3 && f.pitch > 0.02);
  assert.ok(f.lift > 0);
  // góc đã thấp sẵn (người chơi tự hạ) → không bị kéo lên
  assert.equal(bossFrame(5, -0.1, 1).pitch, -0.1);
});
