/**
 * SingleChat workspace mode — 화면은 동일, 오케스트레이션·주도 멤버만 분기.
 */

export type WorkspaceSingleChatMode = "planning" | "implementation";

export type OrchestrationMode = WorkspaceSingleChatMode;

export function resolveWorkspaceSingleChatMode(input: {
  readonly pathname?: string | null;
  readonly activeStage?: string | null;
}): WorkspaceSingleChatMode {
  const path = String(input.pathname ?? "").trim().toLowerCase();
  if (path === "/execution" || path.startsWith("/execution/")) return "implementation";
  const stage = String(input.activeStage ?? "").trim().toLowerCase();
  if (stage === "implementation" || stage === "execution" || stage === "prototype-build") {
    return "implementation";
  }
  return "planning";
}
