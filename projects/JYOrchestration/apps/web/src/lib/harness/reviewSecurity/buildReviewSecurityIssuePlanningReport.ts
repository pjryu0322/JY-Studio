/**
 * Harness Phase H6.5 — **Review/Security Issue Planning Report Builder**.
 *
 * H6 checklist + H5.5 execution routing safety + H4 memory runtime stale 후보를 입력으로
 * "조치 가능한 이슈 후보(issue candidate)" 목록과 plan-level 진단을 생성한다.
 *
 * **절대 원칙(읽기 전용):**
 * - 실제 이슈 등록·머지 차단·조치 실행·remediation 자동 실행 영향 없음.
 * - 결정론적 정렬: severity desc → status desc → area/standard → id.
 * - 결과는 항상 `mode === "dry_run_issue_planning"`.
 */

import { trimAndClipString } from "@/lib/harness/promptAssembly/internal/harnessPromptAssemblyStrings";
import type { ExecutionRoutingSafetyReport } from "@/lib/harness/executionRouting/executionRoutingSafetyTypes";
import type { KnowledgeActivationPlan } from "@/lib/harness/knowledgeActivation/knowledgeActivationPolicyTypes";
import type { MemoryRuntimePlan } from "@/lib/harness/memoryRuntime/memoryRuntimeTypes";

import type {
  ReviewSecurityArea,
  ReviewSecurityHarnessPlan,
  ReviewSecuritySeverity,
  ReviewSecurityStandard,
} from "./reviewSecurityHarnessTypes";
import { reviewSecuritySeverityRank } from "./reviewSecurityStandardPolicy";
import type {
  ReviewSecurityIssueCandidate,
  ReviewSecurityIssuePlanningFinding,
  ReviewSecurityIssuePlanningReport,
  ReviewSecurityIssueStatus,
  ReviewSecurityRemediationActionType,
} from "./reviewSecurityIssueTypes";

/** issue 상한(timeline·UI 비대화 방지). */
export const REVIEW_SECURITY_ISSUE_MAX = 24;
/** findings 상한. */
export const REVIEW_SECURITY_ISSUE_FINDINGS_MAX = 8;

export type BuildReviewSecurityIssuePlanningReportInput = Readonly<{
  /** H6 plan(없으면 빈 report). */
  reviewSecurityHarnessPlan?: ReviewSecurityHarnessPlan | null;
  /** H5.5 safety report(있고 `unsafe_to_apply`/`watch`면 issue candidate 추가). */
  executionRoutingSafetyReport?: ExecutionRoutingSafetyReport | null;
  /** H3 plan(현재는 trigger 미사용; 향후 보안 지식팩 활성화 시 발생 가능한 issue). */
  knowledgeActivationPlan?: KnowledgeActivationPlan | null;
  /** H4 plan(있고 stale reference가 있으면 memory review issue candidate 추가). */
  memoryRuntimePlan?: MemoryRuntimePlan | null;
}>;

/** Issue planning report 빌더. **결정론적·read-only**. */
export function buildReviewSecurityIssuePlanningReport(
  input: BuildReviewSecurityIssuePlanningReportInput
): ReviewSecurityIssuePlanningReport {
  const accumulator = new Map<string, ReviewSecurityIssueCandidate>();

  collectChecklistIssues(input.reviewSecurityHarnessPlan ?? null, accumulator);
  collectSafetyIssues(input.executionRoutingSafetyReport ?? null, accumulator);
  const staleMemoryCount = collectStaleMemoryIssues(
    input.memoryRuntimePlan ?? null,
    accumulator
  );

  const issues = Array.from(accumulator.values())
    .sort(compareIssue)
    .slice(0, REVIEW_SECURITY_ISSUE_MAX);

  const findings = buildPlanFindings({
    issues,
    safety: input.executionRoutingSafetyReport ?? null,
    staleMemoryCount,
  });

  return {
    mode: "dry_run_issue_planning",
    issues,
    findings,
  };
}

// ── internal helpers ────────────────────────────────────────────────────

function addIssue(
  accumulator: Map<string, ReviewSecurityIssueCandidate>,
  issue: ReviewSecurityIssueCandidate
): void {
  if (!issue.id || accumulator.has(issue.id)) return;
  accumulator.set(issue.id, issue);
}

function collectChecklistIssues(
  plan: ReviewSecurityHarnessPlan | null,
  accumulator: Map<string, ReviewSecurityIssueCandidate>
): void {
  if (!plan || plan.mode !== "dry_run_review_security" || !Array.isArray(plan.checklist)) {
    return;
  }
  for (const item of plan.checklist) {
    if (!item) continue;
    const status = deriveStatus(item.area, item.severity);
    const recommendedAction = deriveRecommendedAction(item.area, item.severity);
    const issue: ReviewSecurityIssueCandidate = {
      id: `checklist:${item.id}`,
      sourceChecklistId: item.id,
      area: item.area,
      standard: item.standard,
      severity: item.severity,
      status,
      title: item.title,
      description: item.description,
      remediationHint: buildChecklistRemediationHint(item.area, item.severity),
      recommendedAction,
      duplicateGroupKey: `${item.area}:${item.standard}`,
    };
    addIssue(accumulator, issue);
  }
}

