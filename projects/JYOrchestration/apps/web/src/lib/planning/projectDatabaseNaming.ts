import { extractRepositoryBaseNameFromGitRepoName, normalizeRepositoryNameForDb } from "@/lib/planning/projectDataStoreNaming";

/** Fixed schema names inside each project database (platform-managed). */
export const PLATFORM_PROJECT_IMPLEMENTATION_SCHEMA = "impl_sample" as const;
export const PLATFORM_PROJECT_REVIEW_SCHEMA = "review_test" as const;

function shortProjectIdToken(projectId: string): string {
  return String(projectId ?? "")
    .trim()
    .toLowerCase()
    .replace(/[^a-z0-9]/g, "")
    .slice(0, 8);
}

/**
 * Platform-managed project database name (user does not input this).
 * Prefers `p_{repo}_{id}` when repo is known, else `p_{id}`.
 */
export function buildProjectDatabaseName(input: Readonly<{
  readonly projectId: string;
  readonly gitRepoName?: string | null;
}>): string {
  const token = shortProjectIdToken(input.projectId);
  const repo = extractRepositoryBaseNameFromGitRepoName(input.gitRepoName);
  let base = token ? `p_${token}` : "p_project";
  if (repo) {
    const repoPart = normalizeRepositoryNameForDb(repo, null).slice(0, 24);
    if (repoPart && repoPart !== "project_data") {
      const candidate = `p_${repoPart}_${token}`.slice(0, 48);
      base = candidate;
    }
  }
  return base.replace(/[^a-z0-9_]/g, "_").slice(0, 48);
}
