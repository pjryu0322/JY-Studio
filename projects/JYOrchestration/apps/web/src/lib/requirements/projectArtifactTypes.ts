/**
 * Project artifacts — side-action document outputs (not stage transitions).
 */

import type { RequirementsOrchestrationStageWire } from "@/lib/requirements/requirementsStateJson";

export type ProjectArtifactType =
  | "service-flow-doc"
  | "feature-spec"
  | "screen-spec"
  | "api-spec"
  | "summary"
  | "markdown-export"
  | "pdf-export";

export type ProjectArtifact = Readonly<{
  readonly id: string;
  readonly type: ProjectArtifactType;
  readonly title: string;
  readonly createdAt: string;
  readonly createdBy: "ai" | "user";
  readonly sourceStage: string;
  readonly content: string;
}>;

export const PROJECT_ARTIFACT_LABELS: Record<ProjectArtifactType, string> = {
  "service-flow-doc": "서비스 흐름 문서",
  "feature-spec": "기능 정의서",
  "screen-spec": "화면 정의서",
  "api-spec": "API 명세서",
  summary: "프로젝트 요약서",
  "markdown-export": "Markdown Export",
  "pdf-export": "PDF Export",
};

export const PROJECT_ARTIFACT_MENU_ORDER: readonly ProjectArtifactType[] = [
  "service-flow-doc",
  "feature-spec",
  "screen-spec",
  "api-spec",
  "summary",
  "markdown-export",
  "pdf-export",
];

export function isProjectArtifactType(raw: string | null | undefined): raw is ProjectArtifactType {
  return Boolean(raw && raw in PROJECT_ARTIFACT_LABELS);
}

export function parseProjectArtifactsFromState(raw: unknown): ProjectArtifact[] | null {
  if (raw === null) return null;
  if (!Array.isArray(raw)) return null;
  const out: ProjectArtifact[] = [];
  for (const row of raw) {
    if (!row || typeof row !== "object") continue;
    const o = row as Record<string, unknown>;
    const type = String(o.type ?? "").trim();
    const id = String(o.id ?? "").trim();
    const title = String(o.title ?? "").trim();
    const content = String(o.content ?? "");
    const createdAt = String(o.createdAt ?? "").trim();
    if (!isProjectArtifactType(type) || !id || !title || !createdAt) continue;
    out.push({
      id,
      type,
      title,
      createdAt,
      createdBy: o.createdBy === "user" ? "user" : "ai",
      sourceStage: String(o.sourceStage ?? "").trim() || "unknown",
      content,
    });
  }
  return out;
}

export function wireStageLabel(stage: RequirementsOrchestrationStageWire | string | null | undefined): string {
  const s = String(stage ?? "").trim();
  if (s === "FEATURE_DETAIL") return "FEATURE_DETAIL";
  if (s === "DOCUMENTATION_COMPLETE") return "DOCUMENTATION_COMPLETE";
  if (s === "SERVICE_FLOW_REVIEW") return "SERVICE_FLOW_REVIEW";
  if (s === "IDEATION") return "IDEATION";
  return s || "SERVICE_FLOW";
}
