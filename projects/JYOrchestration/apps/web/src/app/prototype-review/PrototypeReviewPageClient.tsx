"use client";

import { useCallback, useEffect, useLayoutEffect, useMemo, useRef, useState } from "react";
import { useSearchParams } from "next/navigation";
import { FloatingReviewChatDock } from "@/components/prototype-review/FloatingReviewChatDock";
import { MobileReviewTabs, type MobileReviewTabId } from "@/components/prototype-review/MobileReviewTabs";
import { PreviewViewport } from "@/components/prototype-review/PreviewViewport";
import { ReviewChatPanel } from "@/components/prototype-review/ReviewChatPanel";
import { ReviewHeader } from "@/components/prototype-review/ReviewHeader";
import { EmptyState, InlineAlert, LoadingState } from "@/components/ui";
import { WorkflowStageChrome } from "@/components/workflow/primitives/WorkflowStageChrome";
import { useWorkspaceMode } from "@/components/layout/WorkspaceModeContext";
import { WorkspaceSuccessErrorSaveToastHost } from "@/components/workspace/WorkspaceSuccessErrorSaveToastHost";
import { useTimedSuccessErrorToasts } from "@/components/workspace/useTimedSuccessErrorToasts";
import type { PrototypeImprovementItem, PrototypeReviewMessage } from "@/lib/prototype/prototypeReviewStore";
import {
  fetchPrototypeReviewThread,
  postPrototypeReviewBootstrap,
  postPrototypeReviewChatTurn,
  postPrototypeReviewFollowUpDrafts,
  postPrototypeReviewImprovements,
  postPrototypeReviewSummarize,
} from "@/lib/prototype/prototypeReviewClient";
import {
  fetchLatestPrototypeRun,
  fetchPrototypeRunById,
  fetchPrototypeRunsList,
  getPrototypeDeployStatusApi,
  postPrototypeDeployProceed,
  postPrototypeDeploySecurityFixRequest,
  postPrototypeDeploySecurityRecheck,
  postPrototypeRequestDeploy,
  postPrototypeRunRefresh,
} from "@/lib/prototype/prototypeRunApiClient";
import { getPrototypeDeployStatusSnapshot } from "@/lib/prototype/prototypeDeploySnapshot";
import type { PrototypeRun } from "@/lib/prototype/prototypeRunTypes";
import { fetchProjectById } from "@/components/project-spec/api";
import { Button } from "@/components/ui/Button";
import { parseRequirementsStateJson, type RequirementsStateJson } from "@/lib/requirements/requirementsStateJson";
import { buildReviewStageEntryNoticeLines } from "@/lib/prototype/reviewStageEntry";
import { patchProjectRequirementsStateJsonClient } from "@/lib/prototype/patchReviewStageStateClient";
import {
  deriveReviewStageInterviewChips,
  mapReviewStageChipToAction,
  type ReviewStageActionId,
} from "@/lib/prototype/reviewStageMessage";
import {
  registerReviewStageUserFeedbackFromText,
  runReviewStagePageAction,
  type ReviewStageRequirementsPatch,
} from "@/lib/prototype/reviewStagePageActions";
import { isReviewStageEntryReady } from "@/lib/prototype/reviewStageUserTest";

type Busy = "send" | "summarize" | "improvements" | "drafts" | null;

function previewUrlKey(run: PrototypeRun | null): string {
  if (!run) return "";
  const pub = String(run.publicUrl ?? "").trim();
  if (run.deploymentStatus === "DONE" && pub) return pub;
  return String(run.previewUrl || run.suggestedPreviewUrl || "");
}

