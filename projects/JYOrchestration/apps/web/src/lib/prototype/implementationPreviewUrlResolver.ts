import { computeGithubPagesPreviewUrl } from "@/lib/prototype/githubPagesPreviewDeployment";
import {
  buildCodeTaskPreviewFallbackUrl,
  sanitizeIntegratedAppPreviewUrl,
} from "@/lib/prototype/implementationPreviewEntryPolicy";
import type { ImplementationPreviewRuntimeV1 } from "@/lib/prototype/implementationPreviewRuntimeV1";
import { isExternalPreviewUrl } from "@/lib/prototype/previewUrlClassification";

export function resolveActualIntegratedPreviewUrl(input: {
  readonly owner: string;
  readonly repo: string;
  readonly projectId: string;
  readonly githubPagesUrl?: string | null;
}): string {
  const explicit = String(input.githubPagesUrl ?? "").trim();
  if (explicit && isExternalPreviewUrl(explicit)) {
    return explicit.endsWith("/") ? explicit : `${explicit}/`;
  }
  return computeGithubPagesPreviewUrl({
    owner: input.owner,
    repo: input.repo,
    projectId: input.projectId,
  });
}

export function resolveCodeTaskDiagnosticPreviewUrl(projectId: string): string {
  return buildCodeTaskPreviewFallbackUrl(projectId);
}

export function resolveActualIntegratedPreviewUrlForOpen(input: {
  readonly projectId: string;
  readonly previewRuntime?: ImplementationPreviewRuntimeV1 | null;
  readonly snapshotPreviewUrl?: string | null;
}): string | null {
  const pid = input.projectId.trim();
  if (!pid) return null;
  const runtime = input.previewRuntime ?? null;
  const candidates = [
    runtime?.externalPreviewUrl,
    runtime?.githubPagesUrl,
    runtime?.appPreviewUrl,
    runtime?.internalAppPreviewUrl,
    input.snapshotPreviewUrl,
  ];
  for (const raw of candidates) {
    const url = sanitizeIntegratedAppPreviewUrl({ projectId: pid, url: String(raw ?? "").trim() });
    if (url) return url;
  }
  return null;
}
