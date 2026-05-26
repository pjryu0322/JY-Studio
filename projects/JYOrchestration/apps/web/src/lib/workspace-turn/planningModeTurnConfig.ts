import type { WorkspaceTurnConfig, WorkspaceTurnInput } from "@/lib/workspace-turn/workspaceTurnTypes";
import { validateImplementationTurnModelJson } from "@/lib/workspace-turn/workspaceTurnValidation";

/** Planning mode — 후속 작업에서 prototype-chat/turn 로직을 이전할 placeholder */
export type PlanningTurnContext = Readonly<{
  readonly slots: readonly { key: string; title: string; question: string; required: boolean }[];
  readonly answers: Readonly<Record<string, string>>;
  readonly currentSlotKey: string | null;
  readonly envOk: boolean;
}>;

export type PlanningTurnStatePatch = Readonly<{
  readonly slotKeyToFill?: string | null;
  readonly slotValue?: string | null;
  readonly nextSlotKey?: string | null;
}>;

export const planningModeTurnConfig: WorkspaceTurnConfig<PlanningTurnContext, PlanningTurnStatePatch> = {
  mode: "planning",
  stage: "feature-planning",
  primaryMemberId: "prototype_build",
  primaryMemberLabel: "AI 분석가",
  advisorMemberIds: [],
  responseContract: "Planning mode — use /api/prototype-chat/turn until migrated.",
  buildSystemPrompt: () => "Planning mode not wired to workspace turn orchestrator yet.",
  buildUserPrompt: (input: WorkspaceTurnInput<PlanningTurnContext>) => input.userMessage,
  validateModelJson: validateImplementationTurnModelJson,
  fallbackAnalyze: () => ({
    intent: "unknown",
    status: "none",
    confidence: "low",
    responderLabel: "AI 분석가",
    assistantMessage: "Planning mode는 아직 workspace turn으로 연결되지 않았습니다.",
    summary: "not wired",
    extractedRules: [],
    targetAreas: [],
    requiresClarification: false,
    clarifyingQuestion: null,
    nextQuestion: null,
  }),
  buildStatePatch: () => ({}) as PlanningTurnStatePatch,
  buildTimelineEntries: () => [],
};
