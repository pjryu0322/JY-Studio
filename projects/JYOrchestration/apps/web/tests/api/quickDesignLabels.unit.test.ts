import { describe, expect, it } from "vitest";
import { createPlatformTrigger } from "@/lib/platform-orchestration/runResultFactory";
import { runFastPlanDraftFlow } from "@/lib/platform-orchestration/flows/fastPlanDraftFlow";
import { buildDynamicServicePlanningSlotDefinitions } from "@/lib/requirements/singleChatOrchestrationSlots";
import {
  buildQuickDesignResultMessage,
  countQuickDesignSlotsByArea,
  QUICK_DESIGN_LABEL,
  QUICK_DESIGN_TOOLTIP,
} from "@/lib/requirements/quickDesignLabels";
import {
  resolveFastPlanViewArtifactId,
  resolveLatestPlanningDeliverableAssetId,
} from "@/lib/requirements/fastPlanDraftGenerationHandoff";
import { parseRequirementsStateJson } from "@/lib/requirements/requirementsStateJson";

const nowIso = "2026-05-24T12:00:00.000Z";

describe("quickDesignLabels", () => {
  it("uses Quick Design as the user-facing draft action label", () => {
    expect(QUICK_DESIGN_LABEL).toBe("Quick Design");
    expect(QUICK_DESIGN_TOOLTIP).toContain("기획·분석·설계·디자인");
  });

  it("builds Quick Design result message with slot area counts", () => {
    const message = buildQuickDesignResultMessage({
      memberDrafts: [
        {
          draftId: "d1",
          runId: "r1",
          agentId: "ai-planner",
          role: "planner",
          targetSlotKeys: ["p.planning.servicePurpose"],
          content: "- 서비스 목적: 테스트",
          confidence: "candidate",
        },
      ],
      assumptions: [],
      slotCandidatePatch: {
        source: "quick_design",
        runId: "qd-test",
        patchedAt: nowIso,
        patchedSlotKeys: [
          "p.planning.servicePurpose",
          "p.flow.actorTypes",
          "p.architecture.automationLevel",
          "p.design.requiredScreens",
        ],
        updatedSlotKeys: [
          "p.planning.servicePurpose",
          "p.flow.actorTypes",
          "p.architecture.automationLevel",
          "p.design.requiredScreens",
        ],
        areaCounts: { planning: 1, analysis: 1, architecture: 1, design: 1 },
        entries: [],
        candidateSlotKeys: [],
        assumedSlotKeys: [],
      },
    });

    expect(message).toContain("Quick Design 초안이 생성되었습니다");
    expect(message).toContain("### 슬롯 후보 반영");
    expect(message).toContain("기획 후보: 1개");
    expect(message).toContain("분석 후보: 1개");
    expect(message).toContain("설계 후보: 1개");
    expect(message).toContain("디자인 후보: 1개");
    expect(message).not.toContain("분석 후보: 0개");
  });

  it("counts slot keys by planning/flow/architecture/design areas", () => {
    expect(
      countQuickDesignSlotsByArea([
        "p.planning.servicePurpose",
        "p.flow.actorTypes",
        "p.architecture.automationLevel",
        "p.design.requiredScreens",
      ]),
    ).toEqual({ planning: 1, analysis: 1, architecture: 1, design: 1 });
  });

  it("creates drafts for planner, analyst, architect, and designer", () => {
    const slotDefinitions = buildDynamicServicePlanningSlotDefinitions({
      projectId: "p1",
      projectName: "회의록",
    });
    const result = runFastPlanDraftFlow({
      trigger: createPlatformTrigger({
        flowId: "fast_plan_draft",
        source: "cta",
        projectId: "p1",
        conversationScope: "project_single_chat",
        createdAt: nowIso,
      }),
      projectName: "회의록",
      projectDescription: "녹취",
      conversationMessages: [],
      serviceFlow: null,
      orchestration: null,
      slotDefinitions,
      nowIso,
    });

    expect(result.memberDrafts.map((draft) => draft.role)).toEqual(
      expect.arrayContaining(["planner", "analyst", "architect", "designer"]),
    );
    expect(String(result.userMessage ?? "")).toContain("Quick Design 초안이 생성되었습니다");
  });

  it("does not confirm slots automatically after Quick Design draft", () => {
    const slotDefinitions = buildDynamicServicePlanningSlotDefinitions({
      projectId: "p1",
      projectName: "회의록",
    });
    const result = runFastPlanDraftFlow({
      trigger: createPlatformTrigger({
        flowId: "fast_plan_draft",
        source: "cta",
        projectId: "p1",
        conversationScope: "project_single_chat",
        createdAt: nowIso,
      }),
      projectName: "회의록",
      projectDescription: "녹취",
      conversationMessages: [],
      serviceFlow: null,
      orchestration: null,
      slotDefinitions,
      nowIso,
    });

    expect(JSON.stringify(result.statePatches)).not.toContain('"confirmed"');
  });

  it("resolves the latest planning deliverable asset for viewer", () => {
    const state = parseRequirementsStateJson({
      deliverableAssets: [
        {
          id: "del-1",
          projectId: "p1",
          title: "기획안",
          type: "full_plan",
          version: 1,
          createdAt: nowIso,
          content: "# 기획안",
        },
      ],
      projectArtifacts: [{ id: "artifact-legacy", type: "fast_prototype_plan", title: "legacy", createdAt: nowIso, createdBy: "ai", sourceStage: "IDEATION", content: "body" }],
    });

    expect(resolveLatestPlanningDeliverableAssetId({ state })).toBe("del-1");
    expect(resolveFastPlanViewArtifactId({ state })).toBe("del-1");
  });
});
