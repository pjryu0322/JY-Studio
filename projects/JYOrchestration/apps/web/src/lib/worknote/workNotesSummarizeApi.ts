import { credentialsIncludeFetch } from "@/lib/http/credentialsIncludeFetch";

export type WorkNoteSummarizeWire = {
  readonly summary: string;
  readonly requestType: string;
  readonly priority: string;
  readonly priorityReason: string;
};

export type WorkNoteSummaryMode = "work_note" | "messenger_conversation";

export type PostWorkNoteSummarizeBody =
  | { readonly scope: "user"; readonly contentHtml: string; readonly summaryMode?: WorkNoteSummaryMode }
  | {
      readonly projectId: string;
      readonly contentHtml: string;
      readonly scope?: "project";
      readonly summaryMode?: WorkNoteSummaryMode;
    };

export type MessengerConversationSummarizeWire = {
  readonly summary: string;
};

function normalizeSummarizeWire(json: {
  data?: { summary?: string; requestType?: string; priority?: string; priorityReason?: string };
}): WorkNoteSummarizeWire {
  const summary = typeof json.data?.summary === "string" ? json.data.summary.trim() : "";
  if (!summary) throw new Error("요약 결과가 비어 있습니다.");
  return {
    summary,
    requestType: typeof json.data?.requestType === "string" ? json.data.requestType.trim() || "기타" : "기타",
    priority: typeof json.data?.priority === "string" ? json.data.priority.trim().toUpperCase() || "P2" : "P2",
    priorityReason:
      typeof json.data?.priorityReason === "string" && json.data.priorityReason.trim()
        ? json.data.priorityReason.trim()
        : "",
  };
}

export async function postWorkNoteSummarize(body: PostWorkNoteSummarizeBody): Promise<WorkNoteSummarizeWire> {
  const summaryMode = body.summaryMode ?? "work_note";
  const payload =
    body.scope === "user"
      ? { scope: "user", contentHtml: body.contentHtml, summaryMode }
      : {
          projectId: body.projectId.trim(),
          scope: body.scope ?? "project",
          contentHtml: body.contentHtml,
          summaryMode,
        };

  const res = await credentialsIncludeFetch("/api/work-notes/summarize", {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify(payload),
  });
  const json = (await res.json()) as {
    success?: boolean;
    message?: string;
    data?: { summary?: string; requestType?: string; priority?: string; priorityReason?: string };
  };
  if (!res.ok || !json.success) {
    throw new Error(json.message || `HTTP ${res.status}`);
  }
  return normalizeSummarizeWire(json);
}

/** 로그인 사용자 개인 메모·메신저 등 `scope=user` 요약. */
export async function postWorkNoteSummarizeFromHtml(contentHtml: string): Promise<WorkNoteSummarizeWire> {
  return postWorkNoteSummarize({ scope: "user", contentHtml });
}

/** Pre-Project 메신저 대화 요약(브레인스토밍 맥락, priority/requestType 없음). */
export async function postMessengerConversationSummarizeFromHtml(
  contentHtml: string
): Promise<MessengerConversationSummarizeWire> {
  const { summary } = await postWorkNoteSummarize({
    scope: "user",
    contentHtml,
    summaryMode: "messenger_conversation",
  });
  return { summary };
}
