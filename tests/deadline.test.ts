/**
 * Hạn nộp hiệu lực (lib/deadline.ts) — thuần logic: hạn lớp → hạn chung → không hạn.
 */
import { test, describe } from "node:test";
import assert from "node:assert/strict";
import { dueStatus, effectiveDueDate } from "@/lib/deadline";

const d1 = new Date("2026-12-01T10:00:00+07:00");
const d2 = new Date("2026-12-05T10:00:00+07:00");

describe("effectiveDueDate", () => {
  test("không hạn chung, không hạn lớp → null (không đặt hạn = không có deadline)", () => {
    assert.equal(effectiveDueDate({ dueDate: null }, "A"), null);
    assert.equal(effectiveDueDate({ dueDate: null, deadlines: [] }, "A"), null);
    assert.equal(effectiveDueDate({ dueDate: null, deadlines: [{ classId: "B", dueDate: d2 }] }, "A"), null, "hạn của lớp khác không áp dụng");
  });

  test("hạn lớp ưu tiên hơn hạn chung; lớp không có dòng riêng dùng hạn chung", () => {
    const t = { dueDate: d1, deadlines: [{ classId: "A", dueDate: d2 }] };
    assert.equal(effectiveDueDate(t, "A")?.getTime(), d2.getTime());
    assert.equal(effectiveDueDate(t, "B")?.getTime(), d1.getTime());
    assert.equal(effectiveDueDate(t, null)?.getTime(), d1.getTime(), "học sinh chưa xếp lớp dùng hạn chung");
  });

  test("hạn lớp có mà hạn chung không → chỉ lớp đó có hạn", () => {
    const t = { dueDate: null, deadlines: [{ classId: "A", dueDate: d2 }] };
    assert.equal(effectiveDueDate(t, "A")?.getTime(), d2.getTime());
    assert.equal(effectiveDueDate(t, "B"), null);
  });

  test("nhận chuỗi ISO; chuỗi hỏng → null", () => {
    assert.equal(effectiveDueDate({ dueDate: d1.toISOString() }, "A")?.getTime(), d1.getTime());
    assert.equal(effectiveDueDate({ dueDate: "không phải ngày" }, "A"), null);
  });
});

describe("dueStatus", () => {
  test("không hạn → none; trước/đúng hạn → on-time; sau hạn → late", () => {
    assert.equal(dueStatus(null), "none");
    assert.equal(dueStatus(d1, new Date(d1.getTime() - 1)), "on-time");
    assert.equal(dueStatus(d1, d1), "on-time");
    assert.equal(dueStatus(d1, new Date(d1.getTime() + 1)), "late");
  });
});
