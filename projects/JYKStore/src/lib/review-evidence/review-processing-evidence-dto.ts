export type CapabilityState = {
  supported: boolean;
  status: string;
  reason: string | null;
};

export type ImportProcessingEvidenceDto = {
  packageMode: "LEGACY_BUILDER" | "DISTRIBUTION_ZIP" | "EXTERNAL_IMPORT";

  generator: {
    name: string;
    version: string | null;
  } | null;

  adapter: {
    type: string;
    version: string;
  } | null;

  schema: {
    name: string;
    version: string | null;
  } | null;

  files: Array<{
    id: string;
    role: string;
    roleLabel: string;
    originalFileName: string;
    mimeType: string;
    fileSize: number;
    checksumSha256: string;
    downloadable: boolean;
  }>;

  validation: {
    status: "PASS" | "WARNING" | "BLOCKED" | "NOT_AVAILABLE";
    warningCount: number;
    errorCount: number;
    originMatchSummary: string | null;
    /** Soft markdown auxiliary status for Admin evidence. */
    markdownStatusLabel: string | null;
    /** @deprecated Legacy similarity fields retained for old report readers. */
    validatorVersion: string | null;
    markdownCoverage: number | null;
    jaccard: number | null;
    samplePassCount: number | null;
    issues: Array<{
      code: string;
      severity: "INFO" | "WARNING" | "ERROR";
      message: string;
    }>;
  };

  normalization: {
    supported: boolean;
    status: string;
    normalizedDocumentId: string | null;
    fingerprint: string | null;
    fingerprintVersion: string | null;
    language: string | null;
    /** PROVIDER when set by pack language; never auto-detection confidence. */
    languageSource: string | null;
    title: string | null;
    summary: {
      headingCount?: number;
      paragraphCount?: number;
      listCount?: number;
      tableCount?: number;
      figureCount?: number;
      readingOrderCount?: number;
    } | null;
  };

  integrity: {
    status: "PASS" | "WARNING" | "BLOCKED" | "NOT_CHECKED" | "UNKNOWN";
    messages: string[];
  };

  capabilities: {
    download: CapabilityState;
    normalizedDocument: CapabilityState;
    retrieval: CapabilityState;
    context: CapabilityState;
    export: CapabilityState;
    mcp: CapabilityState;
  };

  processingLogs: Array<{
    id: string;
    stage: string;
    status: string;
    message: string | null;
    startedAt: string;
    completedAt: string | null;
  }>;

  /** Truncated technical IDs for advanced panel. */
  technicalIds: {
    bundleId: string | null;
    normalizedDocumentId: string | null;
  };
};
