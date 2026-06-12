import type { ImplementationCodeTaskPlanV1, ImplementationCodeTaskV1 } from "@/lib/prototype/implementationCodeTaskPlan";
import { CODE_TASK_FILE_BOUNDARY_VERSION } from "@/lib/prototype/codeTaskFileBoundary";
import { normalizeCodeTaskFileBoundaryV1 } from "@/lib/prototype/codeTaskFileBoundaryNormalize";
import { integrationWiringFileBoundary } from "@/lib/prototype/codeTaskIntegrationWiringTask";
import { isSampleDataCodeTaskRef } from "@/lib/prototype/sampleDataCodeTaskPlanner";

export const CANONICAL_PREVIEW_UX_WIRING_CODE_TASK_ID = "CODE-WIRING-PREVIEW-001" as const;
export const PREVIEW_UX_WIRING_PARENT_PROCESS_TASK_ID = "DEV-INTEGRATION-PREVIEW-001" as const;
export const PREVIEW_UX_WIRING_WORK_BRANCH = "wip/integration/preview-ux" as const;

export function isPreviewUxWiringCodeTaskRef(input: {
  readonly codeTaskId: string;
  readonly title?: string | null;
}): boolean {
  const id = input.codeTaskId.trim();
  if (id === CANONICAL_PREVIEW_UX_WIRING_CODE_TASK_ID) return true;
  return /preview\s*ux|샘플.*실제\s*화면\s*연결/i.test(String(input.title ?? ""));
}

export function buildPreviewUxWiringCodeTask(input: {
  readonly dependsOnCodeTaskId: string | null;
}): ImplementationCodeTaskV1 {
  const deps = input.dependsOnCodeTaskId?.trim() ? [input.dependsOnCodeTaskId.trim()] : [];
  const boundary = integrationWiringFileBoundary();
  return {
    codeTaskId: CANONICAL_PREVIEW_UX_WIRING_CODE_TASK_ID,
    parentTaskId: PREVIEW_UX_WIRING_PARENT_PROCESS_TASK_ID,
    title: "Preview UX 마감 · 샘플데이터 실제 화면 연결",
    description:
      "샘플데이터를 회의 분석 워크스페이스 UX에 연결하고 placeholder를 제거하여 actual Preview가 실제 서비스 초기 상태처럼 보이게 한다.",
    changeType: "integration",
    targetHints: ["integration", "preview-ux"],
    dependencies: deps,
    codeTaskDependencies: deps,
    acceptanceCriteria: [
      "Preview에서 placeholder-only 화면을 기본값으로 두지 않는다.",
      "샘플데이터가 있는 경우 실제 서비스 초기 화면처럼 렌더링한다.",
      "회의 파일, 참여자, 스크립트, 요약, 결정사항, 할 일을 구획별로 자연스럽게 표시한다.",
      "빈 배열·결정사항 없음 상태도 실제 UX 안내 문구로 표현한다.",
      "<ul><li>만 나열된 데모 화면처럼 보이지 않게 한다.",
      "패널 간 여백, 제목, 상태 뱃지, 카드 구성을 적용한다.",
      "src/data/sampleData.ts export를 좌/중/우 패널에 연결한다(플랫폼 Runtime 패치가 아닌 본 repo CodeTask 산출).",
      "App Shell 구조를 재작성하지 않는다.",
    ],
    verificationHints: [
      "actual Preview에서 placeholder 문구가 보이지 않는다.",
      "빈 bullet·[]·undefined 표시가 없다.",
      "모바일/좁은 화면에서 패널 겹침이 없다.",
    ],
    forbiddenPaths: ["package.json", "pnpm-lock.yaml"],
    priority: "P0",
    status: "ready",
    blockers: [],
    branchPlan: {
      branchGroup: "integration",
      workBranch: PREVIEW_UX_WIRING_WORK_BRANCH,
      baseBranch: "wip/screen/workspace",
      baseBranchPolicy: "same_group",
      executionMode: "integration_only",
    },
    fileBoundary: normalizeCodeTaskFileBoundaryV1({
      version: CODE_TASK_FILE_BOUNDARY_VERSION,
      fileBoundaryConfidence: "high",
      conflictGroupId: "preview-ux-wiring",
      expectedFiles: boundary?.ownedFiles ?? [],
      ownedFiles: boundary?.ownedFiles ?? [],
      forbiddenFiles: boundary?.forbiddenFiles ?? [],
      forbiddenGlobs: [],
      sharedFiles: [],
    })!,
  };
}

export function ensurePreviewUxWiringCodeTaskInPlan(
  plan: ImplementationCodeTaskPlanV1,
): ImplementationCodeTaskPlanV1 {
  if (plan.tasks.some((t) => isPreviewUxWiringCodeTaskRef(t))) {
    return plan;
  }
  const hasSampleData = plan.tasks.some((t) => isSampleDataCodeTaskRef(t));
  if (!hasSampleData) return plan;

  const dependsOn =
    [...plan.tasks].reverse().find((t) => t.changeType === "screen" || t.branchPlan)?.codeTaskId ??
    plan.tasks[plan.tasks.length - 1]?.codeTaskId ??
    null;

  const wiring = buildPreviewUxWiringCodeTask({ dependsOnCodeTaskId: dependsOn });
  const tasks = [...plan.tasks, wiring];

  if (typeof console !== "undefined" && console.info) {
    console.info(
      JSON.stringify({
        action: "preview_ux_wiring_codetask_created",
        codeTaskId: CANONICAL_PREVIEW_UX_WIRING_CODE_TASK_ID,
        projectId: plan.projectId,
        dependsOnCodeTaskId: dependsOn,
      }),
    );
  }

  return {
    ...plan,
    tasks,
    codeTaskCount: tasks.length,
    updatedAt: new Date().toISOString(),
  };
}
