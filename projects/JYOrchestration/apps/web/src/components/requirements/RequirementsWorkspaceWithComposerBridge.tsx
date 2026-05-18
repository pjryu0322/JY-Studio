"use client";

import { WorkNoteComposerInsertProvider } from "@/components/worknote/WorkNoteComposerInsertContext";
import { RequirementsWorkspace } from "@/components/requirements/RequirementsWorkspace";

export function RequirementsWorkspaceWithComposerBridge({
  initialProjectId,
  initialWorkflowNotice,
}: {
  readonly initialProjectId: string;
  readonly initialWorkflowNotice: string;
}) {
  return (
    <WorkNoteComposerInsertProvider>
      <RequirementsWorkspace initialProjectId={initialProjectId} initialWorkflowNotice={initialWorkflowNotice} />
    </WorkNoteComposerInsertProvider>
  );
}
