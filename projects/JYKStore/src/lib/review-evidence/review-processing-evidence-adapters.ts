import type { AdminReviewDetailDto } from "@/lib/admin-review-dto";
import type {
  DoclingImportBundlePublicDto,
  PackCapabilitiesDto,
} from "@/lib/docling-import/docling-import-dto";
import {
  DOCLING_FILE_ROLE_LABELS,
  extractOriginMatchSummary,
  extractSimilarityDiagnostics,
} from "@/lib/docling-import/docling-import-ui";
import { isDoclingBundleReviewSnapshot } from "@/lib/provider-review-submit-snapshot";
import type { ImportProcessingEvidenceDto } from "@/lib/review-evidence/review-processing-evidence-dto";

function capability(
  supported: boolean,
  status: string,
  reason: string | null = null,
): ImportProcessingEvidenceDto["capabilities"]["download"] {
  return { supported, status, reason };
}

function defaultCapabilities(
  overrides?: Partial<ImportProcessingEvidenceDto["capabilities"]>,
): ImportProcessingEvidenceDto["capabilities"] {
  return {
    download: capability(true, "READY"),
    normalizedDocument: capability(false, "NOT_BUILT", "정규화 문서가 없습니다."),
    retrieval: capability(false, "NOT_BUILT", "Retrieval 인덱스가 아직 없습니다."),
    context: capability(false, "NOT_BUILT", "Context API 준비가 아직 없습니다."),
    export: capability(false, "NOT_BUILT", "Export 준비가 아직 없습니다."),
    mcp: capability(false, "NOT_BUILT", "MCP 등록이 아직 없습니다."),
    ...overrides,
  };
}

export function buildDoclingProcessingEvidence(input: {
  detail: AdminReviewDetailDto;
  bundle: DoclingImportBundlePublicDto | null;
  capabilities: PackCapabilitiesDto | null;
}): ImportProcessingEvidenceDto {
  const { detail, bundle, capabilities } = input;
  const snapshot = detail.latestReview?.submitSnapshot ?? null;
  const isDocling = isDoclingBundleReviewSnapshot(snapshot);

  const integrityStatus =
    detail.doclingReviewIntegrity?.status === "PASS"
      ? "PASS"
      : detail.doclingReviewIntegrity?.status === "BLOCKED"
        ? "BLOCKED"
        : detail.doclingReviewIntegrity
          ? "UNKNOWN"
          : "NOT_CHECKED";

  const nd = bundle?.normalizedDocument ?? null;
  const structureSummary =
    nd && typeof (nd as { warningCount?: number }).warningCount === "number"
      ? null
      : null;

  return {
    packageMode: "EXTERNAL_IMPORT",
    generator: {
      name: "Docling",
      version: bundle?.doclingSchemaVersion ?? (isDocling ? snapshot.doclingSchemaVersion : null),
    },
    adapter: bundle
      ? { type: bundle.adapterType, version: bundle.adapterVersion }
      : isDocling
        ? { type: "DOCLING", version: snapshot.adapterVersion }
        : null,
    schema: bundle
      ? {
          name: bundle.doclingSchemaName ?? "DoclingDocument",
          version: bundle.doclingSchemaVersion,
        }
      : isDocling
        ? { name: "DoclingDocument", version: snapshot.doclingSchemaVersion }
        : null,
    files:
      bundle?.files.map((file) => ({
        id: file.id,
        role: file.role,
        roleLabel: DOCLING_FILE_ROLE_LABELS[file.role] ?? file.role,
        originalFileName: file.originalFileName,
        mimeType: file.mimeType,
        fileSize: file.fileSize,
        checksumSha256: file.checksumSha256,
        downloadable: true,
      })) ?? [],
    validation: {
      status:
        (bundle?.errorCount ?? 0) > 0
          ? "BLOCKED"
          : (bundle?.warningCount ?? 0) > 0
            ? "WARNING"
            : bundle
              ? "PASS"
              : "NOT_AVAILABLE",
      warningCount: bundle?.warningCount ?? 0,
      errorCount: bundle?.errorCount ?? 0,
      originMatchSummary: bundle ? extractOriginMatchSummary(bundle.validationReport) : null,
      ...((): {
        validatorVersion: string | null;
        markdownCoverage: number | null;
        jaccard: number | null;
        samplePassCount: number | null;
      } => {
        const diag = bundle
          ? extractSimilarityDiagnostics(bundle.validationReport)
          : null;
        return {
          validatorVersion: diag?.validatorVersion ?? null,
          markdownCoverage: diag?.markdownCoverage ?? null,
          jaccard: diag?.jaccard ?? null,
          samplePassCount: diag?.samplePassCount ?? null,
        };
      })(),
      issues: [],
    },
    normalization: {
      supported: true,
      status: nd ? "READY" : "NOT_BUILT",
      normalizedDocumentId: nd?.id ?? (isDocling ? snapshot.normalizedDocumentId : null),
      fingerprint: nd?.fingerprint ?? (isDocling ? snapshot.fingerprint : null),
      fingerprintVersion: nd?.fingerprintVersion ?? null,
      language: nd?.language ?? null,
      title: nd?.title ?? null,
      summary: structureSummary,
    },
    integrity: {
      status: integrityStatus,
      messages: [
        ...(detail.doclingReviewIntegrity?.errors.map((e) => e.message) ?? []),
        ...(detail.doclingReviewIntegrity?.warnings.map((w) => w.message) ?? []),
      ],
    },
    capabilities: defaultCapabilities({
      download: capability(Boolean(bundle?.files.length), bundle?.files.length ? "READY" : "NOT_BUILT"),
      normalizedDocument: capability(
        Boolean(capabilities?.normalizedDocument.supported ?? nd),
        capabilities?.normalizedDocument.status ?? (nd ? "READY" : "NOT_BUILT"),
        capabilities?.normalizedDocument.message ?? null,
      ),
      retrieval: capability(
        Boolean(capabilities?.retrieval.supported),
        capabilities?.retrieval.status ?? "NOT_BUILT",
        capabilities?.retrieval.message ?? null,
      ),
      context: capability(
        Boolean(capabilities?.retrieval.supported) &&
          (capabilities?.retrieval.status === "READY" ||
            capabilities?.retrieval.status === "AVAILABLE"),
        capabilities?.retrieval.status === "READY" ||
          capabilities?.retrieval.status === "AVAILABLE"
          ? "READY"
          : "NOT_BUILT",
        "Context API는 Retrieval 준비가 필요합니다.",
      ),
      mcp: capability(
        Boolean(capabilities?.mcp.supported),
        capabilities?.mcp.status ?? "NOT_BUILT",
        capabilities?.mcp.message ?? null,
      ),
    }),
    processingLogs:
      bundle?.processingLogs.map((log) => ({
        id: log.id,
        stage: log.stage,
        status: log.status,
        message: log.message,
        startedAt: log.startedAt,
        completedAt: log.completedAt,
      })) ?? [],
    technicalIds: {
      bundleId: bundle?.id ?? (isDocling ? snapshot.doclingBundleId : null),
      normalizedDocumentId: nd?.id ?? (isDocling ? snapshot.normalizedDocumentId : null),
    },
  };
}

