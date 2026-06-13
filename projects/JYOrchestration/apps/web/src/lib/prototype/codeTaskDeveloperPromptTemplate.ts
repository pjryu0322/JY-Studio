import type { CodeTaskBranchGroupV1, CodeTaskBranchPlanV1 } from "@/lib/prototype/implementationBranchPlan";
import {
  boundaryIncludesRouteEntryCandidates,
  requiresRouteEntryGuardInPrompt,
  ROUTE_ENTRY_DUPLICATE_GUARD_LINE,
  ROUTE_ENTRY_USAGE_NOTE,
} from "@/lib/prototype/codeTaskRouteBoundaryPlanner";

export function buildWorkBranchReusePrincipleLines(): readonly string[] {
  return [
    "- work branch가 이미 origin에 존재하면 base branch에서 새로 만들지 않는다.",
    "- 반드시 origin/<work branch>를 checkout/pull 한 뒤 기존 커밋 위에 이어서 작업한다.",
    "- work branch가 존재하지 않을 때만 base branch에서 새로 생성한다.",
    "- 같은 branch group 내 후속 CodeTask는 이전 CodeTask 커밋을 보존해야 한다.",
    "- 동일 work branch 공유는 Integration 단계에서 branch group 단위 검증을 하기 위한 의도된 구조다.",
  ];
}

export function buildBranchWorkPrincipleLines(branchPlan: CodeTaskBranchPlanV1): readonly string[] {
  const workBranch = branchPlan.workBranch.trim();
  const baseIntro = "- 이 작업은 위에 명시된 base branch를 기준으로 수행한다.";
  switch (branchPlan.branchGroup) {
    case "foundation":
      return [
        baseIntro,
        "- foundation group은 첫 구현 단위이므로 base branch가 `main`일 수 있다.",
        `- work branch는 \`${workBranch}\`을 사용한다.`,
        "- 이 Task는 App Shell/공통 화면 프레임의 단일 소유자다.",
        "- 기존 App Shell 관련 파일이 이미 있으면 전체 재작성하지 말고 필요한 범위만 보완한다.",
        "- 관련 파일이 없으면 수정 허용 파일 범위 안에서 새로 생성한다.",
        "- data/common/feature/screen 세부 구현은 직접 만들지 않는다.",
      ];
    case "integration":
      return [
        baseIntro,
        "- integration group wiring CodeTask는 Developer Prompt Bundle에 포함하지 않는다.",
        "- Integration은 사용자가 플랫폼에서 **통합 버튼**을 선택했을 때 별도 Integration Action으로 실행한다.",
        "- integration group은 screen group 결과물을 base로 최종 연결만 수행한다.",
        "- screen/common/feature/data 결과물을 App Shell에 연결한다.",
        "- 기존 컴포넌트 내부 구현을 재작성하지 않는다.",
        "- 변경은 import, props wiring, route/wrapper, panel slot 연결에 한정한다.",
        "- CodeTask 단계에서 PR/merge/Preview 연결을 수행하지 않는다.",
      ];
    case "data":
    case "common":
    case "feature":
    case "screen":
    default:
      return [
        baseIntro,
        "- 이 Task의 base branch는 Branch Plan에서 정한 선행 group work branch여야 한다.",
        "- foundation group에서 생성한 App Shell 구조를 보존한다.",
        "- 기존 구조를 재생성하거나 재작성하지 않는다.",
        "- 이 Task의 수정 허용 파일 밖은 수정하지 않는다.",
        "- Shell/global 파일 연결이 필요하면 직접 수정하지 말고 `requiresIntegrationChange`에 기록한다.",
        "- Integration은 통합 버튼 선택 시 별도 Integration Action으로 처리한다.",
        "- 이번 CodeTask에서는 Shell/global 파일을 직접 연결하지 않는다.",
      ];
  }
}

export function buildFileBoundaryPrincipleLines(
  branchGroup: CodeTaskBranchGroupV1 | null | undefined,
): readonly string[] {
  switch (branchGroup) {
    case "foundation":
      return [
        "- 위 허용 파일 밖의 기존 파일을 재작성하지 않는다.",
        "- 수정 금지 파일은 생성·수정·삭제하지 않는다.",
        "- 기존 App Shell 관련 파일이 이미 있으면 전체 재작성하지 말고 필요한 범위만 보완한다.",
        "- 관련 파일이 없으면 허용 파일 범위 안에서 새로 생성한다.",
        "- data/common/feature/screen 세부 구현은 직접 만들지 않는다.",
        "- 필요한 연결이 수정 금지 파일에 필요한 경우, 직접 수정하지 말고 작업 결과의 `requiresIntegrationChange` 항목에 기록한다.",
      ];
    case "integration":
      return [
        "- Integration Task는 연결/wiring만 수행한다.",
        "- Integration은 사용자가 플랫폼 **통합 버튼**으로 별도 Integration Action을 실행할 때 수행한다.",
        "- Developer Prompt Bundle에서 Integration Task를 자동 실행하지 않는다.",
        "- 개별 컴포넌트 내부 구현을 재작성하지 않는다.",
        "- 변경은 import, props, slot placement, route/wrapper 연결에 한정한다.",
        "- 수정 금지 파일은 생성·수정·삭제하지 않는다.",
        "- 연결에 필요한 사항은 작업 결과의 `integrationSummary`에 기록한다.",
      ];
    default:
      return [
        "- 위 허용 파일 밖의 기존 파일을 재작성하지 않는다.",
        "- 수정 금지 파일은 생성·수정·삭제하지 않는다.",
        "- 기존 App Shell 구조를 재작성하지 않는다.",
        "- Shell/global 파일 연결이 필요하면 직접 수정하지 말고 작업 결과의 `requiresIntegrationChange` 항목에 기록한다.",
        "- Integration은 통합 버튼 선택 시 별도 Integration Action으로 처리한다.",
        "- 이번 CodeTask에서는 Shell/global 파일을 직접 연결하지 않는다.",
        "- 새 파일은 허용 경로 하위에만 생성한다.",
      ];
  }
}

