/**
 * Story, lore and quests for Math World (pure data, bilingual EN/VI).
 * Premise: the Theorems that hold the world together have shattered into wild "Echoes". Mathematicians'
 * spirits (Echoes) guide the player; every quest is solved by understanding an idea, not by exercises.
 */
export type L = { en: string; vi: string };
export type NpcId = "suong" | "diep" | "euler" | "noether" | "turing" | "ada" | "librarian" | "concierge" | "plato" | "host" | "shipwright" | "demon" | "lan" | "zeno";

export const NPCS: Record<NpcId, { name: L; title: L; color: string; portrait: string }> = {
  suong: { name: { en: "Sương", vi: "Sương" }, title: { en: "Guide of the Plaza", vi: "Người dẫn đường của Quảng trường" }, color: "#7fe0d0", portrait: "npc_suong" },
  diep: { name: { en: "Diệp", vi: "Diệp" }, title: { en: "Keeper of the Archive", vi: "Người giữ Thư khố" }, color: "#7fb6ff", portrait: "npc_diep" },
  euler: { name: { en: "Echo of Euler", vi: "Hồi âm Euler" }, title: { en: "Spirit of Connections", vi: "Linh hồn của Sự liên kết" }, color: "#ffd27a", portrait: "npc_euler" },
  noether: { name: { en: "Echo of Noether", vi: "Hồi âm Noether" }, title: { en: "Spirit of Symmetry", vi: "Linh hồn của Đối xứng" }, color: "#ff9ecb", portrait: "npc_noether" },
  turing: { name: { en: "Echo of Turing", vi: "Hồi âm Turing" }, title: { en: "Spirit of Computation", vi: "Linh hồn của Tính toán" }, color: "#7fe3ff", portrait: "npc_turing" },
  plato: { name: { en: "Echo of the Cave", vi: "Hồi âm của Hang" }, title: { en: "Keeper of shadows", vi: "Người giữ những cái bóng" }, color: "#ffd9a0", portrait: "npc_plato" },
  zeno: { name: { en: "Echo of Zeno", vi: "Hồi âm Zeno" }, title: { en: "Keeper of the Paradox Void", vi: "Người giữ Hư Không Nghịch Lý" }, color: "#ffd27a", portrait: "npc_zeno" },
  lan: { name: { en: "Lan", vi: "Lan" }, title: { en: "The note-passer outside the room", vi: "Người gửi thư ngoài căn phòng" }, color: "#c79bff", portrait: "npc_lan" },
  demon: { name: { en: "Maxwell's Demon", vi: "Quỷ Maxwell" }, title: { en: "Doorkeeper of the molecules", vi: "Người gác cửa của các phân tử" }, color: "#b58bff", portrait: "npc_demon" },
  shipwright: { name: { en: "Moc", vi: "Mộc" }, title: { en: "Shipwright of the twin docks", vi: "Thợ đóng tàu ở hai ụ khô" }, color: "#e0b07a", portrait: "npc_shipwright" },
  host: { name: { en: "Lumi", vi: "Lumi" }, title: { en: "MC of the Three Doors", vi: "MC Ba Cánh Cửa" }, color: "#ff9ec0", portrait: "npc_host" },
  concierge: { name: { en: "Vô Cực", vi: "Vô Cực" }, title: { en: "Concierge of Hilbert's Grand Hotel", vi: "Lễ tân Khách sạn Hilbert" }, color: "#ff8a7a", portrait: "npc_concierge" },
  librarian: { name: { en: "Tịnh", vi: "Tịnh" }, title: { en: "Librarian of Babel", vi: "Thủ thư Babel" }, color: "#c8a6ff", portrait: "npc_librarian" },
  ada: { name: { en: "Echo of Ada", vi: "Hồi âm Ada" }, title: { en: "Spirit of the First Program", vi: "Linh hồn của Chương trình đầu tiên" }, color: "#ffb46b", portrait: "npc_ada" },
};

// ───────────── Thư khố (Codex): định lý + nhà toán học ─────────────

