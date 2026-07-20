import assert from "node:assert/strict";
import { describe, it } from "node:test";
import { bindingMatchesActive } from "../lib/docling-knowledge/docling-knowledge-pipeline-shared.ts";
import {
  resolveDoclingKnowledgeActionFlags,
  resolveDoclingKnowledgeLockReason,
  resolveDoclingKnowledgePrimaryCta,
  resolveDoclingKnowledgeStageNextAction,
} from "../lib/docling-knowledge/docling-knowledge-pipeline-status-policy.ts";

describe("docling knowledge pipeline status policy", () => {
  it("maps STRUCTURE binding failures to refresh guidance", () => {
    assert.match(
      resolveDoclingKnowledgeStageNextAction({
        stageId: "STRUCTURE",
        status: "FAIL",
        providerConfirmed: true,
        running: false,
        priorFailed: false,
        failureCode: "FINGERPRINT_MISMATCH",
      }) ?? "",
      /새로고침/,
    );
  });

  it("marks STALE stages for regeneration", () => {
    assert.match(
      resolveDoclingKnowledgeStageNextAction({
        stageId: "SEARCH_INDEX",
        status: "STALE",
        providerConfirmed: true,
        running: false,
        priorFailed: false,
      }) ?? "",
      /다시 생성/,
    );
  });

  it("resolves primary CTA and action flags without DB", () => {
    assert.equal(
      resolveDoclingKnowledgePrimaryCta({
        running: false,
        passed: true,
        structurePassed: true,
        searchFoundationPassed: true,
        stale: false,
        failed: false,
        warningOnly: false,
        providerConfirmed: true,
        packIsDraft: true,
      }),
      "distribution",
    );
    assert.equal(
      resolveDoclingKnowledgePrimaryCta({
        running: false,
        passed: false,
        structurePassed: true,
        searchFoundationPassed: false,
        stale: false,
        failed: false,
        warningOnly: false,
        providerConfirmed: true,
        packIsDraft: true,
      }),
      "search_validation",
    );
    assert.deepEqual(
      resolveDoclingKnowledgeActionFlags({
        providerConfirmed: true,
        packIsDraft: true,
        running: false,
        passed: false,
        primaryCta: "start",
      }),
      { canStart: true, canRetry: false, canOpenDistribution: false },
    );
  });

  it("resolves lock reasons by stage pass", () => {
    assert.match(
      resolveDoclingKnowledgeLockReason({
        providerConfirmed: false,
        structurePassed: false,
        searchFoundationPassed: false,
      }) ?? "",
      /대표 샘플/,
    );
    assert.equal(
      resolveDoclingKnowledgeLockReason({
        providerConfirmed: true,
        structurePassed: true,
        searchFoundationPassed: true,
      }),
      null,
    );
  });
});

describe("bindingMatchesActive", () => {
  it("requires fingerprint and full identity match", () => {
    const binding = {
      v: 1 as const,
      versionId: "v1",
      normalizedDocumentId: "nd1",
      fingerprint: "fp1",
      bundleId: "b1",
      indexGenerationId: "g1",
      heartbeatAt: null,
      cancelRequestedAt: null,
      lockOwner: null,
      lockExpiresAt: null,
      attempt: 0,
      failureCode: null,
      failureMessage: null,
      requestedByUserId: null,
      requestedByClientId: null,
      userMessage: null,
    };
    assert.equal(
      bindingMatchesActive({
        binding,
        versionId: "v1",
        ndId: "nd1",
        fingerprint: "fp1",
        bundleId: "b1",
      }),
      true,
    );
    assert.equal(
      bindingMatchesActive({
        binding,
        versionId: "v1",
        ndId: "nd1",
        fingerprint: null,
        bundleId: "b1",
      }),
      false,
    );
    assert.equal(
      bindingMatchesActive({
        binding,
        versionId: "v1",
        ndId: "nd1",
        fingerprint: "other",
        bundleId: "b1",
      }),
      false,
    );
  });
});
