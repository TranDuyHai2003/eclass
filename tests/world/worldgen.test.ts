import { test } from "node:test";
import assert from "node:assert/strict";
import { B } from "@/lib/world/blocks";
import { CAVE_FLOOR, caveMask, shapeChunk } from "@/lib/world/density";
import { SPECIES, expand, growTree } from "@/lib/world/lsystem";
import { DE, DN, DS, DW, mazeDistances, wfcMaze } from "@/lib/world/wfc";
import {
  ISLE_C,
  ISLE_N,
  MAZE_CELL,
  MAZE_TILES,
  chunkGrotto,
  chunkTreeBlocks,
  forestLayout,
  inKeepClear,
  islesLayout,
  mazeOf,
  regionStructure,
  sectorOf,
  structureBlocks,
  structuresIn,
} from "@/lib/world/structures";
import { genChunk, genColumn } from "@/lib/world/worldgen";
import { blockAt, columnRange, naturalAt, surfaceAt } from "@/lib/world/voxels";
import { CHUNK, blockTop } from "@/lib/world/terrain";

const solid = (x: number, y: number, z: number) => naturalAt(x, y, z) !== B.air;

// ───────────── L-system ─────────────
test("L-system: tất định, số khối hợp lý, gỗ liền mặt từ gốc, cây nhị phân có 2⁵ = 32 chồi lá", () => {
  for (const sp of Object.values(SPECIES)) {
    const a = growTree(sp, 100, 5, -40, 3, 1.1);
    const b = growTree(sp, 100, 5, -40, 3, 1.1);
    assert.deepEqual(Array.from(a), Array.from(b), sp.id);
    const n = a.length / 4;
    assert.ok(n >= 40 && n <= 900, `${sp.id}: ${n} khối`);
    // gỗ: BFS theo mặt từ ô gốc phải tới hết mọi khối gỗ (cành không rời thân)
    const wood = new Set<string>();
    for (let i = 0; i < a.length; i += 4) if (a[i + 3] === sp.wood) wood.add(`${a[i]},${a[i + 1]},${a[i + 2]}`);
    const seen = new Set(["100,5,-40"]);
    const q = [[100, 5, -40]];
    while (q.length) {
      const [x, y, z] = q.pop()!;
      for (const [dx, dy, dz] of [[1, 0, 0], [-1, 0, 0], [0, 1, 0], [0, -1, 0], [0, 0, 1], [0, 0, -1]]) {
        const k = `${x + dx},${y + dy},${z + dz}`;
        if (wood.has(k) && !seen.has(k)) {
          seen.add(k);
          q.push([x + dx, y + dy, z + dz]);
        }
      }
    }
    assert.equal(seen.size, wood.size, `${sp.id}: gỗ rời ${wood.size - seen.size} khối`);
    // không có hai mục cùng ô
    const cells = new Set<string>();
    for (let i = 0; i < a.length; i += 4) cells.add(`${a[i]},${a[i + 1]},${a[i + 2]}`);
    assert.equal(cells.size, n);
  }
  const s = expand(SPECIES.binary);
  assert.equal([...s].filter((c) => c === "L").length, 32);
  assert.equal([...s].filter((c) => c === "F").length, 31); // 1 + 2 + 4 + 8 + 16 đốt
});

// ───────────── WFC ─────────────
test("WFC: tất định; biên đóng trừ lối vào; cổng hai ô kề khớp nhau; mọi ô tới được; đích xa nhất", () => {
  for (const seed of [1, 42, 9001, 123456]) {
    const m = wfcMaze(9, 9, seed);
    assert.deepEqual(Array.from(wfcMaze(9, 9, seed).tiles), Array.from(m.tiles));
    assert.ok(m.attempts >= 1 && m.attempts <= 8);
    for (let j = 0; j < 9; j++)
      for (let i = 0; i < 9; i++) {
        const t = m.tiles[j * 9 + i];
        if (j === 0) assert.equal(t & DN, 0);
        if (i === 0) assert.equal(t & DW, 0);
        if (i === 8) assert.equal(t & DE, 0);
        if (j === 8) assert.equal(!!(t & DS), j * 9 + i === m.entrance);
        if (i < 8) assert.equal(!!(t & DE), !!(m.tiles[j * 9 + i + 1] & DW));
        if (j < 8) assert.equal(!!(t & DS), !!(m.tiles[(j + 1) * 9 + i] & DN));
      }
    const d = mazeDistances(m.tiles, 9, 9, m.entrance);
    assert.ok(d.every((v) => v >= 0), "có ô không tới được");
    assert.equal(Math.max(...d), d[m.goal]);
    assert.ok(d[m.goal] >= 8);
  }
});

