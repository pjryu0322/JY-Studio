"use client";

import { useEffect, useMemo, useState, type CSSProperties } from "react";
import { ScreenLabel } from "@/components/ui/ScreenLabel";
import { useShowScreenLabels } from "@/components/ui/ScreenLabelsContext";
import { TaskDraftsPanel } from "@/components/workflow/TaskDraftsPanel";
import { TaskSequence } from "@/components/workflow/TaskSequence";
import { TasksWorkspaceSummaryStrip } from "@/components/workflow/TasksWorkspaceSummaryStrip";
import { WorkflowActionButton } from "@/components/workflow/primitives/WorkflowActionButton";
import { WorkflowCard } from "@/components/workflow/primitives/WorkflowCard";
import { WorkflowSectionLabel } from "@/components/workflow/primitives/WorkflowSectionLabel";
import type { TaskExecutionReadiness } from "@/lib/workflow/collaborationSessionResultStore";
import {
  businessExecutionRunLatestStrip,
  executorConnectorResultSubtleNote,
  executorIntegrationAdapterSubtleNote,
  getTaskExecutionReadiness,
  recordSessionConfirmedTasks,
  recordSessionExecutionLaunchSnapshot,
  setSessionTaskReadiness,
} from "@/lib/workflow/collaborationSessionResultStore";
import { buildExecutionLaunchInput } from "@/lib/workflow/executionLaunchInput";
import { createExecutionLaunchSnapshot } from "@/lib/workflow/executionLaunchSnapshot";
import { EXECUTOR_TYPE_LABELS } from "@/lib/workflow/executionAssignment";
import { getBusinessExecutionSessionState } from "@/lib/workflow/businessExecutionSelectors";
import type { TasksWorkspaceView } from "@/lib/workflow/tasksWorkspaceViewModel";
import { useCollaborationSessionResultsVersion } from "@/lib/workflow/useCollaborationSessionResultsSync";
import { useTasksWorkspaceReview } from "@/lib/workflow/useTasksWorkspaceReview";

type Props = {
  view: TasksWorkspaceView;
  onOpenRequirement: () => void;
  onOpenFeaturesStep: () => void;
};

const inputStyle: CSSProperties = {
  width: "100%",
  marginTop: 4,
  padding: "8px 10px",
  borderRadius: 6,
  border: "1px solid #e5e7eb",
  fontSize: 13,
  boxSizing: "border-box",
};