export function buildDistributionProcessingEvidence(
  detail: AdminReviewDetailDto,
): ImportProcessingEvidenceDto {
  const payload = detail.payload;
  return {
    packageMode: "DISTRIBUTION_ZIP",
    generator: payload
      ? {
          name: payload.generatorType || "ZIP Payload",
          version: payload.generatorVersion,
        }
      : null,
    adapter: payload
      ? { type: payload.profile, version: payload.generatorVersion ?? "n/a" }
      : null,
    schema: {
      name: "Distribution Manifest",
      version: "jyk-distribution-0.2",
    },
    files: payload
      ? [
          {
            id: payload.id,
            role: "PAYLOAD_ZIP",
            roleLabel: "Payload ZIP",
            originalFileName: payload.originalFileName,
            mimeType: "application/zip",
            fileSize: payload.fileSize,
            checksumSha256: payload.checksumSha256,
            downloadable: true,
          },
        ]
      : [],
    validation: {
      status:
        payload?.validationStatus === "VALID"
          ? "PASS"
          : payload
            ? "BLOCKED"
            : "NOT_AVAILABLE",
      warningCount: 0,
      errorCount: payload && payload.validationStatus !== "VALID" ? 1 : 0,
      originMatchSummary: null,
      validatorVersion: null,
      markdownCoverage: null,
      jaccard: null,
      samplePassCount: null,
      issues: payload?.validationMessage
        ? [
            {
              code: "PAYLOAD_VALIDATION",
              severity: payload.validationStatus === "VALID" ? "WARNING" : "ERROR",
              message: payload.validationMessage,
            },
          ]
        : [],
    },
    normalization: {
      supported: false,
      status: "NOT_SUPPORTED",
      normalizedDocumentId: null,
      fingerprint: detail.currentManifestFingerprint,
      fingerprintVersion: null,
      language: null,
      title: null,
      summary: null,
    },
    integrity: {
      status: payload?.validationStatus === "VALID" ? "PASS" : "NOT_CHECKED",
      messages: [],
    },
    capabilities: defaultCapabilities({
      download: capability(Boolean(payload), payload ? "READY" : "NOT_BUILT"),
    }),
    processingLogs: [],
    technicalIds: {
      bundleId: payload?.id ?? null,
      normalizedDocumentId: null,
    },
  };
}

