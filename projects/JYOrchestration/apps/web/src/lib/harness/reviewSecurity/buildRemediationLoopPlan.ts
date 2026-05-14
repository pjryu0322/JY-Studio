/**
 * Harness Phase H6.5 — **Remediation Loop Plan Builder**.
 *
 * `ReviewSecurityIssuePlanningReport`를 입력으로 "검토 → 조치 요청 → 조치 → 재점검 → 최종 검토"
 * 흐름을 dry-run plan으로 표현한다.
 *
 * **절대 원칙(읽기 전용):**
 * - 실제 task 생성, AI멤버 assignment, Cursor execution, 자동 fix, 자동 머지 영향 없음.
 * - 결정론적 step 생성(같은 입력 → 같은 step 시퀀스).
 * - 결과는 항상 `mode === "dry_run_remediation_loop"`.
 */

import type {
  RemediationLoopPlan,
  RemediationLoopStep,
  RemediationLoopStepType,
  ReviewSecurityIssueCandidate,
  ReviewSecurityIssuePlanningFinding,
  ReviewSecurityIssuePlanningReport,
  ReviewSecurityRemediationActionType,
} from "./reviewSecurityIssueTypes";

/** loop step 상한(UI 비대화 방지). */
export const REMEDIATION_LOOP_STEPS_MAX = 8;
/** findings 상한. */
export const REMEDIATION_LOOP_FINDINGS_MAX = 4;

export type BuildRemediationLoopPlanInput = Readonly<{
  issuePlanningReport?: ReviewSecurityIssuePlanningReport | null;
}>;

/** 권장 조치 → actor 역할 라벨. */
const ACTION_TO_ACTOR: Readonly<Record<ReviewSecurityRemediationActionType, string>> = {
  developer_fix: "developer",
  designer_fix: "designer",
  architect_review: "architect",
  security_recheck: "security",
  reviewer_recheck: "reviewer",
  user_decision_required: "user",
};

/** Remediation loop plan 빌더. **결정론적·read-only**. */
export function buildRemediationLoopPlan(
  input: BuildRemediationLoopPlanInput
): RemediationLoopPlan {
  const report = input.issuePlanningReport ?? null;
  const issues = isValidReport(report) ? report.issues : [];

  if (issues.length === 0) {
    return buildEmptyLoop();
  }

  const steps: RemediationLoopStep[] = [];

  // 1) review — AI검수자/AI보안관 후보 확인.
  pushStep(steps, {
    type: "review",
    actorRole: pickReviewerActor(issues),
    description: buildReviewDescription(issues),
  });

  // 2–3) assign + fix — 권장 조치별 actor 분배 후 첫 actor 기준 조치 검토(실행 없음).
  const assignActors = collectUniqueAssignActors(issues);
  if (assignActors.length > 0) {
    pushStep(steps, {
      type: "assign",
      actorRole: assignActors.join(","),
      description: `조치 후보를 actor 역할별로 정리합니다(${assignActors.join(", ")}). 실제 task 생성·assignment는 아닙니다.`,
    });
    pushStep(steps, {
      type: "fix",
      actorRole: assignActors[0] ?? "developer",
      description:
        "권장 actor가 후보 항목에 대해 점검·반영을 검토합니다(실제 코드 변경·Cursor 실행 없음).",
    });
  }

  // 4) recheck — AI검수자/AI보안관 재점검.
  pushStep(steps, {
    type: "recheck",
    actorRole: pickRecheckActor(issues),
    description: "조치 후보 반영 이후 AI검수자/AI보안관이 다시 점검합니다(실제 검사·머지 차단 없음).",
  });

  // 5) final_review — 사람이 최종 확인하기 전 단계의 안내.
  pushStep(steps, {
    type: "final_review",
    actorRole: "user",
    description:
      "사용자가 최종 확인하기 전 단계의 dry-run 요약입니다. 실제 merge gate/이슈 등록은 수행되지 않습니다.",
  });

  const findings = buildLoopFindings(issues, steps);

  return {
    mode: "dry_run_remediation_loop",
    steps: steps.slice(0, REMEDIATION_LOOP_STEPS_MAX),
    findings,
  };
}

// ── internal helpers ────────────────────────────────────────────────────

function isValidReport(
  report: ReviewSecurityIssuePlanningReport | null
): report is ReviewSecurityIssuePlanningReport {
  return Boolean(
    report && report.mode === "dry_run_issue_planning" && Array.isArray(report.issues)
  );
}

function buildEmptyLoop(): RemediationLoopPlan {
  return {
    mode: "dry_run_remediation_loop",
    steps: [],
    findings: [
      {
        code: "REMEDIATION_LOOP_DRY_RUN_ONLY",
        severity: "info",
        message:
          "이슈 후보가 없어 조치 루프 step을 생성하지 않았습니다. 실제 조치 실행/머지 차단/이슈 등록은 어떤 경우에도 수행되지 않습니다.",
      },
    ],
  };
}

function pushStep(
  steps: RemediationLoopStep[],
  step: Omit<RemediationLoopStep, "order">
): void {
  if (steps.length >= REMEDIATION_LOOP_STEPS_MAX) return;
  steps.push({
    order: steps.length + 1,
    ...step,
  });
}

function pickReviewerActor(issues: readonly ReviewSecurityIssueCandidate[]): string {
  const hasSecurity = issues.some(
    (i) =>
      i.area === "security" ||
      i.area === "privacy" ||
      i.recommendedAction === "security_recheck"
  );
  return hasSecurity ? "reviewer+security" : "reviewer";
}

function pickRecheckActor(issues: readonly ReviewSecurityIssueCandidate[]): string {
  const needsSecurityRecheck = issues.some(
    (i) => i.recommendedAction === "security_recheck"
  );
  return needsSecurityRecheck ? "security" : "reviewer";
}

function collectUniqueAssignActors(
  issues: readonly ReviewSecurityIssueCandidate[]
): string[] {
  const seen = new Set<string>();
  for (const issue of issues) {
    const actor = ACTION_TO_ACTOR[issue.recommendedAction];
    if (actor && actor !== "user") seen.add(actor);
  }
  return Array.from(seen).sort();
}

function buildReviewDescription(
  issues: readonly ReviewSecurityIssueCandidate[]
): string {
  const criticalCount = issues.filter((i) => i.severity === "critical_candidate").length;
  if (criticalCount > 0) {
    return `AI검수자/AI보안관이 중요 후보 ${criticalCount}건을 포함한 총 ${issues.length}건의 후보를 검토합니다.`;
  }
  return `AI검수자/AI보안관이 총 ${issues.length}건의 후보를 검토합니다.`;
}

function buildLoopFindings(
  issues: readonly ReviewSecurityIssueCandidate[],
  steps: readonly RemediationLoopStep[]
): readonly ReviewSecurityIssuePlanningFinding[] {
  const findings: ReviewSecurityIssuePlanningFinding[] = [];
  if (issues.some((i) => i.recommendedAction === "user_decision_required")) {
    findings.push({
      code: "USER_DECISION_REQUIRED",
      severity: "warning",
      message:
        "사용자 결정이 필요한 후보가 있습니다. 자동 처리하지 않고 사람의 결정을 기다려야 합니다.",
    });
  }
  if (steps.some((s) => s.type === "final_review")) {
    findings.push({
      code: "REMEDIATION_LOOP_DRY_RUN_ONLY",
      severity: "info",
      message:
        "이 조치 루프는 dry-run 계획이며, 실제 task 생성·Cursor 실행·머지 차단을 수행하지 않습니다.",
    });
  }
  return findings.slice(0, REMEDIATION_LOOP_FINDINGS_MAX);
}
