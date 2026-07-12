import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import { dirname, join } from "node:path";
import { describe, it } from "node:test";
import { fileURLToPath } from "node:url";
import { buildProviderOnboardingSteps } from "../lib/provider-onboarding-steps.ts";

const here = dirname(fileURLToPath(import.meta.url));
const projectRoot = join(here, "..", "..");

function readSource(relativePath: string): string {
  return readFileSync(join(projectRoot, relativePath), "utf8");
}

describe("buildProviderOnboardingSteps", () => {
  it("starts with pack basics and does not require profile registration", () => {
    const steps = buildProviderOnboardingSteps({
      hasProfile: false,
      packCount: 0,
      sourceDocumentCount: 0,
      knowledgeUnitDraftCount: 0,
      hasReviewingPack: false,
      hasPublishedOrVerifiedPack: false,
    });
    assert.equal(steps.find((s) => s.key === "profile"), undefined);
    assert.equal(steps.find((s) => s.key === "pack")?.status, "current");

    const withPack = buildProviderOnboardingSteps({
      hasProfile: true,
      packCount: 1,
      sourceDocumentCount: 0,
      knowledgeUnitDraftCount: 0,
      hasReviewingPack: false,
      hasPublishedOrVerifiedPack: false,
    });
    assert.equal(withPack.find((s) => s.key === "pack")?.status, "done");
    assert.equal(withPack.find((s) => s.key === "materials")?.status, "current");
  });

  it("includes four onboarding steps without profile registration", () => {
    const steps = buildProviderOnboardingSteps({
      hasProfile: true,
      packCount: 1,
      sourceDocumentCount: 2,
      knowledgeUnitDraftCount: 1,
      hasReviewingPack: false,
      hasPublishedOrVerifiedPack: false,
    });
    assert.equal(steps.length, 4);
    assert.deepEqual(
      steps.map((s) => s.key),
      ["pack", "materials", "review", "publish"],
    );
  });
});

describe("provider onboarding UX sources", () => {
  it("avoids duplicate numbered list on provider page", () => {
    const page = readSource("src/app/(store)/provider/page.tsx");
    assert.ok(!page.includes("list-decimal"));
    assert.ok(!page.includes("PROVIDER_CENTER_ONBOARDING_STEPS.map"));
    assert.ok(page.includes("ProviderCenterPageClient"));
  });

  it("shows payload import prep notice instead of create CTAs", () => {
    const center = readSource("src/components/ProviderCenterPageClient.tsx");
    assert.ok(!center.includes("<details"));
    assert.ok(center.includes("fetchAuthSession"));
    assert.ok(!center.includes("새 지식팩 만들기"));
    assert.ok(!center.includes("첫 지식팩 만들기"));
    assert.ok(center.includes("PROVIDER_PAYLOAD_IMPORT_PREP_TITLE"));
    assert.ok(!center.includes("1. 1."));
  });

  it("shows blocked notice instead of pack create form on new pack page", () => {
    const packNew = readSource("src/app/(store)/provider/packs/new/page.tsx");
    assert.ok(packNew.includes("ProviderRequiredCard"));
    assert.ok(!packNew.includes("ProviderPackCreateForm"));
    assert.ok(packNew.includes("PROVIDER_PACK_NEW_BLOCKED_TITLE"));
    assert.ok(packNew.includes("getUserIdFromCookies"));
    assert.ok(packNew.includes("ensureProviderProfileForAccount"));
  });

  it("keeps pack create form component for P29 reuse", () => {
    const form = readSource("src/components/ProviderPackCreateForm.tsx");
    assert.ok(form.includes("1단계"));
    assert.ok(form.includes("지식팩 초안 생성"));
  });

  it("does not ask for pack id or short description on create form", () => {
    const form = readSource("src/components/ProviderPackCreateForm.tsx");
    assert.ok(!form.includes("짧은 설명"));
    assert.ok(!form.includes("Pack ID"));
    assert.ok(!form.includes('htmlFor="pack-id"'));
    assert.ok(!form.includes('htmlFor="pack-short"'));
    assert.ok(form.includes("PROVIDER_PACK_CREATE_AUTO_ID_HINT"));
  });

  it("shows issued pack id after create on detail editor", () => {
    const editor = readSource("src/components/ProviderPackEditor.tsx");
    assert.ok(editor.includes("PROVIDER_PACK_CREATED_BANNER_TITLE"));
    assert.ok(editor.includes("PROVIDER_PACK_ID_LABEL"));
    assert.ok(editor.includes('searchParams.get("created")'));
  });
});
