import {
  ApiResponse,
  ParseResult,
  Project,
  TaskItem,
  TaskGenerateResult,
  UploadHistoryItem,
  UploadResult,
} from "./types";

export async function fetchProjectById(projectId: string): Promise<{
  project: Project | null;
  errorMessage: string | null;
}> {
  const res = await fetch("/api/projects");
  const json = (await res.json()) as ApiResponse<Project[]>;

  if (!res.ok || !json.success || !Array.isArray(json.data)) {
    return {
      project: null,
      errorMessage: json.message || "프로젝트 정보를 불러오지 못했습니다.",
    };
  }

  const target = json.data.find((item) => item.id === projectId) || null;
  if (!target) {
    return {
      project: null,
      errorMessage: "존재하지 않는 프로젝트입니다.",
    };
  }

  return {
    project: target,
    errorMessage: null,
  };
}

export async function fetchProjectSpecUploadHistory(projectId: string) {
  const encodedProjectId = encodeURIComponent(projectId);
  const res = await fetch(`/api/project-spec/list?projectId=${encodedProjectId}`);
  const json = (await res.json()) as ApiResponse<UploadHistoryItem[]>;
  return { res, json };
}

export async function uploadProjectSpecTestFile(formData: FormData, projectId: string) {
  const encodedProjectId = encodeURIComponent(projectId);
  const res = await fetch(`/api/project-spec/upload?projectId=${encodedProjectId}`, {
    method: "POST",
    body: formData,
  });

  const json = (await res.json()) as ApiResponse<UploadResult>;
  return { res, json };
}

export async function runProjectSpecMockParse(projectSpecUploadId: string) {
  const res = await fetch("/api/project-spec/parse", {
    method: "POST",
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
  const res = await fetch(`/api/task/generate?projectId=${encodedProjectId}`);
  const json = (await res.json()) as ApiResponse<TaskItem[]>;
  return { res, json };
}
