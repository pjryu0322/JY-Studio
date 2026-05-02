export const APP_FLOW_LAST_PROJECT_KEY = "jyo:flow:lastProjectId";

/** 프로젝트 워크플로 상태가 바뀐 뒤 상단 단계 링크를 즉시 다시 불러오기 위해 디스패치합니다. */
export const APP_FLOW_PROJECT_CONTEXT_REFRESH_EVENT = "jyo:app-flow-project-context-refresh";

/** `AppFlowGuidance` 등이 구독하는 컨텍스트 리로드를 트리거합니다. */
export function notifyAppFlowProjectContextRefresh(): void {
  if (typeof window === "undefined") return;
  window.dispatchEvent(new Event(APP_FLOW_PROJECT_CONTEXT_REFRESH_EVENT));
}

export type AppFlowStepId =
  | "requirements"
  | "service_flow"
  | "features"
  | "tasks"
  | "planning"
  | "execution"
  | "prototype_review"
  | "trace";

export type AppFlowStepDef = Readonly<{
  id: AppFlowStepId;
  label: string;
}>;

export const APP_FLOW_STEPS: readonly AppFlowStepDef[] = [
  { id: "requirements", label: "아이디어 구체화" },
  { id: "service_flow", label: "액터 및 서비스 흐름 정의" },
  { id: "features", label: "기능 정리" },
  { id: "tasks", label: "작업 정리" },
  { id: "planning", label: "생성 준비" },
  { id: "execution", label: "프로토타입 생성" },
  { id: "prototype_review", label: "프로토타입 검토" },
  { id: "trace", label: "추적" },
] as const;

/** 프로젝트 허브(스펙·작업 준비)는 `?view=workspace`로 구분합니다. */
export function appFlowStepHref(stepId: AppFlowStepId, projectId: string | null): string {
  const pid = projectId?.trim() || null;
  const q = pid ? `?projectId=${encodeURIComponent(pid)}` : "";
  switch (stepId) {
    case "requirements":
      return `/requirements${q}`;
    case "service_flow":
      return pid
        ? `/requirements?projectId=${encodeURIComponent(pid)}&stage=service-flow`
        : "/requirements?stage=service-flow";
    case "features":
      return `/features${q}`;
    case "tasks":
      return `/tasks${q}`;
    case "planning":
      return pid ? `/projects/${encodeURIComponent(pid)}?view=workspace` : "/";
    case "execution":
      return `/execution${q}`;
    case "prototype_review":
      return `/prototype-review${q}`;
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
  if (p === "/requirements" || p.startsWith("/requirements/")) {
    const stage = String(sp.get("stage") ?? "").trim().toLowerCase();
    if (stage === "service-flow") return "service_flow";
    return "requirements";
  }
  if (p === "/collaboration" || p.startsWith("/collaboration/")) return null;
  if (p === "/features" || p.startsWith("/features/")) return "features";
  if (p === "/tasks" || p.startsWith("/tasks/")) return "tasks";
  if (p.startsWith("/projects/")) {
    return sp.get("view") === "workspace" ? "planning" : "requirements";
  }
  /** 플랫폼 홈·프로젝트 목록: 워크플로 단계로 취급하지 않음(상단 탭·가이드 혼동 방지). */
  if (isPlatformHomeSurface(p)) return null;
  if (p === "/execution" || p.startsWith("/execution/")) return "execution";
  if (p === "/prototype-review" || p.startsWith("/prototype-review/")) return "prototype_review";
  if (p === "/trace" || p.startsWith("/trace/")) return "trace";
  if (p.startsWith("/planning-execution")) return "execution";
  return null;
}

export function projectIdFromPathname(pathname: string): string | null {
  const m = pathname.match(/^\/projects\/([^/?#]+)/);
  return m?.[1] ? decodeURIComponent(m[1]) : null;
}

/** 플랫폼 홈·프로젝트 목록·생성 폼 화면 (`/`·`/workspace` 리다이렉트 대상). 워크플로 “생성 준비” 허브와 동일시하지 않음. */
export function isPlatformHomeSurface(pathname: string): boolean {
  const p = pathname || "/";
  return p === "/" || p === "/workspace";
}

/**
 * 상단 워크플로·프로젝트 메뉴용 프로젝트 ID.
 * - `/projects/:id` 경로면 해당 id (워크스페이스·상세 모두 “프로젝트 열림”).
 * - 그 외 경로에서는 `?projectId=`만 인정.
 * - 플랫폼 홈 `/`·`/workspace`에서는 URL에 `?projectId=`가 있어도 컨텍스트 없음(목록 화면에서 상단 탭이 남지 않도록).
 */
export function resolveWorkflowProjectContextId(pathname: string, searchParams: URLSearchParams | null): string | null {
  const p = pathname || "/";
  if (isPlatformHomeSurface(p)) return null;

  const sp = searchParams ?? new URLSearchParams();
  const q = String(sp.get("projectId") ?? "").trim();
  if (q) return q;
  return projectIdFromPathname(p);
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
  /** 홈에서는 어떤 워크플로 탭도 활성 표시하지 않음(과거 `/`를 생성 준비와 혼동하던 케이스 방지). */
  if (isPlatformHomeSurface(pathname)) return false;
  const qp = String(sp.get("projectId") ?? "").trim();
  const pathPid = projectIdFromPathname(pathname);

  if (stepId === "planning") {
    return pathPid === ctx && sp.get("view") === "workspace";
  }
  if (stepId === "requirements") {
    if (!(pathname === "/requirements" || pathname.startsWith("/requirements/"))) return false;
    const stage = String(sp.get("stage") ?? "").trim().toLowerCase();
    return qp === ctx && stage !== "service-flow";
  }
  if (stepId === "service_flow") {
    if (!(pathname === "/requirements" || pathname.startsWith("/requirements/"))) return false;
    const stage = String(sp.get("stage") ?? "").trim().toLowerCase();
    return qp === ctx && stage === "service-flow";
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
  if (stepId === "prototype_review") {
    if (!(pathname === "/prototype-review" || pathname.startsWith("/prototype-review/"))) return false;
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
