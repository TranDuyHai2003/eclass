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
