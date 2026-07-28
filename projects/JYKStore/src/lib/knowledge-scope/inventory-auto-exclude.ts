/**
 * P3 knowledge-scope inventory — pure auto-exclusion policy.
 * Maps ZIP preflight / Worker exclusion reasons into Inventory decision fields.
 */

import {
  buildZipExclusionPolicy,
  evaluateZipEntryExclusion,
  type ZipExclusionReason,
} from "@/lib/python-worker/zip-exclusion-policy";

export type InventoryExclusionReasonCode =
  | "ZERO_BYTE"
  | "EXECUTABLE"
  | "EXECUTABLE_LIBRARY"
  | "BUILD_ARTIFACT"
  | "CACHE"
  | "FONT"
  | "LICENSE_OR_KEY"
  | "UNSUPPORTED"
  | "NON_KNOWLEDGE_FILE"
  | "ADMIN_DECISION"
  | "PROVIDER_DECISION"
  | "EXCLUDED_DIRECTORY"
  | "EXCLUDED_FILE_NAME"
  | "EXCLUDED_EXTENSION"
  | "FILE_SIZE_EXCEEDED"
  | "OTHER";

export type InventoryAutoDecision = {
  decision: "INCLUDED" | "EXCLUDED" | "PENDING";
  decisionSource: "SYSTEM";
  exclusionReasonCode: InventoryExclusionReasonCode | null;
  exclusionReasonText: string | null;
  /** Safety exclusions that admin may not override into Worker input. */
  overrideAllowed: boolean;
};

const EXECUTABLE_EXTS = new Set([
  ".exe",
  ".msi",
  ".bat",
  ".cmd",
  ".ps1",
  ".sh",
  ".com",
  ".scr",
]);
const EXECUTABLE_LIB_EXTS = new Set([".dll", ".so", ".dylib", ".jar", ".war", ".class"]);
const FONT_EXTS = new Set([".ttf", ".otf", ".woff", ".woff2", ".eot"]);
const LICENSE_NAME_RE = /^(license|licence|copying|copyright|secret|credentials?|apikey|api[_-]?key)/i;
const LICENSE_EXTS = new Set([".pem", ".key", ".p12", ".pfx", ".crt", ".cer"]);
const BUILD_DIRS = new Set(["dist", "build", "target", "out", "bin", "obj"]);
const CACHE_DIRS = new Set([".cache", "__pycache__", ".next", "node_modules", ".git", "__macosx"]);

function mapZipReason(reason: ZipExclusionReason): InventoryExclusionReasonCode {
  switch (reason) {
    case "excluded_directory":
      return "EXCLUDED_DIRECTORY";
    case "excluded_file_name":
      return "EXCLUDED_FILE_NAME";
    case "excluded_extension":
      return "EXCLUDED_EXTENSION";
    case "file_size_exceeded":
      return "FILE_SIZE_EXCEEDED";
    default:
      return "OTHER";
  }
}

function pathSegments(relativePath: string): string[] {
  return relativePath
    .replace(/\\/g, "/")
    .split("/")
    .map((s) => s.trim())
    .filter(Boolean);
}

