/** Tiệm quà tạm thời chỉ mở cho học sinh offline (thầy quyết 24/11/2026); thầy / admin luôn vào được trang quản lý */
import { test, describe } from "node:test";
import assert from "node:assert/strict";
import { SHOP_OFFLINE_ONLY, canUseShop } from "@/lib/points/shop-access";

describe("Ai được vào Tiệm quà", () => {
  test("chỉ học sinh offline; học sinh online / khách thì không", () => {
    assert.equal(SHOP_OFFLINE_ONLY, true);
    assert.equal(canUseShop({ role: "STUDENT", studentType: "OFFLINE" }), true);
    assert.equal(canUseShop({ role: "STUDENT", studentType: "ONLINE" }), false);
    assert.equal(canUseShop({ role: "STUDENT", studentType: null }), false);
    assert.equal(canUseShop(null), false);
  });
  test("thầy và admin không bị chặn", () => {
    assert.equal(canUseShop({ role: "TEACHER" }), true);
    assert.equal(canUseShop({ role: "ADMIN" }), true);
  });
});
