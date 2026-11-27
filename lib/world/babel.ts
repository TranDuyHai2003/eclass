/**
 * Thư viện Babel (theo truyện ngắn của J. L. Borges, 1941) — toán học thuần, kiểm thử được.
 *
 * Quy ước của truyện, giữ đúng:
 *  - 25 ký hiệu chính tả. Thật trùng hợp: bảng chữ cái tiếng Việt bỏ dấu có ĐÚNG 22 chữ cái gốc
 *    (a b c d e g h i k l m n o p q r s t u v x y) — cộng dấu cách, dấu phẩy, dấu chấm = 25.
 *  - Mỗi trang 40 dòng × 80 ký tự; mỗi cuốn 410 trang; mỗi kệ 32 cuốn; mỗi bức tường 5 kệ; mỗi phòng lục giác 4 bức tường có sách.
 *
 * Mọi trang có thể viết ra đều nằm ở ĐÚNG MỘT địa chỉ: song ánh tuyến tính trên vành số nguyên modulo N = 25^3200
 *     địa chỉ A = (P·K + C) mod N   ⟺   P = (A − C)·K⁻¹ mod N        (K không chia hết cho 5 nên khả nghịch)
 * với P là nội dung trang viết theo cơ số 25. Vì thế "tìm" một câu bất kỳ = tính ngược ra địa chỉ của nó (không phải dò).
 * Số cuốn sách khác nhau = 25^(410·40·80) = 25^1 312 000 ≈ 10^1 834 097 — hữu hạn, nhưng lớn hơn mọi thứ trong vũ trụ.
 */
export const ALPHABET = "abcdeghiklmnopqrstuvxy ,.";
export const BASE = 25;
export const LINES = 40;
export const COLS = 80;
export const PAGE_LEN = LINES * COLS;
export const PAGES = 410;
export const VOLS = 32;
export const SHELVES = 5;
export const WALLS = 4;
export const BOOK_DIGITS = Math.round(Math.log10(BASE) * PAGE_LEN * PAGES); // ≈ 1 834 097

const B = BigInt(BASE);
const N = B ** BigInt(PAGE_LEN);
const PER_HEX = BigInt(WALLS * SHELVES * VOLS * PAGES); // 262 400 trang mỗi phòng
/** Số phòng lục giác (đủ chỗ cho mọi trang) */
export const HEX_COUNT = N / PER_HEX;

// Hằng số trộn: số lớn giả ngẫu nhiên, tất định (xorshift), K không chia hết cho 5
function bigFrom(seed: number, bits: number): bigint {
  let x = seed >>> 0 || 1;
  let out = BigInt(0);
  for (let i = 0; i < Math.ceil(bits / 32); i++) {
    x ^= x << 13;
    x >>>= 0;
    x ^= x >>> 17;
    x ^= x << 5;
    x >>>= 0;
    out = (out << BigInt(32)) | BigInt(x);
  }
  return out;
}
const BITS = Math.ceil(PAGE_LEN * Math.log2(BASE)) + 8;
let K = bigFrom(0x9e3779b9, BITS) % N;
if (K % BigInt(5) === BigInt(0)) K += BigInt(1);
const C = bigFrom(0x85ebca6b, BITS) % N;
let K_INV: bigint | null = null;
function modInv(a: bigint, m: bigint): bigint {
  // Euclid mở rộng (lặp)
  let [r0, r1] = [((a % m) + m) % m, m];
  let [s0, s1] = [BigInt(1), BigInt(0)];
  while (r1 !== BigInt(0)) {
    const q = r0 / r1;
    [r0, r1] = [r1, r0 - q * r1];
    [s0, s1] = [s1, s0 - q * s1];
  }
  if (r0 !== BigInt(1)) throw new Error("not invertible");
  return ((s0 % m) + m) % m;
}
const kInv = () => (K_INV ??= modInv(K, N));

export type Address = { hex: bigint; wall: number; shelf: number; vol: number; page: number };

function addrToInt(a: Address): bigint {
  return ((((a.hex * BigInt(WALLS) + BigInt(a.wall)) * BigInt(SHELVES) + BigInt(a.shelf)) * BigInt(VOLS) + BigInt(a.vol)) * BigInt(PAGES)) + BigInt(a.page);
}
function intToAddr(n: bigint): Address {
  const page = Number(n % BigInt(PAGES));
  n /= BigInt(PAGES);
  const vol = Number(n % BigInt(VOLS));
  n /= BigInt(VOLS);
  const shelf = Number(n % BigInt(SHELVES));
  n /= BigInt(SHELVES);
  const wall = Number(n % BigInt(WALLS));
  n /= BigInt(WALLS);
  return { hex: n, wall, shelf, vol, page };
}

// Đổi cơ số theo khối 25^11 (< 2^53 → phép tính Number chính xác)
const CHUNK = 11;
const D = B ** BigInt(CHUNK);
function textToInt(text: string): bigint {
  let p = BigInt(0);
  for (let i = 0; i < PAGE_LEN; i += CHUNK) {
    let v = 0;
    const len = Math.min(CHUNK, PAGE_LEN - i);
    for (let j = 0; j < len; j++) v = v * BASE + ALPHABET.indexOf(text[i + j]);
    p = p * (len === CHUNK ? D : B ** BigInt(len)) + BigInt(v);
  }
  return p;
}
function intToText(p: bigint): string {
  const out: string[] = new Array(PAGE_LEN);
  let i = PAGE_LEN;
  const rem = PAGE_LEN % CHUNK;
  // khối cuối có thể ngắn hơn
  if (rem) {
    const d = B ** BigInt(rem);
    let v = Number(p % d);
    p /= d;
    for (let j = 0; j < rem; j++) {
      out[--i] = ALPHABET[v % BASE];
      v = Math.floor(v / BASE);
    }
  }
  while (i > 0) {
    let v = Number(p % D);
    p /= D;
    for (let j = 0; j < CHUNK; j++) {
      out[--i] = ALPHABET[v % BASE];
      v = Math.floor(v / BASE);
    }
  }
  return out.join("");
}

