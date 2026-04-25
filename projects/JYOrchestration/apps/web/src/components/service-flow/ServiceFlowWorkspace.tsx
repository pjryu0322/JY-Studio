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

const topBar: CSSProperties = {
  flex: "0 0 auto",
  padding: "10px 14px",
  borderBottom: "1px solid #e2e8f0",
  background: "#fff",
  display: "flex",
  alignItems: "center",
  justifyContent: "space-between",
  gap: 12,
};

const btn: CSSProperties = {
  border: "1px solid #cbd5e1",
  background: "#fff",
  borderRadius: 10,
  padding: "8px 11px",
  fontSize: 12,
  fontWeight: 900,
  color: "#0f172a",
  cursor: "pointer",
};

const primaryBtn: CSSProperties = {
  ...btn,
  border: "1px solid #0f766e",
  background: "#0f766e",
  color: "#fff",
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
      <div style={topBar}>
        <div>
          <div style={{ fontSize: 15, fontWeight: 900, color: "#0f172a" }}>액터 및 서비스 흐름 정의</div>
          <div style={{ marginTop: 2, fontSize: 12, fontWeight: 700, color: "#64748b" }}>AI·전문가·사용자가 대화하며 운영 흐름을 확정합니다.</div>
        </div>
        <div style={{ display: "flex", gap: 8, alignItems: "center", flexShrink: 0 }}>
          <button type="button" onClick={onGenerateAiDraft} disabled={!ideationReady || generatingDraft} style={{ ...primaryBtn, opacity: !ideationReady || generatingDraft ? 0.55 : 1 }}>
            {generatingDraft ? "초안 생성 중..." : "AI 초안 생성"}
          </button>
          <button type="button" onClick={onApproveAll} disabled={!approval.ready} style={{ ...btn, opacity: approval.ready ? 1 : 0.55 }}>
            전체 승인
          </button>
        </div>
      </div>
      <RequirementsServiceFlowStage
        ideationReady={ideationReady}
        ideationReadyNotice="아이디어 초안 확정 후 서비스 흐름 워크숍을 진행할 수 있습니다."
        flow={flow}
        onChangeFlow={onUpdateFlow}
        draftGenerationCount={draftGenerationCount}
        approval={approval}
        onRetryGate={onRetryGate}
      />
    </section>
  );
}
