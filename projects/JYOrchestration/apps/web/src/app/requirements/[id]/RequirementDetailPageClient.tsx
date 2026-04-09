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
import { getRequirementDetailView } from "@/lib/workflow/workflowViewModel";

type TabId = "overview" | "sessions" | "minutes" | "features" | "tasks";

export function RequirementDetailPageClient() {
  const tabs = useMemo(
    () =>
      [
        { id: "overview" as const, label: "Overview" },
        { id: "sessions" as const, label: "Sessions" },
        { id: "minutes" as const, label: "Minutes" },
        { id: "features" as const, label: "Features" },
        { id: "tasks" as const, label: "Tasks" },
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

  return (
    <div>
      <WorkflowPageHeader
        title={vm.requirement?.title ?? "Requirement"}
        subtitle={vm.requirement?.description ?? (requirementId ? `Unknown requirement id: ${requirementId}` : "Unknown requirement id.")}
        backHref="/requirements"
        backLabel="Back to list"
        right={vm.requirement ? <WorkflowBadge>{vm.requirement.status}</WorkflowBadge> : <WorkflowBadge>UNKNOWN</WorkflowBadge>}
      />

      <div style={{ marginTop: 14 }}>
        <WorkflowCard>
          <div style={{ display: "flex", justifyContent: "space-between", gap: 12, flexWrap: "wrap", alignItems: "center" }}>
            <div style={{ display: "flex", gap: 14, flexWrap: "wrap", fontSize: 13, color: "#6b7280" }}>
              <div>
                <strong style={{ color: "#111827" }}>{vm.requirement?.sessionCount ?? vm.sessions.length}</strong> sessions
              </div>
              <div>
                <strong style={{ color: "#111827" }}>{vm.requirement?.featureCount ?? vm.features.length}</strong> features
              </div>
              <div style={{ color: "#6b7280" }}>Next: Requirement → Session → Minutes → Features</div>
              {latestSessionId ? (
                <div style={{ fontSize: 11, color: "#9ca3af", alignSelf: "center" }}>
                  Execution readiness (latest session):{" "}
                  <span style={{ fontWeight: 800, color: pre.executionReadiness.status === "ready" ? "#166534" : "#b45309" }}>
                    {pre.executionReadiness.status === "ready" ? "Ready" : "Not ready"}
                  </span>
                  {pre.isBusinessLaunchIntentCurrent ? (
                    <>
                      {" "}
                      · Launch intent <span style={{ fontWeight: 800, color: "#6b7280" }}>declared</span>
                    </>
                  ) : null}
                  {pre.isBusinessLaunchHandoffRecordCurrent ? (
                    <>
                      {" "}
                      · Launch handoff <span style={{ fontWeight: 800, color: "#6b7280" }}>recorded</span>
                    </>
                  ) : null}
                  {pre.isExecutorLaunchContractCurrent ? (
                    <>
                      {" "}
                      · Launch contract <span style={{ fontWeight: 800, color: "#6b7280" }}>ready</span>
                    </>
                  ) : null}
                  {pre.isExecutionTriggerIntentCurrent ? (
                    <>
                      {" "}
                      · Trigger intent <span style={{ fontWeight: 800, color: "#6b7280" }}>declared</span>
                    </>
                  ) : null}
                  {pre.isActualExecutionAdapterRequestCurrent ? (
                    <>
                      {" "}
                      · Execution adapter <span style={{ fontWeight: 800, color: "#6b7280" }}>ready</span>
                    </>
                  ) : null}
                  {pre.isActualLaunchCommandCurrent ? (
                    <>
                      {" "}
                      · Launch command <span style={{ fontWeight: 800, color: "#6b7280" }}>ready</span>
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
                label="Open latest session"
                onClick={() => {
                  if (!vm.latestSession) return;
                  router.push(`/collaboration/${encodeURIComponent(vm.latestSession.id)}`);
                }}
              />
              <WorkflowActionButton label="View latest minutes" onClick={() => setTab("minutes")} />
              <WorkflowActionButton label="View derived features" onClick={() => setTab("features")} />
              <WorkflowActionButton label="View task drafts" onClick={() => setTab("tasks")} />
            </div>
          </div>
        </WorkflowCard>
      </div>

      <WorkflowTabs ariaLabel="Requirement tabs" tabs={tabs} activeId={tab} onChange={(id) => setTab(id)} />

      {tab === "overview" ? (
        vm.requirement ? (
          <WorkflowCard>
            <div style={{ fontSize: 13, fontWeight: 900, marginBottom: 8 }}>Overview</div>
            <div style={{ fontSize: 13, color: "#111827", lineHeight: 1.6 }}>
              This is a UI skeleton. Next phase will bind real requirement data, sessions, minutes generation, and feature derivation.
            </div>
            <div style={{ marginTop: 10, fontSize: 13, color: "#6b7280" }}>
              Suggested next step: open the latest session, run 회의록 작성 → Feature 생성 → Task 초안 생성 to refresh Minutes, Features, and Tasks tabs here
              (in-memory).
            </div>
          </WorkflowCard>
        ) : (
          <WorkflowEmptyState title="Requirement not found" message="Please check the URL. This page will not show unrelated mock content." />
        )
      ) : null}

      {tab === "sessions" ? (
        <div style={{ display: "grid", gap: 10 }}>
          <div style={{ fontSize: 13, fontWeight: 900 }}>Sessions</div>
          {vm.sessions.length === 0 ? (
            <div style={{ fontSize: 13, color: "#6b7280" }}>No collaboration sessions available</div>
          ) : (
            vm.sessions.map((s) => (
              <div key={s.id} style={{ border: "1px solid #e5e5e5", borderRadius: 12, padding: 14 }}>
                <div style={{ display: "flex", justifyContent: "space-between", gap: 12 }}>
                  <div style={{ minWidth: 0 }}>
                    <div style={{ fontSize: 13, fontWeight: 900 }}>{s.title}</div>
                    <div style={{ fontSize: 12, color: "#6b7280", marginTop: 4 }}>
                      {s.createdAt} · {s.status}
                    </div>
                  </div>
                  <Link href={`/collaboration/${encodeURIComponent(s.id)}`} style={{ fontSize: 13, textDecoration: "underline", alignSelf: "center" }}>
                    Open workspace
                  </Link>
                </div>
              </div>
            ))
          )}
        </div>
      ) : null}

      {tab === "minutes" ? (
        <div style={{ display: "grid", gap: 10 }}>
          {vm.requirement && latestSessionId ? (
            <div style={{ display: "flex", flexWrap: "wrap", gap: 8, alignItems: "center" }}>
              {minutesFromCollaboration ? (
                <>
                  <WorkflowBadge>Collaboration snapshot</WorkflowBadge>
                  <span style={{ fontSize: 12, color: "#6b7280", lineHeight: 1.45 }}>
                    Latest session minutes reflect in-memory output from the collaboration workspace (mock stub; not persisted across reload).
                  </span>
                </>
              ) : (
                <span style={{ fontSize: 12, color: "#6b7280", lineHeight: 1.45 }}>
                  Minutes for the latest session from the view model. Open the session workspace and run 회의록 작성 to update what appears here until real
                  persistence ships.
                </span>
              )}
            </div>
          ) : null}
          <MeetingMinutesPanel minutes={resolvedMinutes} emptyLabel="No meeting minutes available" />
        </div>
      ) : null}

      {tab === "features" ? (
        <div style={{ display: "grid", gap: 10 }}>
          {vm.requirement && latestSessionId ? (
            <div style={{ display: "flex", flexWrap: "wrap", gap: 8, alignItems: "center" }}>
              {featuresFromCollaboration ? (
                <>
                  <WorkflowBadge>Collaboration snapshot</WorkflowBadge>
                  <span style={{ fontSize: 12, color: "#6b7280", lineHeight: 1.45 }}>
                    Official derived features for the latest session come from Feature 생성 in the collaboration workspace (mock_stub; in-memory store — not
                    persisted across full reload). This is separate from 아이디어 요청 suggestions.
                  </span>
                </>
              ) : (
                <span style={{ fontSize: 12, color: "#6b7280", lineHeight: 1.45 }}>
                  Official features for the latest session from the view model. Open the session workspace and run Feature 생성 to replace this list in the
                  requirement view until persistence exists. Idea-based suggestions never appear here.
                </span>
              )}
            </div>
          ) : null}
          <FeatureSummaryPanel features={resolvedFeatures} emptyLabel="No derived features available" />
        </div>
      ) : null}

      {tab === "tasks" ? (
        <div style={{ display: "grid", gap: 10 }}>
          {vm.requirement ? (
            <div style={{ display: "flex", flexWrap: "wrap", gap: 10, alignItems: "center" }}>
              <WorkflowActionButton
                label="Open Tasks workspace"
                variant="primary"
                onClick={() => router.push(`/tasks?requirementId=${encodeURIComponent(requirementId)}`)}
              />
              {latestSessionId ? (
                <>
                  {tasksFromConfirmedSet ? <WorkflowBadge>Confirmed set</WorkflowBadge> : null}
                  {!tasksFromConfirmedSet && tasksFromCollaboration ? <WorkflowBadge>Snapshot</WorkflowBadge> : null}
                  <span style={{ fontSize: 12, color: "#6b7280", lineHeight: 1.45 }}>
                    {tasksFromConfirmedSet
                      ? `Showing the official confirmed task set from the Tasks workspace (in-memory).${
                          executionReadySummary ? ` ${executionReadySummary.ready} / ${executionReadySummary.total} execution candidates (ready).` : ""
                        }`
                      : tasksFromCollaboration
                        ? "Generated drafts from collaboration (same source as /tasks until you confirm a set there)."
                        : "Generate with Task 초안 생성 in the session workspace, then confirm tasks on /tasks if needed."}
                  </span>
                  {tasksFromConfirmedSet ? (
                    <span style={{ fontSize: 12, color: "#6b7280", lineHeight: 1.45 }}>
                      Execution input preview and snapshot preparation are available on the Tasks workspace (pre-execution only).
                    </span>
                  ) : null}
                  {hasExecutionSnapshot && executionSnapshot ? (
                    <span style={{ fontSize: 12, color: "#6b7280", lineHeight: 1.45 }}>
                      Snapshot prepared ({executionSnapshot.summary.candidateCount} candidates).
                    </span>
                  ) : null}
                  {hasExecutionSnapshot && executionSnapshot ? (
                    <span style={{ fontSize: 12, color: "#6b7280", lineHeight: 1.45 }}>
                      Active input:{" "}
                      {isActiveSnapshot ? (
                        <span style={{ fontWeight: 900, color: "#166534" }}>Selected</span>
                      ) : activeExecution ? (
                        <span style={{ fontFamily: "ui-monospace, monospace" }}>
                          {activeExecution.sessionId} / {activeExecution.snapshotId}
                        </span>
                      ) : (
                        <span>(none)</span>
                      )}
                    </span>
                  ) : null}
                  {hasExecutionSnapshot && activeExecution ? (
                    <span style={{ fontSize: 12, color: "#6b7280", lineHeight: 1.45 }}>
                      Launch readiness:{" "}
                      {launchReadiness.isLaunchReady ? (
                        <span style={{ fontWeight: 900, color: "#166534" }}>Ready</span>
                      ) : (
                        <span style={{ fontWeight: 900, color: "#b45309" }}>Not ready</span>
                      )}{" "}
                      (see /execution)
                    </span>
                  ) : null}
                  {hasExecutionSnapshot && isHandoffPrepared && handoffPrepared ? (
                    <span style={{ fontSize: 12, color: "#6b7280", lineHeight: 1.45 }}>
                      Handoff prepared: <span style={{ fontWeight: 900, color: "#166534" }}>Prepared</span> •{" "}
                      <span style={{ fontFamily: "ui-monospace, monospace" }}>{handoffPrepared.preparedAtIso}</span>
                    </span>
                  ) : null}
                  {hasExecutionSnapshot && snapshotStaleness.isSnapshotStale ? (
                    <span style={{ fontSize: 12, color: "#b45309", lineHeight: 1.45 }}>
                      Snapshot stale: <span style={{ fontWeight: 900 }}>Re-prepare</span> (see /tasks)
                    </span>
                  ) : null}
                  {hasExecutionSnapshot && isHandoffPrepared && !handoffValidity.isHandoffValid ? (
                    <span style={{ fontSize: 12, color: "#b45309", lineHeight: 1.45 }}>
                      Handoff invalid: <span style={{ fontWeight: 900 }}>Re-prepare</span> (see /execution)
                    </span>
                  ) : null}
                  {hasExecutionDraft ? (
                    <span style={{ fontSize: 12, color: "#6b7280", lineHeight: 1.45 }}>
                      Execution draft: <span style={{ fontWeight: 900, color: "#166534" }}>Prepared</span> (see /execution)
                    </span>
                  ) : null}
                  {pre.isExecutionDraftApproved ? (
                    <span style={{ fontSize: 12, color: "#6b7280", lineHeight: 1.45 }}>
                      Final checkpoint: <span style={{ fontWeight: 900, color: "#166534" }}>Approved</span>
                    </span>
                  ) : null}
                  {pre.hasBusinessExecutionRequest && pre.businessExecutionRequestValidity ? (
                    <span style={{ fontSize: 12, color: "#6b7280", lineHeight: 1.45 }}>
                      Business request:{" "}
                      <span
                        style={{
                          fontWeight: 900,
                          color: pre.businessExecutionRequestValidity.status === "requested" ? "#166534" : "#b45309",
                        }}
                      >
                        {pre.businessExecutionRequestValidity.status === "requested"
                          ? "Requested"
                          : pre.businessExecutionRequestValidity.status === "stale"
                            ? "Stale"
                            : "Invalid"}
                      </span>{" "}
                      (see /execution)
                    </span>
                  ) : null}
                  {pre.isBusinessExecutionApproved ? (
                    <span style={{ fontSize: 11, color: "#9ca3af", lineHeight: 1.45 }}>
                      Business request: <span style={{ fontWeight: 800, color: "#6b7280" }}>Approved</span> · not a launch.
                    </span>
                  ) : null}
                  {pre.isBusinessExecutionPackaged ? (
                    <span style={{ fontSize: 11, color: "#9ca3af", lineHeight: 1.45 }}>
                      Execution package: <span style={{ fontWeight: 800, color: "#6b7280" }}>Prepared</span> · not launched.
                    </span>
                  ) : null}
                  {pre.isExecutionPackageAssigned && pre.executionAssignment ? (
                    <span style={{ fontSize: 11, color: "#9ca3af", lineHeight: 1.45 }}>
                      Assigned:{" "}
                      <span style={{ fontWeight: 800, color: "#6b7280" }}>{EXECUTOR_TYPE_LABELS[pre.executionAssignment.executorType]}</span> · not launched.
                    </span>
                  ) : null}
                  {pre.isExecutionAssignmentHandoffCurrent ? (
                    <span style={{ fontSize: 11, color: "#9ca3af", lineHeight: 1.45 }}>
                      Executor handoff: <span style={{ fontWeight: 800, color: "#6b7280" }}>Prepared</span> · not launched.
                    </span>
                  ) : null}
                  {pre.isExecutorIntakeContractCurrent ? (
                    <span style={{ fontSize: 11, color: "#9ca3af", lineHeight: 1.45 }}>
                      Executor input: <span style={{ fontWeight: 800, color: "#6b7280" }}>Intake ready</span> · not launched.
                    </span>
                  ) : null}
                  {pre.isExecutorWorkOrderCurrent ? (
                    <span style={{ fontSize: 11, color: "#9ca3af", lineHeight: 1.45 }}>
                      Work order: <span style={{ fontWeight: 800, color: "#6b7280" }}>Ready</span> · not launched.
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
                ? "Confirmed set is empty. Open Tasks workspace and run Task 확정 after marking tasks with Confirm."
                : "No drafts yet. Use Task 초안 생성 in collaboration for the latest session."
            }
          />
        </div>
      ) : null}
    </div>
  );
}