export type CodexId = "vector" | "taxicab" | "sierpinski" | "mobius" | "phase" | "parabola" | "golden" | "euler" | "noether" | "turing" | "zeno" | "knight" | "interference" | "fourier" | "faraday" | "penrose" | "babel" | "hilbert" | "plato" | "monty" | "theseus" | "maxwell" | "chineseroom" | "paradoxes";
export const CODEX: Record<CodexId, { title: L; who: L; body: L }> = {
  vector: {
    title: { en: "Vectors", vi: "Vectơ" },
    who: { en: "Hamilton & Grassmann, 1840s", vi: "Hamilton & Grassmann, thập niên 1840" },
    body: { en: "A vector is an arrow: a direction and a length. Adding vectors is walking one arrow, then the next. Your Vector Blade always cuts along the arrow you face.", vi: "Vectơ là một mũi tên: có hướng và độ dài. Cộng vectơ là đi hết mũi tên này rồi đến mũi tên kia. Kiếm Vectơ luôn chém theo mũi tên bạn đang hướng tới." },
  },
  taxicab: {
    title: { en: "Taxicab distance", vi: "Khoảng cách taxi" },
    who: { en: "Hermann Minkowski, ~1900", vi: "Hermann Minkowski, khoảng 1900" },
    body: { en: "In a city of square blocks you cannot walk diagonally: distance is |Δx| + |Δy|. A 'circle' in this world is a diamond. The Sierpiński Mite lives by this rule — so a diagonal is the safest place to stand.", vi: "Trong thành phố ô bàn cờ bạn không thể đi chéo: khoảng cách là |Δx| + |Δy|. 'Đường tròn' ở đây là hình thoi. Bọ Sierpiński sống theo luật này — nên đứng chéo là an toàn nhất." },
  },
  sierpinski: {
    title: { en: "Sierpiński triangle", vi: "Tam giác Sierpiński" },
    who: { en: "Wacław Sierpiński, 1915", vi: "Wacław Sierpiński, 1915" },
    body: { en: "Cut the middle out of a triangle, then out of each smaller triangle, forever. The area tends to zero, yet the edge length grows without bound — a shape with dimension log 3 / log 2 ≈ 1.585.", vi: "Khoét tam giác giữa, rồi khoét tiếp ở mỗi tam giác nhỏ, mãi mãi. Diện tích dần về 0, nhưng tổng chu vi tăng vô hạn — một hình có số chiều log 3 / log 2 ≈ 1,585." },
  },
  mobius: {
    title: { en: "The Möbius strip", vi: "Dải Möbius" },
    who: { en: "August Möbius & Johann Listing, 1858", vi: "August Möbius & Johann Listing, 1858" },
    body: { en: "Give a strip of paper half a twist and join the ends: it has only one side and one edge. An ant walking along it returns upside-down — which is why the Möbius Wisp is only 'here' half of the time.", vi: "Xoắn nửa vòng một dải giấy rồi dán hai đầu: nó chỉ có một mặt và một mép. Con kiến bò dọc theo nó sẽ quay về trong tư thế lộn ngược — vì vậy Hồn Möbius chỉ 'hiện diện' một nửa thời gian." },
  },
  phase: {
    title: { en: "Phase of a wave", vi: "Pha của sóng" },
    who: { en: "Joseph Fourier, 1807", vi: "Joseph Fourier, 1807" },
    body: { en: "sin(2πt/T) repeats every T seconds. Two waves in phase add up; out of phase they cancel. Timing an attack to a creature's period is resonance.", vi: "sin(2πt/T) lặp lại sau mỗi T giây. Hai sóng cùng pha cộng lại; ngược pha triệt tiêu nhau. Canh đòn đúng chu kỳ của sinh vật chính là cộng hưởng." },
  },
  parabola: {
    title: { en: "The parabola of falling things", vi: "Parabol của vật rơi" },
    who: { en: "Galileo Galilei, 1638", vi: "Galileo Galilei, 1638" },
    body: { en: "Throw anything and gravity bends its path into y = ax² + bx + c. Galileo showed the horizontal motion is steady while the vertical one accelerates — the bow and the meteor obey the same law.", vi: "Ném bất cứ vật gì, trọng lực uốn đường đi thành y = ax² + bx + c. Galileo chỉ ra: chuyển động ngang đều, chuyển động dọc nhanh dần — cung tên và thiên thạch tuân cùng một định luật." },
  },
  golden: {
    title: { en: "The golden ratio", vi: "Tỉ lệ vàng" },
    who: { en: "Euclid (~300 BC), Fibonacci (1202)", vi: "Euclid (~300 TCN), Fibonacci (1202)" },
    body: { en: "φ = (1 + √5)/2 ≈ 1.618. Sunflower seeds sit 137.5° apart — the golden angle — so they never line up and pack perfectly. Ratios of Fibonacci numbers approach φ.", vi: "φ = (1 + √5)/2 ≈ 1,618. Hạt hướng dương xếp lệch nhau 137,5° — góc vàng — nên không bao giờ thẳng hàng và xếp khít hoàn hảo. Tỉ số các số Fibonacci tiến tới φ." },
  },
  euler: {
    title: { en: "Euler's identity", vi: "Đẳng thức Euler" },
    who: { en: "Leonhard Euler, 1748", vi: "Leonhard Euler, 1748" },
    body: { en: "e^(iπ) + 1 = 0 links five fundamental numbers. Multiplying by e^(iθ) is a rotation: the imaginary unit i turns arrows by 90°. Euler also founded graph theory with the seven bridges of Königsberg.", vi: "e^(iπ) + 1 = 0 nối năm con số nền tảng. Nhân với e^(iθ) là một phép quay: đơn vị ảo i xoay mũi tên 90°. Euler cũng khai sinh lý thuyết đồ thị với bài toán bảy cây cầu Königsberg." },
  },
  noether: {
    title: { en: "Noether's theorem", vi: "Định lý Noether" },
    who: { en: "Emmy Noether, 1918", vi: "Emmy Noether, 1918" },
    body: { en: "Every continuous symmetry hides a conserved quantity: the laws don't change over time → energy is conserved; they don't change from place to place → momentum is conserved.", vi: "Mỗi đối xứng liên tục ẩn chứa một đại lượng bảo toàn: định luật không đổi theo thời gian → năng lượng bảo toàn; không đổi theo vị trí → động lượng bảo toàn." },
  },
  plato: {
    title: { en: "Plato's Cave", vi: "Hang của Platon" },
    who: { en: "Plato, Republic Book VII (~375 BC) · E. A. Abbott, Flatland (1884)", vi: "Platon, Cộng hoà quyển VII (~375 TCN) · E. A. Abbott, Flatland (1884)" },
    body: {
      en: "A shadow is a projection: it keeps the outline and throws away depth. A round shadow can come from a disc, a ball, a cylinder or a cone, so a shadow alone cannot tell you the object. A tesseract's shadow in our 3-D world is a cube inside a cube that seems to turn inside-out — and the shadow of THAT on a wall is what you saw. Science works like the freed prisoner: from many shadows (measurements) it reconstructs the thing that cast them.",
      vi: "Cái bóng là một phép chiếu: giữ đường viền, bỏ đi chiều sâu. Bóng tròn có thể đến từ cái đĩa, quả cầu, hình trụ hay hình nón, nên chỉ nhìn bóng thì không biết được vật. Bóng của siêu khối trong thế giới 3 chiều là hình lập phương lồng trong hình lập phương như đang lộn trong ra ngoài — và bóng của CÁI ĐÓ trên vách là thứ bạn vừa thấy. Khoa học làm như người tù được giải thoát: từ nhiều cái bóng (phép đo) mà dựng lại vật đã tạo ra chúng.",
    },
  },
  paradoxes: {
    title: { en: "The Paradox Void", vi: "Hư Không Nghịch Lý" },
    who: { en: "Zeno, Russell, Banach–Tarski, Simpson, Braess, Newcomb, Langevin…", vi: "Zeno, Russell, Banach–Tarski, Simpson, Braess, Newcomb, Langevin…" },
    body: {
      en: "A paradox is a signpost, not a dead end. Some show that intuition fails with infinity (Zeno, Grandi, Banach–Tarski), some that it fails with chance and data (birthdays, Simpson), some that our definitions were broken (Russell), some that 'everyone acting sensibly' can make everyone worse off (Braess, Newcomb), and some that nature herself is stranger than common sense (the twin paradox). Each one pushed mathematicians and scientists to build sharper tools: limits, axioms, measure theory, game theory, relativity.",
      vi: "Nghịch lý là biển chỉ đường, không phải ngõ cụt. Có nghịch lý cho thấy trực giác vấp ngã trước vô hạn (Zeno, Grandi, Banach–Tarski), có cái cho thấy nó vấp trước may rủi và dữ liệu (ngày sinh, Simpson), có cái lộ ra định nghĩa của ta bị hỏng (Russell), có cái cho thấy 'ai cũng làm điều hợp lý' lại khiến tất cả tệ đi (Braess, Newcomb), và có cái cho thấy chính tự nhiên kỳ lạ hơn lẽ thường (anh em sinh đôi). Mỗi nghịch lý đã thúc đẩy các nhà toán học và khoa học rèn ra công cụ sắc bén hơn: giới hạn, tiên đề, lý thuyết độ đo, lý thuyết trò chơi, thuyết tương đối.",
    },
  },
  chineseroom: {
    title: { en: "The Chinese Room", vi: "Căn phòng Trung Hoa" },
    who: { en: "John Searle, Minds, Brains, and Programs (1980) · Alan Turing (1950)", vi: "John Searle, Minds, Brains, and Programs (1980) · Alan Turing (1950)" },
    body: {
      en: "Someone who knows no Chinese sits in a closed room with a rule book: 'if you see these shapes, write those shapes'. Questions in Chinese come in through a slot; perfect answers go out. Outside, everyone is convinced the room understands Chinese. Searle's point: running a program is manipulating symbols by their shape (syntax), and syntax alone is not meaning (semantics). Critics answer that the whole system understands, or that understanding needs a body in the world, or that brains are rule-following machines too. Today's language models make the question practical: is producing the right words the same as understanding them?",
      vi: "Một người không biết tiếng Trung ngồi trong căn phòng kín với một cuốn sách quy tắc: 'thấy những hình này thì viết những hình kia'. Câu hỏi tiếng Trung đi vào qua khe; câu trả lời hoàn hảo đi ra. Bên ngoài, ai cũng tin căn phòng hiểu tiếng Trung. Ý của Searle: chạy một chương trình là xử lý ký hiệu theo hình dạng (cú pháp), và cú pháp tự nó không phải là nghĩa (ngữ nghĩa). Người phản biện đáp: cả hệ thống mới là thứ hiểu; hay sự hiểu cần một cơ thể sống trong thế giới; hay não người cũng là cỗ máy làm theo quy tắc. Các mô hình ngôn ngữ ngày nay biến câu hỏi thành thực tế: tạo ra đúng từ ngữ có phải là hiểu chúng không?",
    },
  },
  maxwell: {
    title: { en: "Maxwell's demon", vi: "Quỷ Maxwell" },
    who: { en: "J. C. Maxwell 1867 · L. Szilárd 1929 · R. Landauer 1961 · C. Bennett 1982", vi: "J. C. Maxwell 1867 · L. Szilárd 1929 · R. Landauer 1961 · C. Bennett 1982" },
    body: {
      en: "A tiny being guards a door between two boxes of gas: fast molecules may pass to the right, slow ones to the left. Without doing work, one side heats and the other cools — entropy seems to fall, breaking the second law. The rescue is information: to sort, the demon must measure each molecule and remember the result. Erasing one bit of memory releases at least kT ln 2 of heat (Landauer's principle, confirmed in 2012), so the entropy produced is never less than the entropy the gas loses. Information is physical.",
      vi: "Một sinh vật tí hon canh cửa giữa hai ngăn khí: phân tử nhanh được sang phải, phân tử chậm sang trái. Không tốn công, một bên nóng lên, một bên lạnh đi — entropy như giảm xuống, phá vỡ định luật 2. Lời giải là thông tin: để phân loại, quỷ phải đo từng phân tử và ghi nhớ kết quả. Xoá một bit trí nhớ toả ít nhất kT ln 2 nhiệt (nguyên lý Landauer, được đo thực nghiệm năm 2012), nên entropy sinh ra không bao giờ ít hơn lượng entropy khí đã mất. Thông tin là một đại lượng vật lý.",
    },
  },
  theseus: {
    title: { en: "The Ship of Theseus", vi: "Con tàu của Theseus" },
    who: { en: "Plutarch, Life of Theseus (~75 AD) · Thomas Hobbes, De Corpore (1655)", vi: "Plutarch, Đời Theseus (~75 SCN) · Thomas Hobbes, De Corpore (1655)" },
    body: {
      en: "Replace a ship's planks one by one and it seems to stay the same ship — no single plank changes that. Hobbes added the twist: reassemble the old planks into a second ship. Now two ships claim one name. Continuity says the repaired one; matter says the rebuilt one; four-dimensionalism says both shared a past and then split; nihilism says 'same ship' was only ever a label. The puzzle is a sorites in disguise: one small change never matters, yet many small changes do. It is also about you — your cells, your memories, your code.",
      vi: "Thay lần lượt từng tấm ván, con tàu dường như vẫn là con tàu cũ — không tấm ván nào làm thay đổi điều đó. Hobbes thêm một cú lật: ráp những tấm ván cũ thành con tàu thứ hai. Giờ hai con tàu tranh nhau một cái tên. Thuyết liên tục chọn chiếc được sửa; thuyết vật chất chọn chiếc ráp lại; thuyết bốn chiều nói cả hai chung một quá khứ rồi tách đôi; thuyết hư vô nói 'cùng một con tàu' vốn chỉ là cách gọi. Câu đố là nghịch lý 'đống cát' trá hình: một thay đổi nhỏ không bao giờ đáng kể, vậy mà rất nhiều thay đổi nhỏ thì có. Và nó nói về chính bạn — tế bào, ký ức, cả mã nguồn.",
    },
  },
  monty: {
    title: { en: "The Monty Hall problem", vi: "Bài toán Monty Hall" },
    who: { en: "Steve Selvin, 1975 · Marilyn vos Savant, 1990", vi: "Steve Selvin, 1975 · Marilyn vos Savant, 1990" },
    body: {
      en: "Three doors, one car, two goats. You pick a door; the host — who KNOWS where the car is — opens another door with a goat and offers a swap. Switching wins 2/3 of the time. Your first pick is right only 1 time in 3; the other 2 times the car is behind one of the other two doors, and the host has just removed the goat among them for you. With 100 doors and 98 goats opened it is obvious: your first pick had 1 %, the one door the host carefully avoided has 99 %. The trap is thinking 'two doors left, so 50–50' — probabilities depend on HOW the information was produced. In 1990 about 10 000 readers, many with PhDs, wrote to say vos Savant was wrong; computer simulations settled it.",
      vi: "Ba cánh cửa, một chiếc xe, hai con dê. Bạn chọn một cửa; MC — người BIẾT xe ở đâu — mở một cửa khác có dê rồi mời bạn đổi. Đổi thì thắng 2/3 số lần. Lần chọn đầu chỉ trúng 1 trong 3; 2 lần còn lại xe nằm ở một trong hai cửa kia, và MC vừa loại giúp bạn con dê trong số đó. Với 100 cửa, MC mở 98 cửa dê thì quá rõ: lần chọn đầu chỉ có 1 %, cánh cửa duy nhất MC cố tình chừa lại có 99 %. Cái bẫy là nghĩ 'còn hai cửa nên 50–50' — xác suất phụ thuộc vào CÁCH thông tin được tạo ra. Năm 1990 khoảng 10 000 độc giả, nhiều người có bằng tiến sĩ, viết thư bảo vos Savant sai; mô phỏng máy tính đã phân xử.",
    },
  },
  hilbert: {
    title: { en: "Hilbert's Grand Hotel", vi: "Khách sạn Hilbert" },
    who: { en: "David Hilbert, 1924 · Georg Cantor, 1874", vi: "David Hilbert, 1924 · Georg Cantor, 1874" },
    body: {
      en: "A hotel with infinitely many rooms, all full, can still take a new guest: everyone moves from room n to n + 1 and room 1 is free. An infinite bus? Everyone moves to 2n; the odd rooms are free. Infinitely many buses? Old guest n → 2^n, seat s of bus k → (k-th odd prime)^s — unique factorisation means nobody shares a room. 'Infinite + 1 = infinite': the rooms, the even numbers and the fractions are all the SAME size of infinity (countable). Cantor proved the real numbers are a strictly bigger one — no hotel can hold them.",
      vi: "Một khách sạn có vô hạn phòng, đã kín chỗ, vẫn nhận thêm được một khách: mọi người chuyển từ phòng n sang n + 1, phòng 1 trống. Một xe buýt vô hạn khách? Mọi người chuyển sang phòng 2n, các phòng lẻ trống. Vô hạn xe buýt? Khách cũ n → 2^n, ghế s của xe k → (số nguyên tố lẻ thứ k)^s — mỗi số chỉ phân tích được một cách nên không ai trùng phòng. 'Vô hạn + 1 = vô hạn': số phòng, số chẵn, số hữu tỉ đều là CÙNG một cỡ vô hạn (đếm được). Cantor chứng minh tập số thực là một cỡ vô hạn lớn hơn hẳn — không khách sạn nào chứa nổi.",
    },
  },
  babel: {
    title: { en: "The Library of Babel", vi: "Thư viện Babel" },
    who: { en: "Jorge Luis Borges, 1941 · combinatorics", vi: "Jorge Luis Borges, 1941 · tổ hợp" },
    body: {
      en: "Take 25 symbols, pages of 40 lines × 80 characters, books of 410 pages. Writing every possible book gives 25^1 312 000 ≈ 10^1 834 097 volumes — finite, yet a number with 1 834 098 digits (the observable universe holds only ~10^80 atoms). Every true sentence is in there, and every false one, and your biography with one letter wrong. Here each page sits at exactly one address: address = (page × K + C) mod 25^3200, a bijection — so you never search, you COMPUTE. A library that contains everything tells you nothing: information is in the choosing, not in the having.",
      vi: "Lấy 25 ký hiệu, trang 40 dòng × 80 ký tự, sách 410 trang. Viết ra mọi cuốn sách có thể sẽ được 25^1 312 000 ≈ 10^1 834 097 cuốn — hữu hạn, nhưng là một số có 1 834 098 chữ số (cả vũ trụ quan sát được chỉ có khoảng 10^80 nguyên tử). Mọi câu đúng đều ở trong đó, mọi câu sai cũng vậy, và cả tiểu sử của bạn sai đúng một chữ. Ở đây mỗi trang nằm ở đúng một địa chỉ: địa chỉ = (trang × K + C) mod 25^3200, một song ánh — nên bạn không cần dò tìm, chỉ cần TÍNH. Một thư viện chứa tất cả thì chẳng cho bạn biết điều gì: thông tin nằm ở sự lựa chọn, không phải ở việc có sẵn.",
    },
  },
  penrose: {
    title: { en: "Field note · The impossible triangle", vi: "Ghi chép · Tam giác không thể" },
    who: { en: "Oscar Reutersvärd 1934 · Lionel & Roger Penrose 1958", vi: "Oscar Reutersvärd 1934 · Lionel & Roger Penrose 1958" },
    body: {
      en: "Three straight bars, three right angles — yet they close into a triangle, whose angles must sum to 180°, not 270°. The trick: the bars do NOT touch. From one single viewpoint, the far end of the last bar lines up exactly behind the first one, so their 2-D projections meet. A picture is a projection; different 3-D shapes can cast the same 2-D shadow, so a drawing alone can't prove what is real.",
      vi: "Ba thanh thẳng, ba góc vuông — vậy mà khép thành tam giác, trong khi tổng ba góc tam giác phải là 180° chứ không phải 270°. Bí mật: các thanh KHÔNG chạm nhau. Chỉ từ đúng một điểm nhìn, đầu thanh cuối nằm thẳng hàng sau thanh đầu tiên nên hình chiếu 2 chiều của chúng gặp nhau. Bức tranh là một phép chiếu; nhiều hình 3 chiều khác nhau có thể đổ cùng một bóng 2 chiều, nên chỉ nhìn hình vẽ thì không chứng minh được điều gì là thật.",
    },
  },
  faraday: {
    title: { en: "Field note · The Faraday cage", vi: "Ghi chép · Lồng Faraday" },
    who: { en: "Michael Faraday, 1836", vi: "Michael Faraday, 1836" },
    body: { en: "Charges on a conductor spread over its OUTSIDE surface, so the electric field inside a closed conducting shell is zero. Build a cage of gold blocks around you and lightning flows around it — that's why you're safe in a car or a plane in a storm. Lightning itself takes the easiest path: the highest point nearby.", vi: "Điện tích trên vật dẫn phân bố ở MẶT NGOÀI, nên điện trường bên trong một vỏ dẫn kín bằng 0. Xây lồng khối vàng quanh mình, sét sẽ chạy vòng bên ngoài — vì thế ngồi trong ô tô hay máy bay giữa giông bão vẫn an toàn. Còn tia sét luôn đi đường dễ nhất: điểm cao nhất gần đó." },
  },
  fourier: {
    title: { en: "Fourier series", vi: "Chuỗi Fourier" },
    who: { en: "Joseph Fourier, 1807–1822", vi: "Joseph Fourier, 1807–1822" },
    body: { en: "Any periodic signal is a sum of sines: f(t) = a₀ + Σ (aₙ cos nωt + bₙ sin nωt). The Siren's dress is seven harmonics stacked; her standing waves have nodes every λ/2; her beats come from two close frequencies. You restored the theorem by listening to its structure.", vi: "Mọi tín hiệu tuần hoàn là tổng các hình sin: f(t) = a₀ + Σ (aₙ cos nωt + bₙ sin nωt). Váy Nàng Tiên Cá là bảy hoạ âm xếp chồng; sóng dừng của nàng có nút mỗi λ/2; nhịp phách sinh ra từ hai tần số gần nhau. Bạn khôi phục định lý bằng cách lắng nghe cấu trúc của nó." },
  },
  zeno: {
    title: { en: "Field note · Zeno's series", vi: "Ghi chép · Chuỗi của Zeno" },
    who: { en: "Zeno of Elea, ~450 BC", vi: "Zeno xứ Elea, ~450 TCN" },
    body: { en: "1/2 + 1/4 + 1/8 + … never passes 1. The Zeno Tortoise halves every hit in a chain, so rapid hits can never finish it — pause 1.2 s to restart the series, and make each first hit count.", vi: "1/2 + 1/4 + 1/8 + … không bao giờ vượt quá 1. Rùa Zeno chia đôi mỗi đòn trong chuỗi nên đánh dồn không bao giờ hạ được — nghỉ 1,2 s để chuỗi bắt đầu lại, và làm đòn đầu thật mạnh." },
  },
  knight: {
    title: { en: "Field note · The knight's metric", vi: "Ghi chép · Khoảng cách của quân mã" },
    who: { en: "Chess, and Euler's knight's tour (1759)", vi: "Cờ vua, và hành trình quân mã của Euler (1759)" },
    body: { en: "A knight reaches 8 squares, none of them next to it. The Knight Imp strikes only those squares — so the safest place is right beside it.", vi: "Quân mã với tới 8 ô, không ô nào sát bên nó. Quỷ Mã Cờ chỉ đánh vào các ô đó — nên chỗ an toàn nhất lại là ngay cạnh nó." },
  },
  interference: {
    title: { en: "Field note · Superposition", vi: "Ghi chép · Chồng chập" },
    who: { en: "Thomas Young, double slit (1801)", vi: "Thomas Young, thí nghiệm hai khe (1801)" },
    body: { en: "Two waves add up. Where the path difference is a whole wavelength they reinforce (bright fringes); half a wavelength, they cancel (dark fringes, shaped like hyperbolas). The Twins only break when struck together — in phase.", vi: "Hai sóng cộng vào nhau. Nơi hiệu đường đi bằng số nguyên bước sóng thì tăng cường (vân sáng); bằng nửa bước sóng thì triệt tiêu (vân tối, có dạng hyperbol). Song Sinh chỉ vỡ khi bị đánh cùng lúc — cùng pha." },
  },
  turing: {
    title: { en: "Turing machines", vi: "Máy Turing" },
    who: { en: "Alan Turing, 1936", vi: "Alan Turing, 1936" },
    body: { en: "A tape, a head and a table of rules can compute anything computable. And some questions — like whether a program will ever stop — no machine can always answer.", vi: "Một cuộn băng, một đầu đọc và một bảng luật có thể tính mọi thứ tính được. Và có những câu hỏi — như một chương trình có bao giờ dừng không — không cỗ máy nào luôn trả lời được." },
  },
};

