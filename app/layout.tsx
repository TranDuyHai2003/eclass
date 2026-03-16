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
  title: "E-Class - Hệ thống học tập trực tuyến",
  description: "Nền tảng học tập trực tuyến hiện đại",
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
