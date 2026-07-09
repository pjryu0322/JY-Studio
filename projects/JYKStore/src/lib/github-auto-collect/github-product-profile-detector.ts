import type {
  GitHubFileClass,
  GitHubProductProfileDetection,
  GitHubProductType,
  GitHubRepositoryMetadata,
  GitHubTreeFileItem,
} from "./github-auto-collect-types";
import { classifyGitHubFilePath } from "./github-file-classifier";

export type GitHubProductProfileHint = {
  likelyTypes: string[];
  evidence: string[];
};

const PRIMARY_SCORE_THRESHOLD = 35;

function isDocumentationFileClass(fileClass: GitHubFileClass): boolean {
  return (
    fileClass === "DOCS" ||
    fileClass === "GETTING_STARTED" ||
    fileClass === "API_DOC"
  );
}

type RepoSignals = {
  paths: string[];
  corpus: string;
  hasPackageJson: boolean;
  hasPom: boolean;
  hasGradle: boolean;
  hasReadme: boolean;
  hasDocs: boolean;
  hasExamples: boolean;
  hasSrcIndex: boolean;
  hasLibIndex: boolean;
  hasJavaMain: boolean;
  hasApplicationConfig: boolean;
  hasOpenApiDoc: boolean;
  hasDockerfile: boolean;
  hasDockerCompose: boolean;
  hasHelm: boolean;
  hasK8s: boolean;
  hasTerraform: boolean;
  hasAnsible: boolean;
  hasGithubWorkflows: boolean;
  hasAppPage: boolean;
  hasPagesDir: boolean;
  hasEnvExample: boolean;
  hasBinPath: boolean;
  hasCmdPath: boolean;
  hasSrcTree: boolean;
  hasPackageManifest: boolean;
  hasFrontendDir: boolean;
  hasBackendDir: boolean;
};

function pathKeyword(corpus: string, keywords: string[]): boolean {
  const lower = corpus.toLowerCase();
  return keywords.some((kw) => lower.includes(kw.toLowerCase()));
}

