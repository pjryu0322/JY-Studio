import { useCallback } from "react";
import {
  buildCodeAgentWipDraftCreatedTimelineEntry,
  buildCodeAgentWipDraftFailedTimelineEntry,
  mapBlockedMessageToWipDraftFailureReason,
} from "@/lib/prototype/codeAgentWipExecution";
import { resolveOrchestrationAwareRequirementsState } from "@/lib/prototype/effectiveImplementationState";
import {
  buildImplementationStageActionRunLogPatch,
  type ImplementationStageActionRun,
} from "@/lib/prototype/implementationStageActionRun";
import type { ImplementationStageActionExecutionResult } from "@/lib/prototype/implementationStageActionPipeline";
import { resolvePrototypeExecutionSingleChatFromState } from "@/lib/prototype/prototypeExecutionSingleChatWire";
import { appendPromptTimeline } from "@/lib/requirements/promptTimelineState";
import type { RequirementsPromptTimelineEntry } from "@/lib/requirements/promptTimelineState";
import { parseRequirementsStateJson } from "@/lib/requirements/requirementsStateJson";
import type { PrototypeExecutionOrchestrationPersistInput } from "@/lib/prototype/prototypeExecutionTaskPlanPersist";

export function useImplementationStageActionTimeline(input: {
  readonly projectId: string;
  readonly requirementsStateJsonRef: React.MutableRefObject<unknown>;
  readonly pendingImplementationPatchRef: React.MutableRefObject<
    PrototypeExecutionOrchestrationPersistInput | undefined
  >;
  readonly applyPendingFromOrchestrationPatchRef: React.MutableRefObject<
    (patch: PrototypeExecutionOrchestrationPersistInput | undefined) => void
  >;
  readonly persistChatToDb: ReturnType<
    typeof import("@/components/preview/usePrototypeExecutionPersistChatToDb").usePrototypeExecutionPersistChatToDb
  >["persistChatToDb"];
  readonly appendUserNotice: (message: string) => void;
  readonly setExecutionEnvironmentModalOpen: (open: boolean) => void;
  readonly showRoleCheckDetails: () => void;
  readonly appendStatusQueryFromChip: (chip: string) => void;
}): Readonly<{
  readonly persistStageActionTimelineEntries: (
    entries: readonly RequirementsPromptTimelineEntry[],
    runLogPatch?: { readonly implementationStageActionRunLogV1: unknown },
  ) => void;
  readonly persistImplementationStageActionRun: (run: ImplementationStageActionRun) => void;
  readonly applyImplementationStageActionExecutionResult: (
    result: ImplementationStageActionExecutionResult,
  ) => void;
}> {
  const persistStageActionTimelineEntries = useCallback(
    (
      entries: readonly RequirementsPromptTimelineEntry[],
      runLogPatch?: { readonly implementationStageActionRunLogV1: unknown },
    ) => {
      if (!entries.length && !runLogPatch) return;
      const imp = resolveOrchestrationAwareRequirementsState({
        base: parseRequirementsStateJson(input.requirementsStateJsonRef.current),
        pendingPatch: input.pendingImplementationPatchRef.current,
      });
      let timeline = imp.promptTimeline;
      for (const entry of entries) {
        timeline = appendPromptTimeline(timeline, entry);
      }
      input.applyPendingFromOrchestrationPatchRef.current({ promptTimeline: timeline });
      const resolved = resolvePrototypeExecutionSingleChatFromState(
        input.requirementsStateJsonRef.current,
      );
      void input.persistChatToDb(
        {
          messages: resolved.messages ?? [],
          slots: resolved.slots ?? [],
          answers: resolved.answers ?? {},
          currentSlotKey: resolved.currentSlotKey ?? null,
        },
        { promptTimeline: timeline, ...(runLogPatch ?? {}) },
        undefined,
        { force: true },
      );
    },
    [
      input.persistChatToDb,
      input.requirementsStateJsonRef,
      input.pendingImplementationPatchRef,
      input.applyPendingFromOrchestrationPatchRef,
    ],
  );

  const persistImplementationStageActionRun = useCallback(
    (run: ImplementationStageActionRun) => {
      const refState = parseRequirementsStateJson(input.requirementsStateJsonRef.current);
      const runLogPatch = buildImplementationStageActionRunLogPatch({
        currentLog: refState.implementationStageActionRunLogV1,
        run,
      });
      let extraEntries = [...run.timelineEntries];
      if (run.actionId === "REQUEST_CODE_AGENT_WIP") {
        const pid = input.projectId.trim();
        if (run.runResult?.outcome === "executed") {
          const wip = refState.codeAgentWipExecutionV1;
          const hasDraftWip =
            wip &&
            (wip.bridgeExecutionStatus === "draft_created" ||
              wip.executionStatus === "draft_created" ||
              wip.commits.some((commit) => String(commit.sha ?? "").startsWith("wip-stub")));
          if (hasDraftWip && wip) {
            extraEntries = [
              ...extraEntries,
              buildCodeAgentWipDraftCreatedTimelineEntry({
                projectId: pid,
                wip,
                runId: run.runId,
                source: "REQUEST_CODE_AGENT_WIP",
              }),
            ];
          }
        } else if (run.runResult?.outcome === "blocked") {
          extraEntries = [
            ...extraEntries,
            buildCodeAgentWipDraftFailedTimelineEntry({
              projectId: pid,
              runId: run.runId,
              reason: mapBlockedMessageToWipDraftFailureReason(run.runResult.message),
              detail: run.runResult.message,
              source: "REQUEST_CODE_AGENT_WIP",
            }),
          ];
        }
      }
      persistStageActionTimelineEntries(extraEntries, runLogPatch);
    },
    [persistStageActionTimelineEntries, input.projectId, input.requirementsStateJsonRef],
  );

  const applyImplementationStageActionExecutionResult = useCallback(
    (result: ImplementationStageActionExecutionResult) => {
      if (result.timelineEntries?.length) {
        persistStageActionTimelineEntries(result.timelineEntries);
      }
      switch (result.kind) {
        case "blocked":
          input.appendUserNotice(result.message);
          break;
        case "focus_composer":
          input.appendUserNotice(result.message);
          break;
        case "open_env_settings":
          input.setExecutionEnvironmentModalOpen(true);
          break;
        case "open_artifacts":
          input.appendUserNotice(
            "구현 산출물 Hub는 제공되지 않습니다. 기획(/requirements) 화면에서 산출물을 확인해 주세요.",
          );
          break;
        case "show_status":
          if (result.intent === "role") input.showRoleCheckDetails();
          else if (result.intent === "scm") input.appendStatusQueryFromChip("scm_check_details");
          else input.appendStatusQueryFromChip("environment_check_details");
          break;
        case "handled":
          break;
      }
    },
    [
      input.appendUserNotice,
      input.showRoleCheckDetails,
      input.appendStatusQueryFromChip,
      input.setExecutionEnvironmentModalOpen,
      persistStageActionTimelineEntries,
    ],
  );

  return {
    persistStageActionTimelineEntries,
    persistImplementationStageActionRun,
    applyImplementationStageActionExecutionResult,
  };
}
