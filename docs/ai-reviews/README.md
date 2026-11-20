# Quy trình Claude viết code, Gemini review

**Vai trò:**
- **Claude Code:** đọc code, lập kế hoạch, viết code, chạy test.
- **Gemini** (Antigravity CLI hoặc gemini.google.com): reviewer độc lập, **chỉ đọc**.
- **Bạn:** quyết định cuối cùng, duyệt và deploy.

Mỗi tính năng có một thư mục `docs/ai-reviews/<tính-năng>/`:

| File | Ai viết | Nội dung |
|---|---|---|
| `PLAN.md` | Claude | Kế hoạch: mục tiêu, dữ liệu, luồng, rủi ro, các giai đoạn, test |
| `GEMINI_PLAN_REVIEW.md` | Gemini | Review kế hoạch |
| `GEMINI_CODE_REVIEW.md` | Gemini | Review code (git diff) |
| `review-input-*.md` | script | Nội dung tạm gửi đi (không commit) |

## Các bước

Claude **tự chạy** các bước review (2 và 5) và tự xử lý báo cáo. Bạn chỉ cần đọc tóm tắt Claude báo lại.

**Cách Claude gửi cho Gemini (ưu tiên theo thứ tự):**
1. **Gemini trên web, qua trình duyệt Chrome** (model mới nhất của gói Pro, hiện là Neon):
   - Claude tạo gói nội dung bằng `REVIEW_BUNDLE_ONLY=1 scripts/ai-review.sh plan|diff <tính-năng>`;
   - mở gemini.google.com, đính kèm file, gửi yêu cầu;
   - đọc câu trả lời, lưu vào `GEMINI_*_REVIEW.md` kèm phần "Claude kiểm chứng".
2. **`agy` (Antigravity CLI):**
   - chạy hoàn toàn trong terminal, nhưng gói của bạn chỉ có Gemini 3.8 Flash;
   - Gemini thường tự chạy lệnh terminal để đọc code, mà chế độ chạy nền tự chặn các lệnh đó nên hay dừng không có kết quả. Gói nội dung đã đính kèm sẵn file liên quan để giảm việc này.

1. **Lập kế hoạch:** nhờ Claude viết `PLAN.md`, chưa code.
2. **Review kế hoạch:** `scripts/ai-review.sh plan <tính-năng>`
3. **Chỉnh kế hoạch:** nói với Claude "đọc `GEMINI_PLAN_REVIEW.md`, kiểm chứng và chỉnh `PLAN.md`".
4. **Làm từng giai đoạn:** Claude làm từng giai đoạn, mỗi giai đoạn một commit, chạy `npm test` (và `npm run test:e2e` nếu có giao diện).
5. **Review code:** `scripts/ai-review.sh diff <tính-năng> <commit-trước-giai-đoạn>` (bỏ trống base thì review thay đổi chưa commit, hoặc commit gần nhất).
6. **Sửa lỗi:** nói với Claude "đọc `GEMINI_CODE_REVIEW.md`, kiểm chứng từng finding, sửa lỗi đúng kèm test, báo finding nào bác bỏ".
7. **Duyệt và deploy:** bạn duyệt rồi deploy (buổi tối).

Không cần review lại vô hạn: chỉ review lần hai cho phần rủi ro (tiền, điểm, phân quyền, dữ liệu).

## Cài Antigravity CLI cho tài khoản Gemini Pro (Google AI Pro)

Từ 18/06/2026, tài khoản cá nhân Google AI Pro/Ultra **không dùng được Gemini CLI** (`@google/gemini-cli`). Gói này đã chuyển sang **Antigravity CLI** (lệnh `agy`).

```bash
# 1. Cài (script chính thức của Google, cài vào ~/.local/bin/agy)
curl -fsSL https://antigravity.google/cli/install.sh | bash
agy --version

# 2. Đăng nhập một lần: mở trình duyệt, chọn "Google OAuth", đăng nhập tài khoản Gemini Pro
cd ~/workspace/eclass && agy        # đăng nhập xong gõ /quit để thoát

# 3. (Nên làm) Chặn reviewer ghi file / chạy lệnh
#    Sửa ~/.gemini/antigravity-cli/settings.json, thêm vào khối JSON:
#    "permissions": { "deny": ["write_file(*)", "command(*)"] }
#    (Chế độ --mode plan chỉ là lời dặn trong prompt, không chặn cứng.)

# 4. Xem các model của gói, chọn một nếu muốn (mặc định đã là model mạnh nhất của gói)
agy models
export REVIEW_MODEL=<tên-model>     # không bắt buộc
```

Script `scripts/ai-review.sh` tự dùng `agy` nếu có. Nếu chưa cài, script tạo sẵn file nội dung để bạn dán vào gemini.google.com và lưu câu trả lời vào đúng file báo cáo.

Script luôn kiểm tra `git status` trước và sau khi chạy. Nếu reviewer lỡ sửa file trong repo, nó sẽ cảnh báo.
