"use client";

import { ProjectWorkflowNav } from "@/components/layout/ProjectWorkflowNav";
import { uiTokens as t } from "@/components/ui/tokens";

export function RequirementsHeader({
  showProjectWorkflowNav,
  hideCompactWorkflowTitle,
}: {
  /** 프로젝트가 열려 있을 때 워크플로·멤버/설정 탭을 헤더 하단에 표시 */
  readonly showProjectWorkflowNav: boolean;
  /** 모바일(컴팩트)에서 단계 라벨(예: "서비스 기획") 한 줄만 뜨는 것을 숨김 */
  readonly hideCompactWorkflowTitle?: boolean;
}) {
  if (!showProjectWorkflowNav) return null;

  return (
    <header
      style={{
        display: "flex",
        flexDirection: "column",
        gap: 0,
        padding: "0 0 14px",
        borderBottom: `1px solid ${t.border}`,
      }}
    >
      <div className="relative" style={{ position: "relative", width: "100%" }}>        <ProjectWorkflowNav hideCompactTitle={hideCompactWorkflowTitle} />
      </div>
    </header>
  );
}
