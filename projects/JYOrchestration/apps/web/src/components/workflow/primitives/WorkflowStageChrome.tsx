"use client";

import type { ReactNode } from "react";
import { ProjectWorkflowNav } from "@/components/layout/ProjectWorkflowNav";
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
  children,
}: {
  readonly title: string;
  readonly subtitle?: string;
  readonly right?: ReactNode;
  readonly backHref?: string;
  readonly backLabel?: string;
  readonly children: ReactNode;
}) {
  return (
    <div>
      <WorkflowPageHeader title={title} subtitle={subtitle} right={right} backHref={backHref} backLabel={backLabel} />

      <div style={{ marginTop: 12, marginBottom: 4 }}>
        <ProjectWorkflowNav />
      </div>

      <div style={{ marginTop: 14 }}>
        <StageWorkspaceLayout>{children}</StageWorkspaceLayout>
      </div>
    </div>
  );
}
