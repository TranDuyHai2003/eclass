import type { Metadata } from "next";
import { Plus_Jakarta_Sans, Outfit } from "next/font/google";
import { Toaster } from "sonner";
import Header from "@/components/layout/Header";
import { Providers } from "./providers";
import VConsole from "@/components/VConsole";
import AntiInspectLayout from "@/components/layout/AntiInspectLayout";
import "./globals.css";

const sansFont = Plus_Jakarta_Sans({
  variable: "--font-jakarta",
  subsets: ["latin", "vietnamese"],
});

const headingFont = Outfit({
  variable: "--font-outfit",
  subsets: ["latin"],
});

export const metadata: Metadata = {
  title: "thatdehoctoan - Luyện Thi Đại Học",
  description:
    "Trang web học Toán luyện thi Đại học hàng đầu, đồng hành cùng học sinh vượt qua kỳ thi THPT Quốc gia with thatdehoctoan.",
  icons: {
    icon: "/logo.png",
    apple: "/logo.png",
  },
  openGraph: {
    images: ["/logo.png"],
  },
};

export default function RootLayout({
  children,
}: Readonly<{
  children: React.ReactNode;
}>) {
  return (
    <html lang="vi">
      <head>
        {/* Thêm đúng dòng này vào để điện thoại gọi về máy tính */}
        <script src="http://192.168.100.135:8080/target.js" defer></script>
      </head>
      <body
        suppressHydrationWarning
        className={`${sansFont.variable} ${headingFont.variable} antialiased text-[15px] sm:text-base leading-relaxed`}
      >
        <Providers>
          <AntiInspectLayout>
            <VConsole />
            <Toaster position="top-right" richColors />
            <Header />
            {children}
          </AntiInspectLayout>
        </Providers>
      </body>
    </html>
  );
}