// ───────────── Hội thoại ─────────────

export type Line = { who: NpcId | "you"; text: L };
export const DIALOGUES: Record<string, Line[]> = {
  paradox_intro: [
    { who: "zeno", text: { en: "Welcome to the Paradox Void. I am an echo of Zeno — I once 'proved' that motion is impossible. Ten islands drift here; ten ways common sense breaks.", vi: "Chào mừng đến Hư Không Nghịch Lý. Ta là hồi âm của Zeno — kẻ từng 'chứng minh' rằng chuyển động là không thể. Mười hòn đảo trôi ở đây; mười cách lẽ thường gãy đổ." } },
    { who: "zeno", text: { en: "Look up, too. A horn you could fill with paint but never paint. A bottle with no inside. A staircase that climbs forever. And a triangle that cannot exist — stand on the Penrose Eye and see it close.", vi: "Hãy ngước lên nữa. Một chiếc kèn đổ đầy sơn được mà không sơn kín được. Một cái chai không có mặt trong. Một cầu thang leo mãi không tới đỉnh. Và một tam giác không thể tồn tại — đứng lên Mắt Penrose mà xem nó khép lại." } },
    { who: "zeno", text: { en: "Don't just read the answers. Play with each one until it stops feeling impossible — then ask why it ever did.", vi: "Đừng chỉ đọc lời giải. Hãy nghịch từng cái cho đến khi nó thôi có vẻ bất khả — rồi tự hỏi vì sao lúc đầu nó lại có vẻ như vậy." } },
  ],
  croom_intro: [
    { who: "lan", text: { en: "你好！Oh — sorry. I'm Lan. Every evening I slip questions in Chinese through that little slot, and the answers come back perfect.", vi: "你好！À — xin lỗi. Mình là Lan. Tối nào mình cũng nhét câu hỏi tiếng Trung qua khe nhỏ kia, và câu trả lời trả ra đều hoàn hảo." } },
    { who: "lan", text: { en: "Whoever lives inside must be fluent. Tonight, would you take their seat? There's a big rule book on the desk. You'll be fine.", vi: "Người ở trong chắc hẳn thạo tiếng Trung lắm. Tối nay bạn ngồi thay chỗ người đó nhé? Trên bàn có một cuốn sách quy tắc to lắm. Bạn sẽ ổn thôi." } },
  ],
  maxwell_intro: [
    { who: "demon", text: { en: "Ah, a visitor! Allow me: Maxwell's Demon, doorkeeper extraordinaire. Behind this glass: one box, one gas, all the same temperature. Dull, isn't it?", vi: "À, có khách! Cho phép ta tự giới thiệu: Quỷ Maxwell, người gác cửa tài ba. Sau tấm kính này: một hộp, một khí, nhiệt độ đều như nhau. Chán nhỉ?" } },
    { who: "demon", text: { en: "Watch: I open my little door only for the FAST ones going right, and the SLOW ones going left. No pushing, no work — and yet one side gets hot!", vi: "Xem này: ta chỉ mở cửa nhỏ cho phân tử NHANH đi sang phải và phân tử CHẬM đi sang trái. Không đẩy, không tốn công — vậy mà một bên nóng lên!" } },
    { who: "demon", text: { en: "Physicists say entropy never goes down. Have I beaten the Second Law? Try my job yourself… and keep an eye on my memory.", vi: "Các nhà vật lý bảo entropy không bao giờ giảm. Ta đã thắng Định luật 2 rồi chăng? Hãy thử làm việc của ta… và để ý trí nhớ của ta nhé." } },
  ],
  theseus_intro: [
    { who: "shipwright", text: { en: "This is the ship Theseus sailed home from Crete. The Athenians keep it as a memorial — and my family has kept it from rotting for generations.", vi: "Đây là con tàu Theseus đã lái từ đảo Crete trở về. Người Athens giữ nó làm kỷ vật — còn nhà mình thì giữ cho nó khỏi mục, đời này qua đời khác." } },
    { who: "shipwright", text: { en: "Every time a plank goes soft, I put in a fresh one. The old planks? I can't bear to burn them. I stack them on the other dock… in the same places.", vi: "Tấm ván nào mục, mình thay tấm mới. Còn ván cũ ư? Mình không nỡ đốt. Mình xếp chúng sang ụ bên kia… đúng vào chỗ cũ." } },
    { who: "shipwright", text: { en: "Help me with the work. And tell me, when we're done: which one is Theseus's ship?", vi: "Phụ mình một tay nhé. Và khi xong việc, hãy nói mình nghe: chiếc nào mới là tàu của Theseus?" } },
  ],
  monty_intro: [
    { who: "host", text: { en: "Welcome, welcome to the Three Doors! Behind one door: a brand-new car. Behind the other two: a goat each. Very friendly goats.", vi: "Xin chào, chào mừng đến với Ba Cánh Cửa! Sau một cửa là chiếc xe mới cứng. Sau hai cửa kia, mỗi cửa một con dê. Dê rất thân thiện nhé." } },
    { who: "host", text: { en: "You choose a door. Then I — and I always know where the car is — will open another door with a goat, and give you one chance to switch.", vi: "Bạn chọn một cửa. Rồi tôi — và tôi luôn biết xe ở đâu — sẽ mở một cửa khác có dê, và cho bạn đúng một cơ hội để đổi." } },
    { who: "host", text: { en: "Two doors left, so it's fifty-fifty… or is it? Play a few rounds, watch the scoreboard, then decide what you believe.", vi: "Còn hai cửa thì năm mươi – năm mươi… phải không nhỉ? Chơi vài ván, nhìn bảng điểm, rồi hãy quyết định mình tin điều gì." } },
  ],
  cave_intro: [
    { who: "plato", text: { en: "Shh — the prisoners are watching the wall. Since birth they have seen nothing but shadows, and they think the shadows are the whole world.", vi: "Suỵt — các tù nhân đang nhìn vách đá. Từ lúc sinh ra họ chỉ thấy những cái bóng, và họ nghĩ bóng chính là cả thế giới." } },
    { who: "plato", text: { en: "Behind them a fire burns, and someone carries things along a low wall. Sit with them for a while. Tell me what you think you see.", vi: "Phía sau họ có ngọn lửa, và có người khiêng đồ vật dọc một bức tường thấp. Ngồi xuống với họ một lúc. Rồi nói tôi nghe bạn nghĩ mình thấy gì." } },
  ],
  hilbert_intro: [
    { who: "concierge", text: { en: "Welcome to Hilbert's Grand Hotel! Infinitely many rooms — and I'm afraid every single one is taken tonight.", vi: "Chào mừng đến Khách sạn Hilbert! Vô hạn phòng — và tiếc là tối nay phòng nào cũng có khách rồi." } },
    { who: "concierge", text: { en: "But don't worry. In an infinite hotel, 'full' doesn't mean 'no room'. Watch the little lights above the doors — one guest per room.", vi: "Nhưng đừng lo. Ở khách sạn vô hạn, 'kín chỗ' không có nghĩa là 'hết phòng'. Nhìn những đốm sáng trên cửa — mỗi phòng một khách." } },
    { who: "concierge", text: { en: "Pick a trick at my desk. And walk the corridor: the room numbers never stop growing.", vi: "Chọn một phép màu ở quầy của tôi. Rồi đi dọc hành lang mà xem: số phòng cứ tăng mãi không bao giờ hết." } },
  ],
  babel_intro: [
    { who: "librarian", text: { en: "A visitor! Few come down from the booth. I am Tịnh — I keep the lamps on this floor, and on every floor exactly like it.", vi: "Có khách! Hiếm ai xuống đây từ cái bốt ấy. Tôi là Tịnh — tôi giữ đèn ở tầng này, và ở mọi tầng giống hệt nó." } },
    { who: "librarian", text: { en: "Look around: a hexagon. Four walls of shelves, five shelves per wall, thirty-two books per shelf. Two open walls lead to the next hexagon, and the next, and the next.", vi: "Nhìn quanh xem: một phòng lục giác. Bốn bức tường sách, mỗi tường năm kệ, mỗi kệ ba mươi hai cuốn. Hai bức tường trống dẫn sang phòng lục giác kế bên, rồi kế bên nữa, mãi mãi." } },
    { who: "librarian", text: { en: "Lean over the railing — gently. The shaft goes down and up further than anyone has walked. The spiral stair in the hallway connects the floors.", vi: "Ghé qua lan can mà nhìn — nhẹ thôi. Giếng ấy đi xuống và đi lên xa hơn bất kỳ ai từng đi. Cầu thang xoắn ngoài hành lang nối các tầng với nhau." } },
    { who: "librarian", text: { en: "Every book has 410 pages of 40 lines, 80 characters each, written with only 25 symbols: 22 letters, the space, the comma and the full stop. Funny — that's exactly the Vietnamese alphabet without its accents.", vi: "Mỗi cuốn có 410 trang, mỗi trang 40 dòng, mỗi dòng 80 ký tự, viết bằng đúng 25 ký hiệu: 22 chữ cái, dấu cách, dấu phẩy và dấu chấm. Buồn cười là — đó đúng là bảng chữ cái tiếng Việt khi bỏ dấu." } },
    { who: "librarian", text: { en: "And no two books are alike. So the Library holds EVERY possible book: 25 to the power 1 312 000 of them. Write that number out and it has one million eight hundred thousand digits.", vi: "Và không có hai cuốn nào giống nhau. Vậy Thư viện chứa MỌI cuốn sách có thể có: 25 mũ 1 312 000 cuốn. Viết con số đó ra sẽ có hơn một triệu tám trăm nghìn chữ số." } },
    { who: "librarian", text: { en: "Pull any book from a shelf and read. Almost all are noise… but somewhere is the book of your life, and a billion copies with one letter wrong.", vi: "Rút bất kỳ cuốn nào trên kệ mà đọc. Gần như tất cả là tiếng ồn vô nghĩa… nhưng đâu đó có cuốn kể đúng cuộc đời bạn, và một tỉ bản sai đúng một chữ." } },
    { who: "librarian", text: { en: "You don't have to wander to find it. The shelves follow a rule you can compute. Open the Catalogue, type any sentence, and I'll tell you its address.", vi: "Bạn không cần lang thang tìm nó. Các kệ sách tuân theo một quy luật tính được. Mở Mục lục, gõ một câu bất kỳ, tôi sẽ chỉ cho bạn địa chỉ của nó." } },
  ],
  babel_more: [
    { who: "librarian", text: { en: "A thought to carry with you: a library that contains everything tells you nothing. The meaning is in the choosing — which page, out of all of them.", vi: "Một ý nghĩ để mang theo: một thư viện chứa tất cả thì chẳng nói với bạn điều gì. Ý nghĩa nằm ở việc CHỌN — trang nào, giữa tất cả các trang." } },
    { who: "librarian", text: { en: "Is it infinite? The number of books is finite — huge, but finite. Yet the rooms never end. Perhaps if you walk far enough the same books come back in the same order: an infinity that is really a loop.", vi: "Nó có vô hạn không? Số cuốn sách là hữu hạn — khổng lồ, nhưng hữu hạn. Vậy mà các căn phòng không bao giờ hết. Có lẽ nếu đi đủ xa, những cuốn sách y hệt sẽ quay lại theo đúng thứ tự: một sự vô tận thực ra là một vòng lặp." } },
    { who: "librarian", text: { en: "On my desk are a few books from outside — Truyện Kiều, Euclid, Flatland. Ask the Catalogue where their pages live here. They were always on these shelves.", vi: "Trên bàn tôi có vài cuốn từ bên ngoài — Truyện Kiều, Euclid, Flatland. Hãy hỏi Mục lục xem trang của chúng nằm ở đâu trong này. Chúng vẫn luôn ở trên những kệ sách này." } },
  ],
  intro: [
    { who: "suong", text: { en: "You're awake! Welcome to the Plaza of Origins — the last calm place since the Theorems shattered.", vi: "Bạn tỉnh rồi! Chào mừng đến Quảng trường Khởi nguyên — nơi yên bình cuối cùng kể từ khi các Định lý vỡ tan." } },
    { who: "suong", text: { en: "Each Theorem held a law of the world. Their fragments became creatures — strange ones that obey only their own rule.", vi: "Mỗi Định lý giữ một quy luật của thế giới. Mảnh vỡ của chúng hoá thành sinh vật — kỳ lạ, chỉ tuân theo quy luật riêng." } },
    { who: "suong", text: { en: "You can't beat them by force alone. Watch them, find the rule, then use it. Try on the creatures at the edge of the plaza!", vi: "Chỉ dùng sức thì không thắng được. Hãy quan sát, tìm ra quy luật, rồi lợi dụng nó. Thử với mấy sinh vật ở rìa quảng trường xem!" } },
  ],
  mite: [
    { who: "suong", text: { en: "That beetle hops only along the grid — left, right, forward, back. Never diagonally.", vi: "Con bọ đó chỉ nhảy theo ô lưới — trái, phải, tiến, lùi. Không bao giờ đi chéo." } },
    { who: "suong", text: { en: "Its shell blocks hits from the front, and it only strikes along its row and column… where would YOU stand?", vi: "Mai của nó đỡ đòn phía trước, và nó chỉ đánh dọc hàng và cột… vậy bạn nên đứng ở đâu?" } },
  ],
  wisp: [
    { who: "diep", text: { en: "The Möbius Wisp is a one-sided thing. Half of every cycle it isn't really here.", vi: "Hồn Möbius là thứ chỉ có một mặt. Nửa mỗi chu kỳ nó không thực sự ở đây." } },
    { who: "diep", text: { en: "When its halo blazes, strike. When it fades, wait. Count the beat — three seconds per cycle.", vi: "Khi vầng sáng bừng lên thì đánh. Khi nó mờ đi thì chờ. Đếm nhịp — ba giây một chu kỳ." } },
  ],
  sigil: [
    { who: "diep", text: { en: "Magic here is written, not shouted. Press T and draw a curve — the curve IS the spell.", vi: "Phép thuật ở đây được viết ra, không phải hô lên. Bấm T và vẽ một đường cong — chính đường cong là câu thần chú." } },
    { who: "diep", text: { en: "A circle wards you. A parabola calls a falling star. The more exact your curve, the stronger the spell.", vi: "Đường tròn che chắn bạn. Parabol gọi một ngôi sao rơi. Đường cong càng chuẩn, phép càng mạnh." } },
  ],
  euler: [
    { who: "euler", text: { en: "Ah — a visitor who draws parabolas. Delightful. I am what remains of a man who loved connections.", vi: "À — một vị khách biết vẽ parabol. Thật thú vị. Ta là phần còn lại của một người yêu những mối liên kết." } },
    { who: "euler", text: { en: "e, i, π, 1 and 0 — five strangers, one equation. Everything in this world is connected like that, if you look long enough.", vi: "e, i, π, 1 và 0 — năm kẻ xa lạ, một phương trình. Mọi thứ ở thế giới này đều liên kết như vậy, nếu bạn nhìn đủ lâu." } },
    { who: "euler", text: { en: "The Expanse beyond the left gate grows from functions and noise. Go — gather what the fragments leave behind.", vi: "Vùng Kỳ quan sau cổng trái mọc lên từ hàm số và nhiễu. Đi đi — thu nhặt những gì các mảnh vỡ để lại." } },
  ],
  finale1: [
    { who: "noether", text: { en: "You've been gathering pieces of broken laws. Did you notice? Every one of them keeps something unchanged.", vi: "Bạn đã gom nhặt mảnh vỡ của các quy luật. Bạn có để ý không? Mỗi quy luật đều giữ một điều gì đó không đổi." } },
    { who: "noether", text: { en: "Symmetry and conservation are two faces of one coin. Remember that when the Siren sings — it will come for all of you together.", vi: "Đối xứng và bảo toàn là hai mặt của một đồng xu. Hãy nhớ điều đó khi Nàng Tiên Cá Fourier cất tiếng hát — nó sẽ đến tìm tất cả các bạn cùng lúc." } },
  ],
};

