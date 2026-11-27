import { test } from "node:test";
import assert from "node:assert/strict";
import { CHAIR, COLLIDER_RECTS, EXIT_POINT, SEATS, STUDY_SPAWN, SR, WALK, seatAt, seatNear, studyBlocked, suggestSeat } from "../../lib/world/studyRoom";
import { PLANS, ROOM_PLAN, elapsed, fmtClock, newSolo, nextPhase, pause, reset, roomPhase, setPlan, soloView, start, tick } from "../../lib/world/studyTimer";
import { addBlock, addFocus, blockCounts, dayKey, dueReviews, emptyStats, goalRate, lastDays, logGoal, minutesOn, parseStats, shiftDay, streak, totalMinutes } from "../../lib/world/studyStats";
import { CREED, OATH, QUOTES, QUOTE_PERIOD_MS, quoteIndex } from "../../lib/world/studyQuotes";
import { INTERACT, STUDY_DOOR, hubBlocked } from "../../lib/world/hubLayout";

const MIN = 60_000;

// ───────────── Bố cục phòng ─────────────

/** BFS lưới 0,25 m từ điểm vào: điểm (x, z) tới được không (đứng trong bán kính r) */
function reach() {
  const S = 0.25;
  const nx = Math.ceil((WALK.x * 2) / S) + 1;
  const nz = Math.ceil((WALK.z * 2) / S) + 1;
  const X = (i: number) => -WALK.x + i * S;
  const Z = (j: number) => -WALK.z + j * S;
  const seen = new Uint8Array(nx * nz);
  const si = Math.round((STUDY_SPAWN.x + WALK.x) / S);
  const sj = Math.round((STUDY_SPAWN.z + WALK.z) / S);
  const q = [si * nz + sj];
  seen[q[0]] = 1;
  while (q.length) {
    const c = q.pop()!;
    const i = Math.floor(c / nz);
    const j = c % nz;
    for (const [di, dj] of [
      [1, 0],
      [-1, 0],
      [0, 1],
      [0, -1],
    ]) {
      const a = i + di;
      const b = j + dj;
      if (a < 0 || b < 0 || a >= nx || b >= nz) continue;
      const k = a * nz + b;
      if (!seen[k] && !studyBlocked(X(a), Z(b))) {
        seen[k] = 1;
        q.push(k);
      }
    }
  }
  return (x: number, z: number, r = 0.4) => {
    for (let i = 0; i < nx; i++) for (let j = 0; j < nz; j++) if (seen[i * nz + j] && Math.hypot(X(i) - x, Z(j) - z) < r) return true;
    return false;
  };
}

test("study: điểm vào trống, cửa ra và chỗ đứng sau MỌI ghế đều tới được", () => {
  assert.ok(!studyBlocked(STUDY_SPAWN.x, STUDY_SPAWN.z));
  const can = reach();
  assert.ok(can(EXIT_POINT.x, EXIT_POINT.z, 0.6), "cửa ra");
  for (const s of SEATS) {
    assert.ok(!studyBlocked(s.sx, s.sz), `chỗ đứng ghế ${s.id}`);
    assert.ok(can(s.sx, s.sz), `tới được ghế ${s.id}`);
  }
});

test("study: 12 ghế, không chồng nhau; đứng sau ghế thì F chọn đúng ghế đó", () => {
  assert.equal(SEATS.length, 12);
  SEATS.forEach((s, i) => assert.equal(s.id, i));
  for (let i = 0; i < SEATS.length; i++)
    for (let j = i + 1; j < SEATS.length; j++) assert.ok(Math.hypot(SEATS[i].x - SEATS[j].x, SEATS[i].z - SEATS[j].z) >= CHAIR.hx * 2 + 0.3);
  for (const s of SEATS) assert.equal(seatNear(s.sx, s.sz)?.id, s.id);
  // giữa lối đi xa mọi ghế → không có gì để ngồi
  assert.equal(seatNear(0, -5.5), null);
});

