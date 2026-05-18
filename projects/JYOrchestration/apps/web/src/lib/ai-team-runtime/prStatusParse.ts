import type { TeamRuntimeSummary } from "./serialize";

export type OpenPrFromStatus = Readonly<{
  pullRequestNumber: number | null;
  pullRequestUrl: string | null;
}>;

/** Parse `open:<number>:<url>` from `TaskExecutionRun.prStatus` for SCM merge reuse. */
export function parseOpenPrStatus(
  prStatus: string | null | undefined
): OpenPrFromStatus | null {
  const parsed = parsePrStatusForTeamRuntime(prStatus);
  if (!parsed || parsed.pullRequestState !== "OPEN" || !parsed.pullRequestUrl) {
    return null;
  }
  return {
    pullRequestNumber: parsed.pullRequestNumber ?? null,
    pullRequestUrl: parsed.pullRequestUrl,
  };
}

/** Parse `TaskExecutionRun.prStatus` without new DB columns. */
export function parsePrStatusForTeamRuntime(
  prStatus: string | null | undefined
): TeamRuntimeSummary["pr"] | undefined {
  const raw = prStatus?.trim();
  if (!raw) return undefined;

  const openColon = raw.match(/^open:(\d+):(.+)$/i);
  if (openColon) {
    const n = parseInt(openColon[1]!, 10);
    return {
      pullRequestNumber: Number.isFinite(n) ? n : null,
      pullRequestUrl: openColon[2]!.trim() || null,
      pullRequestState: "OPEN",
      mergedAt: null,
    };
  }

  const lower = raw.toLowerCase();
  if (lower === "merged" || lower.startsWith("merged:")) {
    return { pullRequestState: "MERGED", pullRequestUrl: null, pullRequestNumber: null, mergedAt: null };
  }
  if (lower === "open" || lower.startsWith("pr_opened")) {
    return { pullRequestState: "OPEN", pullRequestUrl: null, pullRequestNumber: null, mergedAt: null };
  }

  return { pullRequestState: raw.slice(0, 40), pullRequestUrl: null, pullRequestNumber: null, mergedAt: null };
}
