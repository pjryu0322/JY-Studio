import { describe, expect, it } from "vitest";
import {
  canOpenAlternativeViewer,
  canUseProjectExecutionActions,
  canUseServiceFlowAnalyze,
  containsPreProjectForbiddenExecutionMarkers,
  conversationScopeFromConversationScope,
  conversationScopeFromProjectId,
  isPreProjectWorkspaceScreenKey,
  PRE_PROJECT_EXECUTION_SCOPE_BOUNDARY_PROMPT,
  sanitizePreProjectContaminatedResponse,
  shouldApplyStrongActionGuard,
} from "@/lib/conversation/conversationScopeBoundary";
import { buildServiceFlowResponsePolicyFromDispatch } from "@/lib/requirements/serviceFlowAdviceMode";
import { mergeGuardWithStrongActionPolicy } from "@/lib/requirements/requirementsStrongActionPolicy";
import type { IntentRoutingResult } from "@/lib/requirements/requirementsIntentRouterTypes";
import { guardRequirementsAction } from "@/lib/requirements/requirementsActionGuard";

describe("conversationScopeBoundary", () => {
  it("does not allow service-flow analyze in pre-project scope", () => {
    expect(canUseServiceFlowAnalyze("pre_project")).toBe(false);
  });

  it("allows service-flow analyze in project single chat scope", () => {
    expect(canUseServiceFlowAnalyze("project_single_chat")).toBe(true);
  });

  it("does not allow alternative viewer in pre-project scope", () => {
    expect(canOpenAlternativeViewer("pre_project")).toBe(false);
  });

  it("allows alternative viewer in project single chat scope", () => {
    expect(canOpenAlternativeViewer("project_single_chat")).toBe(true);
  });

  it("maps projectId presence to execution scope", () => {
    expect(conversationScopeFromProjectId(null)).toBe("pre_project");
    expect(conversationScopeFromProjectId("")).toBe("pre_project");
    expect(conversationScopeFromProjectId("proj-1")).toBe("project_single_chat");
  });

  it("maps conversation scope to execution scope", () => {
    expect(conversationScopeFromConversationScope("pre_project")).toBe("pre_project");
    expect(conversationScopeFromConversationScope("project")).toBe("project_single_chat");
  });

  it("rejects pre-project workspace screen keys for analyze API", () => {
    expect(isPreProjectWorkspaceScreenKey("pre_project")).toBe(true);
    expect(isPreProjectWorkspaceScreenKey("messenger_pre_project")).toBe(true);
    expect(isPreProjectWorkspaceScreenKey("requirements_service_flow")).toBe(false);
  });

  it("detects forbidden execution markers in pre-project responses", () => {
    expect(containsPreProjectForbiddenExecutionMarkers("GENERATE_ALTERNATIVE 실행")).toBe(true);
    expect(containsPreProjectForbiddenExecutionMarkers("검수 절차를 단계별로 제안합니다.")).toBe(false);
  });

  it("detects pre-project execution contamination markers", () => {
    expect(
      containsPreProjectForbiddenExecutionMarkers(
        "다음 [ProposalDecision] action: GENERATE_ALTERNATIVE 대안 비교 Viewer를 엽니다.",
      ),
    ).toBe(true);
  });

  it("sanitizes contaminated pre-project response", () => {
    const result = sanitizePreProjectContaminatedResponse({
      text: "검수절차를 제안합니다. [ProposalDecision] action: GENERATE_ALTERNATIVE 대안 비교 Viewer를 엽니다.",
      fallbackUserMessage: "검수절차를 제안해줘",
    });

    expect(result.contaminated).toBe(true);
    expect(result.text).not.toContain("[ProposalDecision]");
    expect(result.text).not.toContain("GENERATE_ALTERNATIVE");
    expect(result.text).not.toContain("대안 비교 Viewer");
    expect(result.text).toContain("검수절차");
  });

  it("uses safe fallback when sanitized text is too short", () => {
    const result = sanitizePreProjectContaminatedResponse({
      text: "[ProposalDecision] GENERATE_ALTERNATIVE",
      fallbackUserMessage: "다른 대안을 보여줘",
    });

    expect(result.contaminated).toBe(true);
    expect(result.text.length).toBeGreaterThan(60);
    expect(result.text).toContain("프로젝트 생성 전");
    expect(result.text).not.toContain("GENERATE_ALTERNATIVE");
    expect(result.text).toContain("다른 대안을 보여줘");
  });

  it("leaves clean pre-project response unchanged", () => {
    const clean = "검수 절차는 1) 초안 검토 2) 승인 3) 반영 순으로 두는 것이 좋습니다.";
    const result = sanitizePreProjectContaminatedResponse({ text: clean });
    expect(result.contaminated).toBe(false);
    expect(result.text).toBe(clean);
  });

  it("skips strong action guard outside project single chat", () => {
    const baseGuard = guardRequirementsAction({
      suggestedActionId: "GENERATE_ALTERNATIVE",
      authoritativeStage: "IDEATION",
      availableActionIds: ["GENERATE_ALTERNATIVE"],
      featureMetrics: { filledSlotCount: 0, totalSlotCount: 0, completionRatio: 0 },
    });
    const intent: IntentRoutingResult = {
      intentType: "command",
      suggestedActionId: "GENERATE_ALTERNATIVE",
      confidence: 0.95,
      reason: "test",
      routerMode: "llm",
      executionIntent: "compare_alternatives",
      actionInvocationStrength: "strong",
    };
    const guarded = mergeGuardWithStrongActionPolicy({
      guard: baseGuard,
      suggestedActionId: "GENERATE_ALTERNATIVE",
      userMessage: "다른 대안을 비교해줘",
      intent,
      authoritativeStage: "IDEATION",
      availableActionIds: ["GENERATE_ALTERNATIVE"],
      featureMetrics: { filledSlotCount: 0, totalSlotCount: 0, completionRatio: 0 },
      executionScope: "pre_project",
    });
    expect(guarded).toEqual(baseGuard);
    expect(shouldApplyStrongActionGuard("pre_project")).toBe(false);
    expect(canUseProjectExecutionActions("pre_project")).toBe(false);
  });

  it("advice policy defaults to flow_update outside project single chat", () => {
    const intent: IntentRoutingResult = {
      intentType: "question",
      suggestedActionId: null,
      confidence: 0.9,
      reason: "test",
      routerMode: "llm",
      executionIntent: "ask_advice",
    };
    const policy = buildServiceFlowResponsePolicyFromDispatch({
      intent,
      guard: { allowed: false, reason: "n/a" },
      effectiveActionId: "DIRECT_INPUT",
      executionScope: "pre_project",
    });
    expect(policy.mode).toBe("flow_update");
  });

  it("exposes pre-project boundary prompt text", () => {
    expect(PRE_PROJECT_EXECUTION_SCOPE_BOUNDARY_PROMPT).toContain("프로젝트 생성 전");
    expect(PRE_PROJECT_EXECUTION_SCOPE_BOUNDARY_PROMPT).toContain("예고성 반복 문구는 금지");
  });
});