/** Nội dung trang tại địa chỉ (3200 ký tự, 40 dòng × 80) */
export function pageAt(a: Address): string {
  const A = addrToInt(a) % N;
  const P = (((A - C) % N + N) % N * kInv()) % N;
  return intToText(P);
}
/** Địa chỉ DUY NHẤT của một trang (đúng 3200 ký tự trong bảng chữ cái) */
export function addressOfPage(page: string): Address {
  if (page.length !== PAGE_LEN) throw new Error("page must be 3200 symbols");
  const P = textToInt(page);
  return intToAddr((P * K + C) % N);
}

/** Đưa văn bản về 25 ký hiệu: bỏ dấu tiếng Việt, đ→d, f→ph, j→gi, w→u, z→d, mọi dấu câu khác → phẩy / chấm / cách */
export function normalize(text: string): string {
  const s = text
    .normalize("NFD")
    .replace(/[̀-ͯ]/g, "")
    .replace(/[đĐ]/g, "d")
    .toLowerCase()
    .replace(/f/g, "ph")
    .replace(/j/g, "gi")
    .replace(/w/g, "u")
    .replace(/z/g, "d")
    .replace(/[!?;:]/g, ".")
    .replace(/[-–—"'()[\]]/g, ",")
    .replace(/\s+/g, " ");
  let out = "";
  for (const ch of s) if (ALPHABET.includes(ch)) out += ch;
  return out;
}

function rng(seed: number) {
  let a = seed >>> 0;
  return () => {
    a |= 0;
    a = (a + 0x6d2b79f5) | 0;
    let t = Math.imul(a ^ (a >>> 15), 1 | a);
    t = (t + Math.imul(t ^ (t >>> 7), 61 | t)) ^ t;
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
  };
}
export function hashStr(s: string) {
  let h = 2166136261;
  for (let i = 0; i < s.length; i++) h = Math.imul(h ^ s.charCodeAt(i), 16777619);
  return h >>> 0;
}

/**
 * Tìm câu trong Thư viện: trả về địa chỉ một trang chứa câu đó.
 *  mode "random": câu nằm ở vị trí ngẫu nhiên giữa các ký tự ngẫu nhiên (đúng như phần lớn sách trong Thư viện)
 *  mode "blank": câu ở đầu trang, phần còn lại là dấu cách (cũng là một trang có thật trong Thư viện)
 * variant: đổi biến thể → một trang KHÁC cũng chứa câu đó (có vô số trang như vậy).
 */
export function search(text: string, mode: "random" | "blank" = "random", variant = 0): { addr: Address; page: string; at: number; text: string } {
  const t = normalize(text).slice(0, PAGE_LEN);
  const r = rng(hashStr(t) + variant * 7919);
  let page: string;
  let at = 0;
  if (mode === "blank") {
    page = t.padEnd(PAGE_LEN, " ");
  } else {
    at = Math.floor(r() * (PAGE_LEN - t.length + 1));
    let fill = "";
    for (let i = 0; i < PAGE_LEN; i++) fill += ALPHABET[Math.floor(r() * BASE)];
    page = fill.slice(0, at) + t + fill.slice(at + t.length);
  }
  return { addr: addressOfPage(page), page, at, text: t };
}

/** Tên phòng lục giác: số nguyên khổng lồ viết cơ số 36, rút gọn đầu … cuối (kèm số chữ số) */
export function hexName(hex: bigint, head = 10, tail = 6) {
  const s = hex.toString(36);
  return { short: s.length > head + tail + 1 ? `${s.slice(0, head)}…${s.slice(-tail)}` : s, digits: s.length };
}
/** Một phòng "ngẫu nhiên" trong Thư viện (tất định theo seed) */
export function randomHex(seed: number): bigint {
  return bigFrom(seed || 1, BITS - 20) % HEX_COUNT;
}
/** Phòng kế bên theo hành lang (đông +1 / tây −1) và theo tầng (lên / xuống): ánh xạ đơn ánh đơn giản lên số nguyên */
export function neighborHex(hex: bigint, dx: number, dy: number): bigint {
  const step = BigInt(dx) + BigInt(dy) * BigInt(1000003);
  return (((hex + step) % HEX_COUNT) + HEX_COUNT) % HEX_COUNT;
}
/** Nhan đề trên gáy sách (Borges: nhan đề không nói gì về nội dung) — 2–4 ký tự tất định */
export function spineTitle(a: Omit<Address, "page">): string {
  const h = hashStr(`${a.hex.toString(36).slice(-12)}:${a.wall}:${a.shelf}:${a.vol}`);
  const n = 2 + (h % 3);
  let s = "";
  for (let i = 0; i < n; i++) s += ALPHABET[(h >>> (i * 5 + 3)) % 22];
  return s;
}
/** Chia trang thành 40 dòng 80 ký tự */
export const lines = (page: string) => Array.from({ length: LINES }, (_, i) => page.slice(i * COLS, (i + 1) * COLS));