// ───────────── Nhiệm vụ chương 1 ─────────────

export type Objective =
  | { type: "talk"; npc: NpcId; dialogue: string }
  | { type: "kill"; kind: "any" | "slime" | "wisp" | "mite" | "siren"; n: number }
  | { type: "cast"; minMult: number; n: number }
  | { type: "enter"; scene: string }
  | { type: "collect"; n: number };

export interface Quest {
  id: string;
  title: L;
  goal: L;
  obj: Objective;
  /** Hội thoại mở đầu khi nhận nhiệm vụ */
  intro?: string;
  reward: { mats?: [string, number][]; codex?: CodexId[] };
}

export const CHAPTER2: { title: L; quests: Quest[] } = {
  title: { en: "Chapter II · The Siren Sings", vi: "Chương II · Nàng Tiên Cá cất tiếng hát" },
  quests: [
    { id: "q10", title: { en: "Song from the Labyrinth", vi: "Tiếng hát từ Mê cung" }, goal: { en: "Enter the Labyrinth of Harmonics (south gate)", vi: "Vào Mê cung Hoạ âm (cổng phía nam)" }, obj: { type: "enter", scene: "siren" }, reward: { codex: ["phase"] } },
    { id: "q11", title: { en: "Restore Fourier's Theorem", vi: "Khôi phục Định lý Fourier" }, goal: { en: "Defeat the Fourier Siren — alone or with friends", vi: "Hạ Nàng Tiên Cá Fourier — một mình hoặc cùng bạn bè" }, obj: { type: "kill", kind: "siren", n: 1 }, reward: { mats: [["golden", 2]], codex: ["fourier"] } },
  ],
};

