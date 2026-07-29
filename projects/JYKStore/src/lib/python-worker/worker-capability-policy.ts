/**
 * P4.2 — Worker capability policy (mirrored from python-worker/config/worker_capability_policy.json).
 * SoT for “what can become Inventory INCLUDED knowledge”.
 */
export const WORKER_CAPABILITY_POLICY_VERSION = "worker-capability-v1" as const;

export type WorkerCapabilityKind =
  | "SUPPORTED"
  | "UNSUPPORTED"
  | "REVIEW_REQUIRED"
  | "SUPPORTING";

export type WorkerCapabilityAssessment = {
  capability: WorkerCapabilityKind;
  fileType: string;
  parser: string | null;
  knowledgeEligible: boolean;
  reasonCode: string | null;
  policyVersion: typeof WORKER_CAPABILITY_POLICY_VERSION;
};

const IMAGE_EXTS = new Set([
  ".png",
  ".jpg",
  ".jpeg",
  ".gif",
  ".svg",
  ".webp",
  ".bmp",
  ".ico",
  ".tif",
  ".tiff",
]);

function pathParts(relativePath: string): string[] {
  return relativePath
    .replace(/\\/g, "/")
    .split("/")
    .map((p) => p.trim().toLowerCase())
    .filter(Boolean);
}

function hasDocsApiPath(parts: string[]): boolean {
  if (parts.length >= 2 && parts[0] === "docs" && parts[1] === "api") return true;
  const docsIdx = parts.indexOf("docs");
  const apiIdx = parts.indexOf("api");
  return docsIdx >= 0 && apiIdx > docsIdx;
}

function isSamplePath(parts: string[]): boolean {
  return parts.some((p) => p === "samples" || p === "react_vue_samples" || p === "serversamples");
}

const LICENSE_NAME_RE =
  /(license|copyright|readme|사용권|라이선스|처음사용자|eula|terms)/i;

/**
 * Mirror of python-worker/src/policies.py classify_file knowledge eligibility.
 * Keep in sync with python-worker/config/worker_capability_policy.json.
 */
export function assessWorkerCapability(input: {
  relativePath: string;
  fileName: string;
  extension: string;
}): WorkerCapabilityAssessment {
  const ext = (input.extension || "").toLowerCase();
  const parts = pathParts(input.relativePath);
  const fileName = input.fileName || parts[parts.length - 1] || "";
  const base = {
    policyVersion: WORKER_CAPABILITY_POLICY_VERSION,
  } as const;

  if (parts.includes("licensekey") || parts.some((p) => p === "fonts" || p === "font")) {
    return {
      ...base,
      capability: "UNSUPPORTED",
      fileType: ext.replace(".", "") || "unknown",
      parser: null,
      knowledgeEligible: false,
      reasonCode: "HARD_EXCLUDED_PATH",
    };
  }

  if (LICENSE_NAME_RE.test(fileName)) {
    return {
      ...base,
      capability: "REVIEW_REQUIRED",
      fileType: "license",
      parser: "license_inspector",
      knowledgeEligible: false,
      reasonCode: "LICENSE_REVIEW",
    };
  }

  if (ext === ".pdf") {
    return {
      ...base,
      capability: "SUPPORTED",
      fileType: "pdf",
      parser: "docling_pdf",
      knowledgeEligible: true,
      reasonCode: null,
    };
  }

  if (ext === ".html" || ext === ".htm") {
    if (hasDocsApiPath(parts)) {
      return {
        ...base,
        capability: "SUPPORTED",
        fileType: "html",
        parser: "html_api",
        knowledgeEligible: true,
        reasonCode: null,
      };
    }
    if (isSamplePath(parts)) {
      return {
        ...base,
        capability: "SUPPORTED",
        fileType: "html",
        parser: "html_sample",
        knowledgeEligible: true,
        reasonCode: null,
      };
    }
    return {
      ...base,
      capability: "REVIEW_REQUIRED",
      fileType: "html",
      parser: null,
      knowledgeEligible: false,
      reasonCode: "HTML_NOT_IN_KNOWN_KNOWLEDGE_PATH",
    };
  }

  if (IMAGE_EXTS.has(ext)) {
    return {
      ...base,
      capability: "SUPPORTING",
      fileType: "image",
      parser: null,
      knowledgeEligible: false,
      reasonCode: "SUPPORTING_ASSET",
    };
  }

  if (
    isSamplePath(parts) &&
    [".xml", ".json", ".js", ".ts", ".jsx", ".tsx", ".css"].includes(ext)
  ) {
    return {
      ...base,
      capability: "SUPPORTING",
      fileType: "sample_companion",
      parser: null,
      knowledgeEligible: false,
      reasonCode: "SAMPLE_COMPANION",
    };
  }

  return {
    ...base,
    capability: "UNSUPPORTED",
    fileType: ext.replace(".", "") || "unknown",
    parser: null,
    knowledgeEligible: false,
    reasonCode: "NO_KNOWLEDGE_PARSER",
  };
}

export function isKnowledgeEligibleForInclude(assessment: WorkerCapabilityAssessment): boolean {
  return assessment.knowledgeEligible && assessment.capability === "SUPPORTED";
}
