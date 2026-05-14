/**
 * Harness Phase H6 — **Review / Security Harness Plan Builder**.
 *
 * roleKey + workspaceStage + (executionRoutingPlan / knowledgeActivationPlan / memoryRuntimePlan)
 * 입력으로 "AI검수자/AI보안관이 어떤 기준으로 검토해야 하는가"를 checklist planning metadata로 만든다.
 *
 * **절대 원칙(읽기 전용):**
 * - 실제 보안 스캔·코드 분석·이슈 등록·머지 차단·PR 게이트·remediation 자동 실행 영향 없음.
 * - 결정론적 정렬: 같은 입력은 같은 checklist 순서를 생성.
 * - 결과는 항상 `mode === "dry_run_review_security"`.
 */

import { trimAndClipString } from "@/lib/harness/promptAssembly/internal/harnessPromptAssemblyStrings";
import type { ExecutionRoutingPlan } from "@/lib/harness/executionRouting/executionCapabilityTypes";
import type { KnowledgeActivationPlan } from "@/lib/harness/knowledgeActivation/knowledgeActivationPolicyTypes";
import type { MemoryRuntimePlan } from "@/lib/harness/memoryRuntime/memoryRuntimeTypes";

import type {
  ReviewSecurityArea,
  ReviewSecurityChecklistItem,
  ReviewSecurityFinding,
  ReviewSecurityHarnessPlan,
  ReviewSecurityStandard,
} from "./reviewSecurityHarnessTypes";
import {
  REVIEW_SECURITY_AREA_ORDER,
  REVIEW_SECURITY_CODE_CAPABILITY_BOOSTERS,
  REVIEW_SECURITY_SECURITY_KNOWLEDGE_BOOSTERS,
  REVIEW_SECURITY_STAGE_BOOSTERS,
  REVIEW_SECURITY_STANDARD_ORDER,
  normalizeReviewSecurityRoleKey,
  resolveReviewSecurityRolePolicy,
  reviewSecuritySeverityRank,
} from "./reviewSecurityStandardPolicy";

/** checklist 상한(timeline·UI 비대화 방지). */
export const REVIEW_SECURITY_CHECKLIST_MAX = 24;
/** findings 상한. */
export const REVIEW_SECURITY_FINDINGS_MAX = 6;

export type BuildReviewSecurityHarnessPlanInput = Readonly<{
  /** 현재 turn의 역할(예: `reviewer`). 빈 값이면 default 정책(빈 checklist) 사용. */
  roleKey?: string | null;
  /** 프로젝트 단계 키(예: `deploy-staging`). stage booster 매칭에 사용. */
  workspaceStage?: string | null;
  /** H5 plan(있으면 code/security booster 트리거). */
  executionRoutingPlan?: ExecutionRoutingPlan | null;
  /** H3 plan(있으면 security knowledge booster 트리거). */
  knowledgeActivationPlan?: KnowledgeActivationPlan | null;
  /** H4 plan(현재는 trigger 미사용; 향후 stale 후보 발생 시 finding으로 안내). */
  memoryRuntimePlan?: MemoryRuntimePlan | null;
}>;

/** Review/Security Harness Plan 빌더. **결정론적·read-only**. */
export function buildReviewSecurityHarnessPlan(
  input: BuildReviewSecurityHarnessPlanInput
): ReviewSecurityHarnessPlan {
  const normalizedRoleKey = normalizeReviewSecurityRoleKey(input.roleKey ?? null);
  const roleKeyForPlan = trimAndClipString(input.roleKey, 80) || null;
  const workspaceStage = trimAndClipString(input.workspaceStage, 80) || null;

  const policyItems = resolveReviewSecurityRolePolicy(input.roleKey ?? null);
  const codeCapabilityPresent = hasCodeCapability(input.executionRoutingPlan ?? null);
  const securityKnowledgePresent = hasSecurityKnowledgeCandidate(
    input.knowledgeActivationPlan ?? null
  );
  const stageBoosters = workspaceStage
    ? REVIEW_SECURITY_STAGE_BOOSTERS.filter((b) =>
        b.stageMatcher(workspaceStage.toLowerCase())
      ).map((b) => b.item)
    : [];

  const accumulator = new Map<string, ReviewSecurityChecklistItem>();

  for (const item of policyItems) {
    addChecklist(accumulator, item, normalizedRoleKey || "unknown");
  }
  for (const item of stageBoosters) {
    addChecklist(accumulator, item, normalizedRoleKey || "stage");
  }
  if (codeCapabilityPresent) {
    for (const item of REVIEW_SECURITY_CODE_CAPABILITY_BOOSTERS) {
      addChecklist(accumulator, item, normalizedRoleKey || "developer");
    }
  }
  if (securityKnowledgePresent) {
    for (const item of REVIEW_SECURITY_SECURITY_KNOWLEDGE_BOOSTERS) {
      addChecklist(accumulator, item, normalizedRoleKey || "security");
    }
  }

  const checklist = Array.from(accumulator.values())
    .sort(compareChecklist)
    .slice(0, REVIEW_SECURITY_CHECKLIST_MAX);

  const findings = buildPlanFindings({
    normalizedRoleKey,
    roleHasPolicy: policyItems.length > 0,
    codeCapabilityPresent,
    securityKnowledgePresent,
    securityChecklistCount: checklist.filter((c) => c.area === "security").length,
  });

  return {
    mode: "dry_run_review_security",
    roleKey: roleKeyForPlan,
    workspaceStage,
    checklist,
    findings,
  };
}