test("study: đang ngồi thì ghế của mình không chặn, ghế người khác vẫn chặn", () => {
  const s = SEATS[3];
  assert.ok(studyBlocked(s.x, s.z));
  assert.ok(!studyBlocked(s.x, s.z - 0.06, 0.28, s.id));
  assert.ok(studyBlocked(SEATS[4].x, SEATS[4].z, 0.28, s.id));
  assert.ok(studyBlocked(SR.W + 1, 0));
  assert.ok(COLLIDER_RECTS.length > SEATS.length);
});

test("study: seatAt nhận ra người đang ngồi đúng ghế", () => {
  assert.equal(seatAt(SEATS[5].x, SEATS[5].z - 0.06), 5);
  assert.equal(seatAt(0, 0), null);
});

test("study: gợi ý chỗ ngồi — ghế trống, tránh ngồi sát người khác cùng bàn", () => {
  assert.ok(suggestSeat([]));
  const occ = [0];
  const s = suggestSeat(occ)!;
  assert.ok(!occ.includes(s.id));
  assert.notEqual(s.table, SEATS[0].table);
  // phòng đầy → không còn ghế
  assert.equal(
    suggestSeat(SEATS.map((x) => x.id)),
    null,
  );
  // còn đúng một ghế
  assert.equal(suggestSeat(SEATS.filter((x) => x.id !== 7).map((x) => x.id))?.id, 7);
});

test("study: cửa phòng ở Quảng trường — trống, cách các điểm tương tác khác ≥ 4 m, khung cửa ngoài vùng đi", () => {
  assert.ok(!hubBlocked(STUDY_DOOR.x, STUDY_DOOR.z));
  assert.deepEqual(INTERACT.study, { x: STUDY_DOOR.x, z: STUDY_DOOR.z });
  assert.ok(Math.hypot(STUDY_DOOR.dx, STUDY_DOOR.dz) > 34.4);
  // mặt cửa quay vào tâm sân
  const fx = Math.sin(STUDY_DOOR.yaw);
  const fz = Math.cos(STUDY_DOOR.yaw);
  assert.ok(fx * -STUDY_DOOR.dx + fz * -STUDY_DOOR.dz > 0.99 * Math.hypot(STUDY_DOOR.dx, STUDY_DOOR.dz));
});

// ───────────── Đồng hồ ─────────────

test("study: nhịp chung của phòng 25/5 khớp nửa giờ thực, giống nhau với mọi người", () => {
  const t0 = Date.UTC(2026, 10, 27, 10, 0, 0);
  const a = roomPhase(t0);
  assert.equal(a.phase, "focus");
  assert.equal(a.remain, ROOM_PLAN.focus * MIN);
  const b = roomPhase(t0 + 24 * MIN + 59_000);
  assert.equal(b.phase, "focus");
  assert.equal(b.remain, 1000);
  const c = roomPhase(t0 + 25 * MIN);
  assert.equal(c.phase, "short");
  assert.equal(c.remain, 5 * MIN);
  assert.equal(c.cycle, a.cycle);
  const d = roomPhase(t0 + 30 * MIN);
  assert.equal(d.phase, "focus");
  assert.equal(d.cycle, a.cycle + 1);
  assert.deepEqual(roomPhase(t0 + 123_456), roomPhase(t0 + 123_456));
});

