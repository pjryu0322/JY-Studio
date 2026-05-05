import { RequirementsWorkspaceWithComposerBridge } from "@/components/requirements/RequirementsWorkspaceWithComposerBridge";

function pickFirst(v: string | string[] | undefined): string {
  if (v == null) return "";
  return Array.isArray(v) ? String(v[0] ?? "").trim() : String(v).trim();
}

export default async function RequirementsPage({
  searchParams,
}: {
  searchParams: Promise<Record<string, string | string[] | undefined>>;
}) {
  const sp = await searchParams;
  const projectId = pickFirst(sp.projectId);
  const workflowNotice = pickFirst(sp.workflowNotice);
  const stage = pickFirst(sp.stage);

  return (
    <div className="jyo-requirements-page-shell">
      <RequirementsWorkspaceWithComposerBridge initialProjectId={projectId} initialWorkflowNotice={workflowNotice} initialStage={stage} />
    </div>
  );
}
