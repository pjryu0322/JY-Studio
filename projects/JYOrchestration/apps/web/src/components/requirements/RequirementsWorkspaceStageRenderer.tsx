"use client";

import type { ReactNode } from "react";

/**
 * 서비스 기획 워크스페이스는 항상 동일한 SingleChat 표면(통합 대화)만 노출한다.
 * 내부 `activeStage`(ideation / service-flow / feature-planning / implementation)는 URL·상태로 유지되며
 * 전송·오케스트레이션 라우팅에만 쓰인다. `/execution`은 동일 표면 + implementation mode 오케스트레이션.
 */
export function RequirementsWorkspaceStageRenderer({ singleChatSurface }: { readonly singleChatSurface: ReactNode }) {
  return <>{singleChatSurface}</>;
}
