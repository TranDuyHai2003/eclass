#!/usr/bin/env bash
# Gửi kế hoạch hoặc git diff cho Gemini review (chỉ đọc), lưu báo cáo vào docs/ai-reviews/<tính-năng>/.
#
#   scripts/ai-review.sh plan <tính-năng>          # review docs/ai-reviews/<tính-năng>/PLAN.md
#   scripts/ai-review.sh diff <tính-năng> [base]   # review thay đổi code
#        base bỏ trống: còn thay đổi chưa commit → so với HEAD; sạch → commit gần nhất (HEAD~1..HEAD)
#        base = mã commit/nhánh (vd master~3): mọi thay đổi từ base tới hiện tại (kể cả chưa commit)
#
# Công cụ chạy review (tự chọn theo thứ tự):
#   1. REVIEW_CMD   — lệnh tuỳ chọn, prompt được thêm làm tham số cuối (vd REVIEW_CMD="agy -p")
#   2. agy          — Antigravity CLI (tài khoản Google AI Pro/Ultra cá nhân)
#   3. gemini       — Gemini CLI (chỉ dùng được với API key / tài khoản tổ chức)
#   4. không có CLI — tạo sẵn file nội dung để dán vào gemini.google.com
# Biến khác: REVIEW_MODEL (xem `agy models`), REVIEW_TIMEOUT (mặc định 20m), REVIEW_NO_CLIPBOARD=1 (không chép vào clipboard).
set -euo pipefail

usage() {
  sed -n '2,15p' "$0" | sed 's/^# \{0,1\}//'
  exit 1
}

kind="${1:-}"
feature="${2:-}"
[[ "$kind" == "plan" || "$kind" == "diff" ]] || usage
[[ "$feature" =~ ^[a-z0-9][a-z0-9._-]*$ ]] || { echo "Tên tính năng chỉ gồm chữ thường, số, '-', '_', '.' (vd: gamified-ui)"; exit 1; }

root="$(git rev-parse --show-toplevel)"
cd "$root"
dir="docs/ai-reviews/$feature"
mkdir -p "$dir"
input="$dir/review-input-$kind.md" # đã có trong .gitignore
if [[ "$kind" == "plan" ]]; then out="$dir/GEMINI_PLAN_REVIEW.md"; else out="$dir/GEMINI_CODE_REVIEW.md"; fi

# Không gửi các file không liên quan / quá dài
excludes=(":(exclude)package-lock.json" ":(exclude)README.md" ":(exclude)README.vi.md" ":(exclude)docs/ai-reviews/**" ":(exclude)*.png" ":(exclude)*.jpg" ":(exclude)*.webp")

# ------------------------------------------------------------------ nội dung cần review
{
  echo "# Yêu cầu review ($kind) — tính năng: $feature"
  echo
  echo "Bối cảnh dự án, các bất biến cần giữ và ĐỊNH DẠNG BÁO CÁO nằm trong file GEMINI.md ở thư mục gốc — hãy đọc trước."
  echo "Bạn chỉ được ĐỌC (đọc file, tìm kiếm). Không tạo/sửa/xoá file, không chạy lệnh làm thay đổi gì. In báo cáo ra màn hình."
  echo
  if [[ "$kind" == "plan" ]]; then
    [[ -f "$dir/PLAN.md" ]] || { echo "Thiếu $dir/PLAN.md" >&2; exit 1; }
    echo "Hãy review KẾ HOẠCH dưới đây so với code hiện có (mở các file được nhắc tới để kiểm chứng)."
    echo "Tìm: chỗ không khớp kiến trúc, rủi ro dữ liệu/race condition, phân quyền, trường hợp biên còn thiếu, phần làm thừa/phức tạp không cần thiết, rủi ro giao diện (điện thoại 320px, hiệu năng, hydration)."
    echo "Không viết lại toàn bộ thiết kế; chỉ nêu các điểm cụ thể, có thể hành động."
    echo
    echo "---------------------------------------------------------------- PLAN.md"
    cat "$dir/PLAN.md"
  else
    base="${3:-}"
    if [[ -z "$base" ]]; then
      if [[ -n "$(git status --porcelain -- . "${excludes[@]}")" ]]; then
        range=(HEAD); label="thay đổi chưa commit so với HEAD"
      else
        range=(HEAD~1 HEAD); label="commit gần nhất ($(git log -1 --format='%h %s'))"
      fi
    else
      git rev-parse --verify --quiet "$base^{commit}" >/dev/null || { echo "Không tìm thấy base '$base'" >&2; exit 1; }
      range=("$base"); label="từ $base tới hiện tại"
    fi
    echo "Hãy review CÁC THAY ĐỔI CODE dưới đây ($label). Mở thêm file xung quanh khi cần để hiểu ngữ cảnh."
    echo "Chỉ báo lỗi có bằng chứng: đúng/sai logic, race condition, ranh giới transaction, phân quyền, cộng điểm trùng, đổi quà trùng, tồn kho, giao diện vỡ trên điện thoại, thiếu test cho logic rủi ro."
    echo
    echo "---------------------------------------------------------------- git diff --stat"
    git diff --stat "${range[@]}" -- . "${excludes[@]}"
    echo
    echo "---------------------------------------------------------------- git diff"
    git diff "${range[@]}" -- . "${excludes[@]}"
    # File mới chưa được git theo dõi (git diff không hiện)
    if [[ "${range[*]}" != "HEAD~1 HEAD" ]]; then
      while IFS= read -r f; do
        [[ -z "$f" ]] && continue
        echo
        echo "---------------------------------------------------------------- FILE MỚI (chưa add): $f"
        head -c 60000 "$f"
      done < <(git ls-files --others --exclude-standard -- . "${excludes[@]}")
    fi
  fi
} > "$input"

