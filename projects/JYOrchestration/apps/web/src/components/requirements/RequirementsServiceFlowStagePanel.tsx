"use client";

import { ServiceFlowWorkspace } from "@/components/service-flow/ServiceFlowWorkspace";
import type { ServiceFlowProjectMember } from "@/components/service-flow/serviceFlowWorkshopBridge";
import type { WorkspaceAiMemberId } from "@/lib/ai-member/platformAiMembers";
import type { RequirementsMessage } from "@/lib/requirements/requirementsMessage";
import type { RequirementsServiceFlowV1 } from "@/lib/requirements/requirementsStateJson";

export type RequirementsServiceFlowStagePanelProps = Readonly<{
  projectId: string;
  projectName: string;
  projectDescription: string;
  ideationParticipantHumanMemberIds: readonly string[];
  ideationAssets: ReadonlyArray<{ type?: string; title?: string; content?: string }>;
  flow: RequirementsServiceFlowV1 | null;
  ideationReady: boolean;
  generatingDraft: boolean;
  draftGenerationCount: number;
  members: readonly ServiceFlowProjectMember[];
  currentUserId: string | null;
  onInviteMember: () => void;
  onRetryGate: () => void;
  onUpdateFlow: (next: RequirementsServiceFlowV1) => void;
  persistedServiceFlowMessages: readonly RequirementsMessage[];
  onAppendPersistedServiceFlowMessages: (
    incoming: readonly RequirementsMessage[]
  ) => Promise<readonly RequirementsMessage[]>;
  platformScreenAiMemberIds?: readonly WorkspaceAiMemberId[];
}>;

export function RequirementsServiceFlowStagePanel(props: RequirementsServiceFlowStagePanelProps) {
  return (
    <div key="service-flow" style={{ display: "contents" }}>
      <ServiceFlowWorkspace {...props} />
    </div>
  );
}
