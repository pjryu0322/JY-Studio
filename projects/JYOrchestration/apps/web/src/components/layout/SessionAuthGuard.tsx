"use client";

import { usePathname, useRouter } from "next/navigation";
import { useEffect, useRef } from "react";

function isPublicAuthPath(pathname: string): boolean {
  const p = pathname.split("?")[0] || "/";
  return p === "/login" || p.startsWith("/login/");
}

/**
 * 미들웨어·RSC와 별도로 `/api/auth/me` 기준 세션을 확인한다.
 * 만료·삭제된 사용자 JWT, 미들웨어 미적용 경로 등에서 로그인 화면으로 보낸다.
 */
export function SessionAuthGuard() {
  const pathname = usePathname() || "/";
  const router = useRouter();
  const checkedRef = useRef<string | null>(null);

  useEffect(() => {
    if (isPublicAuthPath(pathname)) return;
    if (checkedRef.current === pathname) return;
    checkedRef.current = pathname;

    let cancelled = false;
    void (async () => {
      try {
        const res = await fetch("/api/auth/me", { credentials: "include", cache: "no-store" });
        const json = (await res.json()) as { success?: boolean; data?: { id?: string } | null };
        if (cancelled) return;
        const id = String(json.data?.id ?? "").trim();
        if (id) return;

        await fetch("/api/auth/logout", { method: "POST", credentials: "include" });
        const from = pathname.startsWith("/") && !pathname.startsWith("//") ? pathname : "/";
        const login = `/login?from=${encodeURIComponent(from)}`;
        router.replace(login);
      } catch {
        /* 네트워크 오류 시 화면 유지 */
      }
    })();

    return () => {
      cancelled = true;
    };
  }, [pathname, router]);

  return null;
}
