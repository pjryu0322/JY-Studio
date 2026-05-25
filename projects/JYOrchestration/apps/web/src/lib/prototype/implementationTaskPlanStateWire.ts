import type { CursorWorkItem } from "@/lib/prototype/implementationCursorWorkItems";
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

function parseTaskItem(raw: unknown): ImplementationTaskPlanItem | null {
  if (!raw || typeof raw !== "object") return null;
  const o = raw as Record<string, unknown>;
  const id = String(o.id ?? "").trim();
  const title = String(o.title ?? "").trim();
  if (!id || !title) return null;
  const priority = String(o.priority ?? "P1").trim() as ImplementationTaskPriority;
  const status = String(o.status ?? "draft").trim() as ImplementationTaskStatus;
  return {
    id,
    title,
    description: String(o.description ?? "").trim() || title,
    priority: PRIORITIES.has(priority) ? priority : "P1",
    sourceArtifactTypes: Array.isArray(o.sourceArtifactTypes)
      ? o.sourceArtifactTypes.map((x) => String(x)).filter(Boolean)
      : [],
    sourceRoles: Array.isArray(o.sourceRoles) ? o.sourceRoles.map((x) => String(x)).filter(Boolean) : [],
    acceptanceCriteria: Array.isArray(o.acceptanceCriteria)
      ? o.acceptanceCriteria.map((x) => String(x)).filter(Boolean)
      : [],
    securityChecks: Array.isArray(o.securityChecks) ? o.securityChecks.map((x) => String(x)).filter(Boolean) : [],
    reviewChecks: Array.isArray(o.reviewChecks) ? o.reviewChecks.map((x) => String(x)).filter(Boolean) : [],
    cursorPromptDraft: String(o.cursorPromptDraft ?? "").trim(),
    status: STATUSES.has(status) ? status : "draft",
    blockers: Array.isArray(o.blockers) ? o.blockers.map((x) => String(x)).filter(Boolean) : [],
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
    out.push({
      id,
      taskId,
      title,
      prompt: String(o.prompt ?? "").trim(),
      requiredFilesHint: Array.isArray(o.requiredFilesHint)
        ? o.requiredFilesHint.map((x) => String(x)).filter(Boolean)
        : [],
      expectedOutput: Array.isArray(o.expectedOutput) ? o.expectedOutput.map((x) => String(x)).filter(Boolean) : [],
      blocked: Boolean(o.blocked),
      blockers: Array.isArray(o.blockers) ? o.blockers.map((x) => String(x)).filter(Boolean) : [],
    });
  }
  return out;
}
