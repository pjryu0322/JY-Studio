import type { PrototypeDeployStatusSnapshot, PrototypeRun } from "@/lib/prototype/prototypeRunTypes";
import type { PrototypeRunStatusReason } from "@/lib/prototype/prototypeRunTypes";

export type LatestPrototypeRunResponse = Readonly<{
  success: boolean;
  data?: {
    run: PrototypeRun | null;
    runVersionNo?: number | null;
    runTotalCount?: number | null;
    automationAvailable: boolean;
    automationBlockReason: PrototypeRunStatusReason | null;
  };
  message?: string;
}>;

export async function fetchPrototypeRunsList(projectId: string): Promise<{
  success: boolean;
  data?: { runs: Array<{ id: string; status: string; updatedAt: string; createdAt: string; previewUrl: string | null }> };
  message?: string;
}> {
  const u = new URL("/api/prototype-runs/list", window.location.origin);
  u.searchParams.set("projectId", projectId);
  const res = await fetch(u.toString(), { credentials: "include" });
  return (await res.json()) as {
    success: boolean;
    data?: { runs: Array<{ id: string; status: string; updatedAt: string; createdAt: string; previewUrl: string | null }> };
    message?: string;
  };
}

export async function fetchPrototypeRunById(projectId: string, runId: string): Promise<LatestPrototypeRunResponse> {
  const u = new URL(`/api/prototype-runs/${encodeURIComponent(runId)}`, window.location.origin);
  u.searchParams.set("projectId", projectId);
  const res = await fetch(u.toString(), { credentials: "include" });
  return (await res.json()) as LatestPrototypeRunResponse;
}

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
  plannerContext?: {
    projectDescription: string;
    actorFlowSummary: string;
    featureDraftTitles: readonly string[];
    ideationSummary?: string;
  };
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

export async function postPrototypePreparePreview(
  runId: string,
  body: { projectId: string },
): Promise<{ success: boolean; data?: { run: PrototypeRun; deploy: PrototypeDeployStatusSnapshot }; message?: string }> {
  const res = await fetch(`/api/prototype-runs/${encodeURIComponent(runId)}/prepare-preview`, {
    method: "POST",
    credentials: "include",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify(body),
  });
  return (await res.json()) as {
    success: boolean;
    data?: { run: PrototypeRun; deploy: PrototypeDeployStatusSnapshot };
    message?: string;
  };
}

export async function postPrototypeRequestDeploy(
  runId: string,
  body: { projectId: string },
): Promise<{ success: boolean; data?: { run: PrototypeRun; deploy: PrototypeDeployStatusSnapshot }; message?: string }> {
  const res = await fetch(`/api/prototype-runs/${encodeURIComponent(runId)}/request-deploy`, {
    method: "POST",
    credentials: "include",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify(body),
  });
  return (await res.json()) as {
    success: boolean;
    data?: { run: PrototypeRun; deploy: PrototypeDeployStatusSnapshot };
    message?: string;
  };
}

export async function postPrototypeDeployProceed(
  runId: string,
  body: { projectId: string },
): Promise<{ success: boolean; data?: { run: PrototypeRun; deploy: PrototypeDeployStatusSnapshot }; message?: string }> {
  const res = await fetch(`/api/prototype-runs/${encodeURIComponent(runId)}/deploy-proceed`, {
    method: "POST",
    credentials: "include",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify(body),
  });
  return (await res.json()) as {
    success: boolean;
    data?: { run: PrototypeRun; deploy: PrototypeDeployStatusSnapshot };
    message?: string;
  };
}

export async function postPrototypeDeploySecurityRecheck(
  runId: string,
  body: { projectId: string },
): Promise<{ success: boolean; data?: { run: PrototypeRun; deploy: PrototypeDeployStatusSnapshot }; message?: string }> {
  const res = await fetch(`/api/prototype-runs/${encodeURIComponent(runId)}/deploy-security-recheck`, {
    method: "POST",
    credentials: "include",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify(body),
  });
  return (await res.json()) as {
    success: boolean;
    data?: { run: PrototypeRun; deploy: PrototypeDeployStatusSnapshot };
    message?: string;
  };
}

