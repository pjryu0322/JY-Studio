import type {
  DoclingBundleStorageStatus,
  DoclingImportBundleStatus,
  DoclingProcessingStage,
  DoclingProcessingStatus,
  KnowledgePackFileRole,
} from "@prisma/client";

export type KnowledgePackFilePublicDto = {
  id: string;
  bundleId: string;
  packId: string;
  versionId: string;
  role: KnowledgePackFileRole;
  originalFileName: string;
  mimeType: string;
  fileExtension: string;
  fileSize: number;
  checksumSha256: string;
  uploadedAt: string;
};

export type DoclingProcessingLogPublicDto = {
  id: string;
  stage: DoclingProcessingStage;
  status: DoclingProcessingStatus;
  attempt: number;
  adapterVersion: string | null;
  message: string | null;
  errorCode: string | null;
  startedAt: string;
  completedAt: string | null;
  createdAt: string;
};

export type NormalizedDocumentSummaryDto = {
  id: string;
  bundleId: string;
  packId: string;
  versionId: string;
  isActive: boolean;
  adapterType: string;
  adapterVersion: string;
  sourceSchemaName: string | null;
  sourceSchemaVersion: string | null;
  title: string | null;
  language: string | null;
  languageSource: string | null;
  languageConfidence: number | null;
  fingerprint: string | null;
  fingerprintVersion: string | null;
  warningCount: number;
  sourceFileId: string | null;
  jsonPayloadFileId: string | null;
  markdownPayloadFileId: string | null;
  sourcePayloadChecksum: string | null;
  createdAt: string;
  updatedAt: string;
};

export type PackCapabilityStatusDto = {
  supported: boolean;
  status: string;
  message?: string;
};

export type PackCapabilitiesDto = {
  normalizedDocument: PackCapabilityStatusDto;
  retrieval: PackCapabilityStatusDto;
  mcp: PackCapabilityStatusDto;
};

export type DoclingImportBundlePublicDto = {
  id: string;
  packId: string;
  versionId: string;
  status: DoclingImportBundleStatus;
  isActive: boolean;
  adapterType: string;
  adapterVersion: string;
  doclingSchemaName: string | null;
  doclingSchemaVersion: string | null;
  validationReport: unknown;
  normalizationReport: unknown;
  warningCount: number;
  errorCount: number;
  lastErrorCode: string | null;
  lastErrorMessage: string | null;
  validatedAt: string | null;
  normalizedAt: string | null;
  reviewReadyAt: string | null;
  deactivatedAt: string | null;
  storageStatus: DoclingBundleStorageStatus;
  stagingReason: string | null;
  expiresAt: string | null;
  createdAt: string;
  updatedAt: string;
  canDelete: boolean;
  canRetry: boolean;
  immutableAfterSubmission: boolean;
  files: KnowledgePackFilePublicDto[];
  processingLogs: DoclingProcessingLogPublicDto[];
  normalizedDocument: NormalizedDocumentSummaryDto | null;
};

export function buildPackCapabilitiesDto(input: {
  hasNormalizedDocument: boolean;
}): PackCapabilitiesDto {
  return {
    normalizedDocument: {
      supported: true,
      status: input.hasNormalizedDocument ? "READY" : "NOT_READY",
    },
    retrieval: {
      supported: false,
      status: "NOT_BUILT",
      message: "Retrieval index는 후속 단계에서 구축됩니다.",
    },
    mcp: {
      supported: false,
      status: "NOT_BUILT",
      message: "MCP 노출은 후속 단계에서 지원됩니다.",
    },
  };
}
