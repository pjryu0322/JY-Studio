import type { GitHubFileClass } from "./github-auto-collect-types";

const PACKAGE_MANIFEST_NAMES = new Set([
  "package.json",
  "pom.xml",
  "build.gradle",
  "build.gradle.kts",
  "pyproject.toml",
  "go.mod",
  "Cargo.toml",
  "composer.json",
]);

const LOCK_FILE_NAMES = new Set([
  "package-lock.json",
  "yarn.lock",
  "pnpm-lock.yaml",
  "poetry.lock",
  "Gemfile.lock",
  "go.sum",
]);

const BINARY_EXTENSIONS = new Set([
  ".png",
  ".jpg",
  ".jpeg",
  ".gif",
  ".webp",
  ".ico",
  ".svg",
  ".zip",
  ".jar",
  ".war",
  ".pdf",
  ".woff",
  ".woff2",
  ".ttf",
  ".eot",
  ".mp4",
  ".mp3",
  ".exe",
  ".dll",
  ".so",
  ".dylib",
  ".bin",
  ".dat",
]);

const EXAMPLE_PREFIXES = [
  "examples",
  "example",
  "samples",
  "sample",
  "demo",
  "demos",
  "playground",
  "storybook",
  "stories",
];

const BUILD_ARTIFACT_PREFIXES = [
  "node_modules",
  ".next",
  ".nuxt",
  "out",
  "dist",
  "build",
  "target",
  "coverage",
];

function normalizePath(path: string): string {
  return path.replace(/\\/g, "/");
}

function basename(path: string): string {
  const parts = normalizePath(path).split("/");
  return parts[parts.length - 1] ?? path;
}

function pathSegments(path: string): string[] {
  return normalizePath(path).split("/").filter(Boolean);
}

function isUnderPrefix(path: string, prefix: string): boolean {
  const p = normalizePath(path);
  const pre = prefix.endsWith("/") ? prefix.slice(0, -1) : prefix;
  return p === pre || p.startsWith(`${pre}/`);
}

function isUnderAnyPrefix(path: string, prefixes: string[]): boolean {
  return prefixes.some((pre) => isUnderPrefix(path, pre));
}

function matchesSegmentKeyword(path: string, keywords: string[]): boolean {
  const lower = normalizePath(path).toLowerCase();
  return keywords.some((kw) => lower.includes(kw));
}

function isGettingStartedPath(norm: string): boolean {
  const lower = norm.toLowerCase();
  const base = basename(norm).toLowerCase();
  if (
    base.includes("getting-started") ||
    base === "quickstart.md" ||
    base === "installation.md" ||
    base === "start.md"
  ) {
    return true;
  }
  if (/\/getting-started|\/quickstart|\/installation/.test(lower)) {
    return true;
  }
  if (isUnderPrefix(norm, "guide") && (base === "start.md" || base.includes("start"))) {
    return true;
  }
  return matchesSegmentKeyword(norm, ["getting-started", "quickstart", "installation"]);
}

function isApiDocPath(norm: string): boolean {
  const lower = norm.toLowerCase();
  const base = basename(norm).toLowerCase();
  if (base === "api.md" || base === "reference.md" || base === "swagger.json") {
    return true;
  }
  if (base.includes("openapi")) {
    return true;
  }
  if (matchesSegmentKeyword(lower, ["openapi", "swagger"])) {
    return true;
  }
  if (/\/api(\/|$)/i.test(norm) || /\/reference(\/|$)/i.test(norm)) {
    return true;
  }
  return false;
}

function isDocTreePath(norm: string): boolean {
  return (
    isUnderPrefix(norm, "docs") ||
    isUnderPrefix(norm, "doc") ||
    isUnderPrefix(norm, "guide") ||
    isUnderPrefix(norm, "manual")
  );
}