function collectSafetyIssues(
  safety: ExecutionRoutingSafetyReport | null,
  accumulator: Map<string, ReviewSecurityIssueCandidate>
): void {
  if (!safety || safety.mode !== "dry_run_safety") return;
  if (safety.status === "safe_dry_run") return;
  const area: ReviewSecurityArea = "security";
  const standard: ReviewSecurityStandard = "jy_orchestration_baseline";
  const severity: ReviewSecuritySeverity =
    safety.status === "unsafe_to_apply" ? "critical_candidate" : "warning";
  const status: ReviewSecurityIssueStatus = "needs_review";
  const recommendedAction: ReviewSecurityRemediationActionType =
    safety.status === "unsafe_to_apply" ? "security_recheck" : "reviewer_recheck";
  const title =
    safety.status === "unsafe_to_apply"
      ? "Execution Routing 안전 진단 부적합(검토 권장)"
      : "Execution Routing 관찰 필요(검토 권장)";
  const description = `Execution Routing Safety status=${safety.status}. provider 자동 전환·실행 차단·자동 실행은 모두 비활성화 상태이며 본 항목은 검토 권장 후보입니다.`;
  const issue: ReviewSecurityIssueCandidate = {
    id: `safety:execution_routing:${safety.status}`,
    sourceChecklistId: "synthetic:execution_routing_safety",
    area,
    standard,
    severity,
    status,
    title,
    description,
    remediationHint:
      "AI보안관/AI검수자가 disabled·warning 항목을 다시 점검하고, 미지정 provider/민감 capability 후보를 사람이 확인해야 합니다.",
    recommendedAction,
    duplicateGroupKey: `${area}:${standard}:execution_routing_safety`,
  };
  addIssue(accumulator, issue);
}

function collectStaleMemoryIssues(
  plan: MemoryRuntimePlan | null,
  accumulator: Map<string, ReviewSecurityIssueCandidate>
): number {
  if (!plan || plan.mode !== "dry_run" || !Array.isArray(plan.references)) return 0;
  let staleCount = 0;
  for (const ref of plan.references) {
    if (!ref) continue;
    if (ref.freshness !== "stale") continue;
    staleCount += 1;
  }
  if (staleCount === 0) return 0;
  const area: ReviewSecurityArea = "code_quality";
  const standard: ReviewSecurityStandard = "internal_quality_standard";
  const issue: ReviewSecurityIssueCandidate = {
    id: `memory:stale:${plan.roleKey ?? "unknown"}`,
    sourceChecklistId: "synthetic:memory_runtime_stale",
    area,
    standard,
    severity: "warning",
    status: "needs_review",
    title: `참조 메모리 ${staleCount}건이 오래되었거나 충돌 가능합니다`,
    description:
      "Memory Runtime에서 stale 후보가 감지되어 검토 권장 후보로 추가되었습니다. 실제 메모리 삭제·persistence 영향은 없습니다.",
    remediationHint:
      "AI검수자가 stale 참조 메모리를 다시 확인하고, 오래된 가정이 결과물에 영향을 주었는지 살펴봐야 합니다.",
    recommendedAction: "reviewer_recheck",
    duplicateGroupKey: `${area}:${standard}:memory_stale`,
  };
  addIssue(accumulator, issue);
  return staleCount;
}

function compareIssue(
  a: ReviewSecurityIssueCandidate,
  b: ReviewSecurityIssueCandidate
): number {
  // severity desc.
  const severityDelta = reviewSecuritySeverityRank(b.severity) - reviewSecuritySeverityRank(a.severity);
  if (severityDelta !== 0) return severityDelta;
  // status priority desc(needs_review/needs_remediation 우선, candidate 후순위).
  const statusDelta = statusRank(b.status) - statusRank(a.status);
  if (statusDelta !== 0) return statusDelta;
  // area asc (보안/코드품질 우선; 그 외 alphabet).
  if (a.area !== b.area) return a.area < b.area ? -1 : 1;
  // standard asc.
  if (a.standard !== b.standard) return a.standard < b.standard ? -1 : 1;
  // id asc.
  return a.id < b.id ? -1 : a.id > b.id ? 1 : 0;
}

function statusRank(status: ReviewSecurityIssueStatus): number {
  switch (status) {
    case "needs_review":
      return 3;
    case "needs_remediation":
      return 2;
    case "ready_for_recheck":
      return 1;
    default:
      return 0;
  }
}

/** area/severity 조합으로 issue status 도출. */
function deriveStatus(
  area: ReviewSecurityArea,
  severity: ReviewSecuritySeverity
): ReviewSecurityIssueStatus {
  if (severity === "critical_candidate") return "needs_review";
  if (area === "security" || area === "privacy") return "needs_review";
  if (area === "code_quality" && severity === "warning") return "needs_review";
  return "candidate";
}

