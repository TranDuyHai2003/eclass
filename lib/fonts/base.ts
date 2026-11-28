/*
 * 28/11/2026: phông tự lưu (gói @fontsource trong node_modules) thay next/font/google — Google Fonts lúc trả đường dẫn
 * phông kiểu "fonts.gstatic.com/l/font?kit=…&skey=…" làm Turbopack (Next 16.1) báo
 * "next/font/google queries have exactly one entry" → build Heroku / CI hỏng lúc được lúc không. Giờ build không cần mạng.
 * Chỉ nạp bảng chữ latin, latin-ext, tiếng Việt. Lớp `.variable` gắn biến CSS như next/font (nơi dùng giữ nguyên).
 */

import "@fontsource-variable/plus-jakarta-sans/wght.css";
import "@fontsource-variable/outfit/wght.css";
import "./base.css";

/** Phông chung toàn site (layout gốc): Plus Jakarta Sans (chữ thường) + Outfit (tiêu đề) */
export const sansFont = { variable: "font-var-jakarta" };
export const headingFont = { variable: "font-var-outfit" };
