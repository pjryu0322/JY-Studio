/**
 * 컨테이너 안에서 첫 번째 포커스 가능한 `role="menuitem"` 요소에 포커스를 둡니다.
 */
export function focusFirstRoleMenuitem(root: Element | null | undefined): void {
  if (!root) return;
  const btn = root.querySelector<HTMLButtonElement>('[role="menuitem"]:not([disabled])');
  const link = root.querySelector<HTMLAnchorElement>('a[role="menuitem"]:not([aria-disabled="true"])');
  (btn ?? link)?.focus();
}
