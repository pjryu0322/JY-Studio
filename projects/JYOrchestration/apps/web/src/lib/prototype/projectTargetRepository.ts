import { parseGithubComOwnerRepoFromUrl } from "@/lib/integration/githubRestCommon";

export type ProjectTargetRepository = Readonly<{
  owner: string;
  repo: string;
  repoFullName: string;
  defaultBranch: string;
  cloneUrl?: string;
  webUrl?: string;
}>;

type RepoSource = Readonly<{
  readonly gitRepoName?: string | null;
  readonly gitRepoUrl?: string | null;
  readonly baseBranch?: string | null;
}>;

function parseOwnerRepoFromName(name: string): Readonly<{ owner: string; repo: string }> | null {
  const trimmed = String(name ?? "").trim();
  if (!trimmed) return null;
  const parts = trimmed.split("/").map((p) => p.trim()).filter(Boolean);
  if (parts.length < 2) return null;
  const owner = parts[0]!;
  let repo = parts[1]!;
  if (repo.endsWith(".git")) repo = repo.slice(0, -4);
  if (!owner || !repo) return null;
  return { owner, repo };
}

function readRepoSource(value: unknown): RepoSource | null {
  if (!value || typeof value !== "object") return null;
  const o = value as Record<string, unknown>;
  const gitRepoName =
    typeof o.gitRepoName === "string"
      ? o.gitRepoName
      : typeof o.repositoryName === "string"
        ? o.repositoryName
        : null;
  const gitRepoUrl =
    typeof o.gitRepoUrl === "string"
      ? o.gitRepoUrl
      : typeof o.repoUrl === "string"
        ? o.repoUrl
        : null;
  const baseBranch = typeof o.baseBranch === "string" ? o.baseBranch : null;
  if (!gitRepoName?.trim() && !gitRepoUrl?.trim()) return null;
  return { gitRepoName, gitRepoUrl, baseBranch };
}

function buildTargetRepository(
  owner: string,
  repo: string,
  defaultBranch: string,
  cloneUrl?: string,
): ProjectTargetRepository {
  const repoFullName = `${owner}/${repo}`;
  return {
    owner,
    repo,
    repoFullName,
    defaultBranch: defaultBranch.trim() || "main",
    ...(cloneUrl ? { cloneUrl } : { cloneUrl: `https://github.com/${repoFullName}.git` }),
    webUrl: `https://github.com/${repoFullName}`,
  };
}

export function resolveProjectTargetRepository(input: {
  readonly requirementsStateJson?: unknown;
  readonly projectSettings?: unknown;
  readonly envSettings?: unknown;
}): ProjectTargetRepository | null {
  const sources: readonly (unknown | undefined)[] = [
    input.envSettings,
    input.projectSettings,
    readRequirementsRepoSettings(input.requirementsStateJson),
  ];

  for (const source of sources) {
    const row = readRepoSource(source);
    if (!row) continue;
    const fromName = row.gitRepoName ? parseOwnerRepoFromName(row.gitRepoName) : null;
    const fromUrl = row.gitRepoUrl ? parseGithubComOwnerRepoFromUrl(row.gitRepoUrl) : null;
    const parsed = fromName ?? fromUrl;
    if (!parsed) continue;
    return buildTargetRepository(parsed.owner, parsed.repo, row.baseBranch ?? "main", row.gitRepoUrl?.trim() || undefined);
  }
  return null;
}

function readRequirementsRepoSettings(requirementsStateJson: unknown): RepoSource | null {
  if (!requirementsStateJson || typeof requirementsStateJson !== "object") return null;
  const root = requirementsStateJson as Record<string, unknown>;
  const direct = readRepoSource(root);
  if (direct) return direct;
  const nested = readRepoSource(root.executionSetup);
  if (nested) return nested;
  return readRepoSource(root.prototypeExecutionSetup);
}

export const CURSOR_BRIDGE_MISSING_TARGET_REPO_MESSAGE = [
  "대상 프로젝트 Git 저장소가 설정되지 않았습니다.",
  "",
  "실제 소스 생성을 진행하려면 환경설정에서 owner/repo 또는 repoUrl을 먼저 설정해야 합니다.",
].join("\n");

export const CURSOR_BRIDGE_MISSING_CONNECTION_MESSAGE = [
  "실제 Cursor 소스 생성 실행을 위해 Cursor Bridge/API 연결이 필요합니다.",
  "현재는 WIP 초안까지만 생성되었습니다.",
].join("\n");

export const CURSOR_BRIDGE_LOCAL_RUNNER_BLOCKED_MESSAGE = [
  "Local Runner를 사용하려면 실제 Cursor CLI 또는 Code Agent Runner 명령이 필요합니다.",
  "현재 설정만으로는 실제 소스 생성이 불가능합니다.",
].join("\n");

export function evaluateCursorBridgeSourceGenerationGate(input: {
  readonly targetRepository: ProjectTargetRepository | null;
  readonly bridgeAvailable: boolean;
  readonly bridgeReason?: string;
}): Readonly<{ readonly ok: true } | Readonly<{ readonly ok: false; readonly message: string }>> {
  if (!input.targetRepository) {
    return { ok: false, message: CURSOR_BRIDGE_MISSING_TARGET_REPO_MESSAGE };
  }
  if (!input.bridgeAvailable) {
    return {
      ok: false,
      message: [CURSOR_BRIDGE_MISSING_CONNECTION_MESSAGE, "", input.bridgeReason?.trim()].filter(Boolean).join("\n"),
    };
  }
  return { ok: true };
}
