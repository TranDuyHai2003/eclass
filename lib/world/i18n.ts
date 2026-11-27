/**
 * i18n cho Thế giới Toán — tiếng Anh là mặc định, tiếng Việt là bản dịch.
 * Văn bản nội dung (KC, phát hiện, ngộ nhận, đề) dùng kiểu `L` = { en, vi }; giao diện dùng từ điển UI.
 */
export const LANGS = ["en", "vi"] as const;
export type Lang = (typeof LANGS)[number];
export const DEFAULT_LANG: Lang = "en";

export interface L {
  en: string;
  vi: string;
}
export const isLang = (x: unknown): x is Lang => x === "en" || x === "vi";
export const tr = (lang: Lang, s: L) => s[lang] ?? s.en;

/** Định dạng số: en "1.5", vi "1,5"; dấu trừ thật */
export function fmtNum(n: number, lang: Lang, digits = 2): string {
  if (!Number.isFinite(n)) return n > 0 ? "+∞" : "−∞";
  const r = Math.round(n * 10 ** digits) / 10 ** digits;
  let s = (Object.is(r, -0) ? 0 : r).toString();
  if (lang === "vi") s = s.replace(".", ",");
  return s.startsWith("-") ? "−" + s.slice(1) : s;
}

type Dict = Record<string, L>;

