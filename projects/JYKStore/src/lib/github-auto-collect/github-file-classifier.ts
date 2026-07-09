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

function matchesSegmentKeyword(path: string, keywords: string[]): boolean {
  const lower = normalizePath(path).toLowerCase();
  return keywords.some((kw) => lower.includes(kw));
}

function isRootReadme(path: string): boolean {
  const base = basename(path);
  return /^readme(\.|$)/i.test(base) && pathSegments(path).length === 1;
}

export function classifyGitHubFilePath(path: string): GitHubFileClass {
  const norm = normalizePath(path);
  const base = basename(norm);
  const lowerBase = base.toLowerCase();

  if (PACKAGE_MANIFEST_NAMES.has(lowerBase)) {
    return "PACKAGE_MANIFEST";
  }
  if (LOCK_FILE_NAMES.has(lowerBase)) {
    return "LOCK_FILE";
  }

  const ext = lowerBase.includes(".") ? lowerBase.slice(lowerBase.lastIndexOf(".")) : "";
  if (BINARY_EXTENSIONS.has(ext)) {
    return "BINARY";
  }

  if (/^license(\.|$)/i.test(base) || lowerBase === "notice") {
    return "LICENSE";
  }
  if (/^readme(\.|$)/i.test(base)) {
    return "README";
  }

  if (
    isUnderPrefix(norm, "dist") ||
    isUnderPrefix(norm, "build") ||
    isUnderPrefix(norm, "target") ||
    isUnderPrefix(norm, "coverage")
  ) {
    return "BUILD_ARTIFACT";
  }

  if (norm.endsWith(".map") || norm.endsWith(".min.js") || /generated/i.test(norm)) {
    return "GENERATED";
  }

  if (
    isUnderPrefix(norm, "test") ||
    isUnderPrefix(norm, "tests") ||
    isUnderPrefix(norm, "__tests__") ||
    isUnderPrefix(norm, "cypress") ||
    /\.spec\.[^/]+$/i.test(norm) ||
    /\.test\.[^/]+$/i.test(norm)
  ) {
    return "TEST";
  }

  if (
    isUnderPrefix(norm, "examples") ||
    isUnderPrefix(norm, "samples") ||
    isUnderPrefix(norm, "demo")
  ) {
    return "EXAMPLE";
  }

  if (
    isUnderPrefix(norm, "docs") ||
    isUnderPrefix(norm, "doc") ||
    isUnderPrefix(norm, "guide") ||
    isUnderPrefix(norm, "manual")
  ) {
    return "DOCS";
  }

  if (
    matchesSegmentKeyword(norm, [
      "getting-started",
      "quickstart",
      "/start/",
      "installation",
    ])
  ) {
    return "GETTING_STARTED";
  }

  if (
    matchesSegmentKeyword(norm, ["openapi", "swagger"]) ||
    /\/api(\/|$)/i.test(norm) ||
    /\/reference(\/|$)/i.test(norm)
  ) {
    return "API_DOC";
  }

  if (
    lowerBase === ".env.example" ||
    lowerBase === "application.yml" ||
    lowerBase === "application.yaml" ||
    lowerBase === "application.properties" ||
    /^vite\.config\./i.test(base) ||
    /^next\.config\./i.test(base)
  ) {
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

  if (isRootReadme(norm)) {
    return "README";
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
