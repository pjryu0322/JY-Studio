"use client";

import { usePathname } from "next/navigation";
import { Suspense, useMemo } from "react";
import { PlatformTopNav } from "@/components/layout/PlatformTopNav";

/**
 * 플랫폼 좌측 레일(내비·작업메모 등) 표시 여부.
 * 서비스 기획·구현·검토 등 프로젝트 워크플로 단계 화면과 홈·지식팩 등에서는 표시한다.
 * 로그인·회원가입(`/login`)·메신저 전용 창 등은 레일을 두지 않는다.
 */
export function platformTopNavVisibleForPath(pathname: string): boolean {
  const p = (pathname.split("?")[0] || "/").trim() || "/";

  if (p === "/login" || p.startsWith("/login/")) return false;

  /** 메신저 대화방 전용 창: 본문만 보이도록 좌측 플랫폼 레일 숨김 */
  if (p.startsWith("/chat/")) return false;

  /** 지식팩 상세 팝업 전용 라우트: 본문만 보이도록 레일 숨김 */
  if (p === "/knowledge-packs/detail" || p.startsWith("/knowledge-packs/detail/")) return false;

  if (p === "/") return true;

  if (p === "/knowledge-packs" || p.startsWith("/knowledge-packs/")) return true;

  // 프로젝트 워크플로 단계 — 레일에서 기획·구현·검토 전환 시에도 유지
  if (p === "/requirements" || p.startsWith("/requirements/")) return true;
  if (p === "/execution" || p.startsWith("/execution/")) return true;
  if (p === "/prototype-review" || p.startsWith("/prototype-review/")) return true;
  if (p === "/features") return false;
  if (p === "/tasks") return false;
  if (p === "/trace") return false;
  if (p === "/planning-execution") return false;
  if (p.startsWith("/projects/")) return false;
  if (p.startsWith("/collaboration/")) return false;

  return true;
}

export function PlatformTopNavGate() {
  const pathname = usePathname() || "/";
  const visible = useMemo(() => platformTopNavVisibleForPath(pathname), [pathname]);

  if (!visible) return null;

  return (
    <Suspense
      fallback={
        <div
          style={{
            width: 52,
            flexShrink: 0,
            alignSelf: "stretch",
            borderRight: "1px solid #e2e8f0",
            background: "rgba(255,255,255,0.92)",
          }}
          aria-hidden
        />
      }
    >
      <PlatformTopNav />
    </Suspense>
  );
}
