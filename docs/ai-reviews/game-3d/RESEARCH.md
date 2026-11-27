# Game 3D học Toán 10–12 — Tổng hợp nghiên cứu gameplay

> Ngày: 26/11/2026 · Nguồn: 5 agent nghiên cứu song song (game học toán · thiết kế khám phá · khoa học học tập & ghi nhớ · cơ chế social · chương trình GDPT 2018 & đề thi THPT).
> Công nghệ đã chốt: three.js / React Three Fiber, nhân vật VRoid (`@pixiv/three-vrm`), asset Quaternius (CC0).
> Đây là tài liệu nghiên cứu, **chưa phải PLAN**. Mức độ bằng chứng được ghi kèm: **[mạnh]** meta-analysis/RCT lớn · **[vừa]** nghiên cứu nhỏ/không đồng nhất · **[ý kiến]** kinh nghiệm nhà thiết kế · **[tóm tắt]** agent chỉ đọc được abstract/snippet, cần kiểm lại trước khi trích dẫn.

---

## 0. Bảy kết luận quan trọng nhất

1. **Toán phải *là* cơ chế, không phải "câu hỏi chặn giữa màn".** Zombie Division: bản tích hợp nội tại cho học tốt hơn, trẻ tự chọn chơi lâu hơn **7 lần**; bản lặp lại có đăng ký trước (210 người) xác nhận phần học tập **[vừa–mạnh]**. Prodigy (đánh quái bằng trắc nghiệm) là phản ví dụ kinh điển.
2. **Có quyền truy cập ≠ tiến bộ; chỉ *lượng luyện tập* dự đoán tiến bộ.** RCT Math Garden (n=376): cho dùng app không làm điểm tăng, chỉ ai luyện nhiều mới tăng **[mạnh]**. ⇒ Cơ chế *kéo học sinh quay lại* quan trọng hơn thêm nội dung.
3. **Khám phá trước, công thức sau — và gọi tên định lý *sau* khi đã "à há".** Productive failure g≈0.36–0.58 **[mạnh]**; Antichamber, The Witness, Outer Wilds đều giấu tên/luật đến khi người chơi tự thấy **[ý kiến]**. Nhưng **phải có bước bắc cầu sang ký hiệu**: DragonBox vui hơn nhưng nhóm học với tutor đại số làm bài kiểm tra tốt hơn vì game "làm hộ" và không bắt viết phương trình **[vừa]**.
4. **Nhớ lâu = gợi nhớ chủ động + giãn cách + xen kẽ.** Học xen kẽ trong toán: 61% vs 38% sau 1 tháng, d=0.83 (RCT 54 lớp) **[mạnh]**. ⇒ Ôn tập phải là gameplay chính hằng ngày, không phải tính năng phụ.
5. **Hình ảnh gọn hơn ≥ hình ảnh đẹp.** Meta-analysis Clark 2016: thiết kế đơn giản/sơ đồ học bằng hoặc tốt hơn thiết kế hiện thực **[tóm tắt]**. ⇒ VRoid/3D đẹp đặt ở **sảnh, chuyển cảnh, danh tính**; *màn giải toán phải sạch*.
6. **Social chỉ giúp học khi có mục tiêu nhóm + trách nhiệm cá nhân.** Slavin: 37/44 nghiên cứu có đủ hai điều kiện cho kết quả dương, thiếu thì chỉ 4/23 **[mạnh]**. Bảng xếp hạng tuyệt đối làm học sinh yếu nản và có nghiên cứu cho thấy hạ điểm thi **[vừa]**.
7. **Phần thưởng vật chất theo từng câu làm giảm động lực tự thân** (d≈−0.28 đến −0.40, Deci/Koestner/Ryan 1999) **[tóm tắt]**. ⇒ Xu là *thông tin về sự thành thạo*, thưởng cho khám phá/mốc thành thạo/hồi phục kiến thức, không trả công theo số câu.

---

## 1. Trụ cột thiết kế

| # | Trụ cột | Nghĩa là | Cấm |
|---|---|---|---|
| P1 | **Hiểu biết là sức mạnh** | Mỗi phát hiện toán học mở khả năng / khu vực mới, và *phải dùng chính ý tưởng đó* để điều khiển khả năng (Outer Wilds: "kiến thức là nâng cấp") | Vật phẩm chìa khoá vô nghĩa; quiz chặn cửa |
| P2 | **Đoán → thấy → giải thích** | Trước mọi lần "lộ" kết quả, học sinh cam kết dự đoán (kèm độ tự tin) | Tutorial chữ dài; nói đáp án trước |
| P3 | **Kiến thức có tuổi thọ** | Kiến thức phai theo thời gian và *quay lại* thành thử thách | Học xong một lần là xong |
| P4 | **Cùng nhau mới làm được** | Co-op có thông tin bất đối xứng, điểm nhóm = tổng tiến bộ cá nhân | Ai nhanh nhất trả lời; xếp hạng tuyệt đối |
| P5 | **Sát đề thi thật** | Mọi kỹ năng cuối cùng được kiểm bằng đúng 3 dạng Phần I/II/III | Toán "game" không chuyển được sang đề |
| P6 | **Hiển thị sạch, thế giới đẹp** | 3D phục vụ trực giác (hình không gian, Oxyz, khối tròn xoay); màn giải tối giản | Hiệu ứng trang trí trong màn giải |

---

## 2. Vòng chơi ba tầng

### 2.1 Vòng một chủ đề (lần đầu ≈ 25 phút, chia 2 phiên được)
Ví dụ **Hàm bậc ba & đồ thị đạo hàm** (chương nặng điểm nhất lớp 12):

