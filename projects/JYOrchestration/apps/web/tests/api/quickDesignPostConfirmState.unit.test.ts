import { describe, expect, it } from "vitest";
import {
  quickDesignPostConfirmChipLabelsForState,
} from "@/lib/requirements/implementationUxLabels";
import { resolveQuickDesignImplementationReadyCopy } from "@/lib/requirements/quickDesignConfirmArtifacts";
import { evaluateQuickDesignPostConfirmState } from "@/lib/requirements/quickDesignPostConfirmState";
import {
  IMPLEMENTATION_SEED_REQUIRED_GAP_KEYS,
  IMPLEMENTATION_SEED_SLOT_SUFFIX_BY_GAP,
} from "@/lib/requirements/implementationSeed";
import {
  buildDynamicServicePlanningSlotDefinitions,
  initialOrchestrationStateFromDefinitions,
} from "@/lib/requirements/singleChatOrchestrationSlots";
import { findOrchestrationSlotKeysBySuffix } from "@/lib/requirements/singleChatSlotNextAction";

const nowIso = "2026-05-26T10:00:00.000Z";

describe("quickDesignPostConfirmChipLabelsForState", () => {
  it("hides work plan draft CTA when env is not ready", () => {
    const chips = quickDesignPostConfirmChipLabelsForState({
      seedReady: true,
      designOk: true,
      envOk: false,
      hasReferenceArtifacts: true,
    });

    expect(chips).not.toContain("구현 작업안 초안 생성");
    expect(chips[0]).toBe("환경설정 열기");
    expect(chips).toContain("구현단계로 이동");
  });

  it("hides implementation navigation and work plan CTA when seed is not ready", () => {
    const chips = quickDesignPostConfirmChipLabelsForState({
      seedReady: false,
      designOk: true,
      envOk: true,
      hasReferenceArtifacts: true,
    });

    expect(chips).not.toContain("구현단계로 이동");
    expect(chips).not.toContain("구현 작업안 초안 생성");
    expect(chips).toContain("Seed 후보 확인/확정");
  });

  it("shows work plan draft CTA only when seed, design, env, and artifacts are ready", () => {
    const chips = quickDesignPostConfirmChipLabelsForState({
      seedReady: true,
      designOk: true,
      envOk: true,
      hasReferenceArtifacts: true,
    });

    expect(chips).toContain("구현 작업안 초안 생성");
    expect(chips[0]).toBe("구현 작업안 초안 생성");
  });
});

describe("resolveQuickDesignImplementationReadyCopy", () => {
  it("uses planning/seed heading when env is not ready", () => {
    const copy = resolveQuickDesignImplementationReadyCopy({
      state: { seedReady: true, designOk: true, envOk: false, hasReferenceArtifacts: true },
      autoConfirmedRequired: true,
    });
    expect(copy.heading).toBe("기획/Seed 준비가 완료되었습니다.");
    expect(copy.intro).not.toContain("구현 작업안 초안을 생성할 수 있습니다");
    expect(copy.intro).toContain("환경 설정");
  });

  it("uses full implementation heading when env is ready", () => {
    const copy = resolveQuickDesignImplementationReadyCopy({
      state: { seedReady: true, designOk: true, envOk: true, hasReferenceArtifacts: true },
      autoConfirmedRequired: true,
    });
    expect(copy.heading).toBe("구현 작업 준비가 완료되었습니다.");
    expect(copy.intro).toContain("구현 작업안 초안을 생성할 수 있습니다");
  });
});

describe("evaluateQuickDesignPostConfirmState", () => {
  it("marks seedReady only when prep is complete", () => {
    const definitions = buildDynamicServicePlanningSlotDefinitions({ projectName: "테스트" });
    const orchestration = initialOrchestrationStateFromDefinitions(definitions, nowIso);
    const state = evaluateQuickDesignPostConfirmState({
      readiness: { ready: true, score: 0.8, missing: [], warnings: [] },
      prepComplete: false,
      projectArtifacts: [{ id: "a1", type: "summary", title: "요약", content: "# x", createdAt: nowIso, createdBy: "ai", sourceStage: "ideation" }],
      envOk: true,
    });
    expect(state.seedReady).toBe(false);
  });

  it("detects reference artifacts from planning outputs", () => {
    const definitions = buildDynamicServicePlanningSlotDefinitions({ projectName: "테스트" });
    const slots = { ...initialOrchestrationStateFromDefinitions(definitions, nowIso).slots };
    for (const gapKey of IMPLEMENTATION_SEED_REQUIRED_GAP_KEYS) {
      const key = findOrchestrationSlotKeysBySuffix(definitions, IMPLEMENTATION_SEED_SLOT_SUFFIX_BY_GAP[gapKey])[0];
      if (!key || !slots[key]) continue;
      slots[key] = { ...slots[key], status: "confirmed", value: "사용자: 작업\n검수자: 검토", updatedAt: nowIso };
    }
    const state = evaluateQuickDesignPostConfirmState({
      readiness: { ready: true, score: 1, missing: [], warnings: [] },
      prepComplete: true,
      projectArtifacts: [
        {
          id: "a1",
          type: "summary",
          title: "프로젝트 요약서",
          content: "# 프로젝트 요약\n\n본문",
          createdAt: nowIso,
          createdBy: "ai",
          sourceStage: "ideation",
          orchestration: { required: true, completeness: "full" },
        },
      ],
      envOk: false,
    });
    expect(state.hasReferenceArtifacts).toBe(true);
    expect(state.seedReady).toBe(true);
    expect(state.envOk).toBe(false);
  });
});
