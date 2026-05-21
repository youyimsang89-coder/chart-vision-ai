import type { Metadata, Viewport } from "next";
import { Inter } from "next/font/google";
import "./globals.css";
import SessionProvider from "@/components/session-provider";

const inter = Inter({ subsets: ["latin"], display: "swap" });

const TITLE = "Chart Vision AI - AI 트레이딩 차트 분석";
const DESCRIPTION =
  "트레이딩 차트를 업로드하면 AI가 추세, 지지/저항선, 패턴, 롱/숏 시나리오를 분석합니다. Ctrl+V 붙여넣기를 지원합니다.";

export const metadata: Metadata = {
  metadataBase: new URL(process.env.NEXT_PUBLIC_SITE_URL ?? "http://localhost:3000"),
  title: { default: TITLE, template: "%s | Chart Vision AI" },
  description: DESCRIPTION,
  keywords: [
    "차트분석", "AI 분석", "트레이딩", "비트코인",
    "암호화폐", "기술적분석", "지지선", "저항선", "캔들", "TradingView",
  ],
  authors: [{ name: "Chart Vision AI" }],
  robots: { index: true, follow: true },
  openGraph: {
    type: "website",
    locale: "ko_KR",
    title: TITLE,
    description: DESCRIPTION,
    siteName: "Chart Vision AI",
  },
  twitter: {
    card: "summary_large_image",
    title: TITLE,
    description: DESCRIPTION,
  },
};

export const viewport: Viewport = {
  width: "device-width",
  initialScale: 1,
  themeColor: "#09090b",
};

export default function RootLayout({ children }: { children: React.ReactNode }) {
  return (
    <html lang="ko" className="dark" suppressHydrationWarning>
      <body className={`${inter.className} bg-zinc-950 antialiased`}>
        <SessionProvider>{children}</SessionProvider>
      </body>
    </html>
  );
}
