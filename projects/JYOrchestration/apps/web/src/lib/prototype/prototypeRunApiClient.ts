import type { PrototypeRun } from "@/lib/prototype/prototypeRunTypes";
import type { PrototypeRunStatusReason } from "@/lib/prototype/prototypeRunTypes";

export type LatestPrototypeRunResponse = Readonly<{
  success: boolean;
  data?: {
    run: PrototypeRun | null;
    automationAvailable: boolean;
    automationBlockReason: PrototypeRunStatusReason | null;
  };
  message?: string;
}>;

export async function fetchLatestPrototypeRun(projectId: string): Promise<LatestPrototypeRunResponse> {
  const u = new URL("/api/prototype-runs/latest", window.location.origin);
  u.searchParams.set("projectId", projectId);
  const res = await fetch(u.toString(), { credentials: "include" });
  return (await res.json()) as LatestPrototypeRunResponse;
}

export type CreatePrototypeRunResponse = Readonly<{
  success: boolean;
  data?: {
    run: PrototypeRun;
    automationAvailable: boolean;
    automationBlockReason: PrototypeRunStatusReason | null;
    message?: string;
  };
  message?: string;
}>;

export async function postCreatePrototypeRun(body: {
  projectId: string;
  selectedTemplate: string;
  promptSnapshot: string;
  startCursorAgent: boolean;
}): Promise<CreatePrototypeRunResponse> {
  const res = await fetch("/api/prototype-runs", {
    method: "POST",
    credentials: "include",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify(body),
  });
  return (await res.json()) as CreatePrototypeRunResponse;
}

export async function postPrototypePreviewUrl(
  runId: string,
  body: { projectId: string; previewUrl: string },
): Promise<{ success: boolean; data?: { run: PrototypeRun }; message?: string }> {
  const res = await fetch(`/api/prototype-runs/${encodeURIComponent(runId)}/preview-url`, {
    method: "POST",
    credentials: "include",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify(body),
  });
  return (await res.json()) as { success: boolean; data?: { run: PrototypeRun }; message?: string };
}

export async function postPrototypeRunRefresh(
  runId: string,
  body: { projectId: string },
): Promise<{ success: boolean; data?: { run: PrototypeRun | null }; message?: string }> {
  const res = await fetch(`/api/prototype-runs/${encodeURIComponent(runId)}/refresh`, {
    method: "POST",
    credentials: "include",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify(body),
  });
  return (await res.json()) as { success: boolean; data?: { run: PrototypeRun | null }; message?: string };
}
