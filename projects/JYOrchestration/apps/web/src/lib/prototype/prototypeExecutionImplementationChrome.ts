import type { WorkspaceConversationInterviewUi } from "@/components/workspace/WorkspaceConversationHubIconRow";
import type { ImplementationExecutionBoardV1 } from "@/lib/prototype/implementationExecutionBoard";
import type { ImplementationQuickRunV1 } from "@/lib/prototype/implementationQuickRun";
import type { IdeationDeliverableAsset } from "@/lib/requirements/ideationDeliverables";
import {
  evaluateImplementationSlotsReadiness,
  IMPLEMENTATION_SLOT_META,
  implementationSlotLabel,
  implementationSlotStatusLabel,
  type ImplementationSlot,
  type ImplementationSlotKey,
  type ImplementationSlotOwner,
  type ImplementationSlotStatus,
  type ImplementationSlotsV1,
} from "@/lib/prototype/implementationSlots";
import { buildArtifactHubView } from "@/lib/prototype/artifactHubView";
import type { ProjectArtifactHubEntry } from "@/lib/requirements/projectArtifactHub";
import type { ProjectArtifact } from "@/lib/requirements/projectArtifactTypes";
import type { RequirementsStateJson } from "@/lib/requirements/requirementsStateJson";
import type { OrchestrationSlotSummarySection } from "@/lib/requirements/singleChatOrchestrationSlots";
import type { SingleChatOrchestrationStatusCounts } from "@/lib/requirements/singleChatOrchestrationSlots";

const OWNER_SECTION_TITLES: Record<ImplementationSlotOwner, string> = {
  ai_developer: "AI개발자",
  ai_designer: "AI설계자(참조)",
  ai_reviewer: "AI검수자",
  ai_security: "AI보안관",
  scm: "SCM",
};

const OWNER_SECTION_ORDER: readonly ImplementationSlotOwner[] = [
  "ai_developer",
  "ai_designer",
  "ai_reviewer",
  "ai_security",
  "scm",
];

function implementationSlotStatusToLevel(
  status: ImplementationSlotStatus,
): "filled" | "partial" | "empty" {
  if (status === "confirmed") return "filled";
  if (status === "partial" || status === "candidate" || status === "blocked") return "partial";
  return "empty";
}

function countImplementationSlotStatuses(
  slots: readonly ImplementationSlot[],
): SingleChatOrchestrationStatusCounts {
  let confirmed = 0;
  let partial = 0;
  let candidate = 0;
  let empty = 0;
  for (const s of slots) {
    switch (s.status) {
      case "confirmed":
        confirmed += 1;
        break;
      case "partial":
      case "blocked":
        partial += 1;
        break;
      case "candidate":
        candidate += 1;
        break;
      default:
        empty += 1;
    }
  }
  return { confirmed, partial, candidate, stale: 0, empty, total: slots.length };
}

function buildEmptyImplementationSlotSections(): readonly OrchestrationSlotSummarySection[] {
  const keys = Object.keys(IMPLEMENTATION_SLOT_META) as ImplementationSlotKey[];
  return OWNER_SECTION_ORDER.map((owner) => ({
    sectionTitle: OWNER_SECTION_TITLES[owner],
    slots: keys
      .filter((key) => IMPLEMENTATION_SLOT_META[key].owner === owner)
      .map((key) => ({
        label: IMPLEMENTATION_SLOT_META[key].label,
        level: "empty" as const,
      })),
  })).filter((sec) => sec.slots.length > 0);
}

export function buildImplementationOrchestrationSlotSections(
  slots: ImplementationSlotsV1 | null | undefined,
): readonly OrchestrationSlotSummarySection[] {
  if (!slots?.slots.length) return buildEmptyImplementationSlotSections();
  return OWNER_SECTION_ORDER.map((owner) => ({
    sectionTitle: OWNER_SECTION_TITLES[owner],
    slots: slots.slots
      .filter((s) => s.owner === owner)
      .map((s) => ({
        label: s.label,
        level: implementationSlotStatusToLevel(s.status),
      })),
  })).filter((sec) => sec.slots.length > 0);
}

