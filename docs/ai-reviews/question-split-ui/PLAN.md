# Kế hoạch: Cắt câu tự động tốt hơn, công cụ cắt tay cho thầy, giao diện học sinh, kiểm thử toàn trang

> Claude Code · 21/11/2026 · Trạng thái: **chờ review** (Gemini)

## 0. Số liệu hiện trạng (đo bằng `tests/tools/eval-anchors.ts` trên 83 đề thật có PDF lời giải)

| Chỉ số | Hiện tại |
|---|---|
| Câu cắt được tự động | **3017/4015 (75,1%)** |
| Đề cắt đủ 100% | 55/83 |
| Đề không cắt được câu nào | **21/83** |
| Đề có mốc do thầy lưu | 0 (học sinh đang hoàn toàn dựa vào cắt tự động, chạy trên máy học sinh) |

Nguyên nhân các đề cắt kém:
- **A. PDF chỉ toàn ảnh** ("Microsoft: Print To PDF", 0 chữ): 16 đề, khoảng 700 câu. Bộ dò hiện tại đọc lớp chữ của PDF, mà PDF dạng này không có lớp chữ. Nhãn câu ("TDHT 1.", "Câu 1:") vẫn rõ trong ảnh (chữ đỏ hoặc đậm ở lề trái), nên OCR đọc được.
- **B. PDF Word có chữ nhưng ghép thiếu** (vd 0/48, 9/16):
  - đánh số trần "1. Cho…" bị khuyết vài số (câu dạng ảnh) → bộ ghép đòi khớp tuyệt đối nên bỏ cả đề;
  - có nhãn lạc chỗ (vd "12" xuất hiện trước "11") → dãy số bị cắt thành nhiều đợt.
- **C. PDF Word mà phần lớn nội dung là ảnh:** chỉ một phần nhãn là chữ.
- **Ranh giới chưa đủ:** tiêu đề "Phần II: …" (số La Mã) không được coi là ranh giới, nên vùng câu cuối mỗi phần lẹm sang tiêu đề phần sau (thấy rõ ở câu 12 của đề "Bài 6").

## 1. Cắt câu tự động (`lib/pdf-question-anchors.ts`)

### 1.1. Ghép theo dãy số tăng dài nhất
Áp dụng khi các bước hiện có không ghép đủ.
- **Cách ghép:** trong mỗi phần chưa ghép, lấy dãy con tăng dần dài nhất (LIS) của số nhãn theo thứ tự đọc. Các số trong dãy phải nằm trong 1…số câu của phần (hoặc nối tiếp số cuối của phần trước nếu đề đánh số liên tục). Nhãn số n gán cho câu thứ n.
- **Ngưỡng an toàn:**
  - nhãn có từ khoá (Câu/TDHT): dãy phải phủ ≥ 60% số câu của phần;
  - nhãn số trần: phải phủ ≥ 80%, và nhãn thẳng lề trái (đã có);
  - không đạt ngưỡng thì không ghép (giữ nguyên tắc "chỉ ghép khi chắc").
- **Đề Đúng/Sai nhập 4 câu/nhãn:** giữ cách xử lý hiện có.

### 1.2. Thêm ranh giới
- **Tiêu đề phần:** "Phần I/II/III/IV", "PHẦN 2", "Chương", "Mục", "Dạng" và số La Mã đầu dòng ("II. TRẮC NGHIỆM ĐÚNG SAI"); chỉ tính khi chữ viết hoa hoặc dòng ngắn để tránh nhầm với lời giải.
- **Dòng "Hết", "--- HẾT ---", "ĐÁP ÁN":** kết thúc câu cuối.

### 1.3. OCR cho PDF chỉ toàn ảnh (chỉ chạy ở phía giáo viên)
- **Thư viện:** thêm `tesseract.js`, chỉ nạp ở trang cắt câu của giáo viên (tách chunk riêng, không ảnh hưởng học sinh). Dữ liệu ngôn ngữ `vie` (~10 MB) tải từ jsDelivr khi bấm nút, trình duyệt tự cache.
- **Cách chạy:** vẽ mỗi trang ở độ phân giải vừa đủ (~1.5×), OCR riêng **dải 40% bên trái** (nơi có nhãn câu) cho nhanh. Lấy các dòng khớp `MARKER_REGEX` / "Lời giải" / tiêu đề phần, kèm toạ độ, rồi đưa vào cùng bộ ghép ở mục 1.1.
- **Lề:** bỏ header/footer bằng mật độ mực theo hàng (ảnh) lặp lại giữa các trang.
- **Kết quả:** lưu vào DB như mốc thầy lưu (`source: "auto"`, thêm `method: "ocr"`). Học sinh chỉ đọc mốc đã lưu, không bao giờ chạy OCR.
- **Script hàng loạt** `tests/tools/ocr-anchors.ts` (chạy ở Node): OCR và lưu mốc cho các đề PDF ảnh trong DB local. **Chạy trên production chỉ khi thầy đồng ý.**

