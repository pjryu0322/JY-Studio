import type { TeamRuntimeSummary } from "./serialize";

export type OpenPrFromStatus = Readonly<{
  pullRequestNumber: number | null;
  pullRequestUrl: string | null;
}>;

/** Extract PR number from GitHub-style `/pull/<n>` URL segments. */
export function extractPullRequestNumberFromUrl(url: string): number | null {
  const m = url.trim().match(/\/pull\/(\d+)(?:\/|$)/i);
  if (!m) return null;
  const n = parseInt(m[1]!, 10);
  return Number.isFinite(n) ? n : null;
}

function parseOpenPrFromRaw(raw: string): TeamRuntimeSummary["pr"] | undefined {
  const openNumberColon = raw.match(/^open:(\d+):(.+)$/i);
  if (openNumberColon) {
    const n = parseInt(openNumberColon[1]!, 10);
    const pullRequestUrl = openNumberColon[2]!.trim() || null;
    return {
      pullRequestNumber: Number.isFinite(n) ? n : null,
      pullRequestUrl,
      pullRequestState: "OPEN",
      mergedAt: null,
    };
  }

  const openUrlOnly = raw.match(/^open:(https?:\/\/.+)$/i);
  if (openUrlOnly) {
    const pullRequestUrl = openUrlOnly[1]!.trim() || null;
    return {
      pullRequestNumber: pullRequestUrl ? extractPullRequestNumberFromUrl(pullRequestUrl) : null,
      pullRequestUrl,
      pullRequestState: "OPEN",
      mergedAt: null,
    };
  }

  return undefined;
}

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

  const openParsed = parseOpenPrFromRaw(raw);
  if (openParsed) {
    return openParsed;
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
