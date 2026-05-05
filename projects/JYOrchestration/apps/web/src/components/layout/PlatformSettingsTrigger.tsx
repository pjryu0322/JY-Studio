"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";
import { useLayoutMobileBreakpoint } from "@/components/ui/breakpoints";

function GearIcon() {
  return (
    <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.75" strokeLinecap="round" strokeLinejoin="round" aria-hidden>
      <path d="M12 15a3 3 0 1 0 0-6 3 3 0 0 0 0 6Z" />
      <path d="M19.4 15a1.65 1.65 0 0 0 .33 1.82l.06.06a2 2 0 0 1-2.83 2.83l-.06-.06a1.65 1.65 0 0 0-1.82-.33 1.65 1.65 0 0 0-1 1.51V21a2 2 0 0 1-4 0v-.09A1.65 1.65 0 0 0 9 19.4a1.65 1.65 0 0 0-1.82.33l-.06.06a2 2 0 1 1-2.83-2.83l.06-.06a1.65 1.65 0 0 0 .33-1.82 1.65 1.65 0 0 0-1.51-1H3a2 2 0 0 1 0-4h.09A1.65 1.65 0 0 0 4.6 9a1.65 1.65 0 0 0-.33-1.82l-.06-.06a2 2 0 1 1 2.83-2.83l.06.06A1.65 1.65 0 0 0 9 4.6V4a2 2 0 0 1 4 0v.09a1.65 1.65 0 0 0 1 1.51 1.65 1.65 0 0 0 1.82-.33l.06-.06a2 2 0 1 1 2.83 2.83l-.06.06a1.65 1.65 0 0 0-.33 1.82V9c.26.604.852 1 1.51 1H21a2 2 0 0 1 0 4h-.09a1.65 1.65 0 0 0-1.51 1Z" />
    </svg>
  );
}

/** 상단 헤더: `/settings` 본문 라우트로 이동합니다(알림·작업메모와 동일 패턴). */
export function PlatformSettingsTrigger() {
  const pathname = usePathname() || "/";
  const narrow = useLayoutMobileBreakpoint();
  const inSettings = pathname === "/settings" || pathname.startsWith("/settings/");

  return (
    <Link
      href="/settings"
      prefetch={false}
      aria-label="설정"
      title="설정"
      style={{
        display: "inline-flex",
        alignItems: "center",
        justifyContent: "center",
        width: narrow ? 44 : 40,
        height: narrow ? 40 : 36,
        padding: 0,
        borderRadius: 10,
        border: "1px solid #cbd5e1",
        background: inSettings ? "#f1f5f9" : "#fff",
        color: "#475569",
        cursor: "pointer",
        boxSizing: "border-box",
        textDecoration: "none",
      }}
    >
      <GearIcon />
    </Link>
  );
}
