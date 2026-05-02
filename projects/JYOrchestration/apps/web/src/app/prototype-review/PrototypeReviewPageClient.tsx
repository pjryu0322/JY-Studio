"use client";

import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import { useSearchParams } from "next/navigation";
import { FloatingReviewChatDock } from "@/components/prototype-review/FloatingReviewChatDock";
import { MobileReviewTabs, type MobileReviewTabId } from "@/components/prototype-review/MobileReviewTabs";
import { PreviewViewport } from "@/components/prototype-review/PreviewViewport";
import { ReviewChatPanel } from "@/components/prototype-review/ReviewChatPanel";
import { ReviewHeader } from "@/components/prototype-review/ReviewHeader";
import { EmptyState, InlineAlert, LoadingState } from "@/components/ui";
import { WorkflowStageChrome } from "@/components/workflow/primitives/WorkflowStageChrome";
import { usePrototypeReviewMobileLayout } from "@/components/ui/breakpoints";
import type { PrototypeImprovementItem, PrototypeReviewMessage } from "@/lib/prototype/prototypeReviewStore";
import {
  fetchPrototypeReviewThread,
  postPrototypeReviewBootstrap,
  postPrototypeReviewChatTurn,
  postPrototypeReviewFollowUpDrafts,
  postPrototypeReviewImprovements,
  postPrototypeReviewSummarize,
} from "@/lib/prototype/prototypeReviewClient";
import { fetchLatestPrototypeRun, fetchPrototypeRunById, fetchPrototypeRunsList, postPrototypeRunRefresh } from "@/lib/prototype/prototypeRunApiClient";
import type { PrototypeRun } from "@/lib/prototype/prototypeRunTypes";

type Busy = "send" | "summarize" | "improvements" | "drafts" | null;

function previewUrlKey(run: PrototypeRun | null): string {
  if (!run) return "";
  return String(run.previewUrl || run.suggestedPreviewUrl || run.resultUrl || "");
}

