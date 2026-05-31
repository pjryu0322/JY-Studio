import type { CursorWorkItem } from "@/lib/prototype/implementationCursorWorkItems";
import { evaluateCursorWorkItemQuality } from "@/lib/prototype/implementationCursorPromptQuality";
import {
  buildImplementationTaskExecutionHints,
  type ImplementationTaskExecutionHints,
} from "@/lib/prototype/implementationExecutionHints";
import type {
  ImplementationTaskPlanItem,
  ImplementationTaskPlanV1,
  ImplementationTaskPriority,
  ImplementationTaskStatus,
} from "@/lib/prototype/implementationTaskPlan";

const PLAN_VERSION = "implementation_task_plan_v1";
const PRIORITIES = new Set<ImplementationTaskPriority>(["P0", "P1", "P2"]);
const STATUSES = new Set<ImplementationTaskStatus>([
  "draft",
  "ready",
  "blocked",
  "running",
  "done",
  "failed",
]);

function parseStringArray(raw: unknown): string[] {
  return Array.isArray(raw) ? raw.map((x) => String(x)).filter(Boolean) : [];
}

function parseExecutionHints(raw: unknown, fallbackTitle: string): ImplementationTaskExecutionHints {
  if (!raw || typeof raw !== "object") {
    return buildImplementationTaskExecutionHints({
      taskTitle: fallbackTitle,
      sourceArtifactTypes: [],
      projectArtifacts: [],
    });
  }
  const o = raw as Record<string, unknown>;
  const base = buildImplementationTaskExecutionHints({
    taskTitle: fallbackTitle,
    sourceArtifactTypes: [],
    projectArtifacts: [],
  });
  return {
    candidateDirectories: parseStringArray(o.candidateDirectories).length
      ? parseStringArray(o.candidateDirectories)
      : base.candidateDirectories,
    candidateFiles: parseStringArray(o.candidateFiles).length ? parseStringArray(o.candidateFiles) : base.candidateFiles,
    candidateApiRoutes: parseStringArray(o.candidateApiRoutes).length
      ? parseStringArray(o.candidateApiRoutes)
      : base.candidateApiRoutes,
    candidateComponents: parseStringArray(o.candidateComponents).length
      ? parseStringArray(o.candidateComponents)
      : base.candidateComponents,
    candidateTests: parseStringArray(o.candidateTests).length ? parseStringArray(o.candidateTests) : base.candidateTests,
    forbiddenPaths: parseStringArray(o.forbiddenPaths).length ? parseStringArray(o.forbiddenPaths) : base.forbiddenPaths,
    testCommands: parseStringArray(o.testCommands).length ? parseStringArray(o.testCommands) : base.testCommands,
    manualVerification: parseStringArray(o.manualVerification).length
      ? parseStringArray(o.manualVerification)
      : base.manualVerification,
    expectedBehavior: parseStringArray(o.expectedBehavior).length
      ? parseStringArray(o.expectedBehavior)
      : base.expectedBehavior,
    regressionScope: parseStringArray(o.regressionScope).length
      ? parseStringArray(o.regressionScope)
      : base.regressionScope,
  };
}

function parseTaskItem(raw: unknown): ImplementationTaskPlanItem | null {
  if (!raw || typeof raw !== "object") return null;
  const o = raw as Record<string, unknown>;
  const id = String(o.id ?? "").trim();
  const title = String(o.title ?? "").trim();
  if (!id || !title) return null;
  const priority = String(o.priority ?? "P1").trim() as ImplementationTaskPriority;
  const status = String(o.status ?? "draft").trim() as ImplementationTaskStatus;
  const sourceArtifactTypes = parseStringArray(o.sourceArtifactTypes);
  const executionHints = parseExecutionHints(o.executionHints, title);
  return {
    id,
    title,
    description: String(o.description ?? "").trim() || title,
    priority: PRIORITIES.has(priority) ? priority : "P1",
    sourceArtifactTypes,
    sourceRoles: parseStringArray(o.sourceRoles),
    acceptanceCriteria: parseStringArray(o.acceptanceCriteria),
    securityChecks: parseStringArray(o.securityChecks),
    reviewChecks: parseStringArray(o.reviewChecks),
    executionHints,
    cursorPromptDraft: String(o.cursorPromptDraft ?? "").trim(),
    status: STATUSES.has(status) ? status : "draft",
    blockers: parseStringArray(o.blockers),
  };
}

