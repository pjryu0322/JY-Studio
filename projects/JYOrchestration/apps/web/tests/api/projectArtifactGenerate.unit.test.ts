import { describe, expect, it } from "vitest";
import { applyRequirementsOrchestrationTransition } from "@/lib/requirements/requirementsTransitionEngine";
import { buildProjectArtifactContent, generateProjectArtifact } from "@/lib/requirements/projectArtifactGenerate";
import { quickActionsForConversationState } from "@/lib/requirements/requirementsQuickActionRegistry";
import { filterQuickActionsForStage } from "@/lib/requirements/requirementsOrchestrationRegistry";
import { createSampleServiceFlow } from "../orchestration/helpers/orchestrationRegressionHarness";

describe("projectArtifactGenerate", () => {
  it("builds service-flow-doc without LLM", () => {
    const flow = createSampleServiceFlow({ conversationState: "APPROVED" });
    const md = buildProjectArtifactContent({
      artifactType: "service-flow-doc",
      projectName: "Demo",
      serviceFlow: flow,
      sourceStage: "SERVICE_FLOW_REVIEW",
    });
    expect(md).toContain("서비스 흐름");
    expect(md).toContain("Upload");
  });

  it("generateProjectArtifact returns side-action artifact", () => {
    const artifact = generateProjectArtifact({
      artifactType: "summary",
      projectName: "P",
      projectDescription: "desc",
      sourceStage: "FEATURE_DETAIL",
    });
    expect(artifact.type).toBe("summary");
    expect(artifact.content.length).toBeGreaterThan(10);
  });

  it("approved conversation profile has no documentation quick reply labels", () => {
    const labels = quickActionsForConversationState("APPROVED").map((a) => a.label);
    expect(labels).not.toContain("문서화하기");
    expect(labels).not.toContain("문서화 완료");
    expect(labels).toContain("다음 단계 진행");
  });

  it("COMPLETE_DOCUMENTATION quickActionId does not trigger orchestration transition", () => {
    const flow = createSampleServiceFlow({ conversationState: "APPROVED" });
    const r = applyRequirementsOrchestrationTransition({
      state: { serviceFlowV1: flow },
      currentFlow: flow,
      proposalDecision: null,
      quickActionId: "COMPLETE_DOCUMENTATION",
      quickActionLabel: "문서화 완료",
    });
    expect(r.transitionResult).not.toBe("applied");
    expect(r.transitionTriggered).toBe(false);
  });

  it("FEATURE_DETAIL filters out documentation actionIds", () => {
    const filtered = filterQuickActionsForStage(
      "FEATURE_DETAIL",
      quickActionsForConversationState("FEATURE_DETAIL").concat(
        quickActionsForConversationState("APPROVED"),
      ),
    );
    expect(filtered.map((a) => a.id)).not.toContain("DOCUMENT_FLOW");
    expect(filtered.map((a) => a.id)).not.toContain("COMPLETE_DOCUMENTATION");
  });
});
