"use client";

import { useMemo, type CSSProperties } from "react";
import { WorkflowCard } from "@/components/workflow/primitives/WorkflowCard";
import type { Project } from "@/components/project-spec/types";
import type { RequirementsServiceFlowV1 } from "@/lib/requirements/requirementsStateJson";
import { RequirementsServiceFlowStage } from "@/components/requirements/RequirementsServiceFlowStage";

const wrap: CSSProperties = {
  flex: "1 1 auto",
  minHeight: 0,
  height: "calc(100vh - 220px)",
  border: "1px solid #e2e8f0",
  borderRadius: 16,
  overflow: "hidden",
  background: "#fff",
  boxShadow: "0 18px 50px -24px rgba(15, 23, 42, 0.18)",
  display: "flex",
  flexDirection: "column",
};

const topBar: CSSProperties = {
  position: "relative",
  zIndex: 10,
  padding: "12px 14px",
  borderBottom: "1px solid #e2e8f0",
  background: "linear-gradient(180deg, #ffffff 0%, #f8fafc 100%)",
  display: "flex",
  alignItems: "center",
  justifyContent: "space-between",
  gap: 12,
  flexWrap: "wrap",
};

const btn: CSSProperties = {
  border: "1px solid #e2e8f0",
  background: "#fff",
  borderRadius: 10,
  padding: "8px 10px",
  fontSize: 12,
  fontWeight: 800,
  color: "#0f172a",
  cursor: "pointer",
  textDecoration: "none",
  display: "inline-block",
};

const btnPrimary: CSSProperties = { ...btn, border: "1px solid #0f766e", background: "#0f766e", color: "#fff" };

export function ServiceFlowWorkspace({
  projectId,
  project,
  flow,
  ideationReady,
  generatingDraft,
  draftGenerationCount,
  onRetryGate,
  onGenerateAiDraft,
  onApproveAll,
  onUpdateFlow,
}: {
  readonly projectId: string;
  readonly project: Project | null;
  readonly flow: RequirementsServiceFlowV1 | null;
  readonly ideationReady: boolean;
  readonly generatingDraft: boolean;
  readonly draftGenerationCount: number;
  readonly onRetryGate: () => void;
  readonly onGenerateAiDraft: () => void;
  readonly onApproveAll: () => void;
  readonly onUpdateFlow: (next: RequirementsServiceFlowV1) => void;
}) {
  const approvedCount = useMemo(() => (flow?.steps ?? []).filter((s) => s.approved).length, [flow?.steps]);
  const totalCount = flow?.steps?.length ?? 0;
  const actorIds = useMemo(() => new Set((flow?.actors ?? []).map((a) => a.id)), [flow?.actors]);
  const allMapped = Boolean(flow && totalCount >= 3 && flow.actors.length >= 2 && flow.steps.every((s) => s.primaryActorId && actorIds.has(s.primaryActorId)));
  const allApproved = Boolean(allMapped && totalCount > 0 && approvedCount === totalCount);
  const featureHref = projectId ? `/features?projectId=${encodeURIComponent(projectId)}` : "/features";

  const renderGate = !ideationReady;

  const title = "액터 및 서비스 흐름 정의";
  const subtitle = "AI와 전문가가 함께 실제 운영 흐름을 구체화합니다. 다음 단계 기능 정리에 필요한 현실 정보를 확보합니다.";

  return (
    <section style={wrap} aria-label={title}>
      <div style={topBar}>
        <div style={{ minWidth: 240 }}>
          <div style={{ fontSize: 16.5, fontWeight: 900, color: "#0f172a", letterSpacing: "-0.02em" }}>{title}</div>
          <div style={{ marginTop: 3, fontSize: 12, fontWeight: 700, color: "#64748b", lineHeight: 1.45 }}>
            {subtitle}
            {project?.name?.trim() ? <span style={{ marginLeft: 8, color: "#94a3b8" }}>프로젝트: {project.name.trim()}</span> : null}
          </div>
        </div>
        <div style={{ display: "flex", flexWrap: "wrap", gap: 8, alignItems: "center" }}>
          <button type="button" onClick={onGenerateAiDraft} style={btnPrimary} disabled={renderGate || generatingDraft}>
            {generatingDraft ? "생성 중..." : "AI 초안 생성"}
          </button>
          <button
            type="button"
            onClick={onApproveAll}
            style={{ ...btn, opacity: allMapped ? 1 : 0.55, cursor: allMapped ? "pointer" : "not-allowed" }}
            disabled={!allMapped}
            title={!allMapped ? "단계 1개 이상, 액터 1개 이상, 모든 단계의 주 담당 액터가 필요합니다." : "전체 단계를 승인합니다."}
          >
            전체 승인
          </button>
          <button
            type="button"
            onClick={() => {
              window.location.href = featureHref;
            }}
            style={{ ...btn, opacity: allApproved ? 1 : 0.55, cursor: allApproved ? "pointer" : "not-allowed" }}
            disabled={!allApproved}
            title={!allApproved ? "전체 승인 후 기능 정리로 이동할 수 있습니다." : "기능 정리 단계로 이동합니다."}
          >
            기능 정리로 이동
          </button>
        </div>
      </div>

      {renderGate ? (
        <div style={{ padding: 14 }}>
          <WorkflowCard padding={16}>
            <div style={{ fontSize: 15, fontWeight: 900, color: "#0f172a", marginBottom: 6 }}>
              아이디어 구체화 단계의 정리 산출물이 필요합니다.
            </div>
            <div style={{ fontSize: 13.5, color: "#475569", lineHeight: 1.6, marginBottom: 12 }}>
              현재 단계로 이동하려면 아이디어 구체화 단계에서 기획 산출물 정리가 필요합니다.
            </div>
            <div style={{ display: "flex", flexWrap: "wrap", gap: 10 }}>
              <button type="button" onClick={onRetryGate} style={btn}>
                다시 확인
              </button>
            </div>
          </WorkflowCard>
        </div>
      ) : (
        <div style={{ padding: 14, minHeight: 0, flex: "1 1 auto", overflow: "hidden" }}>
          <RequirementsServiceFlowStage
            ideationReady={ideationReady}
            ideationReadyNotice="현재 단계로 이동하려면\n아이디어 구체화 단계에서\n기획 산출물 정리가 필요합니다."
            flow={flow}
            onChangeFlow={onUpdateFlow}
            draftGenerationCount={draftGenerationCount}
          />
        </div>
      )}
    </section>
  );
}

