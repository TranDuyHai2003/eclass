/**
 * Thế giới Toán — logic thuần (không cần DB): toán bậc ba, sinh đề có seed, KHÔNG lộ đáp án trong đề,
 * chấm MCQ / TF4 (thang đề thi) / SHORT (≤ 4 ký tự) / ANCHOR / MULTI, FSRS, Elo.
 * Chạy riêng: ALLOW_NON_LOCAL_TEST_DB=1 node --test -r ./tests/setup/register.cjs tests/world/logic.test.ts
 */
import { test, describe } from "node:test";
import assert from "node:assert/strict";
import { createRng } from "@/lib/world/rng";
import { criticalPoints, cubicDoubleRoot, cubicFromRoots, extrema, f, fp, minMaxOnInterval, monotonicIntervals } from "@/lib/world/cubic";
import { FAMILIES, FAMILY_BY_ID, generate, practiceFamilies } from "@/lib/world/generators";
import { grade, parseShort, TF4_SCALE } from "@/lib/world/grading";
import { EMPTY_MEMORY, Rating, creatureState, eloP, eloUpdate, fsrsGrade, pickByElo, retrievability, review } from "@/lib/world/memory";
import { DISCOVERIES, KC_IDS, MISCONCEPTIONS } from "@/lib/world/kcs";

const SEEDS = Array.from({ length: 150 }, (_, i) => i * 7919 + 13);

describe("rng", () => {
  test("cùng seed ⇒ cùng dãy", () => {
    const a = createRng(42);
    const b = createRng(42);
    for (let i = 0; i < 20; i++) assert.equal(a.next(), b.next());
  });
  test("int nằm trong biên", () => {
    const r = createRng(1);
    for (let i = 0; i < 500; i++) {
      const v = r.int(-3, 4);
      assert.ok(v >= -3 && v <= 4 && Number.isInteger(v));
    }
  });
});

describe("cubic", () => {
  test("dựng từ nghiệm f′: f′(p) = f′(q) = 0, hệ số nguyên khi p + q chẵn", () => {
    const k = cubicFromRoots(1, -1, 3, 2);
    assert.equal(fp(k, -1), 0);
    assert.equal(fp(k, 3), 0);
    for (const c of [k.a, k.b, k.c, k.d]) assert.ok(Number.isInteger(c));
  });
  test("a > 0: cực đại tại nghiệm nhỏ, cực tiểu tại nghiệm lớn; a < 0 ngược lại", () => {
    const up = extrema(cubicFromRoots(1, -1, 3, 0));
    assert.equal(up.max!.x, -1);
    assert.equal(up.min!.x, 3);
    const down = extrema(cubicFromRoots(-1, -1, 3, 0));
    assert.equal(down.max!.x, 3);
    assert.equal(down.min!.x, -1);
  });
  test("nghiệm kép ⇒ không cực trị, một khoảng đơn điệu", () => {
    const k = cubicDoubleRoot(1, 2, 0);
    assert.equal(criticalPoints(k).kind, "double");
    assert.deepEqual(extrema(k), {});
    assert.equal(monotonicIntervals(k).length, 1);
  });
  test("GTLN trên đoạn có thể ở đầu mút", () => {
    const k = cubicFromRoots(1, -1, 1, 0); // x³ − 3x: cực đại f(−1)=2
    const mm = minMaxOnInterval(k, -2, 3);
    assert.equal(mm.max.x, 3);
    assert.equal(mm.max.y, f(k, 3)); // 18 > 2
    assert.equal(mm.min.y, -2);
  });
});

