"use client";

import type { CSSProperties, ReactNode } from "react";
import { ProjectWorkflowNav } from "@/components/layout/ProjectWorkflowNav";
import { WorkNoteChatSelectionBridgeProvider } from "@/components/worknote/WorkNoteChatSelectionBridge";
import { StageWorkspaceLayout } from "@/components/workspace/StageWorkspaceLayout";
import { WorkflowPageHeader } from "@/components/workflow/primitives/WorkflowPageHeader";

/**
 * 아이디어 구체화 외 단계(기능 정리·프로토타입 생성 등)에서 반복되던
 * [페이지 헤더 → 워크플로 내비 → 스테이지 본문] 패턴을 한 곳으로 맞춥니다.
 */
export function WorkflowStageChrome({
  title,
  subtitle,
  right,
  backHref,
  backLabel,
  stageLayoutStyle,
  workNoteProjectId,
  hideWorkflowNav,
  children,
}: {
  readonly title?: string | null;
  readonly subtitle?: string;
  readonly right?: ReactNode;
  readonly backHref?: string;
  readonly backLabel?: string;
  /** 단계 본문(`StageWorkspaceLayout`)에만 적용. 예: 검토 화면에서 세로 공간 확보. */
  readonly stageLayoutStyle?: CSSProperties;
  /** 지정 시 대화 선택 → 작업메모 브리지(내비의 작업메모 버튼과 동일 projectId) */
  readonly workNoteProjectId?: string;
  /** 프로젝트 레일에 단계가 있을 때 중복 워크플로 내비(모바일 단계 타이틀 포함) 숨김 */
  readonly hideWorkflowNav?: boolean;
  readonly children: ReactNode;
}) {
  const hasHeader = Boolean(String(title ?? "").trim()) || Boolean(String(subtitle ?? "").trim()) || Boolean(right) || Boolean(backHref);
  const body = (
    <div style={{ display: "flex", flexDirection: "column", flex: "1 1 auto", minHeight: 0, width: "100%" }}>
      {hasHeader ? (
        <WorkflowPageHeader title={title} subtitle={subtitle} right={right} backHref={backHref} backLabel={backLabel} />
      ) : null}

      {hideWorkflowNav ? null : (
        <div style={{ marginTop: hasHeader ? 12 : 0, marginBottom: 4, flexShrink: 0 }}>
          <ProjectWorkflowNav />
        </div>
      )}

      <div
        style={{
          marginTop: hideWorkflowNav ? 0 : 14,
          flex: "1 1 auto",
          minHeight: 0,
          display: "flex",
          flexDirection: "column",
          minWidth: 0,
        }}
      >
        <StageWorkspaceLayout style={stageLayoutStyle}>{children}</StageWorkspaceLayout>
      </div>
    </div>
  );
  const wid = String(workNoteProjectId ?? "").trim();
  if (wid) {
    return <WorkNoteChatSelectionBridgeProvider projectId={wid}>{body}</WorkNoteChatSelectionBridgeProvider>;
  }
  return body;
}