| Bước | Thời lượng | Hoạt động | Cơ sở |
|---|---|---|---|
| 1. Khám phá | 4' | Tàu lượn trên đồ thị bậc ba: kéo a,b,c,d; người trượt nghiêng theo độ dốc; mũi tên độ dốc và parabol f′ vẽ trực tiếp bên dưới. Không chấm điểm. | Explorable explanations, Marbleslides |
| 2. Dự đoán | 3' | Cho 3 đồ thị f′, chọn/vẽ dáng f, **đặt cược độ tự tin** (1–3 rune) rồi lộ kết quả | Generation, hypercorrection |
| 3. Vật lộn | 6' | "Xây đường ray có đỉnh tại x=1 và đáy tại x=3", "đường ray không có khúc quanh". Thử nhiều lần, không phạt; ghi lại các lần thử. | Productive failure |
| 4. Giải thích | 7' | Nhân vật thầy (VRoid) so các lần thử của *chính học sinh* với lời giải chuẩn: f′ là bậc hai → dấu a và Δ của f′ cho 4 dáng; điểm uốn x=−b/3a. 2 câu tự giải thích (chọn lý do) + 1 lời giải mẫu bị khuyết bước. **Lúc này mới hiện tên gọi.** | Self-explanation, faded examples |
| 5. Luyện | 5' | 6 câu dạng đề: Phần I, một khoá 4 mệnh đề Phần II ("cho đồ thị f′…"), một câu trả lời ngắn. Mục tiêu ~75–80% đúng. | Retrieval, Elo |
| 6. Ôn giãn cách | — | Ngày 1, ~3, 7, 16, 35 (FSRS điều chỉnh); từ ngày 3 trộn với chủ đề khác trong trận đấu | Spacing, interleaving |

**Cú xoắn (kishōtenketsu):** màn cuối khu dùng y=x³ — f′=0 nhưng *không* có cực trị. Đây đúng là sai lầm hay gặp nhất trong đề.

### 2.2 Vòng ngày (10–20 phút, phù hợp giới hạn giờ chơi)
1. Vào sảnh → thấy **Sinh vật Hồi âm** hoang dã (kiến thức sắp quên) đang lang thang → thuần hoá lại (2–5 câu biến thể, xen kẽ chủ đề).
2. Nhiệm vụ bạn học (Study Buddy) chung với 1 bạn cùng lớp.
3. Tuỳ chọn: một khu mới / một màn khám phá / một trận đấu bóng ma.

### 2.3 Vòng tuần và mùa
- **Tuần:** Boss thế giới của lớp (sự kiện thầy live) · Thử thách tuần theo điểm tiến bộ · Xưởng đề (học sinh ra đề cho nhau).
- **Mùa (đến kỳ thi):** tỉ lệ ghi nhớ mục tiêu FSRS tăng dần khi gần ngày thi (0.85 → 0.92); các "Boss mô phỏng đề" có giờ mở dần từ tháng 3; tháng cuối là chuỗi đề thi thử 90 phút/22 câu.

---

## 3. Khám phá — "Phát hiện = Năng lực"

### 3.1 Nguyên tắc tạo "à há"
- **Cho thấy khoảng trống trước.** Gờ đá với không tới, cánh cửa đóng — trước khi học sinh có ý tưởng mở nó (lý thuyết khoảng trống thông tin của Loewenstein; tò mò làm nhớ tốt hơn: 45.9% vs 28.1% sau 1 ngày, Gruber 2014 **[mạnh]**). Độ bất định vừa phải — quá lớn hay quá nhỏ đều tắt tò mò.
- **Quen trước, lạ sau.** Cho học sinh hiểu "bình thường" của khu trước khi phá vỡ nó.
- **Mỗi phòng một ý mới**, theo nhịp giới thiệu → phát triển → xoắn → kết; cú xoắn chính là **phản ví dụ / trường hợp biên**.
- **Đầu mối nằm sẵn trước mắt** ("mình đi qua cái này 10 lần rồi"). Giữ manh mối ngang tầm mắt — người chơi hiếm khi nhìn lên.
- **Không màn hình hướng dẫn.** Dạy bằng bố trí, ánh sáng, vị trí camera. Refraction (≈50.000 người chơi): *cả bốn* hệ thống gợi ý đều làm kết quả kém hơn không gợi ý **[tóm tắt]**.
- **Thỉnh thoảng để dự đoán hiển nhiên là đúng** — nếu mọi lần lộ đều bất ngờ, học sinh sẽ đi "săn mánh".

### 3.2 Thang gợi ý (giữ được "à há")
1. Chỉ vào một quan sát ("Nhìn quả bóng trên đỉnh đồi") → 2. Hỏi một câu → 3. Yêu cầu dự đoán → 4. Đưa trường hợp nhỏ tương tự → 5. Đáp án rõ ràng, phải chủ động mở.
Gợi ý có giá: mỗi bậc hạ điểm FSRS của lần đó (Good → Hard). Gợi ý nằm trong thế giới dưới dạng "trang sổ tay cổ" đọc được một phần (kiểu Tunic). Mọi màn phải giải được không cần gợi ý.

### 3.3 Danh sách phát hiện → năng lực (ứng viên)

