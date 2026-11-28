import { test } from "node:test";
import assert from "node:assert/strict";
import { CUBIST, cubistCells, inCell } from "@/lib/world/theseusCubist";

test("các ô Voronoi lập thể phủ kín khung, không chồng nhau", () => {
  const cells = cubistCells(CUBIST.seeds, CUBIST.hw, CUBIST.hh);
  let n = 0;
  for (let x = -CUBIST.hw + 0.013; x < CUBIST.hw; x += 0.171)
    for (let y = -CUBIST.hh + 0.017; y < CUBIST.hh; y += 0.137) {
      const k = cells.filter((c) => inCell(c, x, y)).length;
      assert.equal(k, 1, `(${x.toFixed(2)}, ${y.toFixed(2)}) thuộc ${k} ô`);
      n++;
    }
  assert.ok(n > 1000);
});

test("mỗi hạt nằm trong ô của chính nó; ngoài khung không thuộc ô nào", () => {
  const cells = cubistCells(CUBIST.seeds, CUBIST.hw, CUBIST.hh);
  CUBIST.seeds.forEach((s, i) => assert.ok(inCell(cells[i], s.x, s.y)));
  for (const [x, y] of [[CUBIST.hw + 0.1, 0], [0, -CUBIST.hh - 0.1]]) assert.equal(cells.filter((c) => inCell(c, x, y)).length, 0);
});
