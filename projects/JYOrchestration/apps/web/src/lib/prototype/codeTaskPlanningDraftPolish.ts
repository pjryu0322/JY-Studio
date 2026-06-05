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

export function filterPerTaskVerificationLines(lines: readonly string[]): string[] {
  return [...new Set(lines.map((l) => l.trim()).filter((l) => l && !isCommonVerificationLine(l)))];
}

export function filterPerTaskRequirementLines(
  lines: readonly string[],
  roleKind: CodeTaskRoleKind,
): string[] {
  const filtered = lines
    .map((l) => l.trim())
    .filter((l) => {
      if (!l) return false;
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
  return [...new Set(filtered)];
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
