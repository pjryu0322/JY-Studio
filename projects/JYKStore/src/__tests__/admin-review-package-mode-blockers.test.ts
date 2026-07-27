import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import { dirname, join } from "node:path";
import { describe, it } from "node:test";
import { fileURLToPath } from "node:url";
import type { AdminReviewDetailDto } from "../lib/admin-review-dto.ts";
import {
  assertAdminReviewDecisionConsistency,
  canAcceptAdminReview,
  collectReviewBlockers,
  collectReviewWarnings,
} from "../lib/admin-review-decision.ts";

const here = dirname(fileURLToPath(import.meta.url));
const projectRoot = join(here, "..", "..");

function readSource(relativePath: string): string {
  return readFileSync(join(projectRoot, relativePath), "utf8");
}

function readiness(overrides: Partial<AdminReviewDetailDto["readiness"]> = {}) {
  return {
    versionCount: 1,
    sourceDocumentCount: 0,
    hasRequiredDescription: true,
    canApprove: true,
    pipelineStatus: "READY",
    sourceValidation: {
      passCount: 0,
      warningCount: 4,
      failCount: 0,
      notCheckedCount: 0,
    },
    sourceTypeCoverage: {},
    structureCoverageStatus: "WARNING",
    knowledgeQualityStatus: "WARNING",
    structureQualityMessage: "구조 품질 메시지",
    chunkQualityStatus: "WARNING",
    chunkQualityMessage: "청킹 품질 메시지",
    retrievalEvaluationStatus: "WARNING",
    retrievalEvaluationMessage: "검색 품질 메시지",
    releaseGateStatus: "WARNING" as string | null,
    releaseGateMessage: null,
    ...overrides,
  };
}

function baseDetail(overrides: Partial<AdminReviewDetailDto> = {}): AdminReviewDetailDto {
  const now = new Date().toISOString();
  return {
    pack: {
      packId: "pack-1",
      name: "Test Pack",
      providerName: "Provider",
      providerType: "ORG",
      categoryId: "cat",
      status: "REVIEWING",
      pricing: "FREE",
      icon: "📦",
      shortDescription: "short",
      description: "long",
      tags: [],
      createdAt: now,
      updatedAt: now,
      ...(overrides.pack ?? {}),
    },
    versions: overrides.versions ?? [],
    latestReview:
      overrides.latestReview === undefined
        ? {
            id: "rev-1",
            status: "PENDING",
            decision: null,
            memo: null,
            rejectionReason: null,
            reviewerUserId: null,
            createdAt: now,
            updatedAt: now,
            decidedAt: null,
            submitSnapshot: null,
          }
        : overrides.latestReview,
    readiness: readiness(overrides.readiness),
    payload: overrides.payload ?? null,
    currentManifestFingerprint: overrides.currentManifestFingerprint ?? null,
    doclingReviewIntegrity: overrides.doclingReviewIntegrity ?? null,
    distribution: overrides.distribution ?? null,
    artifactOptions: overrides.artifactOptions ?? null,
    structureQuality: overrides.structureQuality ?? null,
    chunkQuality: overrides.chunkQuality ?? null,
    retrievalEvaluation: overrides.retrievalEvaluation ?? null,
    releaseGate: overrides.releaseGate ?? null,
  };
}

function dist(overrides: Partial<NonNullable<AdminReviewDetailDto["distribution"]>> = {}) {
  return {
    sourceTitle: "Source",
    sourceUrl: null,
    sourcePublisherName: null,
    sourcePublisherUrl: null,
    sourceDocumentVersion: null,
    sourcePublishedAt: null,
    sourceRetrievedAt: null,
    licenseName: "MIT",
    licenseUrl: null,
    usageTerms: null,
    readmeText: null,
    visibility: "PRIVATE",
    allowDownload: true,
    allowApi: true,
    allowMcp: true,
    rightsBasis: "PUBLIC_LICENSE",
    rightsBasisDetail: null,
    rightsConfirmed: true,
    rightsConfirmedAt: "2026-01-01T00:00:00.000Z",
    serviceEndsAt: null,
    primaryArtifactType: null,
    contentType: null,
    ...overrides,
  };
}

