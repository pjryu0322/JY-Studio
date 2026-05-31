import { describe, expect, it } from "vitest";
import fs from "node:fs";
import path from "node:path";
import {
  buildQuickDesignConfirmStatePatch,
  runQuickDesignConfirmFlowSync,
} from "@/lib/requirements/quickDesignConfirmFlow";
import {
  buildAnalystMemberDraft,
  buildArchitectMemberDraft,
  buildDesignerMemberDraft,
  buildPlannerMemberDraft,
  collectFastPlanDraftContext,
} from "@/lib/platform-orchestration/fastPlanMemberDrafts";
import { buildSlotCandidatePatchesFromFastPlanDrafts } from "@/lib/requirements/fastPlanDraftSlotPatch";
import { confirmFastPlanDraftSlots } from "@/lib/requirements/fastPlanDraftConfirmation";
import {
  buildDynamicServicePlanningSlotDefinitions,
  initialOrchestrationStateFromDefinitions,
} from "@/lib/requirements/singleChatOrchestrationSlots";

const nowIso = "2026-05-28T12:00:00.000Z";

function buildConfirmedQuickDesignFixture() {
  const definitions = buildDynamicServicePlanningSlotDefinitions({
    projectId: "p-flow",
    projectName: "회의록",
  });
  const orchestration = initialOrchestrationStateFromDefinitions(definitions, nowIso);
  const collected = collectFastPlanDraftContext({
    projectId: "p-flow",
    projectName: "회의록",
    projectDescription: "녹취",
    conversationMessages: [],
    serviceFlow: null,
    orchestration,
    slotDefinitions: definitions,
    featurePlanning: null,
    problemInterview: null,
  });
  const memberDrafts = [
    buildPlannerMemberDraft({ runId: "run-p", collected, definitions, orchestration }),
    buildAnalystMemberDraft({ runId: "run-a", collected, definitions, orchestration }),
    buildArchitectMemberDraft({ runId: "run-arch", collected, definitions, orchestration }),
    buildDesignerMemberDraft({ runId: "run-d", collected, definitions, orchestration }),
  ];
  const patch = buildSlotCandidatePatchesFromFastPlanDrafts({
    memberDrafts,
    orchestration,
    definitions,
    nowIso,
    runId: "qd-flow",
  });
  const fastPlanDraftV1 = {
    status: "confirmed" as const,
    generatedAt: nowIso,
    flowId: "fast_plan_draft",
    memberRuns: [],
    memberDrafts,
    assumptions: collected.assumptions,
    slotCandidatePatch: patch.slotCandidatePatch ?? undefined,
    source: "current_conversation_and_slots" as const,
  };
  const orchestrationForConfirm = patch.orchestration ?? orchestration;
  return { definitions, fastPlanDraftV1, orchestrationForConfirm };
}

describe("quickDesignConfirmFlow", () => {
  it("produces seed + task list state patch without work plan draft", () => {
    const { definitions, fastPlanDraftV1, orchestrationForConfirm } = buildConfirmedQuickDesignFixture();
    const result = runQuickDesignConfirmFlowSync({
      envOk: true,
      flow: {
        projectId: "p-flow",
        projectName: "회의록",
        projectDescription: "녹취",
        conversationMessages: [],
        serviceFlow: null,
        problemInterview: null,
        sourceStage: "IDEATION",
        nowIso,
        fastPlanDraftV1,
        orchestrationForConfirm,
        slotDefinitions: definitions,
        planningState: {
          featurePlanningSlotsV1: null,
          serviceFlowV1: null,
          projectArtifacts: [],
          deliverableAssets: [],
          requirementsOrchestrationStageV1: null,
          implementationTaskListV1: null,
        },
      },
    });

    expect(result.kind).toBe("success");
    if (result.kind !== "success") return;

    expect(result.statePatch.implementationSeedV1).toBeTruthy();
    expect(result.statePatch.implementationTaskListV1?.tasks?.length).toBeGreaterThan(0);
    expect(result.statePatch.implementationCodeTaskPlanV1?.codeTaskCount).toBeGreaterThan(0);
    expect(result.statePatch.cursorWorkItemsV1?.length).toBeGreaterThan(0);
    expect(result.statePatch).not.toHaveProperty("implementationWorkPlanDraftV1");
    expect(result.readyMessage.meta?.internalType).toBe("quick_design_implementation_ready");
    expect(result.timelineEntries.length).toBeGreaterThan(0);
  });

  it("preserves existing implementationTaskListV1 on state patch", () => {
    const { definitions, fastPlanDraftV1, orchestrationForConfirm } = buildConfirmedQuickDesignFixture();
    const confirm = confirmFastPlanDraftSlots({
      fastPlanDraftV1,
      orchestration: orchestrationForConfirm,
      definitions,
      nowIso,
      projectId: "p-flow",
      onlyPatchedSlotKeys: true,
    });
    expect(confirm.blocked).toBe(false);

    const existingList = {
      version: 1 as const,
      projectId: "p-flow",
      createdAt: nowIso,
      updatedAt: nowIso,
      source: "implementation_seed_v1" as const,
      tasks: [],
      roleSummary: { developer: 0, designer: 0, reviewer: 0, security: 0, scm: 0 },
    };

    const sync = runQuickDesignConfirmFlowSync({
      envOk: false,
      flow: {
        projectId: "p-flow",
        projectName: "회의록",
        projectDescription: "녹취",
        conversationMessages: [],
        serviceFlow: null,
        problemInterview: null,
        sourceStage: "IDEATION",
        nowIso,
        fastPlanDraftV1,
        orchestrationForConfirm,
        slotDefinitions: definitions,
        planningState: {
          featurePlanningSlotsV1: null,
          serviceFlowV1: null,
          projectArtifacts: [],
          deliverableAssets: [],
          requirementsOrchestrationStageV1: null,
          implementationTaskListV1: existingList,
        },
      },
    });
    expect(sync.kind).toBe("success");
    if (sync.kind !== "success") return;

    const patch = buildQuickDesignConfirmStatePatch({
      confirm: sync.confirm,
      artifactBundle: sync.artifactBundle,
      mergedProjectArtifacts: sync.statePatch.projectArtifacts,
      mergedDeliverableAssets: sync.statePatch.deliverableAssets,
      prep: sync.prep,
      existingRequirementsStage: null,
      existingImplementationTaskListV1: existingList,
      nowIso,
    });
    expect(patch).not.toHaveProperty("implementationTaskListV1");
    expect(patch.implementationSeedV1).toBeTruthy();
  });

  it("does not auto-generate implementationWorkPlanDraftV1 in RequirementsWorkspace", () => {
    const abs = path.join(process.cwd(), "src", "components", "requirements", "RequirementsWorkspace.tsx");
    const source = fs.readFileSync(abs, "utf8");
    expect(source).not.toContain("buildGenerateImplementationWorkPlanDraftResult");
    expect(source).not.toContain("autoDraftResult");
    expect(source).not.toContain("implementationWorkPlanDraftV1: autoDraftResult");
  });
});