| Khu | Phát hiện | Năng lực mở ra | Cú xoắn |
|---|---|---|---|
| Thung lũng Hàm số | Ở đỉnh/đáy, độ dốc bằng 0 | **Neo móc**: chỉ bám được vào điểm dừng; về sau giải f′(x)=0 từ công thức để bám điểm ẩn trong sương | y=x³: neo trượt vì không phải cực trị |
| Thung lũng Hàm số | f′>0 ⇔ đi lên | **Cảm biến leo**: đọc bảng xét dấu của thung lũng bị niêm phong để tìm đường an toàn không cần nhìn | Đạo hàm không xác định tại điểm gãy |
| Kính hiển vi | Phóng to đủ thì đường cong thành thẳng | **Ống ngắm tiếp tuyến** | \|x\| không bao giờ thẳng ra → không có đạo hàm |
| Hồ chứa | Lượng nước = diện tích dưới đồ thị tốc độ | **Bè nổi**: đoán chính xác lúc nước chạm gờ; sau đó dựng lại địa hình ẩn từ bản đồ độ dốc (định lý cơ bản) | Tốc độ âm → nước rút |
| Xưởng tiện | Quay miền phẳng = chồng đĩa | **Đặt hàng bình gốm** đúng thể tích | Quên bình phương bán kính |
| Phòng thí nghiệm lát cắt | Một nhát cắt qua lập phương cho lục giác đều | **Cổng lục giác** | Thiết diện không đi qua điểm cho trước |
| Đài định vị Oxyz | Biết khoảng cách ⇒ nằm trên mặt cầu; 3 mặt cầu cắt nhau tại 1 điểm | **Dịch chuyển** đến toạ độ kho báu | Hai mặt cầu tiếp xúc |
| Khoá vuông góc | Vuông góc ⇔ tích vô hướng = 0 | **Ngắm laser bằng số** thay vì thử | Nhầm vectơ pháp tuyến với chỉ phương |
| Vòng đu quay | sin/cos là bóng của điểm chạy trên vòng tròn | **Đồng bộ pha** (bắt cóc tàu bay); sin x + sin(x+π)=0 → **phát sóng ngược pha** triệt tiêu tường | Độ vs radian |
| Đầm vi khuẩn | log = số lần nhân đôi | **Thấu kính log** nén đảo xa thành tầm với; đoán thời điểm rào chắn bán rã sụp | log(a+b) ≠ log a + log b |
| Cầu Zeno | 1/2 + 1/4 + … = 1 | **Lướt Zeno** qua hố "vô tận" | Công bội > 1 → không bao giờ tới |
| Xưởng hộp | Thể tích lớn nhất khi V′=0 | **Đóng hộp chở nhiều tinh thể nhất**; histogram cả lớp lộ đỉnh | Quên xét đầu mút |
| Làng xác suất | Điều kiện = thu nhỏ vũ trụ | **Cổng xét nghiệm**: 1.000 dân đi qua cổng "dương tính", chỉ người qua được ở lại → thấy tỉ lệ thật | Bỏ qua tỉ lệ nền; đảo P(A\|B)↔P(B\|A) |
| Bãi biển cứu hộ | Đường đi nhanh nhất qua cát→nước bị gãy khúc | **Thử thách tính giờ** chỉ thắng bằng đường tối ưu | Đường thẳng không nhanh nhất |

### 3.4 Bảo tàng Khám phá (tòa nhà trong sảnh)
- Mỗi học sinh có một cánh riêng; mỗi phát hiện là một hiện vật.
- Thẻ hiện vật ghi: **dự đoán ban đầu** của em · ảnh/replay khoảnh khắc · **lời giải thích bằng lời của em** · tên định lý chính thức (chỉ hiện sau khi phát hiện) · năng lực đã mở · những nơi em đã tái sử dụng nó.
- Năm bậc: **Tin đồn** (thấy manh mối) → **Linh cảm** (đã dự đoán) → **Xác nhận** → **Giải thích được** → **Thành thạo** (dùng đúng ở 3 bối cảnh khác nhau).
- Hiện vật chưa tìm thấy hiện **bóng mờ** + lời nhá ("Có gì đó lạ xảy ra trên đỉnh đồi") — giữ khoảng trống mà không lộ đáp án.
- **Mạng liên kết** giữa hiện vật (như bảng nhật ký Outer Wilds): "Neo móc + Hồ chứa → ?".
- Bảng đồng lớp: "Lớp 12A1 phát hiện đầu tiên". Giáo viên xem được dự đoán & lời giải thích → **phát hiện ngộ nhận của cả lớp**.

### 3.5 Chống phá "à há"
- **Tham số ngẫu nhiên theo từng học sinh** → tra mạng ra định lý vẫn phải tự áp dụng (tra ý tưởng = vẫn là học).
- **Ưu tiên đầu vào liên tục** (toạ độ, thời gian, góc) hơn trắc nghiệm ở màn khám phá; nếu bắt buộc chọn, xác nhận theo lô (Obra Dinn xác nhận theo nhóm 3 để chống đoán mò).
- **Không bao giờ để một mã ngắn là cửa duy nhất** (cộng đồng Fez đã brute-force trong một tuần).
- **Lộ đáp án qua chat** được biến thành tích cực: xem §5 "Thẻ gợi ý" và "Vén màn cả lớp".

---

## 4. Ghi nhớ — Sinh vật Hồi âm

### 4.1 Cơ chế
- Mỗi **đơn vị kiến thức** (KC — ví dụ "đọc tính đơn điệu từ đồ thị f′") là một sinh vật được thuần hoá ở khu của nó.
- Khi xác suất nhớ R giảm, sinh vật **mờ dần**; dưới ngưỡng (vd 0.90) nó **hoá hoang**, chạy ra sảnh. Nhiệm vụ ngày chủ yếu là **thuần hoá lại** bằng *biến thể mới* (sinh từ generator), không bao giờ lặp câu cũ.
- Lỗi sai **khi tự tin cao** được gắn cờ — sinh vật đó thành "sinh vật ưu tiên" trong lần ôn tới (hiệu ứng siêu sửa lỗi có thể quay lại sau 1 tuần).
- Trận đấu ôn tập **xen kẽ**: không hai câu liền nhau dùng cùng chiến lược.

### 4.2 Hai mô hình, hai việc
- **FSRS quyết định *khi nào* ôn** (trí nhớ): theo học sinh × KC lưu độ bền S, độ khó D, khả năng nhớ R. Sai → Again; đúng nhưng dùng gợi ý/rất chậm → Hard; đúng → Good; đúng + nhanh + tự tin → Easy.
  - ⚠ FSRS được khớp trên thẻ ghi nhớ lặp y hệt; dùng theo KC với câu biến thể là **ngoại suy**. Bắt đầu với tham số mặc định, khớp lại bằng optimizer khi đủ log.