export async function postPrototypeDeploySecurityFixRequest(
  runId: string,
  body: { projectId: string },
): Promise<{ success: boolean; data?: { run: PrototypeRun; deploy: PrototypeDeployStatusSnapshot }; message?: string }> {
  const res = await fetch(`/api/prototype-runs/${encodeURIComponent(runId)}/deploy-security-fix-request`, {
    method: "POST",
    credentials: "include",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify(body),
  });
  return (await res.json()) as {
    success: boolean;
    data?: { run: PrototypeRun; deploy: PrototypeDeployStatusSnapshot };
    message?: string;
  };
}

export async function getPrototypeDeployStatusApi(
  projectId: string,
  runId: string,
  refresh: boolean,
): Promise<{ success: boolean; data?: { run: PrototypeRun; deploy: PrototypeDeployStatusSnapshot }; message?: string }> {
  const u = new URL(`/api/prototype-runs/${encodeURIComponent(runId)}/deploy-status`, window.location.origin);
  u.searchParams.set("projectId", projectId);
  if (refresh) u.searchParams.set("refresh", "1");
  const res = await fetch(u.toString(), { credentials: "include" });
  return (await res.json()) as {
    success: boolean;
    data?: { run: PrototypeRun; deploy: PrototypeDeployStatusSnapshot };
    message?: string;
  };
}

export async function postPrototypeRunRefresh(
  runId: string,
  body: { projectId: string },
): Promise<{
  success: boolean;
  data?: {
    run: PrototypeRun | null;
    nextAction?:
      | "WAIT_CURSOR"
      | "WAIT_GITHUB_PUSH"
      | "REVIEWING"
      | "OPEN_PR"
      | "MERGED"
      | "CONNECT_PREVIEW_URL"
      | "REWORK_REQUIRED"
      | "FAILED"
      | "BLOCKED";
    userMessage?: string | null;
  };
  message?: string;
}> {
  const res = await fetch(`/api/prototype-runs/${encodeURIComponent(runId)}/refresh`, {
    method: "POST",
    credentials: "include",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify(body),
  });
  return (await res.json()) as { success: boolean; data?: { run: PrototypeRun | null }; message?: string };
}

export async function postPrototypeConfirmExecution(
  runId: string,
  body: { projectId: string },
): Promise<{ success: boolean; data?: { run: PrototypeRun | null }; message?: string }> {
  const res = await fetch(`/api/prototype-runs/${encodeURIComponent(runId)}/confirm-execution`, {
    method: "POST",
    credentials: "include",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify(body),
  });
  return (await res.json()) as { success: boolean; data?: { run: PrototypeRun | null }; message?: string };
}

export async function postPrototypeRegeneratePlan(
  runId: string,
  body: {
    projectId: string;
    userFeedback?: string;
    plannerContext?: {
      projectDescription: string;
      actorFlowSummary: string;
      featureDraftTitles: readonly string[];
      ideationSummary?: string;
    };
  },
): Promise<{ success: boolean; data?: { run: PrototypeRun | null }; message?: string }> {
  const res = await fetch(`/api/prototype-runs/${encodeURIComponent(runId)}/regenerate-plan`, {
    method: "POST",
    credentials: "include",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify(body),
  });
  return (await res.json()) as { success: boolean; data?: { run: PrototypeRun | null }; message?: string };
}

export type RetryPrototypeWorkUnitMode = "same_prompt" | "regenerate_prompt" | "skip_admin";

export async function postPrototypeRetryWorkUnit(
  runId: string,
  body: { projectId: string; workUnitOrder: number; mode: RetryPrototypeWorkUnitMode },
): Promise<{ success: boolean; data?: { run: PrototypeRun | null }; message?: string }> {
  const res = await fetch(`/api/prototype-runs/${encodeURIComponent(runId)}/retry-work-unit`, {
    method: "POST",
    credentials: "include",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify(body),
  });
  return (await res.json()) as { success: boolean; data?: { run: PrototypeRun | null }; message?: string };
}
