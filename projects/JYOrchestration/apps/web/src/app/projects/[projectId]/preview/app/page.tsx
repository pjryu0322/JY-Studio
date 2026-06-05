import { GeneratedAppPreviewPageClient } from "@/components/preview/GeneratedAppPreviewPageClient";

type PageProps = {
  readonly params: Promise<{ readonly projectId: string }>;
};

export default async function ProjectGeneratedAppPreviewPage(props: PageProps) {
  const params = await props.params;
  const projectId = typeof params.projectId === "string" ? params.projectId : "";
  return <GeneratedAppPreviewPageClient projectId={projectId} />;
}