test("study: đồng hồ riêng — chạy, dừng, tiếp, hết giờ học tự vào nghỉ, hết nghỉ thì chờ bấm", () => {
  let s = newSolo("25/5");
  assert.equal(soloView(s, 0).remain, 25 * MIN);
  s = start(s, 1000);
  assert.equal(elapsed(s, 1000 + 5 * MIN), 5 * MIN);
  s = pause(s, 1000 + 5 * MIN);
  assert.equal(soloView(s, 1e12).remain, 20 * MIN, "đang dừng thì thời gian không trôi");
  s = start(s, 2e6);
  let r = tick(s, 2e6 + 20 * MIN - 1);
  assert.equal(r.ended, null);
  r = tick(s, 2e6 + 20 * MIN + 30_000);
  assert.equal(r.ended, "focus");
  assert.equal(r.s.phase, "short");
  assert.equal(r.s.done, 1);
  assert.notEqual(r.s.since, null, "giờ nghỉ tự chạy");
  assert.equal(soloView(r.s, 2e6 + 20 * MIN + 30_000).remain, 5 * MIN - 30_000, "phần dư tính sang giờ nghỉ");
  const r2 = tick(r.s, 2e6 + 26 * MIN);
  assert.equal(r2.ended, "short");
  assert.equal(r2.s.phase, "focus");
  assert.equal(r2.s.since, null, "khối học mới chờ người chơi bấm bắt đầu");
  assert.deepEqual(reset(r2.s), { ...r2.s, phase: "focus", since: null, spent: 0 });
});

test("study: nghỉ dài sau đủ số khối; đổi nhịp; định dạng giờ", () => {
  const p = PLANS[0];
  assert.equal(nextPhase("focus", 1, p.every), "short");
  assert.equal(nextPhase("focus", 4, p.every), "long");
  assert.equal(nextPhase("long", 4, p.every), "focus");
  const s = setPlan({ ...newSolo(), done: 3 }, "50/10");
  assert.equal(s.done, 3);
  assert.equal(soloView(s, 0).dur, 50 * MIN);
  assert.equal(newSolo("??").plan, "25/5");
  assert.equal(fmtClock(25 * MIN), "25:00");
  assert.equal(fmtClock(61_001), "01:02");
  assert.equal(fmtClock(-5), "00:00");
  assert.equal(fmtClock(3_600_000 + 5000), "1:00:05");
});

// ───────────── Thống kê ─────────────

test("study: cộng phút theo ngày, chuỗi ngày, 7 ngày gần nhất", () => {
  let s = emptyStats();
  s = addFocus(s, "2026-11-25", 30 * MIN);
  s = addFocus(s, "2026-11-26", 12 * MIN);
  s = addFocus(s, "2026-11-27", 9 * MIN);
  s = addFocus(s, "2026-11-27", 2 * MIN);
  assert.equal(minutesOn(s, "2026-11-27"), 11);
  assert.equal(totalMinutes(s), 53);
  assert.equal(streak(s, "2026-11-27"), 3);
  // hôm nay chưa đủ 10 phút → vẫn giữ chuỗi tới hôm qua
  assert.equal(streak(addFocus(emptyStats(), "2026-11-26", 15 * MIN), "2026-11-27"), 1);
  assert.equal(streak(s, "2026-11-29"), 0);
  const days = lastDays(s, "2026-11-27");
  assert.equal(days.length, 7);
  assert.equal(days[6].day, "2026-11-27");
  assert.equal(days[4].min, 30);
  assert.equal(addFocus(s, "2026-11-27", -5), s);
  assert.equal(addBlock(s).blocks, 1);
});

test("study: khoá ngày qua tháng / năm; khối học trọn vẹn cần ≥ 60% thời gian ngồi", () => {
  assert.equal(shiftDay("2026-03-01", -1), "2026-02-28");
  assert.equal(shiftDay("2026-12-31", 1), "2027-01-01");
  assert.equal(dayKey(new Date(2026, 0, 5, 23, 59)), "2026-01-05");
  assert.ok(blockCounts(15 * MIN, 25 * MIN));
  assert.ok(!blockCounts(14 * MIN, 25 * MIN));
  assert.ok(!blockCounts(5, 0));
});

test("study: đọc dữ liệu hỏng / lạ không làm vỡ game; giữ đúng dữ liệu hợp lệ", () => {
  assert.deepEqual(parseStats(null), emptyStats());
  assert.deepEqual(parseStats("{oops"), emptyStats());
  assert.deepEqual(parseStats(JSON.stringify({ v: 2 })), emptyStats());
  const s = parseStats(JSON.stringify({ v: 1, days: { "2026-11-27": 40, bad: 3, "2026-11-26": -1 }, blocks: 2.7, goals: [{ day: "2026-11-27", text: "x".repeat(300), result: "done" }, { day: 1, text: 2 }] }));
  assert.deepEqual(Object.keys(s.days), ["2026-11-27"]);
  assert.equal(s.blocks, 2);
  assert.equal(s.goals.length, 1);
  assert.equal(s.goals[0].text.length, 120);
  const round = parseStats(JSON.stringify(s));
  assert.deepEqual(round, s);
});

