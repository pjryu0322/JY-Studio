import type { PlanningSnapshotV1Wire } from "@/lib/planning-snapshot/planningSnapshotModel";
import type {
  RequirementsServiceFlowActorV1,
  RequirementsStateJson,
} from "@/lib/requirements/requirementsStateJson";
import { randomUUID } from "node:crypto";

function newActorId(): string {
  return `snap_${randomUUID().replace(/-/g, "").slice(0, 12)}`;
}

export function mergeDownstreamStateFromPlanningSnapshot(
  state: RequirementsStateJson,
  snapshot: PlanningSnapshotV1Wire,
): Partial<RequirementsStateJson> {
  const patch: Partial<RequirementsStateJson> = {
    planningSnapshotV1: snapshot,
  };

  const now = new Date().toISOString();
  const flow = state.serviceFlowV1;
  if (snapshot.actors.length > 0 && (!flow || flow.actors.length === 0)) {
    const actors: RequirementsServiceFlowActorV1[] = snapshot.actors.map((name) => ({
      id: newActorId(),
      name: name.slice(0, 120),
      kind: "human",
      status: "candidate",
      description: "AI 기획자 초기 정리에서 제안된 액터",
    }));
    patch.serviceFlowV1 = {
      ...(flow ?? { createdAt: now, updatedAt: now, steps: [], actors: [] }),
      actors,
      updatedAt: now,
    };
  }

  if (snapshot.features.length > 0 && !String(state.priorityFeatures ?? "").trim()) {
    patch.priorityFeatures = snapshot.features.map((f) => `- ${f}`).join("\n").slice(0, 4000);
  }

  return patch;
}