### 1.4. Lưu sẵn mốc cho đề PDF có chữ (học sinh khỏi tự phân tích)
- **Cách làm:** khi chưa có mốc lưu, màn kết quả vẫn tự dò như hiện tại. Server tính một lần bằng pdfjs ở Node (chạy sau khi trả trang, dùng `after()`), rồi lưu với `algoVersion`.
- **Khi đổi thuật toán:** chỉ tính lại khi `algoVersion` cũ **và** không có câu nào `manual` (không bao giờ ghi đè mốc thầy chỉnh).
- **Lợi ích:** điện thoại học sinh không phải đọc cả file 50 trang; mọi máy thấy cùng một kết quả.

### 1.5. Câu chưa cắt được: dẫn học sinh tới đúng chỗ
Thay vì hiện toàn bộ đề từ trang 1:
- mở khung PDF ở **vùng giữa câu trước và câu sau đã cắt được** (vd câu 6 nằm giữa điểm kết thúc câu 5 và điểm bắt đầu câu 9);
- ghi rõ "Câu 6 nằm trong khoảng trang 3–5";
- vẫn có nút xem toàn bộ.

### 1.6. Đo lường
- **Chạy lại sau mỗi thay đổi:** `eval-anchors.ts`, kèm bảng trước/sau trong báo cáo.
- **Mục tiêu:**
  - với PDF có chữ: không đề nào giảm số câu cắt được;
  - cắt được ≥ 85% câu trên toàn bộ (kể cả ảnh, sau OCR).
- **Test hồi quy:** dữ liệu nhãn giả lập cho LIS, nhãn lạc, số trần khuyết, tiêu đề La Mã, và trường hợp ghép nhầm phải bị từ chối.

## 2. Công cụ cắt tay cho thầy (`SolutionAnchorEditor`)

| Vấn đề hiện tại | Cải thiện |
|---|---|
| Thanh bên và header của site chiếm chỗ; PDF chỉ rộng ~400px, chữ khó đọc | **Không gian làm việc toàn màn hình** (ẩn header/sidebar như màn làm bài); PDF mặc định vừa khung |
| Phải bấm "Đặt bắt đầu" rồi mới bấm vào PDF | **Bấm thẳng vào PDF** là đặt điểm bắt đầu cho câu đang chọn rồi tự sang câu sau; **Shift + bấm** đặt điểm kết thúc |
| Không biết sẽ cắt ở đâu cho tới khi bấm | **Đường dóng theo chuột**, ghi "Câu 7 bắt đầu ở đây"; **tự hút** vào mép trên dòng chữ gần nhất (PDF có chữ) hoặc khoảng trắng gần nhất (PDF ảnh, đo mật độ mực trên canvas) |
| Đặt sai phải làm lại | **Kéo mốc** trên PDF để chỉnh; **Hoàn tác / làm lại** (Ctrl+Z / Ctrl+Shift+Z, nút trên thanh công cụ) |
| PDF ảnh: phải đặt tay từng câu | Nút **"Nhận dạng chữ (OCR)"** kèm thanh tiến trình theo trang; giữ các câu đã chỉnh tay |
| Khó thấy câu nào cắt sai | Danh sách câu có **cảnh báo**: vùng quá dài (> 2 trang), trùng điểm bắt đầu, thứ tự ngược, chưa gắn. Lọc theo cảnh báo |
| Phím tắt ẩn | Thanh gợi ý phím tắt luôn hiện: ↑↓ chuyển câu · bấm = bắt đầu · Shift + bấm = kết thúc · G = giống câu trước · Ctrl+Z |
| Điện thoại quá chật | Bố cục 3 tab (Danh sách · PDF · Xem trước); nhắc "nên dùng máy tính để cắt nhanh" |

Không đổi định dạng dữ liệu lưu (`SolutionAnchorsData` v1), chỉ thêm trường tuỳ chọn `method` và `algoVersion`.

## 3. Giao diện học sinh (có Gemini thiết kế cùng)

**Cách làm:**
1. Chụp các màn chính của học sinh ở 390 và 1366px: trang chủ, danh sách khoá học, trang học (video và bài), làm bài, kết quả, bảng xếp hạng, hồ sơ, điểm thưởng.
2. Gửi Gemini (web, model Neon) kèm bối cảnh: nhận diện xanh `#2563EB`, phong cách "game nhẹ" đã có, học sinh cấp 3. Nhờ Gemini chỉ ra điểm yếu và đề xuất bố cục cụ thể, có thể kèm bản mẫu HTML.
3. Claude chọn đề xuất phù hợp và hiện thực bằng Tailwind theo các thành phần đã có (`.btn-3d`, thẻ viền 2px + bóng đáy, `dots-bg`). Mỗi màn một commit, có ảnh trước/sau.

