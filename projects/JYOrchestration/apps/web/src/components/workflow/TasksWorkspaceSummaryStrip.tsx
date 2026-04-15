"use client";

import { ScreenLabel } from "@/components/ui/ScreenLabel";
import { useShowScreenLabels } from "@/components/ui/ScreenLabelsContext";
import { WorkflowActionButton } from "@/components/workflow/primitives/WorkflowActionButton";
import { WorkflowBadge } from "@/components/workflow/primitives/WorkflowBadge";
import { WorkflowCard } from "@/components/workflow/primitives/WorkflowCard";
import type { TasksWorkspaceView } from "@/lib/workflow/tasksWorkspaceViewModel";

type Props = {
  view: TasksWorkspaceView;
  onOpenRequirement: () => void;
  onOpenCollaboration: () => void;
};

/** Single compact row: context, source, navigation. */
export function TasksWorkspaceSummaryStrip({ view, onOpenRequirement, onOpenCollaboration }: Props) {
  const showScreenLabels = useShowScreenLabels();

  return (
    <div className="relative">
      <ScreenLabel label="작업-요약-컨텍스트-패널" visible={showScreenLabels} />
      <WorkflowCard padding={12}>
        <div
          style={{
            display: "flex",
            flexWrap: "wrap",
            gap: 12,
            alignItems: "center",
            justifyContent: "space-between",
          }}
        >
          <div style={{ display: "flex", flexWrap: "wrap", gap: 8, alignItems: "center", minWidth: 0, fontSize: 13, lineHeight: 1.45 }}>
            {view.requirementTitle ? <span style={{ fontWeight: 800, color: "#111827" }}>{view.requirementTitle}</span> : null}
            {view.sessionTitle ? (
              <>
                <span style={{ color: "#d1d5db" }} aria-hidden>
                  |
                </span>
                <span style={{ color: "#374151" }}>{view.sessionTitle}</span>
                {view.sessionStatus ? <WorkflowBadge>{view.sessionStatus}</WorkflowBadge> : null}
              </>
            ) : (
              <>
                <span style={{ color: "#d1d5db" }} aria-hidden>
                  |
                </span>
                <span style={{ fontSize: 12, color: "#6b7280" }}>세션 없음</span>
              </>
            )}
            <span style={{ color: "#d1d5db" }} aria-hidden>
              |
            </span>
            {view.taskSource === "collaboration_snapshot" ? <WorkflowBadge>스냅샷</WorkflowBadge> : <WorkflowBadge>미생성</WorkflowBadge>}
            {view.hasConfirmedTaskSet ? <WorkflowBadge>확정 세트</WorkflowBadge> : null}
            <span style={{ fontSize: 12, color: "#6b7280" }}>
              {view.taskSource === "collaboration_snapshot" ? "메모리 전용입니다." : "협업 화면에서 작업 초안을 생성하세요."}
              {view.hasConfirmedTaskSet ? " 이 세션에 공식 확정 작업 세트가 있습니다." : ""}
            </span>
          </div>
          <div style={{ display: "flex", gap: 8, flexWrap: "wrap" }}>
            {view.requirementId ? <WorkflowActionButton label="요구사항" onClick={onOpenRequirement} /> : null}
            <WorkflowActionButton label="협업" variant="primary" onClick={onOpenCollaboration} />
          </div>
        </div>
      </WorkflowCard>
    </div>
  );
}
