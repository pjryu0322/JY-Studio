import type { ApiResponse, TaskDraftDto } from "../types";
import { credentialsIncludeFetch } from "@/lib/http/credentialsIncludeFetch";

export async function fetchProjectTaskDrafts(projectId: string, options?: { status?: string }) {
  const encoded = encodeURIComponent(projectId);
  const q = options?.status ? `?status=${encodeURIComponent(options.status)}` : "";
  const res = await credentialsIncludeFetch(`/api/projects/${encoded}/task-drafts${q}`);
  const json = (await res.json()) as ApiResponse<TaskDraftDto[]>;
  return { res, json };
}

export async function postProjectTaskDraftCreate(
  projectId: string,
  body: {
    specVersionId: string;
    title: string;
    nodeType?: "requirement" | "design" | "feature" | "task";
    description?: string | null;
    priority?: string;
    acceptanceCriteria?: string[];
    positionX?: number;
    positionY?: number;
    dependsOnIds?: string[];
    stage?: string;
  }
) {
  const encoded = encodeURIComponent(projectId);
  const res = await credentialsIncludeFetch(`/api/projects/${encoded}/task-drafts`, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify(body),
  });
  const json = (await res.json()) as ApiResponse<TaskDraftDto>;
  return { res, json };
}

export async function postProjectTaskDraftsGenerate(
  projectId: string,
  body: {
    specVersionId?: string;
    model?: string;
    mode?: "initial" | "regenerate";
    generationMode?: "single_pass" | "legacy_pipeline";
    includeNonFunctionalRequirements?: boolean;
  }
) {
  const encoded = encodeURIComponent(projectId);
  const res = await credentialsIncludeFetch(`/api/projects/${encoded}/task-drafts/generate`, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify(body),
  });
  const json = (await res.json()) as ApiResponse<{
    createdCount: number;
    supersededCount: number;
    model: string;
    usage: { promptTokens: number | null; completionTokens: number | null; totalTokens: number | null } | null;
    graphAutoRepaired?: boolean;
    autoConfirmedTaskCount?: number;
    promotedDraftRows?: number;
    confirmedTaskIds?: string[];
  }>;
  return { res, json };
}

export async function postProjectTaskDraftsConfirm(
  projectId: string,
  body: { draftIds?: string[]; confirmAll?: boolean }
) {
  const encoded = encodeURIComponent(projectId);
  const res = await credentialsIncludeFetch(`/api/projects/${encoded}/task-drafts/confirm`, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify(body),
  });
  const json = (await res.json()) as ApiResponse<{ confirmedCount: number; taskIds: string[] }>;
  return { res, json };
}

export async function patchProjectTaskDraft(
  projectId: string,
  draftId: string,
  body: Partial<{
    title: string;
    nodeType: "requirement" | "design" | "feature" | "task";
    description: string | null;
    priority: string;
    dependsOn: string[];
    dependsOnIds: string[];
    acceptanceCriteria: string[];
    taskInput: string | null;
    taskOutput: string | null;
    estimatedSize: string | null;
    executionKind: string | null;
    positionX: number;
    positionY: number;
    stage: string;
  }>
) {
  const encoded = encodeURIComponent(projectId);
  const did = encodeURIComponent(draftId);
  const res = await credentialsIncludeFetch(`/api/projects/${encoded}/task-drafts/${did}`, {
    method: "PATCH",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify(body),
  });
  const json = (await res.json()) as ApiResponse<TaskDraftDto>;
  return { res, json };
}

export async function deleteProjectTaskDraft(projectId: string, draftId: string) {
  const encoded = encodeURIComponent(projectId);
  const did = encodeURIComponent(draftId);
  const res = await credentialsIncludeFetch(`/api/projects/${encoded}/task-drafts/${did}`, {
    method: "DELETE",
  });
  const json = (await res.json()) as ApiResponse<unknown>;
  return { res, json };
}
