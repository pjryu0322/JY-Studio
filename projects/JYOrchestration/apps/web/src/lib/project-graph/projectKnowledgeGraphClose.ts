import type { AppRouterInstance } from "next/dist/shared/lib/app-router-context.shared-runtime";

/**
 * 그래프 화면 종료: window.close → router.back → requirements 복귀.
 */
export function exitProjectKnowledgeGraphView(router: AppRouterInstance, projectId: string): void {
  const pid = String(projectId ?? "").trim();
  const requirementsHref = `/requirements?projectId=${encodeURIComponent(pid)}`;

  if (typeof window !== "undefined") {
    try {
      window.close();
    } catch {
      /* ignore */
    }
    window.setTimeout(() => {
      if (window.history.length > 1) {
        router.back();
        return;
      }
      router.push(requirementsHref);
    }, 0);
    return;
  }

  router.push(requirementsHref);
}