- **Elo quyết định *câu nào*** (năng lực): P = 1/(1+e^−(θ−d)); θ += K(r−P); d −= K(r−P); K = a/(1+b·n), khởi đầu a=1, b=0.05 (Pelánek). Chọn câu có P≈0.75 khi học, ≈0.85 khi ôn.

### 4.3 Phác thảo dữ liệu
```
kc(id, topic, prereq_ids[])
item_family(id, kc_ids[], format{MCQ, TF4, SHORT}, generator_spec, distractor→misconception_id)
item(id, family_id, elo_d, n)
student_kc_memory(student, kc, S, D, last_review, due_at, reps, lapses)
student_kc_skill(student, kc, theta, n)
attempt(id, student, item, kc, correct, confidence, response_ms, hints, chosen_distractor,
        fsrs_grade, context{explore, battle, quest, review, mock}, ts)
creature(student, kc, species, state{wild, tamed, fading, feral}, bond)
discovery(student, discovery_id, stage{rumor, hunch, confirmed, explained, mastered},
          prediction, explanation, first_at, reuse_count)
student.exam_date
```
**Mọi phương án nhiễu gắn mã ngộ nhận** → phản hồi gọi tên ngộ nhận và chiếu đồ thị phản ví dụ (thay vì chỉ "Sai").

### 4.4 Áp lực thời gian — dung hoà Math Battle với nghiên cứu
- Áp lực thời gian thường làm học sinh chọn chiến lược kém hơn (Caviola 2017) **[vừa]**; mối liên hệ nhân quả với lo âu toán **chưa được chứng minh**; nhận định "bài tính giờ gây lo âu" của Boaler là quan điểm, có nghiên cứu 2024 phản bác **[tóm tắt]**.
- Nhưng đề thật **có tính giờ**, và năm 2025 nhiều học sinh không kịp làm Phần III vì đề dài.
- ⇒ **Không đồng hồ khi khám phá/học/ôn.** Đấu tốc độ chỉ cho KC đã có độ bền cao, tự nguyện; "Boss mô phỏng đề" tính giờ mở dần trong các tháng cuối. Có thời gian tối thiểu trước khi mở đáp án trắc nghiệm (chống đoán mò).

---

## 5. Social — cơ chế được chọn

Luật vàng: **mục tiêu nhóm + điểm nhóm phụ thuộc vào việc học của từng cá nhân**.

### 5.1 Ưu tiên cao (khớp tốt nhất với nghiên cứu + hệ thống sẵn có)

| Cơ chế | Mô tả | Chống ăn theo | Bảo vệ học sinh yếu |
|---|---|---|---|
| **Kho hai chìa** (co-op bất đối xứng) | "Người nhìn" thấy đồ thị/bảng biến thiên; "Người ghi" giữ sách luật (quy tắc dấu f′, tiệm cận). Mỗi người nhập nửa đáp án; đổi vai mỗi kho. | Không ai giải một mình được | Có nút ping/đánh dấu, không phụ thuộc giọng nói; độ khó nằm ở quyết định, không ở thao tác |
| **Điểm tiến bộ của lớp** (STAD) | Điểm guild = tổng mức *vượt chính mình* của từng thành viên trên bài cá nhân; thưởng theo bậc mục tiêu cố định (lớp nào cũng đạt được "Lớp Xuất Sắc") | Bài kiểm tra cá nhân | Em yếu tiến bộ đóng góp ngang em giỏi |
| **Boss thế giới của lớp** | Sự kiện thầy live; mỗi đòn đánh = một câu tự giải đúng ở *mức của chính em* | Sát thương chỉ đến từ lời giải cá nhân | Câu thích ứng; mỗi đòn có giá trị như nhau |
| **Bầu – Bàn – Bầu lại** (peer instruction) | Trong live: bầu một mình → ghép với bạn bầu khác → bàn 60–90 giây → bầu lại → thầy giảng | Lần bầu đầu là cá nhân, được ghi | Hiệu quả nhất cho cả ba nhóm năng lực *khi có bước thầy giảng sau* |
| **Đấu bóng ma** (bất đồng bộ) | Đua với bản ghi của bạn / kỷ lục của chính mình trên cùng bộ đề | Cá nhân | Mặc định "vượt chính mình" |
| **Bạn học tuần** | Ghép đôi với bạn cùng lớp *đang hoạt động*, mục tiêu chung, nhắc nhở | Cả hai phải góp | Không ghép với người không hoạt động; không thông báo bêu tên |
| **Bàn đấu** (TGT) | Bàn 3 người cùng trình độ, thắng/thua "đẩy" lên xuống bàn; người thắng bàn nào cũng mang cùng số điểm về lớp | Ai cũng chơi bàn của mình | Em yếu đấu với em yếu vẫn ghi đủ điểm |