export function buildLegacyProcessingEvidence(
  detail: AdminReviewDetailDto,
): ImportProcessingEvidenceDto {
  return {
    packageMode: "LEGACY_BUILDER",
    generator: null,
    adapter: null,
    schema: null,
    files: [],
    validation: {
      status:
        detail.readiness.sourceValidation.failCount > 0
          ? "BLOCKED"
          : detail.readiness.sourceValidation.warningCount > 0
            ? "WARNING"
            : "PASS",
      warningCount: detail.readiness.sourceValidation.warningCount,
      errorCount: detail.readiness.sourceValidation.failCount,
      originMatchSummary: null,
      validatorVersion: null,
      markdownCoverage: null,
      jaccard: null,
      samplePassCount: null,
      issues: [],
    },
    normalization: {
      supported: false,
      status: "NOT_SUPPORTED",
      normalizedDocumentId: null,
      fingerprint: null,
      fingerprintVersion: null,
      language: null,
      title: null,
      summary: null,
    },
    integrity: { status: "NOT_CHECKED", messages: [] },
    capabilities: defaultCapabilities({
      download: capability(detail.readiness.sourceDocumentCount > 0, "READY"),
      retrieval: capability(
        detail.readiness.retrievalEvaluationStatus === "PASS" ||
          detail.readiness.retrievalEvaluationStatus === "WARNING",
        detail.readiness.retrievalEvaluationStatus ?? "NOT_BUILT",
      ),
      context: capability(
        detail.readiness.retrievalEvaluationStatus === "PASS" ||
          detail.readiness.retrievalEvaluationStatus === "WARNING",
        detail.readiness.retrievalEvaluationStatus === "PASS" ||
          detail.readiness.retrievalEvaluationStatus === "WARNING"
          ? "READY"
          : "NOT_BUILT",
      ),
    }),
    processingLogs: [],
    technicalIds: { bundleId: null, normalizedDocumentId: null },
  };
}

/** Fixture-friendly builder for non-Docling generators (Unstructured, JYKPackBuilder, …). */
export function buildExternalImportEvidenceFixture(
  overrides: Partial<ImportProcessingEvidenceDto> & {
    generatorName: string;
    adapterType: string;
  },
): ImportProcessingEvidenceDto {
  return {
    packageMode: "EXTERNAL_IMPORT",
    generator: { name: overrides.generatorName, version: overrides.generator?.version ?? null },
    adapter: {
      type: overrides.adapterType,
      version: overrides.adapter?.version ?? "1.0.0",
    },
    schema: overrides.schema ?? { name: "ExternalSchema", version: "1.0.0" },
    files: overrides.files ?? [],
    validation: overrides.validation ?? {
      status: "PASS",
      warningCount: 0,
      errorCount: 0,
      originMatchSummary: null,
      validatorVersion: null,
      markdownCoverage: null,
      jaccard: null,
      samplePassCount: null,
      issues: [],
    },
    normalization: overrides.normalization ?? {
      supported: true,
      status: "READY",
      normalizedDocumentId: "nd-fixture",
      fingerprint: "fp",
      fingerprintVersion: "v1",
      language: "ko",
      title: "Fixture",
      summary: null,
    },
    integrity: overrides.integrity ?? { status: "PASS", messages: [] },
    capabilities: overrides.capabilities ?? {
      download: capability(true, "READY"),
      normalizedDocument: capability(true, "READY"),
      retrieval: capability(false, "NOT_BUILT"),
      context: capability(false, "NOT_BUILT"),
      export: capability(false, "NOT_BUILT"),
      mcp: capability(false, "NOT_BUILT"),
    },
    processingLogs: overrides.processingLogs ?? [],
    technicalIds: overrides.technicalIds ?? {
      bundleId: "bundle-fixture",
      normalizedDocumentId: "nd-fixture",
    },
  };
}
