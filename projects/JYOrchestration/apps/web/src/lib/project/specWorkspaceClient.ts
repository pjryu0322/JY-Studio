/**
 * `/api/projects/[id]/spec-workspace` — GET / POST / PATCH 공통 URL·fetch 옵션.
 */

import { credentialsIncludeFetch } from "@/lib/http/credentialsIncludeFetch";

export function specWorkspaceUrl(projectId: string): string {
  return `/api/projects/${encodeURIComponent(projectId.trim())}/spec-workspace`;
}

export async function fetchSpecWorkspaceRequest(projectId: string): Promise<{ res: Response; json: unknown }> {
  const res = await credentialsIncludeFetch(specWorkspaceUrl(projectId));
  const json = await res.json();
  return { res, json };
}

export async function postSpecWorkspaceRequest(
  projectId: string,
  body: unknown
): Promise<{ res: Response; json: unknown }> {
  const res = await credentialsIncludeFetch(specWorkspaceUrl(projectId), {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify(body),
  });
  const json = await res.json();
  return { res, json };
}

export async function patchSpecWorkspaceRequest(
  projectId: string,
  body: unknown
): Promise<{ res: Response; json: unknown }> {
  const res = await credentialsIncludeFetch(specWorkspaceUrl(projectId), {
    method: "PATCH",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify(body),
  });
  const json = await res.json();
  return { res, json };
}
