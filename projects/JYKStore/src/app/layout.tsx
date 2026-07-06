import type { Metadata } from "next";
import "./globals.css";

export const metadata: Metadata = {
  title: "JYKStore",
  description: "모바일 앱스토어형 지식팩 스토어",
};

export default function RootLayout({ children }: Readonly<{ children: React.ReactNode }>) {
  return (
    <html lang="ko">
      <body>{children}</body>
    </html>
  );
}
