import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import { dirname, join } from "node:path";
import { describe, it } from "node:test";
import { fileURLToPath } from "node:url";
import {
  canRequestProviderReviewHandoff,
  isWorkerKnowledgeGenerationCompleted,
} from "../lib/store-workflow-handoff-gates-policy.ts";
import { buildProviderPackProgress } from "../lib/provider-pack-progress.ts";

const here = dirname(fileURLToPath(import.meta.url));
const projectRoot = join(here, "..", "..");

function readSource(relativePath: string): string {
  return readFileSync(join(projectRoot, relativePath), "utf8");
}

describe("store workflow handoff gates", () => {
  it("requires worker COMPLETED and quality pass for provider review request", () => {
    const quality = {
      completed: true,
      failCount: 0,
      hasBlockers: false,
      hasWarnings: false,
      blockers: [] as string[],
      warnings: [] as string[],
    };
    assert.equal(
      canRequestProviderReviewHandoff({
        workerZipPhase: "ACCEPTED",
        quality,
      }),
      false,
    );
    assert.equal(
      canRequestProviderReviewHandoff({
        workerZipPhase: "COMPLETED",
        quality: { ...quality, completed: false },
      }),
      false,
    );
    assert.equal(
      canRequestProviderReviewHandoff({
        workerZipPhase: "COMPLETED",
        quality: { ...quality, hasBlockers: true, failCount: 1 },
      }),
      false,
    );
    assert.equal(
      canRequestProviderReviewHandoff({
        workerZipPhase: "COMPLETED",
        quality,
      }),
      true,
    );
    assert.equal(isWorkerKnowledgeGenerationCompleted("COMPLETED"), true);
    assert.equal(isWorkerKnowledgeGenerationCompleted("PROCESSING"), false);
  });

  it("enforces knowledge generation completed in request-provider-review API", () => {
    const route = readSource(
      "src/app/api/v1/admin/packs/[packId]/store-workflow/request-provider-review/route.ts",
    );
    assert.ok(route.includes("KNOWLEDGE_GENERATION_NOT_COMPLETED"));
    assert.ok(route.includes("canRequestProviderReviewHandoff"));
    assert.ok(route.includes("resolveAdminWorkerZipPhaseForPack"));
  });

  it("enforces API/MCP/ZIP channel gates in service-validation complete API", () => {
    const markers = readSource("src/lib/store-workflow-markers.ts");
    const route = readSource(
      "src/app/api/v1/admin/packs/[packId]/store-workflow/service-validation/route.ts",
    );
    assert.ok(markers.includes("SERVICE_CHANNELS_INCOMPLETE"));
    assert.ok(markers.includes("resolveStoreServiceChannelGates"));
    assert.ok(route.includes("missingChannels"));
    assert.ok(route.includes("resolveStoreServiceChannelGates"));
  });

  it("prioritizes provider review banner over admin generation hold", () => {
    const editor = readSource("src/components/ProviderPackEditor.tsx");
    const reviewIdx = editor.indexOf("PROVIDER_PACK_LOCKED_GENERATION_REVIEW");
    const adminIdx = editor.indexOf("PROVIDER_PACK_LOCKED_ADMIN_GENERATION");
    assert.ok(reviewIdx > 0);
    assert.ok(adminIdx > 0);
    // Banner branch for REQUESTED appears before admin-hold-only branch.
    assert.ok(
      editor.indexOf('providerReviewPhase === "REQUESTED"') <
        editor.indexOf("lockedByAdminGeneration ? ("),
    );
  });

  it("shows 생성 결과 검토 and hides draft CTAs when review requested", () => {
    const progress = buildProviderPackProgress({
      packId: "pack-1",
      packStatus: "DRAFT",
      name: "Pack",
      categoryId: "cat",
      shortDescription: "short",
      description: "desc",
      language: "ko",
      adminGenerationHold: "COMPLETED",
      workerZipRequestStatus: "COMPLETED",
      providerReviewPhase: "REQUESTED",
      adminQualityPassed: true,
      workingVersion: {
        id: "v1",
        version: "0.1.0",
        sourceDocumentCount: 2,
        materialReady: true,
        distributionReady: true,
      },
      publishedVersion: null,
    });
    assert.equal(progress.storeWorkflowStatus, "PROVIDER_REVIEW_REQUESTED");
    assert.equal(progress.currentStepLabel, "생성 결과 검토 필요");
    assert.ok(progress.actions.some((a) => a.label === "생성 결과 검토"));
    assert.ok(!progress.actions.some((a) => a.label === "계속 작성"));
    assert.ok(!progress.actions.some((a) => a.label === "자료등록"));
    assert.ok(!progress.actions.some((a) => a.label === "검수 요청"));
  });
});
