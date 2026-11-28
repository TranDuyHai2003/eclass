/*
 * 28/11/2026: phông tự lưu (gói @fontsource trong node_modules) thay next/font/google — Google Fonts lúc trả đường dẫn
 * phông kiểu "fonts.gstatic.com/l/font?kit=…&skey=…" làm Turbopack (Next 16.1) báo
 * "next/font/google queries have exactly one entry" → build Heroku / CI hỏng lúc được lúc không. Giờ build không cần mạng.
 * Chỉ nạp bảng chữ latin, latin-ext, tiếng Việt. Lớp `.variable` gắn biến CSS như next/font (nơi dùng giữ nguyên).
 */

import "@fontsource/mali/latin-500.css";
import "@fontsource/mali/latin-ext-500.css";
import "@fontsource/mali/vietnamese-500.css";
import "@fontsource/mali/latin-600.css";
import "@fontsource/mali/latin-ext-600.css";
import "@fontsource/mali/vietnamese-600.css";
import "@fontsource/mali/latin-700.css";
import "@fontsource/mali/latin-ext-700.css";
import "@fontsource/mali/vietnamese-700.css";
import "@fontsource-variable/nunito/wght.css";
import "./shop.css";

/** Theme "Adorable Home" của Tiệm quà: Mali (chữ viết tay, nút) + Nunito (chữ thường) */
export const mali = { variable: "font-var-mali" };
export const nunito = { variable: "font-var-nunito" };
