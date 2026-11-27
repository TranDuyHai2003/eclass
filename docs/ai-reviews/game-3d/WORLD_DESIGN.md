# Math World — World & content design (26/11/2026)

Nguồn: agent nghiên cứu thiết kế (không gian toán/lý lạ, kỹ năng, bestiary, thế giới mở) + yêu cầu của người dùng trong phiên.
Nguyên tắc: **khám phá không cần giấy bút** — mọi tương tác là kéo / nhắm / quan sát; vui, lạ, hiểu bản chất; **luyện đề là việc của hệ thống bài tập trên web**.

## Trụ cột
1. **Đoán rồi xem** — người chơi cam kết dự đoán (đặt mốc, nhắm, kéo) rồi thế giới chạy hành vi thật; chấp nhận sai số → ước lượng là đủ, không phải tính.
2. **Quy luật chính là cơ chế** — mỗi năng lực là chính nguyên lý, không phải quiz đội lốt.
3. **Trả thưởng bằng điều bất ngờ** — mỗi vùng dẫn tới một sự thật phản trực giác (tam giác > 180° trên cầu, đổi cửa thắng 2/3…).

## Cấu trúc thế giới: nhiều thế giới + lỗ sâu
- **Sảnh** (đảo nổi): chỉ có cổng, bảo tàng, gương hoá thân, NPC, sinh vật hồi âm.
- **Thung lũng Hàm số** (đã có): mặt đất là đồ thị bậc ba.
- **Vùng Kỳ quan** (đã có, vô hạn): địa hình chunk sinh theo seed, biome, kỳ quan rải trong chunk.
- Các "lục địa" tiếp theo (mỗi lục địa là một zone riêng sau cổng — giữ trần bộ nhớ trên iOS):
  Calculus Highlands · Vector Steppe · Wave Coast · Chance Bazaar · Algorithm Labyrinth · The Beyond (hyperbolic / cầu / xuyến / 4D / fractal) · Chaos Delta.
- Cổng tri thức (metroidbrainia): cổng cứng cần năng lực; cổng "thuần kiến thức" chỉ cần hiểu (vd trong thế giới xuyến bắn ra trước để trúng sau lưng).

## Biome không gian lạ (ứng viên)
Hyperbolic Forest {7,3} (chạy thẳng là cắt đuôi, holonomy) · Spherical Moonlet (tam giác 270°) · Torus Archipelago (bắn trúng lưng mình) · Möbius Causeway / Klein Cellar (quay về bị lật gương) · Flatland Shelf → Tesseract Ruins (lát cắt 4D, kiểu Miegakure) · Fractal Coast (bờ biển dài vô hạn) · Hat Plaza (gạch “einstein” 2023) · Knot Caverns · Phase-Space Sea (separatrix của con lắc) · Slow-Light Rail (A Slower Speed of Light) · Quantum Shallows (xuyên hầm giảm theo hàm mũ) · Orthogonal Rift (vật lý của Greg Egan: tốc độ ánh sáng phụ thuộc màu).

## Năng lực = hiểu biết (vũ khí / kỹ năng)
| Năng lực | Nguyên lý | Liên hệ chương trình |
|---|---|---|
| Arc Bow (kéo đỉnh parabol) | Trọng lực → parabol, 45° xa nhất, 2 góc cùng trúng | Hàm bậc hai (10), ném xiên (VL10) |
| Sine Lance | Biên độ / chu kì | Lượng giác (11) |
| Exp Bloom + kính log | Nhân đôi vượt mọi tuyến tính | Mũ – log (11) |
| Neo Móc tiếp tuyến (đã có) | Cực trị là chỗ phẳng | Đạo hàm (11–12) |
| Area Siphon | Diện tích dưới v(t) = quãng đường | Tích phân (12) |
| Force Arrows | Hợp lực đầu–đuôi | Vectơ (10), Newton (VL10) |
| Mirror Ward / Prism Lens | Phản xạ, khúc xạ, phản xạ toàn phần | Quang học |
| Momentum Billiard | Bảo toàn động lượng | VL10 |
| Pendulum Shield | Cộng hưởng | Dao động (VL11) |
| Orbit Sling | Kepler, đốt ga ở cận điểm | Chuyển động tròn, hấp dẫn |
| Fourier Choir | Mọi sóng là tổng sin, đảo pha triệt tiêu | Sóng (VL11) |
| Matrix Gauntlet / i-Turn | Phép biến đổi, thứ tự quan trọng; nhân i = quay 90° | Ngoài chương trình |
| Gambit Dice | Kì vọng, Bayes | Xác suất (10–12) |
| BFS Flood / Dijkstra Ink | Đường ngắn nhất | Tin học |
| Mirror-Clone | Đệ quy, cấp số nhân hội tụ | Cấp số (11) |
| Life Seed | Game of Life, tính trồi | CS |
| Halving Compass | Tìm kiếm nhị phân: 1000 hang trong ~10 câu | Tin học |
| Gate Runes / Cipher Lantern | Cổng logic (NAND), mã hoá | Tin học |

