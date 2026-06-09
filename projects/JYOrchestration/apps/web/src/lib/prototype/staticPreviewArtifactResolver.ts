export type StaticPreviewArtifactPathV1 = "dist" | "out" | "build";

const ARTIFACT_CANDIDATES: readonly StaticPreviewArtifactPathV1[] = ["dist", "out", "build"];

export function resolveStaticPreviewArtifact(input: {
  readonly repositoryFullName?: string | null;
  readonly branch?: string | null;
  readonly projectType?: string | null;
  readonly packageJson?: unknown;
  readonly repositoryFiles?: readonly string[];
}): {
  readonly ok: boolean;
  readonly artifactPath: StaticPreviewArtifactPathV1 | null;
  readonly reason: string | null;
  readonly userSafeMessage: string | null;
} {
  void input.repositoryFullName;
  void input.branch;
  void input.projectType;

  const files = (input.repositoryFiles ?? []).map((p) => String(p ?? "").replace(/\\/g, "/"));
  for (const candidate of ARTIFACT_CANDIDATES) {
    const indexPath = `${candidate}/index.html`;
    if (files.some((p) => p === indexPath || p.endsWith(`/${indexPath}`))) {
      return { ok: true, artifactPath: candidate, reason: null, userSafeMessage: null };
    }
  }

  const pkgHint = readPackageJsonBuildHint(input.packageJson);
  if (pkgHint && files.some((p) => p.startsWith(`${pkgHint}/`))) {
    return { ok: true, artifactPath: pkgHint, reason: null, userSafeMessage: null };
  }

  return {
    ok: false,
    artifactPath: null,
    reason: "static_artifact_missing",
    userSafeMessage:
      "GitHub Pages Preview에 사용할 정적 산출물을 찾지 못했습니다.\n정적 빌드 산출물(dist/out/build)이 integration branch에 필요합니다.",
  };
}

function readPackageJsonBuildHint(packageJson: unknown): StaticPreviewArtifactPathV1 | null {
  if (!packageJson || typeof packageJson !== "object") return null;
  const scripts = (packageJson as Record<string, unknown>).scripts;
  if (!scripts || typeof scripts !== "object") return null;
  const text = JSON.stringify(scripts).toLowerCase();
  if (text.includes("next export") || text.includes("out")) return "out";
  if (text.includes("vite") || text.includes("dist")) return "dist";
  if (text.includes("build")) return "build";
  return null;
}

export function mapArtifactTreePathsToGithubPagesPreview(input: {
  readonly projectId: string;
  readonly artifactPath: StaticPreviewArtifactPathV1;
  readonly treeEntries: readonly Readonly<{ readonly path: string; readonly sha: string; readonly type: string }>;
}): readonly Readonly<{ readonly path: string; readonly sha: string }>[] {
  const prefix = `${input.artifactPath}/`;
  const pagesRoot = `previews/${input.projectId.trim()}/`;
  const mapped: Array<{ path: string; sha: string }> = [];
  for (const entry of input.treeEntries) {
    if (entry.type !== "blob") continue;
    const path = String(entry.path ?? "").replace(/\\/g, "/");
    if (!path.startsWith(prefix)) continue;
    const rel = path.slice(prefix.length);
    if (!rel || rel.includes("..")) continue;
    mapped.push({ path: `${pagesRoot}${rel}`, sha: entry.sha });
  }
  return mapped;
}