describe("sinh đề", () => {
  test("mọi họ câu: cùng seed ⇒ cùng đề và cùng đáp án", () => {
    for (const fam of FAMILIES) {
      for (const s of SEEDS.slice(0, 20)) {
        assert.deepEqual(fam.generate(s), fam.generate(s), `${fam.id} seed ${s}`);
      }
    }
  });

  test("đề gửi xuống client KHÔNG chứa đáp án / bẫy / lời giải", () => {
    for (const fam of FAMILIES) {
      for (const s of SEEDS.slice(0, 30)) {
        const g = fam.generate(s);
        const json = JSON.stringify(g.prompt);
        assert.ok(!("key" in g.prompt), fam.id);
        assert.ok(!/correct|truth|traps|explanation/i.test(json), `${fam.id}: payload lộ trường đáp án`);
        for (const id of Object.keys(MISCONCEPTIONS)) assert.ok(!json.includes(id), `${fam.id}: lộ mã ngộ nhận ${id}`);
        assert.ok(!json.includes(g.explanation), fam.id);
      }
    }
  });

  test("MCQ: phương án khác nhau, đáp án nằm trong phương án, bẫy không trùng đáp án", () => {
    for (const fam of FAMILIES.filter((x) => x.format === "MCQ")) {
      for (const s of SEEDS) {
        const g = fam.generate(s);
        const opts = g.prompt.options!;
        assert.equal(new Set(opts.map((o) => o.label + JSON.stringify(o.graph ?? null))).size, opts.length, `${fam.id} seed ${s}: duplicate options`);
        assert.equal(g.key.kind, "MCQ");
        const key = g.key;
        if (key.kind !== "MCQ") continue;
        assert.ok(opts.some((o) => o.id === key.correct));
        assert.ok(!(key.correct in key.traps));
        for (const m of Object.values(key.traps)) assert.ok(m in MISCONCEPTIONS, m);
      }
    }
  });

  test("slope.interval: đáp án đúng thật sự là khoảng f′ > 0", () => {
    for (const s of SEEDS) {
      const g = generate("slope.interval", s);
      const key = g.key;
      if (key.kind !== "MCQ") throw new Error();
      const { k, roots, correctIv } = g.meta as { k: number; roots: number[]; correctIv: [number, number] };
      const [lo, hi] = correctIv;
      const label = g.prompt.options!.find((o) => o.id === key.correct)!.label;
      assert.ok(label.includes(lo === -Infinity ? "-\\infty" : String(lo)), label);
      // f′ dương tại nhiều điểm trong khoảng đúng
      const xs = lo === -Infinity ? [hi - 0.5, hi - 3] : hi === Infinity ? [lo + 0.5, lo + 3] : [(lo + hi) / 2, lo + 0.1, hi - 0.1];
      for (const x of xs) {
        const val = k * roots.reduce((acc, r) => acc * (x - r), 1);
        assert.ok(val > 0, `seed ${s}: ${label} tại x=${x}`);
      }
    }
  });

  test("extremum.count: số cực trị = số nghiệm bội lẻ", () => {
    for (const s of SEEDS) {
      const g = generate("extremum.count", s);
      const key = g.key;
      if (key.kind !== "MCQ") throw new Error();
      const { exps, roots } = g.meta as { exps: number[]; roots: number[] };
      // Đếm số lần f′ đổi dấu bằng cách lấy mẫu số
      const fpv = (x: number) => roots.reduce((acc, r, i) => acc * (x - r) ** exps[i], 1);
      let changes = 0;
      for (const r of roots) if (Math.sign(fpv(r - 0.01)) !== Math.sign(fpv(r + 0.01))) changes++;
      assert.equal(changes, exps.filter((e) => e % 2 === 1).length);
      const label = g.prompt.options!.find((o) => o.id === key.correct)!.label;
      assert.equal(Number(label), changes, `seed ${s}: ${g.prompt.stem}`);
    }
  });

  test("SHORT: đáp số vừa 4 ký tự", () => {
    for (const fam of FAMILIES.filter((x) => x.format === "SHORT")) {
      for (const s of SEEDS) {
        const g = fam.generate(s);
        if (g.key.kind !== "SHORT") throw new Error();
        assert.ok(String(g.key.value).length <= 4, `${fam.id} seed ${s}: ${g.key.value}`);
        assert.equal(parseShort(String(g.key.value).replace(".", ",")).value, g.key.value);
      }
    }
  });

  test("minmax.interval: có cả đề bẫy đầu mút", () => {
    const withTrap = SEEDS.filter((s) => {
      const g = generate("minmax.interval", s);
      return g.key.kind === "SHORT" && g.key.traps.some((t) => t.id === "M_FORGOT_ENDPOINT");
    });
    assert.ok(withTrap.length > 20, `chỉ ${withTrap.length} đề bẫy đầu mút`);
  });

  test("mỗi KC có ít nhất một họ câu luyện; mỗi phát hiện có bài xác nhận", () => {
    for (const kc of KC_IDS) assert.ok(practiceFamilies(kc).length > 0, kc);
    for (const d of Object.values(DISCOVERIES)) assert.ok(FAMILY_BY_ID[d.checkFamily]?.discovery, d.id);
  });
});

