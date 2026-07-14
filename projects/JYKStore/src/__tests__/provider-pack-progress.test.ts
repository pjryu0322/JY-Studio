import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import { dirname, join } from "node:path";
import { describe, it } from "node:test";
import { fileURLToPath } from "node:url";
import {
  buildProviderPackProgress,
  buildProviderPacksStatusSummary,
} from "../lib/provider-pack-progress.ts";
import { buildProviderOnboardingSteps } from "../lib/provider-onboarding-steps.ts";

const here = dirname(fileURLToPath(import.meta.url));
const projectRoot = join(here, "..", "..");

function readSource(relativePath: string): string {
  return readFileSync(join(projectRoot, relativePath), "utf8");
}

describe("provider pack progress", () => {
  it("keeps published and reviewing packs on separate steps", () => {
    const published = buildProviderPackProgress({
      packId: "2025sw",
      packStatus: "PUBLISHED",
      name: "SW",
      categoryId: "guide",
      shortDescription: "short",
      description: "desc",
      language: "ko",
      workingVersion: {
        id: "v1",
        version: "0.1.0",
        sourceDocumentCount: 1,
        materialReady: true,
        distributionReady: true,
      },
      publishedVersion: { id: "v1", version: "0.1.0" },
    });
    const reviewing = buildProviderPackProgress({
      packId: "toast-ui-grid",
      packStatus: "REVIEWING",
      name: "TOAST UI Grid",
      categoryId: "ui",
      shortDescription: "short",
      description: "desc",
      language: "en",
      workingVersion: {
        id: "v2",
        version: "1.0.0",
        sourceDocumentCount: 2,
        materialReady: true,
        distributionReady: true,
      },
      publishedVersion: null,
    });

    assert.equal(published.currentStep, "PUBLISHED");
    assert.ok(published.actions.some((a) => a.label === "새 버전 만들기"));
    assert.equal(reviewing.currentStep, "APPROVAL");
    assert.ok(reviewing.actions.some((a) => a.label === "검수 상태 보기"));

    const summary = buildProviderPacksStatusSummary([
      { status: "PUBLISHED" },
      { status: "REVIEWING" },
    ]);
    assert.equal(summary.total, 2);
    assert.equal(summary.published, 1);
    assert.equal(summary.reviewing, 1);
  });

  it("separates published version from working draft version", () => {
    const progress = buildProviderPackProgress({
      packId: "pack-a",
      packStatus: "PUBLISHED",
      name: "Pack A",
      categoryId: "cat",
      shortDescription: "short",
      description: "desc",
      language: "ko",
      workingVersion: {
        id: "v2",
        version: "0.2.0",
        sourceDocumentCount: 0,
        materialReady: false,
        distributionReady: false,
      },
      publishedVersion: { id: "v1", version: "0.1.0" },
    });

    assert.equal(progress.publishedVersion?.version, "0.1.0");
    assert.equal(progress.workingVersion?.version, "0.2.0");
    assert.equal(progress.currentStep, "MATERIAL");
    assert.equal(progress.currentStepLabel, "자료 등록");
  });

  it("uses 자료 등록 label instead of Payload 등록", () => {
    const progress = buildProviderPackProgress({
      packId: "draft-1",
      packStatus: "DRAFT",
      name: "Draft",
      categoryId: "cat",
      shortDescription: "short",
      description: "desc",
      language: "ko",
      workingVersion: {
        id: "v1",
        version: "0.1.0",
        sourceDocumentCount: 0,
        materialReady: false,
        distributionReady: false,
      },
      publishedVersion: null,
    });
    assert.ok(progress.steps.some((s) => s.label === "자료 등록"));
    assert.ok(!progress.steps.some((s) => s.label.includes("Payload")));
  });

  it("maps pack-scoped onboarding steps through facade", () => {
    const steps = buildProviderOnboardingSteps({
      hasProfile: true,
      packCount: 1,
      sourceDocumentCount: 0,
      hasReviewingPack: false,
      hasPublishedOrVerifiedPack: false,
      packScoped: {
        packId: "draft-1",
        packStatus: "DRAFT",
        name: "Draft",
        categoryId: "cat",
        shortDescription: "short",
        description: "desc",
        language: "ko",
        workingVersion: {
          id: "v1",
          version: "0.1.0",
          sourceDocumentCount: 0,
          materialReady: false,
          distributionReady: false,
        },
        publishedVersion: null,
      },
    });
    assert.equal(steps.find((s) => s.key === "payload")?.title, "자료 등록");
    assert.equal(steps.find((s) => s.key === "payload")?.status, "current");
  });
});

describe("provider center pack progress UX sources", () => {
  it("removes global stepper and first-pack detail fetch", () => {
    const center = readSource("src/components/ProviderCenterPageClient.tsx");
    assert.ok(!center.includes("ProviderOnboardingStepper"));
    assert.ok(!center.includes("buildProviderOnboardingSteps"));
    assert.ok(!center.includes("fetchProviderPack("));
    assert.ok(!center.includes("primary"));
    assert.ok(center.includes("summary") || center.includes("현황"));
    assert.ok(center.includes("currentStepLabel") || center.includes("progress"));
  });

  it("does not mount pack-scoped stepper on pack detail editor", () => {
    const editor = readSource("src/components/ProviderPackEditor.tsx");
    assert.ok(!editor.includes("ProviderPackProgressStepper"));
    assert.ok(editor.includes("buildProviderPackProgress"));
  });

  it("enriches list API with summary without N+1 client calls", () => {
    const route = readSource("src/app/api/v1/provider/packs/route.ts");
    const service = readSource("src/lib/provider-pack-service.ts");
    assert.ok(route.includes("summary"));
    assert.ok(service.includes("buildProviderPackProgress"));
    assert.ok(service.includes("buildProviderPacksStatusSummary"));
  });
});
