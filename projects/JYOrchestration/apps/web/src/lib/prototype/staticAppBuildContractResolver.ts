import { resolveStaticPreviewArtifact } from "@/lib/prototype/staticPreviewArtifactResolver";

export type StaticAppBuildContractStatusV1 =
  | "ready"
  | "missing_package_json"
  | "missing_build_script"
  | "missing_entry"
  | "unsupported_runtime"
  | "needs_scaffold";

export type StaticAppProjectTypeV1 =
  | "vite_react_spa"
  | "static_html"
  | "next_static_export"
  | "unknown";

export type StaticAppBuildContractV1 = Readonly<{
  readonly status: StaticAppBuildContractStatusV1;
  readonly projectType: StaticAppProjectTypeV1;
  readonly packageJsonPath: string | null;
  readonly buildCommand: string | null;
  readonly outputDir: "dist" | "out" | "build" | null;
  readonly requiredFiles: readonly string[];
  readonly missingFiles: readonly string[];
  readonly canAutoScaffold: boolean;
  readonly userSafeMessage: string | null;
}>;

function normPaths(files: readonly string[]): string[] {
  return files.map((p) => String(p ?? "").replace(/\\/g, "/"));
}

function hasPath(files: string[], path: string): boolean {
  const p = path.replace(/\\/g, "/");
  return files.some((f) => f === p || f.endsWith(`/${p}`));
}

function detectProjectType(files: string[]): StaticAppProjectTypeV1 {
  if (hasPath(files, "next.config.js") || hasPath(files, "next.config.ts") || hasPath(files, "next.config.mjs")) {
    return "next_static_export";
  }
  if (hasPath(files, "index.html") && (hasPath(files, "src/main.tsx") || hasPath(files, "src/main.jsx"))) {
    return "vite_react_spa";
  }
  if (hasPath(files, "index.html")) {
    return "static_html";
  }
  return "unknown";
}

function readPackageJsonScripts(packageJson: unknown): Record<string, string> {
  if (!packageJson || typeof packageJson !== "object") return {};
  const scripts = (packageJson as Record<string, unknown>).scripts;
  if (!scripts || typeof scripts !== "object") return {};
  const out: Record<string, string> = {};
  for (const [k, v] of Object.entries(scripts)) {
    const s = String(v ?? "").trim();
    if (s) out[k] = s;
  }
  return out;
}