export function buildDeveloperPromptSearchScopeSections(
  probePathLines: readonly string[],
  options?: { readonly includeRouteEntryFrameworkCheck?: boolean },
): readonly string[] {
  const lines = [
    "",
    "## 수정 대상 탐색 기준",
    "- 아래 경로는 관련 구조 파악을 위한 탐색만 허용한다.",
    "- 실제 코드 변경은 반드시 `수정 허용 파일` 섹션에 명시된 파일/경로 안에서만 수행한다.",
    "- 수정 금지 파일은 탐색할 수는 있지만 생성·수정·삭제하지 않는다.",
  ];
  if (options?.includeRouteEntryFrameworkCheck) {
    lines.push(
      "- route/app entry 파일을 수정하거나 생성하기 전에 package.json, 기존 app/pages/src 구조, 현재 사용 중인 entry 파일을 확인한다.",
      "- framework 구조 판단 목적의 package.json 열람은 허용하지만, package.json 수정은 금지한다.",
    );
  }
  lines.push("- 우선 탐색 경로:", ...probePathLines, "- 실제 저장소 구조에 맞춰 최소 범위만 수정한다.");
  return lines;
}

export function buildWorkResultReportFormatSections(options?: {
  readonly requireRouteEntryDecision?: boolean;
}): readonly string[] {
  const reportBlock = [
    "commitSha:",
    "workBranch:",
    "changedFiles:",
    "verification:",
    "workBranchReuse:",
    "  - origin work branch 존재 여부:",
    "  - checkout/pull 여부:",
    "  - 이전 group/task 커밋 보존 여부:",
    ...(options?.requireRouteEntryDecision
      ? [
          "routeEntryDecision:",
          "  - 사용한 entry 파일:",
          "  - 선택 사유:",
          "  - 생성/수정 여부:",
        ]
      : []),
    "requiresIntegrationChange:",
    "  - 필요한 경우에만 작성",
    "  - 연결이 필요한 파일:",
    "  - 사유:",
    "  - 예상 연결 위치:",
    "noCodeChange:",
    "  - 코드 변경이 없었던 경우에만 작성",
  ];
  return [
    "",
    "## 작업 결과 보고 형식",
    "",
    "작업 완료 후 다음 형식으로 결과를 보고한다.",
    "",
    "```text",
    ...reportBlock,
    "```",
    "",
    "- 코드 파일에 임의 TODO 주석을 남기지 않는다.",
    "- 작업 결과 보고의 `requiresIntegrationChange` 항목에 필요한 연결 파일, 사유, 예상 연결 위치를 명시한다.",
    ...(options?.requireRouteEntryDecision
      ? ["- route/app entry를 사용·생성·수정한 경우 `routeEntryDecision` 항목을 반드시 작성한다."]
      : []),
  ];
}

export function buildRouteEntryForbiddenRuleLines(): readonly string[] {
  return [
    `- ${ROUTE_ENTRY_DUPLICATE_GUARD_LINE}`,
    "- 현재 저장소의 프레임워크 구조와 맞지 않는 entry 파일을 새로 만들지 않는다.",
    "- 이미 저장소에 여러 entry 파일이 존재하는 경우 기존 파일은 삭제하지 않는다.",
    "- 현재 사용 중인 entry 흐름을 확인한 뒤 필요한 파일만 최소 수정한다.",
    "- 사용 여부가 불확실한 entry 파일은 직접 삭제하지 않고 작업 결과 보고에 확인 필요로 기록한다.",
  ];
}

export function shouldIncludeRouteEntryUsageNote(
  branchGroup: CodeTaskBranchGroupV1 | null | undefined,
  ownedFiles?: readonly string[],
): boolean {
  return requiresRouteEntryGuardInPrompt({ branchGroup, ownedFiles });
}

export {
  boundaryIncludesRouteEntryCandidates,
  requiresRouteEntryGuardInPrompt,
  ROUTE_ENTRY_DUPLICATE_GUARD_LINE,
  ROUTE_ENTRY_USAGE_NOTE,
};
