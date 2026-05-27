export type ProjectScopedCustomEventDetail<TPayload extends object> = Readonly<
  {
    readonly projectId: string;
  } & TPayload
>;

export type ProjectScopedCustomEventBus<TPayload extends object> = Readonly<{
  readonly eventName: string;
  dispatch(projectId: string, payload: TPayload): void;
  subscribe(projectId: string, handler: (payload: TPayload) => void): () => void;
}>;

/**
 * 프로젝트 단위 window CustomEvent dispatch/subscribe.
 * 레일·보조 패널 등 화면 간 open 상태 동기화에 사용합니다.
 */
export function createProjectScopedCustomEventBus<TPayload extends object>(
  eventName: string,
): ProjectScopedCustomEventBus<TPayload> {
  function dispatch(projectId: string, payload: TPayload): void {
    const id = projectId.trim();
    if (!id || typeof window === "undefined") return;
    window.dispatchEvent(
      new CustomEvent<ProjectScopedCustomEventDetail<TPayload>>(eventName, {
        detail: { ...payload, projectId: id },
      }),
    );
  }

  function subscribe(projectId: string, handler: (payload: TPayload) => void): () => void {
    const id = projectId.trim();
    if (!id || typeof window === "undefined") return () => {};
    const onEvent = (e: Event) => {
      const detail = (e as CustomEvent<ProjectScopedCustomEventDetail<TPayload>>).detail;
      if (!detail) return;
      const eventProjectId = String(detail.projectId ?? "").trim();
      if (eventProjectId && eventProjectId !== id) return;
      const { projectId: _scoped, ...payload } = detail;
      handler(payload as TPayload);
    };
    window.addEventListener(eventName, onEvent as EventListener);
    return () => window.removeEventListener(eventName, onEvent as EventListener);
  }

  return { eventName, dispatch, subscribe };
}
