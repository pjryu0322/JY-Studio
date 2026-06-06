import { githubRestApiBase, resolveGithubOwnerRepoStrict } from "@/lib/integration/githubRestCommon";
import { encodeGithubRefBranchPath } from "@/lib/prototype/githubIntegrationBranchService";

export type IntegrationCheckResultV1 = Readonly<{
  readonly status: "passed" | "failed" | "not_run";
  readonly checks: readonly {
    readonly name: string;
    readonly status: "passed" | "failed" | "skipped";
    readonly summary?: string;
  }[];
}>;

export async function runIntegrationBranchChecks(input: {
  readonly repoUrl: string;
  readonly integrationBranch: string;
  readonly githubToken: string;
}): Promise<IntegrationCheckResultV1> {
  const token = input.githubToken.trim();
  const branch = input.integrationBranch.trim();
  if (!token || !branch) {
    return {
      status: "not_run",
      checks: [{ name: "branch_exists", status: "skipped", summary: "token or branch missing" }],
    };
  }

  const parsed = resolveGithubOwnerRepoStrict(input.repoUrl);
  if (!parsed) {
    return {
      status: "failed",
      checks: [{ name: "branch_exists", status: "failed", summary: "invalid repo url" }],
    };
  }

  const refPath = encodeGithubRefBranchPath(branch);
  const api = githubRestApiBase();
  const url = `${api}/repos/${encodeURIComponent(parsed.owner)}/${encodeURIComponent(parsed.repo)}/git/ref/heads/${refPath}`;
  try {
    const res = await fetch(url, {
      headers: {
        Accept: "application/vnd.github+json",
        Authorization: `Bearer ${token}`,
        "User-Agent": "JYOrchestration/integration-check",
        "X-GitHub-Api-Version": "2022-11-28",
      },
    });
    if (!res.ok) {
      return {
        status: "failed",
        checks: [
          {
            name: "branch_exists",
            status: "failed",
            summary: `integration branch ref HTTP ${res.status}`,
          },
        ],
      };
    }
    return {
      status: "passed",
      checks: [{ name: "branch_exists", status: "passed", summary: "integration branch ref ok" }],
    };
  } catch (error) {
    const summary = error instanceof Error ? error.message : String(error);
    return {
      status: "failed",
      checks: [{ name: "branch_exists", status: "failed", summary }],
    };
  }
}
