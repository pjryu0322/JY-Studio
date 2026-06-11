import type { ImplementationPrimaryActionResolutionV1 } from "@/lib/prototype/implementationActionRoutingPolicy";

export type ImplementationRuntimeActionV1 =
  | "execute_selected_runnable_codetasks"
  | "prepare_integration_preview"
  | "open_preview"
  | "start_job"
  | "client_trace";

/**
 * Maps unified primary action to implementation-runtime API action + payload ids.
 * Execute path uses canonical `execute_selected_runnable_codetasks` (server aliases to start_job).
 */
export function buildImplementationRuntimeActionRequest(input: {
  readonly resolution: ImplementationPrimaryActionResolutionV1;
}): Readonly<{
  readonly apiAction: ImplementationRuntimeActionV1 | null;
  readonly selectedCodeTaskIds: readonly string[];
  readonly blockedMessage: string | null;
}> {
  const resolution = input.resolution;
  switch (resolution.action) {
    case "execute_selected_runnable_codetasks":
      if (!resolution.codeTaskIds.length) {
        return {
          apiAction: null,
          selectedCodeTaskIds: [],
          blockedMessage: resolution.disabledReason ?? "실행할 CodeTask를 선택해 주세요.",
        };
      }
      return {
        apiAction: "execute_selected_runnable_codetasks",
        selectedCodeTaskIds: resolution.codeTaskIds,
        blockedMessage: null,
      };
    case "prepare_integration_preview":
      return {
        apiAction: "prepare_integration_preview",
        selectedCodeTaskIds: resolution.codeTaskIds,
        blockedMessage: null,
      };
    case "open_preview":
      return {
        apiAction: "open_preview",
        selectedCodeTaskIds: [],
        blockedMessage: null,
      };
    case "blocked_no_selection":
    case "blocked_no_available_action":
      return {
        apiAction: null,
        selectedCodeTaskIds: [],
        blockedMessage: resolution.disabledReason,
      };
    default:
      return { apiAction: null, selectedCodeTaskIds: [], blockedMessage: "지원하지 않는 action입니다." };
  }
}
