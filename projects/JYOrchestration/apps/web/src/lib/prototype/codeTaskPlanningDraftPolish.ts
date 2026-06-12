import type { CodeTaskRoleKind } from "@/lib/prototype/codeTaskPromptRoleResolver";

/** 기획단계 Draft 묶음 상단에 한 번만 노출 */
export const PLANNING_DRAFT_COMMON_VERIFICATION_CRITERIA: readonly string[] = [
  "대상 저장소 루트에서 package.json scripts를 확인한다.",
  "가능한 경우 build/test/lint 중 존재하는 명령을 실행한다.",
  "구현한 기능이 화면 또는 상태 흐름에서 재현되는지 확인한다.",
  "동일 기능 및 관련 화면·상태 흐름의 회귀가 없는지 확인한다.",
] as const;

const COMMON_VERIFICATION_PATTERNS: readonly RegExp[] = [
  /package\.json\s*scripts/i,
  /build\/test\/lint/i,
  /화면\s*또는\s*상태\s*흐름에서\s*재현/i,
  /동일\s*기능.*회귀/i,
  /관련\s*화면·상태\s*흐름.*회귀/i,
  /기존\s*레이아웃\s*회귀/i,
  /기존\s*정상\s*화면\s*회귀/i,
  /기존\s*화면\s*회귀/i,
  /정상\s*상태\s*회귀/i,
  /회귀\s*없음\s*확인/i,
  /회귀가\s*없다/i,
];

export const COMMON_FEATURE_MODULE_REQUIREMENTS: readonly string[] = [
  "이번 CodeTask는 독립 컴포넌트 또는 flow 모듈을 생성한다.",
  "App Shell, LeftPanel, CenterPanel, RightPanel, route, global style은 수정하지 않는다.",
  "화면 연결이 필요한 경우 직접 수정하지 말고 작업 결과 보고의 `requiresIntegrationChange`에 기록한다.",
  "연결이 필요한 파일, 사유, 예상 연결 위치를 명시한다.",
] as const;

export const COMMON_FEATURE_MODULE_VERIFICATION: readonly string[] = [
  "생성한 컴포넌트/flow 모듈이 import 가능한지 확인한다.",
  "props 또는 handler 인터페이스가 명확한지 확인한다.",
  "로딩/오류/빈결과/재시도/권한/임시저장 등 상태 표현이 독립적으로 동작 가능한지 확인한다.",
  "화면 연결이 필요한 경우 `requiresIntegrationChange`에 기록한다.",
] as const;

const COMMON_FEATURE_SCREEN_WIRE_CONFLICT: readonly RegExp[] = [
  /기존\s*화면.*연동/i,
  /기존\s*목록.*연동/i,
  /기존\s*입력\s*화면/i,
  /작업\s*공간.*연결/i,
  /결과\s*패널.*연결/i,
  /요약본\/스크립트\s*탭/i,
  /최소\s*1곳에\s*연동/i,
  /최소\s*1곳에\s*적용/i,
];

function isCommonOrFeatureRoleKind(roleKind: CodeTaskRoleKind): boolean {
  return roleKind.startsWith("common_") || roleKind.startsWith("feature_");
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
    out = [...new Set([...out, ...COMMON_FEATURE_MODULE_VERIFICATION])];
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

const SCREEN_OPTIONAL_MOCK_VERIFY =
  "샘플 데이터 또는 기존 mock 상태가 있으면 화면 상태를 확인한다." as const;

export function appendOptionalScreenMockVerification(
  lines: readonly string[],
  roleKind: CodeTaskRoleKind,
): string[] {
  if (roleKind !== "screen_input" && roleKind !== "screen_result") {
    return [...lines];
  }
  const hasMockHint = lines.some((l) => /샘플\s*데이터|mock\s*상태/i.test(l));
  if (hasMockHint) return [...lines];
  return [...lines, SCREEN_OPTIONAL_MOCK_VERIFY];
}
