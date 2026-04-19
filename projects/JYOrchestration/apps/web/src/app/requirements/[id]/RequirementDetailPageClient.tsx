"use client";

import Link from "next/link";
import { useParams, useRouter, useSearchParams } from "next/navigation";
import { useMemo } from "react";
import {
  getTaskExecutionReadiness,
  resolveSessionConfirmedTasks,
  resolveSessionExecutionLaunchSnapshot,
  resolveSessionMinutes,
  resolveSessionOfficialFeatures,
  resolveSessionOfficialTasks,
  resolveSessionTaskReadiness,
  sessionHasExecutionLaunchSnapshot,
  sessionHasConfirmedTaskSet,
  sessionHasMinutesOverride,
  sessionHasOfficialFeaturesOverride,
  sessionHasOfficialTasksOverride,
} from "@/lib/workflow/collaborationSessionResultStore";
import { useCollaborationSessionResultsVersion } from "@/lib/workflow/useCollaborationSessionResultsSync";
import { EXECUTOR_TYPE_LABELS } from "@/lib/workflow/executionAssignment";
import { businessExecutionRunLatestStrip } from "@/lib/workflow/businessExecutionRun";
import { executorConnectorResultSubtleNote } from "@/lib/workflow/executorConnector";
import { executorIntegrationAdapterSubtleNote } from "@/lib/workflow/executorIntegrationAdapter";
import { getBusinessExecutionSessionState } from "@/lib/workflow/businessExecutionSelectors";
import { TaskDraftsPanel } from "@/components/workflow/TaskDraftsPanel";
import { WorkflowTabs } from "@/components/workflow/WorkflowTabs";
import { FeatureSummaryPanel } from "@/components/workflow/FeatureSummaryPanel";
import { MeetingMinutesPanel } from "@/components/workflow/MeetingMinutesPanel";
import { WorkflowActionButton } from "@/components/workflow/primitives/WorkflowActionButton";
import { WorkflowBadge } from "@/components/workflow/primitives/WorkflowBadge";
import { WorkflowCard } from "@/components/workflow/primitives/WorkflowCard";
import { WorkflowEmptyState } from "@/components/workflow/primitives/WorkflowEmptyState";
import { WorkflowPageHeader } from "@/components/workflow/primitives/WorkflowPageHeader";
import { ScreenLabel } from "@/components/ui/ScreenLabel";
import { useShowScreenLabels } from "@/components/ui/ScreenLabelsContext";
import { formatCollaborationSessionStatusForUi, formatRequirementStatusForUi } from "@/lib/ui/workflowUiCopy";
import { getRequirementDetailView } from "@/lib/workflow/workflowViewModel";

type TabId = "overview" | "sessions" | "minutes" | "features" | "tasks";

