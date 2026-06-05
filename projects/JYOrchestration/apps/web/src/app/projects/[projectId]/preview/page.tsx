import { CompletedCodeTaskPreviewPageClient } from "@/components/preview/CompletedCodeTaskPreviewPageClient";

type PageProps = {
  readonly params: Promise<{ readonly projectId: string }>;
};

export default async function ProjectCompletedCodeTaskPreviewPage(props: PageProps) {
  const params = await props.params;
  const projectId = typeof params.projectId === "string" ? params.projectId : "";
  return <CompletedCodeTaskPreviewPageClient projectId={projectId} />;
}
