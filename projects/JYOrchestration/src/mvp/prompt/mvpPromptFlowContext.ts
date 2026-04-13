/**
 * MVP — prompt helpers for ScreenFlow context (extracted from promptService).
 * Behavior must remain identical to the prior inline implementation.
 */

import type { Task } from "../task/taskService";
import type { MvpScreen } from "../domain/mvpDomainTypes";
import { mvpGetProjectScreenFlow } from "../screen/stores/mvpScreenFlowStore";
import { getNextScreens, getPreviousScreens, isEntryScreen } from "../screen/mvpScreenFlowMetadata";

export type ResolvedTaskFlowContext = {
  graph: ReturnType<typeof mvpGetProjectScreenFlow>;
  prevNames: string[];
  nextNames: string[];
  isEntry: boolean;
};

export function resolveFlowGraphForTask(task: Task | undefined, screen: MvpScreen | null) {
  return screen && screen.projectId
    ? mvpGetProjectScreenFlow(screen.projectId)
    : task?.projectId
      ? mvpGetProjectScreenFlow(task.projectId)
      : null;
}

export function resolvePrevNextScreenNames(graph: NonNullable<ReturnType<typeof mvpGetProjectScreenFlow>>, screenId: string): {
  prevNames: string[];
  nextNames: string[];
} {
  const prevIds = getPreviousScreens(graph, screenId);
  const nextIds = getNextScreens(graph, screenId);
  const prevNames = prevIds
    .map((id) => graph.screens.find((s) => s.id === id)?.name)
    .filter((x): x is string => typeof x === "string" && x.length > 0);
  const nextNames = nextIds
    .map((id) => graph.screens.find((s) => s.id === id)?.name)
    .filter((x): x is string => typeof x === "string" && x.length > 0);
  return { prevNames, nextNames };
}

export function buildFlowContextPromptLines(input: {
  screen: MvpScreen;
  graph: ReturnType<typeof mvpGetProjectScreenFlow>;
  prevNames: string[];
  nextNames: string[];
}): string[] {
  const { screen, graph, prevNames, nextNames } = input;
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

/** Reference implementation kept for parity checks in self-check. */
export function legacyBuildFlowContextPromptLines(
  screen: MvpScreen,
  graph: ReturnType<typeof mvpGetProjectScreenFlow>,
  prevNames: string[],
  nextNames: string[]
): string[] {
  return buildFlowContextPromptLines({ screen, graph, prevNames, nextNames });
}

