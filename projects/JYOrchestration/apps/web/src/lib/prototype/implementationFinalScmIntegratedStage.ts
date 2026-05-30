import {
  isRealCursorSourceGenerationCompleted,
  type CodeAgentWipExecutionV1,
} from "@/lib/prototype/codeAgentWipExecution";
import {
  buildWipPlatformScmPushRequestPatch,
  type PlatformScmExecutionV1,
} from "@/lib/prototype/platformScmExecution";

export function isFinalScmPlatformExecutionCompleted(
  wip: CodeAgentWipExecutionV1 | null | undefined,
): boolean {
  const pushStatus = wip?.platformScmExecutionV1?.pushStatus;
  return pushStatus === "push_completed" || pushStatus === "pr_completed";
}

export function validateFinalScmIntegratedStageReadiness(
  wip: CodeAgentWipExecutionV1 | null | undefined,
): Readonly<{ readonly ok: true } | Readonly<{ readonly ok: false; readonly message: string }>> {
  if (!wip) {
    return {
      ok: false,
      message: "Code Agent WIP 실행 결과가 없어 최종 SCM 반영을 실행할 수 없습니다.",
    };
  }
  if (!isRealCursorSourceGenerationCompleted(wip)) {
    return {
      ok: false,
      message: "실제 Cursor commit 결과가 없어 최종 SCM 반영을 실행할 수 없습니다.",
    };
  }
  if (isFinalScmPlatformExecutionCompleted(wip)) {
    return { ok: true };
  }
  if (wip.status !== "developer_approved" && wip.status !== "scm_commit_pending") {
    return {
      ok: false,
      message: "AI개발자 [구현 결과 승인] 후 최종 SCM 반영을 실행할 수 있습니다.",
    };
  }
  return { ok: true };
}

export function prepareCodeAgentWipForFinalScmIntegratedStage(input: {
  readonly wip: CodeAgentWipExecutionV1;
  readonly nowIso?: string;
}): CodeAgentWipExecutionV1 {
  if (input.wip.status === "scm_commit_pending") {
    return input.wip.platformScmExecutionV1?.pushStatus === "push_requested"
      ? input.wip
      : buildWipPlatformScmPushRequestPatch({ wip: input.wip, nowIso: input.nowIso });
  }
  if (input.wip.status === "developer_approved") {
    return buildWipPlatformScmPushRequestPatch({
      wip: { ...input.wip, status: "scm_commit_pending" },
      nowIso: input.nowIso,
    });
  }
  return input.wip;
}

export function buildFinalScmIntegratedStageStartedNotice(): string {
  return [
    "최종 SCM 반영 실행을 시작했습니다.",
    "플랫폼 SCM이 WIP commit을 push하고 PR을 생성합니다.",
  ].join("\n");
}

export function buildFinalScmIntegratedStageCompletedNotice(input: {
  readonly message: string;
  readonly scm?: PlatformScmExecutionV1 | null;
}): string {
  const lines = ["최종 SCM 반영 단계가 완료되었습니다.", "", input.message];
  if (input.scm?.prNumber !== undefined) {
    lines.push("", `Pull Request: #${input.scm.prNumber}`);
  }
  return lines.join("\n");
}

export function buildFinalScmIntegratedStageFailedNotice(message: string): string {
  return ["최종 SCM 반영 실행에 실패했습니다.", "", "사유:", `- ${message}`].join("\n");
}
