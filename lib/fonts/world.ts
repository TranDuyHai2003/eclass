/*
 * 28/11/2026: phông tự lưu (gói @fontsource trong node_modules) thay next/font/google — Google Fonts lúc trả đường dẫn
 * phông kiểu "fonts.gstatic.com/l/font?kit=…&skey=…" làm Turbopack (Next 16.1) báo
 * "next/font/google queries have exactly one entry" → build Heroku / CI hỏng lúc được lúc không. Giờ build không cần mạng.
 * Chỉ nạp bảng chữ latin, latin-ext, tiếng Việt. Lớp `.variable` gắn biến CSS như next/font (nơi dùng giữ nguyên).
 */

import "@fontsource/chakra-petch/latin-500.css";
import "@fontsource/chakra-petch/latin-500-italic.css";
import "@fontsource/chakra-petch/latin-ext-500.css";
import "@fontsource/chakra-petch/latin-ext-500-italic.css";
import "@fontsource/chakra-petch/vietnamese-500.css";
import "@fontsource/chakra-petch/vietnamese-500-italic.css";
import "@fontsource/chakra-petch/latin-600.css";
import "@fontsource/chakra-petch/latin-600-italic.css";
import "@fontsource/chakra-petch/latin-ext-600.css";
import "@fontsource/chakra-petch/latin-ext-600-italic.css";
import "@fontsource/chakra-petch/vietnamese-600.css";
import "@fontsource/chakra-petch/vietnamese-600-italic.css";
import "@fontsource/chakra-petch/latin-700.css";
import "@fontsource/chakra-petch/latin-700-italic.css";
import "@fontsource/chakra-petch/latin-ext-700.css";
import "@fontsource/chakra-petch/latin-ext-700-italic.css";
import "@fontsource/chakra-petch/vietnamese-700.css";
import "@fontsource/chakra-petch/vietnamese-700-italic.css";
import "@fontsource/m-plus-rounded-1c/latin-500.css";
import "@fontsource/m-plus-rounded-1c/latin-ext-500.css";
import "@fontsource/m-plus-rounded-1c/vietnamese-500.css";
import "@fontsource/m-plus-rounded-1c/latin-700.css";
import "@fontsource/m-plus-rounded-1c/latin-ext-700.css";
import "@fontsource/m-plus-rounded-1c/vietnamese-700.css";
import "@fontsource/m-plus-rounded-1c/latin-800.css";
import "@fontsource/m-plus-rounded-1c/latin-ext-800.css";
import "@fontsource/m-plus-rounded-1c/vietnamese-800.css";
import "./world.css";

/** Game Thế giới Toán: Chakra Petch (tiêu đề / số / nút) + M PLUS Rounded 1c (thân chữ tròn) — chỉ game import */
export const chakra = { variable: "font-var-chakra" };
export const mplus = { variable: "font-var-mplus" };
