"use client";

import { useCallback, useState, type MutableRefObject } from "react";
import { buildImplementationResetWithPlanningReentry } from "@/lib/requirements/implementationSessionResetReentry";
import {
  IMPLEMENTATION_RESET_CODETASK_SUCCESS_MESSAGE,
  IMPLEMENTATION_RESET_CONVERSATION_ONLY_SUCCESS_MESSAGE,
  IMPLEMENTATION_RESET_SCOPE_TRACE_ACTIONS,
  appendImplementationResetScopeTrace,
  implementationResetAuditFieldsForScope,
  type ImplementationResetScope,
} from "@/lib/requirements/implementationResetScope";
import { patchSpecWorkspaceRequest } from "@/lib/project/specWorkspaceClient";
import { postPlanningResetCascade } from "@/lib/requirements/planningResetCascadeClient";
import {
  appendCodeTaskResetCompletedTrace,
  clearImplementationConversationOnlyFromRequirementsJson,
  hasActiveImplementationExecutionSession,
  hasImplementationConversationToReset,
} from "@/lib/requirements/resetDerivedImplementationState";
import { parseRequirementsStateJson } from "@/lib/requirements/requirementsStateJson";
import { notifyAppFlowProjectContextRefresh } from "@/lib/workflow/appFlowModel";

import type { SingleChatOrchestrationSlotDefinition } from "@/lib/requirements/singleChatOrchestrationTypes";
import type { PrototypeTemplateType } from "@/lib/templates/prototypeTemplates";

type SpecWorkspacePatchResponse = Readonly<{
  readonly success?: boolean;
  readonly message?: string;
  readonly data?: Readonly<{ readonly patchApplied?: boolean }>;
}>;

export type ImplementationSessionResetControllerInput = Readonly<{
  readonly projectId: string;
  readonly projectName?: string;
  readonly projectDescription?: string;
  readonly slotDefinitions: readonly SingleChatOrchestrationSlotDefinition[];
  readonly envOk: boolean;
  readonly designOk: boolean;
  readonly userSelectedTemplateId?: PrototypeTemplateType | null;
  readonly parsedRequirementsState: ReturnType<typeof parseRequirementsStateJson>;
  readonly requirementsStateJsonRef: MutableRefObject<unknown>;
  readonly orchestrationPersistSeqRef: MutableRefObject<number>;
  readonly implementationResetInFlightRef: MutableRefObject<boolean>;
  readonly onRequirementsStateJsonChange?: (next: unknown) => void;
  readonly onResetLocalCaches: (scope: ImplementationResetScope) => void;
  readonly appendUserNotice: (message: string) => void;
  readonly protoBusy: boolean;
}>;

export type ImplementationSessionResetControllerValue = Readonly<{
  readonly implementationResetScopeDialogOpen: boolean;
  readonly onOpenImplementationResetDialog: () => void;
  readonly onCloseImplementationResetDialog: () => void;
  readonly onConfirmImplementationResetScope: (scope: ImplementationResetScope) => void | Promise<void>;
  readonly resetImplementationSessionBusy: boolean;
  readonly resetImplementationSessionDisabled: boolean;
  readonly implementationResetConversationOnlyDisabled: boolean;
  readonly implementationResetCodeTaskDisabled: boolean;
}>;

async function persistResetState(input: Readonly<{
  projectId: string;
  resetState: ReturnType<typeof parseRequirementsStateJson>;
  requirementsStateJsonRef: MutableRefObject<unknown>;
  onRequirementsStateJsonChange?: (next: unknown) => void;
}>): Promise<void> {
  const { res, json: raw } = await patchSpecWorkspaceRequest(input.projectId, {
    requirementsStateJson: input.resetState,
  });
  const json = raw as SpecWorkspacePatchResponse;
  if (!res.ok || !json.success || json.data?.patchApplied === false) {
    throw new Error(json.message ?? "구현 초기화 저장에 실패했습니다.");
  }
  input.requirementsStateJsonRef.current = input.resetState;
  input.onRequirementsStateJsonChange?.(input.resetState);
  notifyAppFlowProjectContextRefresh();
}

