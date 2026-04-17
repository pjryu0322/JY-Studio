export const APP_FLOW_LAST_PROJECT_KEY = "jyo:flow:lastProjectId";

/** 프로젝트 워크플로 상태가 바뀐 뒤 상단 단계 링크를 즉시 다시 불러오기 위해 디스패치합니다. */
export const APP_FLOW_PROJECT_CONTEXT_REFRESH_EVENT = "jyo:app-flow-project-context-refresh";

export type AppFlowStepId =
  | "requirements"
  | "collaboration"
  | "features"
  | "tasks"
  | "planning"
  | "execution"
  | "trace";

export type AppFlowStepDef = Readonly<{
  id: AppFlowStepId;
  label: string;
  href: string;
}>;

export const APP_FLOW_STEPS: readonly AppFlowStepDef[] = [
  { id: "requirements", label: "요구사항", href: "/requirements" },
  { id: "collaboration", label: "협업", href: "/collaboration" },
  { id: "features", label: "기능", href: "/features" },
  { id: "tasks", label: "작업", href: "/tasks" },
  { id: "planning", label: "실행 계획", href: "/" },
  { id: "execution", label: "실행", href: "/execution" },
  { id: "trace", label: "추적", href: "/trace" },
] as const;

export function resolveAppFlowStepFromPathname(pathname: string): AppFlowStepId | null {
  const p = pathname || "/";
  if (p === "/login" || p.startsWith("/login/")) return null;
  if (p === "/requirements" || p.startsWith("/requirements/")) return "requirements";
  if (p === "/collaboration" || p.startsWith("/collaboration/")) return "collaboration";
  if (p === "/features" || p.startsWith("/features/")) return "features";
  if (p === "/tasks" || p.startsWith("/tasks/")) return "tasks";
  if (p === "/" || p === "/workspace" || p.startsWith("/projects/")) return "planning";
  if (p === "/execution" || p.startsWith("/execution/")) return "execution";
  if (p === "/trace" || p.startsWith("/trace/")) return "trace";
  if (p.startsWith("/planning-execution")) return "execution";
  return null;
}

export function projectIdFromPathname(pathname: string): string | null {
  const m = pathname.match(/^\/projects\/([^/?#]+)/);
  return m?.[1] ? decodeURIComponent(m[1]) : null;
}

export function nextStepAfter(current: AppFlowStepId): AppFlowStepDef | null {
  const idx = APP_FLOW_STEPS.findIndex((s) => s.id === current);
  if (idx < 0 || idx >= APP_FLOW_STEPS.length - 1) return null;
  return APP_FLOW_STEPS[idx + 1] ?? null;
}
