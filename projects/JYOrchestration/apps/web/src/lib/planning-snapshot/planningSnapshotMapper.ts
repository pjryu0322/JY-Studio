import { createHash } from "node:crypto";
import type { PlanningSnapshotModel } from "@/lib/planning-snapshot/planningSnapshotModel";
import { PLANNING_SNAPSHOT_CREATED_BY } from "@/lib/planning-snapshot/planningSnapshotModel";
import type { RequirementsStateJson } from "@/lib/requirements/requirementsStateJson";
import type { RequirementsSingleChatOrchestrationStateV1 } from "@/lib/requirements/singleChatOrchestrationTypes";
import type { SingleChatOrchestrationSlotDefinition } from "@/lib/requirements/singleChatOrchestrationTypes";

function splitBulletLines(text: string | null | undefined, max = 12): string[] {
  const lines = String(text ?? "")
    .split(/\n+/)
    .map((s) => s.trim())
    .filter(Boolean);
  const out: string[] = [];
  for (const line of lines) {
    if (line.startsWith("- ")) out.push(line.slice(2).trim());
    else if (/^[-*•]\s+/.test(line)) out.push(line.replace(/^[-*•]\s+/, "").trim());
    else out.push(line);
    if (out.length >= max) break;
  }
  return out.filter(Boolean).slice(0, max);
}

function slotValueEndingWith(
  orchestration: RequirementsSingleChatOrchestrationStateV1 | null | undefined,
  definitions: readonly SingleChatOrchestrationSlotDefinition[],
  suffix: string,
): string {
  if (!orchestration) return "";
  const key = definitions.find((d) => d.slotKey.endsWith(suffix))?.slotKey;
  if (!key) return "";
  return String(orchestration.slots[key]?.value ?? "").trim();
}

function parseActorNamesFromText(text: string): string[] {
  const raw = String(text ?? "").trim();
  if (!raw) return [];
  const parts = raw
    .split(/[,、·/|]|\n+/)
    .map((s) => s.replace(/^[-*•]\s+/, "").trim())
    .filter(Boolean);
  if (parts.length > 1) return parts.slice(0, 8);
  return splitBulletLines(raw, 8);
}

function parseFeaturesFromText(text: string): string[] {
  return splitBulletLines(text, 12);
}

function parseScopeLines(text: string): { included: string[]; excluded: string[] } {
  const included: string[] = [];
  const excluded: string[] = [];
  for (const line of splitBulletLines(text, 16)) {
    if (/제외|하지 않|빼고/i.test(line)) excluded.push(line);
    else included.push(line);
  }
  return { included, excluded };
}

export function mapPlanningSnapshotFromRequirementsContext(input: Readonly<{
  readonly projectId: string;
  readonly projectName: string;
  readonly projectDescription?: string | null;
  readonly state: RequirementsStateJson;
  readonly sourceMessageId: string;
  readonly orchestration?: RequirementsSingleChatOrchestrationStateV1 | null;
  readonly definitions?: readonly SingleChatOrchestrationSlotDefinition[];
}>): PlanningSnapshotModel {
  const pid = String(input.projectId).trim();
  const defs = input.definitions ?? [];
  const orch = input.orchestration ?? input.state.singleChatOrchestrationV1 ?? null;

  const productName = String(input.projectName ?? "").trim() || "프로젝트";
  const purpose = slotValueEndingWith(orch, defs, ".planning.servicePurpose");
  const problemSlot = slotValueEndingWith(orch, defs, ".planning.problem");
  const description =
    String(input.projectDescription ?? "").trim() ||
    String(input.state.originalProjectDescription ?? "").trim();
  const summary =
    purpose ||
    splitBulletLines(description, 1)[0] ||
    String(input.state.lastUserDraftText ?? "").trim().slice(0, 400) ||
    productName;

  const coreUsers = slotValueEndingWith(orch, defs, ".planning.coreUsers");
  let actors = parseActorNamesFromText(coreUsers);

  const featuresText =
    slotValueEndingWith(orch, defs, ".design.coreFeatures") ||
    slotValueEndingWith(orch, defs, ".design.featurePriority") ||
    String(input.state.priorityFeatures ?? "").trim();
  let features = parseFeaturesFromText(featuresText);
  if (!features.length) {
    features = splitBulletLines(input.state.priorityFeatures, 8);
  }

  const mvpScope = slotValueEndingWith(orch, defs, ".planning.mvpScope");
  const scope = parseScopeLines(mvpScope || description);

  const successCriteria = splitBulletLines(
    slotValueEndingWith(orch, defs, ".planning.successCriteria"),
    6,
  );

  const problems: string[] = [];
  if (problemSlot) problems.push(problemSlot.slice(0, 500));
  else {
    const fromDesc = splitBulletLines(description, 3).filter((l) => /문제|불편|과제|pain/i.test(l));
    if (fromDesc.length) problems.push(...fromDesc);
    else if (description.length > 20) problems.push(description.slice(0, 280));
  }

  return {
    projectId: pid,
    productName,
    summary: summary.slice(0, 500),
    problems: problems.slice(0, 8),
    actors: actors.slice(0, 8),
    features: features.slice(0, 12),
    scope: {
      included: scope.included.slice(0, 8),
      excluded: scope.excluded.slice(0, 8),
    },
    successCriteria: successCriteria.slice(0, 8),
    sourceMessageId: String(input.sourceMessageId).trim(),
    createdBy: PLANNING_SNAPSHOT_CREATED_BY,
  };
}

export function planningSnapshotPayloadFromModel(snapshot: PlanningSnapshotModel): Record<string, unknown> {
  return {
    projectId: snapshot.projectId,
    productName: snapshot.productName,
    summary: snapshot.summary,
    problems: [...snapshot.problems],
    actors: [...snapshot.actors],
    features: [...snapshot.features],
    scope: {
      included: [...snapshot.scope.included],
      excluded: [...snapshot.scope.excluded],
    },
    successCriteria: [...snapshot.successCriteria],
    sourceMessageId: snapshot.sourceMessageId,
    createdBy: snapshot.createdBy,
  };
}

export function snapshotEntitySlug(text: string): string {
  const norm = String(text ?? "")
    .toLowerCase()
    .replace(/\s+/g, " ")
    .trim();
  return createHash("sha256").update(norm).digest("hex").slice(0, 16);
}