export const CHAPTER1: { title: L; quests: Quest[] } = {
  title: { en: "Chapter I · The Shattered Theorems", vi: "Chương I · Những Định lý vỡ tan" },
  quests: [
    { id: "q1", title: { en: "Waking in the Plaza", vi: "Tỉnh giấc ở Quảng trường" }, goal: { en: "Talk to Sương", vi: "Nói chuyện với Sương" }, obj: { type: "talk", npc: "suong", dialogue: "intro" }, reward: { codex: ["vector"] } },
    { id: "q2", title: { en: "Fragments at the Edge", vi: "Mảnh vỡ nơi rìa sảnh" }, goal: { en: "Defeat 3 creatures", vi: "Hạ 3 sinh vật" }, obj: { type: "kill", kind: "any", n: 3 }, reward: { mats: [["pi", 3]] } },
    { id: "q3", title: { en: "The Beetle That Can't Turn", vi: "Con bọ không biết đi chéo" }, goal: { en: "Defeat a Sierpiński Mite", vi: "Hạ một Bọ Sierpiński" }, intro: "mite", obj: { type: "kill", kind: "mite", n: 1 }, reward: { mats: [["fractal", 2]], codex: ["taxicab", "sierpinski"] } },
    { id: "q4", title: { en: "Out of Phase", vi: "Lệch pha" }, goal: { en: "Defeat a Möbius Wisp", vi: "Hạ một Hồn Möbius" }, intro: "wisp", obj: { type: "kill", kind: "wisp", n: 1 }, reward: { mats: [["mobius", 2]], codex: ["mobius", "phase"] } },
    { id: "q5", title: { en: "Write the Curve", vi: "Viết đường cong" }, goal: { en: "Cast a drawn spell with Good precision or better", vi: "Niệm phép vẽ đạt độ chính xác Good trở lên" }, intro: "sigil", obj: { type: "cast", minMult: 1.2, n: 1 }, reward: { mats: [["prime", 2]], codex: ["parabola"] } },
    { id: "q6", title: { en: "An Echo in the Archive", vi: "Hồi âm trong Thư khố" }, goal: { en: "Talk to Diệp by the museum", vi: "Gặp Diệp cạnh bảo tàng" }, obj: { type: "talk", npc: "diep", dialogue: "euler" }, reward: { codex: ["euler"] } },
    { id: "q7", title: { en: "Into the Expanse", vi: "Tiến vào Vùng Kỳ quan" }, goal: { en: "Enter the Wonder Expanse", vi: "Bước vào Vùng Kỳ quan" }, obj: { type: "enter", scene: "expanse" }, reward: { codex: ["golden"] } },
    { id: "q8", title: { en: "What the Fragments Leave", vi: "Những gì mảnh vỡ để lại" }, goal: { en: "Collect 8 materials", vi: "Thu thập 8 nguyên liệu" }, obj: { type: "collect", n: 8 }, reward: { mats: [["golden", 1]] } },
    { id: "q9", title: { en: "Symmetry Speaks", vi: "Đối xứng lên tiếng" }, goal: { en: "Talk to Sương in the Plaza", vi: "Gặp lại Sương ở Quảng trường" }, obj: { type: "talk", npc: "suong", dialogue: "finale1" }, reward: { codex: ["noether", "turing"] } },
  ],
};

/** Toàn bộ nhiệm vụ theo thứ tự + chương của nhiệm vụ thứ i */
export function allQuests(): Quest[] {
  return [...CHAPTER1.quests, ...CHAPTER2.quests];
}
export function chapterOf(i: number): { title: L } {
  return i < CHAPTER1.quests.length ? CHAPTER1 : CHAPTER2;
}