function isGeneratedPath(norm: string): boolean {
  if (norm.endsWith(".map") || norm.endsWith(".min.js")) return true;
  if (/\.generated\.[^/]+$/i.test(norm) || /\.gen\.[^/]+$/i.test(norm)) return true;
  if (/\/generated\//i.test(norm) || /generated/i.test(basename(norm))) return true;
  return false;
}

function isConfigFile(norm: string, base: string, lowerBase: string): boolean {
  if (
    lowerBase === ".env.example" ||
    lowerBase === ".env.sample" ||
    lowerBase === "application.yml" ||
    lowerBase === "application.yaml" ||
    lowerBase === "application.properties" ||
    lowerBase === "application-dev.yml" ||
    lowerBase === "application-test.yml" ||
    lowerBase === "docker-compose.yml" ||
    lowerBase === "dockerfile" ||
    lowerBase === "tsconfig.json"
  ) {
    return true;
  }
  return (
    /^vite\.config\./i.test(base) ||
    /^next\.config\./i.test(base) ||
    /^nuxt\.config\./i.test(base) ||
    /^webpack\.config\./i.test(base) ||
    /^eslint\.config\./i.test(base)
  );
}

export function classifyGitHubFilePath(path: string): GitHubFileClass {
  const norm = normalizePath(path);
  const base = basename(norm);
  const lowerBase = base.toLowerCase();

  if (PACKAGE_MANIFEST_NAMES.has(lowerBase)) {
    return "PACKAGE_MANIFEST";
  }
  if (LOCK_FILE_NAMES.has(lowerBase) || lowerBase.endsWith(".lock")) {
    return "LOCK_FILE";
  }

  const ext = lowerBase.includes(".") ? lowerBase.slice(lowerBase.lastIndexOf(".")) : "";
  if (BINARY_EXTENSIONS.has(ext)) {
    return "BINARY";
  }
  if (/^public\/.+\/logo\.png$/i.test(norm) || /\/public\/.+\.(png|jpg|jpeg|gif|webp)$/i.test(norm)) {
    return "BINARY";
  }

  if (isUnderAnyPrefix(norm, BUILD_ARTIFACT_PREFIXES)) {
    return "BUILD_ARTIFACT";
  }

  if (isGeneratedPath(norm)) {
    return "GENERATED";
  }

  if (
    isUnderPrefix(norm, "test") ||
    isUnderPrefix(norm, "tests") ||
    isUnderPrefix(norm, "__tests__") ||
    isUnderPrefix(norm, "cypress") ||
    /\/__fixtures__\//i.test(norm) ||
    /\/fixtures\//i.test(norm) ||
    /\.spec\.[^/]+$/i.test(norm) ||
    /\.test\.[^/]+$/i.test(norm)
  ) {
    return "TEST";
  }

  if (isUnderAnyPrefix(norm, EXAMPLE_PREFIXES)) {
    return "EXAMPLE";
  }

  if (/^license(\.|$)/i.test(base) || lowerBase === "notice") {
    return "LICENSE";
  }
  if (/^readme(\.|$)/i.test(base)) {
    return "README";
  }

  if (isGettingStartedPath(norm)) {
    return "GETTING_STARTED";
  }
  if (isApiDocPath(norm)) {
    return "API_DOC";
  }
  if (isDocTreePath(norm)) {
    return "DOCS";
  }

  if (isConfigFile(norm, base, lowerBase)) {
    return "CONFIG";
  }

  if (
    isUnderPrefix(norm, "src") ||
    isUnderPrefix(norm, "lib") ||
    isUnderPrefix(norm, "app") ||
    /^packages\/[^/]+\/src\//i.test(norm)
  ) {
    return "SRC";
  }

  return "UNKNOWN";
}

export function isDocumentationClass(fileClass: GitHubFileClass): boolean {
  return (
    fileClass === "README" ||
    fileClass === "LICENSE" ||
    fileClass === "DOCS" ||
    fileClass === "GETTING_STARTED" ||
    fileClass === "API_DOC"
  );
}

export function isStorybookExamplePath(path: string): boolean {
  const norm = normalizePath(path);
  return isUnderPrefix(norm, "stories") || isUnderPrefix(norm, "storybook");
}
