"use client";

import { useCallback, useEffect, useState } from "react";
import { useSearchParams } from "next/navigation";
import { ReviewChatPanel } from "@/components/prototype-review/ReviewChatPanel";
import { ReviewPreviewPanel } from "@/components/prototype-review/ReviewPreviewPanel";
import { EmptyState, InlineAlert, LoadingState } from "@/components/ui";
import { WorkflowStageChrome } from "@/components/workflow/primitives/WorkflowStageChrome";
import type { PrototypeImprovementItem, PrototypeReviewMessage } from "@/lib/prototype/prototypeReviewStore";
import {
  fetchPrototypeReviewThread,
  postPrototypeReviewChatTurn,
  postPrototypeReviewFollowUpDrafts,
  postPrototypeReviewImprovements,
  postPrototypeReviewSummarize,
} from "@/lib/prototype/prototypeReviewClient";
import { fetchLatestPrototypeRun, postPrototypeRunRefresh } from "@/lib/prototype/prototypeRunApiClient";
import type { PrototypeRun } from "@/lib/prototype/prototypeRunTypes";

type Busy = "send" | "summarize" | "improvements" | "drafts" | null;

export function PrototypeReviewPageClient() {
  const search = useSearchParams();
  const projectId = search?.get("projectId")?.trim() ?? "";

  const [run, setRun] = useState<PrototypeRun | null>(null);
  const [versionNo, setVersionNo] = useState<number | null>(null);
  const [totalRuns, setTotalRuns] = useState<number | null>(null);
  const [messages, setMessages] = useState<PrototypeReviewMessage[]>([]);
  const [improvementItems, setImprovementItems] = useState<PrototypeImprovementItem[] | null>(null);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [busy, setBusy] = useState<Busy>(null);
  const [refreshing, setRefreshing] = useState(false);

  const loadRun = useCallback(async () => {
    if (!projectId) return;
    setLoading(true);
    setError(null);
    try {
      const res = await fetchLatestPrototypeRun(projectId);
      if (!res.success) {
        setError(res.message ?? "실행 정보를 불러오지 못했습니다.");
        setRun(null);
        setVersionNo(null);
        setTotalRuns(null);
        return;
      }
      setRun(res.data?.run ?? null);
      setVersionNo(res.data?.runVersionNo ?? null);
      setTotalRuns(res.data?.runTotalCount ?? null);
    } finally {
      setLoading(false);
    }
  }, [projectId]);

  const loadThread = useCallback(async () => {
    if (!projectId || !run?.id) return;
    const res = await fetchPrototypeReviewThread(projectId, run.id);
    if (res.success && res.data) {
      setMessages(res.data.messages);
      setImprovementItems(res.data.improvementItems);
    }
  }, [projectId, run?.id]);

  useEffect(() => {
    void loadRun();
  }, [loadRun]);

  useEffect(() => {
    void loadThread();
  }, [loadThread]);

  const onRefreshPreview = useCallback(async () => {
    if (!projectId || !run?.id) return;
    setRefreshing(true);
    setError(null);
    try {
      const ref = await postPrototypeRunRefresh(run.id, { projectId });
      if (!ref.success) {
        setError(ref.message ?? "새로고침에 실패했습니다.");
      }
      await loadRun();
    } finally {
      setRefreshing(false);
    }
  }, [projectId, run?.id, loadRun]);

  async function wrapBusy<T>(b: Busy, fn: () => Promise<T>): Promise<T | undefined> {
    if (busy) return undefined;
    setBusy(b);
    setError(null);
    try {
      return await fn();
    } finally {
      setBusy(null);
    }
  }

  if (!projectId) {
    return (
      <WorkflowStageChrome title="프로토타입 검토" subtitle="프로젝트를 연 뒤 이 단계에서 프리뷰와 검토 대화를 이어갑니다.">
        <EmptyState title="프로젝트가 선택되지 않았습니다" description="상단에서 프로젝트를 연결하거나, 프로젝트 허브에서 열어 주세요." />
      </WorkflowStageChrome>
    );
  }

  return (
    <WorkflowStageChrome
      title="프로토타입 검토"
      subtitle="프로토타입 생성 후 결과물을 보며 AI기획자와 개선점을 정리하고, 필요 시 작업 초안으로 넘깁니다."
    >
      {loading && !run ? (
        <LoadingState label="불러오는 중…" />
      ) : (
        <>
          {error ? (
            <InlineAlert variant="danger" style={{ marginBottom: 12 }}>
              {error}
            </InlineAlert>
          ) : null}
          <div
            style={{
              display: "grid",
              gridTemplateColumns: "repeat(auto-fit, minmax(min(100%, 340px), 1fr))",
              gap: 16,
              alignItems: "stretch",
            }}
          >
            <ReviewChatPanel
              disabled={!run}
              messages={messages}
              improvementItems={improvementItems}
              busy={busy !== null}
              busyAction={busy}
              onSend={(userMessage) =>
                void wrapBusy("send", async () => {
                  if (!run) return;
                  const res = await postPrototypeReviewChatTurn(projectId, run.id, userMessage);
                  if (!res.success) {
                    setError(res.message ?? "전송에 실패했습니다.");
                    return;
                  }
                  if (res.data?.messages) setMessages(res.data.messages);
                })
              }
              onSummarize={() =>
                void wrapBusy("summarize", async () => {
                  if (!run) return;
                  const res = await postPrototypeReviewSummarize(projectId, run.id);
                  if (!res.success) {
                    setError(res.message ?? "정리요청에 실패했습니다.");
                    return;
                  }
                  if (res.data?.messages) setMessages(res.data.messages);
                })
              }
              onImprovements={() =>
                void wrapBusy("improvements", async () => {
                  if (!run) return;
                  const res = await postPrototypeReviewImprovements(projectId, run.id);
                  if (!res.success) {
                    setError(res.message ?? "개선안 생성에 실패했습니다.");
                    return;
                  }
                  if (res.data) {
                    setImprovementItems(res.data.items);
                    setMessages(res.data.messages);
                  }
                })
              }
              onFollowUpDrafts={() =>
                void wrapBusy("drafts", async () => {
                  if (!run) return;
                  const res = await postPrototypeReviewFollowUpDrafts(projectId, run.id);
                  if (!res.success) {
                    setError(res.message ?? "작업 초안 생성에 실패했습니다.");
                    return;
                  }
                  if (res.data?.messages) setMessages(res.data.messages);
                })
              }
            />
            <ReviewPreviewPanel
              run={run}
              versionNo={versionNo}
              totalRuns={totalRuns}
              refreshing={refreshing}
              onRefresh={onRefreshPreview}
            />
          </div>
        </>
      )}
    </WorkflowStageChrome>
  );
}
