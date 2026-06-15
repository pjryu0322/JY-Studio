import { ImplementationPreviewViewerPageClient } from "@/components/preview/ImplementationPreviewViewerPageClient";

type PageProps = {
  readonly params: Promise<{ readonly projectId: string }>;
  readonly searchParams: Promise<{
    readonly target?: string | string[];
    readonly composerAttach?: string | string[];
  }>;
};

function readSingleSearchParam(raw: string | string[] | undefined): string | null {
  if (typeof raw === "string") return raw.trim() || null;
  if (Array.isArray(raw)) {
    const first = raw[0];
    return typeof first === "string" ? first.trim() || null : null;
  }
  return null;
}

function readTargetParam(raw: string | string[] | undefined): string | null {
  return readSingleSearchParam(raw);
}

function readComposerAttachEnabled(raw: string | string[] | undefined): boolean {
  const value = readSingleSearchParam(raw);
  if (value === "0" || value === "false") return false;
  return true;
}

export default async function ImplementationPreviewViewerPage(props: PageProps) {
  const params = await props.params;
  const searchParams = await props.searchParams;
  const projectId = typeof params.projectId === "string" ? params.projectId : "";
  const initialTarget = readTargetParam(searchParams.target);
  const composerAttachEnabled = readComposerAttachEnabled(searchParams.composerAttach);

  return (
    <ImplementationPreviewViewerPageClient
      projectId={projectId}
      initialTarget={initialTarget}
      composerAttachEnabled={composerAttachEnabled}
    />
  );
}
