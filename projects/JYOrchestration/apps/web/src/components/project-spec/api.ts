import { ApiResponse, Project, UploadResult } from "./types";

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

export async function uploadProjectSpecTestFile(file: File) {
  const formData = new FormData();
  formData.append("file", file);

  const res = await fetch("/api/project-spec/upload", {
    method: "POST",
    body: formData,
  });

  const json = (await res.json()) as ApiResponse<UploadResult>;
  return { res, json };
}
