"use client";

import { useMemo, type CSSProperties } from "react";
import type { RequirementsServiceFlowV1 } from "@/lib/requirements/requirementsStateJson";
import { RequirementsServiceFlowStage } from "@/components/requirements/RequirementsServiceFlowStage";

type ProjectMemberForServiceFlow = {
  memberId: string;
  displayName: string | null;
  email: string | null;
  memberType: string;
  role: string;
  isOwner?: boolean;
  userId?: string | null;
  aiOrchestrationRole?: string | null;
  orchestrationStage?: string | null;
};

type ServiceFlowSlotKey =
  | "humanActors"
  | "systemActors"
  | "mainFlow"
  | "actorResponsibility"
  | "exceptionFlow"
  | "accessControl"
  | "handoffToFeatures";

type SlotState = Record<ServiceFlowSlotKey, boolean>;

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
  members,
  currentUserId,
  onInviteMember,
  onRetryGate,
  onGenerateAiDraft,
  onApproveAll,
  onUpdateFlow,
}: {
  readonly flow: RequirementsServiceFlowV1 | null;
  readonly ideationReady: boolean;
  readonly generatingDraft: boolean;
  readonly draftGenerationCount: number;
  readonly members: readonly ProjectMemberForServiceFlow[];
  readonly currentUserId: string | null;
  readonly onInviteMember: () => void;
  readonly onRetryGate: () => void;
  readonly onGenerateAiDraft: () => void;
  readonly onApproveAll: () => void;
  readonly onUpdateFlow: (next: RequirementsServiceFlowV1) => void;
}) {
  const approval = useMemo(() => {
    const actorIds = new Set((flow?.actors ?? []).map((a) => a.id));
    const text = `${(flow?.actors ?? []).map((a) => `${a.name} ${a.description ?? ""}`).join(" ")} ${(flow?.steps ?? []).map((s) => `${s.title} ${s.purpose}`).join(" ")}`;
    const hasHumanActors = (flow?.actors ?? []).some((a) => a.kind === "human");
    const hasSystemActors = (flow?.actors ?? []).some((a) => a.kind === "system");
    const stepsReady = (flow?.steps.length ?? 0) >= 3;
    const mapped = Boolean(flow?.steps.length) && (flow?.steps ?? []).every((s) => s.primaryActorId && actorIds.has(s.primaryActorId));
    const slots: SlotState = {
      humanActors: hasHumanActors,
      systemActors: hasSystemActors,
      mainFlow: stepsReady,
      actorResponsibility: mapped,
      exceptionFlow: /예외|수정|반려|재처리|실패|오류|누락/.test(text),
      accessControl: /권한|열람|수정 가능|공유 범위|접근|관리자/.test(text),
      handoffToFeatures: /기능|후보|알림|업로드|공유|승인|요청|관리/.test(text),
    };
    const filledSlotCount = Object.values(slots).filter(Boolean).length;
    const progressPercent = Math.round((filledSlotCount / 7) * 100);
    const actorsReady = slots.humanActors && slots.systemActors;
    const approved = Boolean(actorsReady && stepsReady && mapped && flow?.steps.every((s) => s.approved));
    return {
      actorsReady,
      stepsReady,
      mapped,
      approved,
      ready: slots.humanActors && slots.systemActors && slots.mainFlow && slots.actorResponsibility,
      slots,
      filledSlotCount,
      progressPercent,
      recommendedMissing: {
        exceptionFlow: !slots.exceptionFlow,
        accessControl: !slots.accessControl,
        handoffToFeatures: !slots.handoffToFeatures,
      },
    };
  }, [flow]);

  return (
    <section style={wrap} aria-label="액터 및 서비스 흐름 정의">
      <div style={topBar}>
        <div>
          <div style={{ fontSize: 15, fontWeight: 900, color: "#0f172a" }}>서비스 사용 흐름 함께 정리하기</div>
          <div style={{ marginTop: 2, fontSize: 12, fontWeight: 700, color: "#64748b" }}>대화하면 AI가 사용자와 진행 순서를 왼쪽에 정리합니다.</div>
        </div>
        <div style={{ display: "flex", gap: 8, alignItems: "center", flexShrink: 0 }}>
          <button type="button" onClick={onGenerateAiDraft} disabled={!ideationReady || generatingDraft} style={{ ...primaryBtn, opacity: !ideationReady || generatingDraft ? 0.55 : 1 }}>
            {generatingDraft ? "초안 만드는 중..." : "AI에게 초안 부탁하기"}
          </button>
          <button type="button" onClick={onApproveAll} disabled={!approval.ready} style={{ ...btn, opacity: approval.ready ? 1 : 0.55 }}>
            이대로 다음 단계로
          </button>
        </div>
      </div>
      <RequirementsServiceFlowStage
        ideationReady={ideationReady}
        ideationReadyNotice="먼저 아이디어 초안을 확정하면 이 단계에서 흐름을 함께 정리할 수 있습니다."
        flow={flow}
        onChangeFlow={onUpdateFlow}
        draftGenerationCount={draftGenerationCount}
        approval={approval}
        members={members}
        currentUserId={currentUserId}
        onInviteMember={onInviteMember}
        onRetryGate={onRetryGate}
      />
    </section>
  );
}
