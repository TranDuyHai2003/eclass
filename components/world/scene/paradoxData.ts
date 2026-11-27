/** Nội dung chữ của 10 trạm Phòng Nghịch Lý (song ngữ) — câu chuyện, lời giải, câu hỏi "thử nghĩ" */
import { create } from "zustand";

/** Trạm đang mở trong bảng */
export const usePdx = create<{ id: number }>(() => ({ id: 0 }));
type L = { en: string; vi: string };
export type ParadoxInfo = { id: string; color: string; title: L; who: L; story: L; key: L; think: L };

export const PARADOXES: ParadoxInfo[] = [
  {
    id: "zeno",
    color: "#ffd27a",
    title: { en: "Achilles and the tortoise", vi: "Achilles và con rùa" },
    who: { en: "Zeno of Elea, ~450 BC", vi: "Zeno xứ Elea, ~450 TCN" },
    story: {
      en: "Achilles runs ten times faster than a tortoise that starts 100 m ahead. When he reaches where the tortoise was, it has moved 10 m. When he covers those 10 m, it has moved 1 m… There are infinitely many such steps — so he never catches it?",
      vi: "Achilles chạy nhanh gấp mười con rùa xuất phát trước 100 m. Khi anh tới chỗ rùa vừa đứng, rùa đã đi thêm 10 m. Anh chạy nốt 10 m, rùa lại đi thêm 1 m… Có vô hạn bước như thế — vậy anh không bao giờ đuổi kịp?",
    },
    key: {
      en: "Infinitely many steps can take a finite time: 10 + 1 + 0.1 + 0.01 + … = 11.11… seconds. A sum of infinitely many shrinking terms can converge — the idea at the heart of limits and calculus.",
      vi: "Vô hạn bước vẫn có thể chỉ tốn hữu hạn thời gian: 10 + 1 + 0,1 + 0,01 + … = 11,11… giây. Tổng của vô hạn số hạng nhỏ dần có thể hội tụ — đó là ý tưởng cốt lõi của giới hạn và giải tích.",
    },
    think: { en: "Does every infinite sum of shrinking numbers converge? Try 1 + 1/2 + 1/3 + 1/4 + …", vi: "Mọi tổng vô hạn của các số nhỏ dần đều hội tụ ư? Thử 1 + 1/2 + 1/3 + 1/4 + …" },
  },
  {
    id: "birthday",
    color: "#ff9ec0",
    title: { en: "The birthday paradox", vi: "Nghịch lý ngày sinh" },
    who: { en: "Richard von Mises, 1939", vi: "Richard von Mises, 1939" },
    story: {
      en: "How many people must be in a room before it's more likely than not that two share a birthday? Most people guess around 180. The answer is 23.",
      vi: "Cần bao nhiêu người trong phòng để khả năng có hai người trùng ngày sinh vượt quá 50%? Đa số đoán khoảng 180. Đáp án là 23.",
    },
    key: {
      en: "We don't need a match with YOU — any pair counts. 23 people form 253 pairs. The chance that all birthdays differ is 365/365 × 364/365 × … × 343/365 ≈ 49.3%, so a match has ≈ 50.7%.",
      vi: "Không cần ai trùng với BẠN — bất kỳ cặp nào cũng được. 23 người tạo ra 253 cặp. Xác suất mọi ngày sinh khác nhau là 365/365 × 364/365 × … × 343/365 ≈ 49,3%, nên có cặp trùng ≈ 50,7%.",
    },
    think: { en: "Why does this matter for passwords and digital signatures? (search: 'birthday attack')", vi: "Vì sao điều này quan trọng với mật khẩu và chữ ký số? (tìm: 'tấn công ngày sinh')" },
  },
  {
    id: "simpson",
    color: "#7fe3ff",
    title: { en: "Simpson's paradox", vi: "Nghịch lý Simpson" },
    who: { en: "E. H. Simpson, 1951 · kidney-stone data, BMJ 1986", vi: "E. H. Simpson, 1951 · số liệu sỏi thận, BMJ 1986" },
    story: {
      en: "Treatment A beats treatment B for small kidney stones AND for large ones. Yet over all patients, B looks better. How can A win every group and lose the total?",
      vi: "Phương pháp A tốt hơn B với sỏi thận nhỏ VÀ với sỏi lớn. Vậy mà tính trên tất cả bệnh nhân, B lại trông tốt hơn. Sao A thắng mọi nhóm mà thua tổng?",
    },
    key: {
      en: "Doctors gave A mostly to the hard, large-stone cases and B mostly to easy, small ones. The groups have very different sizes, so the totals are weighted differently. A hidden variable (stone size) reverses the trend: always ask how the data was split.",
      vi: "Bác sĩ dùng A chủ yếu cho ca khó (sỏi lớn) và B cho ca dễ (sỏi nhỏ). Các nhóm có cỡ rất khác nhau nên tổng được 'cân' khác nhau. Một biến ẩn (cỡ sỏi) đảo ngược xu hướng: luôn hỏi dữ liệu được chia nhóm thế nào.",
    },
    think: { en: "A school's average score rose, but every class's average fell. Possible?", vi: "Điểm trung bình toàn trường tăng, nhưng lớp nào cũng giảm. Có thể không?" },
  },
  {
    id: "banach",
    color: "#b58bff",
    title: { en: "Banach–Tarski", vi: "Nghịch lý Banach–Tarski" },
    who: { en: "Stefan Banach & Alfred Tarski, 1924", vi: "Stefan Banach & Alfred Tarski, 1924" },
    story: {
      en: "Cut a solid ball into just five pieces, move them only by rotations and shifts — and reassemble them into TWO balls, each the same size as the original.",
      vi: "Cắt một quả cầu đặc thành chỉ năm mảnh, chỉ xoay và dời chúng — rồi ráp lại thành HAI quả cầu, mỗi quả to bằng quả ban đầu.",
    },
    key: {
      en: "The pieces are not shapes you could cut: they are infinitely scattered 'dust' with no volume at all (non-measurable sets), built with the Axiom of Choice. The trick lives in the free group: the words starting with A, rotated by a, become ALL words except those starting with a — one piece turns into almost everything.",
      vi: "Các mảnh không phải hình có thể cắt bằng dao: chúng là 'bụi' rải rác vô hạn, không có thể tích (tập không đo được), dựng bằng Tiên đề chọn. Mẹo nằm ở nhóm tự do: các từ bắt đầu bằng A, khi nhân với a, trở thành MỌI từ trừ những từ bắt đầu bằng a — một mảnh biến thành gần như tất cả.",
    },
    think: { en: "Why can't you do this with real oranges?", vi: "Vì sao bạn không làm được điều này với quả cam thật?" },
  },
  {
    id: "russell",
    color: "#ff7a7a",
    title: { en: "Russell's barber", vi: "Người thợ cạo của Russell" },
    who: { en: "Bertrand Russell, 1901", vi: "Bertrand Russell, 1901" },
    story: {
      en: "In a village, the barber shaves exactly those men who do not shave themselves. Who shaves the barber?",
      vi: "Trong một làng, người thợ cạo cạo râu cho đúng những ai không tự cạo. Vậy ai cạo râu cho người thợ cạo?",
    },
    key: {
      en: "If he shaves himself, he mustn't. If he doesn't, he must. Such a barber cannot exist. Russell found the same trap in set theory: the set of all sets that don't contain themselves. Mathematics had to be rebuilt with careful rules (axioms) about which collections count as sets.",
      vi: "Nếu anh ta tự cạo thì anh ta không được cạo. Nếu không tự cạo thì anh ta phải cạo. Người thợ cạo như vậy không thể tồn tại. Russell thấy đúng cái bẫy đó trong lý thuyết tập hợp: tập hợp mọi tập không chứa chính nó. Toán học phải được xây lại với các luật (tiên đề) cẩn thận về thứ gì được coi là tập hợp.",
    },
    think: { en: "'This sentence is false.' True or false?", vi: "'Câu này là sai.' Đúng hay sai?" },
  },
  {
    id: "newcomb",
    color: "#7dff9a",
    title: { en: "Newcomb's problem", vi: "Bài toán Newcomb" },
    who: { en: "William Newcomb, 1960 · Robert Nozick, 1969", vi: "William Newcomb, 1960 · Robert Nozick, 1969" },
    story: {
      en: "Box A (clear) holds $1 000. Box B (closed) holds $1 000 000 — but only if an almost-perfect predictor foresaw that you'd take box B alone. The boxes are already filled. Take both, or just B?",
      vi: "Hộp A (trong suốt) có 1 000 đô. Hộp B (kín) có 1 000 000 đô — nhưng chỉ khi một kẻ tiên tri gần như không bao giờ sai đã đoán bạn chỉ lấy hộp B. Hộp đã được bỏ tiền xong. Lấy cả hai, hay chỉ lấy B?",
    },
    key: {
      en: "Dominance says: whatever is in B, taking both gives $1 000 more. Expected value says: one-boxers almost always become millionaires. Two good principles disagree. It's a question about free will, prediction and what 'rational' even means.",
      vi: "Lập luận trội nói: dù trong B có gì, lấy cả hai luôn được thêm 1 000 đô. Kỳ vọng nói: người chỉ lấy B gần như luôn thành triệu phú. Hai nguyên tắc hợp lý mâu thuẫn nhau. Đây là câu hỏi về ý chí tự do, sự tiên đoán và chính ý nghĩa của 'hợp lý'.",
    },
    think: { en: "Would you change your choice if the predictor were right only 60% of the time?", vi: "Bạn có đổi lựa chọn nếu kẻ tiên tri chỉ đúng 60% không?" },
  },
  {
    id: "coast",
    color: "#6fb6ff",
    title: { en: "The coastline paradox", vi: "Nghịch lý đường bờ biển" },
    who: { en: "Lewis Richardson, 1961 · Benoît Mandelbrot, 1967", vi: "Lewis Richardson, 1961 · Benoît Mandelbrot, 1967" },
    story: {
      en: "How long is the coast of Britain? Measure with a 200 km ruler and you get about 2 400 km. With a 50 km ruler: about 3 400 km. The shorter the ruler, the longer the coast — without limit.",
      vi: "Bờ biển nước Anh dài bao nhiêu? Đo bằng thước 200 km được khoảng 2 400 km. Thước 50 km: khoảng 3 400 km. Thước càng ngắn, bờ biển càng dài — không có giới hạn.",
    },
    key: {
      en: "Coastlines are fractal: every bay has smaller bays. The Koch snowflake shows it exactly: each refinement multiplies the length by 4/3, forever, while the area stays finite. Its 'dimension' is log 4 / log 3 ≈ 1.26 — more than a line, less than a surface.",
      vi: "Đường bờ biển là fractal: vịnh nào cũng có vịnh nhỏ hơn. Bông tuyết Koch cho thấy chính xác: mỗi lần chi tiết hơn, chiều dài nhân 4/3, mãi mãi, trong khi diện tích vẫn hữu hạn. 'Số chiều' của nó là log 4 / log 3 ≈ 1,26 — hơn một đường, kém một mặt.",
    },
    think: { en: "What other things in nature might have a fractional dimension?", vi: "Còn thứ gì trong tự nhiên có thể có số chiều không nguyên?" },
  },
  {
    id: "braess",
    color: "#ffb347",
    title: { en: "Braess's paradox", vi: "Nghịch lý Braess" },
    who: { en: "Dietrich Braess, 1968", vi: "Dietrich Braess, 1968" },
    story: {
      en: "4 000 drivers, two routes, each taking 65 minutes. The city opens a free shortcut. Everyone takes it — and now everyone needs 80 minutes. Adding a road made traffic worse.",
      vi: "4 000 tài xế, hai tuyến, mỗi tuyến mất 65 phút. Thành phố mở thêm một cầu tắt miễn phí. Ai cũng đi cầu — và giờ ai cũng mất 80 phút. Thêm đường lại làm giao thông tệ hơn.",
    },
    key: {
      en: "Each driver picks what's best for themselves (a Nash equilibrium), not what's best for all. The shortcut lures everyone onto the congested roads. Real cities have seen traffic improve after closing roads (Seoul's Cheonggyecheon, 2003).",
      vi: "Mỗi tài xế chọn điều tốt nhất cho riêng mình (cân bằng Nash), không phải tốt nhất cho tất cả. Cầu tắt kéo mọi người vào những đoạn dễ tắc. Nhiều thành phố thật đã thấy giao thông tốt lên sau khi đóng bớt đường (Cheonggyecheon, Seoul, 2003).",
    },
    think: { en: "Where else might adding an option make everyone worse off?", vi: "Còn ở đâu mà thêm một lựa chọn lại khiến mọi người tệ đi?" },
  },
  {
    id: "grandi",
    color: "#fff07a",
    title: { en: "Grandi's series & Thomson's lamp", vi: "Chuỗi Grandi & đèn Thomson" },
    who: { en: "Guido Grandi, 1703 · James Thomson, 1954", vi: "Guido Grandi, 1703 · James Thomson, 1954" },
    story: {
      en: "1 − 1 + 1 − 1 + … equals (1−1)+(1−1)+… = 0, or 1+(−1+1)+(−1+1)+… = 1? And a lamp switched after 1 minute, then ½, then ¼… — at the 2-minute mark, is it on or off?",
      vi: "1 − 1 + 1 − 1 + … bằng (1−1)+(1−1)+… = 0, hay 1+(−1+1)+(−1+1)+… = 1? Và một chiếc đèn được bật/tắt sau 1 phút, rồi ½ phút, rồi ¼… — đến mốc 2 phút, đèn bật hay tắt?",
    },
    key: {
      en: "The partial sums jump 1, 0, 1, 0, … and never settle: the series diverges, so regrouping it is not allowed. Averaging the partial sums (Cesàro) gives ½. The lamp question has no answer either — 'the state at the end of infinitely many switches' simply isn't defined.",
      vi: "Các tổng riêng nhảy 1, 0, 1, 0, … và không bao giờ ổn định: chuỗi phân kỳ, nên không được nhóm lại tuỳ ý. Lấy trung bình các tổng riêng (Cesàro) được ½. Câu hỏi chiếc đèn cũng không có đáp án — 'trạng thái sau vô hạn lần bấm' đơn giản là không được định nghĩa.",
    },
    think: { en: "Why could Zeno's sum be added up but Grandi's can't?", vi: "Vì sao tổng của Zeno cộng được, còn tổng Grandi thì không?" },
  },
  {
    id: "twin",
    color: "#9be7ff",
    title: { en: "The twin paradox", vi: "Nghịch lý anh em sinh đôi" },
    who: { en: "Paul Langevin, 1911 · special relativity", vi: "Paul Langevin, 1911 · thuyết tương đối hẹp" },
    story: {
      en: "One twin flies to a star 4 light-years away at 80% of light speed and comes back. On Earth, 10 years pass. The traveller has aged only 6. But from the rocket, wasn't it Earth that moved?",
      vi: "Một người trong cặp sinh đôi bay tới ngôi sao cách 4 năm ánh sáng với 80% tốc độ ánh sáng rồi quay về. Trên Trái Đất trôi qua 10 năm. Người du hành chỉ già thêm 6 năm. Nhưng nhìn từ tên lửa, chẳng phải Trái Đất mới là bên chuyển động sao?",
    },
    key: {
      en: "The situation isn't symmetric: only the traveller turns around (accelerates), switching between frames. Moving clocks tick slower by γ = 1/√(1−v²/c²) = 5/3 here. GPS satellites correct for exactly this effect every day.",
      vi: "Hai người không đối xứng: chỉ người du hành quay đầu (có gia tốc), chuyển giữa các hệ quy chiếu. Đồng hồ chuyển động chạy chậm γ = 1/√(1−v²/c²) lần, ở đây là 5/3. Vệ tinh GPS phải hiệu chỉnh đúng hiệu ứng này mỗi ngày.",
    },
    think: { en: "What happens to γ as v gets close to the speed of light?", vi: "γ thế nào khi v tiến sát tốc độ ánh sáng?" },
  },
];
