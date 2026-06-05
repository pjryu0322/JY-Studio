import { describe, expect, it } from "vitest";
import {
  buildImplementationCandidateItems,
  buildRefineSelectedImplementationCandidatesPrompt,
  formatImplementationCandidateSummaryLines,
  implementationCandidateLabelForKey,
  resolveImplementationCandidateGapKeys,
} from "@/lib/requirements/implementationCandidateLabels";
import { formatQuickDesignImplementationPrepSummaryLines } from "@/lib/requirements/quickDesignConfirmImplementationPrep";
import {
  buildDynamicServicePlanningSlotDefinitions,
  initialOrchestrationStateFromDefinitions,
} from "@/lib/requirements/singleChatOrchestrationSlots";

describe("implementationCandidateLabels", () => {
  it("maps internal gap keys to user-facing labels", () => {
    expect(implementationCandidateLabelForKey("actor_permission_matrix")).toBe("액터별 권한");
    expect(implementationCandidateLabelForKey("screen_data_map")).toBe("화면별 데이터");
    expect(implementationCandidateLabelForKey("unknown_key")).toBe("기획정보 항목");
  });

  it("formats candidate summary lines without internal keys", () => {
    const lines = formatImplementationCandidateSummaryLines([
      "actor_permission_matrix",
      "state_model",
    ]);
    expect(lines).toEqual(["- 액터별 권한: 후보", "- 상태 모델: 후보"]);
    expect(lines.join("\n")).not.toContain("actor_permission_matrix");
  });

  it("builds selected refine composer prompt", () => {
    expect(
      buildRefineSelectedImplementationCandidatesPrompt(["액터별 권한", "화면별 데이터"]),
    ).toBe("다음 기획정보 후보 항목을 보완해 주세요: 액터별 권한, 화면별 데이터");
  });

  it("uses touched gap keys for prep summary instead of abstract placeholder", () => {
    const definitions = buildDynamicServicePlanningSlotDefinitions({
      projectId: "p1",
      projectName: "회의록",
    });
    const orchestration = initialOrchestrationStateFromDefinitions(definitions, "2026-05-27T00:00:00.000Z");

    const lines = formatQuickDesignImplementationPrepSummaryLines({
      prepComplete: false,
      readiness: { ready: false, score: 0.2, missing: [], warnings: [] },
      autoCandidateGenerated: true,
      touchedGapKeys: ["actor_permission_matrix", "screen_actor_matrix", "state_model"],
      orchestration,
      definitions,
    });

    expect(lines.some((l) => l.includes("액터별 권한: 후보"))).toBe(true);
    expect(lines.some((l) => l.includes("화면별 사용 액터: 후보"))).toBe(true);
    expect(lines.some((l) => l.includes("상태 모델: 후보"))).toBe(true);
    expect(lines.join("\n")).not.toContain("일부 항목은 후보 상태");
  });

  it("builds candidate items with descriptions", () => {
    const items = buildImplementationCandidateItems(["mock_data_strategy"]);
    expect(items).toHaveLength(1);
    expect(items[0]?.label).toBe("샘플 데이터 전략");
    expect(items[0]?.description).toContain("예시 데이터");
  });

  it("resolves keys from touched list first", () => {
    const keys = resolveImplementationCandidateGapKeys({
      touchedGapKeys: ["data_entities"],
      autoCandidateGenerated: true,
    });
    expect(keys).toEqual(["data_entities"]);
  });
});
