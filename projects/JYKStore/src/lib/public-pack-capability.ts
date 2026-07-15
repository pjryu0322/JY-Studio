import type { PackStatus } from "@prisma/client";
import {
  canPubliclyDownloadLatestDistributionPack,
  isLatestVersionCatalogVisible,
  resolveLatestDistributionState,
  type LatestDistributionState,
  type LatestDistributionVersionInput,
} from "@/lib/distribution/latest-distribution-state";

export type PublicCapabilityStatus =
  | "READY"
  | "NOT_BUILT"
  | "DISABLED"
  | "FAILED"
  | "NOT_SUPPORTED";

export type PublicCapabilityState = {
  supported: boolean;
  status: PublicCapabilityStatus;
  reason: string | null;
};

export type PublicPackCapabilities = {
  catalog: PublicCapabilityState;
  download: PublicCapabilityState;
  normalizedDocument: PublicCapabilityState;
  context: PublicCapabilityState;
  retrieval: PublicCapabilityState;
  export: PublicCapabilityState;
  mcp: PublicCapabilityState;
};

export type PublicPackCapabilityInput = {
  packStatus: PackStatus | string;
  distributionState: LatestDistributionState;
  catalogPurpose?: "list" | "detail";
  normalizedDocumentReady: boolean;
  /** Reserved for future runtime index; currently unused (always false unless set). */
  runtimeIndexReady?: boolean;
  legacyKnowledgeChunkCount: number;
  exportFormats?: string[];
  mcpEnabled?: boolean;
};

function capability(
  status: PublicCapabilityStatus,
  reason: string | null = null,
): PublicCapabilityState {
  return {
    supported: status === "READY",
    status,
    reason,
  };
}

export function resolvePublicPackCapabilities(
  input: PublicPackCapabilityInput,
): PublicPackCapabilities {
  const purpose = input.catalogPurpose ?? "detail";
  const runtimeReady = Boolean(input.runtimeIndexReady);
  const legacyChunks = Math.max(0, input.legacyKnowledgeChunkCount);
  const hasRuntimeOrLegacy = runtimeReady || legacyChunks > 0;
  const mcpBridgeEnabled = input.mcpEnabled !== false;
  const exportFormats = input.exportFormats ?? [];

  const catalogReady =
    (input.packStatus === "PUBLISHED" || input.packStatus === "VERIFIED") &&
    isLatestVersionCatalogVisible(input.distributionState, purpose);

  const downloadReady = canPubliclyDownloadLatestDistributionPack(input.distributionState);

  let serviceEnded = false;
  if (input.distributionState.kind === "DISTRIBUTION" && input.distributionState.serviceEndsAt) {
    const rawEnd = input.distributionState.serviceEndsAt;
    const end = typeof rawEnd === "string" ? new Date(rawEnd) : rawEnd;
    serviceEnded = !Number.isNaN(end.getTime()) && end.getTime() <= Date.now();
  }

  const allowApi =
    input.distributionState.kind !== "DISTRIBUTION" ||
    input.distributionState.allowApi !== false;
  const allowMcp =
    input.distributionState.kind !== "DISTRIBUTION" ||
    input.distributionState.allowMcp !== false;

  const contextReady = hasRuntimeOrLegacy && allowApi && !serviceEnded;
  const retrievalReady = hasRuntimeOrLegacy && allowApi && !serviceEnded;
  const mcpReady =
    mcpBridgeEnabled &&
    allowMcp &&
    !serviceEnded &&
    (hasRuntimeOrLegacy);

  const exportReady =
    downloadReady || exportFormats.length > 0
      ? "READY"
      : ("NOT_BUILT" as PublicCapabilityStatus);

  return {
    catalog: catalogReady
      ? capability("READY")
      : capability("DISABLED", "카탈로그에 공개되지 않은 지식팩입니다."),
    download: downloadReady
      ? capability("READY")
      : serviceEnded
        ? capability("DISABLED", "서비스 종료일이 지나 다운로드할 수 없습니다.")
        : capability("NOT_BUILT", "공개 다운로드가 준비되지 않았습니다."),
    normalizedDocument: input.normalizedDocumentReady
      ? capability("READY")
      : capability("NOT_BUILT", "정규화 문서가 준비되지 않았습니다."),
    context: contextReady
      ? capability("READY")
      : !allowApi
        ? capability("DISABLED", "이 지식팩은 Retrieval API 제공이 허용되지 않았습니다.")
        : serviceEnded
          ? capability("DISABLED", "서비스 종료일이 지나 사용할 수 없습니다.")
          : capability(
              "NOT_BUILT",
              "Context API용 Runtime Index 또는 KnowledgeChunk가 준비되지 않았습니다.",
            ),
    retrieval: retrievalReady
      ? capability("READY")
      : !allowApi
        ? capability("DISABLED", "이 지식팩은 Retrieval API 제공이 허용되지 않았습니다.")
        : serviceEnded
          ? capability("DISABLED", "서비스 종료일이 지나 사용할 수 없습니다.")
          : capability(
              "NOT_BUILT",
              "Retrieval API용 Runtime Index 또는 KnowledgeChunk가 준비되지 않았습니다.",
            ),
    export:
      exportReady === "READY"
        ? capability("READY")
        : capability("NOT_BUILT", "내보낼 수 있는 형식이 없습니다."),
    mcp: mcpReady
      ? capability("READY")
      : !allowMcp
        ? capability("DISABLED", "이 지식팩은 MCP 제공이 허용되지 않았습니다.")
        : serviceEnded
          ? capability("DISABLED", "서비스 종료일이 지나 사용할 수 없습니다.")
          : capability("NOT_BUILT", "MCP 연동에 필요한 Context/Retrieval이 준비되지 않았습니다."),
  };
}

export function isPackApiIntegrationReady(capabilities: PublicPackCapabilities): boolean {
  return capabilities.context.status === "READY" || capabilities.retrieval.status === "READY";
}

export function buildPublicPackCapabilityInputFromVersion(input: {
  packStatus: PackStatus | string;
  version: LatestDistributionVersionInput & {
    _count?: { chunks?: number };
    doclingImportBundles?: Array<{
      isActive: boolean;
      normalizedDocuments?: Array<{ isActive: boolean }> | null;
    }> | null;
  } | null | undefined;
  catalogPurpose?: "list" | "detail";
  runtimeIndexReady?: boolean;
  mcpEnabled?: boolean;
}): PublicPackCapabilityInput {
  const distributionState = resolveLatestDistributionState(input.version);
  const chunkCount = input.version?._count?.chunks ?? 0;
  const normalizedDocumentReady = Boolean(
    input.version?.doclingImportBundles?.some(
      (bundle) =>
        bundle.isActive && bundle.normalizedDocuments?.some((doc) => doc.isActive),
    ),
  );

  return {
    packStatus: input.packStatus,
    distributionState,
    catalogPurpose: input.catalogPurpose,
    normalizedDocumentReady,
    runtimeIndexReady: input.runtimeIndexReady ?? false,
    legacyKnowledgeChunkCount: chunkCount,
    exportFormats: canPubliclyDownloadLatestDistributionPack(distributionState)
      ? ["package"]
      : [],
    mcpEnabled: input.mcpEnabled,
  };
}
