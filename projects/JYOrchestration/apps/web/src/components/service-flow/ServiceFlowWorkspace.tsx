"use client";

import { useMemo, type CSSProperties } from "react";
import type { RequirementsServiceFlowV1 } from "@/lib/requirements/requirementsStateJson";
import { RequirementsServiceFlowStage } from "@/components/requirements/RequirementsServiceFlowStage";

const wrap: CSSProperties = {
  flex: "1 1 auto",
  minHeight: 0,
  height: "calc(100vh - 210px)",
  overflow: "hidden",
  background: "#fff",
  display: "flex",
  flexDirection: "column",
};

export function ServiceFlowWorkspace({
  flow,
  ideationReady,
  generatingDraft,
  draftGenerationCount,
  onRetryGate,
  onGenerateAiDraft,
  onApproveAll,
  onUpdateFlow,
}: {
  readonly flow: RequirementsServiceFlowV1 | null;
  readonly ideationReady: boolean;
  readonly generatingDraft: boolean;
  readonly draftGenerationCount: number;
  readonly onRetryGate: () => void;
  readonly onGenerateAiDraft: () => void;
  readonly onApproveAll: () => void;
  readonly onUpdateFlow: (next: RequirementsServiceFlowV1) => void;
}) {
  const approval = useMemo(() => {
    const actorIds = new Set((flow?.actors ?? []).map((a) => a.id));
    const actorsReady = (flow?.actors.length ?? 0) >= 2;
    const stepsReady = (flow?.steps.length ?? 0) >= 3;
    const mapped = Boolean(flow?.steps.length) && (flow?.steps ?? []).every((s) => s.primaryActorId && actorIds.has(s.primaryActorId));
    const approved = Boolean(actorsReady && stepsReady && mapped && flow?.steps.every((s) => s.approved));
    return { actorsReady, stepsReady, mapped, approved, ready: actorsReady && stepsReady && mapped };
  }, [flow]);

  return (
    <section style={wrap} aria-label="액터 및 서비스 흐름 정의">
      <RequirementsServiceFlowStage
        ideationReady={ideationReady}
        ideationReadyNotice="아이디어 초안 확정 후 서비스 흐름 워크숍을 진행할 수 있습니다."
        flow={flow}
        onChangeFlow={onUpdateFlow}
        draftGenerationCount={draftGenerationCount}
        generatingDraft={generatingDraft}
        approval={approval}
        onRetryGate={onRetryGate}
        onGenerateAiDraft={onGenerateAiDraft}
        onApproveAll={onApproveAll}
      />
    </section>
  );
}
