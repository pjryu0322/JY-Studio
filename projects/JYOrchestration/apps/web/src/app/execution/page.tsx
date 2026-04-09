"use client";

import { useRouter, useSearchParams } from "next/navigation";
import { useMemo } from "react";
import { WorkflowActionButton } from "@/components/workflow/primitives/WorkflowActionButton";
import { WorkflowCard } from "@/components/workflow/primitives/WorkflowCard";
import { WorkflowEmptyState } from "@/components/workflow/primitives/WorkflowEmptyState";
import { WorkflowPageHeader } from "@/components/workflow/primitives/WorkflowPageHeader";
import {
  recordSessionBusinessExecutionRequest,
  recordSessionExecutionRequestDraft,
  recordSessionExecutionRequestApproval,
  recordSessionHandoffPrepared,
  setActiveExecutionInput,
} from "@/lib/workflow/collaborationSessionResultStore";
import { createBusinessExecutionRequest } from "@/lib/workflow/businessExecutionRequest";
import { approveExecutionRequestDraft } from "@/lib/workflow/executionRequestApproval";
import { createExecutionRequestDraft } from "@/lib/workflow/executionRequestDraft";
import { getPreLaunchActionAvailability } from "@/lib/workflow/preLaunchActionModel";
import { getPreExecutionStateForSession } from "@/lib/workflow/preExecutionSelectors";
import { useCollaborationSessionResultsVersion } from "@/lib/workflow/useCollaborationSessionResultsSync";

