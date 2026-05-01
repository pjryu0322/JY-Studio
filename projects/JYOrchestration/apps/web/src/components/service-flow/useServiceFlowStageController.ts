"use client";

import { useCallback, useMemo, useState } from "react";
import {
  applyRecommendedServiceFlowPrimaryActors,
  computeServiceFlowDecisionResolution,
  deriveServiceFlowApprovalFromFlow,
  normalizeServiceFlowStepOrder,
  serviceFlowProgressHint,
  unresolvedServiceFlowChecklistEntries,
  type ServiceFlowStageSlotKey,
} from "@/components/service-flow/serviceFlowStageDerived";
import { serviceFlowSidebarParticipants, type ServiceFlowProjectMember } from "@/components/service-flow/serviceFlowWorkshopBridge";
import { useServiceFlowWorkshopChat, type ServiceFlowWorkspaceMode } from "@/components/service-flow/useServiceFlowWorkshopChat";
import type { RequirementsMessage } from "@/lib/requirements/requirementsMessage";
import type {
  RequirementsServiceFlowStepV1,
  RequirementsServiceFlowV1,
  RequirementsServiceFlowChecklistDeferralKind,
} from "@/lib/requirements/requirementsStateJson";

export type ServiceFlowStageControllerInput = {
  readonly projectId: string;
  readonly projectName: string;
  readonly projectDescription: string;
  readonly ideationParticipantHumanMemberIds: readonly string[];
  readonly ideationAssets: ReadonlyArray<{ type?: string; title?: string; content?: string }>;
  readonly ideationReady: boolean;
  readonly flow: RequirementsServiceFlowV1 | null;
  readonly onChangeFlow: (next: RequirementsServiceFlowV1) => void;
  readonly generatingDraft: boolean;
  readonly draftGenerationCount: number;
  readonly members: readonly ServiceFlowProjectMember[];
  readonly currentUserId: string | null;
  readonly persistedServiceFlowMessages: readonly RequirementsMessage[];
  readonly onAppendPersistedServiceFlowMessages: (
    incoming: readonly RequirementsMessage[],
  ) => Promise<readonly RequirementsMessage[]>;
};

