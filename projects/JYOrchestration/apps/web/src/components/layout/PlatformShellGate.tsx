"use client";

import type { ReactNode } from "react";
import { usePathname } from "next/navigation";
import { PlatformShell } from "@/components/layout/PlatformShell";

function isLoginPath(pathname: string): boolean {
  const p = (pathname.split("?")[0] || "/").trim() || "/";
  return p === "/login" || p.startsWith("/login/");
}

/** 로그인·비밀번호 찾기 등은 플랫폼 레일 없이 전체 화면으로 표시 */
export function PlatformShellGate({ children }: { readonly children: ReactNode }) {
  const pathname = usePathname() || "/";
  if (isLoginPath(pathname)) {
    return <>{children}</>;
  }
  return <PlatformShell>{children}</PlatformShell>;
}