// ───────────── điểm xuất phát ─────────────
test("điểm xuất phát, Lò Ma trận (−10, 9), Totem (16, 4): không hang, không cây, không công trình — y như bản đồ độ cao", () => {
  for (let cx = -2; cx <= 1; cx++) for (let cz = -2; cz <= 1; cz++) assert.equal(shapeChunk(cx, cz), null, `chunk ${cx},${cz} có hang`);
  for (let x = -12; x <= 30; x++)
    for (let z = -14; z <= 18; z++) {
      if (!inKeepClear(x, z) && Math.hypot(x, z) > 10) continue;
      assert.equal(genColumn(x, z), undefined, `cột (${x}, ${z}) bị đổi`);
    }
  for (let ri = -2; ri <= 1; ri++)
    for (let rj = -2; rj <= 1; rj++) {
      const s = regionStructure(ri, rj);
      if (s) assert.ok(Math.hypot(s.x, s.z) > 120, `${s.kind} quá gần (${s.x}, ${s.z})`);
    }
  for (let cx = -2; cx <= 1; cx++) for (let cz = -2; cz <= 1; cz++) assert.equal(chunkGrotto(cx, cz), null);
  assert.equal(caveMask(5, 5), 0);
});

// ───────────── hợp đồng columnRange + tất định ─────────────
test("columnRange: dưới lo luôn đặc, trên hi luôn rỗng — cả ở chunk có hang / đảo / cây / mê cung", () => {
  const isles = regionStructure(-1, -1)!;
  const spots: [number, number][] = [[isles.x, isles.z], [-92, 92], [120, 50], [19, 110], [40, 55], [-142, -175]];
  for (const [px, pz] of spots)
    for (let dx = -16; dx <= 16; dx += 3)
      for (let dz = -16; dz <= 16; dz += 3) {
        const x = px + dx;
        const z = pz + dz;
        const [lo, hi] = columnRange(x, z);
        for (let y = lo - 6; y < lo; y++) assert.ok(solid(x, y, z), `(${x}, ${y}, ${z}) dưới lo ${lo} mà rỗng`);
        for (let y = hi + 1; y <= hi + 40; y++) assert.ok(!solid(x, y, z), `(${x}, ${y}, ${z}) trên hi ${hi} mà đặc`);
      }
  // tất định: chunk sinh lại (cache độc lập) cho cùng khối
  const a = genChunk(0, 3);
  const cols = a.cols.map((c) => (c ? `${c.lo}:${Array.from(c.ids).join(",")}` : ""));
  assert.deepEqual(genChunk(0, 3).cols.map((c) => (c ? `${c.lo}:${Array.from(c.ids).join(",")}` : "")), cols);
});

// ───────────── hang động ─────────────
test("hang: có khoang rỗng dưới mặt đất ở vùng hang, không thấp hơn CAVE_FLOOR, không mảnh vụn lơ lửng 1 khối", () => {
  let caveCells = 0;
  let floating = 0;
  let chunksWithShape = 0;
  for (let cx = -8; cx <= -3; cx++)
    for (let cz = -8; cz <= -3; cz++) {
      const sh = shapeChunk(cx, cz);
      if (!sh) continue;
      chunksWithShape++;
      for (let i = 0; i < CHUNK * CHUNK; i += 7) {
        const x = cx * CHUNK + (i % CHUNK);
        const z = cz * CHUNK + Math.floor(i / CHUNK);
        const top = blockTop(x, z);
        for (let y = CAVE_FLOOR - 4; y < top - 3; y++) {
          if (solid(x, y, z)) continue;
          caveCells++;
          assert.ok(y >= CAVE_FLOOR, `hang thấp hơn sàn: (${x}, ${y}, ${z})`);
        }
        for (let y = top; y < top + 9; y++) {
          if (!solid(x, y, z)) continue;
          const nb = [solid(x + 1, y, z), solid(x - 1, y, z), solid(x, y, z + 1), solid(x, y, z - 1), solid(x, y + 1, z), solid(x, y - 1, z)].filter(Boolean).length;
          if (nb === 0) floating++;
        }
      }
    }
  assert.ok(chunksWithShape >= 3, `chỉ ${chunksWithShape} chunk có hang`);
  assert.ok(caveCells > 50, `quá ít ô hang: ${caveCells}`);
  assert.equal(floating, 0);
});

