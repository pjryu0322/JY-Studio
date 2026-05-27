export const PROJECT_ADMIN_EXECUTION_SETUP_PANEL_ID = "execution-setup-panel" as const;

export function scrollProjectAdminExecutionSetupPanelIntoView(
  scrollContainer: HTMLElement | null,
): void {
  const el = document.getElementById(PROJECT_ADMIN_EXECUTION_SETUP_PANEL_ID);
  if (!scrollContainer || !el) return;
  const containerRect = scrollContainer.getBoundingClientRect();
  const elRect = el.getBoundingClientRect();
  const nextTop = scrollContainer.scrollTop + (elRect.top - containerRect.top) - 12;
  scrollContainer.scrollTo({ top: Math.max(0, nextTop), behavior: "smooth" });
  if (el instanceof HTMLElement) {
    if (!el.hasAttribute("tabindex")) el.setAttribute("tabindex", "-1");
    el.focus({ preventScroll: true });
  }
}
