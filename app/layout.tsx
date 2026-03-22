import type { Metadata } from "next";
import { Inter, Montserrat } from "next/font/google";
import { Toaster } from "sonner";
import Header from "@/components/layout/Header";
import { Providers } from "./providers";
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
  title: "Toán Thầy Đức - Luyện Thi Đại Học",
  description: "Trang web học Toán luyện thi Đại học hàng đầu, đồng hành cùng học sinh vượt qua kỳ thi THPT Quốc gia.",
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
      <body
        suppressHydrationWarning
        className={`${inter.variable} ${montserrat.variable} antialiased`}
      >
        <Providers>
          <Toaster position="top-right" richColors />
          <Header />
          {children}
        </Providers>
      </body>
    </html>
  );
}