/** Từ điển giao diện. Tham số dạng {name} */
export const UI: Dict = {
  home: { en: "Home", vi: "Trang chủ" },
  title: { en: "Math World", vi: "Thế giới Toán" },
  viewOnly: { en: "View only", vi: "Chế độ xem" },
  soundOn: { en: "Mute sound", vi: "Tắt âm thanh" },
  soundOff: { en: "Unmute sound", vi: "Bật âm thanh" },
  feralBanner: { en: "{n} creature(s) gone wild — get close to tame them!", vi: "{n} sinh vật đang hoang dã — tới gần để thuần hoá!" },
  controlsHint: { en: "WASD move · Left click combo (press right as the weapon flashes = Rhythm) · hold = charged · Shift / right click dodge (dodge just before a hit = slow time) · E skill · Q burst · Space jump · R switch weapon · F interact · Esc free cursor", vi: "WASD đi · chuột trái chuỗi đòn (bấm đúng lúc vũ khí loé = Nhịp) · giữ = tụ lực · Shift / chuột phải né (né sát lúc bị đánh = làm chậm thời gian) · E kỹ năng · Q tuyệt kỹ · Space nhảy · R đổi vũ khí · F tương tác · Esc nhả chuột" },
  attack: { en: "Attack", vi: "Tấn công" },
  skill: { en: "Tangent Dash", vi: "Lướt Tiếp tuyến" },
  burst: { en: "Integral Nova", vi: "Tích phân Bùng nổ" },
  jump: { en: "Jump", vi: "Nhảy" },
  switchWeapon: { en: "Switch weapon", vi: "Đổi vũ khí" },
  menu: { en: "Menu", vi: "Menu" },
  characters: { en: "Characters", vi: "Nhân vật" },
  language: { en: "Language", vi: "Ngôn ngữ" },
  sound: { en: "Sound", vi: "Âm thanh" },
  bestiary: { en: "Memory creatures", vi: "Sinh vật trí nhớ" },
  controls: { en: "Controls", vi: "Điều khiển" },
  recovering: { en: "Recovering…", vi: "Đang hồi phục…" },
  sirenName: { en: "Labyrinth of Harmonics", vi: "Mê cung Hoạ âm" },
  plazaName: { en: "Plaza of Origins", vi: "Quảng trường Khởi nguyên" },
  noWebgl: { en: "This device doesn't support 3D graphics (WebGL).", vi: "Thiết bị chưa hỗ trợ đồ hoạ 3D (WebGL)." },
  noWebglHint: { en: "Try a newer Chrome/Safari, or use a computer.", vi: "Hãy thử Chrome/Safari mới hơn, hoặc dùng máy tính." },
  backHome: { en: "Back to home", vi: "Về trang chủ" },
  // Sảnh
  enterValley: { en: "Jump through the wormhole", vi: "Nhảy qua lỗ sâu" },
  valleyName: { en: "Function Valley", vi: "Thung lũng Hàm số" },
  museum: { en: "Museum of Discoveries", vi: "Bảo tàng Khám phá" },
  mirror: { en: "Mirror of Forms — change character", vi: "Gương Hoá Thân — đổi nhân vật" },
  mirrorName: { en: "Mirror of Forms", vi: "Gương Hoá Thân" },
  tame: { en: "Tame {name}", vi: "Thuần hoá {name}" },
  wildTag: { en: "{name} · wild", vi: "{name} · hoang dã" },
  npcGuide: { en: "Suong · Guide", vi: "Sương · Hướng dẫn" },
  npcCurator: { en: "Diep · Museum Keeper", vi: "Diệp · Người giữ Bảo tàng" },
  derivGraph: { en: "graph of f′", vi: "đồ thị f′" },
  // Bảng & nút
  close: { en: "Close", vi: "Đóng" },
  continue: { en: "Continue →", vi: "Tiếp tục →" },
  cast: { en: "Cast", vi: "Tung phép" },
  casting: { en: "Casting…", vi: "Đang niệm phép…" },
  hint: { en: "Hint {n}/{m}", vi: "Gợi ý {n}/{m}" },
  hintN: { en: "Hint {n}:", vi: "Gợi ý {n}:" },
  confidence: { en: "Confidence:", vi: "Độ chắc chắn:" },
  confidenceAria: { en: "Confidence {n}/3", vi: "Chắc chắn {n}/3" },
  partLabel: { en: "Exam Part {p}", vi: "Dạng Phần {p}" },
  challenge: { en: "Challenge", vi: "Thử thách" },
  tf4Scale: { en: "Scored like the real exam: 1 / 2 / 3 / 4 correct → 0.1 / 0.25 / 0.5 / 1 point.", vi: "Thang điểm như đề thi: đúng 1 / 2 / 3 / 4 ý → 0,1 / 0,25 / 0,5 / 1 điểm." },
  trueShort: { en: "T", vi: "Đ" },
  falseShort: { en: "F", vi: "S" },
  correct: { en: "✦ Correct!", vi: "✦ Chính xác!" },
  partial: { en: "Almost — {s} point(s)", vi: "Gần đúng — {s} điểm" },
  wrong: { en: "Not quite", vi: "Chưa đúng" },
  answerIs: { en: "Answer: {v}", vi: "Đáp số: {v}" },
  trap: { en: "Common trap: {name}.", vi: "Bẫy hay gặp: {name}." },
  shortHint: { en: "Enter a number (max 4 characters)", vi: "Nhập một số (tối đa 4 ký tự)" },
  // Bảo tàng
  stage_hunch: { en: "Hunch", vi: "Linh cảm" },
  stage_confirmed: { en: "Confirmed", vi: "Đã xác nhận" },
  stage_explained: { en: "Explained", vi: "Giải thích được" },
  stage_mastered: { en: "Mastered", vi: "Thành thạo" },
  unfound: { en: "Undiscovered exhibit", vi: "Hiện vật chưa tìm thấy" },
  firstGuess: { en: "First prediction:", vi: "Dự đoán ban đầu:" },
  ability: { en: "Ability: {name}", vi: "Năng lực: {name}" },
  explainPh: { en: "Explain it in your own words…", vi: "Giải thích bằng lời của em…" },
  save: { en: "Save", vi: "Lưu" },
  explainSaved: { en: "Your explanation is now in the museum ✦", vi: "Đã lưu lời giải thích vào bảo tàng ✦" },
  echoes: { en: "Echo Creatures", vi: "Sinh vật Hồi âm" },
  untamed: { en: "Not tamed yet", vi: "Chưa thuần hoá" },
  st_feral: { en: "Wild", vi: "Hoang dã" },
  st_fading: { en: "Fading", vi: "Đang mờ" },
  st_tamed: { en: "Bonded", vi: "Gắn bó" },
  echoesNote: {
    en: "Creatures fade as you start to forget. When they go wild they roam the plaza — tame them again to remember longer.",
    vi: "Sinh vật mờ dần khi em bắt đầu quên. Khi hoá hoang dã, chúng chạy ra sảnh — thuần hoá lại để nhớ lâu hơn.",
  },
  // Nhân vật
  transforming: { en: "✦ Current form", vi: "✦ Đang hoá thân" },
  avatarCredits: { en: "VRoid characters by their VRoid Hub creators — see /world/CREDITS.md.", vi: "Nhân vật VRoid của các tác giả trên VRoid Hub — xem /world/CREDITS.md." },
  // Trận
  taming: { en: "Taming {name}", vi: "Thuần hoá {name}" },
  barrier: { en: "Barrier · round {r}/{m}", vi: "Hộ thể · lượt {r}/{m}" },
  retreat: { en: "Retreat", vi: "Rút lui" },
  circleAppears: { en: "A magic circle is forming…", vi: "Vòng tròn phép đang hiện…" },
  tamed: { en: "✦ Tamed! ✦", vi: "✦ Thuần hoá thành công! ✦" },
  tamedNote: { en: "{name} is back by your side. Your next review will be further away.", vi: "{name} đã quay về bên em. Lần ôn tiếp theo sẽ cách xa hơn." },
  great: { en: "Awesome!", vi: "Tuyệt!" },
  escaped: { en: "{name} slipped into the clouds…", vi: "{name} lẩn vào mây…" },
  escapedNote: { en: "That's okay — mistakes are part of learning. Review the solutions and come back later.", vi: "Không sao — sai là một phần của việc học. Xem lại lời giải và quay lại sau nhé." },
  toPlaza: { en: "Back to plaza", vi: "Về sảnh" },
  // Thung lũng
  backPlaza: { en: "Plaza", vi: "Về sảnh" },
  rideHint: { en: "← → (or joystick) to ride · Shift to go faster", vi: "← → (hoặc joystick) để lướt · Shift để lướt nhanh" },
  mystery: { en: "Mystery of the valley", vi: "Bí ẩn của thung lũng" },
  investigate: { en: "Investigate", vi: "Tìm hiểu" },
  predictFirst: { en: "Predict first: {q}", vi: "Dự đoán trước đã: {q}" },
  exploreNote: {
    en: "Ride the track, change a, b, c, d and watch the slope number under your feet. When you think you've found the rule, confirm it.",
    vi: "Lướt thử trên đường ray, đổi a, b, c, d và quan sát số độ dốc dưới chân. Khi đã nghĩ ra quy luật, hãy xác nhận.",
  },
  hintBtn: { en: "Hint ({n}/{m})", vi: "Gợi ý ({n}/{m})" },
  confirm: { en: "Confirm discovery", vi: "Xác nhận phát hiện" },
  confirmTitle: { en: "Confirm discovery", vi: "Xác nhận phát hiện" },
  anchorNote: { en: "Ride to the right spot and press Drop anchor (Space). Anchors placed: {n}", vi: "Lướt tới đúng chỗ rồi bấm Đặt neo (phím Space). Neo đã đặt: {n}" },
  dropAnchor: { en: "Drop anchor", vi: "Đặt neo" },
  undoAnchor: { en: "Remove last", vi: "Gỡ neo cuối" },
  submit: { en: "Submit", vi: "Nộp" },
  anchorWrong: { en: "Not yet — an anchor slipped or a point is missing.", vi: "Neo chưa đúng chỗ — có neo bị trượt hoặc còn thiếu điểm." },
  retryNote: { en: "Not quite — but every mistake is a clue.", vi: "Chưa đúng — nhưng mỗi lần sai là một manh mối." },
  retry: { en: "Explore more and try again", vi: "Khám phá thêm rồi thử lại" },
  newDiscovery: { en: "✦ New discovery ✦", vi: "✦ Phát hiện mới ✦" },
  newAbility: { en: "New ability", vi: "Năng lực mới" },
  toMuseum: { en: "Add to the Museum →", vi: "Ghi vào Bảo tàng →" },
  allFound: { en: "Every mystery of the valley is solved ✦", vi: "Mọi bí ẩn của thung lũng đã được khám phá ✦" },
  practiceWith: { en: "Play intuition challenges with your tamed creatures:", vi: "Thử thách trực giác cùng sinh vật đã thuần hoá:" },
  practicing: { en: "Practicing with", vi: "Luyện cùng" },
  streak: { en: "Streak: {n}", vi: "Chuỗi đúng: {n}" },
  stop: { en: "Stop", vi: "Dừng" },
  presetHills: { en: "Hill & dip", vi: "Đồi – thung" },
  presetCube: { en: "y = x³", vi: "y = x³" },
  presetFlip: { en: "Flipped", vi: "Ngược" },
  presetGentle: { en: "Gentle", vi: "Thoải" },
  lang: { en: "VI", vi: "EN" },
  wonderLook: { en: "Wonder: {name}", vi: "Kỳ quan: {name}" },
  enterExpanse: { en: "Teleport to the Wonder Expanse", vi: "Dịch chuyển tới Vùng Kỳ quan" },
  expanseName: { en: "Wonder Expanse", vi: "Vùng Kỳ quan" },
  returnHub: { en: "Return to the plaza", vi: "Trở về sảnh" },
  place: { en: "Place", vi: "Đặt" },
  online: { en: "{n} online", vi: "{n} đang chơi" },
  connecting: { en: "Connecting…", vi: "Đang kết nối…" },
  enterImpossible: { en: "Step into the Impossible Halls", vi: "Bước vào Sảnh Bất Khả" },
  impossibleName: { en: "Impossible Halls", vi: "Sảnh Bất Khả" },
  babelName: { en: "The Library of Babel", vi: "Thư viện Babel" },
  paradoxName: { en: "Paradox Void", vi: "Hư Không Nghịch Lý" },
  studyName: { en: "Study Together", vi: "Phòng Học cùng nhau" },
  enterStudy: { en: "Enter the Study Room (study with me)", vi: "Vào Phòng Học cùng nhau" },
  impBooth: { en: "A booth… bigger on the inside?", vi: "Một cái bốt… bên trong lớn hơn bên ngoài?" },
  impCorridor: { en: "The corridor that never ends", vi: "Hành lang không có điểm cuối" },
  emotes: { en: "Emotes & expressions", vi: "Động tác & biểu cảm" },
  emoteMoves: { en: "Moves", vi: "Động tác" },
  emoteFaces: { en: "Expression", vi: "Biểu cảm" },
  emoteHint: { en: "Press G anytime. Moving cancels a move.", vi: "Bấm G bất cứ lúc nào. Di chuyển sẽ huỷ động tác." },
  break: { en: "Break", vi: "Phá" },
  blockSlot: { en: "Block {n}", vi: "Khối {n}" },
  blockHint: { en: "Left click break (or hit a monster in front) · Right click place · 1–6 choose block", vi: "Chuột trái phá khối (hoặc đánh quái trước mặt) · chuột phải đặt · 1–6 chọn khối" },
  wonderTitle: { en: "Mathematical Wonder", vi: "Kỳ quan Toán học" },
  wonderQuestion: { en: "Wonder about it", vi: "Thử nghĩ xem" },
  wonderSee: { en: "Where it lives", vi: "Gặp nó ở đâu" },
  start: { en: "Enter the world", vi: "Vào thế giới" },
  yourName: { en: "Your name (shown above your head)", vi: "Tên của em (hiện trên đầu nhân vật)" },
  namePh: { en: "Type your name…", vi: "Nhập tên của em…" },
  tagline: { en: "Explore, discover the hidden laws of mathematics, and tame the creatures of memory.", vi: "Khám phá, tự tìm ra quy luật ẩn của toán học và thuần hoá những sinh vật của trí nhớ." },
  fullscreenNote: { en: "The game opens in fullscreen — press Esc to exit.", vi: "Game mở toàn màn hình — bấm Esc để thoát." },
  fullscreen: { en: "Toggle fullscreen", vi: "Bật/tắt toàn màn hình" },
};

export function t(lang: Lang, key: string, params?: Record<string, string | number>): string {
  const e = UI[key];
  let s = e ? tr(lang, e) : key;
  if (params) for (const [k, v] of Object.entries(params)) s = s.replaceAll(`{${k}}`, String(v));
  return s;
}
