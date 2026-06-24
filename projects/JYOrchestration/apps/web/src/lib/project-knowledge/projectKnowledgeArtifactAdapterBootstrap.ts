import { registerProjectKnowledgeArtifactAdapter } from "@/lib/project-knowledge/projectKnowledgeArtifactAdapterRegistry";
import { planningSnapshotArtifactAdapter } from "@/lib/project-knowledge/planningSnapshotArtifactAdapter";
import { planningProposalArtifactAdapter } from "@/lib/project-knowledge/planningProposalArtifactAdapter";

let bootstrapped = false;

export function bootstrapProjectKnowledgeArtifactAdapters(): void {
  if (bootstrapped) return;
  bootstrapped = true;
  registerProjectKnowledgeArtifactAdapter(planningSnapshotArtifactAdapter);
  registerProjectKnowledgeArtifactAdapter(planningProposalArtifactAdapter);
}

export function resetProjectKnowledgeArtifactBootstrapForTests(): void {
  bootstrapped = false;
}