function doclingVersion() {
  return {
    id: "ver-1",
    version: "1.0.0",
    overview: "",
    features: [] as string[],
    includedKnowledge: [] as string[],
    supportedEnvironments: [] as string[],
    targetUsers: [] as string[],
    useCases: [] as string[],
    versionSummary: "",
    language: "ko" as const,
    sourceDocuments: [] as AdminReviewDetailDto["versions"][number]["sourceDocuments"],
  };
}

function doclingSnapshot() {
  return {
    mode: "DOCLING_BUNDLE" as const,
    submittedAt: new Date().toISOString(),
    submittedVersionId: "ver-1",
    doclingBundleId: "bundle-1",
    sourceFileId: "src-1",
    jsonPayloadFileId: "json-1",
    markdownPayloadFileId: "md-1",
    checksums: { source: "a", json: "b", markdown: "c" },
    doclingSchemaVersion: "1.10.0",
    adapterVersion: "1.0.0",
    normalizedDocumentId: "nd-1",
    fingerprint: "fp-1",
    warningCount: 0,
    sourceTitle: "Source",
    licenseName: "MIT",
    visibility: "PRIVATE",
    allowDownload: true,
    language: "ko" as const,
  };
}

function distributionSnapshot() {
  return {
    mode: "DISTRIBUTION" as const,
    submittedAt: new Date().toISOString(),
    submittedVersionId: "ver-1",
    payloadId: "payload-1",
    payloadProfile: "GENERIC",
    checksumSha256: "abc",
    validationStatus: "VALID" as const,
    manifestSchemaVersion: "jyk-distribution-0.2",
    manifestFingerprint: "mf-1",
    sourceTitle: "Source",
    licenseName: "MIT",
    visibility: "PRIVATE",
    allowDownload: true,
  };
}

