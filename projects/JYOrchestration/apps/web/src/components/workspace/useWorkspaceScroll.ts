"use client";

import { useEffect, useRef } from "react";

/**
 * 메시지 등 콘텐츠 변경 시 하단으로 스크롤(기존 요구사항 채팅과 동일한 requestAnimationFrame 패턴).
 * 이후 단계에서 사용자 스크롤 위치를 존중하는 옵션을 추가할 수 있습니다.
 */
export function useWorkspaceScrollToEnd(contentKey: unknown) {
  const endRef = useRef<HTMLDivElement | null>(null);

  useEffect(() => {
    const id = window.requestAnimationFrame(() => {
      endRef.current?.scrollIntoView({ behavior: "smooth", block: "end" });
    });
    return () => window.cancelAnimationFrame(id);
  }, [contentKey]);

  return endRef;
}
