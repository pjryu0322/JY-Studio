import assert from "node:assert/strict";
import { describe, it } from "node:test";
import {
  DOCLING_KNOWLEDGE_STAGES,
  DOCLING_KNOWLEDGE_PIPELINE_TRIGGER,
} from "../lib/docling-knowledge/docling-knowledge-stages.ts";
import { missingRequirementsForReview } from "../lib/docling-knowledge/docling-knowledge-pipeline-service.ts";
import {
  PROVIDER_PACK_TAB_IDS,
  resolveDefaultProviderPackTab,
  resolveProviderPackTabLocks,
} from "../lib/provider-pack-tabs.ts";
import { PROVIDER_PACK_TAB_KNOWLEDGE } from "../lib/role-based-ux-copy.ts";
import { readFileSync } from "node:fs";
import { join } from "node:path";

describe("provider knowledge generation flow", () => {
  it("orders tabs as basic → payload → knowledge → serviceValidation → distributionReview", () => {
    assert.deepEqual([...PROVIDER_PACK_TAB_IDS], [
      "basic",
      "payload",
      "knowledge",
      "serviceValidation",
      "distributionReview",
    ]);
    assert.equal(PROVIDER_PACK_TAB_KNOWLEDGE, "데이터 구조화");
  });

  it("defaults to knowledge after provider confirm before pipeline pass", () => {
    assert.equal(
      resolveDefaultProviderPackTab({
        created: false,
        status: "DRAFT",
        sourceDocumentCount: 0,
        hasPayload: true,
        providerConfirmed: true,
        knowledgePassed: false,
        hasDistribution: false,
      }),
      "knowledge",
    );
  });

  it("locks search validation until structure and distributionReview until search validation", () => {
    const locked = resolveProviderPackTabLocks({
      providerConfirmed: true,
      knowledgePassed: false,
      distributionReady: false,
      serviceValidationPassed: false,
    });
    assert.equal(locked.knowledge.locked, false);
    assert.equal(locked.serviceValidation.locked, true);
    assert.ok(locked.serviceValidation.reason?.includes("데이터 구조화"));
    assert.equal(locked.distributionReview.locked, true);

    const structureOk = resolveProviderPackTabLocks({
      providerConfirmed: true,
      knowledgePassed: true,
      distributionReady: false,
      serviceValidationPassed: false,
    });
    assert.equal(structureOk.serviceValidation.locked, false);
    assert.equal(structureOk.distributionReview.locked, true);

    const unlocked = resolveProviderPackTabLocks({
      providerConfirmed: true,
      knowledgePassed: true,
      distributionReady: true,
      serviceValidationPassed: true,
    });
    assert.equal(unlocked.distributionReview.locked, false);
  });

  it("lists five knowledge stages and pipeline trigger", () => {
    assert.equal(DOCLING_KNOWLEDGE_STAGES.length, 5);
    assert.equal(DOCLING_KNOWLEDGE_STAGES[0]?.id, "STRUCTURE");
    assert.equal(DOCLING_KNOWLEDGE_STAGES[4]?.id, "RETRIEVAL_EVALUATION");
    assert.equal(DOCLING_KNOWLEDGE_PIPELINE_TRIGGER, "DOCLING_KNOWLEDGE_GENERATION");
  });

  it("builds missingRequirements for review gate", () => {
    assert.deepEqual(
      missingRequirementsForReview({
        materialReady: true,
        knowledgePassed: false,
        distributionReady: false,
      }),
      ["RETRIEVAL_EVALUATION_PASSED", "DISTRIBUTION_INFO_COMPLETED"],
    );
  });

  it("wires confirm CTA to knowledge generation wording", () => {
    const root = join(import.meta.dirname, "../..");
    const tab = readFileSync(
      join(root, "src/components/provider-distribution/ProviderDoclingImportTab.tsx"),
      "utf8",
    );
    assert.ok(tab.includes("확인 완료하고 데이터 구조화"));
    assert.ok(!tab.includes("확인 완료하고 유통정보 입력"));
    assert.ok(!tab.includes("확인 완료하고 지식 데이터 생성"));
    assert.ok(tab.includes("startProviderKnowledgePipelineApi"));
    assert.ok(tab.includes("onGoToKnowledge"));
  });
});
