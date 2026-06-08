import { prisma } from "@/lib/prisma";
import {
  mergeRequirementsStateJson,
  parseRequirementsStateJson,
  type RequirementsStateJson,
} from "@/lib/requirements/requirementsStateJson";
import {
  type ImplementationIntegrationStepKindV1,
  type ImplementationIntegrationStepStatusV1,
  type ImplementationIntegrationStepV1,
} from "@/lib/prototype/implementationIntegrationStep";

export const IMPLEMENTATION_INTEGRATION_STEPS_STATE_VERSION =
  "implementation_integration_steps_v1" as const;

export type ImplementationIntegrationStepsStateV1 = Readonly<{
  readonly version: typeof IMPLEMENTATION_INTEGRATION_STEPS_STATE_VERSION;
  readonly projectId: string;
  readonly updatedAt: string;
  readonly steps: readonly ImplementationIntegrationStepV1[];
}>;

const STEP_KINDS = new Set<ImplementationIntegrationStepKindV1>([
  "final_wiring",
  "integration_branch",
  "build",
  "app_preview_target",
]);
const STEP_STATUSES = new Set<ImplementationIntegrationStepStatusV1>([
  "pending",
  "ready",
  "running",
  "completed",
  "failed",
  "skipped",
]);

function readString(value: unknown): string {
  return String(value ?? "").trim();
}

function parseStep(raw: unknown): ImplementationIntegrationStepV1 | null {
  if (!raw || typeof raw !== "object") return null;
  const o = raw as Record<string, unknown>;
  const stepId = readString(o.stepId);
  const kind = readString(o.kind) as ImplementationIntegrationStepKindV1;
  const status = readString(o.status) as ImplementationIntegrationStepStatusV1;
  const title = readString(o.title);
  if (!stepId || !STEP_KINDS.has(kind) || !STEP_STATUSES.has(status) || !title) return null;
  return {
    stepId,
    kind,
    title,
    status,
    order: Number(o.order) || 0,
    ...(readString(o.branchGroup) === "integration" ? { branchGroup: "integration" as const } : {}),
    ...(o.baseBranch != null ? { baseBranch: readString(o.baseBranch) || null } : {}),
    ...(o.workBranch != null ? { workBranch: readString(o.workBranch) || null } : {}),
    ...(o.startedAt != null ? { startedAt: readString(o.startedAt) || null } : {}),
    ...(o.completedAt != null ? { completedAt: readString(o.completedAt) || null } : {}),
    ...(o.failedAt != null ? { failedAt: readString(o.failedAt) || null } : {}),
    ...(o.commitSha != null ? { commitSha: readString(o.commitSha) || null } : {}),
    ...(o.errorCode != null ? { errorCode: readString(o.errorCode) || null } : {}),
    ...(o.errorMessage != null ? { errorMessage: readString(o.errorMessage) || null } : {}),
  };
}

export function parseImplementationIntegrationStepsStateV1(
  raw: unknown,
): ImplementationIntegrationStepsStateV1 | null | undefined {
  if (raw === undefined) return undefined;
  if (raw === null) return null;
  if (!raw || typeof raw !== "object") return null;
  const o = raw as Record<string, unknown>;
  if (readString(o.version) !== IMPLEMENTATION_INTEGRATION_STEPS_STATE_VERSION) return null;
  const projectId = readString(o.projectId);
  const updatedAt = readString(o.updatedAt);
  if (!projectId || !updatedAt) return null;
  const steps: ImplementationIntegrationStepV1[] = [];
  for (const row of Array.isArray(o.steps) ? o.steps : []) {
    const step = parseStep(row);
    if (step) steps.push(step);
  }
  return {
    version: IMPLEMENTATION_INTEGRATION_STEPS_STATE_VERSION,
    projectId,
    updatedAt,
    steps,
  };
}

export function loadImplementationIntegrationStepsFromState(
  state: RequirementsStateJson | null | undefined,
): readonly ImplementationIntegrationStepV1[] {
  return state?.implementationIntegrationStepsV1?.steps ?? [];
}

export function saveImplementationIntegrationStepsToState(input: {
  readonly projectId: string;
  readonly steps: readonly ImplementationIntegrationStepV1[];
  readonly reason: string;
  readonly nowIso?: string;
}): Partial<RequirementsStateJson> {
  const nowIso = input.nowIso ?? new Date().toISOString();
  const pid = input.projectId.trim();
  return {
    implementationIntegrationStepsV1: {
      version: IMPLEMENTATION_INTEGRATION_STEPS_STATE_VERSION,
      projectId: pid,
      updatedAt: nowIso,
      steps: [...input.steps],
    },
  };
}

export async function loadImplementationIntegrationSteps(input: {
  readonly projectId: string;
}): Promise<readonly ImplementationIntegrationStepV1[]> {
  const row = await prisma.project.findUnique({
    where: { id: input.projectId.trim() },
    select: { requirementsStateJson: true },
  });
  const state = parseRequirementsStateJson(row?.requirementsStateJson) ?? {};
  return loadImplementationIntegrationStepsFromState(state);
}

export async function saveImplementationIntegrationSteps(input: {
  readonly projectId: string;
  readonly steps: readonly ImplementationIntegrationStepV1[];
  readonly reason: string;
  readonly nowIso?: string;
}): Promise<void> {
  const pid = input.projectId.trim();
  const row = await prisma.project.findUnique({
    where: { id: pid },
    select: { requirementsStateJson: true },
  });
  const state = parseRequirementsStateJson(row?.requirementsStateJson) ?? {};
  const patch = saveImplementationIntegrationStepsToState(input);
  await prisma.project.update({
    where: { id: pid },
    data: {
      requirementsStateJson: mergeRequirementsStateJson(state, patch) as object,
    },
  });
}

export async function patchImplementationIntegrationStep(input: {
  readonly projectId: string;
  readonly stepId: string;
  readonly patch: Partial<ImplementationIntegrationStepV1>;
  readonly reason: string;
  readonly nowIso?: string;
}): Promise<ImplementationIntegrationStepV1> {
  const pid = input.projectId.trim();
  const stepId = input.stepId.trim();
  const nowIso = input.nowIso ?? new Date().toISOString();
  const existing = await loadImplementationIntegrationSteps({ projectId: pid });
  const idx = existing.findIndex((s) => s.stepId === stepId);
  if (idx < 0) {
    throw new Error(`integration_step_not_found:${stepId}`);
  }
  const next = { ...existing[idx]!, ...input.patch, stepId, order: existing[idx]!.order };
  const steps = [...existing];
  steps[idx] = next;
  await saveImplementationIntegrationSteps({
    projectId: pid,
    steps,
    reason: input.reason,
    nowIso,
  });
  return next;
}

export function findIntegrationStepByKind(
  steps: readonly ImplementationIntegrationStepV1[],
  kind: ImplementationIntegrationStepKindV1,
): ImplementationIntegrationStepV1 | null {
  return steps.find((s) => s.kind === kind) ?? null;
}