/** area/severity 조합으로 권장 조치 유형 도출. */
function deriveRecommendedAction(
  area: ReviewSecurityArea,
  severity: ReviewSecuritySeverity
): ReviewSecurityRemediationActionType {
  if (severity === "critical_candidate") {
    return area === "security" || area === "privacy"
      ? "security_recheck"
      : "reviewer_recheck";
  }
  switch (area) {
    case "security":
    case "privacy":
      return "security_recheck";
    case "uiux":
      return "designer_fix";
    case "architecture":
    case "deployment":
    case "operations":
      return "architect_review";
    case "code_quality":
      return "developer_fix";
    case "requirements":
      return "reviewer_recheck";
    default:
      return "reviewer_recheck";
  }
}

const CHECKLIST_REMEDIATION_HINTS: Readonly<Record<ReviewSecurityArea, string>> = {
  requirements: "AI검수자가 요구사항/스토리/acceptance criteria 충족 여부를 다시 확인합니다.",
  architecture: "AI아키텍트가 결정과 책임 경계가 일관되는지 점검합니다.",
  uiux: "AI디자이너가 UI 일관성·접근성 후보 항목을 확인합니다.",
  code_quality: "AI개발자가 테스트·정적 분석·경계 케이스 보강 여부를 점검합니다.",
  security: "AI보안관이 보안 표준 기준으로 결함 후보를 점검합니다.",
  privacy: "AI보안관이 개인정보/민감정보 처리 경로를 확인합니다.",
  deployment: "AI아키텍트가 환경 분리·롤백 안전성을 점검합니다.",
  operations: "AI아키텍트가 관찰성·운영 핸드오프를 점검합니다.",
};

function buildChecklistRemediationHint(
  area: ReviewSecurityArea,
  severity: ReviewSecuritySeverity
): string {
  const base = CHECKLIST_REMEDIATION_HINTS[area] ?? "AI검수자가 항목을 다시 확인합니다.";
  if (severity === "critical_candidate") {
    return `${base} 중요 후보이므로 사람이 최종 확인하기 전까지는 실행에 반영하지 않습니다.`;
  }
  return base;
}

function buildPlanFindings(args: {
  readonly issues: readonly ReviewSecurityIssueCandidate[];
  readonly safety: ExecutionRoutingSafetyReport | null;
  readonly staleMemoryCount: number;
}): readonly ReviewSecurityIssuePlanningFinding[] {
  const findings: ReviewSecurityIssuePlanningFinding[] = [];

  const criticalCount = args.issues.filter(
    (i) => i.severity === "critical_candidate"
  ).length;
  if (criticalCount > 0) {
    findings.push({
      code: "CRITICAL_CANDIDATE_PRESENT",
      severity: "warning",
      message: `중요 후보 이슈 ${criticalCount}건이 감지되었습니다. 사람이 직접 확인하기 전까지는 적용을 보류해야 합니다.`,
    });
  }

  const securityRecheckNeeded = args.issues.some(
    (i) => i.recommendedAction === "security_recheck"
  );
  if (securityRecheckNeeded) {
    findings.push({
      code: "SECURITY_RECHECK_RECOMMENDED",
      severity: "info",
      message:
        "보안 영역에서 재점검 권장 후보가 있습니다. AI보안관 재검토 후보로 다뤄야 합니다.",
    });
  }

  if (args.safety && args.safety.mode === "dry_run_safety") {
    if (args.safety.status === "unsafe_to_apply") {
      findings.push({
        code: "EXECUTION_ROUTING_UNSAFE_REVIEW_REQUIRED",
        severity: "warning",
        message: trimAndClipString(
          "Execution Routing Safety가 unsafe_to_apply 상태입니다. 자동 실행은 비활성화되어 있으며, 사람이 검토해야 합니다.",
          240
        ),
      });
    } else if (args.safety.status === "watch") {
      findings.push({
        code: "EXECUTION_ROUTING_WATCH_REVIEW_RECOMMENDED",
        severity: "info",
        message:
          "Execution Routing Safety가 watch 상태입니다. 자동 실행은 비활성화되어 있으며, 모니터링 권장 후보입니다.",
      });
    }
  }

  if (args.staleMemoryCount > 0) {
    findings.push({
      code: "STALE_MEMORY_REVIEW_RECOMMENDED",
      severity: "info",
      message: `Memory Runtime에서 stale 후보 ${args.staleMemoryCount}건이 감지되었습니다. 검토 후보로 다뤄야 합니다.`,
    });
  }

  findings.push({
    code: "ISSUE_PLAN_DRY_RUN_ONLY",
    severity: "info",
    message:
      "이 정보는 실제 이슈 등록이나 머지 차단이 아니라, 검토 결과를 어떻게 조치 후보로 정리할지 보여주는 계획 정보입니다.",
  });

  return findings.slice(0, REVIEW_SECURITY_ISSUE_FINDINGS_MAX);
}