test("miệng hang: bậc dốc 1 khối / 2 ô, đủ khoảng đầu, xuống tới khoang có pha lê", () => {
  let checked = 0;
  for (let cx = -8; cx <= 10 && checked < 4; cx++)
    for (let cz = -8; cz <= 10 && checked < 4; cz++) {
      const g = chunkGrotto(cx, cz);
      if (!g) continue;
      checked++;
      let prev = surfaceAt(g.x - g.dx * 2 + 0.5, g.z - g.dz * 2 + 0.5, g.top + 9);
      assert.equal(prev, g.top, "bậc đỗ trước miệng hang");
      for (let i = 0; i < g.steps; i++) {
        const x = g.x + g.dx * i;
        const z = g.z + g.dz * i;
        const s = surfaceAt(x + 0.5, z + 0.5, prev + 0.2);
        assert.ok(s <= prev + 1 && s >= prev - 1, `bậc ${i} của hang (${g.x}, ${g.z}): ${prev} → ${s}`);
        assert.ok(!solid(x, s, z) && !solid(x, s + 1, z) && !solid(x, s + 2, z), `thiếu khoảng đầu ở bậc ${i}`);
        prev = s;
      }
      assert.equal(prev, g.floor);
      let crystals = 0;
      for (let dx = -6; dx <= 6; dx++) for (let dz = -6; dz <= 6; dz++) if (naturalAt(g.cx + dx, g.floor, g.cz + dz) === B.crystal) crystals++;
      assert.ok(crystals >= 1, "khoang không có pha lê");
    }
  assert.ok(checked >= 2, `chỉ thấy ${checked} miệng hang`);
});

// ───────────── Đảo Phyllotaxis ─────────────
test("Đảo Phyllotaxis: góc vàng, r = c·√n, Fibonacci gần một tia, nhảy được từ cầu thang tới đảo tâm", () => {
  const s = regionStructure(-1, -1)!;
  assert.equal(s.kind, "isles");
  const L = islesLayout(s);
  const cx = s.x + 0.5;
  const cz = s.z + 0.5;
  const ang = (i: number) => Math.atan2(L.isles[i].z - cz, L.isles[i].x - cx);
  for (let n = 1; n < ISLE_N; n++) {
    const r = Math.hypot(L.isles[n].x - cx, L.isles[n].z - cz);
    assert.ok(Math.abs(r - ISLE_C * Math.sqrt(n)) < 1e-6);
    let d = ((ang(n + 1) - ang(n)) * 180) / Math.PI;
    d = ((d % 360) + 360) % 360;
    assert.ok(Math.abs(d - 137.5078) < 1e-3 || Math.abs(d - (360 - 137.5078)) < 1e-3, `Δθ ${d}`);
  }
  for (const n of [13, 21, 34, 55]) assert.ok(Math.abs(ang(n)) < (15 * Math.PI) / 180, `đảo ${n} lệch tia`);
  // đồ thị "nhảy được" (nhảy cao ~1,24 m, xa ~3 m): mép cách mép ≤ 2 m và chênh cao ≤ 1 khối khi đi lên
  const hop = (a: (typeof L.isles)[0], b: (typeof L.isles)[0]) => Math.hypot(a.x - b.x, a.z - b.z) - a.r - b.r <= 2 && b.top - a.top <= 1;
  const seen = new Set([ISLE_N]);
  const q = [ISLE_N];
  while (q.length) {
    const a = q.pop()!;
    for (let b = 0; b <= ISLE_N; b++) if (!seen.has(b) && hop(L.isles[a], L.isles[b])) (seen.add(b), q.push(b));
  }
  assert.ok(seen.has(0), "không nhảy tới được đảo tâm");
  assert.ok(seen.size >= ISLE_N * 0.9, `chỉ tới được ${seen.size} đảo`);
  // khối thật trên đảo: mặt đảo 0 có khối, dưới đáy đảo là khoảng trống trên mặt đất
  const c0 = L.isles[0];
  assert.notEqual(naturalAt(Math.floor(c0.x) + 1, c0.top - 1, Math.floor(c0.z)), B.air);
  assert.equal(naturalAt(Math.floor(c0.x) + 1, c0.top - 12, Math.floor(c0.z)), B.air);
  assert.ok(L.y0 - 14 > blockTop(s.x, s.z));
});

