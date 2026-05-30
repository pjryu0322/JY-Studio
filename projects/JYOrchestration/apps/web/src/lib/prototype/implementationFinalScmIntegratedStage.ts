import {
  buildWipPlatformScmPushRequestPatch,
  type PlatformScmExecutionV1,
} from "@/lib/prototype/platformScmExecution";
import type { CodeAgentWipExecutionV1 } from "@/lib/prototype/codeAgentWipExecution";

export {
  isFinalScmPlatformExecutionCompleted,
  isPlatformScmPushPrCompleted,
  validateFinalScmIntegratedStageReadiness,
} from "@/lib/prototype/platformScmReadiness";

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
