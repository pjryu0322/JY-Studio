import { describe, expect, it } from "vitest";
import {
  isImplementationCandidateRefineApplyPrompt,
  isImplementationCandidateRefinePrompt,
  parseImplementationCandidateRefineApplyFromUserMessage,
  parseImplementationCandidateRefineFromUserMessage,
} from "@/lib/requirements/implementationCandidateRefineRequest";
import { implementationCandidateRefineApplyResultChips } from "@/lib/requirements/implementationCandidateRefineCta";
import {
  buildImplementationCandidateRefineResultItems,
  formatImplementationCandidateRefineResultMessage,
  runImplementationCandidateRefineApplyTurn,
  runImplementationCandidateRefineTurn,
} from "@/lib/requirements/implementationCandidateRefineResult";
import { isUiInstructionLikePlanningValue } from "@/lib/requirements/uiInstructionLikePlanningValue";
import {
  buildDynamicServicePlanningSlotDefinitions,
  initialOrchestrationStateFromDefinitions,
} from "@/lib/requirements/singleChatOrchestrationSlots";
import { buildImplementationSeedCandidateSlotPatches } from "@/lib/requirements/implementationSeed";

const nowIso = "2026-05-27T12:00:00.000Z";

describe("implementationCandidateRefineResult", () => {
  it("detects refine prompts", () => {
    expect(
      isImplementationCandidateRefinePrompt(
        "구현 전 확인이 필요한 기획정보 후보 항목 전체를 검토하고, 보완이 필요한 내용을 정리해 주세요.",
      ),
    ).toBe(true);
    expect(
      isImplementationCandidateRefinePrompt("다음 기획정보 후보 항목을 보완해 주세요: 액터별 권한, 상태 모델"),
    ).toBe(true);
  });

  it("parses selected labels from user message", () => {
    const parsed = parseImplementationCandidateRefineFromUserMessage(
      "다음 기획정보 후보 항목을 보완해 주세요: 액터별 권한, 상태 모델",
    );
    expect(parsed?.mode).toBe("selected");
    expect(parsed?.kind).toBe("review");
    expect(parsed?.labels).toEqual(["액터별 권한", "상태 모델"]);
    expect(parsed?.keys).toContain("actor_permission_matrix");
  });

  it("detects and parses apply prompts", () => {
    const text =
      "다음 기획정보 후보 항목 보완안을 적용해 주세요: 데이터 항목, 액터별 권한";
    expect(isImplementationCandidateRefineApplyPrompt(text)).toBe(true);
    expect(isImplementationCandidateRefinePrompt(text)).toBe(true);
    const parsed = parseImplementationCandidateRefineApplyFromUserMessage(text);
    expect(parsed?.kind).toBe("apply");
    expect(parsed?.mode).toBe("selected");
    expect(parsed?.keys).toContain("data_entities");
    expect(parsed?.keys).toContain("actor_permission_matrix");
  });

  it("formats itemized review table with summary counts", () => {
    const definitions = buildDynamicServicePlanningSlotDefinitions({
      projectId: "p1",
      projectName: "회의록",
    });
    let orchestration = initialOrchestrationStateFromDefinitions(definitions, nowIso);
    const patch = buildImplementationSeedCandidateSlotPatches({
      orchestration,
      definitions,
      projectName: "회의록",
      nowIso,
    });
    orchestration = { ...orchestration, slots: patch.slots, updatedAt: nowIso };

    const turn = runImplementationCandidateRefineTurn({
      mode: "selected",
      keys: ["actor_permission_matrix", "state_model"],
      orchestration,
      definitions,
      nowIso,
      autoCandidateGenerated: true,
    });

    expect(turn.items).toHaveLength(2);
    expect(turn.summary.targetCount).toBe(2);
    expect(turn.summary.reviewedCount).toBe(2);
    expect(turn.assistantMessage).toContain("검토 요약:");
    expect(turn.assistantMessage).toContain("| 항목 | 현재 상태 | 보완 결과 | 다음 처리 |");
    expect(turn.assistantMessage).not.toContain("actor_permission_matrix");
    expect(turn.interviewSuggestions).toContain("선택 보완안 적용");
    expect(turn.interviewSuggestions).not.toContain("추천안 적용");
  });

  it("does not mark empty refinement as confirmed wording", () => {
    const definitions = buildDynamicServicePlanningSlotDefinitions({
      projectId: "p2",
      projectName: "테스트",
    });
    const orchestration = initialOrchestrationStateFromDefinitions(definitions, nowIso);
    const items = buildImplementationCandidateRefineResultItems({
      keys: ["data_entities"],
      orchestration,
      definitions,
    });
    expect(items[0]?.refinedValue.length).toBeGreaterThan(8);
    expect(items[0]?.refinedValue).not.toBe("보완됨");
  });

  it("filters ui instruction-like planner slot values", () => {
    expect(
      isUiInstructionLikePlanningValue(
        "기획 정보를 보완하겠습니다. 수정할 슬롯이나 항목을 알려 주세요.",
      ),
    ).toBe(true);
    expect(isUiInstructionLikePlanningValue("MVP 1차 범위는 음성 인식·요약·TODO 추출입니다.")).toBe(
      false,
    );
  });

  it("formats all-mode title for full review", () => {
    const msg = formatImplementationCandidateRefineResultMessage({
      mode: "all",
      items: [
        {
          key: "state_model",
          label: "상태 모델",
          beforeStatus: "candidate",
          refinedValue: "상태 흐름 초안",
          resultStatus: "needs_confirmation",
          nextActionLabel: "추가 확인",
        },
      ],
      summary: {
        targetCount: 1,
        reviewedCount: 1,
        confirmableCount: 0,
        needsConfirmationCount: 1,
      },
    });
    expect(msg).toContain("전체 검토 결과");
  });

  it("formats apply result with dedicated chips", () => {
    const definitions = buildDynamicServicePlanningSlotDefinitions({
      projectId: "p3",
      projectName: "회의록",
    });
    let orchestration = initialOrchestrationStateFromDefinitions(definitions, nowIso);
    const patch = buildImplementationSeedCandidateSlotPatches({
      orchestration,
      definitions,
      projectName: "회의록",
      nowIso,
    });
    orchestration = { ...orchestration, slots: patch.slots, updatedAt: nowIso };

    const turn = runImplementationCandidateRefineApplyTurn({
      mode: "selected",
      appliedKeys: ["data_entities", "actor_permission_matrix"],
      orchestration,
      definitions,
      autoCandidateGenerated: true,
    });

    expect(turn.assistantMessage).toContain("선택 보완안 적용 결과");
    expect(turn.assistantMessage).toContain("적용 항목:");
    expect(turn.assistantMessage).toContain("아직 검토·확정이 필요한 항목:");
    expect(turn.assistantMessage).toContain("Implementation Seed 확정");
    expect(turn.appliedKeys).toHaveLength(2);
    expect(implementationCandidateRefineApplyResultChips()).toContain("구현단계로 이동");
    expect(turn.interviewSuggestions).not.toContain("추천안 적용");
  });
});
