import { redirect } from "next/navigation";

export default async function FeaturesPage({
  searchParams,
}: {
  searchParams: Promise<Record<string, string | string[] | undefined>>;
}) {
  const sp = await searchParams;
  const raw = sp.projectId;
  const projectId = Array.isArray(raw) ? String(raw[0] ?? "").trim() : String(raw ?? "").trim();
  const q = projectId ? `?projectId=${encodeURIComponent(projectId)}` : "";
  redirect(`/requirements${q}`);
}