### 5.2 Ưu tiên giai đoạn sau
- **Thám hiểm ghép hình (jigsaw)** 4 người: mỗi người qua *phòng chuyên gia* một kỹ năng con (định lý sin, định lý cos, diện tích, vectơ) **có bài kiểm tra thành thạo** rồi mới vào boss. ⚠ Jigsaw dao động rất mạnh giữa các nghiên cứu (I²≈91%, có nghiên cứu âm) — *bắt buộc có cổng thành thạo*.
- **Thẻ đáp án phân tán** (kiểu Quizlet Live): các lựa chọn nằm rải trên màn hình đồng đội, sai là cả đội về 0 → thưởng chính xác hơn tốc độ. Hợp với ghép f ↔ f′, phương trình ↔ hình.
- **Phiên toà lời giải:** lời giải mẫu có một "bước giả mạo"; mỗi người bảo vệ/tố cáo dòng của mình. **Kẻ giả mạo luôn là NPC, không bao giờ là bạn học.**
- **Xưởng đề** (kiểu Mario Maker): học sinh ra bài tham số m / tối ưu / xác suất từ mẫu; phải tự giải được trước (server kiểm), được thưởng khi bạn khác giải và đánh giá "rõ ràng".
- **Dạy thú cưng:** thú cưng mua ở tiệm thành "học trò" — em chọn bước giải để dạy, thú cưng đi thi đấu. Hiệu ứng "học để dạy" (protégé effect); lỗi sai là của thú cưng → giảm áp lực.
- **Bảng nhờ giúp + Thẻ gợi ý:** người giúp chỉ được thưởng khi người được giúp **sau đó tự giải được** bài tương tự. Thẻ gợi ý dùng câu soạn sẵn ("Nhìn vào…", "Chuyện gì xảy ra khi…?") không thể chứa đáp án. (Nghiên cứu: giải thích chi tiết giúp cả hai; đưa đáp án trần không giúp ai; có nghiên cứu thấy "nói nhiều" tương quan *âm* với điểm.)
- **Đoán hình 2 người** (kiểu Polygraph) trong sảnh: hỏi có/không về đồ thị/khối → buộc dùng từ chính xác (đồng biến, tiệm cận, cực trị).
- **Vén màn cả lớp:** mọi người cùng dự đoán, cùng xem kết quả lộ ra.

### 5.3 Cấu trúc
- Đội: **2** (kho hai chìa) · **3** (bàn đấu) · **4** (jigsaw, đội STAD). Tránh co-op ≥5 người (ăn theo tăng).
- **Lớp = guild** (30–45 em); đội 4 người trộn trình độ, xoay vòng 2–3 tuần. Lớp so với lớp **chỉ qua bậc mục tiêu hoặc tổng tiến bộ**.
- Ghép trận: rating theo từng chủ đề — đấu thì ghép cùng trình độ, co-op thì cố ý trộn nhưng vai hợp sức.
- **~70% bất đồng bộ / ~30% realtime** theo khung giờ (giờ học, sự kiện tối, boss tuần). Sảnh: hiện diện theo khoảng cách (chỉ tương tác người gần), kiểu Gather.
- Thay bảng xếp hạng tuyệt đối bằng: kỷ lục cá nhân · giải đấu nhóm nhỏ cùng trình độ · chỉ hiện ±2 người quanh mình · ẩn nhóm cuối.

### 5.4 An toàn cho học sinh dưới 18 tuổi
- **Chat phân tầng (mô hình Club Penguin):** mặc định là **vòng câu "Toán Talk"** soạn sẵn ("Mình nghĩ B vì…", "Kiểm tra tập xác định", "Giải thích bước 2 được không?") + emote + ping. Chat tự do có lọc *chỉ* trong lớp/đội. Không chat người lạ trường khác, không nhắn riêng khác lớp, không gửi ảnh/link.
- **Chặn thông tin cá nhân:** số điện thoại, Zalo/Facebook, link, teencode có/không dấu, tên trường khác. Tên hiển thị chọn từ bộ sinh hoặc được duyệt.
- **Giọng nói:** tắt mặc định; chỉ trong giờ học/có thầy.
- **Báo cáo, tắt tiếng, chặn** ở mọi màn; dashboard giáo viên xem tin bị gắn cờ; **gắn cờ tự động** (chỉ dựa vào báo cáo là không đủ).
- **Chống bắt nạt bằng thiết kế:** không bao giờ hiện tên người trả lời sai · không bỏ phiếu đuổi người · hạn chế tặng/giao dịch xu · không trò "tố cáo bạn".
- **Pháp lý:** Nghị định 147/2024/NĐ-CP yêu cầu giới hạn người dưới 18 tuổi **60 phút/game/ngày, 180 phút/ngày cho mọi game của một nhà phát hành**, cảnh báo mỗi 30 phút; có dự thảo siết hơn cho dưới 16 tuổi. ⇒ Thiết kế phiên 15–20 phút, chỉ đếm thời gian chơi game; **cần hỏi luật sư** game học tập trong web học có thuộc diện này không.

---

## 6. Kinh tế & phần thưởng

- **Xu thật (của tiệm quà) giữ nguyên luật thầy** — hiện chỉ cộng qua 3 hành động. Mọi đề xuất cộng xu từ game cần thầy duyệt.
- Đề xuất trong game dùng **tiền riêng không đổi ra quà thật** (vd "Tinh thể") cho: phát hiện mới, mốc thành thạo, thuần hoá lại sinh vật hoang, giúp bạn thành công. **Không** trả theo số câu.
- **Huy hiệu thành thạo không mua được** — chỉ kiếm được (Thành thạo KC, Người dẫn đường, Người ra đề). Nhà riêng/phòng trưng bày là nơi khoe.
- **Khu xác suất không dùng tiền thật** (tránh động lực cờ bạc; lưu ý web đã có hộp bí ẩn/gacha).
- Chuỗi ngày (streak) có "đóng băng chuỗi", không có thông báo đánh vào sự mất mát; không nhân thưởng streak cho việc lặp *cùng* một kỹ năng (ảo giác thành thạo).

---

## 7. Bản đồ khu theo chương trình & đề thi

Đề từ 2025: 90 phút, 22 câu / 34 ý. **Phần I** 12 câu × 0,25 = 3đ · **Phần II** 4 câu × 4 mệnh đề = 4đ, điểm phi tuyến (đúng 1 ý 0,1 · 2 ý 0,25 · 3 ý 0,5 · 4 ý 1,0) · **Phần III** 6 câu × 0,5 = 3đ, đáp án tối đa 4 ký tự. Ước lượng ~70% lớp 12, ~30% lớp 11 (phân tích đề tham khảo của Hocmai — **không có ma trận chính thức**). Tổ hợp – xác suất là nhóm câu **phân loại điểm 10** cả 2025 và 2026; đề nhiều bối cảnh thực tế (VIASM khuyến nghị 20–30%).

