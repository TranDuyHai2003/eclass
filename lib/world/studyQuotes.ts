/**
 * Chữ trên tường phòng Học cùng nhau.
 *  - OATH: bản "Lời thề" đầy đủ do người dùng cung cấp — NGUYÊN VĂN, giữ ngắt dòng — tường chính (bắc).
 *  - CREED: đoạn "Ta sẽ vì chân lý mà đấu tranh!" — nguyên văn, 5 đoạn → 5 tấm ở tường nam (quanh cửa).
 *  - QUOTES: danh ngôn ngắn của triết gia / nhà khoa học, CHỈ những câu đã kiểm chứng xuất xứ
 *    (tác phẩm / thư / bài phỏng vấn gốc; nguồn ghi ở `src`). Câu không rõ nguồn (vd. "Nothing in life is to be
 *    feared…" gán cho Marie Curie) đã bị loại.
 */

/** Tường chính — nguyên văn; "" = dòng trống ngăn khổ */
export const OATH: string[] = [
  "Ta nguyện trọn đời vì chân lý mà chiến đấu!",
  "",
  "Chẳng cúi đầu trước giáo điều,",
  "không lạc lối giữa mê mang,",
  "chẳng đắm chìm trong vọng tưởng.",
  "Ta sẽ đâm thủng lớp mặt nạ giả nhân của mọi kẻ bóc lột,",
  "vững bước nơi trận địa của mình, dẫu đến hơi thở cuối cùng!",
  "",
  "Ta là người gieo mầm văn minh và ánh sáng khoa học,",
  "là tiếng nói vang vọng của dân chủ và tiến bộ.",
  "",
  "Ta là ngọn đuốc rực cháy, thiêu rụi màn đêm mê tín;",
  "là lưỡi liềm sắc bén, cắt phăng cỏ dại ngu muội;",
  "là nhát búa sắt rền vang, đập tan xiềng xích áp bức;",
  "là bức tường thành che chở cho toàn thể nhân loại!",
  "",
  "Sinh mệnh này, vinh quang này, ta xin hiến trọn cho lý tưởng cách mạng khoa học vĩ đại nhất.",
  "Hôm nay như thế, ngày mai như thế, muôn đời sau vẫn vẹn một lời thề!",
];

/** Tường nam — nguyên văn, mỗi phần tử là một đoạn (một tấm) */
export const CREED: string[] = [
  "Ta sẽ vì chân lý mà đấu tranh!",
  "Ta đem không tin dạy, không vọng tưởng, không mê mang, ta đem đâm thủng hết thảy kẻ bóc lột đạo đức giả mặt nạ, tận trung cương vị, đến chết mới thôi!",
  "Ta là văn minh cùng khoa học máy gieo hạt, ta là dân chủ cùng tiến bộ tuyên truyền giảng giải viên.",
  "Ta là khu trục mê tín ngọn đuốc, ta là diệt trừ ngu muội liêm đao, ta là đạp nát gông xiềng thiết chùy, ta là toàn nhân loại thủ hộ giả!",
  "Ta đem sinh mệnh cùng vinh quang hiến tặng cho vĩ đại nhất khoa học cách mạng tín ngưỡng, hôm nay như thế, ngày ngày giống nhau!",
];

export interface Quote {
  who: { vi: string; en: string };
  vi: string;
  en: string;
  /** xuất xứ (đã kiểm chứng) */
  src: string;
}

