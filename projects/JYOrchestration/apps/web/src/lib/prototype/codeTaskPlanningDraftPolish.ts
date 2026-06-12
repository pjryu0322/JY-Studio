import type { CodeTaskRoleKind } from "@/lib/prototype/codeTaskPromptRoleResolver";

/** 기획단계 Draft 묶음 상단에 한 번만 노출 */
export const PLANNING_DRAFT_COMMON_VERIFICATION_CRITERIA: readonly string[] = [
  "대상 저장소 루트에서 package.json scripts를 확인한다.",
  "가능한 경우 build/test/lint 중 존재하는 명령을 실행한다.",
  "CodeTask 유형에 맞는 검증 기준을 적용한다.",
  "common Task는 독립 컴포넌트의 import/export, props 기반 렌더링 가능성, 타입 오류 여부를 확인한다.",
  "feature Task는 독립 flow 모듈의 import/export, props/callback 기반 동작 가능성, 타입 오류 여부를 확인한다.",
  "screen Task는 자기 화면 컴포넌트의 렌더링 구조와 Preview UX 품질 기준을 확인한다.",
  "foundation Task는 App Shell/Panel 구조와 반응형 레이아웃을 확인한다.",
  "Integration Orchestration Task는 최종 import/props wiring과 Preview 화면 흐름을 확인한다.",
] as const;

const COMMON_VERIFICATION_PATTERNS: readonly RegExp[] = [
  /package\.json\s*scripts/i,
  /build\/test\/lint/i,
  /CodeTask\s*유형에\s*맞는\s*검증/i,
  /common\s*Task는\s*독립\s*컴포넌트/i,
  /feature\s*Task는\s*독립\s*flow/i,
  /screen\s*Task는\s*자기\s*화면/i,
  /foundation\s*Task는/i,
  /Integration\s*Orchestration\s*Task는/i,
  /화면\s*또는\s*상태\s*흐름에서\s*재현/i,
  /동일\s*기능.*회귀/i,
  /관련\s*화면·상태\s*흐름.*회귀/i,
];

export const COMMON_FEATURE_MODULE_REQUIREMENTS: readonly string[] = [
  "이번 CodeTask에서는 화면에 직접 연결하지 않는다.",
  "integration Task에서 연결할 수 있도록 props/callback 기반 구조로 작성한다.",
  "App Shell, LeftPanel, CenterPanel, RightPanel, route, global style은 수정하지 않는다.",
  "화면 연결이 필요한 경우 작업 결과 보고의 `requiresIntegrationChange`에 연결 파일, 사유, 예상 연결 위치를 기록한다.",
] as const;

const COMMON_MODULE_VERIFICATION: readonly string[] = [
  "컴포넌트가 독립적으로 import/export 가능하다.",
  "props 상태에 따라 정상/로딩/오류/빈 결과/권한 없음/재시도/저장 상태를 표현할 수 있다.",
  "실제 화면 연결 없이도 컴포넌트 자체 타입 오류가 없어야 한다.",
  "App Shell, LeftPanel, CenterPanel, RightPanel, route, global style을 수정하지 않았다.",
  "화면 연결이 필요한 경우 작업 결과 보고의 `requiresIntegrationChange`에 연결 파일, 사유, 예상 연결 위치를 기록했다.",
] as const;

const FEATURE_MODULE_VERIFICATION: readonly string[] = [
  "flow 모듈이 독립적으로 import/export 가능하다.",
  "상태 전환 함수 또는 flow 컴포넌트가 props/callback 기반으로 동작 가능하다.",
  "입력 부족, 처리 중, 완료, 실패, 결과 없음 등 상태를 내부 구조 또는 props로 표현할 수 있다.",
  "실제 화면 연결 없이도 모듈 자체 타입 오류가 없어야 한다.",
  "App Shell, LeftPanel, CenterPanel, RightPanel, route, global style을 수정하지 않았다.",
  "화면 연결이 필요한 경우 작업 결과 보고의 `requiresIntegrationChange`에 연결 파일, 사유, 예상 연결 위치를 기록했다.",
] as const;

export const SCREEN_MODULE_VERIFICATION: readonly string[] = [
  "placeholder-only 화면이 아니다.",
  "단순 텍스트/빈 bullet 나열로만 구성되어 있지 않다.",
  "undefined/null/빈 문자열이 그대로 노출되지 않는다.",
  "샘플 데이터가 props로 주입되었을 때 실제 서비스 초기 화면처럼 보인다.",
  "카드/리스트/탭/상태 배지 등 사용자가 실제 화면으로 인식할 수 있는 UI 구조를 갖는다.",
  "모바일 또는 좁은 화면에서 주요 영역이 겹치지 않는다.",
] as const;

