import { ImplementationPreviewViewerPageClient } from "@/components/preview/ImplementationPreviewViewerPageClient";

type PageProps = {
  readonly params: Promise<{ readonly projectId: string }>;
  readonly searchParams: Promise<{ readonly target?: string | string[] }>;
};

function readTargetParam(raw: string | string[] | undefined): string | null {
  if (typeof raw === "string") return raw.trim() || null;
  if (Array.isArray(raw)) {
    const first = raw[0];
    return typeof first === "string" ? first.trim() || null : null;
  }
  return null;
}

export default async function ImplementationPreviewViewerPage(props: PageProps) {
  const params = await props.params;
  const searchParams = await props.searchParams;
  const projectId = typeof params.projectId === "string" ? params.projectId : "";
  const initialTarget = readTargetParam(searchParams.target);

  return (
    <ImplementationPreviewViewerPageClient projectId={projectId} initialTarget={initialTarget} />
  );
}