size=$(wc -c < "$input")
echo "→ Đã tạo nội dung review: $input ($((size / 1024)) KB)"

prompt="$(cat "$input")"
timeout="${REVIEW_TIMEOUT:-20m}"
before="$(git status --porcelain)"

run_ok=0
if [[ -n "${REVIEW_CMD:-}" ]] || command -v agy >/dev/null || command -v gemini >/dev/null; then
  # Một tham số dòng lệnh tối đa ~128 KB trên Linux
  if (( size > 120000 )); then
    echo "✖ Nội dung quá lớn để gửi một lần ($((size / 1024)) KB). Hãy review từng phần nhỏ hơn (chọn base gần hơn), hoặc dán file $input vào gemini.google.com." >&2
    exit 1
  fi
  tmp="$(mktemp)"
  errlog="$dir/.review-stderr.log"
  echo "→ Đang gửi cho reviewer… (tối đa $timeout)"
  if [[ -n "${REVIEW_CMD:-}" ]]; then
    read -ra cmd <<< "$REVIEW_CMD"
    "${cmd[@]}" "$prompt" > "$tmp" 2> "$errlog" && run_ok=1
  elif command -v agy >/dev/null; then
    args=(-p "$prompt" --mode plan --output-format text --print-timeout "$timeout")
    [[ -n "${REVIEW_MODEL:-}" ]] && args+=(--model "$REVIEW_MODEL")
    agy "${args[@]}" > "$tmp" 2> "$errlog" && run_ok=1
  else
    args=(-p "$prompt" --approval-mode plan --output-format text)
    [[ -n "${REVIEW_MODEL:-}" ]] && args+=(--model "$REVIEW_MODEL")
    gemini "${args[@]}" > "$tmp" 2> "$errlog" && run_ok=1
  fi

  if [[ "$run_ok" == 1 && -s "$tmp" ]]; then
    mv "$tmp" "$out"
    echo "✔ Báo cáo: $out"
  else
    rm -f "$tmp"
    echo "✖ Reviewer không trả kết quả. Xem $errlog" >&2
    if grep -qi "authentication required\|login\|sign in" "$errlog" 2>/dev/null; then
      echo "  → Có vẻ chưa đăng nhập: chạy 'agy' một lần trong terminal để đăng nhập Google." >&2
    fi
    exit 1
  fi
  if grep -qiE "denied|not allowed|permission" "$errlog" 2>/dev/null; then
    echo "ℹ Reviewer đã thử một thao tác bị chặn (đúng như mong muốn — xem $errlog)."
  fi

  # Lưới an toàn: reviewer không được sửa repo
  after="$(git status --porcelain)"
  if [[ "$before" != "$after" ]]; then
    echo "⚠ CẢNH BÁO: trạng thái repo đã thay đổi trong lúc review — reviewer có thể đã sửa file:" >&2
    diff <(echo "$before") <(echo "$after") >&2 || true
    echo "  Kiểm tra bằng 'git status' / 'git diff' và hoàn tác nếu cần." >&2
  fi
else
  echo
  echo "Chưa cài Antigravity CLI (agy). Cách thủ công:"
  echo "  1. Mở https://gemini.google.com (tài khoản Gemini Pro)"
  echo "  2. Dán toàn bộ nội dung file: $input"
  echo "     (đính kèm thêm GEMINI.md để Gemini biết bối cảnh và định dạng báo cáo)"
  echo "  3. Lưu câu trả lời vào: $out"
  if [[ -z "${REVIEW_NO_CLIPBOARD:-}" ]] && command -v xclip >/dev/null; then
    xclip -selection clipboard < "$input" >/dev/null 2>&1 && echo "  (Đã chép nội dung vào clipboard)"
  fi
  exit 0
fi

echo
echo "Bước tiếp theo — trong Claude Code, gõ:"
echo "  Đọc $out, kiểm chứng từng finding với code thật (không tin mù quáng), sửa các lỗi đúng kèm test, báo lại finding nào bác bỏ và vì sao."
