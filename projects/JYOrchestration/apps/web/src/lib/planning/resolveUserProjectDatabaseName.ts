import {
  normalizeRepositoryNameForDb,
  resolveDefaultPostgresDatabaseNameFromGitRepo,
} from "@/lib/planning/projectDataStoreNaming";
import { buildProjectDatabaseName } from "@/lib/planning/projectDatabaseNaming";

/** PostgreSQL database name from user-facing display name (GitHub repo default). */
export function resolveUserProjectDatabaseName(input: Readonly<{
  readonly databaseDisplayName?: string | null;
  readonly projectId: string;
  readonly gitRepoName?: string | null;
}>): string {
  const display = String(input.databaseDisplayName ?? "").trim();
  if (display) {
    return normalizeRepositoryNameForDb(display, input.projectId).slice(0, 63);
  }
  const fromGit = resolveDefaultPostgresDatabaseNameFromGitRepo(input.gitRepoName, input.projectId);
  if (fromGit) return fromGit.slice(0, 63);
  return buildProjectDatabaseName({ projectId: input.projectId, gitRepoName: input.gitRepoName });
}
