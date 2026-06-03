export const DISABLED_IMPLEMENTATION_RUNTIME_USER_ACTIONS = new Set([
  "recover",
  "force_release",
  "redispatch",
]);

export const DISABLED_IMPLEMENTATION_RUNTIME_USER_ACTION_MESSAGE =
  "이 Runtime 관리 액션은 사용자 구현단계 화면에서 비활성화되었습니다.";

export function isDisabledImplementationRuntimeUserAction(
  action: string,
): boolean {
  return DISABLED_IMPLEMENTATION_RUNTIME_USER_ACTIONS.has(action.trim());
}