// ── internal helpers ────────────────────────────────────────────────────

function addChecklist(
  accumulator: Map<string, ReviewSecurityChecklistItem>,
  item: Omit<ReviewSecurityChecklistItem, "appliesToRole">,
  appliesToRole: string
): void {
  if (accumulator.has(item.id)) return;
  accumulator.set(item.id, {
    ...item,
    appliesToRole,
  });
}

function compareChecklist(
  a: ReviewSecurityChecklistItem,
  b: ReviewSecurityChecklistItem
): number {
  // 결정론적 정렬: severity desc → area order asc → standard order asc → id asc.
  const severityDelta = reviewSecuritySeverityRank(b.severity) - reviewSecuritySeverityRank(a.severity);
  if (severityDelta !== 0) return severityDelta;
  const areaDelta = areaIndex(a.area) - areaIndex(b.area);
  if (areaDelta !== 0) return areaDelta;
  const standardDelta = standardIndex(a.standard) - standardIndex(b.standard);
  if (standardDelta !== 0) return standardDelta;
  return a.id < b.id ? -1 : a.id > b.id ? 1 : 0;
}

function areaIndex(area: ReviewSecurityArea): number {
  const idx = REVIEW_SECURITY_AREA_ORDER.indexOf(area);
  return idx >= 0 ? idx : REVIEW_SECURITY_AREA_ORDER.length;
}

function standardIndex(standard: ReviewSecurityStandard): number {
  const idx = REVIEW_SECURITY_STANDARD_ORDER.indexOf(standard);
  return idx >= 0 ? idx : REVIEW_SECURITY_STANDARD_ORDER.length;
}

function hasCodeCapability(plan: ExecutionRoutingPlan | null): boolean {
  if (!plan || plan.mode !== "dry_run") return false;
  for (const item of plan.items) {
    if (!item) continue;
    if (item.capability === "code_generation" || item.capability === "cursor_execution") return true;
  }
  return false;
}

function hasSecurityKnowledgeCandidate(plan: KnowledgeActivationPlan | null): boolean {
  if (!plan || plan.mode !== "dry_run" || !Array.isArray(plan.items)) return false;
  for (const item of plan.items) {
    if (!item) continue;
    const id = String(item.knowledgePackId ?? "").toLowerCase();
    const label = String(item.reasonLabel ?? "").toLowerCase();
    if (id.includes("security") || id.includes("owasp") || id.includes("cwe") || id.includes("privacy"))
      return true;
    if (label.includes("security") || label.includes("보안")) return true;
  }
  return false;
}

function buildPlanFindings(args: {
  readonly normalizedRoleKey: string;
  readonly roleHasPolicy: boolean;
  readonly codeCapabilityPresent: boolean;
  readonly securityKnowledgePresent: boolean;
  readonly securityChecklistCount: number;
}): readonly ReviewSecurityFinding[] {
  const findings: ReviewSecurityFinding[] = [];

  if (!args.roleHasPolicy) {
    findings.push({
      code: "NO_REVIEW_ROLE_MATCH",
      severity: "info",
      message: args.normalizedRoleKey
        ? `역할 '${args.normalizedRoleKey}'에 매칭되는 review/security 기본 정책이 없습니다.`
        : "역할이 비어 있어 review/security 기본 정책을 매칭하지 못했습니다.",
    });
  }

  if (args.securityChecklistCount > 0) {
    findings.push({
      code: "SECURITY_REVIEW_RECOMMENDED",
      severity: "info",
      message: `security 영역 checklist ${args.securityChecklistCount}건이 권장되었습니다. 실제 보안 스캔/머지 차단은 수행되지 않습니다.`,
    });
  }

  if (args.codeCapabilityPresent && args.securityChecklistCount === 0) {
    findings.push({
      code: "CODE_GENERATION_WITHOUT_SECURITY_CHECKLIST",
      severity: "warning",
      message:
        "code_generation/cursor_execution capability가 감지되었지만 security 영역 checklist 후보가 없습니다. 보안 표준 점검 항목을 보강하세요.",
    });
  }

  if (args.securityKnowledgePresent) {
    findings.push({
      code: "SECURITY_KNOWLEDGE_ACTIVATION_PRESENT",
      severity: "info",
      message:
        "보안 지식팩이 활성화 후보로 감지되어 security 영역 checklist를 보강했습니다(실제 검색·주입은 아님).",
    });
  }

  // 항상 노출되는 dry-run 안내 finding(사용자에게 dry-run임을 재확인).
  findings.push({
    code: "REVIEW_PLAN_DRY_RUN_ONLY",
    severity: "info",
    message:
      "이 계획은 실제 보안 차단이나 머지 게이트가 아니라, 현재 역할과 단계 기준으로 어떤 검토 기준을 적용할지 보여주는 planning metadata입니다.",
  });

  return findings.slice(0, REVIEW_SECURITY_FINDINGS_MAX);
}
