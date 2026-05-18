"use client";

import { useMediaQuery } from "@/components/ui/useMediaQuery";

/**
 * 공통 `max-width` 미디어쿼리. 레이아웃·내비·컴포저가 같은 기준을 쓰도록 한곳에 둡니다.
 */
export const MEDIA_QUERY = {
  /** 요구사항 GPT 컴포저: 좁은 뷰에서 툴 메뉴 동작 전환 */
  composerNarrow: "(max-width: 640px)",
  /** 프로젝트 워크플로 내비: 모바일 스텝 선택 */
  workflowNavNarrow: "(max-width: 720px)",
  /** 프로토타입 검토: 프리뷰·채팅 탭 레이아웃 */
  prototypeReviewMobile: "(max-width: 760px)",
  /** 앱 셸·사이드 레이아웃 (`useViewport`와 동일) */
  layoutMobile: "(max-width: 1023px)",
} as const;

/** `MEDIA_QUERY.layoutMobile`과 맞는 분류용 너비(px). 실제 `window.innerWidth`가 아닙니다. */
export const LAYOUT_MOBILE_BREAKPOINT = 1024;

export function useLayoutMobileBreakpoint(): boolean {
  return useMediaQuery(MEDIA_QUERY.layoutMobile);
}

export function useWorkflowNavNarrowBreakpoint(): boolean {
  return useMediaQuery(MEDIA_QUERY.workflowNavNarrow);
}

export function useComposerNarrowBreakpoint(): boolean {
  return useMediaQuery(MEDIA_QUERY.composerNarrow);
}

export function usePrototypeReviewMobileLayout(): boolean {
  return useMediaQuery(MEDIA_QUERY.prototypeReviewMobile);
}
