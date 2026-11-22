/**
 * Nhóm khối của khoá học (lib/course-grade.ts) — hàm thuần, không cần DB.
 */
import { test, describe } from "node:test";
import assert from "node:assert/strict";
import { getCourseGroup, groupCover, groupOrder } from "@/lib/course-grade";

describe("getCourseGroup", () => {
  test("tiêu đề thật của các khoá hiện có", () => {
    assert.equal(getCourseGroup({ title: "Lớp 10 – XPS 2K11" }), "10");
    assert.equal(getCourseGroup({ title: "Lớp 11 – XPS 2K10" }), "11");
    assert.equal(getCourseGroup({ title: "Giai đoạn 2: Kiến thức nền tảng 12" }), "12");
    assert.equal(getCourseGroup({ title: "Giai đoạn 2: Kiến thức nền tảng 12 (Nâng cao)" }), "12");
    assert.equal(getCourseGroup({ title: "Chuyên Đề Luyện Thi THPTQG Toán NC 2026" }), "thi");
  });

  test("khoá luyện thi gắn lớp 12 vẫn là nhóm Luyện thi", () => {
    assert.equal(getCourseGroup({ title: "Chuyên đề luyện thi THPTQG Toán NC 2026", classes: [{ grade: 12 }] }), "thi");
  });

  test("ưu tiên khối của lớp gắn khoá khi mọi lớp cùng khối", () => {
    assert.equal(getCourseGroup({ title: "Hình học không gian", classes: [{ grade: 11 }, { grade: 11 }] }), "11");
    assert.equal(getCourseGroup({ title: "Ôn tập 10 chuyên đề", classes: [{ grade: 12 }] }), "12");
  });

  test("lớp lẫn khối hoặc chưa có khối thì đoán theo tiêu đề", () => {
    assert.equal(getCourseGroup({ title: "Toán 11 nâng cao", classes: [{ grade: 10 }, { grade: 12 }] }), "11");
    assert.equal(getCourseGroup({ title: "Toán 12", classes: [{ grade: null }] }), "12");
  });

  test("năm 2026, 2K10 hay số khác không bị nhận nhầm là khối", () => {
    assert.equal(getCourseGroup({ title: "Khoá hè 2026" }), null);
    assert.equal(getCourseGroup({ title: "XPS 2K11" }), null);
    assert.equal(getCourseGroup({ title: "100 câu hỏi hay" }), null);
    assert.equal(getCourseGroup({ title: "Hình học", classes: [] }), null);
  });

  test("chữ tiếng Việt dạng tổ hợp (NFD) vẫn nhận ra luyện thi", () => {
    assert.equal(getCourseGroup({ title: "Luyện thi đại học".normalize("NFD") }), "thi");
  });
});

describe("thứ tự và bìa", () => {
  test("10 → 11 → 12 → luyện thi → chưa rõ", () => {
    const order = (["thi", null, "12", "10", "11"] as const).slice().sort((a, b) => groupOrder(a) - groupOrder(b));
    assert.deepEqual(order, ["10", "11", "12", "thi", null]);
  });

  test("lớp 12 nâng cao có bìa riêng", () => {
    assert.equal(groupCover("12").big, "12");
    assert.equal(groupCover("12", true).big, "12+");
    assert.equal(groupCover("thi").big, "ƒ(x)");
    assert.equal(groupCover(null).big, "∑");
  });
});
