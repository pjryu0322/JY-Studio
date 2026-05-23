import { describe, expect, it, vi, beforeEach } from "vitest";
import { guardRequirementsAction } from "@/lib/requirements/requirementsActionGuard";
import {
  buildRequirementsIntentDispatchContext,
  dispatchRequirementsUserIntentAsync,
} from "@/lib/requirements/requirementsIntentDispatch";
import { postRequirementsIntentRouter } from "@/lib/requirements/requirementsIntentRouterClient";
import type { IntentRoutingResult } from "@/lib/requirements/requirementsIntentRouterTypes";
import {
  normalizeActionInvocationStrength,
  normalizeExecutionIntent,
} from "@/lib/requirements/requirementsIntentRouterTypes";
import {
  evaluateStrongActionExecutionPolicy,
  mergeGuardWithStrongActionPolicy,
  shouldOpenAlternativeCanvasFromAnalyze,
} from "@/lib/requirements/requirementsStrongActionPolicy";
import {
  createSampleServiceFlow,
  ORCHESTRATION_REGRESSION_NOW,
} from "../orchestration/helpers/orchestrationRegressionHarness";
import type { RequirementsStateJson } from "@/lib/requirements/requirementsStateJson";
vi.mock("@/lib/requirements/requirementsIntentRouterClient", () => ({
  postRequirementsIntentRouter: vi.fn(),
}));

const mockedPostRouter = vi.mocked(postRequirementsIntentRouter);

/** Authoritative stage SERVICE_FLOW (PROPOSAL) — GENERATE_ALTERNATIVE + DIRECT_INPUT both allowed. */
function serviceFlowProposalState(): RequirementsStateJson {
  return {
    serviceFlowV1: createSampleServiceFlow({ conversationState: "PROPOSAL" }),
    requirementsOrchestrationStageV1: {
      currentStage: "IDEATION",
      activePhase: "IDEATION",
      completedStages: [],
      updatedAt: ORCHESTRATION_REGRESSION_NOW,
    },
  };
}

function basePolicyInput(
  overrides: Partial<Parameters<typeof evaluateStrongActionExecutionPolicy>[0]> = {},
) {
  return {
    suggestedActionId: "GENERATE_ALTERNATIVE" as const,
    userMessage: "검수절차를 제안해줘",
    directQuickActionId: null,
    authoritativeStage: "SERVICE_FLOW" as const,
    availableActionIds: [
      "APPLY_PROPOSAL",
      "REVIEW_FLOW",
      "GENERATE_ALTERNATIVE",
      "PARTIAL_EDIT",
      "DIRECT_INPUT",
      "HOLD",
    ] as const,
    ...overrides,
  };
}

describe("requirementsStrongActionPolicy", () => {
  beforeEach(() => {
    mockedPostRouter.mockReset();
  });

  it("normalizes missing execution metadata to ambiguous / weak", () => {
    expect(normalizeExecutionIntent(undefined)).toBe("ambiguous");
    expect(normalizeActionInvocationStrength(undefined)).toBe("weak");
    expect(normalizeExecutionIntent("ask_advice")).toBe("ask_advice");
    expect(normalizeActionInvocationStrength("explicit")).toBe("explicit");
  });

  it("allows direct quick action GENERATE_ALTERNATIVE", () => {
    const decision = evaluateStrongActionExecutionPolicy(
      basePolicyInput({
        directQuickActionId: "GENERATE_ALTERNATIVE",
        actionInvocationStrength: "explicit",
        executionIntent: "explicit_execute",
      }),
    );
    expect(decision.allowed).toBe(true);
  });

  it("blocks free-text weak GENERATE_ALTERNATIVE (ask_advice, not keyword rules)", () => {
    const decision = evaluateStrongActionExecutionPolicy(
      basePolicyInput({
        actionInvocationStrength: "weak",
        executionIntent: "ask_advice",
      }),
    );
    expect(decision.allowed).toBe(false);
    expect(decision.fallbackActionId).toBe("DIRECT_INPUT");
  });

  it("allows free-text explicit alternative comparison", () => {
    const decision = evaluateStrongActionExecutionPolicy(
      basePolicyInput({
        userMessage: "기존안 말고 다른 대안을 비교해줘",
        actionInvocationStrength: "explicit",
        executionIntent: "ask_compare",
      }),
    );
    expect(decision.allowed).toBe(true);
  });

  it("mergeGuard downgrades to DIRECT_INPUT when strong action blocked", () => {
    const state = serviceFlowProposalState();
    const ctx = buildRequirementsIntentDispatchContext(state);
    const intent: IntentRoutingResult = {
      intentType: "orchestration_action",
      suggestedActionId: "GENERATE_ALTERNATIVE",
      confidence: 0.85,
      reason: "llm suggested alternative",
      routerMode: "llm",
      executionIntent: "ask_advice",
      actionInvocationStrength: "weak",
    };
    const baseGuard = guardRequirementsAction({
      suggestedActionId: "GENERATE_ALTERNATIVE",
      authoritativeStage: ctx.authoritativeStage,
      availableActionIds: ctx.availableActionIds,
      featureMetrics: ctx.featureMetrics,
    });
    const guard = mergeGuardWithStrongActionPolicy({
      guard: baseGuard,
      suggestedActionId: intent.suggestedActionId,
      userMessage: "검수절차를 제안해줘",
      intent,
      authoritativeStage: ctx.authoritativeStage,
      availableActionIds: ctx.availableActionIds,
      featureMetrics: ctx.featureMetrics,
    });
    expect(guard.allowed).toBe(true);
    expect(guard.effectiveActionId).toBe("DIRECT_INPUT");
    expect(guard.warning).toContain("기획 제안");
  });

  it("shouldOpenAlternativeCanvasFromAnalyze only when quickAction is GENERATE_ALTERNATIVE", () => {
    expect(
      shouldOpenAlternativeCanvasFromAnalyze({
        openAlternativeCanvas: true,
        quickActionId: "GENERATE_ALTERNATIVE",
      }),
    ).toBe(true);
    expect(
      shouldOpenAlternativeCanvasFromAnalyze({
        openAlternativeCanvas: true,
        quickActionId: "DIRECT_INPUT",
      }),
    ).toBe(false);
    expect(
      shouldOpenAlternativeCanvasFromAnalyze({
        openAlternativeCanvas: true,
        quickActionId: null,
      }),
    ).toBe(false);
  });

  it("dispatch async: weak GENERATE_ALTERNATIVE LLM suggestion does not become effective action", async () => {
    const state = serviceFlowProposalState();
    const ctx = buildRequirementsIntentDispatchContext(state);
    mockedPostRouter.mockResolvedValue({
      ok: true,
      intent: {
        intentType: "orchestration_action",
        suggestedActionId: "GENERATE_ALTERNATIVE",
        confidence: 0.9,
        reason: "test mock",
        routerMode: "llm",
        executionIntent: "ask_advice",
        actionInvocationStrength: "weak",
      },
    });

    const result = await dispatchRequirementsUserIntentAsync({
      userMessage: "검수절차를 제안해줘",
      ctx,
      projectId: "proj-strong-guard",
      routingState: state,
    });

    expect(result.effectiveActionId).not.toBe("GENERATE_ALTERNATIVE");
    expect(result.effectiveQuickAction?.id).not.toBe("GENERATE_ALTERNATIVE");
    expect(result.effectiveActionId).toBe("DIRECT_INPUT");
  });
});
