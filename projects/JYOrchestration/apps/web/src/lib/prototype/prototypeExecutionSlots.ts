import { resolveFocusWorkUnit, workUnitProgressAllMerged } from "@/components/preview/prototypePreviewPanelHelpers";
import type { PrototypeExecutionSlot, PrototypeRun, PrototypeWorkUnit } from "@/lib/prototype/prototypeRunTypes";

function workUnitSlotStatus(wu: PrototypeWorkUnit, focus: PrototypeWorkUnit | null): PrototypeExecutionSlot["status"] {
  if (wu.status === "MERGED" || wu.status === "SKIPPED") return "DONE";
  if (wu.status === "FAILED") return "FAILED";
  if (focus && focus.id === wu.id) return "RUNNING";
  if (wu.status === "PENDING") return "WAITING";
  return focus && focus.order === wu.order ? "RUNNING" : "WAITING";
}

function deploySlotForRun(run: PrototypeRun): PrototypeExecutionSlot | null {
  if (!workUnitProgressAllMerged(run)) return null;
  const s = run.status;
  if (
    s !== "MERGED" &&
    s !== "DEPLOY_CONFIGURING" &&
    s !== "DEPLOYING" &&
    s !== "PREVIEW_READY" &&
    s !== "DEPLOY_FAILED"
  ) {
    return null;
  }

  let status: PrototypeExecutionSlot["status"] = "WAITING";
  let errorMessage: string | undefined;
  if (s === "PREVIEW_READY") status = "DONE";
  else if (s === "DEPLOY_FAILED") {
    status = "FAILED";
    errorMessage = run.deployFailureDetail?.trim() || run.statusReason || undefined;
  } else if (s === "DEPLOYING" || s === "DEPLOY_CONFIGURING") status = "RUNNING";
  else if (s === "MERGED") status = "WAITING";

  const startedAt = run.deploymentStartedAt ?? undefined;
  const completedAt = run.deploymentEndedAt ?? undefined;

  return {
    id: `${run.id}:slot:deploy`,
    runId: run.id,
    slotType: "DEPLOY",
    slotOrder: 9_000,
    status,
    startedAt,
    completedAt,
    errorMessage,
  };
}

function reviewSlotForRun(run: PrototypeRun, baseOrder: number): PrototypeExecutionSlot | null {
  if (run.status !== "AI_REVIEWING") return null;
  return {
    id: `${run.id}:slot:review-run`,
    runId: run.id,
    slotType: "REVIEW",
    slotOrder: baseOrder,
    status: "RUNNING",
  };
}

/** 서버 저장 없이 `PrototypeRun`으로부터 실행·배포 슬롯 스냅샷을 만듭니다. */
export function computePrototypeExecutionSlots(run: PrototypeRun | null): PrototypeExecutionSlot[] {
  if (!run?.id || !run.workUnits?.length) return [];
  const sorted = [...run.workUnits].sort((a, b) => a.order - b.order);
  const focus = resolveFocusWorkUnit(run);
  const slots: PrototypeExecutionSlot[] = sorted.map((wu, idx) => ({
    id: `${run.id}:slot:wu:${wu.order}`,
    runId: run.id,
    slotType: "WORKUNIT" as const,
    slotOrder: idx + 1,
    status: workUnitSlotStatus(wu, focus),
    workUnitId: wu.id,
    startedAt: wu.executionStartedAt ?? wu.startedAt ?? undefined,
    completedAt: wu.executionCompletedAt ?? wu.finishedAt ?? undefined,
    errorMessage: wu.status === "FAILED" ? "WORK_UNIT_FAILED" : undefined,
  }));

  const deploy = deploySlotForRun(run);
  if (deploy) slots.push(deploy);

  const rev = reviewSlotForRun(run, slots.length + 1);
  if (rev) slots.push(rev);

  return slots;
}
