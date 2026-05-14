import type { Metadata } from "next";
import { Inter, Montserrat } from "next/font/google";
import { Toaster } from "sonner";
import Header from "@/components/layout/Header";
import { Providers } from "./providers";
import VConsole from "@/components/VConsole";
import "./globals.css";

const inter = Inter({
  variable: "--font-inter",
  subsets: ["latin"],
});

const montserrat = Montserrat({
  variable: "--font-montserrat",
  subsets: ["latin"],
});

export const metadata: Metadata = {
  title: "thatdehoctoan - Luyện Thi Đại Học",
  description:
    "Trang web học Toán luyện thi Đại học hàng đầu, đồng hành cùng học sinh vượt qua kỳ thi THPT Quốc gia với thatdehoctoan.",
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
        className={`${inter.variable} ${montserrat.variable} antialiased`}
      >
        <Providers>
          <VConsole />
          <Toaster position="top-right" richColors />
          <Header />
          {children}
        </Providers>
      </body>
    </html>
  );
}
