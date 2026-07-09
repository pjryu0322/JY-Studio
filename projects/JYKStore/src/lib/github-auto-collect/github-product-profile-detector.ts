import type { GitHubRepositoryMetadata, GitHubTreeFileItem } from "./github-auto-collect-types";
import { classifyGitHubFilePath } from "./github-file-classifier";

export type GitHubProductProfileHint = {
  likelyTypes: string[];
  evidence: string[];
};

export function buildProductProfileHint(
  files: GitHubTreeFileItem[],
  metadata?: Pick<GitHubRepositoryMetadata, "language">,
): GitHubProductProfileHint {
  const blobs = files.filter((f) => f.type === "blob");
  const paths = new Set(blobs.map((f) => f.path));
  const evidence: string[] = [];
  const likelyTypes: string[] = [];

  const hasPackageJson = paths.has("package.json");
  const hasPom = paths.has("pom.xml");
  const hasGradle = paths.has("build.gradle") || paths.has("build.gradle.kts");
  const hasReadme = [...paths].some((p) => /^readme/i.test(p.split("/").pop() ?? ""));
  const hasDocs = blobs.some((f) => classifyGitHubFilePath(f.path) === "DOCS");
  const hasExamples = blobs.some((f) => classifyGitHubFilePath(f.path) === "EXAMPLE");
  const hasSrcIndex = [...paths].some(
    (p) => p === "src/index.ts" || p === "src/index.js" || /\/src\/index\.(ts|js)$/.test(p),
  );
  const hasJavaMain = [...paths].some((p) => /src\/main\/java\//i.test(p));

  if (hasPackageJson) evidence.push("package.json");
  if (hasPom) evidence.push("pom.xml");
  if (hasGradle) evidence.push("build.gradle");
  if (hasReadme) evidence.push("README.md");
  if (hasDocs) evidence.push("docs/**");
  if (hasExamples) evidence.push("examples/**");
  if (hasSrcIndex) evidence.push("src/index.ts");
  if (hasJavaMain) evidence.push("src/main/java/**");
  if (metadata?.language) evidence.push(`language:${metadata.language}`);

  if (hasPackageJson && (hasSrcIndex || hasExamples)) {
    likelyTypes.push("SDK_LIBRARY", "FRONTEND_COMPONENT");
  } else if (hasPom || hasGradle) {
    if (hasJavaMain) {
      likelyTypes.push("BACKEND_FRAMEWORK");
    } else {
      likelyTypes.push("BACKEND_FRAMEWORK");
    }
  }

  if (hasReadme && !hasPackageJson && !hasPom && !hasGradle && !hasSrcIndex) {
    likelyTypes.push("DOCUMENTATION_ONLY");
  }

  if (likelyTypes.length === 0 && hasReadme) {
    likelyTypes.push("DOCUMENTATION_ONLY");
  }

  return {
    likelyTypes: [...new Set(likelyTypes)],
    evidence: [...new Set(evidence)],
  };
}
