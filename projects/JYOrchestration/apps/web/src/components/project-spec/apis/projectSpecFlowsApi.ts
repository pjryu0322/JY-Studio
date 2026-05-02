import type { ApiResponse } from "../types";
import { credentialsIncludeFetch } from "@/lib/http/credentialsIncludeFetch";

/** GET /api/project-spec/context */
export type ProjectSpecContextDto = {
  projectId: string;
  name: string;
  /** 공식 프로젝트 설명(읽기 전용). 저장은 별도 "프로젝트 설명 수정"에서만 합니다. */
  description: string | null;
  projectType: string;
  coreGoals: string | null;
  inScope: string | null;
  outOfScope: string | null;
  targetUsers: string | null;
  successCriteria: string | null;
  executionPlanMarkdown: string | null;
  selectedPlanCandidateId: string | null;
};

export async function fetchProjectSpecContext(projectId: string) {
  const encoded = encodeURIComponent(projectId);
  const res = await credentialsIncludeFetch(`/api/project-spec/context?projectId=${encoded}`);
  const json = (await res.json()) as ApiResponse<ProjectSpecContextDto>;
  return { res, json };
}

export async function patchProjectSpecContext(body: {
  projectId: string;
  name?: string;
  projectType?: string;
  coreGoals?: string | null;
  inScope?: string | null;
  outOfScope?: string | null;
  targetUsers?: string | null;
  successCriteria?: string | null;
  executionPlanMarkdown?: string | null;
  selectedPlanCandidateId?: string | null;
}) {
  const res = await credentialsIncludeFetch("/api/project-spec/context", {
    method: "PATCH",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify(body),
  });
  const json = (await res.json()) as ApiResponse<ProjectSpecContextDto>;
  return { res, json };
}

export type ProjectTaskPromptDto = {
  taskPrompt: string | null;
  defaultPrompt: string;
};

export async function fetchProjectTaskPrompt(projectId: string) {
  const encoded = encodeURIComponent(projectId);
  const res = await credentialsIncludeFetch(`/api/projects/${encoded}/task-prompt`);
  const json = (await res.json()) as ApiResponse<ProjectTaskPromptDto>;
  return { res, json };
}

export async function patchProjectTaskPrompt(projectId: string, body: { taskPrompt: string }) {
  const encoded = encodeURIComponent(projectId);
  const res = await credentialsIncludeFetch(`/api/projects/${encoded}/task-prompt`, {
    method: "PATCH",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify(body),
  });
  const json = (await res.json()) as ApiResponse<{ taskPrompt: string | null }>;
  return { res, json };
}

/** F-1-3-5 단일 호출 Task 생성용 템플릿 */
export type ProjectTaskGenerationPromptDto = {
  taskGenerationPrompt: string | null;
  defaultPrompt: string;
};

export async function fetchProjectTaskGenerationPrompt(projectId: string) {
  const encoded = encodeURIComponent(projectId);
  const res = await credentialsIncludeFetch(`/api/projects/${encoded}/task-generation-prompt`);
  const json = (await res.json()) as ApiResponse<ProjectTaskGenerationPromptDto>;
  return { res, json };
}

export async function patchProjectTaskGenerationPrompt(
  projectId: string,
  body: { taskGenerationPrompt: string }
) {
  const encoded = encodeURIComponent(projectId);
  const res = await credentialsIncludeFetch(`/api/projects/${encoded}/task-generation-prompt`, {
    method: "PATCH",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify(body),
  });
  const json = (await res.json()) as ApiResponse<{ taskGenerationPrompt: string | null }>;
  return { res, json };
}

export type GenerateSpecContextResponse = {
  projectId: string;
  coreGoals: string;
  inScope: string[];
  outOfScope: string[];
  targetUsers: string[];
  successCriteria: string[];
  formatted: {
    specCoreGoals: string;
    specScopeIn: string;
    specScopeOut: string;
    specTargetUsers: string;
    specSuccessCriteria: string;
  };
};

export async function postGenerateSpecContext(body: {
  projectId: string;
  name: string;
  description: string;
  projectType: string;
}) {
  const res = await credentialsIncludeFetch("/api/project-spec/context/generate", {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify(body),
  });
  const json = (await res.json()) as ApiResponse<GenerateSpecContextResponse>;
  return { res, json };
}

/** 전체 문서 후보 (모델별 비교) */
export type AiDraftCandidate = {
  id: string;
  modelId: string;
  content: string;
  createdAt: string;
};

export async function postProjectPlanGenerate(body: {
  projectId: string;
  name: string;
  description: string;
  projectType: string;
  models: string[];
}) {
  const res = await credentialsIncludeFetch("/api/project-spec/project-plan/generate", {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify(body),
  });
  const json = (await res.json()) as ApiResponse<{
    candidates: AiDraftCandidate[];
    failures: Array<{ modelId: string; message: string }>;
  }>;
  return { res, json };
}

export async function postProjectPlanRevise(body: {
  projectId: string;
  document: string;
  instruction?: string;
  model: string;
}) {
  const res = await credentialsIncludeFetch("/api/project-spec/project-plan/revise", {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify(body),
  });
  const json = (await res.json()) as ApiResponse<{
    content: string;
    model: string;
    usage: { promptTokens: number; completionTokens: number; totalTokens: number } | null;
  }>;
  return { res, json };
}
