import type { Metadata } from "next";
import { Geist, Geist_Mono } from "next/font/google";
import "./globals.css";
import "@/lib/service/executionWorkerRuntime";
import "@/lib/service/aiActionWorkerRuntime";
import { ClientProviders } from "@/components/layout/ClientProviders";
import { PlatformShellGate } from "@/components/layout/PlatformShellGate";

const geistSans = Geist({
  variable: "--font-geist-sans",
  subsets: ["latin"],
});

const geistMono = Geist_Mono({
  variable: "--font-geist-mono",
  subsets: ["latin"],
});

export const metadata: Metadata = {
  title: "JY Orchestration",
  description: "프로젝트·요구사항·실행 워크플로를 관리하는 웹 앱",
};

export default function RootLayout({
  children,
}: Readonly<{
  children: React.ReactNode;
}>) {
  return (
    <html lang="ko" className={`${geistSans.variable} ${geistMono.variable} h-full antialiased`}>
      <body className="h-full min-h-0 flex flex-col">
        <ClientProviders>
          <div className="flex min-h-0 min-w-0 flex-1 flex-col">
            <PlatformShellGate>{children}</PlatformShellGate>
          </div>
        </ClientProviders>
      </body>
    </html>
  );
}
