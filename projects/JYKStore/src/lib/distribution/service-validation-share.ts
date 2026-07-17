import { createHash } from "node:crypto";

export type ShareableValidationRun = {
  status: string;
  query: string | null;
  pipelineRunId: string | null;
  indexGenerationId: string | null;
  fingerprint: string | null;
  normalizedDocumentId: string | null;
  resultCount: number | null;
  resultFingerprint?: string | null;
  invalidatedAt?: Date | null;
};

export type ShareableResultItem = {
  rank: number;
  chunkId: string;
  sourceDocumentId: string;
  pageStart: number | null;
  pageEnd: number | null;
};

export type ShareBinding = {
  fingerprint?: string | null;
  indexGenerationId?: string | null;
  normalizedDocumentId?: string | null;
  pipelineRunId?: string | null;
};

export function normalizeValidationQuery(query: string | null | undefined): string {
  return (query ?? "").replace(/\s+/g, " ").trim();
}

export function computeResultFingerprint(input: {
  query: string | null | undefined;
  indexGenerationId: string | null | undefined;
  items: ShareableResultItem[];
}): string {
  const normalizedQuery = normalizeValidationQuery(input.query);
  const rows = [...input.items]
    .sort((a, b) => a.rank - b.rank)
    .map(
      (item) =>
        `${item.rank}:${item.chunkId}:${item.sourceDocumentId}:${item.pageStart ?? ""}:${item.pageEnd ?? ""}`,
    )
    .join("|");
  const payload = [
    normalizedQuery,
    input.indexGenerationId ?? "",
    rows,
  ].join("\n");
  return createHash("sha256").update(payload, "utf8").digest("hex");
}

export function compareShareableResultItems(
  left: ShareableResultItem[],
  right: ShareableResultItem[],
): boolean {
  if (left.length !== right.length) return false;
  if (left.length === 0) return false;
  const a = [...left].sort((x, y) => x.rank - y.rank);
  const b = [...right].sort((x, y) => x.rank - y.rank);
  for (let i = 0; i < a.length; i++) {
    const x = a[i]!;
    const y = b[i]!;
    if (
      x.rank !== y.rank ||
      x.chunkId !== y.chunkId ||
      x.sourceDocumentId !== y.sourceDocumentId ||
      x.pageStart !== y.pageStart ||
      x.pageEnd !== y.pageEnd
    ) {
      return false;
    }
  }
  return true;
}

function isCurrentAgainstBinding(
  run: ShareableValidationRun,
  binding: ShareBinding | null | undefined,
): boolean {
  if (run.invalidatedAt) return false;
  if (run.status !== "PASS") return false;
  if (
    binding?.fingerprint &&
    run.fingerprint &&
    run.fingerprint !== binding.fingerprint
  ) {
    return false;
  }
  if (
    binding?.indexGenerationId &&
    run.indexGenerationId &&
    run.indexGenerationId !== binding.indexGenerationId
  ) {
    return false;
  }
  return true;
}

/**
 * Shared API+MCP provider confirmation is allowed only when system runs
 * and retrieval snapshots are effectively identical.
 */
export function canShareProviderConfirmation(input: {
  apiRun: ShareableValidationRun | null | undefined;
  mcpRun: ShareableValidationRun | null | undefined;
  apiResults: ShareableResultItem[];
  mcpResults: ShareableResultItem[];
  binding?: ShareBinding | null;
}): boolean {
  const { apiRun, mcpRun, apiResults, mcpResults, binding } = input;
  if (!apiRun || !mcpRun) return false;
  if (apiRun.status !== "PASS" || mcpRun.status !== "PASS") return false;
  if (!isCurrentAgainstBinding(apiRun, binding) || !isCurrentAgainstBinding(mcpRun, binding)) {
    return false;
  }
  if (normalizeValidationQuery(apiRun.query) !== normalizeValidationQuery(mcpRun.query)) {
    return false;
  }
  if ((apiRun.pipelineRunId ?? "") !== (mcpRun.pipelineRunId ?? "")) return false;
  if ((apiRun.indexGenerationId ?? "") !== (mcpRun.indexGenerationId ?? "")) return false;
  if ((apiRun.fingerprint ?? "") !== (mcpRun.fingerprint ?? "")) return false;
  if ((apiRun.normalizedDocumentId ?? "") !== (mcpRun.normalizedDocumentId ?? "")) return false;
  if ((apiRun.resultCount ?? -1) !== (mcpRun.resultCount ?? -2)) return false;
  if (apiResults.length === 0 || mcpResults.length === 0) return false;
  if (apiResults.length !== mcpResults.length) return false;
  if (!compareShareableResultItems(apiResults, mcpResults)) return false;

  const apiFp =
    apiRun.resultFingerprint?.trim() ||
    computeResultFingerprint({
      query: apiRun.query,
      indexGenerationId: apiRun.indexGenerationId,
      items: apiResults,
    });
  const mcpFp =
    mcpRun.resultFingerprint?.trim() ||
    computeResultFingerprint({
      query: mcpRun.query,
      indexGenerationId: mcpRun.indexGenerationId,
      items: mcpResults,
    });
  return apiFp === mcpFp;
}
