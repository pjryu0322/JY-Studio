import { createHash } from "node:crypto";
import type { SourceFormat, SourceType } from "@prisma/client";
import type { GitHubFileClass } from "./github-auto-collect-types";
import { isSourceFormat, isSourceType } from "@/lib/source-type-dto";

const CODE_EXTENSIONS = new Set([
  ".ts",
  ".tsx",
  ".js",
  ".jsx",
  ".java",
  ".py",
  ".go",
  ".kt",
  ".rs",
  ".cs",
]);

export function basenamePath(path: string): string {
  return path.replace(/\\/g, "/").split("/").pop() ?? path;
}

export function buildGitHubSourceTitle(path: string, fileClass: GitHubFileClass): string {
  const base = basenamePath(path);
  if (fileClass === "README" && /^readme/i.test(base)) {
    return "README";
  }
  const withoutExt = base.includes(".") ? base.slice(0, base.lastIndexOf(".")) : base;
  const norm = path.replace(/\\/g, "/");
  const title = norm.includes("/") ? norm.replace(/\.[^/.]+$/, "") : withoutExt;
  return title.length > 120 ? title.slice(0, 120) : title;
}

export function buildGitHubBlobUrl(
  repositoryUrl: string,
  branch: string,
  filePath: string,
): string {
  const base = repositoryUrl.replace(/\/$/, "");
  const encodedPath = filePath
    .split("/")
    .map((seg) => encodeURIComponent(seg))
    .join("/");
  return `${base}/blob/${encodeURIComponent(branch)}/${encodedPath}`;
}

export function inferSourceFormat(path: string, fileClass: GitHubFileClass): SourceFormat {
  const lower = path.toLowerCase();
  const ext = lower.includes(".") ? lower.slice(lower.lastIndexOf(".")) : "";
  const isOpenApi =
    lower.includes("openapi") ||
    lower.includes("swagger") ||
    fileClass === "API_DOC";

  if (fileClass === "README" || ext === ".md" || ext === ".mdx") {
    return "MARKDOWN";
  }
  if (isOpenApi && (ext === ".yaml" || ext === ".yml")) {
    return "OPENAPI_YAML";
  }
  if (isOpenApi && ext === ".json") {
    return "OPENAPI_JSON";
  }
  if (ext === ".json") {
    return "JSON";
  }
  if (ext === ".yaml" || ext === ".yml") {
    return "YAML";
  }
  if (CODE_EXTENSIONS.has(ext)) {
    return "CODE";
  }
  if (ext === ".csv") {
    return "CSV";
  }
  return "TEXT";
}

export function inferMimeType(path: string): string {
  const lower = path.toLowerCase();
  if (lower.endsWith(".md")) return "text/markdown";
  if (lower.endsWith(".json")) return "application/json";
  if (lower.endsWith(".yaml") || lower.endsWith(".yml")) return "application/yaml";
  if (lower.endsWith(".ts")) return "text/typescript";
  if (lower.endsWith(".js")) return "text/javascript";
  return "text/plain";
}

export function sha256Content(content: string): string {
  return createHash("sha256").update(content, "utf8").digest("hex");
}

export function resolveSourceType(sourceTypeSuggestion: string): SourceType {
  if (isSourceType(sourceTypeSuggestion)) {
    return sourceTypeSuggestion;
  }
  return "ETC";
}

export function resolveSourceFormat(path: string, fileClass: GitHubFileClass): SourceFormat {
  const fmt = inferSourceFormat(path, fileClass);
  return isSourceFormat(fmt) ? fmt : "TEXT";
}
