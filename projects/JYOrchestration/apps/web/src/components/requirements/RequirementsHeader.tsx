"use client";

import { ProjectWorkflowNav } from "@/components/layout/ProjectWorkflowNav";
import { ScreenLabel } from "@/components/ui/ScreenLabel";
import { useShowScreenLabels } from "@/components/ui/ScreenLabelsContext";

export function RequirementsHeader({
  projectName,
  showProjectWorkflowNav,
  ideationStatusLine,
}: {
  /** 실제 프로젝트명(또는 로딩·오류 시 사람이 읽을 수 있는 짧은 문구). raw projectId 축약 문자열 금지. */
  readonly projectName: string;
  /** 프로젝트가 열려 있을 때 워크플로·멤버/설정/추적 탭을 헤더 하단에 표시 */
  readonly showProjectWorkflowNav: boolean;
  /** 프로젝트 연결 시에만: 진행률 또는 완료 문구 */
  readonly ideationStatusLine?: string | null;
}) {
  const showScreenLabels = useShowScreenLabels();
  const status = (ideationStatusLine ?? "").trim();

  return (
    <header
      style={{
        display: "flex",
        flexDirection: "column",
        gap: 0,
        padding: "16px 0 18px",
        borderBottom: "1px solid #e2e8f0",
      }}
    >
      <div className="relative" style={{ position: "relative", minWidth: 0 }}>
        <ScreenLabel label="요구사항-헤더-프로젝트정보" visible={showScreenLabels} />
        <div
          style={{
            fontSize: 22,
            fontWeight: 800,
            color: "#0f172a",
            overflow: "hidden",
            textOverflow: "ellipsis",
            whiteSpace: "nowrap",
            letterSpacing: "-0.02em",
            minWidth: 0,
          }}
        >
          {projectName}
        </div>
        {status ? (
          <div
            style={{
              marginTop: 8,
              fontSize: 14,
              fontWeight: 700,
              color: status.includes("완료") ? "#047857" : "#475569",
              letterSpacing: "-0.01em",
            }}
          >
            {status}
          </div>
        ) : null}
      </div>

      {showProjectWorkflowNav ? (
        <div style={{ marginTop: 14, paddingTop: 14, borderTop: "1px solid #e2e8f0", width: "100%" }}>
          <ProjectWorkflowNav />
        </div>
      ) : null}
    </header>
  );
}
