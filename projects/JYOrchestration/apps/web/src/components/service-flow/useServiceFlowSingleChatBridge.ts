"use client";

import { useEffect, useMemo, useState } from "react";
import type { RequirementsMessage } from "@/lib/requirements/requirementsMessage";
import type {
  RequirementsPromptTimelineEntry,
  RequirementsServiceFlowV1,
  RequirementsStateJson,
} from "@/lib/requirements/requirementsStateJson";
import type { ServiceFlowQuickActionDispatch } from "@/components/service-flow/useServiceFlowWorkshopChat";
import type { ServiceFlowSingleChatSendOptions } from "@/lib/service-design/serviceDesignSingleChatServiceFlowSend";
import type { WorkspaceAiMemberId } from "@/lib/ai-member/platformAiMembers";
import type { ServiceDesignHarnessPayload } from "@/lib/service-design/serviceDesignTurnPayload";
import { deriveServiceFlowApprovalFromFlow, type ServiceFlowStageSlotKey } from "@/components/service-flow/serviceFlowStageDerived";
import { useServiceFlowWorkshopChat, type ServiceFlowWorkspaceMode } from "@/components/service-flow/useServiceFlowWorkshopChat";
import type { RequirementsOrchestrationContextWire } from "@/lib/requirements/requirementsOrchestrationContextWire";
import type { ServiceFlowProjectMember } from "@/components/service-flow/serviceFlowWorkshopBridge";

export function useServiceFlowSingleChatBridge(params: {
  readonly projectId: string;
  readonly projectName: string;
  readonly projectDescription: string;
  readonly ideationParticipantHumanMemberIds: readonly string[];
  readonly ideationAssets: ReadonlyArray<{ type?: string; title?: string; content?: string }>;
  readonly flow: RequirementsServiceFlowV1 | null;
  readonly onChangeFlow: (next: RequirementsServiceFlowV1) => void;
  readonly members: readonly ServiceFlowProjectMember[];
  readonly currentUserId: string | null;
  readonly ideationReady: boolean;
  readonly generatingDraft: boolean;
  readonly draftGenerationCount: number;
  readonly persistedServiceFlowMessages: readonly RequirementsMessage[];
  readonly onAppendPersistedServiceFlowMessages: (
    incoming: readonly RequirementsMessage[],
  ) => Promise<readonly RequirementsMessage[]>;
  readonly platformScreenAiMemberIds?: readonly WorkspaceAiMemberId[];
  readonly onSingleChatPromptTrace?: (entry: RequirementsPromptTimelineEntry) => void;
  readonly orchestrationContext?: RequirementsOrchestrationContextWire;
  readonly onAnalyzeStatePatch?: (patch: Partial<RequirementsStateJson>) => void | Promise<void>;
  readonly onEnterActorEdit?: () => void;
  readonly onEnterFeatureDetailEdit?: () => void;
  readonly onOpenArtifactHub?: () => void;
  /** expose send executor to parent without UI mount */
  readonly serviceFlowSendRef?: {
    current:
      | ((
          payload: ServiceDesignHarnessPayload,
          text: string,
          quickAction?: ServiceFlowQuickActionDispatch | null,
          opts?: ServiceFlowSingleChatSendOptions,
        ) => void | Promise<void>)
      | null;
  };
}) {
  const [workspaceMode, setWorkspaceMode] = useState<ServiceFlowWorkspaceMode>("chat");

  const derivedApproval = useMemo(() => deriveServiceFlowApprovalFromFlow(params.flow), [params.flow]);

  const workshop = useServiceFlowWorkshopChat({
    projectId: params.projectId,
    projectName: params.projectName,
    projectDescription: params.projectDescription,
    ideationAssets: params.ideationAssets,
    flow: params.flow,
    onChangeFlow: params.onChangeFlow,
    currentUserId: params.currentUserId,
    ideationReady: params.ideationReady,
    generatingDraft: params.generatingDraft,
    draftGenerationCount: params.draftGenerationCount,
    persistedServiceFlowMessages: params.persistedServiceFlowMessages,
    onAppendPersistedServiceFlowMessages: params.onAppendPersistedServiceFlowMessages,
    workspaceMode,
    setWorkspaceMode,
    structureLockedAt: params.flow?.structureLockedAt,
    derivedSlotsForDraftBootstrap: derivedApproval.slots as Record<ServiceFlowStageSlotKey, boolean>,
    onSingleChatPromptTrace: params.onSingleChatPromptTrace,
    orchestrationContext: params.orchestrationContext,
    onAnalyzeStatePatch: params.onAnalyzeStatePatch,
    onEnterActorEdit: params.onEnterActorEdit,
    onEnterFeatureDetailEdit: params.onEnterFeatureDetailEdit,
    onOpenArtifactHub: params.onOpenArtifactHub,
  });

  useEffect(() => {
    const ref = params.serviceFlowSendRef;
    if (!ref) return;
    ref.current = async (payload, text, quickAction, opts) => {
      workshop.sendMessage(payload, text, quickAction ?? null, opts);
    };
    return () => {
      if (ref.current) ref.current = null;
    };
  }, [params.serviceFlowSendRef, workshop]);

  return {
    alternativeCanvasOpen: workshop.alternativeCanvasOpen,
    alternativeCanvasPayload: workshop.alternativeCanvasPayload,
    closeAlternativeCanvas: workshop.closeAlternativeCanvas,
    openAlternativeCanvas: workshop.openAlternativeCanvas,
    applyAlternativeFromCanvas: workshop.applyAlternativeFromCanvas,
    keepPrimaryFromCanvas: workshop.keepPrimaryFromCanvas,
    regenerateAlternativeFromCanvas: workshop.regenerateAlternativeFromCanvas,
    replying: workshop.replying,
    pendingStatusLabel: workshop.pendingStatusLabel,
  };
}
