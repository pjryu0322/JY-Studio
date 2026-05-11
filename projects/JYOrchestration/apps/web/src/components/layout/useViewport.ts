"use client";

import { useWorkspaceModeOptional } from "@/components/layout/WorkspaceModeContext";
import { LAYOUT_MOBILE_BREAKPOINT, useLayoutMobileBreakpoint } from "@/components/ui/breakpoints";

export { LAYOUT_MOBILE_BREAKPOINT, MEDIA_QUERY } from "@/components/ui/breakpoints";

/**
 * 레이아웃용 뷰포트 구간.
 *
 * - `WorkspaceModeProvider`가 있으면 **화면 레이아웃(DESKTOP / MOBILE / AUTO)** 의 유효 레이아웃을 반영합니다.
 * - 없으면 `MEDIA_QUERY.layoutMobile`(1024px 미만)만 사용합니다.
 * - `width`: 레이아웃 분류용 대표값(브레이크포인트 ±1).
 */
export function useViewport(): {
  width: number;
  isMobile: boolean;
  isDesktop: boolean;
} {
  const wm = useWorkspaceModeOptional();
  const layoutMqIsMobile = useLayoutMobileBreakpoint();
  const isMobile = wm ? wm.effectiveLayout === "MOBILE" : layoutMqIsMobile;
  const width = isMobile ? LAYOUT_MOBILE_BREAKPOINT - 1 : LAYOUT_MOBILE_BREAKPOINT;
  return { width, isMobile, isDesktop: !isMobile };
}
