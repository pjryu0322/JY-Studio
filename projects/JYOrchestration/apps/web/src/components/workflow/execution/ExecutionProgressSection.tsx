import { WorkflowCard } from "@/components/workflow/primitives/WorkflowCard";
import type { ExecutionProgressView } from "@/lib/workflow/executionViewState";
import { progressRowView } from "./executionPageUiHelpers";

export type ExecutionProgressSectionProps = {
  progress: ExecutionProgressView;
};

export function ExecutionProgressSection(props: ExecutionProgressSectionProps) {
  const { progress } = props;

  return (
    <WorkflowCard padding={12}>
      <div style={{ fontSize: 13, fontWeight: 900, marginBottom: 8 }}>워크플로 진행</div>
      <div style={{ fontSize: 12, color: "#6b7280", lineHeight: 1.5, marginBottom: 10 }}>
        상위 체크포인트입니다. 세부 동작은 아래 워크플로 단계에 있으며, 현재 실행과 연결기 모니터링은 위에서 확인합니다.
      </div>
      <div style={{ display: "grid", gap: 10 }}>
        {progressRowView(progress.executionRequest)}
        {progressRowView(progress.packageAndAssignment)}
        {progressRowView(progress.executionPreparation)}
      </div>
    </WorkflowCard>
  );
}