Ưu tiên: **màn kết quả** (gắn với mục 1), **trang học bài/video**, **danh sách khoá học**, **làm bài**, **hồ sơ**.

Lỗi đã thấy cần sửa: thanh dưới màn kết quả trên điện thoại bị vỡ dòng ("Câu 15 / … · Chọn câu").

## 4. Kiểm thử toàn trang

Script mới `tests/e2e/site-audit.mjs`:
- **Phạm vi:** đi qua mọi route (khách, học sinh, giáo viên, admin) ở 390 / 768 / 1366 / 1920px.
- **Kiểm tra:**
  - mã HTTP;
  - lỗi JavaScript và console;
  - ảnh hỏng;
  - bố cục: tràn ngang, chữ bị cắt, nội dung tràn khung, thừa khoảng trống (dùng lại `layoutProblems`);
  - thời gian tải.
- **Kết quả:** báo cáo dạng bảng kèm ảnh.
- Lỗi tìm được sẽ sửa và thêm vào E2E nếu là luồng quan trọng.

## 5. Thứ tự làm và cách kiểm tra

1. **Mục 1.1 + 1.2:** bộ ghép LIS và ranh giới mới, kèm test và số liệu trước/sau. *(Nhanh, đo được.)*
2. **Mục 2:** công cụ cắt tay. *(E2E cho các thao tác chính.)*
3. **Mục 1.3:** OCR trong công cụ cắt tay và script hàng loạt. *(Đo trên 16 đề PDF ảnh.)*
4. **Mục 1.5 + sửa thanh dưới màn kết quả.**
5. **Mục 4:** kiểm thử toàn trang, sửa lỗi.
6. **Mục 3:** giao diện học sinh cùng Gemini, từng màn.
7. **Mục 1.4:** lưu sẵn mốc phía server. *(Sau cùng, vì có ghi DB tự động.)*

Sau mỗi giai đoạn: `npx tsc`, `eslint`, `npm test`, `npm run test:e2e`, rồi Gemini review diff.

## 6. Rủi ro

| Rủi ro | Cách xử lý |
|---|---|
| LIS ghép nhầm (nhãn trong lời giải như "theo Câu 3") | Chỉ nhận nhãn đầu dòng (đã có); ngưỡng phủ; test trường hợp phải từ chối |
| OCR chậm hoặc sai | Chỉ OCR dải trái, chạy trên máy thầy một lần, thầy xem lại trước khi lưu; chỉ dùng nhãn khớp mẫu chặt |
| Tải `tesseract.js` và dữ liệu ngôn ngữ (~10 MB) | Chỉ nạp khi bấm OCR ở trang giáo viên; học sinh không tải |
| Lưu mốc tự động ghi đè việc thầy chỉnh | Không ghi đè nếu có bất kỳ câu `manual` nào; có `algoVersion` |
| Đổi giao diện làm vỡ luồng cũ | E2E hiện có + site-audit + ảnh trước/sau |

## 7. Chỉnh sau review (Gemini Neon, 21/11)

Chi tiết ở `GEMINI_PLAN_REVIEW.md`.

- **Bỏ §1.4** (tự lưu mốc phía server bằng `after()`). Mốc lưu khi thầy bấm Lưu, hoặc qua script hàng loạt chỉ ghi khi đề chưa có mốc.
- **LIS:**
  - chỉ chạy trong khối đợt đánh số liền nhau của từng phần;
  - phần ≤ 5 câu được thiếu tối đa 1 câu; phần lớn hơn cần phủ ≥ 70% (nhãn số trần ≥ 85%).
- **OCR:** quét cả trang ở 2×, so khớp bỏ dấu; script hàng loạt chạy bằng Chrome headless qua công cụ cắt tay.
- **Công cụ cắt tay, bổ sung:**
  - mốc "Lời giải" (phím L);
  - tách bấm vào mốc (chọn/kéo) với bấm vào nền (đặt mới);
  - tự sang câu sau theo `visibleRows`;
  - Ctrl+S để lưu.
- **Dữ liệu:** `sanitizeSolutionAnchors` giữ `algoVersion` / `method`; tăng khoá đệm phân tích lên v10.
- **Thứ tự mới:**
  1. Ghép LIS và ranh giới mới, câu chưa cắt dẫn tới đúng khoảng trang, sửa thanh dưới màn kết quả.
  2. Công cụ cắt tay.
  3. OCR và script hàng loạt.
  4. Giao diện học sinh cùng Gemini.
  5. Kiểm thử toàn trang (sau giao diện), sửa lỗi.