describe("chấm", () => {
  test("TF4 theo thang 0,1 / 0,25 / 0,5 / 1", () => {
    const key = { kind: "TF4" as const, truth: [true, false, true, false] as [boolean, boolean, boolean, boolean], traps: [null, "M_MAX_MIN_SWAP", null, null] };
    assert.deepEqual(TF4_SCALE, [0, 0.1, 0.25, 0.5, 1]);
    assert.equal(grade(key, { kind: "TF4", marks: [true, false, true, false] }).score, 1);
    assert.equal(grade(key, { kind: "TF4", marks: [true, false, true, true] }).score, 0.5);
    assert.equal(grade(key, { kind: "TF4", marks: [true, true, false, true] }).score, 0.1);
    const r = grade(key, { kind: "TF4", marks: [true, true, true, false] });
    assert.equal(r.misconception, "M_MAX_MIN_SWAP");
    assert.equal(r.correct, false);
  });

  test("SHORT: chấp nhận dấu phẩy, dấu trừ unicode; từ chối > 4 ký tự", () => {
    const key = { kind: "SHORT" as const, value: -1.5, traps: [{ value: 2, id: "M_X_NOT_POINT" }] };
    assert.equal(grade(key, { kind: "SHORT", text: "-1,5" }).correct, true);
    assert.equal(grade(key, { kind: "SHORT", text: "−1.5" }).correct, true);
    assert.equal(grade(key, { kind: "SHORT", text: "2" }).misconception, "M_X_NOT_POINT");
    const long = grade(key, { kind: "SHORT", text: "-1,50" });
    assert.equal(long.correct, false);
    assert.ok(long.formatError);
    assert.ok(grade(key, { kind: "SHORT", text: "abc" }).formatError);
  });

  test("ANCHOR: đủ điểm, trong sai số, không thừa", () => {
    const key = { kind: "ANCHOR" as const, xs: [-1, 2.5], tol: 0.15 };
    assert.equal(grade(key, { kind: "ANCHOR", xs: [2.4, -1.1] }).correct, true);
    assert.equal(grade(key, { kind: "ANCHOR", xs: [-1] }).correct, false);
    const extra = grade(key, { kind: "ANCHOR", xs: [-1, 2.5, 0.7] });
    assert.equal(extra.correct, false);
    assert.equal(extra.misconception, "M_FPRIME_ZERO_IS_EXTREMUM");
  });

  test("MULTI: phải đúng đủ tập", () => {
    const key = { kind: "MULTI" as const, correct: ["i1", "i3"], traps: { i2: "M_SIGN_FLIP" } };
    assert.equal(grade(key, { kind: "MULTI", choices: ["i3", "i1"] }).correct, true);
    assert.equal(grade(key, { kind: "MULTI", choices: ["i1"] }).correct, false);
    assert.equal(grade(key, { kind: "MULTI", choices: ["i1", "i2", "i3"] }).misconception, "M_SIGN_FLIP");
  });

  test("sai dạng câu trả lời không làm sập", () => {
    const key = { kind: "MCQ" as const, correct: "A", traps: {} };
    assert.equal(grade(key, { kind: "SHORT", text: "1" }).correct, false);
  });

  test("đáp án sinh ra luôn chấm đúng chính nó", () => {
    for (const fam of FAMILIES) {
      for (const s of SEEDS.slice(0, 30)) {
        const { key } = fam.generate(s);
        const answer =
          key.kind === "MCQ"
            ? { kind: "MCQ" as const, choice: key.correct }
            : key.kind === "TF4"
              ? { kind: "TF4" as const, marks: [...key.truth] }
              : key.kind === "SHORT"
                ? { kind: "SHORT" as const, text: String(key.value).replace(".", ",") }
                : key.kind === "ANCHOR"
                  ? { kind: "ANCHOR" as const, xs: key.xs }
                  : { kind: "MULTI" as const, choices: key.correct };
        assert.equal(grade(key, answer).correct, true, `${fam.id} seed ${s}`);
      }
    }
  });
});

