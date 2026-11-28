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
  CABINET,
  DESK,
  DESK_R,
  floorLight,
  propLight,
  pillarLight,
  spillAt,
  lampOn,
  depthTint,
  PAGES,
  pagePos,
  pageNear,
  presenceStep,
  presenceRespawn,
  presenceCell,
  PRESENCE_MIN,
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

/** điểm đại diện của ô: tâm, hoặc (ô có bàn đọc chiếm giữa) hai điểm trên trục z cách tâm 1,45 m */
function cellReach(reach: (x: number, z: number) => boolean, i: number, j: number, ep?: EpochFn) {
  if (!(cellBits(i, j, ep) & DESK)) return reach(i * CELL, j * CELL);
  return reach(i * CELL, j * CELL + 1.45) || reach(i * CELL, j * CELL - 1.45) || reach(i * CELL + 1.45, j * CELL) || reach(i * CELL - 1.45, j * CELL);
}

test("archive: từ chỗ xuất hiện đi tới được mọi ô mở trong vùng 13 × 13 ô (không ô nào bị bịt kín)", () => {
  const reach = flood();
  assert.ok(reach(EXIT.x, EXIT.z), "tới được cửa sổ trăng (điểm về)");
  let open = 0;
  for (let j = -6; j <= 6; j++)
    for (let i = -6; i <= 6; i++) {
      if (!isOpen(i, j)) continue;
      open++;
      // tâm ô (ô kệ: tâm nằm giữa lối đi; ô bàn đọc: dải trống quanh bàn)
      assert.ok(cellReach(reach, i, j), `ô (${i},${j}) bị bịt kín`);
    }
  assert.ok(open > 90, `quá ít ô mở: ${open}`);
});

test("archive: phòng đổi dạng (epoch) vẫn giữ liên thông", () => {
  const ep: EpochFn = (i, j) => ((i * 7 + j * 13) & 3) + 1;
  const reach = flood(ep);
  for (let j = -6; j <= 6; j++)
    for (let i = -6; i <= 6; i++) if (isOpen(i, j, ep)) assert.ok(cellReach(reach, i, j, ep), `ô (${i},${j}) bị bịt kín (epoch)`);
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

test("archive: tủ hồ sơ / bàn đọc — chỉ trong phòng, bàn chặn giữa ô, có đủ mẫu", () => {
  let cab = 0;
  let desk = 0;
  let deskDark = 0;
  for (let j = -30; j <= 30; j++)
    for (let i = -30; i <= 30; i++) {
      const b = cellBits(i, j);
      if (b & CABINET) {
        cab++;
        assert.ok(b & SHELFC, "tủ hồ sơ là biến thể của ô kệ");
      }
      if (b & DESK) {
        desk++;
        if (b & DARK) deskDark++;
        assert.ok(!isCorridor(i, j) && !(b & SHELFC), `bàn chỉ trong phòng không kệ (${i},${j})`);
        assert.ok(archiveBlocked(i * CELL + DESK_R * 0.5, j * CELL, R), "bàn chặn");
        assert.ok(!archiveBlocked(i * CELL, j * CELL + DESK_R + R + 0.05, R) || archiveBlocked(i * CELL, j * CELL + 1.9, R), "quanh bàn đi được");
      }
    }
  assert.ok(cab > 20 && desk > 20, `thiếu mẫu: tủ ${cab}, bàn ${desk}`);
  assert.ok(deskDark / desk > 0.4, `bàn đọc chủ yếu trong ô tối: ${deskDark}/${desk}`);
});

test("archive: ánh sáng nướng theo ô — ô tối tối thật, càng nhiều đèn hỏng quanh càng tối", () => {
  let darkSeen = 0;
  for (let j = -20; j <= 20; j++)
    for (let i = -20; i <= 20; i++) {
      const b = cellBits(i, j);
      if (!(b & OPEN)) {
        assert.equal(floorLight(i, j), 0);
        continue;
      }
      if (lampOn(i, j)) {
        assert.equal(floorLight(i, j), 1);
        assert.equal(propLight(i, j), 1);
        continue;
      }
      darkSeen++;
      const sp = spillAt(i, j);
      assert.ok(sp >= 0 && sp <= 1);
      assert.ok(Math.abs(floorLight(i, j) - sp * sp) < 1e-9);
      assert.ok(propLight(i, j) <= 0.06 + 1e-9, "tường / kệ ô tối chỉ còn ánh sáng tràn");
    }
  assert.ok(darkSeen > 50);
  for (let j = -6; j <= 6; j++) for (let i = -6; i <= 6; i++) assert.ok(pillarLight(i, j) >= 0 && pillarLight(i, j) <= 1);
  // độ sâu: tối + lạnh dần (xanh giữ nhiều hơn đỏ)
  const a = depthTint(0, [0, 0, 0]);
  const b = depthTint(1, [0, 0, 0]);
  assert.deepEqual(a, [1, 1, 1]);
  assert.ok(b[2] < 1 && b[0] < b[1] && b[1] < b[2]);
});

test("archive: 5 trang Hồi âm nằm trên sàn đi tới được, nhặt theo khoảng cách", () => {
  const reach = flood(undefined, 16);
  PAGES.forEach((pg, k) => {
    assert.ok(isCorridor(pg.i, pg.j), `trang ${k} trên hành lang (luôn mở)`);
    const { x, z } = pagePos(k);
    assert.ok(!archiveBlocked(x, z, R), `trang ${k} không nằm trong vật cản`);
    assert.ok(reach(x, z), `trang ${k} đi tới được`);
    assert.equal(pageNear(x + 0.5, z, 0), k);
    assert.equal(pageNear(x + 0.5, z, 1 << k), -1, "đã nhặt thì không nhặt lại");
  });
  assert.equal(pageNear(0, -10, 0), -1);
});

test("archive: hiện diện vô hình — đứng yên khi bị nhìn, mỗi bước ≤ 1 ô, không lại gần quá PRESENCE_MIN", () => {
  let moved = 0;
  for (let t = 0; t < 400; t++) {
    const i = ((t * 7) % 23) - 11;
    const j = ((t * 11) % 19) - 4;
    if (!presenceCell(i, j)) continue;
    const pi = ((t * 5) % 9) - 4;
    const pj = ((t * 3) % 9) - 2;
    assert.deepEqual(presenceStep(i, j, pi, pj, true, t), [i, j], "bị nhìn thì đứng yên");
    const [ni, nj] = presenceStep(i, j, pi, pj, false, t);
    assert.ok(Math.abs(ni - i) + Math.abs(nj - j) <= 1, "mỗi bước tối đa một ô");
    assert.ok(presenceCell(ni, nj));
    if (ni !== i || nj !== j) {
      moved++;
      assert.ok(Math.max(Math.abs(ni - pi), Math.abs(nj - pj)) >= PRESENCE_MIN, "không lại gần quá");
    }
  }
  assert.ok(moved > 20, `ít di chuyển: ${moved}`);
  // xuất hiện lại sau lưng (nhìn về −z → xuất hiện ở phía +z)
  let n = 0;
  for (let t = 0; t < 30; t++) {
    const r = presenceRespawn(0, 6, 0, -1, t);
    if (!r) continue;
    n++;
    assert.ok(r[1] > 6, `sau lưng: ${r}`);
    assert.ok(presenceCell(r[0], r[1]));
  }
  assert.ok(n > 20);
});