export function resolveStaticAppBuildContract(input: {
  readonly repositoryFiles: readonly string[];
  readonly packageJson?: unknown;
}): StaticAppBuildContractV1 {
  const files = normPaths(input.repositoryFiles);
  const artifact = resolveStaticPreviewArtifact({ repositoryFiles: files });
  if (artifact.ok && artifact.artifactPath) {
    return {
      status: "ready",
      projectType: detectProjectType(files),
      packageJsonPath: hasPath(files, "package.json") ? "package.json" : null,
      buildCommand: "build",
      outputDir: artifact.artifactPath,
      requiredFiles: [`${artifact.artifactPath}/index.html`],
      missingFiles: [],
      canAutoScaffold: false,
      userSafeMessage: null,
    };
  }

  const projectType = detectProjectType(files);

  if (projectType === "next_static_export") {
    const scripts = readPackageJsonScripts(input.packageJson);
    const hasExport = Object.values(scripts).some((s) => /next export|output:\s*['"]export/i.test(s));
    if (!hasExport) {
      return {
        status: "unsupported_runtime",
        projectType,
        packageJsonPath: hasPath(files, "package.json") ? "package.json" : null,
        buildCommand: null,
        outputDir: null,
        requiredFiles: ["out/index.html"],
        missingFiles: ["out/index.html"],
        canAutoScaffold: false,
        userSafeMessage:
          "현재 프로젝트는 GitHub Pages 정적 Preview로 실행할 수 없습니다.\n정적 빌드 설정 또는 외부 Preview URL이 필요합니다.",
      };
    }
  }

  if (projectType === "vite_react_spa") {
    const required = ["index.html", "package.json", "vite.config.ts", "tsconfig.json"] as const;
    const missing: string[] = [];
    if (!hasPath(files, "index.html")) missing.push("index.html");
    if (!hasPath(files, "src/main.tsx") && !hasPath(files, "src/main.jsx")) {
      missing.push("src/main.tsx");
    }
    if (!hasPath(files, "src/App.tsx") && !hasPath(files, "src/App.jsx")) {
      missing.push("src/App.tsx");
    }

    const hasPkg = hasPath(files, "package.json");
    const hasVite =
      hasPath(files, "vite.config.ts") ||
      hasPath(files, "vite.config.js") ||
      hasPath(files, "vite.config.mjs");
    const hasTs = hasPath(files, "tsconfig.json") || hasPath(files, "jsconfig.json");

    if (!hasPkg) {
      return {
        status: "needs_scaffold",
        projectType,
        packageJsonPath: null,
        buildCommand: "vite build",
        outputDir: "dist",
        requiredFiles: [...required],
        missingFiles: ["package.json", ...missing.filter((m) => m !== "package.json")],
        canAutoScaffold: true,
        userSafeMessage: "정적 Preview를 위한 빌드 설정을 준비하고 있습니다.",
      };
    }

    const scripts = readPackageJsonScripts(input.packageJson);
    if (!scripts.build?.trim()) {
      return {
        status: "missing_build_script",
        projectType,
        packageJsonPath: "package.json",
        buildCommand: null,
        outputDir: "dist",
        requiredFiles: [...required],
        missingFiles: ["scripts.build"],
        canAutoScaffold: true,
        userSafeMessage: "정적 Preview를 위한 build script를 준비하고 있습니다.",
      };
    }

    const stillMissing: string[] = [...missing];
    if (!hasVite) stillMissing.push("vite.config.ts");
    if (!hasTs) stillMissing.push("tsconfig.json");

    if (stillMissing.length > 0) {
      return {
        status: "needs_scaffold",
        projectType,
        packageJsonPath: "package.json",
        buildCommand: scripts.build,
        outputDir: "dist",
        requiredFiles: [...required],
        missingFiles: stillMissing,
        canAutoScaffold: true,
        userSafeMessage: "정적 Preview를 위한 빌드 설정을 준비하고 있습니다.",
      };
    }

    return {
      status: "ready",
      projectType,
      packageJsonPath: "package.json",
      buildCommand: scripts.build,
      outputDir: "dist",
      requiredFiles: ["dist/index.html"],
      missingFiles: [],
      canAutoScaffold: false,
      userSafeMessage: null,
    };
  }

  if (projectType === "static_html" && hasPath(files, "index.html")) {
    return {
      status: "ready",
      projectType,
      packageJsonPath: null,
      buildCommand: null,
      outputDir: null,
      requiredFiles: ["index.html"],
      missingFiles: [],
      canAutoScaffold: false,
      userSafeMessage: null,
    };
  }

  return {
    status: "unsupported_runtime",
    projectType,
    packageJsonPath: hasPath(files, "package.json") ? "package.json" : null,
    buildCommand: null,
    outputDir: null,
    requiredFiles: ["dist/index.html"],
    missingFiles: ["dist/index.html"],
    canAutoScaffold: false,
    userSafeMessage:
      "현재 프로젝트는 GitHub Pages 정적 Preview로 실행할 수 없습니다.\n정적 빌드 설정 또는 외부 Preview URL이 필요합니다.",
  };
}

export function isStaticBuildStepSatisfied(input: {
  readonly repositoryFiles: readonly string[];
  readonly packageJson?: unknown;
  readonly hasExternalOrLocalPreview?: boolean;
}): boolean {
  if (input.hasExternalOrLocalPreview) return true;
  const artifact = resolveStaticPreviewArtifact({ repositoryFiles: input.repositoryFiles });
  if (artifact.ok) return true;
  const contract = resolveStaticAppBuildContract({
    repositoryFiles: input.repositoryFiles,
    packageJson: input.packageJson,
  });
  return (
    contract.status === "ready" ||
    contract.status === "needs_scaffold" ||
    contract.status === "missing_build_script"
  );
}
