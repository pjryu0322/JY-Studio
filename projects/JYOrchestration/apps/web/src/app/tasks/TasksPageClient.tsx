"use client";

import { useSearchParams } from "next/navigation";
import { useMemo } from "react";
import { ProjectWorkflowNav } from "@/components/layout/ProjectWorkflowNav";
import { TasksWorkspaceContent } from "@/components/workflow/TasksWorkspaceContent";
import { WorkflowCard } from "@/components/workflow/primitives/WorkflowCard";
import { WorkflowEmptyState } from "@/components/workflow/primitives/WorkflowEmptyState";
import { WorkflowPageHeader } from "@/components/workflow/primitives/WorkflowPageHeader";
import { WorkflowDemoSampleBanner } from "@/components/workflow/primitives/WorkflowDemoSampleBanner";
import { getTasksPageSubtitle, getTasksWorkspaceView } from "@/lib/workflow/tasksWorkspaceViewModel";
import { useCollaborationSessionResultsVersion } from "@/lib/workflow/useCollaborationSessionResultsSync";

export function TasksPageClient() {
  const search = useSearchParams();
  const sessionResultsVersion = useCollaborationSessionResultsVersion();

  const requirementId = search?.get("requirementId")?.trim() || null;
  const sessionId = search?.get("sessionId")?.trim() || null;

  const view = useMemo(() => getTasksWorkspaceView({ requirementId, sessionId }), [requirementId, sessionId, sessionResultsVersion]);

  const hasContext = Boolean(view.requirementId || view.sessionId);

  return (
    <div>
      <WorkflowPageHeader
        title="작업 정리"
        subtitle={getTasksPageSubtitle(view, hasContext)}
      />

      <div style={{ marginTop: 12, marginBottom: 4 }}>
        <ProjectWorkflowNav />
      </div>

      <div style={{ marginTop: 14, display: "grid", gap: 14 }}>
        {!view.found ? (
          <WorkflowEmptyState title="컨텍스트를 찾을 수 없음" message={view.notFoundReason ?? "URL을 확인하세요."} />
        ) : null}

        {view.found && !hasContext ? (
          <WorkflowCard padding={12}>
            <div style={{ fontSize: 13, fontWeight: 900, marginBottom: 6 }}>아이디어 또는 세션 컨텍스트를 선택하세요</div>
            <div style={{ fontSize: 13, color: "#6b7280", lineHeight: 1.5 }}>
              아이디어 구체화 화면에서 작업 워크스페이스 열기를 사용하거나, URL에 <code style={{ fontSize: 12 }}>?requirementId=</code> /{" "}
              <code style={{ fontSize: 12 }}>?sessionId=</code> 를 추가하세요.
            </div>
          </WorkflowCard>
        ) : null}

        {view.found && hasContext ? (
          <>
            <WorkflowDemoSampleBanner>
              이 작업 공간은 URL로 연결된 아이디어·세션에서 온 초안 중심입니다. 프로젝트 단위 작업·생성 작업은 생성 준비(홈)에서 이어집니다.
            </WorkflowDemoSampleBanner>
            <TasksWorkspaceContent view={view} />
          </>
        ) : null}
      </div>
    </div>
  );
}

