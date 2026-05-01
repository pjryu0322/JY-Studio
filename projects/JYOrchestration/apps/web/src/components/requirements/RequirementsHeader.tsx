"use client";

import { ProjectWorkflowNav } from "@/components/layout/ProjectWorkflowNav";
import { ScreenLabel } from "@/components/ui/ScreenLabel";
import { useShowScreenLabels } from "@/components/ui/ScreenLabelsContext";
import { uiTokens as t } from "@/components/ui/tokens";

export function RequirementsHeader({
  showProjectWorkflowNav,
}: {
  /** 프로젝트가 열려 있을 때 워크플로·멤버/설정 탭을 헤더 하단에 표시 */
  readonly showProjectWorkflowNav: boolean;
}) {
  const showScreenLabels = useShowScreenLabels();

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
      <div className="relative" style={{ position: "relative", width: "100%" }}>
        <ScreenLabel label="요구사항-헤더-프로젝트정보" visible={showScreenLabels} />
        <ProjectWorkflowNav />
      </div>
    </header>
  );
}