export function classifyInventoryAutoDecision(input: {
  relativePath: string;
  fileName: string;
  extension: string;
  sizeBytes: number;
}): InventoryAutoDecision {
  const ext = (input.extension || "").toLowerCase();
  const fileName = input.fileName || input.relativePath.split("/").pop() || "";
  const segments = pathSegments(input.relativePath).map((s) => s.toLowerCase());

  if (input.sizeBytes === 0) {
    return {
      decision: "EXCLUDED",
      decisionSource: "SYSTEM",
      exclusionReasonCode: "ZERO_BYTE",
      exclusionReasonText: "파일 크기가 0 Byte입니다.",
      overrideAllowed: false,
    };
  }

  if (EXECUTABLE_EXTS.has(ext)) {
    return {
      decision: "EXCLUDED",
      decisionSource: "SYSTEM",
      exclusionReasonCode: "EXECUTABLE",
      exclusionReasonText: `실행 파일(${ext})은 지식화 대상에서 제외합니다.`,
      overrideAllowed: false,
    };
  }

  if (EXECUTABLE_LIB_EXTS.has(ext)) {
    return {
      decision: "EXCLUDED",
      decisionSource: "SYSTEM",
      exclusionReasonCode: "EXECUTABLE_LIBRARY",
      exclusionReasonText: `실행 라이브러리(${ext})는 지식화 대상에서 제외합니다.`,
      overrideAllowed: false,
    };
  }

  if (FONT_EXTS.has(ext)) {
    return {
      decision: "EXCLUDED",
      decisionSource: "SYSTEM",
      exclusionReasonCode: "FONT",
      exclusionReasonText: `폰트 파일(${ext})은 지식화 대상에서 제외합니다.`,
      overrideAllowed: true,
    };
  }

  if (LICENSE_EXTS.has(ext) || LICENSE_NAME_RE.test(fileName)) {
    return {
      decision: "EXCLUDED",
      decisionSource: "SYSTEM",
      exclusionReasonCode: "LICENSE_OR_KEY",
      exclusionReasonText: "라이선스·키·자격증명 관련 파일은 제외합니다.",
      overrideAllowed: false,
    };
  }

  if (segments.some((s) => BUILD_DIRS.has(s))) {
    return {
      decision: "EXCLUDED",
      decisionSource: "SYSTEM",
      exclusionReasonCode: "BUILD_ARTIFACT",
      exclusionReasonText: "빌드 산출물 경로의 파일입니다.",
      overrideAllowed: true,
    };
  }

  if (segments.some((s) => CACHE_DIRS.has(s))) {
    return {
      decision: "EXCLUDED",
      decisionSource: "SYSTEM",
      exclusionReasonCode: "CACHE",
      exclusionReasonText: "캐시·임시·의존성 경로의 파일입니다.",
      overrideAllowed: true,
    };
  }

  const policy = buildZipExclusionPolicy();
  const zipHit = evaluateZipEntryExclusion(policy, input.relativePath, input.sizeBytes);
  if (zipHit) {
    const code = mapZipReason(zipHit.reason);
    return {
      decision: "EXCLUDED",
      decisionSource: "SYSTEM",
      exclusionReasonCode: code,
      exclusionReasonText: zipHit.detail ?? `정책 제외: ${zipHit.reason}`,
      overrideAllowed: code !== "FILE_SIZE_EXCEEDED",
    };
  }

  // Default: knowledge candidate pending admin confirmation.
  return {
    decision: "PENDING",
    decisionSource: "SYSTEM",
    exclusionReasonCode: null,
    exclusionReasonText: null,
    overrideAllowed: true,
  };
}

export function isSafetyBlockedOverride(reason: InventoryExclusionReasonCode | null | undefined): boolean {
  return (
    reason === "ZERO_BYTE" ||
    reason === "EXECUTABLE" ||
    reason === "EXECUTABLE_LIBRARY" ||
    reason === "LICENSE_OR_KEY"
  );
}

export function previewKindForExtension(extension: string): string {
  const ext = extension.toLowerCase();
  if (ext === ".pdf") return "pdf";
  if ([".png", ".jpg", ".jpeg", ".gif", ".webp", ".bmp", ".svg"].includes(ext)) return "image";
  if (
    [
      ".txt",
      ".md",
      ".markdown",
      ".json",
      ".xml",
      ".yml",
      ".yaml",
      ".csv",
      ".html",
      ".htm",
      ".css",
      ".js",
      ".ts",
      ".tsx",
      ".jsx",
      ".py",
      ".java",
      ".go",
      ".rs",
      ".c",
      ".cpp",
      ".h",
      ".cs",
      ".sql",
    ].includes(ext)
  ) {
    return "text";
  }
  return "unsupported";
}
