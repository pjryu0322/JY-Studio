import { ProjectMembersAdminClient } from "@/components/project-members/ProjectMembersAdminClient";

function pickFirst(v: string | string[] | undefined): string {
  if (v == null) return "";
  return Array.isArray(v) ? String(v[0] ?? "").trim() : String(v).trim();
}

export default async function ProjectMembersProjectPage({
  params,
  searchParams,
}: {
  params: Promise<{ projectId?: string }>;
  searchParams?: Promise<Record<string, string | string[] | undefined>>;
}) {
  const p = await params;
  const sp = searchParams ? await searchParams : {};
  const projectId = String(p.projectId ?? "").trim() || pickFirst(sp.projectId);

  return (
    <div style={{ minHeight: "60vh", background: "#f8fafc" }}>
      <ProjectMembersAdminClient initialProjectId={projectId} />
    </div>
  );
}