const COMMON_FEATURE_DIRECT_SCREEN_VERIFY: readonly RegExp[] = [
  /UI\s*표시\s*확인/i,
  /화면에\s*표시/i,
  /표시되는지\s*확인/i,
  /표시\s*및\s*동작\s*확인/i,
  /동작\s*확인/i,
  /연결\s*확인/i,
  /연동\s*확인/i,
  /흐름\s*연결\s*확인/i,
  /로딩\s*중\s*UI/i,
  /입력\s*필드.*선택\s*UI/i,
  /요약\/스크립트\s*확인/i,
  /정상\s*화면/i,
  /복귀\s*확인/i,
  /EmptyState\s*표시/i,
  /기존\s*목록\s*표시/i,
  /레이아웃\s*회귀/i,
  /회귀\s*없음/i,
  /진입점이\s*표시/i,
];

const COMMON_FEATURE_SCREEN_WIRE_CONFLICT: readonly RegExp[] = [
  /기존\s*화면.*연동/i,
  /기존\s*목록.*연동/i,
  /기존\s*입력\s*화면/i,
  /작업\s*공간.*연결/i,
  /결과\s*패널.*연결/i,
  /요약본\/스크립트\s*탭/i,
  /최소\s*1곳에\s*연동/i,
  /최소\s*1곳에\s*적용/i,
  /mock\s*data\s*state와\s*연결/i,
  /화면\s*상태\s*또는\s*mock/i,
];

const SCREEN_AMBIGUOUS_VERIFY: readonly RegExp[] = [
  /기존\s*레이아웃\s*회귀/i,
  /화면\s*진입\s*및\s*주요\s*플로우\s*확인/i,
  /기존\s*화면\s*회귀/i,
];

function isCommonOrFeatureRoleKind(roleKind: CodeTaskRoleKind): boolean {
  return roleKind.startsWith("common_") || roleKind.startsWith("feature_");
}

function isScreenRoleKind(roleKind: CodeTaskRoleKind): boolean {
  return roleKind === "screen_input" || roleKind === "screen_result" || roleKind === "screen_admin";
}

const GENERIC_REQUIREMENT_PATTERNS: readonly RegExp[] = [
  /^주요\s*UI\s*영역이\s*표시/i,
  /샘플\s*데이터\s*기준으로\s*화면\s*상태/i,
  /기능\s*진입점,\s*상태\s*전환,\s*연동\s*지점/i,
  /화면\s*진입\s*및\s*주요\s*플로우\s*확인$/i,
  /기획\s*산출물\s*기준으로\s*공통\s*동작/i,
];

export function isCommonVerificationLine(line: string): boolean {
  const t = line.trim();
  if (!t) return true;
  return COMMON_VERIFICATION_PATTERNS.some((p) => p.test(t));
}

export function filterPerTaskVerificationLines(
  lines: readonly string[],
  roleKind?: CodeTaskRoleKind,
): string[] {
  let out = [...new Set(lines.map((l) => l.trim()).filter((l) => l && !isCommonVerificationLine(l)))];
  if (roleKind && isCommonOrFeatureRoleKind(roleKind)) {
    out = out.filter((l) => !COMMON_FEATURE_DIRECT_SCREEN_VERIFY.some((p) => p.test(l)));
    const moduleLines = roleKind.startsWith("feature_")
      ? FEATURE_MODULE_VERIFICATION
      : COMMON_MODULE_VERIFICATION;
    out = [...new Set([...out, ...moduleLines])];
  }
  if (roleKind && isScreenRoleKind(roleKind)) {
    out = out.filter((l) => !SCREEN_AMBIGUOUS_VERIFY.some((p) => p.test(l)));
    out = [...new Set([...out, ...SCREEN_MODULE_VERIFICATION])];
  }
  return out;
}

export function filterPerTaskRequirementLines(
  lines: readonly string[],
  roleKind: CodeTaskRoleKind,
): string[] {
  const filtered = lines
    .map((l) => l.trim())
    .filter((l) => {
      if (!l) return false;
      if (isCommonOrFeatureRoleKind(roleKind) && COMMON_FEATURE_SCREEN_WIRE_CONFLICT.some((p) => p.test(l))) {
        return false;
      }
      if (roleKind !== "mock_data" && GENERIC_REQUIREMENT_PATTERNS.some((p) => p.test(l))) {
        return false;
      }
      if (
        (roleKind === "screen_input" ||
          roleKind === "screen_result" ||
          roleKind === "screen_admin") &&
        /샘플\s*데이터\s*기준/i.test(l)
      ) {
        return false;
      }
      if (roleKind !== "mock_data" && /mock\s*data|fixture\s*helper/i.test(l)) {
        return false;
      }
      return true;
    });
  const merged = isCommonOrFeatureRoleKind(roleKind)
    ? [...filtered, ...COMMON_FEATURE_MODULE_REQUIREMENTS]
    : filtered;
  return [...new Set(merged)];
}

export function appendOptionalScreenMockVerification(
  lines: readonly string[],
  roleKind: CodeTaskRoleKind,
): string[] {
  if (!isScreenRoleKind(roleKind)) {
    return [...lines];
  }
  return [...new Set([...lines, ...SCREEN_MODULE_VERIFICATION])];
}