export function useImplementationSessionResetController(
  input: ImplementationSessionResetControllerInput,
): ImplementationSessionResetControllerValue {
  const [resetBusy, setResetBusy] = useState(false);
  const [dialogOpen, setDialogOpen] = useState(false);

  const hasConversation = hasImplementationConversationToReset(input.parsedRequirementsState);
  const hasCodeTaskSession = hasActiveImplementationExecutionSession(input.parsedRequirementsState);

  const resetImplementationSessionDisabled =
    !input.projectId.trim() || resetBusy || input.protoBusy || (!hasConversation && !hasCodeTaskSession);

  const implementationResetConversationOnlyDisabled = !hasConversation;
  const implementationResetCodeTaskDisabled = !hasCodeTaskSession;

  const onOpenImplementationResetDialog = useCallback(() => {
    if (resetImplementationSessionDisabled) return;
    setDialogOpen(true);
  }, [resetImplementationSessionDisabled]);

  const onCloseImplementationResetDialog = useCallback(() => {
    if (resetBusy) return;
    setDialogOpen(false);
  }, [resetBusy]);

  const resetConversationOnly = useCallback(async () => {
    const pid = input.projectId.trim();
    const nowIso = new Date().toISOString();
    const base = parseRequirementsStateJson(input.requirementsStateJsonRef.current);
    const requestedAudit = implementationResetAuditFieldsForScope("conversation_only", pid, nowIso);
    const withRequestTrace = {
      ...base,
      promptTimeline: appendImplementationResetScopeTrace(base.promptTimeline ?? [], {
        action: IMPLEMENTATION_RESET_SCOPE_TRACE_ACTIONS.conversationRequested,
        audit: requestedAudit,
      }),
    };
    const resetState = clearImplementationConversationOnlyFromRequirementsJson(withRequestTrace, {
      nowIso,
      projectId: pid,
    });

    input.orchestrationPersistSeqRef.current += 1;
    input.onResetLocalCaches("conversation_only");
    await persistResetState({
      projectId: pid,
      resetState,
      requirementsStateJsonRef: input.requirementsStateJsonRef,
      onRequirementsStateJsonChange: input.onRequirementsStateJsonChange,
    });
    input.appendUserNotice(IMPLEMENTATION_RESET_CONVERSATION_ONLY_SUCCESS_MESSAGE);
  }, [input]);

  const resetCodeTasksWithConversation = useCallback(async () => {
    const pid = input.projectId.trim();
    const nowIso = new Date().toISOString();
    const base = parseRequirementsStateJson(input.requirementsStateJsonRef.current);
    const requestedAudit = implementationResetAuditFieldsForScope("codetask_with_conversation", pid, nowIso);
    input.requirementsStateJsonRef.current = {
      ...base,
      promptTimeline: appendImplementationResetScopeTrace(base.promptTimeline ?? [], {
        action: IMPLEMENTATION_RESET_SCOPE_TRACE_ACTIONS.codetaskRequested,
        audit: requestedAudit,
      }),
    };

    const cascade = await postPlanningResetCascade({
      projectId: pid,
      reason: "manual",
    });
    if (!cascade.success) {
      throw new Error(cascade.message ?? "구현 Runtime 정리에 실패했습니다.");
    }

    const reentry = buildImplementationResetWithPlanningReentry({
      base: parseRequirementsStateJson(input.requirementsStateJsonRef.current),
      nowIso,
      projectId: pid,
      projectName: input.projectName,
      projectDescription: input.projectDescription,
      slotDefinitions: input.slotDefinitions,
      envOk: input.envOk,
      designOk: input.designOk,
      userSelectedTemplateId: input.userSelectedTemplateId,
    });
    let resetState = appendCodeTaskResetCompletedTrace(reentry.state, { nowIso, projectId: pid });

    input.orchestrationPersistSeqRef.current += 1;
    input.onResetLocalCaches("codetask_with_conversation");
    await persistResetState({
      projectId: pid,
      resetState,
      requirementsStateJsonRef: input.requirementsStateJsonRef,
      onRequirementsStateJsonChange: input.onRequirementsStateJsonChange,
    });

    if (reentry.ok) {
      input.appendUserNotice(IMPLEMENTATION_RESET_CODETASK_SUCCESS_MESSAGE);
    } else {
      input.appendUserNotice(`${IMPLEMENTATION_RESET_CODETASK_SUCCESS_MESSAGE}\n${reentry.reason}`);
    }
  }, [input]);

  const onConfirmImplementationResetScope = useCallback(
    async (scope: ImplementationResetScope) => {
      const pid = input.projectId.trim();
      if (!pid || resetBusy || input.protoBusy) return;
      if (scope === "conversation_only" && implementationResetConversationOnlyDisabled) return;
      if (scope === "codetask_with_conversation" && implementationResetCodeTaskDisabled) return;

      setResetBusy(true);
      input.implementationResetInFlightRef.current = true;

      try {
        const nowIso = new Date().toISOString();
        const pid = input.projectId.trim();
        const base = parseRequirementsStateJson(input.requirementsStateJsonRef.current);
        const dialogAudit = implementationResetAuditFieldsForScope(scope, pid, nowIso);
        input.requirementsStateJsonRef.current = {
          ...base,
          promptTimeline: appendImplementationResetScopeTrace(base.promptTimeline ?? [], {
            action: IMPLEMENTATION_RESET_SCOPE_TRACE_ACTIONS.dialogOpened,
            audit: dialogAudit,
          }),
        };

        if (scope === "conversation_only") {
          await resetConversationOnly();
        } else {
          await resetCodeTasksWithConversation();
        }
        setDialogOpen(false);
      } catch (e) {
        input.appendUserNotice(e instanceof Error ? e.message : "구현 초기화에 실패했습니다.");
      } finally {
        input.implementationResetInFlightRef.current = false;
        setResetBusy(false);
      }
    },
    [
      input,
      resetBusy,
      implementationResetConversationOnlyDisabled,
      implementationResetCodeTaskDisabled,
      resetConversationOnly,
      resetCodeTasksWithConversation,
    ],
  );

  return {
    implementationResetScopeDialogOpen: dialogOpen,
    onOpenImplementationResetDialog,
    onCloseImplementationResetDialog,
    onConfirmImplementationResetScope,
    resetImplementationSessionBusy: resetBusy,
    resetImplementationSessionDisabled,
    implementationResetConversationOnlyDisabled,
    implementationResetCodeTaskDisabled,
  };
}
