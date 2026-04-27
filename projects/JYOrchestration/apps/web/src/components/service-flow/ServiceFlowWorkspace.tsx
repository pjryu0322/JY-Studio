"use client";

import { useMemo, type CSSProperties } from "react";
import type { RequirementsMessage } from "@/lib/requirements/requirementsMessage";
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
  | "approvalStep"
  | "exceptionFlow"
  | "accessControl"
  | "handoffToFeatures";

type SlotState = Record<ServiceFlowSlotKey, boolean>;

const wrap: CSSProperties = {
  flex: "1 1 0%",
  width: "100%",
  minWidth: 0,
  minHeight: 0,
  height: "100%",
  overflow: "hidden",
  background: "#fff",
  display: "flex",
  flexDirection: "column",
};

export function ServiceFlowWorkspace({
  projectId,
  projectName,
  projectDescription,
  initialPrototypePreviewOpen = false,
  ideationParticipantHumanMemberIds,
  ideationAssets,
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
  persistedServiceFlowMessages,
  onAppendPersistedServiceFlowMessages,
}: {
  readonly projectId: string;
  readonly projectName: string;
  readonly projectDescription: string;
  readonly initialPrototypePreviewOpen?: boolean;
  readonly ideationParticipantHumanMemberIds: readonly string[];
  readonly ideationAssets: ReadonlyArray<{ type?: string; title?: string; content?: string }>;
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
  readonly persistedServiceFlowMessages: readonly RequirementsMessage[];
  readonly onAppendPersistedServiceFlowMessages: (
    incoming: readonly RequirementsMessage[],
  ) => Promise<readonly RequirementsMessage[]>;
}) {
  const approval = useMemo(() => {
    const actorIds = new Set((flow?.actors ?? []).map((a) => a.id));
    const text = `${(flow?.actors ?? []).map((a) => `${a.name} ${a.description ?? ""}`).join(" ")} ${(flow?.steps ?? []).map((s) => `${s.title} ${s.purpose}`).join(" ")}`;
    const hasHumanActors = (flow?.actors ?? []).some((a) => a.kind === "human");
    const hasSystemActors = (flow?.actors ?? []).some((a) => a.kind === "system");
    const stepsReady = (flow?.steps.length ?? 0) >= 3;
    const mapped = Boolean(flow?.steps.length) && (flow?.steps ?? []).every((s) => s.primaryActorId && actorIds.has(s.primaryActorId));
    const hasApprovalStep = /승인|확정|결재|결정/.test(text);
    const slots: SlotState = {
      humanActors: hasHumanActors,
      systemActors: hasSystemActors,
      mainFlow: stepsReady,
      actorResponsibility: mapped,
      approvalStep: hasApprovalStep,
      exceptionFlow: /예외|수정|반려|재처리|실패|오류|누락/.test(text),
      accessControl: /권한|열람|수정 가능|공유 범위|접근|관리자/.test(text),
      handoffToFeatures: /기능|후보|알림|업로드|공유|승인|요청|관리/.test(text),
    };
    const filledSlotCount = Object.values(slots).filter(Boolean).length;
    const progressPercent = Math.round((filledSlotCount / 8) * 100);
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
        approvalStep: !slots.approvalStep,
        exceptionFlow: !slots.exceptionFlow,
        accessControl: !slots.accessControl,
        handoffToFeatures: !slots.handoffToFeatures,
      },
    };
  }, [flow]);

  return (
    <section style={wrap} aria-label="액터 및 서비스 흐름 정의">
      <div style={{ flex: "1 1 auto", minHeight: 0, minWidth: 0, display: "flex", height: "100%" }}>
        <RequirementsServiceFlowStage
          projectId={projectId}
          projectName={projectName}
          projectDescription={projectDescription}
          initialPrototypePreviewOpen={initialPrototypePreviewOpen}
          ideationParticipantHumanMemberIds={ideationParticipantHumanMemberIds}
          ideationAssets={ideationAssets}
          ideationReady={ideationReady}
          ideationReadyNotice="먼저 아이디어 초안을 확정하면 이 단계에서 흐름을 함께 정리할 수 있습니다."
          flow={flow}
          onChangeFlow={onUpdateFlow}
          generatingDraft={generatingDraft}
          draftGenerationCount={draftGenerationCount}
          approval={approval}
          members={members}
          currentUserId={currentUserId}
          onInviteMember={onInviteMember}
          onGenerateAiDraft={onGenerateAiDraft}
          onApproveAll={onApproveAll}
          onRetryGate={onRetryGate}
          persistedServiceFlowMessages={persistedServiceFlowMessages}
          onAppendPersistedServiceFlowMessages={onAppendPersistedServiceFlowMessages}
        />
      </div>
    </section>
  );
}
