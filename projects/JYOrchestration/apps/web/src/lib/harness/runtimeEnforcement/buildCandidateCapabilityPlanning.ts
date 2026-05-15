/**
 * H11 — capability별 **후보·차단·계획** 행(read-only). 실제 enforcement 없음.
 */

import type { HarnessMaturityBaselineReport, HarnessReleaseGateReadinessReport } from "@/lib/harness/maturity/harnessMaturityTypes";
import type { ExtractedOverlayPromptTraceMetadata } from "@/lib/overlay/overlayPromptTraceExtract";
import { evaluateResourcePressure } from "@/lib/harness/resourceStabilization/evaluateResourcePressure";
import type { RuntimeGovernancePlanningContext } from "@/lib/harness/runtimeGovernance/buildRuntimeGovernancePlanningContext";
import type {
  CandidateCapabilityKind,
  CandidateCapabilityPlanningReport,
  CandidateCapabilityPlanningRow,
  CandidateCapabilityStatus,
  RuntimeEnforcementCandidateReport,
} from "./runtimeEnforcementCandidateTypes";

function row(
  kind: CandidateCapabilityKind,
  labelKo: string,
  status: CandidateCapabilityStatus,
  noteKo: string
): CandidateCapabilityPlanningRow {
  return { kind, labelKo, status, noteKo };
}

export function buildCandidateCapabilityPlanning(input: {
  readonly baseline: HarnessMaturityBaselineReport;
  readonly releaseGate: HarnessReleaseGateReadinessReport;
  readonly governanceCtx: RuntimeGovernancePlanningContext;
  readonly candidateReport: RuntimeEnforcementCandidateReport;
  readonly extract: ExtractedOverlayPromptTraceMetadata | null | undefined;
  readonly messageExplainabilityAvailable: boolean;
}): CandidateCapabilityPlanningReport {
  const pressure = evaluateResourcePressure(input.extract);
  const { governance, rollbackSafety, trialReadiness } = input.governanceCtx;

  const explainOk = input.messageExplainabilityAvailable && input.baseline.userVisibleSummaryReady;
  const gateOk = input.releaseGate.readinessLevel === "candidate_for_manual_review";
  const trialOk = trialReadiness.readinessLevel === "ready_for_documented_trial";
  const govOk = governance.approvalMode !== "disabled" && governance.governanceRisk !== "high";
  const rbOk = rollbackSafety.rollbackRisk !== "high";
  const pressureOk = pressure.pressureSeverity !== "critical" && pressure.pressureSeverity !== "high";

  const baseCandidate = input.candidateReport.candidateEligible;
  const releaseBlocked = input.releaseGate.readinessLevel === "not_ready";
  const retrievalBlocked =
    releaseBlocked || trialReadiness.readinessLevel === "not_prepared" || pressure.pressureSeverity === "critical";

  const providerStatus: CandidateCapabilityStatus = baseCandidate && pressureOk ? "candidate" : "planning_only";
  const retrievalStatus: CandidateCapabilityStatus = retrievalBlocked
    ? "blocked"
    : baseCandidate && gateOk && trialOk
      ? "candidate"
      : "planning_only";
  const executionStatus: CandidateCapabilityStatus =
    baseCandidate && govOk && explainOk
      ? "candidate"
      : trialReadiness.readinessLevel === "not_prepared" || !explainOk
        ? "blocked"
        : "planning_only";
  const approvalStatus: CandidateCapabilityStatus =
    governance.operatorReviewReadiness === "required" && baseCandidate ? "candidate" : "planning_only";
  const rollbackStatus: CandidateCapabilityStatus = rbOk && trialOk ? (baseCandidate ? "candidate" : "planning_only") : "blocked";

  const rows: CandidateCapabilityPlanningRow[] = [
    row(
      "provider_routing",
      "프로바이더 라우팅 후보",
      providerStatus,
      providerStatus === "candidate"
        ? "자원 압력이 허용 범위일 때만 후보로 문서화 가능(실제 전환 없음)."
        : "압력·거버넌스 조건으로 후보 적용은 계획 단계로 제한."
    ),
    row(
      "retrieval_orchestration",
      "검색 오케스트레이션 후보",
      retrievalStatus,
      retrievalStatus === "blocked"
        ? "Release gate 또는 시험 준비도·압력 조건으로 후보에서 제외."
        : "수동 검토·통제 시험 설계 하에서만 후보로 간주."
    ),
    row(
      "execution_gating",
      "실행 게이팅 후보",
      executionStatus,
      executionStatus === "blocked"
        ? "시험 미준비·Explainability 불안정·거버넌스 리스크로 실행 게이팅 후보 차단."
        : "Dry-run·경고 경로만 유지; 실제 차단 없음."
    ),
    row(
      "approval_gating",
      "승인 게이팅 후보",
      approvalStatus,
      "운영자 검토·외부 승인 절차가 전제일 때만 후보로 표시(자동 승인 없음)."
    ),
    row(
      "rollback",
      "롤백 후보",
      rollbackStatus,
      rollbackStatus === "blocked"
        ? "롤백 안전 등급이 높아 후보 적용 전 완화 필요."
        : "문서·dry-run 롤백 시나리오만 후보."
    ),
  ];

  return {
    mode: "candidate_capability_planning_only",
    actualEnforcementEnabled: false,
    rows,
  };
}

export function serializeCandidateCapabilityPlanningForDiagnostic(
  report: CandidateCapabilityPlanningReport
): Readonly<Record<string, unknown>> {
  return {
    mode: report.mode,
    actualEnforcementEnabled: report.actualEnforcementEnabled,
    rows: report.rows.map((r) => ({
      kind: r.kind,
      labelKo: r.labelKo,
      status: r.status,
      noteKo: r.noteKo,
    })),
  };
}
