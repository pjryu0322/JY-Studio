import { describe, expect, it } from "vitest";
import {
  formatProductDefinitionPlanningContext,
  buildProductDefinitionFromChatDraft,
  buildProductDefinitionStubFromProject,
  defaultProductizationFields,
  evaluateProductDefinitionReadiness,
  isProductDefinitionCompleteIntent,
  parseProductDefinitionV1,
  requiresDataPolicyConfirmation,
} from "@/lib/requirements/productDefinitionV1";
import {
  PRODUCT_DEFINITION_ARTIFACT_ID,
  PRODUCT_DEFINITION_ARTIFACT_TYPE,
  upsertProductDefinitionArtifact,
} from "@/lib/requirements/productDefinitionArtifact";
import { buildMaterializedReferenceContextFromSnapshot } from "@/lib/project-knowledge/projectKnowledgeReferenceMaterializedContext";
import {
  buildInitialProductDefinitionForProject,
  buildInitialRequirementsStateForNewProject,
} from "@/lib/requirements/productDefinitionInitial";
import { buildInitialProductDefinitionOrchestrationStage } from "@/lib/requirements/productDefinitionOrchestration";
import { isProjectArtifactType, parseProjectArtifactsFromState } from "@/lib/requirements/projectArtifactTypes";
import { parseRequirementsStateJson } from "@/lib/requirements/requirementsStateJson";

