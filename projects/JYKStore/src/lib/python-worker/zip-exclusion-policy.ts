/**
 * TS mirror of python-worker exclusion_policy defaults (P7.4).
 * Used for Admin "사전정리" ZIP preflight — no Worker round-trip.
 */

export const ZIP_EXCLUSION_REASONS = [
  "excluded_directory",
  "excluded_file_name",
  "excluded_extension",
  "file_size_exceeded",
] as const;

export type ZipExclusionReason = (typeof ZIP_EXCLUSION_REASONS)[number];

export type ZipExclusionPolicy = {
  excludeExtensions: ReadonlySet<string>;
  excludeDirectories: ReadonlySet<string>;
  excludeFileNames: ReadonlySet<string>;
  maxFileSizeBytes: number | null;
};

const MB = 1024 * 1024;

/** Kept in sync with python-worker/config/zip_exclusion_policy.json. */
export const DEFAULT_ZIP_EXCLUSION_POLICY_CONFIG = {
  excludeExtensions: [
    ".exe",
    ".dll",
    ".msi",
    ".bat",
    ".cmd",
    ".ps1",
    ".sh",
    ".jar",
    ".war",
    ".class",
    ".bin",
    ".dat",
    ".zip",
    ".7z",
    ".rar",
    ".tar",
    ".gz",
  ],
  excludeDirectories: [
    ".git",
    "__MACOSX",
    "node_modules",
    "dist",
    "build",
    "target",
    ".next",
    ".cache",
  ],
  excludeFileNames: [".DS_Store", "Thumbs.db"],
  maxFileSizeMb: 50,
} as const;

function normExt(ext: string): string {
  const trimmed = ext.trim().toLowerCase();
  if (!trimmed) return "";
  return trimmed.startsWith(".") ? trimmed : `.${trimmed}`;
}

export function buildZipExclusionPolicy(
  config: {
    excludeExtensions?: readonly string[];
    excludeDirectories?: readonly string[];
    excludeFileNames?: readonly string[];
    maxFileSizeMb?: number | null;
  } | null = null,
): ZipExclusionPolicy {
  const cfg = config ?? {};
  const extensions = (cfg.excludeExtensions?.length
    ? cfg.excludeExtensions
    : DEFAULT_ZIP_EXCLUSION_POLICY_CONFIG.excludeExtensions
  ).map(normExt);
  const directories = (cfg.excludeDirectories?.length
    ? cfg.excludeDirectories
    : DEFAULT_ZIP_EXCLUSION_POLICY_CONFIG.excludeDirectories
  ).map((d) => d.trim().toLowerCase());
  const fileNames = (cfg.excludeFileNames?.length
    ? cfg.excludeFileNames
    : DEFAULT_ZIP_EXCLUSION_POLICY_CONFIG.excludeFileNames
  ).map((f) => f.trim().toLowerCase());
  const maxMb =
    cfg.maxFileSizeMb === undefined
      ? DEFAULT_ZIP_EXCLUSION_POLICY_CONFIG.maxFileSizeMb
      : cfg.maxFileSizeMb;
  return {
    excludeExtensions: new Set(extensions.filter(Boolean)),
    excludeDirectories: new Set(directories.filter(Boolean)),
    excludeFileNames: new Set(fileNames.filter(Boolean)),
    maxFileSizeBytes:
      maxMb == null || !Number.isFinite(maxMb) || maxMb <= 0 ? null : Math.floor(maxMb * MB),
  };
}

export function evaluateZipEntryExclusion(
  policy: ZipExclusionPolicy,
  sourcePath: string,
  fileSize: number | null = null,
): { reason: ZipExclusionReason; detail: string } | null {
  const normalized = sourcePath.replace(/\\/g, "/");
  const parts = normalized.split("/").filter(Boolean);
  const name = parts[parts.length - 1] ?? normalized;
  const nameLower = name.toLowerCase();
  const ancestorParts = parts.slice(0, -1).map((p) => p.toLowerCase());

  for (const part of ancestorParts) {
    if (policy.excludeDirectories.has(part)) {
      return { reason: "excluded_directory", detail: part };
    }
  }

  if (policy.excludeFileNames.has(nameLower)) {
    return { reason: "excluded_file_name", detail: name };
  }

  const dot = nameLower.lastIndexOf(".");
  const ext = dot > 0 ? nameLower.slice(dot) : "";
  if (ext && policy.excludeExtensions.has(ext)) {
    return { reason: "excluded_extension", detail: ext };
  }

  if (
    policy.maxFileSizeBytes != null &&
    fileSize != null &&
    Number.isFinite(fileSize) &&
    fileSize > policy.maxFileSizeBytes
  ) {
    return { reason: "file_size_exceeded", detail: String(fileSize) };
  }

  return null;
}

/** Match Admin 사전정리 exclude rules (exact path or nested under a selected folder). */
export function matchAdminPreflightExcludePath(
  sourcePath: string,
  excludePaths: readonly string[] | null | undefined,
): string | null {
  if (!excludePaths?.length) return null;
  const norm = sourcePath.replace(/\\/g, "/").replace(/^\/+|\/+$/g, "").trim();
  if (!norm) return null;
  for (const raw of excludePaths) {
    const rule = raw.replace(/\\/g, "/").replace(/^\/+|\/+$/g, "").trim();
    if (!rule) continue;
    if (norm === rule || norm.startsWith(`${rule}/`)) return rule;
  }
  return null;
}

export function zipExclusionReasonLabel(reason: ZipExclusionReason | string): string {
  switch (reason) {
    case "excluded_directory":
      return "제외 디렉터리";
    case "excluded_file_name":
      return "제외 파일명";
    case "excluded_extension":
      return "제외 확장자";
    case "file_size_exceeded":
      return "크기 초과";
    case "admin_preflight_excluded":
      return "사전정리 제외";
    default:
      return reason;
  }
}
