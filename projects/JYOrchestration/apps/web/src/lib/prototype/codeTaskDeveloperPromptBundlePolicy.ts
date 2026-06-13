/** 2단계 Developer Prompt Bundle 상단 정책 블록 (Markdown) */

export function buildDeveloperPromptBundleExecutionPolicyLines(): readonly string[] {
  return [
    "## Execution Policy",
    "",
    "이 Bundle은 개별 CodeTask 실행용이다.",
    "",
    "- 각 CodeTask 섹션은 Cursor에 하나씩 순서대로 전달한다.",
    "- Bundle 전체를 한 번에 실행하지 않는다.",
    "- CodeTask 1~15는 branch group별 산출물을 생성하고 누적하는 단계다.",
    "- Integration Task는 이 Bundle에서 자동 실행하지 않는다.",
    "- Integration은 사용자가 플랫폼에서 **통합 버튼**을 선택했을 때 별도 Integration Action으로 실행한다.",
    "- CodeTask 결과는 각 work branch에 commit/push까지만 수행한다.",
    "- PR 생성, merge, preview 연결은 CodeTask 단계에서 수행하지 않는다.",
  ];
}

export function buildDeveloperPromptBundleBranchGroupAccumulationPolicyLines(): readonly string[] {
  return [
    "## Branch Group Accumulation Policy",
    "",
    "동일 branch group에 속한 여러 CodeTask는 같은 work branch에 순차 누적된다.",
    "",
    "- work branch가 이미 origin에 존재하면 base branch에서 새로 만들지 않는다.",
    "- 반드시 origin/<work branch>를 checkout/pull 한 뒤 기존 커밋 위에 이어서 작업한다.",
    "- work branch가 존재하지 않을 때만 base branch에서 새로 생성한다.",
    "- 같은 branch group 내 후속 CodeTask는 이전 CodeTask 커밋을 보존해야 한다.",
    "- 이전 CodeTask 산출물을 삭제하거나 되돌리지 않는다.",
    "- push 전 현재 branch와 `git status`를 확인한다.",
    "- 동일 work branch 공유는 Integration 단계에서 branch group 단위로 병합/검증하기 위한 의도된 구조다.",
  ];
}

export function buildDeveloperPromptBundleBranchGroupIntentLines(): readonly string[] {
  return [
    "## Branch Group Intent",
    "",
    "- `foundation`: App Shell/공통 화면 프레임을 구성한다.",
    "- `data`: 샘플 데이터와 타입을 구성한다.",
    "- `common`: 공통 UI 상태 컴포넌트를 하나의 work branch에 누적한다.",
    "- `feature`: 시작/입력/처리/결과 확인 flow API를 하나의 work branch에 누적한다.",
    "- `screen`: 입력/결과/관리 화면 컴포넌트를 하나의 work branch에 누적한다.",
    "",
    "각 group의 work branch는 Integration 버튼 실행 시 통합 대상 후보가 된다.",
  ];
}
