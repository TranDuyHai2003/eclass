import { test } from "node:test";
import assert from "node:assert/strict";
import { GROUPS, mul, orbit, type GroupId } from "@/lib/world/symmetry";

test("cấp của nhóm: |C₂| = 2, |C₄| = 4, |D₄| = 8, |Oₕ| = 48", () => {
  assert.equal(GROUPS.C2.length, 2);
  assert.equal(GROUPS.C4.length, 4);
  assert.equal(GROUPS.D4.length, 8);
  assert.equal(GROUPS.Oh.length, 48);
});

test("đóng dưới phép nhân và mọi phần tử có định thức ±1 (khối nguyên → khối nguyên)", () => {
  for (const g of Object.keys(GROUPS) as GroupId[]) {
    const keys = new Set(GROUPS[g].map((m) => m.join(",")));
    for (const a of GROUPS[g]) for (const b of GROUPS[g]) assert.ok(keys.has(mul(a, b).join(",")), `${g} không đóng`);
  }
});

test("định lý quỹ đạo – ổn định hoá: điểm tổng quát có |G| bản; điểm trên trục / mặt đối xứng ít hơn", () => {
  const generic: [number, number, number] = [3, 5, 1];
  assert.equal(orbit(generic, "C4").length, 4);
  assert.equal(orbit(generic, "D4").length, 8);
  assert.equal(orbit(generic, "Oh").length, 48);
  assert.equal(orbit([0, 7, 0], "C4").length, 1); // trên trục quay
  assert.equal(orbit([2, 2, 2], "Oh").length, 8); // trên đường chéo khối: ổn định hoá cấp 6
  assert.equal(orbit([2, 0, 0], "Oh").length, 6); // tâm mặt
  // quỹ đạo luôn chứa chính điểm đó
  assert.ok(orbit(generic, "D4").some((v) => v.join(",") === "3,5,1"));
});
