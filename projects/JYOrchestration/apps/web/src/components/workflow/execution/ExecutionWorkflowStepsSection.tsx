import { WorkflowActionButton } from "@/components/workflow/primitives/WorkflowActionButton";
import { WorkflowCard } from "@/components/workflow/primitives/WorkflowCard";
import {
  EXECUTION_EXECUTOR_TYPES,
  EXECUTOR_TYPE_LABELS,
  actualExecutionAdapterExecutorHintPreview,
  actualExecutionAdapterPayloadSummary,
  actualLaunchCommandExecutorHintPreview,
  actualLaunchCommandPayloadSummary,
  executorLaunchContractContextSummary,
  executorLaunchHintsPreview,
  executorIntakePreviewLine,
  truncateWorkOrderPreview,
} from "@/lib/workflow/collaborationSessionResultStore";
import type { ExecutionPageActionState, PreExecutionSessionSelector } from "@/lib/workflow/businessExecutionSelectors";
import type { ExecutionPageContentActions } from "./executionPageTypes";

export type ExecutionWorkflowStepsSectionProps = {
  sessionId: string | null;
  pre: PreExecutionSessionSelector;
  actions: ExecutionPageActionState;
  pageActions: ExecutionPageContentActions;
};

export function ExecutionWorkflowStepsSection(props: ExecutionWorkflowStepsSectionProps) {
  const { sessionId, pre, actions, pageActions } = props;

  const snapshot = pre.snapshot;
  const isHandoffPrepared = pre.isHandoffPreparedActive;
  const handoffValidity = pre.handoffValidity;

  const executionRequestDraft = pre.executionRequestDraft;
  const executionRequestApproval = pre.executionRequestApproval;
  const isDraftApproved = pre.isExecutionDraftApproved;

  const businessExecutionRequest = pre.businessExecutionRequest;
  const bizReqValidity = pre.businessExecutionRequestValidity;
  const businessExecutionApproval = pre.businessExecutionApproval;
  const isBusinessExecutionApproved = pre.isBusinessExecutionApproved;
  const businessExecutionPackage = pre.businessExecutionPackage;
  const isBusinessExecutionPackaged = pre.isBusinessExecutionPackaged;
  const executionAssignment = pre.executionAssignment;
  const isExecutionPackageAssigned = pre.isExecutionPackageAssigned;

  const executionAssignmentHandoffPayload = pre.executionAssignmentHandoffPayload;
  const isExecutionAssignmentHandoffCurrent = pre.isExecutionAssignmentHandoffCurrent;
  const executorIntakeContract = pre.executorIntakeContract;
  const isExecutorIntakeContractCurrent = pre.isExecutorIntakeContractCurrent;
  const executorWorkOrder = pre.executorWorkOrder;
  const isExecutorWorkOrderCurrent = pre.isExecutorWorkOrderCurrent;
  const executionReadiness = pre.executionReadiness;

  const isBusinessLaunchIntentCurrent = pre.isBusinessLaunchIntentCurrent;
  const isBusinessLaunchHandoffRecordCurrent = pre.isBusinessLaunchHandoffRecordCurrent;
  const isExecutionBridgePayloadCurrent = pre.isExecutionBridgePayloadCurrent;
  const executorLaunchContract = pre.executorLaunchContract;
  const isExecutorLaunchContractCurrent = pre.isExecutorLaunchContractCurrent;
  const isExecutionTriggerIntentCurrent = pre.isExecutionTriggerIntentCurrent;
  const actualExecutionAdapterRequest = pre.actualExecutionAdapterRequest;
  const isActualExecutionAdapterRequestCurrent = pre.isActualExecutionAdapterRequestCurrent;
  const actualLaunchCommand = pre.actualLaunchCommand;
  const isActualLaunchCommandCurrent = pre.isActualLaunchCommandCurrent;

  return (
    <div style={{ display: "grid", gap: 10 }}>
      <div style={{ fontSize: 12, fontWeight: 900, color: "#111827" }}>워크플로 단계</div>

      <details open style={{ border: "1px solid #e5e7eb", borderRadius: 12, padding: 10, background: "#ffffff" }}>
        <summary style={{ cursor: "pointer", fontSize: 13, fontWeight: 900, color: "#111827" }}>실행 요청</summary>
        <div style={{ marginTop: 10, display: "grid", gap: 14 }}>
          {/* Draft */}
          <WorkflowCard padding={12}>
            <div style={{ fontSize: 13, fontWeight: 900, marginBottom: 8 }}>실행 요청 초안</div>
            <div style={{ fontSize: 12, color: "#6b7280", lineHeight: 1.5 }}>
              초안은 구조화된 요청 페이로드입니다. 초안 작성은 실행을 시작하지 않습니다.
            </div>
            <div style={{ marginTop: 10, display: "grid", gap: 8 }}>
              {executionRequestDraft ? (
                <div style={{ border: "1px solid #e5e7eb", borderRadius: 10, padding: 10, background: "#fafafa" }}>
                  <div style={{ fontSize: 13, fontWeight: 900, color: "#111827" }}>초안 준비됨</div>
                  <div style={{ fontSize: 12, color: "#6b7280", marginTop: 6, lineHeight: 1.5 }}>
                    상태 <span style={{ fontWeight: 900 }}>draft</span> · 요청{" "}
                    <span style={{ fontFamily: "ui-monospace, monospace" }}>{executionRequestDraft.requestId}</span>
                  </div>
                  <div style={{ fontSize: 12, color: "#6b7280", marginTop: 6, lineHeight: 1.5 }}>
                    스냅샷 <span style={{ fontFamily: "ui-monospace, monospace" }}>{executionRequestDraft.snapshotId}</span> · 후보{" "}
                    <span style={{ fontWeight: 900 }}>{executionRequestDraft.readyTaskIds.length}</span> · 생성{" "}
                    <span style={{ fontFamily: "ui-monospace, monospace" }}>{executionRequestDraft.createdAtIso}</span>
                  </div>
                </div>
              ) : (
                <div style={{ fontSize: 12, color: "#6b7280", lineHeight: 1.5 }}>아직 준비된 초안이 없습니다.</div>
              )}
              <div style={{ display: "flex", gap: 8, flexWrap: "wrap" }}>
                <WorkflowActionButton
                  label="실행 초안 만들기"
                  variant="primary"
                  disabled={!handoffValidity.isHandoffValid || !isHandoffPrepared || !snapshot || Boolean(executionRequestDraft)}
                  onClick={pageActions.createExecutionRequestDraft}
                />
                {!handoffValidity.isHandoffValid ? (
                  <WorkflowActionButton label="작업 화면 열기" onClick={pageActions.openTasks} />
                ) : null}
              </div>
            </div>
          </WorkflowCard>

          {/* Draft approval */}
          <WorkflowCard padding={12}>
            <div style={{ fontSize: 13, fontWeight: 900, marginBottom: 8 }}>실행 직전 최종 체크포인트</div>
            <div style={{ fontSize: 12, color: "#6b7280", lineHeight: 1.5 }}>
              승인은 현재 실행 초안에 대한 로컬 체크포인트입니다. 실행을 시작하지 않습니다.
            </div>
            <div style={{ marginTop: 10, display: "grid", gap: 8 }}>
              {isDraftApproved && executionRequestApproval ? (
                <div style={{ border: "1px solid #bbf7d0", borderRadius: 10, padding: 10, background: "#f0fdf4" }}>
                  <div style={{ fontSize: 13, fontWeight: 900, color: "#166534" }}>향후 실행을 위해 승인됨</div>
                  <div style={{ fontSize: 12, color: "#15803d", marginTop: 6, lineHeight: 1.5 }}>
                    요청 <span style={{ fontFamily: "ui-monospace, monospace" }}>{executionRequestApproval.requestId}</span> · 승인{" "}
                    <span style={{ fontFamily: "ui-monospace, monospace" }}>{executionRequestApproval.approvedAtIso}</span>
                  </div>
                </div>
              ) : (
                <div style={{ fontSize: 12, color: "#6b7280", lineHeight: 1.5 }}>아직 승인되지 않았습니다.</div>
              )}
              <div style={{ display: "flex", gap: 8, flexWrap: "wrap" }}>
                <WorkflowActionButton
                  label={isDraftApproved ? "승인됨" : "실행을 위해 승인"}
                  variant="primary"
                  disabled={!executionRequestDraft || !handoffValidity.isHandoffValid || isDraftApproved}
                  onClick={pageActions.approveExecutionDraft}
                />
                {!executionRequestDraft || !handoffValidity.isHandoffValid ? (
                  <WorkflowActionButton label="작업 화면 열기" onClick={pageActions.openTasks} />
                ) : null}
              </div>
            </div>
          </WorkflowCard>

          {/* Business request */}
          <WorkflowCard padding={12}>
            <div style={{ fontSize: 13, fontWeight: 900, marginBottom: 8 }}>비즈니스 실행 요청</div>
            <div style={{ fontSize: 12, color: "#6b7280", lineHeight: 1.5 }}>
              비즈니스 측 요청만 해당합니다(저장소·PR 환경 실행 제외). 생명주기는 현재 스냅샷과 작업 집합에서 계산됩니다.
            </div>
            <div style={{ marginTop: 10, display: "grid", gap: 8 }}>
              {businessExecutionRequest && bizReqValidity ? (
                <div style={{ border: "1px solid #e5e7eb", borderRadius: 10, padding: 10, background: "#fafafa" }}>
                  <div style={{ fontSize: 13, fontWeight: 900, color: "#111827" }}>요청된 작업 패키지</div>
                  <div style={{ fontSize: 12, color: "#6b7280", marginTop: 6, lineHeight: 1.5 }}>
                    요청 상태:{" "}
                    {bizReqValidity.status === "requested" ? (
                      <span style={{ fontWeight: 900, color: "#166534" }}>요청됨</span>
                    ) : bizReqValidity.status === "stale" ? (
                      <span style={{ fontWeight: 900, color: "#b45309" }}>오래됨</span>
                    ) : (
                      <span style={{ fontWeight: 900, color: "#b45309" }}>무효</span>
                    )}{" "}
                    · id <span style={{ fontFamily: "ui-monospace, monospace" }}>{businessExecutionRequest.requestId}</span>
                  </div>
                  <div style={{ fontSize: 12, color: "#6b7280", marginTop: 6, lineHeight: 1.5 }}>
                    세션 <span style={{ fontFamily: "ui-monospace, monospace" }}>{businessExecutionRequest.sessionId}</span> · 스냅샷{" "}
                    <span style={{ fontFamily: "ui-monospace, monospace" }}>{businessExecutionRequest.snapshotId}</span> · 후보{" "}
                    <span style={{ fontWeight: 900 }}>{businessExecutionRequest.candidateTaskIds.length}</span> · 생성{" "}
                    <span style={{ fontFamily: "ui-monospace, monospace" }}>{businessExecutionRequest.createdAtIso}</span>
                  </div>
                  {bizReqValidity.status === "stale" && bizReqValidity.staleReason ? (
                    <div style={{ fontSize: 12, color: "#b45309", marginTop: 6, lineHeight: 1.5 }}>{bizReqValidity.staleReason}</div>
                  ) : null}
                  {bizReqValidity.status === "invalid" && bizReqValidity.invalidReason ? (
                    <div style={{ fontSize: 12, color: "#b45309", marginTop: 6, lineHeight: 1.5 }}>{bizReqValidity.invalidReason}</div>
                  ) : null}
                  {actions.businessRequestNeedsAttention ? (
                    <div style={{ fontSize: 12, color: "#6b7280", marginTop: 6, lineHeight: 1.5 }}>
                      필요하면 /tasks에서 스냅샷을 다시 준비한 뒤 요청 다시 만들기를 사용하세요.
                    </div>
                  ) : null}
                </div>
              ) : (
                <div style={{ fontSize: 12, color: "#6b7280", lineHeight: 1.5 }}>아직 비즈니스 실행 요청이 없습니다.</div>
              )}
              <div style={{ display: "flex", gap: 8, flexWrap: "wrap" }}>
                {!businessExecutionRequest ? (
                  <WorkflowActionButton
                    label="실행 요청 작성"
                    variant="primary"
                    disabled={!actions.canRecordBusinessRequest}
                    onClick={pageActions.recordBusinessExecutionRequest}
                  />
                ) : null}
                {businessExecutionRequest && actions.businessRequestNeedsAttention ? (
                  <WorkflowActionButton
                    label="요청 다시 만들기"
                    variant="primary"
                    disabled={!actions.canRecordBusinessRequest}
                    onClick={pageActions.recordBusinessExecutionRequest}
                  />
                ) : null}
                {!actions.canRecordBusinessRequest || actions.businessRequestNeedsAttention ? (
                  <WorkflowActionButton label="작업 화면 열기" onClick={pageActions.openTasks} />
                ) : null}
              </div>
            </div>
          </WorkflowCard>

          {/* Business approval */}
          <WorkflowCard padding={12}>
            <div style={{ fontSize: 13, fontWeight: 900, marginBottom: 8 }}>비즈니스 실행 승인</div>
            <div style={{ fontSize: 12, color: "#6b7280", lineHeight: 1.5 }}>
              현재 비즈니스 실행 요청을 추적용으로만 확정합니다. 저장소·PR 환경 실행은 이 단계에서 시작하지 않습니다.
            </div>
            <div style={{ marginTop: 10, display: "grid", gap: 8 }}>
              {!sessionId ? (
                <div style={{ fontSize: 12, color: "#6b7280", lineHeight: 1.5 }}>승인을 관리하려면 세션을 선택하세요.</div>
              ) : !businessExecutionRequest || !bizReqValidity ? (
                <div style={{ fontSize: 12, color: "#6b7280", lineHeight: 1.5 }}>아직 비즈니스 실행 요청이 없습니다.</div>
              ) : !actions.businessRequestValid ? (
                <div style={{ fontSize: 12, color: "#6b7280", lineHeight: 1.5 }}>
                  요청이{" "}
                  <span style={{ fontWeight: 900, color: "#b45309" }}>{bizReqValidity.status === "stale" ? "오래됨" : "무효"}</span>
                  이면 승인할 수 없습니다.
                </div>
              ) : null}

              {actions.hasOrphanBusinessApproval ? (
                <div style={{ fontSize: 12, color: "#6b7280", lineHeight: 1.5 }}>
                  다른 요청 스냅샷에 대한 이전 승인이 있어 현재 요청에는 적용되지 않습니다.
                </div>
              ) : null}

              {isBusinessExecutionApproved && businessExecutionApproval ? (
                <div style={{ border: "1px solid #bbf7d0", borderRadius: 10, padding: 10, background: "#f0fdf4" }}>
                  <div style={{ fontSize: 13, fontWeight: 900, color: "#166534" }}>비즈니스 실행을 위해 승인됨</div>
                  <div style={{ fontSize: 12, color: "#15803d", marginTop: 6, lineHeight: 1.5 }}>
                    상태 <span style={{ fontWeight: 900 }}>approved</span> · 요청{" "}
                    <span style={{ fontFamily: "ui-monospace, monospace" }}>{businessExecutionApproval.requestId}</span>
                  </div>
                  <div style={{ fontSize: 12, color: "#15803d", marginTop: 4, lineHeight: 1.5 }}>
                    승인 시각 <span style={{ fontFamily: "ui-monospace, monospace" }}>{businessExecutionApproval.approvedAtIso}</span> · 세션{" "}
                    <span style={{ fontFamily: "ui-monospace, monospace" }}>{businessExecutionApproval.sessionId}</span> • snapshot{" "}
                    <span style={{ fontFamily: "ui-monospace, monospace" }}>{businessExecutionApproval.snapshotId}</span>
                  </div>
                </div>
              ) : sessionId && businessExecutionRequest && actions.businessRequestValid ? (
                <div style={{ fontSize: 12, color: "#6b7280", lineHeight: 1.5 }}>아직 확정되지 않았습니다.</div>
              ) : null}

              <div style={{ display: "flex", gap: 8, flexWrap: "wrap" }}>
                <WorkflowActionButton
                  label={isBusinessExecutionApproved ? "승인됨" : "실행 요청 승인"}
                  variant="primary"
                  disabled={!sessionId || !actions.canApproveBusinessExecution}
                  onClick={pageActions.approveBusinessExecution}
                />
                {sessionId && (!businessExecutionRequest || !actions.businessRequestValid) ? (
                  <WorkflowActionButton label="작업 화면 열기" onClick={pageActions.openTasks} />
                ) : null}
              </div>
            </div>
          </WorkflowCard>
        </div>
      </details>

      <details style={{ border: "1px solid #e5e7eb", borderRadius: 12, padding: 10, background: "#ffffff" }}>
        <summary style={{ cursor: "pointer", fontSize: 13, fontWeight: 900, color: "#111827" }}>패키지·배정</summary>
        <div style={{ marginTop: 10, display: "grid", gap: 14 }}>
          <WorkflowCard padding={12}>
            <div style={{ fontSize: 13, fontWeight: 900, marginBottom: 8 }}>비즈니스 실행 패키지</div>
            <div style={{ fontSize: 12, color: "#6b7280", lineHeight: 1.5 }}>
              승인된 실행 요청을 안정적인 작업 패키지로 묶습니다. 저장소·PR 환경 실행은 이 단계에서 시작하지 않습니다.
            </div>
            <div style={{ marginTop: 10, display: "grid", gap: 8 }}>
              {!sessionId ? (
                <div style={{ fontSize: 12, color: "#6b7280", lineHeight: 1.5 }}>실행 패키지를 관리하려면 세션을 선택하세요.</div>
              ) : !isBusinessExecutionApproved ? (
                <div style={{ fontSize: 12, color: "#6b7280", lineHeight: 1.5 }}>
                  요청이 <span style={{ fontWeight: 900 }}>승인</span>되어야 패키징할 수 있습니다.
                </div>
              ) : null}
              {actions.hasNonCurrentPackage ? (
                <div style={{ fontSize: 12, color: "#6b7280", lineHeight: 1.5 }}>
                  저장된 패키지가 현재 승인된 요청과 일치하지 않습니다. 다시 준비해 교체하세요(최신만).
                </div>
              ) : null}
              {isBusinessExecutionPackaged && businessExecutionPackage ? (
                <div style={{ border: "1px solid #bfdbfe", borderRadius: 10, padding: 10, background: "#eff6ff" }}>
                  <div style={{ fontSize: 13, fontWeight: 900, color: "#1e40af" }}>실행 패키지 준비됨</div>
                  <div style={{ fontSize: 12, color: "#1d4ed8", marginTop: 6, lineHeight: 1.5 }}>
                    상태 <span style={{ fontWeight: 900 }}>packaged</span> · 패키지{" "}
                    <span style={{ fontFamily: "ui-monospace, monospace" }}>{businessExecutionPackage.packageId}</span>
                  </div>
                  <div style={{ fontSize: 12, color: "#1d4ed8", marginTop: 4, lineHeight: 1.5 }}>
                    세션 <span style={{ fontFamily: "ui-monospace, monospace" }}>{businessExecutionPackage.sessionId}</span> · 스냅샷{" "}
                    <span style={{ fontFamily: "ui-monospace, monospace" }}>{businessExecutionPackage.snapshotId}</span> · 후보{" "}
                    <span style={{ fontWeight: 900 }}>{businessExecutionPackage.candidateTaskIds.length}</span> · 생성{" "}
                    <span style={{ fontFamily: "ui-monospace, monospace" }}>{businessExecutionPackage.createdAtIso}</span>
                  </div>
                </div>
              ) : sessionId && isBusinessExecutionApproved ? (
                <div style={{ fontSize: 12, color: "#6b7280", lineHeight: 1.5 }}>아직 준비된 패키지가 없습니다.</div>
              ) : null}
              <div style={{ display: "flex", gap: 8, flexWrap: "wrap" }}>
                <WorkflowActionButton
                  label={isBusinessExecutionPackaged ? "패키징됨" : "실행 패키지 준비"}
                  variant="primary"
                  disabled={!sessionId || !actions.canCreateBusinessPackage}
                  onClick={pageActions.createBusinessExecutionPackage}
                />
                {sessionId && !isBusinessExecutionApproved ? (
                  <WorkflowActionButton label="작업 화면 열기" onClick={pageActions.openTasks} />
                ) : null}
              </div>
            </div>
          </WorkflowCard>

          <WorkflowCard padding={12}>
            <div style={{ fontSize: 13, fontWeight: 900, marginBottom: 8 }}>실행 배정</div>
            <div style={{ fontSize: 12, color: "#6b7280", lineHeight: 1.5 }}>
              현재 패키지를 어떤 실행기 역할이 다룰지 기록합니다. 의도만이며 저장소·PR 환경 실행은 이 단계에서 시작하지 않습니다.
            </div>
            <div style={{ marginTop: 10, display: "grid", gap: 8 }}>
              {!sessionId ? (
                <div style={{ fontSize: 12, color: "#6b7280", lineHeight: 1.5 }}>실행기를 배정하려면 세션을 선택하세요.</div>
              ) : !isBusinessExecutionPackaged ? (
                <div style={{ fontSize: 12, color: "#6b7280", lineHeight: 1.5 }}>
                  <span style={{ fontWeight: 900 }}>실행 패키지</span>가 있어야 배정할 수 있습니다.
                </div>
              ) : null}
              {actions.hasNonCurrentAssignment ? (
                <div style={{ fontSize: 12, color: "#6b7280", lineHeight: 1.5 }}>
                  저장된 배정이 다른 패키지를 가리킵니다. 실행기를 다시 선택해 갱신하세요(최신만).
                </div>
              ) : null}
              {isExecutionPackageAssigned && executionAssignment ? (
                <div style={{ border: "1px solid #e9d5ff", borderRadius: 10, padding: 10, background: "#faf5ff" }}>
                  <div style={{ fontSize: 13, fontWeight: 900, color: "#6b21a8" }}>패키지 배정</div>
                  <div style={{ fontSize: 12, color: "#7c3aed", marginTop: 6, lineHeight: 1.5 }}>
                    상태 <span style={{ fontWeight: 900 }}>assigned</span> · 배정{" "}
                    <span style={{ fontFamily: "ui-monospace, monospace" }}>{executionAssignment.assignmentId}</span>
                  </div>
                  <div style={{ fontSize: 12, color: "#7c3aed", marginTop: 4, lineHeight: 1.5 }}>
                    실행기 <span style={{ fontWeight: 900 }}>{EXECUTOR_TYPE_LABELS[executionAssignment.executorType]}</span> (
                    <span style={{ fontFamily: "ui-monospace, monospace" }}>{executionAssignment.executorType}</span>)
                  </div>
                </div>
              ) : sessionId && isBusinessExecutionPackaged ? (
                <div style={{ fontSize: 12, color: "#6b7280", lineHeight: 1.5 }}>아직 실행기가 배정되지 않았습니다.</div>
              ) : null}
              <div style={{ fontSize: 12, color: "#6b7280", fontWeight: 800, marginTop: 4 }}>실행기 배정</div>
              <div style={{ display: "flex", gap: 8, flexWrap: "wrap" }}>
                {EXECUTION_EXECUTOR_TYPES.map((t) => (
                  <WorkflowActionButton
                    key={t}
                    label={EXECUTOR_TYPE_LABELS[t]}
                    variant={isExecutionPackageAssigned && executionAssignment?.executorType === t ? "primary" : undefined}
                    disabled={!sessionId || !actions.canAssignExecutor}
                    onClick={() => pageActions.assignExecutor(t)}
                  />
                ))}
              </div>
            </div>
          </WorkflowCard>
        </div>
      </details>

      <details open style={{ border: "1px solid #e5e7eb", borderRadius: 12, padding: 10, background: "#ffffff" }}>
        <summary style={{ cursor: "pointer", fontSize: 13, fontWeight: 900, color: "#111827" }}>실행 준비</summary>
        <div style={{ marginTop: 10, display: "grid", gap: 12 }}>
          <div style={{ fontSize: 12, color: "#6b7280", lineHeight: 1.45 }}>
            실행 명령까지의 인수를 하위 단계로 묶었습니다. 작업 중인 그룹을 펼치세요. 저장소·PR 환경 실행이 아닙니다.
          </div>

          <details style={{ border: "1px solid #e8e8ff", borderRadius: 10, padding: 8, background: "#fafbff" }}>
            <summary style={{ cursor: "pointer", fontSize: 12, fontWeight: 900, color: "#4338ca" }}>실행기 전달(인수 → 입력 → 작업 지시)</summary>
            <div style={{ marginTop: 10, display: "grid", gap: 10 }}>
              <WorkflowCard padding={10}>
                <div style={{ fontSize: 12, fontWeight: 900, marginBottom: 6 }}>실행기 인수 페이로드</div>
                <div style={{ fontSize: 11, color: "#6b7280", lineHeight: 1.45 }}>현재 배정에서 나온 안정 번들입니다. 저장소·PR 환경 실행은 이 단계에서 시작하지 않습니다.</div>
                <div style={{ marginTop: 8, display: "grid", gap: 6 }}>
                  {!sessionId ? (
                    <div style={{ fontSize: 12, color: "#6b7280", lineHeight: 1.5 }}>인수 페이로드를 준비하려면 세션을 선택하세요.</div>
                  ) : !isExecutionPackageAssigned ? (
                    <div style={{ fontSize: 12, color: "#6b7280", lineHeight: 1.5 }}>
                      현재 패키지에 유효한 <span style={{ fontWeight: 900 }}>실행기 배정</span>이 있어야 인수를 준비할 수 있습니다.
                    </div>
                  ) : null}
                  {actions.hasNonCurrentHandoffPayload ? (
                    <div style={{ fontSize: 12, color: "#6b7280", lineHeight: 1.5 }}>
                      저장된 인수 페이로드가 현재 배정과 일치하지 않습니다. 다시 준비하세요(최신만).
                    </div>
                  ) : null}
                  {isExecutionAssignmentHandoffCurrent && executionAssignmentHandoffPayload ? (
                    <div style={{ border: "1px solid #fed7aa", borderRadius: 10, padding: 8, background: "#fffbeb" }}>
                      <div style={{ fontSize: 12, fontWeight: 900, color: "#9a3412" }}>인수 준비됨</div>
                      <div style={{ fontSize: 11, color: "#c2410c", marginTop: 4, lineHeight: 1.45 }}>
                        상태 <span style={{ fontWeight: 900 }}>handoff_ready</span> · 인수{" "}
                        <span style={{ fontFamily: "ui-monospace, monospace" }}>{executionAssignmentHandoffPayload.handoffId}</span>
                      </div>
                    </div>
                  ) : sessionId && isExecutionPackageAssigned ? (
                    <div style={{ fontSize: 12, color: "#6b7280", lineHeight: 1.5 }}>이 배정에 대한 인수 페이로드가 아직 없습니다.</div>
                  ) : null}
                  <div style={{ display: "flex", gap: 8, flexWrap: "wrap" }}>
                    <WorkflowActionButton
                      label={isExecutionAssignmentHandoffCurrent ? "인수 준비됨" : "실행기 인수 준비"}
                      variant="primary"
                      disabled={!sessionId || !actions.canCreateHandoffPayload}
                      onClick={pageActions.prepareExecutorHandoffPayload}
                    />
                    {sessionId && !isExecutionPackageAssigned ? (
                      <WorkflowActionButton label="작업 화면 열기" onClick={pageActions.openTasks} />
                    ) : null}
                  </div>
                </div>
              </WorkflowCard>

              <WorkflowCard padding={10}>
                <div style={{ fontSize: 12, fontWeight: 900, marginBottom: 6 }}>실행기 입력 계약</div>
                <div style={{ fontSize: 11, color: "#6b7280", lineHeight: 1.45 }}>현재 인수에서 온 구조화된 입력입니다. 저장소·PR 환경 실행은 이 단계에서 시작하지 않습니다.</div>
                <div style={{ marginTop: 8, display: "grid", gap: 6 }}>
                  {!sessionId ? (
                    <div style={{ fontSize: 12, color: "#6b7280", lineHeight: 1.5 }}>입력 계약을 준비하려면 세션을 선택하세요.</div>
                  ) : !isExecutionAssignmentHandoffCurrent ? (
                    <div style={{ fontSize: 12, color: "#6b7280", lineHeight: 1.5 }}>
                      <span style={{ fontWeight: 900 }}>현재 인수 페이로드</span>가 있어야 입력 계약을 준비할 수 있습니다.
                    </div>
                  ) : null}
                  {actions.hasNonCurrentIntakeContract ? (
                    <div style={{ fontSize: 12, color: "#6b7280", lineHeight: 1.5 }}>
                      저장된 입력 계약이 현재 인수와 일치하지 않습니다. 다시 준비하세요(최신만).
                    </div>
                  ) : null}
                  {isExecutorIntakeContractCurrent && executorIntakeContract ? (
                    <div style={{ border: "1px solid #d1fae5", borderRadius: 10, padding: 8, background: "#ecfdf5" }}>
                      <div style={{ fontSize: 12, fontWeight: 900, color: "#065f46" }}>입력 준비됨</div>
                      <div style={{ fontSize: 11, color: "#047857", marginTop: 4, lineHeight: 1.45 }}>
                        입력 <span style={{ fontFamily: "ui-monospace, monospace" }}>{executorIntakeContract.intakeId}</span> ·{" "}
                        <span style={{ fontStyle: "italic" }}>{executorIntakePreviewLine(executorIntakeContract)}</span>
                      </div>
                    </div>
                  ) : sessionId && isExecutionAssignmentHandoffCurrent ? (
                    <div style={{ fontSize: 12, color: "#6b7280", lineHeight: 1.5 }}>아직 입력 계약이 없습니다.</div>
                  ) : null}
                  <WorkflowActionButton
                    label={isExecutorIntakeContractCurrent ? "입력 준비됨" : "실행기 입력 준비"}
                    variant="primary"
                    disabled={!sessionId || !actions.canCreateIntakeContract}
                    onClick={pageActions.prepareExecutorIntakeContract}
                  />
                </div>
              </WorkflowCard>

              <WorkflowCard padding={10}>
                <div style={{ fontSize: 12, fontWeight: 900, marginBottom: 6 }}>실행기 작업 지시</div>
                <div style={{ fontSize: 11, color: "#6b7280", lineHeight: 1.45 }}>현재 입력에 따른 지시입니다. 저장소·PR 환경 실행은 이 단계에서 시작하지 않습니다.</div>
                <div style={{ marginTop: 8, display: "grid", gap: 6 }}>
                  {!sessionId ? (
                    <div style={{ fontSize: 12, color: "#6b7280", lineHeight: 1.5 }}>작업 지시를 준비하려면 세션을 선택하세요.</div>
                  ) : !isExecutorIntakeContractCurrent ? (
                    <div style={{ fontSize: 12, color: "#6b7280", lineHeight: 1.5 }}>
                      <span style={{ fontWeight: 900 }}>현재 입력 계약</span>이 있어야 작업 지시를 준비할 수 있습니다.
                    </div>
                  ) : null}
                  {actions.hasNonCurrentWorkOrder ? (
                    <div style={{ fontSize: 12, color: "#6b7280", lineHeight: 1.5 }}>
                      저장된 작업 지시가 현재 입력과 일치하지 않습니다. 다시 준비하세요(최신만).
                    </div>
                  ) : null}
                  {isExecutorWorkOrderCurrent && executorWorkOrder ? (
                    <div style={{ border: "1px solid #e0e7ff", borderRadius: 10, padding: 8, background: "#eef2ff" }}>
                      <div style={{ fontSize: 12, fontWeight: 900, color: "#3730a3" }}>작업 지시 준비됨</div>
                      <div style={{ fontSize: 11, color: "#6366f1", marginTop: 4, lineHeight: 1.45 }}>
                        목표: {truncateWorkOrderPreview(executorWorkOrder.objective, 96)}
                      </div>
                      <div style={{ fontSize: 11, color: "#6366f1", marginTop: 2, lineHeight: 1.45 }}>
                        성공 기준: {truncateWorkOrderPreview(executorWorkOrder.successCriteria, 96)}
                      </div>
                    </div>
                  ) : sessionId && isExecutorIntakeContractCurrent ? (
                    <div style={{ fontSize: 12, color: "#6b7280", lineHeight: 1.5 }}>아직 작업 지시가 없습니다.</div>
                  ) : null}
                  <WorkflowActionButton
                    label={isExecutorWorkOrderCurrent ? "작업 지시 준비됨" : "실행기 작업 지시 준비"}
                    variant="primary"
                    disabled={!sessionId || !actions.canCreateWorkOrder}
                    onClick={pageActions.prepareExecutorWorkOrder}
                  />
                </div>
              </WorkflowCard>
            </div>
          </details>

          <details style={{ border: "1px solid #e8e8ff", borderRadius: 10, padding: 8, background: "#fafbff" }}>
            <summary style={{ cursor: "pointer", fontSize: 12, fontWeight: 900, color: "#4338ca" }}>실행 준비도·기록</summary>
            <div style={{ marginTop: 10, display: "grid", gap: 10 }}>
              <WorkflowCard padding={10}>
                <div style={{ fontSize: 12, fontWeight: 900, marginBottom: 6 }}>실행 준비도</div>
                <div style={{ fontSize: 11, color: "#6b7280", lineHeight: 1.45 }}>파생 점검만 수행합니다. 실제 가동이나 저장소·PR 환경 실행은 시작하지 않습니다.</div>
                <div style={{ marginTop: 8, display: "grid", gap: 6 }}>
                  <div style={{ fontSize: 12, color: "#111827" }}>
                    상태:{" "}
                    {executionReadiness.status === "ready" ? (
                      <span style={{ fontWeight: 900, color: "#166534" }}>준비됨</span>
                    ) : (
                      <span style={{ fontWeight: 900, color: "#b45309" }}>미준비</span>
                    )}
                  </div>
                </div>
              </WorkflowCard>

              <WorkflowCard padding={10}>
                <div style={{ fontSize: 12, fontWeight: 900, marginBottom: 6 }}>실행 의도</div>
                <div style={{ marginTop: 8 }}>
                  <WorkflowActionButton
                    label={isBusinessLaunchIntentCurrent ? "의도 선언됨" : "실행 의도 선언"}
                    variant="primary"
                    disabled={!sessionId || !actions.canDeclareLaunchIntent}
                    onClick={pageActions.declareLaunchIntent}
                  />
                </div>
              </WorkflowCard>

              <WorkflowCard padding={10}>
                <div style={{ fontSize: 12, fontWeight: 900, marginBottom: 6 }}>실행 인수 기록</div>
                <div style={{ marginTop: 8 }}>
                  <WorkflowActionButton
                    label={isBusinessLaunchHandoffRecordCurrent ? "인수 기록됨" : "실행 인수 기록 준비"}
                    variant="primary"
                    disabled={!sessionId || !actions.canRecordLaunchHandoff}
                    onClick={pageActions.prepareLaunchHandoffRecord}
                  />
                </div>
              </WorkflowCard>
            </div>
          </details>

          <details style={{ border: "1px solid #e8e8ff", borderRadius: 10, padding: 8, background: "#fafbff" }}>
            <summary style={{ cursor: "pointer", fontSize: 12, fontWeight: 900, color: "#4338ca" }}>실행 체인(브리지 → 명령)</summary>
            <div style={{ marginTop: 10, display: "grid", gap: 10 }}>
              <WorkflowCard padding={10}>
                <div style={{ fontSize: 12, fontWeight: 900, marginBottom: 6 }}>실행 브리지</div>
                <WorkflowActionButton
                  label={isExecutionBridgePayloadCurrent ? "브리지 준비됨" : "실행 브리지 준비"}
                  variant="primary"
                  disabled={!sessionId || !actions.canPrepareExecutionBridge}
                  onClick={pageActions.prepareExecutionBridge}
                />
              </WorkflowCard>

              <WorkflowCard padding={10}>
                <div style={{ fontSize: 12, fontWeight: 900, marginBottom: 6 }}>실행기 실행 계약</div>
                {isExecutorLaunchContractCurrent && executorLaunchContract ? (
                  <div style={{ fontSize: 10, color: "#0e7490", marginBottom: 6, lineHeight: 1.45, fontStyle: "italic" }}>
                    컨텍스트: {executorLaunchContractContextSummary(executorLaunchContract)}
                    <br />
                    실행 힌트: {executorLaunchHintsPreview(executorLaunchContract.launchHints)}…
                  </div>
                ) : null}
                <WorkflowActionButton
                  label={isExecutorLaunchContractCurrent ? "계약 준비됨" : "실행 계약 준비"}
                  variant="primary"
                  disabled={!sessionId || !actions.canPrepareLaunchContract}
                  onClick={pageActions.prepareExecutorLaunchContract}
                />
              </WorkflowCard>

              <WorkflowCard padding={10}>
                <div style={{ fontSize: 12, fontWeight: 900, marginBottom: 6 }}>실행 트리거 의도</div>
                <WorkflowActionButton
                  label={isExecutionTriggerIntentCurrent ? "트리거 의도 선언됨" : "트리거 의도 선언"}
                  variant="primary"
                  disabled={!sessionId || !actions.canDeclareExecutionTriggerIntent}
                  onClick={pageActions.markExecutionTriggerIntent}
                />
              </WorkflowCard>

              <WorkflowCard padding={10}>
                <div style={{ fontSize: 12, fontWeight: 900, marginBottom: 6 }}>실제 실행 어댑터</div>
                {isActualExecutionAdapterRequestCurrent && actualExecutionAdapterRequest ? (
                  <div style={{ fontSize: 10, color: "#2563eb", marginBottom: 6, lineHeight: 1.45, fontStyle: "italic" }}>
                    페이로드: {actualExecutionAdapterPayloadSummary(actualExecutionAdapterRequest)}
                    <br />
                    힌트: {actualExecutionAdapterExecutorHintPreview(actualExecutionAdapterRequest)}
                  </div>
                ) : null}
                <WorkflowActionButton
                  label={isActualExecutionAdapterRequestCurrent ? "어댑터 준비됨" : "실행 어댑터 준비"}
                  variant="primary"
                  disabled={!sessionId || !actions.canPrepareExecutionAdapter}
                  onClick={pageActions.prepareActualExecutionAdapter}
                />
              </WorkflowCard>

              <WorkflowCard padding={10}>
                <div style={{ fontSize: 12, fontWeight: 900, marginBottom: 6 }}>실제 실행 명령</div>
                {isActualLaunchCommandCurrent && actualLaunchCommand ? (
                  <div style={{ fontSize: 10, color: "#059669", marginBottom: 6, lineHeight: 1.45, fontStyle: "italic" }}>
                    명령: {actualLaunchCommandPayloadSummary(actualLaunchCommand)}
                    <br />
                    힌트: {actualLaunchCommandExecutorHintPreview(actualLaunchCommand)}
                  </div>
                ) : null}
                <WorkflowActionButton
                  label={isActualLaunchCommandCurrent ? "명령 준비됨" : "실행 명령 준비"}
                  variant="primary"
                  disabled={!sessionId || !actions.canPrepareLaunchCommand}
                  onClick={pageActions.prepareActualLaunchCommand}
                />
              </WorkflowCard>
            </div>
          </details>
        </div>
      </details>
    </div>
  );
}
