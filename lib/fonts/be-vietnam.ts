/*
 * 28/11/2026: phông tự lưu (gói @fontsource trong node_modules) thay next/font/google — Google Fonts lúc trả đường dẫn
 * phông kiểu "fonts.gstatic.com/l/font?kit=…&skey=…" làm Turbopack (Next 16.1) báo
 * "next/font/google queries have exactly one entry" → build Heroku / CI hỏng lúc được lúc không. Giờ build không cần mạng.
 * Chỉ nạp bảng chữ latin, latin-ext, tiếng Việt. Lớp `.variable` gắn biến CSS như next/font (nơi dùng giữ nguyên).
 */

import "@fontsource/be-vietnam-pro/latin-400.css";
import "@fontsource/be-vietnam-pro/latin-ext-400.css";
import "@fontsource/be-vietnam-pro/vietnamese-400.css";
import "@fontsource/be-vietnam-pro/latin-500.css";
import "@fontsource/be-vietnam-pro/latin-ext-500.css";
import "@fontsource/be-vietnam-pro/vietnamese-500.css";
import "@fontsource/be-vietnam-pro/latin-600.css";
import "@fontsource/be-vietnam-pro/latin-ext-600.css";
import "@fontsource/be-vietnam-pro/vietnamese-600.css";
import "@fontsource/be-vietnam-pro/latin-700.css";
import "@fontsource/be-vietnam-pro/latin-ext-700.css";
import "@fontsource/be-vietnam-pro/vietnamese-700.css";
import "@fontsource/be-vietnam-pro/latin-800.css";
import "@fontsource/be-vietnam-pro/latin-ext-800.css";
import "@fontsource/be-vietnam-pro/vietnamese-800.css";
import "./be-vietnam.css";

/** Đăng nhập / Khoá học / Hồ sơ / Trang chủ khách */
export const beVietnam = { variable: "font-var-bvp" };
