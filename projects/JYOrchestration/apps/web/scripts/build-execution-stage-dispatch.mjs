import fs from "fs";

const hookPath =
  "c:/project/JY-Studio/projects/JYOrchestration/apps/web/src/components/preview/usePrototypeImplementationStagePanel.tsx";
const outPath =
  "c:/project/JY-Studio/projects/JYOrchestration/apps/web/src/lib/prototype/implementationStageActionExecutionDispatch.ts";

const lines = fs.readFileSync(hookPath, "utf8").split(/\r?\n/);

const importLines = [];
let block = [];
let collecting = false;

function flushImportBlock() {
  if (!block.length) return;
  const text = block.join("\n");
  const skip =
    text.includes("@/components/") ||
    (text.includes('from "react"') && !text.startsWith("import type"));
  if (!skip) {
    importLines.push(...block);
  }
  block = [];
  collecting = false;
}

for (let i = 2; i < lines.length; i++) {
  const line = lines[i];
  if (line.startsWith("function isLikelyPreviewUrl")) break;
  if (line.startsWith("export type PrototypeImplementationStageHost")) break;

  if (line.startsWith("import ")) {
    flushImportBlock();
    collecting = true;
    block = [line];
    if (line.includes(";")) flushImportBlock();
  } else if (collecting) {
    block.push(line);
    if (line.includes(";")) flushImportBlock();
  }
}
flushImportBlock();

function extractCaseBody(caseLabel) {
  const caseLine = lines.findIndex((l) => l.includes(`case "${caseLabel}":`));
  if (caseLine < 0) throw new Error(`missing case ${caseLabel}`);
  let i = caseLine;
  while (i < lines.length && !lines[i].includes("{")) i++;
  let depth = 0;
  const start = i + 1;
  for (; i < lines.length; i++) {
    for (const ch of lines[i]) {
      if (ch === "{") depth++;
      if (ch === "}") depth--;
    }
    if (i > caseLine && depth === 0) {
      return lines.slice(start, i).join("\n");
    }
  }
  throw new Error(`unclosed ${caseLabel}`);
}

const cases = [
  "REQUEST_CODE_AGENT_WIP",
  "REQUEST_TASK_CURSOR_EXECUTION",
  "VERIFY_TASK_CURSOR_GITHUB",
  "REQUEST_CURSOR_BRIDGE_EXECUTION",
];

const bodies = cases.map((c) => ({ id: c, body: extractCaseBody(c) }));

const destructuring = `
  const {
    projectId,
    parsedRequirementsState,
    pendingImplementationPatch,
    effectiveImplementationState,
    executionSetupRow,
    executionArtifacts,
    orchestrationAwareRequirementsState,
    requirementsStateJson,
    persistChatToDb,
    appendAiNoticeForImplementation,
    appendUserNotice,
    appendImplementationTaskListAiMessage,
    applyImplementationOrchestrationResult,
    applyPendingFromOrchestrationPatch,
    implementationCursorGate,
    prototypeRunSyncSnapshot,
    previewUrl,
    implementationStageBoardGateContext,
    boardManualPickTaskIdRef,
    codeTaskDispatchPreferredTaskIdRef,
    pendingQuickRunQueueDispatchRef,
    quickRunCodeTaskContinuationRef,
    requirementsStateJsonRef,
    dispatchNextQuickRunFromGithubVerify,
    appendImplementationExecutionNotice,
    enrichCodeTaskRunOrchestrationPatch,
    applyImplementationRuntimeFetch,
    persistedQueueDispatch,
    wipChipHandlers,
  } = deps;
`;

const switchCases = bodies
  .map(
    ({ id, body }) => `    case "${id}": {
${body}
    }`,
  )
  .join("\n");

