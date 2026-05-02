"use client";

import type { ReactNode } from "react";
import { useWorkspaceMode } from "@/components/layout/WorkspaceModeContext";

/**
 * 플랫폼 본문 폭·작업모드 클래스. 프로토타입 실행 설정과 무관한 UI 전용입니다.
 */
export function PlatformMainFrame({ children }: { readonly children: ReactNode }) {
  const { effectiveLayout } = useWorkspaceMode();
  const cls = `jyo-platform-main jyo-workspace-${effectiveLayout.toLowerCase()}`;
  return (
    <div
      className={cls}
      style={{
        margin: "0 auto",
        width: "100%",
        boxSizing: "border-box",
      }}
    >
      {children}
    </div>
  );
}
