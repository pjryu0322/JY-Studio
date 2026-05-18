import { findOpenPullRequestByHeadBranch } from "@/lib/service/githubOpenPullRequestByHeadService";
import { parseOpenPrStatus } from "./prStatusParse";

export type PrForScmMerge = Readonly<{
  pullRequestUrl: string;
  pullRequestNumber: number | null;
}>;

export function formatOpenPrStatusValue(pr: PrForScmMerge): string {
  return pr.pullRequestNumber != null
    ? `open:${pr.pullRequestNumber}:${pr.pullRequestUrl}`
    : `open:${pr.pullRequestUrl}`;
}

/** Reuse PR from run prStatus or GitHub head-branch lookup before creating a new PR. */
export async function resolvePrForScmMerge(input: Readonly<{
  execRunPrStatus: string | null | undefined;
  repoUrl: string;
  headBranch: string;
  githubAccessToken: string | null;
  projectId: string;
}>): Promise<PrForScmMerge | null> {
  const fromRun = parseOpenPrStatus(input.execRunPrStatus);
  if (fromRun?.pullRequestUrl) {
    return {
      pullRequestUrl: fromRun.pullRequestUrl,
      pullRequestNumber: fromRun.pullRequestNumber,
    };
  }

  const found = await findOpenPullRequestByHeadBranch({
    repoUrl: input.repoUrl,
    headBranch: input.headBranch,
    githubAccessToken: input.githubAccessToken,
    projectId: input.projectId,
  });
  if (found?.prUrl) {
    return {
      pullRequestUrl: found.prUrl,
      pullRequestNumber: found.prNumber,
    };
  }

  return null;
}
