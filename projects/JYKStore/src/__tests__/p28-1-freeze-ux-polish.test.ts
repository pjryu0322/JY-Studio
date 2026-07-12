import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import { dirname, join } from "node:path";
import { describe, it } from "node:test";
import { fileURLToPath } from "node:url";
import type { ProviderPackDetailDto } from "@/lib/provider-pack-dto";

const here = dirname(fileURLToPath(import.meta.url));
const projectRoot = join(here, "..", "..");

function readSource(relativePath: string): string {
  return readFileSync(join(projectRoot, relativePath), "utf8");
}

function currentVersionDocs(pack: Pick<ProviderPackDetailDto, "versions">) {
  return pack.versions[0]?.sourceDocuments ?? [];
}

describe("P28.1 new pack creation UX freeze", () => {
  it("removes clickable create CTAs from provider center and shows prep notice", () => {
    const center = readSource("src/components/ProviderCenterPageClient.tsx");
    assert.ok(!center.includes("새 지식팩 만들기"));
    assert.ok(!center.includes("첫 지식팩 만들기"));
    assert.ok(!center.includes("ROUTES.providerPackNew"));
    assert.ok(center.includes("PROVIDER_PAYLOAD_IMPORT_PREP_TITLE"));
    assert.ok(center.includes("PROVIDER_PAYLOAD_IMPORT_PREP_BODY"));
  });

  it("blocks create form on direct /provider/packs/new URL", () => {
    const packNew = readSource("src/app/(store)/provider/packs/new/page.tsx");
    assert.ok(!packNew.includes("ProviderPackCreateForm"));
    assert.ok(packNew.includes("PROVIDER_PACK_NEW_BLOCKED_TITLE"));
    assert.ok(packNew.includes("Provider Center로 돌아가기"));
    assert.ok(packNew.includes("기존 지식팩 관리"));
    assert.ok(packNew.includes("ROUTES.provider"));
  });

  it("keeps pack create API available for P29 reuse", () => {
    const api = readSource("src/lib/provider-center-api.ts");
    const route = readSource("src/app/api/v1/provider/packs/route.ts");
    assert.ok(api.includes("export async function createProviderPackApi"));
    assert.ok(route.includes("export async function POST"));
  });
});

describe("P28.1 materials latest-version alignment", () => {
  it("materials tab and editor count use versions[0] only", () => {
    const materials = readSource("src/components/ProviderPackMaterialsTab.tsx");
    const editor = readSource("src/components/ProviderPackEditor.tsx");
    const center = readSource("src/components/ProviderCenterPageClient.tsx");

    assert.ok(materials.includes("pack.versions[0]"));
    assert.ok(!materials.includes("flatMap"));
    assert.ok(materials.includes("PROVIDER_PACK_MATERIALS_REVIEW_VERSION_LABEL"));
    assert.ok(editor.includes("pack?.versions[0]?.sourceDocuments.length"));
    assert.ok(!editor.includes("flatMap((v) => v.sourceDocuments)"));
    assert.ok(center.includes("versions[0]?.sourceDocuments.length"));
  });

  it("counts only latest version documents for review readiness", () => {
    const pack = {
      versions: [
        { version: "2.0.0", sourceDocuments: [] },
        {
          version: "1.0.0",
          sourceDocuments: [{ id: "old-1" }, { id: "old-2" }],
        },
      ],
    } as unknown as ProviderPackDetailDto;

    assert.equal(currentVersionDocs(pack).length, 0);
    assert.equal(pack.versions[0]?.version, "2.0.0");

    const packWithLatestDocs = {
      versions: [
        {
          version: "2.0.0",
          sourceDocuments: [{ id: "a" }, { id: "b" }, { id: "c" }],
        },
        { version: "1.0.0", sourceDocuments: [{ id: "old" }] },
      ],
    } as unknown as ProviderPackDetailDto;

    assert.equal(currentVersionDocs(packWithLatestDocs).length, 3);
    assert.ok(
      currentVersionDocs(packWithLatestDocs).every((doc) => doc.id !== "old"),
    );
  });
});

describe("P28.1 legacy client API removal", () => {
  it("removes unused provider builder client helpers", () => {
    const api = readSource("src/lib/provider-center-api.ts");
    for (const name of [
      "addSourceDocumentApi",
      "evaluateProviderStructureQualityApi",
      "evaluateProviderReleaseGateApi",
      "evaluateProviderChunkQualityApi",
      "generateProviderRetrievalEvaluationCasesApi",
      "runProviderRetrievalEvaluationApi",
      "validateSourceDocumentApi",
      "previewGitHubRepositoryDiscoveryApi",
      "registerGitHubSourceDocumentsApi",
      "generateGitHubKnowledgeUnitDraftsApi",
      "runProviderInspectionAutoPrepareApi",
      "fetchProviderKnowledgeUnitDraftsApi",
      "resetProviderKnowledgeUnitDraftsApi",
    ]) {
      assert.ok(!api.includes(name), `expected ${name} removed`);
    }
    assert.ok(!api.includes("github-auto-collect-types"));
    assert.ok(api.includes("submitProviderPackApi"));
    assert.ok(api.includes("withdrawProviderPackReviewApi"));
    assert.ok(api.includes("fetchProviderPack"));
  });

  it("removes unused admin builder client helpers and keeps decision APIs", () => {
    const api = readSource("src/lib/admin-review-api.ts");
    for (const name of [
      "validateAdminPackSourcesApi",
      "evaluateAdminStructureQualityApi",
      "evaluateAdminChunkQualityApi",
      "generateAdminRetrievalEvaluationCasesApi",
      "runAdminRetrievalEvaluationApi",
      "evaluateAdminReleaseGateApi",
      "refreshAdminReviewReadinessApi",
    ]) {
      assert.ok(!api.includes(name), `expected ${name} removed`);
    }
    assert.ok(api.includes("fetchAdminReviewItems"));
    assert.ok(api.includes("fetchAdminReviewDetail"));
    assert.ok(api.includes("acceptAdminReview"));
    assert.ok(api.includes("approveAdminReview"));
    assert.ok(api.includes("rejectAdminReview"));
  });
});