test("study: mục tiêu — ghi, tỉ lệ đạt, gợi ý ôn lại sau 1 · 3 · 7 ngày", () => {
  let s = emptyStats();
  s = logGoal(s, { day: "2026-11-26", text: "  Giải 4 phương trình  ", result: "done" });
  s = logGoal(s, { day: "2026-11-24", text: "Ôn hằng đẳng thức", result: "part" });
  s = logGoal(s, { day: "2026-11-20", text: "Hệ phương trình", result: "no" });
  s = logGoal(s, { day: "2026-11-20", text: "Định lý Pythagore", result: "done" });
  s = logGoal(s, { day: "2026-11-25", text: "   ", result: "done" });
  assert.equal(s.goals.length, 4);
  assert.equal(s.goals[0].text, "Giải 4 phương trình");
  assert.equal(goalRate(s), (1 + 0.5 + 0 + 1) / 4);
  const due = dueReviews(s, "2026-11-27");
  assert.deepEqual(
    due.map((d) => [d.text, d.gap]),
    [
      ["Giải 4 phương trình", 1],
      ["Ôn hằng đẳng thức", 3],
      ["Định lý Pythagore", 7],
    ],
  );
});

// ───────────── Chữ trên tường ─────────────

test("study: Lời thề và đoạn văn giữ NGUYÊN VĂN (dòng đầu, dòng cuối, số khổ)", () => {
  assert.equal(OATH[0], "Ta nguyện trọn đời vì chân lý mà chiến đấu!");
  assert.equal(OATH[OATH.length - 1], "Hôm nay như thế, ngày mai như thế, muôn đời sau vẫn vẹn một lời thề!");
  assert.equal(OATH.filter((l) => l === "").length, 4);
  assert.equal(OATH.length, 18);
  assert.ok(OATH.includes("là lưỡi liềm sắc bén, cắt phăng cỏ dại ngu muội;"));
  assert.equal(CREED.length, 5);
  assert.equal(CREED[0], "Ta sẽ vì chân lý mà đấu tranh!");
  assert.ok(CREED[4].endsWith("hôm nay như thế, ngày ngày giống nhau!"));
});

test("study: danh ngôn đủ thông tin; các bảng luôn hiện câu khác nhau; đổi câu theo giờ thực", () => {
  assert.ok(QUOTES.length >= 12);
  for (const q of QUOTES) assert.ok(q.vi && q.en && q.who.vi && q.who.en && q.src, q.en);
  assert.ok(!QUOTES.some((q) => /nothing in life is to be feared/i.test(q.en)), "câu không rõ nguồn đã bị loại");
  for (let step = 0; step < 50; step++) {
    const now = step * QUOTE_PERIOD_MS + 10;
    const ids = Array.from({ length: 6 }, (_, b) => quoteIndex(b, 6, now));
    assert.equal(new Set(ids).size, 6);
    for (const i of ids) assert.ok(i >= 0 && i < QUOTES.length);
  }
  assert.equal(quoteIndex(0, 6, 5), quoteIndex(0, 6, QUOTE_PERIOD_MS - 1));
  assert.notEqual(quoteIndex(0, 6, 0), quoteIndex(0, 6, QUOTE_PERIOD_MS));
  // qua một vòng đủ lâu, câu nào cũng được lên bảng
  const seen = new Set<number>();
  for (let step = 0; step < QUOTES.length; step++) seen.add(quoteIndex(0, 6, step * QUOTE_PERIOD_MS));
  assert.equal(seen.size, QUOTES.length);
});
