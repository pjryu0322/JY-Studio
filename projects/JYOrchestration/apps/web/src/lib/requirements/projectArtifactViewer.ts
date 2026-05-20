import type { IdeationDeliverableAsset } from "@/lib/requirements/ideationDeliverables";
import type { ProjectArtifact } from "@/lib/requirements/projectArtifactTypes";

/** Canvas / Artifact viewer 호환용 deliverable shape */
export function projectArtifactToDeliverableAsset(
  artifact: ProjectArtifact,
  projectId: string,
): IdeationDeliverableAsset {
  return {
    id: artifact.id,
    projectId,
    type: "full_plan",
    title: artifact.title,
    version: 1,
    content: artifact.content,
    createdAt: artifact.createdAt,
  };
}
