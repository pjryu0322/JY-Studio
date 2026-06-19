/**
 * Git Repository 저장소명 → PostgreSQL schema-safe 프로젝트 데이터 저장소 명.
 */

export type ProjectDataStoreNaming = Readonly<{
  readonly repositoryName: string;
  readonly normalizedBaseName: string;
  readonly implementationSchemaName: string;
  readonly reviewSchemaName: string;
  readonly productionSchemaName?: string;
}>;

export function normalizeRepositoryNameForDb(input: string, projectIdSuffix?: string | null): string {
  const base = String(input ?? "")
    .trim()
    .toLowerCase()
    .replace(/[^a-z0-9_\-\s]/g, "")
    .replace(/[\s\-]+/g, "_")
    .replace(/_+/g, "_")
    .replace(/^_+|_+$/g, "");

  let safe = /^[0-9]/.test(base) ? `p_${base}` : base;
  if (!safe) safe = "project_data";
  safe = safe.slice(0, 48);
  const suffix = String(projectIdSuffix ?? "")
    .trim()
    .toLowerCase()
    .replace(/[^a-z0-9]/g, "")
    .slice(0, 8);
  if (suffix && safe.length + suffix.length + 1 <= 48) {
    safe = `${safe}_${suffix}`;
  }
  return safe;
}

export function extractRepositoryBaseNameFromGitRepoName(gitRepoName: string | null | undefined): string {
  const raw = String(gitRepoName ?? "").trim();
  if (!raw) return "";
  const slash = raw.lastIndexOf("/");
  return slash >= 0 ? raw.slice(slash + 1) : raw;
}

/** GitHub `owner/repo` → PostgreSQL database name default (repo segment, schema-safe). */
export function resolveDefaultPostgresDatabaseNameFromGitRepo(
  gitRepoName: string | null | undefined,
  projectId?: string | null,
): string {
  const repo = extractRepositoryBaseNameFromGitRepoName(gitRepoName);
  if (!repo) return "";
  return normalizeRepositoryNameForDb(repo, projectId ?? null);
}

export function buildProjectDataStoreNaming(input: Readonly<{
  readonly repositoryName: string;
  readonly projectId?: string | null;
  /** When true, append projectId suffix to store name (collision avoidance). */
  readonly includeProjectIdSuffix?: boolean;
}>): ProjectDataStoreNaming {
  const repositoryName = String(input.repositoryName ?? "").trim() || "project";
  const normalizedBaseName = normalizeRepositoryNameForDb(
    repositoryName,
    input.includeProjectIdSuffix ? (input.projectId ?? null) : null,
  );
  return {
    repositoryName,
    normalizedBaseName,
    implementationSchemaName: `${normalizedBaseName}_impl_sample`,
    reviewSchemaName: `${normalizedBaseName}_review_test`,
  };
}
