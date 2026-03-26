import {
  ApiResponse,
  ParseResult,
  Project,
  ProjectSpecPromptRecord,
  ProjectSpecResponseRecord,
  TaskItem,
  TaskGenerateResult,
  UploadHistoryItem,
  UploadResult,
} from "./types";

export async function fetchProjectById(projectId: string): Promise<{
  project: Project | null;
  errorMessage: string | null;
}> {
  const encoded = encodeURIComponent(projectId);
  const res = await fetch(`/api/projects/${encoded}`, { credentials: "include" });
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

export async function fetchProjectSpecUploadHistory(projectId: string) {
  const encodedProjectId = encodeURIComponent(projectId);
  const res = await fetch(`/api/project-spec/list?projectId=${encodedProjectId}`, {
    credentials: "include",
  });
  const json = (await res.json()) as ApiResponse<UploadHistoryItem[]>;
  return { res, json };
}

export async function uploadProjectSpecTestFile(formData: FormData, projectId: string) {
  const encodedProjectId = encodeURIComponent(projectId);
  const res = await fetch(`/api/project-spec/upload?projectId=${encodedProjectId}`, {
    method: "POST",
    credentials: "include",
    body: formData,
  });

  const json = (await res.json()) as ApiResponse<UploadResult>;
  return { res, json };
}

export async function runProjectSpecMockParse(projectSpecUploadId: string) {
  const res = await fetch("/api/project-spec/parse", {
    method: "POST",
    credentials: "include",
    headers: {
      "Content-Type": "application/json",
    },
    body: JSON.stringify({ projectSpecUploadId }),
  });

  const json = (await res.json()) as ApiResponse<ParseResult>;
  return { res, json };
}

export async function generateTasksFromParsedSpec(projectSpecUploadId: string) {
  const res = await fetch("/api/task/generate", {
    method: "POST",
    credentials: "include",
    headers: {
      "Content-Type": "application/json",
    },
    body: JSON.stringify({ projectSpecUploadId }),
  });

  const json = (await res.json()) as ApiResponse<TaskGenerateResult>;
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
    | "confirmedSpecMarkdown"
    | "confirmedSpecResponseId"
    | "confirmedSpecAt"
  >;
  prompts: ProjectSpecPromptRecord[];
  responses: ProjectSpecResponseRecord[];
};

export async function fetchSpecWorkspace(projectId: string) {
  const encoded = encodeURIComponent(projectId);
  const res = await fetch(`/api/projects/${encoded}/spec-workspace`, { credentials: "include" });
  const json = (await res.json()) as ApiResponse<SpecWorkspaceSnapshot>;
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
  }>
) {
  const encoded = encodeURIComponent(projectId);
  const res = await fetch(`/api/projects/${encoded}/spec-workspace`, {
    method: "PATCH",
    credentials: "include",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify(body),
  });
  const json = (await res.json()) as ApiResponse<{ project: SpecWorkspaceSnapshot["project"] }>;
  return { res, json };
}

export type SpecWorkspaceAiRequestSaveContext = {
  name: string;
  description: string | null;
  projectType: string;
  coreGoals: string | null;
  inScope: string | null;
  outOfScope: string | null;
  targetUsers: string | null;
  successCriteria: string | null;
};

export async function postSpecWorkspaceAction(
  projectId: string,
  body:
    | { action: "regeneratePrompt" }
    | { action: "aiRequest"; promptId?: string; saveContext?: SpecWorkspaceAiRequestSaveContext }
    | { action: "confirm"; responseId: string }
) {
  const encoded = encodeURIComponent(projectId);
  const res = await fetch(`/api/projects/${encoded}/spec-workspace`, {
    method: "POST",
    credentials: "include",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify(body),
  });
  const json = (await res.json()) as ApiResponse<unknown>;
  return { res, json };
}

/** GET /api/project-spec/context */
export type ProjectSpecContextDto = {
  projectId: string;
  name: string;
  description: string | null;
  projectType: string;
  coreGoals: string | null;
  inScope: string | null;
  outOfScope: string | null;
  targetUsers: string | null;
  successCriteria: string | null;
};

export async function fetchProjectSpecContext(projectId: string) {
  const encoded = encodeURIComponent(projectId);
  const res = await fetch(`/api/project-spec/context?projectId=${encoded}`, { credentials: "include" });
  const json = (await res.json()) as ApiResponse<ProjectSpecContextDto>;
  return { res, json };
}

export async function patchProjectSpecContext(body: {
  projectId: string;
  name?: string;
  description?: string | null;
  projectType?: string;
  coreGoals?: string | null;
  inScope?: string | null;
  outOfScope?: string | null;
  targetUsers?: string | null;
  successCriteria?: string | null;
}) {
  const res = await fetch("/api/project-spec/context", {
    method: "PATCH",
    credentials: "include",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify(body),
  });
  const json = (await res.json()) as ApiResponse<ProjectSpecContextDto>;
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
  const res = await fetch("/api/project-spec/context/generate", {
    method: "POST",
    credentials: "include",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify(body),
  });
  const json = (await res.json()) as ApiResponse<GenerateSpecContextResponse>;
  return { res, json };
}
