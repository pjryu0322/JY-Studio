import assert from "node:assert/strict";
import { describe, it } from "node:test";
import {
  isFullKnowledgePipelineStagesPassed,
  isSearchFoundationStagesPassed,
  isStructureStagesPassed,
  STRUCTURE_STAGE_IDS,
  SEARCH_FOUNDATION_STAGE_IDS,
} from "../lib/docling-knowledge/docling-knowledge-stage-pass.ts";
import {
  resolveProviderRegistrationReadiness,
  tabLocksFromRegistrationReadiness,
} from "../lib/provider-registration-readiness.ts";
import { buildProviderPackProgress } from "../lib/provider-pack-progress.ts";
import { PROVIDER_PACK_TAB_IDS } from "../lib/provider-pack-tabs.ts";

const allPassSteps = [
  { step: "STRUCTURE_VALIDATING", status: "PASS", details: { advisory: true } },
  { step: "KNOWLEDGE_CHECKING", status: "PASS" },
  { step: "CHUNKING", status: "PASS", details: { chunkCount: 3 } },
  { step: "INDEXING", status: "PASS" },
  {
    step: "SEARCH_EVALUATING",
    status: "PASS",
    details: { retrievalRankingPolicyVersion: "relevance_diversity_v2" },
  },
  { step: "READY_FOR_REVIEW", status: "PASS" },
];

describe("structure vs search foundation pass", () => {
  it("computes structurePassed without SEARCH_INDEX", () => {
    const structureOnly = allPassSteps.filter(
      (s) =>
        s.step === "STRUCTURE_VALIDATING" ||
        s.step === "KNOWLEDGE_CHECKING" ||
        s.step === "CHUNKING",
    );
    assert.equal(
      isStructureStagesPassed({ steps: structureOnly, pipelineCurrent: true }),
      true,
    );
    assert.equal(
      isSearchFoundationStagesPassed({ steps: structureOnly, pipelineCurrent: true }),
      false,
    );
  });

  it("requires SEARCH_INDEX and RETRIEVAL_EVALUATION for search foundation", () => {
    assert.equal(
      isSearchFoundationStagesPassed({ steps: allPassSteps, pipelineCurrent: true }),
      true,
    );
    const withoutEval = allPassSteps.filter((s) => s.step !== "SEARCH_EVALUATING");
    assert.equal(
      isSearchFoundationStagesPassed({ steps: withoutEval, pipelineCurrent: true }),
      false,
    );
  });

  it("excludes non-current binding from completion", () => {
    assert.equal(
      isStructureStagesPassed({ steps: allPassSteps, pipelineCurrent: false }),
      false,
    );
    assert.equal(
      isFullKnowledgePipelineStagesPassed({
        steps: allPassSteps,
        pipelineCurrent: false,
      }),
      false,
    );
  });

  it("keeps stage id sets aligned with registration boundaries", () => {
    assert.deepEqual([...STRUCTURE_STAGE_IDS], [
      "STRUCTURE",
      "KNOWLEDGE_UNIT",
      "RETRIEVAL_CHUNK",
    ]);
    assert.deepEqual([...SEARCH_FOUNDATION_STAGE_IDS], [
      "SEARCH_INDEX",
      "RETRIEVAL_EVALUATION",
    ]);
  });
});

