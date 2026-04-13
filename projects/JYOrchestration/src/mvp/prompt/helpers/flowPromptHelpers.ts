/**
 * MVP — **target** ScreenFlow prompt helpers (`promptService` composes these only).
 *
 * **Legacy compatibility:** tasks without `screenId` never use this module from structured prompts.
 */

import type { Task } from "../../task/taskService";
import type { MvpScreen } from "../../domain/mvpDomainTypes";
import { mvpGetProjectScreenFlow } from "../../screen/stores/mvpScreenFlowStore";
import { getNextScreens, getPreviousScreens, isEntryScreen } from "../../screen/mvpScreenFlowMetadata";
import { getNextScreenNames, getPreviousScreenNames } from "../../screen/helpers/screenFlowLookup";

export type ResolvedTaskFlowContext = {
  graph: ReturnType<typeof mvpGetProjectScreenFlow>;
  prevNames: string[];
  nextNames: string[];
  isEntry: boolean;
};

export type MvpScreenFlowGraphNonNull = NonNullable<ReturnType<typeof mvpGetProjectScreenFlow>>;

export function resolveFlowGraph(projectId: string): ReturnType<typeof mvpGetProjectScreenFlow> {
  return mvpGetProjectScreenFlow(projectId);
}

export function resolveFlowGraphForTask(task: Task | undefined, screen: MvpScreen | null) {
  return screen && screen.projectId
    ? resolveFlowGraph(screen.projectId)
    : task?.projectId
      ? resolveFlowGraph(task.projectId)
      : null;
}

export function resolvePreviousScreens(screenId: string, graph: MvpScreenFlowGraphNonNull): string[] {
  return getPreviousScreenNames(screenId, graph);
}

export function resolveNextScreens(screenId: string, graph: MvpScreenFlowGraphNonNull): string[] {
  return getNextScreenNames(screenId, graph);
}

export function resolvePreviousScreenIds(graph: MvpScreenFlowGraphNonNull, screenId: string): string[] {
  return getPreviousScreens(graph, screenId);
}

export function resolveNextScreenIds(graph: MvpScreenFlowGraphNonNull, screenId: string): string[] {
  return getNextScreens(graph, screenId);
}

export function resolvePreviousScreenNames(graph: MvpScreenFlowGraphNonNull, screenId: string): string[] {
  return resolvePreviousScreens(screenId, graph);
}

export function resolveNextScreenNames(graph: MvpScreenFlowGraphNonNull, screenId: string): string[] {
  return resolveNextScreens(screenId, graph);
}

/** Single call-site for structured prompts: graph + adjacent screen names (empty when no screen/graph). */
export function resolveScreenFlowLabelsForPrompt(
  task: Task | undefined,
  screen: MvpScreen | null
): {
  graph: ReturnType<typeof mvpGetProjectScreenFlow>;
  prevNames: string[];
  nextNames: string[];
} {
  const graph = resolveFlowGraphForTask(task, screen);
  const prevNames = screen && graph ? resolvePreviousScreenNames(graph, screen.id) : [];
  const nextNames = screen && graph ? resolveNextScreenNames(graph, screen.id) : [];
  return { graph, prevNames, nextNames };
}

export function resolvePrevNextScreenNames(graph: MvpScreenFlowGraphNonNull, screenId: string): {
  prevNames: string[];
  nextNames: string[];
} {
  return {
    prevNames: resolvePreviousScreens(screenId, graph),
    nextNames: resolveNextScreens(screenId, graph),
  };
}

export type FlowPromptBlockContext = {
  screen: MvpScreen;
  graph: ReturnType<typeof mvpGetProjectScreenFlow>;
  prevNames: string[];
  nextNames: string[];
};

export function buildFlowPromptBlock(context: FlowPromptBlockContext): string[] {
  const { screen, graph, prevNames, nextNames } = context;
  return [
    `### Flow context (preparation only)`,
    ...(graph
      ? [
          isEntryScreen(graph, screen.id)
            ? `This screen is an ENTRY screen.`
            : prevNames.length > 0
              ? `This screen comes AFTER: ${prevNames.join(", ")}`
              : `This screen comes AFTER: (unknown)`,
          nextNames.length > 0 ? `Next screen(s): ${nextNames.join(", ")}` : `Next screen(s): (none)`,
          `Flow validation: OFF`,
        ]
      : [`Flow graph: (not available)`]),
    ``,
  ];
}

/** Stable name used across the codebase and self-check (alias of {@link buildFlowPromptBlock}). */
export const buildFlowContextPromptLines = buildFlowPromptBlock;

/** Parity alias for self-check (same output as {@link buildFlowPromptBlock}). */
export function legacyBuildFlowContextPromptLines(
  screen: MvpScreen,
  graph: ReturnType<typeof mvpGetProjectScreenFlow>,
  prevNames: string[],
  nextNames: string[]
): string[] {
  return buildFlowPromptBlock({ screen, graph, prevNames, nextNames });
}
