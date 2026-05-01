import { ExecutionAdvancedDiagnosticsSection } from "@/components/workflow/execution/ExecutionAdvancedDiagnosticsSection";
import { ExecutionProgressSection } from "@/components/workflow/execution/ExecutionProgressSection";
import { ExecutionRunMonitoringSection } from "@/components/workflow/execution/ExecutionRunMonitoringSection";
import { ExecutionStatusSection } from "@/components/workflow/execution/ExecutionStatusSection";
import { ExecutionWorkflowStepsSection } from "@/components/workflow/execution/ExecutionWorkflowStepsSection";
import { WorkflowStageChrome } from "@/components/workflow/primitives/WorkflowStageChrome";
import type { ExecutionPageContentProps } from "./executionPageTypes";

export type { ExecutionPageContentActions, ExecutionPageContentProps } from "./executionPageTypes";

export function ExecutionPageContent(props: ExecutionPageContentProps) {
  const { sessionId, pre, monitoring, actions, nextAction, views, pageActions } = props;

  const summary = views.summary;
  const runView = views.run;
  const connectorView = views.connector;
  const recentEvents = views.runMeta.recentEvents;

  return (
    <WorkflowStageChrome
      title={null}
      subtitle={undefined}
    >
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
    </WorkflowStageChrome>
  );
}