function collectSignals(
  files: GitHubTreeFileItem[],
  metadata?: Pick<GitHubRepositoryMetadata, "language" | "description" | "repo" | "fullName">,
): RepoSignals {
  const blobs = files.filter((f) => f.type === "blob");
  const paths = blobs.map((f) => f.path);
  const pathSet = new Set(paths);

  const desc = metadata?.description ?? "";
  const repo = metadata?.repo ?? "";
  const fullName = metadata?.fullName ?? "";
  const language = metadata?.language ?? "";
  const corpus = [paths.join("\n"), desc, repo, fullName, language].join("\n");

  const hasPackageJson = pathSet.has("package.json");
  const hasPom = pathSet.has("pom.xml");
  const hasGradle = pathSet.has("build.gradle") || pathSet.has("build.gradle.kts");
  const hasReadme = paths.some((p) => /^readme/i.test(p.split("/").pop() ?? ""));
  const hasDocs = blobs.some((f) => isDocumentationFileClass(classifyGitHubFilePath(f.path)));
  const hasExamples = blobs.some((f) => classifyGitHubFilePath(f.path) === "EXAMPLE");
  const hasSrcIndex = paths.some(
    (p) => p === "src/index.ts" || p === "src/index.js" || /\/src\/index\.(ts|js)$/i.test(p),
  );
  const hasLibIndex = paths.some((p) => /^lib\/index\.(ts|js)$/i.test(p));
  const hasJavaMain = paths.some((p) => /src\/main\/java\//i.test(p));
  const hasApplicationConfig = paths.some((p) =>
    /^application\.(yml|yaml|properties)$/i.test(p.split("/").pop() ?? ""),
  );
  const hasOpenApiDoc = blobs.some((f) => {
    const fc = classifyGitHubFilePath(f.path);
    return fc === "API_DOC" || /openapi|swagger/i.test(f.path);
  });
  const hasDockerfile = paths.some((p) => p.toLowerCase() === "dockerfile");
  const hasDockerCompose = pathSet.has("docker-compose.yml");
  const hasHelm = paths.some(
    (p) => /^helm\//i.test(p) || /^charts\//i.test(p) || /\/charts\//i.test(p),
  );
  const hasK8s = paths.some((p) => /^k8s\//i.test(p) || /kubernetes/i.test(p));
  const hasTerraform = paths.some((p) => /^terraform\//i.test(p) || p.endsWith(".tf"));
  const hasAnsible = paths.some((p) => /^ansible\//i.test(p));
  const hasGithubWorkflows = paths.some((p) => /^\.github\/workflows\//i.test(p));
  const hasAppPage = pathSet.has("app/page.tsx") || pathSet.has("app/page.jsx");
  const hasPagesDir = paths.some((p) => /^pages\//i.test(p));
  const hasEnvExample = paths.some((p) =>
    [".env.example", ".env.sample"].includes(p.split("/").pop()?.toLowerCase() ?? ""),
  );
  const hasBinPath = paths.some((p) => /^bin\//i.test(p));
  const hasCmdPath = paths.some((p) => /^cmd\//i.test(p));
  const hasSrcTree = paths.some((p) => /^src\//i.test(p));
  const hasPackageManifest =
    hasPackageJson ||
    hasPom ||
    hasGradle ||
    pathSet.has("pyproject.toml") ||
    pathSet.has("go.mod") ||
    pathSet.has("composer.json");
  const hasFrontendDir = paths.some((p) => /^frontend\//i.test(p));
  const hasBackendDir = paths.some((p) => /^backend\//i.test(p));

  return {
    paths,
    corpus,
    hasPackageJson,
    hasPom,
    hasGradle,
    hasReadme,
    hasDocs,
    hasExamples,
    hasSrcIndex,
    hasLibIndex,
    hasJavaMain,
    hasApplicationConfig,
    hasOpenApiDoc,
    hasDockerfile,
    hasDockerCompose,
    hasHelm,
    hasK8s,
    hasTerraform,
    hasAnsible,
    hasGithubWorkflows,
    hasAppPage,
    hasPagesDir,
    hasEnvExample,
    hasBinPath,
    hasCmdPath,
    hasSrcTree,
    hasPackageManifest,
    hasFrontendDir,
    hasBackendDir,
  };
}

function addEvidence(evidence: string[], item: string) {
  if (!evidence.includes(item)) evidence.push(item);
}

function scoreType(
  type: GitHubProductType,
  score: number,
  evidence: string[],
): { type: GitHubProductType; score: number; evidence: string[] } {
  return { type, score, evidence: [...evidence] };
}

function addFrontendKeywordEvidence(corpus: string, evidence: string[]) {
  const rules: Array<[string, string]> = [
    ["ui", "keyword:frontend"],
    ["component", "keyword:component"],
    ["grid", "keyword:grid"],
    ["calendar", "keyword:calendar"],
    ["editor", "keyword:editor"],
    ["tree", "keyword:tree"],
    ["date-picker", "keyword:date-picker"],
    ["react", "keyword:react"],
    ["vue", "keyword:vue"],
    ["svelte", "keyword:svelte"],
    ["angular", "keyword:angular"],
  ];
  const lower = corpus.toLowerCase();
  for (const [kw, label] of rules) {
    if (lower.includes(kw)) addEvidence(evidence, label);
  }
}

function scoreCandidates(signals: RepoSignals): Array<{
  type: GitHubProductType;
  score: number;
  evidence: string[];
}> {
  const candidates: Array<{ type: GitHubProductType; score: number; evidence: string[] }> = [];

  {
    const evidence: string[] = [];
    let score = 0;
    const chartKw = pathKeyword(signals.corpus, ["chart", "graph", "visualization", "tui.chart"]);
    if (chartKw) {
      score += 35;
      addEvidence(evidence, "keyword:chart");
    }
    if (signals.hasPackageJson) {
      score += 15;
      addEvidence(evidence, "package.json");
    }
    if (signals.hasExamples) {
      score += 15;
      addEvidence(evidence, "examples/**");
    }
    if (signals.hasDocs) {
      score += 10;
      addEvidence(evidence, "docs/**");
    }
    candidates.push(scoreType("CHART_COMPONENT", score, evidence));
  }

  {
    const evidence: string[] = [];
    let score = 0;
    if (signals.hasPackageJson) {
      score += 20;
      addEvidence(evidence, "package.json");
    }
    if (signals.hasSrcIndex) {
      score += 15;
      addEvidence(evidence, "src/index.ts");
    }
    if (signals.hasExamples) {
      score += 15;
      addEvidence(evidence, "examples/**");
    }
    if (signals.hasDocs) {
      score += 10;
      addEvidence(evidence, "docs/**");
    }
    if (
      pathKeyword(signals.corpus, [
        "ui",
        "component",
        "grid",
        "calendar",
        "editor",
        "tree",
        "date-picker",
        "react",
        "vue",
        "svelte",
        "angular",
      ])
    ) {
      score += 20;
      addFrontendKeywordEvidence(signals.corpus, evidence);
    }
    if (pathKeyword(signals.corpus, ["packages/", "wrapper"])) {
      score += 10;
      addEvidence(evidence, "React/Vue wrapper path");
    }
    candidates.push(scoreType("FRONTEND_COMPONENT", score, evidence));
  }

  {
    const evidence: string[] = [];
    let score = 0;
    if (signals.hasPom) {
      score += 25;
      addEvidence(evidence, "pom.xml");
    }
    if (signals.hasGradle) {
      score += 25;
      addEvidence(evidence, "build.gradle");
    }
    if (signals.hasJavaMain) {
      score += 25;
      addEvidence(evidence, "src/main/java/**");
    }
    if (signals.hasApplicationConfig) {
      score += 10;
      addEvidence(evidence, "application.yml");
    }
    if (signals.hasOpenApiDoc) {
      score += 10;
      addEvidence(evidence, "swagger/openapi");
    }
    if (
      pathKeyword(signals.corpus, ["framework", "backend", "spring", "egovframe", "egov"])
    ) {
      score += 20;
      addEvidence(evidence, "keyword:framework");
    }
    candidates.push(scoreType("BACKEND_FRAMEWORK", score, evidence));
  }

  {
    const evidence: string[] = [];
    let score = 0;
    if (pathKeyword(signals.corpus, ["template", "starter", "sample app", "sample-app"])) {
      score += 25;
      addEvidence(evidence, "keyword:template");
    }
    if (signals.hasAppPage) {
      score += 15;
      addEvidence(evidence, "app/page.tsx");
    }
    if (signals.hasPagesDir) {
      score += 15;
      addEvidence(evidence, "pages/**");
    }
    if (signals.hasEnvExample) {
      score += 10;
      addEvidence(evidence, ".env.example");
    }
    if (signals.hasDockerCompose) {
      score += 10;
      addEvidence(evidence, "docker-compose.yml");
    }
    if (signals.hasFrontendDir || signals.hasBackendDir) {
      score += 20;
      addEvidence(evidence, "frontend/backend directory");
    }
    if (signals.hasReadme) {
      score += 10;
      addEvidence(evidence, "README.md");
    }
    if (signals.hasPackageJson && (signals.hasAppPage || signals.hasJavaMain)) {
      score += 10;
    }
    candidates.push(scoreType("TEMPLATE_APP", score, evidence));
  }

  {
    const evidence: string[] = [];
    let score = 0;
    if (signals.hasPackageManifest) {
      score += 25;
      addEvidence(evidence, "package manifest");
    }
    if (signals.hasSrcIndex || signals.hasLibIndex) {
      score += 15;
      addEvidence(evidence, signals.hasLibIndex ? "lib/index.ts" : "src/index.ts");
    }
    if (signals.hasExamples) {
      score += 10;
      addEvidence(evidence, "examples/**");
    }
    if (pathKeyword(signals.corpus, ["sdk", "client", "api", "browser-sdk"])) {
      score += 25;
      addEvidence(evidence, "keyword:sdk");
    }
    if (signals.hasDocs) {
      score += 10;
      addEvidence(evidence, "docs/api/reference");
    }
    candidates.push(scoreType("SDK_LIBRARY", score, evidence));
  }

  {
    const evidence: string[] = [];
    let score = 0;
    if (signals.hasBinPath) {
      score += 20;
      addEvidence(evidence, "bin/**");
    }
    if (signals.hasCmdPath) {
      score += 20;
      addEvidence(evidence, "cmd/**");
    }
    if (pathKeyword(signals.corpus, ["cli", "command line", "command-line"])) {
      score += 25;
      addEvidence(evidence, "keyword:cli");
    }
    if (signals.hasPackageJson) {
      score += 10;
      addEvidence(evidence, "package.json");
    }
    if (signals.hasReadme) {
      score += 10;
      addEvidence(evidence, "README.md");
    }
    candidates.push(scoreType("CLI_TOOL", score, evidence));
  }

  {
    const evidence: string[] = [];
    let score = 0;
    if (signals.hasDockerfile) {
      score += 15;
      addEvidence(evidence, "Dockerfile");
    }
    if (signals.hasDockerCompose) {
      score += 15;
      addEvidence(evidence, "docker-compose.yml");
    }
    if (signals.hasHelm) {
      score += 25;
      addEvidence(evidence, "helm/**");
    }
    if (signals.hasK8s) {
      score += 25;
      addEvidence(evidence, "k8s/**");
    }
    if (signals.hasTerraform) {
      score += 25;
      addEvidence(evidence, "terraform/**");
    }
    if (signals.hasAnsible) {
      score += 20;
      addEvidence(evidence, "ansible/**");
    }
    if (signals.hasGithubWorkflows) {
      score += 10;
      addEvidence(evidence, ".github/workflows/**");
    }
    candidates.push(scoreType("INFRA_TOOL", score, evidence));
  }

  {
    const evidence: string[] = [];
    let score = 0;
    if (signals.hasReadme) {
      score += 20;
      addEvidence(evidence, "README.md");
    }
    if (signals.hasDocs) {
      score += 30;
      addEvidence(evidence, "docs/**");
    }
    if (!signals.hasPackageManifest) {
      score += 10;
      addEvidence(evidence, "no package manifest");
    }
    if (!signals.hasSrcTree && !signals.hasJavaMain) {
      score += 10;
      addEvidence(evidence, "no src tree");
    }
    candidates.push(scoreType("DOCUMENTATION_ONLY", score, evidence));
  }

  return candidates.filter((c) => c.score > 0);
}

export function detectGitHubProductProfile(params: {
  files: GitHubTreeFileItem[];
  metadata?: Pick<GitHubRepositoryMetadata, "language" | "description" | "repo" | "fullName">;
  classificationSummary?: Partial<Record<GitHubFileClass, number>>;
}): GitHubProductProfileDetection {
  const signals = collectSignals(params.files, params.metadata);
  const raw = scoreCandidates(signals).sort((a, b) => b.score - a.score);

  const warnings: string[] = [];
  let primaryType: GitHubProductType = "UNKNOWN";
  let topScore = 0;

  if (raw.length > 0) {
    const chart = raw.find((c) => c.type === "CHART_COMPONENT");
    const frontend = raw.find((c) => c.type === "FRONTEND_COMPONENT");
    if (
      chart &&
      frontend &&
      chart.score >= frontend.score &&
      chart.score >= PRIMARY_SCORE_THRESHOLD &&
      pathKeyword(signals.corpus, ["chart", "graph", "visualization"])
    ) {
      primaryType = "CHART_COMPONENT";
      topScore = chart.score;
    } else {
      primaryType = raw[0]!.type;
      topScore = raw[0]!.score;
    }
  }

  if (topScore < PRIMARY_SCORE_THRESHOLD) {
    primaryType = "UNKNOWN";
    warnings.push("제품 유형 판별 근거가 부족합니다.");
  }

  if (raw.length >= 2 && raw[0]!.score - raw[1]!.score < 10) {
    warnings.push("제품 유형 후보 간 점수 차이가 작습니다.");
  }

  const candidateTypes = raw.map((c) => ({
    type: c.type,
    score: c.score,
    confidence: Math.min(1, c.score / 100),
    evidence: c.evidence,
  }));

  const primaryCandidate =
    candidateTypes.find((c) => c.type === primaryType) ?? candidateTypes[0];
  let confidence = primaryCandidate ? Math.min(1, primaryCandidate.score / 100) : 0;
  if (raw.length >= 2 && raw[0]!.score - raw[1]!.score >= 20) {
    confidence = Math.min(1, confidence + 0.1);
  }

  const evidence = primaryCandidate?.evidence ?? [];

  return {
    primaryType,
    candidateTypes,
    confidence,
    evidence,
    warnings,
  };
}

export function buildProductProfileHint(
  files: GitHubTreeFileItem[],
  metadata?: Pick<GitHubRepositoryMetadata, "language" | "description" | "repo" | "fullName">,
): GitHubProductProfileHint {
  const blobs = files.filter((f) => f.type === "blob");
  const paths = new Set(blobs.map((f) => f.path));
  const evidence: string[] = [];
  const likelyTypes: string[] = [];

  const hasPackageJson = paths.has("package.json");
  const hasPom = paths.has("pom.xml");
  const hasGradle = paths.has("build.gradle") || paths.has("build.gradle.kts");
  const hasReadme = [...paths].some((p) => /^readme/i.test(p.split("/").pop() ?? ""));
  const hasDocs = blobs.some((f) => isDocumentationFileClass(classifyGitHubFilePath(f.path)));
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

  const detection = detectGitHubProductProfile({ files, metadata });
  if (detection.primaryType !== "UNKNOWN") {
    likelyTypes.push(detection.primaryType);
  } else if (detection.candidateTypes[0]) {
    likelyTypes.push(detection.candidateTypes[0].type);
  }

  if (hasPackageJson && (hasSrcIndex || hasExamples) && !likelyTypes.length) {
    likelyTypes.push("SDK_LIBRARY", "FRONTEND_COMPONENT");
  } else if ((hasPom || hasGradle) && hasJavaMain && !likelyTypes.length) {
    likelyTypes.push("BACKEND_FRAMEWORK");
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