export function parseImplementationTaskPlanV1(raw: unknown): ImplementationTaskPlanV1 | null | undefined {
  if (raw === undefined) return undefined;
  if (raw === null) return null;
  if (!raw || typeof raw !== "object") return null;
  const o = raw as Record<string, unknown>;
  if (String(o.version ?? "") !== PLAN_VERSION) return null;
  const projectId = String(o.projectId ?? "").trim();
  const createdAt = String(o.createdAt ?? "").trim();
  if (!projectId || !createdAt) return null;
  const itemsRaw = Array.isArray(o.items) ? o.items : [];
  const items = itemsRaw.map(parseTaskItem).filter((x): x is ImplementationTaskPlanItem => Boolean(x));
  const r = o.readiness;
  let readiness = { ready: false, missing: [] as string[] };
  if (r && typeof r === "object") {
    const ro = r as Record<string, unknown>;
    readiness = {
      ready: Boolean(ro.ready),
      missing: Array.isArray(ro.missing) ? ro.missing.map((x) => String(x)).filter(Boolean) : [],
    };
  }
  return {
    version: PLAN_VERSION,
    projectId,
    createdAt,
    source: "implementation_orchestration",
    items,
    readiness,
  };
}

function parseQualityGate(raw: unknown, item: CursorWorkItem): CursorWorkItem["qualityGate"] {
  if (!raw || typeof raw !== "object") return evaluateCursorWorkItemQuality(item);
  const o = raw as Record<string, unknown>;
  const score = typeof o.score === "number" ? o.score : Number(o.score);
  const missing = parseStringArray(o.missing);
  const promptReady = Boolean(o.promptReady);
  if (Number.isFinite(score)) {
    return { promptReady, missing, score };
  }
  return evaluateCursorWorkItemQuality(item);
}

export function parseCursorWorkItemsV1(raw: unknown): readonly CursorWorkItem[] | null | undefined {
  if (raw === undefined) return undefined;
  if (raw === null) return null;
  if (!Array.isArray(raw)) return null;
  const out: CursorWorkItem[] = [];
  for (const row of raw) {
    if (!row || typeof row !== "object") continue;
    const o = row as Record<string, unknown>;
    const id = String(o.id ?? "").trim();
    const taskId = String(o.taskId ?? "").trim();
    const title = String(o.title ?? "").trim();
    if (!id || !taskId || !title) continue;
    const draft: CursorWorkItem = {
      id,
      taskId,
      title,
      prompt: String(o.prompt ?? "").trim(),
      requiredFilesHint: parseStringArray(o.requiredFilesHint),
      expectedOutput: parseStringArray(o.expectedOutput),
      testCommands: parseStringArray(o.testCommands),
      forbiddenPaths: parseStringArray(o.forbiddenPaths),
      blocked: Boolean(o.blocked),
      blockers: parseStringArray(o.blockers),
      qualityGate: { promptReady: false, missing: [], score: 0 },
      ...(typeof o.objective === "string" && o.objective.trim() ? { objective: o.objective.trim() } : {}),
      ...(typeof o.expectedChange === "string" && o.expectedChange.trim()
        ? { expectedChange: o.expectedChange.trim() }
        : {}),
      ...(parseStringArray(o.candidateFiles).length ? { candidateFiles: parseStringArray(o.candidateFiles) } : {}),
      ...(parseStringArray(o.candidateFileHints).length
        ? { candidateFileHints: parseStringArray(o.candidateFileHints) }
        : {}),
      ...(parseStringArray(o.acceptanceCriteria).length
        ? { acceptanceCriteria: parseStringArray(o.acceptanceCriteria) }
        : {}),
      ...(parseStringArray(o.verificationHints).length
        ? { verificationHints: parseStringArray(o.verificationHints) }
        : {}),
      ...(parseStringArray(o.allowedPathHints).length
        ? { allowedPathHints: parseStringArray(o.allowedPathHints) }
        : {}),
      ...(typeof o.noCodeChangeEvidenceRequired === "boolean"
        ? { noCodeChangeEvidenceRequired: o.noCodeChangeEvidenceRequired }
        : {}),
      ...(o.originStage === "planning" || o.originStage === "implementation"
        ? { originStage: o.originStage }
        : {}),
      ...(o.refinementStatus === "draft" ||
      o.refinementStatus === "source_refined" ||
      o.refinementStatus === "preflight_passed" ||
      o.refinementStatus === "preflight_failed"
        ? { refinementStatus: o.refinementStatus }
        : {}),
      ...(typeof o.sourceRefinedAt === "string" && o.sourceRefinedAt.trim()
        ? { sourceRefinedAt: o.sourceRefinedAt.trim() }
        : {}),
    };
    out.push({ ...draft, qualityGate: parseQualityGate(o.qualityGate, draft) });
  }
  return out;
}