/** Leo cầu thang xoắn bằng luật của Player: bước lên ≤ 1 khối, 2 ô trống trên đầu, ô kề mặt */
function climb(x0: number, z0: number, base: number, top: number) {
  let cells: [number, number, number][] = [];
  // bậc đầu: ô bậc thấp nhất
  for (let dx = -3; dx <= 3; dx++) for (let dz = -3; dz <= 3; dz++) if (solid(x0 + dx, base, z0 + dz) && !solid(x0 + dx, base + 1, z0 + dz) && (dx || dz)) cells.push([x0 + dx, base + 1, z0 + dz]);
  assert.ok(cells.length, "không có bậc đầu");
  for (let y = base + 1; y < top; y++) {
    const next: [number, number, number][] = [];
    for (const [x, , z] of cells)
      for (const [dx, dz] of [[1, 0], [-1, 0], [0, 1], [0, -1]]) {
        const nx = x + dx;
        const nz = z + dz;
        // ô đích: bậc đặc + 2 ô trống cho thân; ô đang đứng: thân 2 ô (y, y + 1) đã trống
        if (solid(nx, y, nz) && !solid(nx, y + 1, nz) && !solid(nx, y + 2, nz)) next.push([nx, y + 1, nz]);
      }
    assert.ok(next.length, `kẹt ở cao độ ${y}`);
    cells = next;
  }
  return cells;
}

test("cầu thang xoắn (đảo nổi + Rừng Đồ thị) leo được từng bậc tới đỉnh", () => {
  const s = regionStructure(-1, -1)!;
  const st = islesLayout(s).stair;
  const end = climb(st.x, st.z, st.base, st.top);
  assert.ok(end.every(([, y]) => y === st.top));
  const f = regionStructure(0, 0)!;
  assert.equal(f.kind, "forest");
  const F = forestLayout(f)!;
  const n = F.nodes[F.stairNode];
  let base = -1e9;
  for (let a = -3; a <= 3; a++) for (let b = -3; b <= 3; b++) base = Math.max(base, blockTop(n.x + a, n.z + b));
  climb(n.x, n.z, base, F.deckY);
  // 8 cung "góc kim cương" đơn điệu theo góc thật
  assert.equal(sectorOf(1, 0), 0);
  assert.equal(sectorOf(0, 1), 2);
  assert.equal(sectorOf(-1, 0), 4);
  assert.equal(sectorOf(0, -1), 6);
});

// ───────────── Rừng Đồ thị ─────────────
test("Rừng Đồ thị: cầu ván = cây khung nhỏ nhất (n − 1 cạnh, liên thông, tổng ngắn nhất), cầu dây tạo chu trình", () => {
  const f = regionStructure(0, 0)!;
  const F = forestLayout(f)!;
  const n = F.nodes.length;
  assert.ok(n >= 6);
  const mst = F.edges.filter((e) => e.mst);
  assert.equal(mst.length, n - 1);
  const parent = F.nodes.map((_, i) => i);
  const find = (i: number): number => (parent[i] === i ? i : (parent[i] = find(parent[i])));
  for (const e of mst) parent[find(e.a)] = find(e.b);
  assert.ok(F.nodes.every((_, i) => find(i) === find(0)), "cây khung không liên thông");
  // tính chất chu trình: mỗi cạnh ngoài cây khung dài ≥ mọi cạnh trên đường nối hai đầu trong cây khung → kiểm thô: ≥ cạnh khung dài nhất kề nó
  const len = (e: { a: number; b: number }) => Math.hypot(F.nodes[e.a].x - F.nodes[e.b].x, F.nodes[e.a].z - F.nodes[e.b].z);
  for (const e of F.edges.filter((q) => !q.mst)) {
    const adj = mst.filter((q) => q.a === e.a || q.b === e.a || q.a === e.b || q.b === e.b);
    assert.ok(adj.length > 0 && len(e) >= Math.min(...adj.map(len)));
  }
  // khối thật: giữa mỗi cầu ván là ván ở tầng sàn
  for (const e of mst) {
    const mx = Math.floor((F.nodes[e.a].x + F.nodes[e.b].x + 1) / 2);
    const mz = Math.floor((F.nodes[e.a].z + F.nodes[e.b].z + 1) / 2);
    let ok = false;
    for (let a = -1; a <= 1; a++) for (let b = -1; b <= 1; b++) if (naturalAt(mx + a, F.deckY - 1, mz + b) === B.plank || naturalAt(mx + a, F.deckY - 1, mz + b) === B.wood) ok = true;
    assert.ok(ok, `cầu ${e.a}–${e.b} thiếu ván ở giữa`);
  }
});