| Ưu tiên | Khu | Chương | Dạng đề hay gặp | Ngộ nhận chính | Bản chất |
|---|---|---|---|---|---|
| ★★★ | **Thung lũng Hàm số** | 12-C1 Ứng dụng đạo hàm (+ 11-C9) | I, II, III (tối ưu kinh tế) | f′=0 ⇒ cực trị; trả x khi hỏi điểm; quên đầu mút; đồ thị không cắt tiệm cận | Phóng to thì cong thành thẳng; dấu f′ = lên/xuống; tối ưu là nơi thay đổi dừng lại |
| ★★★ | **Làng Xác suất** | 10-C8,C9 · 11-C8 · 12-C6 | III (phân loại), II (xác suất có điều kiện 2026) | Lẫn chỉnh hợp/tổ hợp; đếm trùng; bỏ qua điều kiện (23%), nhầm thứ tự thời gian (22%), sai độc lập (20%) | Đếm = dựng cây quyết định; điều kiện = thu nhỏ vũ trụ; Bayes = phần của giả thuyết trong vùng đã thu nhỏ |
| ★★★ | **Hồ chứa & Xưởng tiện** | 12-C4 Nguyên hàm – tích phân | II (chuyển động, diện tích), III (thể tích vật thật, khối tròn xoay) | Tích phân luôn là diện tích dương; quên \|f−g\|; bình phương sai | Tích phân = phép nhân khi tốc độ thay đổi = tích luỹ |
| ★★★ | **Đài định vị Oxyz** | 12-C2, C5 | II (một câu trọn vẹn), bối cảnh radar/cáp treo | Lẫn pháp tuyến ↔ chỉ phương; góc giữa hai mặt lấy góc tù | Toạ độ = công thức bước; mặt phẳng = mọi điểm có tích vô hướng với pháp tuyến bằng 0 |
| ★★ | **Tháp Hình không gian** | 11-C4, C7 | III (khoảng cách 2025, thể tích) | Tin góc trên hình vẽ phẳng; ⊥ mặt phẳng chỉ với một đường; góc đường–mặt không chiếu | Vuông góc = ngắn nhất; góc đường–mặt = góc với bóng của nó |
| ★★ | **Vòng đu quay** | 11-C1 Lượng giác | I, nằm trong mô hình | Lẫn độ–radian (~70% trong một khảo sát đa quốc gia); thiếu nghiệm k2π/kπ | sin/cos là bóng của điểm chạy trên vòng tròn; radian = quãng đi trên vành, đo bằng bán kính |
| ★★ | **Đầm Mũ – Log** | 11-C6 | I, mô hình tăng/giảm | log(a+b)=log a+log b; quên điều kiện; quên đổi chiều BĐT khi cơ số <1 | log đếm số lần nhân; e^x có độ dốc bằng độ cao |
| ★★ | **Kho số liệu ghép nhóm** | 11-C3 · 12-C3 | I; nguyên câu II so sánh hai mẫu | Chọn sai nhóm chứa trung vị/tứ phân vị; lẫn khoảng biến thiên với IQR; phương sai ↔ độ lệch chuẩn | Công thức nội suy giả định dữ liệu đều trong nhóm; IQR là bề rộng nửa giữa |
| ★ | **Tháp Cấp số** | 11-C2 | Trong bài thực tế (lãi, tăng trưởng) | Lệch một (n vs n−1); cộng thay vì nhân | Cộng đều = cầu thang thẳng; nhân đều = bùng nổ |
| ★ | **Đồng bằng Tối ưu tuyến tính** | 10-C2 | Trong bài tối ưu (III 2025) | Tô nhầm nửa mặt phẳng | Đường mức trượt qua miền → tối ưu luôn ở đỉnh |
| ★ | Vectơ phẳng, toạ độ phẳng, hệ thức lượng | 10-C3, C4, C7 | Nền cho lớp 11–12 | Cộng độ dài thay vì vectơ | Vectơ = một dịch chuyển; tích vô hướng = mức đi cùng hướng |

**Dạng câu trong game (khớp đề):**
- **Khoá 4 chìa (Phần II):** một kịch bản, 4 mệnh đề tăng dần độ khó, thưởng theo đúng đường cong 0,1/0,25/0,5/1 → 4/4 đáng giá hơn hẳn 3/4.
- **Đáp số ≤ 4 ký tự** kèm quy tắc làm tròn (luyện cả máy tính cầm tay).
- **Mô hình hoá:** biến đoạn văn tiếng Việt dài thành mô hình (hàm, tích phân, mặt phẳng, cây xác suất) — đọc nhanh dưới áp lực là kỹ năng thật đề kiểm tra.
- Mỗi dạng câu có ít nhất một câu dựa trên hình/bảng/đồ thị.

**Khoảng trống thị trường:** các nền tảng Việt hiện chủ yếu là video + ngân hàng đề (Hocmai, …); VioEdu có gamification nhưng nguồn đọc được chỉ ghi phạm vi tiểu học/THCS. Chỗ trống: trực giác trước công thức · phản hồi theo ngộ nhận · luyện Phần II · luyện mô hình hoá · trực giác không gian 3D thật · xác suất có điều kiện/Bayes (mới, quyết định điểm, ít tài liệu) · gamification cho lớp 10–12. (Một khảo sát 2026 ở Quảng Trị: không học sinh lớp 11 nào từng dùng GeoGebra **[tóm tắt]**.)

---

## 8. Những điều không làm

