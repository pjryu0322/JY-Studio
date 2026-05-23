import { describe, expect, it } from "vitest";
import { buildPlanningCoreSlotProposal } from "@/lib/requirements/singleChatPlanningSlotProposal";
import { normalizeSlotStatus } from "@/lib/requirements/singleChatOrchestrationSlots";
import { initialOrchestrationStateFromDefinitions } from "@/lib/requirements/singleChatOrchestrationSlots";
import { createDefaultSlotDefinitions, ORCHESTRATION_REGRESSION_NOW } from "../orchestration/helpers/orchestrationRegressionHarness";

function findSlot(
  state: ReturnType<typeof initialOrchestrationStateFromDefinitions>,
  suffix: string,
) {
  const key = Object.keys(state.slots).find((k) => k.endsWith(suffix));
  return key ? state.slots[key] : null;
}

describe("singleChatPlanningSlotProposal", () => {
  const definitions = createDefaultSlotDefinitions();

  it("builds planning core proposal and candidate slot patch", () => {
    const orchestration = initialOrchestrationStateFromDefinitions(definitions, ORCHESTRATION_REGRESSION_NOW);
    const result = buildPlanningCoreSlotProposal({
      projectName: "회의록 자동 정리",
      projectDescription: "녹취 파일을 회의록과 TODO로 정리하는 웹서비스",
      orchestration,
      definitions,
      recentMessages: "사용자는 회의록 자동 정리 서비스를 원함",
    });

    expect(result.assistantMessage).toContain("AI기획자 제안");
    expect(result.assistantMessage).toContain("서비스 목적");
    expect(result.assistantMessage).toContain("주 사용자");
    expect(result.assistantMessage).toContain("핵심 문제");
    expect(result.assistantMessage).toContain("기대 효과");

    expect(normalizeSlotStatus(String(findSlot(result.orchestration, ".planning.servicePurpose")?.status))).toBe(
      "candidate",
    );
    expect(normalizeSlotStatus(String(findSlot(result.orchestration, ".planning.coreUsers")?.status))).toBe(
      "candidate",
    );
    expect(normalizeSlotStatus(String(findSlot(result.orchestration, ".planning.problem")?.status))).toBe(
      "candidate",
    );
    expect(
      normalizeSlotStatus(String(findSlot(result.orchestration, ".planning.expectedOutcome")?.status)),
    ).toBe("candidate");

    expect(result.quickReplies).toEqual(
      expect.arrayContaining([
        expect.objectContaining({ label: "이 기준으로 반영" }),
      ]),
    );
  });
});
