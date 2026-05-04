"use client";

import type { CSSProperties } from "react";
import type { RequirementsMessage } from "@/lib/requirements/requirementsMessage";
import type { RequirementsServiceFlowV1 } from "@/lib/requirements/requirementsStateJson";
import type { WorkspaceAiMemberId } from "@/lib/ai-member/platformAiMembers";
import { RequirementsServiceFlowStage } from "@/components/requirements/RequirementsServiceFlowStage";
import type { ServiceFlowProjectMember } from "@/components/service-flow/serviceFlowWorkshopBridge";
import { uiTokens as t } from "@/components/ui/tokens";

const wrap: CSSProperties = {
  flex: "1 1 0%",
  width: "100%",
  minWidth: 0,
  minHeight: 0,
  height: "100%",
  overflow: "hidden",
  background: t.bgCard,
  display: "flex",
  flexDirection: "column",
};

export function ServiceFlowWorkspace({
  projectId,
  projectName,
  projectDescription,
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
  onUpdateFlow,
  persistedServiceFlowMessages,
  onAppendPersistedServiceFlowMessages,
  platformScreenAiMemberIds,
}: {
  readonly projectId: string;
  readonly projectName: string;
  readonly projectDescription: string;
  readonly ideationParticipantHumanMemberIds: readonly string[];
  readonly ideationAssets: ReadonlyArray<{ type?: string; title?: string; content?: string }>;
  readonly flow: RequirementsServiceFlowV1 | null;
  readonly ideationReady: boolean;
  readonly generatingDraft: boolean;
  readonly draftGenerationCount: number;
  readonly members: readonly ServiceFlowProjectMember[];
  readonly currentUserId: string | null;
  readonly onInviteMember: () => void;
  readonly onRetryGate: () => void;
  readonly onUpdateFlow: (next: RequirementsServiceFlowV1) => void;
  readonly persistedServiceFlowMessages: readonly RequirementsMessage[];
  readonly onAppendPersistedServiceFlowMessages: (
    incoming: readonly RequirementsMessage[],
  ) => Promise<readonly RequirementsMessage[]>;
  readonly platformScreenAiMemberIds?: readonly WorkspaceAiMemberId[];
}) {
  return (
    <section style={wrap} aria-label="액터 및 서비스 흐름 정의">
      <div style={{ flex: "1 1 auto", minHeight: 0, minWidth: 0, display: "flex", height: "100%" }}>
        <RequirementsServiceFlowStage
          projectId={projectId}
          projectName={projectName}
          projectDescription={projectDescription}
          ideationParticipantHumanMemberIds={ideationParticipantHumanMemberIds}
          ideationAssets={ideationAssets}
          ideationReady={ideationReady}
          ideationReadyNotice="먼저 아이디어 초안을 확정하면 이 단계에서 흐름을 함께 정리할 수 있습니다."
          flow={flow}
          onChangeFlow={onUpdateFlow}
          generatingDraft={generatingDraft}
          draftGenerationCount={draftGenerationCount}
          members={members}
          currentUserId={currentUserId}
          onInviteMember={onInviteMember}
          onRetryGate={onRetryGate}
          persistedServiceFlowMessages={persistedServiceFlowMessages}
          onAppendPersistedServiceFlowMessages={onAppendPersistedServiceFlowMessages}
          platformScreenAiMemberIds={platformScreenAiMemberIds}
        />
      </div>
    </section>
  );
}
