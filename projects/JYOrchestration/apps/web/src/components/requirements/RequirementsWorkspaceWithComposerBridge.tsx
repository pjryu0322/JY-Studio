"use client";

import { WorkNoteComposerInsertProvider } from "@/components/worknote/WorkNoteComposerInsertContext";
import { RequirementsWorkspace } from "@/components/requirements/RequirementsWorkspace";

export function RequirementsWorkspaceWithComposerBridge({
  initialProjectId,
  initialWorkflowNotice,
  initialStage,
}: {
  readonly initialProjectId: string;
  readonly initialWorkflowNotice: string;
  readonly initialStage?: string;
}) {
  return (
    <WorkNoteComposerInsertProvider>
      <RequirementsWorkspace initialProjectId={initialProjectId} initialWorkflowNotice={initialWorkflowNotice} initialStage={initialStage} />
    </WorkNoteComposerInsertProvider>
  );
}
