/**
 * Căn phòng Trung Hoa (John Searle, "Minds, Brains, and Programs", 1980) — dữ liệu + logic thuần.
 * Người trong phòng KHÔNG biết tiếng Trung. Mẩu giấy câu hỏi đi vào khe IN; người đó tra sách quy tắc theo HÌNH DẠNG ký tự
 * ("thấy dãy nét này thì chép dãy nét kia") rồi đẩy câu trả lời ra khe OUT. Bên ngoài tưởng trong phòng có người thạo tiếng Trung.
 * Câu hỏi / trả lời là tiếng Trung phổ thông thật (giản thể); bản dịch chỉ hiện khi đã chơi xong.
 */
import { mulberry32 } from "./monty";

export type L = { en: string; vi: string };
export type Rule = { id: string; see: string; write: string; q: L; a: L };

/** Các cuộc trao đổi theo thứ tự (Lan ở ngoài gửi vào) */
export const ROUNDS: Rule[] = [
  { id: "hello", see: "你好吗？", write: "我很好，谢谢！", q: { en: "How are you?", vi: "Bạn khoẻ không?" }, a: { en: "I'm very well, thank you!", vi: "Tôi rất khoẻ, cảm ơn!" } },
  { id: "speak", see: "你会说中文吗？", write: "会，我说得很流利。", q: { en: "Can you speak Chinese?", vi: "Bạn nói được tiếng Trung không?" }, a: { en: "Yes, I speak it fluently.", vi: "Được, tôi nói rất trôi chảy." } },
  { id: "understand", see: "你明白我的意思吗？", write: "当然明白！", q: { en: "Do you understand what I mean?", vi: "Bạn có hiểu ý tôi không?" }, a: { en: "Of course I understand!", vi: "Tất nhiên là hiểu!" } },
  { id: "think", see: "你在想什么？", write: "我在想你的问题。", q: { en: "What are you thinking about?", vi: "Bạn đang nghĩ gì vậy?" }, a: { en: "I'm thinking about your question.", vi: "Tôi đang nghĩ về câu hỏi của bạn." } },
];

/** Quy tắc gây nhiễu trong sách (cũng là tiếng Trung thật) */
const DISTRACT: Rule[] = [
  { id: "weather", see: "今天天气怎么样？", write: "今天天气很好。", q: { en: "How's the weather today?", vi: "Hôm nay trời thế nào?" }, a: { en: "The weather is nice today.", vi: "Hôm nay trời đẹp." } },
  { id: "name", see: "你叫什么名字？", write: "我叫小房间。", q: { en: "What's your name?", vi: "Bạn tên gì?" }, a: { en: "My name is Little Room.", vi: "Tôi tên là Căn Phòng Nhỏ." } },
  { id: "math", see: "你喜欢数学吗？", write: "我非常喜欢数学。", q: { en: "Do you like maths?", vi: "Bạn thích toán không?" }, a: { en: "I like maths very much.", vi: "Tôi rất thích toán." } },
  { id: "time", see: "现在几点？", write: "现在三点。", q: { en: "What time is it?", vi: "Bây giờ là mấy giờ?" }, a: { en: "It's three o'clock.", vi: "Bây giờ là ba giờ." } },
];

/** Sách quy tắc: trộn cố định (người chơi phải dò theo hình dạng) */
export const RULEBOOK: Rule[] = (() => {
  const all = [...ROUNDS, ...DISTRACT];
  const r = mulberry32(1980);
  for (let i = all.length - 1; i > 0; i--) {
    const j = Math.floor(r() * (i + 1));
    [all[i], all[j]] = [all[j], all[i]];
  }
  return all;
})();

/** Tách thành từng ký tự (kể cả dấu câu toàn khổ) */
export const glyphs = (s: string) => Array.from(s);

export function findRule(input: string): Rule | null {
  const hits = RULEBOOK.filter((r) => r.see === input);
  return hits.length === 1 ? hits[0] : null;
}

/** Khay chữ cho một lượt: mọi ký tự của câu trả lời + 4 ký tự nhiễu không có trong câu trả lời, xáo trộn cố định */
export function trayFor(round: number, seed = 7): string[] {
  const ans = glyphs(ROUNDS[round].write);
  const pool = Array.from(new Set(DISTRACT.flatMap((d) => glyphs(d.write)).filter((g) => !ans.includes(g))));
  const r = mulberry32(seed + round * 101);
  const extra: string[] = [];
  while (extra.length < 4 && pool.length) extra.push(pool.splice(Math.floor(r() * pool.length), 1)[0]);
  const tray = [...ans, ...extra];
  for (let i = tray.length - 1; i > 0; i--) {
    const j = Math.floor(r() * (i + 1));
    [tray[i], tray[j]] = [tray[j], tray[i]];
  }
  return tray;
}

export const isCorrect = (round: number, written: string[]) => written.join("") === ROUNDS[round].write;
