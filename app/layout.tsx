import type { Metadata, Viewport } from "next";
import { Plus_Jakarta_Sans, Outfit } from "next/font/google";
import { Toaster } from "sonner";
import Header from "@/components/layout/Header";
import DemoBanner from "@/components/layout/DemoBanner";
import { Providers } from "./providers";
import AntiInspectLayout from "@/components/layout/AntiInspectLayout";
import { WatchRouteTracker } from "@/components/layout/WatchRouteTracker";
import "./globals.css";
import { isPointsEnabled } from "@/lib/points/config";

const sansFont = Plus_Jakarta_Sans({
  variable: "--font-jakarta",
  subsets: ["latin", "vietnamese"],
});

const headingFont = Outfit({
  variable: "--font-outfit",
  subsets: ["latin"],
});

export const metadata: Metadata = {
  metadataBase: new URL("https://teacherduc.me"),
  title: {
    default: "thatdehoctoan - Luyện Thi Đại Học Môn Toán",
    template: "%s | thatdehoctoan"
  },
  description:
    "Hệ thống học Toán luyện thi Đại học hàng đầu. Cung cấp lộ trình học bài bản, livestream tương tác và kho đề thi thử THPT Quốc gia bứt phá điểm số.",
  keywords: ["học toán online", "luyện thi đại học môn toán", "toán thpt quốc gia", "thầy đức dạy toán", "thatdehoctoan", "toán 12", "đề thi thử toán"],
  authors: [{ name: "Thầy Đức", url: "https://teacherduc.me" }],
  creator: "thatdehoctoan",
  publisher: "thatdehoctoan",
  robots: {
    index: true,
    follow: true,
    googleBot: {
      index: true,
      follow: true,
      "max-video-preview": -1,
      "max-image-preview": "large",
      "max-snippet": -1,
    },
  },
  icons: {
    // Biểu tượng đúng kích thước (trước dùng logo 470×531, 256KB cho cả favicon)
    icon: [{ url: "/icon-32.png", sizes: "32x32", type: "image/png" }],
    apple: [{ url: "/apple-icon-180.png", sizes: "180x180", type: "image/png" }],
  },
  openGraph: {
    type: "website",
    locale: "vi_VN",
    url: "https://teacherduc.me",
    title: "thatdehoctoan - Luyện Thi Đại Học Môn Toán",
    description: "Hệ thống học Toán online hàng đầu, bứt phá điểm số kỳ thi THPT Quốc gia.",
    siteName: "thatdehoctoan",
    images: [
      {
        url: "/logo.png?v=1",
        width: 470,
        height: 531,
        alt: "thatdehoctoan - Luyện Thi Đại Học",
      },
    ],
  },
  twitter: {
    card: "summary_large_image",
    title: "thatdehoctoan - Luyện Thi Đại Học Môn Toán",
    description: "Hệ thống học Toán online hàng đầu, bứt phá điểm số kỳ thi THPT Quốc gia.",
    images: ["/logo.png?v=1"],
    creator: "@thatdehoctoan",
  },
  alternates: {
    canonical: "https://teacherduc.me",
  },
  verification: {
    google: "google-site-verification-id", // User should update this with their actual ID
  },
};

export const viewport: Viewport = {
  width: "device-width",
  initialScale: 1,
  maximumScale: 1,
  userScalable: false,
};

export default function RootLayout({
  children,
}: Readonly<{
  children: React.ReactNode;
}>) {
  const jsonLd = {
    "@context": "https://schema.org",
    "@type": "Organization",
    "name": "thatdehoctoan",
    "url": "https://teacherduc.me",
    "logo": "https://teacherduc.me/logo.png?v=1",
    "sameAs": [
      "https://facebook.com/thatdehoctoan",
      "https://youtube.com/thatdehoctoan"
    ],
    "description": "Hệ thống học Toán luyện thi Đại học hàng đầu Việt Nam."
  };

  return (
    <html lang="vi">
      <head>
        <script
          dangerouslySetInnerHTML={{
            __html: `
              if (typeof Promise.withResolvers === 'undefined') {
                Promise.withResolvers = function () {
                  var resolve, reject;
                  var promise = new Promise(function (res, rej) {
                    resolve = res;
                    reject = rej;
                  });
                  return { promise: promise, resolve: resolve, reject: reject };
                };
              }
            `,
          }}
        />
        <script
          type="application/ld+json"
          dangerouslySetInnerHTML={{ __html: JSON.stringify(jsonLd) }}
        />
      </head>
      <body
        suppressHydrationWarning
        className={`${sansFont.variable} ${headingFont.variable} antialiased text-[15px] sm:text-base leading-relaxed`}
      >
        <Providers pointsEnabled={isPointsEnabled()}>
          <WatchRouteTracker />
          <AntiInspectLayout>
            <Toaster position="top-right" richColors toastOptions={{ className: "p-4" }} gap={12} />
            <DemoBanner />
            <Header />
            {children}
          </AntiInspectLayout>
        </Providers>
      </body>
    </html>
  );
}
