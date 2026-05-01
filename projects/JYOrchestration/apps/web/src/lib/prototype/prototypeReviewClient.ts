import type { PrototypeImprovementItem, PrototypeReviewMessage } from "@/lib/prototype/prototypeReviewStore";

export type ReviewThreadResponse = Readonly<{
  success: boolean;
  data?: {
    messages: PrototypeReviewMessage[];
    improvementItems: PrototypeImprovementItem[] | null;
  };
  message?: string;
}>;

export async function postPrototypeReviewBootstrap(projectId: string, runId: string): Promise<{
  success: boolean;
  data?: { seeded: boolean; messages: import("@/lib/prototype/prototypeReviewStore").PrototypeReviewMessage[] };
  message?: string;
}> {
  const res = await fetch("/api/prototype-review/bootstrap", {
    method: "POST",
    credentials: "include",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ projectId, runId }),
  });
  return (await res.json()) as {
    success: boolean;
    data?: { seeded: boolean; messages: import("@/lib/prototype/prototypeReviewStore").PrototypeReviewMessage[] };
    message?: string;
  };
}

export async function fetchPrototypeReviewThread(projectId: string, runId: string): Promise<ReviewThreadResponse> {
  const u = new URL("/api/prototype-review/thread", window.location.origin);
  u.searchParams.set("projectId", projectId);
  u.searchParams.set("runId", runId);
  const res = await fetch(u.toString(), { credentials: "include" });
  return (await res.json()) as ReviewThreadResponse;
}

export async function postPrototypeReviewChatTurn(projectId: string, runId: string, userMessage: string): Promise<{
  success: boolean;
  data?: { messages: PrototypeReviewMessage[]; improvementItems: PrototypeImprovementItem[] | null };
  message?: string;
  code?: string;
}> {
  const res = await fetch("/api/prototype-review/chat-turn", {
    method: "POST",
    credentials: "include",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ projectId, runId, userMessage }),
  });
  return (await res.json()) as {
    success: boolean;
    data?: { messages: PrototypeReviewMessage[]; improvementItems: PrototypeImprovementItem[] | null };
    message?: string;
    code?: string;
  };
}

export async function postPrototypeReviewSummarize(projectId: string, runId: string): Promise<{
  success: boolean;
  data?: { messages: PrototypeReviewMessage[]; improvementItems: PrototypeImprovementItem[] | null };
  message?: string;
  code?: string;
}> {
  const res = await fetch("/api/prototype-review/summarize", {
    method: "POST",
    credentials: "include",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ projectId, runId }),
  });
  return (await res.json()) as {
    success: boolean;
    data?: { messages: PrototypeReviewMessage[]; improvementItems: PrototypeImprovementItem[] | null };
    message?: string;
    code?: string;
  };
}

export async function postPrototypeReviewImprovements(
  projectId: string,
  runId: string,
  opts?: { silentFollowup?: boolean },
): Promise<{
  success: boolean;
  data?: { items: PrototypeImprovementItem[]; messages: PrototypeReviewMessage[] };
  message?: string;
  code?: string;
}> {
  const res = await fetch("/api/prototype-review/improvements", {
    method: "POST",
    credentials: "include",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ projectId, runId, silentFollowup: Boolean(opts?.silentFollowup) }),
  });
  return (await res.json()) as {
    success: boolean;
    data?: { items: PrototypeImprovementItem[]; messages: PrototypeReviewMessage[] };
    message?: string;
    code?: string;
  };
}

export async function postPrototypeReviewFollowUpDrafts(projectId: string, runId: string): Promise<{
  success: boolean;
  data?: { draftIds: string[]; messages: PrototypeReviewMessage[]; improvementItems: PrototypeImprovementItem[] | null };
  message?: string;
}> {
  const res = await fetch("/api/prototype-review/follow-up-drafts", {
    method: "POST",
    credentials: "include",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ projectId, runId }),
  });
  return (await res.json()) as {
    success: boolean;
    data?: { draftIds: string[]; messages: PrototypeReviewMessage[]; improvementItems: PrototypeImprovementItem[] | null };
    message?: string;
  };
}