export function RequirementDetailPageClient() {
  const showScreenLabels = useShowScreenLabels();
  const tabs = useMemo(
    () =>
      [
        { id: "overview" as const, label: "개요" },
        { id: "sessions" as const, label: "세션" },
        { id: "minutes" as const, label: "회의록" },
        { id: "features" as const, label: "기능" },
        { id: "tasks" as const, label: "작업" },
      ] satisfies { id: TabId; label: string }[],
    []
  );

  const params = useParams<{ id: string }>();
  const requirementId = typeof params?.id === "string" ? params.id : "";
  const vm = useMemo(() => getRequirementDetailView(requirementId), [requirementId]);
  const sessionResultsVersion = useCollaborationSessionResultsVersion();
  const latestSessionId = vm.latestSession?.id ?? null;

  const resolvedMinutes = useMemo(
    () => resolveSessionMinutes(latestSessionId, vm.minutes),
    [latestSessionId, vm.minutes, sessionResultsVersion]
  );

  const resolvedFeatures = useMemo(
    () => resolveSessionOfficialFeatures(latestSessionId, vm.features),
    [latestSessionId, vm.features, sessionResultsVersion]
  );

  const minutesFromCollaboration = useMemo(() => sessionHasMinutesOverride(latestSessionId), [latestSessionId, sessionResultsVersion]);

  const featuresFromCollaboration = useMemo(
    () => sessionHasOfficialFeaturesOverride(latestSessionId),
    [latestSessionId, sessionResultsVersion]
  );

  const generatedTaskDrafts = useMemo(
    () => resolveSessionOfficialTasks(latestSessionId, vm.taskDrafts),
    [latestSessionId, vm.taskDrafts, sessionResultsVersion]
  );

  const confirmedTaskSet = useMemo(() => resolveSessionConfirmedTasks(latestSessionId), [latestSessionId, sessionResultsVersion]);

  const resolvedTaskDrafts = useMemo(
    () => (confirmedTaskSet !== undefined ? confirmedTaskSet : generatedTaskDrafts),
    [confirmedTaskSet, generatedTaskDrafts]
  );

  const tasksFromCollaboration = useMemo(() => sessionHasOfficialTasksOverride(latestSessionId), [latestSessionId, sessionResultsVersion]);

  const tasksFromConfirmedSet = useMemo(() => sessionHasConfirmedTaskSet(latestSessionId), [latestSessionId, sessionResultsVersion]);

  const taskReadinessMap = useMemo(() => resolveSessionTaskReadiness(latestSessionId), [latestSessionId, sessionResultsVersion]);

  const executionReadySummary = useMemo(() => {
    if (!tasksFromConfirmedSet) return null;
    const list = resolvedTaskDrafts;
    const ready = list.filter((t) => getTaskExecutionReadiness(taskReadinessMap, t.id) === "ready").length;
    return { ready, total: list.length };
  }, [tasksFromConfirmedSet, resolvedTaskDrafts, taskReadinessMap]);

  const hasExecutionSnapshot = useMemo(() => sessionHasExecutionLaunchSnapshot(latestSessionId), [latestSessionId, sessionResultsVersion]);

  const executionSnapshot = useMemo(() => resolveSessionExecutionLaunchSnapshot(latestSessionId), [latestSessionId, sessionResultsVersion]);

  const pre = useMemo(() => getBusinessExecutionSessionState(latestSessionId), [latestSessionId, sessionResultsVersion]);
  const activeExecution = pre.active;
  const isActiveSnapshot = pre.isSnapshotActive;
  const launchReadiness = pre.launchReadiness;
  const isHandoffPrepared = pre.isHandoffPreparedActive;
  const handoffPrepared = pre.handoffPrepared;
  const snapshotStaleness = pre.snapshotStaleness;
  const handoffValidity = pre.handoffValidity;
  const hasExecutionDraft = pre.hasExecutionRequestDraft;

  const search = useSearchParams();
  const router = useRouter();
  const tabRaw = (search?.get("tab") ?? "overview").toLowerCase();
  const tab = (tabs.some((t) => t.id === tabRaw) ? tabRaw : "overview") as TabId;

  const setTab = (next: TabId) => {
    router.replace(`/requirements/${encodeURIComponent(requirementId)}?tab=${encodeURIComponent(next)}`);
  };

  const statusBadge =
    vm.requirement !== undefined && vm.requirement !== null ? (
      <WorkflowBadge>{formatRequirementStatusForUi(vm.requirement.status)}</WorkflowBadge>
    ) : (
      <WorkflowBadge>알 수 없음</WorkflowBadge>
    );

  return (
    <div className="relative">
      <ScreenLabel label="요구사항-상세-페이지-섹션" visible={showScreenLabels} />
      <WorkflowPageHeader
        title={vm.requirement?.title ?? "아이디어"}
        subtitle={
          vm.requirement?.description ?? (requirementId ? `알 수 없는 아이디어 ID: ${requirementId}` : "알 수 없는 아이디어 ID입니다.")
        }
        backHref="/requirements"
        backLabel="아이디어 목록으로"
        right={statusBadge}
      />

      <div className="relative" style={{ marginTop: 14 }}>
        <ScreenLabel label="요구사항-상세-요약-카드" visible={showScreenLabels} />
        <WorkflowCard>
          <div style={{ display: "flex", justifyContent: "space-between", gap: 12, flexWrap: "wrap", alignItems: "center" }}>
            <div style={{ display: "flex", gap: 14, flexWrap: "wrap", fontSize: 13, color: "#6b7280" }}>
              <div>
                <strong style={{ color: "#111827" }}>{vm.requirement?.sessionCount ?? vm.sessions.length}</strong>개 세션
              </div>
              <div>
                <strong style={{ color: "#111827" }}>{vm.requirement?.featureCount ?? vm.features.length}</strong>개 기능
              </div>
              <div style={{ color: "#6b7280" }}>흐름: 아이디어 구체화 → 세션 → 회의록 → 기능 정리</div>
              {latestSessionId ? (
                <div style={{ fontSize: 11, color: "#9ca3af", alignSelf: "center" }}>
                  실행 준비도(최신 세션):{" "}
                  <span style={{ fontWeight: 800, color: pre.executionReadiness.status === "ready" ? "#166534" : "#b45309" }}>
                    {pre.executionReadiness.status === "ready" ? "준비됨" : "미준비"}
                  </span>
                  {pre.isBusinessLaunchIntentCurrent ? (
                    <>
                      {" "}
                      · 시작 의도 <span style={{ fontWeight: 800, color: "#6b7280" }}>선언됨</span>
                    </>
                  ) : null}
                  {pre.isBusinessLaunchHandoffRecordCurrent ? (
                    <>
                      {" "}
                      · 시작 인계 <span style={{ fontWeight: 800, color: "#6b7280" }}>기록됨</span>
                    </>
                  ) : null}
                  {pre.isExecutorLaunchContractCurrent ? (
                    <>
                      {" "}
                      · 시작 계약 <span style={{ fontWeight: 800, color: "#6b7280" }}>준비됨</span>
                    </>
                  ) : null}
                  {pre.isExecutionTriggerIntentCurrent ? (
                    <>
                      {" "}
                      · 트리거 의도 <span style={{ fontWeight: 800, color: "#6b7280" }}>선언됨</span>
                    </>
                  ) : null}
                  {pre.isActualExecutionAdapterRequestCurrent ? (
                    <>
                      {" "}
                      · 실행 어댑터 <span style={{ fontWeight: 800, color: "#6b7280" }}>준비됨</span>
                    </>
                  ) : null}
                  {pre.isActualLaunchCommandCurrent ? (
                    <>
                      {" "}
                      · 시작 명령 <span style={{ fontWeight: 800, color: "#6b7280" }}>준비됨</span>
                    </>
                  ) : null}
                  {pre.businessExecutionRun ? (
                    <>
                      {" "}
                      ·{" "}
                      <span style={{ fontWeight: 800, color: "#6b7280" }}>
                        {businessExecutionRunLatestStrip(pre.businessExecutionRun, pre.isBusinessExecutionRunCurrent)}
                      </span>
                    </>
                  ) : null}
                  {pre.executorIntegrationAdapter ? (
                    <>
                      {" "}
                      ·{" "}
                      <span style={{ fontWeight: 800, color: "#6b7280" }}>
                        {executorIntegrationAdapterSubtleNote(pre.executorIntegrationAdapter, pre.isExecutorIntegrationAdapterCurrent)}
                      </span>
                    </>
                  ) : null}
                  {pre.executorConnectorResult ? (
                    <>
                      {" "}
                      ·{" "}
                      <span style={{ fontWeight: 800, color: "#6b7280" }}>
                        {executorConnectorResultSubtleNote(pre.executorConnectorResult, pre.isExecutorConnectorResultCurrent)}
                      </span>
                    </>
                  ) : null}
                </div>
              ) : null}
            </div>
            <div style={{ display: "flex", gap: 8, flexWrap: "wrap" }}>
              <WorkflowActionButton
                label="최신 세션 열기"
                onClick={() => {
                  if (!vm.latestSession) return;
                  router.push(`/collaboration/${encodeURIComponent(vm.latestSession.id)}`);
                }}
              />
              <WorkflowActionButton label="최신 회의록 보기" onClick={() => setTab("minutes")} />
              <WorkflowActionButton label="파생 기능 보기" onClick={() => setTab("features")} />
              <WorkflowActionButton label="작업 초안 보기" onClick={() => setTab("tasks")} />
            </div>
          </div>
        </WorkflowCard>
      </div>

      <div className="relative">
        <ScreenLabel label="요구사항-상세-탭-메뉴" visible={showScreenLabels} />
        <WorkflowTabs ariaLabel="아이디어 상세 탭" tabs={tabs} activeId={tab} onChange={(id) => setTab(id)} />
      </div>

      {tab === "overview" ? (
        vm.requirement ? (
          <div className="relative">
            <ScreenLabel label="요구사항-상세-개요탭-패널" visible={showScreenLabels} />
            <WorkflowCard>
              <div style={{ fontSize: 13, fontWeight: 900, marginBottom: 8 }}>개요</div>
              <div style={{ fontSize: 13, color: "#111827", lineHeight: 1.6 }}>
                UI 골격입니다. 이후 단계에서 실제 아이디어·세션·회의록·기능 데이터와 연동됩니다.
              </div>
              <div style={{ marginTop: 10, fontSize: 13, color: "#6b7280" }}>
                권장: 최신 세션을 연 뒤 회의록 작성 → 기능 생성 → 작업 초안 생성을 실행하면 이 화면의 회의록·기능·작업 탭이 갱신됩니다(메모리).
              </div>
            </WorkflowCard>
          </div>
        ) : (
          <WorkflowEmptyState title="아이디어를 찾을 수 없음" message="URL을 확인하세요. 관계 없는 목 데이터는 표시하지 않습니다." />
        )
      ) : null}

      {tab === "sessions" ? (
        <div className="relative" style={{ display: "grid", gap: 10 }}>
          <ScreenLabel label="요구사항-상세-세션탭-섹션" visible={showScreenLabels} />
          <div style={{ fontSize: 13, fontWeight: 900 }}>세션</div>
          {vm.sessions.length === 0 ? (
            <div style={{ fontSize: 13, color: "#6b7280" }}>연결된 협업 세션이 없습니다.</div>
          ) : (
            vm.sessions.map((s) => (
              <div key={s.id} style={{ border: "1px solid #e5e5e5", borderRadius: 12, padding: 14 }}>
                <div style={{ display: "flex", justifyContent: "space-between", gap: 12 }}>
                  <div style={{ minWidth: 0 }}>
                    <div style={{ fontSize: 13, fontWeight: 900 }}>{s.title}</div>
                    <div style={{ fontSize: 12, color: "#6b7280", marginTop: 4 }}>
                      {s.createdAt} · {formatCollaborationSessionStatusForUi(s.status)}
                    </div>
                  </div>
                  <Link href={`/collaboration/${encodeURIComponent(s.id)}`} style={{ fontSize: 13, textDecoration: "underline", alignSelf: "center" }}>
                    워크스페이스 열기
                  </Link>
                </div>
              </div>
            ))
          )}
        </div>
      ) : null}

      {tab === "minutes" ? (
        <div className="relative" style={{ display: "grid", gap: 10 }}>
          <ScreenLabel label="요구사항-상세-회의록탭-섹션" visible={showScreenLabels} />
          {vm.requirement && latestSessionId ? (
            <div style={{ display: "flex", flexWrap: "wrap", gap: 8, alignItems: "center" }}>
              {minutesFromCollaboration ? (
                <>
                  <WorkflowBadge>협업 스냅샷</WorkflowBadge>
                  <span style={{ fontSize: 12, color: "#6b7280", lineHeight: 1.45 }}>
                    최신 세션 회의록은 협업 워크스페이스의 메모리 출력을 반영합니다(목 스텁, 새로고침 시 초기화될 수 있음).
                  </span>
                </>
              ) : (
                <span style={{ fontSize: 12, color: "#6b7280", lineHeight: 1.45 }}>
                  최신 세션 회의록은 뷰 모델 기준입니다. 세션 워크스페이스에서 회의록 작성을 실행하면 저장소 연동 전까지 여기 내용이 바뀝니다.
                </span>
              )}
            </div>
          ) : null}
          <MeetingMinutesPanel minutes={resolvedMinutes} emptyLabel="표시할 회의록이 없습니다." />
        </div>
      ) : null}

      {tab === "features" ? (
        <div className="relative" style={{ display: "grid", gap: 10 }}>
          <ScreenLabel label="요구사항-상세-기능탭-섹션" visible={showScreenLabels} />
          {vm.requirement && latestSessionId ? (
            <div style={{ display: "flex", flexWrap: "wrap", gap: 8, alignItems: "center" }}>
              {featuresFromCollaboration ? (
                <>
                  <WorkflowBadge>협업 스냅샷</WorkflowBadge>
                  <span style={{ fontSize: 12, color: "#6b7280", lineHeight: 1.45 }}>
                    최신 세션의 공식 파생 기능은 협업 워크스페이스의 기능 생성에서 옵니다(목·메모리, 전체 새로고침 시 유실 가능). 아이디어 요청 제안과는
                    별개입니다.
                  </span>
                </>
              ) : (
                <span style={{ fontSize: 12, color: "#6b7280", lineHeight: 1.45 }}>
                  최신 세션 기능은 뷰 모델 기준입니다. 세션에서 기능 생성을 실행하면 저장 전까지 아이디어 상세 화면 목록이 바뀝니다. 아이디어 기반 제안은 여기에
                  나오지 않습니다.
                </span>
              )}
            </div>
          ) : null}
          <FeatureSummaryPanel features={resolvedFeatures} emptyLabel="파생 기능이 없습니다." />
        </div>
      ) : null}

      {tab === "tasks" ? (
        <div className="relative" style={{ display: "grid", gap: 10 }}>
          <ScreenLabel label="요구사항-상세-작업탭-섹션" visible={showScreenLabels} />
          {vm.requirement ? (
            <div style={{ display: "flex", flexWrap: "wrap", gap: 10, alignItems: "center" }}>
              <WorkflowActionButton
                label="작업 워크스페이스 열기"
                variant="primary"
                onClick={() => router.push(`/tasks?requirementId=${encodeURIComponent(requirementId)}`)}
              />
              {latestSessionId ? (
                <>
                  {tasksFromConfirmedSet ? <WorkflowBadge>확정 세트</WorkflowBadge> : null}
                  {!tasksFromConfirmedSet && tasksFromCollaboration ? <WorkflowBadge>스냅샷</WorkflowBadge> : null}
                  <span style={{ fontSize: 12, color: "#6b7280", lineHeight: 1.45 }}>
                    {tasksFromConfirmedSet
                      ? `작업 화면의 공식 확정 세트를 표시합니다(메모리).${
                          executionReadySummary
                            ? ` 실행 후보(준비됨) ${executionReadySummary.ready} / ${executionReadySummary.total}개.`
                            : ""
                        }`
                      : tasksFromCollaboration
                        ? "협업에서 생성된 초안입니다(작업 화면에서 확정하기 전까지 동일 출처)."
                        : "세션 워크스페이스에서 작업 초안 생성을 실행한 뒤 필요하면 작업 화면에서 확정하세요."}
                  </span>
                  {tasksFromConfirmedSet ? (
                    <span style={{ fontSize: 12, color: "#6b7280", lineHeight: 1.45 }}>
                      실행 입력 미리보기·스냅샷 준비는 작업 워크스페이스에서 할 수 있습니다(실행 전 단계).
                    </span>
                  ) : null}
                  {hasExecutionSnapshot && executionSnapshot ? (
                    <span style={{ fontSize: 12, color: "#6b7280", lineHeight: 1.45 }}>
                      스냅샷 준비됨(후보 {executionSnapshot.summary.candidateCount}개).
                    </span>
                  ) : null}
                  {hasExecutionSnapshot && executionSnapshot ? (
                    <span style={{ fontSize: 12, color: "#6b7280", lineHeight: 1.45 }}>
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
                    </span>
                  ) : null}
                  {hasExecutionSnapshot && activeExecution ? (
                    <span style={{ fontSize: 12, color: "#6b7280", lineHeight: 1.45 }}>
                      시작 준비도:{" "}
                      {launchReadiness.isLaunchReady ? (
                        <span style={{ fontWeight: 900, color: "#166534" }}>준비됨</span>
                      ) : (
                        <span style={{ fontWeight: 900, color: "#b45309" }}>미준비</span>
                      )}{" "}
                      (/execution 참고)
                    </span>
                  ) : null}
                  {hasExecutionSnapshot && isHandoffPrepared && handoffPrepared ? (
                    <span style={{ fontSize: 12, color: "#6b7280", lineHeight: 1.45 }}>
                      인계 준비: <span style={{ fontWeight: 900, color: "#166534" }}>준비됨</span> ·{" "}
                      <span style={{ fontFamily: "ui-monospace, monospace" }}>{handoffPrepared.preparedAtIso}</span>
                    </span>
                  ) : null}
                  {hasExecutionSnapshot && snapshotStaleness.isSnapshotStale ? (
                    <span style={{ fontSize: 12, color: "#b45309", lineHeight: 1.45 }}>
                      스냅샷 오래됨: <span style={{ fontWeight: 900 }}>다시 준비</span> (/tasks 참고)
                    </span>
                  ) : null}
                  {hasExecutionSnapshot && isHandoffPrepared && !handoffValidity.isHandoffValid ? (
                    <span style={{ fontSize: 12, color: "#b45309", lineHeight: 1.45 }}>
                      인계 무효: <span style={{ fontWeight: 900 }}>다시 준비</span> (/execution 참고)
                    </span>
                  ) : null}
                  {hasExecutionDraft ? (
                    <span style={{ fontSize: 12, color: "#6b7280", lineHeight: 1.45 }}>
                      실행 요청 초안: <span style={{ fontWeight: 900, color: "#166534" }}>준비됨</span> (/execution 참고)
                    </span>
                  ) : null}
                  {pre.isExecutionDraftApproved ? (
                    <span style={{ fontSize: 12, color: "#6b7280", lineHeight: 1.45 }}>
                      최종 검증점: <span style={{ fontWeight: 900, color: "#166534" }}>승인됨</span>
                    </span>
                  ) : null}
                  {pre.hasBusinessExecutionRequest && pre.businessExecutionRequestValidity ? (
                    <span style={{ fontSize: 12, color: "#6b7280", lineHeight: 1.45 }}>
                      비즈니스 요청:{" "}
                      <span
                        style={{
                          fontWeight: 900,
                          color: pre.businessExecutionRequestValidity.status === "requested" ? "#166534" : "#b45309",
                        }}
                      >
                        {pre.businessExecutionRequestValidity.status === "requested"
                          ? "요청됨"
                          : pre.businessExecutionRequestValidity.status === "stale"
                            ? "오래됨"
                            : "무효"}
                      </span>{" "}
                      (/execution 참고)
                    </span>
                  ) : null}
                  {pre.isBusinessExecutionApproved ? (
                    <span style={{ fontSize: 11, color: "#9ca3af", lineHeight: 1.45 }}>
                      비즈니스 요청: <span style={{ fontWeight: 800, color: "#6b7280" }}>승인됨</span> · 실행 시작은 아님.
                    </span>
                  ) : null}
                  {pre.isBusinessExecutionPackaged ? (
                    <span style={{ fontSize: 11, color: "#9ca3af", lineHeight: 1.45 }}>
                      실행 패키지: <span style={{ fontWeight: 800, color: "#6b7280" }}>준비됨</span> · 아직 시작되지 않음.
                    </span>
                  ) : null}
                  {pre.isExecutionPackageAssigned && pre.executionAssignment ? (
                    <span style={{ fontSize: 11, color: "#9ca3af", lineHeight: 1.45 }}>
                      배정:{" "}
                      <span style={{ fontWeight: 800, color: "#6b7280" }}>{EXECUTOR_TYPE_LABELS[pre.executionAssignment.executorType]}</span> · 아직 시작되지
                      않음.
                    </span>
                  ) : null}
                  {pre.isExecutionAssignmentHandoffCurrent ? (
                    <span style={{ fontSize: 11, color: "#9ca3af", lineHeight: 1.45 }}>
                      실행기 인계: <span style={{ fontWeight: 800, color: "#6b7280" }}>준비됨</span> · 아직 시작되지 않음.
                    </span>
                  ) : null}
                  {pre.isExecutorIntakeContractCurrent ? (
                    <span style={{ fontSize: 11, color: "#9ca3af", lineHeight: 1.45 }}>
                      실행기 입력: <span style={{ fontWeight: 800, color: "#6b7280" }}>접수 준비됨</span> · 아직 시작되지 않음.
                    </span>
                  ) : null}
                  {pre.isExecutorWorkOrderCurrent ? (
                    <span style={{ fontSize: 11, color: "#9ca3af", lineHeight: 1.45 }}>
                      작업 지시: <span style={{ fontWeight: 800, color: "#6b7280" }}>준비됨</span> · 아직 시작되지 않음.
                    </span>
                  ) : null}
                </>
              ) : null}
            </div>
          ) : null}
          <TaskDraftsPanel
            tasks={resolvedTaskDrafts}
            executionReadiness={tasksFromConfirmedSet ? taskReadinessMap : undefined}
            highlightExecutionReady={tasksFromConfirmedSet}
            emptyLabel={
              tasksFromConfirmedSet
                ? "확정 세트가 비어 있습니다. 작업 워크스페이스에서 행을 확정한 뒤 작업 확정을 실행하세요."
                : "아직 초안이 없습니다. 최신 세션 협업에서 작업 초안 생성을 사용하세요."
            }
          />
        </div>
      ) : null}
    </div>
  );
}
