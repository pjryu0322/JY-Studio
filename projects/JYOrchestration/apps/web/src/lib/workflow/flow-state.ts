export const APP_FLOW_LAST_PROJECT_KEY = "jyo:flow:lastProjectId";

/** 프로젝트 워크플로 상태가 바뀐 뒤 상단 단계 링크를 즉시 다시 불러오기 위해 디스패치합니다. */
export const APP_FLOW_PROJECT_CONTEXT_REFRESH_EVENT = "jyo:app-flow-project-context-refresh";

export type AppFlowStepId =
  | "requirements"
  | "features"
  | "tasks"
  | "planning"
  | "execution"
  | "trace";

export type AppFlowStepDef = Readonly<{
  id: AppFlowStepId;
  label: string;
}>;

export const APP_FLOW_STEPS: readonly AppFlowStepDef[] = [
  { id: "requirements", label: "아이디어 구체화" },
  { id: "features", label: "기능 정리" },
  { id: "tasks", label: "작업 정리" },
  { id: "planning", label: "생성 준비" },
  { id: "execution", label: "프로토타입 생성" },
  { id: "trace", label: "추적" },
] as const;

/** 프로젝트 허브(스펙·작업 준비)는 `?view=workspace`로 구분합니다. */
export function appFlowStepHref(stepId: AppFlowStepId, projectId: string | null): string {
  const pid = projectId?.trim() || null;
  const q = pid ? `?projectId=${encodeURIComponent(pid)}` : "";
  switch (stepId) {
    case "requirements":
      return `/requirements${q}`;
    case "features":
      return `/features${q}`;
    case "tasks":
      return `/tasks${q}`;
    case "planning":
      return pid ? `/projects/${encodeURIComponent(pid)}?view=workspace` : "/";
    case "execution":
      return `/execution${q}`;
    case "trace":
      return `/trace${q}`;
    default:
      return "/";
  }
}

export function resolveAppFlowStepFromLocation(pathname: string, searchParams: URLSearchParams | null): AppFlowStepId | null {
  const sp = searchParams ?? new URLSearchParams();
  const p = pathname || "/";
  if (p === "/login" || p.startsWith("/login/")) return null;
  if (p.startsWith("/admin")) return null;
  if (p === "/requirements" || p.startsWith("/requirements/")) return "requirements";
  if (p === "/collaboration" || p.startsWith("/collaboration/")) return null;
  if (p === "/features" || p.startsWith("/features/")) return "features";
  if (p === "/tasks" || p.startsWith("/tasks/")) return "tasks";
  if (p.startsWith("/projects/")) {
    return sp.get("view") === "workspace" ? "planning" : "requirements";
  }
  if (p === "/" || p === "/workspace") return "planning";
  if (p === "/execution" || p.startsWith("/execution/")) return "execution";
  if (p === "/trace" || p.startsWith("/trace/")) return "trace";
  if (p.startsWith("/planning-execution")) return "execution";
  return null;
}

export function projectIdFromPathname(pathname: string): string | null {
  const m = pathname.match(/^\/projects\/([^/?#]+)/);
  return m?.[1] ? decodeURIComponent(m[1]) : null;
}

/**
 * 상단 워크플로 탭을 보여줄지 여부. `?projectId=` 또는 `/projects/:id`에 프로젝트가 열려 있을 때만 true.
 * (홈 `/`·프로젝트 목록만 있는 화면에서는 컨텍스트 없음 → 탭 숨김.)
 */
export function resolveWorkflowProjectContextId(pathname: string, searchParams: URLSearchParams | null): string | null {
  const sp = searchParams ?? new URLSearchParams();
  const q = String(sp.get("projectId") ?? "").trim();
  if (q) return q;
  return projectIdFromPathname(pathname);
}

/** 워크플로 탭(요구사항·기능·…) 현재 단계 활성 표시용 */
export function isWorkflowStepNavActive(
  stepId: AppFlowStepId,
  pathname: string,
  searchParams: URLSearchParams | null,
  contextProjectId: string
): boolean {
  const sp = searchParams ?? new URLSearchParams();
  const ctx = contextProjectId.trim();
  if (!ctx) return false;
  const qp = String(sp.get("projectId") ?? "").trim();
  const pathPid = projectIdFromPathname(pathname);

  if (stepId === "planning") {
    return pathPid === ctx && sp.get("view") === "workspace";
  }
  if (stepId === "requirements") {
    if (!(pathname === "/requirements" || pathname.startsWith("/requirements/"))) return false;
    return qp === ctx;
  }
  if (stepId === "features") {
    if (!(pathname === "/features" || pathname.startsWith("/features/"))) return false;
    return qp === ctx;
  }
  if (stepId === "tasks") {
    if (!(pathname === "/tasks" || pathname.startsWith("/tasks/"))) return false;
    return qp === ctx;
  }
  if (stepId === "execution") {
    if (!(pathname === "/execution" || pathname.startsWith("/execution/"))) return false;
    return qp === ctx;
  }
  if (stepId === "trace") {
    if (!(pathname === "/trace" || pathname.startsWith("/trace/"))) return false;
    return qp === ctx;
  }
  return false;
}

export function nextStepAfter(current: AppFlowStepId): AppFlowStepDef | null {
  const idx = APP_FLOW_STEPS.findIndex((s) => s.id === current);
  if (idx < 0 || idx >= APP_FLOW_STEPS.length - 1) return null;
  return APP_FLOW_STEPS[idx + 1] ?? null;
}
