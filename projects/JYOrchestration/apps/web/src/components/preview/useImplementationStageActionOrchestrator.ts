"use client";

import { useCallback } from "react";
import type {
  EffectiveImplementationState,
  ImplementationStageActionId,
} from "@/lib/prototype/effectiveImplementationState";
import type { CodeAgentWipExecutionV1 } from "@/lib/prototype/codeAgentWipExecution";
import {
  buildImplementationStageActionClickedTimelineEntry,
  resolveImplementationStageActionClick,
  type ImplementationStageActionClickSource,
} from "@/lib/prototype/implementationStageActionBinding";
import type { ImplementationStageActionRunResult } from "@/lib/prototype/implementationStageActionPipeline";
import type { ImplementationStageBoardGateContext } from "@/lib/prototype/implementationStageActionPipeline";
import { orchestrateImplementationStageAction } from "@/lib/prototype/implementationStageActionOrchestrator";
import type {
  ImplementationStageActionRun,
  ImplementationStageActionRunSource,
} from "@/lib/prototype/implementationStageActionRun";
import type { RequirementsPromptTimelineEntry } from "@/lib/requirements/promptTimelineState";

/**
 * Orchestrates implementation-stage action clicks.
 *
 * Scope:
 * - resolve clicked action labels to action ids
 * - persist stage action click timeline entries
 * - run implementation-stage action gate/orchestrator
 * - persist ImplementationStageActionRun result
 *
 * Not scope:
 * - concrete action execution
 * - Quick Run internals
 * - GitHub verification internals
 * - Integration pipeline internals
 * - board rendering
 */
export type ImplementationStageActionOrchestratorInput = Readonly<{
  readonly projectId: string;
  readonly effectiveImplementationState: EffectiveImplementationState;
  readonly implementationStageBoardGateContext: ImplementationStageBoardGateContext | null;
  readonly currentWip: CodeAgentWipExecutionV1 | null | undefined;
  readonly runImplementationStageAction: (
    actionId: ImplementationStageActionId,
  ) => ImplementationStageActionRunResult | Promise<ImplementationStageActionRunResult>;
  readonly persistImplementationStageActionRun: (run: ImplementationStageActionRun) => void;
  readonly persistStageActionTimelineEntries: (
    entries: readonly RequirementsPromptTimelineEntry[],
  ) => void;
}>;

export type ImplementationStageActionOrchestratorValue = Readonly<{
  readonly executeImplementationStageAction: (
    actionId: ImplementationStageActionId,
    clickContext?: {
      readonly label: string;
      readonly source: ImplementationStageActionClickSource;
      readonly buttonIndex?: number;
    },
  ) => boolean;
  readonly runOrchestratedStageAction: (input: {
    readonly actionId: ImplementationStageActionId;
    readonly source?: ImplementationStageActionRunSource;
    readonly execute?: () =>
      | ImplementationStageActionRunResult
      | Promise<ImplementationStageActionRunResult>;
  }) => void;
}>;

export function useImplementationStageActionOrchestrator(
  input: ImplementationStageActionOrchestratorInput,
): ImplementationStageActionOrchestratorValue {
  const runOrchestratedStageAction = useCallback(
    (runInput: {
      readonly actionId: ImplementationStageActionId;
      readonly source?: ImplementationStageActionRunSource;
      readonly execute?: () =>
        | ImplementationStageActionRunResult
        | Promise<ImplementationStageActionRunResult>;
    }) => {
      const pid = input.projectId.trim();
      if (!pid) return;

      void orchestrateImplementationStageAction({
        projectId: pid,
        actionId: runInput.actionId,
        source: runInput.source ?? "cta",
        effectiveState: input.effectiveImplementationState,
        boardGateContext: input.implementationStageBoardGateContext,
        execute: () =>
          runInput.execute?.() ?? input.runImplementationStageAction(runInput.actionId),
      }).then((run) => {
        input.persistImplementationStageActionRun(run);
        const gateBlocked = run.gateResult != null && !run.gateResult.ok;
        if (gateBlocked && run.message) {
        } else if (run.status === "failed" && run.message) {
        }
      });
    },
    [
      input.projectId,
      input.effectiveImplementationState,
      input.implementationStageBoardGateContext,
      input.runImplementationStageAction,
      input.persistImplementationStageActionRun,
    ],
  );

  const executeImplementationStageAction = useCallback(
    (
      actionId: ImplementationStageActionId,
      clickContext?: {
        readonly label: string;
        readonly source: ImplementationStageActionClickSource;
        readonly buttonIndex?: number;
      },
    ): boolean => {
      const pid = input.projectId.trim();
      if (!pid) {
        return true;
      }

      const wip = input.currentWip;
      const resolvedActionId = clickContext
        ? resolveImplementationStageActionClick({
            actionId,
            label: clickContext.label,
            wip,
          })
        : actionId;

      if (clickContext) {
        input.persistStageActionTimelineEntries([
          buildImplementationStageActionClickedTimelineEntry({
            actionId: resolvedActionId,
            label: clickContext.label,
            source: clickContext.source,
            buttonIndex: clickContext.buttonIndex,
            selectedTaskId: wip?.selectedTaskId,
            currentBridgeExecutionStatus: wip?.bridgeExecutionStatus,
            currentExecutionMode: wip?.executionMode,
          }),
        ]);
      }

      runOrchestratedStageAction({
        actionId: resolvedActionId,
        source: "cta",
        execute: () => input.runImplementationStageAction(resolvedActionId),
      });

      return true;
    },
    [
      input.projectId,
      input.currentWip,
      input.persistStageActionTimelineEntries,
      input.runImplementationStageAction,
      runOrchestratedStageAction,
    ],
  );

  return { executeImplementationStageAction, runOrchestratedStageAction };
}
