import type { ImplementationCodeTaskQualityGateV1 } from "@/lib/prototype/implementationCodeTaskQualityGate";
import type { CursorWorkItem } from "@/lib/prototype/implementationCursorWorkItems";
import type { TaskCursorFailureReason } from "@/lib/prototype/taskCursorExecution";

export type ImplementationCodeTaskFailureCauseLayer =
  | "code_task_quality"
  | "work_item_preflight"
  | "cursor_execution"
  | "github_verify"
  | "review_security"
  | "unknown";

export type ImplementationCodeTaskFailureDiagnosisV1 = Readonly<{
  readonly causeLayer: ImplementationCodeTaskFailureCauseLayer;
  readonly message: string;
  readonly affectedCodeTaskIds: readonly string[];
}>;

export function diagnoseImplementationCodeTaskFailure(input: {
  readonly failureReason?: TaskCursorFailureReason | string | null;
  readonly selectedWorkItems?: readonly CursorWorkItem[] | null;
  readonly codeTaskQualityGate?: ImplementationCodeTaskQualityGateV1 | null;
  readonly preflightFailed?: boolean;
  readonly githubVerifyFailed?: boolean;
}): ImplementationCodeTaskFailureDiagnosisV1 {
  const affectedCodeTaskIds = [
    ...new Set(
      (input.selectedWorkItems ?? [])
        .map((item) => String(item.codeTaskId ?? "").trim())
        .filter(Boolean),
    ),
  ];
  const reason = String(input.failureReason ?? "").trim();

  if (input.codeTaskQualityGate?.status === "failed") {
    const qualityIds = input.codeTaskQualityGate.issues
      .filter((issue) => issue.severity === "error")
      .map((issue) => issue.codeTaskId);
    return {
      causeLayer: "code_task_quality",
      message: "CodeTask 품질 보완이 필요합니다.",
      affectedCodeTaskIds: qualityIds.length ? qualityIds : affectedCodeTaskIds,
    };
  }

  if (input.preflightFailed || reason === "work_item_preflight_failed") {
    return {
      causeLayer: "work_item_preflight",
      message: "WorkItem preflight 문제로 실행이 차단되었습니다.",
      affectedCodeTaskIds,
    };
  }

  if (input.githubVerifyFailed || reason === "github_verify_failed") {
    return {
      causeLayer: "github_verify",
      message: "GitHub 검증 실패로 CodeTask 실행이 완료되지 않았습니다.",
      affectedCodeTaskIds,
    };
  }

  if (
    reason === "review_failed" ||
    reason === "security_failed" ||
    reason === "quality_gate_failed"
  ) {
    return {
      causeLayer: "review_security",
      message: "검수/보안 단계에서 실패했습니다.",
      affectedCodeTaskIds,
    };
  }

  if (
    reason === "cursor_failed" ||
    reason === "poll_timeout" ||
    reason === "poll_cancelled" ||
    reason === "api_failed" ||
    reason === "launch_failed"
  ) {
    return {
      causeLayer: "cursor_execution",
      message: "Cursor 실행 단계에서 실패했습니다.",
      affectedCodeTaskIds,
    };
  }

  return {
    causeLayer: "unknown",
    message: reason ? `실패 원인: ${reason}` : "실패 원인을 확인할 수 없습니다.",
    affectedCodeTaskIds,
  };
}
