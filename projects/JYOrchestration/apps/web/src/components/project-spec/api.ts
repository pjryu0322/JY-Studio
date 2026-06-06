import {
  ApiResponse,
  Project,
  ProjectSpecPromptRecord,
  ProjectSpecResponseRecord,
  ProjectSpecVersionRecord,
  SpecPromptConfigRecord,
  TaskItem,
} from "./types";
import type { GithubCapabilityValidationSnapshot } from "@/lib/executionSetup/githubPatCapabilityProbes";
import {
  fetchSpecWorkspaceRequest,
  patchSpecWorkspaceRequest,
  postSpecWorkspaceRequest,
} from "@/lib/project/specWorkspaceClient";

export type { GithubCapabilityValidationSnapshot };

export * from "./apis/taskDrafts";

export async function fetchProjectById(projectId: string): Promise<{
  project: Project | null;
  errorMessage: string | null;
}> {
  const encoded = encodeURIComponent(projectId);
  let res: Response;
  try {
    res = await fetch(`/api/projects/${encoded}`, {
      credentials: "include",
      cache: "no-store",
    });
  } catch {
    return {
      project: null,
      errorMessage: "네트워크 오류로 프로젝트 정보를 불러오지 못했습니다.",
    };
  }
  const json = (await res.json()) as ApiResponse<Project>;

  if (res.status === 404 || res.status === 403) {
    return {
      project: null,
      errorMessage: json.message || "프로젝트 정보를 불러오지 못했습니다.",
    };
  }

  if (!res.ok || !json.success || !json.data) {
    return {
      project: null,
      errorMessage: json.message || "프로젝트 정보를 불러오지 못했습니다.",
    };
  }

  return {
    project: json.data,
    errorMessage: null,
  };
}

export async function fetchProjectWithRetry(projectId: string): Promise<{
  project: Project | null;
  errorMessage: string | null;
}> {
  const first = await fetchProjectById(projectId);
  if (first.project) return first;
  await new Promise((r) => setTimeout(r, 450));
  return fetchProjectById(projectId);
}

export async function postProjectWorkflowAckRequirements(projectId: string): Promise<{
  res: Response;
  json: { success?: boolean };
}> {
  const encoded = encodeURIComponent(projectId.trim());
  const res = await fetch(`/api/projects/${encoded}/workflow/ack-requirements`, {
    method: "POST",
    credentials: "include",
  });
  const json = (await res.json()) as { success?: boolean };
  return { res, json };
}

export async function fetchGeneratedTasks(projectId: string) {
  const encodedProjectId = encodeURIComponent(projectId);
  const res = await fetch(`/api/task/generate?projectId=${encodedProjectId}`, {
    credentials: "include",
  });
  const json = (await res.json()) as ApiResponse<TaskItem[]>;
  return { res, json };
}

export type SpecWorkspaceSnapshot = {
  project: Pick<
    Project,
    | "id"
    | "name"
    | "description"
    | "projectType"
    | "specCoreGoals"
    | "specScopeIn"
    | "specScopeOut"
    | "specTargetUsers"
    | "specSuccessCriteria"
    | "executionPlanMarkdown"
    | "selectedPlanCandidateId"
    | "confirmedSpecMarkdown"
    | "confirmedSpecResponseId"
    | "confirmedSpecAt"
    | "currentSpecVersionId"
  >;
  specVersions: ProjectSpecVersionRecord[];
  prompts: ProjectSpecPromptRecord[];
  responses: ProjectSpecResponseRecord[];
  specPromptConfig: SpecPromptConfigRecord | null;
};

export async function fetchSpecWorkspace(projectId: string) {
  const { res, json: raw } = await fetchSpecWorkspaceRequest(projectId);
  const json = raw as ApiResponse<SpecWorkspaceSnapshot>;
  return { res, json };
}

export async function patchSpecWorkspace(
  projectId: string,
  body: Partial<{
    name: string;
    description: string | null;
    projectType: string;
    specCoreGoals: string | null;
    specScopeIn: string | null;
    specScopeOut: string | null;
    specTargetUsers: string | null;
    specSuccessCriteria: string | null;
    executionPlanMarkdown: string | null;
    selectedPlanCandidateId: string | null;
    specPromptTemplate?: string | null;
    specPromptPreset?: string | null;
  }>
) {
  const { res, json: raw } = await patchSpecWorkspaceRequest(projectId, body);
  const json = raw as ApiResponse<{
    project: SpecWorkspaceSnapshot["project"];
    specPromptConfig?: SpecPromptConfigRecord;
  }>;
  return { res, json };
}

export async function postSpecWorkspaceAction(
  projectId: string,
  body:
    | { action: "aiRequest"; model?: string; preset?: string; templatePrompt?: string }
    | { action: "confirm"; responseId: string }
    | {
        action: "confirmMerged";
        responseAId: string;
        responseBId: string;
        mergedMarkdown: string;
        selectedSections: Record<string, "A" | "B">;
      }
    | { action: "appendManualSpec"; markdown: string }
    | { action: "refineSpec"; model?: string }
    | { action: "rollbackSpec"; versionId: string }
) {
  const { res, json: raw } = await postSpecWorkspaceRequest(projectId, body);
  const json = raw as ApiResponse<unknown>;
  return { res, json };
}

export * from "./apis/executionSetupApi";
export * from "./apis/executionLoopEnvironmentRunsApi";
export * from "./apis/projectSpecFlowsApi";
