import { ProjectMembersAdminClient } from "@/components/project-members/ProjectMembersAdminClient";

function pickFirst(v: string | string[] | undefined): string {
  if (v == null) return "";
  return Array.isArray(v) ? String(v[0] ?? "").trim() : String(v).trim();
}

export default async function ProjectMembersPage({
  searchParams,
}: {
  searchParams: Promise<Record<string, string | string[] | undefined>>;
}) {
  const sp = await searchParams;
  const projectId = pickFirst(sp.projectId);

  return (
    <div style={{ minHeight: "60vh", background: "#f8fafc" }}>
      <ProjectMembersAdminClient initialProjectId={projectId} />
    </div>
  );
}
