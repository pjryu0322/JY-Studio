import { ProjectWorkflowNav } from "@/components/layout/ProjectWorkflowNav";
import { WorkflowPageHeader } from "@/components/workflow/primitives/WorkflowPageHeader";
import { ExecutionAdvancedDiagnosticsSection } from "@/components/workflow/execution/ExecutionAdvancedDiagnosticsSection";
import { ExecutionProgressSection } from "@/components/workflow/execution/ExecutionProgressSection";
import { ExecutionRunMonitoringSection } from "@/components/workflow/execution/ExecutionRunMonitoringSection";
import { ExecutionStatusSection } from "@/components/workflow/execution/ExecutionStatusSection";
import { ExecutionWorkflowStepsSection } from "@/components/workflow/execution/ExecutionWorkflowStepsSection";
import { StageWorkspaceLayout } from "@/components/workspace/StageWorkspaceLayout";
import type { ExecutionPageContentProps } from "./executionPageTypes";

export type { ExecutionPageContentActions, ExecutionPageContentProps } from "./executionPageTypes";

export function ExecutionPageContent(props: ExecutionPageContentProps) {
  const { sessionId, pre, monitoring, actions, nextAction, views, pageActions } = props;

  const summary = views.summary;
  const runView = views.run;
  const connectorView = views.connector;
  const recentEvents = views.runMeta.recentEvents;

  return (
    <div>
      <WorkflowPageHeader
        title="프로토타입 생성"
        subtitle="프로젝트에서 만든 결과물(프로토타입)을 요청·진행·검토하는 단계입니다. 협업 세션에 연결된 비즈니스 실행 흐름을 다루며,
        저장소·PR·머지에 해당하는 환경 실행은 프로젝트 설정에서 이어집니다."
      />

      <div style={{ marginTop: 12, marginBottom: 4 }}>
        <ProjectWorkflowNav />
      </div>

      <div style={{ marginTop: 14 }}>
        <StageWorkspaceLayout>
          <div style={{ padding: 14, display: "grid", gap: 14 }}>
            <ExecutionStatusSection sessionId={sessionId} summary={summary} pageActions={pageActions} />
            <ExecutionProgressSection progress={views.progress} />
            <ExecutionRunMonitoringSection
              sessionId={sessionId}
              pre={pre}
              monitoring={monitoring}
              actions={actions}
              pageActions={pageActions}
              runView={runView}
              connectorView={connectorView}
              recentEvents={recentEvents}
            />
            <ExecutionWorkflowStepsSection sessionId={sessionId} pre={pre} actions={actions} pageActions={pageActions} />
            <ExecutionAdvancedDiagnosticsSection sessionId={sessionId} pre={pre} nextAction={nextAction} pageActions={pageActions} />
          </div>
        </StageWorkspaceLayout>
      </div>
    </div>
  );
}
