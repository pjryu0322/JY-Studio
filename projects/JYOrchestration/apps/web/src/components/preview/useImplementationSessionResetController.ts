"use client";

import { useCallback, useState, type MutableRefObject } from "react";
import { confirmResetConversation } from "@/lib/chat/conversationMarkdown";
import { buildImplementationResetWithPlanningReentry } from "@/lib/requirements/implementationSessionResetReentry";
import { patchSpecWorkspaceRequest } from "@/lib/project/specWorkspaceClient";
import { postPlanningResetCascade } from "@/lib/requirements/planningResetCascadeClient";
import {
  IMPLEMENTATION_RESET_CONVERSATION_CONFIRM_MESSAGE,
  hasActiveImplementationExecutionSession,
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
  readonly onResetLocalCaches: () => void;
  readonly appendUserNotice: (message: string) => void;
  readonly protoBusy: boolean;
}>;

export type ImplementationSessionResetControllerValue = Readonly<{
  readonly onResetImplementationSession: () => void | Promise<void>;
  readonly resetImplementationSessionBusy: boolean;
  readonly resetImplementationSessionDisabled: boolean;
}>;

export function useImplementationSessionResetController(
  input: ImplementationSessionResetControllerInput,
): ImplementationSessionResetControllerValue {
  const [resetBusy, setResetBusy] = useState(false);

  const hasResettableImplementationData = hasActiveImplementationExecutionSession(
    input.parsedRequirementsState,
  );

  const resetImplementationSessionDisabled =
    !input.projectId.trim() ||
    resetBusy ||
    input.protoBusy ||
    !hasResettableImplementationData;

  const onResetImplementationSession = useCallback(async () => {
    const pid = input.projectId.trim();
    if (!pid || resetBusy || input.protoBusy) return;
    if (!confirmResetConversation({ message: IMPLEMENTATION_RESET_CONVERSATION_CONFIRM_MESSAGE })) {
      return;
    }

    setResetBusy(true);
    input.implementationResetInFlightRef.current = true;
    input.orchestrationPersistSeqRef.current += 1;

    try {
      const cascade = await postPlanningResetCascade({
        projectId: pid,
        reason: "manual",
      });
      if (!cascade.success) {
        throw new Error(cascade.message ?? "구현 Runtime 정리에 실패했습니다.");
      }

      const nowIso = new Date().toISOString();
      const base = parseRequirementsStateJson(input.requirementsStateJsonRef.current);
      const reentry = buildImplementationResetWithPlanningReentry({
        base,
        nowIso,
        projectId: pid,
        projectName: input.projectName,
        projectDescription: input.projectDescription,
        slotDefinitions: input.slotDefinitions,
        envOk: input.envOk,
        designOk: input.designOk,
        userSelectedTemplateId: input.userSelectedTemplateId,
      });
      const resetState = reentry.state;

      input.requirementsStateJsonRef.current = resetState;
      input.onResetLocalCaches();

      const { res, json: raw } = await patchSpecWorkspaceRequest(pid, {
        requirementsStateJson: resetState,
      });
      const json = raw as SpecWorkspacePatchResponse;
      if (!res.ok || !json.success || json.data?.patchApplied === false) {
        throw new Error(json.message ?? "구현 초기화 저장에 실패했습니다.");
      }

      input.onRequirementsStateJsonChange?.(resetState);
      notifyAppFlowProjectContextRefresh();
      if (reentry.ok) {
        input.appendUserNotice(
          "구현 단계 데이터를 초기화했습니다. 기획 기준으로 구현 Seed·작업목록·CodeTask 계획을 다시 생성했습니다.",
        );
      } else {
        input.appendUserNotice(
          `구현 단계 데이터는 초기화했습니다. ${reentry.reason}`,
        );
      }
    } catch (e) {
      input.appendUserNotice(e instanceof Error ? e.message : "구현 초기화에 실패했습니다.");
    } finally {
      input.implementationResetInFlightRef.current = false;
      setResetBusy(false);
    }
  }, [input, resetBusy]);

  return {
    onResetImplementationSession,
    resetImplementationSessionBusy: resetBusy,
    resetImplementationSessionDisabled,
  };
}