const header = `${importLines.join("\n")}
import type { ImplementationStageActionId } from "@/lib/prototype/effectiveImplementationState";
import type { ImplementationStageActionRunResult } from "@/lib/prototype/implementationStageActionPipeline";
import type { buildImplementationStageBoardGateContext } from "@/lib/prototype/implementationStageActionPipeline";
import type { resolveOrchestrationAwareRequirementsState } from "@/lib/prototype/effectiveImplementationState";
import type { RefObject, MutableRefObject } from "react";
import type { PrototypeExecutionOrchestrationPersistInput } from "@/lib/prototype/prototypeExecutionTaskPlanPersist";
import type { QuickRunGithubAdvanceDispatch } from "@/lib/prototype/implementationQuickRunGithubAdvanceService";

export type ImplementationStageActionExecutionDispatchDeps = Readonly<{
  readonly projectId: string;
  readonly parsedRequirementsState: ReturnType<
    typeof import("@/lib/requirements/requirementsStateJson").parseRequirementsStateJson
  >;
  readonly pendingImplementationPatch: import("@/lib/prototype/effectiveImplementationState").PendingImplementationPatch | null;
  readonly effectiveImplementationState: ReturnType<
    typeof import("@/lib/prototype/effectiveImplementationState").resolveEffectiveImplementationState
  >;
  readonly executionSetupRow: import("@/lib/prototype/executionSetupSourceGeneration").ExecutionSetupSourceGenerationRow | null;
  readonly executionArtifacts: ReturnType<
    typeof import("@/lib/prototype/prototypeExecutionEnvSnapshot").pickExecutionStateArtifacts
  >;
  readonly orchestrationAwareRequirementsState: ReturnType<
    typeof resolveOrchestrationAwareRequirementsState
  >;
  readonly requirementsStateJson: unknown;
  readonly persistChatToDb: (
    chat?: unknown,
    patch?: unknown,
  ) => void | Promise<void>;
  readonly appendAiNoticeForImplementation: (text: string) => void;
  readonly appendUserNotice: (message: string) => void;
  readonly appendImplementationTaskListAiMessage: (
    message: import("@/lib/requirements/requirementsMessage").RequirementsMessage,
  ) => void;
  readonly applyImplementationOrchestrationResult: (
    input: {
      readonly messages?: readonly import("@/lib/requirements/requirementsMessage").RequirementsMessage[];
      readonly orchestrationPatch?: PrototypeExecutionOrchestrationPersistInput;
    },
    options?: { readonly persist?: boolean },
  ) => void;
  readonly applyPendingFromOrchestrationPatch: (
    patch: PrototypeExecutionOrchestrationPersistInput | undefined,
  ) => void;
  readonly implementationCursorGate: unknown;
  readonly prototypeRunSyncSnapshot: ReturnType<
    typeof import("@/lib/prototype/implementationPrototypeRunSync").deriveImplementationPrototypeRunSyncSnapshot
  >;
  readonly previewUrl: string | null | undefined;
  readonly implementationStageBoardGateContext: ReturnType<
    typeof buildImplementationStageBoardGateContext
  > | null;
  readonly boardManualPickTaskIdRef: MutableRefObject<string | null>;
  readonly codeTaskDispatchPreferredTaskIdRef: MutableRefObject<string | null>;
  readonly pendingQuickRunQueueDispatchRef: MutableRefObject<
    import("@/lib/prototype/selectedCodeTaskCursorExecution").CodeTaskQueueDispatchRef | null
  >;
  readonly quickRunCodeTaskContinuationRef: MutableRefObject<string | null>;
  readonly requirementsStateJsonRef: RefObject<unknown>;
  readonly dispatchNextQuickRunFromGithubVerify: (next: QuickRunGithubAdvanceDispatch) => void;
  readonly appendImplementationExecutionNotice: (text: string) => void;
  readonly enrichCodeTaskRunOrchestrationPatch: (
    patch: PrototypeExecutionOrchestrationPersistInput | undefined,
  ) => PrototypeExecutionOrchestrationPersistInput | undefined;
  readonly applyImplementationRuntimeFetch: (fetched: unknown) => void;
  readonly persistedQueueDispatch: import("@/lib/prototype/selectedCodeTaskCursorExecution").CodeTaskQueueDispatchRef | null;
  readonly wipChipHandlers: Record<string, unknown>;
}>;

export function dispatchExecutionStageAction(
  actionId: ImplementationStageActionId,
  deps: ImplementationStageActionExecutionDispatchDeps,
): ImplementationStageActionRunResult | null {
${destructuring}
  switch (actionId) {
${switchCases}
    default:
      return null;
  }
}
`;

fs.writeFileSync(outPath, header);
console.log("Wrote", outPath, "lines", header.split("\n").length);
console.log("Next: node apps/web/scripts/prune-imports.mjs", outPath, "export function dispatchExecutionStageAction");
