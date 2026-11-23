import { Be_Vietnam_Pro, Mali, Nunito } from "next/font/google";

/** Chữ cho Tiệm quà & Hồ sơ (artifact thiết kế GĐ9) — chỉ nạp ở các trang này */
export const beVietnam = Be_Vietnam_Pro({ subsets: ["latin", "vietnamese"], weight: ["400", "500", "600", "700", "800"], variable: "--font-bvp", display: "swap" });

/** Theme "Adorable Home" của canvas Tiệm quà v2: Mali (chữ viết tay, nút) + Nunito (chữ thường) */
export const mali = Mali({ subsets: ["latin", "vietnamese"], weight: ["500", "600", "700"], variable: "--font-mali", display: "swap" });
export const nunito = Nunito({ subsets: ["latin", "vietnamese"], weight: ["600", "700", "800", "900"], variable: "--font-nunito", display: "swap" });
