import type { Project } from "@/components/project-spec/types";

/** `PATCH /api/projects/.../spec-workspace` 응답에서 requirements·프로젝트 갱신 경로가 공통으로 쓰는 `data` 형태 */
export type SpecWorkspaceProjectPatchData = {
  project?: Project;
  patchApplied?: boolean;
  message?: string;
};

export type SpecWorkspaceProjectPatchResponseBody = {
  success?: boolean;
  message?: string;
  code?: string;
  data?: SpecWorkspaceProjectPatchData;
};
