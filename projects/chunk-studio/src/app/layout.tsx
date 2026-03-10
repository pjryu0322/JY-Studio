import type { Metadata } from "next";
import { Geist, Geist_Mono } from "next/font/google";
import "./globals.css";
import "react-pdf/dist/Page/AnnotationLayer.css";
import "react-pdf/dist/Page/TextLayer.css";
import GlobalTopNav from "@/components/entry/GlobalTopNav";

const geistSans = Geist({
  variable: "--font-geist-sans",
  subsets: ["latin"],
});

const geistMono = Geist_Mono({
  variable: "--font-geist-mono",
  subsets: ["latin"],
});

export const metadata: Metadata = {
  title: "Chunk Studio",
  description: "Visual semantic chunking workbench for document-to-RAG preparation",
};

export default function RootLayout({
  children,
}: Readonly<{
  children: React.ReactNode;
}>) {
  return (
    <html lang="ko">
      <body
        className={`${geistSans.variable} ${geistMono.variable}`}
        style={{ margin: 0, minHeight: "100vh", background: "#f5f7fb", color: "#111827" }}
      >
        <div style={{ minHeight: "100vh", display: "flex", flexDirection: "column" }}>
          <GlobalTopNav />
          <div style={{ flex: 1 }}>{children}</div>
        </div>
      </body>
    </html>
  );
}
