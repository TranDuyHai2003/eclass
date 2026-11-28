/** Mọi khung có chỗ đặt mặt hợp lý (28/11: thầy báo avatar lệch / bị che khi đeo khung) */
import { test, describe } from "node:test";
import assert from "node:assert/strict";
import { ITEMS } from "@/lib/game/items";
import { CUT_FRAME_FACE } from "@/lib/game/cut-art";
import { SVG_FRAME_FACE } from "@/lib/game/frame-face";

describe("Chỗ đặt mặt trong khung", () => {
  test("khung nào cũng có số đo; mặt cỡ 20–34% cạnh, lệch tâm ≤ 7%", () => {
    for (const it of ITEMS.filter((i) => i.slot === "frame")) {
      const f = CUT_FRAME_FACE[it.id] ?? SVG_FRAME_FACE[it.id];
      assert.ok(f, `thiếu chỗ đặt mặt cho ${it.id}`);
      const [r, dx, dy] = f;
      assert.ok(r >= 0.2 && r <= 0.34, `${it.id}: bán kính ${r}`);
      assert.ok(Math.abs(dx) <= 0.07 && Math.abs(dy) <= 0.07, `${it.id}: lệch ${dx},${dy}`);
    }
  });
  test("khung có lỗ kín đặt mặt đúng tâm (chỉ trăng khuyết lệch vào lòng trăng)", () => {
    for (const [id, [, dx, dy]] of Object.entries({ ...CUT_FRAME_FACE, ...SVG_FRAME_FACE })) {
      if (id === "frame-moon") continue;
      assert.equal(dx, 0, id);
      assert.equal(dy, 0, id);
    }
  });
});
