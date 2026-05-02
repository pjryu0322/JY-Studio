"use client";

import { LAYOUT_MOBILE_BREAKPOINT, useLayoutMobileBreakpoint } from "@/components/ui/breakpoints";

export { LAYOUT_MOBILE_BREAKPOINT, MEDIA_QUERY } from "@/components/ui/breakpoints";

/**
 * 레이아웃용 뷰포트 구간. `matchMedia` 기준으로 모바일 셸 여부를 판별합니다.
 *
 * - `isMobile` / `isDesktop`: `MEDIA_QUERY.layoutMobile` 기준.
 * - `width`: **실측 픽셀이 아니라** 레이아웃 분류용 대표값입니다(브레이크포인트 ±1).
 *   실제 창 너비가 필요하면 별도 `resize` 측정 훅을 사용하세요.
 */
export function useViewport(): {
  width: number;
  isMobile: boolean;
  isDesktop: boolean;
} {
  const isMobile = useLayoutMobileBreakpoint();
  const width = isMobile ? LAYOUT_MOBILE_BREAKPOINT - 1 : LAYOUT_MOBILE_BREAKPOINT;
  return { width, isMobile, isDesktop: !isMobile };
}