describe("provider registration readiness", () => {
  it("matches five-step tab order", () => {
    const readiness = resolveProviderRegistrationReadiness({
      packId: "p1",
      packStatus: "DRAFT",
      basicInfoReady: true,
      sourceMaterialsReady: true,
      structurePassed: false,
      searchFoundationPassed: false,
      allPreparationChannelsPassed: false,
      distributionMetadataReady: false,
      pipelineCurrent: true,
    });
    assert.deepEqual(
      readiness.steps.map((s) => s.tab),
      [...PROVIDER_PACK_TAB_IDS],
    );
    assert.equal(readiness.currentStepId, "DATA_STRUCTURE");
  });

  it("locks distribution until preparation channels pass", () => {
    const readiness = resolveProviderRegistrationReadiness({
      packId: "p1",
      packStatus: "DRAFT",
      basicInfoReady: true,
      sourceMaterialsReady: true,
      structurePassed: true,
      searchFoundationPassed: true,
      allPreparationChannelsPassed: false,
      distributionMetadataReady: false,
      pipelineCurrent: true,
    });
    const locks = tabLocksFromRegistrationReadiness(readiness);
    assert.equal(locks.serviceValidation.locked, false);
    assert.equal(locks.distributionReview.locked, true);
    assert.equal(readiness.canSubmitReview, false);
  });

  it("blocks submit when distribution metadata incomplete", () => {
    const readiness = resolveProviderRegistrationReadiness({
      packId: "p1",
      packStatus: "DRAFT",
      basicInfoReady: true,
      sourceMaterialsReady: true,
      structurePassed: true,
      searchFoundationPassed: true,
      allPreparationChannelsPassed: true,
      distributionMetadataReady: false,
      pipelineCurrent: true,
    });
    assert.equal(readiness.canSubmitReview, false);
    assert.ok(readiness.submitBlockers.includes("DISTRIBUTION_METADATA"));
  });

  it("propagates STALE when binding is not current", () => {
    const readiness = resolveProviderRegistrationReadiness({
      packId: "p1",
      packStatus: "DRAFT",
      basicInfoReady: true,
      sourceMaterialsReady: true,
      structurePassed: true,
      searchFoundationPassed: true,
      allPreparationChannelsPassed: true,
      distributionMetadataReady: true,
      pipelineCurrent: false,
      structureStale: true,
      searchValidationStale: true,
    });
    assert.equal(readiness.canSubmitReview, false);
    assert.ok(readiness.submitBlockers.includes("BINDING_STALE"));
    const structure = readiness.steps.find((s) => s.id === "DATA_STRUCTURE");
    assert.ok(structure?.status === "STALE" || structure?.locked);
  });
});

describe("provider pack progress five-step model", () => {
  it("advances to data structure after materials, not distribution", () => {
    const progress = buildProviderPackProgress({
      packId: "draft-1",
      packStatus: "DRAFT",
      name: "Draft",
      categoryId: "cat",
      shortDescription: "short description",
      description: "long enough description text",
      language: "ko",
      workingVersion: {
        id: "v1",
        version: "0.1.0",
        sourceDocumentCount: 1,
        materialReady: true,
        structureReady: false,
        searchFoundationReady: false,
        searchValidationReady: false,
        distributionReady: false,
      },
      publishedVersion: null,
    });
    assert.equal(progress.currentStep, "DATA_STRUCTURE");
    assert.deepEqual(
      progress.steps.map((s) => s.key),
      [
        "BASIC_INFO",
        "SOURCE_MATERIALS",
        "DATA_STRUCTURE",
        "SEARCH_DATA_VALIDATION",
        "DISTRIBUTION_REVIEW",
      ],
    );
    assert.ok(!progress.steps.some((s) => s.key === ("APPROVAL" as never)));
  });

  it("uses REVIEWING as lifecycle overlay, not a sixth registration step", () => {
    const progress = buildProviderPackProgress({
      packId: "rev-1",
      packStatus: "REVIEWING",
      name: "Pack",
      categoryId: "cat",
      shortDescription: "short description",
      description: "long enough description text",
      language: "ko",
      workingVersion: {
        id: "v1",
        version: "0.1.0",
        sourceDocumentCount: 1,
        materialReady: true,
        structureReady: true,
        searchFoundationReady: true,
        searchValidationReady: true,
        distributionReady: true,
      },
      publishedVersion: null,
    });
    assert.equal(progress.currentStep, "REVIEWING");
    assert.equal(progress.lifecycleStatus, "REVIEWING");
    assert.equal(progress.steps.length, 5);
  });
});
