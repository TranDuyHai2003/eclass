import { test } from "node:test";
import assert from "node:assert/strict";
import {
  archiveBlocked,
  cameraReach,
  CELL,
  cellBits,
  DARK,
  edgeKind,
  EXIT,
  HALL,
  HALLCELL,
  inHall,
  isCorridor,
  isOpen,
  OPEN,
  pillarAt,
  SHELFC,
  shouldMutate,
  SPAWN,
  type EpochFn,
} from "../../lib/world/archiveLayout";

const R = 0.3;

test("archive: bố cục tất định (cùng toạ độ ⇒ cùng ô, cạnh, cột)", () => {
  for (let j = -20; j <= 20; j++)
    for (let i = -20; i <= 20; i++) {
      assert.equal(cellBits(i, j), cellBits(i, j));
      for (let d = 0; d < 4; d++) assert.equal(edgeKind(i, j, d), edgeKind(i, j, d));
      assert.equal(pillarAt(i, j), pillarAt(i, j));
    }
});

test("archive: hành lang luôn mở, ô sảnh không phải ô mở, cửa sảnh không có tường", () => {
  for (let j = -30; j <= 30; j++)
    for (let i = -30; i <= 30; i++) {
      const b = cellBits(i, j);
      if (i >= HALL.i0 && i <= HALL.i1 && j >= HALL.j0 && j <= HALL.j1) {
        assert.equal(b, HALLCELL);
        continue;
      }
      if (isCorridor(i, j)) assert.ok(b & OPEN, `hành lang (${i},${j}) phải mở`);
      // kệ chỉ trong phòng
      if (b & SHELFC) assert.ok(!isCorridor(i, j));
    }
  assert.equal(edgeKind(0, 0, 0), 0);
  // hai ô cạnh cửa sảnh có tường quay vào lưới
  assert.equal(edgeKind(-1, 0, 0), 1);
  assert.equal(edgeKind(1, 0, 0), 1);
  // ô cửa sảnh luôn sáng (không hỏng đèn) — ấn tượng đầu
  assert.equal(cellBits(0, 0) & DARK, 0);
});

test("archive: càng sâu càng nhiều ô tối", () => {
  const ratio = (r0: number, r1: number) => {
    let n = 0;
    let dark = 0;
    for (let j = -r1; j <= r1; j++)
      for (let i = -r1; i <= r1; i++) {
        const d = Math.hypot(i, j);
        if (d < r0 || d > r1) continue;
        const b = cellBits(i, j);
        if (!(b & OPEN)) continue;
        n++;
        if (b & DARK) dark++;
      }
    return dark / n;
  };
  assert.ok(ratio(30, 40) > ratio(1, 8) + 0.15, `${ratio(1, 8)} → ${ratio(30, 40)}`);
});

/** loang trên lưới 0,2 m bằng chính hàm va chạm → tập ô tới được */
function flood(ep?: EpochFn, lim = 6) {
  const S = 0.2;
  const min = -lim * CELL - 1;
  const n = Math.ceil((2 * lim * CELL + 2) / S);
  const seen = new Uint8Array(n * n);
  const idx = (x: number, z: number) => Math.round((z - min) / S) * n + Math.round((x - min) / S);
  const q: number[] = [];
  const start = idx(SPAWN.x, SPAWN.z);
  assert.ok(!archiveBlocked(SPAWN.x, SPAWN.z, R, ep), "chỗ xuất hiện bị chặn");
  seen[start] = 1;
  q.push(start);
  while (q.length) {
    const k = q.pop()!;
    const gx = k % n;
    const gz = (k - gx) / n;
    for (const [dx, dz] of [
      [1, 0],
      [-1, 0],
      [0, 1],
      [0, -1],
    ]) {
      const nx = gx + dx;
      const nz = gz + dz;
      if (nx < 0 || nz < 0 || nx >= n || nz >= n) continue;
      const kk = nz * n + nx;
      if (seen[kk]) continue;
      if (archiveBlocked(min + nx * S, min + nz * S, R, ep)) continue;
      seen[kk] = 1;
      q.push(kk);
    }
  }
  return (x: number, z: number) => seen[idx(x, z)] === 1;
}

test("archive: từ chỗ xuất hiện đi tới được mọi ô mở trong vùng 13 × 13 ô (không ô nào bị bịt kín)", () => {
  const reach = flood();
  assert.ok(reach(EXIT.x, EXIT.z), "tới được cửa sổ trăng (điểm về)");
  let open = 0;
  for (let j = -6; j <= 6; j++)
    for (let i = -6; i <= 6; i++) {
      if (!isOpen(i, j)) continue;
      open++;
      // tâm ô (ô kệ: tâm nằm giữa lối đi)
      assert.ok(reach(i * CELL, j * CELL), `ô (${i},${j}) bị bịt kín`);
    }
  assert.ok(open > 90, `quá ít ô mở: ${open}`);
});

