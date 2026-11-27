import { test } from "node:test";
import assert from "node:assert/strict";
import { ALPHABET, BOOK_DIGITS, addressOfPage, hexName, lines, neighborHex, normalize, pageAt, randomHex, search, spineTitle, PAGE_LEN } from "../../lib/world/babel";

test("babel: 25 ký hiệu = 22 chữ cái tiếng Việt không dấu + cách, phẩy, chấm", () => {
  assert.equal(ALPHABET.length, 25);
  assert.equal(new Set(ALPHABET).size, 25);
  for (const ch of "fjwz") assert.ok(!ALPHABET.includes(ch));
  assert.equal(BOOK_DIGITS, 1834097); // 25^1 312 000 ≈ 10^1 834 097 cuốn
});

test("babel: chuẩn hoá tiếng Việt (bỏ dấu, đ→d, f→ph)", () => {
  assert.equal(normalize("Toán học đẹp!"), "toan hoc dep.");
  assert.equal(normalize("Flatland"), "phlatland");
});

test("babel: song ánh — trang tại địa chỉ ↔ địa chỉ của trang (khứ hồi)", () => {
  const a = { hex: randomHex(42), wall: 2, shelf: 3, vol: 17, page: 99 };
  const p = pageAt(a);
  assert.equal(p.length, PAGE_LEN);
  for (const ch of p) assert.ok(ALPHABET.includes(ch));
  const back = addressOfPage(p);
  assert.deepEqual(back, a);
  assert.equal(lines(p).length, 40);
});

test("babel: tìm câu → địa chỉ có thật, mở ra đúng trang chứa câu", () => {
  const r = search("Toán học là ngôn ngữ của vũ trụ");
  const page = pageAt(r.addr);
  assert.equal(page, r.page);
  assert.equal(page.slice(r.at, r.at + r.text.length), "toan hoc la ngon ngu cua vu tru");
  const blank = search("xin chao", "blank");
  assert.ok(pageAt(blank.addr).startsWith("xin chao   "));
  // biến thể khác → trang khác cũng chứa câu đó
  const v2 = search("Toán học là ngôn ngữ của vũ trụ", "random", 1);
  assert.notDeepEqual(v2.addr, r.addr);
});

test("babel: hai địa chỉ liền nhau cho hai trang khác hẳn nhau; phòng kế bên, tên phòng, gáy sách", () => {
  const h = randomHex(7);
  const p1 = pageAt({ hex: h, wall: 0, shelf: 0, vol: 0, page: 0 });
  const p2 = pageAt({ hex: h, wall: 0, shelf: 0, vol: 0, page: 1 });
  let same = 0;
  for (let i = 0; i < 400; i++) if (p1[i] === p2[i]) same++;
  assert.ok(same < 60); // ~1/25 trùng ngẫu nhiên
  assert.notEqual(neighborHex(h, 1, 0), h);
  assert.equal(neighborHex(neighborHex(h, 1, 0), -1, 0), h);
  assert.ok(hexName(h).digits > 2800); // log36(25^3200 / 262 400) ≈ 2871 chữ số
  assert.ok(/^[a-z]{2,4}$/.test(spineTitle({ hex: h, wall: 1, shelf: 2, vol: 3 })));
});