- Câu hỏi là "vé qua cửa" không liên quan cơ chế (Prodigy) · quảng cáo / lợi thế trả tiền.
- Game làm hộ lập luận và không bao giờ bắt viết ký hiệu (DragonBox).
- Tutorial chữ dài, gợi ý tràn lan (Refraction).
- Đồng hồ đếm ngược ở bài khái niệm.
- Chỉ báo "Đúng/Sai" — luôn cho phản hồi *diễn giải* (cho xem kết quả của câu trả lời, kiểu Marbleslides).
- Hiệu ứng trang trí không có mục đích trong màn giải.
- Khái niệm cao siêu không có giàn giáo (4D Miner) — với hình không gian, luôn có bản 2D tương tự trước (Miegakure).
- Học một buổi rồi thôi — hiệu quả đến từ nhiều phiên.
- Vật phẩm ngẫu nhiên quyết định thắng thua bất kể toán.
- Bảng xếp hạng tuyệt đối toàn trường; hiện tên người sai.
- Mô phỏng quá phức tạp che mất hiện tượng toán (cảnh báo của nhà làm Noita).
- Khu mới mà giờ chơi đầu tiên chưa có phát hiện nào (phê bình Outer Wilds).

---

## 9. Đề xuất MVP để kiểm chứng

**Phạm vi:** một khu — **Thung lũng Hàm số** (nặng điểm nhất, nhiều ngộ nhận nhất, 2D-trong-3D nên nhẹ máy).
- Sảnh tối giản (chưa realtime) + cổng vào khu.
- 3 phát hiện: *Điểm dừng* (→ Neo móc) · *Dấu f′* (→ Cảm biến leo) · cú xoắn *x³*.
- Vòng chủ đề đầy đủ §2.1; 4–5 KC; generator câu có tham số ngẫu nhiên + nhiễu gắn mã ngộ nhận; khoá 4 chìa Phần II.
- Sinh vật Hồi âm (FSRS + Elo) cho các KC đó; Bảo tàng cánh cá nhân.
- Social bất đồng bộ: đấu bóng ma + bạn học tuần.
- **Chấm hoàn toàn ở server; đáp án không bao giờ xuống client.**

**Đo (so với lớp/nhóm chưa dùng, hoặc trước–sau):**
- Tỉ lệ quay lại ngày 7 / ngày 30; số phiên/tuần (Hilz: đây là biến dự đoán tiến bộ).
- Điểm câu cùng KC trong bài kiểm tra **trễ** (sau ≥2 tuần) trên hệ thống bài tập hiện có.
- Tỉ lệ phát hiện không cần gợi ý; thời gian bị kẹt; tỉ lệ dự đoán đúng/sai kèm độ tự tin.
- Phân bố ngộ nhận theo lớp (giá trị cho thầy).

**Quan sát playtest trực tiếp** mỗi tuần (Valve, Keep Talking, Teikari đều nhấn mạnh: người thiết kế "mù" độ khó; lỗi mơ hồ chỉ thấy khi xem người chơi).

---

## 10. Câu hỏi mở cho thầy / người dùng

1. Số học sinh online đồng thời lúc cao điểm? (quyết định realtime/kênh)
2. Cho phép chat tự do trong lớp hay chỉ câu soạn sẵn?
3. Game có được cộng **xu thật** không, hay dùng tiền riêng trong game?
4. Có được dùng giờ học trên lớp cho phiên co-op/peer instruction không?
5. Ngày thi dự kiến từng khối (để FSRS tăng mục tiêu ghi nhớ)?
6. Có muốn xin tư vấn pháp lý về Nghị định 147/2024 trước khi mở rộng?

---

## 11. Nguồn

Chỉ liệt kê nguồn agent **đã đọc**; nguồn chỉ đọc tóm tắt đánh dấu †.

**Game học toán**
- Habgood & Ainsworth / Cutting & Iacovides 2022 (bản lặp): https://eprints.whiterose.ac.uk/id/eprint/189921/ · https://groups.google.com/g/mathgamedesign/c/uync5tVLdK0
- Long & Aleven (DragonBox): https://www.cmu.edu/homepage/computing/2014/spring/fun-and-games.shtml · https://hechingerreport.org/video-games-that-work-better-than-school/ · † https://unpaywall.org/10.1145%2F3057889
- Desmos: https://blog.desmos.com/articles/new-activity-marbleslides/ · https://blog.desmos.com/articles/polygraph/ · https://blog.desmos.com/articles/desmos-guide-to-building-great-digital-math-2021/
- Euclidea: https://www.euclidea.xyz/faq · Wuzzit Trouble: https://journal.seriousgamessociety.org/index.php/IJSG/article/view/88
- Explorable explanations: http://worrydream.com/ExplorableExplanations/ · https://blog.ncase.me/explorable-explanations/ · 3Blue1Brown FAQ: https://www.3blue1brown.com/faq/
- Miegakure: http://miegakure.com/ · Độ khó & động lực (CMU): https://hcii.cmu.edu/news/chi-preview-researchers-hcii-believe-difficulty-can-be-overrated-games
- † Refraction hints: https://grail.cs.washington.edu/wp-content/uploads/2015/08/orourke2014hsm.pdf · † Clark 2016: https://sri.com/publication/digital-games-design-and-learning-a-systematic-review-and-meta-analysis-brief · https://joanganzcooneycenter.org/?p=16779 · † Prodigy: https://fairplayforkids.org/pf/prodigy/