export function PrototypeReviewPageClient() {
  const search = useSearchParams();
  const projectId = search?.get("projectId")?.trim() ?? "";
  const runIdFromUrl = search?.get("runId")?.trim() ?? "";

  const isMobile = usePrototypeReviewMobileLayout();
  const [mobileTab, setMobileTab] = useState<MobileReviewTabId>("preview");

  const [run, setRun] = useState<PrototypeRun | null>(null);
  const [runList, setRunList] = useState<Array<{ id: string; status: string; updatedAt: string; createdAt: string; previewUrl: string | null }>>(
    [],
  );
  const [selectedRunId, setSelectedRunId] = useState<string | null>(null);
  const [versionNo, setVersionNo] = useState<number | null>(null);
  const [, setTotalRuns] = useState<number | null>(null);

  const [messages, setMessages] = useState<PrototypeReviewMessage[]>([]);
  const [improvementItems, setImprovementItems] = useState<PrototypeImprovementItem[] | null>(null);
  const [threadLoading, setThreadLoading] = useState(false);
  const [improvementsLoading, setImprovementsLoading] = useState(false);
  const [improvementsError, setImprovementsError] = useState<string | null>(null);
  const [initializing, setInitializing] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [busy, setBusy] = useState<Busy>(null);
  const [refreshing, setRefreshing] = useState(false);
  const [frameLoading, setFrameLoading] = useState(false);

  const lastAutoAttemptKeyRef = useRef<string | null>(null);
  const previewStackRef = useRef<HTMLDivElement | null>(null);

  const runOptions = useMemo(() => {
    return runList.map((r, i) => {
      const d = new Date(r.updatedAt);
      const dateStr = Number.isNaN(d.getTime()) ? "" : `${d.getMonth() + 1}/${d.getDate()}`;
      return { id: r.id, label: `실행 ${runList.length - i} · ${dateStr} · ${r.status}` };
    });
  }, [runList]);

  const applyRunPayload = useCallback((payload: Awaited<ReturnType<typeof fetchLatestPrototypeRun>>["data"]) => {
    setRun(payload?.run ?? null);
    setVersionNo(payload?.runVersionNo ?? null);
    setTotalRuns(payload?.runTotalCount ?? null);
  }, []);

  const loadRunById = useCallback(
    async (pid: string, rid: string) => {
      const res = await fetchPrototypeRunById(pid, rid);
      if (!res.success || !res.data) {
        setError(res.message ?? "실행 정보를 불러오지 못했습니다.");
        setRun(null);
        return false;
      }
      applyRunPayload(res.data);
      setError(null);
      return true;
    },
    [applyRunPayload],
  );

  const initProject = useCallback(async () => {
    if (!projectId) return;
    setInitializing(true);
    setError(null);
    try {
      const [listRes, latestRes] = await Promise.all([fetchPrototypeRunsList(projectId), fetchLatestPrototypeRun(projectId)]);
      if (listRes.success && listRes.data?.runs) {
        setRunList(listRes.data.runs);
      } else {
        setRunList([]);
      }

      let targetId = latestRes.data?.run?.id ?? null;
      if (runIdFromUrl && listRes.data?.runs?.some((r) => r.id === runIdFromUrl)) {
        targetId = runIdFromUrl;
      }
      if (!targetId) {
        setRun(null);
        setVersionNo(null);
        setTotalRuns(null);
        setSelectedRunId(null);
        if (!latestRes.success) setError(latestRes.message ?? "실행 정보를 불러오지 못했습니다.");
        return;
      }
      setSelectedRunId(targetId);
      const ok = await loadRunById(projectId, targetId);
      if (!ok && latestRes.data?.run) {
        applyRunPayload(latestRes.data);
        setSelectedRunId(latestRes.data.run.id);
      }
    } finally {
      setInitializing(false);
    }
  }, [projectId, runIdFromUrl, loadRunById, applyRunPayload]);

  useEffect(() => {
    void initProject();
  }, [initProject]);

  useEffect(() => {
    lastAutoAttemptKeyRef.current = null;
  }, [projectId, selectedRunId]);

  const hydrateThread = useCallback(async (pid: string, rid: string) => {
    setThreadLoading(true);
    try {
      const res = await fetchPrototypeReviewThread(pid, rid);
      if (res.success && res.data) {
        setMessages(res.data.messages);
        setImprovementItems(res.data.improvementItems);
        if (res.data.messages.length === 0) {
          const boot = await postPrototypeReviewBootstrap(pid, rid);
          if (boot.success && boot.data?.messages) {
            setMessages(boot.data.messages);
          }
        }
      }
    } finally {
      setThreadLoading(false);
    }
  }, []);

  useEffect(() => {
    if (!projectId || !selectedRunId) return;
    void hydrateThread(projectId, selectedRunId);
  }, [projectId, selectedRunId, hydrateThread]);

  /**
   * 환영 인사 후, 저장된 개선안이 없으면 AI개선안을 한 번 자동 생성.
   * improvementItems는 의존 배열에 넣지 않음(응답 직후 effect 재실행으로 중복 요청·로딩 깜빡임 방지).
   */
  useEffect(() => {
    if (threadLoading || !projectId || !selectedRunId || !run) return;
    if (improvementItems && improvementItems.length > 0) return;
    const attemptKey = `${projectId}:${selectedRunId}`;
    if (lastAutoAttemptKeyRef.current === attemptKey) return;
    let cancelled = false;
    setImprovementsLoading(true);
    setImprovementsError(null);
    void (async () => {
      try {
        const res = await postPrototypeReviewImprovements(projectId, selectedRunId, { silentFollowup: true });
        if (cancelled) return;
        if (res.success && res.data) {
          lastAutoAttemptKeyRef.current = attemptKey;
          setImprovementItems(res.data.items);
          setMessages(res.data.messages);
        } else {
          setImprovementsError(res.message ?? "AI개선안을 불러오지 못했습니다. 「개선안 보기」를 눌러 다시 시도해 주세요.");
        }
      } finally {
        if (!cancelled) setImprovementsLoading(false);
      }
    })();
    return () => {
      cancelled = true;
    };
  }, [threadLoading, projectId, selectedRunId, run?.id]); // eslint-disable-line react-hooks/exhaustive-deps -- improvementItems (see JSDoc above)

  const urlKey = previewUrlKey(run);
  useEffect(() => {
    if (!urlKey || !(urlKey.startsWith("http://") || urlKey.startsWith("https://"))) {
      setFrameLoading(false);
      return;
    }
    setFrameLoading(true);
  }, [selectedRunId, urlKey]);

  const onRefreshPreview = useCallback(async () => {
    if (!projectId || !selectedRunId) return;
    setRefreshing(true);
    setFrameLoading(true);
    setError(null);
    try {
      const ref = await postPrototypeRunRefresh(selectedRunId, { projectId });
      if (!ref.success) {
        setError(ref.message ?? "새로고침에 실패했습니다.");
      }
      await loadRunById(projectId, selectedRunId);
    } finally {
      setRefreshing(false);
    }
  }, [projectId, selectedRunId, loadRunById]);

  const onFullscreen = useCallback(() => {
    const el = document.getElementById("jyo-prototype-review-preview");
    if (!el) return;
    void el.requestFullscreen?.().catch(() => {
      /* ignore */
    });
  }, []);

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

  const stageStyle = useMemo(
    () => ({
      display: "flex" as const,
      flexDirection: "column" as const,
      minHeight: "min(92vh, 980px)",
      maxHeight: "calc(100vh - 84px)",
      overflow: "hidden" as const,
      padding: 0,
    }),
    [],
  );

  const chatHandlers = {
    onSend: (userMessage: string) =>
      void wrapBusy("send", async () => {
        if (!selectedRunId) return;
        const res = await postPrototypeReviewChatTurn(projectId, selectedRunId, userMessage);
        if (!res.success) {
          setError(res.message ?? "전송에 실패했습니다.");
          return;
        }
        if (res.data?.messages) setMessages(res.data.messages);
        if (res.data && "improvementItems" in res.data) setImprovementItems(res.data.improvementItems ?? null);
      }),
    onSummarize: () =>
      void wrapBusy("summarize", async () => {
        if (!selectedRunId) return;
        const res = await postPrototypeReviewSummarize(projectId, selectedRunId);
        if (!res.success) {
          setError(res.message ?? "정리요청에 실패했습니다.");
          return;
        }
        if (res.data?.messages) setMessages(res.data.messages);
        if (res.data && "improvementItems" in res.data) setImprovementItems(res.data.improvementItems ?? null);
      }),
    onImprovements: () =>
      void wrapBusy("improvements", async () => {
        if (!selectedRunId) return;
        setImprovementsError(null);
        const res = await postPrototypeReviewImprovements(projectId, selectedRunId);
        if (!res.success) {
          setError(res.message ?? "개선안 생성에 실패했습니다.");
          return;
        }
        if (res.data) {
          setImprovementItems(res.data.items);
          setMessages(res.data.messages);
        }
      }),
    onFollowUpDrafts: () =>
      void wrapBusy("drafts", async () => {
        if (!selectedRunId) return;
        const res = await postPrototypeReviewFollowUpDrafts(projectId, selectedRunId);
        if (!res.success) {
          setError(res.message ?? "작업 초안 생성에 실패했습니다.");
          return;
        }
        if (res.data?.messages) setMessages(res.data.messages);
        if (res.data && "improvementItems" in res.data) setImprovementItems(res.data.improvementItems ?? null);
      }),
  };

  const chatPanelProps = {
    disabled: !run,
    messages,
    improvementItems,
    improvementsLoading,
    improvementsError,
    threadLoading,
    busy: busy !== null,
    busyAction: busy,
    ...chatHandlers,
  };

  if (!projectId) {
    return (
      <WorkflowStageChrome title="프로토타입 검토" subtitle="프로젝트를 연 뒤 프리뷰를 보며 의견을 남깁니다.">
        <EmptyState title="프로젝트가 선택되지 않았습니다" description="상단에서 프로젝트를 연결하거나, 프로젝트 허브에서 열어 주세요." />
      </WorkflowStageChrome>
    );
  }

  const inner = (
    <div
      style={{
        flex: 1,
        minHeight: 0,
        display: "flex",
        flexDirection: "column",
        gap: 12,
        padding: isMobile ? "10px 10px 0" : "14px 14px 12px",
        boxSizing: "border-box",
      }}
    >
      {error ? (
        <InlineAlert variant="danger" style={{ flexShrink: 0 }}>
          {error}
        </InlineAlert>
      ) : null}

      <ReviewHeader
        run={run}
        versionNo={versionNo}
        runOptions={runOptions}
        selectedRunId={selectedRunId}
        onSelectRun={(id) => {
          setSelectedRunId(id);
          void loadRunById(projectId, id);
        }}
        refreshing={refreshing}
        onRefresh={onRefreshPreview}
        onFullscreen={onFullscreen}
      />

      {initializing && !run ? (
        <LoadingState label="불러오는 중…" />
      ) : isMobile ? (
        <>
          <div style={{ flex: 1, minHeight: 0, overflow: "hidden", display: "flex", flexDirection: "column" }}>
            {mobileTab === "preview" ? (
              <PreviewViewport run={run} frameLoading={frameLoading} onFrameLoad={() => setFrameLoading(false)} />
            ) : null}
            {mobileTab === "chat" ? <ReviewChatPanel compact {...chatPanelProps} /> : null}
          </div>
          <MobileReviewTabs value={mobileTab} onChange={setMobileTab} />
        </>
      ) : (
        <div
          ref={previewStackRef}
          style={{
            flex: 1,
            minHeight: 0,
            position: "relative",
            display: "flex",
            flexDirection: "column",
          }}
        >
          <PreviewViewport
            fillContainer
            run={run}
            frameLoading={frameLoading}
            onFrameLoad={() => setFrameLoading(false)}
          />
          <FloatingReviewChatDock containerRef={previewStackRef}>
            {(surfaceAlpha) => (
              <ReviewChatPanel fillParent floating omitChrome surfaceAlpha={surfaceAlpha} {...chatPanelProps} />
            )}
          </FloatingReviewChatDock>
        </div>
      )}
    </div>
  );

  return (
    <WorkflowStageChrome
      title="프로토타입 검토"
      subtitle="프리뷰를 넓게 보며, 화면 위 검토 대화 패널에서 AI개선안과 의견을 주고받습니다."
      stageLayoutStyle={stageStyle}
    >
      {inner}
    </WorkflowStageChrome>
  );
}
