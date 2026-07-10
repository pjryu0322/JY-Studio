import { normalizeKuDraftTitleKey } from "./ku-draft-dedup";

export type KuSourceLanguage = "ko" | "en" | "unknown";
export type KuProductVariant = "core" | "vue" | "react" | "unknown";

const BROAD_SEMANTIC_TOPIC_KEYS = new Set([
  "grid",
  "column",
  "editor",
  "renderer",
  "tree",
  "theme",
  "event",
  "api",
  "example",
]);

export function buildSemanticTopicKey(input: {
  title: string;
  primaryHeading?: string | null;
  sourcePath?: string | null;
}): string {
  const probe = `${input.title} ${input.primaryHeading ?? ""} ${input.sourcePath ?? ""}`.toLowerCase();

  if (probe.includes("getting-started") || probe.includes("quick") || probe.includes("시작")) {
    return "getting-started";
  }
  if (probe.includes("install") || probe.includes("설치")) {
    return "install";
  }
  if (probe.includes("readme") || probe.includes("overview") || probe.includes("개요")) {
    return "overview";
  }
  if (probe.includes("grid")) return "grid";
  if (probe.includes("column")) return "column";
  if (probe.includes("editor")) return "editor";
  if (probe.includes("renderer")) return "renderer";
  if (probe.includes("tree")) return "tree";
  if (probe.includes("theme")) return "theme";
  if (probe.includes("event")) return "event";
  if (probe.includes("api")) return "api";
  if (probe.includes("example") || probe.includes("예제")) return "example";

  return normalizeKuDraftTitleKey(input.title) || "topic";
}

export function canonicalizeKuSourcePath(path: string | null): string | null {
  if (!path) return null;

  return path
    .replace(/\\/g, "/")
    .replace(/^packages\/toast-ui\.(vue|react)-grid\//i, "")
    .replace(/^packages\/toast-ui\.grid\//i, "")
    .replace(/\/docs\/(ko|en)\//i, "/docs/")
    .replace(/^docs\/(ko|en)\//i, "docs/");
}

export function inferKuSourceLanguage(path: string | null): KuSourceLanguage {
  if (!path) return "unknown";
  const norm = path.replace(/\\/g, "/").toLowerCase();
  if (/\/(ko|kr)\//.test(norm) || norm.includes("/docs/ko/")) return "ko";
  if (/\/(en)\//.test(norm) || norm.includes("/docs/en/")) return "en";
  return "unknown";
}

export function inferKuProductVariant(path: string | null): KuProductVariant {
  if (!path) return "unknown";
  const norm = path.replace(/\\/g, "/").toLowerCase();
  if (norm.includes("vue-grid")) return "vue";
  if (norm.includes("react-grid")) return "react";
  if (norm.includes("toast-ui.grid")) return "core";
  return "unknown";
}

export function kuSourcePathRepresentativeScore(path: string | null): number {
  if (!path) return 0;
  const norm = path.replace(/\\/g, "/").toLowerCase();
  if (norm.includes("packages/toast-ui.grid/")) return 100;
  if (norm.startsWith("docs/") && !norm.includes("/ko/") && !norm.includes("/en/")) return 85;
  if (norm === "readme.md" || norm.endsWith("/readme.md")) return 80;
  if (norm.includes("/docs/ko/") || norm.startsWith("docs/ko/")) return 60;
  if (norm.includes("vue-grid") || norm.includes("react-grid")) return 40;
  return 50;
}

export function isBroadSemanticTopicKey(key: string | null | undefined): boolean {
  if (!key) return false;
  return BROAD_SEMANTIC_TOPIC_KEYS.has(key);
}