export function TasksWorkspaceContent({ view, onOpenRequirement, onOpenFeaturesStep }: Props) {
  const showScreenLabels = useShowScreenLabels();
  const sessionResultsVersion = useCollaborationSessionResultsVersion();
  const working = useTasksWorkspaceReview(view.taskDrafts);
  const [addName, setAddName] = useState("");
  const [addDesc, setAddDesc] = useState("");
  const [addFeat, setAddFeat] = useState("");
  const [confirmFlash, setConfirmFlash] = useState<string | null>(null);
  const [sequenceView, setSequenceView] = useState<"all" | "candidates">("all");

  const pre = useMemo(() => getBusinessExecutionSessionState(view.sessionId), [view.sessionId, sessionResultsVersion]);
  const readinessMap = pre.readinessMap;

  const officialConfirmed = view.confirmedTasks ?? [];
  const readyCount = useMemo(
    () => officialConfirmed.filter((t) => getTaskExecutionReadiness(readinessMap, t.id) === "ready").length,
    [officialConfirmed, readinessMap]
  );
  const readyTotal = officialConfirmed.length;

  const candidateTasks = pre.candidateTasks;

  const executionLaunchPreview = useMemo(() => {
    if (!view.sessionId) return null;
    return buildExecutionLaunchInput({
      sessionId: view.sessionId,
      requirementId: view.requirementId,
      confirmedTasks: officialConfirmed,
      candidateTasks,
    });
  }, [view.sessionId, view.requirementId, officialConfirmed, candidateTasks]);

  const preparedSnapshot = pre.snapshot;
  const activeExecution = pre.active;
  const isActiveSnapshot = pre.isSnapshotActive;
  const isHandoffPrepared = pre.isHandoffPreparedActive;
  const handoffPrepared = pre.handoffPrepared;
  const snapshotStaleness = pre.snapshotStaleness;
  const handoffValidity = pre.handoffValidity;
  const hasExecutionRequestDraft = pre.hasExecutionRequestDraft;
  const executionRequestDraft = pre.executionRequestDraft;
  const isDraftApproved = pre.isExecutionDraftApproved;
  const hasBusinessExecutionRequest = pre.hasBusinessExecutionRequest;
  const businessExecutionRequestValidity = pre.businessExecutionRequestValidity;
  const isBusinessExecutionApproved = pre.isBusinessExecutionApproved;
  const isBusinessExecutionPackaged = pre.isBusinessExecutionPackaged;
  const isExecutionPackageAssigned = pre.isExecutionPackageAssigned;
  const executionAssignment = pre.executionAssignment;
  const isExecutionAssignmentHandoffCurrent = pre.isExecutionAssignmentHandoffCurrent;
  const isExecutorIntakeContractCurrent = pre.isExecutorIntakeContractCurrent;
  const isExecutorWorkOrderCurrent = pre.isExecutorWorkOrderCurrent;
  const executionReadiness = pre.executionReadiness;
  const isBusinessLaunchIntentCurrent = pre.isBusinessLaunchIntentCurrent;
  const isBusinessLaunchHandoffRecordCurrent = pre.isBusinessLaunchHandoffRecordCurrent;
  const isExecutorLaunchContractCurrent = pre.isExecutorLaunchContractCurrent;
  const isExecutionTriggerIntentCurrent = pre.isExecutionTriggerIntentCurrent;
  const isActualExecutionAdapterRequestCurrent = pre.isActualExecutionAdapterRequestCurrent;
  const isActualLaunchCommandCurrent = pre.isActualLaunchCommandCurrent;
  const businessExecutionRun = pre.businessExecutionRun;
  const isBusinessExecutionRunCurrent = pre.isBusinessExecutionRunCurrent;
  const executorIntegrationAdapter = pre.executorIntegrationAdapter;
  const isExecutorIntegrationAdapterCurrent = pre.isExecutorIntegrationAdapterCurrent;
  const executorConnectorResult = pre.executorConnectorResult;
  const isExecutorConnectorResultCurrent = pre.isExecutorConnectorResultCurrent;

  const displayedSequenceTasks = useMemo(() => {
    if (sequenceView === "all") return working.activeTasks;
    return working.activeTasks.filter((t) => getTaskExecutionReadiness(readinessMap, t.id) === "ready");
  }, [sequenceView, working.activeTasks, readinessMap]);

  const reviewApi = {
    reviewById: working.reviewById,
    onConfirm: working.confirmTask,
    onRemove: working.removeTask,
    onMoveUp: working.moveUp,
    onMoveDown: working.moveDown,
    onUpdateDependencyNote: working.updateDependencyNote,
    executionReadiness: readinessMap,
    onSetExecutionReadiness:
      view.sessionId !== null
        ? (taskId: string, readiness: TaskExecutionReadiness) => setSessionTaskReadiness(view.sessionId!, taskId, readiness)
        : undefined,
  };

  const submitManual = () => {
    working.addManualTask({
      name: addName,
      description: addDesc,
      relatedFeatureName: addFeat,
    });
    setAddName("");
    setAddDesc("");
    setAddFeat("");
  };

  const confirmTaskSet = () => {
    if (!view.sessionId) return;
    const subset = working.activeTasks.filter((t) => working.reviewById[t.id] === "confirmed");
    const snapshot = subset.map((t, i) => ({ ...t, order: i + 1 }));
    recordSessionConfirmedTasks(view.sessionId, snapshot);
    setConfirmFlash(
      snapshot.length > 0
        ? "확정 작업 세트가 다음 단계에 사용할 수 있게 준비되었습니다. 공유 세션 메모리(새로고침 전까지 이 탭)에 저장됩니다."
        : "빈 확정 세트를 저장했습니다. 행을 확정하거나 작업 확정을 다시 실행하기 전까지 요구사항 화면에는 작업이 표시되지 않습니다."
    );
  };

  useEffect(() => {
    if (!confirmFlash) return;
    const id = window.setTimeout(() => setConfirmFlash(null), 7000);
    return () => window.clearTimeout(id);
  }, [confirmFlash]);

  return (
    <>
      <TasksWorkspaceSummaryStrip view={view} onOpenRequirement={onOpenRequirement} onOpenFeaturesStep={onOpenFeaturesStep} />

      {view.hasConfirmedTaskSet ? (
        <div className="relative" style={{ border: "1px solid #bbf7d0", borderRadius: 12, padding: 10, background: "#f0fdf4" }}>
          <ScreenLabel label="작업-워크스페이스-공식확정-안내패널" visible={showScreenLabels} />
          <div style={{ fontSize: 13, fontWeight: 800, color: "#166534" }}>공식 확정 스냅샷</div>
          <div style={{ fontSize: 12, color: "#15803d", marginTop: 6, lineHeight: 1.5 }}>
            이 세션에 확정된 작업 세트가 있습니다
            {view.confirmedTaskSetRecordedAtIso ? ` (저장: ${new Date(view.confirmedTaskSetRecordedAtIso).toLocaleString("ko-KR")})` : ""}. 작업 목록은 계속
            편집할 수 있으며, 공식 세트를 바꾸려면 작업 확정을 다시 사용하세요. 아직 데이터베이스에는 저장되지 않습니다.
          </div>
        </div>
      ) : null}

      {confirmFlash ? (
        <div className="relative" style={{ border: "1px solid #bfdbfe", borderRadius: 12, padding: 10, background: "#eff6ff" }}>
          <ScreenLabel label="작업-워크스페이스-확정결과-알림패널" visible={showScreenLabels} />
          <div style={{ fontSize: 13, color: "#1e40af", lineHeight: 1.5 }}>{confirmFlash}</div>
        </div>
      ) : null}

      <div className="relative" style={{ fontSize: 12, color: "#6b7280", lineHeight: 1.5 }}>
        <ScreenLabel label="작업-워크스페이스-편집안내-본문섹션" visible={showScreenLabels} />
        아래에는 생성된 공식 초안이 표시됩니다. 공식 세트에 넣을 각 작업에{" "}
        <span style={{ fontWeight: 800, color: "#374151" }}>확정</span>을 사용한 뒤, 공유 세션 저장소(메모리)에 저장하려면{" "}
        <span style={{ fontWeight: 800, color: "#374151" }}>작업 확정</span>을 누르세요. 확정하지 않은 행은 이 워크스페이스에서만 초안으로 남습니다.
      </div>

      <div className="relative" style={{ display: "flex", flexWrap: "wrap", gap: 10, alignItems: "center" }}>
        <ScreenLabel label="작업-워크스페이스-작업확정-실행섹션" visible={showScreenLabels} />
        <WorkflowActionButton label="작업 확정" variant="primary" onClick={confirmTaskSet} disabled={!view.sessionId} />
        <span style={{ fontSize: 12, color: "#6b7280" }}>확정으로 표시된 작업만 현재 순서대로 저장합니다.</span>
      </div>

      {view.sessionId ? (
        <div className="relative" style={{ fontSize: 13, color: "#374151", lineHeight: 1.5 }}>
          <ScreenLabel label="작업-워크스페이스-실행후보-현황섹션" visible={showScreenLabels} />
          <span style={{ fontWeight: 800 }}>{readyCount}</span> / <span style={{ fontWeight: 800 }}>{readyTotal}</span>개의{" "}
          <span style={{ fontWeight: 800 }}>저장된 확정 세트</span> 작업이 실행 후보(준비됨)입니다.
          {readyTotal === 0 ? (
            <span style={{ color: "#6b7280" }}> 행을 확정한 뒤 작업 확정을 실행하면 합계가 갱신됩니다.</span>
          ) : null}
        </div>
      ) : null}

      <div
        className="relative"
        style={{ fontSize: 12, color: "#6b7280", lineHeight: 1.5, borderLeft: "3px solid #e5e7eb", paddingLeft: 10 }}
      >
        <ScreenLabel label="작업-워크스페이스-실행후보-설명섹션" visible={showScreenLabels} />
        준비된 작업은 <span style={{ fontWeight: 800, color: "#374151" }}>실행 후보 집합</span>을 구성합니다. 이후 단계에서 실행에 사용할 수 있습니다(여기서는
        연결되지 않음). 이름·설명이 분명하고 선행 작업이 막지 않을 때만 준비로 표시하세요.
      </div>

      <div className="relative" style={{ display: "flex", gap: 8, flexWrap: "wrap", alignItems: "center" }}>
        <ScreenLabel label="작업-워크스페이스-목록보기-토글섹션" visible={showScreenLabels} />
        <span style={{ fontSize: 12, color: "#6b7280", fontWeight: 800 }}>보기</span>
        <button
          type="button"
          onClick={() => setSequenceView("all")}
          style={{
            fontSize: 12,
            fontWeight: 800,
            padding: "6px 10px",
            borderRadius: 10,
            border: "1px solid #e5e7eb",
            background: sequenceView === "all" ? "#111827" : "#fff",
            color: sequenceView === "all" ? "#fff" : "#374151",
            cursor: "pointer",
          }}
        >
          전체 작업
        </button>
        <button
          type="button"
          onClick={() => setSequenceView("candidates")}
          style={{
            fontSize: 12,
            fontWeight: 800,
            padding: "6px 10px",
            borderRadius: 10,
            border: "1px solid #e5e7eb",
            background: sequenceView === "candidates" ? "#111827" : "#fff",
            color: sequenceView === "candidates" ? "#fff" : "#374151",
            cursor: "pointer",
          }}
        >
          실행 후보만
        </button>
        {sequenceView === "candidates" ? (
          <span style={{ fontSize: 12, color: "#6b7280" }}>저장된 확정 세트에서 준비된 작업만 표시합니다.</span>
        ) : null}
      </div>

      <div className="relative">
        <ScreenLabel label="작업-워크스페이스-작업순서-미리보기패널" visible={showScreenLabels} />
        <WorkflowSectionLabel marginBottom={10}>작업 순서</WorkflowSectionLabel>
        <TaskSequence tasks={displayedSequenceTasks} review={reviewApi} />
        {sequenceView === "candidates" && displayedSequenceTasks.length === 0 ? (
          <div style={{ marginTop: 8, fontSize: 12, color: "#6b7280", lineHeight: 1.5 }}>
            아직 실행 후보가 없습니다. 작업을 확정하고 작업 확정을 저장한 뒤 준비로 표시하세요.
          </div>
        ) : null}
      </div>

      {executionLaunchPreview ? (
        <div className="relative">
          <ScreenLabel label="작업-워크스페이스-실행입력-미리보기패널" visible={showScreenLabels} />
          <WorkflowCard padding={12}>
            <details>
              <summary style={{ cursor: "pointer", fontSize: 13, fontWeight: 900, listStyle: "none" }}>실행 입력 미리보기</summary>
              <div style={{ marginTop: 10, display: "grid", gap: 8 }}>
                <div style={{ fontSize: 12, color: "#6b7280" }}>
                  준비된 작업이 실행 후보 집합을 구성합니다. 이 미리보기는 이후 단계에서 실행 시작 입력으로 묶일 내용을 보여 줍니다(여기서는 실행을 시작하지
                  않습니다).
                </div>
                <div style={{ fontSize: 13, color: "#111827" }}>
                  <span style={{ fontWeight: 900 }}>{executionLaunchPreview.summary.candidateCount}</span>명 후보 ·{" "}
                  <span style={{ fontWeight: 900 }}>{executionLaunchPreview.summary.confirmedCount}</span>명 확정 · 세션{" "}
                  <span style={{ fontFamily: "ui-monospace, monospace" }}>{executionLaunchPreview.sessionId}</span>
                </div>
                <div style={{ fontSize: 12, color: "#6b7280" }}>
                  요구사항 ID:{" "}
                  <span style={{ fontFamily: "ui-monospace, monospace" }}>{executionLaunchPreview.requirementId ?? "(없음)"}</span> · 생성 시각:{" "}
                  <span style={{ fontFamily: "ui-monospace, monospace" }}>{executionLaunchPreview.createdAtIso}</span>
                </div>
                <div style={{ fontSize: 12, color: "#111827" }}>
                  후보 작업 ID:{" "}
                  <span style={{ fontFamily: "ui-monospace, monospace", color: "#374151" }}>
                    {executionLaunchPreview.readyTaskIds.length > 0 ? executionLaunchPreview.readyTaskIds.join(", ") : "(없음)"}
                  </span>
                </div>
              </div>
            </details>
          </WorkflowCard>
        </div>
      ) : null}

      {executionLaunchPreview ? (
        <div className="relative">
          <ScreenLabel label="작업-워크스페이스-실행스냅샷-준비패널" visible={showScreenLabels} />
          <WorkflowCard padding={12}>
            <details>
              <summary style={{ cursor: "pointer", fontSize: 13, fontWeight: 900, listStyle: "none" }}>실행 시작 스냅샷</summary>
              <div style={{ marginTop: 10, display: "grid", gap: 10 }}>
                <div style={{ fontSize: 12, color: "#6b7280" }}>
                  미리보기는 변동됩니다. 스냅샷은 공유 세션 메모리에 보관되는 명시적 준비 집합입니다(여전히 실행 전 단계).
                </div>
                <div style={{ display: "flex", gap: 10, flexWrap: "wrap", alignItems: "center" }}>
                  <WorkflowActionButton
                    label="실행 스냅샷 준비"
                    variant="primary"
                    disabled={!view.sessionId}
                    onClick={() => {
                      if (!view.sessionId) return;
                      const snap = createExecutionLaunchSnapshot({
                        sessionId: view.sessionId,
                        requirementId: view.requirementId,
                        confirmedTasks: officialConfirmed,
                        candidateTasks,
                      });
                      recordSessionExecutionLaunchSnapshot(view.sessionId, snap);
                    }}
                  />
                  <span style={{ fontSize: 12, color: "#6b7280" }}>현재 실행 후보를 한 시점에 고정합니다.</span>
                </div>
                {preparedSnapshot ? (
                  <div style={{ border: "1px solid #e5e7eb", borderRadius: 10, padding: 10, background: "#fafafa" }}>
                    <div style={{ fontSize: 13, fontWeight: 900, color: "#111827" }}>스냅샷 준비됨</div>
                    <div style={{ fontSize: 12, color: "#6b7280", marginTop: 6, lineHeight: 1.5 }}>
                      {preparedSnapshot.summary.candidateCount}명 후보 · 준비 시각{" "}
                      <span style={{ fontFamily: "ui-monospace, monospace" }}>{preparedSnapshot.preparedAtIso}</span> · ID{" "}
                      <span style={{ fontFamily: "ui-monospace, monospace" }}>{preparedSnapshot.snapshotId}</span>
                    </div>
                    <div style={{ fontSize: 12, color: "#6b7280", marginTop: 6, lineHeight: 1.5 }}>
                      활성 입력:{" "}
                      {isActiveSnapshot ? (
                        <span style={{ fontWeight: 900, color: "#166534" }}>선택됨</span>
                      ) : activeExecution ? (
                        <span style={{ fontFamily: "ui-monospace, monospace" }}>
                          {activeExecution.sessionId} / {activeExecution.snapshotId}
                        </span>
                      ) : (
                        <span>(없음)</span>
                      )}
                    </div>
                    {isHandoffPrepared && handoffPrepared ? (
                      <div style={{ fontSize: 12, color: "#6b7280", marginTop: 6, lineHeight: 1.5 }}>
                        인계 준비: <span style={{ fontWeight: 900, color: "#166534" }}>준비됨</span> ·{" "}
                        <span style={{ fontFamily: "ui-monospace, monospace" }}>{handoffPrepared.preparedAtIso}</span>
                      </div>
                    ) : null}
                    {preparedSnapshot && snapshotStaleness.isSnapshotStale ? (
                      <div style={{ fontSize: 12, color: "#b45309", marginTop: 6, lineHeight: 1.5 }}>
                        스냅샷이 오래되었습니다. 인계 전에 스냅샷을 다시 준비하세요.
                      </div>
                    ) : null}
                    {isHandoffPrepared && !handoffValidity.isHandoffValid ? (
                      <div style={{ fontSize: 12, color: "#b45309", marginTop: 6, lineHeight: 1.5 }}>
                        인계가 유효하지 않습니다. 스냅샷을 다시 준비하고 인계를 다시 준비하세요.
                      </div>
                    ) : null}
                    {hasExecutionRequestDraft && executionRequestDraft ? (
                      <div style={{ fontSize: 12, color: "#6b7280", marginTop: 6, lineHeight: 1.5 }}>
                        실행 요청 초안: <span style={{ fontWeight: 900, color: "#166534" }}>초안 준비됨</span> ·{" "}
                        <span style={{ fontFamily: "ui-monospace, monospace" }}>{executionRequestDraft.requestId}</span>
                      </div>
                    ) : null}
                    {isDraftApproved ? (
                      <div style={{ fontSize: 12, color: "#6b7280", marginTop: 6, lineHeight: 1.5 }}>
                        최종 검증점: <span style={{ fontWeight: 900, color: "#166534" }}>승인됨</span> (/execution 참고)
                      </div>
                    ) : null}
                    {hasBusinessExecutionRequest && businessExecutionRequestValidity ? (
                      <div style={{ fontSize: 12, color: "#6b7280", marginTop: 6, lineHeight: 1.5 }}>
                        비즈니스 요청:{" "}
                        <span
                          style={{
                            fontWeight: 900,
                            color: businessExecutionRequestValidity.status === "requested" ? "#166534" : "#b45309",
                          }}
                        >
                          {businessExecutionRequestValidity.status === "requested"
                            ? "요청됨"
                            : businessExecutionRequestValidity.status === "stale"
                              ? "오래됨"
                              : "무효"}
                        </span>{" "}
                        (/execution 참고)
                      </div>
                    ) : null}
                    {isBusinessExecutionApproved ? (
                      <div style={{ fontSize: 11, color: "#9ca3af", marginTop: 4, lineHeight: 1.45 }}>
                        비즈니스 요청: <span style={{ fontWeight: 800, color: "#6b7280" }}>승인됨</span> · 실행 전 단계이며 시작은 아님.
                      </div>
                    ) : null}
                    {isBusinessExecutionPackaged ? (
                      <div style={{ fontSize: 11, color: "#9ca3af", marginTop: 2, lineHeight: 1.45 }}>
                        실행 패키지: <span style={{ fontWeight: 800, color: "#6b7280" }}>준비됨</span> · 아직 시작되지 않음.
                      </div>
                    ) : null}
                    {isExecutionPackageAssigned && executionAssignment ? (
                      <div style={{ fontSize: 11, color: "#9ca3af", marginTop: 2, lineHeight: 1.45 }}>
                        배정: <span style={{ fontWeight: 800, color: "#6b7280" }}>{EXECUTOR_TYPE_LABELS[executionAssignment.executorType]}</span> · 아직 시작되지
                        않음.
                      </div>
                    ) : null}
                    {isExecutionAssignmentHandoffCurrent ? (
                      <div style={{ fontSize: 11, color: "#9ca3af", marginTop: 2, lineHeight: 1.45 }}>
                        실행기 인계: <span style={{ fontWeight: 800, color: "#6b7280" }}>준비됨</span> · 아직 시작되지 않음.
                      </div>
                    ) : null}
                    {isExecutorIntakeContractCurrent ? (
                      <div style={{ fontSize: 11, color: "#9ca3af", marginTop: 2, lineHeight: 1.45 }}>
                        실행기 입력: <span style={{ fontWeight: 800, color: "#6b7280" }}>접수 준비됨</span> · 아직 시작되지 않음.
                      </div>
                    ) : null}
                    {isExecutorWorkOrderCurrent ? (
                      <div style={{ fontSize: 11, color: "#9ca3af", marginTop: 2, lineHeight: 1.45 }}>
                        작업 지시: <span style={{ fontWeight: 800, color: "#6b7280" }}>준비됨</span> · 아직 시작되지 않음.
                      </div>
                    ) : null}
                    {view.sessionId ? (
                      <div style={{ fontSize: 11, color: "#9ca3af", marginTop: 2, lineHeight: 1.45 }}>
                        실행 준비 상태:{" "}
                        <span style={{ fontWeight: 800, color: executionReadiness.status === "ready" ? "#166534" : "#b45309" }}>
                          {executionReadiness.status === "ready" ? "준비됨" : "미준비"}
                        </span>
                        .
                      </div>
                    ) : null}
                    {isBusinessLaunchIntentCurrent ? (
                      <div style={{ fontSize: 11, color: "#9ca3af", marginTop: 2, lineHeight: 1.45 }}>
                        시작 의도: <span style={{ fontWeight: 800, color: "#6b7280" }}>선언됨</span> · 아직 시작되지 않음.
                      </div>
                    ) : null}
                    {isBusinessLaunchHandoffRecordCurrent ? (
                      <div style={{ fontSize: 11, color: "#9ca3af", marginTop: 2, lineHeight: 1.45 }}>
                        시작 인계 기록됨 · 실행 인계 준비됨 · 아직 시작되지 않음.
                      </div>
                    ) : null}
                    {isExecutorLaunchContractCurrent ? (
                      <div style={{ fontSize: 11, color: "#9ca3af", marginTop: 2, lineHeight: 1.45 }}>
                        시작 계약 준비됨 · 실행기 계약 준비됨 · 아직 시작되지 않음.
                      </div>
                    ) : null}
                    {isExecutionTriggerIntentCurrent ? (
                      <div style={{ fontSize: 11, color: "#9ca3af", marginTop: 2, lineHeight: 1.45 }}>
                        트리거 의도 선언됨 · 이후 트리거 준비됨 · 아직 시작되지 않음.
                      </div>
                    ) : null}
                    {isActualExecutionAdapterRequestCurrent ? (
                      <div style={{ fontSize: 11, color: "#9ca3af", marginTop: 2, lineHeight: 1.45 }}>
                        실행 어댑터 준비됨 · 실제 실행 인계 준비됨 · 아직 시작되지 않음.
                      </div>
                    ) : null}
                    {isActualLaunchCommandCurrent ? (
                      <div style={{ fontSize: 11, color: "#9ca3af", marginTop: 2, lineHeight: 1.45 }}>
                        시작 명령 준비됨 · 실행 명령 준비됨 · 아직 시작되지 않음.
                      </div>
                    ) : null}
                    {businessExecutionRun ? (
                      <div style={{ fontSize: 11, color: "#9ca3af", marginTop: 2, lineHeight: 1.45 }}>
                        {businessExecutionRunLatestStrip(businessExecutionRun, isBusinessExecutionRunCurrent)}
                      </div>
                    ) : null}
                    {executorIntegrationAdapter ? (
                      <div style={{ fontSize: 11, color: "#9ca3af", marginTop: 2, lineHeight: 1.45 }}>
                        {executorIntegrationAdapterSubtleNote(executorIntegrationAdapter, isExecutorIntegrationAdapterCurrent)}
                      </div>
                    ) : null}
                    {executorConnectorResult ? (
                      <div style={{ fontSize: 11, color: "#9ca3af", marginTop: 2, lineHeight: 1.45 }}>
                        {executorConnectorResultSubtleNote(executorConnectorResult, isExecutorConnectorResultCurrent)}
                      </div>
                    ) : null}
                  </div>
                ) : (
                  <div style={{ fontSize: 12, color: "#6b7280" }}>아직 준비된 스냅샷이 없습니다.</div>
                )}
              </div>
            </details>
          </WorkflowCard>
        </div>
      ) : null}

      {working.removedTasks.length > 0 ? (
        <div className="relative">
          <ScreenLabel label="작업-워크스페이스-검토제외-목록패널" visible={showScreenLabels} />
          <WorkflowCard padding={10}>
            <div style={{ fontSize: 12, fontWeight: 800, marginBottom: 8, color: "#6b7280" }}>이 검토에서 제외됨</div>
            <ul style={{ margin: 0, paddingLeft: 18, fontSize: 13, color: "#374151" }}>
              {working.removedTasks.map((t) => (
                <li key={t.id} style={{ marginBottom: 6 }}>
                  {t.name}{" "}
                  <button
                    type="button"
                    onClick={() => working.restoreTask(t.id)}
                    style={{
                      fontSize: 11,
                      textDecoration: "underline",
                      border: 0,
                      background: "none",
                      cursor: "pointer",
                      padding: 0,
                      color: "#2563eb",
                    }}
                  >
                    복원
                  </button>
                </li>
              ))}
            </ul>
          </WorkflowCard>
        </div>
      ) : null}

      <div className="relative">
        <ScreenLabel label="작업-워크스페이스-수동추가-폼패널" visible={showScreenLabels} />
        <WorkflowCard padding={12}>
          <details>
            <summary style={{ cursor: "pointer", fontSize: 13, fontWeight: 900, listStyle: "none" }}>작업 추가</summary>
            <div style={{ marginTop: 12, display: "grid", gap: 10, maxWidth: 440 }}>
              <label style={{ fontSize: 12, color: "#6b7280" }}>
                이름
                <input value={addName} onChange={(e) => setAddName(e.target.value)} style={inputStyle} />
              </label>
              <label style={{ fontSize: 12, color: "#6b7280" }}>
                짧은 설명
                <textarea
                  value={addDesc}
                  onChange={(e) => setAddDesc(e.target.value)}
                  rows={2}
                  style={{ ...inputStyle, marginTop: 4, resize: "vertical", minHeight: 48 }}
                />
              </label>
              <label style={{ fontSize: 12, color: "#6b7280" }}>
                관련 기능(선택)
                <input value={addFeat} onChange={(e) => setAddFeat(e.target.value)} style={inputStyle} placeholder="기능 이름" />
              </label>
              <div>
                <button
                  type="button"
                  onClick={submitManual}
                  style={{
                    fontSize: 13,
                    fontWeight: 700,
                    padding: "8px 14px",
                    borderRadius: 8,
                    border: "1px solid #e5e7eb",
                    background: "#111827",
                    color: "#fff",
                    cursor: "pointer",
                  }}
                >
                  순서에 추가
                </button>
              </div>
            </div>
          </details>
        </WorkflowCard>
      </div>

      <div className="relative">
        <ScreenLabel label="작업-워크스페이스-상세작업목록-패널" visible={showScreenLabels} />
        <WorkflowCard padding={12}>
          <details>
            <summary style={{ cursor: "pointer", fontSize: 13, fontWeight: 900, listStyle: "none" }}>상세 작업 목록</summary>
            <div style={{ marginTop: 12 }}>
              <TaskDraftsPanel
                tasks={working.activeTasks}
                review={reviewApi}
                highlightExecutionReady
                emptyLabel="이 작업 집합에 작업이 없습니다."
              />
            </div>
          </details>
        </WorkflowCard>
      </div>

      <div className="relative">
        <ScreenLabel label="작업-워크스페이스-실행참고-접이섹션" visible={showScreenLabels} />
        <details>
          <summary style={{ cursor: "pointer", fontSize: 12, fontWeight: 800, color: "#9ca3af" }}>실행(아직 연결되지 않음)</summary>
          <p style={{ fontSize: 12, color: "#6b7280", marginTop: 8, lineHeight: 1.5, marginBottom: 0 }}>
            준비도 표시는 실행 전 단계(메모리)용입니다. 실행, 대기열, Stage 연결은 아직 없습니다.
          </p>
        </details>
      </div>
    </>
  );
}
