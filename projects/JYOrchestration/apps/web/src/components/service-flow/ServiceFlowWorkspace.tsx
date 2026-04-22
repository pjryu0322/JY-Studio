"use client";

import { useMemo, type CSSProperties, type ReactNode } from "react";
import Link from "next/link";
import { WorkflowCard } from "@/components/workflow/primitives/WorkflowCard";
import type { Project } from "@/components/project-spec/types";
import type { ParticipantOption } from "@/components/requirements/RequirementsParticipantBar";
import type { RequirementsServiceFlowV1 } from "@/lib/requirements/requirementsStateJson";
import { RequirementsServiceFlowStage } from "@/components/requirements/RequirementsServiceFlowStage";

const wrap: CSSProperties = {
  flex: "1 1 auto",
  minHeight: 0,
  border: "1px solid #e2e8f0",
  borderRadius: 16,
  overflow: "hidden",
  background: "#fff",
  boxShadow: "0 18px 50px -24px rgba(15, 23, 42, 0.18)",
  display: "flex",
  flexDirection: "column",
};

const topBar: CSSProperties = {
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
  participants,
  chatPanel,
  flow,
  ideationReady,
  onRetryGate,
  onGenerateAiDraft,
  onApproveAll,
  onUpdateFlow,
}: {
  readonly projectId: string;
  readonly project: Project | null;
  readonly participants: readonly ParticipantOption[];
  readonly chatPanel: ReactNode;
  readonly flow: RequirementsServiceFlowV1 | null;
  readonly ideationReady: boolean;
  readonly onRetryGate: () => void;
  readonly onGenerateAiDraft: () => void;
  readonly onApproveAll: () => void;
  readonly onUpdateFlow: (next: RequirementsServiceFlowV1) => void;
}) {
  const approvedCount = useMemo(() => (flow?.steps ?? []).filter((s) => s.approved).length, [flow?.steps]);
  const totalCount = flow?.steps?.length ?? 0;
  const progressLabel = totalCount ? `${approvedCount} / ${totalCount} 승인됨` : "승인 단계가 아직 없습니다";

  const featuresHref = useMemo(() => (projectId ? `/features?projectId=${encodeURIComponent(projectId)}` : "/features"), [projectId]);
  const ideationHref = useMemo(() => (projectId ? `/requirements?projectId=${encodeURIComponent(projectId)}` : "/requirements"), [projectId]);

  const renderGate = !ideationReady;

  const title = "액터 및 서비스 흐름 정의";
  const subtitle = project?.name?.trim() ? `프로젝트: ${project.name.trim()}` : "아이디어 구체화 다음 단계";

  return (
    <section style={wrap} aria-label={title}>
      <div style={topBar}>
        <div style={{ minWidth: 240 }}>
          <div style={{ fontSize: 16.5, fontWeight: 900, color: "#0f172a", letterSpacing: "-0.02em" }}>{title}</div>
          <div style={{ marginTop: 3, fontSize: 12, fontWeight: 700, color: "#64748b" }}>{subtitle}</div>
        </div>
        <div style={{ display: "flex", flexWrap: "wrap", gap: 8, alignItems: "center" }}>
          <span style={{ fontSize: 12, fontWeight: 900, color: "#475569" }}>진행률: {progressLabel}</span>
          <button type="button" onClick={onGenerateAiDraft} style={btnPrimary} disabled={renderGate}>
            AI 초안 생성
          </button>
          <button type="button" onClick={onApproveAll} style={btn} disabled={!flow || totalCount === 0}>
            전체 승인
          </button>
          <Link href={featuresHref} style={btn}>
            기능 정리로 이동
          </Link>
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
              <Link href={ideationHref} style={btnPrimary}>
                아이디어 구체화로 이동
              </Link>
              <button type="button" onClick={onRetryGate} style={btn}>
                다시 확인
              </button>
            </div>
          </WorkflowCard>
        </div>
      ) : (
        <div style={{ padding: 14, minHeight: 0 }}>
          <RequirementsServiceFlowStage
            ideationReady={ideationReady}
            ideationReadyNotice="현재 단계로 이동하려면\n아이디어 구체화 단계에서\n기획 산출물 정리가 필요합니다."
            flow={flow}
            onChangeFlow={onUpdateFlow}
            onGenerateAiDraft={onGenerateAiDraft}
            onApproveAll={onApproveAll}
            onNavigateToFeaturesHref={featuresHref}
            chat={chatPanel}
          />
        </div>
      )}
    </section>
  );
}

