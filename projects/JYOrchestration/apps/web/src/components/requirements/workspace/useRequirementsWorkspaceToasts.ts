"use client";

import { useTimedSuccessErrorToasts } from "@/components/workspace/useTimedSuccessErrorToasts";

export function useRequirementsWorkspaceToasts() {
  return useTimedSuccessErrorToasts({ successDismissMs: 2000, errorDismissMs: 4500 });
}