export default function ExecutionPage() {
  const router = useRouter();
  const search = useSearchParams();
  const sessionResultsVersion = useCollaborationSessionResultsVersion();

  const requirementId = search?.get("requirementId")?.trim() || null;
  const sessionId = search?.get("sessionId")?.trim() || null;

  const pre = useMemo(() => getPreExecutionStateForSession(sessionId), [sessionId, sessionResultsVersion]);
  const snapshot = pre.snapshot;
  const isActive = pre.isSnapshotActive;
  const launchReadiness = pre.launchReadiness;
  const isHandoffPrepared = pre.isHandoffPreparedActive;
  const handoffPrepared = pre.handoffPrepared;
  const snapshotStaleness = pre.snapshotStaleness;
  const handoffValidity = pre.handoffValidity;
  const executionRequestDraft = pre.executionRequestDraft;
  const executionRequestApproval = pre.executionRequestApproval;
  const isDraftApproved = pre.isExecutionDraftApproved;
  const businessExecutionRequest = pre.businessExecutionRequest;
  const isBusinessRequestForSnapshot = pre.isBusinessExecutionRequestForCurrentSnapshot;
  const nextAction = useMemo(
    () =>
      getPreLaunchActionAvailability({
        active: pre.active,
        snapshot: snapshot,
        launchReadiness,
      }),
    [pre.active, snapshot, launchReadiness]
  );

  const openTasks = () => {
    const qs = new URLSearchParams();
    if (requirementId) qs.set("requirementId", requirementId);
    if (sessionId) qs.set("sessionId", sessionId);
    const suffix = qs.toString() ? `?${qs.toString()}` : "";
    router.push(`/tasks${suffix}`);
  };

  return (
    <div>
      <WorkflowPageHeader
        title="Execution"
        subtitle="Pre-execution visibility only (no launch here)"
        backHref="/workspace"
        backLabel="Back to workspace"
      />

      <div style={{ marginTop: 14, display: "grid", gap: 14 }}>
        <WorkflowCard padding={12}>
          <div style={{ fontSize: 13, fontWeight: 900, marginBottom: 8 }}>Prepared execution input</div>

          {!sessionId ? (
            <WorkflowEmptyState
              title="No session selected"
              message="Add ?sessionId= (and optionally ?requirementId=) to view a prepared snapshot for a specific session."
            />
          ) : snapshot ? (
            <div style={{ display: "grid", gap: 8 }}>
              <div style={{ fontSize: 12, color: "#6b7280" }}>
                Snapshot exists for this session. Execution is not started; this is a read-only pre-execution input source.
              </div>
              <div style={{ fontSize: 12, color: "#6b7280" }}>
                Active input:{" "}
                {isActive ? (
                  <span style={{ fontWeight: 900, color: "#166534" }}>Selected</span>
                ) : pre.active ? (
                  <span style={{ fontFamily: "ui-monospace, monospace" }}>
                    {pre.active.sessionId} / {pre.active.snapshotId}
                  </span>
                ) : (
                  <span>(none)</span>
                )}
              </div>
              <div style={{ fontSize: 13, color: "#111827", lineHeight: 1.55 }}>
                <span style={{ fontWeight: 900 }}>{snapshot.summary.candidateCount}</span> candidates • snapshot{" "}
                <span style={{ fontFamily: "ui-monospace, monospace" }}>{snapshot.snapshotId}</span>
              </div>
              <div style={{ fontSize: 12, color: "#6b7280" }}>
                sessionId: <span style={{ fontFamily: "ui-monospace, monospace" }}>{snapshot.sessionId}</span> • requirementId:{" "}
                <span style={{ fontFamily: "ui-monospace, monospace" }}>{snapshot.requirementId ?? "(none)"}</span> • preparedAt:{" "}
                <span style={{ fontFamily: "ui-monospace, monospace" }}>{snapshot.preparedAtIso}</span>
              </div>
              <div style={{ display: "flex", gap: 8, flexWrap: "wrap" }}>
                <WorkflowActionButton
                  label={isActive ? "Active input selected" : "Select as active input"}
                  variant="primary"
                  onClick={() => setActiveExecutionInput({ sessionId: snapshot.sessionId, snapshotId: snapshot.snapshotId })}
                  disabled={isActive}
                />
              </div>
            </div>
          ) : (
            <div style={{ display: "grid", gap: 10 }}>
              <div style={{ fontSize: 12, color: "#6b7280", lineHeight: 1.5 }}>
                No prepared execution snapshot for this session yet. Prepare it in the Tasks workspace first.
              </div>
              <div style={{ display: "flex", gap: 8, flexWrap: "wrap" }}>
                <WorkflowActionButton label="Open Tasks workspace" variant="primary" onClick={openTasks} />
              </div>
            </div>
          )}

          {sessionId ? (
            <div style={{ display: "flex", gap: 8, flexWrap: "wrap", marginTop: 12 }}>
              <WorkflowActionButton label="Open Tasks workspace" onClick={openTasks} />
            </div>
          ) : null}
        </WorkflowCard>

        <WorkflowCard padding={12}>
          <div style={{ fontSize: 13, fontWeight: 900, marginBottom: 8 }}>Launch readiness</div>
          <div style={{ fontSize: 12, color: "#6b7280", lineHeight: 1.5 }}>
            This is a pre-launch validation checkpoint for the active prepared input. No execution is triggered here.
          </div>
          <div style={{ marginTop: 10, display: "grid", gap: 8 }}>
            <div style={{ fontSize: 13, color: "#111827" }}>
              Status:{" "}
              {launchReadiness.isLaunchReady ? (
                <span style={{ fontWeight: 900, color: "#166534" }}>Ready</span>
              ) : (
                <span style={{ fontWeight: 900, color: "#b45309" }}>Not ready</span>
              )}
            </div>

            {!launchReadiness.isLaunchReady ? (
              <div style={{ fontSize: 12, color: "#6b7280", lineHeight: 1.5 }}>
                {launchReadiness.reasons.map((r) => (
                  <div key={r}>- {r}</div>
                ))}
              </div>
            ) : null}

            {launchReadiness.warnings.length > 0 ? (
              <div style={{ fontSize: 12, color: "#6b7280", lineHeight: 1.5 }}>
                <div style={{ fontWeight: 900, marginBottom: 4 }}>Warnings</div>
                {launchReadiness.warnings.map((w) => (
                  <div key={w}>- {w}</div>
                ))}
              </div>
            ) : null}

            {!launchReadiness.isLaunchReady ? (
              <div style={{ display: "flex", gap: 8, flexWrap: "wrap" }}>
                <WorkflowActionButton label="Open Tasks workspace" variant="primary" onClick={openTasks} />
              </div>
            ) : null}
          </div>
        </WorkflowCard>

        <WorkflowCard padding={12}>
          <div style={{ fontSize: 13, fontWeight: 900, marginBottom: 8 }}>Next action</div>
          <div style={{ fontSize: 12, color: "#6b7280", lineHeight: 1.5 }}>
            Shows the next possible execution step based on the current active input. This is a placeholder only; nothing launches here.
          </div>

          <div style={{ marginTop: 10, display: "grid", gap: 8 }}>
            {isHandoffPrepared && handoffPrepared ? (
              <div style={{ fontSize: 12, color: "#6b7280", lineHeight: 1.5 }}>
                <span style={{ fontWeight: 900, color: "#166534" }}>Handoff prepared</span> • preparedAt{" "}
                <span style={{ fontFamily: "ui-monospace, monospace" }}>{handoffPrepared.preparedAtIso}</span> • snapshot{" "}
                <span style={{ fontFamily: "ui-monospace, monospace" }}>{handoffPrepared.snapshotId}</span>
              </div>
            ) : null}

            {snapshot ? (
              <div style={{ fontSize: 12, color: "#6b7280", lineHeight: 1.5 }}>
                Snapshot:{" "}
                {snapshotStaleness.isSnapshotStale ? (
                  <span style={{ fontWeight: 900, color: "#b45309" }}>Stale</span>
                ) : (
                  <span style={{ fontWeight: 900, color: "#166534" }}>Current</span>
                )}
                {snapshotStaleness.isSnapshotStale && snapshotStaleness.staleReason ? ` • ${snapshotStaleness.staleReason}` : ""}
              </div>
            ) : null}

            {isHandoffPrepared ? (
              <div style={{ fontSize: 12, color: "#6b7280", lineHeight: 1.5 }}>
                Handoff validity:{" "}
                {handoffValidity.isHandoffValid ? (
                  <span style={{ fontWeight: 900, color: "#166534" }}>Valid</span>
                ) : (
                  <span style={{ fontWeight: 900, color: "#b45309" }}>Invalid</span>
                )}
                {!handoffValidity.isHandoffValid && handoffValidity.invalidReason ? ` • ${handoffValidity.invalidReason}` : ""}
              </div>
            ) : null}
            <div style={{ fontSize: 13, color: "#111827" }}>
              State:{" "}
              {nextAction.canPrepareLaunchAction ? (
                <span style={{ fontWeight: 900, color: "#166534" }}>Ready for handoff</span>
              ) : (
                <span style={{ fontWeight: 900, color: "#6b7280" }}>Unavailable</span>
              )}
            </div>

            {nextAction.actionReason ? (
              <div style={{ fontSize: 12, color: "#6b7280", lineHeight: 1.5 }}>{nextAction.actionReason}</div>
            ) : null}

            <div style={{ display: "flex", gap: 8, flexWrap: "wrap" }}>
              <WorkflowActionButton
                label={isHandoffPrepared ? "Handoff prepared" : nextAction.actionLabel}
                variant="primary"
                disabled={!nextAction.canPrepareLaunchAction || isHandoffPrepared}
                onClick={() => {
                  if (!nextAction.canPrepareLaunchAction) return;
                  if (!pre.active) return;
                  recordSessionHandoffPrepared(pre.active.sessionId, {
                    sessionId: pre.active.sessionId,
                    snapshotId: pre.active.snapshotId,
                    preparedAtIso: new Date().toISOString(),
                    status: "prepared",
                  });
                }}
              />
              {!nextAction.canPrepareLaunchAction || snapshotStaleness.isSnapshotStale || (isHandoffPrepared && !handoffValidity.isHandoffValid) ? (
                <WorkflowActionButton label="Open Tasks workspace" onClick={openTasks} />
              ) : null}
            </div>
          </div>
        </WorkflowCard>

        <WorkflowCard padding={12}>
          <div style={{ fontSize: 13, fontWeight: 900, marginBottom: 8 }}>Execution request draft</div>
          <div style={{ fontSize: 12, color: "#6b7280", lineHeight: 1.5 }}>
            Draft is a structured request payload for a later stage. Creating a draft does not start execution.
          </div>

          <div style={{ marginTop: 10, display: "grid", gap: 8 }}>
            {executionRequestDraft ? (
              <div style={{ border: "1px solid #e5e7eb", borderRadius: 10, padding: 10, background: "#fafafa" }}>
                <div style={{ fontSize: 13, fontWeight: 900, color: "#111827" }}>Draft prepared</div>
                <div style={{ fontSize: 12, color: "#6b7280", marginTop: 6, lineHeight: 1.5 }}>
                  status <span style={{ fontWeight: 900 }}>draft</span> • request{" "}
                  <span style={{ fontFamily: "ui-monospace, monospace" }}>{executionRequestDraft.requestId}</span>
                </div>
                <div style={{ fontSize: 12, color: "#6b7280", marginTop: 6, lineHeight: 1.5 }}>
                  snapshot <span style={{ fontFamily: "ui-monospace, monospace" }}>{executionRequestDraft.snapshotId}</span> • candidates{" "}
                  <span style={{ fontWeight: 900 }}>{executionRequestDraft.readyTaskIds.length}</span> • created{" "}
                  <span style={{ fontFamily: "ui-monospace, monospace" }}>{executionRequestDraft.createdAtIso}</span>
                </div>
              </div>
            ) : (
              <div style={{ fontSize: 12, color: "#6b7280", lineHeight: 1.5 }}>No draft prepared yet.</div>
            )}

            <div style={{ display: "flex", gap: 8, flexWrap: "wrap" }}>
              <WorkflowActionButton
                label="Create execution draft"
                variant="primary"
                disabled={!handoffValidity.isHandoffValid || !isHandoffPrepared || !snapshot || Boolean(executionRequestDraft)}
                onClick={() => {
                  if (!snapshot) return;
                  if (!isHandoffPrepared) return;
                  if (!handoffValidity.isHandoffValid) return;
                  recordSessionExecutionRequestDraft(snapshot.sessionId, createExecutionRequestDraft({ snapshot }));
                }}
              />
              {!handoffValidity.isHandoffValid ? (
                <WorkflowActionButton label="Open Tasks workspace" onClick={openTasks} />
              ) : null}
            </div>
          </div>
        </WorkflowCard>

        <WorkflowCard padding={12}>
          <div style={{ fontSize: 13, fontWeight: 900, marginBottom: 8 }}>Final pre-launch checkpoint</div>
          <div style={{ fontSize: 12, color: "#6b7280", lineHeight: 1.5 }}>
            Approval is a local pre-execution checkpoint for the current execution draft. It does not start execution.
          </div>

          <div style={{ marginTop: 10, display: "grid", gap: 8 }}>
            {isDraftApproved && executionRequestApproval ? (
              <div style={{ border: "1px solid #bbf7d0", borderRadius: 10, padding: 10, background: "#f0fdf4" }}>
                <div style={{ fontSize: 13, fontWeight: 900, color: "#166534" }}>Approved for future launch</div>
                <div style={{ fontSize: 12, color: "#15803d", marginTop: 6, lineHeight: 1.5 }}>
                  request <span style={{ fontFamily: "ui-monospace, monospace" }}>{executionRequestApproval.requestId}</span> • approved{" "}
                  <span style={{ fontFamily: "ui-monospace, monospace" }}>{executionRequestApproval.approvedAtIso}</span>
                </div>
              </div>
            ) : (
              <div style={{ fontSize: 12, color: "#6b7280", lineHeight: 1.5 }}>Not approved yet.</div>
            )}

            <div style={{ display: "flex", gap: 8, flexWrap: "wrap" }}>
              <WorkflowActionButton
                label={isDraftApproved ? "Approved" : "Approve for launch"}
                variant="primary"
                disabled={!executionRequestDraft || !handoffValidity.isHandoffValid || isDraftApproved}
                onClick={() => {
                  if (!executionRequestDraft) return;
                  if (!handoffValidity.isHandoffValid) return;
                  const approval = approveExecutionRequestDraft({ draft: executionRequestDraft, approvedBy: "local" });
                  recordSessionExecutionRequestApproval(executionRequestDraft.sessionId, approval);
                }}
              />
              {!executionRequestDraft || !handoffValidity.isHandoffValid ? (
                <WorkflowActionButton label="Open Tasks workspace" onClick={openTasks} />
              ) : null}
            </div>
          </div>
        </WorkflowCard>

        <WorkflowCard padding={12}>
          <div style={{ fontSize: 13, fontWeight: 900, marginBottom: 8 }}>Business execution request</div>
          <div style={{ fontSize: 12, color: "#6b7280", lineHeight: 1.5 }}>
            This creates a business-side execution request artifact (not Stage1/Stage2). It does not launch execution.
          </div>

          <div style={{ marginTop: 10, display: "grid", gap: 8 }}>
            {businessExecutionRequest ? (
              <div style={{ border: "1px solid #e5e7eb", borderRadius: 10, padding: 10, background: "#fafafa" }}>
                <div style={{ fontSize: 13, fontWeight: 900, color: "#111827" }}>Request prepared</div>
                <div style={{ fontSize: 12, color: "#6b7280", marginTop: 6, lineHeight: 1.5 }}>
                  status <span style={{ fontWeight: 900 }}>requested</span> • request{" "}
                  <span style={{ fontFamily: "ui-monospace, monospace" }}>{businessExecutionRequest.requestId}</span>
                </div>
                <div style={{ fontSize: 12, color: "#6b7280", marginTop: 6, lineHeight: 1.5 }}>
                  snapshot <span style={{ fontFamily: "ui-monospace, monospace" }}>{businessExecutionRequest.snapshotId}</span> • candidates{" "}
                  <span style={{ fontWeight: 900 }}>{businessExecutionRequest.candidateTaskIds.length}</span> • created{" "}
                  <span style={{ fontFamily: "ui-monospace, monospace" }}>{businessExecutionRequest.createdAtIso}</span>
                </div>
                {!isBusinessRequestForSnapshot ? (
                  <div style={{ fontSize: 12, color: "#b45309", marginTop: 6, lineHeight: 1.5 }}>
                    Note: this request was created for a different snapshot.
                  </div>
                ) : null}
              </div>
            ) : (
              <div style={{ fontSize: 12, color: "#6b7280", lineHeight: 1.5 }}>No business execution request yet.</div>
            )}

            <div style={{ display: "flex", gap: 8, flexWrap: "wrap" }}>
              <WorkflowActionButton
                label="Create execution request"
                variant="primary"
                disabled={!snapshot || !handoffValidity.isHandoffValid || !isDraftApproved || !isHandoffPrepared || Boolean(businessExecutionRequest)}
                onClick={() => {
                  if (!snapshot) return;
                  if (!isHandoffPrepared) return;
                  if (!handoffValidity.isHandoffValid) return;
                  if (!isDraftApproved) return;
                  recordSessionBusinessExecutionRequest(snapshot.sessionId, createBusinessExecutionRequest({ snapshot }));
                }}
              />
              {!snapshot || !handoffValidity.isHandoffValid || !isDraftApproved ? (
                <WorkflowActionButton label="Open Tasks workspace" onClick={openTasks} />
              ) : null}
            </div>
          </div>
        </WorkflowCard>
      </div>
    </div>
  );
}

