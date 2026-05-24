import { describe, expect, it } from "vitest";
import { createPlatformTrigger } from "@/lib/platform-orchestration/runResultFactory";
import { runFastPlanDraftFlow } from "@/lib/platform-orchestration/flows/fastPlanDraftFlow";
import { buildDynamicServicePlanningSlotDefinitions } from "@/lib/requirements/singleChatOrchestrationSlots";
import {
  buildQuickDesignResultMessage,
  buildQuickDesignSlotsPatchedTimelineEntry,
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

const samplePatch = {
  source: "quick_design" as const,
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
};

describe("quickDesignLabels", () => {
  it("uses Quick Design as the user-facing draft action label", () => {
    expect(QUICK_DESIGN_LABEL).toBe("Quick Design");
    expect(QUICK_DESIGN_TOOLTIP).toContain("기획·분석·설계·디자인");
  });

  it("does not expose slot candidate counts in user-facing Quick Design message", () => {
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
      slotCandidatePatch: samplePatch,
    });

    expect(message).toContain("Quick Design 초안이 생성되었습니다");
    expect(message).toContain("확인 후 그대로 확정하거나 일부 수정할 수 있습니다");
    expect(message).not.toContain("슬롯 후보 반영");
    expect(message).not.toContain("기획 후보:");
    expect(message).not.toContain("분석 후보:");
    expect(message).not.toContain("설계 후보:");
    expect(message).not.toContain("디자인 후보:");
  });

  it("does not expose internal shortfall warnings in user-facing Quick Design message", () => {
    const message = buildQuickDesignResultMessage({
      memberDrafts: [],
      assumptions: [
        {
          key: "x",
          label: "서비스 아이디어",
          value: "테스트",
          confidence: "candidate",
          reason: "대화·후보 슬롯에서 추출(미확정)",
        },
      ],
      slotCandidatePatch: { ...samplePatch, areaCounts: { planning: 1, analysis: 0, architecture: 0, design: 0 } },
    });

    expect(message).not.toContain("후보가 부족합니다");
    expect(message).not.toMatch(/\(\d+\/\d+\)/);
    expect(message).toContain("일부 항목은 현재 대화만으로 확정하기 어려워");
  });

  it("keeps area counts in Quick Design timeline detail", () => {
    const entry = buildQuickDesignSlotsPatchedTimelineEntry({
      projectId: "p1",
      nowIso,
      patchedSlotKeys: ["p.planning.servicePurpose"],
      areaCounts: { planning: 4, analysis: 2, architecture: 2, design: 2 },
      runId: "quick-design-1",
      shortfallWarnings: ["- 기획 후보가 부족합니다(3/4)."],
    });

    const detail = JSON.parse(String(entry.responseText ?? "").replace(/^[^\{]*/, "").match(/\{[\s\S]*\}/)?.[0] ?? "{}");
    expect(detail.areaCounts?.analysis ?? detail.analysisCandidateCount).toBe(2);
    expect(detail.patchedSlotKeys).toContain("p.planning.servicePurpose");
    expect(detail.runId).toBe("quick-design-1");
    expect(detail.shortfallWarnings?.length).toBeGreaterThan(0);
  });

  it("renders assumption table rows without embedded newlines", () => {
    const message = buildQuickDesignResultMessage({
      memberDrafts: [],
      assumptions: [
        {
          key: "coreProblem",
          label: "핵심 문제",
          value: "첫 줄\n둘째 줄",
          confidence: "candidate",
          reason: "근거",
        },
      ],
    });

    const tableSection = message.slice(message.indexOf("### AI 보완 후보/가정"));
    const tableLines = tableSection.split("\n").filter((line) => line.startsWith("|"));
    expect(tableLines.length).toBeGreaterThanOrEqual(3);
    for (const line of tableLines.slice(2)) {
      expect(line).not.toMatch(/\n/);
      expect(line.startsWith("|") && line.endsWith("|")).toBe(true);
    }
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
    expect(String(result.userMessage ?? "")).not.toContain("기획 후보:");
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