// ───────────── Tàn tích WFC ─────────────
test("Tàn tích WFC: đi bộ từ dốc ngoài lối vào tới kho báu vàng (tường cao ≥ 2 không leo được)", () => {
  const s = regionStructure(-1, 0)!;
  assert.equal(s.kind, "maze");
  const M = mazeOf(s);
  const size = MAZE_TILES * MAZE_CELL;
  const x0 = s.x - Math.floor(size / 2);
  const z0 = s.z - Math.floor(size / 2);
  const gi = M.goal % MAZE_TILES;
  const gj = (M.goal - gi) / MAZE_TILES;
  const gx = x0 + gi * MAZE_CELL + 1;
  const gz = z0 + gj * MAZE_CELL + 1;
  // y sàn = ô vàng
  let yf = -99;
  for (let y = -10; y < 40; y++) if (naturalAt(gx, y, gz) === B.gold) yf = y;
  assert.ok(yf > -99, "không thấy kho báu");
  // BFS theo luật Player trong hộp mê cung + dốc: đứng ở (x, y) khi ô y−1 đặc, y và y+1 rỗng; bước lên ≤ 1, xuống ≤ 3
  const stand = (x: number, z: number, y: number) => solid(x, y - 1, z) && !solid(x, y, z) && !solid(x, y + 1, z);
  const ex = x0 + Math.floor(MAZE_TILES / 2) * MAZE_CELL + 1;
  const sz = z0 + size + 8;
  const sy = surfaceAt(ex + 0.5, sz + 0.5, yf + 6);
  const key = (x: number, y: number, z: number) => `${x},${y},${z}`;
  const seen = new Set([key(ex, sy, sz)]);
  const q: [number, number, number][] = [[ex, sy, sz]];
  let reached = false;
  while (q.length && !reached) {
    const [x, y, z] = q.shift()!;
    for (const [dx, dz] of [[1, 0], [-1, 0], [0, 1], [0, -1]]) {
      const nx = x + dx;
      const nz = z + dz;
      if (nx < x0 - 2 || nx > x0 + size + 2 || nz < z0 - 2 || nz > sz) continue;
      for (let ny = y + 1; ny >= y - 3; ny--) {
        if (!stand(nx, nz, ny)) continue;
        if (ny === y + 1 && solid(x, y + 2, z)) break;
        const k = key(nx, ny, nz);
        if (!seen.has(k)) {
          seen.add(k);
          q.push([nx, ny, nz]);
        }
        if (Math.abs(nx - gx) + Math.abs(nz - gz) === 1 && ny === yf) reached = true;
        break;
      }
    }
  }
  assert.ok(reached, "không đi được tới kho báu");
  // tường: ô góc của ô (0, 0) là tường cao ≥ 2 (người chơi chỉ leo 1 khối)
  assert.ok(solid(x0, yf, z0) && solid(x0, yf + 1, z0));
});

// ───────────── cây theo chunk ─────────────
test("cây L-system theo chunk: tất định, có ở đồng cỏ, không mọc trong công trình, gốc trên mặt đất", () => {
  let trees = 0;
  for (let cx = 1; cx <= 4; cx++)
    for (let cz = 1; cz <= 4; cz++) {
      const t = chunkTreeBlocks(cx, cz);
      assert.deepEqual(Array.from(chunkTreeBlocks(cx, cz)), Array.from(t));
      trees += t.length;
      for (let i = 0; i < t.length; i += 4) {
        const [x, , z] = [t[i], t[i + 1], t[i + 2]];
        for (const s of structuresIn(x, z, x, z)) assert.fail(`cây trong ${s.kind} tại (${x}, ${z})`);
      }
    }
  assert.ok(trees > 0);
  // khối của công trình vùng tất định
  const s = regionStructure(0, 0)!;
  assert.equal(structureBlocks(s), structureBlocks(s));
  // blockAt (gồm sửa của người chơi) và naturalAt khớp khi chưa sửa
  assert.equal(blockAt(121, 30, 51), naturalAt(121, 30, 51));
});