describe("admin review blockers by package mode", () => {
  it("Docling Bundle ignores Legacy sourceDocumentCount blockers", () => {
    const detail = baseDetail({
      readiness: readiness({ sourceDocumentCount: 0 }),
      distribution: dist(),
      doclingReviewIntegrity: { status: "PASS", errors: [], warnings: [] },
      latestReview: {
        id: "rev-1",
        status: "PENDING",
        decision: null,
        memo: null,
        rejectionReason: null,
        reviewerUserId: null,
        createdAt: new Date().toISOString(),
        updatedAt: new Date().toISOString(),
        decidedAt: null,
        submitSnapshot: doclingSnapshot(),
      },
      versions: [doclingVersion()],
    });

    const blockers = collectReviewBlockers(detail);
    assert.equal(blockers.includes("원천 문서가 없습니다."), false);
    assert.ok(!blockers.some((b) => b.includes("청킹 품질")));
    assert.ok(!blockers.some((b) => b.includes("릴리스 게이트")));
    assert.deepEqual(blockers, []);
    assert.equal(canAcceptAdminReview(detail), true);
    assert.equal(assertAdminReviewDecisionConsistency(detail).consistent, true);
  });

  it("Docling Bundle blocks missing original via integrity message", () => {
    const detail = baseDetail({
      distribution: dist(),
      doclingReviewIntegrity: {
        status: "BLOCKED",
        errors: [
          {
            code: "DOCLING_REVIEW_FILE_NOT_FOUND",
            message: "원본문서 파일이 없습니다.",
          },
        ],
        warnings: [],
      },
      latestReview: {
        id: "rev-1",
        status: "PENDING",
        decision: null,
        memo: null,
        rejectionReason: null,
        reviewerUserId: null,
        createdAt: new Date().toISOString(),
        updatedAt: new Date().toISOString(),
        decidedAt: null,
        submitSnapshot: doclingSnapshot(),
      },
      versions: [doclingVersion()],
    });

    const blockers = collectReviewBlockers(detail);
    assert.ok(blockers.some((b) => b.includes("원본문서 파일이 없습니다.")));
    assert.ok(!blockers.includes("원천 문서가 없습니다."));
  });

  it("Docling Bundle blocks missing NormalizedDocument", () => {
    const detail = baseDetail({
      distribution: dist(),
      doclingReviewIntegrity: {
        status: "BLOCKED",
        errors: [
          {
            code: "DOCLING_REVIEW_NORMALIZED_DOCUMENT_MISSING",
            message: "정규화 문서가 없습니다.",
          },
        ],
        warnings: [],
      },
      latestReview: {
        id: "rev-1",
        status: "PENDING",
        decision: null,
        memo: null,
        rejectionReason: null,
        reviewerUserId: null,
        createdAt: new Date().toISOString(),
        updatedAt: new Date().toISOString(),
        decidedAt: null,
        submitSnapshot: doclingSnapshot(),
      },
      versions: [doclingVersion()],
    });

    assert.ok(collectReviewBlockers(detail).includes("정규화 문서가 없습니다."));
  });

  it("legacy DISTRIBUTION ZIP snapshots are permanently blocked", () => {
    const detail = baseDetail({
      readiness: readiness({ sourceDocumentCount: 0 }),
      payload: null,
      distribution: dist(),
      currentManifestFingerprint: null,
      latestReview: {
        id: "rev-1",
        status: "PENDING",
        decision: null,
        memo: null,
        rejectionReason: null,
        reviewerUserId: null,
        createdAt: new Date().toISOString(),
        updatedAt: new Date().toISOString(),
        decidedAt: null,
        submitSnapshot: distributionSnapshot(),
      },
      versions: [{ id: "ver-1", version: "1.0.0", sourceDocuments: [] } as never],
    });

    const blockers = collectReviewBlockers(detail);
    assert.ok(blockers.some((b) => /ZIP Knowledge Package/.test(b)));
    assert.equal(canAcceptAdminReview(detail), false);
  });

  it("Legacy Builder still blocks missing source documents", () => {
    const detail = baseDetail({
      readiness: readiness({
        sourceDocumentCount: 0,
        sourceValidation: {
          passCount: 0,
          warningCount: 0,
          failCount: 0,
          notCheckedCount: 0,
        },
        structureQualityMessage: null,
        chunkQualityMessage: null,
        retrievalEvaluationMessage: null,
        structureCoverageStatus: "PASS",
        knowledgeQualityStatus: "PASS",
        chunkQualityStatus: "PASS",
        retrievalEvaluationStatus: "PASS",
        releaseGateStatus: "PASS",
      }),
      latestReview: {
        id: "rev-1",
        status: "PENDING",
        decision: null,
        memo: null,
        rejectionReason: null,
        reviewerUserId: null,
        createdAt: new Date().toISOString(),
        updatedAt: new Date().toISOString(),
        decidedAt: null,
        submitSnapshot: {
          submittedAt: new Date().toISOString(),
          submittedVersionId: "ver-1",
          sourceDocumentIds: [],
          activeChunkIds: ["c1"],
          sourceDocumentCount: 0,
          activeChunkCount: 1,
          releaseGateRunId: "rg-1",
          releaseGateStatus: "PASS",
          warnings: [],
        },
      },
    });

    assert.ok(collectReviewBlockers(detail).includes("원천 문서가 없습니다."));
  });

  it("Docling warnings exclude Legacy source WARNING copy", () => {
    const detail = baseDetail({
      distribution: dist(),
      doclingReviewIntegrity: { status: "PASS", errors: [], warnings: [] },
      latestReview: {
        id: "rev-1",
        status: "PENDING",
        decision: null,
        memo: null,
        rejectionReason: null,
        reviewerUserId: null,
        createdAt: new Date().toISOString(),
        updatedAt: new Date().toISOString(),
        decidedAt: null,
        submitSnapshot: doclingSnapshot(),
      },
      versions: [doclingVersion()],
    });

    const warnings = collectReviewWarnings(detail);
    assert.ok(!warnings.some((w) => w.includes("원천 문서")));
    assert.ok(!warnings.some((w) => w.includes("릴리스 게이트")));
  });

  it("warning tab UI documents Docling guidance and empty states", () => {
    const ui = readSource("src/components/AdminReviewWarningIssuesTab.tsx");
    assert.ok(ui.includes("ADMIN_REVIEW_WARNING_TAB_HINT_DOCLING"));
    assert.ok(ui.includes("ADMIN_REVIEW_BLOCKERS_EMPTY"));
    assert.ok(ui.includes("ADMIN_REVIEW_WARNINGS_EMPTY"));
    assert.ok(ui.includes("ADMIN_REVIEW_ISSUES_EMPTY"));
    assert.ok(ui.includes("hasDoclingReviewEvidence"));
    assert.ok(ui.includes("buildReviewIssuesDetailMarkdown"));
    assert.ok(ui.includes("차단/주의 이슈 상세 MD 다운로드"));
  });
});