export function PrototypeReviewPageClient() {
  const search = useSearchParams();
  const projectId = search?.get("projectId")?.trim() ?? "";
  const runIdFromUrl = search?.get("runId")?.trim() ?? "";

  const { effectiveLayout } = useWorkspaceMode();
  const [layoutHydrated, setLayoutHydrated] = useState(false);
  useEffect(() => {
    setLayoutHydrated(true);
  }, []);
  const isMobile = layoutHydrated && effectiveLayout === "MOBILE";
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
  const [previewRotationLandscape, setPreviewRotationLandscape] = useState(false);
  const [deployRequestBusy, setDeployRequestBusy] = useState(false);
  const [deployProceedBusy, setDeployProceedBusy] = useState(false);
  const [securityRecheckBusy, setSecurityRecheckBusy] = useState(false);
  const [securityFixBusy, setSecurityFixBusy] = useState(false);
  const [requirementsStateJson, setRequirementsStateJson] = useState<unknown>(null);
  const [reviewStageNoticeLines, setReviewStageNoticeLines] = useState<readonly string[]>([]);
  const [reviewStageEntryReady, setReviewStageEntryReady] = useState(false);
  const [reviewFeedbackCaptureMode, setReviewFeedbackCaptureMode] = useState(false);
  const [reviewStageActionNotice, setReviewStageActionNotice] = useState<string | null>(null);
  const [reviewStageActionBusy, setReviewStageActionBusy] = useState(false);
  const { successToast, errorToast, showSuccessToast } = useTimedSuccessErrorToasts({ successDismissMs: 2800 });

  const parsedRequirementsState = useMemo(
    () => parseRequirementsStateJson(requirementsStateJson),
    [requirementsStateJson],
  );

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

  useLayoutEffect(() => {
    if (!isMobile || mobileTab !== "changes") return;
    const id = window.requestAnimationFrame(() => {
      document.getElementById("jyo-prototype-review-change-requests")?.scrollIntoView({ block: "start", behavior: "smooth" });
    });
    return () => window.cancelAnimationFrame(id);
  }, [isMobile, mobileTab]);

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

  const deploySnap = useMemo(() => getPrototypeDeployStatusSnapshot(run), [run]);

  const deployPollActive =
    deploySnap.deployStatus === "DEPLOYING" || (run?.deploySecurityGatePhase ?? "") === "SECURITY_CHECKING";

  useEffect(() => {
    if (!projectId || !selectedRunId) return;
    if (!deployPollActive) return;
    const tick = () => {
      void (async () => {
        const res = await getPrototypeDeployStatusApi(projectId, selectedRunId, true);
        if (res.success && res.data?.run) {
          setRun(res.data.run);
        }
      })();
    };
    tick();
    const id = window.setInterval(tick, 5000);
    return () => window.clearInterval(id);
  }, [projectId, selectedRunId, deployPollActive]);

  const urlKey = previewUrlKey(run);

  const applyReviewStageBanner = useCallback(
    (state: RequirementsStateJson, previewUrl: string) => {
      const previewReady = Boolean(previewUrl?.trim());
      const entryReady = isReviewStageEntryReady({
        implementationReviewStageReadyV1: state.implementationReviewStageReadyV1,
        previewReady,
      });
      const lines = buildReviewStageEntryNoticeLines({
        implementationReviewStageReadyV1: state.implementationReviewStageReadyV1,
        previewReady,
        session: state.reviewStageUserTestSessionV1,
        feedbackList: state.reviewStageUserFeedbackListV1,
        previewUrl: previewUrl || undefined,
      });
      setReviewStageEntryReady(entryReady);
      setReviewStageNoticeLines(lines);
    },
    [],
  );

  const loadProjectRequirementsState = useCallback(async () => {
    if (!projectId) return;
    const { project } = await fetchProjectById(projectId);
    const state = parseRequirementsStateJson(project?.requirementsStateJson);
    setRequirementsStateJson(project?.requirementsStateJson ?? null);
    applyReviewStageBanner(state, urlKey);
  }, [projectId, urlKey, applyReviewStageBanner]);

  useEffect(() => {
    void loadProjectRequirementsState();
  }, [loadProjectRequirementsState]);

  const persistReviewStagePatch = useCallback(
    async (patch: ReviewStageRequirementsPatch) => {
      const res = await patchProjectRequirementsStateJsonClient(projectId, requirementsStateJson, patch);
      if (res.success && res.merged) {
        setRequirementsStateJson(res.merged);
        applyReviewStageBanner(res.merged, urlKey);
        return res;
      }
      setError(res.message ?? "검토단계 상태 저장에 실패했습니다.");
      return res;
    },
    [projectId, requirementsStateJson, urlKey, applyReviewStageBanner],
  );

  const reviewStageChips = useMemo(
    () =>
      deriveReviewStageInterviewChips({
        entryReady: reviewStageEntryReady,
        feedbackList: parsedRequirementsState.reviewStageUserFeedbackListV1,
        session: parsedRequirementsState.reviewStageUserTestSessionV1,
      }),
    [
      reviewStageEntryReady,
      parsedRequirementsState.reviewStageUserFeedbackListV1,
      parsedRequirementsState.reviewStageUserTestSessionV1,
    ],
  );

  const runReviewStageAction = useCallback(
    async (actionId: ReviewStageActionId) => {
      if (!projectId || reviewStageActionBusy) return;
      setReviewStageActionBusy(true);
      setError(null);
      try {
        const result = runReviewStagePageAction({
          actionId,
          projectId,
          orchestration: parsedRequirementsState,
          previewUrl: urlKey || undefined,
        });
        if (!result.ok) {
          setError(result.message);
          return;
        }
        if (result.feedbackCaptureMode) {
          setReviewFeedbackCaptureMode(true);
          setReviewStageActionNotice(result.notice ?? null);
          return;
        }
        if (result.viewFeedbackLines?.length) {
          setReviewStageActionNotice(result.viewFeedbackLines.join("\n"));
        } else if (result.notice) {
          setReviewStageActionNotice(result.notice);
          showSuccessToast(result.notice.split("\n")[0] ?? result.notice);
        }
        if (Object.keys(result.patch).length > 0) {
          const persistRes = await persistReviewStagePatch(result.patch);
          if (!persistRes.success) return;
        }
      } finally {
        setReviewStageActionBusy(false);
      }
    },
    [
      projectId,
      reviewStageActionBusy,
      parsedRequirementsState,
      urlKey,
      persistReviewStagePatch,
      showSuccessToast,
    ],
  );

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

  const onRequestDeploy = useCallback(async () => {
    if (!projectId || !selectedRunId) return;
    setDeployRequestBusy(true);
    setError(null);
    try {
      const res = await postPrototypeRequestDeploy(selectedRunId, { projectId });
      if (!res.success) {
        setError(res.message ?? "배포 보안 점검을 시작하지 못했습니다.");
        return;
      }
      if (res.data?.run) setRun(res.data.run);
      else await loadRunById(projectId, selectedRunId);
    } finally {
      setDeployRequestBusy(false);
    }
  }, [projectId, selectedRunId, loadRunById]);

  const onDeployProceed = useCallback(async () => {
    if (!projectId || !selectedRunId) return;
    setDeployProceedBusy(true);
    setError(null);
    try {
      const res = await postPrototypeDeployProceed(selectedRunId, { projectId });
      if (!res.success) {
        setError(res.message ?? "배포를 진행할 수 없습니다.");
        return;
      }
      if (res.data?.run) setRun(res.data.run);
      else await loadRunById(projectId, selectedRunId);
    } finally {
      setDeployProceedBusy(false);
    }
  }, [projectId, selectedRunId, loadRunById]);

  const onSecurityRecheck = useCallback(async () => {
    if (!projectId || !selectedRunId) return;
    setSecurityRecheckBusy(true);
    setError(null);
    try {
      const res = await postPrototypeDeploySecurityRecheck(selectedRunId, { projectId });
      if (!res.success) {
        setError(res.message ?? "보안 재점검을 시작하지 못했습니다.");
        return;
      }
      if (res.data?.run) setRun(res.data.run);
      else await loadRunById(projectId, selectedRunId);
    } finally {
      setSecurityRecheckBusy(false);
    }
  }, [projectId, selectedRunId, loadRunById]);

  const onSecurityFixRequest = useCallback(async () => {
    if (!projectId || !selectedRunId) return;
    setSecurityFixBusy(true);
    setError(null);
    try {
      const res = await postPrototypeDeploySecurityFixRequest(selectedRunId, { projectId });
      if (!res.success) {
        setError(res.message ?? "조치 요청을 생성하지 못했습니다.");
        return;
      }
      if (res.data?.run) setRun(res.data.run);
      else await loadRunById(projectId, selectedRunId);
      showSuccessToast("보안 조치용 Cursor 작업이 추가되었습니다. 프로토타입 생성 화면에서 실행 상태를 확인하세요.");
    } finally {
      setSecurityFixBusy(false);
    }
  }, [projectId, selectedRunId, loadRunById, showSuccessToast]);

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
      flex: "1 1 auto" as const,
      minHeight: 0,
      maxHeight:
        "calc(100dvh - 84px - env(safe-area-inset-top, 0px) - env(safe-area-inset-bottom, 0px))",
      overflow: "hidden" as const,
      padding: 0,
    }),
    [],
  );

  const chatHandlers = {
    onSend: (userMessage: string) =>
      void wrapBusy("send", async () => {
        if (!selectedRunId) return;
        if (reviewFeedbackCaptureMode) {
          const registered = registerReviewStageUserFeedbackFromText({
            projectId,
            text: userMessage,
            feedbackList: parsedRequirementsState.reviewStageUserFeedbackListV1,
            session: parsedRequirementsState.reviewStageUserTestSessionV1,
            previewUrl: urlKey || undefined,
          });
          if (!registered.ok) {
            setError(registered.message);
            return;
          }
          const persistRes = await persistReviewStagePatch(registered.patch);
          if (!persistRes.success) return;
          setReviewFeedbackCaptureMode(false);
          setReviewStageActionNotice(null);
          showSuccessToast(`사용자 피드백이 저장되었습니다. (${registered.feedbackId})`);
          const chatRes = await postPrototypeReviewChatTurn(
            projectId,
            selectedRunId,
            `[사용자 피드백] ${userMessage}`,
          );
          if (chatRes.success && chatRes.data?.messages) {
            setMessages(chatRes.data.messages);
          }
          return;
        }
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
    busy: busy !== null || reviewStageActionBusy,
    busyAction: busy,
    composerPlaceholder: reviewFeedbackCaptureMode
      ? "다음 메시지는 사용자 피드백으로 저장됩니다. (AI개선안과 별도)"
      : undefined,
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
      <WorkspaceSuccessErrorSaveToastHost success={successToast} error={errorToast} />
      {error ? (
        <InlineAlert variant="danger" style={{ flexShrink: 0 }}>
          {error}
        </InlineAlert>
      ) : null}
      {reviewStageNoticeLines.length ? (
        <InlineAlert variant={reviewStageEntryReady ? "info" : "warning"} style={{ flexShrink: 0 }}>
          <div style={{ display: "flex", flexDirection: "column", gap: 6 }}>
            {reviewStageNoticeLines.slice(0, 12).map((line) => (
              <span key={line}>{line}</span>
            ))}
            <span style={{ fontSize: 12, color: "#4b5563" }}>
              AI개선안은 AI가 제안한 개선 후보이며, 사용자 피드백은 직접 테스트하며 등록한 수정 요청입니다.
            </span>
          </div>
        </InlineAlert>
      ) : null}
      {reviewStageActionNotice ? (
        <InlineAlert variant="info" style={{ flexShrink: 0 }}>
          <span style={{ whiteSpace: "pre-wrap" }}>{reviewStageActionNotice}</span>
        </InlineAlert>
      ) : null}
      {reviewStageEntryReady && reviewStageChips.length ? (
        <div
          style={{
            display: "flex",
            flexWrap: "wrap",
            gap: 8,
            flexShrink: 0,
          }}
        >
          {reviewStageChips.map((chip) => {
            const actionId = mapReviewStageChipToAction(chip);
            if (!actionId) return null;
            return (
              <Button
                key={chip}
                type="button"
                variant="secondary"
                size="sm"
                disabled={reviewStageActionBusy || busy !== null}
                onClick={() => void runReviewStageAction(actionId)}
              >
                {chip}
              </Button>
            );
          })}
        </div>
      ) : null}

      <ReviewHeader
        projectId={projectId}
        run={run}
        deploy={deploySnap}
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
        onRequestDeploy={onRequestDeploy}
        onDeployProceed={onDeployProceed}
        onSecurityRecheck={onSecurityRecheck}
        onSecurityFixRequest={onSecurityFixRequest}
        deployRequestBusy={deployRequestBusy}
        deployProceedBusy={deployProceedBusy}
        securityRecheckBusy={securityRecheckBusy}
        securityFixBusy={securityFixBusy}
        previewRotationLandscape={previewRotationLandscape}
        onTogglePreviewRotation={() => setPreviewRotationLandscape((v) => !v)}
      />

      {initializing && !run ? (
        <LoadingState label="불러오는 중…" />
      ) : isMobile ? (
        <>
          <div style={{ flex: 1, minHeight: 0, overflow: "hidden", display: "flex", flexDirection: "column" }}>
            {mobileTab === "preview" ? (
              <PreviewViewport
                projectId={projectId}
                run={run}
                frameLoading={frameLoading}
                onFrameLoad={() => setFrameLoading(false)}
                rotationLandscape={previewRotationLandscape}
              />
            ) : null}
            {mobileTab === "ai" || mobileTab === "changes" ? <ReviewChatPanel compact {...chatPanelProps} /> : null}
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
            projectId={projectId}
            fillContainer
            run={run}
            frameLoading={frameLoading}
            onFrameLoad={() => setFrameLoading(false)}
            rotationLandscape={previewRotationLandscape}
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