Combat không cần tính: kẻ địch lộ hình học (cung, chu kì, quỹ đạo) → người chơi **khớp hình** và **canh nhịp**; độ khó tăng bằng xếp lớp quy luật (gió = thêm vectơ, nước = khúc xạ), không bằng con số.

## Bestiary (thiết kế gốc)
Slice Wraith (4D) · Zeno Hydra (½+¼+…=1) · Hercules' Hydra (Kirby–Paris) · Lorenz Moth · Sierpiński Swarm · Tangent Wyvern · Area Golem · Prism Heron · Bell Crab (cộng hưởng) · Kepler Comet-Kite · Brachistochrone Otter (cycloid) · Bayes Mimic · Three-Veil Lynx (Monty Hall) · Birthday Wisps · Gauss Slimes (định lí giới hạn trung tâm) · Glider Imps · Möbius Serpent · Hyperbolic Wolf Pack · Euler Wisp · Fourier Siren (co-op) · Benford Magpie · Collatz Beetle (bài toán mở — trung thực "chưa ai chứng minh").
Sinh vật thuần hoá → trở thành Sinh vật Hồi âm của KC tương ứng (ôn giãn cách gọi lại thử thách của nó).

## Kỳ quan đã có (Vùng Kỳ quan)
Tesseract (chiếu 4D) · Chai Klein · Cánh bướm Lorenz (RK4) · Đĩa Poincaré {7,3} (nhóm phản xạ + dịch Möbius) · Hố đen (thấu kính hấp dẫn, vòng photon, đĩa bồi tụ). Mỗi kỳ quan có thẻ: móc câu, câu chuyện, câu hỏi tò mò, "gặp ở đâu" (Flatland, Greg Egan, HyperRogue, Escher, EHT 2019).

## "Hoá học toán" (hệ quy luật trồi, kiểu BotW)
Đối tượng mang thẻ (periodic, conserved, transformable, wave, random) + 4 quy luật toàn cục: sóng chồng chập · động lượng/năng lượng bảo toàn · phép biến đổi hợp thành (thứ tự quan trọng) · ngẫu nhiên tụ thành phân phối.

## 3 vùng tiếp theo (đề xuất)
1. **Torus Archipelago + Arc Bow** — rẻ (3×3 instancing), phủ lớp 10–11, "à há" tức thì.
2. **Chance Bazaar** — mật độ bất ngờ cao nhất (Monty Hall, Bayes Mimic, Birthday Wisps, Gauss Slimes), hợp co-op.
3. **Wave Coast** — Sine Lance, Pendulum Shield, Prism Lens, boss Fourier Siren (vật lý + lượng giác).
Mục tiêu xa: Flatland Shelf → Tesseract Ruins.

## Nguồn (agent đã đọc)
A Slower Speed of Light (Wikipedia) · HyperRogue (Wikipedia) · Manifold Garden design (Game Developer) · 4D Golf (80.lv) · Nicky Case explorables · Greg Egan Orthogonal (gregegan.net) · Hat monotile (plus.maths.org). Chỉ từ snippet: Miegakure, Quantum Moves (Nature 2016), Hyperbolica, Velocity Raptor, BotW GDC 2017, Kirby–Paris hydra.
