import { test } from "node:test";
import assert from "node:assert/strict";
import { NAME_MAX, cleanName } from "@/lib/world/playerName";

test("giữ tên tiếng Việt có dấu, gộp khoảng trắng", () => {
  assert.equal(cleanName("  Nguyễn   Thị  Ánh  "), "Nguyễn Thị Ánh");
  assert.equal(cleanName("Lê Văn-Đức_10A1"), "Lê Văn-Đức_10A1");
});

test("bỏ thẻ HTML, ký tự điều khiển, ký tự vô hình / đảo chiều", () => {
  assert.equal(cleanName("<b>Minh</b>"), "bMinhb");
  assert.equal(cleanName("An\u0000​‮h"), "Anh");
  assert.equal(cleanName("a\nb\tc"), "a b c");
});

test("cắt ở NAME_MAX điểm mã, không để khoảng trắng cuối", () => {
  const long = "Phạm Hoàng Bảo Ngọc Trâm Anh Thư";
  const c = cleanName(long);
  assert.ok(Array.from(c).length <= NAME_MAX);
  assert.equal(c, c.trim());
  assert.ok(long.startsWith(c));
});

test("không phải chuỗi / rỗng → chuỗi rỗng (dùng tên mặc định)", () => {
  assert.equal(cleanName(undefined), "");
  assert.equal(cleanName(42), "");
  assert.equal(cleanName("   "), "");
  assert.equal(cleanName("<>{}"), "");
});

test("dạng tổ hợp (NFD) được chuẩn hoá về NFC", () => {
  assert.equal(cleanName("Nguyễn"), "Nguyễn");
});