export function useServiceFlowStageController(p: ServiceFlowStageControllerInput) {
  const [workspaceMode, setWorkspaceMode] = useState<ServiceFlowWorkspaceMode>("chat");
  const [remainingPanelOpen, setRemainingPanelOpen] = useState(false);
  const [membersModalOpen, setMembersModalOpen] = useState(false);

  const derivedApproval = useMemo(() => deriveServiceFlowApprovalFromFlow(p.flow), [p.flow]);
  const hint = serviceFlowProgressHint(derivedApproval);
  const structureLocked = Boolean(p.flow?.structureLockedAt);
  const deferrals = p.flow?.checklistDeferrals ?? null;
  const decision = useMemo(
    () => computeServiceFlowDecisionResolution({ flow: p.flow, derivedSlots: derivedApproval.slots, deferrals }),
    [p.flow, derivedApproval.slots, deferrals],
  );

  const chatActive = workspaceMode === "chat";
  const mappingActive = workspaceMode === "mapping";
  const summaryActive = workspaceMode === "summary";

  const workshop = useServiceFlowWorkshopChat({
    projectId: p.projectId,
    projectName: p.projectName,
    projectDescription: p.projectDescription,
    ideationAssets: p.ideationAssets,
    flow: p.flow,
    onChangeFlow: p.onChangeFlow,
    currentUserId: p.currentUserId,
    ideationReady: p.ideationReady,
    generatingDraft: p.generatingDraft,
    draftGenerationCount: p.draftGenerationCount,
    persistedServiceFlowMessages: p.persistedServiceFlowMessages,
    onAppendPersistedServiceFlowMessages: p.onAppendPersistedServiceFlowMessages,
    workspaceMode,
    setWorkspaceMode,
    structureLockedAt: p.flow?.structureLockedAt,
    derivedSlotsForDraftBootstrap: derivedApproval.slots,
  });

  const { callAnalyze, jumpToResolveSlot } = workshop;

  const actors = p.flow?.actors ?? [];
  const steps = useMemo(() => normalizeServiceFlowStepOrder(p.flow?.steps ?? []), [p.flow?.steps]);
  const sidebarParticipants = useMemo(
    () =>
      serviceFlowSidebarParticipants(
        p.members,
        p.currentUserId,
        p.ideationParticipantHumanMemberIds,
        workshop.replying,
      ),
    [p.members, p.currentUserId, p.ideationParticipantHumanMemberIds, workshop.replying],
  );

  const patchChecklistDeferral = useCallback(
    (key: ServiceFlowStageSlotKey, kind: RequirementsServiceFlowChecklistDeferralKind | null) => {
      if (!p.flow) return;
      const now = new Date().toISOString();
      const next: Partial<Record<ServiceFlowStageSlotKey, RequirementsServiceFlowChecklistDeferralKind>> = {
        ...(p.flow.checklistDeferrals ?? {}),
      };
      if (kind === null) delete next[key];
      else next[key] = kind;
      const checklistDeferrals = Object.keys(next).length ? next : null;
      p.onChangeFlow({ ...p.flow, checklistDeferrals, updatedAt: now });
    },
    [p.flow, p.onChangeFlow],
  );

  const reapplyRecommendedOwners = useCallback(() => {
    if (!p.flow?.structureLockedAt) return;
    const now = new Date().toISOString();
    const next = applyRecommendedServiceFlowPrimaryActors({ ...p.flow, updatedAt: now });
    p.onChangeFlow({ ...next, structureLockedAt: p.flow.structureLockedAt ?? now, updatedAt: now });
  }, [p.flow, p.onChangeFlow]);

  const updateStep = useCallback(
    (id: string, patch: Partial<RequirementsServiceFlowStepV1>) => {
      if (!p.flow) return;
      const now = new Date().toISOString();
      const nextSteps = p.flow.steps.map((s) => {
        if (s.id !== id) return s;
        const merged: RequirementsServiceFlowStepV1 = { ...s, ...patch, updatedAt: now };
        if (!("approved" in patch)) merged.approved = false;
        return merged;
      });
      p.onChangeFlow({ ...p.flow, steps: normalizeServiceFlowStepOrder(nextSteps), updatedAt: now });
    },
    [p.flow, p.onChangeFlow],
  );

  const jumpToResolveSlotWrapped = useCallback(
    (key: ServiceFlowStageSlotKey) => {
      setRemainingPanelOpen(false);
      jumpToResolveSlot(key);
    },
    [jumpToResolveSlot],
  );

  const remainingEntries = useMemo(
    () => unresolvedServiceFlowChecklistEntries(derivedApproval.slots, deferrals),
    [derivedApproval.slots, deferrals],
  );

  const composerQuickActions = useMemo(() => {
    const shouldShowApproval =
      !decision.requiredUnresolved.length && decision.optionalUnresolved.includes("approvalStep");
    const shouldShowException =
      !decision.requiredUnresolved.length && decision.optionalUnresolved.includes("exceptionFlow");

    const base =
      steps.length >= 1
        ? []
        : [
            {
              label: "액터 추가",
              action: () => callAnalyze("액터를 추가해 주세요. 사람 액터와 시스템 액터를 분리해 정리해 주세요."),
            },
            {
              label: "흐름 정리",
              action: () =>
                callAnalyze(
                  "주요 서비스 흐름을 3단계 이상으로 정리해 주세요. 각 단계 제목/목적/담당을 포함해 주세요.",
                ),
            },
          ];

    const extras =
      steps.length >= 1
        ? [
            ...(shouldShowApproval
              ? [
                  {
                    label: "승인 추가",
                    action: () =>
                      callAnalyze(
                        "승인/확정 단계가 필요합니다. 승인 단계를 흐름에 추가하고 담당도 지정해 주세요.",
                      ),
                  },
                ]
              : []),
            ...(shouldShowException
              ? [
                  {
                    label: "예외 흐름",
                    action: () =>
                      callAnalyze(
                        "수정 요청/반려 같은 예외 흐름이 필요합니다. 예외 단계를 흐름에 반영해 주세요.",
                      ),
                  },
                ]
              : []),
          ]
        : [];

    return [...base, ...extras];
  }, [callAnalyze, decision.optionalUnresolved, decision.requiredUnresolved.length, steps.length]);

  return {
    workspaceMode,
    setWorkspaceMode,
    remainingPanelOpen,
    setRemainingPanelOpen,
    membersModalOpen,
    setMembersModalOpen,
    chatActive,
    mappingActive,
    summaryActive,
    derivedApproval,
    hint,
    decision,
    structureLocked,
    actors,
    steps,
    remainingEntries,
    sidebarParticipants,
    patchChecklistDeferral,
    reapplyRecommendedOwners,
    updateStepPrimary: (stepId: string, primaryActorId: string) => updateStep(stepId, { primaryActorId }),
    jumpToResolveSlotWrapped,
    composerQuickActions,
    workshop,
  };
}
