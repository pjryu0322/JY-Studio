"use client";

import { usePathname } from "next/navigation";
import { Suspense, useMemo } from "react";
import { PlatformTopNav } from "@/components/layout/PlatformTopNav";

/**
 * 플랫폼 좌측 레일(내비·작업메모 등) 표시 여부.
 * 프로젝트 목록(홈 `/`)·일반 설정 화면에서는 표시하고,
 * 아이디어 구체화 및 그 이후 워크플로·프로젝트 작업 화면에서는 숨긴다.
 * 로그인·회원가입(`/login`)은 비로그인 전용이므로 레일을 두지 않는다.
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

  // 요구사항 화면은 좌측 레일(작업메모/알림/설정 등) 접근이 필요하므로 표시한다.
  if (p === "/requirements" || p.startsWith("/requirements/")) return true;
  if (p === "/features") return false;
  if (p === "/tasks") return false;
  if (p === "/execution") return false;
  if (p === "/prototype-review") return false;
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