export function resolveImplementationTaskExecutionProgress(input: {
  readonly board: ImplementationExecutionBoardV1;
  readonly quickRun?: ImplementationQuickRunV1 | null;
}): Readonly<{ covered: number; total: number; readinessPercent: number }> | null {
  const total = input.board.summary.totalTasks;
  if (total <= 0) return null;

  let completed = input.board.summary.completedTasks;
  const quickRunDone = input.quickRun?.completedTaskIds?.length ?? 0;
  completed = Math.max(completed, quickRunDone);

  const inProgress = input.board.summary.inProgressTasks;
  const covered =
    inProgress > 0 ? Math.min(total, completed + inProgress) : completed;
  const readinessPercent = Math.min(100, Math.round((covered / total) * 100));

  return { covered, total, readinessPercent };
}

export function overlayImplementationInterviewUiWithTaskExecutionProgress(
  base: WorkspaceConversationInterviewUi,
  input: {
    readonly board?: ImplementationExecutionBoardV1 | null;
    readonly quickRun?: ImplementationQuickRunV1 | null;
  },
): WorkspaceConversationInterviewUi {
  const board = input.board;
  if (!board) return base;

  const progress = resolveImplementationTaskExecutionProgress({
    board,
    quickRun: input.quickRun,
  });
  if (!progress) return base;

  return {
    ...base,
    readinessPercent: progress.readinessPercent,
    covered: progress.covered,
    total: progress.total,
    statusCounts: null,
    progressCountKind: "tasks",
  };
}

export function buildImplementationSlotsInterviewUi(input: {
  readonly implementationSlotsV1: ImplementationSlotsV1 | null | undefined;
  readonly onQuickExecution: () => void;
}): WorkspaceConversationInterviewUi {
  const bundle = input.implementationSlotsV1;
  const readiness = bundle
    ? bundle.readiness
    : evaluateImplementationSlotsReadiness(null);
  const slotRows = bundle?.slots ?? [];
  const statusCounts = slotRows.length ? countImplementationSlotStatuses(slotRows) : null;
  const percent =
    readiness.required > 0
      ? Math.min(100, Math.round((readiness.confirmed / readiness.required) * 100))
      : 0;

  const slotCellHints: Record<string, string> = {};
  for (const row of slotRows) {
    const preview = formatImplementationSlotValuePreview(row);
    slotCellHints[row.label] = `${implementationSlotStatusLabel(row.status)} · ${preview}`;
  }

  return {
    readinessPercent: percent,
    covered: readiness.confirmed,
    total: readiness.required,
    statusCounts,
    remainingQuestionsEstimate: readiness.missing.length,
    onForceGeneratePlanNow: input.onQuickExecution,
    orchestrationSlotSections: buildImplementationOrchestrationSlotSections(bundle),
    slotCellHints: Object.keys(slotCellHints).length ? slotCellHints : null,
  };
}

export function buildImplementationPhaseArtifactHubCatalog(input: {
  readonly state: RequirementsStateJson;
  readonly projectId?: string;
  readonly deliverableAssets?: readonly IdeationDeliverableAsset[];
  readonly projectArtifacts?: readonly ProjectArtifact[];
}): readonly ProjectArtifactHubEntry[] {
  const view = buildArtifactHubView({
    mode: "implementation",
    state: input.state,
    projectId: input.projectId ?? input.state.implementationTaskPlanV1?.projectId ?? "",
    deliverableAssets: input.deliverableAssets,
    projectArtifacts: input.projectArtifacts,
  });
  return view.entries;
}

export function formatImplementationSlotValuePreview(slot: ImplementationSlot): string {
  const v = slot.value;
  if (v === null || v === undefined) return "(없음)";
  if (typeof v === "boolean") return v ? "예" : "아니오";
  if (typeof v === "string") return v.length > 120 ? `${v.slice(0, 117)}…` : v;
  if (Array.isArray(v)) {
    const lines = v.map(String).filter(Boolean);
    if (!lines.length) return "(없음)";
    return lines.length <= 3 ? lines.join(", ") : `${lines.slice(0, 3).join(", ")} 외 ${lines.length - 3}건`;
  }
  return JSON.stringify(v).slice(0, 80);
}

export function buildImplementationSlotsMissingLabels(
  slots: ImplementationSlotsV1 | null | undefined,
): readonly string[] {
  const readiness = slots ? slots.readiness : evaluateImplementationSlotsReadiness(slots);
  return readiness.missing.map((key) => implementationSlotLabel(key));
}
