import assert from "node:assert/strict";
import { existsSync, readFileSync } from "node:fs";
import { dirname, join } from "node:path";
import { describe, it } from "node:test";
import { fileURLToPath } from "node:url";
import { buildPackCapabilitiesDto } from "../lib/docling-import/docling-import-dto.ts";
import {
  isDoclingPayloadPresent,
  isDoclingPayloadReady,
} from "../lib/docling-import/docling-import-ui.ts";
import { ADMIN_REVIEW_EVIDENCE_TAB_IDS } from "../lib/admin-review-tabs.ts";
import { ADMIN_REVIEW_TAB_DOCLING } from "../lib/role-based-ux-copy.ts";

const here = dirname(fileURLToPath(import.meta.url));
const projectRoot = join(here, "..", "..");

function readSource(relativePath: string): string {
  return readFileSync(join(projectRoot, relativePath), "utf8");
}

describe("docling import UX sources", () => {
  it("ships ProviderDoclingImportTab with optional Markdown and multipart upload", () => {
    const path = "src/components/provider-distribution/ProviderDoclingImportTab.tsx";
    assert.ok(existsSync(join(projectRoot, path)));
    const source = readSource(path);
    assert.ok(source.includes("원본문서"));
    assert.ok(source.includes("Docling JSON"));
    assert.ok(source.includes("Docling Markdown"));
    assert.ok(source.includes("선택 안 함") || source.includes("선택)"));
    assert.ok(!source.includes("원본문서와 구조화 JSON을 등록합니다"));
    assert.ok(!source.includes("3파일 업로드"));
    assert.ok(source.includes("선택됨:") || source.includes("선택 안 함"));
    assert.ok(source.includes("선택한 파일"));
    assert.ok(source.includes("등록된 Docling Bundle"));
    assert.ok(source.includes("cachedBundle"));
    assert.ok(!source.includes("교체(재업로드)"));
    assert.ok(source.includes("새 파일로 교체"));
    assert.ok(source.includes("등록 자료 삭제"));
    assert.ok(source.includes("NormalizedDocumentPreview"));
    assert.ok(source.includes("min-h-[44px]"));
    assert.ok(source.includes("실패한 Staging Bundle") || source.includes("stagingBundle"));
    assert.ok(source.includes("Staging 재시도") || source.includes("retryProviderDoclingImportBundleApi"));
    assert.ok(source.includes("검수 제출 이력이 있어 교체할 수 없습니다"));
    assert.ok(source.includes("uploadDoclingMultipart"));
    assert.ok(!source.includes("uploadProviderDoclingImportApi"));
    assert.ok(!source.includes("FormData"));
    assert.ok(!source.includes("extractSimilarityDiagnostics"));
  });

  it("ships multipart client and upload-session API helpers; FormData upload gone", () => {
    const client = readSource("src/lib/docling-import/docling-multipart-client.ts");
    assert.ok(client.includes("uploadDoclingMultipart"));
    assert.ok(client.includes("preValidateDoclingUploadFiles"));
    assert.ok(client.includes("XMLHttpRequest"));
    assert.ok(client.includes("sessionStorage"));
    assert.ok(client.includes("파일 확인") || client.includes("validating"));

    const api = readSource("src/lib/provider-center-api.ts");
    assert.ok(api.includes("fetchProviderDoclingUploadPolicyApi"));
    assert.ok(api.includes("createProviderDoclingUploadSessionApi"));
    assert.ok(api.includes("presignProviderDoclingUploadPartsApi"));
    assert.ok(api.includes("completeProviderDoclingUploadSessionApi"));
    assert.ok(!api.includes("uploadProviderDoclingImportApi"));
    assert.ok(!api.includes("form.append(\"sourceFile\""));

    const route = readSource(
      "src/app/api/v1/provider/packs/[packId]/docling-import/route.ts",
    );
    assert.ok(route.includes("410") || route.includes("DOCLING_FORMDATA_UPLOAD_GONE"));
  });

  it("payload tab is Docling-only without legacy ZIP UI", () => {
    const payload = readSource("src/components/provider-distribution/ProviderPayloadTab.tsx");
    assert.ok(payload.includes("ProviderDoclingImportTab"));
    assert.ok(payload.includes("등록 자료") || payload.includes("ProviderMaterialRegistrationTab"));
    assert.ok(!payload.includes("Docling Markdown을 등록합니다"));
    assert.ok(!payload.includes("레거시 ZIP Payload"));
    assert.ok(!payload.includes("legacyOpen"));
    assert.ok(!payload.includes("ZIP 파일"));
  });

  it("wires provider API helpers and pack editor readiness", () => {
    const api = readSource("src/lib/provider-center-api.ts");
    assert.ok(api.includes("fetchProviderDoclingImportApi"));
    assert.ok(api.includes("deleteProviderDoclingImportApi"));
    assert.ok(api.includes("retryProviderDoclingImportApi"));
    assert.ok(api.includes("fetchProviderNormalizedDocumentApi"));
    assert.ok(api.includes("providerDoclingImportFileDownloadUrl"));

    const editor = readSource("src/components/ProviderPackEditor.tsx");
    assert.ok(editor.includes("fetchProviderDoclingImportApi"));
    assert.ok(editor.includes("onDoclingChanged"));
    assert.ok(editor.includes("isDoclingPayloadPresent"));
    assert.ok(!editor.includes("fetchProviderPackPayloadApi"));

    const readiness = readSource(
      "src/components/provider-distribution/ProviderDistributionReadiness.tsx",
    );
    assert.ok(readiness.includes("doclingBundle"));
    assert.ok(readiness.includes("isDoclingPayloadReady"));
    assert.ok(readiness.includes("등록 자료"));
    assert.ok(readiness.includes("파일 무결성"));
    assert.ok(readiness.includes("문서 정규화"));
    assert.ok(!readiness.includes("KnowledgePayloadPublicDto"));
  });

  it("ships AdminReviewProcessingEvidenceTab and evidence tab id", () => {
    const path = "src/components/AdminReviewProcessingEvidenceTab.tsx";
    assert.ok(existsSync(join(projectRoot, path)));
    const source = readSource(path);
    assert.ok(source.includes("Capability") || source.includes("capabilities"));
    assert.ok(source.includes("patchAdminDistributionMetadataApi"));
    assert.ok(source.includes("처리 로그") || source.includes("processingLogs"));
    assert.ok(source.includes("무결성") || source.includes("integrity"));
    assert.ok(source.includes("생성 도구"));

    assert.ok(ADMIN_REVIEW_EVIDENCE_TAB_IDS.includes("processing"));
    assert.ok(!ADMIN_REVIEW_EVIDENCE_TAB_IDS.includes("docling" as never));
    assert.equal(ADMIN_REVIEW_TAB_DOCLING, "처리·검증");

    const page = readSource("src/components/AdminReviewDetailPageClient.tsx");
    assert.ok(!page.includes("AdminReviewProcessingEvidenceTab"));
    assert.ok(!page.includes("includeProcessing"));
    assert.ok(!page.includes("fetchAdminDoclingImportApi"));
    assert.ok(page.includes("AdminKnowledgeGenerationPanel"));

    const processing = readSource("src/components/AdminReviewProcessingEvidenceTab.tsx");
    assert.ok(processing.includes("AdminReview"));

    const facade = readSource("src/components/AdminReviewDoclingImportTab.tsx");
    assert.ok(facade.includes("AdminReviewProcessingEvidenceTab"));

    const adminApi = readSource("src/lib/admin-review-api.ts");
    assert.ok(adminApi.includes("fetchAdminDoclingImportApi"));
    assert.ok(adminApi.includes("fetchAdminNormalizedDocumentApi"));
    assert.ok(adminApi.includes("adminDoclingImportFileDownloadUrl"));
  });

  it("documents Docling import, schema, and adapter ops; README mentions no Docling runtime", () => {
    for (const relative of [
      "docs/docling-three-file-import.md",
      "docs/normalized-document-schema.md",
      "docs/docling-adapter-operations.md",
    ]) {
      assert.ok(existsSync(join(projectRoot, relative)), relative);
    }

    const importDoc = readSource("docs/docling-three-file-import.md");
    assert.ok(importDoc.includes("Docling을 **실행하지 않습니다**") || importDoc.includes("실행하지 않습니다"));
    assert.ok(importDoc.includes("DOCLING_ADAPTER_VERSION") || importDoc.includes("서버 상수"));
    assert.ok(importDoc.includes("storageStatus") || importDoc.includes("Storage Status"));

    const schemaDoc = readSource("docs/normalized-document-schema.md");
    assert.ok(schemaDoc.includes("capabilities"));
    assert.ok(schemaDoc.includes("NOT_BUILT"));
    assert.ok(schemaDoc.includes("normalized-document-v2"));

    const opsDoc = readSource("docs/docling-adapter-operations.md");
    assert.ok(opsDoc.includes("REVIEW_READY"));
    assert.ok(opsDoc.includes("NormalizedDocument"));
    assert.ok(opsDoc.includes("DOCLING_REVIEW_INTEGRITY") || opsDoc.includes("무결성"));

    const readme = readSource("README.md");
    assert.ok(readme.includes("Docling 3파일 Import"));
    assert.ok(readme.includes("Docling을 실행하지 않습니다"));
    assert.ok(readme.includes("NormalizedDocument"));
    assert.ok(readme.includes("레거시 ZIP"));
    assert.ok(readme.includes("서버 상수") || readme.includes("Adapter Version"));
  });

  it("exposes capability badge helper and readiness helpers", () => {
    const caps = buildPackCapabilitiesDto({ hasNormalizedDocument: true });
    assert.equal(caps.normalizedDocument.supported, true);
    assert.equal(caps.normalizedDocument.status, "READY");
    assert.equal(caps.retrieval.supported, false);
    assert.equal(caps.retrieval.status, "NOT_BUILT");
    assert.equal(caps.mcp.status, "NOT_BUILT");

    assert.equal(isDoclingPayloadReady("REVIEW_READY"), true);
    assert.equal(isDoclingPayloadReady("NORMALIZED"), false);
    assert.equal(isDoclingPayloadPresent("NORMALIZED"), true);
    assert.equal(isDoclingPayloadPresent("VALID"), false);

    const route = readSource(
      "src/app/api/v1/provider/packs/[packId]/normalized-document/route.ts",
    );
    assert.ok(route.includes("capabilities"));
  });

  it("sanitizes markdown preview via shared helper", () => {
    const preview = readSource("src/components/docling/NormalizedDocumentPreview.tsx");
    assert.ok(preview.includes("sanitizeMarkdownForPreview"));
    assert.ok(preview.includes("확인 요약"));
    assert.ok(preview.includes("목차 샘플"));
    assert.ok(preview.includes("본문 샘플"));
    assert.ok(preview.includes("표 샘플"));
    assert.ok(preview.includes("그림 샘플"));
    assert.ok(preview.includes("전체 그림"));
    assert.ok(preview.includes("확인 필요 그림"));
    assert.ok(preview.includes("isFallbackCandidate") || preview.includes("제공자 확인이 필요한 후보"));
    assert.ok(preview.includes("고급 정보"));
    assert.ok(preview.includes("Markdown"));
    assert.ok(preview.includes("처리 로그"));
    assert.ok(preview.includes("제공자") || preview.includes("미선택"));
    assert.ok(!preview.includes("languageConfidence"));
    assert.ok(!preview.includes("Fingerprint:") || preview.includes("고급 정보"));
  });
});
