import { workUnitProgressAllMerged } from "@/components/preview/prototypePreviewPanelHelpers";
import { getLatestRun } from "@/lib/prototype/prototypeRunStore";
import type { PrototypeRun } from "@/lib/prototype/prototypeRunTypes";

function isPrototypeDeployPhaseFromRun(run: PrototypeRun): boolean {
  if (!workUnitProgressAllMerged(run)) return false;
  return run.status === "MERGED" || run.status === "DEPLOY_CONFIGURING" || run.status === "DEPLOYING";
}

/** iframe·검토 화면에서 실제 미리보기를 열 수 있는지(실행 결과 URL 기준). */
function isPrototypePreviewRunnable(run: PrototypeRun): boolean {
  if (run.status === "PREVIEW_READY") return true;
  const u = (run.previewUrl ?? run.suggestedPreviewUrl ?? run.resultUrl ?? "").trim();
  return u.length > 0;
}

/**
 * 홈 프로젝트 카드: 최신 프로토타입 실행 ID와 “배포(실행) 화면으로 이어질 수 있는지”.
 * - 파이프라인이 머지·배포 단계이거나, 미리보기 준비·배포 실패 등 후속 조치가 있는 경우 true.
 */
export function projectPrototypeCardMeta(projectId: string): {
  latestPrototypeRunId: string | null;
  prototypePreviewActionAvailable: boolean;
  prototypeDeployActionAvailable: boolean;
} {
  const run = getLatestRun(projectId);
  if (!run) {
    return {
      latestPrototypeRunId: null,
      prototypePreviewActionAvailable: false,
      prototypeDeployActionAvailable: false,
    };
  }
  const previewRunnable = isPrototypePreviewRunnable(run);
  const deployAvailable =
    isPrototypeDeployPhaseFromRun(run) || run.status === "PREVIEW_READY" || run.status === "DEPLOY_FAILED";
  return {
    latestPrototypeRunId: run.id,
    prototypePreviewActionAvailable: previewRunnable,
    prototypeDeployActionAvailable: deployAvailable,
  };
}
