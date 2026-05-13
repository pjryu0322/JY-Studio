/**
 * augment의 conflict 연결 검증: timelineMessages가 주어졌을 때
 * `overlayConflictWarnings`가 실제 생성되는지, 없을 때는 출력에서 빠지는지.
 */
import { describe, expect, it } from "vitest";
import { buildOrchestrationOverlayPromptTraceAugments } from "@/lib/overlay/overlayPromptTraceAugment";
import type { SingleChatOrchestrationTurnMeta } from "@/lib/requirements/singleChatOrchestrationOpenAI";

function buildMinimalMeta(overrides: Partial<SingleChatOrchestrationTurnMeta> = {}): SingleChatOrchestrationTurnMeta {
  return {
    routingDecision: "primary",
    matchedSlots: [],
    updatedSlotKeys: [],
    updatedSlotCount: 0,
    delegatedAgents: [],
    orchestratorAgent: "planner",
    executedAgents: [],
    staleSlots: [],
    confirmedSlots: [],
    candidateSlots: [],
    slotDependenciesChanged: false,
    questionGeneratedBy: "planner",
    ...overrides,
  } as SingleChatOrchestrationTurnMeta;
}

describe("buildOrchestrationOverlayPromptTraceAugments — conflict + budget fallback", () => {
  it("emits overlayConflictWarnings when timelineMessages contain conflicting keywords", () => {
    const out = buildOrchestrationOverlayPromptTraceAugments({
      workspaceScreenKey: "requirements_ideation",
      timelineStage: "ideation",
      meta: buildMinimalMeta(),
      timelineMessages: [
        "로그인 토큰은 localStorage에 두고 JWT를 사용하자.",
        "기존 모놀리식 vs 마이크로서비스 구조 검토.",
      ],
      promptText: "user prompt body",
    });
    const codes = (out.overlayConflictWarnings ?? []).map((w) => w.code);
    expect(codes).toContain("OVERLAY_CONFLICT_LOCALSTORAGE_VS_JWT");
    expect(codes).toContain("OVERLAY_CONFLICT_MONOLITH_VS_MICROSERVICE");
  });

  it("omits overlayConflictWarnings field when no timelineMessages or all blank", () => {
    const out = buildOrchestrationOverlayPromptTraceAugments({
      workspaceScreenKey: "requirements_ideation",
      timelineStage: "ideation",
      meta: buildMinimalMeta(),
      timelineMessages: ["", "   ", null as unknown as string],
    });
    expect(out.overlayConflictWarnings).toBeUndefined();
  });

  it("always emits overlayContextBudget — fallback to promptText length when promptLength is missing", () => {
    const out = buildOrchestrationOverlayPromptTraceAugments({
      workspaceScreenKey: "requirements_ideation",
      timelineStage: "ideation",
      meta: buildMinimalMeta(),
      promptText: "a".repeat(1200),
    });
    expect(out.overlayContextBudget).toBeDefined();
    expect(out.overlayContextBudget?.estimatedInputTokens).toBeGreaterThan(0);
  });

  it("falls back to JSON.stringify heuristic when neither promptLength nor promptText is provided", () => {
    const out = buildOrchestrationOverlayPromptTraceAugments({
      workspaceScreenKey: "requirements_ideation",
      timelineStage: "ideation",
      meta: buildMinimalMeta({
        decisionAxis: "scope",
        ownershipReason: "explicit_mention",
      }),
    });
    expect(out.overlayContextBudget).toBeDefined();
    // budget metadata는 항상 생성되며 정책은 valid한 enum 값이다.
    expect(["compact", "balanced", "default", "extended"]).toContain(
      out.overlayContextBudget?.budgetPolicy ?? ""
    );
  });
});
