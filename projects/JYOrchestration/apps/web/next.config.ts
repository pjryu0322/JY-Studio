import type { NextConfig } from "next";

const extraOrigins =
  process.env.NEXT_EXTRA_DEV_ORIGINS?.split(",")
    .map((s) => s.trim())
    .filter(Boolean) ?? [];

const nextConfig: NextConfig = {
  /** LAN 등에서 dev 접속 시 HMR / _next 리소스 cross-origin 허용 (호스트[:포트], 프로토콜 없음) */
  allowedDevOrigins: [
    "192.168.45.37",
    "192.168.45.37:3000",
    "127.0.0.1",
    "127.0.0.1:3000",
    "localhost",
    "localhost:3000",
    ...extraOrigins,
  ],
};

export default nextConfig;