**Thiết kế khám phá**
- The Witness: https://www.gamedeveloper.com/design/-i-the-witness-i-modeling-epiphany · https://gamedeveloper.com/design/indiecade-inside-jonathan-blow-s-puzzle-design-process · https://www.gamereactor.eu/shared-epiphany-jonathan-blow-reflects-on-the-witness
- Outer Wilds: https://www.gamedeveloper.com/design/live-die-repeat-how-i-outer-wilds-i-piques-curiosity-in-an-ambivalent-solar-system · https://www.gamedeveloper.com/design/outer-wilds-critical-analysis · https://www.mobiusdigitalgames.com/news/a-look-into-playtests
- Baba Is You: https://www.gamedeveloper.com/design/designing-i-baba-is-you-i-s-delightfully-innovative-rule-writing-system · Tunic: https://www.gamedeveloper.com/road-to-igf-2023/how-tunic-weaves-wondrous-unknowable-worlds-inspired-by-inscrutable-nes-manuals
- Portal: https://combineoverwiki.net/wiki/Developer_commentary/Portal · https://gmtk.substack.com/p/valves-secret-weapon · Kishōtenketsu: https://www.mcvuk.com/development/video-nintendos-level-design-secrets-in-four-steps
- Noita: https://www.gamedeveloper.com/game-platforms/road-to-the-igf-nolla-games-i-noita-i- · Gợi ý ít spoil: https://www.gamedeveloper.com/design/how-and-why-to-write-low-spoiler-hints-for-adventure-games-
- Tò mò & trí nhớ: Gruber 2014 https://pmc.ncbi.nlm.nih.gov/articles/PMC4252494 · Kang 2009 https://neuroecon.berkeley.edu/papers/papers_files/Kang_PsychSci_2009.html

**Khoa học học tập**
- Rohrer 2020 (xen kẽ): https://Www.Gwern.net/doc/psychology/spaced-repetition/2019-rohrer.pdf
- Pelánek 2016 (Elo): https://www.fi.muni.cz/~xpelanek/publications/CAE-elo.pdf · FSRS: https://expertium.github.io/Algorithm.html
- Hilz 2023 (RCT Math Garden): https://pmc.ncbi.nlm.nih.gov/articles/PMC10299571 · Caviola 2017 (áp lực thời gian): https://pmc.ncbi.nlm.nih.gov/articles/PMC5585192/
- † Dunlosky 2013 · † Cepeda 2008 · † Sinha & Kapur 2021 · † Kalyuga 2007 · † Bisra 2018 · † Fyfe 2014 · † Rittle-Johnson 2015 · † Deci/Koestner/Ryan 1999 · † Wouters 2013 · † Hamari 2014 (link đầy đủ trong báo cáo agent; kiểm lại trước khi trích)

**Social & an toàn**
- Slavin (học hợp tác): https://files.ascd.org/staticfiles/ascd/pdf/journals/ed_lead/el_199102_slavin.pdf · Jigsaw meta: https://www.frontiersin.org/articles/10.3389/fpsyg.2023.1216437/full
- Keep Talking: https://gamedeveloper.com/design/finding-the-fun-in-bomb-defusal-with-i-keep-talking-and-nobody-explodes-i- · We Were Here: https://www.gamedeveloper.com/game-platforms/road-to-the-igf-total-mayhem-games-i-we-were-here-i-
- Protégé effect: https://engineering.vanderbilt.edu/news/2010/vanderbilt-professors-find-that-students-learn-by-tutoring-virtual-peers · Bảng xếp hạng: https://par.nsf.gov/servlets/purl/10510520 · https://www.emerald.com/insight/content/doi/10.1108/intr-12-2021-0897/full/html
- Duolingo: https://blog.duolingo.com/friends-quests/ · https://blog.duolingo.com/product-lessons-friend-streak/
- Club Penguin: https://www.itpro.com/security/20321/club-penguin-making-child-s-play-online-safety · Roblox: https://about.roblox.com/newsroom/2025/07/advancing-safety-on-roblox-with-age-based-communication
- NĐ 147/2024: https://vietnamnet.vn/en/vietnam-introduces-stricter-gaming-limits-for-minors-to-combat-addiction-2344250.html · https://news.tuoitre.vn/vietnam-proposes-capping-online-gaming-time-for-under-16s-at-60-minutes-a-day-103260729154214674.htm

**Chương trình & đề thi**
- VIASM (ma trận, cách chấm Phần II): https://viasm.edu.vn/Cms_Data/Contents/viasm/Media/2024/anhdang/VIASM-VAI-SUY-NGHI-VE-MA-TRAN-VA-CAU-TRUC-CUA-DE-THI-THPT-MON-TOAN-.pdf
- Phân tích đề tham khảo 2025: https://daibieunhandan.vn/de-tham-khao-mon-toan-tot-nghiep-thpt-2025-dam-bao-phan-hoa-ro-nang-luc-thi-sinh-10349516.html · Đề 2025: https://lifestyle.zingnews.vn/de-toan-thi-tot-nghiep-dai-nhu-de-van-kho-co-mua-diem-10-post1563956.html
- Đề 2026: https://nhandan.vn/de-thi-toan-co-tinh-phan-hoa-ro-net-he-thong-cau-hoi-da-dang-ve-dang-thuc-va-cap-do-tu-duy-post968642.html · https://tienphong.vn/de-toan-thpt-2026-khong-danh-do-o-nhom-cau-co-ban-xac-suat-tiep-tuc-la-diem-chan-cua-diem-tuyet-doi-post1850993.tpo
- Mục lục KNTT: https://vietjack.com/toan-12-kn/index.jsp (và lớp 10, 11)
- Ngộ nhận xác suất có điều kiện (Tạp chí Giáo dục 2025): https://tcgd.tapchigiaoduc.edu.vn/index.php/tapchi/article/download/3500/1144/2219
- 3Blue1Brown: https://3blue1brown.com/lessons/bayes-theorem · https://www.3blue1brown.com/lessons/derivatives · https://www.3blue1brown.com/lessons/integration · Better Explained: https://betterexplained.com/articles/demystifying-the-natural-logarithm-ln/
