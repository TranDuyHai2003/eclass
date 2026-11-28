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

export type CodexId = "vector" | "taxicab" | "sierpinski" | "mobius" | "phase" | "parabola" | "golden" | "euler" | "noether" | "turing" | "zeno" | "knight" | "interference" | "fourier" | "faraday" | "penrose" | "babel" | "hilbert" | "plato" | "monty" | "theseus" | "maxwell" | "chineseroom" | "paradoxes" | "greedy" | "prime" | "galton" | "torus" | "torusbow" | "tide" | "resonance" | "snell" | "birthday" | "bayes" | "clt" | "gambler" | "colorlight" | "colorsub" | "colorspace" | "colorwheel" | "colorperception" | "colorcie" | "standingwave";
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
  greedy: {
    title: { en: "Field note · Greedy search and local minima", vi: "Ghi chép · Thuật toán tham lam và cực tiểu địa phương" },
    who: { en: "Greedy best-first search (Doran & Michie, 1966); A* (Hart, Nilsson & Raphael, 1968)", vi: "Tìm kiếm tham lam ưu tiên tốt nhất (Doran & Michie, 1966); A* (Hart, Nilsson & Raphael, 1968)" },
    body: {
      en: "A greedy algorithm always takes the step that looks best right now — for the Greedy Ghoul, the neighbouring square that is closest to you in a straight line. It never steps back to go around. Stand behind the back wall of a U-shaped fence and every square around it is farther from you than where it stands: a LOCAL MINIMUM. A path still exists, but greed can't see it. Smarter searches like A* remember the whole map and plan the detour.",
      vi: "Thuật toán tham lam luôn chọn bước trông tốt nhất ngay lúc này — với Ma Tham Lam, đó là ô kề gần bạn nhất theo đường thẳng. Nó không bao giờ lùi một bước để đi vòng. Đứng sau lưng một bức rào chữ U, mọi ô quanh nó đều xa bạn hơn chỗ nó đang đứng: một CỰC TIỂU ĐỊA PHƯƠNG. Đường đi vẫn có, nhưng lòng tham không nhìn thấy. Các thuật toán khôn hơn như A* nhớ cả bản đồ và lên kế hoạch đi vòng.",
    },
  },
  prime: {
    title: { en: "Field note · Prime numbers and factorisation", vi: "Ghi chép · Số nguyên tố và phân tích thừa số" },
    who: { en: "Euclid, Elements Book VII–IX (~300 BC)", vi: "Euclid, Cơ sở quyển VII–IX (~300 TCN)" },
    body: {
      en: "Every whole number above 1 is a product of primes in exactly one way: 12 = 2·2·3, 30 = 2·3·5 (the Fundamental Theorem of Arithmetic). The Prime Warden's shield n is divided by any burst of c hits when c divides n. A composite shield can be broken in small bites; tiles line up in an a×b rectangle. A prime p only lines up in one row — it is divisible by 1 and itself alone, so only one unbroken burst of exactly p hits can break it.",
      vi: "Mọi số nguyên lớn hơn 1 đều là tích các số nguyên tố theo đúng một cách: 12 = 2·2·3, 30 = 2·3·5 (Định lý cơ bản của số học). Khiên n của Hộ Vệ Nguyên Tố bị chia bởi mỗi loạt c đòn khi c là ước của n. Khiên hợp số phá được từng miếng nhỏ; gạch của nó xếp thành hình chữ nhật a×b. Số nguyên tố p chỉ xếp được một hàng — nó chỉ chia hết cho 1 và chính nó, nên chỉ một loạt liền đúng p đòn mới phá nổi.",
    },
  },
  torus: {
    title: { en: "Field note · The flat torus: a square with glued edges", vi: "Ghi chép · Xuyến phẳng: ô vuông dán mép" },
    who: { en: "Poincaré (1895); Jeff Weeks, The Shape of Space (1985); the screen of Asteroids (1979)", vi: "Poincaré (1895); Jeff Weeks, Hình dạng của không gian (1985); màn hình trò Asteroids (1979)" },
    body: {
      en: "Take a square and glue its right edge to its left edge: you get a tube. Glue the top to the bottom too and the tube closes into a doughnut — a torus. On the 'flat' torus nothing bends: angles and lengths are those of the square, but walking off one edge brings you back through the opposite one. The world is finite yet has no wall. That is why, in the Torus Archipelago, you can see copies of the islands — and of yourself — repeating every 48 m: light also leaves through one edge and comes back through the other. Distance means the SHORTEST way, which may cross an edge: two points 2 m apart across the seam are not 46 m apart.",
      vi: "Lấy một ô vuông, dán mép phải vào mép trái: được một cái ống. Dán tiếp mép trên vào mép dưới, ống khép lại thành chiếc bánh vòng — một mặt xuyến. Trên xuyến \"phẳng\" không có gì bị uốn: góc và độ dài vẫn y như trên ô vuông, chỉ là đi ra khỏi một mép thì quay vào từ mép đối diện. Thế giới hữu hạn mà không có bức tường nào. Vì vậy ở Quần đảo Xuyến bạn thấy các hòn đảo — và chính mình — lặp lại sau mỗi 48 m: ánh sáng cũng đi ra một mép rồi quay vào từ mép kia. Khoảng cách là đường NGẮN NHẤT, có thể đi qua mép: hai điểm cách nhau 2 m qua đường khâu thì không hề cách nhau 46 m.",
    },
  },
  torusbow: {
    title: { en: "Field note · Shooting yourself in the back", vi: "Ghi chép · Bắn trúng lưng chính mình" },
    who: { en: "Geodesics on the flat torus; lines of slope p/q close up after L·√(p²+q²)", vi: "Đường trắc địa trên xuyến phẳng; đường hệ số góc p/q khép lại sau L·√(p²+q²)" },
    body: {
      en: "Shoot straight ahead along the x-axis: the arrow leaves through the right edge, re-enters through the left — exactly behind you — and after one lap of length L it reaches your own back. 'In front of me' and 'behind me' are the same direction, just different distances. So a target has infinitely many straight-line routes to it: the short one, and the long ones that wrap. The Bell Box opens only towards the sea, and the Torus Warden always turns its shield along the SHORTEST route — so take a long one. A line with slope 1 closes after L·√2, slope 1/2 after L·√5; a line with an irrational slope never closes and passes arbitrarily close to every point.",
      vi: "Bắn thẳng theo trục x: mũi tên ra khỏi mép phải, quay vào từ mép trái — đúng sau lưng bạn — và sau một vòng dài L thì chạm lưng chính bạn. \"Phía trước\" và \"phía sau\" là cùng một hướng, chỉ khác quãng đường. Vì thế tới một mục tiêu có vô số đường thẳng: đường ngắn, và những đường dài đi vòng qua mép. Hộp Chuông chỉ mở ra biển mây, còn Mắt Canh Xuyến luôn xoay khiên theo đường NGẮN NHẤT — hãy đi đường dài. Đường có hệ số góc 1 khép lại sau L·√2, hệ số góc 1/2 sau L·√5; đường có hệ số góc vô tỉ không bao giờ khép lại và đi qua sát mọi điểm tuỳ ý.",
    },
  },
  tide: {
    title: { en: "Field note · Tides are a slow sine", vi: "Ghi chép · Thuỷ triều là một hình sin chậm" },
    who: { en: "Newton, Principia (1687); Laplace's tidal equations (1775); harmonic tide prediction (Kelvin, 1867)", vi: "Newton, Principia (1687); phương trình thuỷ triều Laplace (1775); dự báo triều bằng điều hoà (Kelvin, 1867)" },
    body: {
      en: "The Moon pulls the near side of the ocean a little more than the Earth's centre, and the far side a little less: two bulges. The Earth turns under them, so most coasts see high water about every 12 h 25 min. Sea level is then close to h(t) = A·sin(2πt/T) + c — and real tide tables are sums of dozens of such sines (Lord Kelvin built a brass machine that added them). If you know the phase you can predict exactly when a sandbar will be dry. At the Wave Coast the period is squeezed into 48 s.",
      vi: "Mặt Trăng kéo phía đại dương gần nó mạnh hơn tâm Trái Đất một chút, phía xa thì yếu hơn một chút: thành hai chỗ phình. Trái Đất quay bên dưới, nên phần lớn bờ biển có nước lớn khoảng 12 giờ 25 phút một lần. Mực nước khi đó gần đúng h(t) = A·sin(2πt/T) + c — và bảng thuỷ triều thật là tổng của hàng chục hình sin như vậy (Lord Kelvin chế cả một cỗ máy đồng thau để cộng chúng). Biết pha là đoán chính xác lúc nào doi cát nổi lên. Ở Bờ Sóng, chu kỳ được nén còn 48 giây.",
    },
  },
  resonance: {
    title: { en: "Field note · The pendulum and resonance", vi: "Ghi chép · Con lắc và cộng hưởng" },
    who: { en: "Galileo (~1602, the swinging lamp in Pisa); Huygens, Horologium Oscillatorium (1673)", vi: "Galileo (~1602, ngọn đèn đung đưa ở Pisa); Huygens, Horologium Oscillatorium (1673)" },
    body: {
      en: "For small swings a pendulum's period is T = 2π√(L/g): it depends on the length, not on the mass and hardly on the amplitude. Gravity pulls a heavy bob harder, but a heavy bob is equally harder to accelerate — the mass cancels (Galileo's insight, later Newton's F = ma). Push a swing once per period, at the same moment of each swing, and every push adds energy: the amplitude grows until friction eats as much as you add. That is resonance. A rope of 2.24 m has T ≈ 3.0 s, the beat of the swell, so the sea rings the bell for you.",
      vi: "Với góc lắc nhỏ, chu kỳ con lắc là T = 2π√(L/g): phụ thuộc chiều dài, không phụ thuộc khối lượng và hầu như không phụ thuộc biên độ. Trọng lực kéo quả nặng mạnh hơn, nhưng quả nặng cũng khó tăng tốc hơn đúng bấy nhiêu — khối lượng triệt tiêu (ý của Galileo, sau này là F = ma của Newton). Đẩy xích đu mỗi chu kỳ một lần, đúng cùng một lúc trong mỗi lần lắc, thì cú đẩy nào cũng thêm năng lượng: biên độ lớn dần tới khi ma sát lấy đi đúng bằng phần bạn thêm. Đó là cộng hưởng. Dây 2,24 m có T ≈ 3,0 s, đúng nhịp sóng lừng, nên biển rung chuông hộ bạn.",
    },
  },
  snell: {
    title: { en: "Field note · Snell's law, total reflection and the rainbow", vi: "Ghi chép · Định luật Snell, phản xạ toàn phần và cầu vồng" },
    who: { en: "Ibn Sahl (984), Snellius (1621), Descartes (1637); Newton's prism experiments (1666)", vi: "Ibn Sahl (984), Snellius (1621), Descartes (1637); thí nghiệm lăng kính của Newton (1666)" },
    body: {
      en: "Light is slower in glass than in air, so a ray that crosses the surface at an angle bends: n₁·sin θ₁ = n₂·sin θ₂, angles measured from the normal. Through a prism it bends twice, always towards the base; the total deviation is smallest when the ray passes symmetrically, and near that minimum two different turns of the prism give almost the same beam. Going from glass to air beyond the critical angle (sin θc = 1/n ≈ 41° for glass) the light cannot get out at all and is reflected completely — that is how optical fibres carry the internet. n is slightly larger for violet than for red, so a prism fans white light into a spectrum.",
      vi: "Ánh sáng đi trong thuỷ tinh chậm hơn trong không khí, nên tia xiên qua mặt phân cách bị bẻ hướng: n₁·sin θ₁ = n₂·sin θ₂, góc đo từ pháp tuyến. Qua lăng kính tia bị bẻ hai lần, luôn lệch về phía đáy; góc lệch nhỏ nhất khi tia đi đối xứng, và gần mức nhỏ nhất đó hai góc xoay khác nhau của lăng kính cho tia gần như trùng nhau. Đi từ thuỷ tinh ra không khí mà góc tới vượt góc tới hạn (sin θc = 1/n ≈ 41° với thuỷ tinh) thì ánh sáng không ra được, bị phản xạ toàn bộ — cáp quang truyền Internet nhờ đúng điều này. Chiết suất với ánh sáng tím lớn hơn đỏ một chút, nên lăng kính xoè ánh sáng trắng thành dải màu.",
    },
  },
  birthday: {
    title: { en: "Field note · The birthday problem: count pairs, not people", vi: "Ghi chép · Bài toán ngày sinh: đếm cặp, đừng đếm người" },
    who: { en: "Richard von Mises (1939); P(no match among n) = 365·364·…·(365 − n + 1) / 365ⁿ", vi: "Richard von Mises (1939); P(n người không ai trùng) = 365·364·…·(365 − n + 1) / 365ⁿ" },
    body: {
      en: "Release wisps one by one into 365 lanterns. Intuition says a match needs about half the lanterns (~183). In fact half of all jars match by the 23rd wisp, and 40 wisps match 89% of the time. The trick is that a match can happen between ANY two wisps: 23 wisps form 23·22/2 = 253 pairs, and each pair matches with chance 1/365. So the number of pairs grows like n², and collisions arrive after only about √365 · 1.2 ≈ 23 tries. The same arithmetic tells hash tables and cryptographers when 'random' IDs start colliding (the birthday attack).",
      vi: "Thả từng đom đóm vào 365 đèn lồng. Trực giác bảo phải gần nửa số đèn (~183) mới trùng. Thật ra một nửa số vò đã trùng trước con thứ 23, và 40 con thì trùng 89% số lần. Bí mật: trùng có thể xảy ra giữa BẤT KÌ hai con nào — 23 con tạo 23·22/2 = 253 cặp, mỗi cặp trùng với xác suất 1/365. Số cặp tăng như n², nên trùng đến chỉ sau khoảng √365 · 1,2 ≈ 23 lần thử. Cùng phép tính này cho biết khi nào mã \"ngẫu nhiên\" bắt đầu đụng nhau trong bảng băm và mật mã (tấn công ngày sinh).",
    },
  },
  bayes: {
    title: { en: "Field note · Bayes' rule and the Mimic Lantern", vi: "Ghi chép · Định lý Bayes và Đèn Soi Mimic" },
    who: { en: "Thomas Bayes (1763), Pierre-Simon Laplace (1774); natural frequencies: Gerd Gigerenzer (1995)", vi: "Thomas Bayes (1763), Pierre-Simon Laplace (1774); tần số tự nhiên: Gerd Gigerenzer (1995)" },
    body: {
      en: "10% of chests are mimics. The Lantern turns red for 90% of mimics but also for 20% of real chests. Picture 100 chests: 10 mimics → 9 red; 90 real chests → 18 red by mistake. Of the 27 red chests only 9 are mimics: P(mimic | red) = 1/3, not 90%. In odds form: prior odds 1 : 9, times the Bayes factor 0.9 / 0.2 = 4.5, gives 4.5 : 9 = 1 : 2. Ignoring how RARE mimics are (the base rate) is the classic mistake doctors and juries make with medical tests and forensic evidence. A second independent red lamp multiplies the odds by 4.5 again: 4.5 : 2 → about 69%.",
      vi: "10% số rương là mimic. Đèn Soi bật đỏ với 90% mimic nhưng cũng đỏ nhầm 20% rương thật. Hình dung 100 rương: 10 mimic → 9 đỏ; 90 rương thật → 18 đỏ nhầm. Trong 27 rương đỏ chỉ có 9 mimic: P(mimic | đỏ) = 1/3, không phải 90%. Dạng tỉ số cược: cược trước 1 : 9, nhân hệ số Bayes 0,9 / 0,2 = 4,5 → 4,5 : 9 = 1 : 2. Quên mất mimic HIẾM thế nào (tỉ lệ nền) là lỗi kinh điển khi đọc xét nghiệm y khoa hay chứng cứ trước toà. Thêm một đèn đỏ độc lập nữa thì nhân tiếp 4,5: 4,5 : 2 → khoảng 69%.",
    },
  },
  clt: {
    title: { en: "Field note · Sums of dice and the central limit theorem", vi: "Ghi chép · Tổng xúc xắc và định lí giới hạn trung tâm" },
    who: { en: "Abraham de Moivre (1733), Pierre-Simon Laplace (1810), Aleksandr Lyapunov (1901)", vi: "Abraham de Moivre (1733), Pierre-Simon Laplace (1810), Aleksandr Lyapunov (1901)" },
    body: {
      en: "One die is flat: every face 1/6. Two dice make a triangle: 7 can be made 6 ways (1+6 … 6+1) out of 36, while 2 and 12 only 1 way. Three dice already look like a bell: 10 and 11 have 27 ways each out of 216, 3 and 18 just one. Add more and more independent pieces and the sum's shape tends to the normal curve, centred at n·3.5 with spread √(n·35/12) — whatever the pieces looked like. That is why heights, measurement errors and exam averages so often look bell-shaped: each is a sum of many small independent effects.",
      vi: "Một xúc xắc thì phẳng: mỗi mặt 1/6. Hai xúc xắc thành tam giác: 7 tạo được 6 cách (1+6 … 6+1) trên 36, còn 2 và 12 chỉ 1 cách. Ba xúc xắc đã ra hình chuông: 10 và 11 mỗi số 27 cách trên 216, 3 và 18 chỉ một. Cộng càng nhiều phần độc lập, hình dạng của tổng càng gần đường cong chuẩn, tâm ở n·3,5, độ rộng √(n·35/12) — dù từng phần có hình gì. Vì thế chiều cao, sai số đo, điểm trung bình thường có dạng chuông: mỗi thứ là tổng của nhiều tác động nhỏ độc lập.",
    },
  },
  gambler: {
    title: { en: "Field note · The wheel has no memory (and the law of large numbers)", vi: "Ghi chép · Bánh xe không có trí nhớ (và luật số lớn)" },
    who: { en: "Monte Carlo Casino, 18 Aug 1913 (black 26 times in a row); Jacob Bernoulli, Ars Conjectandi (1713)", vi: "Sòng Monte Carlo, 18/8/1913 (Đen 26 lần liền); Jacob Bernoulli, Ars Conjectandi (1713)" },
    body: {
      en: "After five reds, black still comes up 18/37 of the time: spins are independent, the wheel does not remember. Believing black is 'due' is the gambler's fallacy — in Monte Carlo in 1913 players lost fortunes betting against a run of 26 blacks. Then why does the red share approach 18/37 over many spins? Not because the wheel corrects old streaks: the GAP between reds and blacks actually keeps wandering (about √n). The share settles because thousands of new spins swamp any early streak. And the green zero means every even-money bet loses 1/37 on average — whatever the streak. A positive expected value comes only from a better price, never from reading the past.",
      vi: "Sau năm lần Đỏ, Đen vẫn ra 18/37 số lần: các lần quay độc lập, bánh xe không nhớ gì. Tin rằng Đen \"sắp về\" là ảo tưởng con bạc — ở Monte Carlo năm 1913 người ta mất cả gia tài khi cược ngược một chuỗi 26 lần Đen. Vậy sao tỉ lệ Đỏ lại tiến về 18/37 khi quay rất nhiều? Không phải vì bánh xe sửa chuỗi cũ: CHÊNH LỆCH Đỏ − Đen vẫn lang thang (cỡ √n). Tỉ lệ ổn định vì hàng nghìn lần quay mới nhấn chìm mọi chuỗi ban đầu. Còn ô Xanh số 0 khiến mọi cược ăn ×2 trung bình lỗ 1/37 — chuỗi thế nào cũng vậy. Kì vọng dương chỉ đến từ giá tốt hơn, không bao giờ từ việc đọc quá khứ.",
    },
  },
  galton: {
    title: { en: "Field note · The Galton board and the bell curve", vi: "Ghi chép · Bàn Galton và đường cong hình chuông" },
    who: { en: "Francis Galton, 1889 · de Moivre & Laplace (normal approximation)", vi: "Francis Galton, 1889 · de Moivre & Laplace (xấp xỉ chuẩn)" },
    body: {
      en: "Each pebble meets 8 rows of pins and bounces left or right with probability ½. The bin it lands in counts its right-bounces k, so P(k) = C(8, k)/2⁸: 70/256 ≈ 27 % in the middle, 1/256 at each edge. Pile many pebbles and their columns trace a bell — the binomial distribution approaching the normal curve. The Bell Crab's middle lane is its peak; its flanks are the tails, where almost nothing falls… and where its shell doesn't cover it.",
      vi: "Mỗi viên sỏi gặp 8 hàng đinh và nảy trái hoặc phải với xác suất ½. Máng nó rơi vào đếm số lần nảy phải k, nên P(k) = C(8, k)/2⁸: 70/256 ≈ 27 % ở giữa, 1/256 ở mỗi mép. Đổ thật nhiều sỏi, các cột vẽ nên một cái chuông — phân phối nhị thức tiến gần đường cong chuẩn. Máng giữa của Cua Chuông là đỉnh chuông; hai bên hông là hai đuôi, nơi gần như chẳng có viên nào rơi… và cũng là chỗ mai cua không che tới.",
    },
  },
  turing: {
    title: { en: "Turing machines", vi: "Máy Turing" },
    who: { en: "Alan Turing, 1936", vi: "Alan Turing, 1936" },
    body: { en: "A tape, a head and a table of rules can compute anything computable. And some questions — like whether a program will ever stop — no machine can always answer.", vi: "Một cuộn băng, một đầu đọc và một bảng luật có thể tính mọi thứ tính được. Và có những câu hỏi — như một chương trình có bao giờ dừng không — không cỗ máy nào luôn trả lời được." },
  },
  // ── Phòng Lăng kính (lý thuyết màu, docs/ai-reviews/color-theory/PLAN.md) ──
  colorlight: {
    title: { en: "Field note · Light adds: RGB and coloured shadows", vi: "Ghi chép · Ánh sáng cộng: RGB và bóng màu" },
    who: { en: "Thomas Young (1802), James Clerk Maxwell (1855, first colour photograph 1861); Exploratorium “Colored Shadows”", vi: "Thomas Young (1802), James Clerk Maxwell (1855, bức ảnh màu đầu tiên 1861); triển lãm “Colored Shadows” của Exploratorium" },
    body: {
      en: "Your eye has three kinds of cones, so three lamps — red, green, blue — can imitate almost any colour. Light from several lamps simply ADDS, like vectors: red (1,0,0) + green (0,1,0) = (1,1,0), which you see as yellow; all three give white. Screens work exactly this way. Stand in front of the lamps: where your body blocks the red lamp, only green + blue reach the floor, so that shadow is cyan. One object, three lamps, three coloured shadows. Careful with numbers: the code 128 on a screen is only about 21% of the light, and half the light is code 188 — sRGB codes are gamma-encoded. Always mix in linear light, then encode.",
      vi: "Mắt có ba loại tế bào nón, nên ba đèn đỏ, lục, lam bắt chước được gần như mọi màu. Ánh sáng từ nhiều đèn CỘNG lại như vectơ: đỏ (1,0,0) + lục (0,1,0) = (1,1,0), mắt thấy là vàng; cả ba thành trắng. Màn hình làm đúng như vậy. Đứng trước các đèn: chỗ người bạn chắn đèn đỏ chỉ còn lục + lam rọi tới, nên bóng đó có màu lam lục (cyan). Một vật, ba đèn, ba cái bóng màu. Cẩn thận với con số: mã 128 trên màn hình chỉ là khoảng 21% ánh sáng, còn một nửa ánh sáng là mã 188 — mã sRGB đã được mã hoá gamma. Luôn trộn trên ánh sáng tuyến tính rồi mới mã hoá.",
    },
  },
  colorsub: {
    title: { en: "Field note · Filters and inks subtract", vi: "Ghi chép · Kính lọc và mực in trừ ánh sáng" },
    who: { en: "Louis Ducos du Hauron (1868, subtractive colour photography); Kubelka & Munk (1931, paint layers)", vi: "Louis Ducos du Hauron (1868, ảnh màu trừ); Kubelka & Munk (1931, lớp sơn)" },
    body: {
      en: "A filter cannot add colour; it can only remove some wavelengths. Light through two filters is the product S(λ)·T₁(λ)·T₂(λ). Cyan removes red, magenta removes green, yellow removes blue. So cyan + yellow lets only green through, magenta + yellow gives red, cyan + magenta gives blue, and all three give (almost) black — that is CMYK printing. Multiplying the RGB colours of the filters is only a shortcut: two filters can look the same yet pass different spectra, so the true answer needs the spectra. Paint is harder still, because pigments both absorb and scatter (Kubelka–Munk). That is why red + green paint gives a muddy brown, while red + green LIGHT gives yellow. “Red, yellow, blue” is a painters' tradition, not a law of nature.",
      vi: "Kính lọc không thêm được màu, chỉ chặn bớt một số bước sóng. Ánh sáng qua hai kính là tích S(λ)·T₁(λ)·T₂(λ). Cyan chặn đỏ, magenta chặn lục, vàng chặn lam. Vì thế cyan + vàng chỉ để lục đi qua, magenta + vàng ra đỏ, cyan + magenta ra lam, cả ba ra (gần) đen — đó là in CMYK. Nhân màu RGB của từng kính chỉ là lối tắt: hai kính trông giống nhau vẫn có thể cho qua những phổ khác nhau, nên muốn đúng phải nhân phổ. Sơn còn khó hơn vì hạt màu vừa hấp thụ vừa tán xạ (Kubelka–Munk). Vì thế sơn đỏ + sơn lục ra nâu xỉn, còn ÁNH SÁNG đỏ + lục ra vàng. “Đỏ, vàng, lam là ba màu cơ bản” chỉ là truyền thống của hoạ sĩ, không phải định luật tự nhiên.",
    },
  },
  colorspace: {
    title: { en: "Field note · Colour is a point in space: the RGB cube and the HSV cylinder", vi: "Ghi chép · Màu là một điểm trong không gian: khối RGB và trụ HSV" },
    who: { en: "Alvy Ray Smith (HSV, 1978); Björn Ottosson (OKLab, 2020)", vi: "Alvy Ray Smith (HSV, 1978); Björn Ottosson (OKLab, 2020)" },
    body: {
      en: "Three numbers (R, G, B) between 0 and 1 are coordinates, so every screen colour is a point of a cube: black and white at opposite corners, the grey axis along the diagonal R = G = B, and red, green, blue, cyan, magenta, yellow at the other six corners. HSV is the same cube in different coordinates: stand the cube on its black corner and look down the grey axis — you see a hexagon. The angle around it is hue H, the distance from the axis is saturation S, and the height is value V = max(R, G, B). HSV is handy but not fair to the eye: at the same V, yellow looks far brighter than blue. Perceptual spaces like OKLab fix that, and the game measures how close two colours are there (ΔE).",
      vi: "Ba số (R, G, B) từ 0 tới 1 là toạ độ, nên mỗi màu trên màn hình là một điểm trong khối lập phương: đen và trắng ở hai góc đối nhau, trục xám là đường chéo R = G = B, còn đỏ, lục, lam, cyan, magenta, vàng ở sáu góc kia. HSV là chính khối đó trong hệ toạ độ khác: dựng khối đứng trên góc đen rồi nhìn dọc trục xám sẽ thấy một lục giác. Góc quanh trục là sắc độ H, khoảng cách tới trục là độ bão hoà S, chiều cao là V = max(R, G, B). HSV tiện nhưng không công bằng với mắt: cùng V mà vàng trông sáng hơn lam rất nhiều. Các không gian cảm nhận như OKLab sửa điều đó, và game đo hai màu gần nhau tới đâu trong OKLab (ΔE).",
    },
  },
  colorwheel: {
    title: { en: "Field note · Which colour wheel? Complements and harmonies", vi: "Ghi chép · Vòng màu nào? Màu bù và phối màu" },
    who: { en: "Isaac Newton (first colour circle, 1704); Johannes Itten (RYB wheel, 1961); CSS Color 4 (OKLCH)", vi: "Isaac Newton (vòng màu đầu tiên, 1704); Johannes Itten (vòng RYB, 1961); CSS Color 4 (OKLCH)" },
    body: {
      en: "A harmony is a pattern of angles on a colour wheel: complementary H and H + 180°, triad H ± 120°, analogous H ± 30°, split-complementary H + 150° and H + 210°. But the answer depends on the wheel. On the light (HSV) wheel the complement of red is cyan, and the two lights add to white. On the painters' RYB wheel the complement of red is green. On the perceptual OKLCH wheel every hue has the same lightness, so palettes look balanced. None of these is the one true wheel: each is a model built for a purpose. Think about it: why do traffic lights not rely on red versus green alone?",
      vi: "Phối màu là một mẫu góc trên vòng màu: bù là H và H + 180°, bộ ba là H ± 120°, tương đồng là H ± 30°, bù chia là H + 150° và H + 210°. Nhưng đáp án tuỳ vòng. Trên vòng ánh sáng (HSV), màu bù của đỏ là cyan, và hai ánh sáng đó cộng lại thành trắng. Trên vòng RYB của hoạ sĩ, bù của đỏ là lục. Trên vòng cảm nhận OKLCH, mọi sắc độ có cùng độ sáng nên bảng màu trông cân đối. Không vòng nào là vòng đúng duy nhất: mỗi vòng là một mô hình cho một mục đích. Thử nghĩ: vì sao đèn giao thông không chỉ dựa vào khác biệt đỏ – lục?",
    },
  },
  colorperception: {
    title: { en: "Field note · Your eye is not a light meter", vi: "Ghi chép · Mắt không phải máy đo ánh sáng" },
    who: { en: "Ewald Hering (opponent colours, 1878); Michel Chevreul (simultaneous contrast, 1839); Edward Adelson (checker shadow, 1995)", vi: "Ewald Hering (màu đối lập, 1878); Michel Chevreul (tương phản đồng thời, 1839); Edward Adelson (bóng bàn cờ, 1995)" },
    body: {
      en: "After the cones, the brain compares signals in opposing pairs: red against green, blue against yellow, light against dark. Stare at cyan for 15–30 seconds and the cyan channel tires; on a white wall the opposite side wins and you see red — the cyan flag with a blue star turns into a red flag with a yellow star for a few seconds. Not everyone sees it equally, and a screen cannot show it to you: it happens in your own eyes. Your brain also judges a colour by its neighbours. Two identical #808080 squares look different on yellow and on blue (simultaneous contrast), and the same pixel can look light or dark depending on the shadow your brain thinks it is in. Pixel values and what you see are different things.",
      vi: "Sau tế bào nón, não so tín hiệu theo từng cặp đối lập: đỏ với lục, lam với vàng, sáng với tối. Nhìn cyan 15–30 giây thì kênh cyan mỏi; nhìn sang tường trắng thì bên đối lập thắng và bạn thấy đỏ — lá cờ cyan sao lam biến thành cờ đỏ sao vàng trong vài giây. Không phải ai cũng thấy như nhau, và màn hình không thể hiện nó ra cho bạn: nó xảy ra trong chính mắt bạn. Não còn đánh giá màu theo màu xung quanh. Hai ô #808080 giống hệt nhau trông khác nhau trên nền vàng và nền lam (tương phản đồng thời), và cùng một điểm ảnh có thể trông sáng hay tối tuỳ cái bóng mà não nghĩ nó đang nằm trong. Giá trị điểm ảnh và thứ bạn nhìn thấy là hai chuyện khác nhau.",
    },
  },
  colorcie: {
    title: { en: "Field note · Spectrum, the CIE horseshoe and colour blindness", vi: "Ghi chép · Quang phổ, móng ngựa CIE và mù màu" },
    who: { en: "Newton's prism (1666); CIE 1931 standard observer (Wright & Guild); Machado, Oliveira & Fernandes (2009)", vi: "Lăng kính của Newton (1666); người quan sát chuẩn CIE 1931 (Wright & Guild); Machado, Oliveira & Fernandes (2009)" },
    body: {
      en: "Sunlight already contains every wavelength; a prism only separates them, because glass bends violet (larger n) more than red. In 1931 the CIE measured how an average eye matches each wavelength and defined X, Y, Z; dividing gives the chromaticity x = X/(X+Y+Z), y = Y/(X+Y+Z). The pure spectral colours trace a horseshoe; the straight bottom edge (purples) has no wavelength at all — purple is a mixture. A screen's three primaries span only a triangle inside it, so many real colours are out of reach. Two different spectra can land on the same point (metamers): 580 nm yellow looks identical to the right mix of 630 nm red and 532 nm green. About 8% of boys have red–green colour vision deficiency; the simulation glasses use Machado's matrices on linear RGB to show which colours merge.",
      vi: "Ánh nắng vốn chứa mọi bước sóng; lăng kính chỉ tách chúng ra, vì thuỷ tinh bẻ tia tím (n lớn hơn) mạnh hơn tia đỏ. Năm 1931, CIE đo cách một con mắt trung bình ghép màu từng bước sóng và định nghĩa X, Y, Z; chia ra được sắc độ x = X/(X+Y+Z), y = Y/(X+Y+Z). Các màu phổ thuần vẽ thành hình móng ngựa; cạnh thẳng ở đáy (các màu tía) không ứng với bước sóng nào — màu tía là màu hỗn hợp. Ba màu cơ bản của màn hình chỉ phủ một tam giác bên trong, nên nhiều màu thật nằm ngoài tầm. Hai phổ khác nhau có thể rơi vào cùng một điểm (đồng sắc): vàng 580 nm trông y hệt hỗn hợp đúng tỉ lệ của đỏ 630 nm và lục 532 nm. Khoảng 8% nam giới có tật nhìn màu đỏ – lục; kính mô phỏng dùng ma trận của Machado trên RGB tuyến tính để cho thấy những màu nào bị nhập làm một.",
    },
  },
  standingwave: {
    title: { en: "Field note · Standing waves (the Hushed Pleat)", vi: "Ghi chép · Sóng dừng (Gối Xếp Im)" },
    who: { en: "Franz Melde's vibrating string (1859); Lagrange and d'Alembert on the wave equation (1740s–1750s)", vi: "Dây rung của Franz Melde (1859); Lagrange và d'Alembert với phương trình sóng (thập niên 1740–1750)" },
    body: {
      en: "Pin a string (or a cloth wall) at both ends and shake it: two waves running opposite ways add up to y(x, t) = 2A·sin(kx)·cos(ωt). The shape sin(kx) never travels; the whole string just breathes in and out. Because both ends are fixed, a whole number of half-waves must fit: L = n·λ/2, with n loops (antinodes). Points with sin(kx) = 0 never move — the nodes — at x = k·L/n (k = 0…n): one node in the middle at L/2 for n = 2, two at L/3 and 2L/3 for n = 3. Even at the instant the whole wall is flat, the nodes are the stitches that did not move in any frame. The n-th mode vibrates n times as fast as the first, f_n = n·f₁ — the harmonics of a string (here n·110 Hz). The Hushed Pleat only listens to a strike from a node.",
      vi: "Ghim một sợi dây (hay một vách vải) ở hai đầu rồi rung: hai sóng chạy ngược chiều cộng lại thành y(x, t) = 2A·sin(kx)·cos(ωt). Dáng sin(kx) không hề chạy đi; cả sợi dây chỉ phồng lên rồi xẹp xuống. Vì hai đầu cố định, phải vừa khít một số nguyên nửa bước sóng: L = n·λ/2, với n bụng sóng. Những điểm có sin(kx) = 0 không bao giờ chuyển động — đó là nút — ở x = k·L/n (k = 0…n): một nút giữa L/2 khi n = 2, hai nút L/3 và 2L/3 khi n = 3. Kể cả đúng lúc cả vách phẳng lì, nút vẫn là những mũi chỉ không nhúc nhích ở mọi khung hình. Mode thứ n rung nhanh gấp n lần mode đầu, f_n = n·f₁ — chính là các hoạ âm của dây đàn (ở đây n·110 Hz). Gối Xếp Im chỉ chịu nghe một đòn đánh từ nút.",
    },
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