describe("productDefinitionV1", () => {
  it("parses stub from project create flow", () => {
    const stub = buildProductDefinitionStubFromProject({ productName: "회의록 SaaS", description: "회의 자동 정리" });
    const parsed = parseProductDefinitionV1(stub);
    expect(parsed?.overview.productName).toBe("회의록 SaaS");
    expect(parsed?.productModel.organizationModel.value).toBeTruthy();
    expect(evaluateProductDefinitionReadiness(parsed).ready).toBe(false);
  });

  it("parses legacy JSON without productization blocks with defaults", () => {
    const stub = buildProductDefinitionStubFromProject({ productName: "Legacy" });
    const { productModel, dataPolicy, qualityPolicy, ...legacyCore } = stub;
    void productModel;
    void dataPolicy;
    void qualityPolicy;
    const parsed = parseProductDefinitionV1(legacyCore);
    expect(parsed?.productModel.pricingModel.confidence).toBe("needs_confirmation");
    expect(parsed?.dataPolicy.retentionPolicy.value).toBeTruthy();
  });

  it("builds from chat draft with problem and features", () => {
    const def = buildProductDefinitionFromChatDraft({
      productName: "회의록",
      description: "desc",
      draft: {
        version: 1,
        titleCandidates: ["회의록"],
        chosenTitle: "회의록",
        description: "회의 자동 정리 서비스",
        problem: "회의록 작성 부담",
        targetUsers: "PM",
        valueProposition: "자동 요약",
        mvpScope: "업로드·요약",
        explicitExclusions: "결제",
        featureCandidates: ["업로드", "STT", "요약"],
        openQuestions: [],
        assumptions: [],
        confirmedFacts: [],
        recommendedAiMembers: [],
        nextSteps: ["데모"],
      },
    });
    expect(def.overview.problemToSolve.value).toContain("회의록");
    expect(def.coreFeatures.items.length).toBe(3);
    expect(requiresDataPolicyConfirmation(def)).toBe(true);
  });

  it("buildInitialProductDefinitionForProject uses draft when present", () => {
    const draft = {
      version: 1 as const,
      titleCandidates: ["A"],
      chosenTitle: "A",
      description: "d",
      problem: "p",
      targetUsers: "u",
      valueProposition: "v",
      mvpScope: "m",
      explicitExclusions: "",
      featureCandidates: ["f1"],
      openQuestions: [],
      assumptions: [],
      confirmedFacts: [],
      recommendedAiMembers: [],
      nextSteps: [],
    };
    const fromDraft = buildInitialProductDefinitionForProject({ productName: "A", draft });
    const stubOnly = buildInitialProductDefinitionForProject({ productName: "A" });
    expect(fromDraft.coreFeatures.items).toEqual(["f1"]);
    expect(stubOnly.coreFeatures.items).toEqual([]);
  });

  it("buildInitialRequirementsStateForNewProject upserts product-definition artifact", () => {
    const st = buildInitialRequirementsStateForNewProject({
      name: "회의록",
      description: "회의 STT",
      projectFromChatDraft: {
        version: 1,
        titleCandidates: ["회의록"],
        chosenTitle: "회의록",
        description: "회의 STT 서비스",
        problem: "회의록",
        targetUsers: "팀",
        valueProposition: "요약",
        mvpScope: "업로드",
        explicitExclusions: "",
        featureCandidates: ["업로드"],
        openQuestions: ["보관 기간?"],
        assumptions: [],
        confirmedFacts: [],
        recommendedAiMembers: [],
        nextSteps: [],
      },
    });
    expect(st.seededFromPreProjectChat).toBe(true);
    const artifacts = parseProjectArtifactsFromState(st.projectArtifacts);
    expect(artifacts?.some((a) => a.type === PRODUCT_DEFINITION_ARTIFACT_TYPE)).toBe(true);
    expect(isProjectArtifactType(PRODUCT_DEFINITION_ARTIFACT_TYPE)).toBe(true);
    const upserted = upsertProductDefinitionArtifact(
      artifacts,
      st.productDefinitionV1!,
      "2026-06-03T00:00:00.000Z",
    );
    expect(upserted.find((a) => a.id === PRODUCT_DEFINITION_ARTIFACT_ID)?.content).toContain("Product Definition");
  });

  it("buildInitialRequirementsStateForNewProject stores materializedReferenceContextV1", () => {
    const materialized = buildMaterializedReferenceContextFromSnapshot({
      sourceProjectTitle: "Src",
      snapshotTitle: "Snap",
      snapshotPurpose: "REFERENCE_CANDIDATE",
      sourceSnapshotId: "hidden-id",
      graphSnapshot: {
        purpose: "REFERENCE_CANDIDATE",
        nodes: [
          {
            entityKey: "k1",
            nodeType: "Actor",
            title: "고객",
            summary: null,
            reference: {
              lifecycle: "USER_APPROVED",
              reusable: true,
              reusableAs: ["ACTOR"],
              safeForReference: true,
            },
          },
        ],
        edges: [],
      },
    });
    const st = buildInitialRequirementsStateForNewProject({
      name: "New",
      description: "Desc",
      referenceSelection: {
        referenceSnapshotIds: ["hidden-id"],
        selectedAt: "2026-06-03T00:00:00.000Z",
        source: "USER_SELECTED",
      },
      referenceSelectionSummary: {
        sourceProjectTitle: "Src",
        snapshotTitle: "Snap",
        readiness: "READY",
        actorCount: 1,
        serviceFlowCount: 0,
        featureCount: 0,
        graphReusableNodeCount: 1,
      },
      materializedReferenceContextV1: materialized,
    });
    expect(st.materializedReferenceContextV1?.nodes).toHaveLength(1);
    expect(JSON.stringify(st.materializedReferenceContextV1?.nodes)).not.toContain("k1");
  });

  it("formatProductDefinitionPlanningContext caps at 20 lines and 300 chars per line", () => {
    const def = {
      ...buildProductDefinitionStubFromProject({ productName: "X" }),
      ...defaultProductizationFields(),
    };
    const lines = formatProductDefinitionPlanningContext(def);
    expect(lines.length).toBeLessThanOrEqual(20);
    for (const line of lines) {
      expect(line.length).toBeLessThanOrEqual(300);
    }
    expect(lines[0]).toBe("[Product Definition]");
  });

  it("stores orchestration wire PRODUCT_DEFINITION in requirements state", () => {
    const st = parseRequirementsStateJson({
      requirementsOrchestrationStageV1: buildInitialProductDefinitionOrchestrationStage("2026-06-03T00:00:00.000Z"),
      productDefinitionV1: buildProductDefinitionStubFromProject({ productName: "A" }),
    });
    expect(st.requirementsOrchestrationStageV1?.currentStage).toBe("PRODUCT_DEFINITION");
    expect(st.productDefinitionV1?.overview.productName).toBe("A");
  });

  it("detects planning entry intent", () => {
    expect(isProductDefinitionCompleteIntent("기획 단계로 진행")).toBe(true);
    expect(isProductDefinitionCompleteIntent("hello")).toBe(false);
  });
});