test("archive: phòng đổi dạng (epoch) vẫn giữ liên thông", () => {
  const ep: EpochFn = (i, j) => ((i * 7 + j * 13) & 3) + 1;
  const reach = flood(ep);
  for (let j = -6; j <= 6; j++)
    for (let i = -6; i <= 6; i++) if (isOpen(i, j, ep)) assert.ok(reach(i * CELL, j * CELL), `ô (${i},${j}) bị bịt kín (epoch)`);
  // hành lang không đổi theo epoch
  for (let k = -9; k <= 9; k++) assert.equal(cellBits(0, k, ep), cellBits(0, k));
});

test("archive: va chạm tường / cửa / cột / kệ / sảnh", () => {
  // tường sảnh và tường cuối
  assert.ok(archiveBlocked(HALL.innerX - 0.1, -10, R));
  assert.ok(archiveBlocked(0, HALL.end + 0.1, R));
  assert.ok(!archiveBlocked(0, -10, R));
  // đi qua cửa sảnh (giữa) được, mép tường đầu sảnh thì không
  assert.ok(!archiveBlocked(0, -2, R));
  assert.ok(!archiveBlocked(0, -1.5, R));
  assert.ok(archiveBlocked(2.6, -2.2, R));
  assert.ok(archiveBlocked(2.6, -1.8, R));
  assert.ok(!archiveBlocked(2.4, -3.0, R));
  assert.ok(inHall(0, -10) && !inHall(0, 1));
  // tìm một tường, một cửa, một cột, một kệ và kiểm chặn đúng chỗ
  let wall = false;
  let door = false;
  let shelf = false;
  let pillar = false;
  for (let j = -12; j <= 12; j++)
    for (let i = -12; i <= 12; i++) {
      if (!isOpen(i, j)) continue;
      const cx = i * CELL;
      const cz = j * CELL;
      for (let d = 0; d < 4; d++) {
        const k = edgeKind(i, j, d);
        const ex = cx + [0, 2, 0, -2][d];
        const ez = cz + [-2, 0, 2, 0][d];
        if (k) {
          // ngay sát mặt tường (phía ô mở) bị chặn
          const ix = cx + [0, 1.75, 0, -1.75][d];
          const iz = cz + [-1.75, 0, 1.75, 0][d];
          assert.ok(archiveBlocked(ix, iz, R), `cạnh (${i},${j},${d})`);
          if (k === 1) wall = true;
          if (k === 2) door = true;
        } else if (isOpen(i + [0, 1, 0, -1][d], j + [-1, 0, 1, 0][d]) && !(cellBits(i, j) & SHELFC)) {
          // cạnh trống giữa hai ô mở (không kệ): giữa cạnh đi qua được, trừ khi có cột / kệ ô bên kia
          const nb = cellBits(i + [0, 1, 0, -1][d], j + [-1, 0, 1, 0][d]);
          if (!(nb & SHELFC) && d % 2 === 1) assert.ok(!archiveBlocked(ex, ez, R), `cạnh trống (${i},${j},${d})`);
        }
      }
      if (cellBits(i, j) & SHELFC) {
        shelf = true;
        assert.ok(archiveBlocked(cx, cz + 1.2, R), "dãy kệ chặn");
        assert.ok(!archiveBlocked(cx, cz, R), "lối giữa kệ đi được");
      }
      if (pillarAt(i, j)) {
        pillar = true;
        assert.ok(archiveBlocked(i * CELL - 2 + 0.3, j * CELL - 2 + 0.3, R), "cột chặn");
      }
    }
  assert.ok(wall && door && shelf && pillar, `thiếu mẫu: tường ${wall} cửa ${door} kệ ${shelf} cột ${pillar}`);
  // ô đặc: chặn
  for (let j = -6; j <= 6; j++)
    for (let i = -6; i <= 6; i++) if (!isOpen(i, j) && !(cellBits(i, j) & HALLCELL)) assert.ok(archiveBlocked(i * CELL, j * CELL, R));
});

test("archive: máy quay dừng trước tường", () => {
  // trong sảnh: lùi máy về phía tường dọc → bị cắt trước tường
  const t = cameraReach(0, -10, 6, -10);
  assert.ok(t > 0.2 && t < 0.55, `t = ${t}`);
  assert.equal(cameraReach(0, -10, 0, -14), 1);
});

test("archive: chỉ đổi ô phòng ở xa, sau lưng", () => {
  // nhìn về −z; ô phía +z xa → có thể đổi; ô phía trước / gần / hành lang → không
  let some = false;
  for (let j = 3; j <= 8; j++)
    for (let i = -6; i <= 6; i++) {
      if (isCorridor(i, j)) assert.equal(shouldMutate(i, j, 0, 0, 0, -1, 5), false);
      if (shouldMutate(i, j, 0, 0, 0, -1, 5)) some = true;
    }
  assert.ok(some);
  for (let j = -8; j <= -3; j++) for (let i = -6; i <= 6; i++) assert.equal(shouldMutate(i, j, 0, 0, 0, -1, 5), false);
  assert.equal(shouldMutate(1, 1, 0, 0, 0, -1, 5), false);
});
