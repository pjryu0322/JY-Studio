import { describe, expect, it } from "vitest";
import {
  buildArchitectMemberDraft,
  buildDesignerMemberDraft,
  collectFastPlanDraftContext,
} from "@/lib/platform-orchestration/fastPlanMemberDrafts";
import { runFastPlanDraftFlow } from "@/lib/platform-orchestration/flows/fastPlanDraftFlow";
import { createPlatformTrigger } from "@/lib/platform-orchestration/runResultFactory";
import { buildDynamicServicePlanningSlotDefinitions, initialOrchestrationStateFromDefinitions } from "@/lib/requirements/singleChatOrchestrationSlots";

const nowIso = "2026-05-24T12:00:00.000Z";

describe("fastPlanMemberDrafts", () => {
  it("renders architect draft labels only once", () => {
    const definitions = buildDynamicServicePlanningSlotDefinitions({
      projectId: "p1",
      projectName: "회의록",
    });
    const orchestration = initialOrchestrationStateFromDefinitions(definitions, nowIso);
    const collected = collectFastPlanDraftContext({
      projectId: "p1",
      projectName: "회의록",
      projectDescription: "녹취",
      conversationMessages: [],
      serviceFlow: null,
      orchestration,
      slotDefinitions: definitions,
      featurePlanning: null,
      problemInterview: null,
    });
    const draft = buildArchitectMemberDraft({
      runId: "run-arch",
      collected: {
        ...collected,
        featureCandidates: ["- MVP 기능 후보", "파일 업로드", "주제별 요약"],
      },
      definitions,
      orchestration,
    });

    const labelLines = draft.content.match(/^- (핵심 기능 후보|MVP 기능 후보):/gm) ?? [];
    expect(labelLines.length).toBe(1);
    expect(draft.content).toContain("핵심 기능 후보:");
  });

  it("renders designer draft labels only once", () => {
    const definitions = buildDynamicServicePlanningSlotDefinitions({
      projectId: "p1",
      projectName: "회의록",
    });
    const orchestration = initialOrchestrationStateFromDefinitions(definitions, nowIso);
    const collected = collectFastPlanDraftContext({
      projectId: "p1",
      projectName: "회의록",
      projectDescription: "녹취",
      conversationMessages: [],
      serviceFlow: null,
      orchestration,
      slotDefinitions: definitions,
      featurePlanning: null,
      problemInterview: null,
    });
    const draft = buildDesignerMemberDraft({
      runId: "run-design",
      collected: {
        ...collected,
        screenCandidates: ["- 홈", "- 목록", "- 상세"],
      },
      definitions,
      orchestration,
    });

    expect((draft.content.match(/주요 화면 후보/g) ?? []).length).toBe(1);
    expect(draft.content).not.toMatch(/-\s*주요 화면 후보:\s*(\n|$)/);
  });

  it("does not render empty draft bullets", () => {
    const definitions = buildDynamicServicePlanningSlotDefinitions({
      projectId: "p1",
      projectName: "회의록",
    });
    const orchestration = initialOrchestrationStateFromDefinitions(definitions, nowIso);
    const collected = collectFastPlanDraftContext({
      projectId: "p1",
      projectName: "회의록",
      projectDescription: "",
      conversationMessages: [],
      serviceFlow: null,
      orchestration,
      slotDefinitions: definitions,
      featurePlanning: null,
      problemInterview: null,
    });
    const draft = buildDesignerMemberDraft({
      runId: "run-design",
      collected,
      definitions,
      orchestration,
    });

    expect(draft.content.trim().length).toBeGreaterThan(0);
    expect(draft.content).not.toMatch(/-\s*[^:\n]+:\s*(\n|$)/);
  });

  it("creates fallback candidates when source context is insufficient", () => {
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
      projectDescription: "",
      conversationMessages: [],
      serviceFlow: null,
      orchestration: null,
      slotDefinitions,
      nowIso,
    });

    const roles = result.memberDrafts.map((d) => d.role);
    expect(roles).toEqual(expect.arrayContaining(["planner", "analyst", "architect", "designer"]));
    for (const draft of result.memberDrafts) {
      expect(String(draft.content).trim().length).toBeGreaterThan(0);
      expect((draft.targetSlotKeys ?? []).length).toBeGreaterThan(0);
    }
  });
});
