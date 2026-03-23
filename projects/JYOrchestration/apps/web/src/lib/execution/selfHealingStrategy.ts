export function getSelfHealingAction(failureType: string) {
  switch (failureType) {
    case "GIT_CONFLICT":
      return {
        action: "RETRY_WITH_REBASE",
      };
    case "GIT_APPLY_FAILED":
      return {
        action: "REGENERATE_PATCH",
      };
    case "CURSOR_EXECUTION_FAILED":
      return {
        action: "RETRY_EXECUTION",
      };
    case "PR_CREATION_FAILED":
      return {
        action: "RETRY_PR",
      };
    case "AUTH_ERROR":
      return {
        action: "REQUIRE_AUTH",
      };
    case "NETWORK_ERROR":
      return {
        action: "RETRY_WITH_DELAY",
      };
    default:
      return {
        action: "MANUAL_REVIEW",
      };
  }
}

