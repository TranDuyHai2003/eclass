import { test } from "node:test";
import assert from "node:assert/strict";
import { ROUNDS, RULEBOOK, findRule, glyphs, isCorrect, trayFor } from "../../lib/world/chineseRoom";

test("every question matches exactly one rule, and that rule writes the expected answer", () => {
  for (const r of ROUNDS) {
    const hit = findRule(r.see);
    assert.ok(hit, r.id);
    assert.equal(hit!.write, r.write);
  }
  assert.equal(findRule("不存在？"), null);
  assert.equal(new Set(RULEBOOK.map((r) => r.see)).size, RULEBOOK.length);
});

test("the tray holds every glyph of the answer (with multiplicity) plus four decoys", () => {
  ROUNDS.forEach((r, i) => {
    const tray = trayFor(i);
    const ans = glyphs(r.write);
    assert.equal(tray.length, ans.length + 4);
    const left = [...tray];
    for (const g of ans) {
      const k = left.indexOf(g);
      assert.ok(k >= 0, `${r.id} missing ${g}`);
      left.splice(k, 1);
    }
    assert.ok(left.every((g) => !ans.includes(g)));
    assert.deepEqual(trayFor(i), tray, "deterministic");
  });
});

test("only the exact glyph sequence counts as correct", () => {
  assert.ok(isCorrect(0, glyphs("我很好，谢谢！")));
  assert.ok(!isCorrect(0, glyphs("我很好，谢谢")));
  assert.ok(!isCorrect(0, glyphs("很我好，谢谢！")));
});