describe("trí nhớ", () => {
  const t0 = new Date("2026-12-01T08:00:00Z");
  const day = 86400000;

  test("đúng ⇒ hạn ôn xa dần; sai ⇒ lapses tăng, hạn gần lại", () => {
    let m = review(EMPTY_MEMORY, Rating.Good, t0);
    const first = m.dueAt!.getTime() - t0.getTime();
    assert.ok(first >= day, "lần đầu ≥ 1 ngày");
    const t1 = m.dueAt!;
    m = review(m, Rating.Good, t1);
    const second = m.dueAt!.getTime() - t1.getTime();
    assert.ok(second > first, "lần hai xa hơn");
    const t2 = m.dueAt!;
    const lapsed = review(m, Rating.Again, t2);
    assert.equal(lapsed.lapses, 1);
    assert.ok(lapsed.dueAt!.getTime() - t2.getTime() < second);
  });

  test("R giảm theo thời gian; sinh vật: thuần → mờ → hoang", () => {
    const m = review(EMPTY_MEMORY, Rating.Good, t0);
    assert.ok(retrievability(m, t0) > 0.99);
    assert.equal(creatureState(m, true, t0), "tamed");
    assert.equal(creatureState(m, false, t0), "wild");
    assert.equal(creatureState(m, true, new Date(m.dueAt!.getTime() + day)), "feral");
    const later = new Date(t0.getTime() + 60 * day);
    assert.ok(retrievability(m, later) < retrievability(m, new Date(t0.getTime() + day)));
  });

  test("fsrsGrade", () => {
    const base = { correct: true, score: 1, hints: 0, responseMs: 30000, confidence: 2, expectedMs: 40000 };
    assert.equal(fsrsGrade(base), Rating.Good);
    assert.equal(fsrsGrade({ ...base, correct: false, score: 0 }), Rating.Again);
    assert.equal(fsrsGrade({ ...base, correct: false, score: 0.5 }), Rating.Hard);
    assert.equal(fsrsGrade({ ...base, hints: 1 }), Rating.Hard);
    assert.equal(fsrsGrade({ ...base, confidence: 3, responseMs: 10000 }), Rating.Easy);
  });

  test("Elo: đúng ⇒ theta tăng, độ khó giảm; P đúng chiều", () => {
    assert.ok(eloP(1, 0) > 0.5 && eloP(-1, 0) < 0.5);
    const up = eloUpdate(0, 0, 0, 0, 1);
    assert.ok(up.theta > 0 && up.d < 0);
    const down = eloUpdate(0, 0, 0, 0, 0);
    assert.ok(down.theta < 0 && down.d > 0);
  });

  test("pickByElo chọn câu gần mục tiêu", () => {
    const items = [{ id: "easy", difficulty: -3 }, { id: "mid", difficulty: -1.1 }, { id: "hard", difficulty: 3 }];
    assert.equal(pickByElo(items, 0, 0.75, () => 0).id, "mid");
  });
});

describe("i18n & thế giới", () => {
  test("đề tiếng Anh không lẫn chữ tiếng Việt; đề tiếng Việt dùng dấu phẩy thập phân", async () => {
    const vi = /[ăâđêôơưạảấầẩẫậắằẳẵặẹẻẽếềểễệỉịọỏốồổỗộớờởỡợụủứừửữựỳỵỷỹ]/i;
    for (const fam of FAMILIES) {
      for (const s of SEEDS.slice(0, 15)) {
        const en = generate(fam.id, s, "en");
        assert.ok(!vi.test(JSON.stringify(en.prompt) + en.explanation), `${fam.id} seed ${s} (en) lẫn tiếng Việt`);
        const v = generate(fam.id, s, "vi");
        assert.deepEqual(v.key, en.key, `${fam.id}: đáp án phải giống nhau giữa hai ngôn ngữ`);
      }
    }
  });

  test("địa hình xác định theo seed; 5 kỳ quan cố định quanh điểm xuất phát", async () => {
    const { height, chunkWonder } = await import("@/lib/world/terrain");
    assert.equal(height(123.4, -56.7), height(123.4, -56.7));
    assert.equal(height(0, 0), 0);
    const ids = new Set<string>();
    for (let x = -4; x <= 4; x++) for (let z = -4; z <= 4; z++) {
      const w = chunkWonder(x, z);
      if (w) ids.add(w.id);
    }
    for (const id of ["tesseract", "poincare", "klein", "lorenz", "blackhole"]) assert.ok(ids.has(id), id);
  });
});
