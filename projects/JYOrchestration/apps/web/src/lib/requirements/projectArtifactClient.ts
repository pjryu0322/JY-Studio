import type { FeaturePlanningSlotsArtifactV1 } from "@/lib/featurePlanning/featurePlanningSlotsArtifact";
import type { RequirementsServiceFlowV1 } from "@/lib/requirements/requirementsStateJson";
import type { ProjectArtifact, ProjectArtifactType } from "@/lib/requirements/projectArtifactTypes";

export type GenerateProjectArtifactRequest = Readonly<{
  readonly projectId: string;
  readonly artifactType: ProjectArtifactType;
  readonly projectName?: string;
  readonly projectDescription?: string;
  readonly sourceStage?: string | null;
  readonly serviceFlow?: RequirementsServiceFlowV1 | null;
  readonly featurePlanning?: FeaturePlanningSlotsArtifactV1 | null;
}>;

export type GenerateProjectArtifactResponse = Readonly<{
  readonly success: boolean;
  readonly artifact?: ProjectArtifact;
  readonly message?: string;
}>;

export async function fetchGenerateProjectArtifact(
  body: GenerateProjectArtifactRequest,
): Promise<GenerateProjectArtifactResponse> {
  const res = await fetch("/api/requirements/artifacts-generate", {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify(body),
  });
  const json = (await res.json()) as GenerateProjectArtifactResponse & { message?: string };
  if (!res.ok || !json.success || !json.artifact) {
    return { success: false, message: json.message ?? "문서 생성에 실패했습니다." };
  }
  return { success: true, artifact: json.artifact };
}