export const QUOTES: Quote[] = [
  { who: { vi: "Socrates", en: "Socrates" }, vi: "Một cuộc đời không được tự vấn thì không đáng sống.", en: "The unexamined life is not worth living.", src: "Plato, Apology 38a" },
  { who: { vi: "Khổng Tử", en: "Confucius" }, vi: "Học mà không nghĩ thì uổng công; nghĩ mà không học thì nguy hại.", en: "Learning without thought is labour lost; thought without learning is perilous.", src: "Analects 2.15 (Legge)" },
  { who: { vi: "Khổng Tử", en: "Confucius" }, vi: "Biết thì nói là biết, không biết thì nói là không biết — thế mới thật là biết.", en: "To know what you know and to admit what you do not know — that is knowledge.", src: "Analects 2.17" },
  { who: { vi: "Aristotle", en: "Aristotle" }, vi: "Mọi người, tự bản tính, đều khao khát hiểu biết.", en: "All men by nature desire to know.", src: "Metaphysics I.1, 980a21" },
  { who: { vi: "René Descartes", en: "René Descartes" }, vi: "Có trí tuệ tốt thôi chưa đủ; điều chính yếu là dùng nó cho đúng.", en: "It is not enough to have a good mind; the main thing is to use it well.", src: "Discourse on Method, Part I (1637)" },
  { who: { vi: "René Descartes", en: "René Descartes" }, vi: "Tôi tư duy, nên tôi tồn tại.", en: "I think, therefore I am.", src: "Discourse on Method, Part IV (1637)" },
  { who: { vi: "Immanuel Kant", en: "Immanuel Kant" }, vi: "Hãy dám biết! Hãy can đảm sử dụng lý trí của chính mình!", en: "Sapere aude! Have courage to use your own understanding!", src: "What Is Enlightenment? (1784)" },
  { who: { vi: "Galileo Galilei", en: "Galileo Galilei" }, vi: "Cuốn sách lớn của vũ trụ được viết bằng ngôn ngữ toán học.", en: "The great book of the universe is written in the language of mathematics.", src: "The Assayer §6 (1623)" },
  { who: { vi: "Isaac Newton", en: "Isaac Newton" }, vi: "Nếu tôi nhìn xa hơn, ấy là nhờ đứng trên vai những người khổng lồ.", en: "If I have seen further, it is by standing on the shoulders of giants.", src: "Letter to Robert Hooke (1676)" },
  { who: { vi: "Marie Curie", en: "Marie Curie" }, vi: "Người ta không bao giờ để ý điều đã làm được; chỉ thấy điều còn phải làm.", en: "One never notices what has been done; one can only see what remains to be done.", src: "Letter to her brother (1894)" },
  { who: { vi: "Albert Einstein", en: "Albert Einstein" }, vi: "Điều quan trọng là không ngừng đặt câu hỏi. Sự tò mò có lý do tồn tại của riêng nó.", en: "The important thing is not to stop questioning. Curiosity has its own reason for existence.", src: "LIFE, 2 May 1955" },
  { who: { vi: "Albert Einstein", en: "Albert Einstein" }, vi: "Trí tưởng tượng quan trọng hơn kiến thức.", en: "Imagination is more important than knowledge.", src: "The Saturday Evening Post (1929)" },
  { who: { vi: "Euclid", en: "Euclid" }, vi: "Không có con đường dành riêng cho vua chúa để đến với hình học.", en: "There is no royal road to geometry.", src: "Proclus, Commentary on Euclid" },
  { who: { vi: "Archimedes", en: "Archimedes" }, vi: "Hãy cho tôi một điểm tựa, tôi sẽ nâng bổng Trái Đất.", en: "Give me a place to stand, and I will move the Earth.", src: "Pappus, Collection VIII" },
  { who: { vi: "Seneca", en: "Seneca" }, vi: "Người ta học được trong khi dạy.", en: "People learn while they teach.", src: "Letters to Lucilius 7.8" },
  { who: { vi: "Plutarch", en: "Plutarch" }, vi: "Trí óc không phải chiếc bình cần rót đầy, mà là củi cần được nhóm lửa.", en: "The mind is not a vessel that needs filling, but wood that needs igniting.", src: "On Listening, Moralia 48C" },
  { who: { vi: "Hồ Chí Minh", en: "Hồ Chí Minh" }, vi: "Học hỏi là một việc phải tiếp tục suốt đời.", en: "Learning is something we must continue throughout life.", src: "Nói chuyện tại Trường Đại học Nhân dân VN (1956)" },
  {
    who: { vi: "Hồ Chí Minh", en: "Hồ Chí Minh" },
    vi: "Non sông Việt Nam có trở nên tươi đẹp hay không, dân tộc Việt Nam có bước tới đài vinh quang để sánh vai với các cường quốc năm châu được hay không, chính là nhờ một phần lớn ở công học tập của các em.",
    en: "Whether Vietnam becomes beautiful, whether its people rise to stand beside the great powers of the five continents, depends in large part on your studies.",
    src: "Thư gửi các học sinh (9/1945)",
  },
  { who: { vi: "Thân Nhân Trung", en: "Thân Nhân Trung" }, vi: "Hiền tài là nguyên khí của quốc gia.", en: "People of virtue and talent are the vital force of the nation.", src: "Bia tiến sĩ Văn Miếu (1484)" },
  { who: { vi: "Lê Quý Đôn", en: "Lê Quý Đôn" }, vi: "Đi đến đâu, tôi lưu ý sưu tầm hỏi han sách vở.", en: "Wherever I went, I made a point of seeking out books and asking about them.", src: "Kiến văn tiểu lục, lời tựa (1777)" },
];

/** Thời gian mỗi danh ngôn ở trên bảng */
export const QUOTE_PERIOD_MS = 45_000;

/**
 * Danh ngôn cho bảng thứ `board` ở thời điểm `now` (theo giờ thực → mọi người trong phòng thấy giống nhau).
 * Các bảng luôn hiện các câu KHÁC nhau (khi số câu ≥ số bảng); thứ tự được xáo cố định để hai câu của cùng
 * một tác giả ít khi đứng cạnh nhau.
 */
export function quoteIndex(board: number, boards: number, now: number, n = QUOTES.length, period = QUOTE_PERIOD_MS): number {
  const step = Math.floor(now / period);
  // mỗi bảng đi lần lượt qua MỌI câu; các bảng lệch nhau đều n/boards bước → không bao giờ trùng
  const slot = (((step + board * Math.floor(n / Math.max(1, boards))) % n) + n) % n;
  return ORDER[slot % ORDER.length] % n;
}
/** hoán vị cố định 0..n−1 (bước nhảy nguyên tố cùng nhau với n) */
const ORDER: number[] = (() => {
  const n = QUOTES.length;
  let k = 7;
  while (gcd(k, n) !== 1) k++;
  return Array.from({ length: n }, (_, i) => (i * k) % n);
})();
function gcd(a: number, b: number): number {
  return b ? gcd(b, a % b) : a;
}
