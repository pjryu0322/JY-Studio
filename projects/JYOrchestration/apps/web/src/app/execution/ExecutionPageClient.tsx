"use client";

import { useRouter, useSearchParams } from "next/navigation";
import { ExecutionPageContent } from "@/components/workflow/execution/ExecutionPageContent";
import { useExecutionPageViewState } from "@/components/workflow/execution/executionPageViewState";
import { useCollaborationSessionResultsVersion } from "@/lib/workflow/useCollaborationSessionResultsSync";

export function ExecutionPageClient() {
  const router = useRouter();
  const search = useSearchParams();
  const sessionResultsVersion = useCollaborationSessionResultsVersion();

  const view = useExecutionPageViewState({ router, search, sessionResultsVersion });

  return (
    <ExecutionPageContent
      sessionId={view.sessionId}
      requirementId={view.requirementId}
      pre={view.pre}
      monitoring={view.monitoring}
      actions={view.actions}
      nextAction={view.nextAction}
      views={view.views}
      pageActions={view.pageActions}
    />
  );
}

